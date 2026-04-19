from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id
from fractal_agent_lab.evals.artifact_replay import replay_run_artifacts_by_id
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path

H4_SEQ_NEXT_WORKFLOW_ID = "h4.seq_next.v1"
H4_WAVE_START_WORKFLOW_ID = "h4.wave_start.v1"

FRONTMATTER_REQUIRED_FIELDS: tuple[str, ...] = (
    "artifact_type",
    "artifact_version",
    "run_id",
    "workflow_id",
    "workflow_variant",
    "generated_at",
)

CONTEXT_REPORT_REQUIRED_FIELDS: tuple[str, ...] = (
    "artifact_type",
    "artifact_version",
    "run_id",
    "workflow_id",
    "workflow_variant",
    "generated_at",
    "repo_summary",
    "changed_surfaces",
    "relevant_docs",
    "relevant_code_areas",
    "likely_touched_files",
    "assumptions",
    "unknowns",
    "recent_change_notes",
    "current_frontier",
    "blockers_or_holds",
    "shared_zone_cautions",
    "sequencing_risks",
    "non_goals",
    "next_recommended_action",
)

CONTEXT_REPORT_REQUIRED_TEXT_FIELDS: tuple[str, ...] = (
    "repo_summary",
    "current_frontier",
    "next_recommended_action",
)

CONTEXT_REPORT_REQUIRED_NON_EMPTY_LIST_FIELDS: tuple[str, ...] = (
    "changed_surfaces",
    "relevant_docs",
    "relevant_code_areas",
    "likely_touched_files",
    "assumptions",
    "unknowns",
    "recent_change_notes",
)

CONTEXT_REPORT_REQUIRED_LIST_FIELDS: tuple[str, ...] = (
    "blockers_or_holds",
    "shared_zone_cautions",
    "sequencing_risks",
    "non_goals",
)

IMPLEMENTATION_PLAN_REQUIRED_SECTIONS: tuple[str, ...] = (
    "Task Summary",
    "Intent",
    "Current Repo Context",
    "Affected Surfaces",
    "Likely Touched Files",
    "Step Order",
    "Dependencies",
    "Test Plan",
    "Documentation Obligations",
    "Risks",
    "Open Questions",
    "Shared-Zone Cautions",
    "Sequencing Risks",
    "Functional Checks",
    "Tests Required",
    "Docs Required",
    "Blocking Conditions",
    "Non-Goals",
)

ACCEPTANCE_CHECKS_REQUIRED_FIELDS: tuple[str, ...] = (
    "artifact_type",
    "artifact_version",
    "run_id",
    "workflow_id",
    "workflow_variant",
    "generated_at",
    "functional_checks",
    "tests_required",
    "docs_required",
    "non_goals",
    "blocking_conditions",
)

WAVE_START_PACKET_REQUIRED_FIELDS: tuple[str, ...] = (
    "packet_type",
    "packet_version",
    "role",
    "source_ref",
    "frontier_ref",
    "execution_mode",
    "visibility_audit_state",
    "status",
    "generated_at",
    "content",
    "upstream",
)


def inspect_cv1_d_h4_usefulness(
    *,
    seq_next_run_id: str | None,
    baseline_plan_path: str | Path | None,
    comparison_task_intent: str | None,
    wave_start_run_id: str | None = None,
    data_dir: str | Path = "data",
    execution_mode: str = "manual_policy_driven",
    visibility_audit_state: str = (
        "git-visible coordination/code surfaces plus local data artifacts consulted; "
        "canonical run/trace and H4 artifacts are primary truth, baseline is external/manual, "
        "and packet sidecars are additive-only evidence"
    ),
) -> dict[str, Any]:
    seq_next_lane = _build_seq_next_lane(
        seq_next_run_id=seq_next_run_id,
        baseline_plan_path=baseline_plan_path,
        comparison_task_intent=comparison_task_intent,
        data_dir=data_dir,
    )
    wave_start_lane = _build_wave_start_lane(
        wave_start_run_id=wave_start_run_id,
        data_dir=data_dir,
    )

    blocked_reason = _str_or_none(seq_next_lane.get("summary", {}).get("blocked_reason"))
    h4_usefulness_passed = bool(seq_next_lane.get("summary", {}).get("usefulness_demonstrated"))
    packet_legibility_demonstrated = bool(wave_start_lane.get("summary", {}).get("packet_legibility_demonstrated"))
    track_e_evidence_ready = bool(seq_next_lane.get("summary", {}).get("lane_ready"))

    eval_outcome = "PASS" if h4_usefulness_passed else ("BLOCKED" if blocked_reason else "FAIL")

    return {
        "report_version": "cv1_d.h4_usefulness_check.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "disclosure": {
            "execution_mode": execution_mode,
            "visibility_audit_state": visibility_audit_state,
            "comparison_task_intent": comparison_task_intent,
            "same_task_intent_asserted_by_operator": bool(_str_or_none(comparison_task_intent)),
            "baseline_is_external_manual": True,
            "packet_surfaces_additive_only": True,
        },
        "scope": {
            "workflow_family": "H4",
            "claim": "materially more inspectable and readiness-honest than an unstructured plan",
            "lanes": {
                "wave_start": "inspectability and transport legibility additive evidence",
                "seq_next": "planning usefulness and anti-false-ready checks",
            },
        },
        "seq_next_lane": seq_next_lane,
        "wave_start_lane": wave_start_lane,
        "summary": {
            "track_e_evidence_ready": track_e_evidence_ready,
            "h4_usefulness_passed": h4_usefulness_passed,
            "packet_legibility_demonstrated": packet_legibility_demonstrated,
            "eval_outcome": eval_outcome,
            "blocked_reason": blocked_reason,
        },
        "known_limits": [
            "This is a thin CV1-D usefulness check and not a broad H5 or autonomous coding claim.",
            "Baseline comparison relies on operator-asserted same task intent for matched-input discipline.",
            "Packet sidecars are additive evidence only and do not redefine canonical artifact law.",
        ],
    }


def _build_seq_next_lane(
    *,
    seq_next_run_id: str | None,
    baseline_plan_path: str | Path | None,
    comparison_task_intent: str | None,
    data_dir: str | Path,
) -> dict[str, Any]:
    blocked_reason = _blocked_reason_for_required_inputs(
        seq_next_run_id=seq_next_run_id,
        baseline_plan_path=baseline_plan_path,
        comparison_task_intent=comparison_task_intent,
    )
    if blocked_reason:
        return {
            "run_id": seq_next_run_id,
            "baseline_plan_path": _path_or_none(baseline_plan_path),
            "summary": {
                "lane_ready": False,
                "usefulness_demonstrated": False,
                "lane_outcome": "BLOCKED",
                "blocked_reason": blocked_reason,
            },
        }

    assert seq_next_run_id is not None
    assert baseline_plan_path is not None

    validation = validate_run_trace_by_run_id(seq_next_run_id, data_dir=data_dir)
    replay = replay_run_artifacts_by_id(seq_next_run_id, data_dir=data_dir)

    canonical_unavailable_reason = _canonical_unavailable_reason(validation=validation, replay=replay)
    if canonical_unavailable_reason:
        return {
            "run_id": seq_next_run_id,
            "run_artifact_path": validation.run_path.as_posix(),
            "trace_artifact_path": validation.trace_path.as_posix(),
            "baseline_plan_path": str(Path(baseline_plan_path).as_posix()),
            "artifact_validation": {
                "passed": validation.passed,
                "errors": list(validation.errors),
                "warnings": list(validation.warnings),
            },
            "replay_summary": {
                "replay_ready": bool(replay.get("replay_ready")),
                "run_summary": replay.get("run_summary", {}),
            },
            "summary": {
                "lane_ready": False,
                "usefulness_demonstrated": False,
                "lane_outcome": "BLOCKED",
                "blocked_reason": canonical_unavailable_reason,
            },
        }

    run_payload = validation.run_payload if isinstance(validation.run_payload, dict) else {}
    run_truth = {
        "workflow_id": _str_or_none(run_payload.get("workflow_id")),
        "run_status": _str_or_none(run_payload.get("status")),
        "schema_version": _str_or_none(run_payload.get("schema_version")),
    }
    run_succeeded = run_truth.get("run_status") == "succeeded"

    artifact_dir = run_artifact_dir_path(run_id=seq_next_run_id, data_dir=data_dir)
    plan_path = artifact_dir / "implementation_plan.md"
    acceptance_path = artifact_dir / "acceptance_checks.json"

    plan_check = _inspect_implementation_plan_artifact(
        path=plan_path,
        expected_run_id=seq_next_run_id,
        expected_workflow_variant=H4_SEQ_NEXT_WORKFLOW_ID,
    )
    acceptance_check = _inspect_acceptance_checks_artifact(
        path=acceptance_path,
        expected_run_id=seq_next_run_id,
        expected_workflow_variant=H4_SEQ_NEXT_WORKFLOW_ID,
    )
    structural_adequacy = bool(plan_check.get("complete") and acceptance_check.get("complete"))

    baseline_check = _inspect_baseline_plan(baseline_plan_path)
    if not baseline_check.get("present"):
        return {
            "run_id": seq_next_run_id,
            "run_artifact_path": validation.run_path.as_posix(),
            "trace_artifact_path": validation.trace_path.as_posix(),
            "baseline_plan_path": baseline_check.get("path"),
            "artifact_validation": {
                "passed": validation.passed,
                "errors": list(validation.errors),
                "warnings": list(validation.warnings),
            },
            "replay_summary": {
                "replay_ready": bool(replay.get("replay_ready")),
                "run_summary": replay.get("run_summary", {}),
            },
            "summary": {
                "lane_ready": False,
                "usefulness_demonstrated": False,
                "lane_outcome": "BLOCKED",
                "blocked_reason": "empty_baseline_plan",
            },
        }

    h4_dimensions = _build_h4_dimensions(
        run_truth=run_truth,
        plan_check=plan_check,
        acceptance_check=acceptance_check,
    )
    baseline_dimensions = _build_baseline_dimensions(baseline_check)
    comparison = _build_dimension_comparison(h4_dimensions=h4_dimensions, baseline_dimensions=baseline_dimensions)

    usefulness_demonstrated = bool(
        run_succeeded
        and
        structural_adequacy
        and comparison.get("h4_all_critical_dimensions_true")
        and comparison.get("baseline_not_better_on_any_dimension")
        and int(comparison.get("h4_stronger_dimension_count", 0)) >= 2
    )

    lane_outcome = "PASS" if usefulness_demonstrated else "FAIL"
    return {
        "run_id": seq_next_run_id,
        "run_artifact_path": validation.run_path.as_posix(),
        "trace_artifact_path": validation.trace_path.as_posix(),
        "baseline_plan_path": baseline_check.get("path"),
        "run_truth": run_truth,
        "artifact_validation": {
            "passed": validation.passed,
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        },
        "replay_summary": {
            "replay_ready": bool(replay.get("replay_ready")),
            "run_summary": replay.get("run_summary", {}),
            "failure_summary": replay.get("failure_summary", {}),
        },
        "canonical_artifact_checks": {
            "implementation_plan": plan_check,
            "acceptance_checks": acceptance_check,
            "structural_adequacy": structural_adequacy,
            "run_succeeded": run_succeeded,
        },
        "comparison": {
            "h4_dimensions": h4_dimensions,
            "baseline_dimensions": baseline_dimensions,
            "dimension_comparison": comparison,
            "baseline_excerpt": baseline_check.get("excerpt"),
        },
        "summary": {
            "lane_ready": True,
            "usefulness_demonstrated": usefulness_demonstrated,
            "lane_outcome": lane_outcome,
            "blocked_reason": None,
        },
    }


def _build_wave_start_lane(*, wave_start_run_id: str | None, data_dir: str | Path) -> dict[str, Any]:
    if _str_or_none(wave_start_run_id) is None:
        return {
            "run_id": None,
            "summary": {
                "lane_ready": False,
                "packet_legibility_demonstrated": False,
                "lane_outcome": "NOT_DEMONSTRATED",
                "reason": "wave_start_run_not_provided",
            },
        }

    assert wave_start_run_id is not None
    validation = validate_run_trace_by_run_id(wave_start_run_id, data_dir=data_dir)
    replay = replay_run_artifacts_by_id(wave_start_run_id, data_dir=data_dir)

    run_payload = validation.run_payload if isinstance(validation.run_payload, dict) else {}
    workflow_id = _str_or_none(run_payload.get("workflow_id"))
    artifact_dir = run_artifact_dir_path(run_id=wave_start_run_id, data_dir=data_dir)
    context_report_path = artifact_dir / "context_report.json"
    packet_json_path = artifact_dir / "packets" / "wave_start.packet.json"
    packet_md_path = artifact_dir / "packets" / "wave_start.packet.md"

    context_check = _inspect_context_report_artifact(
        path=context_report_path,
        expected_run_id=wave_start_run_id,
    )
    packet_json_check = _inspect_packet_json(path=packet_json_path)
    packet_markdown_check = _inspect_packet_markdown(path=packet_md_path)

    packet_legibility_demonstrated = bool(
        validation.passed
        and bool(replay.get("replay_ready"))
        and workflow_id == H4_WAVE_START_WORKFLOW_ID
        and context_check.get("complete")
        and packet_json_check.get("complete")
        and packet_markdown_check.get("complete")
    )

    if packet_legibility_demonstrated:
        lane_outcome = "PASS"
        reason = None
    else:
        lane_outcome = "NOT_DEMONSTRATED"
        reason = _first_non_empty(
            _packet_lane_reason(validation=validation, replay=replay, workflow_id=workflow_id),
            _str_or_none(context_check.get("reason")),
            _str_or_none(packet_json_check.get("reason")),
            _str_or_none(packet_markdown_check.get("reason")),
            "packet_legibility_not_demonstrated",
        )

    return {
        "run_id": wave_start_run_id,
        "run_artifact_path": validation.run_path.as_posix(),
        "trace_artifact_path": validation.trace_path.as_posix(),
        "artifact_validation": {
            "passed": validation.passed,
            "errors": list(validation.errors),
            "warnings": list(validation.warnings),
        },
        "replay_summary": {
            "replay_ready": bool(replay.get("replay_ready")),
            "run_summary": replay.get("run_summary", {}),
        },
        "canonical_artifact_check": context_check,
        "packet_checks": {
            "packet_json": packet_json_check,
            "packet_markdown": packet_markdown_check,
        },
        "summary": {
            "lane_ready": validation.passed and bool(replay.get("replay_ready")),
            "packet_legibility_demonstrated": packet_legibility_demonstrated,
            "lane_outcome": lane_outcome,
            "reason": reason,
        },
    }


def _blocked_reason_for_required_inputs(
    *,
    seq_next_run_id: str | None,
    baseline_plan_path: str | Path | None,
    comparison_task_intent: str | None,
) -> str | None:
    if _str_or_none(seq_next_run_id) is None:
        return "missing_seq_next_run"
    if baseline_plan_path is None:
        return "missing_baseline_plan"
    baseline_path = Path(baseline_plan_path)
    if not baseline_path.exists() or not baseline_path.is_file():
        return "missing_baseline_plan"
    try:
        if not baseline_path.read_text(encoding="utf-8").strip():
            return "empty_baseline_plan"
    except OSError:
        return "missing_baseline_plan"
    if _str_or_none(comparison_task_intent) is None:
        return "missing_comparison_task_intent"
    return None


def _canonical_unavailable_reason(*, validation: Any, replay: dict[str, Any]) -> str | None:
    replay_ready = bool(replay.get("replay_ready"))
    if validation.passed and replay_ready:
        return None

    missing_paths = [
        error
        for error in list(validation.errors)
        if error.startswith("Missing run artifact") or error.startswith("Missing trace artifact")
    ]
    if missing_paths:
        return "missing_canonical_run_trace_pair"
    if not replay_ready:
        return "seq_next_replay_not_ready"
    return "seq_next_canonical_evidence_unavailable"


def _inspect_implementation_plan_artifact(
    *,
    path: Path,
    expected_run_id: str,
    expected_workflow_variant: str,
) -> dict[str, Any]:
    if not path.exists() or not path.is_file():
        return {
            "path": path.as_posix(),
            "present": False,
            "complete": False,
            "reason": "implementation_plan_missing",
        }

    text = path.read_text(encoding="utf-8")
    frontmatter = _parse_markdown_frontmatter(text)
    section_presence = _section_presence_map(text, IMPLEMENTATION_PLAN_REQUIRED_SECTIONS)

    frontmatter_errors = _frontmatter_errors(
        frontmatter,
        expected_run_id=expected_run_id,
        expected_artifact_type="implementation_plan",
        expected_workflow_variant=expected_workflow_variant,
    )
    missing_sections = [name for name, present in section_presence.items() if not present]
    complete = not frontmatter_errors and not missing_sections
    return {
        "path": path.as_posix(),
        "present": True,
        "complete": complete,
        "frontmatter": frontmatter,
        "frontmatter_errors": frontmatter_errors,
        "section_presence": section_presence,
        "missing_sections": missing_sections,
        "reason": None if complete else "implementation_plan_structurally_inadequate",
    }


def _inspect_acceptance_checks_artifact(
    *,
    path: Path,
    expected_run_id: str,
    expected_workflow_variant: str,
) -> dict[str, Any]:
    check = _inspect_json_artifact(
        path=path,
        required_fields=ACCEPTANCE_CHECKS_REQUIRED_FIELDS,
        expected_artifact_type="acceptance_checks",
        expected_run_id=expected_run_id,
        expected_workflow_variant=expected_workflow_variant,
    )
    if not check.get("present"):
        check["reason"] = "acceptance_checks_missing"
        return check

    payload = check.get("payload")
    list_errors: list[str] = []
    if isinstance(payload, dict):
        for key in ("functional_checks", "tests_required", "docs_required", "non_goals", "blocking_conditions"):
            value = payload.get(key)
            if not isinstance(value, list):
                list_errors.append(f"field_not_list:{key}")
                continue
            if key != "blocking_conditions" and not value:
                list_errors.append(f"field_empty:{key}")

    check["list_errors"] = list_errors
    complete = bool(check.get("complete")) and not list_errors
    check["complete"] = complete
    check["reason"] = None if complete else "acceptance_checks_structurally_inadequate"
    return check


def _inspect_context_report_artifact(*, path: Path, expected_run_id: str) -> dict[str, Any]:
    check = _inspect_json_artifact(
        path=path,
        required_fields=CONTEXT_REPORT_REQUIRED_FIELDS,
        expected_artifact_type="context_report",
        expected_run_id=expected_run_id,
        expected_workflow_variant=H4_WAVE_START_WORKFLOW_ID,
    )
    if not check.get("present"):
        check["reason"] = "context_report_missing"
        return check

    payload = check.get("payload")
    content_errors: list[str] = []
    if isinstance(payload, dict):
        for key in CONTEXT_REPORT_REQUIRED_TEXT_FIELDS:
            if _str_or_none(payload.get(key)) is None:
                content_errors.append(f"field_empty:{key}")
        for key in CONTEXT_REPORT_REQUIRED_NON_EMPTY_LIST_FIELDS:
            value = payload.get(key)
            if not isinstance(value, list):
                content_errors.append(f"field_not_list:{key}")
                continue
            if not value:
                content_errors.append(f"field_empty:{key}")
        for key in CONTEXT_REPORT_REQUIRED_LIST_FIELDS:
            value = payload.get(key)
            if not isinstance(value, list):
                content_errors.append(f"field_not_list:{key}")
                continue
            if any(_str_or_none(item) is None for item in value):
                content_errors.append(f"field_invalid_item:{key}")

    check["content_errors"] = content_errors
    complete = bool(check.get("complete")) and not content_errors
    check["complete"] = complete
    check["reason"] = None if complete else "context_report_structurally_inadequate"
    return check


def _inspect_json_artifact(
    *,
    path: Path,
    required_fields: tuple[str, ...],
    expected_artifact_type: str,
    expected_run_id: str,
    expected_workflow_variant: str,
) -> dict[str, Any]:
    if not path.exists() or not path.is_file():
        return {
            "path": path.as_posix(),
            "present": False,
            "complete": False,
            "reason": "artifact_missing",
        }

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {
            "path": path.as_posix(),
            "present": True,
            "complete": False,
            "reason": "artifact_invalid_json",
        }

    if not isinstance(payload, dict):
        return {
            "path": path.as_posix(),
            "present": True,
            "complete": False,
            "reason": "artifact_not_object",
        }

    missing_fields = [key for key in required_fields if key not in payload]
    consistency_errors: list[str] = []
    if _str_or_none(payload.get("artifact_type")) != expected_artifact_type:
        consistency_errors.append("artifact_type_mismatch")
    if _str_or_none(payload.get("run_id")) != expected_run_id:
        consistency_errors.append("run_id_mismatch")
    if _str_or_none(payload.get("workflow_id")) != "h4":
        consistency_errors.append("workflow_id_mismatch")
    if _str_or_none(payload.get("workflow_variant")) != expected_workflow_variant:
        consistency_errors.append("workflow_variant_mismatch")

    complete = not missing_fields and not consistency_errors
    return {
        "path": path.as_posix(),
        "present": True,
        "complete": complete,
        "payload": payload,
        "missing_fields": missing_fields,
        "consistency_errors": consistency_errors,
        "reason": None if complete else "artifact_structurally_inadequate",
    }


def _inspect_packet_json(*, path: Path) -> dict[str, Any]:
    if not path.exists() or not path.is_file():
        return {
            "path": path.as_posix(),
            "present": False,
            "complete": False,
            "reason": "packet_json_missing",
        }

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {
            "path": path.as_posix(),
            "present": True,
            "complete": False,
            "reason": "packet_json_invalid",
        }
    if not isinstance(payload, dict):
        return {
            "path": path.as_posix(),
            "present": True,
            "complete": False,
            "reason": "packet_json_not_object",
        }

    missing = [key for key in WAVE_START_PACKET_REQUIRED_FIELDS if key not in payload]
    complete = not missing
    return {
        "path": path.as_posix(),
        "present": True,
        "complete": complete,
        "missing_fields": missing,
        "reason": None if complete else "packet_json_structurally_inadequate",
    }


def _inspect_packet_markdown(*, path: Path) -> dict[str, Any]:
    if not path.exists() or not path.is_file():
        return {
            "path": path.as_posix(),
            "present": False,
            "complete": False,
            "reason": "packet_markdown_missing",
        }
    text = path.read_text(encoding="utf-8").strip()
    complete = bool(text and "# Packet:" in text and "## Wave Start" in text)
    return {
        "path": path.as_posix(),
        "present": True,
        "complete": complete,
        "reason": None if complete else "packet_markdown_structurally_inadequate",
    }


def _inspect_baseline_plan(path_like: str | Path) -> dict[str, Any]:
    path = Path(path_like)
    text = path.read_text(encoding="utf-8")
    normalized = text.strip()
    return {
        "path": path.as_posix(),
        "present": bool(normalized),
        "text": normalized,
        "excerpt": normalized[:400] if normalized else None,
    }


def _build_h4_dimensions(
    *,
    run_truth: dict[str, Any],
    plan_check: dict[str, Any],
    acceptance_check: dict[str, Any],
) -> dict[str, bool]:
    plan_sections = plan_check.get("section_presence") if isinstance(plan_check.get("section_presence"), dict) else {}
    acceptance_payload = (
        acceptance_check.get("payload") if isinstance(acceptance_check.get("payload"), dict) else {}
    )

    return {
        "repo_grounding_explicit": bool(
            run_truth.get("workflow_id") == H4_SEQ_NEXT_WORKFLOW_ID
            and _section_present(plan_sections, "Current Repo Context")
            and _section_present(plan_sections, "Affected Surfaces")
            and _section_present(plan_sections, "Likely Touched Files")
        ),
        "touched_surface_clarity": bool(
            _section_present(plan_sections, "Affected Surfaces")
            and _section_present(plan_sections, "Likely Touched Files")
        ),
        "tests_docs_explicit": bool(
            _section_present(plan_sections, "Test Plan")
            and _section_present(plan_sections, "Documentation Obligations")
            and _non_empty_list(acceptance_payload.get("tests_required"))
            and _non_empty_list(acceptance_payload.get("docs_required"))
        ),
        "risks_unknowns_non_goals_explicit": bool(
            _section_present(plan_sections, "Risks")
            and _section_present(plan_sections, "Open Questions")
            and _section_present(plan_sections, "Non-Goals")
            and _non_empty_list(acceptance_payload.get("non_goals"))
        ),
        "blocking_honesty_explicit": bool(
            _section_present(plan_sections, "Blocking Conditions")
            and isinstance(acceptance_payload.get("blocking_conditions"), list)
        ),
    }


def _build_baseline_dimensions(baseline_check: dict[str, Any]) -> dict[str, bool]:
    text = str(baseline_check.get("text") or "")
    lowered = text.lower()
    path_hint_count = len(re.findall(r"(?:src/|tests/|docs/|ops/|\.py\b|\.md\b)", lowered))

    return {
        "repo_grounding_explicit": path_hint_count >= 2,
        "touched_surface_clarity": bool(
            "touched" in lowered
            or "changed surfaces" in lowered
            or path_hint_count >= 3
        ),
        "tests_docs_explicit": "test" in lowered and "doc" in lowered,
        "risks_unknowns_non_goals_explicit": (
            "risk" in lowered and ("unknown" in lowered or "non-goal" in lowered or "non goal" in lowered)
        ),
        "blocking_honesty_explicit": (
            "blocker" in lowered or "blocking condition" in lowered or "hold" in lowered
        ),
    }


def _build_dimension_comparison(
    *,
    h4_dimensions: dict[str, bool],
    baseline_dimensions: dict[str, bool],
) -> dict[str, Any]:
    keys = sorted(h4_dimensions.keys())
    h4_stronger = [key for key in keys if h4_dimensions.get(key) and not baseline_dimensions.get(key)]
    baseline_stronger = [key for key in keys if baseline_dimensions.get(key) and not h4_dimensions.get(key)]
    return {
        "h4_stronger_dimensions": h4_stronger,
        "baseline_stronger_dimensions": baseline_stronger,
        "h4_stronger_dimension_count": len(h4_stronger),
        "baseline_stronger_dimension_count": len(baseline_stronger),
        "h4_all_critical_dimensions_true": all(bool(h4_dimensions.get(key)) for key in keys),
        "baseline_not_better_on_any_dimension": not baseline_stronger,
    }


def _packet_lane_reason(*, validation: Any, replay: dict[str, Any], workflow_id: str | None) -> str | None:
    if not validation.passed:
        return "wave_start_canonical_artifacts_invalid"
    if not bool(replay.get("replay_ready")):
        return "wave_start_replay_not_ready"
    if workflow_id != H4_WAVE_START_WORKFLOW_ID:
        return "wave_start_workflow_mismatch"
    return None


def _parse_markdown_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end_index = text.find("\n---\n", 4)
    if end_index < 0:
        return {}
    block = text[4:end_index]
    frontmatter: dict[str, str] = {}
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key_clean = key.strip()
        value_clean = value.strip()
        if key_clean:
            frontmatter[key_clean] = value_clean
    return frontmatter


def _section_presence_map(text: str, sections: tuple[str, ...]) -> dict[str, bool]:
    return {section: bool(re.search(rf"^##\s+{re.escape(section)}\s*$", text, re.MULTILINE)) for section in sections}


def _frontmatter_errors(
    frontmatter: dict[str, str],
    *,
    expected_run_id: str,
    expected_artifact_type: str,
    expected_workflow_variant: str,
) -> list[str]:
    errors: list[str] = []
    for key in FRONTMATTER_REQUIRED_FIELDS:
        if _str_or_none(frontmatter.get(key)) is None:
            errors.append(f"missing_frontmatter_field:{key}")

    if _str_or_none(frontmatter.get("artifact_type")) != expected_artifact_type:
        errors.append("frontmatter_artifact_type_mismatch")
    if _str_or_none(frontmatter.get("run_id")) != expected_run_id:
        errors.append("frontmatter_run_id_mismatch")
    if _str_or_none(frontmatter.get("workflow_id")) != "h4":
        errors.append("frontmatter_workflow_id_mismatch")
    if _str_or_none(frontmatter.get("workflow_variant")) != expected_workflow_variant:
        errors.append("frontmatter_workflow_variant_mismatch")
    return errors


def _section_present(section_presence: dict[str, bool], name: str) -> bool:
    return bool(section_presence.get(name))


def _non_empty_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value)


def _path_or_none(path_like: str | Path | None) -> str | None:
    if path_like is None:
        return None
    return Path(path_like).as_posix()


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _first_non_empty(*values: str | None) -> str | None:
    for value in values:
        if _str_or_none(value):
            return value
    return None
