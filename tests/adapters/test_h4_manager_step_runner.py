from __future__ import annotations

import unittest
from typing import Any

from fractal_agent_lab.adapters import MockAdapter, build_step_runner
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec, list_workflow_ids
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import H4_SEQ_NEXT_WORKFLOW_ID, H4_WAVE_START_WORKFLOW_ID


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

EXPECTED_H4_SEQ_NEXT_OUTPUT_KEYS = [
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

    def test_h4_seq_next_workflow_is_registered_and_runnable_with_scripted_mock(self) -> None:
        workflow_ids = list_workflow_ids()
        self.assertIn(H4_SEQ_NEXT_WORKFLOW_ID, workflow_ids)

        workflow = get_workflow_spec(H4_SEQ_NEXT_WORKFLOW_ID)
        agent_specs = get_workflow_agent_specs(H4_SEQ_NEXT_WORKFLOW_ID)

        step_runner = build_step_runner(
            agent_specs_by_id=agent_specs,
            providers_config={"default_provider": "mock"},
            model_policy_config={
                "tier_defaults": {
                    "specialist": "gpt-5.4-nano",
                    "finalizer": "gpt-5.4-mini",
                },
            },
            adapters_by_provider={
                "mock": MockAdapter(scripted_responses={"__default__": _seq_next_scripted_response}),
            },
        )
        executor = WorkflowExecutor(step_runner=step_runner)

        run_state = executor.execute(
            workflow=workflow,
            input_payload={"goal": "Open CV1-B with seq-next planning artifacts"},
        )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload = run_state.output_payload or {}
        turns = output_payload["manager_orchestration"]["turns"]
        self.assertEqual(["delegate", "delegate", "delegate", "finalize"], [turn["action"] for turn in turns])
        self.assertEqual(
            ["repo_intake", "planner", "architect_critic"],
            [turn.get("target_step_id") for turn in turns[:3]],
        )

        final_output = output_payload["final_output"]
        self.assertEqual(EXPECTED_H4_SEQ_NEXT_OUTPUT_KEYS, list(final_output.keys()))
        self.assertTrue(final_output["task_summary"])
        self.assertTrue(final_output["risk_register"])
        self.assertTrue(final_output["blocking_conditions"])


def _seq_next_scripted_response(request) -> dict[str, Any]:
    step_results = request.context.get("step_results")
    if not isinstance(step_results, dict):
        step_results = {}

    repo_intake_output = _step_output(step_results.get("repo_intake"))
    planner_output = _step_output(step_results.get("planner"))
    architect_critic_output = _step_output(step_results.get("architect_critic"))

    if request.step_id == "synthesizer":
        if not repo_intake_output:
            return {"control": {"action": "delegate", "target_step_id": "repo_intake", "reason": "missing"}}
        if not planner_output:
            return {"control": {"action": "delegate", "target_step_id": "planner", "reason": "missing"}}
        if not architect_critic_output:
            return {
                "control": {
                    "action": "delegate",
                    "target_step_id": "architect_critic",
                    "reason": "missing",
                },
            }
        return {
            "control": {
                "action": "finalize",
                "reason": "all_workers_completed",
                "output": {
                    "task_summary": _text(repo_intake_output, "task_summary"),
                    "intent": _text(repo_intake_output, "intent"),
                    "repo_summary": _text(repo_intake_output, "repo_summary"),
                    "changed_surfaces": _string_list(repo_intake_output, "changed_surfaces"),
                    "relevant_docs": _string_list(repo_intake_output, "relevant_docs"),
                    "relevant_code_areas": _string_list(repo_intake_output, "relevant_code_areas"),
                    "likely_touched_files": _string_list(repo_intake_output, "likely_touched_files"),
                    "assumptions": _string_list(repo_intake_output, "assumptions"),
                    "unknowns": _string_list(repo_intake_output, "unknowns"),
                    "recent_change_notes": _string_list(repo_intake_output, "recent_change_notes"),
                    "current_frontier": _text(repo_intake_output, "current_frontier"),
                    "step_order": _string_list(planner_output, "step_order"),
                    "dependencies": _string_list(planner_output, "dependencies"),
                    "test_plan": _string_list(planner_output, "test_plan"),
                    "documentation_obligations": _string_list(planner_output, "documentation_obligations"),
                    "risk_register": _risk_items(planner_output),
                    "open_questions": _string_list(planner_output, "open_questions"),
                    "blockers_or_holds": _string_list(architect_critic_output, "blockers_or_holds"),
                    "shared_zone_cautions": _string_list(architect_critic_output, "shared_zone_cautions"),
                    "sequencing_risks": _string_list(architect_critic_output, "sequencing_risks"),
                    "non_goals": _string_list(architect_critic_output, "non_goals"),
                    "functional_checks": _string_list(architect_critic_output, "functional_checks"),
                    "tests_required": _string_list(architect_critic_output, "tests_required"),
                    "docs_required": _string_list(architect_critic_output, "docs_required"),
                    "blocking_conditions": _string_list(architect_critic_output, "blocking_conditions"),
                    "next_recommended_action": _text(architect_critic_output, "next_recommended_action"),
                },
            },
        }

    if request.step_id == "repo_intake":
        return {
            "task_summary": "CV1-B seq_next planning artifact delivery",
            "intent": "Produce explicit implementation plan and acceptance checks",
            "repo_summary": "CV1-A artifacts and H4 baseline are already available.",
            "changed_surfaces": ["src/fractal_agent_lab/workflows", "src/fractal_agent_lab/agents", "tests"],
            "relevant_docs": ["ops/Combined-Execution-Sequencing-Plan.md", "ops/AGENTS.md"],
            "relevant_code_areas": ["hypothesis: src/fractal_agent_lab/workflows/h4.py"],
            "likely_touched_files": ["hypothesis: src/fractal_agent_lab/workflows/h4_artifacts.py"],
            "assumptions": ["CV1-C remains separate from CV1-B implementation scope."],
            "unknowns": ["Default-mock canonical runnable proof may need explicit cross-track checkpoint."],
            "recent_change_notes": ["CV1-A closeout hardened sidecar warning discipline."],
            "current_frontier": "CV1 Step 2 / CV1-B",
        }

    if request.step_id == "planner":
        return {
            "step_order": ["workflow", "pack", "artifact writers", "tests"],
            "dependencies": ["CV1-A completed"],
            "test_plan": ["workflow spec", "pack validation", "CLI artifact proof"],
            "documentation_obligations": ["Track C delivery note", "Combined update", "AGENTS update"],
            "risk_register": [
                {
                    "id": "R1",
                    "title": "Shared-boundary drift",
                    "severity": "medium",
                    "type": "boundary",
                    "description": "Do not silently absorb adapter/helper surfaces into Track C scope.",
                    "mitigation": "Treat adapter seam as explicit checkpoint.",
                    "owner": "track-c",
                },
            ],
            "open_questions": ["Need narrow adapter exception if canonical proof blocks."],
        }

    if request.step_id == "architect_critic":
        return {
            "blockers_or_holds": [],
            "shared_zone_cautions": ["cli/app.py is shared boundary; keep additive hooks only."],
            "sequencing_risks": ["CV1-C helper expansion creep into CV1-B."],
            "non_goals": ["No packet bus or helper-platform expansion in CV1-B."],
            "functional_checks": ["implementation_plan.md materializes on canonical run path"],
            "tests_required": ["tests/cli/test_cv1_b_h4_seq_next_cli.py"],
            "docs_required": ["docs/wave3/Wave3-CV1-B-TrackC-H4-Seq-Next-v1.md"],
            "blocking_conditions": ["missing required plan or acceptance fields"],
            "next_recommended_action": "Proceed with CV1-C in parallel and then run CV1-D evaluation.",
        }

    return {"message": "Unexpected H4 seq_next step"}


def _step_output(step_payload: object) -> dict[str, Any] | None:
    if not isinstance(step_payload, dict):
        return None
    output = step_payload.get("output")
    if not isinstance(output, dict):
        return None
    return output


def _text(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return "missing"


def _string_list(payload: dict[str, Any], key: str) -> list[str]:
    value = payload.get(key)
    if not isinstance(value, list):
        return ["missing"]
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out or ["missing"]


def _risk_items(payload: dict[str, Any]) -> list[dict[str, str]]:
    value = payload.get("risk_register")
    if not isinstance(value, list):
        return [
            {
                "id": "R-missing",
                "title": "missing",
                "severity": "high",
                "type": "validation",
                "description": "Missing risk register in planner output.",
                "mitigation": "Provide at least one structured risk item.",
                "owner": "track-c",
            },
        ]
    out: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        mapped = {
            "id": str(item.get("id", "R-unknown")),
            "title": str(item.get("title", "unknown")),
            "severity": str(item.get("severity", "unspecified")),
            "type": str(item.get("type", "unspecified")),
            "description": str(item.get("description", "")),
            "mitigation": str(item.get("mitigation", "")),
            "owner": str(item.get("owner", "unspecified")),
        }
        out.append(mapped)
    return out or [
        {
            "id": "R-empty",
            "title": "missing",
            "severity": "high",
            "type": "validation",
            "description": "No valid risk rows provided.",
            "mitigation": "Provide at least one structured risk row.",
            "owner": "track-c",
        },
    ]


if __name__ == "__main__":
    unittest.main()
