from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id  # noqa: E402
from fractal_agent_lab.evals.h1_eval_contracts import (  # noqa: E402
    H1_COMPARABLE_OUTPUT_KEYS,
    H1_COMPARISON_ROLE_BY_WORKFLOW_ID,
    H1_VARIANT_WORKFLOW_IDS,
)
from fractal_agent_lab.evals.h1_eval_projections import extract_h1_comparable_output  # noqa: E402
from fractal_agent_lab.evals.h2_eval_contracts import (  # noqa: E402
    H2_COMPARABLE_OUTPUT_KEYS,
    H2_EXPECTED_MANAGER_DELEGATE_ORDER,
    H2_EXPECTED_WORKFLOW_ID,
)
from fractal_agent_lab.evals.h2_eval_projections import extract_h2_comparable_output  # noqa: E402
from fractal_agent_lab.tracing.artifact_layout import (  # noqa: E402
    run_artifact_dir_path,
    run_artifact_path,
    runs_dir_path,
    trace_artifact_path,
)

SCHEMA_VERSION = "u5_e.comparison_index.v1"
DEFAULT_LIMIT = 500
DEFAULT_MAX_SUGGESTED_PAIRS = 25
PREVIEW_MAX_CHARS = 160

P4_B_OPENROUTER_RUN_ID = "4771b058-97b6-4164-b060-40b381acd2b4"
P4_B_OPENAI_RUN_ID = "308ac05a-7f2e-4985-99dc-11d547557a98"
P4_B_SOURCE_PATH = "docs/wave4/Wave4-W4-S1-TrackE-P4-B-Live-Evidence-Closeout-v1.md"


def build_comparison_index(
    *,
    data_dir: str | Path,
    limit: int | None = DEFAULT_LIMIT,
    max_suggested_pairs: int = DEFAULT_MAX_SUGGESTED_PAIRS,
) -> dict[str, Any]:
    data_dir_path = Path(data_dir)
    warnings: list[str] = []
    run_candidates = _collect_run_candidates(data_dir=data_dir_path, limit=limit, warnings=warnings)
    suggested_pairs = _build_suggested_pairs(run_candidates=run_candidates, max_suggested_pairs=max_suggested_pairs)
    known_evidence_pairs = _build_known_evidence_pairs(data_dir=data_dir_path, candidates=run_candidates)
    unsupported_targets = _build_unsupported_targets(run_candidates)

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_dir": data_dir_path.as_posix(),
        "summary": {
            "run_candidate_count": len(run_candidates),
            "suggested_pair_count": len(suggested_pairs),
            "known_evidence_pair_count": len(known_evidence_pairs),
            "unsupported_target_count": len(unsupported_targets),
            "warnings_count": len(warnings),
            "max_suggested_pairs": max_suggested_pairs,
        },
        "run_candidates": run_candidates,
        "suggested_pairs": suggested_pairs,
        "known_evidence_pairs": known_evidence_pairs,
        "unsupported_targets": unsupported_targets,
        "warnings": warnings,
    }


def write_comparison_index(
    *,
    data_dir: str | Path,
    out_path: str | Path,
    limit: int | None = DEFAULT_LIMIT,
    max_suggested_pairs: int = DEFAULT_MAX_SUGGESTED_PAIRS,
) -> dict[str, Any]:
    index = build_comparison_index(data_dir=data_dir, limit=limit, max_suggested_pairs=max_suggested_pairs)
    resolved_out = Path(out_path)
    resolved_out.parent.mkdir(parents=True, exist_ok=True)
    resolved_out.write_text(json.dumps(index, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return index


def _collect_run_candidates(*, data_dir: Path, limit: int | None, warnings: list[str]) -> list[dict[str, Any]]:
    runs_dir = runs_dir_path(data_dir=data_dir)
    if not runs_dir.exists():
        warnings.append(f"Missing runs directory: {runs_dir.as_posix()}")
        return []

    candidates: list[dict[str, Any]] = []
    for path in sorted(runs_dir.glob("*.json")):
        payload = _read_json_object(path=path, warnings=warnings, context="run artifact")
        run_id = _str_or_none(payload.get("run_id")) if payload is not None else path.stem
        if run_id is None:
            run_id = path.stem
        candidates.append(_build_run_candidate(data_dir=data_dir, run_id=run_id, payload=payload, source_path=path))

    candidates.sort(key=_candidate_sort_key)
    if limit is not None:
        candidates = candidates[:limit]
    return candidates


def _build_run_candidate(*, data_dir: Path, run_id: str, payload: dict[str, Any] | None, source_path: Path) -> dict[str, Any]:
    validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)
    run_payload = payload if isinstance(payload, dict) else validation.run_payload if isinstance(validation.run_payload, dict) else {}
    workflow_id = _str_or_none(run_payload.get("workflow_id"))
    status = _str_or_none(run_payload.get("status"))
    output_payload = run_payload.get("output_payload") if isinstance(run_payload.get("output_payload"), dict) else {}
    input_payload = run_payload.get("input_payload") if isinstance(run_payload.get("input_payload"), dict) else None
    target_class = _target_class_for_workflow(workflow_id)
    comparable_output = _comparable_output_for_target(target_class=target_class, workflow_id=workflow_id, output_payload=output_payload)
    h2_gates = _h2_gates(target_class=target_class, output_payload=output_payload)

    run_path = run_artifact_path(run_id=run_id, data_dir=data_dir)
    trace_path = trace_artifact_path(run_id=run_id, data_dir=data_dir)
    artifact_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir)

    return {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "started_at": _str_or_none(run_payload.get("started_at")),
        "completed_at": _str_or_none(run_payload.get("completed_at")),
        "target_class": target_class,
        "comparison_support": _comparison_support_for_target(target_class),
        "comparison_role": H1_COMPARISON_ROLE_BY_WORKFLOW_ID.get(workflow_id) if workflow_id else None,
        "run_artifact_path": run_path.as_posix(),
        "trace_artifact_path": trace_path.as_posix(),
        "artifact_dir_path": artifact_dir.as_posix(),
        "artifact_validation": {
            "passed": validation.passed,
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        },
        "preflight": {
            "run_artifact_exists": run_path.exists(),
            "trace_artifact_exists": trace_path.exists(),
            "artifact_validation_passed": validation.passed,
            "trace_state": "available" if trace_path.exists() else "missing",
        },
        "input": _input_summary(input_payload),
        "comparable_output": comparable_output,
        "h2_gates": h2_gates,
        "provider_disclosure": _provider_disclosure(run_payload),
    }


def _build_suggested_pairs(*, run_candidates: list[dict[str, Any]], max_suggested_pairs: int) -> list[dict[str, Any]]:
    pairs: list[dict[str, Any]] = []
    for target_class in ("h1_structural_variant", "h2_structural"):
        eligible = [candidate for candidate in run_candidates if candidate["target_class"] == target_class]
        eligible.sort(key=_candidate_sort_key)
        for left, right in combinations(eligible, 2):
            if len(pairs) >= max_suggested_pairs:
                return pairs
            pairs.append(_suggested_pair(left=left, right=right, target_class=target_class))
    return pairs


def _suggested_pair(*, left: dict[str, Any], right: dict[str, Any], target_class: str) -> dict[str, Any]:
    status, reasons = _structural_preflight_status(left=left, right=right, target_class=target_class)
    return {
        "pair_id": f"{target_class}:{left['run_id']}:{right['run_id']}",
        "target_class": target_class,
        "left_run_id": left["run_id"],
        "right_run_id": right["run_id"],
        "selection_reason": "bounded_recent_valid_runs_first",
        "structural_preflight_status": status,
        "status_reasons": reasons,
        "matched_input": _matched_input(left, right),
        "source_reported_status": None,
        "display_only": True,
    }


def _build_known_evidence_pairs(*, data_dir: Path, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_run_id = {candidate["run_id"]: candidate for candidate in candidates}
    left = by_run_id.get(P4_B_OPENROUTER_RUN_ID)
    right = by_run_id.get(P4_B_OPENAI_RUN_ID)
    missing = [run_id for run_id, candidate in ((P4_B_OPENROUTER_RUN_ID, left), (P4_B_OPENAI_RUN_ID, right)) if candidate is None]
    local_state = "available" if not missing else "not_demonstrated"
    local_preflight_status = "WARNING" if local_state == "available" else "BLOCKED"
    reasons = ["accepted_track_e_source_reported_pair"]
    if missing:
        reasons.append("missing_local_run_ids:" + ",".join(missing))
    if left is not None and right is not None:
        if left["provider_disclosure"].get("fallback_state") == "observed" or right["provider_disclosure"].get("fallback_state") == "observed":
            local_preflight_status = "FAIL"
            reasons.append("local_fallback_observed_source_report_not_recomputed")

    return [
        {
            "pair_id": "p4_b.accepted_h1_provider_path_smoke",
            "target_class": "h1_provider_path_smoke",
            "left_run_id": P4_B_OPENROUTER_RUN_ID,
            "right_run_id": P4_B_OPENAI_RUN_ID,
            "source_reported_status": "PASS",
            "source_report_path": P4_B_SOURCE_PATH,
            "local_state": local_state,
            "local_preflight_status": local_preflight_status,
            "status_reasons": reasons,
            "display_only": True,
        },
    ]


def _build_unsupported_targets(run_candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for candidate in run_candidates:
        if candidate["target_class"] not in {"h3_single_run_reference", "h4_deferred", "h5_deferred", "unsupported"}:
            continue
        if candidate["target_class"] == "h3_single_run_reference":
            label = "manual_rubric_backed"
            note = "H3 is single-run evidence only in U5-E v1; Track A does not mark it comparison-ready."
        elif candidate["target_class"] in {"h4_deferred", "h5_deferred"}:
            label = "not_demonstrated"
            note = "Comparison support is deferred until a later Track E contract defines keys, labels, and gates."
        else:
            label = "unsupported"
            note = "No accepted Track E comparison target class exists for this workflow."
        rows.append(
            {
                "run_id": candidate["run_id"],
                "workflow_id": candidate["workflow_id"],
                "target_class": candidate["target_class"],
                "evidence_label": label,
                "future_state": "deferred" if candidate["target_class"] in {"h4_deferred", "h5_deferred"} else None,
                "note": note,
            },
        )
    return rows


def _structural_preflight_status(*, left: dict[str, Any], right: dict[str, Any], target_class: str) -> tuple[str, list[str]]:
    reasons: list[str] = []
    if target_class not in {"h1_structural_variant", "h2_structural"}:
        return "BLOCKED", ["unsupported_target_class"]
    for side, candidate in (("left", left), ("right", right)):
        if not candidate["preflight"]["run_artifact_exists"]:
            reasons.append(f"{side}_missing_run_artifact")
        if not candidate["preflight"]["trace_artifact_exists"]:
            reasons.append(f"{side}_missing_trace_artifact")
        if candidate["artifact_validation"]["errors"]:
            reasons.append(f"{side}_artifact_validation_failed")
        if not candidate["input"]["available"]:
            reasons.append(f"{side}_input_payload_missing")
        if not candidate["comparable_output"]["complete"]:
            reasons.append(f"{side}_comparable_output_incomplete")
    if _matched_input(left, right) is not True:
        reasons.append("matched_input_not_confirmed")
    if target_class == "h2_structural":
        for side, candidate in (("left", left), ("right", right)):
            gates = candidate["h2_gates"]
            if not gates.get("key_order_matches"):
                reasons.append(f"{side}_h2_key_order_mismatch")
            if not gates.get("implementation_waves_valid"):
                reasons.append(f"{side}_h2_implementation_waves_invalid")
            if not gates.get("recommended_starting_slice_present"):
                reasons.append(f"{side}_h2_recommended_starting_slice_missing")
            if not gates.get("delegate_order_matches"):
                reasons.append(f"{side}_h2_delegate_order_mismatch")
        reasons.append("h2_intended_comparable_corpus_unknown")

    if not reasons:
        return "PASS", []
    if any("validation_failed" in reason for reason in reasons):
        return "INVALID", reasons
    if any("missing" in reason or "not_confirmed" in reason for reason in reasons):
        return "BLOCKED", reasons
    failure_reasons = [reason for reason in reasons if reason != "h2_intended_comparable_corpus_unknown"]
    if failure_reasons:
        return "FAIL", reasons
    if "h2_intended_comparable_corpus_unknown" in reasons:
        return "WARNING", reasons
    return "FAIL", reasons


def _target_class_for_workflow(workflow_id: str | None) -> str:
    if workflow_id in H1_VARIANT_WORKFLOW_IDS:
        return "h1_structural_variant"
    if workflow_id == H2_EXPECTED_WORKFLOW_ID:
        return "h2_structural"
    if isinstance(workflow_id, str) and workflow_id.startswith("h3."):
        return "h3_single_run_reference"
    if isinstance(workflow_id, str) and workflow_id.startswith("h4."):
        return "h4_deferred"
    if isinstance(workflow_id, str) and workflow_id.startswith("h5."):
        return "h5_deferred"
    return "unsupported"


def _comparison_support_for_target(target_class: str) -> str:
    if target_class in {"h1_structural_variant", "h2_structural"}:
        return "supported"
    if target_class == "h3_single_run_reference":
        return "single_run_reference"
    if target_class in {"h4_deferred", "h5_deferred"}:
        return "not_demonstrated"
    return "unsupported"


def _comparable_output_for_target(*, target_class: str, workflow_id: str | None, output_payload: dict[str, Any]) -> dict[str, Any]:
    if target_class == "h1_structural_variant":
        raw = extract_h1_comparable_output(workflow_id=workflow_id, output_payload=output_payload)
        keys = H1_COMPARABLE_OUTPUT_KEYS
    elif target_class == "h2_structural":
        raw = extract_h2_comparable_output(output_payload)
        keys = H2_COMPARABLE_OUTPUT_KEYS
    else:
        raw = {"present": False, "complete": False, "fields": {}, "missing_keys": []}
        keys = ()
    fields = raw.get("fields") if isinstance(raw.get("fields"), dict) else {}
    return {
        "present": bool(raw.get("present")),
        "complete": bool(raw.get("complete")),
        "missing_keys": [key for key in raw.get("missing_keys", []) if isinstance(key, str)],
        "fields": [_display_field(key=key, value=fields.get(key)) for key in keys],
    }


def _h2_gates(*, target_class: str, output_payload: dict[str, Any]) -> dict[str, bool | None | list[str]]:
    if target_class != "h2_structural":
        return {
            "key_order_matches": None,
            "implementation_waves_valid": None,
            "recommended_starting_slice_present": None,
            "delegate_order_matches": None,
            "delegate_targets": [],
        }
    projection = extract_h2_comparable_output(output_payload)
    manager_orchestration = output_payload.get("manager_orchestration") if isinstance(output_payload.get("manager_orchestration"), dict) else {}
    turns = manager_orchestration.get("turns") if isinstance(manager_orchestration.get("turns"), list) else []
    delegate_targets = [
        turn.get("target_step_id")
        for turn in turns
        if isinstance(turn, dict) and turn.get("action") == "delegate" and isinstance(turn.get("target_step_id"), str)
    ]
    return {
        "key_order_matches": bool(projection.get("key_order_matches")),
        "implementation_waves_valid": bool(projection.get("implementation_waves_valid")),
        "recommended_starting_slice_present": bool(projection.get("recommended_starting_slice_present")),
        "delegate_order_matches": tuple(delegate_targets) == H2_EXPECTED_MANAGER_DELEGATE_ORDER,
        "delegate_targets": delegate_targets,
    }


def _input_summary(input_payload: dict[str, Any] | None) -> dict[str, Any]:
    if input_payload is None:
        return {"available": False, "fingerprint": None, "keys": []}
    return {
        "available": True,
        "fingerprint": _fingerprint(input_payload),
        "keys": sorted(key for key in input_payload if isinstance(key, str)),
    }


def _matched_input(left: dict[str, Any], right: dict[str, Any]) -> bool | None:
    left_fingerprint = left["input"].get("fingerprint")
    right_fingerprint = right["input"].get("fingerprint")
    if left_fingerprint is None or right_fingerprint is None:
        return None
    return left_fingerprint == right_fingerprint


def _display_field(*, key: str, value: Any) -> dict[str, Any]:
    present = value is not None
    return {
        "key": key,
        "present": present,
        "value_kind": _value_kind(value),
        "preview": _preview(value) if present else None,
        "fingerprint": _fingerprint(value) if present else None,
    }


def _provider_disclosure(run_payload: dict[str, Any]) -> dict[str, Any]:
    providers: set[str] = set()
    models: set[str] = set()
    selected_provider = None
    executed_provider = None
    selected_model = None
    executed_model = None
    fallback_observed = False
    fallback_not_observed = False
    provider_attempts: list[dict[str, Any]] = []

    for mapping in _walk_dicts(run_payload):
        selected_provider = selected_provider or _str_or_none(mapping.get("selected_provider"))
        executed_provider = executed_provider or _str_or_none(mapping.get("executed_provider")) or _str_or_none(mapping.get("provider"))
        selected_model = selected_model or _str_or_none(mapping.get("selected_model"))
        executed_model = executed_model or _str_or_none(mapping.get("executed_model")) or _str_or_none(mapping.get("model"))
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
            fallback_used = fallback.get("used")
            if isinstance(fallback_used, bool):
                fallback_observed = fallback_observed or fallback_used
                fallback_not_observed = fallback_not_observed or not fallback_used
            else:
                fallback_observed = True
        used_fallback = mapping.get("used_fallback")
        if isinstance(used_fallback, bool):
            fallback_observed = fallback_observed or used_fallback
            fallback_not_observed = fallback_not_observed or not used_fallback
        attempts = mapping.get("provider_attempts")
        if isinstance(attempts, list) and not provider_attempts:
            provider_attempts = [attempt for attempt in attempts if isinstance(attempt, dict)]

    fallback_state = "observed" if fallback_observed else "not_observed" if fallback_not_observed else "unknown"
    return {
        "provider_names": sorted(providers),
        "model_names": sorted(models),
        "selected_provider": selected_provider,
        "executed_provider": executed_provider,
        "selected_model": selected_model,
        "executed_model": executed_model,
        "fallback_state": fallback_state,
        "provider_attempt_count": len(provider_attempts),
    }


def _candidate_sort_key(candidate: dict[str, Any]) -> tuple[int, str, str]:
    timestamp = candidate.get("completed_at") or candidate.get("started_at") or ""
    valid_rank = 0 if candidate.get("artifact_validation", {}).get("passed") else 1
    return valid_rank, _reverse_sort_text(timestamp), str(candidate.get("run_id") or "")


def _reverse_sort_text(value: str) -> str:
    return "".join(chr(0x10FFFF - ord(char)) for char in value)


def _read_json_object(*, path: Path, warnings: list[str], context: str) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        warnings.append(f"Malformed {context}: {path.as_posix()} ({error})")
        return None
    if not isinstance(payload, dict):
        warnings.append(f"Malformed {context}: {path.as_posix()} (root is not a JSON object)")
        return None
    return payload


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


def _preview(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=True, sort_keys=True) if isinstance(value, (dict, list)) else str(value)
    if len(text) <= PREVIEW_MAX_CHARS:
        return text
    return text[: PREVIEW_MAX_CHARS - 3] + "..."


def _fingerprint(value: Any) -> str:
    try:
        encoded = json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    except TypeError:
        encoded = str(value).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


def _value_kind(value: Any) -> str:
    if value is None:
        return "missing"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "object"
    return "unknown"


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the U5-E derived comparison index for the local UI.")
    parser.add_argument("--data-dir", default="../data", help="Canonical FAL data directory to inspect.")
    parser.add_argument("--out", default="public/generated/comparison-index.json", help="Generated index output path.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Maximum run candidates after deterministic sorting.")
    parser.add_argument("--max-suggested-pairs", type=int, default=DEFAULT_MAX_SUGGESTED_PAIRS, help="Maximum bounded suggested pairs.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.limit is not None and args.limit <= 0:
        print("Error: --limit must be a positive integer.", file=sys.stderr)
        return 2
    if args.max_suggested_pairs <= 0:
        print("Error: --max-suggested-pairs must be a positive integer.", file=sys.stderr)
        return 2
    try:
        index = write_comparison_index(
            data_dir=args.data_dir,
            out_path=args.out,
            limit=args.limit,
            max_suggested_pairs=args.max_suggested_pairs,
        )
    except OSError as error:
        print(f"Error: failed to write comparison index: {error}", file=sys.stderr)
        return 2
    print(
        "Generated {runs} comparison run candidates and {pairs} suggested pairs at {path} with {warnings} warnings.".format(
            runs=index["summary"]["run_candidate_count"],
            pairs=index["summary"]["suggested_pair_count"],
            path=Path(args.out).as_posix(),
            warnings=index["summary"]["warnings_count"],
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
