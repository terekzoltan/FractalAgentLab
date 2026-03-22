from __future__ import annotations

import unittest

from fractal_agent_lab.agents import (
    H1_PROMPT_VERSION,
    H1_SINGLE_AGENT_ID,
    build_h1_agent_pack,
    build_h1_single_agent_pack,
)


class H1PackTests(unittest.TestCase):
    def test_h1_pack_contains_expected_roles_and_prompt_metadata(self) -> None:
        pack = build_h1_agent_pack()

        self.assertEqual(4, len(pack))
        roles = {spec.role for spec in pack.values()}
        self.assertEqual(
            {"h1.intake", "h1.planner", "h1.critic", "h1.synthesizer"},
            roles,
        )

        synthesizer = pack["h1_synthesizer_agent"]
        self.assertEqual("finalizer", synthesizer.model_policy_ref)
        self.assertEqual(
            {"h1_intake_agent", "h1_planner_agent", "h1_critic_agent"},
            set(synthesizer.handoff_targets),
        )
        self.assertEqual("h1/synthesizer/v1", synthesizer.metadata["prompt_version"])
        self.assertEqual(H1_PROMPT_VERSION, synthesizer.metadata["pack_prompt_version"])

        for spec in pack.values():
            self.assertEqual(H1_PROMPT_VERSION, spec.metadata.get("pack_prompt_version"))

    def test_h1_single_agent_pack_has_expected_shape(self) -> None:
        pack = build_h1_single_agent_pack()

        self.assertEqual({H1_SINGLE_AGENT_ID}, set(pack))
        single = pack[H1_SINGLE_AGENT_ID]
        self.assertEqual("h1.single", single.role)
        self.assertEqual("finalizer", single.model_policy_ref)
        self.assertEqual([], single.handoff_targets)
        self.assertEqual("h1/single/v1", single.metadata["prompt_version"])
        self.assertEqual("h1.single.prompt.v1", single.metadata["pack_prompt_version"])


if __name__ == "__main__":
    unittest.main()
