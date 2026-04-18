from __future__ import annotations

import unittest
from typing import Any

from fractal_agent_lab.core.contracts import WorkflowExecutionMode
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import (
    H4_WAVE_START_MANAGER_STEP_ID,
    H4_WAVE_START_WORKER_STEP_IDS,
    H4_WAVE_START_WORKFLOW_ID,
    build_h4_wave_start_workflow_spec,
)


EXPECTED_H4_CONTEXT_KEYS = [
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


class H4WaveStartWorkflowSpecTests(unittest.TestCase):
    def test_h4_wave_start_workflow_schema_shape_is_explicit(self) -> None:
        workflow = build_h4_wave_start_workflow_spec()

        self.assertEqual(H4_WAVE_START_WORKFLOW_ID, workflow.workflow_id)
        self.assertEqual("H4 Wave Start Repo Intake Manager Baseline", workflow.name)
        self.assertEqual("1.0.0", workflow.version)
        self.assertEqual(WorkflowExecutionMode.MANAGER, workflow.execution_mode)
        self.assertEqual(H4_WAVE_START_MANAGER_STEP_ID, workflow.entrypoint_step_id)
        self.assertEqual("h4.wave_start.input.v1", workflow.input_schema_ref)
        self.assertEqual("h4.wave_start.output.v1", workflow.output_schema_ref)

        self.assertIsNotNone(workflow.manager_spec)
        manager_spec = workflow.manager_spec
        assert manager_spec is not None
        self.assertEqual(H4_WAVE_START_MANAGER_STEP_ID, manager_spec.manager_step_id)
        self.assertEqual(list(H4_WAVE_START_WORKER_STEP_IDS), manager_spec.worker_step_ids)
        self.assertNotIn(manager_spec.manager_step_id, manager_spec.worker_step_ids)
        self.assertEqual(6, manager_spec.max_turns)
        self.assertFalse(manager_spec.allow_revisit_workers)

        step_ids = [step.step_id for step in workflow.steps]
        self.assertEqual([H4_WAVE_START_MANAGER_STEP_ID, *H4_WAVE_START_WORKER_STEP_IDS], step_ids)
        self.assertEqual(len(step_ids), len(set(step_ids)))
        self.assertEqual(len(workflow.agent_ids), len(set(workflow.agent_ids)))

        self.assertEqual("track_c.cv1_a", workflow.metadata.get("source"))
        self.assertEqual("H4", workflow.metadata.get("hero_workflow"))
        self.assertEqual("wave_start", workflow.metadata.get("variant"))
        self.assertEqual("h4.wave_start.workflow.v1", workflow.metadata.get("schema_contract"))
        self.assertEqual(
            {"source", "hero_workflow", "variant", "schema_contract", "strict_manager_control"},
            set(workflow.metadata),
        )

    def test_h4_wave_start_workflow_uses_explicit_manager_control(self) -> None:
        workflow = build_h4_wave_start_workflow_spec()
        manager_turn = 0

        def scripted_step_runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            nonlocal manager_turn

            if step.step_id == H4_WAVE_START_MANAGER_STEP_ID:
                manager_turn += 1
                if manager_turn == 1:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "repo_intake",
                            "reason": "missing_repo_intake_output",
                        },
                    }
                if manager_turn == 2:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "architect_critic",
                            "reason": "missing_architect_critic_output",
                        },
                    }
                if manager_turn == 3:
                    return {
                        "control": {
                            "action": "finalize",
                            "reason": "all_workers_completed",
                            "output": {
                                "repo_summary": "Repo intake confirms CV1-A can open with guardrails.",
                                "changed_surfaces": ["ops", "src/fractal_agent_lab/workflows", "src/fractal_agent_lab/agents"],
                                "relevant_docs": [
                                    "ops/Combined-Execution-Sequencing-Plan.md",
                                    "docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md",
                                ],
                                "relevant_code_areas": [
                                    "hypothesis: src/fractal_agent_lab/workflows/h4.py",
                                    "hypothesis: src/fractal_agent_lab/agents/h4/",
                                ],
                                "likely_touched_files": [
                                    "hypothesis: src/fractal_agent_lab/cli/workflow_registry.py",
                                    "hypothesis: src/fractal_agent_lab/cli/app.py",
                                ],
                                "assumptions": ["CV1-A keeps packet transport additive."],
                                "unknowns": ["Whether later CV1-C helper surfaces are needed for packet rendering."],
                                "recent_change_notes": ["Meta reorientation established packet/compiler-first direction."],
                                "current_frontier": "CV1 Step 1 / CV1-A",
                                "blockers_or_holds": [],
                                "shared_zone_cautions": [
                                    "cli/app.py stays a narrow shared-boundary exception for artifact writing.",
                                ],
                                "sequencing_risks": [
                                    "Do not absorb adapter or helper-platform expansion into CV1-A.",
                                ],
                                "non_goals": ["No packet bus or SEQ NEXT planning in CV1-A."],
                                "next_recommended_action": "After CV1-A acceptance, open CV1-B and CV1-C in parallel.",
                            },
                        },
                    }
                raise AssertionError(f"Unexpected manager turn index: {manager_turn}")

            if step.step_id == "repo_intake":
                return {
                    "repo_summary": "CV1-A should remain a narrow repo-intake slice.",
                    "changed_surfaces": ["ops", "docs/private", "src/fractal_agent_lab"],
                    "relevant_docs": ["ops/Combined-Execution-Sequencing-Plan.md"],
                    "relevant_code_areas": ["hypothesis: src/fractal_agent_lab/workflows/h4.py"],
                    "likely_touched_files": ["hypothesis: src/fractal_agent_lab/cli/workflow_registry.py"],
                    "assumptions": ["Track D adapter specialization stays out of CV1-A."],
                    "unknowns": ["Whether H4 mock specialization is needed before CV1-C."],
                    "recent_change_notes": ["CV1 packet/compiler-first stance is now canonical."],
                    "current_frontier": "CV1 Step 1 / CV1-A",
                }
            if step.step_id == "architect_critic":
                return {
                    "blockers_or_holds": [],
                    "shared_zone_cautions": ["cli/app.py is Track A-owned shared boundary."],
                    "sequencing_risks": ["Scope drift into adapter product semantics before CV1-C."],
                    "non_goals": ["No packet bus or queue model in CV1-A."],
                    "next_recommended_action": "Complete CV1-A with CLI-level canonical artifact proof.",
                }
            raise AssertionError(f"Unexpected worker step: {step.step_id}")

        executor = WorkflowExecutor(step_runner=scripted_step_runner)
        run_state = executor.execute(workflow=workflow, input_payload={"goal": "Run CV1-A repo intake"})

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload: dict[str, Any] = run_state.output_payload or {}
        self.assertEqual({"step_results", "manager_orchestration", "final_output"}, set(output_payload))

        final_output = output_payload.get("final_output")
        self.assertIsInstance(final_output, dict)
        assert isinstance(final_output, dict)
        self.assertEqual(EXPECTED_H4_CONTEXT_KEYS, list(final_output.keys()))

        orchestration = output_payload.get("manager_orchestration", {})
        self.assertEqual(H4_WAVE_START_MANAGER_STEP_ID, orchestration.get("manager_step_id"))
        self.assertEqual(list(H4_WAVE_START_WORKER_STEP_IDS), orchestration.get("worker_step_ids"))

        turns = orchestration.get("turns", [])
        self.assertEqual(3, len(turns))
        self.assertEqual(["delegate", "delegate", "finalize"], [turn.get("action") for turn in turns])
        self.assertEqual(["repo_intake", "architect_critic"], [turn.get("target_step_id") for turn in turns[:2]])


if __name__ == "__main__":
    unittest.main()
