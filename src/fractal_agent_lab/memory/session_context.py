from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.memory.json_store import JSONSessionMemoryStore
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


def load_session_memory_context(
    *,
    input_payload: dict[str, Any],
    data_dir: str | Path,
) -> dict[str, Any]:
    session_id = _extract_session_id(input_payload)
    if session_id is None:
        return {}

    context: dict[str, Any] = {"session_id": session_id}
    store = JSONSessionMemoryStore(data_dir=data_dir)
    try:
        session_memory = store.load_session(session_id=session_id)
    except ValueError:
        return context

    if session_memory is None:
        return context

    context["session_memory"] = session_memory.to_dict()
    return context


def write_session_memory_snapshot_artifact(
    *,
    run_id: str,
    workflow_id: str,
    run_context: dict[str, Any],
    data_dir: str | Path,
) -> Path | None:
    session_memory = run_context.get("session_memory")
    session_id = run_context.get("session_id")
    if not isinstance(session_id, str) or not session_id:
        return None
    if not isinstance(session_memory, dict):
        return None

    artifact_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "session_memory.json"
    payload = {
        "artifact_type": "session_memory_snapshot",
        "artifact_version": "1.0",
        "run_id": run_id,
        "workflow_id": workflow_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "session_memory": session_memory,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def _extract_session_id(input_payload: dict[str, Any]) -> str | None:
    session_id = input_payload.get("session_id")
    if not isinstance(session_id, str):
        return None
    normalized = session_id.strip()
    if not normalized:
        return None
    return normalized
