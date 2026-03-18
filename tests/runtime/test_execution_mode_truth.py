from __future__ import annotations

import unittest

from fractal_agent_lab.cli.workflow_registry import get_workflow_spec
from fractal_agent_lab.core.contracts import WorkflowExecutionMode
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


if __name__ == "__main__":
    unittest.main()
