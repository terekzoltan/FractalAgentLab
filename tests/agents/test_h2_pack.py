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
        self.assertEqual("h2/synthesizer/v2", synthesizer.metadata["prompt_version"])
        self.assertEqual(H2_PROMPT_VERSION, synthesizer.metadata["pack_prompt_version"])

        planner = pack["h2_planner_agent"]
        self.assertEqual("h2/planner/v2", planner.metadata["prompt_version"])

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

    def test_h2_pack_rejects_noncanonical_role_for_required_agent(self) -> None:
        pack = build_h2_agent_pack()
        planner = pack["h2_planner_agent"]
        planner.role = "h2.shadow"

        with self.assertRaisesRegex(ValueError, "must use canonical H2 role 'h2.planner'"):
            validate_h2_agent_specs(pack)

    def test_h2_pack_rejects_wrong_prompt_version_for_required_agent(self) -> None:
        pack = build_h2_agent_pack()
        planner = pack["h2_planner_agent"]
        planner.metadata["prompt_version"] = "h2/planner/v1"

        with self.assertRaisesRegex(ValueError, "must use prompt_version 'h2/planner/v2'"):
            validate_h2_agent_specs(pack)


if __name__ == "__main__":
    unittest.main()
