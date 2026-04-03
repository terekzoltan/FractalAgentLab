from __future__ import annotations

import argparse
import json
from pathlib import Path

from fractal_agent_lab.evals import replay_run_artifacts_by_id


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Wave 2 H2-E artifact-backed replay")
    parser.add_argument("--run-id", required=True, help="Run identifier to replay from stored artifacts")
    parser.add_argument("--data-dir", default="data", help="Data directory that contains runs/ and traces/")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    report = replay_run_artifacts_by_id(args.run_id, data_dir=Path(args.data_dir))
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if is_replay_ready(report) else 1


def is_replay_ready(report: dict[str, object]) -> bool:
    return bool(report.get("replay_ready"))


if __name__ == "__main__":
    raise SystemExit(main())
