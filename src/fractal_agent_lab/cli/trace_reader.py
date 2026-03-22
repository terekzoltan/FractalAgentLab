from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_trace_view_artifacts(*, run_id: str, data_dir: str | Path) -> tuple[dict[str, Any] | None, list[dict[str, Any]], Path, Path]:
    base_dir = Path(data_dir)
    trace_artifact_path = base_dir / "traces" / f"{run_id}.jsonl"
    run_artifact_path = base_dir / "runs" / f"{run_id}.json"

    trace_events = _load_trace_jsonl(trace_artifact_path)
    run_payload = _load_optional_run_payload(run_artifact_path)
    return run_payload, trace_events, run_artifact_path, trace_artifact_path


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

    return sorted(events, key=_event_sequence_key)


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


def _event_sequence_key(event: dict[str, Any]) -> tuple[int, str]:
    sequence = event.get("sequence")
    if isinstance(sequence, int):
        return (sequence, str(event.get("event_id", "")))
    return (10**9, str(event.get("event_id", "")))
