from __future__ import annotations

H2_EXPECTED_WORKFLOW_ID = "h2.manager.v1"

H2_COMPARABLE_OUTPUT_KEYS: tuple[str, ...] = (
    "project_summary",
    "tracks",
    "modules",
    "phases",
    "dependency_order",
    "implementation_waves",
    "recommended_starting_slice",
    "risk_zones",
    "open_questions",
)

H2_EXPECTED_MANAGER_DELEGATE_ORDER: tuple[str, ...] = (
    "intake",
    "planner",
    "architect",
    "critic",
)
