from __future__ import annotations

from collections.abc import Callable

from fractal_agent_lab.agents import (
    build_h2_agent_pack,
    build_h1_agent_pack,
    build_h1_handoff_agent_pack,
    build_h1_single_agent_pack,
)
from fractal_agent_lab.core.contracts import AgentSpec
from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.workflows import (
    H2_WORKFLOW_ID,
    H1_HANDOFF_WORKFLOW_ID,
    H1_WORKFLOW_ID,
    H1_LITE_WORKFLOW_ID,
    H1_SINGLE_WORKFLOW_ID,
    build_h2_manager_workflow_spec,
    build_h1_handoff_workflow_spec,
    build_h1_manager_workflow_spec,
    build_h1_lite_agent_pack,
    build_h1_lite_workflow_spec,
    build_h1_single_workflow_spec,
)


def list_workflow_ids() -> list[str]:
    return sorted(_WORKFLOWS)


def get_workflow_spec(workflow_id: str) -> WorkflowSpec:
    try:
        factory = _WORKFLOWS[workflow_id]
    except KeyError as error:
        available = ", ".join(list_workflow_ids()) or "none"
        raise ValueError(
            f"Unknown workflow '{workflow_id}'. Available workflows: {available}.",
        ) from error
    return factory()


def get_workflow_agent_specs(workflow_id: str) -> dict[str, AgentSpec]:
    try:
        factory = _WORKFLOW_AGENT_SPECS[workflow_id]
    except KeyError as error:
        available = ", ".join(list_workflow_ids()) or "none"
        raise ValueError(
            f"Unknown workflow '{workflow_id}'. Available workflows: {available}.",
        ) from error
    return factory()


def _wave0_demo_workflow() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id="wave0.demo",
        name="Wave 0 Demo Workflow",
        execution_mode=WorkflowExecutionMode.LINEAR,
        steps=[
            WorkflowStepSpec(
                step_id="intake",
                agent_id="intake_agent",
                description="Collect user input and normalize it.",
            ),
            WorkflowStepSpec(
                step_id="synthesis",
                agent_id="synth_agent",
                description="Produce a compact synthesis output.",
            ),
        ],
        metadata={"source": "cli.wave0"},
    )


_WORKFLOWS: dict[str, Callable[[], WorkflowSpec]] = {
    H2_WORKFLOW_ID: build_h2_manager_workflow_spec,
    H1_HANDOFF_WORKFLOW_ID: build_h1_handoff_workflow_spec,
    H1_WORKFLOW_ID: build_h1_manager_workflow_spec,
    H1_SINGLE_WORKFLOW_ID: build_h1_single_workflow_spec,
    H1_LITE_WORKFLOW_ID: build_h1_lite_workflow_spec,
    "wave0.demo": _wave0_demo_workflow,
}

_WORKFLOW_AGENT_SPECS: dict[str, Callable[[], dict[str, AgentSpec]]] = {
    H2_WORKFLOW_ID: build_h2_agent_pack,
    H1_HANDOFF_WORKFLOW_ID: build_h1_handoff_agent_pack,
    H1_WORKFLOW_ID: build_h1_agent_pack,
    H1_SINGLE_WORKFLOW_ID: build_h1_single_agent_pack,
    H1_LITE_WORKFLOW_ID: build_h1_lite_agent_pack,
    "wave0.demo": dict,
}
