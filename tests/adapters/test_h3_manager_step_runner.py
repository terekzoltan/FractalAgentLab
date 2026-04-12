from __future__ import annotations

import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec, list_workflow_ids
from fractal_agent_lab.core.errors import StepExecutionError
from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import H3_WORKFLOW_ID


H3_RUNNABLE_DEFAULT_KEYS = [
    "strengths",
    "bottlenecks",
    "merge_risks",
    "refactor_ideas",
]


class H3ManagerStepRunnerTests(unittest.TestCase):
    def test_h3_manager_workflow_is_registered_and_runnable_on_mock(self) -> None:
        workflow_ids = list_workflow_ids()
        self.assertIn(H3_WORKFLOW_ID, workflow_ids)

        workflow = get_workflow_spec(H3_WORKFLOW_ID)
        agent_specs = get_workflow_agent_specs(H3_WORKFLOW_ID)

        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=agent_specs,
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
            input_payload={"goal": "Review architecture boundaries"},
        )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        self.assertEqual(H3_WORKFLOW_ID, run_state.workflow_id)
        self.assertIn("synthesizer", run_state.step_results)
        self.assertIn("intake", run_state.step_results)
        self.assertIn("planner", run_state.step_results)
        self.assertIn("systems", run_state.step_results)
        self.assertIn("critic", run_state.step_results)

        output_payload = run_state.output_payload or {}
        self.assertIn("manager_orchestration", output_payload)
        self.assertIn("final_output", output_payload)

        turns = output_payload["manager_orchestration"]["turns"]
        actions = [turn["action"] for turn in turns]
        self.assertEqual(["delegate", "delegate", "delegate", "delegate", "finalize"], actions)

        delegate_targets = [turn.get("target_step_id") for turn in turns[:4]]
        self.assertEqual(["intake", "planner", "systems", "critic"], delegate_targets)

        reasons = [turn.get("reason") for turn in turns]
        self.assertEqual(
            [
                "missing_intake_output",
                "missing_planner_output",
                "missing_systems_output",
                "missing_critic_output",
                "all_workers_completed",
            ],
            reasons,
        )

        final_output = output_payload["final_output"]
        self.assertIsInstance(final_output, dict)
        self.assertEqual(set(H3_RUNNABLE_DEFAULT_KEYS), set(final_output))
        for key in H3_RUNNABLE_DEFAULT_KEYS:
            value = final_output.get(key)
            self.assertIsInstance(value, list)
            assert isinstance(value, list)
            self.assertTrue(value, f"Runnable H3 review bucket '{key}' must be non-empty.")

    def test_planner_fails_without_intake_context(self) -> None:
        workflow = get_workflow_spec(H3_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H3_WORKFLOW_ID),
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
            run_id="run-h3-missing-intake",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Review architecture boundaries"},
        )

        planner_step = _step_by_id(workflow, "planner")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=planner_step)

        self.assertIn("requires upstream step 'intake'", str(raised.exception))

    def test_systems_fails_without_planner_context(self) -> None:
        workflow = get_workflow_spec(H3_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H3_WORKFLOW_ID),
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
            run_id="run-h3-missing-planner",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Review architecture boundaries"},
            context={
                "step_results": {
                    "intake": {
                        "output": {
                            "review_scope": "Review architecture boundaries",
                        },
                    },
                },
            },
        )
        run_state.step_results["intake"] = {
            "output": {"review_scope": "Review architecture boundaries"},
        }

        systems_step = _step_by_id(workflow, "systems")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=systems_step)

        self.assertIn("requires upstream step 'planner'", str(raised.exception))

    def test_critic_fails_without_systems_context(self) -> None:
        workflow = get_workflow_spec(H3_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H3_WORKFLOW_ID),
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
            run_id="run-h3-missing-systems",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Review architecture boundaries"},
            context={
                "step_results": {
                    "intake": {
                        "output": {
                            "review_scope": "Review architecture boundaries",
                        },
                    },
                    "planner": {
                        "output": {
                            "review_sequence": ["workflow_specs"],
                        },
                    },
                },
            },
        )
        run_state.step_results["intake"] = {
            "output": {"review_scope": "Review architecture boundaries"},
        }
        run_state.step_results["planner"] = {
            "output": {"review_sequence": ["workflow_specs"]},
        }

        critic_step = _step_by_id(workflow, "critic")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=critic_step)

        self.assertIn("requires upstream step 'systems'", str(raised.exception))

    def test_synthesizer_fails_when_systems_strengths_is_not_list(self) -> None:
        workflow = get_workflow_spec(H3_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H3_WORKFLOW_ID),
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
            run_id="run-h3-malformed-systems-strengths",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Review architecture boundaries"},
            context={
                "step_results": {
                    "intake": {
                        "output": {
                            "review_scope": "Review architecture boundaries",
                        },
                    },
                    "planner": {
                        "output": {
                            "review_sequence": ["runtime_boundaries"],
                        },
                    },
                    "systems": {
                        "output": {
                            "architectural_strengths": "not-a-list",
                        },
                    },
                    "critic": {
                        "output": {
                            "bottlenecks": ["status drift"],
                            "merge_risks": ["early freeze"],
                            "refactor_candidates": ["shared review helper"],
                        },
                    },
                },
            },
        )
        run_state.step_results = dict(run_state.context.get("step_results", {}))

        synthesizer_step = _step_by_id(workflow, "synthesizer")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=synthesizer_step)

        self.assertIn("requires non-empty list field 'architectural_strengths'", str(raised.exception))


def _step_by_id(workflow, step_id: str):
    for step in workflow.steps:
        if step.step_id == step_id:
            return step
    raise AssertionError(f"Missing step '{step_id}' in workflow.")


if __name__ == "__main__":
    unittest.main()
