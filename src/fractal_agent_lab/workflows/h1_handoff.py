from __future__ import annotations

from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.workflows.h1 import (
    H1_CRITIC_AGENT_ID,
    H1_INPUT_SCHEMA_REF,
    H1_INTAKE_AGENT_ID,
    H1_MANAGER_AGENT_ID,
    H1_PLANNER_AGENT_ID,
    H1_SCHEMA_CONTRACT,
)


H1_HANDOFF_WORKFLOW_ID = "h1.handoff.v1"
H1_HANDOFF_OUTPUT_SCHEMA_REF = "h1.handoff.output.v1"

H1_HANDOFF_ENTRYPOINT_STEP_ID = "intake"
H1_HANDOFF_STEP_IDS: tuple[str, ...] = ("intake", "planner", "critic", "synthesizer")


def build_h1_handoff_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H1_HANDOFF_WORKFLOW_ID,
        name="H1 Handoff Chain Variant v1",
        version="1.0.0",
        execution_mode=WorkflowExecutionMode.HANDOFF,
        steps=[
            WorkflowStepSpec(
                step_id="intake",
                agent_id=H1_INTAKE_AGENT_ID,
                description="Normalize startup idea input and hand off to planner.",
            ),
            WorkflowStepSpec(
                step_id="planner",
                agent_id=H1_PLANNER_AGENT_ID,
                description="Build validation plan and hand off to critic.",
            ),
            WorkflowStepSpec(
                step_id="critic",
                agent_id=H1_CRITIC_AGENT_ID,
                description="Stress-test assumptions and hand off to synthesizer.",
            ),
            WorkflowStepSpec(
                step_id="synthesizer",
                agent_id=H1_MANAGER_AGENT_ID,
                description="Finalize handoff chain output package.",
            ),
        ],
        entrypoint_step_id=H1_HANDOFF_ENTRYPOINT_STEP_ID,
        input_schema_ref=H1_INPUT_SCHEMA_REF,
        output_schema_ref=H1_HANDOFF_OUTPUT_SCHEMA_REF,
        metadata={
            "source": "track_c.l1_g",
            "hero_workflow": "H1",
            "variant": "handoff",
            "baseline_for": "h1.manager.v1",
            "schema_contract": H1_SCHEMA_CONTRACT,
        },
    )
