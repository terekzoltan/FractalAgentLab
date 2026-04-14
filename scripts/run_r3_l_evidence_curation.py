from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.r3_l_evidence_curation import curate_r3_l_evidence


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Wave 3 R3-L evidence curation from explicit run ids")
    parser.add_argument("--h1-single-run-id", required=True)
    parser.add_argument("--h1-manager-run-id", required=True)
    parser.add_argument("--h1-handoff-run-id", required=True)
    parser.add_argument("--h2-run-id", action="append", required=True, help="H2 run id (repeatable)")
    parser.add_argument("--h3-run-id", required=True)
    parser.add_argument("--data-dir", default="data")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    report = curate_r3_l_evidence(
        h1_single_run_id=args.h1_single_run_id,
        h1_manager_run_id=args.h1_manager_run_id,
        h1_handoff_run_id=args.h1_handoff_run_id,
        h2_run_ids=list(args.h2_run_id),
        h3_run_id=args.h3_run_id,
        data_dir=Path(args.data_dir),
    )
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_track_a_handoff_ready(report) else 1


def is_track_a_handoff_ready(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("track_a_handoff_ready"))


if __name__ == "__main__":
    raise SystemExit(main())
