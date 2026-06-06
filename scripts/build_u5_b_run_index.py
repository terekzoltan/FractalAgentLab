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

from fractal_agent_lab.cli.trace_reader import list_trace_browser_rows  # noqa: E402
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path  # noqa: E402

SCHEMA_VERSION = "u5_b.run_index.v1"
DEFAULT_LIMIT = 500
W7_OPENCODE_LOOP_WORKFLOW_ID = "opencode.meta_track.loop.v1"
W7_OPENCODE_LOOP_SUMMARY_SCHEMA_VERSION = "w7.opencode_loop_summary.v1"
W7_OPENCODE_LOOP_SUMMARY_FILE = "opencode_loop_summary.json"


def build_run_index(*, data_dir: str | Path, limit: int | None = DEFAULT_LIMIT) -> dict[str, Any]:
    data_dir_path = Path(data_dir)
    rows, warnings = list_trace_browser_rows(data_dir=data_dir_path, limit=limit)

    enriched_rows: list[dict[str, Any]] = []
    for row in rows:
        enriched_rows.append(_enrich_row(row=row, data_dir=data_dir_path, global_warnings=warnings))

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_dir": data_dir_path.as_posix(),
        "summary": _build_summary(enriched_rows, warnings),
        "runs": enriched_rows,
        "warnings": warnings,
    }


def write_run_index(*, data_dir: str | Path, out_path: str | Path, limit: int | None = DEFAULT_LIMIT) -> dict[str, Any]:
    index = build_run_index(data_dir=data_dir, limit=limit)
    resolved_out = Path(out_path)
    resolved_out.parent.mkdir(parents=True, exist_ok=True)
    resolved_out.write_text(json.dumps(index, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return index


def _enrich_row(*, row: dict[str, Any], data_dir: Path, global_warnings: list[str]) -> dict[str, Any]:
    run_id = _str_or_none(row.get("run_id")) or "unknown"
    run_warnings = _warnings_for_run(run_id=run_id, warnings=global_warnings)
    artifact_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir)
    run_path = Path(str(row.get("run_artifact_path", "")))
    warnings_before_run_load = len(run_warnings)
    run_payload = _load_run_payload(path=run_path, row_warnings=run_warnings)
    if len(run_warnings) > warnings_before_run_load:
        global_warnings.extend(run_warnings[warnings_before_run_load:])
    provider_names, model_names, fallback_state = _extract_provider_model_disclosure(run_payload)
    sidecar_files = _list_sidecar_files(artifact_dir)
    w7_summary = _load_w7_loop_summary(sidecar_dir=artifact_dir, run_id=run_id, row_warnings=run_warnings, global_warnings=global_warnings)

    row_state = "ok"
    if row.get("has_run_artifact") is False:
        row_state = "missing_run_artifact"
    elif run_payload is None:
        row_state = "invalid_run_artifact"
    elif row.get("trace_state") == "invalid":
        row_state = "invalid_trace_artifact"
    elif row.get("has_trace_artifact") is False:
        row_state = "missing_trace_artifact"

    return {
        **row,
        "artifact_dir_path": artifact_dir.as_posix(),
        "has_artifact_dir": artifact_dir.exists(),
        "sidecar_files": sidecar_files,
        "provider_names": provider_names,
        "model_names": model_names,
        "fallback_state": fallback_state,
        "row_state": row_state,
        "warnings": run_warnings,
        **_w7_run_fields(run_payload=run_payload, w7_summary=w7_summary, sidecar_files=sidecar_files),
    }


def _load_w7_loop_summary(
    *,
    sidecar_dir: Path,
    run_id: str,
    row_warnings: list[str],
    global_warnings: list[str],
) -> dict[str, Any] | None:
    summary_path = sidecar_dir / W7_OPENCODE_LOOP_SUMMARY_FILE
    if not summary_path.exists():
        return None
    try:
        value = json.loads(summary_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        warning = f"{run_id}: Invalid W7 sidecar {summary_path.as_posix()} ({error})"
        row_warnings.append(warning)
        global_warnings.append(warning)
        return None
    if not isinstance(value, dict):
        warning = f"{run_id}: Invalid W7 sidecar {summary_path.as_posix()} (root is not a JSON object)"
        row_warnings.append(warning)
        global_warnings.append(warning)
        return None
    if value.get("schema_version") != W7_OPENCODE_LOOP_SUMMARY_SCHEMA_VERSION:
        warning = (
            f"{run_id}: Invalid W7 sidecar {summary_path.as_posix()} "
            f"(schema_version must be {W7_OPENCODE_LOOP_SUMMARY_SCHEMA_VERSION!r})"
        )
        row_warnings.append(warning)
        global_warnings.append(warning)
        return None
    if value.get("run_id") != run_id:
        warning = f"{run_id}: Invalid W7 sidecar {summary_path.as_posix()} (run_id mismatch)"
        row_warnings.append(warning)
        global_warnings.append(warning)
        return None
    return value


def _w7_run_fields(
    *,
    run_payload: dict[str, Any] | None,
    w7_summary: dict[str, Any] | None,
    sidecar_files: list[str],
) -> dict[str, Any]:
    workflow_id = _str_or_none(run_payload.get("workflow_id")) if run_payload is not None else None
    has_w7_sidecar = W7_OPENCODE_LOOP_SUMMARY_FILE in sidecar_files
    if workflow_id == W7_OPENCODE_LOOP_WORKFLOW_ID or has_w7_sidecar:
        run_origin = "opencode_backed"
    elif run_payload is None:
        run_origin = "unknown"
    else:
        run_origin = "fal_native"

    privacy_audit_state = w7_summary.get("privacy_audit_state") if isinstance(w7_summary, dict) else None
    required_followup_count = w7_summary.get("required_followup_count") if isinstance(w7_summary, dict) else None
    return {
        "run_origin": run_origin,
        "target_project_id": _str_or_none(w7_summary.get("target_project_id")) if isinstance(w7_summary, dict) else None,
        "target_project_name": _str_or_none(w7_summary.get("target_project_name")) if isinstance(w7_summary, dict) else None,
        "sequence_ref": _str_or_none(w7_summary.get("sequence_ref")) if isinstance(w7_summary, dict) else None,
        "final_decision": _str_or_none(w7_summary.get("final_decision")) if isinstance(w7_summary, dict) else None,
        "overall_outcome": _str_or_none(w7_summary.get("overall_outcome")) if isinstance(w7_summary, dict) else None,
        "validation_state": _str_or_none(w7_summary.get("validation_state")) if isinstance(w7_summary, dict) else None,
        "clean_pass_eligible": w7_summary.get("clean_pass_eligible") if isinstance(w7_summary, dict) and isinstance(w7_summary.get("clean_pass_eligible"), bool) else None,
        "packet_count": _non_negative_int_or_none(w7_summary.get("packet_count")) if isinstance(w7_summary, dict) else None,
        "approval_count": _non_negative_int_or_none(w7_summary.get("approval_count")) if isinstance(w7_summary, dict) else None,
        "selected_output_count": _non_negative_int_or_none(w7_summary.get("selected_output_count")) if isinstance(w7_summary, dict) else None,
        "review_synthesis_present": w7_summary.get("review_synthesis_present") if isinstance(w7_summary, dict) and isinstance(w7_summary.get("review_synthesis_present"), bool) else None,
        "privacy_retention_mode": _str_or_none(privacy_audit_state.get("retention_mode")) if isinstance(privacy_audit_state, dict) else None,
        "public_export_state": _str_or_none(privacy_audit_state.get("public_export_state")) if isinstance(privacy_audit_state, dict) else None,
        "required_followup_count": _non_negative_int_or_none(required_followup_count),
    }


def _load_run_payload(*, path: Path, row_warnings: list[str]) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        _append_invalid_run_warning(path=path, error=str(error), row_warnings=row_warnings)
        return None
    if not isinstance(value, dict):
        _append_invalid_run_warning(path=path, error="root is not a JSON object", row_warnings=row_warnings)
        return None
    return value


def _append_invalid_run_warning(*, path: Path, error: str, row_warnings: list[str]) -> None:
    if any("Invalid run artifact" in warning and path.as_posix() in warning for warning in row_warnings):
        return
    row_warnings.append(f"Invalid run artifact: {path.as_posix()} ({error})")


def _extract_provider_model_disclosure(run_payload: dict[str, Any] | None) -> tuple[list[str], list[str], str]:
    if run_payload is None:
        return [], [], "unknown"

    providers: set[str] = set()
    models: set[str] = set()
    fallback_observed = False
    fallback_not_observed = False

    for mapping in _walk_dicts(run_payload):
        for key in ("provider", "selected_provider", "executed_provider", "requested_provider", "response_provider"):
            value = _str_or_none(mapping.get(key))
            if value is not None:
                providers.add(value)
        for key in ("model", "selected_model", "executed_model", "requested_model", "response_model"):
            value = _str_or_none(mapping.get(key))
            if value is not None:
                models.add(value)

        fallback = mapping.get("fallback")
        if isinstance(fallback, dict):
            fallback_observed = True
        elif isinstance(fallback, bool):
            fallback_observed = fallback_observed or fallback
            fallback_not_observed = fallback_not_observed or not fallback

        used_fallback = mapping.get("used_fallback")
        if isinstance(used_fallback, bool):
            fallback_observed = fallback_observed or used_fallback
            fallback_not_observed = fallback_not_observed or not used_fallback

    if fallback_observed:
        fallback_state = "observed"
    elif fallback_not_observed:
        fallback_state = "not_observed"
    else:
        fallback_state = "unknown"

    return sorted(providers), sorted(models), fallback_state


def _walk_dicts(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        found.append(value)
        for nested in value.values():
            found.extend(_walk_dicts(nested))
    elif isinstance(value, list):
        for item in value:
            found.extend(_walk_dicts(item))
    return found


def _list_sidecar_files(directory: Path) -> list[str]:
    if not directory.exists() or not directory.is_dir():
        return []
    try:
        entries = [entry.name for entry in directory.iterdir() if entry.is_file()]
    except OSError:
        return []
    return sorted(entries)


def _warnings_for_run(*, run_id: str, warnings: list[str]) -> list[str]:
    return [warning for warning in warnings if run_id in warning]


def _build_summary(rows: list[dict[str, Any]], warnings: list[str]) -> dict[str, Any]:
    return {
        "total_runs": len(rows),
        "workflow_counts": _counts_for(rows, "workflow_id"),
        "status_counts": _counts_for(rows, "status"),
        "trace_state_counts": _counts_for(rows, "trace_state"),
        "run_origin_counts": _counts_for(rows, "run_origin"),
        "target_project_counts": _counts_for(rows, "target_project_id"),
        "final_decision_counts": _counts_for(rows, "final_decision"),
        "warnings_count": len(warnings),
    }


def _counts_for(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = _str_or_none(row.get(key)) or "unknown"
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


def _non_negative_int_or_none(value: Any) -> int | None:
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    return None


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the U5-B derived run index for the local UI.")
    parser.add_argument("--data-dir", default="../data", help="Canonical FAL data directory to index.")
    parser.add_argument("--out", default="public/generated/run-index.json", help="Generated index output path.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Maximum rows to include after deterministic sorting.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.limit is not None and args.limit <= 0:
        print("Error: --limit must be a positive integer.", file=sys.stderr)
        return 2
    try:
        index = write_run_index(data_dir=args.data_dir, out_path=args.out, limit=args.limit)
    except OSError as error:
        print(f"Error: failed to write run index: {error}", file=sys.stderr)
        return 2
    print(
        "Generated {count} run rows at {path} with {warnings} warnings.".format(
            count=index["summary"]["total_runs"],
            path=Path(args.out).as_posix(),
            warnings=index["summary"]["warnings_count"],
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
