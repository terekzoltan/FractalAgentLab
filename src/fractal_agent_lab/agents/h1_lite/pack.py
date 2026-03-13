from __future__ import annotations

from fractal_agent_lab.agents.h1_lite.prompts import H1_LITE_PROMPT_VERSION, PROMPTS_BY_ROLE
from fractal_agent_lab.agents.h1_lite.roles import H1LiteRole, H1_LITE_AGENT_IDS, ordered_h1_lite_roles
from fractal_agent_lab.core.contracts import AgentKind, AgentSpec


def build_h1_lite_agent_specs() -> dict[str, AgentSpec]:
    specs: list[AgentSpec] = [
        AgentSpec(
            agent_id=H1_LITE_AGENT_IDS[H1LiteRole.INTAKE],
            role=H1LiteRole.INTAKE.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H1LiteRole.INTAKE],
            model_policy_ref="tier.t1.intake",
            handoff_targets=[H1_LITE_AGENT_IDS[H1LiteRole.PLANNER]],
            metadata={"prompt_version": H1_LITE_PROMPT_VERSION},
        ),
        AgentSpec(
            agent_id=H1_LITE_AGENT_IDS[H1LiteRole.PLANNER],
            role=H1LiteRole.PLANNER.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H1LiteRole.PLANNER],
            model_policy_ref="tier.t2.planner",
            handoff_targets=[H1_LITE_AGENT_IDS[H1LiteRole.SYNTHESIZER]],
            metadata={"prompt_version": H1_LITE_PROMPT_VERSION},
        ),
        AgentSpec(
            agent_id=H1_LITE_AGENT_IDS[H1LiteRole.SYNTHESIZER],
            role=H1LiteRole.SYNTHESIZER.value,
            kind=AgentKind.LLM,
            instructions=PROMPTS_BY_ROLE[H1LiteRole.SYNTHESIZER],
            model_policy_ref="tier.t3.synthesizer",
            handoff_targets=[],
            metadata={"prompt_version": H1_LITE_PROMPT_VERSION},
        ),
    ]
    return {spec.agent_id: spec for spec in specs}


def validate_h1_lite_agent_specs(agent_specs_by_id: dict[str, AgentSpec]) -> None:
    required_ids = {H1_LITE_AGENT_IDS[role] for role in ordered_h1_lite_roles()}
    missing = sorted(required_ids.difference(agent_specs_by_id))
    if missing:
        raise ValueError(f"Missing required H1-lite agent specs: {', '.join(missing)}")

    seen_roles: set[str] = set()
    for role in ordered_h1_lite_roles():
        agent_id = H1_LITE_AGENT_IDS[role]
        spec = agent_specs_by_id[agent_id]
        if spec.role in seen_roles:
            raise ValueError(f"Duplicate role in H1-lite pack: {spec.role}")
        seen_roles.add(spec.role)

        for target in spec.handoff_targets:
            if target not in agent_specs_by_id:
                raise ValueError(
                    f"Agent '{spec.agent_id}' references unknown handoff target '{target}'.",
                )
            if target == spec.agent_id:
                raise ValueError(f"Agent '{spec.agent_id}' cannot hand off to itself.")

    intake_targets = agent_specs_by_id[H1_LITE_AGENT_IDS[H1LiteRole.INTAKE]].handoff_targets
    planner_targets = agent_specs_by_id[H1_LITE_AGENT_IDS[H1LiteRole.PLANNER]].handoff_targets
    synthesizer_targets = agent_specs_by_id[H1_LITE_AGENT_IDS[H1LiteRole.SYNTHESIZER]].handoff_targets

    if intake_targets != [H1_LITE_AGENT_IDS[H1LiteRole.PLANNER]]:
        raise ValueError("H1-lite intake must hand off only to planner.")
    if planner_targets != [H1_LITE_AGENT_IDS[H1LiteRole.SYNTHESIZER]]:
        raise ValueError("H1-lite planner must hand off only to synthesizer.")
    if synthesizer_targets:
        raise ValueError("H1-lite synthesizer must be terminal (no handoff targets).")
