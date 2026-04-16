from __future__ import annotations

import argparse
import io
import json
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.cli.app import run_cli
from fractal_agent_lab.cli.config_loader import load_run_configs, resolve_data_dir
from fractal_agent_lab.evals.r3_p_h1_real_provider_smoke import (
    EXPECTED_PROVIDER,
    EXPECTED_WORKFLOW_ID,
    inspect_r3_p_h1_real_provider_run,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Wave 3 side-batch R3-P bounded H1 real-provider smoke")
    parser.add_argument("--run-id", default=None, help="Inspect-only mode run_id")
    parser.add_argument("--data-dir", default=None, help="Inspect-only mode: optional data directory override")
    parser.add_argument(
        "--input-json",
        default='{"idea":"AI founder assistant for startup idea refinement"}',
        help="Live mode only: input payload JSON object",
    )
    parser.add_argument("--runtime-config", default="configs/runtime.example.yaml")
    parser.add_argument("--providers-config", default="configs/providers.example.yaml")
    parser.add_argument("--model-policy-config", default="configs/model_policy.example.yaml")
    parser.add_argument("--provider", default=EXPECTED_PROVIDER)
    parser.add_argument("--show-trace", action="store_true")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    inspect_data_dir = Path(args.data_dir) if args.data_dir else Path("data")

    if args.run_id:
        report = inspect_r3_p_h1_real_provider_run(run_id=args.run_id, data_dir=inspect_data_dir)
        print(json.dumps(report, indent=2, ensure_ascii=True))
        return 0 if is_real_provider_smoke_passed(report) else 1

    if not _provider_is_openrouter(args.provider):
        parser.exit(status=2, message="--provider must be 'openrouter' for R3-P live mode.\n")

    try:
        _ = _parse_input_json(args.input_json)
    except ValueError as error:
        parser.exit(status=2, message=f"{error}\n")

    try:
        runtime_config, _, _ = load_run_configs(
            runtime_config_path=args.runtime_config,
            providers_config_path=args.providers_config,
            model_policy_config_path=args.model_policy_config,
        )
        runtime_data_dir = resolve_data_dir(runtime_config)
    except ValueError as error:
        blocked_report = _build_live_blocked_report(
            blocked_reason="config_load_error",
            error_message=str(error),
            live_execution={
                "cli_exit_code": 2,
                "run_cli_output": None,
            },
        )
        print(json.dumps(blocked_report, indent=2, ensure_ascii=True))
        return 2

    inspect_data_dir = runtime_data_dir

    live_result = _run_live_cli(args)
    run_id = _extract_run_id_from_cli_output(live_result["run_cli_output"])

    if run_id is None:
        blocked_report = _build_live_blocked_report(
            blocked_reason="live_run_did_not_emit_run_id",
            error_message="Live run output did not contain summary.run_id.",
            live_execution=live_result,
        )
        print(json.dumps(blocked_report, indent=2, ensure_ascii=True))
        return 2 if live_result["cli_exit_code"] == 2 else 1

    report = inspect_r3_p_h1_real_provider_run(run_id=run_id, data_dir=inspect_data_dir)
    report["live_execution"] = {
        "mode": "live_and_inspect",
        "cli_exit_code": live_result["cli_exit_code"],
        "run_cli_args": live_result["run_cli_args"],
        "run_cli_output_summary": live_result.get("run_cli_output_summary"),
        "run_id_from_cli": run_id,
        "inspection_data_dir": inspect_data_dir.as_posix(),
    }

    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_real_provider_smoke_passed(report) else 1


def is_track_e_evidence_ready(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("track_e_evidence_ready"))


def is_real_provider_smoke_passed(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("real_provider_smoke_passed"))


def _provider_is_openrouter(provider: Any) -> bool:
    return isinstance(provider, str) and provider.strip().lower() == EXPECTED_PROVIDER


def _parse_input_json(raw: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError(f"--input-json must be valid JSON: {error.msg}.") from error
    if not isinstance(payload, dict):
        raise ValueError("--input-json must decode to a JSON object.")
    return payload


def _run_live_cli(args: argparse.Namespace) -> dict[str, Any]:
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
        args.model_policy_config,
        "--provider",
        EXPECTED_PROVIDER,
    ]
    if args.show_trace:
        run_cli_args.append("--show-trace")

    output_buffer = io.StringIO()
    with redirect_stdout(output_buffer):
        cli_exit_code = run_cli(run_cli_args)

    run_cli_output = output_buffer.getvalue()

    return {
        "mode": "live_and_inspect",
        "cli_exit_code": cli_exit_code,
        "run_cli_args": run_cli_args,
        "run_cli_output": run_cli_output,
        "run_cli_output_summary": _extract_cli_output_summary(run_cli_output),
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
        return run_id
    return None


def _build_live_blocked_report(
    *,
    blocked_reason: str,
    error_message: str,
    live_execution: dict[str, Any],
) -> dict[str, Any]:
    return {
        "report_version": "r3_p.h1_real_provider_smoke.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "disclosure": {
            "execution_mode": "manual_policy_driven",
            "visibility_audit_state": (
                "git-visible coordination/code surfaces plus local data artifacts consulted; "
                "real-provider conclusions depend on local credentials/network/model mapping and canonical stored artifacts"
            ),
        },
        "scope": {
            "workflow_id": EXPECTED_WORKFLOW_ID,
            "provider": EXPECTED_PROVIDER,
            "claim": "one bounded real-provider smoke path",
        },
        "run_id": None,
        "live_execution": {
            "mode": live_execution.get("mode"),
            "cli_exit_code": live_execution.get("cli_exit_code"),
            "run_cli_args": live_execution.get("run_cli_args"),
            "run_cli_output_summary": live_execution.get("run_cli_output_summary"),
            "run_cli_output_excerpt": _output_excerpt(live_execution.get("run_cli_output")),
        },
        "summary": {
            "track_e_evidence_ready": False,
            "real_provider_smoke_passed": False,
            "smoke_outcome": "BLOCKED",
            "blocked_reason": blocked_reason,
            "error_message": error_message,
        },
        "known_limits": [
            "No canonical run/trace evidence is available when live mode fails before run_id emission.",
            "This blocked report does not claim real-provider success.",
        ],
    }


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
