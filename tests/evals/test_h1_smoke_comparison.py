from __future__ import annotations

import tempfile
import unittest
from unittest.mock import patch

from fractal_agent_lab.evals import COMPARABLE_OUTPUT_KEYS, H1_SMOKE_VARIANTS, run_h1_smoke_comparison
from scripts.run_l1_i_h1_smoke_comparison import is_success_summary


class H1SmokeComparisonTests(unittest.TestCase):
    def test_runs_all_variants_with_valid_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            report = run_h1_smoke_comparison(
                input_payload={"idea": "AI founder assistant for startup idea refinement"},
                provider="mock",
                data_dir=tmp_dir,
            )

        summary = report["summary"]
        self.assertEqual(3, summary["variant_count"])
        self.assertTrue(summary["all_succeeded"])
        self.assertTrue(summary["all_artifacts_valid"])
        self.assertTrue(summary["all_comparable_output_envelopes_present"])
        self.assertTrue(summary["all_comparable_outputs_complete"])
        self.assertTrue(summary["all_comparable_outputs_present"])

    def test_report_contains_variant_specific_orchestration_signals(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            report = run_h1_smoke_comparison(
                input_payload={"idea": "AI founder assistant for startup idea refinement"},
                provider="mock",
                data_dir=tmp_dir,
            )

        variants = {entry["workflow_id"]: entry for entry in report["variants"]}
        self.assertEqual(set(H1_SMOKE_VARIANTS), set(variants))

        manager = variants["h1.manager.v1"]
        self.assertEqual("succeeded", manager["status"])
        self.assertIsNotNone(manager["orchestration"]["manager"])
        self.assertGreater(manager["orchestration"]["manager"]["turn_count"], 0)

        handoff = variants["h1.handoff.v1"]
        self.assertEqual("succeeded", handoff["status"])
        self.assertIsNotNone(handoff["orchestration"]["handoff"])
        self.assertGreater(handoff["trace"]["handoff_event_counts"]["handoff_decided"], 0)

        baseline = variants["h1.single.v1"]
        self.assertEqual("succeeded", baseline["status"])
        self.assertIn("linear", baseline["trace"]["lane_counts"])

        for variant in variants.values():
            comparable = variant["comparable_output"]
            self.assertTrue(comparable["present"])
            self.assertTrue(comparable["complete"])
            self.assertEqual(sorted(COMPARABLE_OUTPUT_KEYS), sorted(comparable["fields"]))
            self.assertEqual([], comparable["missing_keys"])

    def test_summary_fails_when_comparable_keys_are_missing_even_with_envelope(self) -> None:
        with patch(
            "fractal_agent_lab.evals.h1_smoke_comparison.COMPARABLE_OUTPUT_KEYS",
            tuple(COMPARABLE_OUTPUT_KEYS) + ("nonexistent_comparison_key",),
        ):
            with tempfile.TemporaryDirectory() as tmp_dir:
                report = run_h1_smoke_comparison(
                    input_payload={"idea": "AI founder assistant for startup idea refinement"},
                    provider="mock",
                    data_dir=tmp_dir,
                )

        summary = report["summary"]
        self.assertTrue(summary["all_succeeded"])
        self.assertTrue(summary["all_artifacts_valid"])
        self.assertTrue(summary["all_comparable_output_envelopes_present"])
        self.assertFalse(summary["all_comparable_outputs_complete"])
        self.assertFalse(summary["all_comparable_outputs_present"])

        variants = {entry["workflow_id"]: entry for entry in report["variants"]}
        for workflow_id in H1_SMOKE_VARIANTS:
            comparable = variants[workflow_id]["comparable_output"]
            self.assertTrue(comparable["present"])
            self.assertFalse(comparable["complete"])
            self.assertIn("nonexistent_comparison_key", comparable["missing_keys"])

    def test_script_summary_gate_requires_comparable_output_completeness(self) -> None:
        self.assertTrue(
            is_success_summary(
                {
                    "all_succeeded": True,
                    "all_artifacts_valid": True,
                    "all_comparable_outputs_complete": True,
                },
            ),
        )
        self.assertFalse(
            is_success_summary(
                {
                    "all_succeeded": True,
                    "all_artifacts_valid": True,
                    "all_comparable_outputs_complete": False,
                },
            ),
        )

    def test_real_provider_override_is_rejected_in_wave3_scope(self) -> None:
        with self.assertRaises(ValueError):
            run_h1_smoke_comparison(
                input_payload={"idea": "AI founder assistant for startup idea refinement"},
                provider="openrouter",
            )


if __name__ == "__main__":
    unittest.main()
