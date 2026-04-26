from __future__ import annotations

import json
import unittest
from io import BytesIO
from urllib.error import HTTPError, URLError
from unittest.mock import patch

from fractal_agent_lab.adapters.base import AdapterStepRequest
from fractal_agent_lab.adapters.openrouter import OpenRouterAdapter
from fractal_agent_lab.core.errors import RuntimeBoundaryError, StepExecutionError


class OpenRouterAdapterTests(unittest.TestCase):
    def test_execute_step_returns_json_object_output(self) -> None:
        captured: dict[str, object] = {}

        def fake_transport(*, url, headers, payload, timeout_seconds):
            captured["url"] = url
            captured["headers"] = headers
            captured["payload"] = payload
            captured["timeout_seconds"] = timeout_seconds
            return (
                200,
                json.dumps(
                    {
                        "id": "resp-1",
                        "model": "openrouter/test-model",
                        "choices": [
                            {
                                "message": {
                                    "content": '{"clarified_idea":"x","recommended_mvp_direction":"y"}',
                                },
                                "finish_reason": "stop",
                            },
                        ],
                        "usage": {"prompt_tokens": 12, "completion_tokens": 7},
                    },
                ),
            )

        adapter = OpenRouterAdapter(
            provider_config={"api_key_env": "OPENROUTER_API_KEY", "timeout_seconds": 12},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        result = adapter.execute_step(_request())

        self.assertEqual("openrouter", result.provider)
        self.assertEqual("openrouter/test-model", result.model)
        self.assertEqual("x", result.output["clarified_idea"])
        self.assertTrue(result.raw["openrouter"])
        self.assertEqual("test-model", result.raw["requested_model"])
        self.assertEqual("openrouter/test-model", result.raw["response_model"])
        payload = captured["payload"]
        self.assertEqual("test-model", payload["model"])
        messages = payload["messages"]
        self.assertEqual("system", messages[0]["role"])
        self.assertIn("Return exactly one valid JSON object", messages[0]["content"])

    def test_missing_model_raises_runtime_boundary_error(self) -> None:
        request = _request()
        request.model = None
        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=_unused_transport,
        )

        with self.assertRaises(RuntimeBoundaryError):
            adapter.execute_step(request)

    def test_missing_api_key_raises_runtime_boundary_error(self) -> None:
        adapter = OpenRouterAdapter(environment={}, transport=_unused_transport)

        with self.assertRaises(RuntimeBoundaryError):
            adapter.execute_step(_request())

    def test_non_success_status_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 503, "service unavailable"

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertTrue(raised.exception.details["fallback_eligible"])
        self.assertEqual("http_status", raised.exception.details["failure_stage"])

    def test_client_error_status_is_not_fallback_eligible(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 400, "bad request"

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertFalse(raised.exception.details["fallback_eligible"])
        self.assertEqual(400, raised.exception.details["status_code"])

    def test_real_http_error_uses_non_success_status_path(self) -> None:
        adapter = OpenRouterAdapter(environment={"OPENROUTER_API_KEY": "secret"})
        http_error = HTTPError(
            url="https://openrouter.ai/api/v1/chat/completions",
            code=503,
            msg="service unavailable",
            hdrs=None,
            fp=BytesIO(b'{"error":"provider_down"}'),
        )

        with patch("fractal_agent_lab.adapters.openrouter.adapter.urlopen", side_effect=http_error):
            with self.assertRaises(StepExecutionError) as raised:
                adapter.execute_step(_request())

        self.assertEqual("OpenRouter returned a non-success status.", str(raised.exception))
        self.assertEqual(503, raised.exception.details["status_code"])
        self.assertTrue(raised.exception.details["fallback_eligible"])

    def test_invalid_envelope_json_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 200, "not-json"

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertFalse(raised.exception.details["fallback_eligible"])
        self.assertEqual("response_envelope", raised.exception.details["failure_stage"])

    def test_missing_first_choice_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"choices": []})

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertFalse(raised.exception.details["fallback_eligible"])
        self.assertEqual("response_content", raised.exception.details["failure_stage"])

    def test_missing_message_mapping_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"choices": [{"message": None}]})

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError):
            adapter.execute_step(_request())

    def test_empty_message_content_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"choices": [{"message": {"content": "   "}}]})

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError):
            adapter.execute_step(_request())

    def test_url_error_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            raise URLError("network down")

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertEqual("OpenRouter request failed.", str(raised.exception))
        self.assertTrue(raised.exception.details["fallback_eligible"])
        self.assertEqual("transport", raised.exception.details["failure_stage"])

    def test_retries_rate_limit_status_then_succeeds(self) -> None:
        responses = [(429, "rate limited"), (200, _success_body())]

        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return responses.pop(0)

        adapter = OpenRouterAdapter(
            provider_config={"retry": {"max_retries": 1, "backoff_seconds": 0.0}},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        result = adapter.execute_step(_request())

        provider_retry = result.raw["provider_retry"]
        self.assertTrue(provider_retry["used"])
        self.assertEqual(2, provider_retry["attempt_count"])
        self.assertEqual(1, provider_retry["retry_count"])
        self.assertFalse(provider_retry["exhausted"])
        self.assertEqual([], responses)

    def test_retries_server_error_status_then_succeeds(self) -> None:
        responses = [(503, "service unavailable"), (200, _success_body())]

        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return responses.pop(0)

        adapter = OpenRouterAdapter(
            provider_config={"retry": {"max_retries": 1, "backoff_seconds": 0.0}},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        result = adapter.execute_step(_request())

        self.assertEqual("ok", result.output["clarified_idea"])
        self.assertTrue(result.raw["provider_retry"]["used"])
        self.assertEqual(2, result.raw["provider_retry"]["attempt_count"])

    def test_rate_limit_retry_exhaustion_preserves_retry_details(self) -> None:
        responses = [(429, "rate limited"), (429, "still limited")]

        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return responses.pop(0)

        adapter = OpenRouterAdapter(
            provider_config={"retry": {"max_retries": 1, "backoff_seconds": 0.0}},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        provider_retry = raised.exception.details["provider_retry"]
        self.assertEqual(429, raised.exception.details["status_code"])
        self.assertTrue(raised.exception.details["fallback_eligible"])
        self.assertTrue(provider_retry["used"])
        self.assertTrue(provider_retry["recoverable"])
        self.assertTrue(provider_retry["exhausted"])
        self.assertEqual(429, provider_retry["final_status_code"])
        self.assertEqual("http_status", provider_retry["failure_stage"])
        self.assertEqual(2, provider_retry["attempt_count"])
        self.assertEqual(1, provider_retry["retry_count"])

    def test_client_error_status_does_not_retry_when_retry_is_configured(self) -> None:
        calls = 0

        def fake_transport(*, url, headers, payload, timeout_seconds):
            nonlocal calls
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            calls += 1
            return 400, "bad request"

        adapter = OpenRouterAdapter(
            provider_config={"retry": {"max_retries": 3, "backoff_seconds": 0.0}},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        provider_retry = raised.exception.details["provider_retry"]
        self.assertEqual(1, calls)
        self.assertFalse(raised.exception.details["fallback_eligible"])
        self.assertFalse(provider_retry["used"])
        self.assertFalse(provider_retry["recoverable"])
        self.assertFalse(provider_retry["exhausted"])
        self.assertEqual(400, provider_retry["final_status_code"])

    def test_retries_url_error_then_succeeds(self) -> None:
        responses = [URLError("network down"), (200, _success_body())]

        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            response = responses.pop(0)
            if isinstance(response, Exception):
                raise response
            return response

        adapter = OpenRouterAdapter(
            provider_config={"retry": {"max_retries": 1, "backoff_seconds": 0.0}},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        result = adapter.execute_step(_request())

        self.assertEqual("ok", result.output["clarified_idea"])
        self.assertTrue(result.raw["provider_retry"]["used"])
        self.assertEqual(2, result.raw["provider_retry"]["attempt_count"])

    def test_retries_os_error_then_succeeds(self) -> None:
        responses = [OSError("socket reset"), (200, _success_body())]

        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            response = responses.pop(0)
            if isinstance(response, Exception):
                raise response
            return response

        adapter = OpenRouterAdapter(
            provider_config={"retry": {"max_retries": 1, "backoff_seconds": 0.0}},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        result = adapter.execute_step(_request())

        self.assertEqual("ok", result.output["clarified_idea"])
        self.assertTrue(result.raw["provider_retry"]["used"])
        self.assertEqual(2, result.raw["provider_retry"]["attempt_count"])

    def test_nonzero_backoff_uses_sleep_between_retries(self) -> None:
        responses = [(503, "service unavailable"), (200, _success_body())]

        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return responses.pop(0)

        adapter = OpenRouterAdapter(
            provider_config={"retry": {"max_retries": 1, "backoff_seconds": 0.25}},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with patch("fractal_agent_lab.adapters.openrouter.adapter.time.sleep") as sleep:
            result = adapter.execute_step(_request())

        self.assertEqual("ok", result.output["clarified_idea"])
        sleep.assert_called_once_with(0.25)
        self.assertTrue(result.raw["provider_retry"]["used"])

    def test_invalid_retry_config_raises_runtime_boundary_error(self) -> None:
        cases = [
            ({"retry": None}, "retry"),
            ({"retry": {"max_retries": -1}}, "retry.max_retries"),
            ({"retry": {"max_retries": 4}}, "retry.max_retries"),
            ({"retry": {"max_retries": "1"}}, "retry.max_retries"),
            ({"retry": {"backoff_seconds": -1}}, "retry.backoff_seconds"),
            ({"retry": {"backoff_seconds": 11}}, "retry.backoff_seconds"),
        ]
        for provider_config, config_key in cases:
            with self.subTest(config_key=config_key, provider_config=provider_config):
                adapter = OpenRouterAdapter(
                    provider_config=provider_config,
                    environment={"OPENROUTER_API_KEY": "secret"},
                    transport=_unused_transport,
                )

                with self.assertRaises(RuntimeBoundaryError) as raised:
                    adapter.execute_step(_request())

                self.assertEqual("openrouter", raised.exception.details["provider"])
                self.assertEqual(config_key, raised.exception.details["config_key"])

    def test_malformed_retry_block_raises_runtime_boundary_error(self) -> None:
        adapter = OpenRouterAdapter(
            provider_config={"retry": "not-a-mapping"},
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=_unused_transport,
        )

        with self.assertRaises(RuntimeBoundaryError) as raised:
            adapter.execute_step(_request())

        self.assertEqual("retry", raised.exception.details["config_key"])

    def test_invalid_content_json_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"choices": [{"message": {"content": "not-json"}}]})

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError):
            adapter.execute_step(_request())

    def test_non_object_json_content_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, headers, payload, timeout_seconds):
            _ = url
            _ = headers
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"choices": [{"message": {"content": "[]"}}]})

        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=fake_transport,
        )

        with self.assertRaises(StepExecutionError):
            adapter.execute_step(_request())

    def test_non_json_serializable_request_payload_raises_step_execution_error(self) -> None:
        adapter = OpenRouterAdapter(
            environment={"OPENROUTER_API_KEY": "secret"},
            transport=_unused_transport,
        )
        request = _request()
        request.input_payload = {"idea": object()}

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(request)

        self.assertEqual("OpenRouter request payload is not JSON-serializable.", str(raised.exception))
        self.assertFalse(raised.exception.details["fallback_eligible"])
        self.assertEqual("request_payload", raised.exception.details["failure_stage"])


def _request() -> AdapterStepRequest:
    return AdapterStepRequest(
        run_id="run-1",
        workflow_id="h1.single.v1",
        step_id="single",
        agent_id="h1_single_agent",
        role="h1.single",
        input_payload={"idea": "AI founder copilot"},
        context={"step_results": {}},
        instructions="Return keys: clarified_idea, weak_points.",
        model_policy_ref="finalizer",
        prompt_version="h1/single/v1",
        model="test-model",
    )


def _success_body() -> str:
    return json.dumps(
        {
            "id": "resp-retry-success",
            "model": "openrouter/test-model",
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "clarified_idea": "ok",
                                "recommended_mvp_direction": "ship bounded retry",
                            },
                        ),
                    },
                    "finish_reason": "stop",
                },
            ],
        },
    )


def _unused_transport(*, url, headers, payload, timeout_seconds):
    _ = url
    _ = headers
    _ = payload
    _ = timeout_seconds
    raise AssertionError("Transport should not be called.")


if __name__ == "__main__":
    unittest.main()
