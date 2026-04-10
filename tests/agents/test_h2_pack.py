from __future__ import annotations

import unittest

from fractal_agent_lab.agents import H2_PROMPT_VERSION, build_h2_agent_pack, validate_h2_agent_specs
from fractal_agent_lab.core.contracts import AgentSpec


class H2PackTests(unittest.TestCase):
    def test_h2_pack_contains_expected_roles_and_prompt_metadata(self) -> None:
        pack = build_h2_agent_pack()

        self.assertEqual(5, len(pack))
        roles = {spec.role for spec in pack.values()}
        self.assertEqual(
            {"h2.intake", "h2.planner", "h2.architect", "h2.critic", "h2.synthesizer"},
            roles,
        )

        synthesizer = pack["h2_synthesizer_agent"]
        self.assertEqual("finalizer", synthesizer.model_policy_ref)
        self.assertEqual([], synthesizer.handoff_targets)
        self.assertEqual("h2/synthesizer/v1", synthesizer.metadata["prompt_version"])
        self.assertEqual(H2_PROMPT_VERSION, synthesizer.metadata["pack_prompt_version"])

        architect = pack["h2_architect_agent"]
        self.assertEqual("specialist", architect.model_policy_ref)
        self.assertEqual("h2/architect/v1", architect.metadata["prompt_version"])

        for spec in pack.values():
            self.assertEqual([], spec.handoff_targets)
            self.assertEqual(H2_PROMPT_VERSION, spec.metadata.get("pack_prompt_version"))

    def test_h2_pack_rejects_unexpected_extra_agent_spec(self) -> None:
        pack = build_h2_agent_pack()
        pack["h2_shadow_agent"] = AgentSpec(
            agent_id="h2_shadow_agent",
            role="h2.shadow",
            instructions="shadow",
            model_policy_ref="specialist",
            metadata={
                "prompt_version": "h2/shadow/v1",
                "pack_prompt_version": H2_PROMPT_VERSION,
            },
        )

        with self.assertRaisesRegex(ValueError, "Unexpected H2 agent specs"):
            validate_h2_agent_specs(pack)


if __name__ == "__main__":
    unittest.main()
