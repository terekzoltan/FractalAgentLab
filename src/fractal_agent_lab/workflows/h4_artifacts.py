from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path
from fractal_agent_lab.workflows.h4 import H4_SEQ_NEXT_WORKFLOW_ID, H4_WAVE_START_WORKFLOW_ID

H4_CONTEXT_REPORT_ARTIFACT_VERSION = "1.0"
H4_ACCEPTANCE_CHECKS_ARTIFACT_VERSION = "1.0"
H4_IMPLEMENTATION_PLAN_ARTIFACT_VERSION = "1.0"

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

SEQ_NEXT_REQUIRED_TEXT_FIELDS: tuple[str, ...] = (
    "task_summary",
    "intent",
    "repo_summary",
    "current_frontier",
    "next_recommended_action",
)
SEQ_NEXT_REQUIRED_NON_EMPTY_LIST_FIELDS: tuple[str, ...] = (
    "changed_surfaces",
    "relevant_docs",
    "relevant_code_areas",
    "likely_touched_files",
    "assumptions",
    "unknowns",
    "recent_change_notes",
    "step_order",
    "dependencies",
    "test_plan",
    "documentation_obligations",
    "open_questions",
    "shared_zone_cautions",
    "sequencing_risks",
    "non_goals",
    "functional_checks",
    "tests_required",
    "docs_required",
)
SEQ_NEXT_REQUIRED_LIST_FIELDS: tuple[str, ...] = (
    "blockers_or_holds",
    "blocking_conditions",
)

RISK_REGISTER_REQUIRED_FIELDS: tuple[str, ...] = (
    "id",
    "title",
    "severity",
    "type",
    "description",
    "mitigation",
    "owner",
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
        "generated_at": _iso_now(),
        **context_report,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def write_h4_seq_next_implementation_plan_artifact(
    *,
    run_state: RunState,
    data_dir: str | Path,
) -> Path | None:
    if run_state.workflow_id != H4_SEQ_NEXT_WORKFLOW_ID:
        return None
    if run_state.status != RunStatus.SUCCEEDED:
        return None

    final_output = _extract_final_output(run_state.output_payload)
    if final_output is None:
        raise ValueError("H4 implementation_plan requires a successful final_output payload.")

    missing = _missing_seq_next_final_output_fields(final_output)
    if missing:
        raise ValueError("H4 seq_next final_output missing required fields: " + ", ".join(missing) + ".")

    normalized_risk_register = _normalize_risk_register(final_output.get("risk_register"))
    if not normalized_risk_register:
        raise ValueError("H4 seq_next risk_register must contain at least one well-formed risk row.")

    artifact_dir = run_artifact_dir_path(run_id=run_state.run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "implementation_plan.md"

    generated_at = _iso_now()
    frontmatter = {
        "artifact_type": "implementation_plan",
        "artifact_version": H4_IMPLEMENTATION_PLAN_ARTIFACT_VERSION,
        "run_id": run_state.run_id,
        "workflow_id": "h4",
        "workflow_variant": H4_SEQ_NEXT_WORKFLOW_ID,
        "generated_at": generated_at,
    }
    content = _render_h4_seq_next_plan(
        frontmatter=frontmatter,
        final_output=final_output,
        normalized_risk_register=normalized_risk_register,
    )
    path.write_text(content, encoding="utf-8")
    return path


def write_h4_seq_next_acceptance_checks_artifact(
    *,
    run_state: RunState,
    data_dir: str | Path,
) -> Path | None:
    if run_state.workflow_id != H4_SEQ_NEXT_WORKFLOW_ID:
        return None
    if run_state.status != RunStatus.SUCCEEDED:
        return None

    final_output = _extract_final_output(run_state.output_payload)
    if final_output is None:
        raise ValueError("H4 acceptance_checks requires a successful final_output payload.")

    fields = {
        "functional_checks": _clean_list(final_output.get("functional_checks")),
        "tests_required": _clean_list(final_output.get("tests_required")),
        "docs_required": _clean_list(final_output.get("docs_required")),
        "non_goals": _clean_list(final_output.get("non_goals")),
        "blocking_conditions": _clean_list(final_output.get("blocking_conditions")),
    }

    missing: list[str] = []
    for key, value in fields.items():
        raw = final_output.get(key)
        if not isinstance(raw, list):
            missing.append(key)
            continue
        if key != "blocking_conditions" and not value:
            missing.append(key)
    if missing:
        raise ValueError("H4 acceptance_checks missing required fields: " + ", ".join(missing) + ".")

    artifact_dir = run_artifact_dir_path(run_id=run_state.run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "acceptance_checks.json"
    payload = {
        "artifact_type": "acceptance_checks",
        "artifact_version": H4_ACCEPTANCE_CHECKS_ARTIFACT_VERSION,
        "run_id": run_state.run_id,
        "workflow_id": "h4",
        "workflow_variant": H4_SEQ_NEXT_WORKFLOW_ID,
        "generated_at": _iso_now(),
        **fields,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def _render_h4_seq_next_plan(
    *,
    frontmatter: dict[str, str],
    final_output: dict[str, Any],
    normalized_risk_register: list[dict[str, str]],
) -> str:
    lines = [
        "---",
        f"artifact_type: {frontmatter['artifact_type']}",
        f"artifact_version: {frontmatter['artifact_version']}",
        f"run_id: {frontmatter['run_id']}",
        f"workflow_id: {frontmatter['workflow_id']}",
        f"workflow_variant: {frontmatter['workflow_variant']}",
        f"generated_at: {frontmatter['generated_at']}",
        "---",
        "",
        "# Implementation Plan",
        "",
    ]

    sections = [
        ("Task Summary", _clean_text(final_output.get("task_summary"))),
        ("Intent", _clean_text(final_output.get("intent"))),
        ("Current Repo Context", _clean_text(final_output.get("repo_summary"))),
        ("Affected Surfaces", _clean_list(final_output.get("changed_surfaces"))),
        ("Likely Touched Files", _clean_list(final_output.get("likely_touched_files"))),
        ("Step Order", _clean_list(final_output.get("step_order"))),
        ("Dependencies", _clean_list(final_output.get("dependencies"))),
        ("Test Plan", _clean_list(final_output.get("test_plan"))),
        (
            "Documentation Obligations",
            _clean_list(final_output.get("documentation_obligations")),
        ),
        ("Risks", _render_risk_register(normalized_risk_register)),
        ("Open Questions", _clean_list(final_output.get("open_questions"))),
        ("Shared-Zone Cautions", _clean_list(final_output.get("shared_zone_cautions"))),
        ("Sequencing Risks", _clean_list(final_output.get("sequencing_risks"))),
        ("Functional Checks", _clean_list(final_output.get("functional_checks"))),
        ("Tests Required", _clean_list(final_output.get("tests_required"))),
        ("Docs Required", _clean_list(final_output.get("docs_required"))),
        ("Blocking Conditions", _clean_list(final_output.get("blocking_conditions"))),
        ("Non-Goals", _clean_list(final_output.get("non_goals"))),
    ]

    for heading, value in sections:
        lines.append(f"## {heading}")
        if isinstance(value, str):
            lines.append(value if value else "- none")
        else:
            lines.extend(_render_markdown_list(value))
        lines.append("")

    return "\n".join(lines) + "\n"


def _render_risk_register(value: list[dict[str, str]]) -> list[str]:
    if not value:
        return ["none"]
    rendered: list[str] = []
    for item in value:
        risk_id = item["id"]
        title = item["title"]
        severity = item["severity"]
        risk_type = item["type"]
        description = item["description"]
        mitigation = item["mitigation"]
        owner = item["owner"]
        rendered.append(f"{risk_id}: {title} ({severity}, {risk_type}, owner={owner})")
        if description:
            rendered.append(f"description: {description}")
        if mitigation:
            rendered.append(f"mitigation: {mitigation}")
    return rendered or ["none"]


def _render_markdown_list(items: list[str]) -> list[str]:
    if not items:
        return ["- none"]
    return [f"- {item}" for item in items]


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


def _missing_seq_next_final_output_fields(final_output: dict[str, Any]) -> list[str]:
    missing: list[str] = []

    for key in SEQ_NEXT_REQUIRED_TEXT_FIELDS:
        value = _clean_text(final_output.get(key))
        if value is None:
            missing.append(key)

    for key in SEQ_NEXT_REQUIRED_NON_EMPTY_LIST_FIELDS:
        raw = final_output.get(key)
        if not isinstance(raw, list) or not _clean_list(raw):
            missing.append(key)

    for key in SEQ_NEXT_REQUIRED_LIST_FIELDS:
        if not isinstance(final_output.get(key), list):
            missing.append(key)

    risk_register = final_output.get("risk_register")
    if not isinstance(risk_register, list) or not risk_register:
        missing.append("risk_register")

    return missing


def _normalize_risk_register(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    normalized_rows: list[dict[str, str]] = []
    for row in value:
        if not isinstance(row, dict):
            return []

        normalized_row: dict[str, str] = {}
        for field_name in RISK_REGISTER_REQUIRED_FIELDS:
            field_value = _clean_text(row.get(field_name))
            if field_value is None:
                return []
            normalized_row[field_name] = field_value

        normalized_rows.append(normalized_row)

    return normalized_rows


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()
