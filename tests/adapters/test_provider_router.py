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

    def test_mock_default_allows_missing_mock_provider_entry(self) -> None:
        router = ProviderRouter(
            providers_config={"default_provider": "mock", "providers": {}},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("mock", selection.provider)
        self.assertEqual("default_provider", selection.selection_source)

    def test_mock_default_allows_missing_enabled_key(self) -> None:
        router = ProviderRouter(
            providers_config={"default_provider": "mock", "providers": {"mock": {}}},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("mock", selection.provider)
        self.assertEqual("default_provider", selection.selection_source)

    def test_mock_default_allows_boolean_false_enabled(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "mock",
                "providers": {"mock": {"enabled": False}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("mock", selection.provider)
        self.assertEqual("default_provider", selection.selection_source)

    def test_rejects_non_boolean_enabled_for_mock_default_provider(self) -> None:
        malformed_values = ["false", "true", 1, 0, None]

        for malformed_value in malformed_values:
            with self.subTest(enabled=malformed_value):
                router = ProviderRouter(
                    providers_config={
                        "default_provider": "mock",
                        "providers": {"mock": {"enabled": malformed_value}},
                    },
                    model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
                )

                with self.assertRaises(RuntimeBoundaryError) as raised:
                    router.resolve(workflow_id="h1.single.v1", agent_spec=None)

                self.assertEqual("mock", raised.exception.details["provider"])
                self.assertEqual("providers.mock.enabled", raised.exception.details["config_key"])
                self.assertEqual(type(malformed_value).__name__, raised.exception.details["value_type"])

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

    def test_accepts_local_default_provider_when_enabled(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "local",
                "providers": {"local": {"enabled": True}},
            },
            model_policy_config={"tier_defaults": {"specialist": "local/test-model"}},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("local", selection.provider)
        self.assertEqual("local/test-model", selection.model)
        self.assertEqual("default_provider", selection.selection_source)

    def test_rejects_disabled_local_default_provider(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "local",
                "providers": {"local": {"enabled": False}},
            },
            model_policy_config={"tier_defaults": {"specialist": "local/test-model"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("local", raised.exception.details["provider"])

    def test_missing_enabled_key_keeps_explicit_provider_disabled(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openrouter",
                "providers": {"openrouter": {}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("openrouter", raised.exception.details["provider"])
        self.assertEqual("default_provider", raised.exception.details["source"])
        self.assertNotIn("config_key", raised.exception.details)

    def test_rejects_non_boolean_enabled_for_default_provider(self) -> None:
        malformed_values = ["false", "true", 1, 0, None]
        provider_models = {
            "openrouter": "openrouter/test-model",
            "local": "local/test-model",
        }

        for provider, model in provider_models.items():
            for malformed_value in malformed_values:
                with self.subTest(provider=provider, enabled=malformed_value):
                    router = ProviderRouter(
                        providers_config={
                            "default_provider": provider,
                            "providers": {provider: {"enabled": malformed_value}},
                        },
                        model_policy_config={"tier_defaults": {"specialist": model}},
                    )

                    with self.assertRaises(RuntimeBoundaryError) as raised:
                        router.resolve(workflow_id="h1.single.v1", agent_spec=None)

                    self.assertEqual(provider, raised.exception.details["provider"])
                    self.assertEqual(f"providers.{provider}.enabled", raised.exception.details["config_key"])
                    self.assertEqual(type(malformed_value).__name__, raised.exception.details["value_type"])

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

    def test_rejects_non_boolean_enabled_for_agent_metadata_provider(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "mock",
                "providers": {"openrouter": {"enabled": "false"}},
            },
            model_policy_config={"tier_defaults": {"specialist": "openrouter/test-model"}},
        )
        agent_spec = AgentSpec(
            agent_id="h1_single_agent",
            role="h1.single",
            metadata={"provider": "openrouter"},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=agent_spec)

        self.assertEqual("openrouter", raised.exception.details["provider"])
        self.assertEqual("providers.openrouter.enabled", raised.exception.details["config_key"])
        self.assertEqual("str", raised.exception.details["value_type"])

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

    def test_rejects_conservative_mock_for_openai_provider(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openai",
                "routing": {"fallback_policy": "conservative_mock"},
                "providers": {"openai": {"enabled": True}},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("openai", raised.exception.details["provider"])
        self.assertEqual("conservative_mock", raised.exception.details["fallback_policy"])

    def test_rejects_conservative_mock_for_mock_provider(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "mock",
                "routing": {"fallback_policy": "conservative_mock"},
            },
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("mock", raised.exception.details["provider"])
        self.assertEqual("openrouter -> mock", raised.exception.details["supported_fallback_route"])

    def test_rejects_conservative_mock_for_local_provider(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "local",
                "routing": {"fallback_policy": "conservative_mock"},
                "providers": {"local": {"enabled": True}},
            },
            model_policy_config={"tier_defaults": {"specialist": "local/test-model"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("local", raised.exception.details["provider"])
        self.assertEqual("openrouter -> mock", raised.exception.details["supported_fallback_route"])

    def test_rejects_unknown_fallback_policy(self) -> None:
        router = ProviderRouter(
            providers_config={"routing": {"fallback_policy": "always_mock"}},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError):
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

    def test_rejects_malformed_routing_block_via_resolve(self) -> None:
        router = ProviderRouter(
            providers_config={"routing": "not-a-mapping"},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("routing", raised.exception.details["config_key"])

    def test_rejects_malformed_providers_block_via_resolve(self) -> None:
        router = ProviderRouter(
            providers_config={"providers": "not-a-mapping"},
            model_policy_config={"tier_defaults": {"specialist": "gpt-5.4-mini"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("providers", raised.exception.details["config_key"])

    def test_rejects_malformed_tier_defaults_via_resolve(self) -> None:
        router = ProviderRouter(
            providers_config={"default_provider": "mock"},
            model_policy_config={"tier_defaults": "not-a-mapping"},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("tier_defaults", raised.exception.details["config_key"])

    def test_rejects_malformed_workflow_overrides_via_resolve(self) -> None:
        router = ProviderRouter(
            providers_config={"default_provider": "mock"},
            model_policy_config={"workflow_overrides": "not-a-mapping"},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("workflow_overrides", raised.exception.details["config_key"])

    def test_rejects_malformed_workflow_override_entry_via_resolve(self) -> None:
        router = ProviderRouter(
            providers_config={"default_provider": "mock"},
            model_policy_config={"workflow_overrides": {"h1.single.v1": "not-a-mapping"}},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("h1.single.v1", raised.exception.details["workflow_id"])

    def test_rejects_openai_without_resolved_model(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openai",
                "providers": {"openai": {"enabled": True}},
            },
            model_policy_config={},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("openai", raised.exception.details["provider"])
        self.assertEqual("specialist", raised.exception.details["model_policy_ref"])

    def test_rejects_openrouter_without_resolved_model(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "openrouter",
                "providers": {"openrouter": {"enabled": True}},
            },
            model_policy_config={},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("openrouter", raised.exception.details["provider"])

    def test_rejects_local_without_resolved_model(self) -> None:
        router = ProviderRouter(
            providers_config={
                "default_provider": "local",
                "providers": {"local": {"enabled": True}},
            },
            model_policy_config={},
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("local", raised.exception.details["provider"])

    def test_mock_provider_allows_missing_model(self) -> None:
        router = ProviderRouter(
            providers_config={"default_provider": "mock"},
            model_policy_config={},
        )

        selection = router.resolve(workflow_id="h1.single.v1", agent_spec=None)

        self.assertEqual("mock", selection.provider)
        self.assertIsNone(selection.model)


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
            apply_provider_override(providers_config, "unsupported-provider")

    def test_apply_provider_override_accepts_local_and_enables_it(self) -> None:
        providers_config: dict[str, object] = {}

        apply_provider_override(providers_config, "Local")

        self.assertEqual("local", providers_config["default_provider"])
        providers_block = providers_config["providers"]
        self.assertTrue(providers_block["local"]["enabled"])

    def test_apply_provider_override_accepts_openai_and_enables_it(self) -> None:
        providers_config: dict[str, object] = {}

        apply_provider_override(providers_config, "OpenAI")

        self.assertEqual("openai", providers_config["default_provider"])
        providers_block = providers_config["providers"]
        self.assertTrue(providers_block["openai"]["enabled"])

    def test_apply_provider_override_rejects_malformed_providers_block_for_openai(self) -> None:
        providers_config: dict[str, object] = {"providers": "not-a-mapping"}

        with self.assertRaises(ValueError) as raised:
            apply_provider_override(providers_config, "openai")

        self.assertIn("providers.providers must be a mapping", str(raised.exception))
        self.assertEqual("not-a-mapping", providers_config["providers"])

    def test_apply_provider_override_rejects_malformed_providers_block_for_openrouter(self) -> None:
        providers_config: dict[str, object] = {"providers": "not-a-mapping"}

        with self.assertRaises(ValueError) as raised:
            apply_provider_override(providers_config, "openrouter")

        self.assertIn("providers.providers must be a mapping", str(raised.exception))
        self.assertEqual("not-a-mapping", providers_config["providers"])


if __name__ == "__main__":
    unittest.main()
