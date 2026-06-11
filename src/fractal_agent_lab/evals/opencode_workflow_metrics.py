from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Mapping

from fractal_agent_lab.core.contracts.w6_packet import WINDOWS_RESERVED_DEVICE_NAMES, require_w6_path_identifier
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


W7_5_WORKFLOW_METRICS_SCHEMA_VERSION = "w7_5.workflow_metrics.v1"
W7_5_REVIEW_FINDINGS_LEDGER_SCHEMA_VERSION = "w7_5.review_findings_ledger.v1"
W7_5_METRICS_CLAIM_BOUNDARY = "structural_workflow_metrics_not_quality_score_or_public_claim"

_REQUIRED_SIDECAR_SCHEMAS = {
    "opencode_loop_summary": "w7.opencode_loop_summary.v1",
    "packet_ledger": "w7.packet_ledger.v1",
    "selected_outputs": "w7.selected_outputs.v1",
    "review_synthesis": "w7.review_synthesis.v1",
    "approval_log": "w7.approval_log.v1",
    "ingest_report": "w7.ingest_report.v1",
}
_ALLOWED_HUMAN_LABELS = {
    "true_positive",
    "false_positive",
    "uncertain",
    "style_only",
    "duplicate",
    "out_of_scope",
}
_RAW_BODY_FIELD_NAMES = {
    "raw_body",
    "body",
    "transcript",
    "raw_transcript",
    "reasoning",
    "thoughts",
    "chain_of_thought",
}


class W75WorkflowMetricsError(ValueError):
    pass


def build_workflow_metrics(run_id: str, *, data_dir: str | Path = "data") -> dict[str, Any]:
    safe_run_id = _validated_run_id(run_id)
    sidecars = _load_required_sidecars(run_id=safe_run_id, data_dir=data_dir)
    summary = sidecars["opencode_loop_summary"]
    packet_entries = _list_field(sidecars["packet_ledger"], "entries")
    selected_outputs = _list_field(sidecars["selected_outputs"], "outputs")
    approval_checkpoints = _list_field(sidecars["approval_log"], "checkpoints")
    warnings = _list_field(summary, "warnings")
    stages = [_string_or_none(entry.get("stage")) for entry in packet_entries if isinstance(entry, Mapping)]
    producers = [_string_or_none(entry.get("producer")) for entry in packet_entries if isinstance(entry, Mapping)]
    consumers = [_string_or_none(entry.get("consumer")) for entry in packet_entries if isinstance(entry, Mapping)]
    return {
        "schema_version": W7_5_WORKFLOW_METRICS_SCHEMA_VERSION,
        "run_id": safe_run_id,
        "claim_boundary": W7_5_METRICS_CLAIM_BOUNDARY,
        "public_safe": False,
        "raw_transcript_retained": False,
        "raw_selected_output_body_retained": False,
        "quality_score": None,
        "quality_score_status": "not_computed",
        "source_sidecars": _source_sidecar_names(),
        "source_sidecar_schema_versions": dict(_REQUIRED_SIDECAR_SCHEMAS),
        "packet_count": len(packet_entries),
        "approval_count": len(approval_checkpoints),
        "approved_checkpoint_count": sum(1 for checkpoint in approval_checkpoints if isinstance(checkpoint, Mapping) and checkpoint.get("approved") is True),
        "selected_output_count": len(selected_outputs),
        "review_synthesis_present": bool(summary.get("review_synthesis_present")),
        "warning_count": len(warnings),
        "validation_state": summary.get("validation_state"),
        "clean_pass_eligible": bool(summary.get("clean_pass_eligible")),
        "overall_outcome": summary.get("overall_outcome"),
        "terminal_stage": summary.get("terminal_stage"),
        "stage_count": len([stage for stage in stages if stage is not None]),
        "unique_stage_count": len({stage for stage in stages if stage is not None}),
        "unique_producer_count": len({producer for producer in producers if producer is not None}),
        "unique_consumer_count": len({consumer for consumer in consumers if consumer is not None}),
        "loop_entry_mode": summary.get("loop_entry_mode"),
        "automation_mode": summary.get("automation_mode"),
    }


def write_workflow_metrics(run_id: str, *, data_dir: str | Path = "data") -> Path:
    safe_run_id = _validated_run_id(run_id)
    path = run_artifact_dir_path(run_id=safe_run_id, data_dir=data_dir) / "workflow_metrics.json"
    _fail_if_exists(path)
    payload = build_workflow_metrics(safe_run_id, data_dir=data_dir)
    _write_json(path, payload)
    return path


def build_review_findings_ledger(
    run_id: str,
    *,
    data_dir: str | Path = "data",
    manual_findings: Iterable[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    safe_run_id = _validated_run_id(run_id)
    _load_required_sidecars(run_id=safe_run_id, data_dir=data_dir)
    findings = _validate_manual_findings(manual_findings or [])
    return {
        "schema_version": W7_5_REVIEW_FINDINGS_LEDGER_SCHEMA_VERSION,
        "run_id": safe_run_id,
        "claim_boundary": W7_5_METRICS_CLAIM_BOUNDARY,
        "public_safe": False,
        "raw_transcript_retained": False,
        "raw_selected_output_body_retained": False,
        "labels_are_human_supplied": True,
        "default_label": "uncertain",
        "source_sidecars": _source_sidecar_names(),
        "findings": findings,
    }


def write_review_findings_ledger(
    run_id: str,
    *,
    data_dir: str | Path = "data",
    manual_findings: Iterable[Mapping[str, Any]] | None = None,
) -> Path:
    safe_run_id = _validated_run_id(run_id)
    path = run_artifact_dir_path(run_id=safe_run_id, data_dir=data_dir) / "review_findings_ledger.json"
    _fail_if_exists(path)
    payload = build_review_findings_ledger(safe_run_id, data_dir=data_dir, manual_findings=manual_findings)
    _write_json(path, payload)
    return path


def _load_required_sidecars(*, run_id: str, data_dir: str | Path) -> dict[str, dict[str, Any]]:
    safe_run_id = _validated_run_id(run_id)
    artifact_dir = run_artifact_dir_path(run_id=safe_run_id, data_dir=data_dir)
    sidecars: dict[str, dict[str, Any]] = {}
    for name, schema_version in _REQUIRED_SIDECAR_SCHEMAS.items():
        path = artifact_dir / f"{name}.json"
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as error:
            raise W75WorkflowMetricsError(f"Missing required W7 sidecar: {name}") from error
        except (OSError, json.JSONDecodeError) as error:
            raise W75WorkflowMetricsError(f"Malformed required W7 sidecar '{name}': {error}") from error
        if not isinstance(payload, dict):
            raise W75WorkflowMetricsError(f"Required W7 sidecar '{name}' root must be an object.")
        if payload.get("schema_version") != schema_version:
            raise W75WorkflowMetricsError(f"Required W7 sidecar '{name}' has unsupported schema_version.")
        if payload.get("run_id") != safe_run_id:
            raise W75WorkflowMetricsError(f"Required W7 sidecar '{name}' run_id does not match requested run_id.")
        sidecars[name] = payload
    return sidecars


def _validated_run_id(run_id: str) -> str:
    try:
        return require_w6_path_identifier(run_id, field_name="run_id", reserved_names=WINDOWS_RESERVED_DEVICE_NAMES)
    except ValueError as error:
        raise W75WorkflowMetricsError(f"Invalid run_id for W7.5 metrics artifact path: {error}") from error


def _validate_manual_findings(manual_findings: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for index, item in enumerate(manual_findings, start=1):
        if not isinstance(item, Mapping):
            raise W75WorkflowMetricsError(f"Manual finding #{index} must be an object.")
        finding = dict(item)
        _reject_raw_body_fields(finding, index=index)
        if finding.get("public_safe") is True:
            raise W75WorkflowMetricsError(f"Manual finding #{index} must not set public_safe true.")
        for field in ("finding_id", "summary", "source_stage"):
            if not isinstance(finding.get(field), str) or not finding[field].strip():
                raise W75WorkflowMetricsError(f"Manual finding #{index} missing non-empty {field}.")
        label = finding.get("human_label", "uncertain")
        if label not in _ALLOWED_HUMAN_LABELS:
            raise W75WorkflowMetricsError(f"Manual finding #{index} has unsupported human_label.")
        findings.append(
            {
                "finding_id": finding["finding_id"].strip(),
                "source_stage": finding["source_stage"].strip(),
                "severity": _optional_stripped(finding.get("severity")),
                "category": _optional_stripped(finding.get("category")),
                "summary": finding["summary"].strip(),
                "affected_files": _string_list(finding.get("affected_files", []), field_name="affected_files", index=index),
                "required_fix": _optional_stripped(finding.get("required_fix")),
                "human_label": label,
                "resolution_status": _optional_stripped(finding.get("resolution_status")),
                "resolved_by_run_id": _optional_stripped(finding.get("resolved_by_run_id")),
            }
        )
    return findings


def _reject_raw_body_fields(value: Mapping[str, Any], *, index: int) -> None:
    for key in value:
        if key in _RAW_BODY_FIELD_NAMES:
            raise W75WorkflowMetricsError(f"Manual finding #{index} contains forbidden raw body/transcript field: {key}")


def _list_field(payload: Mapping[str, Any], field_name: str) -> list[Any]:
    value = payload.get(field_name)
    return list(value) if isinstance(value, list) else []


def _string_list(value: Any, *, field_name: str, index: int) -> list[str]:
    if not isinstance(value, list):
        raise W75WorkflowMetricsError(f"Manual finding #{index} field {field_name} must be a list.")
    result = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise W75WorkflowMetricsError(f"Manual finding #{index} field {field_name} must contain only non-empty strings.")
        result.append(item.strip())
    return result


def _source_sidecar_names() -> list[str]:
    return [f"{name}.json" for name in _REQUIRED_SIDECAR_SCHEMAS]


def _fail_if_exists(path: Path) -> None:
    if path.exists():
        raise W75WorkflowMetricsError(f"W7.5 metrics MVP does not support overwrite: {path.as_posix()}")


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n", encoding="utf-8")


def _optional_stripped(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _string_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None
