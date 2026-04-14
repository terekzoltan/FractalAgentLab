from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fractal_agent_lab.tracing.artifact_layout import (
    run_artifact_path,
    runs_dir_path,
    trace_artifact_path,
    traces_dir_path,
)


def load_trace_view_artifacts(*, run_id: str, data_dir: str | Path) -> tuple[dict[str, Any] | None, list[dict[str, Any]], Path, Path]:
    resolved_trace_artifact_path = trace_artifact_path(run_id=run_id, data_dir=data_dir)
    resolved_run_artifact_path = run_artifact_path(run_id=run_id, data_dir=data_dir)

    trace_events = _load_trace_jsonl(resolved_trace_artifact_path)
    run_payload = _load_optional_run_payload(resolved_run_artifact_path)
    return run_payload, trace_events, resolved_run_artifact_path, resolved_trace_artifact_path


def _load_trace_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise ValueError(f"Trace artifact not found: {path.as_posix()}")

    try:
        content = path.read_text(encoding="utf-8")
    except OSError as error:
        raise ValueError(f"Failed to read trace artifact: {path.as_posix()} ({error})") from error

    events: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(
                f"Trace artifact parse error at line {line_number}: {error.msg}",
            ) from error
        if not isinstance(value, dict):
            raise ValueError(f"Trace artifact line {line_number} is not a JSON object.")
        events.append(value)

    if not events:
        raise ValueError(f"Trace artifact has no events: {path.as_posix()}")

    _validate_trace_event_sequence(events, path)
    return events


def _validate_trace_event_sequence(events: list[dict[str, Any]], path: Path) -> None:
    previous_sequence: int | None = None
    for index, event in enumerate(events, start=1):
        sequence = event.get("sequence")
        if not isinstance(sequence, int):
            raise ValueError(
                f"Trace artifact event #{index} has non-integer sequence: {path.as_posix()}",
            )
        if previous_sequence is not None and sequence <= previous_sequence:
            raise ValueError(
                "Trace artifact sequence is not strictly increasing at event "
                f"#{index}: {sequence} <= {previous_sequence}",
            )
        previous_sequence = sequence


def _load_optional_run_payload(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if isinstance(value, dict):
        return value
    return None


def list_trace_browser_rows(
    *,
    data_dir: str | Path,
    workflow_id_filter: str | None = None,
    status_filter: str | None = None,
    limit: int | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    run_ids = _discover_run_ids(data_dir=data_dir, warnings=warnings)

    rows: list[dict[str, Any]] = []
    for run_id in run_ids:
        row = _build_trace_browser_row(run_id=run_id, data_dir=data_dir, warnings=warnings)
        if _matches_filters(
            row,
            workflow_id_filter=workflow_id_filter,
            status_filter=status_filter,
        ):
            rows.append(row)

    rows.sort(key=_trace_browser_sort_key, reverse=True)
    if limit is not None:
        rows = rows[:limit]
    return rows, warnings


def _discover_run_ids(*, data_dir: str | Path, warnings: list[str]) -> list[str]:
    discovered: set[str] = set()
    discovered.update(
        _collect_run_ids_from_dir(
            directory=runs_dir_path(data_dir=data_dir),
            suffix=".json",
            warnings=warnings,
            label="runs",
        ),
    )
    discovered.update(
        _collect_run_ids_from_dir(
            directory=traces_dir_path(data_dir=data_dir),
            suffix=".jsonl",
            warnings=warnings,
            label="traces",
        ),
    )
    return sorted(discovered)


def _collect_run_ids_from_dir(
    *,
    directory: Path,
    suffix: str,
    warnings: list[str],
    label: str,
) -> set[str]:
    if not directory.exists():
        warnings.append(f"{label} directory not found: {directory.as_posix()}")
        return set()

    try:
        entries = list(directory.iterdir())
    except OSError as error:
        raise ValueError(f"Failed to list {label} directory: {directory.as_posix()} ({error})") from error

    run_ids: set[str] = set()
    for entry in entries:
        if not entry.is_file():
            continue
        if entry.suffix != suffix:
            continue
        run_ids.add(entry.stem)
    return run_ids


def _build_trace_browser_row(*, run_id: str, data_dir: str | Path, warnings: list[str]) -> dict[str, Any]:
    run_path = run_artifact_path(run_id=run_id, data_dir=data_dir)
    trace_path = trace_artifact_path(run_id=run_id, data_dir=data_dir)

    row: dict[str, Any] = {
        "run_id": run_id,
        "workflow_id": None,
        "status": None,
        "started_at": None,
        "completed_at": None,
        "run_artifact_path": run_path.as_posix(),
        "trace_artifact_path": trace_path.as_posix(),
        "has_run_artifact": run_path.exists(),
        "has_trace_artifact": trace_path.exists(),
        "trace_state": "missing",
        "trace_event_count": None,
        "trace_schema_versions": [],
    }

    run_payload = _load_optional_run_payload(run_path)
    if run_payload is not None:
        row["workflow_id"] = _str_or_none(run_payload.get("workflow_id"))
        row["status"] = _str_or_none(run_payload.get("status"))
        row["started_at"] = _str_or_none(run_payload.get("started_at"))
        row["completed_at"] = _str_or_none(run_payload.get("completed_at"))
    elif run_path.exists():
        warnings.append(f"Invalid run artifact (ignored for listing row): {run_path.as_posix()}")

    if not trace_path.exists():
        return row

    try:
        trace_events = _load_trace_jsonl(trace_path)
    except ValueError as error:
        row["trace_state"] = "invalid"
        warnings.append(f"{run_id}: {error}")
        return row

    row["trace_state"] = "ok"
    row["trace_event_count"] = len(trace_events)
    row["trace_schema_versions"] = sorted(
        {
            schema
            for schema in (_str_or_none(event.get("schema_version")) for event in trace_events)
            if schema is not None
        },
    )
    return row


def _matches_filters(
    row: dict[str, Any],
    *,
    workflow_id_filter: str | None,
    status_filter: str | None,
) -> bool:
    if workflow_id_filter is not None:
        workflow_id = _str_or_none(row.get("workflow_id"))
        if workflow_id is None or workflow_id != workflow_id_filter:
            return False

    if status_filter is not None:
        status = _str_or_none(row.get("status"))
        if status is None or status != status_filter:
            return False

    return True


def _trace_browser_sort_key(row: dict[str, Any]) -> tuple[float, str]:
    completed = _parse_iso_dt(_str_or_none(row.get("completed_at")))
    started = _parse_iso_dt(_str_or_none(row.get("started_at")))
    if completed is not None:
        ts = completed.timestamp()
    elif started is not None:
        ts = started.timestamp()
    else:
        ts = float("-inf")
    return ts, str(row.get("run_id", ""))


def _parse_iso_dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None
