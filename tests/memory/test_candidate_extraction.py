from __future__ import annotations

import json
import tempfile
import unittest

from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.memory import (
    JSONSessionMemoryStore,
    SessionMemory,
    extract_memory_candidates,
    write_memory_candidates_artifact,
)


class MemoryCandidateExtractionTests(unittest.TestCase):
    def test_no_session_id_returns_no_candidates(self) -> None:
        run_state = _build_manager_run_state(status=RunStatus.SUCCEEDED)
        run_state.context = {}
        run_state.input_payload = {"idea": "x"}

        self.assertEqual([], extract_memory_candidates(run_state=run_state))

    def test_failed_or_timed_out_runs_return_no_candidates(self) -> None:
        failed = _build_manager_run_state(status=RunStatus.FAILED)
        timed_out = _build_manager_run_state(status=RunStatus.TIMED_OUT)

        self.assertEqual([], extract_memory_candidates(run_state=failed))
        self.assertEqual([], extract_memory_candidates(run_state=timed_out))

    def test_manager_handoff_single_extraction_paths_work(self) -> None:
        manager = _build_manager_run_state(status=RunStatus.SUCCEEDED)
        handoff = _build_handoff_run_state(status=RunStatus.SUCCEEDED)
        single = _build_single_run_state(status=RunStatus.SUCCEEDED)

        manager_candidates = extract_memory_candidates(run_state=manager)
        handoff_candidates = extract_memory_candidates(run_state=handoff)
        single_candidates = extract_memory_candidates(run_state=single)

        self.assertTrue(manager_candidates)
        self.assertTrue(handoff_candidates)
        self.assertTrue(single_candidates)
        self.assertTrue(any(item["candidate_type"] == "decision" for item in manager_candidates))
        self.assertTrue(any(item["candidate_type"] == "risk" for item in handoff_candidates))
        self.assertTrue(any(item["candidate_type"] == "next_step" for item in single_candidates))

    def test_write_memory_candidates_artifact_writes_noncanonical_sidecar_only(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-k-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            store.save_session(
                SessionMemory(
                    session_id="thread-11",
                    memory={"sticky": "existing canonical truth"},
                ),
            )
            canonical_before = store.session_path(session_id="thread-11").read_text(encoding="utf-8")

            run_state = _build_manager_run_state(status=RunStatus.SUCCEEDED)
            path = write_memory_candidates_artifact(run_state=run_state, data_dir=tmp_dir)

            self.assertIsNotNone(path)
            assert path is not None
            self.assertTrue(path.exists())
            self.assertIn("artifacts", path.as_posix())
            self.assertTrue(path.name == "memory_candidates.json")

            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual("memory_candidates", payload["artifact_type"])
            self.assertEqual("thread-11", payload["session_id"])
            self.assertGreater(payload["candidate_count"], 0)

            canonical_after = store.session_path(session_id="thread-11").read_text(encoding="utf-8")
            self.assertEqual(canonical_before, canonical_after)

    def test_no_session_means_no_sidecar_write(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-k-") as tmp_dir:
            run_state = _build_manager_run_state(status=RunStatus.SUCCEEDED)
            run_state.context = {}
            run_state.input_payload = {"idea": "x"}

            self.assertIsNone(write_memory_candidates_artifact(run_state=run_state, data_dir=tmp_dir))


def _build_manager_run_state(*, status: RunStatus) -> RunState:
    run_state = RunState(
        run_id="run-manager-1",
        workflow_id="h1.manager.v1",
        status=status,
        input_payload={"idea": "Founder assistant", "session_id": "thread-11"},
        context={"session_id": "thread-11"},
    )
    run_state.output_payload = {
        "final_output": {
            "clarified_idea": "Structured founder assistant",
            "weak_points": ["Differentiation is not strong enough"],
            "recommended_mvp_direction": "Ship constrained H1 flow",
            "next_3_validation_steps": ["Interview 3 founders"],
        },
    }
    return run_state


def _build_handoff_run_state(*, status: RunStatus) -> RunState:
    run_state = RunState(
        run_id="run-handoff-1",
        workflow_id="h1.handoff.v1",
        status=status,
        input_payload={"idea": "Founder assistant", "session_id": "thread-11"},
        context={"session_id": "thread-11"},
    )
    run_state.output_payload = {
        "final_output": {
            "clarified_idea": "Handoff founder assistant",
            "weak_points": ["Needs tighter target segment"],
            "recommended_mvp_direction": "Narrow segment first",
            "next_3_validation_steps": ["Test with one founder segment"],
        },
    }
    return run_state


def _build_single_run_state(*, status: RunStatus) -> RunState:
    run_state = RunState(
        run_id="run-single-1",
        workflow_id="h1.single.v1",
        status=status,
        input_payload={"idea": "Founder assistant", "session_id": "thread-11"},
        context={"session_id": "thread-11"},
    )
    run_state.output_payload = {
        "step_results": {
            "single": {
                "output": {
                    "clarified_idea": "Single-pass founder assistant",
                    "weak_points": ["Single-agent blind spots"],
                    "recommended_mvp_direction": "Compare with manager variant",
                    "next_3_validation_steps": ["Run 5 idea comparisons"],
                },
            },
        },
    }
    return run_state


if __name__ == "__main__":
    unittest.main()
