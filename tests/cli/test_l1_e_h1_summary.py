from __future__ import annotations

import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_agent_pack
from fractal_agent_lab.cli.formatting import build_json_output, format_run_summary_text
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.tracing import InMemoryTraceEmitter
from fractal_agent_lab.workflows import build_h1_manager_workflow_spec


class L1EH1SummaryTests(unittest.TestCase):
    def test_text_summary_includes_h1_workflow_and_orchestration_sections(self) -> None:
        run_state, events = _run_h1_manager_workflow()

        summary = format_run_summary_text(
            run_state,
            steps_total=4,
            trace_events_count=len(events),
        )

        self.assertIn("- workflow_summary:", summary)
        self.assertIn("clarified_idea", summary)
        self.assertIn("recommended_mvp_direction", summary)
        self.assertIn("- orchestration_summary:", summary)
        self.assertIn("manager_step_id", summary)
        self.assertIn("turn_count", summary)

    def test_json_summary_adds_workflow_and_orchestration_sections(self) -> None:
        run_state, events = _run_h1_manager_workflow()

        payload = build_json_output(
            run_state,
            events,
            steps_total=4,
            include_trace=True,
        )

        self.assertIn("summary", payload)
        self.assertIn("workflow_summary", payload)
        self.assertIn("orchestration_summary", payload)
        self.assertIn("trace_summary", payload)
        self.assertIn("event_counts", payload["trace_summary"])
        self.assertIn("lane_counts", payload["trace_summary"])
        self.assertEqual("h1.manager.v1", payload["workflow_summary"]["workflow_id"])


def _run_h1_manager_workflow():
    emitter = InMemoryTraceEmitter()
    workflow = build_h1_manager_workflow_spec()
    executor = WorkflowExecutor(
        step_runner=build_step_runner(
            agent_specs_by_id=build_h1_agent_pack(),
            providers_config={"default_provider": "mock"},
            model_policy_config={
                "tier_defaults": {
                    "cheap_worker": "gpt-4o-mini",
                    "specialist": "gpt-5.4-nano",
                    "finalizer": "gpt-5.4-mini",
                },
            },
        ),
        emitter=emitter,
    )
    run_state = executor.execute(
        workflow=workflow,
        input_payload={"idea": "AI founder copilot for idea refinement"},
    )
    return run_state, emitter.events


if __name__ == "__main__":
    unittest.main()
