from __future__ import annotations

from enum import StrEnum


class H1Role(StrEnum):
    INTAKE = "h1.intake"
    PLANNER = "h1.planner"
    CRITIC = "h1.critic"
    SYNTHESIZER = "h1.synthesizer"


H1_AGENT_IDS: dict[H1Role, str] = {
    H1Role.INTAKE: "h1_intake_agent",
    H1Role.PLANNER: "h1_planner_agent",
    H1Role.CRITIC: "h1_critic_agent",
    H1Role.SYNTHESIZER: "h1_synthesizer_agent",
}


def ordered_h1_roles() -> tuple[H1Role, ...]:
    return (
        H1Role.INTAKE,
        H1Role.PLANNER,
        H1Role.CRITIC,
        H1Role.SYNTHESIZER,
    )
