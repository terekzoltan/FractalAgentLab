from __future__ import annotations

import argparse
import io
import json
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.cli.app import run_cli
from fractal_agent_lab.cli.config_loader import load_mapping_file, load_run_configs, resolve_data_dir
from fractal_agent_lab.evals.p4_b_h1_cross_provider_smoke import (
    EXPECTED_WORKFLOW_ID,
    OPENAI_PROVIDER,
    OPENROUTER_PROVIDER,
    inspect_p4_b_h1_cross_provider_smoke,
)

PASS_EXIT_CODE = 0
FAIL_EXIT_CODE = 1
BLOCKED_EXIT_CODE = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run P4-B H1 cross-provider smoke comparison")
    parser.add_argument("--openrouter-run-id", default=None, help="Inspect-only OpenRouter run_id")
    parser.add_argument("--openai-run-id", default=None, help="Inspect-only OpenAI run_id")
    parser.add_argument("--data-dir", default=None, help="Inspect-only data directory override")
    parser.add_argument(
        "--comparison-task-intent",
        default="bounded h1.single.v1 cross-provider smoke input",
        help="Operator-readable matched-input intent disclosure",
    )
    parser.add_argument(
        "--input-json",
        default='{"idea":"AI founder assistant for startup idea refinement"}',
        help="Live mode only: input payload JSON object used identically for both provider legs",
    )
    parser.add_argument("--runtime-config", default="configs/runtime.example.yaml")
    parser.add_argument("--providers-config", default="configs/providers.example.yaml")
    parser.add_argument(
        "--model-policy-config",
        default="configs/model_policy.example.yaml",
        help="Default model policy config path used for both legs unless provider-specific paths are set",
    )
    parser.add_argument("--openrouter-model-policy-config", default=None)
    parser.add_argument("--openai-model-policy-config", default=None)
    parser.add_argument("--show-trace", action="store_true")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    openrouter_model_policy_path = args.openrouter_model_policy_config or args.model_policy_config
    openai_model_policy_path = args.openai_model_policy_config or args.model_policy_config

    if args.openrouter_run_id or args.openai_run_id:
        if not args.openrouter_run_id or not args.openai_run_id:
            parser.exit(status=BLOCKED_EXIT_CODE, message="Inspect-only mode requires both --openrouter-run-id and --openai-run-id.\n")
        inspect_data_dir = Path(args.data_dir) if args.data_dir else Path("data")
        report = inspect_p4_b_h1_cross_provider_smoke(
            openrouter_run_id=args.openrouter_run_id,
            openai_run_id=args.openai_run_id,
            data_dir=inspect_data_dir,
            comparison_task_intent=args.comparison_task_intent,
            openrouter_model_policy_config_path=openrouter_model_policy_path,
            openai_model_policy_config_path=openai_model_policy_path,
        )
        print(json.dumps(report, indent=2, ensure_ascii=True))
        return exit_code_for_report(report)

    try:
        _ = _parse_input_json(args.input_json)
    except ValueError as error:
        parser.exit(status=BLOCKED_EXIT_CODE, message=f"{error}\n")

    try:
        runtime_config, _, _ = load_run_configs(
            runtime_config_path=args.runtime_config,
            providers_config_path=args.providers_config,
            model_policy_config_path=openrouter_model_policy_path,
        )
        _ = load_mapping_file(openai_model_policy_path)
        runtime_data_dir = resolve_data_dir(runtime_config)
    except ValueError as error:
        report = _build_blocked_report(
            blocked_reason="config_load_error",
            error_message=str(error),
            args=args,
            openrouter_model_policy_path=openrouter_model_policy_path,
            openai_model_policy_path=openai_model_policy_path,
        )
        print(json.dumps(report, indent=2, ensure_ascii=True))
        return BLOCKED_EXIT_CODE

    live_execution = {
        OPENROUTER_PROVIDER: _run_live_cli(
            args=args,
            provider=OPENROUTER_PROVIDER,
            model_policy_config_path=openrouter_model_policy_path,
        ),
        OPENAI_PROVIDER: _run_live_cli(
            args=args,
            provider=OPENAI_PROVIDER,
            model_policy_config_path=openai_model_policy_path,
        ),
    }
    openrouter_run_id, openai_run_id = run_ids_from_live_execution(live_execution)

    if openrouter_run_id is None or openai_run_id is None:
        report = _build_blocked_report(
            blocked_reason="live_run_did_not_emit_run_id",
            error_message="One or both live provider runs did not emit summary.run_id.",
            args=args,
            openrouter_model_policy_path=openrouter_model_policy_path,
            openai_model_policy_path=openai_model_policy_path,
            live_execution=live_execution,
            openrouter_run_id=openrouter_run_id,
            openai_run_id=openai_run_id,
        )
        print(json.dumps(report, indent=2, ensure_ascii=True))
        return BLOCKED_EXIT_CODE

    report = inspect_p4_b_h1_cross_provider_smoke(
        openrouter_run_id=openrouter_run_id,
        openai_run_id=openai_run_id,
        data_dir=runtime_data_dir,
        comparison_task_intent=args.comparison_task_intent,
        openrouter_model_policy_config_path=openrouter_model_policy_path,
        openai_model_policy_config_path=openai_model_policy_path,
        live_execution=live_execution,
    )
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return exit_code_for_report(report)


def is_track_e_evidence_ready(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("track_e_evidence_ready"))


def is_cross_provider_smoke_passed(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("cross_provider_smoke_passed"))


def comparison_outcome(report: dict[str, Any]) -> str:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return "FAIL"
    outcome = summary.get("comparison_outcome")
    if isinstance(outcome, str) and outcome in {"PASS", "FAIL", "BLOCKED"}:
        return outcome
    return "FAIL"


def exit_code_for_report(report: dict[str, Any]) -> int:
    outcome = comparison_outcome(report)
    if outcome == "PASS":
        return PASS_EXIT_CODE
    if outcome == "BLOCKED":
        return BLOCKED_EXIT_CODE
    return FAIL_EXIT_CODE


def run_ids_from_live_execution(live_execution: dict[str, Any]) -> tuple[str | None, str | None]:
    return (
        _run_id_from_live_execution(live_execution, OPENROUTER_PROVIDER),
        _run_id_from_live_execution(live_execution, OPENAI_PROVIDER),
    )


def _run_id_from_live_execution(live_execution: dict[str, Any], provider: str) -> str | None:
    provider_execution = live_execution.get(provider)
    if not isinstance(provider_execution, dict):
        return None

    run_id = provider_execution.get("run_id_from_cli")
    if isinstance(run_id, str) and run_id.strip():
        return run_id.strip()

    return _extract_run_id_from_cli_output(provider_execution.get("run_cli_output"))


def _parse_input_json(raw: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError(f"--input-json must be valid JSON: {error.msg}.") from error
    if not isinstance(payload, dict):
        raise ValueError("--input-json must decode to a JSON object.")
    return payload


def _run_live_cli(*, args: argparse.Namespace, provider: str, model_policy_config_path: str) -> dict[str, Any]:
    run_cli_args = [
        "run",
        EXPECTED_WORKFLOW_ID,
        "--input-json",
        args.input_json,
        "--format",
        "json",
        "--runtime-config",
        args.runtime_config,
        "--providers-config",
        args.providers_config,
        "--model-policy-config",
        model_policy_config_path,
        "--provider",
        provider,
    ]
    if args.show_trace:
        run_cli_args.append("--show-trace")

    output_buffer = io.StringIO()
    with redirect_stdout(output_buffer):
        cli_exit_code = run_cli(run_cli_args)
    run_cli_output = output_buffer.getvalue()
    run_id = _extract_run_id_from_cli_output(run_cli_output)
    return {
        "mode": "live_and_inspect",
        "provider": provider,
        "cli_exit_code": cli_exit_code,
        "run_cli_args": run_cli_args,
        "run_cli_output_summary": _extract_cli_output_summary(run_cli_output),
        "run_cli_output_excerpt": _output_excerpt(run_cli_output),
        "run_id_from_cli": run_id,
        "model_policy_config_path": Path(model_policy_config_path).as_posix(),
    }


def _build_blocked_report(
    *,
    blocked_reason: str,
    error_message: str,
    args: argparse.Namespace,
    openrouter_model_policy_path: str,
    openai_model_policy_path: str,
    live_execution: dict[str, Any] | None = None,
    openrouter_run_id: str | None = None,
    openai_run_id: str | None = None,
) -> dict[str, Any]:
    return {
        "report_version": "p4_b.h1_cross_provider_smoke.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "disclosure": {
            "execution_mode": "manual_policy_driven",
            "visibility_audit_state": "live execution did not produce complete canonical run ids for inspection",
            "comparison_task_intent": args.comparison_task_intent,
            "same_input_payload_required": True,
            "separate_model_policy_configs_allowed": True,
            "model_ids_may_differ_by_provider": True,
            "comparison_claim_excludes_model_quality_parity": True,
            "comparison_claim_excludes_provider_quality_parity": True,
        },
        "scope": {
            "workflow_id": EXPECTED_WORKFLOW_ID,
            "providers": [OPENROUTER_PROVIDER, OPENAI_PROVIDER],
            "claim": "bounded cross-provider h1.single.v1 provider-path smoke comparison",
        },
        "provider_runs": {
            OPENROUTER_PROVIDER: {
                "run_id": openrouter_run_id,
                "model_policy_config_path": Path(openrouter_model_policy_path).as_posix(),
                "live_execution": (live_execution or {}).get(OPENROUTER_PROVIDER),
            },
            OPENAI_PROVIDER: {
                "run_id": openai_run_id,
                "model_policy_config_path": Path(openai_model_policy_path).as_posix(),
                "live_execution": (live_execution or {}).get(OPENAI_PROVIDER),
            },
        },
        "summary": {
            "track_e_evidence_ready": False,
            "cross_provider_smoke_passed": False,
            "comparison_outcome": "BLOCKED",
            "blocked_reason": blocked_reason,
            "error_message": error_message,
        },
        "known_limits": [
            "No complete canonical cross-provider run pair is available when live mode fails before both run ids are emitted.",
            "This blocked report does not claim provider-path smoke success.",
        ],
    }


def _extract_run_id_from_cli_output(raw_output: Any) -> str | None:
    if not isinstance(raw_output, str) or not raw_output.strip():
        return None
    try:
        payload = json.loads(raw_output)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    summary = payload.get("summary")
    if not isinstance(summary, dict):
        return None
    run_id = summary.get("run_id")
    if isinstance(run_id, str) and run_id.strip():
        return run_id.strip()
    return None


def _extract_cli_output_summary(raw_output: Any) -> dict[str, Any] | None:
    if not isinstance(raw_output, str) or not raw_output.strip():
        return None
    try:
        payload = json.loads(raw_output)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    summary = payload.get("summary")
    if isinstance(summary, dict):
        return {
            "run_id": summary.get("run_id"),
            "workflow_id": summary.get("workflow_id"),
            "status": summary.get("status"),
            "errors_count": summary.get("errors_count"),
            "trace_events_count": summary.get("trace_events_count"),
            "schema_version": summary.get("schema_version"),
            "started_at": summary.get("started_at"),
            "completed_at": summary.get("completed_at"),
        }
    return None


def _output_excerpt(raw_output: Any, *, max_chars: int = 500) -> str | None:
    if not isinstance(raw_output, str):
        return None
    normalized = raw_output.strip()
    if not normalized:
        return None
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[:max_chars]}..."


if __name__ == "__main__":
    raise SystemExit(main())
