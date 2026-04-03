from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.h1_artifact_set import load_h1_replay_reports_by_run_ids


def run_h1_smoke_suite_by_run_ids(
    *,
    single_run_id: str,
    manager_run_id: str,
    handoff_run_id: str,
    data_dir: str | Path = "data",
) -> dict[str, Any]:
    artifact_set = load_h1_replay_reports_by_run_ids(
        single_run_id=single_run_id,
        manager_run_id=manager_run_id,
        handoff_run_id=handoff_run_id,
        data_dir=data_dir,
    )

    variants: list[dict[str, Any]] = []
    for entry in artifact_set.get("variants", []):
        if not isinstance(entry, dict):
            continue
        variants.append(_build_variant_smoke_report(entry))

    all_artifacts_valid = all(_bool_nested(item, "artifact_validation", "passed") for item in variants)
    all_replay_ready = all(bool(item.get("replay_ready")) for item in variants)
    all_outputs_complete = all(_bool_nested(item, "comparable_output", "complete") for item in variants)
    handoff_linkage_preserved = all(
        _handoff_linkage_ok(item)
        for item in variants
        if item.get("expected_workflow_id") == "h1.handoff.v1"
    )
    all_variant_specific_checks = all(
        all(bool(check.get("passed")) for check in (item.get("smoke_checks") or []))
        for item in variants
    )

    set_summary = artifact_set.get("summary") if isinstance(artifact_set.get("summary"), dict) else {}
    all_required_variants_present = bool(set_summary.get("all_required_variants_present"))
    all_workflow_matches_expected = bool(set_summary.get("all_workflow_matches_expected"))

    smoke_passed = bool(
        all_required_variants_present
        and all_workflow_matches_expected
        and all_artifacts_valid
        and all_replay_ready
        and all_outputs_complete
        and handoff_linkage_preserved
        and all_variant_specific_checks
    )

    return {
        "report_version": "h2_f.h1_smoke_suite.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "variants": variants,
        "summary": {
            "variant_count": len(variants),
            "all_required_variants_present": all_required_variants_present,
            "all_workflow_matches_expected": all_workflow_matches_expected,
            "all_artifacts_valid": all_artifacts_valid,
            "all_replay_ready": all_replay_ready,
            "all_comparable_outputs_complete": all_outputs_complete,
            "handoff_linkage_preserved": handoff_linkage_preserved,
            "all_variant_specific_checks_passed": all_variant_specific_checks,
            "smoke_passed": smoke_passed,
        },
        "known_limits": [
            "Smoke suite uses stored artifacts and structural gates, not fresh-run quality ranking.",
            "Prompt tags are provenance only and are not used as pass/fail scoring gates.",
            "No deterministic rerun guarantees are implied by this report.",
        ],
    }


def _build_variant_smoke_report(entry: dict[str, Any]) -> dict[str, Any]:
    replay = entry.get("replay") if isinstance(entry.get("replay"), dict) else {}
    expected_workflow_id = entry.get("expected_workflow_id")
    run_summary = replay.get("run_summary") if isinstance(replay.get("run_summary"), dict) else {}
    comparable_output = _nested_dict(replay, "h1_projection", "comparable_output")
    linkage_summary = replay.get("linkage_summary") if isinstance(replay.get("linkage_summary"), dict) else {}
    orchestration = replay.get("orchestration_reconstruction") if isinstance(replay.get("orchestration_reconstruction"), dict) else {}

    smoke_checks = [
        {
            "check_id": "artifact_validation_passed",
            "passed": _bool_nested(replay, "artifact_validation", "passed"),
        },
        {
            "check_id": "replay_ready",
            "passed": bool(replay.get("replay_ready")),
        },
        {
            "check_id": "workflow_matches_expected",
            "passed": bool(entry.get("workflow_matches_expected")),
        },
        {
            "check_id": "comparable_output_complete",
            "passed": bool(comparable_output.get("complete")),
        },
        {
            "check_id": "variant_specific_structure",
            "passed": _variant_structure_ok(expected_workflow_id, orchestration, linkage_summary),
        },
    ]

    return {
        "expected_workflow_id": expected_workflow_id,
        "observed_workflow_id": entry.get("observed_workflow_id"),
        "run_id": entry.get("run_id"),
        "run_artifact_path": replay.get("run_artifact_path"),
        "trace_artifact_path": replay.get("trace_artifact_path"),
        "artifact_validation": replay.get("artifact_validation"),
        "replay_ready": replay.get("replay_ready"),
        "run_summary": run_summary,
        "failure_summary": replay.get("failure_summary"),
        "linkage_summary": linkage_summary,
        "orchestration": orchestration,
        "comparable_output": comparable_output,
        "prompt_tags": _nested_dict(replay, "h1_projection", "prompt_tags"),
        "smoke_checks": smoke_checks,
    }


def _variant_structure_ok(
    workflow_id: Any,
    orchestration: dict[str, Any],
    linkage_summary: dict[str, Any],
) -> bool:
    if workflow_id == "h1.single.v1":
        manager = orchestration.get("manager")
        handoff = orchestration.get("handoff")
        return manager is None and handoff is None

    if workflow_id == "h1.manager.v1":
        manager = orchestration.get("manager")
        if not isinstance(manager, dict):
            return False
        turn_count = manager.get("turn_count")
        return isinstance(turn_count, int) and turn_count > 0

    if workflow_id == "h1.handoff.v1":
        handoff = orchestration.get("handoff")
        if not isinstance(handoff, dict):
            return False
        turn_count = handoff.get("turn_count")
        linked_parent = linkage_summary.get("with_parent_event_id")
        linked_corr = linkage_summary.get("with_correlation_id")
        missing_parent_references = linkage_summary.get("missing_parent_references")
        return (
            isinstance(turn_count, int)
            and turn_count > 0
            and isinstance(linked_parent, int)
            and linked_parent > 0
            and isinstance(linked_corr, int)
            and linked_corr > 0
            and isinstance(missing_parent_references, int)
            and missing_parent_references == 0
        )

    return False


def _handoff_linkage_ok(variant: dict[str, Any]) -> bool:
    linkage_summary = variant.get("linkage_summary") if isinstance(variant.get("linkage_summary"), dict) else {}
    linked_parent = linkage_summary.get("with_parent_event_id")
    linked_corr = linkage_summary.get("with_correlation_id")
    missing_parent_references = linkage_summary.get("missing_parent_references")
    return (
        isinstance(linked_parent, int)
        and linked_parent > 0
        and isinstance(linked_corr, int)
        and linked_corr > 0
        and isinstance(missing_parent_references, int)
        and missing_parent_references == 0
    )


def _nested_dict(payload: Any, *keys: str) -> dict[str, Any]:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return {}
        current = current.get(key)
    if isinstance(current, dict):
        return current
    return {}


def _bool_nested(payload: Any, *keys: str) -> bool:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return False
        current = current.get(key)
    return bool(current)
