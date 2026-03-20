from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, cast

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
