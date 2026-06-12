from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.contracts.w6_packet import WINDOWS_RESERVED_DEVICE_NAMES, require_w6_path_identifier
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


W7_5_CONTEXT_DIGEST_SCHEMA_VERSION = "w7_5.context_digest.v1"
W7_5_CONTEXT_DIGEST_CLAIM_BOUNDARY = "compact_recovery_measurement_not_full_context_truth"

ALLOWED_HYDRATION_LEVELS = {"L0", "L1", "L2", "L3"}
ALLOWED_RECOVERY_SUCCESS_LABELS = {"unknown", "restored", "partially_restored", "failed"}


class W75ContextDigestError(ValueError):
    pass


def build_context_digest(
    run_id: str,
    *,
    hydration_level: str = "L0",
    loaded_context_refs: list[str] | None = None,
    deferred_context_refs: list[str] | None = None,
    token_estimate: int | None = None,
    manual_restore_steps: list[str] | None = None,
    recovery_success_label: str = "unknown",
    operator_notes: str | None = None,
) -> dict[str, Any]:
    safe_run_id = _validated_run_id(run_id)
    return {
        "schema_version": W7_5_CONTEXT_DIGEST_SCHEMA_VERSION,
        "run_id": safe_run_id,
        "claim_boundary": W7_5_CONTEXT_DIGEST_CLAIM_BOUNDARY,
        "public_safe": False,
        "raw_transcript_retained": False,
        "raw_selected_output_body_retained": False,
        "hydration_level": _validated_hydration_level(hydration_level),
        "loaded_context_refs": _string_list(loaded_context_refs, field_name="loaded_context_refs"),
        "deferred_context_refs": _string_list(deferred_context_refs, field_name="deferred_context_refs"),
        "token_estimate": _validated_token_estimate(token_estimate),
        "manual_restore_steps": _string_list(manual_restore_steps, field_name="manual_restore_steps"),
        "recovery_success_label": _validated_recovery_success_label(recovery_success_label),
        "operator_notes": _validated_operator_notes(operator_notes),
    }


def write_context_digest(
    run_id: str,
    *,
    data_dir: str | Path = "data",
    hydration_level: str = "L0",
    loaded_context_refs: list[str] | None = None,
    deferred_context_refs: list[str] | None = None,
    token_estimate: int | None = None,
    manual_restore_steps: list[str] | None = None,
    recovery_success_label: str = "unknown",
    operator_notes: str | None = None,
) -> Path:
    safe_run_id = _validated_run_id(run_id)
    path = run_artifact_dir_path(run_id=safe_run_id, data_dir=data_dir) / "context_digest.json"
    if path.exists():
        raise W75ContextDigestError(f"W7.5 context digest does not support overwrite: {path.as_posix()}")
    payload = build_context_digest(
        safe_run_id,
        hydration_level=hydration_level,
        loaded_context_refs=loaded_context_refs,
        deferred_context_refs=deferred_context_refs,
        token_estimate=token_estimate,
        manual_restore_steps=manual_restore_steps,
        recovery_success_label=recovery_success_label,
        operator_notes=operator_notes,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n", encoding="utf-8")
    return path


def _validated_run_id(run_id: str) -> str:
    try:
        return require_w6_path_identifier(run_id, field_name="run_id", reserved_names=WINDOWS_RESERVED_DEVICE_NAMES)
    except ValueError as error:
        raise W75ContextDigestError(f"Invalid run_id for W7.5 context digest artifact path: {error}") from error


def _validated_hydration_level(value: str) -> str:
    if value not in ALLOWED_HYDRATION_LEVELS:
        raise W75ContextDigestError("hydration_level must be one of L0, L1, L2, or L3.")
    return value


def _string_list(value: list[str] | None, *, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise W75ContextDigestError(f"{field_name} must be a list of non-empty strings.")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise W75ContextDigestError(f"{field_name} must contain only non-empty strings.")
        result.append(item.strip())
    return result


def _validated_token_estimate(value: int | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise W75ContextDigestError("token_estimate must be None or a positive integer.")
    return value


def _validated_recovery_success_label(value: str) -> str:
    if value not in ALLOWED_RECOVERY_SUCCESS_LABELS:
        raise W75ContextDigestError("recovery_success_label must be an operator label: unknown, restored, partially_restored, or failed.")
    return value


def _validated_operator_notes(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise W75ContextDigestError("operator_notes must be None or a string.")
    return value
