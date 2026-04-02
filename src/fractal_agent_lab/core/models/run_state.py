from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any


RUN_STATE_SCHEMA_VERSION = "run_state.v1"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RunStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


@dataclass(slots=True)
class RunState:
    run_id: str
    workflow_id: str
    status: RunStatus = RunStatus.PENDING
    input_payload: dict[str, Any] = field(default_factory=dict)
    output_payload: dict[str, Any] | None = None
    step_results: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    failure: dict[str, Any] | None = None
    context: dict[str, Any] = field(default_factory=dict)
    trace_event_ids: list[str] = field(default_factory=list)
    status_transitions: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=_utc_now)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    schema_version: str = RUN_STATE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.status_transitions:
            self._record_status_transition(self.status)

    def _record_status_transition(self, status: RunStatus, *, reason: str | None = None) -> None:
        transition: dict[str, Any] = {
            "status": status.value,
            "timestamp": _utc_now().isoformat(),
        }
        if reason:
            transition["reason"] = reason
        self.status_transitions.append(transition)

    def start(self) -> None:
        if self.started_at is None:
            self.started_at = _utc_now()
        self.status = RunStatus.RUNNING
        self._record_status_transition(self.status)

    def succeed(self, output_payload: dict[str, Any] | None = None) -> None:
        if output_payload is not None:
            self.output_payload = output_payload
        self.failure = None
        self.status = RunStatus.SUCCEEDED
        self.completed_at = _utc_now()
        self._record_status_transition(self.status)

    def fail(self, error_message: str, *, failure_envelope: dict[str, Any] | None = None) -> None:
        self.errors.append(error_message)
        self.failure = dict(failure_envelope) if isinstance(failure_envelope, dict) else None
        self.status = RunStatus.FAILED
        self.completed_at = _utc_now()
        self._record_status_transition(self.status, reason=error_message)

    def cancel(self, reason: str | None = None) -> None:
        if reason:
            self.errors.append(reason)
        self.status = RunStatus.CANCELLED
        self.completed_at = _utc_now()
        self._record_status_transition(self.status, reason=reason)

    def timeout(
        self,
        reason: str | None = None,
        *,
        failure_envelope: dict[str, Any] | None = None,
    ) -> None:
        if reason:
            self.errors.append(reason)
        self.failure = dict(failure_envelope) if isinstance(failure_envelope, dict) else self.failure
        self.status = RunStatus.TIMED_OUT
        self.completed_at = _utc_now()
        self._record_status_transition(self.status, reason=reason)

    def add_trace_event(self, event_id: str) -> None:
        self.trace_event_ids.append(event_id)
