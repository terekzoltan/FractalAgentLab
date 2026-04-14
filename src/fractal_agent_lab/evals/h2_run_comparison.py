from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id
from fractal_agent_lab.evals.h2_eval_contracts import (
    H2_EXPECTED_MANAGER_DELEGATE_ORDER,
    H2_EXPECTED_WORKFLOW_ID,
)
from fractal_agent_lab.evals.h2_eval_projections import extract_h2_comparable_output


def run_h2_run_comparison_by_run_ids(*, run_ids: list[str], data_dir: str | Path = "data") -> dict[str, Any]:
    reports = [_build_run_report(run_id=run_id, data_dir=data_dir) for run_id in run_ids]

    minimum_run_count_met = len(reports) >= 2
    all_artifacts_valid = all(report["artifact_validation"]["passed"] for report in reports)
    all_replay_ready = all(bool(report.get("replay_ready")) for report in reports)
    all_runs_match_expected_workflow = all(bool(report.get("workflow_matches_expected")) for report in reports)
    all_comparable_outputs_complete = all(bool(_nested(report, "comparable_output", "complete")) for report in reports)
    all_key_orders_match = all(bool(_nested(report, "comparable_output", "key_order_matches")) for report in reports)
    all_implementation_waves_valid = all(
        bool(_nested(report, "comparable_output", "implementation_waves_valid")) for report in reports
    )
    all_recommended_starting_slice_present = all(
        bool(_nested(report, "comparable_output", "recommended_starting_slice_present")) for report in reports
    )
    all_delegate_orders_match = all(bool(_nested(report, "manager_orchestration", "delegate_order_matches")) for report in reports)

    comparison_ready = bool(
        minimum_run_count_met
        and all_artifacts_valid
        and all_replay_ready
        and all_runs_match_expected_workflow
        and all_comparable_outputs_complete
        and all_key_orders_match
        and all_implementation_waves_valid
        and all_recommended_starting_slice_present
        and all_delegate_orders_match
    )

    return {
        "report_version": "r3_k.h2_run_comparison.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expected_workflow_id": H2_EXPECTED_WORKFLOW_ID,
        "runs": reports,
        "summary": {
            "run_count": len(reports),
            "minimum_run_count_met": minimum_run_count_met,
            "all_artifacts_valid": all_artifacts_valid,
            "all_replay_ready": all_replay_ready,
            "all_runs_match_expected_workflow": all_runs_match_expected_workflow,
            "all_comparable_outputs_complete": all_comparable_outputs_complete,
            "all_key_orders_match": all_key_orders_match,
            "all_implementation_waves_valid": all_implementation_waves_valid,
            "all_recommended_starting_slice_present": all_recommended_starting_slice_present,
            "all_delegate_orders_match": all_delegate_orders_match,
            "comparison_ready": comparison_ready,
        },
        "known_limits": [
            "This is a replay-backed structural comparability report for H2 runs, not winner scoring.",
            "Prompt/version metadata is evidence context only and is not a pass/fail scoring gate.",
            "Artifact paths are sourced from replay/validation surfaces, not inferred from CLI JSON output.",
        ],
    }


def _build_run_report(*, run_id: str, data_dir: str | Path) -> dict[str, Any]:
    validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)

    report: dict[str, Any] = {
        "run_id": run_id,
        "run_artifact_path": validation.run_path.as_posix(),
        "trace_artifact_path": validation.trace_path.as_posix(),
        "artifact_validation": {
            "passed": validation.passed,
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        },
        "replay_ready": validation.passed,
        "workflow_id": None,
        "workflow_matches_expected": False,
        "run_summary": {},
        "manager_orchestration": {
            "manager_step_id": None,
            "worker_step_ids": [],
            "delegate_targets": [],
            "delegate_order_matches": False,
        },
        "comparable_output": extract_h2_comparable_output({}),
    }

    if not validation.passed or not isinstance(validation.run_payload, dict):
        return report

    run_payload = validation.run_payload
    workflow_id = run_payload.get("workflow_id") if isinstance(run_payload.get("workflow_id"), str) else None
    output_payload = run_payload.get("output_payload") if isinstance(run_payload.get("output_payload"), dict) else {}

    manager_orchestration = (
        output_payload.get("manager_orchestration")
        if isinstance(output_payload.get("manager_orchestration"), dict)
        else {}
    )
    raw_turns = manager_orchestration.get("turns")
    turns = raw_turns if isinstance(raw_turns, list) else []
    delegate_targets = [
        turn.get("target_step_id")
        for turn in turns
        if isinstance(turn, dict) and turn.get("action") == "delegate" and isinstance(turn.get("target_step_id"), str)
    ]

    report["workflow_id"] = workflow_id
    report["workflow_matches_expected"] = workflow_id == H2_EXPECTED_WORKFLOW_ID
    report["run_summary"] = {
        "status": run_payload.get("status"),
        "schema_version": run_payload.get("schema_version"),
        "started_at": run_payload.get("started_at"),
        "completed_at": run_payload.get("completed_at"),
    }
    report["manager_orchestration"] = {
        "manager_step_id": manager_orchestration.get("manager_step_id"),
        "worker_step_ids": manager_orchestration.get("worker_step_ids"),
        "delegate_targets": delegate_targets,
        "delegate_order_matches": tuple(delegate_targets) == H2_EXPECTED_MANAGER_DELEGATE_ORDER,
    }
    report["comparable_output"] = extract_h2_comparable_output(output_payload)
    return report


def _nested(payload: Any, *keys: str) -> Any:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current
