from __future__ import annotations

from fractal_agent_lab.agents.h4.prompts import (
    H4_SEQ_NEXT_PROMPT_VERSION,
    H4_WAVE_START_PROMPT_VERSION,
    SEQ_NEXT_PROMPTS_BY_ROLE,
    SEQ_NEXT_ROLE_PROMPT_VERSION,
    WAVE_START_PROMPTS_BY_ROLE,
    WAVE_START_ROLE_PROMPT_VERSION,
)
from fractal_agent_lab.agents.h4.roles import (
    H4_SEQ_NEXT_AGENT_IDS,
    H4_WAVE_START_AGENT_IDS,
    H4SeqNextRole,
    H4WaveStartRole,
    ordered_h4_seq_next_roles,
    ordered_h4_wave_start_roles,
)
from fractal_agent_lab.core.contracts import AgentKind, AgentSpec


def build_h4_wave_start_agent_specs() -> dict[str, AgentSpec]:
    specs: list[AgentSpec] = [
        AgentSpec(
            agent_id=H4_WAVE_START_AGENT_IDS[H4WaveStartRole.REPO_INTAKE],
            role=H4WaveStartRole.REPO_INTAKE.value,
            kind=AgentKind.LLM,
            instructions=WAVE_START_PROMPTS_BY_ROLE[H4WaveStartRole.REPO_INTAKE],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": WAVE_START_ROLE_PROMPT_VERSION[H4WaveStartRole.REPO_INTAKE],
                "pack_prompt_version": H4_WAVE_START_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H4_WAVE_START_AGENT_IDS[H4WaveStartRole.ARCHITECT_CRITIC],
            role=H4WaveStartRole.ARCHITECT_CRITIC.value,
            kind=AgentKind.LLM,
            instructions=WAVE_START_PROMPTS_BY_ROLE[H4WaveStartRole.ARCHITECT_CRITIC],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": WAVE_START_ROLE_PROMPT_VERSION[H4WaveStartRole.ARCHITECT_CRITIC],
                "pack_prompt_version": H4_WAVE_START_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H4_WAVE_START_AGENT_IDS[H4WaveStartRole.SYNTHESIZER],
            role=H4WaveStartRole.SYNTHESIZER.value,
            kind=AgentKind.LLM,
            instructions=WAVE_START_PROMPTS_BY_ROLE[H4WaveStartRole.SYNTHESIZER],
            model_policy_ref="finalizer",
            handoff_targets=[],
            metadata={
                "prompt_version": WAVE_START_ROLE_PROMPT_VERSION[H4WaveStartRole.SYNTHESIZER],
                "pack_prompt_version": H4_WAVE_START_PROMPT_VERSION,
            },
        ),
    ]
    return {spec.agent_id: spec for spec in specs}


def build_h4_seq_next_agent_specs() -> dict[str, AgentSpec]:
    specs: list[AgentSpec] = [
        AgentSpec(
            agent_id=H4_SEQ_NEXT_AGENT_IDS[H4SeqNextRole.REPO_INTAKE],
            role=H4SeqNextRole.REPO_INTAKE.value,
            kind=AgentKind.LLM,
            instructions=SEQ_NEXT_PROMPTS_BY_ROLE[H4SeqNextRole.REPO_INTAKE],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": SEQ_NEXT_ROLE_PROMPT_VERSION[H4SeqNextRole.REPO_INTAKE],
                "pack_prompt_version": H4_SEQ_NEXT_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H4_SEQ_NEXT_AGENT_IDS[H4SeqNextRole.PLANNER],
            role=H4SeqNextRole.PLANNER.value,
            kind=AgentKind.LLM,
            instructions=SEQ_NEXT_PROMPTS_BY_ROLE[H4SeqNextRole.PLANNER],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": SEQ_NEXT_ROLE_PROMPT_VERSION[H4SeqNextRole.PLANNER],
                "pack_prompt_version": H4_SEQ_NEXT_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H4_SEQ_NEXT_AGENT_IDS[H4SeqNextRole.ARCHITECT_CRITIC],
            role=H4SeqNextRole.ARCHITECT_CRITIC.value,
            kind=AgentKind.LLM,
            instructions=SEQ_NEXT_PROMPTS_BY_ROLE[H4SeqNextRole.ARCHITECT_CRITIC],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": SEQ_NEXT_ROLE_PROMPT_VERSION[H4SeqNextRole.ARCHITECT_CRITIC],
                "pack_prompt_version": H4_SEQ_NEXT_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H4_SEQ_NEXT_AGENT_IDS[H4SeqNextRole.SYNTHESIZER],
            role=H4SeqNextRole.SYNTHESIZER.value,
            kind=AgentKind.LLM,
            instructions=SEQ_NEXT_PROMPTS_BY_ROLE[H4SeqNextRole.SYNTHESIZER],
            model_policy_ref="finalizer",
            handoff_targets=[],
            metadata={
                "prompt_version": SEQ_NEXT_ROLE_PROMPT_VERSION[H4SeqNextRole.SYNTHESIZER],
                "pack_prompt_version": H4_SEQ_NEXT_PROMPT_VERSION,
            },
        ),
    ]
    return {spec.agent_id: spec for spec in specs}


def build_h4_wave_start_agent_pack() -> dict[str, AgentSpec]:
    specs = build_h4_wave_start_agent_specs()
    validate_h4_wave_start_agent_specs(specs)
    return specs


def build_h4_seq_next_agent_pack() -> dict[str, AgentSpec]:
    specs = build_h4_seq_next_agent_specs()
    validate_h4_seq_next_agent_specs(specs)
    return specs


def validate_h4_wave_start_agent_specs(agent_specs_by_id: dict[str, AgentSpec]) -> None:
    required_ids = {H4_WAVE_START_AGENT_IDS[role] for role in ordered_h4_wave_start_roles()}
    _validate_h4_pack_common(
        agent_specs_by_id=agent_specs_by_id,
        required_ids=required_ids,
        ordered_roles=ordered_h4_wave_start_roles(),
        role_agent_ids=H4_WAVE_START_AGENT_IDS,
        prompt_version_by_role=WAVE_START_ROLE_PROMPT_VERSION,
        pack_prompt_version=H4_WAVE_START_PROMPT_VERSION,
        pack_label="H4 wave_start",
    )


def validate_h4_seq_next_agent_specs(agent_specs_by_id: dict[str, AgentSpec]) -> None:
    required_ids = {H4_SEQ_NEXT_AGENT_IDS[role] for role in ordered_h4_seq_next_roles()}
    _validate_h4_pack_common(
        agent_specs_by_id=agent_specs_by_id,
        required_ids=required_ids,
        ordered_roles=ordered_h4_seq_next_roles(),
        role_agent_ids=H4_SEQ_NEXT_AGENT_IDS,
        prompt_version_by_role=SEQ_NEXT_ROLE_PROMPT_VERSION,
        pack_prompt_version=H4_SEQ_NEXT_PROMPT_VERSION,
        pack_label="H4 seq_next",
    )


def _validate_h4_pack_common(
    *,
    agent_specs_by_id: dict[str, AgentSpec],
    required_ids: set[str],
    ordered_roles: tuple[H4WaveStartRole | H4SeqNextRole, ...],
    role_agent_ids: dict[H4WaveStartRole | H4SeqNextRole, str],
    prompt_version_by_role: dict[H4WaveStartRole | H4SeqNextRole, str],
    pack_prompt_version: str,
    pack_label: str,
) -> None:
    missing = sorted(required_ids.difference(agent_specs_by_id))
    if missing:
        raise ValueError(f"Missing required {pack_label} agent specs: {', '.join(missing)}")

    unexpected = sorted(set(agent_specs_by_id).difference(required_ids))
    if unexpected:
        raise ValueError(f"Unexpected {pack_label} agent specs: {', '.join(unexpected)}")

    seen_roles: set[str] = set()
    observed_pack_versions: set[str] = set()
    for role in ordered_roles:
        agent_id = role_agent_ids[role]
        spec = agent_specs_by_id[agent_id]

        if spec.role in seen_roles:
            raise ValueError(f"Duplicate role in {pack_label} pack: {spec.role}")
        seen_roles.add(spec.role)

        if spec.role != role.value:
            raise ValueError(
                f"Agent '{spec.agent_id}' must use canonical {pack_label} role '{role.value}', got '{spec.role}'.",
            )

        prompt_version = spec.metadata.get("prompt_version")
        if not isinstance(prompt_version, str) or not prompt_version:
            raise ValueError(f"Agent '{spec.agent_id}' missing non-empty prompt_version metadata.")
        if prompt_version != prompt_version_by_role[role]:
            raise ValueError(
                f"Agent '{spec.agent_id}' must use prompt_version '{prompt_version_by_role[role]}'.",
            )

        observed_pack_versions.add(_read_pack_prompt_version(spec=spec))

    if observed_pack_versions != {pack_prompt_version}:
        raise ValueError(
            f"{pack_label} pack must use one consistent pack_prompt_version ({pack_prompt_version}).",
        )

    for spec in agent_specs_by_id.values():
        for target in spec.handoff_targets:
            if target not in agent_specs_by_id:
                raise ValueError(
                    f"Agent '{spec.agent_id}' references unknown handoff target '{target}'.",
                )
            if target == spec.agent_id:
                raise ValueError(f"Agent '{spec.agent_id}' cannot hand off to itself.")

    for role in ordered_roles:
        if agent_specs_by_id[role_agent_ids[role]].handoff_targets:
            raise ValueError(
                f"{pack_label} manager pack agents must not declare handoff targets. "
                "Manager orchestration authority comes from workflow.manager_spec and manager control output.",
            )


def _read_pack_prompt_version(*, spec: AgentSpec) -> str:
    value = spec.metadata.get("pack_prompt_version")
    if not isinstance(value, str) or not value:
        raise ValueError(f"Agent '{spec.agent_id}' missing non-empty pack_prompt_version metadata.")
    return value
