from __future__ import annotations

import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from fractal_agent_lab.cli.app import run_cli
from fractal_agent_lab.evals import validate_run_trace_by_run_id


class W7B3IngestCliTests(unittest.TestCase):
    def test_router_loop_preview_validates_without_target_writes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            data_dir = root / "target-data"
            payload_path = root / "payload.json"
            payload_path.write_text(json.dumps(_valid_payload(), ensure_ascii=True), encoding="utf-8")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "ingest",
                        "router-loop",
                        "--payload-path",
                        payload_path.as_posix(),
                        "--data-dir",
                        data_dir.as_posix(),
                        "--mode",
                        "preview",
                        "--format",
                        "json",
                    ]
                )

            report = json.loads(out.getvalue())
            self.assertEqual(0, code)
            self.assertEqual("preview", report["mode"])
            self.assertEqual("ocloop-ringfall-seq1-20260604t120000", report["run_id"])
            self.assertEqual("ok", report["validation_state"])
            self.assertTrue(report["clean_pass_eligible"])
            self.assertEqual([], report["warnings"])
            self.assertEqual(data_dir.as_posix(), report["data_dir"])
            self.assertEqual("structured_extracts_only", report["privacy_retention_mode"])
            self.assertEqual({}, report["paths"])
            self.assertFalse(data_dir.exists())

    def test_router_loop_write_emits_artifact_acceptance_compatible_outputs(self) -> None:
        payload = _valid_payload()
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            data_dir = root / "target-data"
            payload_path = root / "payload.json"
            payload_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "ingest",
                        "router-loop",
                        "--payload-path",
                        payload_path.as_posix(),
                        "--data-dir",
                        data_dir.as_posix(),
                        "--mode",
                        "write",
                        "--format",
                        "json",
                    ]
                )

            report = json.loads(out.getvalue())
            validation = validate_run_trace_by_run_id(payload["run_id"], data_dir=data_dir)

            self.assertEqual(0, code)
            self.assertEqual("write", report["mode"])
            self.assertTrue(report["clean_pass_eligible"])
            self.assertIn("run", report["paths"])
            self.assertIn("trace", report["paths"])
            self.assertIn("opencode_loop_summary", report["paths"])
            self.assertTrue((data_dir / "runs" / f"{payload['run_id']}.json").exists())
            self.assertTrue((data_dir / "traces" / f"{payload['run_id']}.jsonl").exists())
            self.assertTrue((data_dir / "artifacts" / payload["run_id"] / "opencode_loop_summary.json").exists())
            self.assertTrue(validation.passed)
            self.assertEqual([], validation.errors)

    def test_router_loop_surfaces_false_green_error_without_success_claim(self) -> None:
        payload = _valid_payload()
        final_output = copy.deepcopy(payload["final_output"])
        final_output["review_synthesis_present"] = False
        payload["final_output"] = final_output

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            data_dir = root / "target-data"
            payload_path = root / "payload.json"
            payload_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "ingest",
                        "router-loop",
                        "--payload-path",
                        payload_path.as_posix(),
                        "--data-dir",
                        data_dir.as_posix(),
                    ]
                )

            rendered = out.getvalue()
            self.assertEqual(2, code)
            self.assertIn("Error:", rendered)
            self.assertIn("cannot be 'green'", rendered)
            self.assertNotIn("FAL ingest success is not OpenCode task success", rendered)
            self.assertFalse(data_dir.exists())

    def test_router_loop_rejects_invalid_payload_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            payload_path = Path(tmp_dir) / "payload.json"
            payload_path.write_text("{not-json}", encoding="utf-8")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(["ingest", "router-loop", "--payload-path", payload_path.as_posix()])

            self.assertEqual(2, code)
            self.assertIn("payload JSON is invalid", out.getvalue())

    def test_router_loop_rejects_non_object_payload_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            payload_path = Path(tmp_dir) / "payload.json"
            payload_path.write_text("[]", encoding="utf-8")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(["ingest", "router-loop", "--payload-path", payload_path.as_posix()])

            self.assertEqual(2, code)
            self.assertIn("payload JSON must decode to an object", out.getvalue())

    def test_router_loop_write_fails_loud_on_existing_targets(self) -> None:
        payload = _valid_payload()
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            data_dir = root / "target-data"
            payload_path = root / "payload.json"
            payload_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
            args = [
                "ingest",
                "router-loop",
                "--payload-path",
                payload_path.as_posix(),
                "--data-dir",
                data_dir.as_posix(),
                "--mode",
                "write",
            ]

            with redirect_stdout(io.StringIO()):
                first_code = run_cli(args)
            out = io.StringIO()
            with redirect_stdout(out):
                second_code = run_cli(args)

            self.assertEqual(0, first_code)
            self.assertEqual(2, second_code)
            self.assertIn("does not support overwrite", out.getvalue())


def _valid_payload() -> dict[str, object]:
    return {
        "run_id": "ocloop-ringfall-seq1-20260604t120000",
        "target_project_id": "ringfall",
        "target_project_name": "RingFall",
        "target_repo_path": r"C:\EGYETEM\FUNSTUFF\RingFall",
        "sequence_ref": "W7-B3-SEQ-1",
        "target_track": "track_a",
        "meta_track_pair": "meta_track_a",
        "loop_entry_mode": "router_assisted",
        "automation_mode": "router_assisted",
        "entry_stage": "meta_plan_review",
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
            "sequence_ref": "W7-B3-SEQ-1",
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
            "next_recommended_action": "Proceed to W7-C1 after W7-B3 acceptance.",
            "blocking_conditions": [],
            "required_followups": ["W7-C1 validation/privacy review"],
            "accepted_scope_summary": "W7-B3 Track A ingest CLI UX only.",
            "key_findings": [],
            "artifact_refs": ["data/artifacts/<run_id>/opencode_loop_summary.json"],
            "learning_candidate_refs": [],
            "review_synthesis_present": True,
        },
    }


if __name__ == "__main__":
    unittest.main()
