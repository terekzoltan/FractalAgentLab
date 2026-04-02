from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.errors import RunTimeoutError
from fractal_agent_lab.core.events import TraceEventType
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.tracing import InMemoryTraceEmitter


def _build_linear_workflow() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id="test.failure.envelope",
        name="Failure Envelope Test",
        execution_mode=WorkflowExecutionMode.LINEAR,
        steps=[WorkflowStepSpec(step_id="s1", agent_id="a1")],
    )


class FailureEnvelopeTests(unittest.TestCase):
    def test_timeout_populates_run_failure_and_run_timed_out_payload(self) -> None:
        workflow = _build_linear_workflow()
        emitter = InMemoryTraceEmitter()

        def runner(*, run_state, workflow, step):
            _ = run_state
            _ = workflow
            _ = step
            raise RunTimeoutError("timeout for testing", details={"source": "test"})

        run_state = WorkflowExecutor(step_runner=runner, emitter=emitter).execute(workflow)

        self.assertEqual(RunStatus.TIMED_OUT, run_state.status)
        self.assertIsInstance(run_state.failure, dict)
        self.assertEqual("timeout", run_state.failure.get("category"))
        self.assertEqual("run_timeout_error", run_state.failure.get("code"))

        timed_out_events = [
            event for event in emitter.events if event.event_type == TraceEventType.RUN_TIMED_OUT
        ]
        self.assertEqual(1, len(timed_out_events))
        failure_envelope = timed_out_events[0].payload.get("failure_envelope")
        self.assertIsInstance(failure_envelope, dict)
        self.assertEqual("timeout", failure_envelope.get("category"))

    def test_status_transitions_record_pending_running_and_succeeded(self) -> None:
        workflow = _build_linear_workflow()

        run_state = WorkflowExecutor(
            step_runner=(lambda *, run_state, workflow, step: {"ok": True}),
        ).execute(workflow)

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        statuses = [item.get("status") for item in run_state.status_transitions if isinstance(item, dict)]
        self.assertEqual(["pending", "running", "succeeded"], statuses)


if __name__ == "__main__":
    unittest.main()
