from __future__ import annotations

from fractal_agent_lab.agents.h3.prompts import H3_PROMPT_VERSION, PROMPTS_BY_ROLE, ROLE_PROMPT_VERSION
from fractal_agent_lab.agents.h3.roles import H3Role, H3_AGENT_IDS, ordered_h3_roles
from fractal_agent_lab.core.contracts import AgentKind, AgentSpec


def build_h3_agent_specs() -> dict[str, AgentSpec]:
    specs: list[AgentSpec] = [
        AgentSpec(
            agent_id=H3_AGENT_IDS[H3Role.INTAKE],
            role=H3Role.INTAKE.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H3Role.INTAKE],
            model_policy_ref="cheap_worker",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H3Role.INTAKE],
                "pack_prompt_version": H3_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H3_AGENT_IDS[H3Role.PLANNER],
            role=H3Role.PLANNER.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H3Role.PLANNER],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H3Role.PLANNER],
                "pack_prompt_version": H3_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H3_AGENT_IDS[H3Role.SYSTEMS],
            role=H3Role.SYSTEMS.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H3Role.SYSTEMS],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H3Role.SYSTEMS],
                "pack_prompt_version": H3_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H3_AGENT_IDS[H3Role.CRITIC],
            role=H3Role.CRITIC.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H3Role.CRITIC],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H3Role.CRITIC],
                "pack_prompt_version": H3_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H3_AGENT_IDS[H3Role.SYNTHESIZER],
            role=H3Role.SYNTHESIZER.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H3Role.SYNTHESIZER],
            model_policy_ref="finalizer",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H3Role.SYNTHESIZER],
                "pack_prompt_version": H3_PROMPT_VERSION,
            },
        ),
    ]
    return {spec.agent_id: spec for spec in specs}


def build_h3_agent_pack() -> dict[str, AgentSpec]:
    specs = build_h3_agent_specs()
    validate_h3_agent_specs(specs)
    return specs


def validate_h3_agent_specs(agent_specs_by_id: dict[str, AgentSpec]) -> None:
    required_ids = {H3_AGENT_IDS[role] for role in ordered_h3_roles()}
    missing = sorted(required_ids.difference(agent_specs_by_id))
    if missing:
        raise ValueError(f"Missing required H3 agent specs: {', '.join(missing)}")

    unexpected = sorted(set(agent_specs_by_id).difference(required_ids))
    if unexpected:
        raise ValueError(f"Unexpected H3 agent specs: {', '.join(unexpected)}")

    seen_roles: set[str] = set()
    observed_pack_versions: set[str] = set()
    for role in ordered_h3_roles():
        agent_id = H3_AGENT_IDS[role]
        spec = agent_specs_by_id[agent_id]

        if spec.role in seen_roles:
            raise ValueError(f"Duplicate role in H3 pack: {spec.role}")
        seen_roles.add(spec.role)

        if spec.role != role.value:
            raise ValueError(
                f"Agent '{spec.agent_id}' must use canonical H3 role '{role.value}', got '{spec.role}'.",
            )

        prompt_version = spec.metadata.get("prompt_version")
        if not isinstance(prompt_version, str) or not prompt_version:
            raise ValueError(f"Agent '{spec.agent_id}' missing non-empty prompt_version metadata.")
        if prompt_version != ROLE_PROMPT_VERSION[role]:
            raise ValueError(
                f"Agent '{spec.agent_id}' must use prompt_version '{ROLE_PROMPT_VERSION[role]}'.",
            )

        pack_prompt_version = spec.metadata.get("pack_prompt_version")
        if not isinstance(pack_prompt_version, str) or not pack_prompt_version:
            raise ValueError(f"Agent '{spec.agent_id}' missing non-empty pack_prompt_version metadata.")
        observed_pack_versions.add(pack_prompt_version)

    if observed_pack_versions != {H3_PROMPT_VERSION}:
        raise ValueError(
            f"H3 manager pack must use one consistent pack_prompt_version ({H3_PROMPT_VERSION}).",
        )

    for spec in agent_specs_by_id.values():
        for target in spec.handoff_targets:
            if target not in agent_specs_by_id:
                raise ValueError(
                    f"Agent '{spec.agent_id}' references unknown handoff target '{target}'.",
                )
            if target == spec.agent_id:
                raise ValueError(f"Agent '{spec.agent_id}' cannot hand off to itself.")

    for role in ordered_h3_roles():
        if agent_specs_by_id[H3_AGENT_IDS[role]].handoff_targets:
            raise ValueError(
                "H3 manager pack agents must not declare handoff targets. "
                "Manager orchestration authority comes from workflow.manager_spec and manager control output.",
            )
