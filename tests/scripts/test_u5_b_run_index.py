from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_u5_b_run_index import SCHEMA_VERSION, build_run_index, write_run_index


class U5BRunIndexTests(unittest.TestCase):
    def test_builds_valid_run_index_with_sidecars_and_disclosure_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(
                data_dir,
                run_id="run-valid",
                workflow_id="h1.single.v1",
                status="succeeded",
                provider="openrouter",
                model="test-model",
                used_fallback=False,
            )
            artifact_dir = data_dir / "artifacts" / "run-valid"
            artifact_dir.mkdir(parents=True)
            (artifact_dir / "summary.json").write_text("{}", encoding="utf-8")

            index = build_run_index(data_dir=data_dir)

            self.assertEqual(SCHEMA_VERSION, index["schema_version"])
            self.assertEqual(1, index["summary"]["total_runs"])
            row = index["runs"][0]
            self.assertEqual("run-valid", row["run_id"])
            self.assertEqual("ok", row["row_state"])
            self.assertEqual("ok", row["trace_state"])
            self.assertEqual(["openrouter"], row["provider_names"])
            self.assertEqual(["test-model"], row["model_names"])
            self.assertEqual("not_observed", row["fallback_state"])
            self.assertEqual(["summary.json"], row["sidecar_files"])

    def test_keeps_run_only_and_trace_only_rows_visible(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="run-only", workflow_id="h3.manager.v1", status="failed")
            _write_valid_trace(data_dir, run_id="trace-only")

            index = build_run_index(data_dir=data_dir)
            rows = {row["run_id"]: row for row in index["runs"]}

            self.assertEqual("missing", rows["run-only"]["trace_state"])
            self.assertEqual("missing_trace_artifact", rows["run-only"]["row_state"])
            self.assertEqual("missing_run_artifact", rows["trace-only"]["row_state"])
            self.assertIsNone(rows["trace-only"]["workflow_id"])

    def test_invalid_trace_is_row_level_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="bad-trace", workflow_id="h1.handoff.v1", status="failed")
            _write_non_monotonic_trace(data_dir, run_id="bad-trace")

            index = build_run_index(data_dir=data_dir)
            row = index["runs"][0]

            self.assertEqual("invalid", row["trace_state"])
            self.assertEqual("invalid_trace_artifact", row["row_state"])
            self.assertTrue(row["warnings"])
            self.assertEqual(1, index["summary"]["warnings_count"])

    def test_malformed_run_artifact_is_visible_row_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            runs_dir = data_dir / "runs"
            runs_dir.mkdir(parents=True, exist_ok=True)
            (runs_dir / "bad-run.json").write_text("{not-json", encoding="utf-8")
            _write_valid_trace(data_dir, run_id="bad-run")

            index = build_run_index(data_dir=data_dir)
            row = index["runs"][0]

            self.assertEqual("invalid_run_artifact", row["row_state"])
            self.assertTrue(row["warnings"])
            self.assertGreaterEqual(index["summary"]["warnings_count"], 1)

    def test_empty_trace_and_non_integer_sequence_are_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="empty", workflow_id="h1.single.v1", status="failed")
            _write_empty_trace(data_dir, run_id="empty")
            _write_run_only(data_dir, run_id="bad-sequence", workflow_id="h1.single.v1", status="failed")
            _write_non_integer_sequence_trace(data_dir, run_id="bad-sequence")

            index = build_run_index(data_dir=data_dir)
            rows = {row["run_id"]: row for row in index["runs"]}

            self.assertEqual("invalid", rows["empty"]["trace_state"])
            self.assertEqual("invalid", rows["bad-sequence"]["trace_state"])
            self.assertEqual(2, index["summary"]["warnings_count"])

    def test_missing_directories_produce_empty_warning_index(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            index = build_run_index(data_dir=Path(temp_dir_raw))

            self.assertEqual(0, index["summary"]["total_runs"])
            self.assertEqual(2, index["summary"]["warnings_count"])
            self.assertEqual([], index["runs"])

    def test_write_run_index_creates_output_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_path = Path(temp_dir_raw) / "ui" / "public" / "generated" / "run-index.json"
            _write_run_trace_pair(data_dir, run_id="run-valid", workflow_id="h1.single.v1", status="succeeded")

            write_run_index(data_dir=data_dir, out_path=out_path)

            payload = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(SCHEMA_VERSION, payload["schema_version"])


def _write_run_trace_pair(
    data_dir: Path,
    *,
    run_id: str,
    workflow_id: str,
    status: str,
    provider: str = "mock",
    model: str = "mock-model",
    used_fallback: bool = False,
) -> None:
    _write_run_only(
        data_dir,
        run_id=run_id,
        workflow_id=workflow_id,
        status=status,
        provider=provider,
        model=model,
        used_fallback=used_fallback,
    )
    _write_valid_trace(data_dir, run_id=run_id)


def _write_run_only(
    data_dir: Path,
    *,
    run_id: str,
    workflow_id: str,
    status: str,
    provider: str = "mock",
    model: str = "mock-model",
    used_fallback: bool = False,
) -> None:
    runs_dir = data_dir / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "input_payload": {},
        "output_payload": {
            "step_results": {
                "synthesizer": {
                    "provider": provider,
                    "model": model,
                    "used_fallback": used_fallback,
                },
            },
        },
        "started_at": "2026-05-02T10:00:01+00:00",
        "completed_at": "2026-05-02T10:00:02+00:00",
        "schema_version": "run_state.v1",
    }
    (runs_dir / f"{run_id}.json").write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_valid_trace(data_dir: Path, *, run_id: str) -> None:
    _write_trace_events(
        data_dir,
        run_id=run_id,
        events=[
            {"event_id": f"{run_id}-1", "run_id": run_id, "sequence": 1, "event_type": "run_started", "schema_version": "trace_event.v1"},
            {"event_id": f"{run_id}-2", "run_id": run_id, "sequence": 2, "event_type": "run_completed", "schema_version": "trace_event.v1"},
        ],
    )


def _write_non_monotonic_trace(data_dir: Path, *, run_id: str) -> None:
    _write_trace_events(
        data_dir,
        run_id=run_id,
        events=[
            {"event_id": f"{run_id}-2", "run_id": run_id, "sequence": 2, "event_type": "run_completed", "schema_version": "trace_event.v1"},
            {"event_id": f"{run_id}-1", "run_id": run_id, "sequence": 1, "event_type": "run_started", "schema_version": "trace_event.v1"},
        ],
    )


def _write_non_integer_sequence_trace(data_dir: Path, *, run_id: str) -> None:
    _write_trace_events(
        data_dir,
        run_id=run_id,
        events=[{"event_id": f"{run_id}-1", "run_id": run_id, "sequence": "1", "event_type": "run_started"}],
    )


def _write_empty_trace(data_dir: Path, *, run_id: str) -> None:
    traces_dir = data_dir / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    (traces_dir / f"{run_id}.jsonl").write_text("", encoding="utf-8")


def _write_trace_events(data_dir: Path, *, run_id: str, events: list[dict[str, object]]) -> None:
    traces_dir = data_dir / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    content = "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n"
    (traces_dir / f"{run_id}.jsonl").write_text(content, encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
