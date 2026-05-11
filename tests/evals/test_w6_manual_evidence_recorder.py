from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fractal_agent_lab.core.contracts.w6_packet import W6_PACKET_SCHEMA_VERSION
from fractal_agent_lab.evals.w6_manual_evidence_recorder import (
    W6_MANUAL_EVIDENCE_INPUT_SCHEMA_VERSION,
    W6ManualEvidenceRecorderError,
    record_w6_manual_evidence,
)


class W6ManualEvidenceRecorderTests(unittest.TestCase):
    def test_valid_input_writes_private_loop_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            result = record_w6_manual_evidence(_sample_input(), data_dir=data_dir)

            summary = result.as_dict()
            loop_dir = data_dir / "evidence" / "wave6" / "loops" / "loop-1"
            ledger_path = loop_dir / "ledger.json"
            findings_path = loop_dir / "review_findings.json"
            usefulness_path = loop_dir / "usefulness_row.json"

            self.assertTrue((loop_dir / "packets" / "packet-plan.json").exists())
            self.assertTrue((loop_dir / "packets" / "packet-impl.json").exists())
            self.assertTrue(ledger_path.exists())
            self.assertTrue(findings_path.exists())
            self.assertTrue(usefulness_path.exists())
            self.assertTrue((loop_dir / "summary.md").exists())
            self.assertEqual("loop-1", summary["loop_id"])
            self.assertEqual("pass", summary["final_status"])
            self.assertEqual("warning", summary["validation_status"])
            self.assertFalse(summary["clean_pass"])
            self.assertNotIn("data/artifacts", " ".join(summary["output_paths"].values()))

            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            self.assertEqual("w6.evidence_ledger.v1", ledger["ledger_schema_version"])
            self.assertEqual(3, len(ledger["entries"]))
            step_review_entry = ledger["entries"][2]
            self.assertEqual(2, step_review_entry["findings_count"])
            self.assertEqual(["ui smoke not rerun"], step_review_entry["missing_tests"])

            findings = json.loads(findings_path.read_text(encoding="utf-8"))
            self.assertEqual("w6.review_findings.v1", findings["schema_version"])
            self.assertEqual(2, findings["summary"]["total"])

            usefulness = json.loads(usefulness_path.read_text(encoding="utf-8"))
            self.assertEqual("w6.usefulness_seed_row.v1", usefulness["schema_version"])
            self.assertEqual("single_loop_seed_row_only_not_broad_usefulness_claim", usefulness["claim_boundary"])
            self.assertEqual("private_raw", usefulness["privacy_classification"])
            self.assertEqual(1, usefulness["missing_tests_count"])

    def test_invalid_packet_creates_no_partial_loop_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            payload = _sample_input()
            del payload["packets"][0]["packet_id"]

            with self.assertRaises(W6ManualEvidenceRecorderError):
                record_w6_manual_evidence(payload, data_dir=data_dir)

            loops_dir = data_dir / "evidence" / "wave6" / "loops"
            self.assertFalse((loops_dir / "loop-1").exists())
            self.assertFalse(any(loops_dir.iterdir()) if loops_dir.exists() else False)

    def test_duplicate_packet_id_is_rejected_before_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _sample_input()
            payload["packets"][1]["packet_id"] = "packet-plan"

            with self.assertRaises(W6ManualEvidenceRecorderError):
                record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw))

    def test_mixed_loop_ids_are_rejected_before_write(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            payload = _sample_input()
            payload["packets"][1]["loop_id"] = "other-loop"

            with self.assertRaises(W6ManualEvidenceRecorderError):
                record_w6_manual_evidence(payload, data_dir=data_dir)

            self.assertFalse((data_dir / "evidence" / "wave6" / "loops" / "loop-1").exists())

    def test_warning_packet_preserves_warning_status_and_not_clean_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _sample_input(missing_tests=[])
            payload["packets"][0]["source_command"] = "operator_freeform_notes"

            result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            self.assertEqual("warning", result["validation_status"])
            self.assertFalse(result["clean_pass"])
            self.assertTrue(any("source_command" in warning for warning in result["warnings"]))

    def test_sanitized_public_is_not_allowed_as_default_claim(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _sample_input()
            payload["packets"][0]["privacy_classification"] = "sanitized_public"

            with self.assertRaises(W6ManualEvidenceRecorderError):
                record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw))

    def test_hold_decision_blocks_clean_pass_despite_operator_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _closed_non_pass_input(step_decision="hold")

            result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            self.assertFalse(result["clean_pass"])
            self.assertIn("non_clean_packet_decision:hold", result["clean_pass_blockers"])

    def test_blocked_decision_blocks_clean_pass_despite_operator_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _blocked_plan_input()

            result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            self.assertFalse(result["clean_pass"])
            self.assertIn("non_clean_packet_decision:blocked", result["clean_pass_blockers"])

    def test_deep_review_needed_blocks_clean_pass_despite_operator_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _closed_non_pass_input(step_decision="deep_review_needed")

            result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            self.assertFalse(result["clean_pass"])
            self.assertIn("non_clean_packet_decision:deep_review_needed", result["clean_pass_blockers"])

    def test_unavailable_w6_b_transition_validation_blocks_clean_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _closed_pass_input()
            with patch("fractal_agent_lab.evals.w6_manual_evidence_recorder._validate_w6_packet_history", None):
                result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            self.assertFalse(result["clean_pass"])
            self.assertEqual("unavailable", result["transition_validation"]["status"])
            self.assertIn("w6_b_transition_validation_unavailable", result["clean_pass_blockers"])

    def test_failed_computed_transition_validation_blocks_clean_pass_even_with_operator_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _sample_input(missing_tests=[])
            payload["transition_validation"] = {"status": "pass"}

            result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            self.assertFalse(result["clean_pass"])
            self.assertEqual("computed_w6_b", result["transition_validation"]["source"])
            self.assertEqual("fail", result["transition_validation"]["status"])
            self.assertEqual("pass", result["transition_validation"]["operator_evidence"]["status"])

    def test_valid_full_transition_history_can_clean_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _closed_pass_input()

            result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            self.assertTrue(result["clean_pass"])
            self.assertEqual("pass", result["validation_status"])
            self.assertEqual("computed_w6_b", result["transition_validation"]["source"])
            self.assertEqual("pass", result["transition_validation"]["status"])
            self.assertTrue(result["transition_validation"]["commit_ready_candidate"])
            self.assertEqual([], result["clean_pass_blockers"])

    def test_governance_context_continuity_complexity_class_is_supported(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            payload = _closed_pass_input()
            payload["complexity_class"] = "governance_context_continuity"

            result = record_w6_manual_evidence(payload, data_dir=Path(temp_dir_raw)).as_dict()

            usefulness_path = Path(result["output_paths"]["usefulness_row"])
            usefulness = json.loads(usefulness_path.read_text(encoding="utf-8"))
            self.assertEqual("governance_context_continuity", usefulness["complexity_class"])


def _sample_input(*, missing_tests: list[str] | None = None) -> dict[str, object]:
    missing_tests = ["ui smoke not rerun"] if missing_tests is None else missing_tests
    return {
        "schema_version": W6_MANUAL_EVIDENCE_INPUT_SCHEMA_VERSION,
        "loop_id": "loop-1",
        "target_repo": "FractalAgentLab",
        "sequence_ref": "W6-S1/W6-C",
        "task_type": "manual_evidence_recorder",
        "complexity_class": "shared_boundary",
        "mode": "fal_evidence_backed",
        "manual_copy_paste_steps": 4,
        "copy_paste_avoided_count": 1,
        "operator_interruptions_required": 0,
        "final_status": "pass",
        "net_recommendation": "insufficient_data",
        "missing_tests_or_skipped_checks": missing_tests,
        "review_findings": [
            {
                "severity": "medium",
                "status": "accepted",
                "summary": "Missing skipped-test representation.",
                "evidence": "Meta review",
                "source_stage": "step_review_done",
                "fix_required": True,
            },
            {
                "severity": "low",
                "status": "rejected",
                "summary": "Non-actionable wording note.",
                "evidence": "Track response",
                "source_stage": "step_review_done",
                "fix_required": False,
            },
        ],
        "transition_validation": {"status": "not_available_before_w6_b"},
        "packets": [
            _packet("packet-plan", "plan_ready_for_meta_review", None, _plan_payload()),
            _packet("packet-impl", "implementation_done", None, _implementation_payload(missing_tests)),
            _packet("packet-review", "step_review_done", "pass", _step_review_payload(missing_tests)),
        ],
    }


def _closed_pass_input() -> dict[str, object]:
    payload = _sample_input(missing_tests=[])
    payload["review_findings"] = []
    payload["transition_validation"] = {"status": "operator_claimed_pass"}
    payload["packets"] = _closed_packets(step_decision="pass")
    return payload


def _closed_non_pass_input(*, step_decision: str) -> dict[str, object]:
    payload = _sample_input(missing_tests=[])
    payload["packets"] = _closed_packets(step_decision=step_decision)
    return payload


def _blocked_plan_input() -> dict[str, object]:
    payload = _sample_input(missing_tests=[])
    payload["packets"] = [
        _packet("packet-plan", "plan_ready_for_meta_review", None, _plan_payload(), source_command="/seq-next"),
        _packet("packet-plan-review", "meta_plan_review_done", "blocked", _meta_plan_review_payload(), source_command="/terv-review"),
        _packet("packet-plan-ack", "plan_review_acknowledged", None, _plan_ack_payload(), source_command="/terv-review-utan"),
    ]
    return payload


def _closed_packets(*, step_decision: str) -> list[dict[str, object]]:
    return [
        _packet("packet-plan", "plan_ready_for_meta_review", None, _plan_payload(), source_command="/seq-next"),
        _packet("packet-plan-review", "meta_plan_review_done", "greenlit", _meta_plan_review_payload(), source_command="/terv-review"),
        _packet("packet-plan-ack", "plan_review_acknowledged", None, _plan_ack_payload(), source_command="/terv-review-utan"),
        _packet("packet-impl", "implementation_done", None, _implementation_payload([]), source_command="/implement"),
        _packet("packet-step-review", "step_review_done", step_decision, _step_review_payload([]), source_command="/step-review"),
        _packet("packet-step-ack", "step_review_acknowledged", None, _step_ack_payload(), source_command="/step-review"),
    ]


def _packet(
    packet_id: str,
    stage: str,
    decision: str | None,
    payload: dict[str, object],
    *,
    source_command: str | None = None,
) -> dict[str, object]:
    return {
        "schema_version": W6_PACKET_SCHEMA_VERSION,
        "packet_id": packet_id,
        "loop_id": "loop-1",
        "stage": stage,
        "producer": "track" if stage != "step_review_done" else "meta",
        "consumer": "meta" if stage != "step_review_done" else "track",
        "originating_track": "track_e",
        "target_track": "meta" if stage != "step_review_done" else "track_e",
        "sequence_ref": "W6-S1/W6-C",
        "source_command": source_command or ("/implement" if stage == "implementation_done" else "/seq-next"),
        "decision": decision,
        "created_at": "2026-05-08T12:00:00+00:00",
        "parent_packet_id": None,
        "artifact_refs": [],
        "payload_summary": f"{stage} packet",
        "payload": payload,
        "visibility_audit_state": {
            "execution_mode": "opencode_assisted",
            "git_visible_state": "tracked diff reviewed",
            "local_only_sources": [],
            "data_artifacts_consulted": [],
            "notes": "test packet",
        },
        "privacy_classification": "private_raw",
        "validation": {},
    }


def _plan_payload() -> dict[str, object]:
    return {
        "implementation_plan_summary": "Implement W6-C recorder.",
        "assumptions": [],
        "risks": [],
        "dependencies": ["W6-A"],
        "affected_files_or_surfaces": ["src/fractal_agent_lab/evals"],
        "proposed_acceptance_checks": ["unit tests"],
        "explicit_non_goals": ["no bridge"],
    }


def _implementation_payload(missing_tests: list[str]) -> dict[str, object]:
    return {
        "implementation_summary": "Implemented W6-C recorder.",
        "changed_files": ["src/fractal_agent_lab/evals/w6_manual_evidence_recorder.py"],
        "tests_checks_run": ["tests.evals.test_w6_manual_evidence_recorder"],
        "missing_tests_or_skipped_checks": missing_tests,
        "deviations_from_accepted_plan": [],
        "known_gaps": [],
        "exact_review_request": "Review W6-C recorder.",
    }


def _meta_plan_review_payload() -> dict[str, object]:
    return {
        "findings_first_plan_review": "No findings.",
        "required_plan_changes": [],
        "blockers": [],
        "residual_risks": [],
        "meta_guidance": "Proceed.",
        "track_facing_handoff_summary": "Greenlit.",
    }


def _plan_ack_payload() -> dict[str, object]:
    return {
        "consumed_review_packet_reference": "packet-plan-review",
        "track_response": "Acknowledged.",
        "planned_next_action": "Implement.",
    }


def _step_ack_payload() -> dict[str, object]:
    return {
        "consumed_review_packet_reference": "packet-step-review",
        "track_response": "Acknowledged.",
        "final_completion_acknowledgement_or_next_action": "Complete.",
    }


def _step_review_payload(missing_tests: list[str]) -> dict[str, object]:
    return {
        "findings_first_implementation_review": "No blocking findings.",
        "missing_tests": missing_tests,
        "required_fixes": [],
        "residual_risks": [],
        "commit_readiness_recommendation": "hold until W6-D",
        "deep_review_needed": False,
    }


if __name__ == "__main__":
    unittest.main()
