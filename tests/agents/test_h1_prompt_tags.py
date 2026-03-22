from __future__ import annotations

import unittest

from fractal_agent_lab.agents import (
    build_h1_agent_pack,
    build_h1_handoff_agent_pack,
    build_h1_prompt_tags,
    build_h1_single_agent_pack,
)
from fractal_agent_lab.workflows import (
    build_h1_handoff_workflow_spec,
    build_h1_manager_workflow_spec,
    build_h1_single_workflow_spec,
)


class H1PromptTagsTests(unittest.TestCase):
    def test_manager_prompt_tags_include_pack_role_and_executed_versions(self) -> None:
        workflow = build_h1_manager_workflow_spec()
        tags = build_h1_prompt_tags(
            workflow=workflow,
            agent_specs_by_id=build_h1_agent_pack(),
            step_results={"synthesizer": {}, "intake": {}, "planner": {}, "critic": {}},
        )

        assert tags is not None
        self.assertEqual("manager", tags["variant"])
        self.assertEqual("h1.prompt.v1", tags["pack_prompt_version"])
        self.assertEqual("h1/intake/v1", tags["role_prompt_versions"]["intake"])
        self.assertEqual(
            "h1/synthesizer/v1",
            tags["executed_step_prompt_versions"]["synthesizer"],
        )

    def test_handoff_prompt_tags_use_handoff_versions(self) -> None:
        workflow = build_h1_handoff_workflow_spec()
        tags = build_h1_prompt_tags(
            workflow=workflow,
            agent_specs_by_id=build_h1_handoff_agent_pack(),
            step_results={"intake": {}, "planner": {}, "critic": {}, "synthesizer": {}},
        )

        assert tags is not None
        self.assertEqual("handoff", tags["variant"])
        self.assertEqual("h1.handoff.prompt.v1", tags["pack_prompt_version"])
        self.assertEqual(
            "h1/handoff/critic/v1",
            tags["role_prompt_versions"]["critic"],
        )

    def test_single_prompt_tags_only_report_single_role(self) -> None:
        workflow = build_h1_single_workflow_spec()
        tags = build_h1_prompt_tags(
            workflow=workflow,
            agent_specs_by_id=build_h1_single_agent_pack(),
            step_results={"single": {}},
        )

        assert tags is not None
        self.assertEqual("single", tags["variant"])
        self.assertEqual("h1.single.prompt.v1", tags["pack_prompt_version"])
        self.assertEqual({"single": "h1/single/v1"}, tags["role_prompt_versions"])


if __name__ == "__main__":
    unittest.main()
