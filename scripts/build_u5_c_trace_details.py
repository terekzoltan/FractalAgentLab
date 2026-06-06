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

from fractal_agent_lab.cli.trace_reader import (  # noqa: E402
    list_trace_browser_rows,
    load_trace_view_artifacts,
)

SCHEMA_VERSION = "u5_c.trace_detail.v1"
DEFAULT_LIMIT = 500
GENERATED_TRACE_DETAILS_SENTINEL = ".fal-u5-c-trace-details-generated"
GENERATED_TRACE_DETAILS_SENTINEL_CONTENT = "u5_c.trace_detail.generated_dir.v1\n"
DEFAULT_GENERATED_TRACE_DETAILS_DIR = REPO_ROOT / "ui" / "public" / "generated" / "traces"
CANONICAL_DATA_DIR = REPO_ROOT / "data"
W7_OPENCODE_LOOP_SUMMARY_FILE = "opencode_loop_summary.json"
W7_PACKET_LEDGER_FILE = "packet_ledger.json"
W7_SELECTED_OUTPUTS_FILE = "selected_outputs.json"
W7_REVIEW_SYNTHESIS_FILE = "review_synthesis.json"
W7_APPROVAL_LOG_FILE = "approval_log.json"
W7_OPENCODE_LOOP_SUMMARY_SCHEMA_VERSION = "w7.opencode_loop_summary.v1"
W7_PACKET_LEDGER_SCHEMA_VERSION = "w7.packet_ledger.v1"
W7_SELECTED_OUTPUTS_SCHEMA_VERSION = "w7.selected_outputs.v1"
W7_REVIEW_SYNTHESIS_SCHEMA_VERSION = "w7.review_synthesis.v1"
W7_APPROVAL_LOG_SCHEMA_VERSION = "w7.approval_log.v1"
FAILURE_EVENT_TYPES = {
    "run_failed",
    "run_cancelled",
    "run_timed_out",
    "step_failed",
    "agent_failed",
    "handoff_failed",
}


def build_trace_detail(*, run_id: str, data_dir: str | Path) -> dict[str, Any]:
    run_payload, trace_events, run_artifact_path, trace_artifact_path = load_trace_view_artifacts(
        run_id=run_id,
        data_dir=data_dir,
    )
    validation = _build_validation(trace_events)
    events = [_build_event_record(event) for event in trace_events]
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "workflow_id": _str_or_none(run_payload.get("workflow_id")) if isinstance(run_payload, dict) else None,
        "status": _str_or_none(run_payload.get("status")) if isinstance(run_payload, dict) else None,
        "run_artifact_path": run_artifact_path.as_posix() if isinstance(run_payload, dict) else None,
        "trace_artifact_path": trace_artifact_path.as_posix(),
        "summary": _build_summary(trace_events),
        "validation": validation,
        "events": events,
        "opencode_loop": _build_opencode_loop_detail(run_id=run_id, data_dir=Path(data_dir)),
    }


def _build_opencode_loop_detail(*, run_id: str, data_dir: Path) -> dict[str, Any] | None:
    artifact_dir = data_dir / "artifacts" / run_id
    summary_path = artifact_dir / W7_OPENCODE_LOOP_SUMMARY_FILE
    if not summary_path.exists():
        return None

    warnings: list[str] = []
    summary = _load_optional_sidecar(
        summary_path,
        W7_OPENCODE_LOOP_SUMMARY_FILE,
        warnings,
        expected_schema_version=W7_OPENCODE_LOOP_SUMMARY_SCHEMA_VERSION,
        run_id=run_id,
        require_run_id=True,
    )
    if summary is None:
        return {
            "summary": None,
            "packet_ledger_entries": [],
            "selected_outputs": [],
            "approval_checkpoints": [],
            "review_synthesis": None,
            "sidecar_paths": {"opencode_loop_summary": summary_path.as_posix()},
            "warnings": warnings,
        }

    packet_ledger = _load_optional_sidecar(
        artifact_dir / W7_PACKET_LEDGER_FILE,
        W7_PACKET_LEDGER_FILE,
        warnings,
        expected_schema_version=W7_PACKET_LEDGER_SCHEMA_VERSION,
        run_id=run_id,
    )
    selected_outputs = _load_optional_sidecar(
        artifact_dir / W7_SELECTED_OUTPUTS_FILE,
        W7_SELECTED_OUTPUTS_FILE,
        warnings,
        expected_schema_version=W7_SELECTED_OUTPUTS_SCHEMA_VERSION,
        run_id=run_id,
    )
    approval_log = _load_optional_sidecar(
        artifact_dir / W7_APPROVAL_LOG_FILE,
        W7_APPROVAL_LOG_FILE,
        warnings,
        expected_schema_version=W7_APPROVAL_LOG_SCHEMA_VERSION,
        run_id=run_id,
    )
    review_synthesis = _load_optional_sidecar(
        artifact_dir / W7_REVIEW_SYNTHESIS_FILE,
        W7_REVIEW_SYNTHESIS_FILE,
        warnings,
        expected_schema_version=W7_REVIEW_SYNTHESIS_SCHEMA_VERSION,
        run_id=run_id,
    )

    return {
        "summary": _compact_opencode_summary(summary),
        "packet_ledger_entries": _packet_ledger_entries(packet_ledger),
        "selected_outputs": _selected_output_rows(selected_outputs),
        "approval_checkpoints": _approval_checkpoint_rows(approval_log),
        "review_synthesis": _compact_review_synthesis(review_synthesis),
        "sidecar_paths": _w7_sidecar_paths(artifact_dir),
        "warnings": warnings,
    }


def _load_optional_sidecar(
    path: Path,
    label: str,
    warnings: list[str],
    *,
    expected_schema_version: str,
    run_id: str,
    require_run_id: bool = False,
) -> dict[str, Any] | None:
    if not path.exists():
        warnings.append(f"Missing W7 sidecar {label}: {path.as_posix()}")
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        warnings.append(f"Invalid W7 sidecar {label}: {path.as_posix()} ({error})")
        return None
    if not isinstance(value, dict):
        warnings.append(f"Invalid W7 sidecar {label}: {path.as_posix()} (root is not a JSON object)")
        return None
    if value.get("schema_version") != expected_schema_version:
        warnings.append(f"Invalid W7 sidecar {label}: {path.as_posix()} (schema_version must be {expected_schema_version!r})")
        return None
    sidecar_run_id = value.get("run_id")
    if require_run_id and sidecar_run_id != run_id:
        warnings.append(f"Invalid W7 sidecar {label}: {path.as_posix()} (run_id mismatch)")
        return None
    if sidecar_run_id is not None and sidecar_run_id != run_id:
        warnings.append(f"Invalid W7 sidecar {label}: {path.as_posix()} (run_id mismatch)")
        return None
    return value


def _compact_opencode_summary(payload: dict[str, Any]) -> dict[str, Any]:
    privacy_audit_state = payload.get("privacy_audit_state") if isinstance(payload.get("privacy_audit_state"), dict) else {}
    return {
        "run_id": _str_or_none(payload.get("run_id")),
        "workflow_id": _str_or_none(payload.get("workflow_id")),
        "target_project_id": _str_or_none(payload.get("target_project_id")),
        "target_project_name": _str_or_none(payload.get("target_project_name")),
        "external_loop_id": _str_or_none(payload.get("external_loop_id")),
        "sequence_ref": _str_or_none(payload.get("sequence_ref")),
        "overall_outcome": _str_or_none(payload.get("overall_outcome")),
        "terminal_stage": _str_or_none(payload.get("terminal_stage")),
        "final_decision": _str_or_none(payload.get("final_decision")),
        "validation_state": _str_or_none(payload.get("validation_state")),
        "clean_pass_eligible": payload.get("clean_pass_eligible") if isinstance(payload.get("clean_pass_eligible"), bool) else None,
        "packet_count": _non_negative_int_or_none(payload.get("packet_count")),
        "approval_count": _non_negative_int_or_none(payload.get("approval_count")),
        "selected_output_count": _non_negative_int_or_none(payload.get("selected_output_count")),
        "review_synthesis_present": payload.get("review_synthesis_present") if isinstance(payload.get("review_synthesis_present"), bool) else None,
        "privacy_retention_mode": _str_or_none(privacy_audit_state.get("retention_mode")),
        "public_export_state": _str_or_none(privacy_audit_state.get("public_export_state")),
    }


def _packet_ledger_entries(payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    entries = payload.get("entries") if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        return []
    rows: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        rows.append(
            {
                "sequence": _non_negative_int_or_none(entry.get("sequence")),
                "stage": _str_or_none(entry.get("stage")),
                "producer": _str_or_none(entry.get("producer")),
                "consumer": _str_or_none(entry.get("consumer")),
                "source_command": _str_or_none(entry.get("source_command")),
                "decision": _str_or_none(entry.get("decision")),
                "summary": _str_or_none(entry.get("summary")),
                "validation_state": _str_or_none(entry.get("validation_state")),
                "packet_ref": _str_or_none(entry.get("packet_ref")),
                "selected_output_ref": _str_or_none(entry.get("selected_output_ref")),
                "approval_ref": _str_or_none(entry.get("approval_ref")),
            }
        )
    return rows


def _selected_output_rows(payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    outputs = payload.get("outputs") if isinstance(payload, dict) else None
    if not isinstance(outputs, list):
        return []
    rows: list[dict[str, Any]] = []
    for output in outputs:
        if not isinstance(output, dict):
            continue
        rows.append(
            {
                "output_id": _str_or_none(output.get("output_id")),
                "stage": _str_or_none(output.get("stage")),
                "source_session": _str_or_none(output.get("source_session")),
                "message_id": _str_or_none(output.get("message_id")),
                "capture_mode": _str_or_none(output.get("capture_mode")),
                "summary": _str_or_none(output.get("summary")),
                "excerpt": _str_or_none(output.get("excerpt")),
                "excerpt_truncated": output.get("excerpt_truncated") if isinstance(output.get("excerpt_truncated"), bool) else None,
                "privacy_classification": _str_or_none(output.get("privacy_classification")),
            }
        )
    return rows


def _approval_checkpoint_rows(payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    checkpoints = payload.get("checkpoints") if isinstance(payload, dict) else None
    if not isinstance(checkpoints, list):
        return []
    rows: list[dict[str, Any]] = []
    for checkpoint in checkpoints:
        if not isinstance(checkpoint, dict):
            continue
        rows.append(
            {
                "checkpoint_id": _str_or_none(checkpoint.get("checkpoint_id")),
                "action_kind": _str_or_none(checkpoint.get("action_kind")),
                "target_session": _str_or_none(checkpoint.get("target_session")),
                "stage": _str_or_none(checkpoint.get("stage")),
                "approved": checkpoint.get("approved") if isinstance(checkpoint.get("approved"), bool) else None,
                "approved_at": _str_or_none(checkpoint.get("approved_at")),
                "approval_mode": _str_or_none(checkpoint.get("approval_mode")),
            }
        )
    return rows


def _compact_review_synthesis(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if payload is None:
        return None
    plan_review = payload.get("plan_review") if isinstance(payload.get("plan_review"), dict) else {}
    step_review = payload.get("step_review") if isinstance(payload.get("step_review"), dict) else {}
    return {
        "plan_verdict": _str_or_none(plan_review.get("verdict")),
        "plan_summary": _str_or_none(plan_review.get("summary")),
        "step_final_verdict": _str_or_none(step_review.get("final_verdict")),
        "step_final_summary": _str_or_none(step_review.get("final_summary")),
        "swarm_verdict": _str_or_none(step_review.get("swarm_verdict")),
    }


def _w7_sidecar_paths(artifact_dir: Path) -> dict[str, str]:
    return {
        "opencode_loop_summary": (artifact_dir / W7_OPENCODE_LOOP_SUMMARY_FILE).as_posix(),
        "packet_ledger": (artifact_dir / W7_PACKET_LEDGER_FILE).as_posix(),
        "selected_outputs": (artifact_dir / W7_SELECTED_OUTPUTS_FILE).as_posix(),
        "review_synthesis": (artifact_dir / W7_REVIEW_SYNTHESIS_FILE).as_posix(),
        "approval_log": (artifact_dir / W7_APPROVAL_LOG_FILE).as_posix(),
    }


def write_trace_details(
    *,
    data_dir: str | Path,
    out_dir: str | Path,
    limit: int | None = DEFAULT_LIMIT,
) -> dict[str, Any]:
    rows, row_warnings = list_trace_browser_rows(data_dir=data_dir, limit=limit)
    resolved_out_dir = Path(out_dir)
    _prepare_generated_trace_details_dir(resolved_out_dir)

    generated = 0
    skipped = 0
    warnings = list(row_warnings)

    for row in rows:
        run_id = _str_or_none(row.get("run_id"))
        if run_id is None:
            skipped += 1
            continue
        if row.get("trace_state") != "ok":
            skipped += 1
            continue
        try:
            detail = build_trace_detail(run_id=run_id, data_dir=data_dir)
        except ValueError as error:
            warnings.append(f"{run_id}: {error}")
            skipped += 1
            continue
        out_path = resolved_out_dir / f"{run_id}.json"
        out_path.write_text(json.dumps(detail, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        generated += 1

    return {
        "generated_count": generated,
        "skipped_count": skipped,
        "warnings_count": len(warnings),
        "warnings": warnings,
    }


def _prepare_generated_trace_details_dir(directory: Path) -> None:
    resolved_directory = directory.resolve()
    _raise_if_canonical_data_output(resolved_directory)

    if not directory.exists():
        directory.mkdir(parents=True, exist_ok=True)
        _write_generated_trace_details_sentinel(directory)
        return

    if not directory.is_dir():
        raise OSError(f"Trace detail output path is not a directory: {directory}")

    sentinel_path = directory / GENERATED_TRACE_DETAILS_SENTINEL
    entries = list(directory.iterdir())
    if not entries:
        _write_generated_trace_details_sentinel(directory)
        return

    if _has_valid_generated_trace_details_sentinel(sentinel_path):
        _remove_existing_trace_details(directory)
        return

    if resolved_directory == DEFAULT_GENERATED_TRACE_DETAILS_DIR.resolve():
        _write_generated_trace_details_sentinel(directory)
        _remove_existing_trace_details(directory)
        return

    raise OSError(
        "Refusing to clean non-empty trace detail output directory without "
        f"{GENERATED_TRACE_DETAILS_SENTINEL}: {directory}",
    )


def _raise_if_canonical_data_output(resolved_directory: Path) -> None:
    try:
        resolved_directory.relative_to(CANONICAL_DATA_DIR.resolve())
    except ValueError:
        return
    raise OSError(f"Refusing to write generated trace details under canonical data directory: {resolved_directory}")


def _write_generated_trace_details_sentinel(directory: Path) -> None:
    (directory / GENERATED_TRACE_DETAILS_SENTINEL).write_text(GENERATED_TRACE_DETAILS_SENTINEL_CONTENT, encoding="utf-8")


def _has_valid_generated_trace_details_sentinel(path: Path) -> bool:
    try:
        return path.is_file() and path.read_text(encoding="utf-8") == GENERATED_TRACE_DETAILS_SENTINEL_CONTENT
    except OSError:
        return False


def _remove_existing_trace_details(directory: Path) -> None:
    for path in directory.glob("*.json"):
        path.unlink(missing_ok=True)


def _build_summary(trace_events: list[dict[str, Any]]) -> dict[str, Any]:
    event_counts: dict[str, int] = {}
    lane_counts: dict[str, int] = {}
    max_turn_index: int | None = None
    linked_parent = 0
    linked_corr = 0

    for event in trace_events:
        event_type = _str_or_none(event.get("event_type")) or "unknown"
        event_counts[event_type] = event_counts.get(event_type, 0) + 1

        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        lane = _str_or_none(payload.get("lane"))
        if lane is not None:
            lane_counts[lane] = lane_counts.get(lane, 0) + 1

        turn_index = payload.get("turn_index")
        if isinstance(turn_index, int):
            max_turn_index = turn_index if max_turn_index is None else max(max_turn_index, turn_index)

        if _str_or_none(event.get("parent_event_id")) is not None:
            linked_parent += 1
        if _str_or_none(event.get("correlation_id")) is not None:
            linked_corr += 1

    return {
        "total_events": len(trace_events),
        "event_counts": dict(sorted(event_counts.items())),
        "lane_counts": dict(sorted(lane_counts.items())),
        "max_turn_index": max_turn_index,
        "linked_events": {
            "with_parent_event_id": linked_parent,
            "with_correlation_id": linked_corr,
        },
    }


def _build_validation(trace_events: list[dict[str, Any]]) -> dict[str, Any]:
    warnings: list[str] = []
    timestamp_order = _timestamp_order(trace_events, warnings)
    linkage_state = _linkage_state(trace_events, warnings)
    trace_state = "warning" if warnings else "ok"
    return {
        "trace_state": trace_state,
        "warnings": warnings,
        "timestamp_order": timestamp_order,
        "linkage_state": linkage_state,
    }


def _timestamp_order(trace_events: list[dict[str, Any]], warnings: list[str]) -> str:
    previous: datetime | None = None
    state = "ok"
    for event in trace_events:
        timestamp = _parse_iso_timestamp(_str_or_none(event.get("timestamp")))
        if timestamp is None:
            warnings.append(f"Event #{event.get('sequence')} has missing or invalid timestamp.")
            state = "warning"
            continue
        if previous is not None and timestamp < previous:
            warnings.append(
                f"Timestamp order warning at event #{event.get('sequence')}: canonical sequence is preserved.",
            )
            state = "warning"
        previous = timestamp
    return state if trace_events else "unknown"


def _linkage_state(trace_events: list[dict[str, Any]], warnings: list[str]) -> str:
    event_ids = {
        event_id
        for event_id in (_str_or_none(event.get("event_id")) for event in trace_events)
        if event_id is not None
    }
    state = "ok"
    for event in trace_events:
        parent_event_id = _str_or_none(event.get("parent_event_id"))
        if parent_event_id is not None and parent_event_id not in event_ids:
            warnings.append(
                f"Missing parent_event_id target for event #{event.get('sequence')}: {parent_event_id}",
            )
            state = "warning"
    return state if trace_events else "unknown"


def _build_event_record(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    event_type = _str_or_none(event.get("event_type")) or "unknown"
    return {
        "event_id": _str_or_none(event.get("event_id")),
        "sequence": int(event.get("sequence")),
        "timestamp": _str_or_none(event.get("timestamp")),
        "event_type": event_type,
        "source": _str_or_none(event.get("source")),
        "step_id": _str_or_none(event.get("step_id")),
        "parent_event_id": _str_or_none(event.get("parent_event_id")),
        "correlation_id": _str_or_none(event.get("correlation_id")),
        "lane": _str_or_none(payload.get("lane")),
        "turn_index": payload.get("turn_index") if isinstance(payload.get("turn_index"), int) else None,
        "handoff_index": payload.get("handoff_index") if isinstance(payload.get("handoff_index"), int) else None,
        "from_step_id": _str_or_none(payload.get("from_step_id")),
        "to_step_id": _str_or_none(payload.get("to_step_id")),
        "is_failure": event_type in FAILURE_EVENT_TYPES,
        "payload_summary": _payload_summary(payload),
        "payload": payload,
    }


def _payload_summary(payload: dict[str, Any]) -> str:
    scalar_parts: list[str] = []
    for key in sorted(payload):
        value = payload[key]
        if isinstance(value, (str, int, float, bool)):
            scalar_parts.append(f"{key}={value}")
        if len(scalar_parts) == 4:
            break
    if scalar_parts:
        return ", ".join(scalar_parts)
    if payload:
        return f"payload keys: {', '.join(sorted(payload))}"
    return "no payload fields"


def _parse_iso_timestamp(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


def _non_negative_int_or_none(value: Any) -> int | None:
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    return None


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build strict-valid U5-C trace detail files for the local UI.")
    parser.add_argument("--data-dir", default="../data", help="Canonical FAL data directory to read.")
    parser.add_argument("--out-dir", default="public/generated/traces", help="Generated trace details directory.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Maximum runs to inspect after deterministic sorting.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.limit is not None and args.limit <= 0:
        print("Error: --limit must be a positive integer.", file=sys.stderr)
        return 2
    try:
        summary = write_trace_details(data_dir=args.data_dir, out_dir=args.out_dir, limit=args.limit)
    except OSError as error:
        print(f"Error: failed to write trace details: {error}", file=sys.stderr)
        return 2
    print(
        "Generated {generated} trace detail files at {path}; skipped {skipped}; warnings {warnings}.".format(
            generated=summary["generated_count"],
            path=Path(args.out_dir).as_posix(),
            skipped=summary["skipped_count"],
            warnings=summary["warnings_count"],
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
