from __future__ import annotations

import argparse
import json
from pathlib import Path

from fractal_agent_lab.evals.w6_usefulness_evaluation import (
    W6_F_DEFAULT_OUTPUT_DIR,
    W6UsefulnessEvaluationError,
    load_and_evaluate_w6_usefulness,
)


SUCCESS_EXIT_CODE = 0
INVALID_INPUT_EXIT_CODE = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run W6-F usefulness evaluation over W6 seed rows")
    parser.add_argument(
        "--input-row",
        action="append",
        required=True,
        help="Path to a w6.usefulness_seed_row.v1 JSON file. May be provided more than once.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(W6_F_DEFAULT_OUTPUT_DIR),
        help="Private local output directory for W6-F usefulness evaluation artifacts",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        summary = load_and_evaluate_w6_usefulness(
            input_row_paths=[Path(path) for path in args.input_row],
            output_dir=Path(args.output_dir),
        )
    except (OSError, json.JSONDecodeError, W6UsefulnessEvaluationError) as exc:
        print(json.dumps({"evaluated": False, "error": str(exc)}, indent=2, ensure_ascii=True))
        return INVALID_INPUT_EXIT_CODE
    print(json.dumps({"evaluated": True, "summary": summary}, indent=2, ensure_ascii=True))
    return SUCCESS_EXIT_CODE


if __name__ == "__main__":
    raise SystemExit(main())
