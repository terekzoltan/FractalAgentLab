from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.h1_evidence_prep import prepare_h1_evidence_prep


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Wave 1 L1-L H1 evidence prep")
    parser.add_argument(
        "--input-json",
        default='{"idea":"AI founder assistant for startup idea refinement"}',
        help="Shared evidence input payload as JSON object",
    )
    parser.add_argument("--provider", default="mock", help="Provider for all evidence runs")
    parser.add_argument("--runtime-config", default="configs/runtime.example.yaml")
    parser.add_argument("--providers-config", default="configs/providers.example.yaml")
    parser.add_argument("--model-policy-config", default="configs/model_policy.example.yaml")
    parser.add_argument("--data-dir", default=None, help="Optional artifact directory override")
    parser.add_argument(
        "--rubric-outcome",
        default=None,
        help="Optional manual rubric outcome label (PASS/PARTIAL/FAIL/BLOCKED)",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        input_payload = _parse_input_json(args.input_json)
    except ValueError as error:
        print(f"Error: {error}")
        return 2

    report = prepare_h1_evidence_prep(
        input_payload=input_payload,
        provider=args.provider,
        rubric_outcome=args.rubric_outcome,
        runtime_config_path=args.runtime_config,
        providers_config_path=args.providers_config,
        model_policy_config_path=args.model_policy_config,
        data_dir=Path(args.data_dir).as_posix() if args.data_dir else None,
    )
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_evidence_structurally_ready(report) else 1


def _parse_input_json(raw: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError(f"--input-json must be valid JSON: {error.msg}.") from error
    if not isinstance(payload, dict):
        raise ValueError("--input-json must decode to a JSON object.")
    return payload


def is_evidence_structurally_ready(report: dict[str, Any]) -> bool:
    summary = report.get("comparison_summary")
    if not isinstance(summary, dict):
        return False
    return bool(
        summary.get("all_succeeded")
        and summary.get("all_artifacts_valid")
        and summary.get("all_comparable_outputs_complete"),
    )


if __name__ == "__main__":
    raise SystemExit(main())
