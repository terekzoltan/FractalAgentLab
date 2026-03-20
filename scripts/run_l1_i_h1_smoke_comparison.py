from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals import run_h1_smoke_comparison


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Wave 1 L1-I H1 smoke comparison")
    parser.add_argument(
        "--input-json",
        default='{"idea":"AI founder assistant for startup idea refinement"}',
        help="Shared comparison input payload as JSON object",
    )
    parser.add_argument("--provider", default="mock", help="Provider to use for all comparison runs")
    parser.add_argument("--runtime-config", default="configs/runtime.example.yaml")
    parser.add_argument("--providers-config", default="configs/providers.example.yaml")
    parser.add_argument("--model-policy-config", default="configs/model_policy.example.yaml")
    parser.add_argument("--data-dir", default=None, help="Optional artifact directory override")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        input_payload = _parse_input_json(args.input_json)
    except ValueError as error:
        print(f"Error: {error}")
        return 2

    report = run_h1_smoke_comparison(
        input_payload=input_payload,
        provider=args.provider,
        runtime_config_path=args.runtime_config,
        providers_config_path=args.providers_config,
        model_policy_config_path=args.model_policy_config,
        data_dir=Path(args.data_dir) if args.data_dir else None,
    )
    print(json.dumps(report, indent=2, ensure_ascii=True))

    summary = report.get("summary", {})
    if not isinstance(summary, dict):
        return 1
    return 0 if is_success_summary(summary) else 1


def _parse_input_json(raw: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError(f"--input-json must be valid JSON: {error.msg}.") from error
    if not isinstance(payload, dict):
        raise ValueError("--input-json must decode to a JSON object.")
    return payload


def is_success_summary(summary: dict[str, Any]) -> bool:
    return bool(
        summary.get("all_succeeded")
        and summary.get("all_artifacts_valid")
        and summary.get("all_comparable_outputs_complete"),
    )


if __name__ == "__main__":
    raise SystemExit(main())
