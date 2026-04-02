from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from fractal_agent_lab.tracing.artifact_layout import run_artifact_path, trace_artifact_path


TERMINAL_RUN_STATUSES = {"succeeded", "failed", "timed_out", "cancelled"}
SUPPORTED_RUN_SCHEMA_VERSIONS = {"run_state.v0", "run_state.v1"}
SUPPORTED_TRACE_SCHEMA_VERSIONS = {"trace_event.v0", "trace_event.v1"}

REQUIRED_RUN_FIELDS = {
    "run_id",
    "workflow_id",
    "status",
    "input_payload",
    "output_payload",
    "step_results",
    "errors",
    "context",
    "trace_event_ids",
    "created_at",
    "started_at",
    "completed_at",
    "schema_version",
}

REQUIRED_TRACE_FIELDS = {
    "event_id",
    "run_id",
    "sequence",
    "event_type",
    "timestamp",
    "source",
    "step_id",
    "parent_event_id",
    "correlation_id",
    "payload",
    "schema_version",
}


@dataclass(slots=True)
class ArtifactValidationResult:
    run_path: Path
    trace_path: Path
    run_id: str | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    run_payload: dict[str, Any] | None = None
    trace_events: list[dict[str, Any]] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.errors


def validate_run_trace_by_run_id(
    run_id: str,
    *,
    data_dir: str | Path = "data",
) -> ArtifactValidationResult:
    run_path = run_artifact_path(run_id=run_id, data_dir=data_dir)
    trace_path = trace_artifact_path(run_id=run_id, data_dir=data_dir)
    return validate_run_trace_artifacts(run_path=run_path, trace_path=trace_path)


def validate_run_trace_artifacts(
    *,
    run_path: str | Path,
    trace_path: str | Path,
) -> ArtifactValidationResult:
    run_file = Path(run_path)
    trace_file = Path(trace_path)
    result = ArtifactValidationResult(run_path=run_file, trace_path=trace_file)

    run_payload = _load_json_object(run_file, label="run artifact", errors=result.errors)
    trace_events = _load_jsonl_objects(trace_file, errors=result.errors)

    if run_payload is None:
        return result

    result.run_payload = run_payload
    result.run_id = _as_non_empty_str(run_payload.get("run_id"))
    if result.run_id is None:
        result.errors.append("Run artifact missing non-empty 'run_id'.")

    _check_required_fields(
        run_payload,
        required_fields=REQUIRED_RUN_FIELDS,
        label="run artifact",
        errors=result.errors,
    )
    _check_run_envelope(run_payload, result)

    result.trace_events = trace_events
    if not trace_events:
        result.errors.append("Trace artifact has no events.")
        return result

    _check_trace_events(trace_events, result)
    _check_cross_artifact_consistency(run_payload, trace_events, result)
    return result


def _load_json_object(
    path: Path,
    *,
    label: str,
    errors: list[str],
) -> dict[str, Any] | None:
    if not path.exists():
        errors.append(f"Missing {label}: {path}")
        return None

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"Failed to parse {label} ({path}): {error}")
        return None

    if not isinstance(payload, dict):
        errors.append(f"{label.capitalize()} root must be a JSON object: {path}")
        return None
    return payload


def _load_jsonl_objects(path: Path, *, errors: list[str]) -> list[dict[str, Any]]:
    if not path.exists():
        errors.append(f"Missing trace artifact: {path}")
        return []

    try:
        content = path.read_text(encoding="utf-8")
    except OSError as error:
        errors.append(f"Failed to read trace artifact ({path}): {error}")
        return []

    events: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            errors.append(f"Trace artifact JSON parse error at line {line_number}: {error.msg}")
            continue

        if not isinstance(value, dict):
            errors.append(f"Trace artifact line {line_number} is not a JSON object.")
            continue
        events.append(value)
    return events


def _check_required_fields(
    payload: dict[str, Any],
    *,
    required_fields: set[str],
    label: str,
    errors: list[str],
) -> None:
    missing = sorted(required_fields.difference(payload))
    for key in missing:
        errors.append(f"{label.capitalize()} missing required field '{key}'.")


def _check_run_envelope(run_payload: dict[str, Any], result: ArtifactValidationResult) -> None:
    status = _as_non_empty_str(run_payload.get("status"))
    if status is None:
        result.errors.append("Run artifact missing non-empty 'status'.")
        return

    if status not in TERMINAL_RUN_STATUSES:
        result.errors.append(
            "Run artifact status is not terminal: "
            f"{status} (allowed: {', '.join(sorted(TERMINAL_RUN_STATUSES))}).",
        )

    trace_event_ids = run_payload.get("trace_event_ids")
    if not isinstance(trace_event_ids, list) or not trace_event_ids:
        result.errors.append("Run artifact 'trace_event_ids' must be a non-empty list.")

    schema_version = _as_non_empty_str(run_payload.get("schema_version"))
    if schema_version is None:
        result.errors.append("Run artifact missing non-empty 'schema_version'.")
    elif schema_version not in SUPPORTED_RUN_SCHEMA_VERSIONS:
        result.errors.append(
            "Run artifact has unsupported 'schema_version': "
            f"{schema_version} (supported: {', '.join(sorted(SUPPORTED_RUN_SCHEMA_VERSIONS))}).",
        )

    if schema_version == "run_state.v1":
        failure = run_payload.get("failure")
        if status in {"failed", "timed_out"} and not isinstance(failure, dict):
            result.errors.append("Run artifact v1 failure status requires object 'failure'.")
        if status == "succeeded" and failure is not None:
            result.errors.append("Run artifact v1 succeeded status must not carry 'failure'.")

        status_transitions = run_payload.get("status_transitions")
        if not isinstance(status_transitions, list) or not status_transitions:
            result.errors.append("Run artifact v1 missing non-empty 'status_transitions'.")

    if status == "succeeded":
        output_payload = run_payload.get("output_payload")
        if not isinstance(output_payload, dict):
            result.errors.append("Succeeded run must include object 'output_payload'.")
            return

        step_results = output_payload.get("step_results")
        if not isinstance(step_results, dict) or not step_results:
            result.errors.append("Succeeded run must include non-empty 'output_payload.step_results'.")


def _check_trace_events(events: list[dict[str, Any]], result: ArtifactValidationResult) -> None:
    previous_sequence: int | None = None
    event_types: list[str] = []
    seen_event_ids: set[str] = set()

    for index, event in enumerate(events, start=1):
        _check_required_fields(
            event,
            required_fields=REQUIRED_TRACE_FIELDS,
            label=f"trace event #{index}",
            errors=result.errors,
        )

        sequence = event.get("sequence")
        if not isinstance(sequence, int):
            result.errors.append(f"Trace event #{index} has non-integer 'sequence'.")
        else:
            if previous_sequence is not None and sequence <= previous_sequence:
                result.errors.append(
                    "Trace sequence is not strictly increasing at event "
                    f"#{index} ({sequence} <= {previous_sequence}).",
                )
            previous_sequence = sequence

        event_type = _as_non_empty_str(event.get("event_type"))
        if event_type is not None:
            event_types.append(event_type)

        schema_version = _as_non_empty_str(event.get("schema_version"))
        if schema_version is None:
            result.errors.append(f"Trace event #{index} missing non-empty 'schema_version'.")
        elif schema_version not in SUPPORTED_TRACE_SCHEMA_VERSIONS:
            result.errors.append(
                f"Trace event #{index} has unsupported schema_version '{schema_version}'.",
            )

        event_id = _as_non_empty_str(event.get("event_id"))
        if event_id is None:
            result.errors.append(f"Trace event #{index} missing non-empty 'event_id'.")
        elif event_id in seen_event_ids:
            result.errors.append(f"Trace event #{index} duplicates event_id '{event_id}'.")
        else:
            seen_event_ids.add(event_id)

        timestamp = _as_non_empty_str(event.get("timestamp"))
        if timestamp is None:
            result.errors.append(f"Trace event #{index} missing non-empty 'timestamp'.")
        elif not _is_iso8601_timestamp(timestamp):
            result.errors.append(f"Trace event #{index} has invalid ISO timestamp '{timestamp}'.")

        payload = event.get("payload")
        if not isinstance(payload, dict):
            result.errors.append(f"Trace event #{index} payload must be an object.")

    if event_types and event_types[0] != "run_started":
        result.errors.append("Trace first event must be 'run_started'.")

    run_payload = result.run_payload or {}
    status = _as_non_empty_str(run_payload.get("status"))
    expected_terminal_event = {
        "succeeded": "run_completed",
        "failed": "run_failed",
        "timed_out": "run_timed_out",
        "cancelled": "run_cancelled",
    }.get(status)

    if expected_terminal_event and expected_terminal_event not in event_types:
        result.errors.append(
            "Trace missing expected terminal event "
            f"'{expected_terminal_event}' for run status '{status}'.",
        )

    if status == "succeeded":
        if "step_started" not in event_types:
            result.errors.append("Succeeded run trace must include at least one 'step_started' event.")
        if "step_completed" not in event_types:
            result.errors.append("Succeeded run trace must include at least one 'step_completed' event.")

    if status == "failed" and "step_started" in event_types and "step_failed" not in event_types:
        result.warnings.append("Failed run trace has no 'step_failed' event.")


def _check_cross_artifact_consistency(
    run_payload: dict[str, Any],
    trace_events: list[dict[str, Any]],
    result: ArtifactValidationResult,
) -> None:
    run_id = _as_non_empty_str(run_payload.get("run_id"))
    if run_id is None:
        return

    trace_run_ids = {event.get("run_id") for event in trace_events}
    if trace_run_ids != {run_id}:
        result.errors.append(
            "Run/trace run_id mismatch detected: "
            f"run artifact run_id={run_id}, trace run_ids={sorted(str(value) for value in trace_run_ids)}.",
        )

    trace_event_ids = run_payload.get("trace_event_ids")
    if isinstance(trace_event_ids, list) and trace_event_ids:
        if len(trace_event_ids) != len(trace_events):
            result.errors.append(
                "Trace event count mismatch between run artifact and trace artifact: "
                f"run.trace_event_ids={len(trace_event_ids)}, trace_events={len(trace_events)}.",
            )
        trace_event_id_values = [event.get("event_id") for event in trace_events]
        if trace_event_ids != trace_event_id_values:
            result.errors.append("Run trace_event_ids do not match trace artifact event_id ordering.")


def _as_non_empty_str(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _is_iso8601_timestamp(value: str) -> bool:
    normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
    try:
        datetime.fromisoformat(normalized)
    except ValueError:
        return False
    return True
