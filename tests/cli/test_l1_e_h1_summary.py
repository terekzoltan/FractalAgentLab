from __future__ import annotations

import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_prompt_tags
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec
from fractal_agent_lab.cli.formatting import build_json_output, format_run_summary_text
from fractal_agent_lab.core.contracts import WorkflowSpec
from fractal_agent_lab.core.events import TraceEvent
from fractal_agent_lab.core.models import RunState
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.tracing import InMemoryTraceEmitter


H1_VARIANTS: tuple[str, ...] = ("h1.single.v1", "h1.manager.v1", "h1.handoff.v1")


class L1EH1SummaryTests(unittest.TestCase):
    def test_text_summary_includes_h1_workflow_summary_for_single_variant(self) -> None:
        run_state, events, workflow = _run_h1_workflow("h1.single.v1")

        summary = format_run_summary_text(
            run_state,
            steps_total=len(workflow.steps),
            trace_events_count=len(events),
        )

        self.assertIn("- workflow_summary:", summary)
        self.assertIn("clarified_idea", summary)
        self.assertIn("recommended_mvp_direction", summary)
        self.assertNotIn("- orchestration_summary:", summary)

    def test_text_summary_includes_h1_workflow_summary_for_handoff_variant(self) -> None:
        run_state, events, workflow = _run_h1_workflow("h1.handoff.v1")

        summary = format_run_summary_text(
            run_state,
            steps_total=len(workflow.steps),
            trace_events_count=len(events),
        )

        self.assertIn("- workflow_summary:", summary)
        self.assertIn("clarified_idea", summary)
        self.assertIn("recommended_mvp_direction", summary)
        self.assertNotIn("- orchestration_summary:", summary)

    def test_text_summary_includes_manager_orchestration_section_for_manager_variant(self) -> None:
        run_state, events, workflow = _run_h1_workflow("h1.manager.v1")

        summary = format_run_summary_text(
            run_state,
            steps_total=len(workflow.steps),
            trace_events_count=len(events),
        )

        self.assertIn("- workflow_summary:", summary)
        self.assertIn("clarified_idea", summary)
        self.assertIn("- orchestration_summary:", summary)
        self.assertIn("manager_step_id", summary)
        self.assertIn("turn_count", summary)

    def test_json_summary_adds_h1_workflow_summary_for_all_variants(self) -> None:
        for workflow_id in H1_VARIANTS:
            with self.subTest(workflow_id=workflow_id):
                run_state, events, workflow = _run_h1_workflow(workflow_id)

                payload = build_json_output(
                    run_state,
                    events,
                    steps_total=len(workflow.steps),
                    include_trace=False,
                )

                self.assertIn("summary", payload)
                self.assertIn("workflow_summary", payload)
                self.assertEqual(workflow_id, payload["workflow_summary"]["workflow_id"])
                self.assertIn("clarified_idea", payload["workflow_summary"])
                self.assertIn("recommended_mvp_direction", payload["workflow_summary"])

    def test_json_summary_keeps_manager_orchestration_section_manager_specific(self) -> None:
        manager_state, manager_events, manager_workflow = _run_h1_workflow("h1.manager.v1")
        manager_payload = build_json_output(
            manager_state,
            manager_events,
            steps_total=len(manager_workflow.steps),
            include_trace=False,
        )
        self.assertIn("orchestration_summary", manager_payload)

        single_state, single_events, single_workflow = _run_h1_workflow("h1.single.v1")
        single_payload = build_json_output(
            single_state,
            single_events,
            steps_total=len(single_workflow.steps),
            include_trace=False,
        )
        self.assertNotIn("orchestration_summary", single_payload)

        handoff_state, handoff_events, handoff_workflow = _run_h1_workflow("h1.handoff.v1")
        handoff_payload = build_json_output(
            handoff_state,
            handoff_events,
            steps_total=len(handoff_workflow.steps),
            include_trace=False,
        )
        self.assertNotIn("orchestration_summary", handoff_payload)

    def test_json_trace_summary_preserves_parent_and_correlation_linkage(self) -> None:
        run_state, events, workflow = _run_h1_workflow("h1.handoff.v1")
        payload = build_json_output(
            run_state,
            events,
            steps_total=len(workflow.steps),
            include_trace=True,
        )

        self.assertIn("trace_summary", payload)
        trace_events = payload["trace_summary"]["events"]
        self.assertTrue(trace_events)
        self.assertTrue(any("parent_event_id" in event for event in trace_events))
        self.assertTrue(any("correlation_id" in event for event in trace_events))
        self.assertTrue(any(event.get("parent_event_id") for event in trace_events))
        self.assertTrue(any(event.get("correlation_id") for event in trace_events))

    def test_text_summary_includes_prompt_tags_when_present(self) -> None:
        run_state, events, workflow = _run_h1_workflow("h1.manager.v1")
        _inject_prompt_tags(run_state=run_state, workflow=workflow)

        summary = format_run_summary_text(
            run_state,
            steps_total=len(workflow.steps),
            trace_events_count=len(events),
        )

        self.assertIn("- prompt_tags:", summary)
        self.assertIn("pack_prompt_version", summary)
        self.assertIn("executed_step_prompt_versions", summary)

    def test_json_summary_includes_prompt_tags_when_present(self) -> None:
        run_state, events, workflow = _run_h1_workflow("h1.handoff.v1")
        _inject_prompt_tags(run_state=run_state, workflow=workflow)

        payload = build_json_output(
            run_state,
            events,
            steps_total=len(workflow.steps),
            include_trace=False,
        )

        self.assertIn("prompt_tags", payload)
        self.assertEqual("handoff", payload["prompt_tags"]["variant"])
        self.assertEqual("h1.handoff.prompt.v1", payload["prompt_tags"]["pack_prompt_version"])


def _run_h1_workflow(workflow_id: str) -> tuple[RunState, list[TraceEvent], WorkflowSpec]:
    emitter = InMemoryTraceEmitter()
    workflow = get_workflow_spec(workflow_id)
    executor = WorkflowExecutor(
        step_runner=build_step_runner(
            agent_specs_by_id=get_workflow_agent_specs(workflow_id),
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
    return run_state, emitter.events, workflow


def _inject_prompt_tags(*, run_state: RunState, workflow: WorkflowSpec) -> None:
    tags = build_h1_prompt_tags(
        workflow=workflow,
        agent_specs_by_id=get_workflow_agent_specs(workflow.workflow_id),
        step_results=run_state.step_results,
    )
    if tags is None:
        return

    output_payload = dict(run_state.output_payload or {})
    output_payload["prompt_tags"] = tags
    run_state.output_payload = output_payload


if __name__ == "__main__":
    unittest.main()
