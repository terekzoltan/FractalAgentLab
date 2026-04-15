from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from fractal_agent_lab.adapters.base import AdapterStepResult
from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_single_agent_pack
from fractal_agent_lab.core.errors import StepExecutionError
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
        step_payload = step_results[H1_SINGLE_STEP_ID]
        self.assertEqual("mock", step_payload["raw"]["routing"]["selected_provider"])
        self.assertEqual("default_provider", step_payload["raw"]["routing"]["selection_source"])
        self.assertEqual("none", step_payload["raw"]["routing"]["fallback_policy"])

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
        self.assertEqual("openrouter", step_payload["raw"]["routing"]["selected_provider"])
        self.assertEqual("default_provider", step_payload["raw"]["routing"]["selection_source"])
        self.assertEqual("explicit_v1", step_payload["raw"]["routing"]["selection_mode"])
        self.assertEqual("none", step_payload["raw"]["routing"]["fallback_policy"])
        self.assertEqual(1, len(step_payload["raw"]["provider_attempts"]))
        self.assertFalse(step_payload["raw"]["fallback"]["used"])

    def test_recoverable_openrouter_failure_uses_single_mock_fallback(self) -> None:
        workflow = build_h1_single_workflow_spec()
        mock_adapter = _RecordingMockAdapter()
        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=build_h1_single_agent_pack(),
                providers_config={
                    "default_provider": "openrouter",
                    "routing": {"fallback_policy": "conservative_mock"},
                    "providers": {
                        "openrouter": {
                            "enabled": True,
                        },
                    },
                },
                model_policy_config={
                    "tier_defaults": {
                        "finalizer": "openrouter/test-model",
                    },
                },
                adapters_by_provider={
                    "openrouter": _FailingOpenRouterAdapter(fallback_eligible=True),
                    "mock": mock_adapter,
                },
            ),
        )

        run_state = executor.execute(
            workflow=workflow,
            input_payload={"idea": "AI founder copilot for idea refinement"},
        )

        self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
        self.assertEqual(1, mock_adapter.calls)
        step_payload = run_state.step_results[H1_SINGLE_STEP_ID]
        self.assertEqual("mock", step_payload["provider"])
        self.assertTrue(step_payload["raw"]["fallback"]["used"])
        self.assertEqual("conservative_mock", step_payload["raw"]["fallback"]["policy"])
        self.assertEqual("openrouter", step_payload["raw"]["fallback"]["from_provider"])
        self.assertEqual("mock", step_payload["raw"]["fallback"]["to_provider"])
        self.assertIsNone(step_payload["model"])
        attempts = step_payload["raw"]["provider_attempts"]
        self.assertEqual(2, len(attempts))
        self.assertEqual("openrouter", attempts[0]["provider"])
        self.assertEqual("failed", attempts[0]["outcome"])
        self.assertTrue(attempts[0]["fallback_eligible"])
        self.assertEqual("mock", attempts[1]["provider"])
        self.assertEqual("succeeded", attempts[1]["outcome"])

    def test_nonrecoverable_openrouter_failure_does_not_fallback(self) -> None:
        workflow = build_h1_single_workflow_spec()
        mock_adapter = _RecordingMockAdapter()
        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=build_h1_single_agent_pack(),
                providers_config={
                    "default_provider": "openrouter",
                    "routing": {"fallback_policy": "conservative_mock"},
                    "providers": {
                        "openrouter": {
                            "enabled": True,
                        },
                    },
                },
                model_policy_config={
                    "tier_defaults": {
                        "finalizer": "openrouter/test-model",
                    },
                },
                adapters_by_provider={
                    "openrouter": _FailingOpenRouterAdapter(fallback_eligible=False),
                    "mock": mock_adapter,
                },
            ),
        )

        run_state = executor.execute(
            workflow=workflow,
            input_payload={"idea": "AI founder copilot for idea refinement"},
        )

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertEqual(0, mock_adapter.calls)
        failure = run_state.failure or {}
        details = failure.get("details") if isinstance(failure.get("details"), dict) else {}
        self.assertEqual("conservative_mock", details.get("fallback_policy"))
        self.assertEqual("openrouter", details.get("selected_provider"))
        self.assertEqual(1, len(details.get("provider_attempts", [])))

    def test_recoverable_openrouter_failure_does_not_fallback_when_policy_is_none(self) -> None:
        workflow = build_h1_single_workflow_spec()
        mock_adapter = _RecordingMockAdapter()
        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=build_h1_single_agent_pack(),
                providers_config={
                    "default_provider": "openrouter",
                    "providers": {
                        "openrouter": {
                            "enabled": True,
                        },
                    },
                },
                model_policy_config={
                    "tier_defaults": {
                        "finalizer": "openrouter/test-model",
                    },
                },
                adapters_by_provider={
                    "openrouter": _FailingOpenRouterAdapter(fallback_eligible=True),
                    "mock": mock_adapter,
                },
            ),
        )

        run_state = executor.execute(
            workflow=workflow,
            input_payload={"idea": "AI founder copilot for idea refinement"},
        )

        self.assertEqual(RunStatus.FAILED, run_state.status)
        self.assertEqual(0, mock_adapter.calls)


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


class _FailingOpenRouterAdapter:
    name = "openrouter"

    def __init__(self, *, fallback_eligible: bool) -> None:
        self._fallback_eligible = fallback_eligible

    def execute_step(self, request) -> AdapterStepResult:
        raise StepExecutionError(
            "OpenRouter returned a non-success status.",
            details={
                "provider": self.name,
                "workflow_id": request.workflow_id,
                "step_id": request.step_id,
                "status_code": 503,
                "fallback_eligible": self._fallback_eligible,
                "failure_stage": "http_status",
            },
        )


class _RecordingMockAdapter:
    name = "mock"

    def __init__(self) -> None:
        self.calls = 0

    def execute_step(self, request) -> AdapterStepResult:
        self.calls += 1
        return AdapterStepResult(
            output={
                "clarified_idea": request.input_payload.get("idea", ""),
                "strongest_assumptions": ["assumption"],
                "weak_points": ["weak"],
                "alternatives": ["alt"],
                "recommended_mvp_direction": "mvp",
                "next_3_validation_steps": ["step1", "step2", "step3"],
            },
            provider=self.name,
            model=request.model,
            raw={"mock_fallback": True},
        )


if __name__ == "__main__":
    unittest.main()
