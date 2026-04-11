from __future__ import annotations

import unittest
from typing import Any

from fractal_agent_lab.core.contracts import WorkflowExecutionMode
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import (
    H3_MANAGER_STEP_ID,
    H3_WORKER_STEP_IDS,
    H3_WORKFLOW_ID,
    build_h3_manager_workflow_spec,
)


H3_REVIEW_BUCKET_CANDIDATES = {
    "strengths": ("strong_points", "strengths"),
    "bottlenecks": ("bottlenecks",),
    "merge_risks": ("merge_risk_zones", "merge_risks"),
    "refactor_ideas": ("refactor_suggestions", "refactor_ideas"),
}


class H3WorkflowSpecTests(unittest.TestCase):
    def test_h3_manager_workflow_schema_shape_is_explicit(self) -> None:
        workflow = build_h3_manager_workflow_spec()

        self.assertEqual(H3_WORKFLOW_ID, workflow.workflow_id)
        self.assertEqual("H3 Architecture Review Manager Baseline", workflow.name)
        self.assertEqual("1.0.0", workflow.version)
        self.assertEqual(WorkflowExecutionMode.MANAGER, workflow.execution_mode)
        self.assertEqual(H3_MANAGER_STEP_ID, workflow.entrypoint_step_id)
        self.assertEqual("h3.input.v1", workflow.input_schema_ref)
        self.assertEqual("h3.manager.output.v1", workflow.output_schema_ref)

        self.assertIsNotNone(workflow.manager_spec)
        manager_spec = workflow.manager_spec
        assert manager_spec is not None
        self.assertEqual(H3_MANAGER_STEP_ID, manager_spec.manager_step_id)
        self.assertEqual(list(H3_WORKER_STEP_IDS), manager_spec.worker_step_ids)
        self.assertNotIn(manager_spec.manager_step_id, manager_spec.worker_step_ids)
        self.assertEqual(8, manager_spec.max_turns)
        self.assertFalse(manager_spec.allow_revisit_workers)

        step_ids = [step.step_id for step in workflow.steps]
        self.assertEqual([H3_MANAGER_STEP_ID, *H3_WORKER_STEP_IDS], step_ids)
        self.assertEqual(len(step_ids), len(set(step_ids)))
        self.assertEqual(len(workflow.agent_ids), len(set(workflow.agent_ids)))

        self.assertEqual("track_c.r3_e", workflow.metadata.get("source"))
        self.assertEqual("H3", workflow.metadata.get("hero_workflow"))
        self.assertEqual("manager", workflow.metadata.get("variant"))
        self.assertEqual("h3.workflow.v1", workflow.metadata.get("schema_contract"))
        self.assertEqual(
            {"source", "hero_workflow", "variant", "schema_contract"},
            set(workflow.metadata),
        )

    def test_h3_manager_workflow_uses_existing_manager_envelope_with_explicit_control(self) -> None:
        workflow = build_h3_manager_workflow_spec()
        manager_turn = 0

        def scripted_step_runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            nonlocal manager_turn

            if step.step_id == H3_MANAGER_STEP_ID:
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
                            "target_step_id": "systems",
                            "reason": "missing_systems_output",
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
                            "output": {
                                "strengths": ["Clear separation between runtime and agent semantics."],
                                "bottlenecks": ["Cross-track schema naming drift remains unresolved."],
                                "merge_risks": ["Output-section naming may diverge before R3-G freeze."],
                                "refactor_ideas": ["Introduce a shared H3 section naming registry in R3-G."],
                            },
                        },
                    }
                raise AssertionError(f"Unexpected manager turn index: {manager_turn}")

            if step.step_id == "intake":
                return {
                    "review_scope": "Assess architecture review readiness for H3.",
                }
            if step.step_id == "planner":
                return {
                    "review_plan": ["contracts", "interfaces", "failure_paths"],
                }
            if step.step_id == "systems":
                return {
                    "boundary_map": ["runtime", "adapters", "agents", "evals"],
                }
            if step.step_id == "critic":
                return {
                    "risk_notes": ["naming drift", "premature template freeze"],
                }
            raise AssertionError(f"Unexpected worker step: {step.step_id}")

        executor = WorkflowExecutor(step_runner=scripted_step_runner)
        run_state = executor.execute(workflow=workflow, input_payload={"goal": "Review architecture"})

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload: dict[str, Any] = run_state.output_payload or {}
        self.assertEqual({"step_results", "manager_orchestration", "final_output"}, set(output_payload))

        final_output = output_payload.get("final_output")
        self.assertIsInstance(final_output, dict)
        assert isinstance(final_output, dict)
        self.assertTrue(final_output)
        for concept_name, candidate_keys in H3_REVIEW_BUCKET_CANDIDATES.items():
            matching_key = next((key for key in candidate_keys if key in final_output), None)
            self.assertIsNotNone(matching_key, f"Missing representative H3 review bucket for {concept_name}.")
            value = final_output.get(matching_key)
            self.assertIsInstance(value, list)
            assert isinstance(value, list)
            self.assertTrue(value, f"Representative H3 review bucket '{matching_key}' must be non-empty.")

        orchestration = output_payload.get("manager_orchestration", {})
        self.assertEqual(H3_MANAGER_STEP_ID, orchestration.get("manager_step_id"))
        self.assertEqual(list(H3_WORKER_STEP_IDS), orchestration.get("worker_step_ids"))
        turns = orchestration.get("turns", [])
        self.assertEqual(5, len(turns))

        actions = [turn.get("action") for turn in turns if isinstance(turn, dict)]
        self.assertEqual(["delegate", "delegate", "delegate", "delegate", "finalize"], actions)

        delegate_targets = [turn.get("target_step_id") for turn in turns[:4]]
        self.assertEqual(["intake", "planner", "systems", "critic"], delegate_targets)

        reasons = [turn.get("reason") for turn in turns if isinstance(turn, dict)]
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
        self.assertIsNone(turns[4].get("target_step_id"))

        step_results = output_payload.get("step_results", {})
        self.assertIn("intake", step_results)
        self.assertIn("planner", step_results)
        self.assertIn("systems", step_results)
        self.assertIn("critic", step_results)
        self.assertIn(H3_MANAGER_STEP_ID, step_results)


if __name__ == "__main__":
    unittest.main()
