from __future__ import annotations

H1_VARIANT_WORKFLOW_IDS: tuple[str, ...] = (
    "h1.single.v1",
    "h1.manager.v1",
    "h1.handoff.v1",
)

H1_COMPARABLE_OUTPUT_KEYS: tuple[str, ...] = (
    "clarified_idea",
    "strongest_assumptions",
    "weak_points",
    "alternatives",
    "recommended_mvp_direction",
    "next_3_validation_steps",
)

H1_COMPARISON_ROLE_BY_WORKFLOW_ID: dict[str, str] = {
    "h1.single.v1": "baseline_anchor",
    "h1.manager.v1": "default_multi_agent_reference",
    "h1.handoff.v1": "reference_variant",
}
