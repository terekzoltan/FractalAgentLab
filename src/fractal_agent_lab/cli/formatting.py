from __future__ import annotations

from datetime import datetime
from typing import Any

from fractal_agent_lab.core.events import TraceEvent, TraceEventType
from fractal_agent_lab.core.models import RunState


def format_run_summary_text(run_state: RunState, *, steps_total: int, trace_events_count: int) -> str:
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
        TraceEventType.RUN_COMPLETED,
        TraceEventType.RUN_FAILED,
        TraceEventType.RUN_TIMED_OUT,
    ]
    lines.append("- event_counts:")
    for event_type in ordered_types:
        key = str(event_type)
        if key in counts:
            lines.append(f"  - {key}: {counts[key]}")

    lines.append("- timeline:")
    for event in events:
        step_suffix = f" step={event.step_id}" if event.step_id else ""
        lines.append(
            f"  - #{event.sequence} {event.event_type} source={event.source}{step_suffix}",
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
    if include_trace:
        payload["trace_summary"] = {
            "total_events": len(events),
            "events": [
                {
                    "event_id": event.event_id,
                    "sequence": event.sequence,
                    "event_type": str(event.event_type),
                    "timestamp": _fmt_ts(event.timestamp),
                    "source": event.source,
                    "step_id": event.step_id,
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
