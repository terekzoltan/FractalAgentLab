from __future__ import annotations

import unittest

from fractal_agent_lab.cli.workflow_registry import get_workflow_spec
from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.events import TraceEventType
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.tracing import InMemoryTraceEmitter
from fractal_agent_lab.workflows import build_h1_lite_workflow_spec


class ExecutionModeTruthTests(unittest.TestCase):
    def test_h1_lite_declares_linear_without_manager_spec(self) -> None:
        workflow = build_h1_lite_workflow_spec()
        self.assertEqual(WorkflowExecutionMode.LINEAR, workflow.execution_mode)
        self.assertIsNone(workflow.manager_spec)

    def test_wave0_demo_declares_linear_without_manager_spec(self) -> None:
        workflow = get_workflow_spec("wave0.demo")
        self.assertEqual(WorkflowExecutionMode.LINEAR, workflow.execution_mode)
        self.assertIsNone(workflow.manager_spec)

    def test_runtime_emits_linear_execution_mode_for_linear_workflows(self) -> None:
        for workflow_id in ("h1.lite", "wave0.demo"):
            with self.subTest(workflow_id=workflow_id):
                workflow = get_workflow_spec(workflow_id)
                emitter = InMemoryTraceEmitter()
                run_state = WorkflowExecutor(
                    step_runner=(lambda *, run_state, workflow, step: {"step": step.step_id}),
                    emitter=emitter,
                ).execute(workflow, input_payload={"idea": "x"})

                self.assertEqual(RunStatus.SUCCEEDED, run_state.status)

                run_started = [
                    event
                    for event in emitter.events
                    if event.event_type == TraceEventType.RUN_STARTED
                ]
                self.assertEqual(1, len(run_started))
                self.assertEqual(
                    WorkflowExecutionMode.LINEAR.value,
                    run_started[0].payload.get("execution_mode"),
                )

                run_completed = [
                    event
                    for event in emitter.events
                    if event.event_type == TraceEventType.RUN_COMPLETED
                ]
                self.assertEqual(1, len(run_completed))
                self.assertEqual(
                    WorkflowExecutionMode.LINEAR.value,
                    run_completed[0].payload.get("execution_mode"),
                )

                step_started = [
                    event for event in emitter.events if event.event_type == TraceEventType.STEP_STARTED
                ]
                self.assertTrue(step_started)
                self.assertTrue(
                    all(event.payload.get("lane") == "linear" for event in step_started),
                )

    def test_runtime_emits_handoff_mode_for_handoff_workflow(self) -> None:
        workflow = WorkflowSpec(
            workflow_id="test.handoff.mode.truth",
            name="Handoff Mode Truth",
            execution_mode=WorkflowExecutionMode.HANDOFF,
            steps=[
                WorkflowStepSpec(step_id="a", agent_id="agent_a"),
                WorkflowStepSpec(step_id="b", agent_id="agent_b"),
            ],
            entrypoint_step_id="a",
        )

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            if step.step_id == "a":
                return {"control": {"action": "handoff", "target_step_id": "b"}}
            return {"control": {"action": "finalize", "output": {"ok": True}}}

        emitter = InMemoryTraceEmitter()
        run_state = WorkflowExecutor(step_runner=runner, emitter=emitter).execute(workflow)
        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)

        run_started = [
            event for event in emitter.events if event.event_type == TraceEventType.RUN_STARTED
        ]
        self.assertEqual(1, len(run_started))
        self.assertEqual(WorkflowExecutionMode.HANDOFF.value, run_started[0].payload.get("execution_mode"))

        run_completed = [
            event for event in emitter.events if event.event_type == TraceEventType.RUN_COMPLETED
        ]
        self.assertEqual(1, len(run_completed))
        self.assertEqual(WorkflowExecutionMode.HANDOFF.value, run_completed[0].payload.get("execution_mode"))

        step_started = [
            event for event in emitter.events if event.event_type == TraceEventType.STEP_STARTED
        ]
        self.assertTrue(step_started)
        self.assertTrue(all(event.payload.get("lane") == "handoff" for event in step_started))

    def test_runtime_rejects_parallel_mode_without_silent_linear_fallback(self) -> None:
        workflow = WorkflowSpec(
            workflow_id="test.parallel.unsupported",
            name="Parallel Unsupported",
            execution_mode=WorkflowExecutionMode.PARALLEL,
            steps=[WorkflowStepSpec(step_id="a", agent_id="agent_a")],
        )

        emitter = InMemoryTraceEmitter()
        run_state = WorkflowExecutor(
            step_runner=(lambda *, run_state, workflow, step: {"should_not_run": True}),
            emitter=emitter,
        ).execute(workflow)

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("not implemented", run_state.errors[0].lower())

        run_started = [
            event for event in emitter.events if event.event_type == TraceEventType.RUN_STARTED
        ]
        self.assertEqual(1, len(run_started))
        self.assertEqual(WorkflowExecutionMode.PARALLEL.value, run_started[0].payload.get("execution_mode"))

        step_started = [
            event for event in emitter.events if event.event_type == TraceEventType.STEP_STARTED
        ]
        self.assertEqual([], step_started)

    def test_runtime_rejects_graph_mode_without_silent_linear_fallback(self) -> None:
        workflow = WorkflowSpec(
            workflow_id="test.graph.unsupported",
            name="Graph Unsupported",
            execution_mode=WorkflowExecutionMode.GRAPH,
            steps=[WorkflowStepSpec(step_id="a", agent_id="agent_a")],
        )

        emitter = InMemoryTraceEmitter()
        run_state = WorkflowExecutor(
            step_runner=(lambda *, run_state, workflow, step: {"should_not_run": True}),
            emitter=emitter,
        ).execute(workflow)

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertTrue(run_state.errors)
        self.assertIn("not implemented", run_state.errors[0].lower())

        run_started = [
            event for event in emitter.events if event.event_type == TraceEventType.RUN_STARTED
        ]
        self.assertEqual(1, len(run_started))
        self.assertEqual(WorkflowExecutionMode.GRAPH.value, run_started[0].payload.get("execution_mode"))

        step_started = [
            event for event in emitter.events if event.event_type == TraceEventType.STEP_STARTED
        ]
        self.assertEqual([], step_started)


if __name__ == "__main__":
    unittest.main()
