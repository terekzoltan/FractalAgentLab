from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.w6_usefulness_evaluation import (
    W6UsefulnessEvaluationError,
    evaluate_w6_usefulness,
)

W6D_LOOP_ID = "w6d-fal-w6bc-review-fix-20260508"
W6E_LOOP_ID = "w6e-fal-project-state-protocol-20260511"


class W6UsefulnessEvaluationTests(unittest.TestCase):
    def test_valid_fal_only_warning_rows_write_private_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            output_dir = Path(temp_dir_raw) / "eval" / "w6f-usefulness-evaluation-v1"
            summary = evaluate_w6_usefulness(
                [
                    _seed_row(loop_id=W6D_LOOP_ID, complexity_class="shared_boundary", real_issues=2),
                    _seed_row(loop_id=W6E_LOOP_ID, complexity_class="governance_context_continuity", real_issues=1),
                ],
                output_dir=output_dir,
            )

            rows_jsonl = output_dir / "usefulness_rows.jsonl"
            summary_json = output_dir / "usefulness_summary.json"

            self.assertTrue(rows_jsonl.exists())
            self.assertTrue(summary_json.exists())
            self.assertEqual("w6.usefulness_evaluation.v1", summary["schema_version"])
            self.assertEqual("private_raw", summary["privacy_classification"])
            self.assertFalse(summary["public_safe"])
            self.assertEqual("optional", summary["overall_recommendation"])
            self.assertEqual("low", summary["confidence"])
            self.assertTrue(summary["fal_only_evidence"])
            self.assertFalse(summary["external_evidence_present"])
            self.assertIn("external target evidence is still missing", " ".join(summary["known_limits"]))
            self.assertNotIn("packet_id", summary_json.read_text(encoding="utf-8"))
            self.assertNotIn("operator_transition_validation", rows_jsonl.read_text(encoding="utf-8"))

    def test_warning_clean_pass_false_insufficient_rows_do_not_become_recommended(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            summary = evaluate_w6_usefulness(
                [
                    _seed_row(loop_id=W6D_LOOP_ID, complexity_class="shared_boundary", real_issues=2),
                    _seed_row(loop_id=W6E_LOOP_ID, complexity_class="shared_boundary", real_issues=1),
                ],
                output_dir=Path(temp_dir_raw),
            )

        self.assertNotEqual("recommended", summary["overall_recommendation"])
        self.assertEqual("optional", summary["overall_recommendation"])
        self.assertEqual("low", summary["per_class_evaluations"][0]["confidence"])

    def test_duplicate_loop_ids_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            with self.assertRaises(W6UsefulnessEvaluationError):
                evaluate_w6_usefulness(
                    [_seed_row(loop_id="duplicate"), _seed_row(loop_id="duplicate")],
                    output_dir=Path(temp_dir_raw),
                )

    def test_wrong_schema_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            row = _seed_row(loop_id="bad-schema")
            row["schema_version"] = "wrong"

            with self.assertRaises(W6UsefulnessEvaluationError):
                evaluate_w6_usefulness([row], output_dir=Path(temp_dir_raw))

    def test_public_or_non_private_row_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            row = _seed_row(loop_id="public-claim")
            row["privacy_classification"] = "sanitized_public"

            with self.assertRaises(W6UsefulnessEvaluationError):
                evaluate_w6_usefulness([row], output_dir=Path(temp_dir_raw))

    def test_failed_transition_yields_dangerous_recommendation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            row_a = _seed_row(loop_id=W6D_LOOP_ID)
            row_b = _seed_row(loop_id=W6E_LOOP_ID)
            row_a["transition_validation"] = {"source": "computed_w6_b", "status": "fail"}

            summary = evaluate_w6_usefulness([row_a, row_b], output_dir=Path(temp_dir_raw))

        self.assertEqual("dangerous", summary["overall_recommendation"])
        self.assertEqual("keep_w6g_blocked_and_do_not_expand_automation", summary["bridge_readiness_implication"])

    def test_overhead_without_audit_value_yields_not_worth_it(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            row_a = _seed_row(loop_id=W6D_LOOP_ID, real_issues=0, copy_paste_avoided=0)
            row_b = _seed_row(loop_id=W6E_LOOP_ID, real_issues=0, copy_paste_avoided=0)

            summary = evaluate_w6_usefulness([row_a, row_b], output_dir=Path(temp_dir_raw))

        self.assertEqual("not_worth_it", summary["overall_recommendation"])

    def test_one_row_default_evaluation_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            with self.assertRaisesRegex(W6UsefulnessEvaluationError, r"requires W6-D \+ W6-E seed rows"):
                evaluate_w6_usefulness([_seed_row(loop_id=W6D_LOOP_ID)], output_dir=Path(temp_dir_raw))

    def test_unsupported_transition_status_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            row_a = _seed_row(loop_id=W6D_LOOP_ID)
            row_b = _seed_row(loop_id=W6E_LOOP_ID)
            row_a["transition_validation"] = {"source": "computed_w6_b", "status": "mystery"}

            with self.assertRaisesRegex(W6UsefulnessEvaluationError, "transition_validation.status"):
                evaluate_w6_usefulness([row_a, row_b], output_dir=Path(temp_dir_raw))

    def test_missing_transition_source_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            row_a = _seed_row(loop_id=W6D_LOOP_ID)
            row_b = _seed_row(loop_id=W6E_LOOP_ID)
            row_a["transition_validation"] = {"status": "pass"}

            with self.assertRaisesRegex(W6UsefulnessEvaluationError, "transition_validation.source"):
                evaluate_w6_usefulness([row_a, row_b], output_dir=Path(temp_dir_raw))

    def test_wrong_transition_source_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            row_a = _seed_row(loop_id=W6D_LOOP_ID)
            row_b = _seed_row(loop_id=W6E_LOOP_ID)
            row_a["transition_validation"] = {"source": "operator_context_only", "status": "pass"}

            with self.assertRaisesRegex(W6UsefulnessEvaluationError, "transition_validation.source"):
                evaluate_w6_usefulness([row_a, row_b], output_dir=Path(temp_dir_raw))

    def test_supported_non_pass_transition_statuses_are_not_advisory_positive(self) -> None:
        for status in ("warning", "fail", "unavailable"):
            with self.subTest(status=status):
                with tempfile.TemporaryDirectory() as temp_dir_raw:
                    row_a = _seed_row(loop_id=W6D_LOOP_ID, complexity_class="shared_boundary")
                    row_b = _seed_row(loop_id=W6E_LOOP_ID, complexity_class="shared_boundary")
                    row_a["transition_validation"] = {"source": "computed_w6_b", "status": status}
                    row_b["transition_validation"] = {"source": "computed_w6_b", "status": status}

                    summary = evaluate_w6_usefulness([row_a, row_b], output_dir=Path(temp_dir_raw))

                self.assertNotEqual("optional", summary["overall_recommendation"])
                self.assertNotEqual("recommended", summary["overall_recommendation"])
                self.assertNotIn("may_support", summary["bridge_readiness_implication"])


def _seed_row(
    *,
    loop_id: str = "loop-1",
    complexity_class: str = "shared_boundary",
    real_issues: int = 1,
    copy_paste_avoided: int = 2,
) -> dict[str, object]:
    return {
        "schema_version": "w6.usefulness_seed_row.v1",
        "created_at": "2026-05-11T00:00:00+00:00",
        "loop_id": loop_id,
        "target_repo": "FractalAgentLab",
        "sequence_ref": "W6-S2/W6-F/test",
        "task_type": "test_task",
        "complexity_class": complexity_class,
        "mode": "fal_evidence_backed",
        "manual_copy_paste_steps": 5,
        "copy_paste_avoided_count": copy_paste_avoided,
        "operator_interruptions_required": 0,
        "missing_tests_count": 1,
        "real_issues_caught_count": real_issues,
        "false_positive_findings_count": 0,
        "review_findings_count": real_issues,
        "packet_validation_warning_count": 0,
        "recorder_warning_count": 0,
        "operator_transition_validation": {"status": "operator_context_only"},
        "transition_validation": {
            "source": "computed_w6_b",
            "status": "pass",
            "passed": True,
            "closed": True,
            "commit_ready_candidate": True,
        },
        "clean_pass_blockers": [
            "final_status_not_pass:pass_with_warnings",
            "missing_or_skipped_tests_present",
        ],
        "final_status": "pass_with_warnings",
        "net_recommendation": "insufficient_data",
        "claim_boundary": "single_loop_seed_row_only_not_broad_usefulness_claim",
        "privacy_classification": "private_raw",
    }


if __name__ == "__main__":
    unittest.main()
