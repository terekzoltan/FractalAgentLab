from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fractal_agent_lab.evals.h1_smoke_comparison import H1_SMOKE_VARIANTS, run_h1_smoke_comparison


TRACE_VIEWER_FIELDS: tuple[str, ...] = (
    "event_type",
    "step_id",
    "lane",
    "turn_index",
    "handoff_index",
    "from_step_id",
    "to_step_id",
    "parent_event_id",
    "correlation_id",
)


def prepare_h1_evidence_prep(
    *,
    input_payload: dict[str, Any],
    provider: str = "mock",
    rubric_outcome: str | None = None,
    rubric_reference: str = "docs/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md",
    runtime_config_path: str = "configs/runtime.example.yaml",
    providers_config_path: str = "configs/providers.example.yaml",
    model_policy_config_path: str = "configs/model_policy.example.yaml",
    data_dir: str | None = None,
) -> dict[str, Any]:
    comparison = run_h1_smoke_comparison(
        input_payload=input_payload,
        provider=provider,
        runtime_config_path=runtime_config_path,
        providers_config_path=providers_config_path,
        model_policy_config_path=model_policy_config_path,
        data_dir=data_dir,
    )

    variants = comparison.get("variants", [])
    if not isinstance(variants, list):
        variants = []

    prompt_provenance = _build_prompt_provenance_summary(variants)

    return {
        "report_version": "l1_l.h1_evidence_prep.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_payload": dict(input_payload),
        "provider": provider,
        "rubric": {
            "reference": rubric_reference,
            "manual_outcome": rubric_outcome,
        },
        "comparison_summary": comparison.get("summary", {}),
        "variants": [_project_variant_evidence(entry) for entry in variants if isinstance(entry, dict)],
        "cross_variant_prompt_provenance": prompt_provenance,
        "trace_viewer_guidance": {
            "note": (
                "Trace viewer is a secondary explanatory evidence surface; canonical decision evidence remains "
                "Track E comparison artifacts plus the L1-K rubric outcome."
            ),
            "recommended_fields": list(TRACE_VIEWER_FIELDS),
        },
        "tradeoff_notes": _build_tradeoff_notes(variants),
        "recommendation_draft": _build_recommendation_draft(
            comparison_summary=comparison.get("summary", {}),
            prompt_provenance=prompt_provenance,
        ),
        "known_limits": [
            "Prompt tags are provenance evidence only and are not used as quality scoring gates.",
            "Mock outputs remain structural smoke evidence, not final quality ranking.",
            "Final winner/default decision belongs to Meta in L1-L decision-log closeout.",
        ],
    }


def _project_variant_evidence(entry: dict[str, Any]) -> dict[str, Any]:
    raw_trace = entry.get("trace")
    trace = raw_trace if isinstance(raw_trace, dict) else {}
    raw_orchestration = entry.get("orchestration")
    orchestration = raw_orchestration if isinstance(raw_orchestration, dict) else {}
    raw_comparable = entry.get("comparable_output")
    comparable_output = raw_comparable if isinstance(raw_comparable, dict) else {}
    raw_artifact_validation = entry.get("artifact_validation")
    artifact_validation = raw_artifact_validation if isinstance(raw_artifact_validation, dict) else {}

    return {
        "workflow_id": entry.get("workflow_id"),
        "run_id": entry.get("run_id"),
        "status": entry.get("status"),
        "run_artifact_path": entry.get("run_artifact_path"),
        "trace_artifact_path": entry.get("trace_artifact_path"),
        "artifact_validation": artifact_validation,
        "comparable_output": {
            "complete": comparable_output.get("complete"),
            "missing_keys": comparable_output.get("missing_keys"),
        },
        "trace": {
            "event_counts": trace.get("event_counts"),
            "lane_counts": trace.get("lane_counts"),
            "handoff_event_counts": trace.get("handoff_event_counts"),
            "linked_events": trace.get("linked_events"),
        },
        "orchestration": orchestration,
        "prompt_tags": entry.get("prompt_tags"),
    }


def _build_prompt_provenance_summary(variants: list[dict[str, Any]]) -> dict[str, Any]:
    by_workflow: dict[str, dict[str, Any]] = {}
    pack_versions: dict[str, str] = {}
    for entry in variants:
        if not isinstance(entry, dict):
            continue
        workflow_id = entry.get("workflow_id")
        if not isinstance(workflow_id, str):
            continue

        raw_prompt_tags = entry.get("prompt_tags")
        prompt_tags = raw_prompt_tags if isinstance(raw_prompt_tags, dict) else {}
        pack_prompt_version = prompt_tags.get("pack_prompt_version")
        if isinstance(pack_prompt_version, str) and pack_prompt_version:
            pack_versions[workflow_id] = pack_prompt_version

        by_workflow[workflow_id] = {
            "variant": prompt_tags.get("variant"),
            "pack_prompt_version": pack_prompt_version,
            "executed_step_prompt_versions": prompt_tags.get("executed_step_prompt_versions"),
        }

    unique_pack_versions = sorted(set(pack_versions.values()))
    return {
        "by_workflow": by_workflow,
        "pack_prompt_versions": pack_versions,
        "all_pack_prompt_versions_explicit": len(pack_versions) == len(H1_SMOKE_VARIANTS),
        "same_pack_prompt_version_across_variants": len(unique_pack_versions) <= 1,
        "within_same_prompt_family": _is_within_same_prompt_family(unique_pack_versions),
    }


def _is_within_same_prompt_family(pack_versions: list[str]) -> bool:
    if not pack_versions:
        return False
    return all(version.startswith("h1.") for version in pack_versions)


def _build_tradeoff_notes(variants: list[dict[str, Any]]) -> list[dict[str, Any]]:
    notes: list[dict[str, Any]] = []
    lookup = {
        entry.get("workflow_id"): entry
        for entry in variants
        if isinstance(entry, dict) and isinstance(entry.get("workflow_id"), str)
    }

    single = lookup.get("h1.single.v1")
    if isinstance(single, dict):
        notes.append(
            {
                "workflow_id": "h1.single.v1",
                "observation": "Lowest orchestration complexity, suitable as a baseline anchor.",
                "evidence": {
                    "lane_counts": _nested(single, "trace", "lane_counts"),
                    "comparable_complete": _nested(single, "comparable_output", "complete"),
                },
            },
        )

    manager = lookup.get("h1.manager.v1")
    if isinstance(manager, dict):
        notes.append(
            {
                "workflow_id": "h1.manager.v1",
                "observation": "Explicit manager-turn structure makes orchestration decisions inspectable.",
                "evidence": {
                    "turn_count": _nested(manager, "orchestration", "manager", "turn_count"),
                    "lane_counts": _nested(manager, "trace", "lane_counts"),
                },
            },
        )

    handoff = lookup.get("h1.handoff.v1")
    if isinstance(handoff, dict):
        notes.append(
            {
                "workflow_id": "h1.handoff.v1",
                "observation": "Handoff path and linkage fields improve hop-level chain explainability.",
                "evidence": {
                    "handoff_event_counts": _nested(handoff, "trace", "handoff_event_counts"),
                    "linked_events": _nested(handoff, "trace", "linked_events"),
                },
            },
        )
    return notes


def _build_recommendation_draft(*, comparison_summary: Any, prompt_provenance: dict[str, Any]) -> dict[str, Any]:
    summary = comparison_summary if isinstance(comparison_summary, dict) else {}
    structurally_ready = bool(
        summary.get("all_succeeded")
        and summary.get("all_artifacts_valid")
        and summary.get("all_comparable_outputs_complete"),
    )

    return {
        "recommended_next_default_candidate": "h1.manager.v1" if structurally_ready else None,
        "confidence": "medium" if structurally_ready else "low",
        "why": [
            "Manager variant preserves explicit turn/worker evidence while baseline and handoff references remain available.",
            "Decision remains provisional until Meta closes L1-L with broader product-facing considerations.",
        ],
        "prompt_provenance_note": {
            "pack_versions_explicit": prompt_provenance.get("all_pack_prompt_versions_explicit"),
            "within_same_prompt_family": prompt_provenance.get("within_same_prompt_family"),
            "note": "Prompt tags document run provenance and are not used as quality scoring gates.",
        },
        "what_is_not_proven_yet": [
            "No final quality winner can be asserted from mock-backed smoke runs alone.",
            "Cross-provider robustness and benchmark-level evidence are out of current scope.",
        ],
    }


def _nested(payload: Any, *keys: str) -> Any:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current
