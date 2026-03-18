from __future__ import annotations

from fractal_agent_lab.core.contracts import ManagerSpec, WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec


H1_WORKFLOW_ID = "h1.manager.v1"
H1_SCHEMA_CONTRACT = "h1.workflow.v1"
H1_INPUT_SCHEMA_REF = "h1.input.v1"
H1_OUTPUT_SCHEMA_REF = "h1.manager.output.v1"

H1_MANAGER_STEP_ID = "synthesizer"
H1_WORKER_STEP_IDS: tuple[str, ...] = ("intake", "planner", "critic")

H1_MANAGER_AGENT_ID = "h1_synthesizer_agent"
H1_INTAKE_AGENT_ID = "h1_intake_agent"
H1_PLANNER_AGENT_ID = "h1_planner_agent"
H1_CRITIC_AGENT_ID = "h1_critic_agent"


def build_h1_manager_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H1_WORKFLOW_ID,
        name="H1 Startup Idea Refinement Manager Baseline",
        version="1.0.0",
        execution_mode=WorkflowExecutionMode.MANAGER,
        steps=[
            WorkflowStepSpec(
                step_id=H1_MANAGER_STEP_ID,
                agent_id=H1_MANAGER_AGENT_ID,
                description="Manager and finalizer for H1 worker outputs.",
            ),
            WorkflowStepSpec(
                step_id="intake",
                agent_id=H1_INTAKE_AGENT_ID,
                description="Normalize startup idea input into a structured brief.",
            ),
            WorkflowStepSpec(
                step_id="planner",
                agent_id=H1_PLANNER_AGENT_ID,
                description="Build validation plan and expose top assumptions.",
            ),
            WorkflowStepSpec(
                step_id="critic",
                agent_id=H1_CRITIC_AGENT_ID,
                description="Challenge assumptions and identify weak points.",
            ),
        ],
        entrypoint_step_id=H1_MANAGER_STEP_ID,
        input_schema_ref=H1_INPUT_SCHEMA_REF,
        output_schema_ref=H1_OUTPUT_SCHEMA_REF,
        manager_spec=ManagerSpec(
            manager_step_id=H1_MANAGER_STEP_ID,
            worker_step_ids=list(H1_WORKER_STEP_IDS),
            max_turns=6,
            allow_revisit_workers=False,
        ),
        metadata={
            "source": "track_c.l1_a",
            "hero_workflow": "H1",
            "variant": "manager",
            "schema_contract": H1_SCHEMA_CONTRACT,
        },
    )
