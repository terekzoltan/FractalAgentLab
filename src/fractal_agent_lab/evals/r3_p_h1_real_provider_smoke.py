from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id
from fractal_agent_lab.evals.artifact_replay import replay_run_artifacts_by_id
from fractal_agent_lab.evals.h1_eval_contracts import H1_COMPARABLE_OUTPUT_KEYS
from fractal_agent_lab.evals.h1_eval_projections import extract_h1_comparable_output_for_keys

EXPECTED_WORKFLOW_ID = "h1.single.v1"
EXPECTED_PROVIDER = "openrouter"


def inspect_r3_p_h1_real_provider_run(
    *,
    run_id: str,
    data_dir: str | Path = "data",
    execution_mode: str = "manual_policy_driven",
    visibility_audit_state: str = (
        "git-visible coordination/code surfaces plus local data artifacts consulted; "
        "real-provider conclusions depend on local credentials/network/model mapping and canonical stored artifacts"
    ),
) -> dict[str, Any]:
    validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)
    replay = replay_run_artifacts_by_id(run_id, data_dir=data_dir)

    run_payload = validation.run_payload if isinstance(validation.run_payload, dict) else {}
    run_truth = _build_run_truth(run_payload)
    comparable_output = extract_h1_comparable_output_for_keys(
        workflow_id=run_truth.get("workflow_id"),
        output_payload=run_payload.get("output_payload"),
        comparable_keys=H1_COMPARABLE_OUTPUT_KEYS,
    )

    replay_ready = bool(replay.get("replay_ready"))
    checks = {
        "workflow_is_h1_single_v1": run_truth.get("workflow_id") == EXPECTED_WORKFLOW_ID,
        "selected_provider_is_openrouter": run_truth.get("selected_provider") == EXPECTED_PROVIDER,
        "executed_provider_is_openrouter": run_truth.get("executed_provider") == EXPECTED_PROVIDER,
        "fallback_not_used": run_truth.get("fallback_used") is False,
        "run_succeeded": run_truth.get("run_status") == "succeeded",
        "artifact_validation_passed": validation.passed,
        "replay_ready": replay_ready,
        "comparable_single_output_complete": bool(comparable_output.get("complete")),
    }
    real_provider_smoke_passed = all(bool(value) for value in checks.values())

    run_truth_complete = bool(
        isinstance(run_truth.get("workflow_id"), str)
        and isinstance(run_truth.get("run_status"), str)
        and isinstance(run_truth.get("selected_provider"), str)
        and isinstance(run_truth.get("executed_provider"), str)
        and isinstance(run_truth.get("fallback_used"), bool)
    )
    track_e_evidence_ready = bool(validation.passed and replay_ready and run_truth_complete)

    blocked_reason = None
    if not real_provider_smoke_passed:
        blocked_reason = _blocked_reason_for_non_pass(
            checks=checks,
            run_payload=run_payload,
            run_truth=run_truth,
        )
    smoke_outcome = "PASS" if real_provider_smoke_passed else ("BLOCKED" if blocked_reason else "FAIL")

    return {
        "report_version": "r3_p.h1_real_provider_smoke.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "disclosure": {
            "execution_mode": execution_mode,
            "visibility_audit_state": visibility_audit_state,
        },
        "scope": {
            "workflow_id": EXPECTED_WORKFLOW_ID,
            "provider": EXPECTED_PROVIDER,
            "claim": "one bounded real-provider smoke path",
        },
        "run_id": run_id,
        "run_artifact_path": validation.run_path.as_posix(),
        "trace_artifact_path": validation.trace_path.as_posix(),
        "run_truth": run_truth,
        "artifact_validation": {
            "passed": validation.passed,
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        },
        "replay_summary": {
            "replay_ready": replay_ready,
            "run_summary": replay.get("run_summary", {}),
            "failure_summary": replay.get("failure_summary", {}),
        },
        "h1_single_projection": {
            "comparable_output": comparable_output,
        },
        "checks": checks,
        "summary": {
            "track_e_evidence_ready": track_e_evidence_ready,
            "real_provider_smoke_passed": real_provider_smoke_passed,
            "smoke_outcome": smoke_outcome,
            "blocked_reason": blocked_reason,
        },
        "known_limits": [
            "This report is a bounded h1.single.v1 real-provider smoke/evidence surface only.",
            "Fallback-backed success is inspectability evidence but not a real-provider smoke PASS.",
            "CLI stdout is not canonical evidence truth; canonical truth comes from stored run/trace artifacts.",
            "No provider-parity or manager/handoff real-provider claim is made here.",
        ],
    }


def _build_run_truth(run_payload: dict[str, Any]) -> dict[str, Any]:
    workflow_id = _str_or_none(run_payload.get("workflow_id"))
    run_status = _str_or_none(run_payload.get("status"))

    step_results = run_payload.get("step_results") if isinstance(run_payload.get("step_results"), dict) else {}
    single_step = step_results.get("single") if isinstance(step_results.get("single"), dict) else {}
    step_raw = single_step.get("raw") if isinstance(single_step.get("raw"), dict) else {}

    routing = step_raw.get("routing") if isinstance(step_raw.get("routing"), dict) else {}
    failure_details = _failure_details(run_payload)

    selected_provider = _str_or_none(routing.get("selected_provider"))
    if selected_provider is None:
        selected_provider = _str_or_none(failure_details.get("selected_provider"))

    provider_attempts = _provider_attempts_from_sources(
        step_raw.get("provider_attempts"),
        failure_details.get("provider_attempts"),
    )

    executed_provider = _str_or_none(single_step.get("provider"))
    if executed_provider is None:
        executed_provider = _executed_provider_from_attempts(provider_attempts)

    fallback = step_raw.get("fallback") if isinstance(step_raw.get("fallback"), dict) else {}
    fallback_used = _bool_or_none(fallback.get("used"))
    if fallback_used is None:
        fallback_used = _fallback_used_from_attempts(provider_attempts)

    requested_model = _str_or_none(step_raw.get("requested_model"))
    response_model = _str_or_none(step_raw.get("response_model"))
    selected_model = _str_or_none(routing.get("selected_model"))
    executed_model = _str_or_none(single_step.get("model"))

    return {
        "workflow_id": workflow_id,
        "run_status": run_status,
        "selected_provider": selected_provider,
        "selection_source": _str_or_none(routing.get("selection_source"))
        or _str_or_none(failure_details.get("selection_source")),
        "selection_mode": _str_or_none(routing.get("selection_mode"))
        or _str_or_none(failure_details.get("selection_mode")),
        "fallback_policy": _str_or_none(routing.get("fallback_policy"))
        or _str_or_none(failure_details.get("fallback_policy")),
        "executed_provider": executed_provider,
        "fallback_used": fallback_used,
        "provider_attempts": provider_attempts,
        "requested_model": requested_model,
        "response_model": response_model,
        "selected_model": selected_model,
        "executed_model": executed_model,
    }


def _provider_attempts_from_sources(*sources: Any) -> list[dict[str, Any]]:
    for source in sources:
        attempts = _coerce_provider_attempts(source)
        if attempts:
            return attempts
    return []


def _coerce_provider_attempts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    attempts: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        provider = _str_or_none(item.get("provider"))
        outcome = _str_or_none(item.get("outcome"))
        if provider is None or outcome is None:
            continue
        attempts.append(
            {
                "provider": provider,
                "outcome": outcome,
                "fallback_eligible": bool(item.get("fallback_eligible")),
                "error_type": _str_or_none(item.get("error_type")),
                "error": _str_or_none(item.get("error")),
            },
        )
    return attempts


def _executed_provider_from_attempts(attempts: list[dict[str, Any]]) -> str | None:
    for attempt in reversed(attempts):
        if attempt.get("outcome") == "succeeded":
            provider = attempt.get("provider")
            if isinstance(provider, str) and provider:
                return provider
    return None


def _fallback_used_from_attempts(attempts: list[dict[str, Any]]) -> bool | None:
    if not attempts:
        return None
    if len(attempts) == 1:
        return False

    first_provider = attempts[0].get("provider")
    for attempt in attempts[1:]:
        provider = attempt.get("provider")
        if provider != first_provider:
            return True
    return False


def _blocked_reason_for_non_pass(
    *,
    checks: dict[str, bool],
    run_payload: dict[str, Any],
    run_truth: dict[str, Any],
) -> str | None:
    if not checks.get("artifact_validation_passed"):
        return "artifact_validation_failed"
    if not checks.get("replay_ready"):
        return "replay_not_ready"

    run_status = run_truth.get("run_status")
    if run_status == "succeeded":
        return None

    failure = run_payload.get("failure") if isinstance(run_payload.get("failure"), dict) else {}
    failure_details = failure.get("details") if isinstance(failure.get("details"), dict) else {}
    status_code = failure_details.get("status_code")
    failure_stage = _str_or_none(failure_details.get("failure_stage"))
    text = _failure_text(run_payload).lower()

    if "api key" in text or "openrouter_api_key" in text:
        return "missing_openrouter_api_key"
    if "requires an explicit model selection" in text:
        return "missing_model_mapping"
    if "not enabled" in text and "provider" in text:
        return "provider_not_enabled"

    if failure_stage == "transport":
        return "network_or_transport_failure"
    if failure_stage == "http_status":
        if isinstance(status_code, int) and status_code in {401, 403}:
            return "provider_auth_rejected"
        if isinstance(status_code, int) and status_code in {429, 500, 502, 503, 504}:
            return "provider_service_unavailable"

    return None


def _failure_details(run_payload: dict[str, Any]) -> dict[str, Any]:
    failure = run_payload.get("failure") if isinstance(run_payload.get("failure"), dict) else {}
    details = failure.get("details") if isinstance(failure.get("details"), dict) else {}
    return details


def _failure_text(run_payload: dict[str, Any]) -> str:
    failure = run_payload.get("failure") if isinstance(run_payload.get("failure"), dict) else {}
    message = _str_or_none(failure.get("message"))
    parts: list[str] = []
    if message:
        parts.append(message)
    errors = run_payload.get("errors") if isinstance(run_payload.get("errors"), list) else []
    parts.extend(str(item) for item in errors if isinstance(item, str))
    return " | ".join(parts)


def _bool_or_none(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    return None


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None
