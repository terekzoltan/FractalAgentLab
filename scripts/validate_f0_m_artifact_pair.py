from __future__ import annotations

import argparse
import json
from pathlib import Path

from fractal_agent_lab.evals import validate_run_trace_by_run_id


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate Wave 0 F0-M run/trace artifact pair")
    parser.add_argument("run_id", help="Run identifier to validate")
    parser.add_argument("--data-dir", default="data", help="Artifact base directory (default: data)")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    result = validate_run_trace_by_run_id(args.run_id, data_dir=Path(args.data_dir))
    output = {
        "run_id": result.run_id,
        "run_path": str(result.run_path),
        "trace_path": str(result.trace_path),
        "passed": result.passed,
        "errors": result.errors,
        "warnings": result.warnings,
    }
    print(json.dumps(output, indent=2, ensure_ascii=True))
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
