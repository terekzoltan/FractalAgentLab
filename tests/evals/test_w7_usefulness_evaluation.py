from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.w7_usefulness_evaluation import (
    W7UsefulnessEvaluationError,
    evaluate_w7_usefulness,
)


class W7UsefulnessEvaluationTests(unittest.TestCase):
    def test_valid_w7_evidence_produces_private_no_claim_summary(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            output_dir = Path(temp_dir_raw) / "data" / "evidence" / "wave7" / "eval" / "w7f-usefulness-evaluation-v1"
            summary = evaluate_w7_usefulness(
                _valid_rows(),
                residual_semantic_non_leakage_risk_status="in-scope now",
                w7_g_recommendation="open_docs_only_review",
                output_dir=output_dir,
            )

            summary_text = (output_dir / "usefulness_summary.json").read_text(encoding="utf-8")
            rows_text = (output_dir / "usefulness_rows.jsonl").read_text(encoding="utf-8")

        self.assertEqual("w7.usefulness_evaluation.v1", summary["schema_version"])
        self.assertEqual("APPROVE_WITH_RESIDUAL_RISK", summary["review_verdict"])
        self.assertEqual("PASS", summary["usefulness_verdict"])
        self.assertEqual("narrow_continue", summary["recommendation"])
        self.assertEqual("pass", summary["manual_bookkeeping_verdict"])
        self.assertEqual("pass", summary["audit_replay_verdict"])
        self.assertEqual("pass", summary["learning_input_trust_verdict"])
        self.assertEqual("in-scope now", summary["residual_semantic_non_leakage_risk_status"])
        self.assertEqual("open_docs_only_review", summary["w7_g_recommendation"])
        self.assertEqual("meta_may_consider_docs_first_w8_after_w7_f_meta", summary["w8_gate_recommendation"])
        self.assertFalse(summary["public_safe"])
        self.assertFalse(any(summary["no_claims"].values()))
        self.assertNotIn("docs/public", summary_text)
        self.assertNotIn("public export approved", summary_text.lower())
        self.assertNotIn("PRIVATE SELECTED OUTPUT BODY", rows_text)

    def test_missing_residual_risk_classification_is_rejected(self) -> None:
        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "residual_semantic_non_leakage_risk_status"):
            evaluate_w7_usefulness(
                _valid_rows(),
                residual_semantic_non_leakage_risk_status="",
            )

    def test_w7_g_authorization_claim_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[0]["summary"] = "W7-G is authorized for advisory suggestion implementation."

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "forbidden claim"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_compact_w7g_authorization_claim_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[0]["summary"] = "W7G authorized for implementation."

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "w7-g authorization"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_mixed_case_w7g_authorization_claim_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[0]["summary"] = "w7g Authorized for implementation."

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "w7-g authorization"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_public_safe_or_release_claim_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[1]["public_safe"] = True

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "public_safe"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_malformed_public_safe_value_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[1]["public_safe"] = "true"

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "exactly False"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_natural_public_release_approval_claim_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[1]["summary"] = "Public release approval is granted for this W7 evidence."

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "public release approval"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_bridge_session_api_permission_claim_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[1]["evidence_refs"] = ["bridge/API/session delivery authorized by W7-F"]

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "forbidden claim"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_public_output_dir_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            public_dir = Path(temp_dir_raw) / "docs" / "public" / "w7-f"

            with self.assertRaisesRegex(W7UsefulnessEvaluationError, "public output path"):
                evaluate_w7_usefulness(
                    _valid_rows(),
                    residual_semantic_non_leakage_risk_status="not-yet-in-scope",
                    output_dir=public_dir,
                )

    def test_duplicate_evidence_ids_are_rejected(self) -> None:
        rows = _valid_rows()
        rows[1]["evidence_id"] = rows[0]["evidence_id"]

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "Duplicate W7 evidence_id"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_whitespace_padded_evidence_id_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[1]["evidence_id"] = f" {rows[0]['evidence_id']} "

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "evidence_id must not contain"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_unrelated_source_epic_is_rejected_before_pass_summary(self) -> None:
        rows = _valid_rows()
        for row in rows:
            row["source_epic"] = "UNRELATED"
            row["evidence_refs"] = ["not-real"]

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "dimension=manual_bookkeeping source_epic=UNRELATED expected=W7-D"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_source_epic_whitespace_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[0]["source_epic"] = " W7-D "

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "source_epic must not contain"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_evidence_ref_whitespace_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[0]["evidence_refs"] = [" ca1167d "]

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "evidence_refs must not contain"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_valid_source_with_fake_evidence_refs_is_rejected_for_each_dimension(self) -> None:
        for dimension in ("manual_bookkeeping", "audit_replay", "learning_input_trust"):
            with self.subTest(dimension=dimension):
                rows = _valid_rows()
                for row in rows:
                    if row["dimension"] == dimension:
                        row["evidence_refs"] = ["not-real"]

                with self.assertRaisesRegex(
                    W7UsefulnessEvaluationError,
                    rf"dimension={dimension} invalid_refs=\['not-real'\] expected=",
                ):
                    evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_mixed_valid_and_fake_evidence_refs_are_rejected_for_each_dimension(self) -> None:
        valid_marker_by_dimension = {
            "manual_bookkeeping": "ca1167d",
            "audit_replay": "4d11484",
            "learning_input_trust": "227fd11",
        }
        for dimension, valid_marker in valid_marker_by_dimension.items():
            with self.subTest(dimension=dimension):
                rows = _valid_rows()
                for row in rows:
                    if row["dimension"] == dimension:
                        row["evidence_refs"] = [valid_marker, "not-real"]

                with self.assertRaisesRegex(W7UsefulnessEvaluationError, "invalid evidence_refs"):
                    evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_wrong_dimension_evidence_ref_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[0]["evidence_refs"] = ["4d11484"]

        with self.assertRaisesRegex(
            W7UsefulnessEvaluationError,
            r"dimension=manual_bookkeeping invalid_refs=\['4d11484'\] expected=",
        ):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_missing_usefulness_dimension_cannot_continue(self) -> None:
        rows = [row for row in _valid_rows() if row["dimension"] != "learning_input_trust"]

        summary = evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="already resolved")

        self.assertEqual("INSUFFICIENT_EVIDENCE", summary["usefulness_verdict"])
        self.assertEqual("insufficient_evidence", summary["recommendation"])
        self.assertEqual("missing", summary["learning_input_trust_verdict"])

    def test_weak_evidence_cannot_continue(self) -> None:
        rows = _valid_rows()
        rows[2]["dimension_verdict"] = "weak"

        summary = evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="already resolved")

        self.assertEqual("PARTIAL", summary["usefulness_verdict"])
        self.assertEqual("hold", summary["recommendation"])
        self.assertIn("learning_input_trust", summary["weak_dimensions"])

    def test_forbidden_claims_field_is_rejected(self) -> None:
        rows = _valid_rows()
        rows[2]["forbidden_claims"] = ["commit/push automation"]

        with self.assertRaisesRegex(W7UsefulnessEvaluationError, "forbidden claims"):
            evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_seed_row_no_claims_key_is_rejected(self) -> None:
        no_claims_values = (
            {"w7_g_authorized": "W7G authorized for implementation", "public_release": True},
            {},
            {
                "public_release": False,
                "bridge_api_session_delivery": False,
                "dispatch_commit_push_automation": False,
                "w7_g_authorized": False,
                "semantic_non_leakage_proven": False,
            },
        )
        for no_claims in no_claims_values:
            with self.subTest(no_claims=no_claims):
                rows = _valid_rows()
                rows[0]["no_claims"] = no_claims

                with self.assertRaisesRegex(W7UsefulnessEvaluationError, "seed rows must not supply no_claims"):
                    evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")

    def test_nested_seed_row_no_claims_key_is_rejected(self) -> None:
        metadata_values = (
            {"no_claims": {"w7_g_authorized": False}},
            [{"no_claims": {"w7_g_authorized": False}}],
        )
        for metadata in metadata_values:
            with self.subTest(metadata=metadata):
                rows = _valid_rows()
                rows[0]["metadata"] = metadata

                with self.assertRaisesRegex(W7UsefulnessEvaluationError, "seed rows must not supply no_claims"):
                    evaluate_w7_usefulness(rows, residual_semantic_non_leakage_risk_status="not-yet-in-scope")


def _valid_rows() -> list[dict[str, object]]:
    return [
        _seed_row(
            evidence_id="w7f-manual-bookkeeping",
            source_epic="W7-D",
            dimension="manual_bookkeeping",
            summary="W7-D browse/index evidence reduces manual bookkeeping over raw selected outputs.",
            evidence_refs=["ca1167d", "ops/Combined-Execution-Sequencing-Plan.md:1934"],
        ),
        _seed_row(
            evidence_id="w7f-audit-replay",
            source_epic="W7-B/C",
            dimension="audit_replay",
            summary="Accepted W7 artifacts preserve replay and audit structure through validators.",
            evidence_refs=["4d11484", "ops/Combined-Execution-Sequencing-Plan.md:1925"],
        ),
        _seed_row(
            evidence_id="w7f-learning-input-trust",
            source_epic="W7-E2",
            dimension="learning_input_trust",
            summary="W7-E2 validates private learning inputs with residual semantic non-leakage risk carried forward.",
            evidence_refs=["227fd11", "ops/Combined-Execution-Sequencing-Plan.md:1936"],
        ),
    ]


def _seed_row(*, evidence_id: str, source_epic: str, dimension: str, summary: str, evidence_refs: list[str]) -> dict[str, object]:
    return {
        "schema_version": "w7.usefulness_seed_row.v1",
        "created_at": "2026-06-07T00:00:00+00:00",
        "evidence_id": evidence_id,
        "source_epic": source_epic,
        "dimension": dimension,
        "dimension_verdict": "pass",
        "summary": summary,
        "evidence_refs": evidence_refs,
        "forbidden_claims": [],
        "claim_boundary": "bounded_w7_usefulness_seed_row_not_public_or_automation_claim",
        "privacy_classification": "private_raw",
        "public_safe": False,
    }


if __name__ == "__main__":
    unittest.main()
