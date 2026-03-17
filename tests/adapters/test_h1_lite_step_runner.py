from __future__ import annotations

import unittest

from fractal_agent_lab.adapters import MockAdapter, build_step_runner
from fractal_agent_lab.agents import H1_LITE_PROMPT_VERSION
from fractal_agent_lab.workflows import build_h1_lite_agent_pack, build_h1_lite_workflow_spec
from fractal_agent_lab.core.models import RunState


class H1LiteStepRunnerTests(unittest.TestCase):
    def test_step_runner_passes_prompt_and_policy_metadata_to_adapter(self) -> None:
        captured: dict[str, object] = {}

        def capture_request(request: object) -> dict[str, object]:
            captured["request"] = request
            req = request
            return {
                "role": req.role,
                "instructions": req.instructions,
                "model_policy_ref": req.model_policy_ref,
                "prompt_version": req.prompt_version,
            }

        step_runner = build_step_runner(
            agent_specs_by_id=build_h1_lite_agent_pack(),
            providers_config={"default_provider": "mock"},
            model_policy_config={"tier_defaults": {"cheap_worker": "gpt-4o-mini"}},
            adapters_by_provider={"mock": MockAdapter(scripted_responses={"__default__": capture_request})},
        )
        workflow = build_h1_lite_workflow_spec()
        run_state = RunState(run_id="run-1", workflow_id=workflow.workflow_id, input_payload={"idea": "x"})

        result = step_runner(run_state=run_state, workflow=workflow, step=workflow.steps[0])

        self.assertIn("request", captured)
        self.assertEqual("h1.intake", result["output"]["role"])
        self.assertEqual("cheap_worker", result["output"]["model_policy_ref"])
        self.assertEqual(H1_LITE_PROMPT_VERSION, result["output"]["prompt_version"])
        self.assertIn("Normalize the raw startup idea input", result["output"]["instructions"])
        self.assertEqual("gpt-4o-mini", result["model"])

    def test_h1_lite_mock_execution_produces_structured_outputs_and_model_tiers(self) -> None:
        step_runner = build_step_runner(
            agent_specs_by_id=build_h1_lite_agent_pack(),
            providers_config={"default_provider": "mock"},
            model_policy_config={
                "tier_defaults": {
                    "cheap_worker": "gpt-4o-mini",
                    "specialist": "gpt-5.4-nano",
                    "finalizer": "gpt-5.4-mini",
                },
            },
        )
        workflow = build_h1_lite_workflow_spec()
        run_state = RunState(
            run_id="run-2",
            workflow_id=workflow.workflow_id,
            input_payload={"idea": "AI founder assistant"},
        )

        intake_result = step_runner(run_state=run_state, workflow=workflow, step=workflow.steps[0])
        run_state.step_results["intake"] = intake_result
        planner_result = step_runner(run_state=run_state, workflow=workflow, step=workflow.steps[1])
        run_state.step_results["planner"] = planner_result
        synthesizer_result = step_runner(run_state=run_state, workflow=workflow, step=workflow.steps[2])

        self.assertEqual("gpt-4o-mini", intake_result["model"])
        self.assertEqual("gpt-5.4-nano", planner_result["model"])
        self.assertEqual("gpt-5.4-mini", synthesizer_result["model"])

        self.assertIn("idea_summary", intake_result["output"])
        self.assertIn("validation_axes", planner_result["output"])
        self.assertIn("recommended_mvp_direction", synthesizer_result["output"])
        self.assertEqual(H1_LITE_PROMPT_VERSION, synthesizer_result["raw"]["prompt_version"])
        self.assertTrue(synthesizer_result["raw"]["instructions_present"])


if __name__ == "__main__":
    unittest.main()
