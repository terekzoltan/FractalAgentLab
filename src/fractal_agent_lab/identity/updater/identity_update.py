from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.events import TraceEvent
from fractal_agent_lab.core.models import RunState
from fractal_agent_lab.identity.models import IdentityProfile, IdentitySnapshot
from fractal_agent_lab.identity.store import JSONIdentityStore
from fractal_agent_lab.identity.updater.signal_rules import (
    derive_fallback_identity_signals,
    extract_explicit_identity_signals,
    merge_identity_signals,
)
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


IDENTITY_UPDATE_ARTIFACT_VERSION = "1.0"


@dataclass(slots=True)
class IdentityUpdaterConfig:
    enabled: bool
    store_backend: str = "json"
    data_subdir: str = "identity"


@dataclass(slots=True)
class IdentityUpdateResult:
    updated_agent_ids: list[str]
    updates: list[dict[str, Any]]
    artifact_path: Path


def run_post_run_identity_update(
    *,
    run_state: RunState,
    trace_events: list[TraceEvent],
    runtime_config: dict[str, Any],
    data_dir: str | Path,
) -> IdentityUpdateResult | None:
    config = resolve_identity_updater_config(runtime_config)
    if not config.enabled:
        return None

    if config.store_backend != "json":
        raise ValueError("identity.store_backend currently supports only 'json'.")

    store = JSONIdentityStore(data_dir=data_dir, data_subdir=config.data_subdir)
    explicit_signals = extract_explicit_identity_signals(run_state)
    fallback_signals = derive_fallback_identity_signals(run_state=run_state, trace_events=trace_events)
    merged_signals = merge_identity_signals(
        explicit_signals=explicit_signals,
        fallback_signals=fallback_signals,
    )

    updates: list[dict[str, Any]] = []
    for agent_id in _executed_agent_ids(run_state):
        signals = merged_signals.get(agent_id)
        if not signals:
            continue

        profile = store.load_profile(agent_id=agent_id)
        if profile is None:
            profile = IdentityProfile(agent_id=agent_id)

        before = profile.to_dict()
        updated = _apply_bounded_profile_update(profile=profile, signals=signals, run_id=run_state.run_id)
        if not updated:
            continue
        after = profile.to_dict()

        store.save_profile(profile)
        store.save_snapshot(
            IdentitySnapshot.from_profile(
                profile=profile,
                run_id=run_state.run_id,
                reason="post_run_identity_update",
            ),
        )

        updates.append(
            {
                "agent_id": agent_id,
                "before": before,
                "after": after,
                "delta": _compute_profile_delta(before=before, after=after),
                "signals_used": dict(signals),
            },
        )

    artifact_path = write_identity_update_artifact(
        run_id=run_state.run_id,
        workflow_id=run_state.workflow_id,
        updates=updates,
        data_dir=data_dir,
    )
    return IdentityUpdateResult(
        updated_agent_ids=[update["agent_id"] for update in updates],
        updates=updates,
        artifact_path=artifact_path,
    )


def resolve_identity_updater_config(runtime_config: dict[str, Any]) -> IdentityUpdaterConfig:
    block = runtime_config.get("identity", {})
    if not isinstance(block, dict):
        block = {}

    enabled = bool(block.get("enabled", False))
    store_backend = block.get("store_backend", "json")
    data_subdir = block.get("data_subdir", "identity")

    if not isinstance(store_backend, str) or not store_backend:
        raise ValueError("identity.store_backend must be a non-empty string.")
    if not isinstance(data_subdir, str) or not data_subdir.strip():
        raise ValueError("identity.data_subdir must be a non-empty string.")

    return IdentityUpdaterConfig(
        enabled=enabled,
        store_backend=store_backend,
        data_subdir=data_subdir,
    )


def write_identity_update_artifact(
    *,
    run_id: str,
    workflow_id: str,
    updates: list[dict[str, Any]],
    data_dir: str | Path,
) -> Path:
    artifact_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "identity_update.json"

    payload = {
        "artifact_type": "identity_update",
        "artifact_version": IDENTITY_UPDATE_ARTIFACT_VERSION,
        "run_id": run_id,
        "workflow_id": workflow_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "updates": updates,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def _apply_bounded_profile_update(
    *,
    profile: IdentityProfile,
    signals: dict[str, bool | float],
    run_id: str,
) -> bool:
    changed = False

    needed_revision = signals.get("needed_revision")
    if needed_revision is True:
        changed = _set_if_changed(profile, "caution", _clamp_unit(profile.caution + 0.03)) or changed
        changed = _set_if_changed(profile, "coherence", _clamp_unit(profile.coherence - 0.02)) or changed

    self_correction_used = signals.get("self_correction_used")
    if self_correction_used is True:
        changed = _set_if_changed(
            profile,
            "reflectiveness",
            _clamp_unit(profile.reflectiveness + 0.03),
        ) or changed

    delegated = signals.get("delegated")
    if delegated is True:
        changed = _set_if_changed(profile, "delegation", _clamp_unit(profile.delegation + 0.03)) or changed

    coherence_score = signals.get("coherence_score")
    if isinstance(coherence_score, float):
        changed = _set_if_changed(
            profile,
            "coherence",
            _clamp_unit(profile.coherence + ((coherence_score - profile.coherence) * 0.10)),
        ) or changed

    confidence = signals.get("confidence")
    if isinstance(confidence, float):
        changed = _set_if_changed(
            profile,
            "initiative",
            _clamp_unit(profile.initiative + ((confidence - 0.5) * 0.04)),
        ) or changed

    if not changed:
        return False

    profile.profile_version += 1
    profile.update_count += 1
    profile.last_updated_at = datetime.now(timezone.utc).isoformat()
    profile.last_run_id = run_id
    return True


def _compute_profile_delta(*, before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    delta: dict[str, Any] = {}
    tracked_keys = [
        "profile_version",
        "caution",
        "initiative",
        "delegation",
        "coherence",
        "reflectiveness",
        "update_count",
    ]
    for key in tracked_keys:
        if before.get(key) != after.get(key):
            delta[key] = {
                "before": before.get(key),
                "after": after.get(key),
            }
    return delta


def _executed_agent_ids(run_state: RunState) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for step_result in run_state.step_results.values():
        if not isinstance(step_result, dict):
            continue
        agent_id = step_result.get("agent_id")
        if not isinstance(agent_id, str) or not agent_id or agent_id in seen:
            continue
        seen.add(agent_id)
        ordered.append(agent_id)
    return ordered


def _clamp_unit(value: float) -> float:
    return max(0.0, min(1.0, value))


def _set_if_changed(profile: IdentityProfile, field_name: str, value: float) -> bool:
    current = getattr(profile, field_name)
    if current == value:
        return False
    setattr(profile, field_name, value)
    return True
