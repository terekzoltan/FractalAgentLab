from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.identity_drift_smoke import run_h2_o_identity_drift_smoke


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run W2-S3 H2-O identity drift smoke")
    parser.add_argument(
        "--run-id",
        action="append",
        required=True,
        help="Run id to include. May be specified multiple times.",
    )
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--identity-data-subdir", default="identity")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        report = run_h2_o_identity_drift_smoke(
            run_ids=list(args.run_id),
            data_dir=Path(args.data_dir),
            identity_data_subdir=args.identity_data_subdir,
        )
    except ValueError as error:
        parser.exit(status=2, message=f"{error}\n")
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_drift_smoke_passed(report) else 1


def is_drift_smoke_passed(report: dict[str, Any]) -> bool:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        return False
    return bool(summary.get("drift_smoke_passed"))


if __name__ == "__main__":
    raise SystemExit(main())
