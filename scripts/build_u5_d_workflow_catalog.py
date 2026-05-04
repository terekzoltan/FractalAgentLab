from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from fractal_agent_lab.cli.workflow_registry import (  # noqa: E402
    get_workflow_spec,
    list_workflow_ids,
)
from fractal_agent_lab.core.contracts import WorkflowSpec  # noqa: E402

SCHEMA_VERSION = "u5_d.workflow_catalog.v1"
SAFE_METADATA_KEYS = ("hero_workflow", "variant", "schema_contract")


def build_workflow_catalog() -> dict[str, Any]:
    workflows = [_build_workflow_entry(get_workflow_spec(workflow_id)) for workflow_id in list_workflow_ids()]
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "workflows": workflows,
        "warnings": [],
    }


def write_workflow_catalog(*, out_path: str | Path) -> dict[str, Any]:
    catalog = build_workflow_catalog()
    resolved_out = Path(out_path)
    resolved_out.parent.mkdir(parents=True, exist_ok=True)
    resolved_out.write_text(json.dumps(catalog, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return catalog


def _build_workflow_entry(spec: WorkflowSpec) -> dict[str, Any]:
    return {
        "workflow_id": spec.workflow_id,
        "name": spec.name,
        "version": spec.version,
        "execution_mode": spec.execution_mode.value,
        "input_schema_ref": spec.input_schema_ref,
        "output_schema_ref": spec.output_schema_ref,
        "step_count": len(spec.steps),
        "steps": [
            {
                "step_id": step.step_id,
                "agent_id": step.agent_id,
                "description": step.description,
            }
            for step in spec.steps
        ],
        "metadata": _safe_metadata(spec.metadata),
    }


def _safe_metadata(metadata: dict[str, Any]) -> dict[str, str | int | float | bool | None]:
    safe: dict[str, str | int | float | bool | None] = {}
    for key in SAFE_METADATA_KEYS:
        value = metadata.get(key)
        if value is None or isinstance(value, (str, int, float, bool)):
            safe[key] = value
    return safe


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the U5-D derived workflow catalog for the local UI.")
    parser.add_argument("--out", default="public/generated/workflows.json", help="Generated workflow catalog output path.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    try:
        catalog = write_workflow_catalog(out_path=args.out)
    except OSError as error:
        print(f"Error: failed to write workflow catalog: {error}", file=sys.stderr)
        return 2
    print(
        "Generated {count} workflow catalog entries at {path}.".format(
            count=len(catalog["workflows"]),
            path=Path(args.out).as_posix(),
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
