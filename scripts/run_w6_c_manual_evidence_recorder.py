from __future__ import annotations

import argparse
import json
from pathlib import Path

from fractal_agent_lab.evals.w6_manual_evidence_recorder import (
    W6ManualEvidenceRecorderError,
    load_and_record_w6_manual_evidence,
)


SUCCESS_EXIT_CODE = 0
INVALID_INPUT_EXIT_CODE = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Record W6-C manual evidence ledger artifacts from operator JSON")
    parser.add_argument("--input", required=True, help="Operator-provided w6.manual_evidence_input.v1 JSON file")
    parser.add_argument("--data-dir", default="data", help="Private local data directory for Wave 6 evidence output")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        summary = load_and_record_w6_manual_evidence(
            input_path=Path(args.input),
            data_dir=Path(args.data_dir),
        )
    except (OSError, json.JSONDecodeError, W6ManualEvidenceRecorderError) as exc:
        print(json.dumps({"recorded": False, "error": str(exc)}, indent=2, ensure_ascii=True))
        return INVALID_INPUT_EXIT_CODE
    print(json.dumps(summary, indent=2, ensure_ascii=True))
    return SUCCESS_EXIT_CODE


if __name__ == "__main__":
    raise SystemExit(main())
