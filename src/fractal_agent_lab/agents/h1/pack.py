from __future__ import annotations

from fractal_agent_lab.agents.h1.prompts import (
    H1_HANDOFF_PROMPT_VERSION,
    H1_PROMPT_VERSION,
    HANDOFF_PROMPTS_BY_ROLE,
    HANDOFF_ROLE_PROMPT_VERSION,
    H1_SINGLE_PROMPT,
    H1_SINGLE_PROMPT_VERSION,
    H1_SINGLE_ROLE,
    H1_SINGLE_ROLE_PROMPT_VERSION,
    PROMPTS_BY_ROLE,
    ROLE_PROMPT_VERSION,
)
from fractal_agent_lab.agents.h1.roles import H1Role, H1_AGENT_IDS, ordered_h1_roles
from fractal_agent_lab.core.contracts import AgentKind, AgentSpec


H1_SINGLE_AGENT_ID = "h1_single_agent"


def build_h1_agent_specs() -> dict[str, AgentSpec]:
    specs: list[AgentSpec] = [
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.INTAKE],
            role=H1Role.INTAKE.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H1Role.INTAKE],
            model_policy_ref="cheap_worker",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H1Role.INTAKE],
                "pack_prompt_version": H1_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.PLANNER],
            role=H1Role.PLANNER.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H1Role.PLANNER],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H1Role.PLANNER],
                "pack_prompt_version": H1_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.CRITIC],
            role=H1Role.CRITIC.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H1Role.CRITIC],
            model_policy_ref="specialist",
            handoff_targets=[],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H1Role.CRITIC],
                "pack_prompt_version": H1_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.SYNTHESIZER],
            role=H1Role.SYNTHESIZER.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H1Role.SYNTHESIZER],
            model_policy_ref="finalizer",
            handoff_targets=[
                H1_AGENT_IDS[H1Role.INTAKE],
                H1_AGENT_IDS[H1Role.PLANNER],
                H1_AGENT_IDS[H1Role.CRITIC],
            ],
            metadata={
                "prompt_version": ROLE_PROMPT_VERSION[H1Role.SYNTHESIZER],
                "pack_prompt_version": H1_PROMPT_VERSION,
            },
        ),
    ]
    return {spec.agent_id: spec for spec in specs}


def build_h1_agent_pack() -> dict[str, AgentSpec]:
    specs = build_h1_agent_specs()
    validate_h1_agent_specs(specs)
    return specs


def build_h1_handoff_agent_specs() -> dict[str, AgentSpec]:
    specs: list[AgentSpec] = [
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.INTAKE],
            role=H1Role.INTAKE.value,
            kind=AgentKind.LLM,
            instructions=HANDOFF_PROMPTS_BY_ROLE[H1Role.INTAKE],
            model_policy_ref="cheap_worker",
            handoff_targets=[H1_AGENT_IDS[H1Role.PLANNER]],
            metadata={
                "prompt_version": HANDOFF_ROLE_PROMPT_VERSION[H1Role.INTAKE],
                "pack_prompt_version": H1_HANDOFF_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.PLANNER],
            role=H1Role.PLANNER.value,
            kind=AgentKind.LLM,
            instructions=HANDOFF_PROMPTS_BY_ROLE[H1Role.PLANNER],
            model_policy_ref="specialist",
            handoff_targets=[H1_AGENT_IDS[H1Role.CRITIC]],
            metadata={
                "prompt_version": HANDOFF_ROLE_PROMPT_VERSION[H1Role.PLANNER],
                "pack_prompt_version": H1_HANDOFF_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.CRITIC],
            role=H1Role.CRITIC.value,
            kind=AgentKind.LLM,
            instructions=HANDOFF_PROMPTS_BY_ROLE[H1Role.CRITIC],
            model_policy_ref="specialist",
            handoff_targets=[H1_AGENT_IDS[H1Role.SYNTHESIZER]],
            metadata={
                "prompt_version": HANDOFF_ROLE_PROMPT_VERSION[H1Role.CRITIC],
                "pack_prompt_version": H1_HANDOFF_PROMPT_VERSION,
            },
        ),
        AgentSpec(
            agent_id=H1_AGENT_IDS[H1Role.SYNTHESIZER],
            role=H1Role.SYNTHESIZER.value,
            kind=AgentKind.LLM,
            instructions=HANDOFF_PROMPTS_BY_ROLE[H1Role.SYNTHESIZER],
            model_policy_ref="finalizer",
            handoff_targets=[],
            metadata={
                "prompt_version": HANDOFF_ROLE_PROMPT_VERSION[H1Role.SYNTHESIZER],
                "pack_prompt_version": H1_HANDOFF_PROMPT_VERSION,
            },
        ),
    ]
    return {spec.agent_id: spec for spec in specs}


def build_h1_handoff_agent_pack() -> dict[str, AgentSpec]:
    specs = build_h1_handoff_agent_specs()
    validate_h1_handoff_agent_specs(specs)
    return specs


def validate_h1_agent_specs(agent_specs_by_id: dict[str, AgentSpec]) -> None:
    required_ids = {H1_AGENT_IDS[role] for role in ordered_h1_roles()}
    missing = sorted(required_ids.difference(agent_specs_by_id))
    if missing:
        raise ValueError(f"Missing required H1 agent specs: {', '.join(missing)}")

    seen_roles: set[str] = set()
    observed_pack_versions: set[str] = set()
    for role in ordered_h1_roles():
        agent_id = H1_AGENT_IDS[role]
        spec = agent_specs_by_id[agent_id]
        if spec.role in seen_roles:
            raise ValueError(f"Duplicate role in H1 pack: {spec.role}")
        seen_roles.add(spec.role)

        prompt_version = spec.metadata.get("prompt_version")
        if not isinstance(prompt_version, str) or not prompt_version:
            raise ValueError(f"Agent '{spec.agent_id}' missing non-empty prompt_version metadata.")

        pack_prompt_version = spec.metadata.get("pack_prompt_version")
        if not isinstance(pack_prompt_version, str) or not pack_prompt_version:
            raise ValueError(f"Agent '{spec.agent_id}' missing non-empty pack_prompt_version metadata.")
        observed_pack_versions.add(pack_prompt_version)

    if observed_pack_versions != {H1_PROMPT_VERSION}:
        raise ValueError(
            "H1 manager pack must use one consistent pack_prompt_version (h1.prompt.v1).",
        )

    for spec in agent_specs_by_id.values():
        for target in spec.handoff_targets:
            if target not in agent_specs_by_id:
                raise ValueError(
                    f"Agent '{spec.agent_id}' references unknown handoff target '{target}'.",
                )
            if target == spec.agent_id:
                raise ValueError(f"Agent '{spec.agent_id}' cannot hand off to itself.")

    worker_agent_ids = {
        H1_AGENT_IDS[H1Role.INTAKE],
        H1_AGENT_IDS[H1Role.PLANNER],
        H1_AGENT_IDS[H1Role.CRITIC],
    }
    synthesizer_targets = set(agent_specs_by_id[H1_AGENT_IDS[H1Role.SYNTHESIZER]].handoff_targets)
    if synthesizer_targets != worker_agent_ids:
        raise ValueError("H1 synthesizer must target intake/planner/critic workers only.")

    for role in (H1Role.INTAKE, H1Role.PLANNER, H1Role.CRITIC):
        if agent_specs_by_id[H1_AGENT_IDS[role]].handoff_targets:
            raise ValueError(f"H1 worker '{role.value}' must not declare handoff targets.")


def validate_h1_handoff_agent_specs(agent_specs_by_id: dict[str, AgentSpec]) -> None:
    required_ids = {H1_AGENT_IDS[role] for role in ordered_h1_roles()}
    missing = sorted(required_ids.difference(agent_specs_by_id))
    if missing:
        raise ValueError(f"Missing required H1 handoff agent specs: {', '.join(missing)}")

    intake_targets = agent_specs_by_id[H1_AGENT_IDS[H1Role.INTAKE]].handoff_targets
    planner_targets = agent_specs_by_id[H1_AGENT_IDS[H1Role.PLANNER]].handoff_targets
    critic_targets = agent_specs_by_id[H1_AGENT_IDS[H1Role.CRITIC]].handoff_targets
    synthesizer_targets = agent_specs_by_id[H1_AGENT_IDS[H1Role.SYNTHESIZER]].handoff_targets

    if intake_targets != [H1_AGENT_IDS[H1Role.PLANNER]]:
        raise ValueError("H1 handoff intake must target planner only.")
    if planner_targets != [H1_AGENT_IDS[H1Role.CRITIC]]:
        raise ValueError("H1 handoff planner must target critic only.")
    if critic_targets != [H1_AGENT_IDS[H1Role.SYNTHESIZER]]:
        raise ValueError("H1 handoff critic must target synthesizer only.")
    if synthesizer_targets:
        raise ValueError("H1 handoff synthesizer must be terminal.")

    observed_pack_versions: set[str] = set()
    for role in ordered_h1_roles():
        spec = agent_specs_by_id[H1_AGENT_IDS[role]]
        prompt_version = spec.metadata.get("prompt_version")
        if not isinstance(prompt_version, str) or not prompt_version:
            raise ValueError(f"Agent '{spec.agent_id}' missing non-empty prompt_version metadata.")

        pack_prompt_version = spec.metadata.get("pack_prompt_version")
        if not isinstance(pack_prompt_version, str) or not pack_prompt_version:
            raise ValueError(f"Agent '{spec.agent_id}' missing non-empty pack_prompt_version metadata.")
        observed_pack_versions.add(pack_prompt_version)

        for target in spec.handoff_targets:
            if target not in agent_specs_by_id:
                raise ValueError(
                    f"Agent '{spec.agent_id}' references unknown handoff target '{target}'.",
                )
            if target == spec.agent_id:
                raise ValueError(f"Agent '{spec.agent_id}' cannot hand off to itself.")

    if observed_pack_versions != {H1_HANDOFF_PROMPT_VERSION}:
        raise ValueError(
            "H1 handoff pack must use one consistent pack_prompt_version (h1.handoff.prompt.v1).",
        )


def build_h1_single_agent_specs() -> dict[str, AgentSpec]:
    return {
        H1_SINGLE_AGENT_ID: AgentSpec(
            agent_id=H1_SINGLE_AGENT_ID,
            role=H1_SINGLE_ROLE,
            kind=AgentKind.LLM,
            instructions=H1_SINGLE_PROMPT,
            model_policy_ref="finalizer",
            handoff_targets=[],
            metadata={
                "prompt_version": H1_SINGLE_ROLE_PROMPT_VERSION,
                "pack_prompt_version": H1_SINGLE_PROMPT_VERSION,
            },
        ),
    }


def build_h1_single_agent_pack() -> dict[str, AgentSpec]:
    specs = build_h1_single_agent_specs()
    validate_h1_single_agent_specs(specs)
    return specs


def validate_h1_single_agent_specs(agent_specs_by_id: dict[str, AgentSpec]) -> None:
    if set(agent_specs_by_id) != {H1_SINGLE_AGENT_ID}:
        raise ValueError("H1 single-agent pack must contain only 'h1_single_agent'.")

    spec = agent_specs_by_id[H1_SINGLE_AGENT_ID]
    if spec.role != H1_SINGLE_ROLE:
        raise ValueError("H1 single-agent pack role must be 'h1.single'.")
    if spec.handoff_targets:
        raise ValueError("H1 single-agent baseline must not declare handoff targets.")

    prompt_version = spec.metadata.get("prompt_version")
    if prompt_version != H1_SINGLE_ROLE_PROMPT_VERSION:
        raise ValueError("H1 single-agent prompt_version metadata is invalid.")

    pack_prompt_version = spec.metadata.get("pack_prompt_version")
    if pack_prompt_version != H1_SINGLE_PROMPT_VERSION:
        raise ValueError("H1 single-agent pack_prompt_version metadata is invalid.")
