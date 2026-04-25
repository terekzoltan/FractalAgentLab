from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id
from fractal_agent_lab.evals.artifact_replay import replay_run_artifacts_by_id
from fractal_agent_lab.evals.h1_eval_contracts import H1_COMPARABLE_OUTPUT_KEYS
from fractal_agent_lab.evals.h1_eval_projections import extract_h1_comparable_output_for_keys

EXPECTED_WORKFLOW_ID = "h1.single.v1"
OPENROUTER_PROVIDER = "openrouter"
OPENAI_PROVIDER = "openai"
EXPECTED_PROVIDERS: tuple[str, str] = (OPENROUTER_PROVIDER, OPENAI_PROVIDER)


def inspect_p4_b_h1_cross_provider_smoke(
    *,
    openrouter_run_id: str | None,
    openai_run_id: str | None,
    data_dir: str | Path = "data",
    comparison_task_intent: str | None = None,
    openrouter_model_policy_config_path: str | Path | None = None,
    openai_model_policy_config_path: str | Path | None = None,
    live_execution: dict[str, Any] | None = None,
    execution_mode: str = "manual_policy_driven",
    visibility_audit_state: str = (
        "git-visible coordination/code surfaces plus local data artifacts consulted; "
        "provider/fallback/model truth is read from canonical run artifacts, not CLI stdout"
    ),
) -> dict[str, Any]:
    provider_runs = {
        OPENROUTER_PROVIDER: _inspect_provider_leg(
            expected_provider=OPENROUTER_PROVIDER,
            run_id=openrouter_run_id,
            data_dir=data_dir,
            model_policy_config_path=openrouter_model_policy_config_path,
            live_execution=_provider_live_execution(live_execution, OPENROUTER_PROVIDER),
        ),
        OPENAI_PROVIDER: _inspect_provider_leg(
            expected_provider=OPENAI_PROVIDER,
            run_id=openai_run_id,
            data_dir=data_dir,
            model_policy_config_path=openai_model_policy_config_path,
            live_execution=_provider_live_execution(live_execution, OPENAI_PROVIDER),
        ),
    }
    comparison = _build_comparison(provider_runs)
    summary = _build_summary(provider_runs=provider_runs, comparison=comparison)

    return {
        "report_version": "p4_b.h1_cross_provider_smoke.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "disclosure": {
            "execution_mode": execution_mode,
            "visibility_audit_state": visibility_audit_state,
            "comparison_task_intent": comparison_task_intent,
            "same_input_payload_required": True,
            "separate_model_policy_configs_allowed": True,
            "model_ids_may_differ_by_provider": True,
            "comparison_claim_excludes_model_quality_parity": True,
            "comparison_claim_excludes_provider_quality_parity": True,
        },
        "scope": {
            "workflow_id": EXPECTED_WORKFLOW_ID,
            "providers": list(EXPECTED_PROVIDERS),
            "claim": "bounded cross-provider h1.single.v1 provider-path smoke comparison",
        },
        "provider_runs": provider_runs,
        "comparison": comparison,
        "summary": summary,
        "known_limits": [
            "This is a provider-path smoke comparison, not provider-quality parity or winner scoring.",
            "Provider model IDs may differ; model provenance is disclosed per leg.",
            "Fallback-backed success is inspectable evidence but cannot pass P4-B smoke.",
            "No manager, handoff, H2, H3, routing-v2, or backoff hardening claim is made here.",
        ],
    }


def _inspect_provider_leg(
    *,
    expected_provider: str,
    run_id: str | None,
    data_dir: str | Path,
    model_policy_config_path: str | Path | None,
    live_execution: dict[str, Any] | None,
) -> dict[str, Any]:
    if _str_or_none(run_id) is None:
        return {
            "run_id": run_id,
            "expected_provider": expected_provider,
            "model_policy_config_path": _path_or_none(model_policy_config_path),
            "live_execution": live_execution,
            "summary": {
                "track_e_evidence_ready": False,
                "provider_smoke_passed": False,
                "provider_smoke_outcome": "BLOCKED",
                "blocked_reason": f"missing_{expected_provider}_run_id",
            },
        }

    assert run_id is not None
    validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)
    replay = replay_run_artifacts_by_id(run_id, data_dir=data_dir)
    replay_ready = bool(replay.get("replay_ready"))
    run_payload = validation.run_payload if isinstance(validation.run_payload, dict) else {}
    run_truth = _build_run_truth(run_payload)
    comparable_output = extract_h1_comparable_output_for_keys(
        workflow_id=run_truth.get("workflow_id"),
        output_payload=run_payload.get("output_payload"),
        comparable_keys=H1_COMPARABLE_OUTPUT_KEYS,
    )
    input_payload = run_payload.get("input_payload") if isinstance(run_payload.get("input_payload"), dict) else None
    model_provenance_complete = bool(
        _str_or_none(run_truth.get("selected_model"))
        and _str_or_none(run_truth.get("executed_model"))
        and _str_or_none(run_truth.get("requested_model"))
        and _str_or_none(run_truth.get("response_model"))
    )

    checks = {
        "workflow_is_h1_single_v1": run_truth.get("workflow_id") == EXPECTED_WORKFLOW_ID,
        "selected_provider_matches_expected": run_truth.get("selected_provider") == expected_provider,
        "executed_provider_matches_expected": run_truth.get("executed_provider") == expected_provider,
        "fallback_not_used": run_truth.get("fallback_used") is False,
        "run_succeeded": run_truth.get("run_status") == "succeeded",
        "artifact_validation_passed": validation.passed,
        "replay_ready": replay_ready,
        "comparable_single_output_complete": bool(comparable_output.get("complete")),
        "model_provenance_present": model_provenance_complete,
    }
    provider_smoke_passed = all(bool(value) for value in checks.values())
    track_e_evidence_ready = bool(validation.passed and replay_ready and _run_truth_complete(run_truth))
    blocked_reason = None
    if not provider_smoke_passed:
        blocked_reason = _blocked_reason_for_provider_leg(
            expected_provider=expected_provider,
            checks=checks,
            run_payload=run_payload,
            run_truth=run_truth,
            validation_errors=list(validation.errors),
        )
    provider_smoke_outcome = "PASS" if provider_smoke_passed else ("BLOCKED" if blocked_reason else "FAIL")

    return {
        "run_id": run_id,
        "expected_provider": expected_provider,
        "run_artifact_path": validation.run_path.as_posix(),
        "trace_artifact_path": validation.trace_path.as_posix(),
        "model_policy_config_path": _path_or_none(model_policy_config_path),
        "live_execution": live_execution,
        "input_payload": input_payload,
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
            "provider_smoke_passed": provider_smoke_passed,
            "provider_smoke_outcome": provider_smoke_outcome,
            "blocked_reason": blocked_reason,
        },
    }


def _build_comparison(provider_runs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    openrouter = provider_runs[OPENROUTER_PROVIDER]
    openai = provider_runs[OPENAI_PROVIDER]
    openrouter_input = openrouter.get("input_payload")
    openai_input = openai.get("input_payload")

    openrouter_output = _comparable_output(openrouter)
    openai_output = _comparable_output(openai)
    openrouter_fields = _fields(openrouter_output)
    openai_fields = _fields(openai_output)

    return {
        "input_payloads_match": openrouter_input is not None and openrouter_input == openai_input,
        "both_artifacts_valid": _leg_check(openrouter, "artifact_validation_passed")
        and _leg_check(openai, "artifact_validation_passed"),
        "both_replay_ready": _leg_check(openrouter, "replay_ready") and _leg_check(openai, "replay_ready"),
        "both_workflows_match": _leg_check(openrouter, "workflow_is_h1_single_v1")
        and _leg_check(openai, "workflow_is_h1_single_v1"),
        "both_selected_providers_match_expected": _leg_check(openrouter, "selected_provider_matches_expected")
        and _leg_check(openai, "selected_provider_matches_expected"),
        "both_executed_providers_match_expected": _leg_check(openrouter, "executed_provider_matches_expected")
        and _leg_check(openai, "executed_provider_matches_expected"),
        "neither_used_fallback": _leg_check(openrouter, "fallback_not_used") and _leg_check(openai, "fallback_not_used"),
        "both_runs_succeeded": _leg_check(openrouter, "run_succeeded") and _leg_check(openai, "run_succeeded"),
        "both_comparable_outputs_complete": _leg_check(openrouter, "comparable_single_output_complete")
        and _leg_check(openai, "comparable_single_output_complete"),
        "model_provenance_present": _leg_check(openrouter, "model_provenance_present")
        and _leg_check(openai, "model_provenance_present"),
        "comparable_key_sets_match": bool(openrouter_fields) and sorted(openrouter_fields) == sorted(openai_fields),
        "comparable_key_sets": {
            OPENROUTER_PROVIDER: sorted(openrouter_fields),
            OPENAI_PROVIDER: sorted(openai_fields),
        },
        "behavioral_differences": _behavioral_differences(openrouter_fields, openai_fields),
    }


def _build_summary(*, provider_runs: dict[str, dict[str, Any]], comparison: dict[str, Any]) -> dict[str, Any]:
    blocked_reason = _comparison_blocked_reason(provider_runs=provider_runs, comparison=comparison)
    cross_provider_smoke_passed = bool(
        blocked_reason is None
        and _leg_passed(provider_runs[OPENROUTER_PROVIDER])
        and _leg_passed(provider_runs[OPENAI_PROVIDER])
        and comparison.get("input_payloads_match") is True
        and comparison.get("comparable_key_sets_match") is True
        and comparison.get("model_provenance_present") is True
    )
    comparison_outcome = "PASS" if cross_provider_smoke_passed else ("BLOCKED" if blocked_reason else "FAIL")
    track_e_evidence_ready = bool(
        comparison_outcome != "BLOCKED"
        and provider_runs[OPENROUTER_PROVIDER].get("summary", {}).get("track_e_evidence_ready")
        and provider_runs[OPENAI_PROVIDER].get("summary", {}).get("track_e_evidence_ready")
    )
    return {
        "track_e_evidence_ready": track_e_evidence_ready,
        "cross_provider_smoke_passed": cross_provider_smoke_passed,
        "comparison_outcome": comparison_outcome,
        "blocked_reason": blocked_reason,
    }


def _comparison_blocked_reason(*, provider_runs: dict[str, dict[str, Any]], comparison: dict[str, Any]) -> str | None:
    for provider in EXPECTED_PROVIDERS:
        summary = provider_runs[provider].get("summary")
        if not isinstance(summary, dict):
            return f"{provider}_summary_missing"
        if summary.get("provider_smoke_outcome") == "BLOCKED":
            reason = _str_or_none(summary.get("blocked_reason")) or "provider_leg_blocked"
            return f"{provider}:{reason}"

    if comparison.get("input_payloads_match") is not True:
        return "input_payload_mismatch"
    return None


def _blocked_reason_for_provider_leg(
    *,
    expected_provider: str,
    checks: dict[str, bool],
    run_payload: dict[str, Any],
    run_truth: dict[str, Any],
    validation_errors: list[str],
) -> str | None:
    if not checks.get("artifact_validation_passed"):
        if any(error.startswith("Missing run artifact") or error.startswith("Missing trace artifact") for error in validation_errors):
            return "missing_canonical_run_trace_pair"
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

    if "api key" in text or f"{expected_provider}_api_key" in text:
        return f"missing_{expected_provider}_api_key"
    if "requires an explicit model selection" in text or "requires a resolved non-empty model" in text:
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


def _build_run_truth(run_payload: dict[str, Any]) -> dict[str, Any]:
    workflow_id = _str_or_none(run_payload.get("workflow_id"))
    run_status = _str_or_none(run_payload.get("status"))
    step_results = run_payload.get("step_results") if isinstance(run_payload.get("step_results"), dict) else {}
    single_step = step_results.get("single") if isinstance(step_results.get("single"), dict) else {}
    step_raw = single_step.get("raw") if isinstance(single_step.get("raw"), dict) else {}
    routing = step_raw.get("routing") if isinstance(step_raw.get("routing"), dict) else {}
    failure_details = _failure_details(run_payload)

    selected_provider = _str_or_none(routing.get("selected_provider")) or _str_or_none(failure_details.get("selected_provider"))
    provider_attempts = _provider_attempts_from_sources(step_raw.get("provider_attempts"), failure_details.get("provider_attempts"))
    executed_provider = _str_or_none(single_step.get("provider")) or _executed_provider_from_attempts(provider_attempts)
    fallback = step_raw.get("fallback") if isinstance(step_raw.get("fallback"), dict) else {}
    fallback_used = _bool_or_none(fallback.get("used"))
    if fallback_used is None:
        fallback_used = _fallback_used_from_attempts(provider_attempts)

    return {
        "workflow_id": workflow_id,
        "run_status": run_status,
        "selected_provider": selected_provider,
        "selection_source": _str_or_none(routing.get("selection_source")) or _str_or_none(failure_details.get("selection_source")),
        "selection_mode": _str_or_none(routing.get("selection_mode")) or _str_or_none(failure_details.get("selection_mode")),
        "fallback_policy": _str_or_none(routing.get("fallback_policy")) or _str_or_none(failure_details.get("fallback_policy")),
        "executed_provider": executed_provider,
        "fallback_used": fallback_used,
        "provider_attempts": provider_attempts,
        "selected_model": _str_or_none(routing.get("selected_model")),
        "requested_model": _str_or_none(step_raw.get("requested_model")),
        "response_model": _str_or_none(step_raw.get("response_model")),
        "executed_model": _str_or_none(single_step.get("model")),
        "model_policy_ref": _str_or_none(routing.get("model_policy_ref")),
    }


def _run_truth_complete(run_truth: dict[str, Any]) -> bool:
    return bool(
        isinstance(run_truth.get("workflow_id"), str)
        and isinstance(run_truth.get("run_status"), str)
        and isinstance(run_truth.get("selected_provider"), str)
        and isinstance(run_truth.get("executed_provider"), str)
        and isinstance(run_truth.get("fallback_used"), bool)
    )


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
            return _str_or_none(attempt.get("provider"))
    return None


def _fallback_used_from_attempts(attempts: list[dict[str, Any]]) -> bool | None:
    if not attempts:
        return None
    if len(attempts) == 1:
        return False
    first_provider = attempts[0].get("provider")
    return any(attempt.get("provider") != first_provider for attempt in attempts[1:])


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


def _comparable_output(leg: dict[str, Any]) -> dict[str, Any]:
    projection = leg.get("h1_single_projection") if isinstance(leg.get("h1_single_projection"), dict) else {}
    output = projection.get("comparable_output") if isinstance(projection.get("comparable_output"), dict) else {}
    return output


def _fields(comparable_output: dict[str, Any]) -> dict[str, Any]:
    fields = comparable_output.get("fields")
    if isinstance(fields, dict):
        return dict(fields)
    return {}


def _behavioral_differences(openrouter_fields: dict[str, Any], openai_fields: dict[str, Any]) -> dict[str, Any]:
    differences: dict[str, Any] = {}
    for key in sorted(set(openrouter_fields).intersection(openai_fields)):
        if openrouter_fields.get(key) != openai_fields.get(key):
            differences[key] = {
                OPENROUTER_PROVIDER: openrouter_fields.get(key),
                OPENAI_PROVIDER: openai_fields.get(key),
            }
    return differences


def _leg_check(leg: dict[str, Any], check_name: str) -> bool:
    checks = leg.get("checks") if isinstance(leg.get("checks"), dict) else {}
    return bool(checks.get(check_name))


def _leg_passed(leg: dict[str, Any]) -> bool:
    summary = leg.get("summary") if isinstance(leg.get("summary"), dict) else {}
    return bool(summary.get("provider_smoke_passed"))


def _provider_live_execution(live_execution: dict[str, Any] | None, provider: str) -> dict[str, Any] | None:
    if not isinstance(live_execution, dict):
        return None
    provider_block = live_execution.get(provider)
    if isinstance(provider_block, dict):
        return provider_block
    return None


def _bool_or_none(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    return None


def _path_or_none(path_like: str | Path | None) -> str | None:
    if path_like is None:
        return None
    return Path(path_like).as_posix()


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None
