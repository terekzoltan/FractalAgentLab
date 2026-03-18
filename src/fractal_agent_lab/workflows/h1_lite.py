from __future__ import annotations

from fractal_agent_lab.agents import (
    H1_LITE_AGENT_IDS,
    build_h1_lite_agent_specs,
    validate_h1_lite_agent_specs,
)
from fractal_agent_lab.core.contracts import AgentSpec
from fractal_agent_lab.agents.h1_lite.roles import H1LiteRole
from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec


H1_LITE_WORKFLOW_ID = "h1.lite"


def build_h1_lite_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H1_LITE_WORKFLOW_ID,
        name="H1 Lite Startup Idea Refinement",
        execution_mode=WorkflowExecutionMode.LINEAR,
        steps=[
            WorkflowStepSpec(
                step_id="intake",
                agent_id=H1_LITE_AGENT_IDS[H1LiteRole.INTAKE],
                description="Normalize startup idea input into structured brief.",
            ),
            WorkflowStepSpec(
                step_id="planner",
                agent_id=H1_LITE_AGENT_IDS[H1LiteRole.PLANNER],
                description="Build validation and risk analysis plan.",
            ),
            WorkflowStepSpec(
                step_id="synthesizer",
                agent_id=H1_LITE_AGENT_IDS[H1LiteRole.SYNTHESIZER],
                description="Produce final H1-lite recommendation package.",
            ),
        ],
        metadata={
            "source": "track_c.f0_k",
            "hero_workflow": "H1",
            "variant": "lite",
        },
    )


def build_h1_lite_agent_pack() -> dict[str, AgentSpec]:
    pack = build_h1_lite_agent_specs()
    validate_h1_lite_agent_specs(pack)
    return pack
