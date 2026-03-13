from __future__ import annotations

from enum import StrEnum


class H1LiteRole(StrEnum):
    INTAKE = "h1.intake"
    PLANNER = "h1.planner"
    SYNTHESIZER = "h1.synthesizer"


H1_LITE_AGENT_IDS: dict[H1LiteRole, str] = {
    H1LiteRole.INTAKE: "h1_intake_agent",
    H1LiteRole.PLANNER: "h1_planner_agent",
    H1LiteRole.SYNTHESIZER: "h1_synthesizer_agent",
}


def ordered_h1_lite_roles() -> tuple[H1LiteRole, ...]:
    return (
        H1LiteRole.INTAKE,
        H1LiteRole.PLANNER,
        H1LiteRole.SYNTHESIZER,
    )
