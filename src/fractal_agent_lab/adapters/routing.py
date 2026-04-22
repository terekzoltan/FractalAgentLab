from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from fractal_agent_lab.core.contracts import AgentSpec
from fractal_agent_lab.core.errors import RuntimeBoundaryError

SUPPORTED_PROVIDER_TARGETS: tuple[str, ...] = ("mock", "openai", "openrouter")
SUPPORTED_FALLBACK_POLICIES: tuple[str, ...] = ("none", "conservative_mock")
DEFAULT_PROVIDER_TARGET = "mock"
DEFAULT_SELECTION_MODE = "explicit_v1"
DEFAULT_FALLBACK_POLICY = "none"


@dataclass(slots=True)
class ProviderSelection:
    provider: str
    model: str | None
    model_policy_ref: str | None
    selection_source: str = "implicit_safe_default"
    selection_mode: str = DEFAULT_SELECTION_MODE
    fallback_policy: str = DEFAULT_FALLBACK_POLICY


@dataclass(slots=True)
class ProviderRouter:
    providers_config: Mapping[str, Any] = field(default_factory=dict)
    model_policy_config: Mapping[str, Any] = field(default_factory=dict)
    fallback_provider: str = DEFAULT_PROVIDER_TARGET
    default_policy_ref: str = "specialist"

    def resolve(self, *, workflow_id: str, agent_spec: AgentSpec | None) -> ProviderSelection:
        selection_mode = self._selection_mode()
        fallback_policy = self._fallback_policy()
        provider, selection_source = self._resolve_provider(agent_spec)
        policy_ref = agent_spec.model_policy_ref if agent_spec else self.default_policy_ref
        model = self._resolve_model(workflow_id=workflow_id, model_policy_ref=policy_ref)
        return ProviderSelection(
            provider=provider,
            model=model,
            model_policy_ref=policy_ref,
            selection_source=selection_source,
            selection_mode=selection_mode,
            fallback_policy=fallback_policy,
        )

    def _resolve_provider(self, agent_spec: AgentSpec | None) -> tuple[str, str]:
        providers_block = self._providers_block()

        if agent_spec is not None:
            metadata_provider = agent_spec.metadata.get("provider")
            if isinstance(metadata_provider, str) and metadata_provider.strip():
                normalized = self._normalize_supported_provider(
                    metadata_provider,
                    source="agent_metadata",
                )
                self._assert_enabled(normalized, providers_block, source="agent_metadata")
                return normalized, "agent_metadata"

        configured_default = self.providers_config.get("default_provider")
        if isinstance(configured_default, str) and configured_default.strip():
            normalized = self._normalize_supported_provider(
                configured_default,
                source="default_provider",
            )
            self._assert_enabled(normalized, providers_block, source="default_provider")
            return normalized, "default_provider"

        return DEFAULT_PROVIDER_TARGET, "implicit_safe_default"

    def _normalize_supported_provider(self, provider_name: str, *, source: str) -> str:
        try:
            return validate_provider_target(provider_name)
        except ValueError as error:
            raise RuntimeBoundaryError(
                f"Unsupported provider selection from {source}.",
                details={
                    "source": source,
                    "provider": provider_name,
                    "supported_provider_targets": list(SUPPORTED_PROVIDER_TARGETS),
                },
            ) from error

    def _assert_enabled(
        self,
        provider_name: str,
        providers_block: Mapping[str, Any],
        *,
        source: str,
    ) -> None:
        if provider_name == DEFAULT_PROVIDER_TARGET:
            return
        if self._is_enabled(provider_name, providers_block):
            return
        raise RuntimeBoundaryError(
            f"Provider '{provider_name}' selected from {source} but not enabled.",
            details={
                "source": source,
                "provider": provider_name,
            },
        )

    def _selection_mode(self) -> str:
        routing_block = self._routing_block()
        raw_mode = routing_block.get("selection_mode")
        if raw_mode is None:
            return DEFAULT_SELECTION_MODE
        if not isinstance(raw_mode, str) or not raw_mode.strip():
            raise RuntimeBoundaryError(
                "providers.routing.selection_mode must be a non-empty string.",
                details={"selection_mode": raw_mode},
            )
        normalized = raw_mode.strip().lower()
        if normalized != DEFAULT_SELECTION_MODE:
            raise RuntimeBoundaryError(
                "Unsupported providers.routing.selection_mode.",
                details={
                    "selection_mode": normalized,
                    "supported_selection_modes": [DEFAULT_SELECTION_MODE],
                },
            )
        return normalized

    def _fallback_policy(self) -> str:
        routing_block = self._routing_block()
        raw_policy = routing_block.get("fallback_policy")
        if raw_policy is None:
            return DEFAULT_FALLBACK_POLICY
        if not isinstance(raw_policy, str) or not raw_policy.strip():
            raise RuntimeBoundaryError(
                "providers.routing.fallback_policy must be a non-empty string.",
                details={"fallback_policy": raw_policy},
            )
        try:
            return validate_fallback_policy(raw_policy)
        except ValueError as error:
            raise RuntimeBoundaryError(
                "Unsupported providers.routing.fallback_policy.",
                details={
                    "fallback_policy": raw_policy,
                    "supported_fallback_policies": list(SUPPORTED_FALLBACK_POLICIES),
                },
            ) from error

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

    def _routing_block(self) -> Mapping[str, Any]:
        routing = self.providers_config.get("routing", {})
        if isinstance(routing, Mapping):
            return routing
        return {}

    def _providers_block(self) -> Mapping[str, Any]:
        providers = self.providers_config.get("providers", {})
        if isinstance(providers, Mapping):
            return providers
        return {}

    def _is_enabled(self, provider_name: str, providers_block: Mapping[str, Any]) -> bool:
        provider_entry = providers_block.get(provider_name)
        if not isinstance(provider_entry, Mapping):
            return False
        enabled = provider_entry.get("enabled", False)
        return bool(enabled)


def supported_provider_targets() -> tuple[str, ...]:
    return SUPPORTED_PROVIDER_TARGETS


def validate_provider_target(provider: str) -> str:
    normalized = _normalize_provider(provider)
    if normalized not in SUPPORTED_PROVIDER_TARGETS:
        raise ValueError(
            f"Unsupported provider '{normalized}'. Supported providers: {', '.join(SUPPORTED_PROVIDER_TARGETS)}.",
        )
    return normalized


def validate_fallback_policy(policy: str) -> str:
    normalized = policy.strip().lower()
    if normalized not in SUPPORTED_FALLBACK_POLICIES:
        raise ValueError(
            "Unsupported fallback policy "
            f"'{normalized}'. Supported fallback policies: {', '.join(SUPPORTED_FALLBACK_POLICIES)}.",
        )
    return normalized


def apply_provider_override(providers_config: dict[str, Any], provider: str | None) -> None:
    if provider is None:
        return
    if not isinstance(provider, str):
        raise ValueError("--provider override must be a string when provided.")

    normalized = provider.strip().lower()
    if not normalized:
        return

    selected_provider = validate_provider_target(normalized)
    providers_config["default_provider"] = selected_provider

    providers_block = providers_config.get("providers")
    if not isinstance(providers_block, dict):
        providers_block = {}
        providers_config["providers"] = providers_block

    if selected_provider == DEFAULT_PROVIDER_TARGET:
        return

    provider_block = providers_block.get(selected_provider)
    if not isinstance(provider_block, dict):
        provider_block = {}
        providers_block[selected_provider] = provider_block
    provider_block["enabled"] = True


def _normalize_provider(provider: str) -> str:
    normalized = provider.strip().lower()
    if not normalized:
        raise ValueError("Provider value must be a non-empty string.")
    return normalized
