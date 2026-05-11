from __future__ import annotations

import json
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from fractal_agent_lab.core.contracts.w6_ledger import W6LedgerDocument, ledger_entry_from_validated_packet
from fractal_agent_lab.core.contracts.w6_packet import (
    W6PacketDecision,
    W6PacketStage,
    W6PacketValidationResult,
    W6PrivacyClassification,
    validate_w6_packet,
)
from fractal_agent_lab.tracing.evidence_layout import (
    wave6_ledger_artifact_path,
    wave6_loop_dir_path,
    wave6_loops_dir_path,
    wave6_packet_artifact_path,
)

try:
    from fractal_agent_lab.core.contracts.w6_state_machine import validate_w6_packet_history as _validate_w6_packet_history
except ImportError:  # W6-C can record evidence before W6-B is present, but it cannot clean-pass it.
    _validate_w6_packet_history = None


W6_MANUAL_EVIDENCE_INPUT_SCHEMA_VERSION = "w6.manual_evidence_input.v1"
W6_REVIEW_FINDINGS_SCHEMA_VERSION = "w6.review_findings.v1"
W6_USEFULNESS_SEED_ROW_SCHEMA_VERSION = "w6.usefulness_seed_row.v1"

ALLOWED_COMPLEXITY_CLASSES = {"simple", "medium", "high", "shared_boundary", "governance_context_continuity"}
ALLOWED_FINAL_STATUSES = {"pass", "pass_with_warnings", "hold", "blocked"}
ALLOWED_FINDING_SEVERITIES = {"low", "medium", "high", "critical"}
ALLOWED_FINDING_STATUSES = {"accepted", "rejected", "fixed", "deferred"}
ALLOWED_MODES = {"manual_opencode", "command_assisted", "packet_assisted", "fal_evidence_backed"}
ALLOWED_NET_RECOMMENDATIONS = {
    "recommended",
    "optional",
    "not_worth_it",
    "dangerous",
    "insufficient_data",
}
NON_CLEAN_PACKET_DECISIONS = {
    W6PacketDecision.BLOCKED,
    W6PacketDecision.HOLD,
    W6PacketDecision.DEEP_REVIEW_NEEDED,
}


class W6ManualEvidenceRecorderError(ValueError):
    pass


@dataclass(slots=True)
class W6ManualEvidenceRecordResult:
    loop_id: str
    final_status: str
    validation_status: str
    clean_pass: bool
    warnings: list[str]
    output_paths: dict[str, str]
    packet_count: int
    ledger_entry_count: int
    review_findings_count: int
    missing_tests_count: int
    net_recommendation: str
    transition_validation: dict[str, Any]
    clean_pass_blockers: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": "w6.manual_evidence_record_result.v1",
            "recorded": True,
            "loop_id": self.loop_id,
            "final_status": self.final_status,
            "validation_status": self.validation_status,
            "clean_pass": self.clean_pass,
            "warnings": list(self.warnings),
            "output_paths": dict(self.output_paths),
            "packet_count": self.packet_count,
            "ledger_entry_count": self.ledger_entry_count,
            "review_findings_count": self.review_findings_count,
            "missing_tests_count": self.missing_tests_count,
            "net_recommendation": self.net_recommendation,
            "transition_validation": dict(self.transition_validation),
            "clean_pass_blockers": list(self.clean_pass_blockers),
        }


@dataclass(slots=True)
class _ValidatedRecorderInput:
    payload: dict[str, Any]
    packet_results: list[W6PacketValidationResult]
    review_findings: list[dict[str, Any]]
    missing_tests: list[str]
    warnings: list[str]
    transition_validation: dict[str, Any]
    clean_pass_blockers: list[str]


def load_and_record_w6_manual_evidence(*, input_path: str | Path, data_dir: str | Path = "data") -> dict[str, Any]:
    path = Path(input_path)
    with path.open("r", encoding="utf-8") as file_handle:
        payload = json.load(file_handle)
    if not isinstance(payload, dict):
        raise W6ManualEvidenceRecorderError("Recorder input must be a JSON object.")
    return record_w6_manual_evidence(payload, data_dir=data_dir).as_dict()


def record_w6_manual_evidence(
    recorder_input: Mapping[str, Any],
    *,
    data_dir: str | Path = "data",
) -> W6ManualEvidenceRecordResult:
    validated = _validate_recorder_input(recorder_input, data_dir=data_dir)
    payload = validated.payload
    loop_id = payload["loop_id"]
    final_loop_dir = wave6_loop_dir_path(loop_id=loop_id, data_dir=data_dir)
    if final_loop_dir.exists():
        raise W6ManualEvidenceRecorderError(f"Wave 6 evidence loop already exists: {final_loop_dir.as_posix()}")

    loops_dir = wave6_loops_dir_path(data_dir=data_dir)
    loops_dir.mkdir(parents=True, exist_ok=True)
    staging_dir = Path(tempfile.mkdtemp(prefix=f".{loop_id}.", suffix=".staging", dir=loops_dir))
    try:
        output_paths = _write_staged_loop_evidence(
            staging_dir=staging_dir,
            final_loop_dir=final_loop_dir,
            payload=payload,
            packet_results=validated.packet_results,
            review_findings=validated.review_findings,
            missing_tests=validated.missing_tests,
            warnings=validated.warnings,
            transition_validation=validated.transition_validation,
            clean_pass_blockers=validated.clean_pass_blockers,
            data_dir=data_dir,
        )
        staging_dir.rename(final_loop_dir)
    except Exception:
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise

    return _build_record_result(
        payload=payload,
        packet_results=validated.packet_results,
        review_findings=validated.review_findings,
        missing_tests=validated.missing_tests,
        warnings=validated.warnings,
        output_paths=output_paths,
        transition_validation=validated.transition_validation,
        clean_pass_blockers=validated.clean_pass_blockers,
    )


def _validate_recorder_input(recorder_input: Mapping[str, Any], *, data_dir: str | Path) -> _ValidatedRecorderInput:
    errors: list[str] = []
    warnings: list[str] = []
    payload = dict(recorder_input)

    _require_exact_text(payload, "schema_version", W6_MANUAL_EVIDENCE_INPUT_SCHEMA_VERSION, errors)
    loop_id = _require_text(payload, "loop_id", errors)
    sequence_ref = _require_text(payload, "sequence_ref", errors)
    _require_text(payload, "target_repo", errors)
    _require_text(payload, "task_type", errors)
    _require_enum(payload, "complexity_class", ALLOWED_COMPLEXITY_CLASSES, errors)
    _require_enum(payload, "mode", ALLOWED_MODES, errors)
    _require_enum(payload, "final_status", ALLOWED_FINAL_STATUSES, errors)
    _require_enum(payload, "net_recommendation", ALLOWED_NET_RECOMMENDATIONS, errors)
    manual_copy_paste_steps = _require_non_negative_int(payload, "manual_copy_paste_steps", errors)
    copy_paste_avoided_count = _require_non_negative_int(payload, "copy_paste_avoided_count", errors)
    operator_interruptions_required = _require_non_negative_int(payload, "operator_interruptions_required", errors)

    packets = payload.get("packets")
    packet_results: list[W6PacketValidationResult] = []
    packet_ids: set[str] = set()
    if not isinstance(packets, list) or not packets:
        errors.append("Recorder input field 'packets' must be a non-empty list.")
    else:
        for index, packet_payload in enumerate(packets, start=1):
            if not isinstance(packet_payload, Mapping):
                errors.append(f"Recorder packet #{index} must be an object.")
                continue
            validation = validate_w6_packet(packet_payload)
            if not validation.passed or validation.packet is None:
                errors.extend(f"packet #{index}: {error}" for error in validation.errors)
                continue
            packet = validation.packet
            if loop_id and packet.loop_id != loop_id:
                errors.append(f"Recorder packet #{index} has loop_id '{packet.loop_id}' but expected '{loop_id}'.")
            if sequence_ref and packet.sequence_ref != sequence_ref:
                warnings.append(
                    f"Recorder packet #{index} sequence_ref '{packet.sequence_ref}' differs from recorder sequence_ref '{sequence_ref}'.",
                )
            if packet.packet_id in packet_ids:
                errors.append(f"Recorder packet_id '{packet.packet_id}' appears more than once.")
            packet_ids.add(packet.packet_id)
            if packet.privacy_classification == W6PrivacyClassification.SANITIZED_PUBLIC:
                errors.append("Recorder packets must not default to or claim sanitized_public privacy in W6-C.")
            packet_results.append(validation)

    review_findings = _validate_review_findings(payload.get("review_findings"), errors)
    missing_tests = _validate_string_list(payload.get("missing_tests_or_skipped_checks"), "missing_tests_or_skipped_checks", errors)
    transition_validation = payload.get("transition_validation")
    if transition_validation is not None and not isinstance(transition_validation, Mapping):
        errors.append("Recorder field 'transition_validation' must be an object when present.")

    if payload.get("public_safe") is True:
        errors.append("W6-C recorder output is private_raw by default and must not claim public_safe.")
    if manual_copy_paste_steps is not None and copy_paste_avoided_count is not None:
        if copy_paste_avoided_count > manual_copy_paste_steps:
            warnings.append("copy_paste_avoided_count is greater than manual_copy_paste_steps; preserving operator-provided counts.")
    if operator_interruptions_required is not None and operator_interruptions_required > 0:
        warnings.append("Operator interruptions were required; final summary must not be treated as clean automation.")

    if loop_id:
        # Path helper validation is intentionally part of preflight so unsafe IDs fail before writes.
        try:
            _ = wave6_loop_dir_path(loop_id=loop_id, data_dir=data_dir)
        except ValueError as exc:
            errors.append(str(exc))

    if errors:
        raise W6ManualEvidenceRecorderError(" ".join(errors))

    computed_transition_validation = _compute_transition_validation(packet_results, payload.get("transition_validation"))
    clean_pass_blockers = _clean_pass_blockers(
        payload=payload,
        packet_results=packet_results,
        missing_tests=missing_tests,
        warnings=warnings,
        transition_validation=computed_transition_validation,
    )

    return _ValidatedRecorderInput(
        payload=payload,
        packet_results=packet_results,
        review_findings=review_findings,
        missing_tests=missing_tests,
        warnings=warnings,
        transition_validation=computed_transition_validation,
        clean_pass_blockers=clean_pass_blockers,
    )


def _write_staged_loop_evidence(
    *,
    staging_dir: Path,
    final_loop_dir: Path,
    payload: dict[str, Any],
    packet_results: list[W6PacketValidationResult],
    review_findings: list[dict[str, Any]],
    missing_tests: list[str],
    warnings: list[str],
    transition_validation: dict[str, Any],
    clean_pass_blockers: list[str],
    data_dir: str | Path,
) -> dict[str, str]:
    loop_id = payload["loop_id"]
    packet_dir = staging_dir / "packets"
    packet_dir.mkdir(parents=True, exist_ok=False)

    for validation in packet_results:
        assert validation.packet is not None
        final_packet_path = wave6_packet_artifact_path(
            loop_id=loop_id,
            packet_id=validation.packet.packet_id,
            data_dir=data_dir,
        )
        packet_path = packet_dir / final_packet_path.name
        packet_payload = validation.packet.as_dict()
        packet_payload["recorder_validation"] = {
            "validation_status": validation.validation_status.value,
            "warnings": list(validation.warnings),
        }
        _write_json(packet_path, packet_payload)

    ledger_entries = []
    finding_counts = _finding_counts(review_findings)
    for validation in packet_results:
        assert validation.packet is not None
        packet_payload = validation.packet.payload
        entry = ledger_entry_from_validated_packet(
            validation,
            changed_files=_list_from_payload(packet_payload, "changed_files"),
            tests_run=_list_from_payload(packet_payload, "tests_checks_run"),
            missing_tests=_packet_missing_tests(packet_payload, missing_tests),
        )
        if validation.packet.stage == W6PacketStage.STEP_REVIEW_DONE:
            entry.findings_count = finding_counts["total"]
            entry.accepted_findings_count = finding_counts["accepted"] + finding_counts["fixed"]
            entry.rejected_findings_count = finding_counts["rejected"]
        entry.manual_intervention_count = payload["operator_interruptions_required"]
        entry.copy_paste_avoided_count = payload["copy_paste_avoided_count"]
        ledger_entries.append(entry)

    ledger = W6LedgerDocument(loop_id=loop_id, entries=ledger_entries)
    ledger_path = staging_dir / "ledger.json"
    _write_json(ledger_path, ledger.as_dict())

    review_findings_path = staging_dir / "review_findings.json"
    _write_json(
        review_findings_path,
        {
            "schema_version": W6_REVIEW_FINDINGS_SCHEMA_VERSION,
            "loop_id": loop_id,
            "findings": review_findings,
            "summary": finding_counts,
        },
    )

    usefulness_row = _build_usefulness_row(
        payload,
        review_findings,
        missing_tests,
        packet_results,
        warnings,
        transition_validation,
        clean_pass_blockers,
    )
    usefulness_path = staging_dir / "usefulness_row.json"
    _write_json(usefulness_path, usefulness_row)

    summary_path = staging_dir / "summary.md"
    summary_path.write_text(_build_summary_markdown(payload, usefulness_row, finding_counts), encoding="utf-8")

    return {
        "loop_dir": final_loop_dir.as_posix(),
        "packet_dir": (final_loop_dir / "packets").as_posix(),
        "ledger": wave6_ledger_artifact_path(loop_id=loop_id, data_dir=data_dir).as_posix(),
        "review_findings": (final_loop_dir / "review_findings.json").as_posix(),
        "usefulness_row": (final_loop_dir / "usefulness_row.json").as_posix(),
        "summary_md": (final_loop_dir / "summary.md").as_posix(),
    }


def _build_record_result(
    *,
    payload: dict[str, Any],
    packet_results: list[W6PacketValidationResult],
    review_findings: list[dict[str, Any]],
    missing_tests: list[str],
    warnings: list[str],
    output_paths: dict[str, str],
    transition_validation: dict[str, Any],
    clean_pass_blockers: list[str],
) -> W6ManualEvidenceRecordResult:
    packet_warnings = [warning for result in packet_results for warning in result.warnings]
    all_warnings = list(warnings) + packet_warnings
    validation_status = "warning" if all_warnings or missing_tests or clean_pass_blockers else "pass"
    final_status = payload["final_status"]
    clean_pass = final_status == "pass" and validation_status == "pass" and not clean_pass_blockers
    return W6ManualEvidenceRecordResult(
        loop_id=payload["loop_id"],
        final_status=final_status,
        validation_status=validation_status,
        clean_pass=clean_pass,
        warnings=all_warnings,
        output_paths=output_paths,
        packet_count=len(packet_results),
        ledger_entry_count=len(packet_results),
        review_findings_count=len(review_findings),
        missing_tests_count=len(missing_tests),
        net_recommendation=payload["net_recommendation"],
        transition_validation=transition_validation,
        clean_pass_blockers=clean_pass_blockers,
    )


def _build_usefulness_row(
    payload: dict[str, Any],
    review_findings: list[dict[str, Any]],
    missing_tests: list[str],
    packet_results: list[W6PacketValidationResult],
    warnings: list[str],
    transition_validation: dict[str, Any],
    clean_pass_blockers: list[str],
) -> dict[str, Any]:
    counts = _finding_counts(review_findings)
    packet_warnings = [warning for result in packet_results for warning in result.warnings]
    return {
        "schema_version": W6_USEFULNESS_SEED_ROW_SCHEMA_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "loop_id": payload["loop_id"],
        "target_repo": payload["target_repo"],
        "sequence_ref": payload["sequence_ref"],
        "task_type": payload["task_type"],
        "complexity_class": payload["complexity_class"],
        "mode": payload["mode"],
        "manual_copy_paste_steps": payload["manual_copy_paste_steps"],
        "copy_paste_avoided_count": payload["copy_paste_avoided_count"],
        "operator_interruptions_required": payload["operator_interruptions_required"],
        "missing_tests_count": len(missing_tests),
        "real_issues_caught_count": counts["accepted"] + counts["fixed"],
        "false_positive_findings_count": counts["rejected"],
        "review_findings_count": counts["total"],
        "packet_validation_warning_count": len(packet_warnings),
        "recorder_warning_count": len(warnings),
        "operator_transition_validation": dict(payload.get("transition_validation") or {}),
        "transition_validation": dict(transition_validation),
        "clean_pass_blockers": list(clean_pass_blockers),
        "final_status": payload["final_status"],
        "net_recommendation": payload["net_recommendation"],
        "claim_boundary": "single_loop_seed_row_only_not_broad_usefulness_claim",
        "privacy_classification": W6PrivacyClassification.PRIVATE_RAW.value,
    }


def _build_summary_markdown(payload: dict[str, Any], usefulness_row: dict[str, Any], finding_counts: dict[str, int]) -> str:
    lines = [
        f"# Wave 6 Manual Evidence Loop {payload['loop_id']}",
        "",
        "## Status",
        "",
        f"- final_status: `{payload['final_status']}`",
        f"- clean_pass: `{not usefulness_row['clean_pass_blockers'] and payload['final_status'] == 'pass'}`",
        f"- net_recommendation: `{payload['net_recommendation']}`",
        f"- transition_validation_source: `{usefulness_row['transition_validation']['source']}`",
        f"- transition_validation_status: `{usefulness_row['transition_validation']['status']}`",
        "- privacy_classification: `private_raw`",
        "- claim_boundary: `single_loop_seed_row_only_not_broad_usefulness_claim`",
        "",
        "## Scope",
        "",
        f"- target_repo: `{payload['target_repo']}`",
        f"- sequence_ref: `{payload['sequence_ref']}`",
        f"- task_type: `{payload['task_type']}`",
        f"- complexity_class: `{payload['complexity_class']}`",
        f"- mode: `{payload['mode']}`",
        "",
        "## Evidence Counts",
        "",
        f"- review_findings: {finding_counts['total']}",
        f"- accepted_findings: {finding_counts['accepted']}",
        f"- fixed_findings: {finding_counts['fixed']}",
        f"- rejected_findings: {finding_counts['rejected']}",
        f"- deferred_findings: {finding_counts['deferred']}",
        f"- missing_tests_count: {usefulness_row['missing_tests_count']}",
        f"- packet_validation_warning_count: {usefulness_row['packet_validation_warning_count']}",
        f"- clean_pass_blockers: {len(usefulness_row['clean_pass_blockers'])}",
        "",
        "## Clean Pass Blockers",
        "",
        *(f"- `{blocker}`" for blocker in usefulness_row["clean_pass_blockers"]),
        "",
        "## Boundary",
        "",
        "This is private raw Wave 6 evidence. It does not make a public case-study claim,",
        "does not execute OpenCode delivery, and does not prove broad workflow usefulness by itself.",
        "",
    ]
    return "\n".join(lines)


def _compute_transition_validation(
    packet_results: list[W6PacketValidationResult],
    operator_transition_validation: Any,
) -> dict[str, Any]:
    operator_evidence = dict(operator_transition_validation) if isinstance(operator_transition_validation, Mapping) else {}
    if _validate_w6_packet_history is None:
        return {
            "source": "unavailable",
            "status": "unavailable",
            "passed": False,
            "closed": False,
            "commit_ready_candidate": False,
            "errors": ["W6-B transition validator is unavailable."],
            "warnings": [],
            "operator_evidence": operator_evidence,
        }

    result = _validate_w6_packet_history(packet_results)
    status = "pass" if result.passed and not result.warnings else ("warning" if result.passed else "fail")
    return {
        "source": "computed_w6_b",
        "status": status,
        "passed": result.passed,
        "closed": result.closed,
        "commit_ready_candidate": result.commit_ready_candidate,
        "final_state": result.final_state.value if result.final_state else None,
        "errors": list(result.errors),
        "warnings": list(result.warnings),
        "operator_evidence": operator_evidence,
    }


def _clean_pass_blockers(
    *,
    payload: dict[str, Any],
    packet_results: list[W6PacketValidationResult],
    missing_tests: list[str],
    warnings: list[str],
    transition_validation: dict[str, Any],
) -> list[str]:
    blockers: list[str] = []
    if payload["final_status"] != "pass":
        blockers.append(f"final_status_not_pass:{payload['final_status']}")
    if missing_tests:
        blockers.append("missing_or_skipped_tests_present")
    if warnings:
        blockers.append("recorder_warnings_present")
    for validation in packet_results:
        if validation.warnings:
            blockers.append("packet_validation_warnings_present")
        if validation.packet and validation.packet.decision in NON_CLEAN_PACKET_DECISIONS:
            blockers.append(f"non_clean_packet_decision:{validation.packet.decision.value}")
    if transition_validation.get("source") != "computed_w6_b":
        blockers.append("w6_b_transition_validation_unavailable")
    elif transition_validation.get("status") != "pass":
        blockers.append(f"w6_b_transition_validation_not_pass:{transition_validation.get('status')}")
    elif not transition_validation.get("commit_ready_candidate"):
        blockers.append("w6_b_transition_not_commit_ready_candidate")
    elif not transition_validation.get("closed"):
        blockers.append("w6_b_transition_not_closed")
    return list(dict.fromkeys(blockers))


def _validate_review_findings(value: Any, errors: list[str]) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        errors.append("Recorder input field 'review_findings' must be a list.")
        return []
    findings: list[dict[str, Any]] = []
    for index, item in enumerate(value, start=1):
        if not isinstance(item, Mapping):
            errors.append(f"Review finding #{index} must be an object.")
            continue
        finding = dict(item)
        severity = finding.get("severity")
        status = finding.get("status")
        summary = finding.get("summary")
        if severity not in ALLOWED_FINDING_SEVERITIES:
            errors.append(f"Review finding #{index} has invalid severity {severity!r}.")
        if status not in ALLOWED_FINDING_STATUSES:
            errors.append(f"Review finding #{index} has invalid status {status!r}.")
        if not isinstance(summary, str) or not summary.strip():
            errors.append(f"Review finding #{index} missing non-empty summary.")
        finding.setdefault("fix_required", status in {"accepted", "fixed"})
        finding.setdefault("evidence", "not_provided")
        finding.setdefault("source_stage", "unknown")
        findings.append(finding)
    return findings


def _finding_counts(review_findings: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "total": len(review_findings),
        "accepted": sum(1 for finding in review_findings if finding.get("status") == "accepted"),
        "rejected": sum(1 for finding in review_findings if finding.get("status") == "rejected"),
        "fixed": sum(1 for finding in review_findings if finding.get("status") == "fixed"),
        "deferred": sum(1 for finding in review_findings if finding.get("status") == "deferred"),
        "fixes_required": sum(1 for finding in review_findings if bool(finding.get("fix_required"))),
    }


def _packet_missing_tests(packet_payload: Mapping[str, Any], loop_missing_tests: list[str]) -> list[str]:
    packet_missing = _list_from_payload(packet_payload, "missing_tests_or_skipped_checks")
    step_review_missing = _list_from_payload(packet_payload, "missing_tests")
    merged = list(dict.fromkeys(packet_missing + step_review_missing + loop_missing_tests))
    return merged


def _list_from_payload(packet_payload: Mapping[str, Any], key: str) -> list[str]:
    value = packet_payload.get(key)
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _validate_string_list(value: Any, field_name: str, errors: list[str]) -> list[str]:
    if not isinstance(value, list):
        errors.append(f"Recorder input field '{field_name}' must be a list.")
        return []
    strings: list[str] = []
    for index, item in enumerate(value, start=1):
        if not isinstance(item, str) or not item.strip():
            errors.append(f"Recorder input field '{field_name}' item #{index} must be a non-empty string.")
            continue
        strings.append(item.strip())
    return strings


def _require_exact_text(payload: Mapping[str, Any], field_name: str, expected: str, errors: list[str]) -> None:
    value = payload.get(field_name)
    if value != expected:
        errors.append(f"Recorder input field '{field_name}' must be '{expected}'.")


def _require_text(payload: Mapping[str, Any], field_name: str, errors: list[str]) -> str | None:
    value = payload.get(field_name)
    if isinstance(value, str) and value.strip():
        return value.strip()
    errors.append(f"Recorder input missing non-empty '{field_name}'.")
    return None


def _require_enum(payload: Mapping[str, Any], field_name: str, allowed: set[str], errors: list[str]) -> str | None:
    value = payload.get(field_name)
    if isinstance(value, str) and value in allowed:
        return value
    errors.append(f"Recorder input field '{field_name}' must be one of: {', '.join(sorted(allowed))}.")
    return None


def _require_non_negative_int(payload: Mapping[str, Any], field_name: str, errors: list[str]) -> int | None:
    value = payload.get(field_name)
    if isinstance(value, int) and value >= 0:
        return value
    errors.append(f"Recorder input field '{field_name}' must be a non-negative integer.")
    return None


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
