from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(slots=True)
class AdapterStepRequest:
    run_id: str
    workflow_id: str
    step_id: str
    agent_id: str
    role: str | None = None
    input_payload: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)
    step_description: str | None = None
    instructions: str | None = None
    instruction_ref: str | None = None
    model_policy_ref: str | None = None
    prompt_version: str | None = None
    agent_metadata: dict[str, Any] = field(default_factory=dict)
    model: str | None = None


@dataclass(slots=True)
class AdapterStepResult:
    output: Any
    provider: str
    model: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class ModelAdapter(Protocol):
    name: str

    def execute_step(self, request: AdapterStepRequest) -> AdapterStepResult:
        ...
