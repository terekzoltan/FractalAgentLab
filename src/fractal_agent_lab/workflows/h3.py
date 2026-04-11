from __future__ import annotations

from fractal_agent_lab.core.contracts import ManagerSpec, WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec


H3_WORKFLOW_ID = "h3.manager.v1"
H3_SCHEMA_CONTRACT = "h3.workflow.v1"
H3_INPUT_SCHEMA_REF = "h3.input.v1"
H3_OUTPUT_SCHEMA_REF = "h3.manager.output.v1"

H3_MANAGER_STEP_ID = "synthesizer"
H3_WORKER_STEP_IDS: tuple[str, ...] = ("intake", "planner", "systems", "critic")

H3_MANAGER_AGENT_ID = "h3_synthesizer_agent"
H3_INTAKE_AGENT_ID = "h3_intake_agent"
H3_PLANNER_AGENT_ID = "h3_planner_agent"
H3_SYSTEMS_AGENT_ID = "h3_systems_agent"
H3_CRITIC_AGENT_ID = "h3_critic_agent"


def build_h3_manager_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H3_WORKFLOW_ID,
        name="H3 Architecture Review Manager Baseline",
        version="1.0.0",
        execution_mode=WorkflowExecutionMode.MANAGER,
        steps=[
            WorkflowStepSpec(
                step_id=H3_MANAGER_STEP_ID,
                agent_id=H3_MANAGER_AGENT_ID,
                description="Manager and finalizer for H3 worker outputs.",
            ),
            WorkflowStepSpec(
                step_id="intake",
                agent_id=H3_INTAKE_AGENT_ID,
                description="Normalize architecture-review scope and evidence boundaries.",
            ),
            WorkflowStepSpec(
                step_id="planner",
                agent_id=H3_PLANNER_AGENT_ID,
                description="Define review sequence and focus areas for architecture inspection.",
            ),
            WorkflowStepSpec(
                step_id="systems",
                agent_id=H3_SYSTEMS_AGENT_ID,
                description="Assess system boundaries, interfaces, and module responsibilities.",
            ),
            WorkflowStepSpec(
                step_id="critic",
                agent_id=H3_CRITIC_AGENT_ID,
                description="Challenge architecture assumptions and surface merge-risk pressure points.",
            ),
        ],
        entrypoint_step_id=H3_MANAGER_STEP_ID,
        input_schema_ref=H3_INPUT_SCHEMA_REF,
        output_schema_ref=H3_OUTPUT_SCHEMA_REF,
        manager_spec=ManagerSpec(
            manager_step_id=H3_MANAGER_STEP_ID,
            worker_step_ids=list(H3_WORKER_STEP_IDS),
            max_turns=8,
            allow_revisit_workers=False,
        ),
        metadata={
            "source": "track_c.r3_e",
            "hero_workflow": "H3",
            "variant": "manager",
            "schema_contract": H3_SCHEMA_CONTRACT,
        },
    )
