from __future__ import annotations

from enum import StrEnum


class H2Role(StrEnum):
    INTAKE = "h2.intake"
    PLANNER = "h2.planner"
    ARCHITECT = "h2.architect"
    CRITIC = "h2.critic"
    SYNTHESIZER = "h2.synthesizer"


H2_AGENT_IDS: dict[H2Role, str] = {
    H2Role.INTAKE: "h2_intake_agent",
    H2Role.PLANNER: "h2_planner_agent",
    H2Role.ARCHITECT: "h2_architect_agent",
    H2Role.CRITIC: "h2_critic_agent",
    H2Role.SYNTHESIZER: "h2_synthesizer_agent",
}


def ordered_h2_roles() -> tuple[H2Role, ...]:
    return (
        H2Role.INTAKE,
        H2Role.PLANNER,
        H2Role.ARCHITECT,
        H2Role.CRITIC,
        H2Role.SYNTHESIZER,
    )
