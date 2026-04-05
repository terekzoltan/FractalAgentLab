from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id
from fractal_agent_lab.identity import JSONIdentityStore
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path, run_artifact_path, trace_artifact_path


TRACKED_PROFILE_FIELDS: tuple[str, ...] = (
    "caution",
    "initiative",
    "delegation",
    "coherence",
    "reflectiveness",
)

CONCERNING_DELTA_THRESHOLD = 0.20


def run_h2_o_identity_drift_smoke(
    *,
    run_ids: list[str],
    data_dir: str | Path = "data",
    identity_data_subdir: str = "identity",
) -> dict[str, Any]:
    if not run_ids:
        raise ValueError("run_ids must include at least one run id.")
    if not isinstance(identity_data_subdir, str) or not identity_data_subdir.strip():
        raise ValueError("identity_data_subdir must be a non-empty string.")

    target_data_dir = Path(data_dir)
    store = JSONIdentityStore(data_dir=target_data_dir, data_subdir=identity_data_subdir)

    run_checks: list[dict[str, Any]] = []
    updates_parseable = True
    profile_parseable = True
    snapshot_parseable = True
    all_runs_have_update_sidecar = True
    all_runs_have_update_evidence = True
    all_sidecars_match_requested_runs = True
    all_present_canonical_artifacts_valid = True
    all_updated_agent_ids: set[str] = set()
    per_agent_updates: dict[str, list[dict[str, Any]]] = {}

    for run_id in run_ids:
        run_path = run_artifact_path(run_id=run_id, data_dir=target_data_dir)
        trace_path = trace_artifact_path(run_id=run_id, data_dir=target_data_dir)
        canonical_run_present = run_path.exists()
        canonical_trace_present = trace_path.exists()

        workflow_id = None
        canonical_artifact_validation: dict[str, Any] | None = None
        canonical_artifact_valid = None
        if canonical_run_present:
            try:
                run_payload = json.loads(run_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                run_payload = {}
            if isinstance(run_payload, dict):
                workflow_id = run_payload.get("workflow_id")

        if canonical_run_present or canonical_trace_present:
            validation = validate_run_trace_by_run_id(run_id, data_dir=target_data_dir)
            canonical_artifact_valid = validation.passed
            canonical_artifact_validation = {
                "passed": validation.passed,
                "errors": list(validation.errors),
                "warnings": list(validation.warnings),
            }
            if not validation.passed:
                all_present_canonical_artifacts_valid = False

        update_sidecar_path = run_artifact_dir_path(run_id=run_id, data_dir=target_data_dir) / "identity_update.json"
        identity_update_sidecar_present = update_sidecar_path.exists()
        if not identity_update_sidecar_present:
            all_runs_have_update_sidecar = False
            all_runs_have_update_evidence = False
        orphan_update_warning = bool(
            identity_update_sidecar_present and (not canonical_run_present or not canonical_trace_present)
        )

        warnings: list[str] = []
        if orphan_update_warning:
            warnings.append(
                "identity_update sidecar is present without complete canonical run/trace pair; treated as warning-grade additive behavior",
            )
        if canonical_artifact_validation is not None and not canonical_artifact_validation["passed"]:
            warnings.append("canonical run/trace artifacts are present but invalid")
        if not identity_update_sidecar_present:
            warnings.append("identity_update sidecar is missing for requested run")

        updated_agent_ids: list[str] = []
        update_count = 0
        sidecar_binding_valid = True
        if identity_update_sidecar_present:
            try:
                sidecar_payload = json.loads(update_sidecar_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                updates_parseable = False
                warnings.append(f"failed to parse identity_update sidecar: {error}")
                sidecar_payload = {}

            payload_run_id = sidecar_payload.get("run_id") if isinstance(sidecar_payload, dict) else None
            if payload_run_id != run_id:
                sidecar_binding_valid = False
                all_sidecars_match_requested_runs = False
                warnings.append("identity_update sidecar payload run_id does not match requested run_id")

            payload_workflow_id = sidecar_payload.get("workflow_id") if isinstance(sidecar_payload, dict) else None
            if workflow_id is not None and payload_workflow_id != workflow_id:
                sidecar_binding_valid = False
                all_sidecars_match_requested_runs = False
                warnings.append(
                    "identity_update sidecar workflow_id does not match canonical run workflow_id",
                )

            updates = sidecar_payload.get("updates") if isinstance(sidecar_payload, dict) else []
            if isinstance(updates, list):
                update_count = len(updates)
                for update in updates:
                    if not isinstance(update, dict):
                        continue
                    agent_id = update.get("agent_id")
                    if isinstance(agent_id, str) and agent_id:
                        updated_agent_ids.append(agent_id)
                        all_updated_agent_ids.add(agent_id)
                        per_agent_updates.setdefault(agent_id, []).append(update)
            if update_count == 0:
                all_runs_have_update_evidence = False
                warnings.append("identity_update sidecar parsed successfully but contains no updates")

        run_checks.append(
            {
                "run_id": run_id,
                "workflow_id": workflow_id,
                "canonical_run_present": canonical_run_present,
                "canonical_trace_present": canonical_trace_present,
                "canonical_artifact_valid": canonical_artifact_valid,
                "canonical_artifact_validation": canonical_artifact_validation,
                "identity_update_sidecar_present": identity_update_sidecar_present,
                "sidecar_binding_valid": sidecar_binding_valid,
                "orphan_update_warning": orphan_update_warning,
                "updated_agent_ids": sorted(set(updated_agent_ids)),
                "update_count": update_count,
                "warnings": warnings,
            },
        )

    agents: list[dict[str, Any]] = []
    all_deltas_bounded = True
    no_runaway_drift = True
    all_updated_agents_have_profiles = True
    all_updated_agents_have_snapshots = True
    for agent_id in sorted(all_updated_agent_ids):
        warnings: list[str] = []
        try:
            profile = store.load_profile(agent_id=agent_id)
            profile_payload = profile.to_dict() if profile is not None else None
        except ValueError as error:
            profile_parseable = False
            profile_payload = None
            warnings.append(f"failed to load identity profile: {error}")

        try:
            snapshots = store.load_snapshots(agent_id=agent_id)
            snapshot_payloads = [snapshot.to_dict() for snapshot in snapshots]
        except ValueError as error:
            snapshot_parseable = False
            snapshot_payloads = []
            warnings.append(f"failed to load identity snapshots: {error}")

        if profile_payload is None:
            all_updated_agents_have_profiles = False
            warnings.append("updated agent is missing persisted identity profile")
        if not snapshot_payloads:
            all_updated_agents_have_snapshots = False
            warnings.append("updated agent is missing persisted identity snapshots")

        delta_history = [
            update.get("delta")
            for update in per_agent_updates.get(agent_id, [])
            if isinstance(update.get("delta"), dict)
        ]
        max_abs_delta = _max_abs_delta(delta_history)
        classification = _classify_drift(max_abs_delta=max_abs_delta)
        if classification == "concerning_drift":
            no_runaway_drift = False
        if max_abs_delta > CONCERNING_DELTA_THRESHOLD:
            all_deltas_bounded = False

        agents.append(
            {
                "agent_id": agent_id,
                "profile_present": profile_payload is not None,
                "snapshot_count": len(snapshot_payloads),
                "latest_profile": profile_payload,
                "latest_snapshot": snapshot_payloads[-1] if snapshot_payloads else None,
                "delta_history": delta_history,
                "max_abs_dimension_delta": max_abs_delta,
                "classification": classification,
                "warnings": warnings,
            },
        )

    orphan_updates_detected = any(bool(run_check.get("orphan_update_warning")) for run_check in run_checks)
    has_update_evidence = bool(all_updated_agent_ids)
    drift_smoke_passed = bool(
        updates_parseable
        and profile_parseable
        and snapshot_parseable
        and all_runs_have_update_sidecar
        and all_runs_have_update_evidence
        and all_sidecars_match_requested_runs
        and has_update_evidence
        and all_updated_agents_have_profiles
        and all_updated_agents_have_snapshots
        and all_present_canonical_artifacts_valid
        and all_deltas_bounded
        and no_runaway_drift
    )

    return {
        "report_version": "h2_o.identity_drift_smoke.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "run_scope": {
            "run_count": len(run_ids),
            "run_ids": list(run_ids),
            "identity_data_subdir": identity_data_subdir,
        },
        "runs": run_checks,
        "agents": agents,
        "summary": {
            "all_updates_parseable": updates_parseable,
            "all_profiles_parseable": profile_parseable,
            "all_snapshots_parseable": snapshot_parseable,
            "all_runs_have_update_sidecar": all_runs_have_update_sidecar,
            "all_runs_have_update_evidence": all_runs_have_update_evidence,
            "all_sidecars_match_requested_runs": all_sidecars_match_requested_runs,
            "has_update_evidence": has_update_evidence,
            "all_updated_agents_have_profiles": all_updated_agents_have_profiles,
            "all_updated_agents_have_snapshots": all_updated_agents_have_snapshots,
            "all_present_canonical_artifacts_valid": all_present_canonical_artifacts_valid,
            "all_deltas_bounded": all_deltas_bounded,
            "no_runaway_drift": no_runaway_drift,
            "orphan_updates_detected": orphan_updates_detected,
            "drift_smoke_passed": drift_smoke_passed,
        },
        "known_limits": [
            "Drift smoke is a bounded sanity check, not a full drift-monitor framework.",
            "Orphan updater sidecars are warning-grade and do not fail smoke by themselves.",
            "profile_version is lifecycle metadata and is not treated as drift score semantics.",
        ],
    }


def _max_abs_delta(delta_history: list[dict[str, Any]]) -> float:
    largest = 0.0
    for delta in delta_history:
        if not isinstance(delta, dict):
            continue
        for field in TRACKED_PROFILE_FIELDS:
            change = delta.get(field)
            if not isinstance(change, dict):
                continue
            before = change.get("before")
            after = change.get("after")
            if not isinstance(before, (int, float)) or not isinstance(after, (int, float)):
                continue
            largest = max(largest, abs(float(after) - float(before)))
    return largest


def _classify_drift(*, max_abs_delta: float) -> str:
    if max_abs_delta > CONCERNING_DELTA_THRESHOLD:
        return "concerning_drift"
    if max_abs_delta > 0:
        return "healthy_drift"
    return "stable"
