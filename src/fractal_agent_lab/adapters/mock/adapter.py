from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult
from fractal_agent_lab.core.errors import StepExecutionError


ScriptedResponder = Callable[[AdapterStepRequest], Any]


@dataclass(slots=True)
class MockAdapter:
    name: str = "mock"
    scripted_responses: Mapping[str, Any] = field(default_factory=dict)
    fail_steps: Mapping[str, str] = field(default_factory=dict)

    def execute_step(self, request: AdapterStepRequest) -> AdapterStepResult:
        if request.step_id in self.fail_steps:
            raise StepExecutionError(
                f"MockAdapter forced failure for step '{request.step_id}'.",
                details={
                    "step_id": request.step_id,
                    "agent_id": request.agent_id,
                    "reason": self.fail_steps[request.step_id],
                },
            )

        output = self._resolve_output(request)
        return AdapterStepResult(
            output=output,
            provider=self.name,
            model=request.model,
            raw={
                "mock": True,
                "workflow_id": request.workflow_id,
                "step_id": request.step_id,
                "agent_id": request.agent_id,
            },
        )

    def _resolve_output(self, request: AdapterStepRequest) -> Any:
        candidate = self.scripted_responses.get(request.step_id)
        if candidate is None:
            candidate = self.scripted_responses.get(request.agent_id)
        if candidate is None:
            candidate = self.scripted_responses.get("__default__")

        if callable(candidate):
            responder: ScriptedResponder = candidate
            return responder(request)
        if candidate is not None:
            return candidate
        return {
            "message": (
                f"Mock output for workflow '{request.workflow_id}', step '{request.step_id}', "
                f"agent '{request.agent_id}'."
            ),
            "model": request.model,
        }
