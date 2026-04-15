from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_single_agent_pack
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.workflows import H1_SINGLE_STEP_ID, H1_SINGLE_WORKFLOW_ID, build_h1_single_workflow_spec


class H1SingleStepRunnerTests(unittest.TestCase):
    def test_h1_single_workflow_runs_end_to_end_on_mock(self) -> None:
        workflow = build_h1_single_workflow_spec()
        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=build_h1_single_agent_pack(),
                providers_config={"default_provider": "mock"},
                model_policy_config={
                    "tier_defaults": {
                        "finalizer": "gpt-5.4-mini",
                    },
                },
            ),
        )

        run_state = executor.execute(
            workflow=workflow,
            input_payload={"idea": "AI founder copilot for idea refinement"},
        )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        self.assertEqual(H1_SINGLE_WORKFLOW_ID, run_state.workflow_id)
        self.assertIn(H1_SINGLE_STEP_ID, run_state.step_results)

        output_payload = run_state.output_payload or {}
        step_results = output_payload.get("step_results", {})
        self.assertIn(H1_SINGLE_STEP_ID, step_results)

        single_output = step_results[H1_SINGLE_STEP_ID]["output"]
        self.assertIn("clarified_idea", single_output)
        self.assertIn("weak_points", single_output)
        self.assertIn("recommended_mvp_direction", single_output)

    def test_h1_single_workflow_runs_with_openrouter_adapter_using_fake_transport(self) -> None:
        workflow = build_h1_single_workflow_spec()

        fake_response = _FakeHTTPResponse(
            status_code=200,
            body_text=json.dumps(
                {
                    "id": "resp-1",
                    "model": "openrouter/test-model",
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "clarified_idea": "AI founder copilot",
                                        "strongest_assumptions": ["Founders need sharper positioning."],
                                        "weak_points": ["Audience fit is still uncertain."],
                                        "alternatives": ["Narrow to pre-seed founders only."],
                                        "recommended_mvp_direction": "Start with a constrained refinement flow.",
                                        "next_3_validation_steps": [
                                            "Interview 3 founders",
                                            "Run 5 guided sessions",
                                            "Measure decision-speed delta",
                                        ],
                                    },
                                ),
                            },
                        },
                    ],
                },
            ),
        )

        with (
            patch.dict(
                "os.environ",
                {"OPENROUTER_API_KEY": "test-key"},
                clear=False,
            ),
            patch(
                "fractal_agent_lab.adapters.openrouter.adapter.urlopen",
                return_value=fake_response,
            ),
        ):
            executor = WorkflowExecutor(
                step_runner=build_step_runner(
                    agent_specs_by_id=build_h1_single_agent_pack(),
                    providers_config={
                        "default_provider": "openrouter",
                        "providers": {
                            "openrouter": {
                                "enabled": True,
                                "api_key_env": "OPENROUTER_API_KEY",
                                "chat_completions_url": "https://openrouter.ai/api/v1/chat/completions",
                            },
                        },
                    },
                    model_policy_config={
                        "tier_defaults": {
                            "finalizer": "openrouter/test-model",
                        },
                    },
                ),
            )

            run_state = executor.execute(
                workflow=workflow,
                input_payload={"idea": "AI founder copilot for idea refinement"},
            )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        self.assertEqual(H1_SINGLE_WORKFLOW_ID, run_state.workflow_id)
        self.assertIn(H1_SINGLE_STEP_ID, run_state.step_results)

        step_payload = run_state.step_results[H1_SINGLE_STEP_ID]
        self.assertEqual("openrouter", step_payload["provider"])
        self.assertEqual("openrouter/test-model", step_payload["model"])
        self.assertTrue(step_payload["raw"]["openrouter"])
        self.assertEqual("openrouter/test-model", step_payload["raw"]["requested_model"])
        self.assertEqual("openrouter/test-model", step_payload["raw"]["response_model"])


class _FakeHTTPResponse:
    def __init__(self, *, status_code: int, body_text: str) -> None:
        self._status_code = status_code
        self._body = body_text.encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        _ = exc_type
        _ = exc
        _ = tb

    def getcode(self) -> int:
        return self._status_code

    def read(self) -> bytes:
        return self._body


if __name__ == "__main__":
    unittest.main()
