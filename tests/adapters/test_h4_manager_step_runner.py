from __future__ import annotations

import unittest
from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec, list_workflow_ids
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import H4_WAVE_START_WORKFLOW_ID


EXPECTED_H4_FINAL_OUTPUT_KEYS = [
    "repo_summary",
    "changed_surfaces",
    "relevant_docs",
    "relevant_code_areas",
    "likely_touched_files",
    "assumptions",
    "unknowns",
    "recent_change_notes",
    "current_frontier",
    "blockers_or_holds",
    "shared_zone_cautions",
    "sequencing_risks",
    "non_goals",
    "next_recommended_action",
]


class H4ManagerStepRunnerTests(unittest.TestCase):
    def test_h4_wave_start_workflow_is_registered_and_runnable_with_default_mock_path(self) -> None:
        workflow_ids = list_workflow_ids()
        self.assertIn(H4_WAVE_START_WORKFLOW_ID, workflow_ids)

        workflow = get_workflow_spec(H4_WAVE_START_WORKFLOW_ID)
        agent_specs = get_workflow_agent_specs(H4_WAVE_START_WORKFLOW_ID)

        step_runner = build_step_runner(
            agent_specs_by_id=agent_specs,
            providers_config={"default_provider": "mock"},
            model_policy_config={
                "tier_defaults": {
                    "specialist": "gpt-5.4-nano",
                    "finalizer": "gpt-5.4-mini",
                },
            },
        )
        executor = WorkflowExecutor(step_runner=step_runner)

        run_state = executor.execute(
            workflow=workflow,
            input_payload={"goal": "Open CV1-A with repo-aware intake"},
        )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        self.assertEqual(H4_WAVE_START_WORKFLOW_ID, run_state.workflow_id)
        self.assertIn("synthesizer", run_state.step_results)
        self.assertIn("repo_intake", run_state.step_results)
        self.assertIn("architect_critic", run_state.step_results)

        output_payload = run_state.output_payload or {}
        self.assertIn("manager_orchestration", output_payload)
        self.assertIn("final_output", output_payload)

        turns = output_payload["manager_orchestration"]["turns"]
        self.assertEqual(["delegate", "delegate", "finalize"], [turn["action"] for turn in turns])
        self.assertEqual(["repo_intake", "architect_critic"], [turn.get("target_step_id") for turn in turns[:2]])

        final_output = output_payload["final_output"]
        self.assertEqual(EXPECTED_H4_FINAL_OUTPUT_KEYS, list(final_output.keys()))
        self.assertTrue(final_output["repo_summary"])
        self.assertTrue(final_output["unknowns"])
        self.assertTrue(final_output["next_recommended_action"])


if __name__ == "__main__":
    unittest.main()
