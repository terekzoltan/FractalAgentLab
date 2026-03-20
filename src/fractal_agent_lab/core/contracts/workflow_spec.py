from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


WORKFLOW_SPEC_SCHEMA_VERSION = "workflow_spec.v0"


class WorkflowExecutionMode(StrEnum):
    LINEAR = "linear"
    MANAGER = "manager"
    HANDOFF = "handoff"
    PARALLEL = "parallel"
    GRAPH = "graph"


class ManagerAction(StrEnum):
    DELEGATE = "delegate"
    FINALIZE = "finalize"
    FAIL = "fail"


@dataclass(slots=True)
class ManagerSpec:
    manager_step_id: str
    worker_step_ids: list[str] = field(default_factory=list)
    max_turns: int = 8
    allow_revisit_workers: bool = False


@dataclass(slots=True)
class ManagerDecision:
    action: ManagerAction
    target_step_id: str | None = None
    target_agent_id: str | None = None
    reason: str | None = None
    output: dict[str, Any] = field(default_factory=dict)


class HandoffAction(StrEnum):
    HANDOFF = "handoff"
    FINALIZE = "finalize"
    FAIL = "fail"


@dataclass(slots=True)
class HandoffDecision:
    action: HandoffAction
    target_step_id: str | None = None
    target_agent_id: str | None = None
    reason: str | None = None
    output: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class WorkflowStepSpec:
    step_id: str
    agent_id: str
    description: str | None = None


def _ordered_unique_agent_ids(steps: list[WorkflowStepSpec]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for step in steps:
        if step.agent_id in seen:
            continue
        seen.add(step.agent_id)
        ordered.append(step.agent_id)
    return ordered


@dataclass(slots=True)
class WorkflowSpec:
    workflow_id: str
    name: str
    version: str = "0.1.0"
    execution_mode: WorkflowExecutionMode = WorkflowExecutionMode.LINEAR
    steps: list[WorkflowStepSpec] = field(default_factory=list)
    entrypoint_step_id: str | None = None
    entrypoint_ref: str | None = None
    input_schema_ref: str | None = None
    output_schema_ref: str | None = None
    manager_spec: ManagerSpec | None = None
    agent_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    schema_version: str = WORKFLOW_SPEC_SCHEMA_VERSION

    def __post_init__(self) -> None:
        step_ids = [step.step_id for step in self.steps]
        if len(step_ids) != len(set(step_ids)):
            duplicates = sorted({step_id for step_id in step_ids if step_ids.count(step_id) > 1})
            raise ValueError(
                "WorkflowSpec contains duplicate step_id values: " + ", ".join(duplicates),
            )
        if not self.agent_ids and self.steps:
            self.agent_ids = _ordered_unique_agent_ids(self.steps)
        if self.entrypoint_step_id is None and self.steps:
            self.entrypoint_step_id = self.steps[0].step_id
        if self.manager_spec is None and self.execution_mode == WorkflowExecutionMode.MANAGER:
            raise ValueError("execution_mode 'manager' requires non-null manager_spec.")
        if self.manager_spec is not None and self.execution_mode != WorkflowExecutionMode.MANAGER:
            raise ValueError("manager_spec requires execution_mode 'manager'.")
        if self.manager_spec and self.manager_spec.max_turns <= 0:
            raise ValueError("manager_spec.max_turns must be positive.")
        if self.manager_spec and self.manager_spec.manager_step_id in self.manager_spec.worker_step_ids:
            raise ValueError("manager_spec.worker_step_ids cannot include manager_step_id.")
        if (
            self.execution_mode == WorkflowExecutionMode.HANDOFF
            and self.entrypoint_step_id is not None
            and self.entrypoint_step_id not in {step.step_id for step in self.steps}
        ):
            raise ValueError("handoff workflows require a valid entrypoint_step_id.")
