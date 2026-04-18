from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path
from fractal_agent_lab.workflows.h4 import H4_WAVE_START_WORKFLOW_ID

H4_CONTEXT_REPORT_ARTIFACT_VERSION = "1.0"
H4_REQUIRED_TEXT_FIELDS: tuple[str, ...] = (
    "repo_summary",
    "current_frontier",
    "next_recommended_action",
)
H4_REQUIRED_NON_EMPTY_LIST_FIELDS: tuple[str, ...] = (
    "changed_surfaces",
    "relevant_docs",
    "relevant_code_areas",
    "likely_touched_files",
    "assumptions",
    "unknowns",
    "recent_change_notes",
)
H4_REQUIRED_LIST_FIELDS: tuple[str, ...] = (
    "blockers_or_holds",
    "shared_zone_cautions",
    "sequencing_risks",
    "non_goals",
)


def write_h4_context_report_artifact(
    *,
    run_state: RunState,
    data_dir: str | Path,
) -> Path | None:
    if run_state.workflow_id != H4_WAVE_START_WORKFLOW_ID:
        return None
    if run_state.status != RunStatus.SUCCEEDED:
        return None

    final_output = _extract_final_output(run_state.output_payload)
    if final_output is None:
        raise ValueError("H4 context_report requires a successful final_output payload.")

    context_report = {
        "repo_summary": _clean_text(final_output.get("repo_summary")),
        "changed_surfaces": _clean_list(final_output.get("changed_surfaces")),
        "relevant_docs": _clean_list(final_output.get("relevant_docs")),
        "relevant_code_areas": _clean_list(final_output.get("relevant_code_areas")),
        "likely_touched_files": _clean_list(final_output.get("likely_touched_files")),
        "assumptions": _clean_list(final_output.get("assumptions")),
        "unknowns": _clean_list(final_output.get("unknowns")),
        "recent_change_notes": _clean_list(final_output.get("recent_change_notes")),
        "current_frontier": _clean_text(final_output.get("current_frontier")),
        "blockers_or_holds": _clean_list(final_output.get("blockers_or_holds")),
        "shared_zone_cautions": _clean_list(final_output.get("shared_zone_cautions")),
        "sequencing_risks": _clean_list(final_output.get("sequencing_risks")),
        "non_goals": _clean_list(final_output.get("non_goals")),
        "next_recommended_action": _clean_text(final_output.get("next_recommended_action")),
    }

    missing_fields = _missing_required_fields(final_output=final_output, context_report=context_report)
    if missing_fields:
        raise ValueError(
            "H4 context_report missing required fields: " + ", ".join(missing_fields) + ".",
        )

    artifact_dir = run_artifact_dir_path(run_id=run_state.run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "context_report.json"
    payload = {
        "artifact_type": "context_report",
        "artifact_version": H4_CONTEXT_REPORT_ARTIFACT_VERSION,
        "run_id": run_state.run_id,
        "workflow_id": "h4",
        "workflow_variant": H4_WAVE_START_WORKFLOW_ID,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        **context_report,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def _extract_final_output(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    final_output = payload.get("final_output")
    if not isinstance(final_output, dict):
        return None
    return final_output


def _clean_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return normalized


def _clean_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []

    cleaned: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        normalized = item.strip()
        if not normalized:
            continue
        cleaned.append(normalized)
    return cleaned


def _missing_required_fields(
    *,
    final_output: dict[str, Any],
    context_report: dict[str, Any],
) -> list[str]:
    missing: list[str] = []

    for key in H4_REQUIRED_TEXT_FIELDS:
        if key not in final_output or context_report.get(key) is None:
            missing.append(key)

    for key in H4_REQUIRED_NON_EMPTY_LIST_FIELDS:
        raw_value = final_output.get(key)
        if not isinstance(raw_value, list) or not context_report.get(key):
            missing.append(key)

    for key in H4_REQUIRED_LIST_FIELDS:
        if not isinstance(final_output.get(key), list):
            missing.append(key)

    return missing
