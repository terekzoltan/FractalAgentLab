from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.ingest import write_w7_opencode_loop_artifacts
from fractal_agent_lab.memory import (
    JSONGlobalLearningStore,
    JSONProjectMemoryStore,
    run_w7_opencode_learning_update,
)


class W7OpenCodeLearningTests(unittest.TestCase):
    def test_dry_run_extracts_candidates_without_writing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir)

            self.assertTrue(result.accepted)
            self.assertFalse(result.write)
            self.assertEqual("ringfall", result.project_id)
            self.assertTrue(result.project_candidates)
            self.assertTrue(result.global_candidates)
            self.assertFalse((Path(tmp_dir) / "memory" / "projects" / "ringfall.json").exists())
            self.assertFalse((Path(tmp_dir) / "memory" / "global").exists())
            self.assertFalse((Path(tmp_dir) / "artifacts" / run_id / "opencode_learning_update.json").exists())

    def test_write_updates_project_and_global_memory_and_sidecar(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(result.accepted)
            self.assertGreater(result.project_created_count, 0)
            self.assertGreater(result.global_created_count, 0)
            self.assertIsNotNone(result.sidecar_path)
            assert result.sidecar_path is not None
            sidecar = json.loads(result.sidecar_path.read_text(encoding="utf-8"))
            self.assertEqual("opencode_learning_update", sidecar["artifact_type"])
            self.assertFalse(sidecar["track_e_validation_claim"])

            project_memory = JSONProjectMemoryStore(data_dir=tmp_dir).load_project(project_id="ringfall")
            self.assertIsNotNone(project_memory)
            assert project_memory is not None
            self.assertTrue(project_memory.workflow_learnings)

            global_entries = JSONGlobalLearningStore(data_dir=tmp_dir).load_topic(topic="opencode_review_patterns")
            self.assertEqual(1, len(global_entries))
            self.assertEqual("low", global_entries[0].confidence)
            self.assertTrue(global_entries[0].deidentified)

    def test_unsupported_workflow_produces_no_updates(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            run_path = Path(tmp_dir) / "runs" / f"{run_id}.json"
            run_payload = json.loads(run_path.read_text(encoding="utf-8"))
            run_payload["workflow_id"] = "h2.manager.v1"
            run_path.write_text(json.dumps(run_payload, indent=2), encoding="utf-8")

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertFalse(result.accepted)
            self.assertIn("unsupported_workflow", result.skipped_reasons)
            self.assertFalse((Path(tmp_dir) / "memory").exists())

    def test_non_accepted_artifacts_produce_no_updates(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = "ocloop-ringfall-missing-trace-20260604t120000"
            artifact_dir = Path(tmp_dir) / "artifacts" / run_id
            artifact_dir.mkdir(parents=True)

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertFalse(result.accepted)
            self.assertTrue(any(reason.startswith("artifact_acceptance:") for reason in result.skipped_reasons))
            self.assertFalse((Path(tmp_dir) / "memory").exists())

    def test_wrong_sidecar_schema_produces_no_updates(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            _mutate_sidecar(tmp_dir, run_id, "packet_ledger", {"schema_version": "w7.packet_ledger.v0"})

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertFalse(result.accepted)
            self.assertIn("invalid_sidecar:packet_ledger:schema_version", result.skipped_reasons)
            _assert_no_learning_outputs(tmp_dir, run_id)

    def test_mismatched_sidecar_run_id_produces_no_updates(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            _mutate_sidecar(tmp_dir, run_id, "packet_ledger", {"run_id": "ocloop-other-seq1-20260604t120000"})

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertFalse(result.accepted)
            self.assertIn("invalid_sidecar:packet_ledger:run_id", result.skipped_reasons)
            _assert_no_learning_outputs(tmp_dir, run_id)

    def test_missing_project_id_produces_no_project_update(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            run_path = Path(tmp_dir) / "runs" / f"{run_id}.json"
            run_payload = json.loads(run_path.read_text(encoding="utf-8"))
            run_payload["input_payload"].pop("target_project_id", None)
            run_payload["context"]["target_project_context"].pop("target_project_id", None)
            run_payload["input_payload"]["session_id"] = "session-should-not-be-project"
            run_path.write_text(json.dumps(run_payload, indent=2), encoding="utf-8")

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertFalse(result.accepted)
            self.assertIn("missing_project_id", result.skipped_reasons)
            self.assertFalse((Path(tmp_dir) / "memory").exists())

    def test_raw_selected_excerpt_is_not_copied_to_project_memory(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            raw_excerpt = "Accepted with contract revisions. PRIVATE SELECTED OUTPUT BODY"
            run_id = _write_valid_loop(tmp_dir, selected_excerpt=raw_excerpt)

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(result.accepted)
            project_memory = JSONProjectMemoryStore(data_dir=tmp_dir).load_project(project_id="ringfall")
            self.assertIsNotNone(project_memory)
            assert project_memory is not None
            contents = [entry.content for entry in project_memory.workflow_learnings]
            self.assertNotIn(raw_excerpt, contents)
            self.assertFalse(any("PRIVATE SELECTED OUTPUT BODY" in content for content in contents))

    def test_target_specific_terms_are_not_copied_to_global_learning(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(result.accepted)
            global_root = Path(tmp_dir) / "memory" / "global"
            all_text = "\n".join(path.read_text(encoding="utf-8") for path in global_root.glob("*.json"))
            self.assertNotIn("RingFall", all_text)
            self.assertNotIn("ringfall", all_text.lower())
            self.assertNotIn(r"C:\EGYETEM\FUNSTUFF\RingFall", all_text)

    def test_repeated_same_run_dedupes_learning(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir)
            first = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)
            second = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertGreater(first.project_created_count, 0)
            self.assertGreater(first.global_created_count, 0)
            self.assertEqual(0, second.project_created_count)
            self.assertEqual(0, second.global_created_count)
            self.assertGreater(second.project_skipped_count, 0)
            self.assertGreater(second.global_skipped_count, 0)

    def test_warning_validation_creates_only_low_confidence_global_learning(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w7-learning-") as tmp_dir:
            run_id = _write_valid_loop(tmp_dir, validation_state="warning", overall_outcome="yellow", warnings=["warning-grade"])

            result = run_w7_opencode_learning_update(run_id, data_dir=tmp_dir, write=True)

            self.assertTrue(result.accepted)
            self.assertTrue(result.global_candidates)
            self.assertTrue(all(candidate["confidence"] == "low" for candidate in result.global_candidates))


def _write_valid_loop(
    data_dir: str,
    *,
    run_id: str = "ocloop-ringfall-seq1-20260604t120000",
    selected_excerpt: str = "Accepted with contract revisions.",
    validation_state: str = "ok",
    overall_outcome: str = "green",
    warnings: list[str] | None = None,
) -> str:
    payload = _valid_payload(run_id=run_id)
    payload["selected_outputs"]["outputs"][0]["excerpt"] = selected_excerpt
    payload["step_results"]["meta_plan_review"]["output"]["selected_text_excerpt"] = selected_excerpt
    payload["validation_state"] = validation_state
    payload["warnings"] = list(warnings or [])
    payload["final_output"]["overall_outcome"] = overall_outcome
    if validation_state != "ok":
        payload["packet_ledger"]["entries"][0]["validation_state"] = validation_state
    write_w7_opencode_loop_artifacts(payload, data_dir=data_dir)
    return run_id


def _mutate_sidecar(data_dir: str, run_id: str, sidecar_name: str, updates: dict[str, object]) -> None:
    path = Path(data_dir) / "artifacts" / run_id / f"{sidecar_name}.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload.update(updates)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _assert_no_learning_outputs(data_dir: str, run_id: str) -> None:
    root = Path(data_dir)
    forbidden_paths = [
        root / "memory" / "projects" / "ringfall.json",
        root / "memory" / "global",
        root / "artifacts" / run_id / "opencode_learning_update.json",
    ]
    existing_paths = [path.as_posix() for path in forbidden_paths if path.exists()]
    if existing_paths:
        raise AssertionError(f"Unexpected W7-E1 learning outputs: {existing_paths}")


def _valid_payload(*, run_id: str) -> dict[str, object]:
    payload = {
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
            "public_export_state": "blocked",
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


if __name__ == "__main__":
    unittest.main()
