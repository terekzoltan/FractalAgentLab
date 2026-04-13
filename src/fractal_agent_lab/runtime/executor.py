from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Any, Protocol
from uuid import uuid4

from fractal_agent_lab.core.contracts import (
    HandoffAction,
    HandoffDecision,
    ManagerAction,
    ManagerDecision,
    ManagerSpec,
    WorkflowExecutionMode,
    WorkflowSpec,
    WorkflowStepSpec,
)
from fractal_agent_lab.core.errors import (
    FractalRuntimeError,
    RunBudgetError,
    RunTimeoutError,
    RuntimeBoundaryError,
    StepExecutionError,
    error_envelope_from_exception,
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
            parent_event_id: str | None = None,
            correlation_id: str | None = None,
        ) -> TraceEvent:
            nonlocal sequence
            sequence += 1
            event = TraceEvent(
                run_id=run_state.run_id,
                event_type=event_type,
                sequence=sequence,
                source=self._source,
                step_id=step_id,
                parent_event_id=parent_event_id,
                correlation_id=correlation_id,
                payload=payload or {},
            )
            run_state.add_trace_event(event.event_id)
            self._emitter.emit(event)
            return event

        run_state.start()
        self._state_store.save(run_state)
        runtime_mode = self._runtime_execution_mode(workflow)
        emit(
            TraceEventType.RUN_STARTED,
            payload={
                "workflow_id": workflow.workflow_id,
                "workflow_name": workflow.name,
                "execution_mode": runtime_mode.value,
            },
        )

        supported_modes = {
            WorkflowExecutionMode.LINEAR,
            WorkflowExecutionMode.MANAGER,
            WorkflowExecutionMode.HANDOFF,
        }
        if runtime_mode not in supported_modes:
            error = RuntimeBoundaryError(
                f"Execution mode '{runtime_mode.value}' is not implemented in the current runtime.",
                details={
                    "workflow_id": workflow.workflow_id,
                    "execution_mode": runtime_mode.value,
                    "supported_modes": sorted(mode.value for mode in supported_modes),
                },
            )
            envelope = error_envelope_from_exception(error).to_dict()
            run_state.fail(str(error), failure_envelope=envelope)
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_FAILED, payload=self._error_payload(error))
            return run_state

        if not workflow.steps:
            error = RuntimeBoundaryError(
                "Workflow has no executable steps in runtime executor.",
                details={"workflow_id": workflow.workflow_id},
            )
            envelope = error_envelope_from_exception(error).to_dict()
            run_state.fail(str(error), failure_envelope=envelope)
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_FAILED, payload=self._error_payload(error))
            return run_state

        started_at = monotonic()
        remaining_budget = self._limits.budget_units

        try:
            if runtime_mode == WorkflowExecutionMode.LINEAR:
                output_payload, remaining_budget = self._execute_linear_workflow(
                    run_state=run_state,
                    workflow=workflow,
                    emit=emit,
                    started_at=started_at,
                    remaining_budget=remaining_budget,
                )
            elif runtime_mode == WorkflowExecutionMode.HANDOFF:
                output_payload, remaining_budget = self._execute_handoff_workflow(
                    run_state=run_state,
                    workflow=workflow,
                    emit=emit,
                    started_at=started_at,
                    remaining_budget=remaining_budget,
                )
            else:
                manager_spec = workflow.manager_spec
                if manager_spec is None:
                    raise RuntimeBoundaryError(
                        "Runtime mode 'manager' requires non-null manager_spec.",
                        details={"workflow_id": workflow.workflow_id},
                    )
                output_payload, remaining_budget = self._execute_manager_workflow(
                    run_state=run_state,
                    workflow=workflow,
                    manager_spec=manager_spec,
                    emit=emit,
                    started_at=started_at,
                    remaining_budget=remaining_budget,
                )

            _ = remaining_budget
            run_state.succeed(output_payload=output_payload)
            self._state_store.save(run_state)
            emit(
                TraceEventType.RUN_COMPLETED,
                payload={
                    "steps_completed": len(run_state.step_results),
                    "execution_mode": runtime_mode.value,
                },
            )
            return run_state

        except RunTimeoutError as error:
            envelope = error_envelope_from_exception(error).to_dict()
            run_state.timeout(str(error), failure_envelope=envelope)
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_TIMED_OUT, payload=self._error_payload(error))
            return run_state

        except FractalRuntimeError as error:
            envelope = error_envelope_from_exception(error).to_dict()
            run_state.fail(str(error), failure_envelope=envelope)
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_FAILED, payload=self._error_payload(error))
            return run_state

        except Exception as error:
            wrapped = StepExecutionError(
                "Unhandled runtime exception.",
                details={"error_type": type(error).__name__, "error": str(error)},
            )
            envelope = error_envelope_from_exception(wrapped).to_dict()
            run_state.fail(str(wrapped), failure_envelope=envelope)
            self._state_store.save(run_state)
            emit(TraceEventType.RUN_FAILED, payload=self._error_payload(wrapped))
            return run_state

    def _execute_linear_workflow(
        self,
        *,
        run_state: RunState,
        workflow: WorkflowSpec,
        emit,
        started_at: float,
        remaining_budget: int | None,
    ) -> tuple[dict[str, Any], int | None]:
        for step in workflow.steps:
            output, remaining_budget, _ = self._run_step_with_retries(
                run_state=run_state,
                workflow=workflow,
                step=step,
                emit=emit,
                started_at=started_at,
                remaining_budget=remaining_budget,
                turn_index=None,
                lane="linear",
            )
            run_state.step_results[step.step_id] = output
            self._state_store.save(run_state)

        return {"step_results": dict(run_state.step_results)}, remaining_budget

    def _execute_handoff_workflow(
        self,
        *,
        run_state: RunState,
        workflow: WorkflowSpec,
        emit,
        started_at: float,
        remaining_budget: int | None,
    ) -> tuple[dict[str, Any], int | None]:
        steps_by_id = {step.step_id: step for step in workflow.steps}
        if not steps_by_id:
            raise RuntimeBoundaryError(
                "Handoff workflow requires executable steps.",
                details={"workflow_id": workflow.workflow_id},
            )

        if workflow.entrypoint_step_id is None:
            raise RuntimeBoundaryError(
                "Handoff workflow requires entrypoint_step_id.",
                details={"workflow_id": workflow.workflow_id},
            )

        current_step = steps_by_id.get(workflow.entrypoint_step_id)
        if current_step is None:
            raise RuntimeBoundaryError(
                "Handoff workflow entrypoint_step_id does not match any workflow step.",
                details={
                    "workflow_id": workflow.workflow_id,
                    "entrypoint_step_id": workflow.entrypoint_step_id,
                },
            )

        step_id_to_agent_id = {step.step_id: step.agent_id for step in workflow.steps}
        agent_to_step_ids: dict[str, list[str]] = {}
        for step in workflow.steps:
            agent_to_step_ids.setdefault(step.agent_id, []).append(step.step_id)

        visited_step_ids: list[str] = []
        visited_set: set[str] = set()
        handoff_turns: list[dict[str, Any]] = []
        current_parent_event_id: str | None = None

        handoff_index = 0
        while True:
            if current_step.step_id in visited_set:
                raise StepExecutionError(
                    f"Handoff workflow attempted to revisit step '{current_step.step_id}'.",
                    details={
                        "step_id": current_step.step_id,
                        "visited_step_ids": list(visited_step_ids),
                    },
                )

            handoff_index += 1
            handoff_correlation_id = f"handoff:{run_state.run_id}:{handoff_index}"
            orchestration_payload = {
                "handoff_index": handoff_index,
                "from_step_id": current_step.step_id,
                "from_agent_id": current_step.agent_id,
            }
            step_output, remaining_budget, step_completed_event_id = self._run_step_with_retries(
                run_state=run_state,
                workflow=workflow,
                step=current_step,
                emit=emit,
                started_at=started_at,
                remaining_budget=remaining_budget,
                turn_index=handoff_index,
                lane="handoff",
                parent_event_id=current_parent_event_id,
                correlation_id=handoff_correlation_id,
                orchestration_payload=orchestration_payload,
            )
            run_state.step_results[current_step.step_id] = step_output
            self._state_store.save(run_state)

            visited_step_ids.append(current_step.step_id)
            visited_set.add(current_step.step_id)

            try:
                decision, decision_source = self._resolve_handoff_decision(
                    step_output=step_output,
                    current_step_id=current_step.step_id,
                    current_agent_id=current_step.agent_id,
                    step_id_to_agent_id=step_id_to_agent_id,
                    visited_step_ids=visited_set,
                )
            except StepExecutionError as error:
                emit(
                    TraceEventType.HANDOFF_FAILED,
                    step_id=current_step.step_id,
                    payload={
                        "lane": "handoff",
                        "handoff_index": handoff_index,
                        "from_step_id": current_step.step_id,
                        "from_agent_id": current_step.agent_id,
                        "error": str(error),
                        "error_type": type(error).__name__,
                        "decision_source": "fallback",
                    },
                    parent_event_id=step_completed_event_id,
                    correlation_id=handoff_correlation_id,
                )
                raise

            turn_record: dict[str, Any] = {
                "handoff_index": handoff_index,
                "from_step_id": current_step.step_id,
                "from_agent_id": current_step.agent_id,
                "action": decision.action.value,
                "decision_source": decision_source,
                "reason": decision.reason,
            }

            if decision.action == HandoffAction.FINALIZE:
                emit(
                    TraceEventType.HANDOFF_DECIDED,
                    step_id=current_step.step_id,
                    payload={
                        "lane": "handoff",
                        "handoff_index": handoff_index,
                        "decision_action": decision.action.value,
                        "decision_source": decision_source,
                        "from_step_id": current_step.step_id,
                        "from_agent_id": current_step.agent_id,
                        "reason": decision.reason,
                    },
                    parent_event_id=step_completed_event_id,
                    correlation_id=handoff_correlation_id,
                )
                handoff_turns.append(turn_record)
                orchestration = {
                    "entrypoint_step_id": workflow.entrypoint_step_id,
                    "path": list(visited_step_ids),
                    "handoff_count": max(len(visited_step_ids) - 1, 0),
                    "turns": handoff_turns,
                    "final_step_id": current_step.step_id,
                }
                return {
                    "step_results": dict(run_state.step_results),
                    "handoff_orchestration": orchestration,
                    "final_output": decision.output or {"handoff_output": step_output},
                }, remaining_budget

            if decision.action == HandoffAction.FAIL:
                emit(
                    TraceEventType.HANDOFF_FAILED,
                    step_id=current_step.step_id,
                    payload={
                        "lane": "handoff",
                        "handoff_index": handoff_index,
                        "decision_action": decision.action.value,
                        "decision_source": decision_source,
                        "from_step_id": current_step.step_id,
                        "from_agent_id": current_step.agent_id,
                        "reason": decision.reason,
                        "error": "Handoff workflow requested explicit failure.",
                        "error_type": "StepExecutionError",
                    },
                    parent_event_id=step_completed_event_id,
                    correlation_id=handoff_correlation_id,
                )
                raise StepExecutionError(
                    "Handoff workflow requested explicit failure.",
                    details={
                        "handoff_index": handoff_index,
                        "step_id": current_step.step_id,
                        "reason": decision.reason,
                        "output": decision.output,
                    },
                )

            try:
                target_step_id = self._resolve_handoff_target_step_id(
                    decision=decision,
                    current_step_id=current_step.step_id,
                    current_agent_id=current_step.agent_id,
                    step_id_to_agent_id=step_id_to_agent_id,
                    agent_to_step_ids=agent_to_step_ids,
                )
            except StepExecutionError as error:
                emit(
                    TraceEventType.HANDOFF_FAILED,
                    step_id=current_step.step_id,
                    payload={
                        "lane": "handoff",
                        "handoff_index": handoff_index,
                        "decision_action": decision.action.value,
                        "decision_source": decision_source,
                        "from_step_id": current_step.step_id,
                        "from_agent_id": current_step.agent_id,
                        "attempted_target_step_id": decision.target_step_id,
                        "attempted_target_agent_id": decision.target_agent_id,
                        "reason": decision.reason,
                        "error": str(error),
                        "error_type": type(error).__name__,
                    },
                    parent_event_id=step_completed_event_id,
                    correlation_id=handoff_correlation_id,
                )
                raise

            if target_step_id in visited_set:
                revisit_error = StepExecutionError(
                    f"Handoff workflow attempted to revisit step '{target_step_id}'.",
                    details={
                        "handoff_index": handoff_index,
                        "target_step_id": target_step_id,
                        "visited_step_ids": list(visited_step_ids),
                    },
                )
                emit(
                    TraceEventType.HANDOFF_FAILED,
                    step_id=current_step.step_id,
                    payload={
                        "lane": "handoff",
                        "handoff_index": handoff_index,
                        "decision_action": decision.action.value,
                        "decision_source": decision_source,
                        "from_step_id": current_step.step_id,
                        "from_agent_id": current_step.agent_id,
                        "to_step_id": target_step_id,
                        "reason": decision.reason,
                        "error": str(revisit_error),
                        "error_type": type(revisit_error).__name__,
                    },
                    parent_event_id=step_completed_event_id,
                    correlation_id=handoff_correlation_id,
                )
                raise StepExecutionError(
                    f"Handoff workflow attempted to revisit step '{target_step_id}'.",
                    details={
                        "handoff_index": handoff_index,
                        "target_step_id": target_step_id,
                        "visited_step_ids": list(visited_step_ids),
                    },
                )

            target_agent_id = step_id_to_agent_id[target_step_id]
            handoff_decision_event = emit(
                TraceEventType.HANDOFF_DECIDED,
                step_id=current_step.step_id,
                payload={
                    "lane": "handoff",
                    "handoff_index": handoff_index,
                    "decision_action": decision.action.value,
                    "decision_source": decision_source,
                    "from_step_id": current_step.step_id,
                    "from_agent_id": current_step.agent_id,
                    "to_step_id": target_step_id,
                    "to_agent_id": target_agent_id,
                    "reason": decision.reason,
                },
                parent_event_id=step_completed_event_id,
                correlation_id=handoff_correlation_id,
            )
            turn_record["target_step_id"] = target_step_id
            turn_record["target_agent_id"] = target_agent_id
            handoff_turns.append(turn_record)

            current_parent_event_id = handoff_decision_event.event_id
            current_step = steps_by_id[target_step_id]

    def _execute_manager_workflow(
        self,
        *,
        run_state: RunState,
        workflow: WorkflowSpec,
        manager_spec: ManagerSpec,
        emit,
        started_at: float,
        remaining_budget: int | None,
    ) -> tuple[dict[str, Any], int | None]:
        steps_by_id = {step.step_id: step for step in workflow.steps}
        manager_step = steps_by_id.get(manager_spec.manager_step_id)
        if manager_step is None:
            raise RuntimeBoundaryError(
                "manager_spec.manager_step_id does not match any workflow step.",
                details={
                    "manager_step_id": manager_spec.manager_step_id,
                    "workflow_id": workflow.workflow_id,
                },
            )

        worker_step_ids = manager_spec.worker_step_ids or [
            step.step_id for step in workflow.steps if step.step_id != manager_step.step_id
        ]
        if not worker_step_ids:
            raise RuntimeBoundaryError(
                "Manager workflow requires at least one worker step.",
                details={"workflow_id": workflow.workflow_id},
            )

        unknown_workers = sorted(step_id for step_id in worker_step_ids if step_id not in steps_by_id)
        if unknown_workers:
            raise RuntimeBoundaryError(
                "manager_spec.worker_step_ids contains unknown steps.",
                details={"unknown_worker_step_ids": unknown_workers},
            )

        completed_workers: set[str] = set()
        manager_history: list[dict[str, Any]] = []
        worker_agent_to_step = {steps_by_id[step_id].agent_id: step_id for step_id in worker_step_ids}

        for turn_index in range(1, manager_spec.max_turns + 1):
            manager_output, remaining_budget, _ = self._run_step_with_retries(
                run_state=run_state,
                workflow=workflow,
                step=manager_step,
                emit=emit,
                started_at=started_at,
                remaining_budget=remaining_budget,
                turn_index=turn_index,
                lane="manager",
            )
            run_state.step_results[manager_step.step_id] = manager_output
            self._state_store.save(run_state)

            decision = self._resolve_manager_decision(
                manager_output=manager_output,
                worker_step_ids=worker_step_ids,
                completed_workers=completed_workers,
                workflow_id=workflow.workflow_id,
                require_control=workflow.metadata.get("strict_manager_control") is True,
            )

            turn_record: dict[str, Any] = {
                "turn_index": turn_index,
                "action": decision.action.value,
                "reason": decision.reason,
            }

            if decision.action == ManagerAction.FINALIZE:
                manager_history.append(turn_record)
                run_state.context["manager_orchestration"] = {
                    "manager_step_id": manager_step.step_id,
                    "worker_step_ids": list(worker_step_ids),
                    "turns": manager_history,
                }
                self._state_store.save(run_state)
                return {
                    "step_results": dict(run_state.step_results),
                    "manager_orchestration": run_state.context["manager_orchestration"],
                    "final_output": decision.output,
                }, remaining_budget

            if decision.action == ManagerAction.FAIL:
                raise StepExecutionError(
                    "Manager requested explicit failure.",
                    details={
                        "turn_index": turn_index,
                        "reason": decision.reason,
                        "output": decision.output,
                    },
                )

            target_step_id = self._resolve_delegate_target_step_id(
                decision=decision,
                worker_step_ids=worker_step_ids,
                worker_agent_to_step=worker_agent_to_step,
            )

            if not manager_spec.allow_revisit_workers and target_step_id in completed_workers:
                raise StepExecutionError(
                    f"Manager selected already completed worker step '{target_step_id}'.",
                    details={
                        "turn_index": turn_index,
                        "target_step_id": target_step_id,
                    },
                )

            target_step = steps_by_id[target_step_id]
            worker_output, remaining_budget, _ = self._run_step_with_retries(
                run_state=run_state,
                workflow=workflow,
                step=target_step,
                emit=emit,
                started_at=started_at,
                remaining_budget=remaining_budget,
                turn_index=turn_index,
                lane="worker",
            )
            run_state.step_results[target_step.step_id] = worker_output
            self._state_store.save(run_state)
            completed_workers.add(target_step.step_id)

            turn_record["target_step_id"] = target_step.step_id
            turn_record["target_agent_id"] = target_step.agent_id
            manager_history.append(turn_record)

        raise StepExecutionError(
            "Manager workflow exceeded max_turns before finalize.",
            details={
                "max_turns": manager_spec.max_turns,
                "completed_workers": sorted(completed_workers),
                "worker_step_ids": list(worker_step_ids),
            },
        )

    def _run_step_with_retries(
        self,
        *,
        run_state: RunState,
        workflow: WorkflowSpec,
        step: WorkflowStepSpec,
        emit,
        started_at: float,
        remaining_budget: int | None,
        turn_index: int | None,
        lane: str,
        parent_event_id: str | None = None,
        correlation_id: str | None = None,
        orchestration_payload: dict[str, Any] | None = None,
    ) -> tuple[Any, int | None, str]:
        self._enforce_timeout(started_at)
        remaining_budget = self._consume_budget(remaining_budget, step_id=step.step_id)
        trace_payload = dict(orchestration_payload or {})

        emit(
            TraceEventType.STEP_STARTED,
            step_id=step.step_id,
            payload={
                **trace_payload,
                "agent_id": step.agent_id,
                "turn_index": turn_index,
                "lane": lane,
            },
            parent_event_id=parent_event_id,
            correlation_id=correlation_id,
        )

        attempts = 0
        while True:
            attempts += 1
            emit(
                TraceEventType.AGENT_DISPATCHED,
                step_id=step.step_id,
                payload={
                    **trace_payload,
                    "agent_id": step.agent_id,
                    "attempt": attempts,
                    "turn_index": turn_index,
                    "lane": lane,
                },
                parent_event_id=parent_event_id,
                correlation_id=correlation_id,
            )
            try:
                output = self._step_runner(
                    run_state=run_state,
                    workflow=workflow,
                    step=step,
                )
                emit(
                    TraceEventType.AGENT_COMPLETED,
                    step_id=step.step_id,
                    payload={
                        **trace_payload,
                        "agent_id": step.agent_id,
                        "attempt": attempts,
                        "turn_index": turn_index,
                        "lane": lane,
                    },
                    parent_event_id=parent_event_id,
                    correlation_id=correlation_id,
                )
                step_completed_event = emit(
                    TraceEventType.STEP_COMPLETED,
                    step_id=step.step_id,
                    payload={
                        **trace_payload,
                        "agent_id": step.agent_id,
                        "attempts": attempts,
                        "turn_index": turn_index,
                        "lane": lane,
                    },
                    parent_event_id=parent_event_id,
                    correlation_id=correlation_id,
                )
                return output, remaining_budget, step_completed_event.event_id
            except (RunTimeoutError, RunBudgetError):
                raise
            except Exception as error:
                failure_envelope = error_envelope_from_exception(error).to_dict()
                emit(
                    TraceEventType.AGENT_FAILED,
                    step_id=step.step_id,
                    payload={
                        **trace_payload,
                        "agent_id": step.agent_id,
                        "attempt": attempts,
                        "turn_index": turn_index,
                        "lane": lane,
                        "error_type": type(error).__name__,
                        "error": str(error),
                        "failure_category": failure_envelope.get("category"),
                        "error_code": failure_envelope.get("code"),
                        "failure_envelope": failure_envelope,
                    },
                    parent_event_id=parent_event_id,
                    correlation_id=correlation_id,
                )
                emit(
                    TraceEventType.STEP_FAILED,
                    step_id=step.step_id,
                    payload={
                        **trace_payload,
                        "attempt": attempts,
                        "turn_index": turn_index,
                        "lane": lane,
                        "error_type": type(error).__name__,
                        "error": str(error),
                        "failure_category": failure_envelope.get("category"),
                        "error_code": failure_envelope.get("code"),
                        "failure_envelope": failure_envelope,
                    },
                    parent_event_id=parent_event_id,
                    correlation_id=correlation_id,
                )
                if attempts > self._limits.max_retries_per_step:
                    if isinstance(error, FractalRuntimeError):
                        raise
                    raise StepExecutionError(
                        f"Step '{step.step_id}' failed after {attempts} attempt(s).",
                        details={
                            "step_id": step.step_id,
                            "turn_index": turn_index,
                            "error_type": type(error).__name__,
                            "error": str(error),
                        },
                    ) from error

    def _resolve_manager_decision(
        self,
        *,
        manager_output: Any,
        worker_step_ids: list[str],
        completed_workers: set[str],
        workflow_id: str,
        require_control: bool,
    ) -> ManagerDecision:
        parsed = self._try_parse_manager_decision(manager_output)
        if parsed is not None:
            return parsed

        if require_control:
            raise StepExecutionError(
                f"Workflow '{workflow_id}' manager step emitted no valid control envelope.",
                details={"workflow_id": workflow_id},
            )

        for step_id in worker_step_ids:
            if step_id not in completed_workers:
                return ManagerDecision(
                    action=ManagerAction.DELEGATE,
                    target_step_id=step_id,
                    reason="auto_fallback_next_worker",
                )

        return ManagerDecision(
            action=ManagerAction.FINALIZE,
            reason="auto_fallback_all_workers_completed",
            output={"manager_output": manager_output},
        )

    def _try_parse_manager_decision(self, manager_output: Any) -> ManagerDecision | None:
        if not isinstance(manager_output, dict):
            return None

        control_candidates: list[dict[str, Any]] = []
        direct_control = manager_output.get("control")
        if isinstance(direct_control, dict):
            control_candidates.append(direct_control)

        nested_output = manager_output.get("output")
        if isinstance(nested_output, dict):
            nested_control = nested_output.get("control")
            if isinstance(nested_control, dict):
                control_candidates.append(nested_control)

        nested_raw = manager_output.get("raw")
        if isinstance(nested_raw, dict):
            raw_control = nested_raw.get("control")
            if isinstance(raw_control, dict):
                control_candidates.append(raw_control)

        for control in control_candidates:
            parsed = self._parse_control_candidate(control)
            if parsed is not None:
                return parsed

        return None

    def _parse_control_candidate(self, control: dict[str, Any]) -> ManagerDecision | None:
        action_value = str(control.get("action", "")).strip().lower()
        action = _action_from_value(action_value)
        if action is None:
            return None

        target_step_id = control.get("target_step_id")
        if target_step_id is not None and not isinstance(target_step_id, str):
            target_step_id = None

        target_agent_id = control.get("target_agent_id")
        if target_agent_id is not None and not isinstance(target_agent_id, str):
            target_agent_id = None

        reason = control.get("reason")
        if reason is not None and not isinstance(reason, str):
            reason = str(reason)

        output = control.get("output")
        if not isinstance(output, dict):
            output = {}

        return ManagerDecision(
            action=action,
            target_step_id=target_step_id,
            target_agent_id=target_agent_id,
            reason=reason,
            output=output,
        )

    def _resolve_delegate_target_step_id(
        self,
        *,
        decision: ManagerDecision,
        worker_step_ids: list[str],
        worker_agent_to_step: dict[str, str],
    ) -> str:
        target_step_id = decision.target_step_id
        if target_step_id is None and decision.target_agent_id is not None:
            target_step_id = worker_agent_to_step.get(decision.target_agent_id)

        if target_step_id is None:
            raise StepExecutionError(
                "Manager delegate decision missing target step/agent.",
                details={
                    "decision_action": decision.action.value,
                    "decision_reason": decision.reason,
                },
            )

        if target_step_id not in worker_step_ids:
            raise StepExecutionError(
                f"Manager selected unknown worker step '{target_step_id}'.",
                details={
                    "target_step_id": target_step_id,
                    "allowed_worker_step_ids": list(worker_step_ids),
                },
            )

        return target_step_id

    def _resolve_handoff_decision(
        self,
        *,
        step_output: Any,
        current_step_id: str,
        current_agent_id: str,
        step_id_to_agent_id: dict[str, str],
        visited_step_ids: set[str],
    ) -> tuple[HandoffDecision, str]:
        parsed = self._try_parse_handoff_decision(step_output)
        if parsed is not None:
            return parsed, "explicit"

        unvisited_step_ids = [
            step_id for step_id in step_id_to_agent_id if step_id not in visited_step_ids
        ]
        fallback_targets = [step_id for step_id in unvisited_step_ids if step_id != current_step_id]

        if len(fallback_targets) == 1:
            return (
                HandoffDecision(
                    action=HandoffAction.HANDOFF,
                    target_step_id=fallback_targets[0],
                    reason="auto_fallback_single_remaining_step",
                ),
                "fallback",
            )

        if len(fallback_targets) == 0:
            return (
                HandoffDecision(
                    action=HandoffAction.FINALIZE,
                    reason="auto_fallback_no_remaining_step",
                    output={"handoff_output": step_output},
                ),
                "fallback",
            )

        raise StepExecutionError(
            "Handoff decision is ambiguous: no valid control and multiple remaining targets.",
            details={
                "current_step_id": current_step_id,
                "current_agent_id": current_agent_id,
                "remaining_step_ids": fallback_targets,
            },
        )

    def _try_parse_handoff_decision(self, step_output: Any) -> HandoffDecision | None:
        if not isinstance(step_output, dict):
            return None

        control_candidates: list[dict[str, Any]] = []
        direct_control = step_output.get("control")
        if isinstance(direct_control, dict):
            control_candidates.append(direct_control)

        nested_output = step_output.get("output")
        if isinstance(nested_output, dict):
            nested_control = nested_output.get("control")
            if isinstance(nested_control, dict):
                control_candidates.append(nested_control)

        nested_raw = step_output.get("raw")
        if isinstance(nested_raw, dict):
            raw_control = nested_raw.get("control")
            if isinstance(raw_control, dict):
                control_candidates.append(raw_control)

        for control in control_candidates:
            parsed = self._parse_handoff_control_candidate(control)
            if parsed is not None:
                return parsed

        return None

    def _parse_handoff_control_candidate(self, control: dict[str, Any]) -> HandoffDecision | None:
        action_value = str(control.get("action", "")).strip().lower()
        action = _handoff_action_from_value(action_value)
        if action is None:
            return None

        target_step_id = control.get("target_step_id")
        if target_step_id is not None and not isinstance(target_step_id, str):
            target_step_id = None

        target_agent_id = control.get("target_agent_id")
        if target_agent_id is not None and not isinstance(target_agent_id, str):
            target_agent_id = None

        reason = control.get("reason")
        if reason is not None and not isinstance(reason, str):
            reason = str(reason)

        output = control.get("output")
        if not isinstance(output, dict):
            output = {}

        return HandoffDecision(
            action=action,
            target_step_id=target_step_id,
            target_agent_id=target_agent_id,
            reason=reason,
            output=output,
        )

    def _resolve_handoff_target_step_id(
        self,
        *,
        decision: HandoffDecision,
        current_step_id: str,
        current_agent_id: str,
        step_id_to_agent_id: dict[str, str],
        agent_to_step_ids: dict[str, list[str]],
    ) -> str:
        target_step_id = decision.target_step_id
        if target_step_id is None and decision.target_agent_id is not None:
            candidate_step_ids = agent_to_step_ids.get(decision.target_agent_id, [])
            if len(candidate_step_ids) == 1:
                target_step_id = candidate_step_ids[0]
            elif len(candidate_step_ids) > 1:
                raise StepExecutionError(
                    f"Handoff target agent '{decision.target_agent_id}' maps to multiple steps.",
                    details={
                        "target_agent_id": decision.target_agent_id,
                        "candidate_step_ids": list(candidate_step_ids),
                    },
                )

        if target_step_id is None:
            raise StepExecutionError(
                "Handoff decision missing target step/agent.",
                details={
                    "decision_action": decision.action.value,
                    "decision_reason": decision.reason,
                },
            )

        if target_step_id not in step_id_to_agent_id:
            raise StepExecutionError(
                f"Handoff selected unknown step '{target_step_id}'.",
                details={
                    "target_step_id": target_step_id,
                    "known_step_ids": list(step_id_to_agent_id),
                },
            )

        target_agent_id = step_id_to_agent_id[target_step_id]
        if target_step_id == current_step_id or target_agent_id == current_agent_id:
            raise StepExecutionError(
                "Handoff self-loop is not allowed in v1.",
                details={
                    "current_step_id": current_step_id,
                    "current_agent_id": current_agent_id,
                    "target_step_id": target_step_id,
                    "target_agent_id": target_agent_id,
                },
            )

        return target_step_id

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
        envelope = error_envelope_from_exception(error).to_dict()
        return {
            "code": envelope["code"],
            "error": envelope["message"],
            "details": envelope.get("details", {}),
            "failure_envelope": envelope,
        }

    @staticmethod
    def _runtime_execution_mode(workflow: WorkflowSpec) -> WorkflowExecutionMode:
        return workflow.execution_mode


def _action_from_value(value: str) -> ManagerAction | None:
    if value == ManagerAction.DELEGATE.value:
        return ManagerAction.DELEGATE
    if value == ManagerAction.FINALIZE.value:
        return ManagerAction.FINALIZE
    if value == ManagerAction.FAIL.value:
        return ManagerAction.FAIL
    return None


def _handoff_action_from_value(value: str) -> HandoffAction | None:
    if value == HandoffAction.HANDOFF.value:
        return HandoffAction.HANDOFF
    if value == HandoffAction.FINALIZE.value:
        return HandoffAction.FINALIZE
    if value == HandoffAction.FAIL.value:
        return HandoffAction.FAIL
    return None
