from __future__ import annotations

from enum import StrEnum


class H3Role(StrEnum):
    INTAKE = "h3.intake"
    PLANNER = "h3.planner"
    SYSTEMS = "h3.systems"
    CRITIC = "h3.critic"
    SYNTHESIZER = "h3.synthesizer"


H3_AGENT_IDS: dict[H3Role, str] = {
    H3Role.INTAKE: "h3_intake_agent",
    H3Role.PLANNER: "h3_planner_agent",
    H3Role.SYSTEMS: "h3_systems_agent",
    H3Role.CRITIC: "h3_critic_agent",
    H3Role.SYNTHESIZER: "h3_synthesizer_agent",
}


def ordered_h3_roles() -> tuple[H3Role, ...]:
    return (
        H3Role.INTAKE,
        H3Role.PLANNER,
        H3Role.SYSTEMS,
        H3Role.CRITIC,
        H3Role.SYNTHESIZER,
    )
