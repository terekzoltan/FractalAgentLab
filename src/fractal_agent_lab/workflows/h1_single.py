from __future__ import annotations

from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec


H1_SINGLE_WORKFLOW_ID = "h1.single.v1"
H1_SINGLE_SCHEMA_CONTRACT = "h1.workflow.v1"
H1_SINGLE_INPUT_SCHEMA_REF = "h1.input.v1"
H1_SINGLE_OUTPUT_SCHEMA_REF = "h1.single.output.v1"

H1_SINGLE_STEP_ID = "single"
H1_SINGLE_AGENT_ID = "h1_single_agent"


def build_h1_single_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H1_SINGLE_WORKFLOW_ID,
        name="H1 Single-Agent Baseline v1",
        version="1.0.0",
        execution_mode=WorkflowExecutionMode.LINEAR,
        steps=[
            WorkflowStepSpec(
                step_id=H1_SINGLE_STEP_ID,
                agent_id=H1_SINGLE_AGENT_ID,
                description="Single-agent baseline synthesis for H1 comparison.",
            ),
        ],
        entrypoint_step_id=H1_SINGLE_STEP_ID,
        input_schema_ref=H1_SINGLE_INPUT_SCHEMA_REF,
        output_schema_ref=H1_SINGLE_OUTPUT_SCHEMA_REF,
        metadata={
            "source": "track_e.l1_d",
            "hero_workflow": "H1",
            "variant": "single_agent_baseline",
            "baseline_for": "h1.manager.v1",
            "schema_contract": H1_SINGLE_SCHEMA_CONTRACT,
        },
    )
