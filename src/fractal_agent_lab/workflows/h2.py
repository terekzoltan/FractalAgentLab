from __future__ import annotations

from fractal_agent_lab.core.contracts import ManagerSpec, WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec


H2_WORKFLOW_ID = "h2.manager.v1"
H2_SCHEMA_CONTRACT = "h2.workflow.v1"
H2_INPUT_SCHEMA_REF = "h2.input.v1"
H2_OUTPUT_SCHEMA_REF = "h2.manager.output.v1"

H2_MANAGER_STEP_ID = "synthesizer"
H2_WORKER_STEP_IDS: tuple[str, ...] = ("intake", "planner", "architect", "critic")

H2_MANAGER_AGENT_ID = "h2_synthesizer_agent"
H2_INTAKE_AGENT_ID = "h2_intake_agent"
H2_PLANNER_AGENT_ID = "h2_planner_agent"
H2_ARCHITECT_AGENT_ID = "h2_architect_agent"
H2_CRITIC_AGENT_ID = "h2_critic_agent"


def build_h2_manager_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H2_WORKFLOW_ID,
        name="H2 Project Decomposition Manager Baseline",
        version="1.0.0",
        execution_mode=WorkflowExecutionMode.MANAGER,
        steps=[
            WorkflowStepSpec(
                step_id=H2_MANAGER_STEP_ID,
                agent_id=H2_MANAGER_AGENT_ID,
                description="Manager and finalizer for H2 worker outputs.",
            ),
            WorkflowStepSpec(
                step_id="intake",
                agent_id=H2_INTAKE_AGENT_ID,
                description="Normalize broad project goal into a structured project brief.",
            ),
            WorkflowStepSpec(
                step_id="planner",
                agent_id=H2_PLANNER_AGENT_ID,
                description="Build decomposition strategy, sequencing lens, and constraints.",
            ),
            WorkflowStepSpec(
                step_id="architect",
                agent_id=H2_ARCHITECT_AGENT_ID,
                description="Shape tracks, modules, phases, and dependency structure.",
            ),
            WorkflowStepSpec(
                step_id="critic",
                agent_id=H2_CRITIC_AGENT_ID,
                description="Challenge scope assumptions and surface key risk zones.",
            ),
        ],
        entrypoint_step_id=H2_MANAGER_STEP_ID,
        input_schema_ref=H2_INPUT_SCHEMA_REF,
        output_schema_ref=H2_OUTPUT_SCHEMA_REF,
        manager_spec=ManagerSpec(
            manager_step_id=H2_MANAGER_STEP_ID,
            worker_step_ids=list(H2_WORKER_STEP_IDS),
            max_turns=8,
            allow_revisit_workers=False,
        ),
        metadata={
            "source": "track_c.r3_a",
            "hero_workflow": "H2",
            "variant": "manager",
            "schema_contract": H2_SCHEMA_CONTRACT,
        },
    )
