from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.events import TraceEventType
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.tracing import InMemoryTraceEmitter


def _build_handoff_workflow() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id="test.handoff.workflow",
        name="Handoff Workflow Test",
        execution_mode=WorkflowExecutionMode.HANDOFF,
        steps=[
            WorkflowStepSpec(step_id="intake", agent_id="a_intake"),
            WorkflowStepSpec(step_id="planner", agent_id="a_planner"),
            WorkflowStepSpec(step_id="synthesizer", agent_id="a_synth"),
        ],
        entrypoint_step_id="intake",
    )


class WorkflowExecutorHandoffTests(unittest.TestCase):
    def test_handoff_chain_happy_path_finalizes(self) -> None:
        workflow = _build_handoff_workflow()
        emitter = InMemoryTraceEmitter()

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            if step.step_id == "intake":
                return {
                    "control": {
                        "action": "handoff",
                        "target_step_id": "planner",
                        "reason": "intake_complete",
                    },
                }
            if step.step_id == "planner":
                return {
                    "control": {
                        "action": "handoff",
                        "target_agent_id": "a_synth",
                        "reason": "plan_ready",
                    },
                }
            return {
                "control": {
                    "action": "finalize",
                    "reason": "synthesis_complete",
                    "output": {"summary": "ok"},
                },
            }

        run_state = WorkflowExecutor(step_runner=runner, emitter=emitter).execute(workflow)

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        output_payload = run_state.output_payload or {}
        orchestration = output_payload.get("handoff_orchestration", {})
        self.assertEqual(["intake", "planner", "synthesizer"], orchestration.get("path"))
        self.assertEqual("synthesizer", orchestration.get("final_step_id"))
        self.assertEqual("ok", output_payload.get("final_output", {}).get("summary"))

        handoff_decided = [
            event for event in emitter.events if event.event_type == TraceEventType.HANDOFF_DECIDED
        ]
        self.assertEqual(3, len(handoff_decided))
        self.assertTrue(all(event.payload.get("lane") == "handoff" for event in handoff_decided))

        decision_event = handoff_decided[0]
        self.assertEqual("explicit", decision_event.payload.get("decision_source"))
        self.assertEqual("intake", decision_event.payload.get("from_step_id"))
        self.assertEqual("planner", decision_event.payload.get("to_step_id"))
        self.assertIsNotNone(decision_event.parent_event_id)
        self.assertIsNotNone(decision_event.correlation_id)

        planner_step_started = next(
            event
            for event in emitter.events
            if event.event_type == TraceEventType.STEP_STARTED and event.step_id == "planner"
        )
        self.assertEqual(decision_event.event_id, planner_step_started.parent_event_id)

    def test_invalid_handoff_target_fails(self) -> None:
        workflow = _build_handoff_workflow()
        emitter = InMemoryTraceEmitter()

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            _ = step
            return {"control": {"action": "handoff", "target_step_id": "unknown_step"}}

        run_state = WorkflowExecutor(step_runner=runner, emitter=emitter).execute(workflow)
        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("unknown step", run_state.errors[0].lower())

        handoff_failed = [
            event for event in emitter.events if event.event_type == TraceEventType.HANDOFF_FAILED
        ]
        self.assertEqual(1, len(handoff_failed))
        self.assertEqual("handoff", handoff_failed[0].payload.get("decision_action"))

    def test_no_control_with_multiple_targets_fails_as_ambiguous(self) -> None:
        workflow = _build_handoff_workflow()
        emitter = InMemoryTraceEmitter()

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            _ = step
            return {"note": "no control envelope"}

        run_state = WorkflowExecutor(step_runner=runner, emitter=emitter).execute(workflow)
        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("ambiguous", run_state.errors[0].lower())

        handoff_failed = [
            event for event in emitter.events if event.event_type == TraceEventType.HANDOFF_FAILED
        ]
        self.assertEqual(1, len(handoff_failed))
        self.assertEqual("fallback", handoff_failed[0].payload.get("decision_source"))

    def test_handoff_self_loop_is_rejected(self) -> None:
        workflow = _build_handoff_workflow()
        emitter = InMemoryTraceEmitter()

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            return {
                "control": {
                    "action": "handoff",
                    "target_step_id": step.step_id,
                    "reason": "bad_self_loop",
                },
            }

        run_state = WorkflowExecutor(step_runner=runner, emitter=emitter).execute(workflow)
        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("self-loop", run_state.errors[0].lower())

        handoff_failed = [
            event for event in emitter.events if event.event_type == TraceEventType.HANDOFF_FAILED
        ]
        self.assertEqual(1, len(handoff_failed))


if __name__ == "__main__":
    unittest.main()
