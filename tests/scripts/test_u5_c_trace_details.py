from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import scripts.build_u5_c_trace_details as trace_details
from scripts.build_u5_c_trace_details import SCHEMA_VERSION, build_trace_detail, write_trace_details


class U5CTraceDetailTests(unittest.TestCase):
    def test_builds_valid_trace_detail(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="trace-run", workflow_id="h1.handoff.v1", status="succeeded")
            _write_trace_events(
                data_dir,
                run_id="trace-run",
                events=[
                    _event("trace-run", 1, "run_started", payload={"lane": "manager", "turn_index": 0}),
                    _event("trace-run", 2, "handoff_decided", payload={"from_step_id": "planner", "to_step_id": "critic"}),
                    _event("trace-run", 3, "run_completed"),
                ],
            )

            detail = build_trace_detail(run_id="trace-run", data_dir=data_dir)

            self.assertEqual(SCHEMA_VERSION, detail["schema_version"])
            self.assertEqual("h1.handoff.v1", detail["workflow_id"])
            self.assertEqual(3, detail["summary"]["total_events"])
            self.assertEqual("ok", detail["validation"]["trace_state"])
            self.assertEqual("manager", detail["events"][0]["lane"])

    def test_marks_failure_events_and_preserves_unknown_event_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="trace-run")
            _write_trace_events(
                data_dir,
                run_id="trace-run",
                events=[
                    _event("trace-run", 1, "run_started"),
                    _event("trace-run", 2, "mystery_event", payload={"foo": "bar"}),
                    _event("trace-run", 3, "step_failed"),
                ],
            )

            detail = build_trace_detail(run_id="trace-run", data_dir=data_dir)

            self.assertEqual("mystery_event", detail["events"][1]["event_type"])
            self.assertFalse(detail["events"][1]["is_failure"])
            self.assertTrue(detail["events"][2]["is_failure"])

    def test_timestamp_warning_keeps_detail_valid(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="time-run")
            _write_trace_events(
                data_dir,
                run_id="time-run",
                events=[
                    _event("time-run", 1, "run_started", timestamp="2026-05-03T10:00:02+00:00"),
                    _event("time-run", 2, "step_completed", timestamp="2026-05-03T10:00:01+00:00"),
                ],
            )

            detail = build_trace_detail(run_id="time-run", data_dir=data_dir)

            self.assertEqual("warning", detail["validation"]["trace_state"])
            self.assertEqual("warning", detail["validation"]["timestamp_order"])
            self.assertTrue(detail["validation"]["warnings"])
            self.assertEqual(1, detail["events"][0]["sequence"])
            self.assertEqual(2, detail["events"][1]["sequence"])

    def test_missing_parent_target_creates_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="parent-run")
            _write_trace_events(
                data_dir,
                run_id="parent-run",
                events=[
                    _event("parent-run", 1, "run_started"),
                    _event("parent-run", 2, "step_completed", parent_event_id="missing-parent"),
                ],
            )

            detail = build_trace_detail(run_id="parent-run", data_dir=data_dir)

            self.assertEqual("warning", detail["validation"]["linkage_state"])
            self.assertIn("missing-parent", detail["validation"]["warnings"][0])

    def test_write_trace_details_skips_invalid_and_missing_traces(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "ui" / "public" / "generated" / "traces"
            _write_trace_pair(data_dir, run_id="valid-run")
            _write_run_only(data_dir, run_id="missing-trace", workflow_id="h1.single.v1", status="failed")
            _write_run_only(data_dir, run_id="invalid-run", workflow_id="h1.single.v1", status="failed")
            _write_trace_events(
                data_dir,
                run_id="invalid-run",
                events=[
                    _event("invalid-run", 2, "run_completed"),
                    _event("invalid-run", 1, "run_started"),
                ],
            )

            summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertTrue((out_dir / "valid-run.json").exists())
            self.assertFalse((out_dir / "missing-trace.json").exists())
            self.assertFalse((out_dir / "invalid-run.json").exists())
            self.assertEqual(1, summary["generated_count"])
            self.assertEqual(2, summary["skipped_count"])

    def test_write_trace_details_removes_stale_outputs_for_skipped_runs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "ui" / "public" / "generated" / "traces"
            out_dir.mkdir(parents=True, exist_ok=True)
            _write_trace_detail_sentinel(out_dir)
            stale_path = out_dir / "invalid-run.json"
            stale_path.write_text("{}", encoding="utf-8")

            _write_trace_pair(data_dir, run_id="valid-run")
            _write_run_only(data_dir, run_id="invalid-run", workflow_id="h1.single.v1", status="failed")
            _write_trace_events(
                data_dir,
                run_id="invalid-run",
                events=[
                    _event("invalid-run", 2, "run_completed"),
                    _event("invalid-run", 1, "run_started"),
                ],
            )

            summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertFalse(stale_path.exists())
            self.assertTrue((out_dir / "valid-run.json").exists())
            self.assertEqual(1, summary["generated_count"])

    def test_write_trace_details_initializes_missing_output_dir_with_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "generated" / "traces"
            _write_trace_pair(data_dir, run_id="valid-run")

            summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertTrue((out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL).exists())
            self.assertTrue((out_dir / "valid-run.json").exists())
            self.assertEqual(1, summary["generated_count"])

    def test_write_trace_details_initializes_empty_output_dir_with_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "generated" / "traces"
            out_dir.mkdir(parents=True)
            _write_trace_pair(data_dir, run_id="valid-run")

            write_trace_details(data_dir=data_dir, out_dir=out_dir)

            sentinel = out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL
            self.assertEqual(trace_details.GENERATED_TRACE_DETAILS_SENTINEL_CONTENT, sentinel.read_text(encoding="utf-8"))

    def test_write_trace_details_refuses_non_empty_custom_dir_without_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "custom-output"
            out_dir.mkdir(parents=True)
            existing_json = out_dir / "canonical-looking-run.json"
            existing_content = '{"run_id":"do-not-delete"}'
            existing_json.write_text(existing_content, encoding="utf-8")
            _write_trace_pair(data_dir, run_id="valid-run")

            with self.assertRaises(OSError):
                write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertEqual(existing_content, existing_json.read_text(encoding="utf-8"))
            self.assertFalse((out_dir / "valid-run.json").exists())

    def test_write_trace_details_refuses_canonical_data_dir_even_with_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            original_canonical_data_dir = trace_details.CANONICAL_DATA_DIR
            try:
                temp_root = Path(temp_dir_raw)
                trace_details.CANONICAL_DATA_DIR = temp_root / "data"
                data_dir = temp_root / "source-data"
                out_dir = trace_details.CANONICAL_DATA_DIR / "runs"
                out_dir.mkdir(parents=True)
                _write_trace_detail_sentinel(out_dir)
                existing_json = out_dir / "canonical-run.json"
                existing_content = '{"run_id":"canonical"}'
                existing_json.write_text(existing_content, encoding="utf-8")
                _write_trace_pair(data_dir, run_id="valid-run")

                with self.assertRaises(OSError):
                    write_trace_details(data_dir=data_dir, out_dir=out_dir)

                self.assertEqual(existing_content, existing_json.read_text(encoding="utf-8"))
                self.assertFalse((out_dir / "valid-run.json").exists())
            finally:
                trace_details.CANONICAL_DATA_DIR = original_canonical_data_dir

    def test_write_trace_details_bootstraps_exact_default_trace_output_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            original_default_dir = trace_details.DEFAULT_GENERATED_TRACE_DETAILS_DIR
            try:
                data_dir = Path(temp_dir_raw) / "data"
                out_dir = Path(temp_dir_raw) / "ui" / "public" / "generated" / "traces"
                trace_details.DEFAULT_GENERATED_TRACE_DETAILS_DIR = out_dir
                out_dir.mkdir(parents=True)
                stale_path = out_dir / "stale-run.json"
                stale_path.write_text("{}", encoding="utf-8")
                _write_trace_pair(data_dir, run_id="valid-run")

                summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

                self.assertFalse(stale_path.exists())
                self.assertTrue((out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL).exists())
                self.assertTrue((out_dir / "valid-run.json").exists())
                self.assertEqual(1, summary["generated_count"])
            finally:
                trace_details.DEFAULT_GENERATED_TRACE_DETAILS_DIR = original_default_dir

    def test_payload_summary_and_raw_payload_are_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="payload-run")
            payload = {"lane": "critic", "turn_index": 3, "alpha": "beta", "nested": {"x": 1}}
            _write_trace_events(data_dir, run_id="payload-run", events=[_event("payload-run", 1, "agent_completed", payload=payload)])

            detail = build_trace_detail(run_id="payload-run", data_dir=data_dir)

            self.assertIn("alpha=beta", detail["events"][0]["payload_summary"])
            self.assertEqual(payload, detail["events"][0]["payload"])


def _write_trace_pair(data_dir: Path, *, run_id: str) -> None:
    _write_run_only(data_dir, run_id=run_id, workflow_id="h1.single.v1", status="succeeded")
    _write_trace_events(data_dir, run_id=run_id, events=[_event(run_id, 1, "run_started"), _event(run_id, 2, "run_completed")])


def _write_trace_detail_sentinel(out_dir: Path) -> None:
    (out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL).write_text(
        trace_details.GENERATED_TRACE_DETAILS_SENTINEL_CONTENT,
        encoding="utf-8",
    )


def _write_run_only(data_dir: Path, *, run_id: str, workflow_id: str, status: str) -> None:
    runs_dir = data_dir / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "input_payload": {},
        "output_payload": {},
        "started_at": "2026-05-03T10:00:00+00:00",
        "completed_at": "2026-05-03T10:00:01+00:00",
        "schema_version": "run_state.v1",
    }
    (runs_dir / f"{run_id}.json").write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_trace_events(data_dir: Path, *, run_id: str, events: list[dict[str, object]]) -> None:
    traces_dir = data_dir / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    content = "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n"
    (traces_dir / f"{run_id}.jsonl").write_text(content, encoding="utf-8")


def _event(
    run_id: str,
    sequence: int,
    event_type: str,
    *,
    timestamp: str | None = None,
    payload: dict[str, object] | None = None,
    parent_event_id: str | None = None,
) -> dict[str, object]:
    return {
        "event_id": f"{run_id}-{sequence}",
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": timestamp or f"2026-05-03T10:00:0{sequence}+00:00",
        "source": "runtime.executor",
        "step_id": None,
        "parent_event_id": parent_event_id,
        "correlation_id": None,
        "payload": payload or {},
        "schema_version": "trace_event.v1",
    }


if __name__ == "__main__":
    unittest.main()
