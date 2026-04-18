from __future__ import annotations

from enum import StrEnum


class H4WaveStartRole(StrEnum):
    REPO_INTAKE = "h4.repo_intake"
    ARCHITECT_CRITIC = "h4.architect_critic"
    SYNTHESIZER = "h4.synthesizer"


class H4SeqNextRole(StrEnum):
    REPO_INTAKE = "h4.repo_intake"
    PLANNER = "h4.planner"
    ARCHITECT_CRITIC = "h4.architect_critic"
    SYNTHESIZER = "h4.synthesizer"


H4_WAVE_START_AGENT_IDS: dict[H4WaveStartRole, str] = {
    H4WaveStartRole.REPO_INTAKE: "h4_repo_intake_agent",
    H4WaveStartRole.ARCHITECT_CRITIC: "h4_architect_critic_agent",
    H4WaveStartRole.SYNTHESIZER: "h4_synthesizer_agent",
}


H4_SEQ_NEXT_AGENT_IDS: dict[H4SeqNextRole, str] = {
    H4SeqNextRole.REPO_INTAKE: "h4_repo_intake_agent",
    H4SeqNextRole.PLANNER: "h4_planner_agent",
    H4SeqNextRole.ARCHITECT_CRITIC: "h4_architect_critic_agent",
    H4SeqNextRole.SYNTHESIZER: "h4_synthesizer_agent",
}


def ordered_h4_wave_start_roles() -> tuple[H4WaveStartRole, ...]:
    return (
        H4WaveStartRole.REPO_INTAKE,
        H4WaveStartRole.ARCHITECT_CRITIC,
        H4WaveStartRole.SYNTHESIZER,
    )


def ordered_h4_seq_next_roles() -> tuple[H4SeqNextRole, ...]:
    return (
        H4SeqNextRole.REPO_INTAKE,
        H4SeqNextRole.PLANNER,
        H4SeqNextRole.ARCHITECT_CRITIC,
        H4SeqNextRole.SYNTHESIZER,
    )
