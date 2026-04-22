from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts import ManagerSpec, WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor


MANAGER_STEP_ID = "manager"


def _build_manager_workflow(
    *,
    worker_step_ids: list[str],
    max_turns: int = 6,
    allow_revisit_workers: bool = False,
) -> WorkflowSpec:
    manager_step = WorkflowStepSpec(step_id=MANAGER_STEP_ID, agent_id="manager_agent")
    worker_steps = [
        WorkflowStepSpec(step_id=step_id, agent_id=f"{step_id}_agent") for step_id in worker_step_ids
    ]
    return WorkflowSpec(
        workflow_id="test.manager.workflow",
        name="Test Manager Workflow",
        execution_mode=WorkflowExecutionMode.MANAGER,
        steps=[manager_step, *worker_steps],
        manager_spec=ManagerSpec(
            manager_step_id=MANAGER_STEP_ID,
            worker_step_ids=list(worker_step_ids),
            max_turns=max_turns,
            allow_revisit_workers=allow_revisit_workers,
        ),
    )


class WorkflowExecutorManagerGuardrailTests(unittest.TestCase):
    def test_invalid_delegate_target_fails_run(self) -> None:
        workflow = _build_manager_workflow(worker_step_ids=["worker_a"])

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "unknown_worker",
                        "reason": "invalid_target",
                    },
                }
            return {"ok": True}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("unknown worker step", run_state.errors[0].lower())

    def test_revisit_rejected_when_disabled(self) -> None:
        workflow = _build_manager_workflow(worker_step_ids=["worker_a"], allow_revisit_workers=False)

        def runner(*, run_state, workflow, step):
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                turn = int(run_state.context.get("turn", 0)) + 1
                run_state.context["turn"] = turn
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "worker_a",
                        "reason": f"turn_{turn}",
                    },
                }
            return {"ok": step.step_id}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("already completed worker step", run_state.errors[0].lower())

    def test_max_turn_exhaustion_fails_run(self) -> None:
        workflow = _build_manager_workflow(
            worker_step_ids=["worker_a"],
            max_turns=2,
            allow_revisit_workers=True,
        )

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "worker_a",
                        "reason": "loop_forever",
                    },
                }
            return {"ok": step.step_id}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("exceeded max_turns", run_state.errors[0].lower())

    def test_fallback_path_without_control_auto_delegates_then_finalizes(self) -> None:
        workflow = _build_manager_workflow(worker_step_ids=["worker_a", "worker_b"], max_turns=5)

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                return {"note": "missing_control_envelope"}
            return {"ok": step.step_id}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload = run_state.output_payload or {}
        orchestration = output_payload.get("manager_orchestration", {})
        turns = orchestration.get("turns", [])
        actions = [turn.get("action") for turn in turns if isinstance(turn, dict)]
        self.assertEqual(["delegate", "delegate", "finalize"], actions)
        self.assertIn("worker_a", output_payload.get("step_results", {}))
        self.assertIn("worker_b", output_payload.get("step_results", {}))

    def test_strict_manager_control_rejects_missing_control_envelope(self) -> None:
        workflow = _build_manager_workflow(worker_step_ids=["worker_a"], max_turns=3)
        workflow.metadata["strict_manager_control"] = True

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                return {"note": "missing_control_envelope"}
            return {"ok": step.step_id}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("no valid control envelope", run_state.errors[0].lower())

    def test_strict_manager_control_rejects_finalize_before_all_workers_complete(self) -> None:
        workflow = _build_manager_workflow(worker_step_ids=["worker_a", "worker_b"], max_turns=4)
        workflow.metadata["strict_manager_control"] = True

        def runner(*, run_state, workflow, step):
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                turn = int(run_state.context.get("turn", 0)) + 1
                run_state.context["turn"] = turn
                if turn == 1:
                    return {
                        "control": {
                            "action": "delegate",
                            "target_step_id": "worker_a",
                            "reason": "first_only",
                        },
                    }
                return {
                    "control": {
                        "action": "finalize",
                        "reason": "premature_finalize",
                        "output": {"result": "should_not_succeed"},
                    },
                }
            return {"ok": step.step_id}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("finalize before all worker steps completed", run_state.errors[0].lower())
        failure = run_state.failure or {}
        details = failure.get("details") if isinstance(failure, dict) else {}
        self.assertIsInstance(details, dict)
        assert isinstance(details, dict)
        self.assertEqual(["worker_b"], details.get("missing_worker_step_ids"))


class WorkflowExecutorManagerParsingTests(unittest.TestCase):
    def test_first_valid_control_wins_nested_output_control(self) -> None:
        workflow = _build_manager_workflow(worker_step_ids=["worker_a"], max_turns=3)

        def runner(*, run_state, workflow, step):
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                turn = int(run_state.context.get("turn", 0)) + 1
                run_state.context["turn"] = turn
                if turn == 1:
                    return {
                        "control": {"action": "not_valid"},
                        "output": {
                            "control": {
                                "action": "delegate",
                                "target_step_id": "worker_a",
                                "reason": "nested_output_reason",
                            },
                        },
                    }
                return {
                    "control": {
                        "action": "finalize",
                        "reason": "done",
                        "output": {"result": "ok"},
                    },
                }
            return {"ok": True}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        turns = (run_state.output_payload or {}).get("manager_orchestration", {}).get("turns", [])
        self.assertGreaterEqual(len(turns), 1)
        first_turn = turns[0]
        self.assertEqual("delegate", first_turn.get("action"))
        self.assertEqual("nested_output_reason", first_turn.get("reason"))

    def test_first_valid_control_wins_nested_raw_control(self) -> None:
        workflow = _build_manager_workflow(worker_step_ids=["worker_a"], max_turns=3)

        def runner(*, run_state, workflow, step):
            _ = workflow
            if step.step_id == MANAGER_STEP_ID:
                turn = int(run_state.context.get("turn", 0)) + 1
                run_state.context["turn"] = turn
                if turn == 1:
                    return {
                        "control": {"action": "unknown_action"},
                        "raw": {
                            "control": {
                                "action": "delegate",
                                "target_step_id": "worker_a",
                                "reason": "nested_raw_reason",
                            },
                        },
                    }
                return {
                    "control": {
                        "action": "finalize",
                        "reason": "done",
                        "output": {"result": "ok"},
                    },
                }
            return {"ok": True}

        run_state = WorkflowExecutor(step_runner=runner).execute(workflow)

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        turns = (run_state.output_payload or {}).get("manager_orchestration", {}).get("turns", [])
        self.assertGreaterEqual(len(turns), 1)
        first_turn = turns[0]
        self.assertEqual("delegate", first_turn.get("action"))
        self.assertEqual("nested_raw_reason", first_turn.get("reason"))


class WorkflowSpecManagerInvariantTests(unittest.TestCase):
    def test_duplicate_step_ids_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "duplicate step_id"):
            WorkflowSpec(
                workflow_id="invalid.duplicate.steps",
                name="Invalid Duplicate Steps",
                execution_mode=WorkflowExecutionMode.LINEAR,
                steps=[
                    WorkflowStepSpec(step_id="s1", agent_id="a1"),
                    WorkflowStepSpec(step_id="s1", agent_id="a2"),
                ],
            )

    def test_manager_mode_requires_manager_spec(self) -> None:
        with self.assertRaisesRegex(ValueError, "requires non-null manager_spec"):
            WorkflowSpec(
                workflow_id="invalid.manager.mode",
                name="Invalid Manager Mode",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[WorkflowStepSpec(step_id="s1", agent_id="a1")],
            )

    def test_manager_spec_requires_manager_execution_mode(self) -> None:
        with self.assertRaisesRegex(ValueError, "manager_spec requires execution_mode 'manager'"):
            WorkflowSpec(
                workflow_id="invalid.manager.spec.mode",
                name="Invalid Manager Spec Mode",
                execution_mode=WorkflowExecutionMode.LINEAR,
                steps=[
                    WorkflowStepSpec(step_id="manager", agent_id="m1"),
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=["worker"],
                    max_turns=3,
                ),
            )

    def test_manager_worker_list_cannot_include_manager_step(self) -> None:
        with self.assertRaisesRegex(ValueError, "cannot include manager_step_id"):
            WorkflowSpec(
                workflow_id="invalid.manager.worker_set",
                name="Invalid Manager Worker Set",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[
                    WorkflowStepSpec(step_id="manager", agent_id="m1"),
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=["manager", "worker"],
                    max_turns=3,
                ),
            )

    def test_manager_step_must_reference_declared_step(self) -> None:
        with self.assertRaisesRegex(ValueError, r"manager_spec\.manager_step_id must reference"):
            WorkflowSpec(
                workflow_id="invalid.manager.missing_step",
                name="Invalid Missing Manager Step",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=["worker"],
                    max_turns=3,
                ),
            )

    def test_manager_worker_ids_must_reference_declared_steps(self) -> None:
        with self.assertRaisesRegex(ValueError, "contains unknown workflow steps"):
            WorkflowSpec(
                workflow_id="invalid.manager.unknown_worker",
                name="Invalid Unknown Worker",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[
                    WorkflowStepSpec(step_id="manager", agent_id="m1"),
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=["worker", "missing_worker"],
                    max_turns=3,
                ),
            )

    def test_manager_worker_ids_cannot_be_empty(self) -> None:
        with self.assertRaisesRegex(ValueError, "must include at least one worker step"):
            WorkflowSpec(
                workflow_id="invalid.manager.empty_workers",
                name="Invalid Empty Workers",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[
                    WorkflowStepSpec(step_id="manager", agent_id="m1"),
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=[],
                    max_turns=3,
                ),
            )

    def test_manager_worker_ids_cannot_contain_duplicates(self) -> None:
        with self.assertRaisesRegex(ValueError, "worker_step_ids contains duplicates"):
            WorkflowSpec(
                workflow_id="invalid.manager.duplicate_workers",
                name="Invalid Duplicate Workers",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[
                    WorkflowStepSpec(step_id="manager", agent_id="m1"),
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=["worker", "worker"],
                    max_turns=3,
                ),
            )

    def test_manager_max_turns_must_be_positive(self) -> None:
        with self.assertRaisesRegex(ValueError, "manager_spec.max_turns must be positive"):
            WorkflowSpec(
                workflow_id="invalid.manager.max_turns",
                name="Invalid Manager Max Turns",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[
                    WorkflowStepSpec(step_id="manager", agent_id="m1"),
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=["worker"],
                    max_turns=0,
                ),
            )

    def test_manager_entrypoint_must_match_manager_step_id(self) -> None:
        with self.assertRaisesRegex(ValueError, "entrypoint_step_id to match manager_step_id"):
            WorkflowSpec(
                workflow_id="invalid.manager.entrypoint",
                name="Invalid Manager Entrypoint",
                execution_mode=WorkflowExecutionMode.MANAGER,
                steps=[
                    WorkflowStepSpec(step_id="manager", agent_id="m1"),
                    WorkflowStepSpec(step_id="worker", agent_id="w1"),
                ],
                entrypoint_step_id="worker",
                manager_spec=ManagerSpec(
                    manager_step_id="manager",
                    worker_step_ids=["worker"],
                    max_turns=3,
                ),
            )


if __name__ == "__main__":
    unittest.main()
