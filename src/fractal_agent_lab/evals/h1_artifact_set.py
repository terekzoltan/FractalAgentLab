from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_replay import replay_run_artifacts_by_id
from fractal_agent_lab.evals.h1_eval_contracts import H1_VARIANT_WORKFLOW_IDS


def load_h1_replay_reports_by_run_ids(
    *,
    single_run_id: str,
    manager_run_id: str,
    handoff_run_id: str,
    data_dir: str | Path = "data",
) -> dict[str, Any]:
    expected_run_id_by_workflow = {
        "h1.single.v1": single_run_id,
        "h1.manager.v1": manager_run_id,
        "h1.handoff.v1": handoff_run_id,
    }

    variants: list[dict[str, Any]] = []
    for workflow_id in H1_VARIANT_WORKFLOW_IDS:
        run_id = expected_run_id_by_workflow[workflow_id]
        replay_report = replay_run_artifacts_by_id(run_id, data_dir=data_dir)
        observed_workflow_id = _nested_str(replay_report, "run_summary", "workflow_id")
        variants.append(
            {
                "expected_workflow_id": workflow_id,
                "observed_workflow_id": observed_workflow_id,
                "run_id": run_id,
                "replay": replay_report,
                "workflow_matches_expected": observed_workflow_id == workflow_id,
            },
        )

    all_present = all(isinstance(entry.get("observed_workflow_id"), str) for entry in variants)
    all_replay_ready = all(bool(entry.get("replay", {}).get("replay_ready")) for entry in variants)
    all_workflow_matches_expected = all(bool(entry.get("workflow_matches_expected")) for entry in variants)

    return {
        "report_version": "h2_e.h1_artifact_set.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "required_workflows": list(H1_VARIANT_WORKFLOW_IDS),
        "variants": variants,
        "summary": {
            "variant_count": len(variants),
            "all_required_variants_present": all_present,
            "all_replay_ready": all_replay_ready,
            "all_workflow_matches_expected": all_workflow_matches_expected,
        },
    }


def _nested_str(payload: Any, *keys: str) -> str | None:
    current: Any = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    if isinstance(current, str) and current:
        return current
    return None
