from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.tracing.artifact_layout import run_artifact_path, trace_artifact_path


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

