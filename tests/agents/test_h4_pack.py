from __future__ import annotations

import unittest

from fractal_agent_lab.agents import (
    H4_SEQ_NEXT_PROMPT_VERSION,
    H4_WAVE_START_PROMPT_VERSION,
    build_h4_seq_next_agent_pack,
    build_h4_wave_start_agent_pack,
    validate_h4_seq_next_agent_specs,
    validate_h4_wave_start_agent_specs,
)
from fractal_agent_lab.core.contracts import AgentSpec


class H4WaveStartPackTests(unittest.TestCase):
    def test_h4_wave_start_pack_contains_expected_roles_and_prompt_metadata(self) -> None:
        pack = build_h4_wave_start_agent_pack()

        self.assertEqual(3, len(pack))
        roles = {spec.role for spec in pack.values()}
        self.assertEqual({"h4.repo_intake", "h4.architect_critic", "h4.synthesizer"}, roles)

        synthesizer = pack["h4_synthesizer_agent"]
        self.assertEqual("finalizer", synthesizer.model_policy_ref)
        self.assertEqual("h4/synthesizer/v1", synthesizer.metadata["prompt_version"])

        for spec in pack.values():
            self.assertEqual([], spec.handoff_targets)
            self.assertEqual(H4_WAVE_START_PROMPT_VERSION, spec.metadata.get("pack_prompt_version"))

    def test_h4_wave_start_pack_rejects_unexpected_extra_agent_spec(self) -> None:
        pack = build_h4_wave_start_agent_pack()
        pack["h4_shadow_agent"] = AgentSpec(
            agent_id="h4_shadow_agent",
            role="h4.shadow",
            instructions="shadow",
            model_policy_ref="specialist",
            metadata={
                "prompt_version": "h4/shadow/v1",
                "pack_prompt_version": H4_WAVE_START_PROMPT_VERSION,
            },
        )

        with self.assertRaisesRegex(ValueError, "Unexpected H4 wave_start agent specs"):
            validate_h4_wave_start_agent_specs(pack)


class H4SeqNextPackTests(unittest.TestCase):
    def test_h4_seq_next_pack_contains_expected_roles_and_prompt_metadata(self) -> None:
        pack = build_h4_seq_next_agent_pack()

        self.assertEqual(4, len(pack))
        roles = {spec.role for spec in pack.values()}
        self.assertEqual({"h4.repo_intake", "h4.planner", "h4.architect_critic", "h4.synthesizer"}, roles)

        planner = pack["h4_planner_agent"]
        self.assertEqual("specialist", planner.model_policy_ref)
        self.assertEqual("h4/planner/v1", planner.metadata["prompt_version"])

        synthesizer = pack["h4_synthesizer_agent"]
        self.assertEqual("finalizer", synthesizer.model_policy_ref)
        self.assertEqual("h4/synthesizer/v2", synthesizer.metadata["prompt_version"])

        for spec in pack.values():
            self.assertEqual([], spec.handoff_targets)
            self.assertEqual(H4_SEQ_NEXT_PROMPT_VERSION, spec.metadata.get("pack_prompt_version"))

    def test_h4_seq_next_pack_rejects_unexpected_extra_agent_spec(self) -> None:
        pack = build_h4_seq_next_agent_pack()
        pack["h4_shadow_agent"] = AgentSpec(
            agent_id="h4_shadow_agent",
            role="h4.shadow",
            instructions="shadow",
            model_policy_ref="specialist",
            metadata={
                "prompt_version": "h4/shadow/v1",
                "pack_prompt_version": H4_SEQ_NEXT_PROMPT_VERSION,
            },
        )

        with self.assertRaisesRegex(ValueError, "Unexpected H4 seq_next agent specs"):
            validate_h4_seq_next_agent_specs(pack)

    def test_h4_seq_next_pack_rejects_wrong_prompt_version_for_planner(self) -> None:
        pack = build_h4_seq_next_agent_pack()
        pack["h4_planner_agent"].metadata["prompt_version"] = "h4/planner/v0"

        with self.assertRaisesRegex(ValueError, "must use prompt_version 'h4/planner/v1'"):
            validate_h4_seq_next_agent_specs(pack)


if __name__ == "__main__":
    unittest.main()
