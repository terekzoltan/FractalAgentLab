from __future__ import annotations

import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_single_agent_pack
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import H1_SINGLE_STEP_ID, H1_SINGLE_WORKFLOW_ID, build_h1_single_workflow_spec


class H1SingleStepRunnerTests(unittest.TestCase):
    def test_h1_single_workflow_runs_end_to_end_on_mock(self) -> None:
        workflow = build_h1_single_workflow_spec()
        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=build_h1_single_agent_pack(),
                providers_config={"default_provider": "mock"},
                model_policy_config={
                    "tier_defaults": {
                        "finalizer": "gpt-5.4-mini",
                    },
                },
            ),
        )

        run_state = executor.execute(
            workflow=workflow,
            input_payload={"idea": "AI founder copilot for idea refinement"},
        )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        self.assertEqual(H1_SINGLE_WORKFLOW_ID, run_state.workflow_id)
        self.assertIn(H1_SINGLE_STEP_ID, run_state.step_results)

        output_payload = run_state.output_payload or {}
        step_results = output_payload.get("step_results", {})
        self.assertIn(H1_SINGLE_STEP_ID, step_results)

        single_output = step_results[H1_SINGLE_STEP_ID]["output"]
        self.assertIn("clarified_idea", single_output)
        self.assertIn("weak_points", single_output)
        self.assertIn("recommended_mvp_direction", single_output)


if __name__ == "__main__":
    unittest.main()
