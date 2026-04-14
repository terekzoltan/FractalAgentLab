from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from fractal_agent_lab.cli.app import run_cli


class R3JTraceBrowserTests(unittest.TestCase):
    def test_trace_list_json_browses_multiple_workflows(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id="run-h1", workflow_id="h1.manager.v1", status="succeeded")
            _write_run_trace_pair(data_dir, run_id="run-h2", workflow_id="h2.manager.v1", status="failed")
            _write_run_only(data_dir, run_id="run-h3-runonly", workflow_id="h3.manager.v1", status="succeeded")
            _write_trace_only(data_dir, run_id="run-trace-only")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(["trace", "list", "--data-dir", data_dir.as_posix(), "--format", "json"])

            payload = json.loads(out.getvalue())
            self.assertEqual(0, code)
            self.assertEqual(4, payload["summary"]["total_runs"])
            workflow_counts = payload["summary"]["workflow_counts"]
            self.assertEqual(1, workflow_counts["h1.manager.v1"])
            self.assertEqual(1, workflow_counts["h2.manager.v1"])
            self.assertEqual(1, workflow_counts["h3.manager.v1"])
            self.assertEqual(1, workflow_counts["unknown"])

            run_rows = {row["run_id"]: row for row in payload["runs"]}
            self.assertEqual("ok", run_rows["run-h1"]["trace_state"])
            self.assertEqual("missing", run_rows["run-h3-runonly"]["trace_state"])
            self.assertEqual("ok", run_rows["run-trace-only"]["trace_state"])

    def test_trace_list_invalid_trace_is_row_level_warning_not_command_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="run-invalid-trace", workflow_id="h1.handoff.v1", status="failed")
            _write_non_monotonic_trace(data_dir, run_id="run-invalid-trace")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(["trace", "list", "--data-dir", data_dir.as_posix(), "--format", "json"])

            payload = json.loads(out.getvalue())
            self.assertEqual(0, code)
            self.assertEqual(1, payload["summary"]["total_runs"])
            self.assertEqual(1, payload["summary"]["warnings_count"])
            row = payload["runs"][0]
            self.assertEqual("invalid", row["trace_state"])
            self.assertTrue(payload["warnings"])
            self.assertIn("run-invalid-trace", payload["warnings"][0])

    def test_trace_list_filter_excludes_unknown_rows_without_guessing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_only(data_dir, run_id="trace-only")
            _write_run_trace_pair(data_dir, run_id="run-h1", workflow_id="h1.manager.v1", status="succeeded")

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "trace",
                        "list",
                        "--data-dir",
                        data_dir.as_posix(),
                        "--workflow-id",
                        "h1.manager.v1",
                        "--status",
                        "succeeded",
                        "--format",
                        "json",
                    ],
                )

            payload = json.loads(out.getvalue())
            self.assertEqual(0, code)
            self.assertEqual(1, payload["summary"]["total_runs"])
            self.assertEqual("run-h1", payload["runs"][0]["run_id"])


def _write_run_trace_pair(data_dir: Path, *, run_id: str, workflow_id: str, status: str) -> None:
    _write_run_only(data_dir, run_id=run_id, workflow_id=workflow_id, status=status)
    _write_valid_trace(data_dir, run_id=run_id)


def _write_run_only(data_dir: Path, *, run_id: str, workflow_id: str, status: str) -> None:
    runs_dir = data_dir / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "input_payload": {},
        "output_payload": {},
        "step_results": {},
        "errors": [],
        "context": {},
        "trace_event_ids": [f"{run_id}-e1", f"{run_id}-e2"],
        "created_at": "2026-04-14T10:00:00+00:00",
        "started_at": "2026-04-14T10:00:01+00:00",
        "completed_at": "2026-04-14T10:00:02+00:00",
        "schema_version": "run_state.v1",
    }
    (runs_dir / f"{run_id}.json").write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_trace_only(data_dir: Path, *, run_id: str) -> None:
    _write_valid_trace(data_dir, run_id=run_id)


def _write_valid_trace(data_dir: Path, *, run_id: str) -> None:
    traces_dir = data_dir / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    events = [
        {
            "event_id": f"{run_id}-e1",
            "run_id": run_id,
            "sequence": 1,
            "event_type": "run_started",
            "timestamp": "2026-04-14T10:00:01+00:00",
            "source": "runtime.executor",
            "step_id": None,
            "parent_event_id": None,
            "correlation_id": None,
            "payload": {"execution_mode": "manager"},
            "schema_version": "trace_event.v1",
        },
        {
            "event_id": f"{run_id}-e2",
            "run_id": run_id,
            "sequence": 2,
            "event_type": "run_completed",
            "timestamp": "2026-04-14T10:00:02+00:00",
            "source": "runtime.executor",
            "step_id": None,
            "parent_event_id": None,
            "correlation_id": None,
            "payload": {"execution_mode": "manager"},
            "schema_version": "trace_event.v1",
        },
    ]
    content = "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n"
    (traces_dir / f"{run_id}.jsonl").write_text(content, encoding="utf-8")


def _write_non_monotonic_trace(data_dir: Path, *, run_id: str) -> None:
    traces_dir = data_dir / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    events = [
        {
            "event_id": f"{run_id}-e2",
            "run_id": run_id,
            "sequence": 2,
            "event_type": "run_completed",
            "timestamp": "2026-04-14T10:00:02+00:00",
            "source": "runtime.executor",
            "step_id": None,
            "parent_event_id": None,
            "correlation_id": None,
            "payload": {},
            "schema_version": "trace_event.v1",
        },
        {
            "event_id": f"{run_id}-e1",
            "run_id": run_id,
            "sequence": 1,
            "event_type": "run_started",
            "timestamp": "2026-04-14T10:00:01+00:00",
            "source": "runtime.executor",
            "step_id": None,
            "parent_event_id": None,
            "correlation_id": None,
            "payload": {},
            "schema_version": "trace_event.v1",
        },
    ]
    content = "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n"
    (traces_dir / f"{run_id}.jsonl").write_text(content, encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
