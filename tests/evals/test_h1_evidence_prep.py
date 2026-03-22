from __future__ import annotations

import tempfile
import unittest
from unittest.mock import patch

from fractal_agent_lab.evals import TRACE_VIEWER_FIELDS, prepare_h1_evidence_prep
from scripts.run_l1_l_h1_evidence_prep import is_evidence_structurally_ready


class H1EvidencePrepTests(unittest.TestCase):
    def test_evidence_prep_contains_prompt_provenance_and_trace_guidance(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            report = prepare_h1_evidence_prep(
                input_payload={"idea": "AI founder assistant for startup idea refinement"},
                provider="mock",
                rubric_outcome="PASS",
                data_dir=tmp_dir,
            )

        self.assertEqual("l1_l.h1_evidence_prep.v1", report["report_version"])
        self.assertTrue(is_evidence_structurally_ready(report))

        summary = report["comparison_summary"]
        self.assertTrue(summary["all_succeeded"])
        self.assertTrue(summary["all_artifacts_valid"])
        self.assertTrue(summary["all_comparable_outputs_complete"])

        provenance = report["cross_variant_prompt_provenance"]
        self.assertTrue(provenance["all_pack_prompt_versions_explicit"])
        self.assertTrue(provenance["within_same_prompt_family"])
        self.assertIn("h1.single.v1", provenance["by_workflow"])
        self.assertIn("h1.manager.v1", provenance["by_workflow"])
        self.assertIn("h1.handoff.v1", provenance["by_workflow"])

        guidance = report["trace_viewer_guidance"]
        self.assertEqual(list(TRACE_VIEWER_FIELDS), guidance["recommended_fields"])

    def test_prompt_tags_are_not_structural_success_gate(self) -> None:
        with patch("fractal_agent_lab.evals.h1_smoke_comparison.build_h1_prompt_tags", return_value=None):
            with tempfile.TemporaryDirectory() as tmp_dir:
                report = prepare_h1_evidence_prep(
                    input_payload={"idea": "AI founder assistant for startup idea refinement"},
                    provider="mock",
                    data_dir=tmp_dir,
                )

        self.assertTrue(is_evidence_structurally_ready(report))
        provenance = report["cross_variant_prompt_provenance"]
        self.assertFalse(provenance["all_pack_prompt_versions_explicit"])

    def test_script_readiness_gate_uses_structural_comparison_summary(self) -> None:
        self.assertTrue(
            is_evidence_structurally_ready(
                {
                    "comparison_summary": {
                        "all_succeeded": True,
                        "all_artifacts_valid": True,
                        "all_comparable_outputs_complete": True,
                    },
                },
            ),
        )
        self.assertFalse(
            is_evidence_structurally_ready(
                {
                    "comparison_summary": {
                        "all_succeeded": True,
                        "all_artifacts_valid": True,
                        "all_comparable_outputs_complete": False,
                    },
                },
            ),
        )


if __name__ == "__main__":
    unittest.main()
