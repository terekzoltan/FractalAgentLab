from __future__ import annotations

from dataclasses import dataclass
import json
import os
from typing import Any, Mapping, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult
from fractal_agent_lab.core.errors import RuntimeBoundaryError, StepExecutionError


class OpenRouterTransport(Protocol):
    def __call__(
        self,
        *,
        url: str,
        headers: Mapping[str, str],
        payload: Mapping[str, Any],
        timeout_seconds: float,
    ) -> tuple[int, str]:
        ...


@dataclass(slots=True)
class OpenRouterAdapter:
    name: str = "openrouter"
    provider_config: Mapping[str, Any] | None = None
    environment: Mapping[str, str] | None = None
    transport: OpenRouterTransport | None = None

    def execute_step(self, request: AdapterStepRequest) -> AdapterStepResult:
        if not request.model:
            raise RuntimeBoundaryError(
                "OpenRouterAdapter requires an explicit model selection.",
                details={
                    "provider": self.name,
                    "step_id": request.step_id,
                    "workflow_id": request.workflow_id,
                },
            )

        api_key_env = self._api_key_env_name()
        api_key = self._resolve_api_key(api_key_env)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": request.model,
            "messages": self._build_messages(request),
        }

        transport = self.transport or _urllib_transport
        url = self._chat_completions_url()
        timeout_seconds = self._timeout_seconds()

        try:
            status_code, body_text = transport(
                url=url,
                headers=headers,
                payload=payload,
                timeout_seconds=timeout_seconds,
            )
        except URLError as error:
            raise StepExecutionError(
                "OpenRouter request failed.",
                details={
                    "provider": self.name,
                    "workflow_id": request.workflow_id,
                    "step_id": request.step_id,
                    "error_type": type(error).__name__,
                    "error": str(error),
                },
            ) from error
        except OSError as error:
            raise StepExecutionError(
                "OpenRouter transport failed.",
                details={
                    "provider": self.name,
                    "workflow_id": request.workflow_id,
                    "step_id": request.step_id,
                    "error_type": type(error).__name__,
                    "error": str(error),
                },
            ) from error

        if status_code < 200 or status_code >= 300:
            raise StepExecutionError(
                "OpenRouter returned a non-success status.",
                details={
                    "provider": self.name,
                    "workflow_id": request.workflow_id,
                    "step_id": request.step_id,
                    "status_code": status_code,
                },
            )

        response = _parse_json_object(
            body_text,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            error_message="OpenRouter returned invalid JSON envelope.",
        )

        content_text = _extract_content_text(
            response,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
        )
        output = _parse_json_object(
            content_text,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            error_message="OpenRouter content is not valid JSON.",
        )

        response_model = response.get("model")
        executed_model = response_model if isinstance(response_model, str) and response_model else request.model
        choice = _first_choice(response)
        finish_reason = choice.get("finish_reason") if isinstance(choice, Mapping) else None
        usage = response.get("usage")
        raw_usage = usage if isinstance(usage, Mapping) else {}

        return AdapterStepResult(
            output=output,
            provider=self.name,
            model=executed_model,
            raw={
                "openrouter": True,
                "requested_model": request.model,
                "response_id": response.get("id"),
                "response_model": response_model if isinstance(response_model, str) and response_model else None,
                "finish_reason": finish_reason,
                "usage": dict(raw_usage),
            },
        )

    def _provider_config(self) -> Mapping[str, Any]:
        if isinstance(self.provider_config, Mapping):
            return self.provider_config
        return {}

    def _api_key_env_name(self) -> str:
        raw_name = self._provider_config().get("api_key_env")
        if raw_name is None:
            return "OPENROUTER_API_KEY"
        if isinstance(raw_name, str) and raw_name:
            return raw_name
        raise RuntimeBoundaryError(
            "OpenRouter provider config 'api_key_env' must be a non-empty string.",
            details={"provider": self.name},
        )

    def _resolve_api_key(self, api_key_env: str) -> str:
        source = self.environment if self.environment is not None else os.environ
        api_key = source.get(api_key_env)
        if isinstance(api_key, str) and api_key:
            return api_key
        raise RuntimeBoundaryError(
            f"OpenRouter API key is missing from env var '{api_key_env}'.",
            details={"provider": self.name, "api_key_env": api_key_env},
        )

    def _timeout_seconds(self) -> float:
        raw_timeout = self._provider_config().get("timeout_seconds")
        if raw_timeout is None:
            return 30.0
        if isinstance(raw_timeout, (int, float)) and raw_timeout > 0:
            return float(raw_timeout)
        raise RuntimeBoundaryError(
            "OpenRouter provider config 'timeout_seconds' must be a positive number.",
            details={"provider": self.name},
        )

    def _chat_completions_url(self) -> str:
        explicit_url = self._provider_config().get("chat_completions_url")
        if isinstance(explicit_url, str) and explicit_url:
            return explicit_url

        base_url = self._provider_config().get("base_url")
        if isinstance(base_url, str) and base_url:
            return f"{base_url.rstrip('/')}/chat/completions"
        return "https://openrouter.ai/api/v1/chat/completions"

    def _build_messages(self, request: AdapterStepRequest) -> list[dict[str, str]]:
        system_instruction = (
            f"{request.instructions or ''}\n\n"
            "Return exactly one valid JSON object."
            " Do not wrap the response in markdown fences."
            " Do not add explanation before or after the JSON object."
        ).strip()
        user_payload = {
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
        return [
            {"role": "system", "content": system_instruction},
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=True, sort_keys=True, default=str),
            },
        ]


def _urllib_transport(
    *,
    url: str,
    headers: Mapping[str, str],
    payload: Mapping[str, Any],
    timeout_seconds: float,
) -> tuple[int, str]:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    request = Request(url=url, data=body, headers=dict(headers), method="POST")
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
) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as error:
        raise StepExecutionError(
            error_message,
            details={
                "provider": provider,
                "workflow_id": workflow_id,
                "step_id": step_id,
                "error_type": type(error).__name__,
                "error": str(error),
            },
        ) from error
    if not isinstance(parsed, dict):
        raise StepExecutionError(
            error_message,
            details={
                "provider": provider,
                "workflow_id": workflow_id,
                "step_id": step_id,
                "error": "JSON root must be an object.",
            },
        )
    return parsed


def _extract_content_text(
    response: Mapping[str, Any],
    *,
    provider: str,
    workflow_id: str,
    step_id: str,
) -> str:
    choice = _first_choice(response)
    if not isinstance(choice, Mapping):
        raise StepExecutionError(
            "OpenRouter response is missing a valid first choice.",
            details={"provider": provider, "workflow_id": workflow_id, "step_id": step_id},
        )
    message = choice.get("message")
    if not isinstance(message, Mapping):
        raise StepExecutionError(
            "OpenRouter response choice is missing message content.",
            details={"provider": provider, "workflow_id": workflow_id, "step_id": step_id},
        )
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise StepExecutionError(
            "OpenRouter response message content must be a non-empty string.",
            details={"provider": provider, "workflow_id": workflow_id, "step_id": step_id},
        )
    return content


def _first_choice(response: Mapping[str, Any]) -> Mapping[str, Any] | None:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0]
    if isinstance(first, Mapping):
        return first
    return None
