from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.memory.json_store import JSONProjectMemoryStore
from fractal_agent_lab.memory.project_memory import ProjectMemory, ProjectMemoryEntry, PROJECT_MEMORY_SCHEMA_VERSION
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


PROJECT_MEMORY_UPDATE_ARTIFACT_VERSION = "1.0"

H2_WORKFLOW_ID = "h2.manager.v1"
H3_WORKFLOW_ID = "h3.manager.v1"


@dataclass(slots=True)
class ProjectMemoryUpdateResult:
    project_id: str
    created_count: int
    updated_count: int
    skipped_count: int
    artifact_path: Path


def run_post_run_project_memory_update(
    *,
    run_state: RunState,
    data_dir: str | Path,
) -> ProjectMemoryUpdateResult | None:
    if run_state.status != RunStatus.SUCCEEDED:
        return None

    project_id = _extract_project_id(run_state)
    if project_id is None:
        return None

    extracted = _extract_project_entries(run_state=run_state, project_id=project_id)
    if not extracted:
        return None

    store = JSONProjectMemoryStore(data_dir=data_dir)
    project_memory = store.load_project(project_id=project_id)
    if project_memory is None:
        project_memory = ProjectMemory(project_id=project_id)

    created_count, updated_count, skipped_count = _merge_entries(project_memory=project_memory, entries=extracted)
    if created_count == 0 and updated_count == 0:
        return None

    project_memory.updated_at = datetime.now(timezone.utc).isoformat()
    store.save_project(project_memory)
    artifact_path = write_project_memory_update_artifact(
        run_id=run_state.run_id,
        workflow_id=run_state.workflow_id,
        project_id=project_id,
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        applied_entries=[entry.to_dict() for entry in extracted],
        data_dir=data_dir,
    )
    return ProjectMemoryUpdateResult(
        project_id=project_id,
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        artifact_path=artifact_path,
    )


def write_project_memory_update_artifact(
    *,
    run_id: str,
    workflow_id: str,
    project_id: str,
    created_count: int,
    updated_count: int,
    skipped_count: int,
    applied_entries: list[dict[str, Any]],
    data_dir: str | Path,
) -> Path:
    artifact_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "project_memory_update.json"
    payload = {
        "artifact_type": "project_memory_update",
        "artifact_version": PROJECT_MEMORY_UPDATE_ARTIFACT_VERSION,
        "project_memory_schema_version": PROJECT_MEMORY_SCHEMA_VERSION,
        "run_id": run_id,
        "workflow_id": workflow_id,
        "project_id": project_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "created_count": created_count,
        "updated_count": updated_count,
        "skipped_count": skipped_count,
        "applied_entries": applied_entries,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def _extract_project_entries(*, run_state: RunState, project_id: str) -> list[ProjectMemoryEntry]:
    if run_state.workflow_id not in {H2_WORKFLOW_ID, H3_WORKFLOW_ID}:
        return []

    output_payload = run_state.output_payload
    if not isinstance(output_payload, dict):
        return []

    final_output = output_payload.get("final_output")
    if not isinstance(final_output, dict):
        return []

    if run_state.workflow_id == H2_WORKFLOW_ID:
        return _extract_h2_entries(run_state=run_state, project_id=project_id, final_output=final_output)
    return _extract_h3_entries(run_state=run_state, project_id=project_id, final_output=final_output)


def _extract_h2_entries(
    *,
    run_state: RunState,
    project_id: str,
    final_output: dict[str, Any],
) -> list[ProjectMemoryEntry]:
    _ = project_id
    entries: list[ProjectMemoryEntry] = []
    now = datetime.now(timezone.utc).isoformat()

    starting_slice = final_output.get("recommended_starting_slice")
    if isinstance(starting_slice, str) and starting_slice.strip():
        entries.append(
            ProjectMemoryEntry(
                entry_type="stable_decision",
                entry_subtype="recommended_starting_slice",
                content=starting_slice.strip(),
                workflow_id=run_state.workflow_id,
                source_path="output_payload.final_output.recommended_starting_slice",
                first_seen_run_id=run_state.run_id,
                last_seen_run_id=run_state.run_id,
                last_updated_at=now,
            ),
        )

    risk_zones = final_output.get("risk_zones")
    if isinstance(risk_zones, list):
        for item in risk_zones:
            if not isinstance(item, str) or not item.strip():
                continue
            entries.append(
                ProjectMemoryEntry(
                    entry_type="workflow_learning",
                    entry_subtype="risk_zone",
                    content=item.strip(),
                    workflow_id=run_state.workflow_id,
                    source_path="output_payload.final_output.risk_zones[]",
                    first_seen_run_id=run_state.run_id,
                    last_seen_run_id=run_state.run_id,
                    last_updated_at=now,
                ),
            )

    return entries


def _extract_h3_entries(
    *,
    run_state: RunState,
    project_id: str,
    final_output: dict[str, Any],
) -> list[ProjectMemoryEntry]:
    _ = project_id
    entries: list[ProjectMemoryEntry] = []
    now = datetime.now(timezone.utc).isoformat()
    sections: tuple[tuple[str, str], ...] = (
        ("strengths", "strength"),
        ("bottlenecks", "bottleneck"),
        ("merge_risks", "merge_risk"),
        ("refactor_ideas", "refactor_idea"),
    )

    for section_key, subtype in sections:
        value = final_output.get(section_key)
        if not isinstance(value, list):
            continue
        for item in value:
            if not isinstance(item, str) or not item.strip():
                continue
            entries.append(
                ProjectMemoryEntry(
                    entry_type="workflow_learning",
                    entry_subtype=subtype,
                    content=item.strip(),
                    workflow_id=run_state.workflow_id,
                    source_path=f"output_payload.final_output.{section_key}[]",
                    first_seen_run_id=run_state.run_id,
                    last_seen_run_id=run_state.run_id,
                    last_updated_at=now,
                ),
            )

    return entries


def _extract_project_id(run_state: RunState) -> str | None:
    context_id = run_state.context.get("project_id")
    if isinstance(context_id, str) and context_id.strip():
        return context_id.strip()

    payload_id = run_state.input_payload.get("project_id")
    if isinstance(payload_id, str) and payload_id.strip():
        return payload_id.strip()
    return None


def _merge_entries(*, project_memory: ProjectMemory, entries: list[ProjectMemoryEntry]) -> tuple[int, int, int]:
    created_count = 0
    updated_count = 0
    skipped_count = 0

    for incoming in entries:
        target_list = project_memory.stable_decisions
        if incoming.entry_type == "workflow_learning":
            target_list = project_memory.workflow_learnings

        existing = _find_existing_entry(target_list=target_list, incoming=incoming)
        if existing is None:
            target_list.append(incoming)
            created_count += 1
            continue

        if existing.last_seen_run_id == incoming.last_seen_run_id:
            skipped_count += 1
            continue

        existing.last_seen_run_id = incoming.last_seen_run_id
        existing.last_updated_at = incoming.last_updated_at
        existing.times_observed += 1
        updated_count += 1

    return created_count, updated_count, skipped_count


def _find_existing_entry(*, target_list: list[ProjectMemoryEntry], incoming: ProjectMemoryEntry) -> ProjectMemoryEntry | None:
    normalized_content = _normalize_content(incoming.content)
    for candidate in target_list:
        if (
            candidate.workflow_id == incoming.workflow_id
            and candidate.entry_type == incoming.entry_type
            and candidate.entry_subtype == incoming.entry_subtype
            and _normalize_content(candidate.content) == normalized_content
        ):
            return candidate
    return None


def _normalize_content(value: str) -> str:
    return " ".join(value.split()).strip().lower()
