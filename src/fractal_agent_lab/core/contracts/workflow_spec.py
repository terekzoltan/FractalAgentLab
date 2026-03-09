from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


WORKFLOW_SPEC_SCHEMA_VERSION = "workflow_spec.v0"


class WorkflowExecutionMode(StrEnum):
    MANAGER = "manager"
    HANDOFF = "handoff"
    PARALLEL = "parallel"
    GRAPH = "graph"


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
    execution_mode: WorkflowExecutionMode = WorkflowExecutionMode.MANAGER
    steps: list[WorkflowStepSpec] = field(default_factory=list)
    entrypoint_step_id: str | None = None
    entrypoint_ref: str | None = None
    input_schema_ref: str | None = None
    output_schema_ref: str | None = None
    agent_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    schema_version: str = WORKFLOW_SPEC_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.agent_ids and self.steps:
            self.agent_ids = _ordered_unique_agent_ids(self.steps)
        if self.entrypoint_step_id is None and self.steps:
            self.entrypoint_step_id = self.steps[0].step_id
