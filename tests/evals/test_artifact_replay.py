from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals import replay_run_artifacts_by_id


class ArtifactReplayTests(unittest.TestCase):
    def test_replays_v0_single_success(self) -> None:
        run_id = "h2e-v0-single"
        run_payload = {
            "run_id": run_id,
            "workflow_id": "h1.single.v1",
            "status": "succeeded",
            "input_payload": {"idea": "x"},
            "output_payload": {
                "step_results": {
                    "single": {
                        "output": {"clarified_idea": "x"},
                    },
                },
            },
            "step_results": {"single": {"output": {"clarified_idea": "x"}}},
            "errors": [],
            "context": {},
            "trace_event_ids": ["e1", "e2", "e3", "e4"],
            "created_at": "2026-04-02T10:00:00+00:00",
            "started_at": "2026-04-02T10:00:01+00:00",
            "completed_at": "2026-04-02T10:00:02+00:00",
            "schema_version": "run_state.v0",
        }
        trace_events = [
            _event("e1", run_id, 1, "run_started", payload={"execution_mode": "linear"}),
            _event("e2", run_id, 2, "step_started", step_id="single", payload={"lane": "linear"}),
            _event("e3", run_id, 3, "step_completed", step_id="single", payload={"lane": "linear"}),
            _event("e4", run_id, 4, "run_completed", payload={"execution_mode": "linear"}),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_pair(Path(tmp_dir), run_id, run_payload, trace_events)
            report = replay_run_artifacts_by_id(run_id, data_dir=tmp_dir)

        self.assertTrue(report["replay_ready"])
        self.assertEqual("h1.single.v1", report["run_summary"]["workflow_id"])
        self.assertEqual("linear", report["orchestration_reconstruction"]["execution_mode"])
        self.assertEqual(["single"], report["orchestration_reconstruction"]["step_path"])
        self.assertFalse(report["failure_summary"]["has_failure"])

    def test_replays_v1_manager_success(self) -> None:
        run_id = "h2e-v1-manager"
        run_payload = {
            "run_id": run_id,
            "workflow_id": "h1.manager.v1",
            "status": "succeeded",
            "input_payload": {"idea": "x"},
            "output_payload": {
                "step_results": {"synthesizer": {"output": {"ok": True}}},
                "manager_orchestration": {
                    "manager_step_id": "synthesizer",
                    "worker_step_ids": ["intake", "planner", "critic"],
                    "turns": [
                        {
                            "turn_index": 1,
                            "action": "delegate",
                            "target_step_id": "intake",
                        },
                    ],
                },
                "final_output": {"clarified_idea": "x"},
            },
            "step_results": {
                "synthesizer": {"output": {"ok": True}},
                "intake": {"output": {"ok": True}},
            },
            "errors": [],
            "failure": None,
            "context": {},
            "trace_event_ids": ["e1", "e2", "e3", "e4", "e5", "e6"],
            "status_transitions": [
                {"status": "pending", "timestamp": "2026-04-02T10:00:00+00:00"},
                {"status": "running", "timestamp": "2026-04-02T10:00:01+00:00"},
                {"status": "succeeded", "timestamp": "2026-04-02T10:00:02+00:00"},
            ],
            "created_at": "2026-04-02T10:00:00+00:00",
            "started_at": "2026-04-02T10:00:01+00:00",
            "completed_at": "2026-04-02T10:00:02+00:00",
            "schema_version": "run_state.v1",
        }
        trace_events = [
            _event(
                "e1",
                run_id,
                1,
                "run_started",
                schema_version="trace_event.v1",
                payload={"execution_mode": "manager"},
            ),
            _event(
                "e2",
                run_id,
                2,
                "step_started",
                step_id="synthesizer",
                schema_version="trace_event.v1",
                payload={"lane": "manager", "turn_index": 1},
            ),
            _event(
                "e3",
                run_id,
                3,
                "step_completed",
                step_id="synthesizer",
                schema_version="trace_event.v1",
                payload={"lane": "manager", "turn_index": 1},
            ),
            _event(
                "e4",
                run_id,
                4,
                "step_started",
                step_id="intake",
                schema_version="trace_event.v1",
                payload={"lane": "worker", "turn_index": 1},
            ),
            _event(
                "e5",
                run_id,
                5,
                "step_completed",
                step_id="intake",
                schema_version="trace_event.v1",
                payload={"lane": "worker", "turn_index": 1},
            ),
            _event("e6", run_id, 6, "run_completed", schema_version="trace_event.v1"),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_pair(Path(tmp_dir), run_id, run_payload, trace_events)
            report = replay_run_artifacts_by_id(run_id, data_dir=tmp_dir)

        self.assertTrue(report["replay_ready"])
        manager = report["orchestration_reconstruction"]["manager"]
        self.assertIsInstance(manager, dict)
        self.assertEqual("synthesizer", manager["manager_step_id"])
        self.assertEqual(1, manager["turn_count"])

    def test_replays_v1_handoff_with_linkage(self) -> None:
        run_id = "h2e-v1-handoff"
        run_payload = {
            "run_id": run_id,
            "workflow_id": "h1.handoff.v1",
            "status": "succeeded",
            "input_payload": {"idea": "x"},
            "output_payload": {
                "step_results": {
                    "intake": {"output": {"ok": True}},
                    "planner": {"output": {"ok": True}},
                },
                "handoff_orchestration": {
                    "entrypoint_step_id": "intake",
                    "path": ["intake", "planner"],
                    "handoff_count": 1,
                    "turns": [{"handoff_index": 1, "from_step_id": "intake", "target_step_id": "planner"}],
                    "final_step_id": "planner",
                },
                "final_output": {"clarified_idea": "x"},
            },
            "step_results": {
                "intake": {"output": {"ok": True}},
                "planner": {"output": {"ok": True}},
            },
            "errors": [],
            "failure": None,
            "context": {},
            "trace_event_ids": ["e1", "e2", "e3", "e4", "e5", "e6"],
            "status_transitions": [
                {"status": "pending", "timestamp": "2026-04-02T10:00:00+00:00"},
                {"status": "running", "timestamp": "2026-04-02T10:00:01+00:00"},
                {"status": "succeeded", "timestamp": "2026-04-02T10:00:02+00:00"},
            ],
            "created_at": "2026-04-02T10:00:00+00:00",
            "started_at": "2026-04-02T10:00:01+00:00",
            "completed_at": "2026-04-02T10:00:02+00:00",
            "schema_version": "run_state.v1",
        }
        trace_events = [
            _event(
                "e1",
                run_id,
                1,
                "run_started",
                schema_version="trace_event.v1",
                payload={"execution_mode": "handoff"},
            ),
            _event(
                "e2",
                run_id,
                2,
                "step_started",
                step_id="intake",
                schema_version="trace_event.v1",
                correlation_id="handoff:h2e-v1-handoff:1",
                payload={"lane": "handoff", "turn_index": 1, "handoff_index": 1, "from_step_id": "intake"},
            ),
            _event(
                "e3",
                run_id,
                3,
                "step_completed",
                step_id="intake",
                schema_version="trace_event.v1",
                correlation_id="handoff:h2e-v1-handoff:1",
                payload={"lane": "handoff", "turn_index": 1, "handoff_index": 1, "from_step_id": "intake"},
            ),
            _event(
                "e4",
                run_id,
                4,
                "handoff_decided",
                step_id="intake",
                schema_version="trace_event.v1",
                parent_event_id="e3",
                correlation_id="handoff:h2e-v1-handoff:1",
                payload={
                    "lane": "handoff",
                    "handoff_index": 1,
                    "decision_action": "handoff",
                    "decision_source": "explicit",
                    "from_step_id": "intake",
                    "to_step_id": "planner",
                    "reason": "ok",
                },
            ),
            _event(
                "e5",
                run_id,
                5,
                "step_started",
                step_id="planner",
                schema_version="trace_event.v1",
                parent_event_id="e4",
                correlation_id="handoff:h2e-v1-handoff:2",
                payload={"lane": "handoff", "turn_index": 2, "handoff_index": 2, "from_step_id": "planner"},
            ),
            _event("e6", run_id, 6, "run_completed", schema_version="trace_event.v1"),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_pair(Path(tmp_dir), run_id, run_payload, trace_events)
            report = replay_run_artifacts_by_id(run_id, data_dir=tmp_dir)

        self.assertTrue(report["replay_ready"])
        self.assertGreater(report["linkage_summary"]["with_parent_event_id"], 0)
        self.assertGreater(report["linkage_summary"]["with_correlation_id"], 0)
        handoff = report["orchestration_reconstruction"]["handoff"]
        self.assertEqual(["intake", "planner"], handoff["path"])
        self.assertGreaterEqual(handoff["turn_count"], 1)

    def test_replays_v1_pre_step_failure(self) -> None:
        run_id = "h2e-v1-pre-step-fail"
        run_payload = {
            "run_id": run_id,
            "workflow_id": "h1.manager.v1",
            "status": "failed",
            "input_payload": {"idea": "x"},
            "output_payload": None,
            "step_results": {},
            "errors": ["mode unsupported"],
            "failure": {
                "code": "runtime_boundary_error",
                "message": "mode unsupported",
                "category": "runtime_boundary",
                "error_type": "RuntimeBoundaryError",
                "details": {"execution_mode": "parallel"},
                "recoverable": False,
                "schema_version": "runtime_error_envelope.v1",
            },
            "context": {},
            "trace_event_ids": ["e1", "e2"],
            "status_transitions": [
                {"status": "pending", "timestamp": "2026-04-02T10:00:00+00:00"},
                {"status": "running", "timestamp": "2026-04-02T10:00:01+00:00"},
                {"status": "failed", "timestamp": "2026-04-02T10:00:02+00:00", "reason": "mode unsupported"},
            ],
            "created_at": "2026-04-02T10:00:00+00:00",
            "started_at": "2026-04-02T10:00:01+00:00",
            "completed_at": "2026-04-02T10:00:02+00:00",
            "schema_version": "run_state.v1",
        }
        trace_events = [
            _event(
                "e1",
                run_id,
                1,
                "run_started",
                schema_version="trace_event.v1",
                payload={"execution_mode": "manager"},
            ),
            _event(
                "e2",
                run_id,
                2,
                "run_failed",
                schema_version="trace_event.v1",
                payload={
                    "code": "runtime_boundary_error",
                    "error": "mode unsupported",
                    "details": {"execution_mode": "parallel"},
                    "failure_envelope": {
                        "code": "runtime_boundary_error",
                        "message": "mode unsupported",
                        "category": "runtime_boundary",
                        "error_type": "RuntimeBoundaryError",
                    },
                },
            ),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_pair(Path(tmp_dir), run_id, run_payload, trace_events)
            report = replay_run_artifacts_by_id(run_id, data_dir=tmp_dir)

        self.assertTrue(report["replay_ready"])
        self.assertTrue(report["failure_summary"]["has_failure"])
        self.assertTrue(report["failure_summary"]["pre_step_failure"])

    def test_invalid_artifact_blocks_replay(self) -> None:
        run_id = "h2e-invalid"
        run_payload = {
            "run_id": run_id,
            "workflow_id": "h1.single.v1",
            "status": "succeeded",
            "input_payload": {},
            "output_payload": {"step_results": {"single": {"ok": True}}},
            "step_results": {"single": {"ok": True}},
            "errors": [],
            "context": {},
            "trace_event_ids": ["e1"],
            "created_at": "2026-04-02T10:00:00+00:00",
            "started_at": "2026-04-02T10:00:01+00:00",
            "completed_at": "2026-04-02T10:00:02+00:00",
            "schema_version": "run_state.v0",
        }

        with tempfile.TemporaryDirectory(prefix="fal replay ") as tmp_dir:
            base = Path(tmp_dir)
            runs_dir = base / "runs"
            runs_dir.mkdir(parents=True, exist_ok=True)
            (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")

            report = replay_run_artifacts_by_id(run_id, data_dir=base)

        self.assertFalse(report["replay_ready"])
        self.assertIn("replay_blockers", report)
        blockers = report["replay_blockers"]
        self.assertTrue(any("Missing trace artifact" in item for item in blockers))


def _write_pair(
    base_dir: Path,
    run_id: str,
    run_payload: dict[str, object],
    trace_events: list[dict[str, object]],
) -> None:
    runs_dir = base_dir / "runs"
    traces_dir = base_dir / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    (runs_dir / f"{run_id}.json").write_text(
        json.dumps(run_payload, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )
    trace_content = "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n"
    (traces_dir / f"{run_id}.jsonl").write_text(trace_content, encoding="utf-8")


def _event(
    event_id: str,
    run_id: str,
    sequence: int,
    event_type: str,
    *,
    step_id: str | None = None,
    parent_event_id: str | None = None,
    correlation_id: str | None = None,
    payload: dict[str, object] | None = None,
    schema_version: str = "trace_event.v0",
    timestamp: str = "2026-04-02T10:00:01+00:00",
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": timestamp,
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": parent_event_id,
        "correlation_id": correlation_id,
        "payload": payload or {},
        "schema_version": schema_version,
    }


if __name__ == "__main__":
    unittest.main()
