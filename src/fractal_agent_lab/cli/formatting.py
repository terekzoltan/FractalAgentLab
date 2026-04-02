from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, cast

from fractal_agent_lab.agents import extract_prompt_tags_from_output_payload
from fractal_agent_lab.core.events import TraceEvent, TraceEventType
from fractal_agent_lab.core.models import RunState


H1_MANAGER_WORKFLOW_ID = "h1.manager.v1"
H1_SINGLE_WORKFLOW_ID = "h1.single.v1"
H1_HANDOFF_WORKFLOW_ID = "h1.handoff.v1"

H1_COMPARABLE_SUMMARY_KEYS: tuple[str, ...] = (
    "clarified_idea",
    "strongest_assumptions",
    "weak_points",
    "alternatives",
    "recommended_mvp_direction",
    "next_3_validation_steps",
)


def format_run_summary_text(
    run_state: RunState,
    *,
    steps_total: int,
    trace_events_count: int,
    run_artifact_path: Path | None = None,
    trace_artifact_path: Path | None = None,
) -> str:
    headline = "Run succeeded" if str(run_state.status) == "succeeded" else "Run finished with issues"
    lines = [
        headline,
        f"- run_id: {run_state.run_id}",
        f"- workflow_id: {run_state.workflow_id}",
        f"- status: {run_state.status}",
        f"- steps_total: {steps_total}",
        f"- steps_completed: {len(run_state.step_results)}",
        f"- errors_count: {len(run_state.errors)}",
        f"- trace_events_count: {trace_events_count}",
        f"- schema_version: {run_state.schema_version}",
        f"- started_at: {_fmt_ts(run_state.started_at)}",
        f"- completed_at: {_fmt_ts(run_state.completed_at)}",
    ]

    if run_artifact_path is not None:
        lines.append(f"- run_artifact: {run_artifact_path.as_posix()}")
    if trace_artifact_path is not None:
        lines.append(f"- trace_artifact: {trace_artifact_path.as_posix()}")

    workflow_summary = _build_workflow_summary(run_state)
    if workflow_summary is not None:
        lines.extend(_format_workflow_summary_text(workflow_summary))

    prompt_tags = _build_prompt_tags_summary(run_state)
    if prompt_tags is not None:
        lines.extend(_format_prompt_tags_text(prompt_tags))

    orchestration_summary = _build_orchestration_summary(run_state)
    if orchestration_summary is not None:
        lines.extend(_format_orchestration_summary_text(orchestration_summary))

    if run_state.errors:
        lines.append("- errors:")
        for error in run_state.errors:
            lines.append(f"  - {error}")
    return "\n".join(lines)


def format_trace_summary_text(events: list[TraceEvent]) -> str:
    lines = ["Trace Summary", f"- total_events: {len(events)}"]
    if not events:
        return "\n".join(lines)

    counts: dict[str, int] = {}
    for event in events:
        key = str(event.event_type)
        counts[key] = counts.get(key, 0) + 1

    ordered_types = [
        TraceEventType.RUN_STARTED,
        TraceEventType.STEP_STARTED,
        TraceEventType.STEP_COMPLETED,
        TraceEventType.STEP_FAILED,
        TraceEventType.AGENT_DISPATCHED,
        TraceEventType.AGENT_COMPLETED,
        TraceEventType.AGENT_FAILED,
        TraceEventType.HANDOFF_DECIDED,
        TraceEventType.HANDOFF_FAILED,
        TraceEventType.RUN_COMPLETED,
        TraceEventType.RUN_FAILED,
        TraceEventType.RUN_CANCELLED,
        TraceEventType.RUN_TIMED_OUT,
    ]
    lines.append("- event_counts:")
    for event_type in ordered_types:
        key = str(event_type)
        if key in counts:
            lines.append(f"  - {key}: {counts[key]}")

    lane_counts = _collect_lane_counts(events)
    if lane_counts:
        lines.append("- lane_counts:")
        for lane in sorted(lane_counts):
            lines.append(f"  - {lane}: {lane_counts[lane]}")

    max_turn_index = _max_turn_index(events)
    if max_turn_index is not None:
        lines.append(f"- max_turn_index: {max_turn_index}")

    lines.append("- timeline:")
    for event in events:
        step_suffix = f" step={event.step_id}" if event.step_id else ""
        lane = event.payload.get("lane") if isinstance(event.payload, dict) else None
        turn_index = event.payload.get("turn_index") if isinstance(event.payload, dict) else None
        turn_suffix = f" turn={turn_index}" if isinstance(turn_index, int) else ""
        lane_suffix = f" lane={lane}" if isinstance(lane, str) and lane else ""
        lines.append(
            (
                f"  - #{event.sequence} {event.event_type} source={event.source}"
                f"{step_suffix}{lane_suffix}{turn_suffix}"
            ),
        )
    return "\n".join(lines)


def build_json_output(
    run_state: RunState,
    events: list[TraceEvent],
    *,
    steps_total: int,
    include_trace: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "summary": {
            "run_id": run_state.run_id,
            "workflow_id": run_state.workflow_id,
            "status": str(run_state.status),
            "steps_total": steps_total,
            "steps_completed": len(run_state.step_results),
            "errors_count": len(run_state.errors),
            "trace_events_count": len(events),
            "schema_version": run_state.schema_version,
            "started_at": _fmt_ts(run_state.started_at),
            "completed_at": _fmt_ts(run_state.completed_at),
            "errors": list(run_state.errors),
            "output_payload": run_state.output_payload,
        },
    }

    workflow_summary = _build_workflow_summary(run_state)
    if workflow_summary is not None:
        payload["workflow_summary"] = workflow_summary

    prompt_tags = _build_prompt_tags_summary(run_state)
    if prompt_tags is not None:
        payload["prompt_tags"] = prompt_tags

    orchestration_summary = _build_orchestration_summary(run_state)
    if orchestration_summary is not None:
        payload["orchestration_summary"] = orchestration_summary

    if include_trace:
        payload["trace_summary"] = {
            "total_events": len(events),
            "event_counts": _collect_event_counts(events),
            "lane_counts": _collect_lane_counts(events),
            "max_turn_index": _max_turn_index(events),
            "events": [
                {
                    "event_id": event.event_id,
                    "sequence": event.sequence,
                    "event_type": str(event.event_type),
                    "timestamp": _fmt_ts(event.timestamp),
                    "source": event.source,
                    "step_id": event.step_id,
                    "parent_event_id": event.parent_event_id,
                    "correlation_id": event.correlation_id,
                    "payload": event.payload,
                    "schema_version": event.schema_version,
                }
                for event in events
            ],
        }
    return payload


def format_trace_artifact_timeline_text(
    *,
    run_id: str,
    trace_events: list[dict[str, Any]],
    run_payload: dict[str, Any] | None,
    run_artifact_path: Path,
    trace_artifact_path: Path,
) -> str:
    lines = ["Trace Viewer", f"- run_id: {run_id}"]

    workflow_id = _str_or_none(run_payload.get("workflow_id")) if isinstance(run_payload, dict) else None
    status = _str_or_none(run_payload.get("status")) if isinstance(run_payload, dict) else None
    if workflow_id is not None:
        lines.append(f"- workflow_id: {workflow_id}")
    if status is not None:
        lines.append(f"- status: {status}")

    lines.append(f"- trace_artifact: {trace_artifact_path.as_posix()}")
    if run_payload is not None:
        lines.append(f"- run_artifact: {run_artifact_path.as_posix()}")
    else:
        lines.append("- run_artifact: unavailable")

    lines.append(f"- total_events: {len(trace_events)}")

    event_counts = _collect_event_counts_from_payload(trace_events)
    if event_counts:
        lines.append("- event_counts:")
        for event_type in sorted(event_counts):
            lines.append(f"  - {event_type}: {event_counts[event_type]}")

    lane_counts = _collect_lane_counts_from_payload(trace_events)
    if lane_counts:
        lines.append("- lane_counts:")
        for lane in sorted(lane_counts):
            lines.append(f"  - {lane}: {lane_counts[lane]}")

    max_turn_index = _max_turn_index_from_payload(trace_events)
    if max_turn_index is not None:
        lines.append(f"- max_turn_index: {max_turn_index}")

    linked_parent = sum(1 for event in trace_events if _str_or_none(event.get("parent_event_id")) is not None)
    linked_corr = sum(1 for event in trace_events if _str_or_none(event.get("correlation_id")) is not None)
    lines.append("- linkage:")
    lines.append(f"  - with_parent_event_id: {linked_parent}")
    lines.append(f"  - with_correlation_id: {linked_corr}")

    lines.append("- timeline:")
    for event in trace_events:
        sequence = event.get("sequence")
        event_type = _str_or_none(event.get("event_type")) or "unknown"
        source = _str_or_none(event.get("source")) or "unknown"
        step_id = _str_or_none(event.get("step_id"))
        parent_event_id = _str_or_none(event.get("parent_event_id"))
        correlation_id = _str_or_none(event.get("correlation_id"))
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}

        lane = _str_or_none(payload.get("lane"))
        turn_index = payload.get("turn_index") if isinstance(payload.get("turn_index"), int) else None
        handoff_index = payload.get("handoff_index") if isinstance(payload.get("handoff_index"), int) else None
        from_step_id = _str_or_none(payload.get("from_step_id"))
        to_step_id = _str_or_none(payload.get("to_step_id"))

        parts = [f"  - #{sequence} {event_type} source={source}"]
        if step_id is not None:
            parts.append(f"step={step_id}")
        if lane is not None:
            parts.append(f"lane={lane}")
        if turn_index is not None:
            parts.append(f"turn={turn_index}")
        if handoff_index is not None:
            parts.append(f"handoff={handoff_index}")
        if from_step_id is not None:
            parts.append(f"from={from_step_id}")
        if to_step_id is not None:
            parts.append(f"to={to_step_id}")
        if parent_event_id is not None:
            parts.append(f"parent={parent_event_id}")
        if correlation_id is not None:
            parts.append(f"corr={correlation_id}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def build_trace_artifact_json_output(
    *,
    run_id: str,
    trace_events: list[dict[str, Any]],
    run_payload: dict[str, Any] | None,
    run_artifact_path: Path,
    trace_artifact_path: Path,
) -> dict[str, Any]:
    return {
        "run_id": run_id,
        "workflow_id": _str_or_none(run_payload.get("workflow_id")) if isinstance(run_payload, dict) else None,
        "status": _str_or_none(run_payload.get("status")) if isinstance(run_payload, dict) else None,
        "run_artifact_path": run_artifact_path.as_posix() if run_payload is not None else None,
        "trace_artifact_path": trace_artifact_path.as_posix(),
        "summary": {
            "total_events": len(trace_events),
            "event_counts": _collect_event_counts_from_payload(trace_events),
            "lane_counts": _collect_lane_counts_from_payload(trace_events),
            "max_turn_index": _max_turn_index_from_payload(trace_events),
            "linked_events": {
                "with_parent_event_id": sum(
                    1 for event in trace_events if _str_or_none(event.get("parent_event_id")) is not None
                ),
                "with_correlation_id": sum(
                    1 for event in trace_events if _str_or_none(event.get("correlation_id")) is not None
                ),
            },
        },
        "events": trace_events,
    }


def _fmt_ts(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _build_workflow_summary(run_state: RunState) -> dict[str, Any] | None:
    source = _extract_h1_comparable_source(run_state)
    if source is None:
        return None

    summary: dict[str, Any] = {"workflow_id": run_state.workflow_id}
    included_fields = 0
    for key in H1_COMPARABLE_SUMMARY_KEYS:
        value = source.get(key)
        if value is not None:
            summary[key] = value
            included_fields += 1

    if included_fields == 0:
        return None
    return summary


def _extract_h1_comparable_source(run_state: RunState) -> dict[str, Any] | None:
    output_payload = run_state.output_payload
    if not isinstance(output_payload, dict):
        return None

    if run_state.workflow_id in {H1_MANAGER_WORKFLOW_ID, H1_HANDOFF_WORKFLOW_ID}:
        final_output = output_payload.get("final_output")
        if isinstance(final_output, dict):
            return final_output
        return None

    if run_state.workflow_id == H1_SINGLE_WORKFLOW_ID:
        step_results = output_payload.get("step_results")
        if not isinstance(step_results, dict):
            return None

        single_step = step_results.get("single")
        if not isinstance(single_step, dict):
            return None

        single_output = single_step.get("output")
        if isinstance(single_output, dict):
            return single_output

    return None


def _build_orchestration_summary(run_state: RunState) -> dict[str, Any] | None:
    if not isinstance(run_state.output_payload, dict):
        return None
    manager = run_state.output_payload.get("manager_orchestration")
    if not isinstance(manager, dict):
        return None

    raw_turns = manager.get("turns")
    turns = cast(list[Any], raw_turns) if isinstance(raw_turns, list) else []
    summary: dict[str, Any] = {
        "manager_step_id": manager.get("manager_step_id"),
        "worker_step_ids": manager.get("worker_step_ids"),
        "turn_count": len(turns),
        "turns": turns,
    }
    finalize_reason = _finalize_reason(turns)
    if finalize_reason is not None:
        summary["finalize_reason"] = finalize_reason
    return summary


def _build_prompt_tags_summary(run_state: RunState) -> dict[str, Any] | None:
    prompt_tags = extract_prompt_tags_from_output_payload(run_state.output_payload)
    if prompt_tags is None:
        return None

    variant = prompt_tags.get("variant")
    pack_prompt_version = prompt_tags.get("pack_prompt_version")
    role_prompt_versions = prompt_tags.get("role_prompt_versions")
    executed_step_prompt_versions = prompt_tags.get("executed_step_prompt_versions")

    summary: dict[str, Any] = {
        "workflow_id": run_state.workflow_id,
        "variant": variant,
        "pack_prompt_version": pack_prompt_version,
    }
    if isinstance(role_prompt_versions, dict):
        summary["role_prompt_versions"] = dict(role_prompt_versions)
    if isinstance(executed_step_prompt_versions, dict):
        summary["executed_step_prompt_versions"] = dict(executed_step_prompt_versions)
    return summary


def _finalize_reason(turns: list[Any]) -> str | None:
    for turn in turns:
        if not isinstance(turn, dict):
            continue
        if turn.get("action") == "finalize":
            reason = turn.get("reason")
            if isinstance(reason, str) and reason:
                return reason
    return None


def _format_workflow_summary_text(workflow_summary: dict[str, Any]) -> list[str]:
    lines = ["- workflow_summary:"]
    clarified = workflow_summary.get("clarified_idea")
    if isinstance(clarified, str) and clarified:
        lines.append(f"  - clarified_idea: {clarified}")
    mvp = workflow_summary.get("recommended_mvp_direction")
    if isinstance(mvp, str) and mvp:
        lines.append(f"  - recommended_mvp_direction: {mvp}")

    for key in ("strongest_assumptions", "weak_points", "alternatives", "next_3_validation_steps"):
        value = workflow_summary.get(key)
        if isinstance(value, list) and value:
            lines.append(f"  - {key}:")
            for item in value[:3]:
                lines.append(f"    - {item}")
    return lines


def _format_orchestration_summary_text(orchestration_summary: dict[str, Any]) -> list[str]:
    lines = ["- orchestration_summary:"]
    manager_step_id = orchestration_summary.get("manager_step_id")
    if isinstance(manager_step_id, str) and manager_step_id:
        lines.append(f"  - manager_step_id: {manager_step_id}")

    worker_step_ids = orchestration_summary.get("worker_step_ids")
    if isinstance(worker_step_ids, list) and worker_step_ids:
        lines.append("  - worker_step_ids:")
        for step_id in worker_step_ids:
            lines.append(f"    - {step_id}")

    turn_count = orchestration_summary.get("turn_count")
    if isinstance(turn_count, int):
        lines.append(f"  - turn_count: {turn_count}")

    finalize_reason = orchestration_summary.get("finalize_reason")
    if isinstance(finalize_reason, str) and finalize_reason:
        lines.append(f"  - finalize_reason: {finalize_reason}")
    return lines


def _format_prompt_tags_text(prompt_tags: dict[str, Any]) -> list[str]:
    lines = ["- prompt_tags:"]

    variant = prompt_tags.get("variant")
    if isinstance(variant, str) and variant:
        lines.append(f"  - variant: {variant}")

    pack_prompt_version = prompt_tags.get("pack_prompt_version")
    if isinstance(pack_prompt_version, str) and pack_prompt_version:
        lines.append(f"  - pack_prompt_version: {pack_prompt_version}")

    role_prompt_versions = prompt_tags.get("role_prompt_versions")
    if isinstance(role_prompt_versions, dict) and role_prompt_versions:
        lines.append("  - role_prompt_versions:")
        for role_key in sorted(role_prompt_versions):
            version = role_prompt_versions.get(role_key)
            if isinstance(version, str) and version:
                lines.append(f"    - {role_key}: {version}")

    executed_versions = prompt_tags.get("executed_step_prompt_versions")
    if isinstance(executed_versions, dict) and executed_versions:
        lines.append("  - executed_step_prompt_versions:")
        for role_key in sorted(executed_versions):
            version = executed_versions.get(role_key)
            if isinstance(version, str) and version:
                lines.append(f"    - {role_key}: {version}")

    return lines


def _collect_event_counts(events: list[TraceEvent]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        key = str(event.event_type)
        counts[key] = counts.get(key, 0) + 1
    return counts


def _collect_lane_counts(events: list[TraceEvent]) -> dict[str, int]:
    lane_counts: dict[str, int] = {}
    for event in events:
        if not isinstance(event.payload, dict):
            continue
        lane = event.payload.get("lane")
        if not isinstance(lane, str) or not lane:
            continue
        lane_counts[lane] = lane_counts.get(lane, 0) + 1
    return lane_counts


def _max_turn_index(events: list[TraceEvent]) -> int | None:
    turn_values: list[int] = []
    for event in events:
        if not isinstance(event.payload, dict):
            continue
        turn_index = event.payload.get("turn_index")
        if isinstance(turn_index, int):
            turn_values.append(turn_index)
    if not turn_values:
        return None
    return max(turn_values)


def _collect_event_counts_from_payload(events: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        event_type = _str_or_none(event.get("event_type"))
        if event_type is None:
            continue
        counts[event_type] = counts.get(event_type, 0) + 1
    return counts


def _collect_lane_counts_from_payload(events: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        payload = event.get("payload")
        if not isinstance(payload, dict):
            continue
        lane = _str_or_none(payload.get("lane"))
        if lane is None:
            continue
        counts[lane] = counts.get(lane, 0) + 1
    return counts


def _max_turn_index_from_payload(events: list[dict[str, Any]]) -> int | None:
    turns: list[int] = []
    for event in events:
        payload = event.get("payload")
        if not isinstance(payload, dict):
            continue
        turn = payload.get("turn_index")
        if isinstance(turn, int):
            turns.append(turn)
    if not turns:
        return None
    return max(turns)


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None
