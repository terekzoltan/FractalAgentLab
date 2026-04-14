from __future__ import annotations

from pathlib import Path
from typing import Any

from fractal_agent_lab.memory.json_store import JSONProjectMemoryStore


def load_project_memory_context(
    *,
    input_payload: dict[str, Any],
    data_dir: str | Path,
) -> dict[str, Any]:
    project_id = _extract_project_id(input_payload)
    if project_id is None:
        return {}

    context: dict[str, Any] = {"project_id": project_id}
    store = JSONProjectMemoryStore(data_dir=data_dir)
    try:
        project_memory = store.load_project(project_id=project_id)
    except ValueError:
        return context

    if project_memory is None:
        return context

    context["project_memory"] = project_memory.to_dict()
    return context


def _extract_project_id(input_payload: dict[str, Any]) -> str | None:
    project_id = input_payload.get("project_id")
    if not isinstance(project_id, str):
        return None
    normalized = project_id.strip()
    if not normalized:
        return None
    return normalized
