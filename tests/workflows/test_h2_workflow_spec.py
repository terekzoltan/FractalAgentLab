from __future__ import annotations

import unittest
from typing import Any

from fractal_agent_lab.core.contracts import WorkflowExecutionMode
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import (
    H2_MANAGER_STEP_ID,
    H2_WORKER_STEP_IDS,
    H2_WORKFLOW_ID,
    build_h2_manager_workflow_spec,
)


class H2WorkflowSpecTests(unittest.TestCase):
    def test_h2_manager_workflow_schema_shape_is_explicit(self) -> None:
        workflow = build_h2_manager_workflow_spec()

        self.assertEqual(H2_WORKFLOW_ID, workflow.workflow_id)
        self.assertEqual(WorkflowExecutionMode.MANAGER, workflow.execution_mode)
        self.assertEqual(H2_MANAGER_STEP_ID, workflow.entrypoint_step_id)
        self.assertEqual("h2.input.v1", workflow.input_schema_ref)
        self.assertEqual("h2.manager.output.v1", workflow.output_schema_ref)

        self.assertIsNotNone(workflow.manager_spec)
        manager_spec = workflow.manager_spec
        assert manager_spec is not None
        self.assertEqual(H2_MANAGER_STEP_ID, manager_spec.manager_step_id)
        self.assertEqual(list(H2_WORKER_STEP_IDS), manager_spec.worker_step_ids)
        self.assertEqual(8, manager_spec.max_turns)
        self.assertFalse(manager_spec.allow_revisit_workers)

        step_ids = [step.step_id for step in workflow.steps]
        self.assertEqual([H2_MANAGER_STEP_ID, *H2_WORKER_STEP_IDS], step_ids)
        self.assertEqual(len(step_ids), len(set(step_ids)))
        self.assertEqual(len(workflow.agent_ids), len(set(workflow.agent_ids)))

        self.assertEqual("track_c.r3_a", workflow.metadata.get("source"))
        self.assertEqual("H2", workflow.metadata.get("hero_workflow"))
        self.assertEqual("manager", workflow.metadata.get("variant"))
        self.assertEqual("h2.workflow.v1", workflow.metadata.get("schema_contract"))

    def test_h2_manager_workflow_executes_with_explicit_control_no_fallback(self) -> None:
        workflow = build_h2_manager_workflow_spec()
        manager_turn = 0

        def scripted_step_runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            nonlocal manager_turn

            if step.step_id == H2_MANAGER_STEP_ID:
                manager_turn += 1
                if manager_turn == 1:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "intake",
                            "reason": "missing_intake_output",
                        },
                    }
                if manager_turn == 2:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "planner",
                            "reason": "missing_planner_output",
                        },
                    }
                if manager_turn == 3:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "architect",
                            "reason": "missing_architect_output",
                        },
                    }
                if manager_turn == 4:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "critic",
                            "reason": "missing_critic_output",
                        },
                    }
                if manager_turn == 5:
                    return {
                        "control": {
                            "action": "finalize",
                            "reason": "all_workers_completed",
                            "output": {"decomposition_ready": True},
                        },
                    }
                raise AssertionError(f"Unexpected manager turn index: {manager_turn}")

            if step.step_id == "intake":
                return {
                    "project_brief": "brief",
                    "goal": "decompose broad project",
                }
            if step.step_id == "planner":
                return {
                    "sequencing_lens": ["dependency_first", "risk_first"],
                }
            if step.step_id == "architect":
                return {
                    "tracks": ["platform", "workflow"],
                    "modules": ["runtime", "agent_pack"],
                }
            if step.step_id == "critic":
                return {
                    "risk_zones": ["scope_sprawl", "contract_drift"],
                }
            raise AssertionError(f"Unexpected worker step: {step.step_id}")

        executor = WorkflowExecutor(step_runner=scripted_step_runner)
        run_state = executor.execute(workflow=workflow, input_payload={"goal": "Build an AI system"})

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload: dict[str, Any] = run_state.output_payload or {}
        self.assertEqual({"decomposition_ready": True}, output_payload.get("final_output"))

        orchestration = output_payload.get("manager_orchestration", {})
        self.assertEqual(H2_MANAGER_STEP_ID, orchestration.get("manager_step_id"))
        self.assertEqual(list(H2_WORKER_STEP_IDS), orchestration.get("worker_step_ids"))
        turns = orchestration.get("turns", [])
        self.assertEqual(5, len(turns))

        actions = [turn.get("action") for turn in turns if isinstance(turn, dict)]
        self.assertEqual(["delegate", "delegate", "delegate", "delegate", "finalize"], actions)

        delegate_targets = [turn.get("target_step_id") for turn in turns[:4]]
        self.assertEqual(["intake", "planner", "architect", "critic"], delegate_targets)

        reasons = [turn.get("reason") for turn in turns if isinstance(turn, dict)]
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
        self.assertIsNone(turns[4].get("target_step_id"))

        step_results = output_payload.get("step_results", {})
        self.assertIn("intake", step_results)
        self.assertIn("planner", step_results)
        self.assertIn("architect", step_results)
        self.assertIn("critic", step_results)
        self.assertIn(H2_MANAGER_STEP_ID, step_results)


if __name__ == "__main__":
    unittest.main()
