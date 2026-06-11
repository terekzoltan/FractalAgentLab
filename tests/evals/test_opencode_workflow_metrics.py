from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.opencode_workflow_metrics import (
    W7_5_METRICS_CLAIM_BOUNDARY,
    W7_5_REVIEW_FINDINGS_LEDGER_SCHEMA_VERSION,
    W7_5_WORKFLOW_METRICS_SCHEMA_VERSION,
    W75WorkflowMetricsError,
    build_review_findings_ledger,
    build_workflow_metrics,
    write_review_findings_ledger,
    write_workflow_metrics,
)
from fractal_agent_lab.ingest import write_w7_opencode_loop_artifacts


class OpenCodeWorkflowMetricsTests(unittest.TestCase):
    def test_valid_w7_fixture_writes_workflow_metrics(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-metrics-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            path = write_workflow_metrics(run_id, data_dir=tmp_dir)
            payload = json.loads(path.read_text(encoding="utf-8"))
            serialized = json.dumps(payload, sort_keys=True)

        self.assertEqual(W7_5_WORKFLOW_METRICS_SCHEMA_VERSION, payload["schema_version"])
        self.assertEqual(run_id, payload["run_id"])
        self.assertEqual(W7_5_METRICS_CLAIM_BOUNDARY, payload["claim_boundary"])
        self.assertFalse(payload["public_safe"])
        self.assertFalse(payload["raw_transcript_retained"])
        self.assertFalse(payload["raw_selected_output_body_retained"])
        self.assertIsNone(payload["quality_score"])
        self.assertEqual("not_computed", payload["quality_score_status"])
        self.assertIn("opencode_loop_summary.json", payload["source_sidecars"])
        self.assertEqual("w7.packet_ledger.v1", payload["source_sidecar_schema_versions"]["packet_ledger"])
        self.assertEqual(1, payload["packet_count"])
        self.assertEqual(1, payload["approval_count"])
        self.assertEqual(1, payload["approved_checkpoint_count"])
        self.assertEqual(1, payload["selected_output_count"])
        self.assertTrue(payload["review_synthesis_present"])
        self.assertEqual(0, payload["warning_count"])
        self.assertEqual("ok", payload["validation_state"])
        self.assertTrue(payload["clean_pass_eligible"])
        self.assertEqual("green", payload["overall_outcome"])
        self.assertEqual("meta_plan_review_done", payload["terminal_stage"])
        self.assertEqual(1, payload["stage_count"])
        self.assertEqual(1, payload["unique_stage_count"])
        self.assertEqual(1, payload["unique_producer_count"])
        self.assertEqual(1, payload["unique_consumer_count"])
        self.assertEqual("router_assisted", payload["loop_entry_mode"])
        self.assertEqual("router_assisted", payload["automation_mode"])
        self.assertNotIn("PRIVATE SELECTED OUTPUT BODY", serialized)

    def test_valid_w7_fixture_writes_review_findings_ledger(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-ledger-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            path = write_review_findings_ledger(
                run_id,
                data_dir=tmp_dir,
                manual_findings=[
                    {
                        "finding_id": "rf-1",
                        "source_stage": "step_review",
                        "summary": "A reviewer found a real issue.",
                        "affected_files": ["src/example.py"],
                        "required_fix": "Adjust the example.",
                    }
                ],
            )
            payload = json.loads(path.read_text(encoding="utf-8"))
            serialized = json.dumps(payload, sort_keys=True)

        self.assertEqual(W7_5_REVIEW_FINDINGS_LEDGER_SCHEMA_VERSION, payload["schema_version"])
        self.assertEqual(run_id, payload["run_id"])
        self.assertEqual(W7_5_METRICS_CLAIM_BOUNDARY, payload["claim_boundary"])
        self.assertFalse(payload["public_safe"])
        self.assertFalse(payload["raw_transcript_retained"])
        self.assertFalse(payload["raw_selected_output_body_retained"])
        self.assertTrue(payload["labels_are_human_supplied"])
        self.assertEqual("uncertain", payload["default_label"])
        self.assertIn("review_synthesis.json", payload["source_sidecars"])
        self.assertEqual(1, len(payload["findings"]))
        self.assertEqual("uncertain", payload["findings"][0]["human_label"])
        self.assertEqual(["src/example.py"], payload["findings"][0]["affected_files"])
        self.assertNotIn("PRIVATE SELECTED OUTPUT BODY", serialized)

    def test_missing_sidecar_raises(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-missing-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            (Path(tmp_dir) / "artifacts" / run_id / "approval_log.json").unlink()

            with self.assertRaisesRegex(W75WorkflowMetricsError, "Missing required W7 sidecar"):
                write_workflow_metrics(run_id, data_dir=tmp_dir)

    def test_wrong_sidecar_schema_raises(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-schema-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            _mutate_sidecar(tmp_dir, run_id, "packet_ledger", {"schema_version": "w7.packet_ledger.v0"})

            with self.assertRaisesRegex(W75WorkflowMetricsError, "unsupported schema_version"):
                write_workflow_metrics(run_id, data_dir=tmp_dir)

    def test_mismatched_sidecar_run_id_raises(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-runid-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            _mutate_sidecar(tmp_dir, run_id, "selected_outputs", {"run_id": "different-run"})

            with self.assertRaisesRegex(W75WorkflowMetricsError, "run_id does not match"):
                write_workflow_metrics(run_id, data_dir=tmp_dir)

    def test_workflow_metrics_writer_fails_if_target_exists(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-overwrite-metrics-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            write_workflow_metrics(run_id, data_dir=tmp_dir)

            with self.assertRaisesRegex(W75WorkflowMetricsError, "does not support overwrite"):
                write_workflow_metrics(run_id, data_dir=tmp_dir)

    def test_review_findings_ledger_writer_fails_if_target_exists(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-overwrite-ledger-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            write_review_findings_ledger(run_id, data_dir=tmp_dir)

            with self.assertRaisesRegex(W75WorkflowMetricsError, "does not support overwrite"):
                write_review_findings_ledger(run_id, data_dir=tmp_dir)

    def test_manual_finding_unknown_label_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-bad-label-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            with self.assertRaisesRegex(W75WorkflowMetricsError, "unsupported human_label"):
                build_review_findings_ledger(
                    run_id,
                    data_dir=tmp_dir,
                    manual_findings=[
                        {
                            "finding_id": "rf-1",
                            "source_stage": "step_review",
                            "summary": "Finding summary.",
                            "human_label": "probably_true",
                        }
                    ],
                )

    def test_manual_finding_raw_body_field_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-raw-body-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            with self.assertRaisesRegex(W75WorkflowMetricsError, "forbidden raw body/transcript field"):
                build_review_findings_ledger(
                    run_id,
                    data_dir=tmp_dir,
                    manual_findings=[
                        {
                            "finding_id": "rf-1",
                            "source_stage": "step_review",
                            "summary": "Finding summary.",
                            "raw_body": "PRIVATE SELECTED OUTPUT BODY",
                        }
                    ],
                )

    def test_builders_reject_unsafe_run_ids_before_path_lookup(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-unsafe-build-") as tmp_dir:
            for builder in (build_workflow_metrics, build_review_findings_ledger):
                with self.subTest(builder=builder.__name__):
                    with self.assertRaises(W75WorkflowMetricsError):
                        builder("../escaped-run", data_dir=tmp_dir)

    def test_workflow_metrics_writer_rejects_unsafe_run_ids_without_escape(self) -> None:
        unsafe_ids = [
            "../escaped-run",
            "..\\escaped-run",
            r"C:\escaped-run",
            " valid-run ",
            "CON",
        ]
        with tempfile.TemporaryDirectory(prefix="fal-w75-unsafe-metrics-") as tmp_dir:
            for run_id in unsafe_ids:
                with self.subTest(run_id=run_id):
                    with self.assertRaises(W75WorkflowMetricsError):
                        write_workflow_metrics(run_id, data_dir=tmp_dir)
                    self.assertFalse((Path(tmp_dir) / "escaped-run").exists())
                    self.assertFalse((Path(tmp_dir) / "escaped-run" / "workflow_metrics.json").exists())

    def test_review_findings_writer_rejects_unsafe_run_ids_without_escape(self) -> None:
        unsafe_ids = [
            "../escaped-run",
            "..\\escaped-run",
            r"C:\escaped-run",
            " valid-run ",
            "CON",
        ]
        with tempfile.TemporaryDirectory(prefix="fal-w75-unsafe-ledger-") as tmp_dir:
            for run_id in unsafe_ids:
                with self.subTest(run_id=run_id):
                    with self.assertRaises(W75WorkflowMetricsError):
                        write_review_findings_ledger(run_id, data_dir=tmp_dir)
                    self.assertFalse((Path(tmp_dir) / "escaped-run").exists())
                    self.assertFalse((Path(tmp_dir) / "escaped-run" / "review_findings_ledger.json").exists())


def _write_valid_loop(data_dir: str) -> str:
    payload = _valid_payload()
    write_w7_opencode_loop_artifacts(payload, data_dir=data_dir)
    return str(payload["run_id"])


def _mutate_sidecar(data_dir: str, run_id: str, name: str, updates: dict[str, object]) -> None:
    path = Path(data_dir) / "artifacts" / run_id / f"{name}.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload.update(updates)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


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
                    "excerpt": "PRIVATE SELECTED OUTPUT BODY",
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
    payload.update(copy.deepcopy(overrides))
    return payload


if __name__ == "__main__":
    unittest.main()
