from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from fractal_agent_lab.core.events import TraceEvent, TraceEventType
from fractal_agent_lab.core.models import RunState, RunStatus


IDENTITY_SIGNAL_SCHEMA_VERSION = "identity.signal.v0"


def _clamp_unit(value: float) -> float:
    return max(0.0, min(1.0, value))


def _normalize_float(value: Any) -> float | None:
    if not isinstance(value, (int, float)):
        return None
    return _clamp_unit(float(value))


def _normalize_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    return None


@dataclass(slots=True)
class NormalizedIdentitySignals:
    agent_id: str
    signals: dict[str, bool | float]
    source: str
    workflow_id: str
    step_id: str
    prompt_version: str | None
    schema_version: str = IDENTITY_SIGNAL_SCHEMA_VERSION


def extract_explicit_identity_signals(run_state: RunState) -> dict[str, dict[str, bool | float]]:
    normalized: dict[str, dict[str, bool | float]] = {}

    for step_result in run_state.step_results.values():
        if not isinstance(step_result, Mapping):
            continue
        agent_id = step_result.get("agent_id")
        step_id = step_result.get("step_id")
        step_output = step_result.get("output")
        if not isinstance(agent_id, str) or not agent_id:
            continue
        if not isinstance(step_id, str) or not step_id:
            continue
        if not isinstance(step_output, Mapping):
            continue

        envelope = step_output.get("identity_signals")
        normalized_envelope = normalize_identity_signal_envelope(
            envelope=envelope,
            workflow_id=run_state.workflow_id,
            step_id=step_id,
            agent_id=agent_id,
            prompt_version=_safe_optional_str(step_output.get("prompt_version")),
        )
        if normalized_envelope is None:
            continue

        current = normalized.setdefault(agent_id, {})
        current.update(normalized_envelope.signals)

    return normalized


def normalize_identity_signal_envelope(
    *,
    envelope: Any,
    workflow_id: str,
    step_id: str,
    agent_id: str,
    prompt_version: str | None,
) -> NormalizedIdentitySignals | None:
    if not isinstance(envelope, Mapping):
        return None

    raw_schema = envelope.get("schema_version")
    if raw_schema is not None and raw_schema != IDENTITY_SIGNAL_SCHEMA_VERSION:
        return None

    raw_signals = envelope.get("signals")
    if not isinstance(raw_signals, Mapping):
        return None

    signals: dict[str, bool | float] = {}

    coherence_score = _normalize_float(raw_signals.get("coherence_score"))
    if coherence_score is not None:
        signals["coherence_score"] = coherence_score

    confidence = _normalize_float(raw_signals.get("confidence"))
    if confidence is not None:
        signals["confidence"] = confidence

    needed_revision = _normalize_bool(raw_signals.get("needed_revision"))
    if needed_revision is not None:
        signals["needed_revision"] = needed_revision

    delegated = _normalize_bool(raw_signals.get("delegated"))
    if delegated is not None:
        signals["delegated"] = delegated

    self_correction_used = _normalize_bool(raw_signals.get("self_correction_used"))
    if self_correction_used is not None:
        signals["self_correction_used"] = self_correction_used

    if not signals:
        return None

    raw_source = envelope.get("source")
    source = raw_source if isinstance(raw_source, str) and raw_source else "step_output"

    return NormalizedIdentitySignals(
        agent_id=agent_id,
        signals=signals,
        source=source,
        workflow_id=workflow_id,
        step_id=step_id,
        prompt_version=prompt_version,
    )


def derive_fallback_identity_signals(
    *,
    run_state: RunState,
    trace_events: list[TraceEvent],
) -> dict[str, dict[str, bool | float]]:
    fallback: dict[str, dict[str, bool | float]] = {}
    attempts_by_step_id = _max_attempts_by_step_id(trace_events)

    for step_result in run_state.step_results.values():
        if not isinstance(step_result, Mapping):
            continue
        agent_id = step_result.get("agent_id")
        step_id = step_result.get("step_id")
        if not isinstance(agent_id, str) or not agent_id:
            continue
        if not isinstance(step_id, str) or not step_id:
            continue

        attempts = attempts_by_step_id.get(step_id, 1)
        if attempts > 1:
            fallback.setdefault(agent_id, {})["needed_revision"] = True

    for agent_id in _delegating_agent_ids(run_state):
        fallback.setdefault(agent_id, {})["delegated"] = True

    if run_state.status in {RunStatus.FAILED, RunStatus.TIMED_OUT}:
        for agent_id in _executed_agent_ids(run_state):
            fallback.setdefault(agent_id, {})["needed_revision"] = True

    return fallback


def merge_identity_signals(
    *,
    explicit_signals: dict[str, dict[str, bool | float]],
    fallback_signals: dict[str, dict[str, bool | float]],
) -> dict[str, dict[str, bool | float]]:
    merged: dict[str, dict[str, bool | float]] = {
        agent_id: dict(values)
        for agent_id, values in fallback_signals.items()
    }
    for agent_id, values in explicit_signals.items():
        current = merged.setdefault(agent_id, {})
        current.update(values)
    return merged


def _max_attempts_by_step_id(trace_events: list[TraceEvent]) -> dict[str, int]:
    attempts_by_step_id: dict[str, int] = {}
    for event in trace_events:
        if event.event_type != TraceEventType.STEP_COMPLETED:
            continue
        if not isinstance(event.step_id, str) or not event.step_id:
            continue

        attempts_value = event.payload.get("attempts")
        if not isinstance(attempts_value, int) or attempts_value <= 0:
            continue
        current = attempts_by_step_id.get(event.step_id, 0)
        attempts_by_step_id[event.step_id] = max(current, attempts_value)
    return attempts_by_step_id


def _delegating_agent_ids(run_state: RunState) -> set[str]:
    delegators: set[str] = set()
    output_payload = run_state.output_payload
    if not isinstance(output_payload, Mapping):
        return delegators

    step_agent_ids = _step_agent_id_by_step_id(run_state)

    manager_orchestration = output_payload.get("manager_orchestration")
    if isinstance(manager_orchestration, Mapping):
        turns = manager_orchestration.get("turns")
        manager_step_id = manager_orchestration.get("manager_step_id")
        manager_agent_id = step_agent_ids.get(manager_step_id) if isinstance(manager_step_id, str) else None
        if isinstance(turns, list):
            for turn in turns:
                if not isinstance(turn, Mapping):
                    continue
                if turn.get("action") != "delegate":
                    continue
                if isinstance(manager_agent_id, str) and manager_agent_id:
                    delegators.add(manager_agent_id)

    handoff_orchestration = output_payload.get("handoff_orchestration")
    if isinstance(handoff_orchestration, Mapping):
        turns = handoff_orchestration.get("turns")
        if isinstance(turns, list):
            for turn in turns:
                if not isinstance(turn, Mapping):
                    continue
                if turn.get("action") != "handoff":
                    continue
                from_agent_id = turn.get("from_agent_id")
                if isinstance(from_agent_id, str) and from_agent_id:
                    delegators.add(from_agent_id)

    return delegators


def _executed_agent_ids(run_state: RunState) -> set[str]:
    agent_ids: set[str] = set()
    for step_result in run_state.step_results.values():
        if not isinstance(step_result, Mapping):
            continue
        agent_id = step_result.get("agent_id")
        if isinstance(agent_id, str) and agent_id:
            agent_ids.add(agent_id)
    return agent_ids


def _step_agent_id_by_step_id(run_state: RunState) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for step_result in run_state.step_results.values():
        if not isinstance(step_result, Mapping):
            continue
        step_id = step_result.get("step_id")
        agent_id = step_result.get("agent_id")
        if not isinstance(step_id, str) or not step_id:
            continue
        if not isinstance(agent_id, str) or not agent_id:
            continue
        mapping[step_id] = agent_id
    return mapping


def _safe_optional_str(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None
