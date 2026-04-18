from __future__ import annotations

import unittest
from typing import Any

from fractal_agent_lab.core.contracts import WorkflowExecutionMode
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import (
    H4_SEQ_NEXT_MANAGER_STEP_ID,
    H4_SEQ_NEXT_WORKER_STEP_IDS,
    H4_SEQ_NEXT_WORKFLOW_ID,
    H4_WAVE_START_MANAGER_STEP_ID,
    H4_WAVE_START_WORKER_STEP_IDS,
    H4_WAVE_START_WORKFLOW_ID,
    build_h4_seq_next_workflow_spec,
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

EXPECTED_H4_SEQ_NEXT_KEYS = [
    "task_summary",
    "intent",
    "repo_summary",
    "changed_surfaces",
    "relevant_docs",
    "relevant_code_areas",
    "likely_touched_files",
    "assumptions",
    "unknowns",
    "recent_change_notes",
    "current_frontier",
    "step_order",
    "dependencies",
    "test_plan",
    "documentation_obligations",
    "risk_register",
    "open_questions",
    "blockers_or_holds",
    "shared_zone_cautions",
    "sequencing_risks",
    "non_goals",
    "functional_checks",
    "tests_required",
    "docs_required",
    "blocking_conditions",
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


class H4SeqNextWorkflowSpecTests(unittest.TestCase):
    def test_h4_seq_next_workflow_schema_shape_is_explicit(self) -> None:
        workflow = build_h4_seq_next_workflow_spec()

        self.assertEqual(H4_SEQ_NEXT_WORKFLOW_ID, workflow.workflow_id)
        self.assertEqual("H4 Seq Next Planning Manager Baseline", workflow.name)
        self.assertEqual("1.0.0", workflow.version)
        self.assertEqual(WorkflowExecutionMode.MANAGER, workflow.execution_mode)
        self.assertEqual(H4_SEQ_NEXT_MANAGER_STEP_ID, workflow.entrypoint_step_id)
        self.assertEqual("h4.seq_next.input.v1", workflow.input_schema_ref)
        self.assertEqual("h4.seq_next.output.v1", workflow.output_schema_ref)

        self.assertIsNotNone(workflow.manager_spec)
        manager_spec = workflow.manager_spec
        assert manager_spec is not None
        self.assertEqual(H4_SEQ_NEXT_MANAGER_STEP_ID, manager_spec.manager_step_id)
        self.assertEqual(list(H4_SEQ_NEXT_WORKER_STEP_IDS), manager_spec.worker_step_ids)
        self.assertNotIn(manager_spec.manager_step_id, manager_spec.worker_step_ids)
        self.assertEqual(8, manager_spec.max_turns)
        self.assertFalse(manager_spec.allow_revisit_workers)

        step_ids = [step.step_id for step in workflow.steps]
        self.assertEqual([H4_SEQ_NEXT_MANAGER_STEP_ID, *H4_SEQ_NEXT_WORKER_STEP_IDS], step_ids)
        self.assertEqual(len(step_ids), len(set(step_ids)))

        self.assertEqual("track_c.cv1_b", workflow.metadata.get("source"))
        self.assertEqual("H4", workflow.metadata.get("hero_workflow"))
        self.assertEqual("seq_next", workflow.metadata.get("variant"))
        self.assertEqual("h4.seq_next.workflow.v1", workflow.metadata.get("schema_contract"))

    def test_h4_seq_next_workflow_uses_explicit_manager_control(self) -> None:
        workflow = build_h4_seq_next_workflow_spec()
        manager_turn = 0

        def scripted_step_runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            nonlocal manager_turn

            if step.step_id == H4_SEQ_NEXT_MANAGER_STEP_ID:
                manager_turn += 1
                if manager_turn == 1:
                    return {"control": {"action": "delegate", "target_step_id": "repo_intake", "reason": "missing"}}
                if manager_turn == 2:
                    return {"control": {"action": "delegate", "target_step_id": "planner", "reason": "missing"}}
                if manager_turn == 3:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "architect_critic",
                            "reason": "missing",
                        },
                    }
                if manager_turn == 4:
                    return {
                        "control": {
                            "action": "finalize",
                            "reason": "all_workers_completed",
                            "output": {
                                "task_summary": "Implement CV1-B seq_next planning artifacts.",
                                "intent": "Produce explicit implementation plan and acceptance checks.",
                                "repo_summary": "Repo has CV1-A baseline and is ready for seq_next planning layer.",
                                "changed_surfaces": ["src/fractal_agent_lab/workflows", "src/fractal_agent_lab/agents", "tests"],
                                "relevant_docs": ["ops/Combined-Execution-Sequencing-Plan.md"],
                                "relevant_code_areas": ["hypothesis: src/fractal_agent_lab/workflows/h4.py"],
                                "likely_touched_files": ["hypothesis: src/fractal_agent_lab/workflows/h4_artifacts.py"],
                                "assumptions": ["CV1-C helper surfaces remain separate."],
                                "unknowns": ["Whether packet rendering needs more helper support."],
                                "recent_change_notes": ["CV1-A finalized H4 wave_start baseline."],
                                "current_frontier": "CV1 Step 2 / CV1-B",
                                "step_order": ["workflow", "pack", "writers", "tests"],
                                "dependencies": ["CV1-A complete"],
                                "test_plan": ["workflow tests", "pack tests", "cli tests"],
                                "documentation_obligations": ["delivery note", "Combined update", "AGENTS update"],
                                "risk_register": [
                                    {
                                        "id": "R1",
                                        "title": "Scope drift",
                                        "severity": "medium",
                                        "type": "scope",
                                        "description": "Avoid helper-platform spillover.",
                                        "mitigation": "Scope lock CV1-B artifacts.",
                                        "owner": "track-c",
                                    },
                                ],
                                "open_questions": ["Do we need adapter exception for default mock proof?"],
                                "blockers_or_holds": [],
                                "shared_zone_cautions": ["cli/app.py is shared boundary."],
                                "sequencing_risks": ["Do not absorb CV1-C into CV1-B."],
                                "non_goals": ["No packet bus in CV1-B."],
                                "functional_checks": ["writes implementation_plan.md"],
                                "tests_required": ["tests/cli/test_cv1_b_h4_seq_next_cli.py"],
                                "docs_required": ["docs/wave3/Wave3-CV1-B-TrackC-H4-Seq-Next-v1.md"],
                                "blocking_conditions": ["missing required artifacts"],
                                "next_recommended_action": "Proceed with CV1-C in parallel and then CV1-D.",
                            },
                        },
                    }
                raise AssertionError(f"Unexpected manager turn index: {manager_turn}")

            if step.step_id == "repo_intake":
                return {
                    "task_summary": "CV1-B seq_next planning artifact build.",
                    "intent": "Produce explicit plan/check artifacts.",
                    "repo_summary": "CV1-A baseline exists.",
                    "changed_surfaces": ["src"],
                    "relevant_docs": ["ops/Combined-Execution-Sequencing-Plan.md"],
                    "relevant_code_areas": ["hypothesis: src/fractal_agent_lab/workflows/h4.py"],
                    "likely_touched_files": ["hypothesis: src/fractal_agent_lab/workflows/h4_artifacts.py"],
                    "assumptions": ["Track D helper work stays separate."],
                    "unknowns": ["Adapter seam handling."],
                    "recent_change_notes": ["CV1-A closeout completed."],
                    "current_frontier": "CV1 Step 2 / CV1-B",
                }
            if step.step_id == "planner":
                return {
                    "step_order": ["workflow", "pack", "artifacts", "tests"],
                    "dependencies": ["CV1-A"],
                    "test_plan": ["unit", "cli integration"],
                    "documentation_obligations": ["delivery doc"],
                    "risk_register": [
                        {
                            "id": "R1",
                            "title": "Shared-boundary drift",
                            "severity": "medium",
                            "type": "boundary",
                            "description": "Avoid widening into adapters/tools by default.",
                            "mitigation": "Keep checkpoint explicit.",
                            "owner": "track-c",
                        },
                    ],
                    "open_questions": ["default mock checkpoint"],
                }
            if step.step_id == "architect_critic":
                return {
                    "blockers_or_holds": [],
                    "shared_zone_cautions": ["cli/app.py shared boundary only."],
                    "sequencing_risks": ["CV1-C coupling risk"],
                    "non_goals": ["No helper platform creep"],
                    "functional_checks": ["required artifacts materialized"],
                    "tests_required": ["h4 workflow/pack/cli tests"],
                    "docs_required": ["Combined and AGENTS updates"],
                    "blocking_conditions": ["required fields missing"],
                    "next_recommended_action": "Coordinate CV1-C and then run CV1-D.",
                }
            raise AssertionError(f"Unexpected worker step: {step.step_id}")

        executor = WorkflowExecutor(step_runner=scripted_step_runner)
        run_state = executor.execute(workflow=workflow, input_payload={"goal": "Run CV1-B seq_next"})

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload: dict[str, Any] = run_state.output_payload or {}
        final_output = output_payload.get("final_output")
        self.assertIsInstance(final_output, dict)
        assert isinstance(final_output, dict)
        self.assertEqual(EXPECTED_H4_SEQ_NEXT_KEYS, list(final_output.keys()))

        turns = output_payload["manager_orchestration"]["turns"]
        self.assertEqual(["delegate", "delegate", "delegate", "finalize"], [turn["action"] for turn in turns])


if __name__ == "__main__":
    unittest.main()
