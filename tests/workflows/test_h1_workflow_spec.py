from __future__ import annotations

import unittest
from typing import Any

from fractal_agent_lab.core.contracts import WorkflowExecutionMode
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import (
    H1_MANAGER_STEP_ID,
    H1_WORKER_STEP_IDS,
    H1_WORKFLOW_ID,
    build_h1_manager_workflow_spec,
)


class H1WorkflowSpecTests(unittest.TestCase):
    def test_h1_manager_workflow_schema_shape_is_explicit(self) -> None:
        workflow = build_h1_manager_workflow_spec()

        self.assertEqual(H1_WORKFLOW_ID, workflow.workflow_id)
        self.assertEqual(WorkflowExecutionMode.MANAGER, workflow.execution_mode)
        self.assertEqual(H1_MANAGER_STEP_ID, workflow.entrypoint_step_id)
        self.assertEqual("h1.input.v1", workflow.input_schema_ref)
        self.assertEqual("h1.manager.output.v1", workflow.output_schema_ref)

        self.assertIsNotNone(workflow.manager_spec)
        manager_spec = workflow.manager_spec
        assert manager_spec is not None
        self.assertEqual(H1_MANAGER_STEP_ID, manager_spec.manager_step_id)
        self.assertEqual(list(H1_WORKER_STEP_IDS), manager_spec.worker_step_ids)
        self.assertEqual(6, manager_spec.max_turns)
        self.assertFalse(manager_spec.allow_revisit_workers)

        step_ids = [step.step_id for step in workflow.steps]
        self.assertEqual([H1_MANAGER_STEP_ID, *H1_WORKER_STEP_IDS], step_ids)
        self.assertEqual(len(step_ids), len(set(step_ids)))
        self.assertEqual(len(workflow.agent_ids), len(set(workflow.agent_ids)))

    def test_h1_manager_workflow_executes_with_manager_control_envelope(self) -> None:
        workflow = build_h1_manager_workflow_spec()

        def scripted_step_runner(*, run_state, workflow, step):
            _ = workflow
            turn = int(run_state.context.get("turn", 0)) + 1
            run_state.context["turn"] = turn

            if step.step_id == H1_MANAGER_STEP_ID:
                if turn == 1:
                    return {"control": {"action": "delegate", "target_step_id": "intake"}}
                if turn == 3:
                    return {"control": {"action": "delegate", "target_step_id": "planner"}}
                if turn == 5:
                    return {"control": {"action": "delegate", "target_step_id": "critic"}}
                return {
                    "control": {
                        "action": "finalize",
                        "reason": "all_workers_covered",
                        "output": {"decision": "finalized"},
                    },
                }

            return {
                "step": step.step_id,
                "agent_id": step.agent_id,
                "notes": f"worker output from {step.step_id}",
            }

        executor = WorkflowExecutor(step_runner=scripted_step_runner)
        run_state = executor.execute(workflow=workflow, input_payload={"idea": "AI founder assistant"})

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload: dict[str, Any] = run_state.output_payload or {}
        self.assertIn("manager_orchestration", output_payload)
        self.assertIn("final_output", output_payload)
        self.assertEqual({"decision": "finalized"}, output_payload["final_output"])

        step_results = output_payload.get("step_results", {})
        self.assertIn("intake", step_results)
        self.assertIn("planner", step_results)
        self.assertIn("critic", step_results)
        self.assertIn(H1_MANAGER_STEP_ID, step_results)


if __name__ == "__main__":
    unittest.main()
