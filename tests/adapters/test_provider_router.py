from __future__ import annotations

import unittest

from fractal_agent_lab.adapters.routing import ProviderRouter, apply_provider_override
from fractal_agent_lab.core.contracts import AgentSpec
from fractal_agent_lab.core.errors import RuntimeBoundaryError


class ProviderRouterPolicyTests(unittest.TestCase):
    def test_defaults_to_mock_when_no_explicit_selection_exists(self) -> None:
        router = ProviderRouter(
            providers_config={},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("mock", selection.provider)
        self.assertEqual("implicit_safe_default", selection.selection_source)
        self.assertEqual("explicit_v1", selection.selection_mode)
        self.assertEqual("none", selection.fallback_policy)

    def test_uses_explicit_default_provider_when_enabled(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openrouter",
                "providers": {"openrouter": {"enabled": True}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("openrouter", selection.provider)
        self.assertEqual("default_provider", selection.selection_source)

    def test_rejects_disabled_explicit_default_provider(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openrouter",
                "providers": {"openrouter": {"enabled": False}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError):
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

    def test_rejects_unsupported_default_provider(self) -> None:
        router = ProviderRouter(
            providers_config={"default_provider": "unsupported-provider"},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError):
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

    def test_accepts_openai_default_provider_when_enabled(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openai",
                "providers": {"openai": {"enabled": True}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("openai", selection.provider)
        self.assertEqual("default_provider", selection.selection_source)

    def test_agent_metadata_provider_is_respected_when_enabled(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "mock",
                "providers": {"openrouter": {"enabled": True}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )
        agent_spec = AgentSpec(
            agent_id="h1_single_agent",
            role="h1.single",
            metadata={"provider": "openrouter"},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=agent_spec)

        self.assertEqual("openrouter", selection.provider)
        self.assertEqual("agent_metadata", selection.selection_source)

    def test_accepts_conservative_mock_fallback_policy(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openrouter",
                "routing": {"fallback_policy": "conservative_mock"},
                "providers": {"openrouter": {"enabled": True}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("conservative_mock", selection.fallback_policy)

    def test_rejects_unknown_fallback_policy(self) -> None:
        router = ProviderRouter(
            providers_config={"routing": {"fallback_policy": "always_mock"}},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError):
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)


class ProviderOverridePolicyTests(unittest.TestCase):
    def test_apply_provider_override_accepts_openrouter_and_enables_it(self) -> None:
        providers_config: dict[str, object] = {}

        apply_provider_override(providers_config, "OpenRouter")

        self.assertEqual("openrouter", providers_config["default_provider"])
        providers_block = providers_config["providers"]
        self.assertTrue(providers_block["openrouter"]["enabled"])

    def test_apply_provider_override_accepts_mock_without_force_enabling_others(self) -> None:
        providers_config: dict[str, object] = {}

        apply_provider_override(providers_config, "mock")

        self.assertEqual("mock", providers_config["default_provider"])
        self.assertEqual({}, providers_config["providers"])

    def test_apply_provider_override_rejects_unsupported_provider(self) -> None:
        providers_config: dict[str, object] = {}

        with self.assertRaises(ValueError):
            apply_provider_override(providers_config, "local")

    def test_apply_provider_override_accepts_openai_and_enables_it(self) -> None:
        providers_config: dict[str, object] = {}

        apply_provider_override(providers_config, "OpenAI")

        self.assertEqual("openai", providers_config["default_provider"])
        providers_block = providers_config["providers"]
        self.assertTrue(providers_block["openai"]["enabled"])


if __name__ == "__main__":
    unittest.main()
