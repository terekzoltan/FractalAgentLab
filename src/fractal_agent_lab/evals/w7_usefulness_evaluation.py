from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


W7_USEFULNESS_EVALUATION_SCHEMA_VERSION = "w7.usefulness_evaluation.v1"
W7_USEFULNESS_SEED_ROW_SCHEMA_VERSION = "w7.usefulness_seed_row.v1"
W7_USEFULNESS_CLAIM_BOUNDARY = "private_w7f_usefulness_evaluation_not_broad_or_public_claim"
W7_USEFULNESS_SEED_CLAIM_BOUNDARY = "bounded_w7_usefulness_seed_row_not_public_or_automation_claim"

PRIVATE_RAW = "private_raw"
REQUIRED_DIMENSIONS = ("manual_bookkeeping", "audit_replay", "learning_input_trust")
ALLOWED_DIMENSIONS = set(REQUIRED_DIMENSIONS)
REQUIRED_SOURCE_EPIC_BY_DIMENSION = {
    "manual_bookkeeping": "W7-D",
    "audit_replay": "W7-B/C",
    "learning_input_trust": "W7-E2",
}
REQUIRED_EVIDENCE_REF_MARKERS_BY_DIMENSION = {
    "manual_bookkeeping": {"ca1167d", "ops/Combined-Execution-Sequencing-Plan.md:1934"},
    "audit_replay": {"4d11484", "ops/Combined-Execution-Sequencing-Plan.md:1925"},
    "learning_input_trust": {"227fd11", "ops/Combined-Execution-Sequencing-Plan.md:1936"},
}
ALLOWED_DIMENSION_VERDICTS = {"pass", "weak", "fail"}
ALLOWED_RECOMMENDATIONS = {"continue", "narrow_continue", "hold", "stop", "insufficient_evidence"}
ALLOWED_RESIDUAL_RISK_STATUSES = {"in-scope now", "not-yet-in-scope", "already resolved"}
ALLOWED_W7_G_RECOMMENDATIONS = {"do_not_open", "open_docs_only_review", "defer_to_meta"}

FORBIDDEN_CLAIM_MARKERS = (
    "public export approved",
    "public-safe",
    "public_safe",
    "bridge/api/session delivery authorized",
    "bridge api authorized",
    "session delivery authorized",
    "automatic dispatch",
    "auto dispatch",
    "commit/push automation",
    "commit push automation",
    "w7-g authorized",
    "w7-g is authorized",
    "semantic non-leakage proven",
    "mathematical semantic non-leakage proof",
    "mathematically proven semantic non-leakage",
)

REQUIRED_TEXT_FIELDS = (
    "evidence_id",
    "source_epic",
    "dimension",
    "dimension_verdict",
    "summary",
    "claim_boundary",
    "privacy_classification",
)


class W7UsefulnessEvaluationError(ValueError):
    pass


def evaluate_w7_usefulness(
    seed_rows: Iterable[Mapping[str, Any]],
    *,
    residual_semantic_non_leakage_risk_status: str,
    w7_g_recommendation: str = "defer_to_meta",
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    _validate_residual_risk_status(residual_semantic_non_leakage_risk_status)
    if w7_g_recommendation not in ALLOWED_W7_G_RECOMMENDATIONS:
        raise W7UsefulnessEvaluationError("w7_g_recommendation is not supported for W7-F.")

    rows = [_validate_seed_row(row) for row in seed_rows]
    if not rows:
        raise W7UsefulnessEvaluationError("At least one W7 usefulness seed row is required.")
    _reject_duplicate_evidence_ids(rows)

    summary = _build_summary(
        rows=rows,
        residual_semantic_non_leakage_risk_status=residual_semantic_non_leakage_risk_status,
        w7_g_recommendation=w7_g_recommendation,
    )
    if output_dir is not None:
        output_path = Path(output_dir)
        _validate_private_output_dir(output_path)
        _write_outputs(rows=rows, summary=summary, output_dir=output_path)
    return summary


def _validate_residual_risk_status(value: str) -> None:
    if value not in ALLOWED_RESIDUAL_RISK_STATUSES:
        raise W7UsefulnessEvaluationError(
            "residual_semantic_non_leakage_risk_status must be one of: "
            f"{', '.join(sorted(ALLOWED_RESIDUAL_RISK_STATUSES))}"
        )


def _validate_seed_row(seed_row: Mapping[str, Any]) -> dict[str, Any]:
    row = dict(seed_row)
    errors: list[str] = []

    if _contains_mapping_key(row, "no_claims"):
        errors.append("seed rows must not supply no_claims")

    if row.get("schema_version") != W7_USEFULNESS_SEED_ROW_SCHEMA_VERSION:
        errors.append("schema_version must be w7.usefulness_seed_row.v1")
    for field in REQUIRED_TEXT_FIELDS:
        if not isinstance(row.get(field), str) or not row[field].strip():
            errors.append(f"{field} must be a non-empty string")
        elif row[field] != row[field].strip():
            errors.append(f"{field} must not contain leading or trailing whitespace")

    if row.get("dimension") not in ALLOWED_DIMENSIONS:
        errors.append("dimension is not supported for W7-F")
    else:
        expected_source_epic = REQUIRED_SOURCE_EPIC_BY_DIMENSION[str(row["dimension"])]
        if row.get("source_epic") != expected_source_epic:
            errors.append(
                "source_epic must match dimension mapping: "
                f"dimension={row.get('dimension')} source_epic={row.get('source_epic')} expected={expected_source_epic}"
            )
    if row.get("dimension_verdict") not in ALLOWED_DIMENSION_VERDICTS:
        errors.append("dimension_verdict must be pass, weak, or fail")
    if row.get("claim_boundary") != W7_USEFULNESS_SEED_CLAIM_BOUNDARY:
        errors.append("claim_boundary must remain W7-F seed-only private evidence")
    if row.get("privacy_classification") != PRIVATE_RAW:
        errors.append("privacy_classification must be private_raw")
    if row.get("public_safe") is not False:
        errors.append("public_safe is required and must be exactly False")

    evidence_refs = row.get("evidence_refs")
    if not isinstance(evidence_refs, list) or not evidence_refs:
        errors.append("evidence_refs must be a non-empty list")
    elif any(not isinstance(item, str) or not item.strip() for item in evidence_refs):
        errors.append("evidence_refs must contain non-empty strings")
    elif any(item != item.strip() for item in evidence_refs):
        errors.append("evidence_refs must not contain leading or trailing whitespace")
    elif row.get("dimension") in REQUIRED_EVIDENCE_REF_MARKERS_BY_DIMENSION:
        expected_markers = REQUIRED_EVIDENCE_REF_MARKERS_BY_DIMENSION[str(row["dimension"])]
        actual_refs = set(evidence_refs)
        invalid_refs = actual_refs - expected_markers
        if invalid_refs:
            errors.append(
                "invalid evidence_refs: "
                f"dimension={row.get('dimension')} invalid_refs={sorted(invalid_refs)} "
                f"expected={sorted(expected_markers)}"
            )

    forbidden_claims = row.get("forbidden_claims", [])
    if not isinstance(forbidden_claims, list) or any(not isinstance(item, str) for item in forbidden_claims):
        errors.append("forbidden_claims must be a list of strings when present")
    elif forbidden_claims:
        errors.append("W7-F seed rows must not contain forbidden claims")

    found_forbidden_claims = _find_forbidden_claims(row)
    if found_forbidden_claims:
        errors.append(f"forbidden claim text present: {', '.join(found_forbidden_claims)}")

    if errors:
        evidence_id = row.get("evidence_id", "<unknown>")
        raise W7UsefulnessEvaluationError(f"Invalid W7 usefulness row {evidence_id}: {'; '.join(errors)}")
    return row


def _find_forbidden_claims(row: Mapping[str, Any]) -> list[str]:
    text = "\n".join(_iter_string_values(row)).lower()
    found: list[str] = []
    for marker in FORBIDDEN_CLAIM_MARKERS:
        if marker in text:
            found.append(marker)
    found.extend(_find_forbidden_claim_families(text))
    return sorted(set(found))


def _find_forbidden_claim_families(text: str) -> list[str]:
    words = _word_set(text)
    found: list[str] = []
    approval_words = {"approved", "approval", "authorized", "authorize", "granted", "allowed"}
    if {"public", "release"}.issubset(words) and words & approval_words:
        found.append("public release approval")
    if {"public", "export"}.issubset(words) and words & approval_words:
        found.append("public export approval")
    if (("w7" in words and "g" in words) or "w7g" in words) and (words & approval_words or "implementation" in words):
        found.append("w7-g authorization")
    if ({"bridge", "api", "session"} & words) and (words & approval_words or "delivery" in words):
        found.append("bridge/api/session permission")
    if ({"dispatch", "commit", "push"} & words) and (words & approval_words or "automation" in words or "automatic" in words):
        found.append("dispatch/commit/push automation")
    if {"semantic", "non", "leakage"}.issubset(words) and ({"proof", "proven", "mathematical"} & words):
        found.append("semantic non-leakage proof")
    return found


def _word_set(text: str) -> set[str]:
    normalized = "".join(character.lower() if character.isalnum() else " " for character in text)
    return {word for word in normalized.split() if word}


def _iter_string_values(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
        return
    if isinstance(value, Mapping):
        for nested in value.values():
            yield from _iter_string_values(nested)
        return
    if isinstance(value, list):
        for nested in value:
            yield from _iter_string_values(nested)


def _contains_mapping_key(value: Any, target_key: str) -> bool:
    if isinstance(value, Mapping):
        if any(key == target_key for key in value):
            return True
        return any(_contains_mapping_key(nested, target_key) for nested in value.values())
    if isinstance(value, list):
        return any(_contains_mapping_key(nested, target_key) for nested in value)
    return False


def _reject_duplicate_evidence_ids(rows: Sequence[Mapping[str, Any]]) -> None:
    seen: set[str] = set()
    duplicates: list[str] = []
    for row in rows:
        evidence_id = str(row["evidence_id"])
        if evidence_id in seen:
            duplicates.append(evidence_id)
        seen.add(evidence_id)
    if duplicates:
        raise W7UsefulnessEvaluationError(
            f"Duplicate W7 evidence_id values are not allowed: {', '.join(duplicates)}"
        )


def _build_summary(
    *,
    rows: Sequence[Mapping[str, Any]],
    residual_semantic_non_leakage_risk_status: str,
    w7_g_recommendation: str,
) -> dict[str, Any]:
    dimensions = _dimension_verdicts(rows)
    missing_dimensions = [dimension for dimension in REQUIRED_DIMENSIONS if dimension not in dimensions]
    weak_dimensions = sorted(dimension for dimension, verdict in dimensions.items() if verdict == "weak")
    failed_dimensions = sorted(dimension for dimension, verdict in dimensions.items() if verdict == "fail")
    recommendation = _recommendation_for(
        missing_dimensions=missing_dimensions,
        weak_dimensions=weak_dimensions,
        failed_dimensions=failed_dimensions,
        residual_semantic_non_leakage_risk_status=residual_semantic_non_leakage_risk_status,
    )
    usefulness_verdict = _usefulness_verdict_for(
        missing_dimensions=missing_dimensions,
        weak_dimensions=weak_dimensions,
        failed_dimensions=failed_dimensions,
    )
    return {
        "schema_version": W7_USEFULNESS_EVALUATION_SCHEMA_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "review_verdict": _review_verdict_for(usefulness_verdict),
        "usefulness_verdict": usefulness_verdict,
        "recommendation": recommendation,
        "manual_bookkeeping_verdict": dimensions.get("manual_bookkeeping", "missing"),
        "audit_replay_verdict": dimensions.get("audit_replay", "missing"),
        "learning_input_trust_verdict": dimensions.get("learning_input_trust", "missing"),
        "residual_semantic_non_leakage_risk_status": residual_semantic_non_leakage_risk_status,
        "w7_g_recommendation": w7_g_recommendation,
        "w8_gate_recommendation": _w8_gate_recommendation_for(recommendation),
        "no_claims": {
            "public_release": False,
            "bridge_api_session_delivery": False,
            "dispatch_commit_push_automation": False,
            "w7_g_authorized": False,
            "semantic_non_leakage_proven": False,
        },
        "input_evidence_ids": [str(row["evidence_id"]) for row in rows],
        "source_epics": sorted({str(row["source_epic"]) for row in rows}),
        "missing_dimensions": missing_dimensions,
        "weak_dimensions": weak_dimensions,
        "failed_dimensions": failed_dimensions,
        "evidence_refs": sorted({ref for row in rows for ref in row["evidence_refs"]}),
        "privacy_classification": PRIVATE_RAW,
        "public_safe": False,
        "claim_boundary": W7_USEFULNESS_CLAIM_BOUNDARY,
        "known_limits": _known_limits_for(residual_semantic_non_leakage_risk_status),
    }


def _dimension_verdicts(rows: Sequence[Mapping[str, Any]]) -> dict[str, str]:
    ranked = {"fail": 0, "weak": 1, "pass": 2}
    verdicts: dict[str, str] = {}
    for row in rows:
        dimension = str(row["dimension"])
        verdict = str(row["dimension_verdict"])
        current = verdicts.get(dimension)
        if current is None or ranked[verdict] < ranked[current]:
            verdicts[dimension] = verdict
    return verdicts


def _recommendation_for(
    *,
    missing_dimensions: Sequence[str],
    weak_dimensions: Sequence[str],
    failed_dimensions: Sequence[str],
    residual_semantic_non_leakage_risk_status: str,
) -> str:
    if failed_dimensions:
        return "stop"
    if missing_dimensions:
        return "insufficient_evidence"
    if weak_dimensions:
        return "hold"
    if residual_semantic_non_leakage_risk_status == "already resolved":
        return "continue"
    return "narrow_continue"


def _usefulness_verdict_for(
    *,
    missing_dimensions: Sequence[str],
    weak_dimensions: Sequence[str],
    failed_dimensions: Sequence[str],
) -> str:
    if failed_dimensions:
        return "FAIL"
    if missing_dimensions:
        return "INSUFFICIENT_EVIDENCE"
    if weak_dimensions:
        return "PARTIAL"
    return "PASS"


def _review_verdict_for(usefulness_verdict: str) -> str:
    if usefulness_verdict == "PASS":
        return "APPROVE_WITH_RESIDUAL_RISK"
    if usefulness_verdict == "PARTIAL":
        return "HOLD_FOR_MORE_EVIDENCE"
    if usefulness_verdict == "INSUFFICIENT_EVIDENCE":
        return "INSUFFICIENT_EVIDENCE"
    return "REJECT"


def _w8_gate_recommendation_for(recommendation: str) -> str:
    if recommendation in {"continue", "narrow_continue"}:
        return "meta_may_consider_docs_first_w8_after_w7_f_meta"
    if recommendation == "hold":
        return "keep_w8_blocked_pending_more_w7_evidence"
    return "keep_w8_blocked"


def _known_limits_for(residual_semantic_non_leakage_risk_status: str) -> list[str]:
    limits = [
        "W7-F prepares a Track E usefulness recommendation for Meta; it does not replace W7-F-META closeout.",
        "W7-G advisory suggestion semantics remain blocked until Meta explicitly opens them.",
        "Bridge/API/session delivery, automatic dispatch, commit/push automation, and public export remain unauthorized.",
    ]
    if residual_semantic_non_leakage_risk_status != "already resolved":
        limits.append(
            "W7-E2 de-identification evidence is structured/test-supported, not mathematical semantic non-leakage proof."
        )
    return limits


def _write_outputs(*, rows: Sequence[Mapping[str, Any]], summary: Mapping[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    _write_json(output_dir / "usefulness_summary.json", dict(summary))
    with (output_dir / "usefulness_rows.jsonl").open("w", encoding="utf-8") as file_handle:
        for row in rows:
            file_handle.write(json.dumps(_sanitized_row(row), sort_keys=True, ensure_ascii=True))
            file_handle.write("\n")


def _sanitized_row(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": W7_USEFULNESS_SEED_ROW_SCHEMA_VERSION,
        "evidence_id": row["evidence_id"],
        "source_epic": row["source_epic"],
        "dimension": row["dimension"],
        "dimension_verdict": row["dimension_verdict"],
        "evidence_refs": list(row["evidence_refs"]),
        "claim_boundary": row["claim_boundary"],
        "privacy_classification": row["privacy_classification"],
    }


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n", encoding="utf-8")


def _validate_private_output_dir(output_dir: Path) -> None:
    parts = {part.lower() for part in output_dir.parts}
    if "public" in parts or ("docs" in parts and "public" in parts):
        raise W7UsefulnessEvaluationError("W7-F output_dir must not point to a public output path.")
