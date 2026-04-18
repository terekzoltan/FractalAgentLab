from __future__ import annotations

from fractal_agent_lab.core.contracts import ManagerSpec, WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec


H4_WAVE_START_WORKFLOW_ID = "h4.wave_start.v1"
H4_WAVE_START_SCHEMA_CONTRACT = "h4.wave_start.workflow.v1"
H4_WAVE_START_INPUT_SCHEMA_REF = "h4.wave_start.input.v1"
H4_WAVE_START_OUTPUT_SCHEMA_REF = "h4.wave_start.output.v1"

H4_WAVE_START_MANAGER_STEP_ID = "synthesizer"
H4_WAVE_START_WORKER_STEP_IDS: tuple[str, ...] = ("repo_intake", "architect_critic")

H4_WAVE_START_SYNTHESIZER_AGENT_ID = "h4_synthesizer_agent"
H4_WAVE_START_REPO_INTAKE_AGENT_ID = "h4_repo_intake_agent"
H4_WAVE_START_ARCHITECT_CRITIC_AGENT_ID = "h4_architect_critic_agent"

H4_SEQ_NEXT_WORKFLOW_ID = "h4.seq_next.v1"
H4_SEQ_NEXT_SCHEMA_CONTRACT = "h4.seq_next.workflow.v1"
H4_SEQ_NEXT_INPUT_SCHEMA_REF = "h4.seq_next.input.v1"
H4_SEQ_NEXT_OUTPUT_SCHEMA_REF = "h4.seq_next.output.v1"

H4_SEQ_NEXT_MANAGER_STEP_ID = "synthesizer"
H4_SEQ_NEXT_WORKER_STEP_IDS: tuple[str, ...] = ("repo_intake", "planner", "architect_critic")

H4_SEQ_NEXT_SYNTHESIZER_AGENT_ID = "h4_synthesizer_agent"
H4_SEQ_NEXT_REPO_INTAKE_AGENT_ID = "h4_repo_intake_agent"
H4_SEQ_NEXT_PLANNER_AGENT_ID = "h4_planner_agent"
H4_SEQ_NEXT_ARCHITECT_CRITIC_AGENT_ID = "h4_architect_critic_agent"


def build_h4_wave_start_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H4_WAVE_START_WORKFLOW_ID,
        name="H4 Wave Start Repo Intake Manager Baseline",
        version="1.0.0",
        execution_mode=WorkflowExecutionMode.MANAGER,
        steps=[
            WorkflowStepSpec(
                step_id=H4_WAVE_START_MANAGER_STEP_ID,
                agent_id=H4_WAVE_START_SYNTHESIZER_AGENT_ID,
                description="Manager and finalizer for H4 wave-start repo-intake outputs.",
            ),
            WorkflowStepSpec(
                step_id="repo_intake",
                agent_id=H4_WAVE_START_REPO_INTAKE_AGENT_ID,
                description="Gather repo-aware intake summary, context boundaries, and uncertainty notes.",
            ),
            WorkflowStepSpec(
                step_id="architect_critic",
                agent_id=H4_WAVE_START_ARCHITECT_CRITIC_AGENT_ID,
                description="Stress-test intake for sequencing, shared-zone cautions, and risk pressure points.",
            ),
        ],
        entrypoint_step_id=H4_WAVE_START_MANAGER_STEP_ID,
        input_schema_ref=H4_WAVE_START_INPUT_SCHEMA_REF,
        output_schema_ref=H4_WAVE_START_OUTPUT_SCHEMA_REF,
        manager_spec=ManagerSpec(
            manager_step_id=H4_WAVE_START_MANAGER_STEP_ID,
            worker_step_ids=list(H4_WAVE_START_WORKER_STEP_IDS),
            max_turns=6,
            allow_revisit_workers=False,
        ),
        metadata={
            "source": "track_c.cv1_a",
            "hero_workflow": "H4",
            "variant": "wave_start",
            "schema_contract": H4_WAVE_START_SCHEMA_CONTRACT,
            "strict_manager_control": True,
        },
    )


def build_h4_seq_next_workflow_spec() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id=H4_SEQ_NEXT_WORKFLOW_ID,
        name="H4 Seq Next Planning Manager Baseline",
        version="1.0.0",
        execution_mode=WorkflowExecutionMode.MANAGER,
        steps=[
            WorkflowStepSpec(
                step_id=H4_SEQ_NEXT_MANAGER_STEP_ID,
                agent_id=H4_SEQ_NEXT_SYNTHESIZER_AGENT_ID,
                description="Manager and finalizer for H4 seq-next planning outputs.",
            ),
            WorkflowStepSpec(
                step_id="repo_intake",
                agent_id=H4_SEQ_NEXT_REPO_INTAKE_AGENT_ID,
                description="Refresh repo-aware intake, touched-surface hypotheses, and frontier framing.",
            ),
            WorkflowStepSpec(
                step_id="planner",
                agent_id=H4_SEQ_NEXT_PLANNER_AGENT_ID,
                description="Generate explicit step ordering, dependencies, test intent, and documentation obligations.",
            ),
            WorkflowStepSpec(
                step_id="architect_critic",
                agent_id=H4_SEQ_NEXT_ARCHITECT_CRITIC_AGENT_ID,
                description="Stress-test the plan for shared-zone cautions, sequencing risks, and non-goal drift.",
            ),
        ],
        entrypoint_step_id=H4_SEQ_NEXT_MANAGER_STEP_ID,
        input_schema_ref=H4_SEQ_NEXT_INPUT_SCHEMA_REF,
        output_schema_ref=H4_SEQ_NEXT_OUTPUT_SCHEMA_REF,
        manager_spec=ManagerSpec(
            manager_step_id=H4_SEQ_NEXT_MANAGER_STEP_ID,
            worker_step_ids=list(H4_SEQ_NEXT_WORKER_STEP_IDS),
            max_turns=8,
            allow_revisit_workers=False,
        ),
        metadata={
            "source": "track_c.cv1_b",
            "hero_workflow": "H4",
            "variant": "seq_next",
            "schema_contract": H4_SEQ_NEXT_SCHEMA_CONTRACT,
            "strict_manager_control": True,
        },
    )
