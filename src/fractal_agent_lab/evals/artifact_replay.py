from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id
from fractal_agent_lab.evals.h1_eval_contracts import H1_VARIANT_WORKFLOW_IDS
from fractal_agent_lab.evals.h1_eval_projections import (
    extract_h1_comparable_output,
    extract_h1_prompt_tags,
)


SUPPORTED_H1_WORKFLOW_IDS: tuple[str, ...] = H1_VARIANT_WORKFLOW_IDS

TERMINAL_EVENT_TYPES: tuple[str, ...] = (
    "run_completed",
    "run_failed",
    "run_timed_out",
    "run_cancelled",
)


def replay_run_artifacts_by_id(
    run_id: str,
    *,
    data_dir: str | Path = "data",
) -> dict[str, Any]:
    validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)
    report: dict[str, Any] = {
        "report_version": "h2_e.artifact_replay.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "run_artifact_path": validation.run_path.as_posix(),
        "trace_artifact_path": validation.trace_path.as_posix(),
        "artifact_validation": {
            "passed": validation.passed,
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        },
        "replay_ready": validation.passed,
    }

    if not validation.passed:
        report["replay_blockers"] = list(validation.errors)
        return report

    run_payload = validation.run_payload if isinstance(validation.run_payload, dict) else {}
    trace_events = [event for event in validation.trace_events if isinstance(event, dict)]
    workflow_id = _str_or_none(run_payload.get("workflow_id"))

    report["run_summary"] = _build_run_summary(run_payload, trace_events)
    report["timeline"] = _build_timeline(trace_events)
    report["linkage_summary"] = _build_linkage_summary(trace_events)
    report["h1_projection"] = _build_h1_projection(run_payload)
    report["orchestration_reconstruction"] = _build_orchestration_reconstruction(
        run_payload,
        trace_events,
    )
    report["failure_summary"] = _build_failure_summary(run_payload, trace_events)
    report["supported_h1_workflow"] = workflow_id in SUPPORTED_H1_WORKFLOW_IDS
    return report


def _build_run_summary(run_payload: dict[str, Any], trace_events: list[dict[str, Any]]) -> dict[str, Any]:
    workflow_id = _str_or_none(run_payload.get("workflow_id"))
    step_results = run_payload.get("step_results")
    statuses = run_payload.get("status_transitions")
    trace_schema_versions = sorted(
        {
            version
            for version in (_str_or_none(event.get("schema_version")) for event in trace_events)
            if version is not None
        },
    )

    return {
        "run_id": _str_or_none(run_payload.get("run_id")),
        "workflow_id": workflow_id,
        "status": _str_or_none(run_payload.get("status")),
        "run_schema_version": _str_or_none(run_payload.get("schema_version")),
        "trace_schema_versions": trace_schema_versions,
        "supported_h1_workflow": workflow_id in SUPPORTED_H1_WORKFLOW_IDS,
        "trace_event_count": len(trace_events),
        "steps_recorded": len(step_results) if isinstance(step_results, dict) else 0,
        "started_at": _str_or_none(run_payload.get("started_at")),
        "completed_at": _str_or_none(run_payload.get("completed_at")),
        "status_transitions": list(statuses) if isinstance(statuses, list) else None,
    }


def _build_timeline(trace_events: list[dict[str, Any]]) -> dict[str, Any]:
    timeline_events: list[dict[str, Any]] = []
    for event in trace_events:
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        timeline_events.append(
            {
                "sequence": event.get("sequence"),
                "event_id": event.get("event_id"),
                "event_type": event.get("event_type"),
                "timestamp": event.get("timestamp"),
                "source": event.get("source"),
                "step_id": event.get("step_id"),
                "lane": payload.get("lane"),
                "turn_index": payload.get("turn_index"),
                "handoff_index": payload.get("handoff_index"),
                "from_step_id": payload.get("from_step_id"),
                "to_step_id": payload.get("to_step_id"),
                "parent_event_id": event.get("parent_event_id"),
                "correlation_id": event.get("correlation_id"),
            },
        )

    return {
        "event_count": len(timeline_events),
        "events": timeline_events,
    }


def _build_linkage_summary(trace_events: list[dict[str, Any]]) -> dict[str, Any]:
    event_ids = {
        event_id
        for event_id in (_str_or_none(event.get("event_id")) for event in trace_events)
        if event_id is not None
    }

    parent_refs = [
        parent
        for parent in (_str_or_none(event.get("parent_event_id")) for event in trace_events)
        if parent is not None
    ]
    missing_parent_refs = [parent for parent in parent_refs if parent not in event_ids]

    correlation_ids = [
        corr
        for corr in (_str_or_none(event.get("correlation_id")) for event in trace_events)
        if corr is not None
    ]
    correlation_counts = Counter(correlation_ids)

    return {
        "with_parent_event_id": len(parent_refs),
        "with_correlation_id": len(correlation_ids),
        "missing_parent_references": len(missing_parent_refs),
        "unique_correlation_ids": len(correlation_counts),
        "largest_correlation_chain_size": max(correlation_counts.values(), default=0),
    }


def _build_orchestration_reconstruction(
    run_payload: dict[str, Any],
    trace_events: list[dict[str, Any]],
) -> dict[str, Any]:
    workflow_id = _str_or_none(run_payload.get("workflow_id"))
    execution_mode = _extract_execution_mode(trace_events)
    lane_counts = _collect_lane_counts(trace_events)
    step_path = _collect_step_path(trace_events)

    output_payload = run_payload.get("output_payload") if isinstance(run_payload.get("output_payload"), dict) else {}
    manager_orchestration = (
        output_payload.get("manager_orchestration")
        if isinstance(output_payload.get("manager_orchestration"), dict)
        else {}
    )
    handoff_orchestration = (
        output_payload.get("handoff_orchestration")
        if isinstance(output_payload.get("handoff_orchestration"), dict)
        else {}
    )

    manager_turns = manager_orchestration.get("turns")
    manager_summary = {
        "manager_step_id": manager_orchestration.get("manager_step_id"),
        "worker_step_ids": manager_orchestration.get("worker_step_ids"),
        "turn_count": len(manager_turns) if isinstance(manager_turns, list) else 0,
    }

    handoff_turns = handoff_orchestration.get("turns")
    handoff_path = handoff_orchestration.get("path")
    handoff_decisions = _collect_handoff_decisions(trace_events)
    if not isinstance(handoff_path, list) or not handoff_path:
        handoff_path = _collect_handoff_path_from_trace(trace_events)

    handoff_summary = {
        "entrypoint_step_id": handoff_orchestration.get("entrypoint_step_id"),
        "path": handoff_path,
        "handoff_count": handoff_orchestration.get("handoff_count"),
        "final_step_id": handoff_orchestration.get("final_step_id"),
        "turn_count": len(handoff_turns) if isinstance(handoff_turns, list) else len(handoff_decisions),
        "decisions": handoff_decisions,
    }

    return {
        "workflow_id": workflow_id,
        "execution_mode": execution_mode,
        "supported_h1_workflow": workflow_id in SUPPORTED_H1_WORKFLOW_IDS,
        "lane_counts": lane_counts,
        "step_path": step_path,
        "manager": manager_summary if workflow_id == "h1.manager.v1" else None,
        "handoff": handoff_summary if workflow_id == "h1.handoff.v1" else None,
    }


def _build_h1_projection(run_payload: dict[str, Any]) -> dict[str, Any] | None:
    workflow_id = _str_or_none(run_payload.get("workflow_id"))
    if workflow_id not in SUPPORTED_H1_WORKFLOW_IDS:
        return None

    output_payload = run_payload.get("output_payload")
    return {
        "comparable_output": extract_h1_comparable_output(
            workflow_id=workflow_id,
            output_payload=output_payload,
        ),
        "prompt_tags": extract_h1_prompt_tags(output_payload),
    }


def _build_failure_summary(run_payload: dict[str, Any], trace_events: list[dict[str, Any]]) -> dict[str, Any]:
    status = _str_or_none(run_payload.get("status"))
    step_started_present = any(event.get("event_type") == "step_started" for event in trace_events)
    run_failure = run_payload.get("failure") if isinstance(run_payload.get("failure"), dict) else None

    terminal_event = _extract_terminal_event(trace_events)
    terminal_payload = terminal_event.get("payload") if isinstance(terminal_event.get("payload"), dict) else {}
    terminal_failure_envelope = (
        terminal_payload.get("failure_envelope")
        if isinstance(terminal_payload.get("failure_envelope"), dict)
        else None
    )

    step_failures: list[dict[str, Any]] = []
    for event in trace_events:
        event_type = _str_or_none(event.get("event_type"))
        if event_type not in {"agent_failed", "step_failed"}:
            continue
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        step_failures.append(
            {
                "sequence": event.get("sequence"),
                "event_type": event_type,
                "step_id": event.get("step_id"),
                "error": payload.get("error"),
                "error_type": payload.get("error_type"),
                "failure_category": payload.get("failure_category"),
                "error_code": payload.get("error_code"),
                "failure_envelope": payload.get("failure_envelope") if isinstance(payload.get("failure_envelope"), dict) else None,
            },
        )

    errors = run_payload.get("errors")
    error_messages = list(errors) if isinstance(errors, list) else []

    has_failure = status in {"failed", "timed_out", "cancelled"}
    return {
        "status": status,
        "has_failure": has_failure,
        "pre_step_failure": has_failure and not step_started_present,
        "run_failure": run_failure,
        "terminal_event": {
            "event_type": terminal_event.get("event_type"),
            "sequence": terminal_event.get("sequence"),
            "failure_envelope": terminal_failure_envelope,
            "code": terminal_payload.get("code"),
            "error": terminal_payload.get("error"),
            "details": terminal_payload.get("details"),
        },
        "step_failures": step_failures,
        "errors": error_messages,
    }


def _extract_execution_mode(trace_events: list[dict[str, Any]]) -> str | None:
    for event in trace_events:
        if event.get("event_type") != "run_started":
            continue
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        execution_mode = _str_or_none(payload.get("execution_mode"))
        if execution_mode is not None:
            return execution_mode
    return None


def _collect_lane_counts(trace_events: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in trace_events:
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        lane = _str_or_none(payload.get("lane"))
        if lane is None:
            continue
        counts[lane] = counts.get(lane, 0) + 1
    return counts


def _collect_step_path(trace_events: list[dict[str, Any]]) -> list[str]:
    path: list[str] = []
    for event in trace_events:
        if event.get("event_type") != "step_started":
            continue
        step_id = _str_or_none(event.get("step_id"))
        if step_id is None:
            continue
        if not path or path[-1] != step_id:
            path.append(step_id)
    return path


def _collect_handoff_decisions(trace_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    decisions: list[dict[str, Any]] = []
    for event in trace_events:
        if event.get("event_type") != "handoff_decided":
            continue
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        decisions.append(
            {
                "handoff_index": payload.get("handoff_index"),
                "decision_action": payload.get("decision_action"),
                "decision_source": payload.get("decision_source"),
                "from_step_id": payload.get("from_step_id"),
                "to_step_id": payload.get("to_step_id"),
                "reason": payload.get("reason"),
                "event_id": event.get("event_id"),
                "parent_event_id": event.get("parent_event_id"),
                "correlation_id": event.get("correlation_id"),
            },
        )
    return decisions


def _collect_handoff_path_from_trace(trace_events: list[dict[str, Any]]) -> list[str]:
    path: list[str] = []
    for event in trace_events:
        if event.get("event_type") != "step_started":
            continue
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        lane = _str_or_none(payload.get("lane"))
        step_id = _str_or_none(event.get("step_id"))
        if lane != "handoff" or step_id is None:
            continue
        if not path or path[-1] != step_id:
            path.append(step_id)
    return path


def _extract_terminal_event(trace_events: list[dict[str, Any]]) -> dict[str, Any]:
    for event in reversed(trace_events):
        event_type = _str_or_none(event.get("event_type"))
        if event_type in TERMINAL_EVENT_TYPES:
            return event
    return {}


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None
