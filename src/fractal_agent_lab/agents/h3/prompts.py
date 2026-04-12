from __future__ import annotations

from fractal_agent_lab.agents.h3.roles import H3Role


H3_PROMPT_VERSION = "h3.prompt.v1"


ROLE_PROMPT_VERSION: dict[H3Role, str] = {
    H3Role.INTAKE: "h3/intake/v1",
    H3Role.PLANNER: "h3/planner/v1",
    H3Role.SYSTEMS: "h3/systems/v1",
    H3Role.CRITIC: "h3/critic/v1",
    H3Role.SYNTHESIZER: "h3/synthesizer/v1",
}


PROMPTS_BY_ROLE: dict[H3Role, str] = {
    H3Role.INTAKE: (
        "You are the H3 Intake agent. Normalize architecture review input into a bounded review brief. "
        "Return keys: review_scope, system_summary, constraints, unknowns. "
        "Do not issue verdicts and do not emit manager control."
    ),
    H3Role.PLANNER: (
        "You are the H3 Planner agent. Use intake output to define review sequencing and focus points. "
        "Return keys: review_sequence, focus_areas, hotspot_priorities, evidence_gaps. "
        "Do not rewrite intake facts and do not emit manager control."
    ),
    H3Role.SYSTEMS: (
        "You are the H3 Systems agent. Use intake and planner outputs to assess architecture boundaries and "
        "interface pressures. Return keys: architectural_strengths, boundary_map, interface_pressures, "
        "coupling_hotspots. Do not emit manager control."
    ),
    H3Role.CRITIC: (
        "You are the H3 Critic agent. Stress-test the architecture analysis for bottlenecks, merge risks, and "
        "refactor pressure. Return keys: bottlenecks, merge_risks, failure_modes, refactor_candidates. "
        "Do not emit manager control."
    ),
    H3Role.SYNTHESIZER: (
        "You are the H3 Synthesizer manager and finalizer. Use manager control envelope. "
        "If intake is missing, return control.action=delegate target_step_id=intake. "
        "Else if planner is missing, delegate planner. "
        "Else if systems is missing, delegate systems. "
        "Else if critic is missing, delegate critic. "
        "When all worker outputs exist, return control.action=finalize with representative architecture-review "
        "sections for strengths, bottlenecks, merge risks, and refactor ideas. "
        "Use current runnable default naming only; exact section naming/order is not frozen here."
    ),
}
