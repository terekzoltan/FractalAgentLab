from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.cli.workflow_registry import get_workflow_spec
from fractal_agent_lab.evals.h1_artifact_set import load_h1_replay_reports_by_run_ids
from fractal_agent_lab.evals.h1_eval_contracts import H1_COMPARISON_ROLE_BY_WORKFLOW_ID, H1_COMPARABLE_OUTPUT_KEYS


def capture_h1_baseline_tags_by_run_ids(
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
        variants.append(_build_variant_tag_record(entry))

    set_summary = artifact_set.get("summary") if isinstance(artifact_set.get("summary"), dict) else {}
    all_required_variants_present = bool(set_summary.get("all_required_variants_present"))
    all_replay_ready = all(bool(item.get("replay_ready")) for item in variants)
    all_workflow_matches_expected = bool(set_summary.get("all_workflow_matches_expected"))
    all_roles_assigned = all(isinstance(item.get("comparison_role"), str) and item.get("comparison_role") for item in variants)

    return {
        "report_version": "h2_g.h1_baseline_tags.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "comparison_group_id": f"h1-baseline-{single_run_id[:8]}-{manager_run_id[:8]}-{handoff_run_id[:8]}",
        "comparison_contract": {
            "workflow_family": "H1",
            "comparable_output_keys": list(H1_COMPARABLE_OUTPUT_KEYS),
            "policy_reference": "docs/wave1/Wave1-L1-L-H1-Decision-Log.md",
        },
        "baseline_posture": {
            "h1.single.v1": "baseline_anchor",
            "h1.manager.v1": "default_multi_agent_reference",
            "h1.handoff.v1": "reference_variant",
        },
        "variants": variants,
        "summary": {
            "variant_count": len(variants),
            "all_required_variants_present": all_required_variants_present,
            "all_replay_ready": all_replay_ready,
            "all_workflow_matches_expected": all_workflow_matches_expected,
            "all_roles_assigned": all_roles_assigned,
            "tag_capture_ready": (
                all_required_variants_present
                and all_replay_ready
                and all_workflow_matches_expected
                and all_roles_assigned
            ),
        },
        "known_limits": [
            "This report is additive baseline/provenance tagging, not quality scoring.",
            "Prompt tags are provenance context only and are not used as pass/fail gates.",
            "No canonical run/trace schema mutations are performed by this capture layer.",
        ],
    }


def _build_variant_tag_record(entry: dict[str, Any]) -> dict[str, Any]:
    expected_workflow_id = entry.get("expected_workflow_id")
    replay = entry.get("replay") if isinstance(entry.get("replay"), dict) else {}
    run_summary = replay.get("run_summary") if isinstance(replay.get("run_summary"), dict) else {}
    workflow_id = run_summary.get("workflow_id") if isinstance(run_summary.get("workflow_id"), str) else expected_workflow_id
    workflow_spec = _safe_get_workflow_spec(workflow_id)

    return {
        "expected_workflow_id": expected_workflow_id,
        "observed_workflow_id": workflow_id,
        "workflow_matches_expected": bool(entry.get("workflow_matches_expected")),
        "workflow_id": workflow_id,
        "run_id": entry.get("run_id"),
        "comparison_role": H1_COMPARISON_ROLE_BY_WORKFLOW_ID.get(workflow_id),
        "workflow": {
            "name": workflow_spec.get("name"),
            "version": workflow_spec.get("version"),
            "execution_mode": workflow_spec.get("execution_mode"),
            "metadata": workflow_spec.get("metadata"),
        },
        "artifact_paths": {
            "run_artifact_path": replay.get("run_artifact_path"),
            "trace_artifact_path": replay.get("trace_artifact_path"),
        },
        "replay_ready": replay.get("replay_ready"),
        "artifact_validation": replay.get("artifact_validation"),
        "prompt_tags": _nested_dict(replay, "h1_projection", "prompt_tags"),
        "comparable_output": _nested_dict(replay, "h1_projection", "comparable_output"),
    }


def _safe_get_workflow_spec(workflow_id: Any) -> dict[str, Any]:
    if not isinstance(workflow_id, str):
        return {}
    try:
        spec = get_workflow_spec(workflow_id)
    except ValueError:
        return {}

    return {
        "name": spec.name,
        "version": spec.version,
        "execution_mode": spec.execution_mode.value,
        "metadata": dict(spec.metadata),
    }


def _nested_dict(payload: Any, *keys: str) -> dict[str, Any]:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return {}
        current = current.get(key)
    if isinstance(current, dict):
        return dict(current)
    return {}
