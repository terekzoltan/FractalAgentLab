from __future__ import annotations

from dataclasses import dataclass

from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult
from fractal_agent_lab.core.errors import RuntimeBoundaryError


@dataclass(slots=True)
class OpenAICompatibleAdapter:
    name: str = "openai"

    def execute_step(self, request: AdapterStepRequest) -> AdapterStepResult:
        raise RuntimeBoundaryError(
            "OpenAICompatibleAdapter is not wired for real provider calls in Wave 0.",
            details={
                "provider": self.name,
                "step_id": request.step_id,
                "workflow_id": request.workflow_id,
            },
        )
