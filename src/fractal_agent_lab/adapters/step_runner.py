from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from fractal_agent_lab.adapters.base import AdapterStepRequest, ModelAdapter
from fractal_agent_lab.adapters.mock import MockAdapter
from fractal_agent_lab.adapters.openai import OpenAICompatibleAdapter
from fractal_agent_lab.adapters.openrouter import OpenRouterAdapter
from fractal_agent_lab.adapters.routing import ProviderRouter
from fractal_agent_lab.core.contracts import AgentSpec, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.errors import RuntimeBoundaryError, StepExecutionError
from fractal_agent_lab.core.models import RunState


@dataclass(slots=True)
class AdapterStepRunner:
    router: ProviderRouter = field(default_factory=ProviderRouter)
    agent_specs_by_id: Mapping[str, AgentSpec] = field(default_factory=dict)
    adapters_by_provider: Mapping[str, ModelAdapter] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.adapters_by_provider:
            return
        self.adapters_by_provider = {
            "mock": MockAdapter(),
            "openai": OpenAICompatibleAdapter(),
            "openrouter": OpenRouterAdapter(),
        }

    def __call__(
        self,
        *,
        run_state: RunState,
        workflow: WorkflowSpec,
        step: WorkflowStepSpec,
    ) -> Any:
        agent_spec = self.agent_specs_by_id.get(step.agent_id)
        selection = self.router.resolve(workflow_id=workflow.workflow_id, agent_spec=agent_spec)

        adapter = self.adapters_by_provider.get(selection.provider)
        if adapter is None:
            raise RuntimeBoundaryError(
                f"No adapter registered for provider '{selection.provider}'.",
                details={
                    "provider": selection.provider,
                    "step_id": step.step_id,
                    "agent_id": step.agent_id,
                },
            )

        request = AdapterStepRequest(
            run_id=run_state.run_id,
            workflow_id=workflow.workflow_id,
            step_id=step.step_id,
            agent_id=step.agent_id,
            role=agent_spec.role if agent_spec is not None else None,
            input_payload=dict(run_state.input_payload),
            context={
                **run_state.context,
                "step_results": dict(run_state.step_results),
                "model_policy_ref": selection.model_policy_ref,
            },
            step_description=step.description,
            instructions=agent_spec.instructions if agent_spec is not None else None,
            instruction_ref=agent_spec.instruction_ref if agent_spec is not None else None,
            model_policy_ref=selection.model_policy_ref,
            prompt_version=_prompt_version(agent_spec),
            agent_metadata=dict(agent_spec.metadata) if agent_spec is not None else {},
            model=selection.model,
        )

        try:
            result = adapter.execute_step(request)
        except Exception as error:
            if isinstance(error, (RuntimeBoundaryError, StepExecutionError)):
                raise
            raise StepExecutionError(
                f"Adapter execution failed for step '{step.step_id}'.",
                details={
                    "provider": selection.provider,
                    "error_type": type(error).__name__,
                    "error": str(error),
                },
            ) from error

        return {
            "provider": result.provider,
            "model": result.model,
            "agent_id": step.agent_id,
            "step_id": step.step_id,
            "output": result.output,
            "raw": result.raw,
        }


def build_step_runner(
    *,
    agent_specs_by_id: Mapping[str, AgentSpec] | None = None,
    providers_config: Mapping[str, Any] | None = None,
    model_policy_config: Mapping[str, Any] | None = None,
    adapters_by_provider: Mapping[str, ModelAdapter] | None = None,
) -> AdapterStepRunner:
    return AdapterStepRunner(
        router=ProviderRouter(
            providers_config=providers_config or {},
            model_policy_config=model_policy_config or {},
        ),
        agent_specs_by_id=agent_specs_by_id or {},
        adapters_by_provider=adapters_by_provider or {},
    )


def _prompt_version(agent_spec: AgentSpec | None) -> str | None:
    if agent_spec is None:
        return None

    prompt_version = agent_spec.metadata.get("prompt_version")
    if isinstance(prompt_version, str) and prompt_version:
        return prompt_version
    return None
