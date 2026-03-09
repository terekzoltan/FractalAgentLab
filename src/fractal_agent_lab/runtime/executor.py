from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Any, Protocol
from uuid import uuid4

from fractal_agent_lab.core.contracts import WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.errors import (
    FractalRuntimeError,
    RunBudgetError,
    RunTimeoutError,
    RuntimeBoundaryError,
    StepExecutionError,
)
from fractal_agent_lab.core.events import TraceEvent, TraceEventType
from fractal_agent_lab.core.models import RunState
from fractal_agent_lab.state import NullRunStateStore, RunStateStore
from fractal_agent_lab.tracing import NullTraceEmitter, TraceEmitter


@dataclass(slots=True)
class RuntimeLimits:
    timeout_seconds: float | None = None
    max_retries_per_step: int = 0
    budget_units: int | None = None
    step_cost_units: int = 1

    def __post_init__(self) -> None:
        if self.timeout_seconds is not None and self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive when provided")
        if self.max_retries_per_step < 0:
            raise ValueError("max_retries_per_step cannot be negative")
        if self.budget_units is not None and self.budget_units < 0:
            raise ValueError("budget_units cannot be negative")
        if self.step_cost_units <= 0:
            raise ValueError("step_cost_units must be positive")


class StepRunner(Protocol):
    def __call__(
        self,
        *,
        run_state: RunState,
        workflow: WorkflowSpec,
        step: WorkflowStepSpec,
    ) -> Any:
        ...


def _default_step_runner(
    *,
    run_state: RunState,
    workflow: WorkflowSpec,
    step: WorkflowStepSpec,
) -> Any:
    _ = run_state
    _ = workflow
    _ = step
    raise RuntimeBoundaryError(
        "No step runner configured. Track D should provide adapter-side execution later.",
    )


class WorkflowExecutor:
    def __init__(
        self,
        *,
        step_runner: StepRunner = _default_step_runner,
        emitter: TraceEmitter | None = None,
        state_store: RunStateStore | None = None,
        limits: RuntimeLimits | None = None,
        source: str = "runtime.executor",
    ) -> None:
        self._step_runner = step_runner
        self._emitter = emitter or NullTraceEmitter()
        self._state_store = state_store or NullRunStateStore()
        self._limits = limits or RuntimeLimits()
        self._source = source

    def execute(
        self,
        workflow: WorkflowSpec,
        input_payload: dict[str, Any] | None = None,
        *,
        run_id: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> RunState:
        run_state = RunState(
            run_id=run_id or str(uuid4()),
            workflow_id=workflow.workflow_id,
            input_payload=input_payload or {},
            context=context or {},
        )
        self._state_store.save(run_state)

        sequence = 0

        def emit(
            event_type: TraceEventType,
            *,
            step_id: str | None = None,
            payload: dict[str, Any] | None = None,
        ) -> None:
            nonlocal sequence
            sequence += 1
            event = TraceEvent(
                run_id=run_state.run_id,
                event_type=event_type,
                sequence=sequence,
                source=self._source,
                step_id=step_id,
                payload=payload or {},
            )
            run_state.add_trace_event(event.event_id)
            self._emitter.emit(event)

        run_state.start()
        self._state_store.save(run_state)
        emit(
            TraceEventType.RUN_STARTED,
            payload={
                "workflow_id": workflow.workflow_id,
                "workflow_name": workflow.name,
                "execution_mode": workflow.execution_mode.value,
            },
        )

        if not workflow.steps:
            error = RuntimeBoundaryError(
                "Workflow has no executable steps in Wave 0 executor.",
                details={"workflow_id": workflow.workflow_id},
            )
            run_state.fail(str(error))
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_FAILED, payload=self._error_payload(error))
            return run_state

        started_at = monotonic()
        remaining_budget = self._limits.budget_units

        try:
            for step in workflow.steps:
                self._enforce_timeout(started_at)
                remaining_budget = self._consume_budget(
                    remaining_budget,
                    step_id=step.step_id,
                )

                emit(
                    TraceEventType.STEP_STARTED,
                    step_id=step.step_id,
                    payload={"agent_id": step.agent_id},
                )

                attempts = 0
                while True:
                    attempts += 1
                    try:
                        output = self._step_runner(
                            run_state=run_state,
                            workflow=workflow,
                            step=step,
                        )
                        break
                    except (RunTimeoutError, RunBudgetError):
                        raise
                    except Exception as error:
                        emit(
                            TraceEventType.STEP_FAILED,
                            step_id=step.step_id,
                            payload={
                                "attempt": attempts,
                                "error_type": type(error).__name__,
                                "error": str(error),
                            },
                        )
                        if attempts > self._limits.max_retries_per_step:
                            if isinstance(error, FractalRuntimeError):
                                raise
                            raise StepExecutionError(
                                f"Step '{step.step_id}' failed after {attempts} attempt(s).",
                                details={
                                    "step_id": step.step_id,
                                    "error_type": type(error).__name__,
                                    "error": str(error),
                                },
                            ) from error

                run_state.step_results[step.step_id] = output
                self._state_store.save(run_state)
                emit(
                    TraceEventType.STEP_COMPLETED,
                    step_id=step.step_id,
                    payload={
                        "agent_id": step.agent_id,
                        "attempts": attempts,
                    },
                )

            run_state.succeed(output_payload={"step_results": dict(run_state.step_results)})
            self._state_store.save(run_state)
            emit(
                TraceEventType.RUN_COMPLETED,
                payload={"steps_completed": len(run_state.step_results)},
            )
            return run_state

        except RunTimeoutError as error:
            run_state.timeout(str(error))
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_TIMED_OUT, payload=self._error_payload(error))
            return run_state

        except FractalRuntimeError as error:
            run_state.fail(str(error))
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_FAILED, payload=self._error_payload(error))
            return run_state

        except Exception as error:
            wrapped = StepExecutionError(
                "Unhandled runtime exception.",
                details={"error_type": type(error).__name__, "error": str(error)},
            )
            run_state.fail(str(error))
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_FAILED, payload=self._error_payload(wrapped))
            return run_state

    def _enforce_timeout(self, started_at: float) -> None:
        timeout = self._limits.timeout_seconds
        if timeout is None:
            return
        elapsed = monotonic() - started_at
        if elapsed > timeout:
            raise RunTimeoutError(
                "Run timeout exceeded.",
                details={"timeout_seconds": timeout, "elapsed_seconds": elapsed},
            )

    def _consume_budget(self, remaining: int | None, *, step_id: str) -> int | None:
        if remaining is None:
            return None
        updated = remaining - self._limits.step_cost_units
        if updated < 0:
            raise RunBudgetError(
                "Run budget exceeded.",
                details={
                    "step_id": step_id,
                    "remaining_budget": remaining,
                    "step_cost_units": self._limits.step_cost_units,
                },
            )
        return updated

    @staticmethod
    def _error_payload(error: Exception) -> dict[str, Any]:
        if isinstance(error, FractalRuntimeError):
            return {
                "code": error.code,
                "error": str(error),
                "details": error.details,
            }
        return {"error": str(error), "error_type": type(error).__name__}
