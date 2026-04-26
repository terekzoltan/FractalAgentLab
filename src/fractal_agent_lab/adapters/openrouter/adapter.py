from __future__ import annotations

from dataclasses import dataclass
import json
import os
import time
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
        retry_policy = self._retry_policy()

        status_code, body_text, provider_retry = self._execute_transport_with_retries(
            transport=transport,
            url=url,
            headers=headers,
            payload=payload,
            timeout_seconds=timeout_seconds,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            retry_policy=retry_policy,
        )

        response = _parse_json_object(
            body_text,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            error_message="OpenRouter returned invalid JSON envelope.",
            failure_stage="response_envelope",
            details=_retry_failure_details(provider_retry),
        )

        content_text = _extract_content_text(
            response,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            details=_retry_failure_details(provider_retry),
        )
        output = _parse_json_object(
            content_text,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
            error_message="OpenRouter content is not valid JSON.",
            failure_stage="response_content",
            details=_retry_failure_details(provider_retry),
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
                "provider_retry": provider_retry,
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

    def _retry_policy(self) -> "_RetryPolicy":
        provider_config = self._provider_config()
        if "retry" not in provider_config:
            return _RetryPolicy(max_retries=0, backoff_seconds=0.0)
        raw_retry = provider_config["retry"]
        if not isinstance(raw_retry, Mapping):
            raise _provider_config_error(
                "OpenRouter provider config 'retry' must be a mapping.",
                provider=self.name,
                config_key="retry",
                value=raw_retry,
            )

        raw_max_retries = raw_retry.get("max_retries", 0)
        if not isinstance(raw_max_retries, int) or isinstance(raw_max_retries, bool) or not 0 <= raw_max_retries <= 3:
            raise _provider_config_error(
                "OpenRouter provider config 'retry.max_retries' must be an integer from 0 to 3.",
                provider=self.name,
                config_key="retry.max_retries",
                value=raw_max_retries,
            )

        raw_backoff_seconds = raw_retry.get("backoff_seconds", 0.0)
        if (
            not isinstance(raw_backoff_seconds, (int, float))
            or isinstance(raw_backoff_seconds, bool)
            or not 0.0 <= float(raw_backoff_seconds) <= 10.0
        ):
            raise _provider_config_error(
                "OpenRouter provider config 'retry.backoff_seconds' must be a number from 0.0 to 10.0.",
                provider=self.name,
                config_key="retry.backoff_seconds",
                value=raw_backoff_seconds,
            )

        return _RetryPolicy(max_retries=raw_max_retries, backoff_seconds=float(raw_backoff_seconds))

    def _execute_transport_with_retries(
        self,
        *,
        transport: OpenRouterTransport,
        url: str,
        headers: Mapping[str, str],
        payload: Mapping[str, Any],
        timeout_seconds: float,
        workflow_id: str,
        step_id: str,
        retry_policy: "_RetryPolicy",
    ) -> tuple[int, str, dict[str, Any]]:
        attempt_count = 0
        while True:
            attempt_count += 1
            try:
                status_code, body_text = transport(
                    url=url,
                    headers=headers,
                    payload=payload,
                    timeout_seconds=timeout_seconds,
                )
            except URLError as error:
                if _should_retry(recoverable=True, attempt_count=attempt_count, retry_policy=retry_policy):
                    _sleep_backoff(retry_policy.backoff_seconds)
                    continue
                provider_retry = _provider_retry_metadata(
                    retry_policy=retry_policy,
                    attempt_count=attempt_count,
                    recoverable=True,
                    final_status_code=None,
                    failure_stage="transport",
                    exhausted=True,
                )
                raise _step_failure(
                    "OpenRouter request failed.",
                    provider=self.name,
                    workflow_id=workflow_id,
                    step_id=step_id,
                    error=error,
                    fallback_eligible=True,
                    failure_stage="transport",
                    details={"provider_retry": provider_retry},
                ) from error
            except OSError as error:
                if _should_retry(recoverable=True, attempt_count=attempt_count, retry_policy=retry_policy):
                    _sleep_backoff(retry_policy.backoff_seconds)
                    continue
                provider_retry = _provider_retry_metadata(
                    retry_policy=retry_policy,
                    attempt_count=attempt_count,
                    recoverable=True,
                    final_status_code=None,
                    failure_stage="transport",
                    exhausted=True,
                )
                raise _step_failure(
                    "OpenRouter transport failed.",
                    provider=self.name,
                    workflow_id=workflow_id,
                    step_id=step_id,
                    error=error,
                    fallback_eligible=True,
                    failure_stage="transport",
                    details={"provider_retry": provider_retry},
                ) from error

            if status_code < 200 or status_code >= 300:
                recoverable = _is_recoverable_http_status(status_code)
                if _should_retry(recoverable=recoverable, attempt_count=attempt_count, retry_policy=retry_policy):
                    _sleep_backoff(retry_policy.backoff_seconds)
                    continue
                provider_retry = _provider_retry_metadata(
                    retry_policy=retry_policy,
                    attempt_count=attempt_count,
                    recoverable=recoverable,
                    final_status_code=status_code,
                    failure_stage="http_status",
                    exhausted=recoverable,
                )
                raise _step_failure(
                    "OpenRouter returned a non-success status.",
                    provider=self.name,
                    workflow_id=workflow_id,
                    step_id=step_id,
                    status_code=status_code,
                    fallback_eligible=recoverable,
                    failure_stage="http_status",
                    details={"provider_retry": provider_retry},
                )

            provider_retry = _provider_retry_metadata(
                retry_policy=retry_policy,
                attempt_count=attempt_count,
                recoverable=False,
                final_status_code=None,
                failure_stage=None,
                exhausted=False,
            )
            return status_code, body_text, provider_retry

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
        content = _serialize_user_payload(
            user_payload,
            provider=self.name,
            workflow_id=request.workflow_id,
            step_id=request.step_id,
        )
        return [
            {"role": "system", "content": system_instruction},
            {
                "role": "user",
                "content": content,
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
    failure_stage: str,
    details: Mapping[str, Any] | None = None,
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
            fallback_eligible=False,
            failure_stage=failure_stage,
            details=details,
        ) from error
    if not isinstance(parsed, dict):
        merged_details = {"error": "JSON root must be an object."}
        if isinstance(details, Mapping):
            merged_details.update(details)
        raise _step_failure(
            error_message,
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            fallback_eligible=False,
            failure_stage=failure_stage,
            details=merged_details,
        )
    return parsed


def _extract_content_text(
    response: Mapping[str, Any],
    *,
    provider: str,
    workflow_id: str,
    step_id: str,
    details: Mapping[str, Any] | None = None,
) -> str:
    choice = _first_choice(response)
    if not isinstance(choice, Mapping):
        raise _step_failure(
            "OpenRouter response is missing a valid first choice.",
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            fallback_eligible=False,
            failure_stage="response_content",
            details=details,
        )
    message = choice.get("message")
    if not isinstance(message, Mapping):
        raise _step_failure(
            "OpenRouter response choice is missing message content.",
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            fallback_eligible=False,
            failure_stage="response_content",
            details=details,
        )
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise _step_failure(
            "OpenRouter response message content must be a non-empty string.",
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            fallback_eligible=False,
            failure_stage="response_content",
            details=details,
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


def _is_recoverable_http_status(status_code: int) -> bool:
    return status_code == 429 or status_code >= 500


@dataclass(frozen=True, slots=True)
class _RetryPolicy:
    max_retries: int
    backoff_seconds: float


def _should_retry(*, recoverable: bool, attempt_count: int, retry_policy: _RetryPolicy) -> bool:
    return recoverable and attempt_count <= retry_policy.max_retries


def _provider_retry_metadata(
    *,
    retry_policy: _RetryPolicy,
    attempt_count: int,
    recoverable: bool,
    final_status_code: int | None,
    failure_stage: str | None,
    exhausted: bool,
) -> dict[str, Any]:
    retry_count = max(0, attempt_count - 1)
    return {
        "used": retry_count > 0,
        "max_retries": retry_policy.max_retries,
        "attempt_count": attempt_count,
        "retry_count": retry_count,
        "recoverable": recoverable,
        "final_status_code": final_status_code,
        "failure_stage": failure_stage,
        "exhausted": exhausted,
    }


def _retry_failure_details(provider_retry: Mapping[str, Any]) -> dict[str, Any] | None:
    if provider_retry.get("used") is True:
        return {"provider_retry": dict(provider_retry)}
    return None


def _sleep_backoff(backoff_seconds: float) -> None:
    if backoff_seconds <= 0:
        return
    time.sleep(backoff_seconds)


def _provider_config_error(message: str, *, provider: str, config_key: str, value: Any) -> RuntimeBoundaryError:
    return RuntimeBoundaryError(
        message,
        details={
            "provider": provider,
            "config_key": config_key,
            "value_type": type(value).__name__,
        },
    )


def _serialize_user_payload(
    payload: Mapping[str, Any],
    *,
    provider: str,
    workflow_id: str,
    step_id: str,
) -> str:
    try:
        return json.dumps(payload, ensure_ascii=True, sort_keys=True)
    except (TypeError, ValueError) as error:
        raise _step_failure(
            "OpenRouter request payload is not JSON-serializable.",
            provider=provider,
            workflow_id=workflow_id,
            step_id=step_id,
            error=error,
            fallback_eligible=False,
            failure_stage="request_payload",
        ) from error


def _step_failure(
    message: str,
    *,
    provider: str,
    workflow_id: str,
    step_id: str,
    fallback_eligible: bool,
    failure_stage: str,
    error: Exception | None = None,
    status_code: int | None = None,
    details: Mapping[str, Any] | None = None,
) -> StepExecutionError:
    merged_details: dict[str, Any] = {
        "provider": provider,
        "workflow_id": workflow_id,
        "step_id": step_id,
        "fallback_eligible": fallback_eligible,
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
