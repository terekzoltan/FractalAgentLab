from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.h2_run_comparison import run_h2_run_comparison_by_run_ids


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Wave 3 R3-K H2 replay-backed run comparison")
    parser.add_argument("--run-id", action="append", required=True, help="H2 run id to include (repeatable)")
    parser.add_argument("--data-dir", default="data")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    report = run_h2_run_comparison_by_run_ids(
        run_ids=list(args.run_id),
        data_dir=Path(args.data_dir),
    )
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_comparison_ready(report) else 1


def is_comparison_ready(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("comparison_ready"))


if __name__ == "__main__":
    raise SystemExit(main())
