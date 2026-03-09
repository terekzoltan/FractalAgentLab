from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from fractal_agent_lab.core.contracts import AgentSpec


@dataclass(slots=True)
class ProviderSelection:
    provider: str
    model: str | None
    model_policy_ref: str | None


@dataclass(slots=True)
class ProviderRouter:
    providers_config: Mapping[str, Any] = field(default_factory=dict)
    model_policy_config: Mapping[str, Any] = field(default_factory=dict)
    fallback_provider: str = "mock"
    default_policy_ref: str = "specialist"

    def resolve(self, *, workflow_id: str, agent_spec: AgentSpec | None) -> ProviderSelection:
        provider = self._resolve_provider(agent_spec)
        policy_ref = agent_spec.model_policy_ref if agent_spec else self.default_policy_ref
        model = self._resolve_model(workflow_id=workflow_id, model_policy_ref=policy_ref)
        return ProviderSelection(provider=provider, model=model, model_policy_ref=policy_ref)

    def _resolve_provider(self, agent_spec: AgentSpec | None) -> str:
        providers_block = self._providers_block()

        if agent_spec is not None:
            metadata_provider = agent_spec.metadata.get("provider")
            if isinstance(metadata_provider, str) and metadata_provider:
                if self._is_enabled(metadata_provider, providers_block):
                    return metadata_provider

        configured_default = self.providers_config.get("default_provider")
        if isinstance(configured_default, str) and configured_default:
            if self._is_enabled(configured_default, providers_block):
                return configured_default

        for provider_name in ("openrouter", "openai", "local", self.fallback_provider):
            if self._is_enabled(provider_name, providers_block):
                return provider_name

        return self.fallback_provider

    def _resolve_model(self, *, workflow_id: str, model_policy_ref: str | None) -> str | None:
        workflow_overrides = self.model_policy_config.get("workflow_overrides", {})
        if isinstance(workflow_overrides, Mapping):
            workflow_map = workflow_overrides.get(workflow_id)
            if isinstance(workflow_map, Mapping):
                override = workflow_map.get(model_policy_ref or self.default_policy_ref)
                if isinstance(override, str) and override:
                    return override

        tier_defaults = self.model_policy_config.get("tier_defaults", {})
        if isinstance(tier_defaults, Mapping):
            candidate = tier_defaults.get(model_policy_ref or self.default_policy_ref)
            if isinstance(candidate, str) and candidate:
                return candidate

            fallback = tier_defaults.get(self.default_policy_ref)
            if isinstance(fallback, str) and fallback:
                return fallback
        return None

    def _providers_block(self) -> Mapping[str, Any]:
        providers = self.providers_config.get("providers", {})
        if isinstance(providers, Mapping):
            return providers
        return {}

    def _is_enabled(self, provider_name: str, providers_block: Mapping[str, Any]) -> bool:
        if provider_name == self.fallback_provider:
            return True

        provider_entry = providers_block.get(provider_name)
        if not isinstance(provider_entry, Mapping):
            return False
        enabled = provider_entry.get("enabled", False)
        return bool(enabled)
