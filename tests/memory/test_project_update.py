from __future__ import annotations

import json
import tempfile
import unittest

from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.memory import JSONProjectMemoryStore, run_post_run_project_memory_update


class ProjectMemoryUpdateTests(unittest.TestCase):
    def test_missing_project_id_returns_none(self) -> None:
        run_state = _build_h2_run_state(status=RunStatus.SUCCEEDED)
        run_state.input_payload.pop("project_id", None)
        run_state.context = {}

        with tempfile.TemporaryDirectory(prefix="fal-r3-i-") as tmp_dir:
            self.assertIsNone(run_post_run_project_memory_update(run_state=run_state, data_dir=tmp_dir))

    def test_session_id_does_not_fallback_to_project_id(self) -> None:
        run_state = _build_h2_run_state(status=RunStatus.SUCCEEDED)
        run_state.input_payload.pop("project_id", None)
        run_state.input_payload["session_id"] = "thread-1"
        run_state.context = {"session_id": "thread-1"}

        with tempfile.TemporaryDirectory(prefix="fal-r3-i-") as tmp_dir:
            self.assertIsNone(run_post_run_project_memory_update(run_state=run_state, data_dir=tmp_dir))

    def test_non_succeeded_run_returns_none(self) -> None:
        run_state = _build_h2_run_state(status=RunStatus.FAILED)
        with tempfile.TemporaryDirectory(prefix="fal-r3-i-") as tmp_dir:
            self.assertIsNone(run_post_run_project_memory_update(run_state=run_state, data_dir=tmp_dir))

    def test_unsupported_workflow_returns_none(self) -> None:
        run_state = _build_h2_run_state(status=RunStatus.SUCCEEDED)
        run_state.workflow_id = "h1.manager.v1"
        with tempfile.TemporaryDirectory(prefix="fal-r3-i-") as tmp_dir:
            self.assertIsNone(run_post_run_project_memory_update(run_state=run_state, data_dir=tmp_dir))

    def test_h2_update_writes_canonical_project_memory_and_sidecar(self) -> None:
        run_state = _build_h2_run_state(status=RunStatus.SUCCEEDED)
        with tempfile.TemporaryDirectory(prefix="fal-r3-i-") as tmp_dir:
            result = run_post_run_project_memory_update(run_state=run_state, data_dir=tmp_dir)
            self.assertIsNotNone(result)
            assert result is not None
            self.assertEqual("repo-alpha", result.project_id)
            self.assertGreaterEqual(result.created_count, 1)

            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            project_memory = store.load_project(project_id="repo-alpha")
            self.assertIsNotNone(project_memory)
            assert project_memory is not None
            self.assertTrue(project_memory.stable_decisions)
            self.assertTrue(project_memory.workflow_learnings)

            artifact_payload = json.loads(result.artifact_path.read_text(encoding="utf-8"))
            self.assertEqual("project_memory_update", artifact_payload["artifact_type"])
            self.assertEqual("repo-alpha", artifact_payload["project_id"])

    def test_h3_update_extracts_all_frozen_buckets_as_learnings(self) -> None:
        run_state = _build_h3_run_state(status=RunStatus.SUCCEEDED)
        with tempfile.TemporaryDirectory(prefix="fal-r3-i-") as tmp_dir:
            result = run_post_run_project_memory_update(run_state=run_state, data_dir=tmp_dir)
            self.assertIsNotNone(result)
            assert result is not None

            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            project_memory = store.load_project(project_id="repo-beta")
            self.assertIsNotNone(project_memory)
            assert project_memory is not None
            subtypes = {entry.entry_subtype for entry in project_memory.workflow_learnings}
            self.assertTrue({"strength", "bottleneck", "merge_risk", "refactor_idea"}.issubset(subtypes))

    def test_repeated_signal_is_merged_not_duplicated(self) -> None:
        first = _build_h2_run_state(status=RunStatus.SUCCEEDED)
        second = _build_h2_run_state(status=RunStatus.SUCCEEDED)
        second.run_id = "run-h2-2"
        with tempfile.TemporaryDirectory(prefix="fal-r3-i-") as tmp_dir:
            first_result = run_post_run_project_memory_update(run_state=first, data_dir=tmp_dir)
            self.assertIsNotNone(first_result)
            second_result = run_post_run_project_memory_update(run_state=second, data_dir=tmp_dir)
            self.assertIsNotNone(second_result)
            assert second_result is not None
            self.assertGreater(second_result.updated_count, 0)

            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            project_memory = store.load_project(project_id="repo-alpha")
            self.assertIsNotNone(project_memory)
            assert project_memory is not None
            matches = [
                entry
                for entry in project_memory.stable_decisions
                if entry.entry_subtype == "recommended_starting_slice"
                and entry.content == "stabilize_h2_template_contract"
            ]
            self.assertEqual(1, len(matches))
            self.assertEqual(2, matches[0].times_observed)


def _build_h2_run_state(*, status: RunStatus) -> RunState:
    run_state = RunState(
        run_id="run-h2-1",
        workflow_id="h2.manager.v1",
        status=status,
        input_payload={"goal": "decompose", "project_id": "repo-alpha"},
        context={"project_id": "repo-alpha"},
    )
    run_state.output_payload = {
        "final_output": {
            "recommended_starting_slice": "stabilize_h2_template_contract",
            "risk_zones": ["registry drift", "false green"],
        },
    }
    return run_state


def _build_h3_run_state(*, status: RunStatus) -> RunState:
    run_state = RunState(
        run_id="run-h3-1",
        workflow_id="h3.manager.v1",
        status=status,
        input_payload={"goal": "review", "project_id": "repo-beta"},
        context={"project_id": "repo-beta"},
    )
    run_state.output_payload = {
        "final_output": {
            "strengths": ["clear boundaries"],
            "bottlenecks": ["status drift"],
            "merge_risks": ["cross-surface mismatch"],
            "refactor_ideas": ["shared assertion helper"],
        },
    }
    return run_state


if __name__ == "__main__":
    unittest.main()
