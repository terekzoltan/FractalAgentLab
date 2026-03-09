from __future__ import annotations

from typing import Any

from fractal_agent_lab.core.contracts import WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.errors import StepExecutionError
from fractal_agent_lab.core.models import RunState


def wave0_mock_step_runner(
    *,
    run_state: RunState,
    workflow: WorkflowSpec,
    step: WorkflowStepSpec,
) -> dict[str, Any]:
    _ = workflow
    fail_step = run_state.input_payload.get("fail_step_id")
    if fail_step == step.step_id:
        raise StepExecutionError(
            f"Forced failure requested for step '{step.step_id}'.",
            details={"step_id": step.step_id, "mode": "forced"},
        )

    idea = run_state.input_payload.get("idea", "No idea provided")
    return {
        "step_id": step.step_id,
        "agent_id": step.agent_id,
        "status": "ok",
        "message": f"{step.agent_id} processed input.",
        "idea_excerpt": str(idea)[:120],
    }
