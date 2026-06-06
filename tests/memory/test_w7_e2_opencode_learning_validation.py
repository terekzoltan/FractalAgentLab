from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

from fractal_agent_lab.ingest import write_w7_opencode_loop_artifacts
from fractal_agent_lab.memory import JSONProjectMemoryStore, run_w7_opencode_learning_update


FORBIDDEN_AUTHORITY_KEYS = {
    "approval_bypass",
    "auto_dispatch",
    "identity_routing",
    "public_export_approved",
    "routing_decision",
    "suggested_command",
}
ALLOWED_PROJECT_SUBTYPES = {
    "repo_specific_caution",
    "review_gate_rule",
    "validation_expectation",
}


class W7E2OpenCodeLearningValidationTests(unittest.TestCase):
    def test_w7_e2_global_learning_is_deidentified_and_low_confidence(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-e2-learning-") as tmp_dir:
            raw_excerpt = "Accepted with contract revisions. PRIVATE SELECTED OUTPUT BODY"
            run_id = _write_valid_loop(tmp_dir, selected_excerpt=raw_excerpt)

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(result.accepted)
            self.assertTrue(result.global_candidates)
            global_root = Path(tmp_dir) / "memory" / "global"
            all_text = _read_tree_text(global_root)
            self.assertNotIn("RingFall", all_text)
            self.assertNotIn("ringfall", all_text.lower())
            self.assertNotIn(r"C:\EGYETEM\FUNSTUFF\RingFall", all_text)
            self.assertNotIn("C:\\", all_text)
            self.assertNotIn(":\\", all_text)
            self.assertNotIn(raw_excerpt, all_text)
            self.assertNotIn("PRIVATE SELECTED OUTPUT BODY", all_text)
            self.assertNotIn(run_id, all_text)

            for path in global_root.glob("*.json"):
                payload = json.loads(path.read_text(encoding="utf-8"))
                entries = payload["entries"]
                self.assertTrue(entries)
                for entry in entries:
                    self.assertTrue(entry["deidentified"])
                    self.assertEqual("low", entry["confidence"])
                    self.assertRegex(entry["source_run_ids"][0], r"^run_sha256_[0-9a-f]{12}$")

    def test_w7_e2_dry_run_and_write_outputs_stay_private_local(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-e2-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            dry_run = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir)

            self.assertTrue(dry_run.accepted)
            self.assertFalse(dry_run.write)
            self.assertFalse((Path(tmp_dir) / "memory").exists())
            self.assertFalse((Path(tmp_dir) / "artifacts" / run_id / "opencode_learning_update.json").exists())

            write_result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(write_result.accepted)
            expected_private_paths = {
                (Path(tmp_dir) / "memory" / "projects" / "ringfall.json").resolve(),
                (Path(tmp_dir) / "memory" / "global" / "opencode_review_patterns.json").resolve(),
                (Path(tmp_dir) / "memory" / "global" / "meta_triage_patterns.json").resolve(),
                (Path(tmp_dir) / "artifacts" / run_id / "opencode_learning_update.json").resolve(),
            }
            actual_json_paths = {path.resolve() for path in Path(tmp_dir).rglob("*.json")}
            self.assertTrue(expected_private_paths.issubset(actual_json_paths))
            self.assertFalse((Path(tmp_dir) / "docs" / "public").exists())

            sidecar = json.loads((Path(tmp_dir) / "artifacts" / run_id / "opencode_learning_update.json").read_text(encoding="utf-8"))
            self.assertFalse(sidecar["track_e_validation_claim"])
            self.assertFalse(sidecar["deidentification_summary"]["target_specific_global_content_allowed"])
            sidecar_text = json.dumps(sidecar, ensure_ascii=True).lower()
            self.assertNotIn("public export approved", sidecar_text)
            self.assertNotIn("public_export_approved", sidecar_text)

    def test_w7_e2_learning_sidecar_has_no_identity_routing_or_control_authority(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-e2-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(result.accepted)
            self.assertFalse((Path(tmp_dir) / "identity").exists())
            self.assertFalse((Path(tmp_dir) / "memory" / "identity").exists())

            sidecar = json.loads((Path(tmp_dir) / "artifacts" / run_id / "opencode_learning_update.json").read_text(encoding="utf-8"))
            _assert_forbidden_keys_absent(sidecar, FORBIDDEN_AUTHORITY_KEYS)
            for candidate in sidecar["project_candidates"] + sidecar["global_candidates"]:
                _assert_forbidden_keys_absent(candidate, FORBIDDEN_AUTHORITY_KEYS)
                text = json.dumps(candidate, ensure_ascii=True).lower()
                self.assertNotIn("automatically run", text)
                self.assertNotIn("skip meta review", text)
                self.assertNotIn("commit now", text)

    def test_w7_e2_project_candidates_are_bounded_and_deduped(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-e2-learning-") as tmp_dir:
            run_id = _write_valid_loop(
                tmp_dir,
                accepted_scope=" W7-E2 validation scope only. ",
                required_followups=["Track E review", "", 42],
                blocking_conditions=["W7-F waits for W7-E2", None],
                key_findings=["Learning sidecar is private evidence", "   "],
            )

            first = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)
            second = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(first.accepted)
            self.assertGreater(first.project_created_count, 0)
            self.assertEqual(0, second.project_created_count)
            self.assertGreater(second.project_skipped_count, 0)
            project_memory = JSONProjectMemoryStore(data_dir=tmp_dir).load_project(project_id="ringfall")
            self.assertIsNotNone(project_memory)
            assert project_memory is not None
            contents = [entry.content for entry in project_memory.workflow_learnings]
            self.assertIn("Accepted scope: W7-E2 validation scope only.", contents)
            self.assertIn("Track E review", contents)
            self.assertIn("W7-F waits for W7-E2", contents)
            self.assertIn("Learning sidecar is private evidence", contents)
            self.assertNotIn("", contents)
            self.assertFalse(any("42" == content for content in contents))
            for entry in project_memory.workflow_learnings:
                self.assertEqual("workflow_learning", entry.entry_type)
                self.assertIn(entry.entry_subtype, ALLOWED_PROJECT_SUBTYPES)
                self.assertEqual("opencode.meta_track.loop.v1", entry.workflow_id)
                self.assertTrue(entry.source_path.startswith("output_payload.final_output."))
                self.assertTrue(entry.content.strip())


def _write_valid_loop(
    data_dir: str,
    *,
    run_id: str = "ocloop-ringfall-seq1-20260604t120000",
    selected_excerpt: str = "Accepted with contract revisions.",
    accepted_scope: str = "W7-B planning only.",
    required_followups: list[Any] | None = None,
    blocking_conditions: list[Any] | None = None,
    key_findings: list[Any] | None = None,
) -> str:
    payload = _valid_payload(run_id=run_id)
    payload["selected_outputs"]["outputs"][0]["excerpt"] = selected_excerpt
    payload["step_results"]["meta_plan_review"]["output"]["selected_text_excerpt"] = selected_excerpt
    payload["final_output"]["accepted_scope_summary"] = accepted_scope
    payload["final_output"]["required_followups"] = list(required_followups or ["Track D W7-B2 plan"])
    payload["final_output"]["blocking_conditions"] = list(blocking_conditions or [])
    payload["final_output"]["key_findings"] = list(key_findings or [])
    write_w7_opencode_loop_artifacts(payload, data_dir=data_dir)
    return run_id


def _valid_payload(*, run_id: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "run_id": run_id,
        "target_project_id": "ringfall",
        "target_project_name": "RingFall",
        "target_repo_path": r"C:\EGYETEM\FUNSTUFF\RingFall",
        "sequence_ref": "W7-B1-SEQ-1",
        "target_track": "track_b",
        "meta_track_pair": "meta_track_b",
        "loop_entry_mode": "router_assisted",
        "automation_mode": "router_assisted",
        "entry_stage": "plan_review",
        "external_loop_id": run_id,
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
            "public_export_state": "candidate_needs_review",
            "evidence_root": f"data/evidence/target-projects/ringfall/loops/{run_id}/",
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
            "public_export_state": "candidate_needs_review",
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
            "run_id": run_id,
            "loop_id": run_id,
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
            "run_id": run_id,
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
            "run_id": run_id,
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
            "run_id": run_id,
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
    return copy.deepcopy(payload)


def _read_tree_text(root: Path) -> str:
    return "\n".join(path.read_text(encoding="utf-8") for path in root.rglob("*.json"))


def _assert_forbidden_keys_absent(value: Any, forbidden_keys: set[str]) -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in forbidden_keys:
                raise AssertionError(f"Forbidden authority key present: {key}")
            _assert_forbidden_keys_absent(nested, forbidden_keys)
    elif isinstance(value, list):
        for item in value:
            _assert_forbidden_keys_absent(item, forbidden_keys)


if __name__ == "__main__":
    unittest.main()
