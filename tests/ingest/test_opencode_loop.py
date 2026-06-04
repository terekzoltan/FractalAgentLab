from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals import validate_run_trace_by_run_id
from fractal_agent_lab.ingest import W7OpenCodeLoopIngestError, write_w7_opencode_loop_artifacts


class W7OpenCodeLoopIngestTests(unittest.TestCase):
    def test_writes_canonical_artifacts_and_passes_acceptance(self) -> None:
        payload = _valid_payload()

        with tempfile.TemporaryDirectory() as tmp_dir:
            result = write_w7_opencode_loop_artifacts(payload, data_dir=tmp_dir)
            validation = validate_run_trace_by_run_id(payload["run_id"], data_dir=tmp_dir)

            run_payload = json.loads(Path(result.output_paths["run"]).read_text(encoding="utf-8"))
            summary_payload = json.loads(Path(result.sidecar_paths["opencode_loop_summary"]).read_text(encoding="utf-8"))
            packet_ledger = json.loads(Path(result.sidecar_paths["packet_ledger"]).read_text(encoding="utf-8"))
            selected_outputs = json.loads(Path(result.sidecar_paths["selected_outputs"]).read_text(encoding="utf-8"))
            review_synthesis = json.loads(Path(result.sidecar_paths["review_synthesis"]).read_text(encoding="utf-8"))
            approval_log = json.loads(Path(result.sidecar_paths["approval_log"]).read_text(encoding="utf-8"))
            ingest_report = json.loads(Path(result.sidecar_paths["ingest_report"]).read_text(encoding="utf-8"))
            trace_events = [
                json.loads(line)
                for line in Path(result.output_paths["trace"]).read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            terminal_artifact_ref = trace_events[-1]["payload"]["artifact_ref"]
            terminal_artifact_exists = (Path(tmp_dir) / terminal_artifact_ref).exists()

        self.assertTrue(validation.passed)
        self.assertEqual([], validation.errors)
        self.assertIn("step_results", run_payload["output_payload"])
        self.assertTrue(run_payload["output_payload"]["step_results"])
        self.assertEqual("w7.opencode_loop_summary.v1", summary_payload["schema_version"])
        self.assertEqual("w7.packet_ledger.v1", packet_ledger["schema_version"])
        self.assertEqual("w7.selected_outputs.v1", selected_outputs["schema_version"])
        self.assertEqual("w7.review_synthesis.v1", review_synthesis["schema_version"])
        self.assertEqual("w7.approval_log.v1", approval_log["schema_version"])
        self.assertEqual("w7.ingest_report.v1", ingest_report["schema_version"])
        self.assertTrue(summary_payload["clean_pass_eligible"])
        self.assertEqual([], result.warnings)
        self.assertEqual(f"artifacts/{payload['run_id']}/opencode_loop_summary.json", terminal_artifact_ref)
        self.assertTrue(terminal_artifact_exists)

    def test_rejects_unsafe_run_id(self) -> None:
        payload = _valid_payload(run_id="../bad")

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_green_without_review_synthesis_or_approval(self) -> None:
        payload = _valid_payload(
            final_output={
                **_valid_payload()["final_output"],
                "review_synthesis_present": False,
            },
            approval_log={
                "schema_version": "w7.approval_log.v1",
                "run_id": "ocloop-ringfall-seq1-20260604t120000",
                "checkpoints": [],
            },
        )

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_body_path_in_mvp(self) -> None:
        payload = _valid_payload(
            selected_outputs={
                "schema_version": "w7.selected_outputs.v1",
                "run_id": "ocloop-ringfall-seq1-20260604t120000",
                "outputs": [
                    {
                        **_valid_payload()["selected_outputs"]["outputs"][0],
                        "body_path": "data/artifacts/x/body.md",
                    }
                ],
            }
        )

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_bool_privacy_excerpt_max_chars(self) -> None:
        payload = _valid_payload()
        privacy_audit_state = copy.deepcopy(payload["privacy_audit_state"])
        privacy_audit_state["excerpt_max_chars"] = True
        payload["privacy_audit_state"] = privacy_audit_state

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_bool_selected_output_excerpt_max_chars(self) -> None:
        payload = _valid_payload()
        selected_outputs = copy.deepcopy(payload["selected_outputs"])
        selected_outputs["outputs"][0]["excerpt_max_chars"] = True
        payload["selected_outputs"] = selected_outputs

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_forbidden_fields_recursively(self) -> None:
        payload = _valid_payload()
        selected_outputs = copy.deepcopy(payload["selected_outputs"])
        selected_outputs["outputs"][0]["metadata"] = {
            "nested": [
                {
                    "chain_of_thought": "private reasoning must not be retained",
                }
            ]
        }
        payload["selected_outputs"] = selected_outputs

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_forbidden_top_level_payload_aliases(self) -> None:
        payload = _valid_payload()
        final_output = copy.deepcopy(payload["final_output"])
        final_output["reasoning_text"] = "private reasoning must not be retained"
        payload["final_output"] = final_output

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_forbidden_selected_output_raw_aliases(self) -> None:
        payload = _valid_payload()
        selected_outputs = copy.deepcopy(payload["selected_outputs"])
        selected_outputs["outputs"][0]["raw_body"] = "full raw body"
        payload["selected_outputs"] = selected_outputs

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_forbidden_step_result_fields(self) -> None:
        payload = _valid_payload()
        step_results = copy.deepcopy(payload["step_results"])
        step_results["meta_plan_review"]["output"]["thoughts"] = ["private thought"]
        payload["step_results"] = step_results

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_step_result_raw_extra_fields(self) -> None:
        payload = _valid_payload()
        step_results = copy.deepcopy(payload["step_results"])
        step_results["meta_plan_review"]["raw"]["message_id"] = "message-1"
        payload["step_results"] = step_results

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_green_when_all_checkpoints_unapproved(self) -> None:
        payload = _valid_payload()
        approval_log = copy.deepcopy(payload["approval_log"])
        approval_log["checkpoints"][0]["approved"] = False
        payload["approval_log"] = approval_log

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_green_when_packet_ledger_has_warning(self) -> None:
        payload = _valid_payload()
        packet_ledger = copy.deepcopy(payload["packet_ledger"])
        packet_ledger["entries"][0]["validation_state"] = "warning"
        payload["packet_ledger"] = packet_ledger

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_rejects_green_when_packet_ledger_has_invalid(self) -> None:
        payload = _valid_payload()
        packet_ledger = copy.deepcopy(payload["packet_ledger"])
        packet_ledger["entries"][0]["validation_state"] = "invalid"
        payload["packet_ledger"] = packet_ledger

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_fails_loud_if_target_artifacts_exist(self) -> None:
        payload = _valid_payload()

        with tempfile.TemporaryDirectory() as tmp_dir:
            first = write_w7_opencode_loop_artifacts(payload, data_dir=tmp_dir)
            self.assertTrue(Path(first.output_paths["run"]).exists())
            with self.assertRaises(W7OpenCodeLoopIngestError):
                write_w7_opencode_loop_artifacts(payload, data_dir=tmp_dir)

    def test_w7_c1_rejects_unsafe_external_loop_id(self) -> None:
        payload = _valid_payload(external_loop_id="../bad")

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_rejects_unsafe_packet_selected_output_and_approval_refs(self) -> None:
        ref_overrides = {
            "packet_ref": "../packet",
            "selected_output_ref": "../selected-output",
            "approval_ref": "../approval",
        }

        for ref_name, ref_value in ref_overrides.items():
            with self.subTest(ref_name=ref_name):
                payload = _valid_payload()
                packet_ledger = copy.deepcopy(payload["packet_ledger"])
                packet_ledger["entries"][0][ref_name] = ref_value
                payload["packet_ledger"] = packet_ledger

                with self.assertRaises(W7OpenCodeLoopIngestError):
                    write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_rejects_public_export_approved_at_ingest_time(self) -> None:
        payload = _valid_payload()
        privacy_audit_state = copy.deepcopy(payload["privacy_audit_state"])
        privacy_audit_state["public_export_state"] = "approved"
        payload["privacy_audit_state"] = privacy_audit_state

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_rejects_raw_transcript_retention(self) -> None:
        payload = _valid_payload()
        privacy_audit_state = copy.deepcopy(payload["privacy_audit_state"])
        privacy_audit_state["raw_transcript_retained"] = True
        payload["privacy_audit_state"] = privacy_audit_state

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_rejects_thought_or_reasoning_retention(self) -> None:
        payload = _valid_payload()
        privacy_audit_state = copy.deepcopy(payload["privacy_audit_state"])
        privacy_audit_state["thought_or_reasoning_retained"] = True
        payload["privacy_audit_state"] = privacy_audit_state

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_rejects_selected_output_excerpt_over_limit(self) -> None:
        payload = _valid_payload()
        selected_outputs = copy.deepcopy(payload["selected_outputs"])
        selected_outputs["outputs"][0]["excerpt_max_chars"] = 10
        selected_outputs["outputs"][0]["excerpt"] = "x" * 11
        payload["selected_outputs"] = selected_outputs

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_rejects_step_result_selected_text_excerpt_over_privacy_limit(self) -> None:
        payload = _valid_payload()
        privacy_audit_state = copy.deepcopy(payload["privacy_audit_state"])
        privacy_audit_state["excerpt_max_chars"] = 10
        payload["privacy_audit_state"] = privacy_audit_state
        step_results = copy.deepcopy(payload["step_results"])
        step_results["meta_plan_review"]["output"]["selected_text_excerpt"] = "x" * 11
        payload["step_results"] = step_results

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_rejects_non_string_step_result_selected_text_excerpt(self) -> None:
        payload = _valid_payload()
        step_results = copy.deepcopy(payload["step_results"])
        step_results["meta_plan_review"]["output"]["selected_text_excerpt"] = 123
        payload["step_results"] = step_results

        with self.assertRaises(W7OpenCodeLoopIngestError):
            write_w7_opencode_loop_artifacts(payload, data_dir="data")

    def test_w7_c1_warning_outcome_is_not_clean_pass_eligible(self) -> None:
        payload = _valid_payload(
            validation_state="warning",
            final_output={
                **_valid_payload()["final_output"],
                "overall_outcome": "yellow",
                "final_decision": "accepted_with_warnings",
            },
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            result = write_w7_opencode_loop_artifacts(payload, data_dir=tmp_dir)
            summary_payload = json.loads(Path(result.sidecar_paths["opencode_loop_summary"]).read_text(encoding="utf-8"))

        self.assertEqual("warning", result.validation_state)
        self.assertFalse(result.clean_pass_eligible)
        self.assertFalse(summary_payload["clean_pass_eligible"])


def _valid_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "run_id": "ocloop-ringfall-seq1-20260604t120000",
        "target_project_id": "ringfall",
        "target_project_name": "RingFall",
        "target_repo_path": r"C:\EGYETEM\FUNSTUFF\RingFall",
        "sequence_ref": "W7-B1-SEQ-1",
        "target_track": "track_b",
        "meta_track_pair": "meta_track_b",
        "loop_entry_mode": "router_assisted",
        "automation_mode": "router_assisted",
        "entry_stage": "plan_review",
        "external_loop_id": "ocloop-ringfall-seq1-20260604t120000",
        "source_refs": ["selected-output-1", "review-1"],
        "warnings": [],
        "validation_state": "ok",
        "target_project_context": {
            "schema_version": "external_project_context.v0",
            "target_project_id": "ringfall",
            "target_project_name": "RingFall",
            "target_repo_path": r"C:\EGYETEM\FUNSTUFF\RingFall",
            "target_repo_kind": "git_repo",
            "target_worktree_state": "clean",
            "target_canonical_state_refs": ["ops/PROJECT_STATE.md"],
            "target_local_fal_state_refs": [".fal/FAL-Target-Project-Local-Runbook-v01.md"],
            "sequence_ref": "W7-B1-SEQ-1",
            "current_safe_slice": "artifact_ingest",
            "approval_policy_id": "external_project_default.v0",
            "automation_mode": "router_assisted",
            "privacy_classification": "private_coordination",
            "public_export_state": "blocked",
            "evidence_root": "data/evidence/target-projects/ringfall/loops/ocloop-ringfall-seq1-20260604t120000/",
            "owner_decision_required": True,
        },
        "router_context": {
            "router_kind": "oc_session_router",
            "router_dir": ".opencode-router",
            "server_mode": "local_password_basic_auth",
        },
        "approval_policy": {
            "policy_id": "external_project_default.v0",
            "approval_mode": "explicit_checkpoint",
        },
        "privacy_audit_state": {
            "retention_mode": "structured_extracts_only",
            "raw_transcript_retained": False,
            "excerpt_max_chars": 4000,
            "body_retention_allowed": False,
            "body_path_policy": "none",
            "thought_or_reasoning_retained": False,
            "privacy_classification": "private_coordination",
            "public_export_state": "blocked",
        },
        "step_results": {
            "meta_plan_review": {
                "agent_id": "meta",
                "step_id": "meta_plan_review",
                "output": {
                    "extract_ref": "extract-1",
                    "summary": "Meta review summary.",
                    "decision": "greenlit",
                    "stage": "meta_plan_review_done",
                    "source_session": "session-1",
                    "message_id": "message-1",
                    "selected_text_excerpt": "Accepted with contract revisions.",
                },
                "raw": {
                    "source_kind": "router_selected_output",
                    "provider": "opencode",
                },
            }
        },
        "packet_ledger": {
            "schema_version": "w7.packet_ledger.v1",
            "run_id": "ocloop-ringfall-seq1-20260604t120000",
            "loop_id": "ocloop-ringfall-seq1-20260604t120000",
            "entries": [
                {
                    "sequence": 1,
                    "stage": "meta_plan_review_done",
                    "producer": "meta",
                    "consumer": "track",
                    "source_command": "/terv-review",
                    "decision": "greenlit",
                    "packet_ref": "packet1",
                    "selected_output_ref": "output1",
                    "approval_ref": "checkpoint1",
                    "summary": "Meta approved with revisions.",
                    "validation_state": "ok",
                }
            ],
        },
        "selected_outputs": {
            "schema_version": "w7.selected_outputs.v1",
            "run_id": "ocloop-ringfall-seq1-20260604t120000",
            "outputs": [
                {
                    "output_id": "output1",
                    "stage": "meta_plan_review_done",
                    "source_session": "session-1",
                    "message_id": "message-1",
                    "capture_mode": "latest_output_selected",
                    "summary": "Meta approved with revisions.",
                    "excerpt": "Accepted with contract revisions.",
                    "excerpt_max_chars": 4000,
                    "excerpt_truncated": False,
                    "body_path": None,
                    "body_retention_allowed": False,
                    "body_path_policy": "none",
                    "privacy_classification": "private_coordination",
                }
            ],
        },
        "review_synthesis": {
            "schema_version": "w7.review_synthesis.v1",
            "run_id": "ocloop-ringfall-seq1-20260604t120000",
            "plan_review": {
                "verdict": "greenlit",
                "summary": "Accepted with contract revisions.",
            },
            "step_review": {
                "phase1_summary": None,
                "swarm_verdict": None,
                "final_verdict": None,
                "final_summary": None,
            },
        },
        "approval_log": {
            "schema_version": "w7.approval_log.v1",
            "run_id": "ocloop-ringfall-seq1-20260604t120000",
            "checkpoints": [
                {
                    "checkpoint_id": "checkpoint1",
                    "action_kind": "packet_route",
                    "target_session": "session-1",
                    "stage": "meta_plan_review_done",
                    "approved": True,
                    "approved_at": "2026-06-04T12:00:00+00:00",
                    "approval_mode": "explicit_user_checkpoint",
                }
            ],
        },
        "final_output": {
            "overall_outcome": "green",
            "terminal_stage": "meta_plan_review_done",
            "final_decision": "greenlit",
            "next_recommended_action": "Proceed to Track B plan implementation after Meta review.",
            "blocking_conditions": [],
            "required_followups": ["Track D W7-B2 plan"],
            "accepted_scope_summary": "W7-B planning only.",
            "key_findings": [],
            "artifact_refs": ["data/artifacts/<run_id>/opencode_loop_summary.json"],
            "learning_candidate_refs": [],
            "review_synthesis_present": True,
        },
    }
    payload.update(overrides)
    return payload


if __name__ == "__main__":
    unittest.main()
