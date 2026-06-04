from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from fractal_agent_lab.core.events import TraceEvent, TraceEventType
from fractal_agent_lab.core.models import RunState
from fractal_agent_lab.core.contracts.w6_packet import require_w6_path_identifier
from fractal_agent_lab.tracing import run_artifact_dir_path, write_run_artifact, write_trace_artifact


W7_OPENCODE_LOOP_WORKFLOW_ID = "opencode.meta_track.loop.v1"
W7_OPENCODE_LOOP_SUMMARY_SCHEMA_VERSION = "w7.opencode_loop_summary.v1"
W7_PACKET_LEDGER_SCHEMA_VERSION = "w7.packet_ledger.v1"
W7_SELECTED_OUTPUTS_SCHEMA_VERSION = "w7.selected_outputs.v1"
W7_REVIEW_SYNTHESIS_SCHEMA_VERSION = "w7.review_synthesis.v1"
W7_APPROVAL_LOG_SCHEMA_VERSION = "w7.approval_log.v1"
W7_INGEST_REPORT_SCHEMA_VERSION = "w7.ingest_report.v1"

ALLOWED_LOOP_ENTRY_MODES = {"manual", "router_assisted", "fal_cli_assisted"}
ALLOWED_AUTOMATION_MODES = {
    "manual",
    "opencode_session",
    "router_assisted",
    "fal_cli_assisted",
    "semi_auto_future",
}
ALLOWED_OUTCOMES = {"green", "yellow", "red", "mixed", "blocked"}
ALLOWED_VALIDATION_STATES = {"ok", "warning", "invalid"}
ALLOWED_PUBLIC_EXPORT_STATES = {"blocked", "not_requested", "candidate_needs_review"}
ALLOWED_BODY_PATH_POLICIES = {"none"}
ALLOWED_PRIVACY_CLASSIFICATIONS = {
    "private_raw",
    "private_coordination",
    "sanitized_public_candidate",
    "never_public",
}
FORBIDDEN_RAW_REASONING_FIELDS = {
    "reasoning",
    "reasoning_text",
    "thought",
    "thoughts",
    "chain_of_thought",
    "cot",
    "transcript",
    "raw_transcript",
    "raw_body",
    "body",
}
ALLOWED_STEP_RESULT_RAW_FIELDS = {"source_kind", "provider"}


class W7OpenCodeLoopIngestError(ValueError):
    pass


@dataclass(slots=True)
class W7OpenCodeLoopArtifactResult:
    run_id: str
    validation_state: str
    clean_pass_eligible: bool
    warnings: list[str]
    output_paths: dict[str, str]
    sidecar_paths: dict[str, str]


def write_w7_opencode_loop_artifacts(
    payload: Mapping[str, Any],
    *,
    data_dir: str | Path = "data",
) -> W7OpenCodeLoopArtifactResult:
    validated = _validate_payload(payload)

    run_path = _as_path(write=False, kind="run", run_id=validated["run_id"], data_dir=data_dir)
    trace_path = _as_path(write=False, kind="trace", run_id=validated["run_id"], data_dir=data_dir)
    sidecar_dir = run_artifact_dir_path(run_id=validated["run_id"], data_dir=data_dir)
    sidecar_paths = _sidecar_paths(sidecar_dir)
    _fail_if_targets_exist(run_path=run_path, trace_path=trace_path, sidecar_dir=sidecar_dir, sidecar_paths=sidecar_paths)

    warnings = _sorted_unique_strings(validated["warnings"])
    clean_pass_eligible = _derive_clean_pass_eligible(validated, warnings)
    if validated["final_output"]["overall_outcome"] == "green" and not clean_pass_eligible:
        raise W7OpenCodeLoopIngestError(
            "Field 'final_output.overall_outcome' cannot be 'green' when approval/review/validation safety conditions are not met."
        )

    run_state = _build_run_state(validated, clean_pass_eligible, warnings)
    trace_events = _build_trace_events(validated, clean_pass_eligible, warnings)
    for event in trace_events:
        run_state.add_trace_event(event.event_id)

    run_path = write_run_artifact(run_state, data_dir=data_dir)
    trace_path = write_trace_artifact(trace_events, run_id=validated["run_id"], data_dir=data_dir)

    sidecar_dir.mkdir(parents=True, exist_ok=False)
    _write_json(sidecar_paths["opencode_loop_summary"], _build_loop_summary(validated, clean_pass_eligible, warnings))
    _write_json(sidecar_paths["packet_ledger"], validated["packet_ledger"])
    _write_json(sidecar_paths["selected_outputs"], validated["selected_outputs"])
    _write_json(sidecar_paths["review_synthesis"], validated["review_synthesis"])
    _write_json(sidecar_paths["approval_log"], validated["approval_log"])
    _write_json(sidecar_paths["ingest_report"], _build_ingest_report(validated, warnings))

    output_paths = {
        "run": run_path.as_posix(),
        "trace": trace_path.as_posix(),
        **{name: path.as_posix() for name, path in sidecar_paths.items()},
    }
    return W7OpenCodeLoopArtifactResult(
        run_id=validated["run_id"],
        validation_state=validated["validation_state"],
        clean_pass_eligible=clean_pass_eligible,
        warnings=warnings,
        output_paths=output_paths,
        sidecar_paths={name: path.as_posix() for name, path in sidecar_paths.items()},
    )


def _validate_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    validated: dict[str, Any] = {}

    validated["run_id"] = _require_safe_identifier(payload, "run_id", errors)
    validated["target_project_id"] = _require_safe_identifier(payload, "target_project_id", errors)
    validated["target_project_name"] = _require_text(payload, "target_project_name", errors)
    validated["target_repo_path"] = _require_text(payload, "target_repo_path", errors)
    validated["sequence_ref"] = _require_text(payload, "sequence_ref", errors)
    validated["target_track"] = _require_text(payload, "target_track", errors)
    validated["meta_track_pair"] = _require_text(payload, "meta_track_pair", errors)
    validated["loop_entry_mode"] = _require_enum(payload, "loop_entry_mode", ALLOWED_LOOP_ENTRY_MODES, errors)
    validated["automation_mode"] = _require_enum(payload, "automation_mode", ALLOWED_AUTOMATION_MODES, errors)
    validated["entry_stage"] = _require_text(payload, "entry_stage", errors)
    validated["external_loop_id"] = _require_safe_identifier(payload, "external_loop_id", errors)
    validated["validation_state"] = _require_enum(payload, "validation_state", ALLOWED_VALIDATION_STATES, errors)

    source_refs = payload.get("source_refs")
    if not isinstance(source_refs, list) or not source_refs:
        errors.append("Field 'source_refs' must be a non-empty list.")
        validated["source_refs"] = []
    else:
        validated["source_refs"] = [_require_non_empty_string_item(item, "source_refs", errors) for item in source_refs]

    warnings = payload.get("warnings", [])
    if not isinstance(warnings, list):
        errors.append("Field 'warnings' must be a list when present.")
        validated["warnings"] = []
    else:
        validated["warnings"] = [_require_non_empty_string_item(item, "warnings", errors) for item in warnings]

    target_project_context = _require_mapping(payload, "target_project_context", errors)
    if target_project_context is not None:
        _reject_forbidden_fields(target_project_context, "target_project_context", errors)
        if target_project_context.get("schema_version") != "external_project_context.v0":
            errors.append("Field 'target_project_context.schema_version' must be 'external_project_context.v0'.")
    validated["target_project_context"] = target_project_context or {}

    router_context = _require_mapping(payload, "router_context", errors)
    if router_context is not None:
        _reject_forbidden_fields(router_context, "router_context", errors)
    validated["router_context"] = router_context or {}

    approval_policy = _require_mapping(payload, "approval_policy", errors)
    if approval_policy is not None:
        _reject_forbidden_fields(approval_policy, "approval_policy", errors)
    validated["approval_policy"] = approval_policy or {}

    privacy_audit_state = _require_mapping(payload, "privacy_audit_state", errors)
    validated["privacy_audit_state"] = dict(privacy_audit_state or {})
    _reject_forbidden_fields(validated["privacy_audit_state"], "privacy_audit_state", errors)
    _validate_privacy_audit_state(validated["privacy_audit_state"], errors)

    step_results = _require_mapping(payload, "step_results", errors)
    validated["step_results"] = _validate_step_results(
        step_results,
        validated["privacy_audit_state"].get("excerpt_max_chars"),
        errors,
    )

    packet_ledger = _require_mapping(payload, "packet_ledger", errors)
    validated["packet_ledger"] = _validate_packet_ledger(packet_ledger, errors)

    selected_outputs = _require_mapping(payload, "selected_outputs", errors)
    validated["selected_outputs"] = _validate_selected_outputs(selected_outputs, errors)

    review_synthesis = _require_mapping(payload, "review_synthesis", errors)
    validated["review_synthesis"] = _validate_schema_version(
        review_synthesis,
        W7_REVIEW_SYNTHESIS_SCHEMA_VERSION,
        "review_synthesis",
        errors,
    )
    _reject_forbidden_fields(validated["review_synthesis"], "review_synthesis", errors)

    approval_log = _require_mapping(payload, "approval_log", errors)
    validated["approval_log"] = _validate_approval_log(approval_log, errors)

    final_output = _require_mapping(payload, "final_output", errors)
    validated["final_output"] = _validate_final_output(final_output, errors)

    if errors:
        raise W7OpenCodeLoopIngestError(" ".join(error for error in errors if error))
    return validated


def _validate_privacy_audit_state(payload: Mapping[str, Any], errors: list[str]) -> None:
    if payload.get("retention_mode") != "structured_extracts_only":
        errors.append("Field 'privacy_audit_state.retention_mode' must be 'structured_extracts_only'.")
    if payload.get("raw_transcript_retained") is not False:
        errors.append("Field 'privacy_audit_state.raw_transcript_retained' must be false.")
    excerpt_max_chars = payload.get("excerpt_max_chars")
    if not isinstance(excerpt_max_chars, int) or isinstance(excerpt_max_chars, bool) or excerpt_max_chars <= 0:
        errors.append("Field 'privacy_audit_state.excerpt_max_chars' must be a positive integer.")
    if payload.get("body_retention_allowed") is not False:
        errors.append("Field 'privacy_audit_state.body_retention_allowed' must be false in W7-B1 MVP.")
    if payload.get("body_path_policy") not in ALLOWED_BODY_PATH_POLICIES:
        errors.append("Field 'privacy_audit_state.body_path_policy' must be 'none' in W7-B1 MVP.")
    if payload.get("thought_or_reasoning_retained") is not False:
        errors.append("Field 'privacy_audit_state.thought_or_reasoning_retained' must be false.")
    if payload.get("privacy_classification") not in ALLOWED_PRIVACY_CLASSIFICATIONS:
        errors.append("Field 'privacy_audit_state.privacy_classification' has unsupported value.")
    if payload.get("public_export_state") not in ALLOWED_PUBLIC_EXPORT_STATES:
        errors.append("Field 'privacy_audit_state.public_export_state' has unsupported value.")


def _validate_step_results(
    payload: Mapping[str, Any] | None,
    excerpt_max_chars: Any,
    errors: list[str],
) -> dict[str, Any]:
    if not isinstance(payload, Mapping) or not payload:
        errors.append("Field 'step_results' must be a non-empty object.")
        return {}
    normalized: dict[str, Any] = {}
    for step_id, value in payload.items():
        if not isinstance(step_id, str) or not step_id.strip():
            errors.append("Field 'step_results' contains an invalid step id.")
            continue
        if not isinstance(value, Mapping):
            errors.append(f"Field 'step_results.{step_id}' must be an object.")
            continue
        raw = value.get("raw")
        if raw is not None:
            if not isinstance(raw, Mapping):
                errors.append(f"Field 'step_results.{step_id}.raw' must be an object when present.")
            else:
                extra_raw_keys = sorted(set(raw) - ALLOWED_STEP_RESULT_RAW_FIELDS)
                if extra_raw_keys:
                    errors.append(
                        f"Field 'step_results.{step_id}.raw' only allows source_kind/provider; unsupported keys: "
                        + ", ".join(extra_raw_keys)
                        + "."
                    )
        output = value.get("output")
        if isinstance(output, Mapping) and "selected_text_excerpt" in output:
            selected_text_excerpt = output.get("selected_text_excerpt")
            if not isinstance(selected_text_excerpt, str):
                errors.append(f"Field 'step_results.{step_id}.output.selected_text_excerpt' must be a string when present.")
            elif (
                isinstance(excerpt_max_chars, int)
                and not isinstance(excerpt_max_chars, bool)
                and len(selected_text_excerpt) > excerpt_max_chars
            ):
                errors.append(
                    f"Field 'step_results.{step_id}.output.selected_text_excerpt' exceeds privacy_audit_state.excerpt_max_chars."
                )
        _reject_forbidden_fields(value, f"step_results.{step_id}", errors)
        normalized[step_id] = dict(value)
    return normalized


def _validate_packet_ledger(payload: Mapping[str, Any] | None, errors: list[str]) -> dict[str, Any]:
    packet_ledger = _validate_schema_version(payload, W7_PACKET_LEDGER_SCHEMA_VERSION, "packet_ledger", errors)
    _reject_forbidden_fields(packet_ledger, "packet_ledger", errors)
    entries = packet_ledger.get("entries")
    if not isinstance(entries, list):
        errors.append("Field 'packet_ledger.entries' must be a list.")
        return packet_ledger
    previous_sequence = 0
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, Mapping):
            errors.append(f"Field 'packet_ledger.entries[{index}]' must be an object.")
            continue
        sequence = entry.get("sequence")
        if not isinstance(sequence, int) or sequence <= previous_sequence:
            errors.append("Field 'packet_ledger.entries[].sequence' must be strictly increasing integers.")
        else:
            previous_sequence = sequence
        for field_name in ("stage", "producer", "consumer", "source_command", "summary"):
            if not isinstance(entry.get(field_name), str) or not entry.get(field_name).strip():
                errors.append(f"Field 'packet_ledger.entries[{index}].{field_name}' must be a non-empty string.")
        decision = entry.get("decision")
        if decision is not None and (not isinstance(decision, str) or not decision.strip()):
            errors.append(f"Field 'packet_ledger.entries[{index}].decision' must be null or a non-empty string.")
        if entry.get("validation_state") not in ALLOWED_VALIDATION_STATES:
            errors.append(f"Field 'packet_ledger.entries[{index}].validation_state' has unsupported value.")
        for ref_name in ("packet_ref", "selected_output_ref", "approval_ref"):
            ref_value = entry.get(ref_name)
            if ref_value is not None:
                _validate_optional_safe_identifier(ref_value, f"packet_ledger.entries[{index}].{ref_name}", errors)
    return packet_ledger


def _validate_selected_outputs(payload: Mapping[str, Any] | None, errors: list[str]) -> dict[str, Any]:
    selected_outputs = _validate_schema_version(payload, W7_SELECTED_OUTPUTS_SCHEMA_VERSION, "selected_outputs", errors)
    _reject_forbidden_fields(selected_outputs, "selected_outputs", errors)
    outputs = selected_outputs.get("outputs")
    if not isinstance(outputs, list):
        errors.append("Field 'selected_outputs.outputs' must be a list.")
        return selected_outputs
    for index, output in enumerate(outputs, start=1):
        if not isinstance(output, Mapping):
            errors.append(f"Field 'selected_outputs.outputs[{index}]' must be an object.")
            continue
        _validate_optional_safe_identifier(output.get("output_id"), f"selected_outputs.outputs[{index}].output_id", errors, required=True)
        for field_name in ("stage", "source_session", "capture_mode", "summary"):
            if not isinstance(output.get(field_name), str) or not output.get(field_name).strip():
                errors.append(f"Field 'selected_outputs.outputs[{index}].{field_name}' must be a non-empty string.")
        message_id = output.get("message_id")
        if message_id is not None and (not isinstance(message_id, str) or not message_id.strip()):
            errors.append(f"Field 'selected_outputs.outputs[{index}].message_id' must be null or a non-empty string.")
        excerpt = output.get("excerpt")
        if excerpt is not None and not isinstance(excerpt, str):
            errors.append(f"Field 'selected_outputs.outputs[{index}].excerpt' must be null or a string.")
        excerpt_max_chars = output.get("excerpt_max_chars")
        if not isinstance(excerpt_max_chars, int) or isinstance(excerpt_max_chars, bool) or excerpt_max_chars <= 0:
            errors.append(f"Field 'selected_outputs.outputs[{index}].excerpt_max_chars' must be a positive integer.")
        if excerpt is not None and isinstance(excerpt_max_chars, int) and len(excerpt) > excerpt_max_chars:
            errors.append(f"Field 'selected_outputs.outputs[{index}].excerpt' exceeds excerpt_max_chars.")
        if not isinstance(output.get("excerpt_truncated"), bool):
            errors.append(f"Field 'selected_outputs.outputs[{index}].excerpt_truncated' must be boolean.")
        if output.get("body_retention_allowed") is not False:
            errors.append(f"Field 'selected_outputs.outputs[{index}].body_retention_allowed' must be false in W7-B1 MVP.")
        if output.get("body_path_policy") not in ALLOWED_BODY_PATH_POLICIES:
            errors.append(f"Field 'selected_outputs.outputs[{index}].body_path_policy' must be 'none' in W7-B1 MVP.")
        if output.get("body_path") is not None:
            errors.append(f"Field 'selected_outputs.outputs[{index}].body_path' must be null in W7-B1 MVP.")
        if output.get("privacy_classification") not in ALLOWED_PRIVACY_CLASSIFICATIONS:
            errors.append(f"Field 'selected_outputs.outputs[{index}].privacy_classification' has unsupported value.")
    return selected_outputs


def _validate_approval_log(payload: Mapping[str, Any] | None, errors: list[str]) -> dict[str, Any]:
    approval_log = _validate_schema_version(payload, W7_APPROVAL_LOG_SCHEMA_VERSION, "approval_log", errors)
    _reject_forbidden_fields(approval_log, "approval_log", errors)
    checkpoints = approval_log.get("checkpoints")
    if not isinstance(checkpoints, list):
        errors.append("Field 'approval_log.checkpoints' must be a list.")
        return approval_log
    for index, checkpoint in enumerate(checkpoints, start=1):
        if not isinstance(checkpoint, Mapping):
            errors.append(f"Field 'approval_log.checkpoints[{index}]' must be an object.")
            continue
        _validate_optional_safe_identifier(checkpoint.get("checkpoint_id"), f"approval_log.checkpoints[{index}].checkpoint_id", errors, required=True)
        for field_name in ("action_kind", "target_session", "approval_mode"):
            if not isinstance(checkpoint.get(field_name), str) or not checkpoint.get(field_name).strip():
                errors.append(f"Field 'approval_log.checkpoints[{index}].{field_name}' must be a non-empty string.")
        stage = checkpoint.get("stage")
        if stage is not None and (not isinstance(stage, str) or not stage.strip()):
            errors.append(f"Field 'approval_log.checkpoints[{index}].stage' must be null or a non-empty string.")
        if not isinstance(checkpoint.get("approved"), bool):
            errors.append(f"Field 'approval_log.checkpoints[{index}].approved' must be boolean.")
        approved_at = checkpoint.get("approved_at")
        if approved_at is not None and (not isinstance(approved_at, str) or not approved_at.strip()):
            errors.append(f"Field 'approval_log.checkpoints[{index}].approved_at' must be null or a non-empty string.")
    return approval_log


def _validate_final_output(payload: Mapping[str, Any] | None, errors: list[str]) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        errors.append("Field 'final_output' must be an object.")
        return {}
    _reject_forbidden_fields(payload, "final_output", errors)
    overall_outcome = payload.get("overall_outcome")
    if overall_outcome not in ALLOWED_OUTCOMES:
        errors.append("Field 'final_output.overall_outcome' has unsupported value.")
    for field_name in ("terminal_stage", "next_recommended_action", "accepted_scope_summary"):
        if not isinstance(payload.get(field_name), str) or not payload.get(field_name).strip():
            errors.append(f"Field 'final_output.{field_name}' must be a non-empty string.")
    final_decision = payload.get("final_decision")
    if final_decision is not None and (not isinstance(final_decision, str) or not final_decision.strip()):
        errors.append("Field 'final_output.final_decision' must be null or a non-empty string.")
    for list_name in ("blocking_conditions", "required_followups", "key_findings", "artifact_refs", "learning_candidate_refs"):
        if not isinstance(payload.get(list_name), list):
            errors.append(f"Field 'final_output.{list_name}' must be a list.")
    review_synthesis_present = payload.get("review_synthesis_present")
    if not isinstance(review_synthesis_present, bool):
        errors.append("Field 'final_output.review_synthesis_present' must be boolean.")
    return dict(payload)


def _build_run_state(validated: dict[str, Any], clean_pass_eligible: bool, warnings: list[str]) -> RunState:
    final_output = dict(validated["final_output"])
    final_output["approval_count"] = len(validated["approval_log"]["checkpoints"])
    final_output["validation_state"] = validated["validation_state"]
    final_output["clean_pass_eligible"] = clean_pass_eligible
    final_output["warning_count"] = len(warnings)
    output_payload = {
        "step_results": dict(validated["step_results"]),
        "final_output": final_output,
    }
    run_state = RunState(
        run_id=validated["run_id"],
        workflow_id=W7_OPENCODE_LOOP_WORKFLOW_ID,
        input_payload={
            "target_project_id": validated["target_project_id"],
            "target_project_name": validated["target_project_name"],
            "target_repo_path": validated["target_repo_path"],
            "sequence_ref": validated["sequence_ref"],
            "target_track": validated["target_track"],
            "meta_track_pair": validated["meta_track_pair"],
            "loop_entry_mode": validated["loop_entry_mode"],
            "entry_stage": validated["entry_stage"],
            "source_refs": list(validated["source_refs"]),
        },
        output_payload=None,
        step_results=dict(validated["step_results"]),
        context={
            "external_loop_id": validated["external_loop_id"],
            "target_project_context": dict(validated["target_project_context"]),
            "router_context": dict(validated["router_context"]),
            "approval_policy": dict(validated["approval_policy"]),
            "privacy_audit_state": dict(validated["privacy_audit_state"]),
        },
    )
    run_state.start()
    run_state.succeed(output_payload=output_payload)
    return run_state


def _build_trace_events(validated: dict[str, Any], clean_pass_eligible: bool, warnings: list[str]) -> list[TraceEvent]:
    events: list[TraceEvent] = []
    sequence = 1

    def add_event(event_type: TraceEventType, *, step_id: str | None, payload: dict[str, Any]) -> None:
        nonlocal sequence
        events.append(
            TraceEvent(
                run_id=validated["run_id"],
                event_type=event_type,
                sequence=sequence,
                source="w7_ingest",
                step_id=step_id,
                payload=payload,
            )
        )
        sequence += 1

    base_payload = {
        "w7_event_kind": "loop_started",
        "target_project_id": validated["target_project_id"],
        "sequence_ref": validated["sequence_ref"],
        "stage": validated["entry_stage"],
        "source_session": None,
        "target_session": None,
        "source_command": None,
        "decision": None,
        "summary": "OpenCode-backed loop ingest started.",
        "artifact_ref": None,
        "validation_state": validated["validation_state"],
    }
    add_event(TraceEventType.RUN_STARTED, step_id=None, payload=base_payload)

    for step_id, step_result in validated["step_results"].items():
        output = step_result.get("output") if isinstance(step_result, Mapping) else None
        payload = {
            "w7_event_kind": "selected_stage_result",
            "target_project_id": validated["target_project_id"],
            "sequence_ref": validated["sequence_ref"],
            "stage": output.get("stage") if isinstance(output, Mapping) else None,
            "source_session": output.get("source_session") if isinstance(output, Mapping) else None,
            "target_session": None,
            "source_command": None,
            "decision": output.get("decision") if isinstance(output, Mapping) else None,
            "summary": output.get("summary") if isinstance(output, Mapping) else None,
            "artifact_ref": output.get("extract_ref") if isinstance(output, Mapping) else None,
            "validation_state": validated["validation_state"],
        }
        add_event(TraceEventType.STEP_STARTED, step_id=step_id, payload=payload)
        add_event(TraceEventType.STEP_COMPLETED, step_id=step_id, payload=payload)

    terminal_payload = {
        "w7_event_kind": "loop_completed",
        "target_project_id": validated["target_project_id"],
        "sequence_ref": validated["sequence_ref"],
        "stage": validated["final_output"]["terminal_stage"],
        "source_session": None,
        "target_session": None,
        "source_command": None,
        "decision": validated["final_output"].get("final_decision"),
        "summary": validated["final_output"]["next_recommended_action"],
        "artifact_ref": f"artifacts/{validated['run_id']}/opencode_loop_summary.json",
        "validation_state": validated["validation_state"],
        "clean_pass_eligible": clean_pass_eligible,
        "warnings": list(warnings),
    }
    add_event(TraceEventType.RUN_COMPLETED, step_id=None, payload=terminal_payload)
    return events


def _build_loop_summary(validated: dict[str, Any], clean_pass_eligible: bool, warnings: list[str]) -> dict[str, Any]:
    return {
        "schema_version": W7_OPENCODE_LOOP_SUMMARY_SCHEMA_VERSION,
        "run_id": validated["run_id"],
        "workflow_id": W7_OPENCODE_LOOP_WORKFLOW_ID,
        "target_project_id": validated["target_project_id"],
        "external_loop_id": validated["external_loop_id"],
        "sequence_ref": validated["sequence_ref"],
        "loop_entry_mode": validated["loop_entry_mode"],
        "automation_mode": validated["automation_mode"],
        "overall_outcome": validated["final_output"]["overall_outcome"],
        "terminal_stage": validated["final_output"]["terminal_stage"],
        "final_decision": validated["final_output"].get("final_decision"),
        "packet_count": len(validated["packet_ledger"].get("entries", [])),
        "approval_count": len(validated["approval_log"].get("checkpoints", [])),
        "selected_output_count": len(validated["selected_outputs"].get("outputs", [])),
        "review_synthesis_present": bool(validated["final_output"]["review_synthesis_present"]),
        "validation_state": validated["validation_state"],
        "clean_pass_eligible": clean_pass_eligible,
        "warnings": list(warnings),
        "privacy_audit_state": dict(validated["privacy_audit_state"]),
        "artifact_refs": list(validated["final_output"].get("artifact_refs", [])),
    }


def _build_ingest_report(validated: dict[str, Any], warnings: list[str]) -> dict[str, Any]:
    return {
        "schema_version": W7_INGEST_REPORT_SCHEMA_VERSION,
        "run_id": validated["run_id"],
        "ingest_version": "w7-b1.v1",
        "warnings": list(warnings),
        "skipped_outputs": [],
        "retention_mode": validated["privacy_audit_state"]["retention_mode"],
        "raw_transcript_retained": False,
        "thought_or_reasoning_retained": False,
        "public_export_state": validated["privacy_audit_state"]["public_export_state"],
    }


def _derive_clean_pass_eligible(validated: dict[str, Any], warnings: list[str]) -> bool:
    if validated["validation_state"] != "ok":
        return False
    if warnings:
        return False
    if validated["final_output"]["overall_outcome"] != "green":
        return False
    if not validated["final_output"]["review_synthesis_present"]:
        return False
    if not validated["approval_log"]["checkpoints"]:
        return False
    if not any(checkpoint.get("approved") is True for checkpoint in validated["approval_log"]["checkpoints"]):
        return False
    if any(entry.get("validation_state") != "ok" for entry in validated["packet_ledger"].get("entries", [])):
        return False
    terminal_stage = validated["final_output"]["terminal_stage"].strip().lower()
    if terminal_stage in {"hold", "blocked", "deep_review_needed"}:
        return False
    return True


def _sidecar_paths(sidecar_dir: Path) -> dict[str, Path]:
    return {
        "opencode_loop_summary": sidecar_dir / "opencode_loop_summary.json",
        "packet_ledger": sidecar_dir / "packet_ledger.json",
        "selected_outputs": sidecar_dir / "selected_outputs.json",
        "review_synthesis": sidecar_dir / "review_synthesis.json",
        "approval_log": sidecar_dir / "approval_log.json",
        "ingest_report": sidecar_dir / "ingest_report.json",
    }


def _fail_if_targets_exist(*, run_path: Path, trace_path: Path, sidecar_dir: Path, sidecar_paths: Mapping[str, Path]) -> None:
    existing = []
    for path in [run_path, trace_path, sidecar_dir, *sidecar_paths.values()]:
        if path.exists():
            existing.append(path.as_posix())
    if existing:
        raise W7OpenCodeLoopIngestError(
            "W7-B1 MVP does not support overwrite; target artifacts already exist: " + ", ".join(sorted(existing))
        )


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")


def _as_path(*, write: bool, kind: str, run_id: str, data_dir: str | Path) -> Path:
    del write
    from fractal_agent_lab.tracing.artifact_layout import run_artifact_path, trace_artifact_path

    if kind == "run":
        return run_artifact_path(run_id=run_id, data_dir=data_dir)
    return trace_artifact_path(run_id=run_id, data_dir=data_dir)


def _validate_schema_version(
    payload: Mapping[str, Any] | None,
    expected_schema_version: str,
    field_name: str,
    errors: list[str],
) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        errors.append(f"Field '{field_name}' must be an object.")
        return {}
    if payload.get("schema_version") != expected_schema_version:
        errors.append(f"Field '{field_name}.schema_version' must be '{expected_schema_version}'.")
    return dict(payload)


def _reject_forbidden_fields(value: Any, path: str, errors: list[str]) -> None:
    if isinstance(value, Mapping):
        for key, item in value.items():
            key_text = str(key)
            child_path = f"{path}.{key_text}"
            if key_text in FORBIDDEN_RAW_REASONING_FIELDS:
                errors.append(f"Field '{child_path}' is forbidden in W7-B1 normalized input.")
            _reject_forbidden_fields(item, child_path, errors)
        return
    if isinstance(value, list):
        for index, item in enumerate(value, start=1):
            _reject_forbidden_fields(item, f"{path}[{index}]", errors)


def _require_mapping(payload: Mapping[str, Any], key: str, errors: list[str]) -> dict[str, Any] | None:
    value = payload.get(key)
    if isinstance(value, Mapping):
        return dict(value)
    errors.append(f"Field '{key}' must be an object.")
    return None


def _require_text(payload: Mapping[str, Any], key: str, errors: list[str]) -> str:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    errors.append(f"Field '{key}' must be a non-empty string.")
    return ""


def _require_enum(payload: Mapping[str, Any], key: str, allowed: set[str], errors: list[str]) -> str:
    value = payload.get(key)
    if isinstance(value, str) and value in allowed:
        return value
    errors.append(f"Field '{key}' has unsupported value {value!r}.")
    return ""


def _require_safe_identifier(payload: Mapping[str, Any], key: str, errors: list[str]) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        errors.append(f"Field '{key}' must be a non-empty path-safe identifier.")
        return ""
    try:
        return require_w6_path_identifier(value, field_name=key)
    except ValueError as exc:
        errors.append(str(exc))
        return ""


def _validate_optional_safe_identifier(value: Any, field_name: str, errors: list[str], *, required: bool = False) -> None:
    if value is None:
        if required:
            errors.append(f"Field '{field_name}' must be a non-empty path-safe identifier.")
        return
    if not isinstance(value, str) or not value:
        errors.append(f"Field '{field_name}' must be a non-empty path-safe identifier.")
        return
    try:
        require_w6_path_identifier(value, field_name=field_name)
    except ValueError as exc:
        errors.append(str(exc))


def _require_non_empty_string_item(value: Any, field_name: str, errors: list[str]) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    errors.append(f"Field '{field_name}' contains a non-string or empty value.")
    return ""


def _sorted_unique_strings(values: list[str]) -> list[str]:
    return sorted({value for value in values if isinstance(value, str) and value})
