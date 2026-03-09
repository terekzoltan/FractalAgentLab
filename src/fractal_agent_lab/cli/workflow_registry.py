from __future__ import annotations

from collections.abc import Callable

from fractal_agent_lab.core.contracts import WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec


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


def _wave0_demo_workflow() -> WorkflowSpec:
    return WorkflowSpec(
        workflow_id="wave0.demo",
        name="Wave 0 Demo Workflow",
        execution_mode=WorkflowExecutionMode.MANAGER,
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


_WORKFLOWS: dict[str, Callable[[], WorkflowSpec]] = {"wave0.demo": _wave0_demo_workflow}
