from __future__ import annotations

import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec, list_workflow_ids
from fractal_agent_lab.core.errors import StepExecutionError
from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import H2_WORKFLOW_ID


EXPECTED_H2_FINAL_OUTPUT_KEYS = [
    "project_summary",
    "tracks",
    "modules",
    "phases",
    "dependency_order",
    "implementation_waves",
    "recommended_starting_slice",
    "risk_zones",
    "open_questions",
]


class H2ManagerStepRunnerTests(unittest.TestCase):
    def test_h2_manager_workflow_is_registered_and_runnable_on_mock(self) -> None:
        workflow_ids = list_workflow_ids()
        self.assertIn(H2_WORKFLOW_ID, workflow_ids)

        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        agent_specs = get_workflow_agent_specs(H2_WORKFLOW_ID)

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
            input_payload={"goal": "Build a multi-agent project decomposition workflow"},
        )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        self.assertEqual(H2_WORKFLOW_ID, run_state.workflow_id)
        self.assertIn("synthesizer", run_state.step_results)
        self.assertIn("intake", run_state.step_results)
        self.assertIn("planner", run_state.step_results)
        self.assertIn("architect", run_state.step_results)
        self.assertIn("critic", run_state.step_results)

        output_payload = run_state.output_payload or {}
        self.assertIn("manager_orchestration", output_payload)
        self.assertIn("final_output", output_payload)

        turns = output_payload["manager_orchestration"]["turns"]
        actions = [turn["action"] for turn in turns]
        self.assertEqual(["delegate", "delegate", "delegate", "delegate", "finalize"], actions)

        delegate_targets = [turn.get("target_step_id") for turn in turns[:4]]
        self.assertEqual(["intake", "planner", "architect", "critic"], delegate_targets)

        reasons = [turn.get("reason") for turn in turns]
        self.assertEqual(
            [
                "missing_intake_output",
                "missing_planner_output",
                "missing_architect_output",
                "missing_critic_output",
                "all_workers_completed",
            ],
            reasons,
        )

        final_output = output_payload["final_output"]
        self.assertEqual(EXPECTED_H2_FINAL_OUTPUT_KEYS, list(final_output.keys()))

        implementation_waves = final_output["implementation_waves"]
        self.assertIsInstance(implementation_waves, list)
        self.assertTrue(implementation_waves)
        self.assertIsInstance(implementation_waves[0], dict)
        self.assertIn("wave", implementation_waves[0])
        self.assertIn("focus", implementation_waves[0])
        self.assertIsInstance(implementation_waves[0]["focus"], list)

    def test_planner_fails_without_intake_context(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-missing-intake",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
        )

        planner_step = _step_by_id(workflow, "planner")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=planner_step)

        self.assertIn("requires upstream step 'intake'", str(raised.exception))

    def test_architect_fails_without_planner_context(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-missing-planner",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
            context={
                "step_results": {
                    "intake": {
                        "output": {
                            "project_summary": "Build a decomposition workflow",
                        },
                    },
                },
            },
        )
        run_state.step_results["intake"] = {
            "output": {"project_summary": "Build a decomposition workflow"},
        }

        architect_step = _step_by_id(workflow, "architect")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=architect_step)

        self.assertIn("requires upstream step 'planner'", str(raised.exception))

    def test_critic_fails_without_architect_context(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-missing-architect",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
            context={
                "step_results": {
                    "intake": {
                        "output": {
                            "project_summary": "Build a decomposition workflow",
                        },
                    },
                    "planner": {
                        "output": {
                            "dependency_order": ["schema", "pack"],
                        },
                    },
                },
            },
        )
        run_state.step_results["intake"] = {
            "output": {"project_summary": "Build a decomposition workflow"},
        }
        run_state.step_results["planner"] = {
            "output": {"dependency_order": ["schema", "pack"]},
        }

        critic_step = _step_by_id(workflow, "critic")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=critic_step)

        self.assertIn("requires upstream step 'architect'", str(raised.exception))

    def test_synthesizer_fails_when_worker_output_shape_is_malformed(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-malformed-architect-output",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
            context={
                "step_results": {
                    "intake": {
                        "output": {"project_summary": "Build a decomposition workflow"},
                    },
                    "planner": {
                        "output": {
                            "dependency_order": ["schema", "pack"],
                            "implementation_waves": ["w3-s1"],
                            "recommended_starting_slice": "contracts_and_schema_alignment",
                },
            },
                    "architect": {
                        "output": {
                            "tracks": ["core", "workflow"],
                            "modules": ["workflows", "agents"],
                            "phases": ["contract", "pack"],
                        },
                    },
                    "critic": {
                        "output": {
                            "risk_zones": ["scope_sprawl"],
                            "open_questions": ["What final output ordering should freeze in R3-C?"],
                        },
                    },
                },
            },
        )
        run_state.step_results["intake"] = {
            "output": {"project_summary": "Build a decomposition workflow"},
        }
        run_state.step_results["planner"] = {
            "output": {
                "dependency_order": ["schema", "pack"],
                "implementation_waves": ["w3-s1"],
                "recommended_starting_slice": "contracts_and_schema_alignment",
            },
        }
        run_state.step_results["architect"] = {
            "output": {
                "tracks": ["core", "workflow"],
                "modules": ["workflows", "agents"],
                "phases": ["contract", "pack"],
            },
        }
        run_state.step_results["critic"] = {
            "output": {
                "risk_zones": ["scope_sprawl"],
                "open_questions": ["What final output ordering should freeze in R3-C?"],
            },
        }

        synthesizer_step = _step_by_id(workflow, "synthesizer")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=synthesizer_step)

        self.assertIn("implementation_waves[0] to be an object", str(raised.exception))

    def test_synthesizer_fails_when_architect_tracks_is_not_list(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-malformed-architect-tracks",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
            context={
                "step_results": {
                    "intake": {
                        "output": {"project_summary": "Build a decomposition workflow"},
                    },
                    "planner": {
                        "output": {
                            "dependency_order": ["schema", "pack"],
                            "implementation_waves": [{"wave": "W3-S1", "focus": ["R3-A", "R3-B"]}],
                            "recommended_starting_slice": "stabilize_h2_template_contract",
                        },
                    },
                    "architect": {
                        "output": {
                            "tracks": "not-a-list",
                            "modules": ["workflows", "agents"],
                            "phases": ["contract", "pack"],
                        },
                    },
                    "critic": {
                        "output": {
                            "risk_zones": ["scope_sprawl"],
                            "open_questions": ["What final output ordering should freeze in R3-C?"],
                        },
                    },
                },
            },
        )
        run_state.step_results = dict(run_state.context.get("step_results", {}))

        synthesizer_step = _step_by_id(workflow, "synthesizer")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=synthesizer_step)

        self.assertIn("requires non-empty list field 'tracks'", str(raised.exception))

    def test_synthesizer_fails_when_planner_lacks_recommended_starting_slice(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-missing-starting-slice",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
            context={
                "step_results": {
                    "intake": {
                        "output": {"project_summary": "Build a decomposition workflow"},
                    },
                    "planner": {
                        "output": {
                            "dependency_order": ["schema", "pack"],
                            "implementation_waves": [{"wave": "W3-S1", "focus": ["R3-A", "R3-B"]}],
                        },
                    },
                    "architect": {
                        "output": {
                            "tracks": ["core"],
                            "modules": ["workflows"],
                            "phases": ["contract"],
                        },
                    },
                    "critic": {
                        "output": {
                            "risk_zones": ["scope_sprawl"],
                            "open_questions": ["Which template order should freeze?"],
                        },
                    },
                },
            },
        )
        run_state.step_results = dict(run_state.context.get("step_results", {}))

        synthesizer_step = _step_by_id(workflow, "synthesizer")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=synthesizer_step)

        self.assertIn("requires non-empty text field 'recommended_starting_slice'", str(raised.exception))

    def test_synthesizer_fails_when_implementation_wave_item_lacks_wave_text(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-wave-item-missing-wave",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
            context={
                "step_results": {
                    "intake": {"output": {"project_summary": "Build a decomposition workflow"}},
                    "planner": {
                        "output": {
                            "dependency_order": ["schema", "pack"],
                            "implementation_waves": [{"wave": "", "focus": ["R3-A", "R3-B"]}],
                            "recommended_starting_slice": "stabilize_h2_template_contract",
                        },
                    },
                    "architect": {
                        "output": {
                            "tracks": ["core"],
                            "modules": ["workflows"],
                            "phases": ["contract"],
                        },
                    },
                    "critic": {
                        "output": {
                            "risk_zones": ["scope_sprawl"],
                            "open_questions": ["Which template order should freeze?"],
                        },
                    },
                },
            },
        )
        run_state.step_results = dict(run_state.context.get("step_results", {}))

        synthesizer_step = _step_by_id(workflow, "synthesizer")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=synthesizer_step)

        self.assertIn("requires implementation_waves[0].wave to be non-empty text", str(raised.exception))

    def test_synthesizer_fails_when_implementation_wave_item_lacks_focus_list(self) -> None:
        workflow = get_workflow_spec(H2_WORKFLOW_ID)
        step_runner = build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(H2_WORKFLOW_ID),
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
            run_id="run-h2-wave-item-missing-focus",
            workflow_id=workflow.workflow_id,
            input_payload={"goal": "Build a decomposition workflow"},
            context={
                "step_results": {
                    "intake": {"output": {"project_summary": "Build a decomposition workflow"}},
                    "planner": {
                        "output": {
                            "dependency_order": ["schema", "pack"],
                            "implementation_waves": [{"wave": "W3-S1", "focus": []}],
                            "recommended_starting_slice": "stabilize_h2_template_contract",
                        },
                    },
                    "architect": {
                        "output": {
                            "tracks": ["core"],
                            "modules": ["workflows"],
                            "phases": ["contract"],
                        },
                    },
                    "critic": {
                        "output": {
                            "risk_zones": ["scope_sprawl"],
                            "open_questions": ["Which template order should freeze?"],
                        },
                    },
                },
            },
        )
        run_state.step_results = dict(run_state.context.get("step_results", {}))

        synthesizer_step = _step_by_id(workflow, "synthesizer")
        with self.assertRaises(StepExecutionError) as raised:
            step_runner(run_state=run_state, workflow=workflow, step=synthesizer_step)

        self.assertIn("requires implementation_waves[0].focus to be a non-empty list", str(raised.exception))


def _step_by_id(workflow, step_id: str):
    for step in workflow.steps:
        if step.step_id == step_id:
            return step
    raise AssertionError(f"Missing step '{step_id}' in workflow.")


if __name__ == "__main__":
    unittest.main()
