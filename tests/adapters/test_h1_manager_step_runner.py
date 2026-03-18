from __future__ import annotations

import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_agent_pack
from fractal_agent_lab.core.errors import StepExecutionError
from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import H1_WORKFLOW_ID, build_h1_manager_workflow_spec


class H1ManagerStepRunnerTests(unittest.TestCase):
    def test_h1_manager_workflow_runs_end_to_end_on_mock(self) -> None:
        workflow = build_h1_manager_workflow_spec()
        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=build_h1_agent_pack(),
                providers_config={"default_provider": "mock"},
                model_policy_config={
                    "tier_defaults": {
                        "cheap_worker": "gpt-4o-mini",
                        "specialist": "gpt-5.4-nano",
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
        self.assertEqual(H1_WORKFLOW_ID, run_state.workflow_id)
        self.assertIn("synthesizer", run_state.step_results)
        self.assertIn("intake", run_state.step_results)
        self.assertIn("planner", run_state.step_results)
        self.assertIn("critic", run_state.step_results)

        output_payload = run_state.output_payload or {}
        self.assertIn("manager_orchestration", output_payload)
        self.assertIn("final_output", output_payload)
        self.assertIn("clarified_idea", output_payload["final_output"])

    def test_planner_fails_without_intake_context(self) -> None:
        workflow = build_h1_manager_workflow_spec()
        step_runner = build_step_runner(
            agent_specs_by_id=build_h1_agent_pack(),
            providers_config={"default_provider": "mock"},
            model_policy_config={
                "tier_defaults": {
                    "cheap_worker": "gpt-4o-mini",
                    "specialist": "gpt-5.4-nano",
                    "finalizer": "gpt-5.4-mini",
                },
            },
        )
        run_state = RunState(
            run_id="run-missing-intake",
            workflow_id=workflow.workflow_id,
            input_payload={"idea": "AI founder copilot for idea refinement"},
        )

        planner_step = _step_by_id(workflow, "planner")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=planner_step)

        self.assertIn("requires upstream step 'intake'", str(raised.exception))

    def test_critic_fails_without_planner_context(self) -> None:
        workflow = build_h1_manager_workflow_spec()
        step_runner = build_step_runner(
            agent_specs_by_id=build_h1_agent_pack(),
            providers_config={"default_provider": "mock"},
            model_policy_config={
                "tier_defaults": {
                    "cheap_worker": "gpt-4o-mini",
                    "specialist": "gpt-5.4-nano",
                    "finalizer": "gpt-5.4-mini",
                },
            },
        )
        run_state = RunState(
            run_id="run-missing-planner",
            workflow_id=workflow.workflow_id,
            input_payload={"idea": "AI founder copilot for idea refinement"},
            context={
                "step_results": {
                    "intake": {
                        "output": {
                            "idea_summary": "AI founder copilot for idea refinement",
                        },
                    },
                },
            },
        )
        run_state.step_results["intake"] = {
            "output": {"idea_summary": "AI founder copilot for idea refinement"},
        }

        critic_step = _step_by_id(workflow, "critic")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=critic_step)

        self.assertIn("requires upstream step 'planner'", str(raised.exception))


def _step_by_id(workflow, step_id: str):
    for step in workflow.steps:
        if step.step_id == step_id:
            return step
    raise AssertionError(f"Missing step '{step_id}' in workflow.")


if __name__ == "__main__":
    unittest.main()
