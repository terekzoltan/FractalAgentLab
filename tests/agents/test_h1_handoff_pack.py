from __future__ import annotations

import unittest

from fractal_agent_lab.agents import H1_HANDOFF_PROMPT_VERSION, build_h1_handoff_agent_pack


class H1HandoffPackTests(unittest.TestCase):
    def test_h1_handoff_pack_contains_expected_chain_and_metadata(self) -> None:
        pack = build_h1_handoff_agent_pack()

        self.assertEqual(4, len(pack))
        self.assertEqual(["h1_planner_agent"], pack["h1_intake_agent"].handoff_targets)
        self.assertEqual(["h1_critic_agent"], pack["h1_planner_agent"].handoff_targets)
        self.assertEqual(["h1_synthesizer_agent"], pack["h1_critic_agent"].handoff_targets)
        self.assertEqual([], pack["h1_synthesizer_agent"].handoff_targets)

        synthesizer = pack["h1_synthesizer_agent"]
        self.assertEqual("h1/handoff/synthesizer/v1", synthesizer.metadata["prompt_version"])
        self.assertEqual(H1_HANDOFF_PROMPT_VERSION, synthesizer.metadata["pack_prompt_version"])


if __name__ == "__main__":
    unittest.main()
