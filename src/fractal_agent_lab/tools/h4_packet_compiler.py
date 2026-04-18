from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path

WAVE_START_PACKET_VERSION = "1.0"
WAVE_START_PACKET_EXECUTION_MODE = "actual_fal_workflow_run"
WAVE_START_PACKET_TYPE = "wave_start"
WAVE_START_PACKET_ROLE = "track_d.helper"
WAVE_START_PACKET_STATUS = "derived_transport_packet"

_REQUIRED_CONTEXT_REPORT_FIELDS: tuple[str, ...] = (
    "artifact_type",
    "artifact_version",
    "run_id",
    "workflow_id",
    "workflow_variant",
    "generated_at",
    "current_frontier",
    "blockers_or_holds",
    "next_recommended_action",
    "changed_surfaces",
    "likely_touched_files",
    "shared_zone_cautions",
    "sequencing_risks",
    "non_goals",
    "assumptions",
    "unknowns",
)


def compile_wave_start_packet_from_context_report(
    *,
    context_report: Mapping[str, Any],
    source_ref: str,
) -> dict[str, Any]:
    _assert_context_report_shape(context_report)

    packet = {
        "packet_type": WAVE_START_PACKET_TYPE,
        "packet_version": WAVE_START_PACKET_VERSION,
        "role": WAVE_START_PACKET_ROLE,
        "source_ref": source_ref,
        "frontier_ref": _required_text(context_report, "current_frontier"),
        "execution_mode": WAVE_START_PACKET_EXECUTION_MODE,
        "visibility_audit_state": {
            "git_visible_only": False,
            "non_canonical_inputs_used": [source_ref],
            "depends_on_local_data_artifacts": True,
        },
        "status": WAVE_START_PACKET_STATUS,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "track": "Track D",
        "step_ref": "CV1-C",
        "content": {
            "current_frontier": _required_text(context_report, "current_frontier"),
            "blockers_or_holds": _required_list(context_report, "blockers_or_holds"),
            "next_recommended_action": _required_text(context_report, "next_recommended_action"),
            "changed_surfaces": _required_list(context_report, "changed_surfaces"),
            "likely_touched_files": _required_list(context_report, "likely_touched_files"),
            "shared_zone_cautions": _required_list(context_report, "shared_zone_cautions"),
            "sequencing_risks": _required_list(context_report, "sequencing_risks"),
            "non_goals": _required_list(context_report, "non_goals"),
            "assumptions": _required_list(context_report, "assumptions"),
            "unknowns": _required_list(context_report, "unknowns"),
        },
        "upstream": {
            "artifact_type": _required_text(context_report, "artifact_type"),
            "artifact_version": _required_text(context_report, "artifact_version"),
            "run_id": _required_text(context_report, "run_id"),
            "workflow_id": _required_text(context_report, "workflow_id"),
            "workflow_variant": _required_text(context_report, "workflow_variant"),
            "generated_at": _required_text(context_report, "generated_at"),
        },
    }
    return packet


def render_wave_start_packet_markdown(packet: Mapping[str, Any]) -> str:
    packet_type = _required_text(packet, "packet_type")
    content = _required_mapping(packet, "content")
    lines = [
        f"# Packet: {packet_type}",
        "",
        f"- Packet version: {_required_text(packet, 'packet_version')}",
        f"- Frontier: {_required_text(packet, 'frontier_ref')}",
        f"- Status: {_required_text(packet, 'status')}",
        "",
        "## Wave Start",
        f"- Current frontier: {_required_text(content, 'current_frontier')}",
        f"- Next recommended action: {_required_text(content, 'next_recommended_action')}",
        "",
        "## Blockers",
    ]

    blockers = _required_list(content, "blockers_or_holds")
    if blockers:
        lines.extend(f"- {item}" for item in blockers)
    else:
        lines.append("- none")

    lines.extend(
        [
            "",
            "## Changed Surfaces",
            *[f"- {item}" for item in _required_list(content, "changed_surfaces")],
            "",
            "## Likely Touched Files",
            *[f"- {item}" for item in _required_list(content, "likely_touched_files")],
            "",
            "## Shared-Zone Cautions",
            *[f"- {item}" for item in _required_list(content, "shared_zone_cautions")],
            "",
            "## Sequencing Risks",
            *[f"- {item}" for item in _required_list(content, "sequencing_risks")],
            "",
            "## Non-Goals",
            *[f"- {item}" for item in _required_list(content, "non_goals")],
        ],
    )
    return "\n".join(lines) + "\n"


def write_wave_start_packet_sidecars_from_context_report(
    *,
    context_report_path: str | Path,
    run_id: str,
    data_dir: str | Path,
) -> tuple[Path, Path]:
    path = Path(context_report_path)
    context_report = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(context_report, dict):
        raise ValueError("Context report payload must be a JSON object.")

    context_report_run_id = _required_text(context_report, "run_id")
    if context_report_run_id != run_id:
        raise ValueError(
            "run_id mismatch between requested packet sidecar target and context_report payload.",
        )

    packet = compile_wave_start_packet_from_context_report(
        context_report=context_report,
        source_ref=str(path.as_posix()),
    )
    packet_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir) / "packets"
    packet_dir.mkdir(parents=True, exist_ok=True)

    json_path = packet_dir / "wave_start.packet.json"
    markdown_path = packet_dir / "wave_start.packet.md"

    json_path.write_text(json.dumps(packet, indent=2, ensure_ascii=True), encoding="utf-8")
    markdown_path.write_text(render_wave_start_packet_markdown(packet), encoding="utf-8")
    return json_path, markdown_path


def _assert_context_report_shape(context_report: Mapping[str, Any]) -> None:
    missing = [field for field in _REQUIRED_CONTEXT_REPORT_FIELDS if field not in context_report]
    if missing:
        raise ValueError(
            "Context report is missing required fields for wave_start packet compilation: "
            + ", ".join(missing)
            + ".",
        )
    if _required_text(context_report, "artifact_type") != "context_report":
        raise ValueError("Context report artifact_type must be 'context_report'.")
    if _required_text(context_report, "workflow_id") != "h4":
        raise ValueError("Context report workflow_id must be 'h4'.")
    if _required_text(context_report, "workflow_variant") != "h4.wave_start.v1":
        raise ValueError("Context report workflow_variant must be 'h4.wave_start.v1'.")


def _required_mapping(payload: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = payload.get(key)
    if isinstance(value, Mapping):
        return value
    raise ValueError(f"Field '{key}' must be a mapping.")


def _required_text(payload: Mapping[str, Any], key: str) -> str:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise ValueError(f"Field '{key}' must be a non-empty string.")


def _required_list(payload: Mapping[str, Any], key: str) -> list[str]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"Field '{key}' must be a list of strings.")
    items: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"Field '{key}' contains a non-string or empty item.")
        items.append(item.strip())
    return items
