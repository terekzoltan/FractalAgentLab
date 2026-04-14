from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id
from fractal_agent_lab.evals.h1_smoke_suite import run_h1_smoke_suite_by_run_ids
from fractal_agent_lab.evals.h2_run_comparison import run_h2_run_comparison_by_run_ids
from fractal_agent_lab.memory import JSONProjectMemoryStore
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path

H3_MANUAL_RUBRIC_REFERENCE = "docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-v1.md"


def curate_r3_l_evidence(
    *,
    h1_single_run_id: str,
    h1_manager_run_id: str,
    h1_handoff_run_id: str,
    h2_run_ids: list[str],
    h3_run_id: str,
    data_dir: str | Path = "data",
    execution_mode: str = "manual_policy_driven",
    visibility_audit_state: str = (
        "git-visible coordination/code surfaces plus local data artifacts consulted; "
        "showcase-readiness conclusions depend partly on non-git-visible local evidence"
    ),
) -> dict[str, Any]:
    normalized_h2_run_ids = _normalize_h2_run_ids(h2_run_ids)
    if len(normalized_h2_run_ids) == 0:
        raise ValueError("At least one --h2-run-id is required for bounded corpus sweep.")

    data_root = Path(data_dir)

    h1_smoke = run_h1_smoke_suite_by_run_ids(
        single_run_id=h1_single_run_id,
        manager_run_id=h1_manager_run_id,
        handoff_run_id=h1_handoff_run_id,
        data_dir=data_root,
    )
    h2_comparison = run_h2_run_comparison_by_run_ids(run_ids=normalized_h2_run_ids, data_dir=data_root)
    h3_validation = validate_run_trace_by_run_id(h3_run_id, data_dir=data_root)

    h1_rows = [
        _build_curated_row(run_id=h1_single_run_id, data_dir=data_root, family="h1"),
        _build_curated_row(run_id=h1_manager_run_id, data_dir=data_root, family="h1"),
        _build_curated_row(run_id=h1_handoff_run_id, data_dir=data_root, family="h1"),
    ]
    h2_rows = [_build_curated_row(run_id=run_id, data_dir=data_root, family="h2") for run_id in normalized_h2_run_ids]
    h3_row = _build_curated_row(run_id=h3_run_id, data_dir=data_root, family="h3")

    h2_summary = h2_comparison.get("summary") if isinstance(h2_comparison.get("summary"), dict) else {}
    h2_failed_gates = [
        gate_name
        for gate_name in (
            "minimum_run_count_met",
            "all_artifacts_valid",
            "all_replay_ready",
            "all_runs_match_expected_workflow",
            "all_comparable_outputs_complete",
            "all_key_orders_match",
            "all_implementation_waves_valid",
            "all_recommended_starting_slice_present",
            "all_delegate_orders_match",
        )
        if not bool(h2_summary.get(gate_name))
    ]

    project_memory = _collect_project_memory_evidence(
        run_rows=h1_rows + h2_rows + [h3_row],
        data_dir=data_root,
    )

    all_curated_rows = h1_rows + h2_rows + [h3_row]
    all_curated_rows_valid = all(bool(row.get("artifact_validation_passed")) for row in all_curated_rows)
    h1_smoke_passed = bool(_nested(h1_smoke, "summary", "smoke_passed"))
    h3_validated = bool(h3_validation.passed)
    track_a_handoff_ready = bool(
        all_curated_rows_valid
        and h1_smoke_passed
        and h3_validated
        and bool(h2_summary.get("all_artifacts_valid"))
        and bool(h2_summary.get("all_runs_match_expected_workflow"))
        and bool(h2_summary.get("minimum_run_count_met"))
    )

    return {
        "report_version": "r3_l.evidence_curation.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "disclosure": {
            "execution_mode": execution_mode,
            "visibility_audit_state": visibility_audit_state,
        },
        "selected_runs": {
            "h1": h1_rows,
            "h2": h2_rows,
            "h3": h3_row,
        },
        "h1_evidence": {
            "replay_smoke_summary": h1_smoke.get("summary", {}),
            "truth_statement": (
                "H1 curated evidence is replay-backed and structurally green on the selected triplet."
                if h1_smoke_passed
                else "H1 curated evidence is not structurally green on the selected triplet."
            ),
        },
        "h2_evidence": {
            "bounded_corpus_sweep_run_count": len(normalized_h2_run_ids),
            "comparison_summary": h2_summary,
            "comparison_ready": bool(h2_summary.get("comparison_ready")),
            "failed_gates": h2_failed_gates,
            "truth_statement": (
                "H2 current corpus is comparison-ready."
                if bool(h2_summary.get("comparison_ready"))
                else "H2 current corpus is not comparison-ready."
            ),
        },
        "h3_evidence": {
            "run_id": h3_run_id,
            "workflow_id": _extract_workflow_id(h3_validation.run_payload),
            "artifact_validation_passed": h3_validation.passed,
            "manual_rubric_reference": H3_MANUAL_RUBRIC_REFERENCE,
            "evidence_mode": "single_run_validated_manual_rubric_backed",
            "truth_statement": (
                "H3 evidence is single-run validated/manual-rubric-backed and not comparison evidence."
            ),
        },
        "project_memory_evidence": project_memory,
        "trace_browser_handoff": {
            "h2_trace_list_command": "PYTHONPATH=src python -m fractal_agent_lab.cli trace list --workflow-id h2.manager.v1 --format text --limit 5",
            "h3_trace_show_command": f"PYTHONPATH=src python -m fractal_agent_lab.cli trace show --run-id {h3_run_id}",
            "note": "Trace browser is explanatory presentation support; replay/validation surfaces remain canonical evidence truth.",
        },
        "summary": {
            "track_a_handoff_ready": track_a_handoff_ready,
            "all_curated_rows_valid": all_curated_rows_valid,
            "h1_smoke_passed": h1_smoke_passed,
            "h2_comparison_ready": bool(h2_summary.get("comparison_ready")),
            "h3_validated": h3_validated,
            "project_memory_demonstrated": bool(project_memory.get("demonstrated")),
        },
        "known_limits": [
            "This is additive evidence curation and not a new canonical runtime truth surface.",
            "No winner scoring or benchmark ranking is produced in this report.",
            "H2 comparison claims are tied to report truth only; non-ready remains non-ready.",
            "Project-memory evidence stays not demonstrated unless canonical store plus sidecar are present for selected runs.",
        ],
    }


def _normalize_h2_run_ids(run_ids: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in run_ids:
        if not isinstance(value, str):
            continue
        run_id = value.strip()
        if not run_id or run_id in seen:
            continue
        seen.add(run_id)
        normalized.append(run_id)
    return normalized


def _build_curated_row(*, run_id: str, data_dir: Path, family: str) -> dict[str, Any]:
    validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)
    payload = validation.run_payload if isinstance(validation.run_payload, dict) else {}
    schema_version = payload.get("schema_version") if isinstance(payload.get("schema_version"), str) else None

    return {
        "workflow_family": family,
        "workflow_id": _extract_workflow_id(payload),
        "run_id": run_id,
        "artifact_schema_version": schema_version,
        "status": payload.get("status"),
        "run_artifact_path": validation.run_path.as_posix(),
        "trace_artifact_path": validation.trace_path.as_posix(),
        "artifact_validation_passed": validation.passed,
        "evidence_backing": _build_evidence_backing(family=family, schema_version=schema_version),
    }


def _build_evidence_backing(*, family: str, schema_version: str | None) -> dict[str, Any]:
    if family == "h1":
        historical = schema_version == "run_state.v0"
        return {
            "replay_backed": True,
            "manual_rubric_backed": False,
            "classification": "replay_backed_historical" if historical else "replay_backed",
        }
    if family == "h3":
        return {
            "replay_backed": True,
            "manual_rubric_backed": True,
            "classification": "single_run_validated_manual_rubric_backed",
        }
    return {
        "replay_backed": True,
        "manual_rubric_backed": False,
        "classification": "replay_backed_structural_comparison_candidate",
    }


def _collect_project_memory_evidence(*, run_rows: list[dict[str, Any]], data_dir: Path) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    demonstrated = False
    store = JSONProjectMemoryStore(data_dir=data_dir)

    for row in run_rows:
        run_id = row.get("run_id")
        if not isinstance(run_id, str) or not run_id:
            continue
        validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)
        payload = validation.run_payload if isinstance(validation.run_payload, dict) else {}
        project_id = _extract_project_id(payload)
        memory_store_path, memory_store_exists = _project_memory_store_status(
            store=store,
            project_id=project_id,
        )
        sidecar_path_obj = run_artifact_dir_path(run_id=run_id, data_dir=data_dir) / "project_memory_update.json"
        sidecar_exists = sidecar_path_obj.exists()
        row_demonstrated = bool(project_id and memory_store_exists and sidecar_exists)
        demonstrated = demonstrated or row_demonstrated

        rows.append(
            {
                "run_id": run_id,
                "project_id": project_id,
                "canonical_project_store_path": memory_store_path,
                "canonical_project_store_present": memory_store_exists,
                "project_memory_update_sidecar_path": sidecar_path_obj.as_posix(),
                "project_memory_update_sidecar_present": sidecar_exists,
                "demonstrated_for_run": row_demonstrated,
            },
        )

    return {
        "demonstrated": demonstrated,
        "truth_statement": (
            "M2 project-memory evidence is demonstrated for selected runs."
            if demonstrated
            else "M2 project-memory evidence is not demonstrated in the current curated run set."
        ),
        "runs": rows,
    }


def _project_memory_store_status(*, store: JSONProjectMemoryStore, project_id: str | None) -> tuple[str | None, bool]:
    if not project_id:
        return None, False

    preferred_path = store.project_path(project_id=project_id)
    if preferred_path.exists():
        return preferred_path.as_posix(), True

    try:
        project_memory = store.load_project(project_id=project_id)
    except ValueError:
        return preferred_path.as_posix(), False
    return preferred_path.as_posix(), project_memory is not None


def _extract_workflow_id(payload: dict[str, Any] | None) -> str | None:
    if not isinstance(payload, dict):
        return None
    workflow_id = payload.get("workflow_id")
    if isinstance(workflow_id, str) and workflow_id:
        return workflow_id
    return None


def _extract_project_id(payload: dict[str, Any]) -> str | None:
    input_payload = payload.get("input_payload") if isinstance(payload.get("input_payload"), dict) else {}
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    for source in (context, input_payload):
        project_id = source.get("project_id")
        if isinstance(project_id, str):
            normalized = project_id.strip()
            if normalized:
                return normalized
    return None


def _nested(payload: Any, *keys: str) -> Any:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current
