from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals import validate_run_trace_by_run_id


class ArtifactAcceptanceTests(unittest.TestCase):
    def test_valid_success_pair_passes(self) -> None:
        run_id = "run-ok-1"
        run_payload = {
            "run_id": run_id,
            "workflow_id": "h1.lite",
            "status": "succeeded",
            "input_payload": {"idea": "x"},
            "output_payload": {"step_results": {"intake": {"ok": True}}},
            "step_results": {"intake": {"ok": True}},
            "errors": [],
            "context": {},
            "trace_event_ids": ["e1", "e2", "e3", "e4"],
            "created_at": "2026-03-13T16:35:14.075384+00:00",
            "started_at": "2026-03-13T16:35:14.075384+00:00",
            "completed_at": "2026-03-13T16:35:14.075384+00:00",
            "schema_version": "run_state.v0",
        }
        trace_events = [
            _event("e1", run_id, 1, "run_started"),
            _event("e2", run_id, 2, "step_started", step_id="intake"),
            _event("e3", run_id, 3, "step_completed", step_id="intake"),
            _event("e4", run_id, 4, "run_completed"),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_pair(Path(tmp_dir), run_id, run_payload, trace_events)
            result = validate_run_trace_by_run_id(run_id, data_dir=tmp_dir)

        self.assertTrue(result.passed)
        self.assertEqual([], result.errors)

    def test_mismatched_run_id_fails(self) -> None:
        run_id = "run-bad-1"
        run_payload = {
            "run_id": run_id,
            "workflow_id": "h1.lite",
            "status": "failed",
            "input_payload": {"idea": "x"},
            "output_payload": None,
            "step_results": {},
            "errors": ["x"],
            "context": {},
            "trace_event_ids": ["e1", "e2", "e3"],
            "created_at": "2026-03-13T16:35:14.075384+00:00",
            "started_at": "2026-03-13T16:35:14.075384+00:00",
            "completed_at": "2026-03-13T16:35:14.075384+00:00",
            "schema_version": "run_state.v0",
        }
        trace_events = [
            _event("e1", "wrong-run-id", 1, "run_started"),
            _event("e2", "wrong-run-id", 2, "step_started", step_id="intake"),
            _event("e3", "wrong-run-id", 3, "run_failed"),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_pair(Path(tmp_dir), run_id, run_payload, trace_events)
            result = validate_run_trace_by_run_id(run_id, data_dir=tmp_dir)

        self.assertFalse(result.passed)
        self.assertTrue(any("run_id mismatch" in error for error in result.errors))


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
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": "2026-03-13T16:35:14.075384+00:00",
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": None,
        "correlation_id": None,
        "payload": {},
        "schema_version": "trace_event.v0",
    }


if __name__ == "__main__":
    unittest.main()
