from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.cv1_d_h4_usefulness_check import inspect_cv1_d_h4_usefulness

PASS_EXIT_CODE = 0
FAIL_EXIT_CODE = 1
BLOCKED_EXIT_CODE = 3


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run CV1-D H4 usefulness check (inspect-first)")
    parser.add_argument("--seq-next-run-id", required=True, help="Required h4.seq_next.v1 run_id")
    parser.add_argument("--baseline-plan", required=True, help="Required external/manual baseline plan path")
    parser.add_argument(
        "--comparison-task-intent",
        required=True,
        help="Required operator assertion that H4 and baseline target the same task intent",
    )
    parser.add_argument("--wave-start-run-id", default=None, help="Optional h4.wave_start.v1 run_id for additive packet lane")
    parser.add_argument("--data-dir", default="data", help="Data directory containing runs/traces/artifacts")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    report = inspect_cv1_d_h4_usefulness(
        seq_next_run_id=args.seq_next_run_id,
        baseline_plan_path=args.baseline_plan,
        comparison_task_intent=args.comparison_task_intent,
        wave_start_run_id=args.wave_start_run_id,
        data_dir=Path(args.data_dir),
    )
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return exit_code_for_report(report)


def is_track_e_evidence_ready(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("track_e_evidence_ready"))


def is_h4_usefulness_passed(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("h4_usefulness_passed"))


def report_outcome(report: dict[str, Any]) -> str:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return "FAIL"
    outcome = summary.get("eval_outcome")
    if isinstance(outcome, str) and outcome in {"PASS", "FAIL", "BLOCKED"}:
        return outcome
    return "FAIL"


def exit_code_for_report(report: dict[str, Any]) -> int:
    outcome = report_outcome(report)
    if outcome == "PASS":
        return PASS_EXIT_CODE
    if outcome == "BLOCKED":
        return BLOCKED_EXIT_CODE
    return FAIL_EXIT_CODE


if __name__ == "__main__":
    raise SystemExit(main())
