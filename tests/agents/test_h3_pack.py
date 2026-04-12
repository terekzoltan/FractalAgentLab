from __future__ import annotations

import unittest

from fractal_agent_lab.agents import H3_PROMPT_VERSION, build_h3_agent_pack, validate_h3_agent_specs
from fractal_agent_lab.core.contracts import AgentSpec


class H3PackTests(unittest.TestCase):
    def test_h3_pack_contains_expected_roles_and_prompt_metadata(self) -> None:
        pack = build_h3_agent_pack()

        self.assertEqual(5, len(pack))
        roles = {spec.role for spec in pack.values()}
        self.assertEqual(
            {"h3.intake", "h3.planner", "h3.systems", "h3.critic", "h3.synthesizer"},
            roles,
        )

        synthesizer = pack["h3_synthesizer_agent"]
        self.assertEqual("finalizer", synthesizer.model_policy_ref)
        self.assertEqual([], synthesizer.handoff_targets)
        self.assertEqual("h3/synthesizer/v1", synthesizer.metadata["prompt_version"])
        self.assertEqual(H3_PROMPT_VERSION, synthesizer.metadata["pack_prompt_version"])

        systems = pack["h3_systems_agent"]
        self.assertEqual("specialist", systems.model_policy_ref)
        self.assertEqual("h3/systems/v1", systems.metadata["prompt_version"])

        intake = pack["h3_intake_agent"]
        self.assertEqual("cheap_worker", intake.model_policy_ref)

        for spec in pack.values():
            self.assertEqual([], spec.handoff_targets)
            self.assertEqual(H3_PROMPT_VERSION, spec.metadata.get("pack_prompt_version"))

    def test_h3_pack_rejects_unexpected_extra_agent_spec(self) -> None:
        pack = build_h3_agent_pack()
        pack["h3_shadow_agent"] = AgentSpec(
            agent_id="h3_shadow_agent",
            role="h3.shadow",
            instructions="shadow",
            model_policy_ref="specialist",
            metadata={
                "prompt_version": "h3/shadow/v1",
                "pack_prompt_version": H3_PROMPT_VERSION,
            },
        )

        with self.assertRaisesRegex(ValueError, "Unexpected H3 agent specs"):
            validate_h3_agent_specs(pack)

    def test_h3_pack_rejects_noncanonical_role_for_required_agent(self) -> None:
        pack = build_h3_agent_pack()
        systems = pack["h3_systems_agent"]
        systems.role = "h3.architect"

        with self.assertRaisesRegex(ValueError, "must use canonical H3 role 'h3.systems'"):
            validate_h3_agent_specs(pack)

    def test_h3_pack_rejects_wrong_prompt_version_for_required_agent(self) -> None:
        pack = build_h3_agent_pack()
        planner = pack["h3_planner_agent"]
        planner.metadata["prompt_version"] = "h3/planner/v0"

        with self.assertRaisesRegex(ValueError, "must use prompt_version 'h3/planner/v1'"):
            validate_h3_agent_specs(pack)


if __name__ == "__main__":
    unittest.main()
