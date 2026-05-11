from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


W6_USEFULNESS_EVALUATION_SCHEMA_VERSION = "w6.usefulness_evaluation.v1"
W6_USEFULNESS_SEED_ROW_SCHEMA_VERSION = "w6.usefulness_seed_row.v1"
W6_USEFULNESS_CLAIM_BOUNDARY = "private_w6f_usefulness_evaluation_not_broad_or_public_claim"
W6_USEFULNESS_SEED_CLAIM_BOUNDARY = "single_loop_seed_row_only_not_broad_usefulness_claim"
W6_F_DEFAULT_OUTPUT_DIR = Path("data/evidence/wave6/eval/w6f-usefulness-evaluation-v1")
W6_F_REQUIRED_LOOP_IDS = frozenset(
    {
        "w6d-fal-w6bc-review-fix-20260508",
        "w6e-fal-project-state-protocol-20260511",
    },
)

ALLOWED_COMPLEXITY_CLASSES = {"simple", "medium", "high", "shared_boundary", "governance_context_continuity"}
ALLOWED_MODES = {"manual_opencode", "command_assisted", "packet_assisted", "fal_evidence_backed"}
ALLOWED_FINAL_STATUSES = {"pass", "pass_with_warnings", "hold", "blocked"}
ALLOWED_RECOMMENDATIONS = {"recommended", "optional", "not_worth_it", "dangerous", "insufficient_data"}
SUPPORTED_TRANSITION_STATUSES = {"pass", "warning", "fail", "unavailable"}
ADVISORY_POSITIVE_TRANSITION_STATUS = "pass"
PRIVATE_RAW = "private_raw"

REQUIRED_TEXT_FIELDS = (
    "loop_id",
    "target_repo",
    "sequence_ref",
    "task_type",
    "complexity_class",
    "mode",
    "final_status",
    "net_recommendation",
    "claim_boundary",
    "privacy_classification",
)
REQUIRED_INT_FIELDS = (
    "manual_copy_paste_steps",
    "copy_paste_avoided_count",
    "operator_interruptions_required",
    "missing_tests_count",
    "real_issues_caught_count",
    "false_positive_findings_count",
    "review_findings_count",
    "packet_validation_warning_count",
    "recorder_warning_count",
)


class W6UsefulnessEvaluationError(ValueError):
    pass


def load_and_evaluate_w6_usefulness(
    *,
    input_row_paths: Sequence[str | Path],
    output_dir: str | Path = W6_F_DEFAULT_OUTPUT_DIR,
) -> dict[str, Any]:
    rows = [_load_seed_row(path) for path in input_row_paths]
    return evaluate_w6_usefulness(rows, output_dir=output_dir)


def evaluate_w6_usefulness(
    seed_rows: Iterable[Mapping[str, Any]],
    *,
    output_dir: str | Path = W6_F_DEFAULT_OUTPUT_DIR,
) -> dict[str, Any]:
    rows = [_validate_seed_row(row) for row in seed_rows]
    if not rows:
        raise W6UsefulnessEvaluationError("At least one W6 usefulness seed row is required.")
    _reject_duplicate_loop_ids(rows)
    _require_default_w6f_loop_set(rows)

    per_class = [_evaluate_class(complexity_class, class_rows) for complexity_class, class_rows in _rows_by_class(rows).items()]
    per_class.sort(key=lambda item: item["complexity_class"])
    summary = _build_summary(rows, per_class)
    _write_outputs(rows=rows, summary=summary, output_dir=Path(output_dir))
    return summary


def _load_seed_row(path: str | Path) -> dict[str, Any]:
    row_path = Path(path)
    try:
        payload = json.loads(row_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise W6UsefulnessEvaluationError(f"Unable to read W6 usefulness row '{row_path.as_posix()}': {exc}") from exc
    except json.JSONDecodeError as exc:
        raise W6UsefulnessEvaluationError(f"Invalid JSON in W6 usefulness row '{row_path.as_posix()}': {exc}") from exc
    if not isinstance(payload, dict):
        raise W6UsefulnessEvaluationError(f"W6 usefulness row '{row_path.as_posix()}' must be a JSON object.")
    return payload


def _validate_seed_row(seed_row: Mapping[str, Any]) -> dict[str, Any]:
    row = dict(seed_row)
    errors: list[str] = []

    if row.get("schema_version") != W6_USEFULNESS_SEED_ROW_SCHEMA_VERSION:
        errors.append("schema_version must be w6.usefulness_seed_row.v1")
    for field in REQUIRED_TEXT_FIELDS:
        if not isinstance(row.get(field), str) or not row[field].strip():
            errors.append(f"{field} must be a non-empty string")
    for field in REQUIRED_INT_FIELDS:
        if not isinstance(row.get(field), int) or row[field] < 0:
            errors.append(f"{field} must be a non-negative integer")

    if row.get("complexity_class") not in ALLOWED_COMPLEXITY_CLASSES:
        errors.append("complexity_class is not supported for W6-F")
    if row.get("mode") not in ALLOWED_MODES:
        errors.append("mode is not supported for W6-F")
    if row.get("final_status") not in ALLOWED_FINAL_STATUSES:
        errors.append("final_status is not supported for W6-F")
    if row.get("net_recommendation") not in ALLOWED_RECOMMENDATIONS:
        errors.append("net_recommendation is not supported for W6-F")
    if row.get("claim_boundary") != W6_USEFULNESS_SEED_CLAIM_BOUNDARY:
        errors.append("claim_boundary must remain single-loop seed-only evidence")
    if row.get("privacy_classification") != PRIVATE_RAW:
        errors.append("privacy_classification must be private_raw")
    if row.get("public_safe") is True:
        errors.append("W6-F must not consume rows that claim public_safe")

    transition_validation = row.get("transition_validation")
    if not isinstance(transition_validation, Mapping):
        errors.append("transition_validation must be an object")
    else:
        source = transition_validation.get("source")
        status = transition_validation.get("status")
        if source != "computed_w6_b":
            errors.append("transition_validation.source must be computed_w6_b")
        if not isinstance(status, str) or not status.strip():
            errors.append("transition_validation.status must be a non-empty string")
        elif status not in SUPPORTED_TRANSITION_STATUSES:
            errors.append(
                "transition_validation.status must be one of "
                f"{', '.join(sorted(SUPPORTED_TRANSITION_STATUSES))}",
            )
    clean_pass_blockers = row.get("clean_pass_blockers")
    if not isinstance(clean_pass_blockers, list) or any(not isinstance(item, str) for item in clean_pass_blockers):
        errors.append("clean_pass_blockers must be a list of strings")

    if errors:
        loop_id = row.get("loop_id", "<unknown>")
        raise W6UsefulnessEvaluationError(f"Invalid W6 usefulness row {loop_id}: {'; '.join(errors)}")
    return row


def _reject_duplicate_loop_ids(rows: Sequence[Mapping[str, Any]]) -> None:
    seen: set[str] = set()
    duplicates: list[str] = []
    for row in rows:
        loop_id = str(row["loop_id"])
        if loop_id in seen:
            duplicates.append(loop_id)
        seen.add(loop_id)
    if duplicates:
        raise W6UsefulnessEvaluationError(f"Duplicate W6 loop_id values are not allowed: {', '.join(duplicates)}")


def _require_default_w6f_loop_set(rows: Sequence[Mapping[str, Any]]) -> None:
    loop_ids = {str(row["loop_id"]) for row in rows}
    missing = sorted(W6_F_REQUIRED_LOOP_IDS - loop_ids)
    if missing:
        raise W6UsefulnessEvaluationError(
            "Default W6-F usefulness evaluation requires W6-D + W6-E seed rows; "
            f"missing loop_id values: {', '.join(missing)}",
        )


def _rows_by_class(rows: Sequence[Mapping[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row["complexity_class"])].append(dict(row))
    return dict(grouped)


def _evaluate_class(complexity_class: str, rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    metrics = _aggregate_metrics(rows)
    fal_only = _is_fal_only(rows)
    warning_grade = _has_warning_grade_evidence(rows)
    non_positive_transition = any(_transition_status(row) != ADVISORY_POSITIVE_TRANSITION_STATUS for row in rows)
    failed_transition = any(_transition_status(row) == "fail" for row in rows)
    too_lenient_gate = any(
        row.get("final_status") == "pass" and _transition_status(row) != ADVISORY_POSITIVE_TRANSITION_STATUS
        for row in rows
    )
    high_false_positive_rate = metrics["false_positive_findings_count"] >= 2 and (
        metrics["false_positive_findings_count"] >= metrics["real_issues_caught_count"]
    )
    audit_value_present = metrics["real_issues_caught_count"] > 0 or metrics["copy_paste_avoided_count"] > 0
    overhead_without_value = (
        metrics["real_issues_caught_count"] == 0
        and metrics["copy_paste_avoided_count"] == 0
        and metrics["manual_copy_paste_steps"] > 0
    )

    if failed_transition or too_lenient_gate or high_false_positive_rate:
        recommendation = "dangerous"
        rationale = "Transition, gate, or false-positive evidence makes automation expansion unsafe."
    elif non_positive_transition:
        recommendation = "insufficient_data"
        rationale = "Transition evidence is supported but not pass, so it cannot support advisory-positive output."
    elif overhead_without_value:
        recommendation = "not_worth_it"
        rationale = "The row shows process overhead without captured audit value."
    elif audit_value_present:
        recommendation = "optional"
        rationale = "The row shows audit value, but evidence is narrow and caveated."
    else:
        recommendation = "insufficient_data"
        rationale = "The row does not yet show enough audit value for class-level policy."

    if recommendation == "optional" and _eligible_for_recommended(rows, fal_only=fal_only, warning_grade=warning_grade):
        recommendation = "recommended"
        rationale = "Multiple clean rows with external evidence show repeatable audit value."

    confidence = _confidence_for(rows, fal_only=fal_only, warning_grade=warning_grade)
    bridge_implication = _bridge_implication_for(recommendation, confidence)
    known_limits = _known_limits_for(rows, fal_only=fal_only, warning_grade=warning_grade)
    evidence_quality = _evidence_quality_for(confidence=confidence, fal_only=fal_only, warning_grade=warning_grade)

    return {
        "complexity_class": complexity_class,
        "loop_ids": [str(row["loop_id"]) for row in rows],
        "row_count": len(rows),
        "class_recommendation": recommendation,
        "confidence": confidence,
        "evidence_quality": evidence_quality,
        "bridge_readiness_implication": bridge_implication,
        "rationale": rationale,
        "known_limits": known_limits,
        "metrics": metrics,
    }


def _aggregate_metrics(rows: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    return {
        field: sum(int(row.get(field, 0)) for row in rows)
        for field in REQUIRED_INT_FIELDS
    }


def _is_fal_only(rows: Sequence[Mapping[str, Any]]) -> bool:
    return all(row.get("target_repo") == "FractalAgentLab" for row in rows)


def _has_warning_grade_evidence(rows: Sequence[Mapping[str, Any]]) -> bool:
    return any(
        row.get("final_status") != "pass"
        or bool(row.get("clean_pass_blockers"))
        or int(row.get("missing_tests_count", 0)) > 0
        or row.get("net_recommendation") == "insufficient_data"
        for row in rows
    )


def _transition_status(row: Mapping[str, Any]) -> str | None:
    transition_validation = row.get("transition_validation")
    if isinstance(transition_validation, Mapping):
        status = transition_validation.get("status")
        return status if isinstance(status, str) else None
    return None


def _eligible_for_recommended(rows: Sequence[Mapping[str, Any]], *, fal_only: bool, warning_grade: bool) -> bool:
    if fal_only or warning_grade or len(rows) < 3:
        return False
    metrics = _aggregate_metrics(rows)
    if metrics["real_issues_caught_count"] < 2 or metrics["false_positive_findings_count"] > 0:
        return False
    return all(_transition_status(row) == ADVISORY_POSITIVE_TRANSITION_STATUS for row in rows)


def _confidence_for(rows: Sequence[Mapping[str, Any]], *, fal_only: bool, warning_grade: bool) -> str:
    if fal_only or warning_grade or len(rows) < 2:
        return "low"
    if len(rows) < 4:
        return "medium"
    return "high"


def _evidence_quality_for(*, confidence: str, fal_only: bool, warning_grade: bool) -> str:
    if fal_only or warning_grade or confidence == "low":
        return "low"
    return confidence


def _bridge_implication_for(recommendation: str, confidence: str) -> str:
    if recommendation == "recommended":
        return "may_support_w6g_readiness_brief_after_meta_review_only"
    if recommendation == "optional":
        return "may_support_narrow_w6g_readiness_brief_after_meta_review_only"
    if recommendation == "dangerous":
        return "keep_w6g_blocked_and_do_not_expand_automation"
    return "keep_w6g_blocked_pending_more_or_better_evidence"


def _known_limits_for(rows: Sequence[Mapping[str, Any]], *, fal_only: bool, warning_grade: bool) -> list[str]:
    limits: list[str] = []
    if fal_only:
        limits.append("Evidence is FAL-only; no external target-repo loop has been evaluated yet.")
    if warning_grade:
        limits.append("At least one row is warning-grade, clean_pass=false, or has recorder net_recommendation=insufficient_data.")
    if len(rows) < 2:
        limits.append("Only one row exists for this task class, so class-level confidence remains low.")
    limits.append("This class recommendation can at most inform a W6-G readiness brief; it does not authorize bridge/API implementation.")
    return limits


def _build_summary(rows: Sequence[Mapping[str, Any]], per_class: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    overall_recommendation = _overall_recommendation(per_class)
    confidence = _overall_confidence(per_class)
    fal_only = _is_fal_only(rows)
    warning_grade = _has_warning_grade_evidence(rows)
    bridge_implication = _bridge_implication_for(overall_recommendation, confidence)
    known_limits = _overall_known_limits(rows, fal_only=fal_only, warning_grade=warning_grade)
    return {
        "schema_version": W6_USEFULNESS_EVALUATION_SCHEMA_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_loop_ids": [str(row["loop_id"]) for row in rows],
        "row_count": len(rows),
        "target_repos": sorted({str(row["target_repo"]) for row in rows}),
        "fal_only_evidence": fal_only,
        "external_evidence_present": not fal_only,
        "per_class_evaluations": [dict(item) for item in per_class],
        "overall_recommendation": overall_recommendation,
        "confidence": confidence,
        "evidence_quality": _evidence_quality_for(confidence=confidence, fal_only=fal_only, warning_grade=warning_grade),
        "bridge_readiness_implication": bridge_implication,
        "known_limits": known_limits,
        "privacy_classification": PRIVATE_RAW,
        "public_safe": False,
        "claim_boundary": W6_USEFULNESS_CLAIM_BOUNDARY,
    }


def _overall_recommendation(per_class: Sequence[Mapping[str, Any]]) -> str:
    recommendations = [str(item["class_recommendation"]) for item in per_class]
    if "dangerous" in recommendations:
        return "dangerous"
    if "recommended" in recommendations:
        return "recommended"
    if "optional" in recommendations:
        return "optional"
    if recommendations and all(item == "not_worth_it" for item in recommendations):
        return "not_worth_it"
    return "insufficient_data"


def _overall_confidence(per_class: Sequence[Mapping[str, Any]]) -> str:
    confidence_values = {str(item["confidence"]) for item in per_class}
    if "low" in confidence_values:
        return "low"
    if "medium" in confidence_values:
        return "medium"
    return "high" if confidence_values else "low"


def _overall_known_limits(rows: Sequence[Mapping[str, Any]], *, fal_only: bool, warning_grade: bool) -> list[str]:
    limits = [
        "W6-F evaluates existing seed rows only; it does not run a new W6-C recorder capture.",
        "Recorder net_recommendation values remain row-level evidence and are not overwritten by this aggregate evaluation.",
        "OpenCode bridge/API implementation remains out of scope and unauthorized.",
        "W6-H/W6-I external target readiness remains a separate later gate.",
    ]
    if fal_only:
        limits.append("All evaluated rows are from FractalAgentLab; external target evidence is still missing.")
    if warning_grade:
        limits.append("The evaluated rows include warning-grade evidence, clean_pass blockers, or insufficient recorder recommendations.")
    if len(rows) < 3:
        limits.append("The evidence set is small; recommended verdict is intentionally unreachable from this input size.")
    return limits


def _write_outputs(*, rows: Sequence[Mapping[str, Any]], summary: Mapping[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows_path = output_dir / "usefulness_rows.jsonl"
    summary_path = output_dir / "usefulness_summary.json"

    with rows_path.open("w", encoding="utf-8") as file_handle:
        for row in rows:
            file_handle.write(json.dumps(_sanitized_row(row), sort_keys=True, ensure_ascii=True))
            file_handle.write("\n")
    _write_json(summary_path, dict(summary))


def _sanitized_row(row: Mapping[str, Any]) -> dict[str, Any]:
    transition_validation = row.get("transition_validation") if isinstance(row.get("transition_validation"), Mapping) else {}
    return {
        "schema_version": W6_USEFULNESS_SEED_ROW_SCHEMA_VERSION,
        "loop_id": row["loop_id"],
        "target_repo": row["target_repo"],
        "sequence_ref": row["sequence_ref"],
        "task_type": row["task_type"],
        "complexity_class": row["complexity_class"],
        "mode": row["mode"],
        "manual_copy_paste_steps": row["manual_copy_paste_steps"],
        "copy_paste_avoided_count": row["copy_paste_avoided_count"],
        "operator_interruptions_required": row["operator_interruptions_required"],
        "missing_tests_count": row["missing_tests_count"],
        "real_issues_caught_count": row["real_issues_caught_count"],
        "false_positive_findings_count": row["false_positive_findings_count"],
        "review_findings_count": row["review_findings_count"],
        "transition_validation_source": transition_validation.get("source"),
        "transition_validation_status": transition_validation.get("status"),
        "final_status": row["final_status"],
        "net_recommendation": row["net_recommendation"],
        "claim_boundary": row["claim_boundary"],
        "privacy_classification": row["privacy_classification"],
    }


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n", encoding="utf-8")
