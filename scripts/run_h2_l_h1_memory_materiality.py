from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.h1_memory_materiality import run_h2_l_h1_memory_materiality


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run W2-S3 H2-L H1 memory materiality eval")
    parser.add_argument("--input-json", required=True, help="Workflow input payload as JSON object")
    parser.add_argument("--session-memory-json", required=True, help="Session memory seed JSON object")
    parser.add_argument("--session-id", required=True, help="Session id used by seeded and baseline branches")
    parser.add_argument("--provider", default="mock")
    parser.add_argument("--runtime-config", default="configs/runtime.example.yaml")
    parser.add_argument("--providers-config", default="configs/providers.example.yaml")
    parser.add_argument("--model-policy-config", default="configs/model_policy.example.yaml")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--include-single", action="store_true")
    parser.add_argument("--include-handoff", action="store_true")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    input_payload = _parse_json_object(args.input_json, flag_name="--input-json")
    session_memory_payload = _parse_json_object(
        args.session_memory_json,
        flag_name="--session-memory-json",
    )

    try:
        report = run_h2_l_h1_memory_materiality(
            input_payload=input_payload,
            session_memory_payload=session_memory_payload,
            session_id=args.session_id,
            provider=args.provider,
            runtime_config_path=args.runtime_config,
            providers_config_path=args.providers_config,
            model_policy_config_path=args.model_policy_config,
            data_dir=Path(args.data_dir),
            include_single=bool(args.include_single),
            include_handoff=bool(args.include_handoff),
        )
    except ValueError as error:
        parser.exit(status=2, message=f"{error}\n")
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_structural_ready(report) else 1


def is_structural_ready(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("structural_ready"))


def _parse_json_object(raw_value: str, *, flag_name: str) -> dict[str, Any]:
    try:
        decoded = json.loads(raw_value)
    except json.JSONDecodeError as error:
        raise SystemExit(f"{flag_name} must be valid JSON object: {error.msg}") from error
    if not isinstance(decoded, dict):
        raise SystemExit(f"{flag_name} must decode to a JSON object")
    return decoded


if __name__ == "__main__":
    raise SystemExit(main())
