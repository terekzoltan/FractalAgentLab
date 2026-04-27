from __future__ import annotations

import json
import unittest

from fractal_agent_lab.adapters.base import AdapterStepRequest
from fractal_agent_lab.adapters.local import LocalModelAdapter
from fractal_agent_lab.core.errors import RuntimeBoundaryError, StepExecutionError


class LocalModelAdapterTests(unittest.TestCase):
    def test_execute_step_returns_output_object(self) -> None:
        captured: dict[str, object] = {}

        def fake_transport(*, url, payload, timeout_seconds):
            captured["url"] = url
            captured["payload"] = payload
            captured["timeout_seconds"] = timeout_seconds
            return 200, json.dumps({"model": "local/test-model", "output": {"clarified_idea": "x"}})

        adapter = LocalModelAdapter(
            provider_config={"timeout_seconds": 12},
            transport=fake_transport,
        )

        result = adapter.execute_step(_request())

        self.assertEqual("local", result.provider)
        self.assertEqual("local/test-model", result.model)
        self.assertEqual("x", result.output["clarified_idea"])
        self.assertTrue(result.raw["local"])
        self.assertEqual("test-model", result.raw["requested_model"])
        self.assertEqual("local/test-model", result.raw["response_model"])
        self.assertEqual("local://injected-transport", captured["url"])
        self.assertEqual(12, captured["timeout_seconds"])
        payload = captured["payload"]
        self.assertEqual("test-model", payload["model"])
        self.assertEqual("h1.single.v1", payload["request"]["workflow_id"])

    def test_execute_step_accepts_json_object_content(self) -> None:
        def fake_transport(*, url, payload, timeout_seconds):
            _ = url
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"choices": [{"message": {"content": json.dumps({"clarified_idea": "content"})}}]})

        adapter = LocalModelAdapter(transport=fake_transport)

        result = adapter.execute_step(_request())

        self.assertEqual("content", result.output["clarified_idea"])

    def test_missing_model_raises_runtime_boundary_error(self) -> None:
        request = _request()
        request.model = None
        adapter = LocalModelAdapter(transport=_unused_transport)

        with self.assertRaises(RuntimeBoundaryError):
            adapter.execute_step(request)

    def test_missing_endpoint_raises_when_default_transport_is_used(self) -> None:
        adapter = LocalModelAdapter()

        with self.assertRaises(RuntimeBoundaryError) as raised:
            adapter.execute_step(_request())

        self.assertEqual("local", raised.exception.details["provider"])
        self.assertEqual("endpoint_url", raised.exception.details["config_key"])

    def test_invalid_timeout_config_raises_runtime_boundary_error(self) -> None:
        adapter = LocalModelAdapter(provider_config={"timeout_seconds": 0}, transport=_unused_transport)

        with self.assertRaises(RuntimeBoundaryError) as raised:
            adapter.execute_step(_request())

        self.assertEqual("timeout_seconds", raised.exception.details["config_key"])

    def test_non_success_status_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, payload, timeout_seconds):
            _ = url
            _ = payload
            _ = timeout_seconds
            return 503, "service unavailable"

        adapter = LocalModelAdapter(transport=fake_transport)

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertEqual(503, raised.exception.details["status_code"])
        self.assertFalse(raised.exception.details["fallback_eligible"])

    def test_invalid_envelope_json_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, payload, timeout_seconds):
            _ = url
            _ = payload
            _ = timeout_seconds
            return 200, "not-json"

        adapter = LocalModelAdapter(transport=fake_transport)

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertEqual("response_envelope", raised.exception.details["failure_stage"])

    def test_non_object_envelope_json_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, payload, timeout_seconds):
            _ = url
            _ = payload
            _ = timeout_seconds
            return 200, "[]"

        adapter = LocalModelAdapter(transport=fake_transport)

        with self.assertRaises(StepExecutionError):
            adapter.execute_step(_request())

    def test_missing_output_or_content_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, payload, timeout_seconds):
            _ = url
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"model": "local/test-model"})

        adapter = LocalModelAdapter(transport=fake_transport)

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(_request())

        self.assertEqual("response_content", raised.exception.details["failure_stage"])

    def test_invalid_content_json_raises_step_execution_error(self) -> None:
        def fake_transport(*, url, payload, timeout_seconds):
            _ = url
            _ = payload
            _ = timeout_seconds
            return 200, json.dumps({"choices": [{"message": {"content": "not-json"}}]})

        adapter = LocalModelAdapter(transport=fake_transport)

        with self.assertRaises(StepExecutionError):
            adapter.execute_step(_request())

    def test_non_json_serializable_request_payload_raises_step_execution_error(self) -> None:
        adapter = LocalModelAdapter(transport=_unused_transport)
        request = _request()
        request.input_payload = {"idea": object()}

        with self.assertRaises(StepExecutionError) as raised:
            adapter.execute_step(request)

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


def _unused_transport(*, url, payload, timeout_seconds):
    _ = url
    _ = payload
    _ = timeout_seconds
    raise AssertionError("Transport should not be called.")


if __name__ == "__main__":
    unittest.main()
