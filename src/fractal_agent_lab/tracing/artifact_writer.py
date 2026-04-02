from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.events import TraceEvent
from fractal_agent_lab.core.models import RunState
from fractal_agent_lab.tracing.artifact_layout import run_artifact_path, trace_artifact_path


def write_run_artifact(run_state: RunState, *, data_dir: str | Path) -> Path:
    path = run_artifact_path(run_id=run_state.run_id, data_dir=data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = _normalize(asdict(run_state))
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def write_trace_artifact(events: list[TraceEvent], *, run_id: str, data_dir: str | Path) -> Path:
    path = trace_artifact_path(run_id=run_id, data_dir=data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(_normalize(asdict(event)), ensure_ascii=True) for event in events]
    content = "\n".join(lines)
    if lines:
        content += "\n"
    path.write_text(content, encoding="utf-8")
    return path


def _normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    if isinstance(value, tuple):
        return [_normalize(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return _normalize(asdict(value))
    return value
