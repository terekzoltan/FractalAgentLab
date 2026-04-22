from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any, Mapping

from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult, ModelAdapter
from fractal_agent_lab.adapters.mock import MockAdapter
from fractal_agent_lab.adapters.openai import OpenAICompatibleAdapter
from fractal_agent_lab.adapters.openrouter import OpenRouterAdapter
from fractal_agent_lab.adapters.routing import ProviderRouter, ProviderSelection
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
        providers_block = _providers_block(self.router.providers_config)
        openai_config = providers_block.get("openai", {})
        openrouter_config = providers_block.get("openrouter", {})
        self.adapters_by_provider = {
            "mock": MockAdapter(),
            "openai": OpenAICompatibleAdapter(provider_config=openai_config),
            "openrouter": OpenRouterAdapter(provider_config=openrouter_config),
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

        result, attempts, fallback = self._execute_with_policy(
            step_id=step.step_id,
            request=request,
            selection=selection,
            adapter=adapter,
        )
        raw = _compose_step_raw(
            result_raw=result.raw,
            selection=selection,
            attempts=attempts,
            fallback=fallback,
        )

        return {
            "provider": result.provider,
            "model": result.model,
            "agent_id": step.agent_id,
            "step_id": step.step_id,
            "output": result.output,
            "raw": raw,
        }

    def _execute_with_policy(
        self,
        *,
        step_id: str,
        request: AdapterStepRequest,
        selection: ProviderSelection,
        adapter: ModelAdapter,
    ) -> tuple[AdapterStepResult, list[dict[str, Any]], dict[str, Any]]:
        attempts: list[dict[str, Any]] = []
        fallback = {
            "used": False,
            "policy": selection.fallback_policy,
            "from_provider": selection.provider,
            "to_provider": None,
            "reason": None,
        }

        try:
            result = self._execute_adapter(
                adapter=adapter,
                request=request,
                step_id=step_id,
                provider=selection.provider,
            )
            attempts.append(_attempt_record(provider=selection.provider, outcome="succeeded"))
            return result, attempts, fallback
        except Exception as primary_error:
            attempts.append(
                _attempt_record(
                    provider=selection.provider,
                    outcome="failed",
                    error=primary_error,
                ),
            )

            if not self._should_use_mock_fallback(selection=selection, error=primary_error):
                raise self._augment_error_for_policy(
                    error=primary_error,
                    selection=selection,
                    attempts=attempts,
                ) from primary_error

            mock_adapter = self.adapters_by_provider.get("mock")
            if mock_adapter is None:
                raise RuntimeBoundaryError(
                    "Fallback policy requested mock provider, but no mock adapter is registered.",
                    details={
                        "step_id": step_id,
                        "provider": selection.provider,
                        "fallback_policy": selection.fallback_policy,
                    },
                )

            try:
                fallback_request = replace(request, model=None)
                fallback_result = self._execute_adapter(
                    adapter=mock_adapter,
                    request=fallback_request,
                    step_id=step_id,
                    provider="mock",
                )
            except Exception as fallback_error:
                attempts.append(
                    _attempt_record(
                        provider="mock",
                        outcome="failed",
                        error=fallback_error,
                    ),
                )
                raise StepExecutionError(
                    f"Fallback adapter execution failed for step '{step_id}'.",
                    details={
                        "provider": selection.provider,
                        "fallback_provider": "mock",
                        "fallback_policy": selection.fallback_policy,
                        "selection_source": selection.selection_source,
                        "selection_mode": selection.selection_mode,
                        "provider_attempts": attempts,
                        "primary_error": str(primary_error),
                        "fallback_error": str(fallback_error),
                        "fallback_eligible": False,
                    },
                ) from fallback_error

            attempts.append(_attempt_record(provider="mock", outcome="succeeded"))
            fallback = {
                "used": True,
                "policy": selection.fallback_policy,
                "from_provider": selection.provider,
                "to_provider": "mock",
                "reason": _fallback_reason(primary_error),
            }
            return fallback_result, attempts, fallback

    def _execute_adapter(
        self,
        *,
        adapter: ModelAdapter,
        request: AdapterStepRequest,
        step_id: str,
        provider: str,
    ) -> AdapterStepResult:
        try:
            return adapter.execute_step(request)
        except Exception as error:
            if isinstance(error, (RuntimeBoundaryError, StepExecutionError)):
                raise
            raise StepExecutionError(
                f"Adapter execution failed for step '{step_id}'.",
                details={
                    "provider": provider,
                    "error_type": type(error).__name__,
                    "error": str(error),
                    "fallback_eligible": False,
                },
            ) from error

    def _should_use_mock_fallback(self, *, selection: ProviderSelection, error: Exception) -> bool:
        if selection.fallback_policy != "conservative_mock":
            return False
        if selection.provider != "openrouter":
            return False
        if not isinstance(error, StepExecutionError):
            return False
        details = error.details if isinstance(error.details, dict) else {}
        fallback_eligible = bool(details.get("fallback_eligible", False))
        failed_provider = details.get("provider")
        if isinstance(failed_provider, str) and failed_provider and failed_provider != selection.provider:
            return False
        return fallback_eligible

    def _augment_error_for_policy(
        self,
        *,
        error: Exception,
        selection: ProviderSelection,
        attempts: list[dict[str, Any]],
    ) -> Exception:
        details = {
            "selected_provider": selection.provider,
            "selection_source": selection.selection_source,
            "selection_mode": selection.selection_mode,
            "fallback_policy": selection.fallback_policy,
            "provider_attempts": attempts,
        }

        if isinstance(error, RuntimeBoundaryError):
            merged_details = dict(error.details)
            merged_details.update(details)
            return RuntimeBoundaryError(str(error), details=merged_details)
        if isinstance(error, StepExecutionError):
            merged_details = dict(error.details)
            merged_details.update(details)
            return StepExecutionError(str(error), details=merged_details)
        return error


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


def _providers_block(providers_config: Mapping[str, Any]) -> Mapping[str, Any]:
    providers = providers_config.get("providers")
    if isinstance(providers, Mapping):
        return providers
    return {}


def _compose_step_raw(
    *,
    result_raw: Mapping[str, Any],
    selection: ProviderSelection,
    attempts: list[dict[str, Any]],
    fallback: Mapping[str, Any],
) -> dict[str, Any]:
    raw = dict(result_raw)
    raw["routing"] = {
        "selected_provider": selection.provider,
        "selection_source": selection.selection_source,
        "selection_mode": selection.selection_mode,
        "model_policy_ref": selection.model_policy_ref,
        "selected_model": selection.model,
        "fallback_policy": selection.fallback_policy,
    }
    raw["provider_attempts"] = list(attempts)
    raw["fallback"] = dict(fallback)
    return raw


def _attempt_record(
    *,
    provider: str,
    outcome: str,
    error: Exception | None = None,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "provider": provider,
        "outcome": outcome,
    }
    if error is None:
        return record

    record["error_type"] = type(error).__name__
    record["error"] = str(error)
    if isinstance(error, (RuntimeBoundaryError, StepExecutionError)):
        record["error_code"] = error.code
        details = error.details if isinstance(error.details, dict) else {}
        if "status_code" in details:
            record["status_code"] = details.get("status_code")
        if "fallback_eligible" in details:
            record["fallback_eligible"] = bool(details.get("fallback_eligible"))
    return record


def _fallback_reason(error: Exception) -> str:
    if isinstance(error, StepExecutionError):
        details = error.details if isinstance(error.details, dict) else {}
        stage = details.get("failure_stage")
        if isinstance(stage, str) and stage:
            return f"recoverable_provider_failure:{stage}"
    return "recoverable_provider_failure"
