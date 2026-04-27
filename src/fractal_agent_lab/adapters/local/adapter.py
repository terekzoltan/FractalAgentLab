from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Mapping, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult
from fractal_agent_lab.core.errors import RuntimeBoundaryError, StepExecutionError


class LocalModelTransport(Protocol):
    def __call__(
        self,
        *,
        url: str,
        payload: Mapping[str, Any],
        timeout_seconds: float,
    ) -> tuple[int, str]:
        ...


@dataclass(slots=True)
class LocalModelAdapter:
    name: str = "local"
    provider_config: Mapping[str, Any] | None = None
    transport: LocalModelTransport | None = None

    def execute_step(self, request: AdapterStepRequest) -> AdapterStepResult:
        if not request.model:
            raise RuntimeBoundaryError(
                "LocalModelAdapter requires an explicit model selection.",
                details={
                    "provider": self.name,
                    "step_id": request.step_id,
                    "workflow_id": request.workflow_id,
                },
            )

        transport = self.transport or _urllib_transport
        url = self._endpoint_url(require_config=self.transport is None)
        timeout_seconds = self._timeout_seconds()
        payload = {
            "model": request.model,
            "request": self._build_request_payload(request),
        }
        _serialize_payload(payload, provider=self.name, workflow_id=request.workflow_id, step_id=request.step_id)

        try:
            status_code, body_text = transport(
                url=url,
                payload=payload,
                timeout_seconds=timeout_seconds,
            )
        except URLError as error:
            raise _step_failure(
                "Local model request failed.",
                provider=self.name,
                workflow_id=request.workflow_id,
                step_id=request.step_id,
                error=error,
                failure_stage="transport",
            ) from error
        except OSError as error:
            raise _step_failure(
                "Local model transport failed.",
                provider=self.name,
                workflow_id=request.workflow_id,
                step_id=request.step_id,
                error=error,
                failure_stage="transport",
            ) from error

        if status_code < 200 or status_code >= 300:
            raise _step_failure(
                "Local model endpoint returned a non-success status.",
                provider=self.name,
                workflow_id=request.workflow_id,
                step_id=request.step_id,
                status_code=status_code,
                failure_stage="http_status",
            )

        response = _parse_json_object(
            body_text,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            error_message="Local model endpoint returned invalid JSON envelope.",
            failure_stage="response_envelope",
        )
        output = _extract_output_object(
            response,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
        )
        response_model = response.get("model")
        executed_model = response_model if isinstance(response_model, str) and response_model else request.model

        return AdapterStepResult(
            output=output,
            provider=self.name,
            model=executed_model,
            raw={
                "local": True,
                "requested_model": request.model,
                "response_model": response_model if isinstance(response_model, str) and response_model else None,
                "endpoint_url": url,
            },
        )

    def _provider_config(self) -> Mapping[str, Any]:
        if isinstance(self.provider_config, Mapping):
            return self.provider_config
        return {}

    def _endpoint_url(self, *, require_config: bool) -> str:
        raw_url = self._provider_config().get("endpoint_url")
        if isinstance(raw_url, str) and raw_url.strip():
            return raw_url
        if require_config:
            raise RuntimeBoundaryError(
                "Local provider config 'endpoint_url' must be a non-empty string when using the default transport.",
                details={"provider": self.name, "config_key": "endpoint_url"},
            )
        return "local://injected-transport"

    def _timeout_seconds(self) -> float:
        raw_timeout = self._provider_config().get("timeout_seconds")
        if raw_timeout is None:
            return 30.0
        if isinstance(raw_timeout, (int, float)) and not isinstance(raw_timeout, bool) and raw_timeout > 0:
            return float(raw_timeout)
        raise RuntimeBoundaryError(
            "Local provider config 'timeout_seconds' must be a positive number.",
            details={"provider": self.name, "config_key": "timeout_seconds"},
        )

    def _build_request_payload(self, request: AdapterStepRequest) -> dict[str, Any]:
        return {
            "run_id": request.run_id,
            "workflow_id": request.workflow_id,
            "step_id": request.step_id,
            "agent_id": request.agent_id,
            "role": request.role,
            "step_description": request.step_description,
            "instruction_ref": request.instruction_ref,
            "model_policy_ref": request.model_policy_ref,
            "prompt_version": request.prompt_version,
            "input_payload": request.input_payload,
            "context": request.context,
            "agent_metadata": request.agent_metadata,
        }


def _urllib_transport(
    *,
    url: str,
    payload: Mapping[str, Any],
    timeout_seconds: float,
) -> tuple[int, str]:
    body = _serialize_payload(payload, provider="local", workflow_id="unknown", step_id="unknown").encode("utf-8")
    request = Request(url=url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            status_code = int(response.getcode())
            response_body = response.read().decode("utf-8", errors="replace")
    except HTTPError as error:
        response_body = error.read().decode("utf-8", errors="replace") if error.fp is not None else ""
        return int(error.code), response_body
    return status_code, response_body


def _parse_json_object(
    text: str,
    *,
    provider: str,
    workflow_id: str,
    step_id: str,
    error_message: str,
    failure_stage: str,
) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as error:
        raise _step_failure(
            error_message,
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            error=error,
            failure_stage=failure_stage,
        ) from error
    if not isinstance(parsed, dict):
        raise _step_failure(
            error_message,
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            failure_stage=failure_stage,
            details={"error": "JSON root must be an object."},
        )
    return parsed


def _extract_output_object(
    response: Mapping[str, Any],
    *,
    provider: str,
    workflow_id: str,
    step_id: str,
) -> dict[str, Any]:
    output = response.get("output")
    if isinstance(output, Mapping):
        return dict(output)

    content_text = _extract_content_text(response)
    if isinstance(content_text, str):
        return _parse_json_object(
            content_text,
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            error_message="Local model content is not valid JSON.",
            failure_stage="response_content",
        )

    raise _step_failure(
        "Local model response must contain an object output or JSON object content.",
        provider=provider,
        workflow_id=workflow_id,
        step_id=step_id,
        failure_stage="response_content",
    )


def _extract_content_text(response: Mapping[str, Any]) -> str | None:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0]
    if not isinstance(first, Mapping):
        return None
    message = first.get("message")
    if not isinstance(message, Mapping):
        return None
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content
    return None


def _serialize_payload(payload: Mapping[str, Any], *, provider: str, workflow_id: str, step_id: str) -> str:
    try:
        return json.dumps(payload, ensure_ascii=True, sort_keys=True)
    except (TypeError, ValueError) as error:
        raise _step_failure(
            "Local model request payload is not JSON-serializable.",
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            error=error,
            failure_stage="request_payload",
        ) from error


def _step_failure(
    message: str,
    *,
    provider: str,
    workflow_id: str,
    step_id: str,
    failure_stage: str,
    error: Exception | None = None,
    status_code: int | None = None,
    details: Mapping[str, Any] | None = None,
) -> StepExecutionError:
    merged_details: dict[str, Any] = {
        "provider": provider,
        "workflow_id": workflow_id,
        "step_id": step_id,
        "fallback_eligible": False,
        "failure_stage": failure_stage,
    }
    if error is not None:
        merged_details["error_type"] = type(error).__name__
        merged_details["error"] = str(error)
    if status_code is not None:
        merged_details["status_code"] = status_code
    if isinstance(details, Mapping):
        merged_details.update(details)
    return StepExecutionError(message, details=merged_details)
