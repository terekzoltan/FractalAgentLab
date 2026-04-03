from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.h1_baseline_tags import capture_h1_baseline_tags_by_run_ids


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Wave 2 H2-G H1 baseline/provenance tagging")
    parser.add_argument("--single-run-id", required=True)
    parser.add_argument("--manager-run-id", required=True)
    parser.add_argument("--handoff-run-id", required=True)
    parser.add_argument("--data-dir", default="data")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    report = capture_h1_baseline_tags_by_run_ids(
        single_run_id=args.single_run_id,
        manager_run_id=args.manager_run_id,
        handoff_run_id=args.handoff_run_id,
        data_dir=Path(args.data_dir),
    )
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_tag_capture_ready(report) else 1


def is_tag_capture_ready(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("tag_capture_ready"))


if __name__ == "__main__":
    raise SystemExit(main())
