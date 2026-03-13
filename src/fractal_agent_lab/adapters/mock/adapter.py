from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult
from fractal_agent_lab.core.errors import StepExecutionError


ScriptedResponder = Callable[[AdapterStepRequest], Any]


@dataclass(slots=True)
class MockAdapter:
    name: str = "mock"
    scripted_responses: Mapping[str, Any] = field(default_factory=dict)
    fail_steps: Mapping[str, str] = field(default_factory=dict)

    def execute_step(self, request: AdapterStepRequest) -> AdapterStepResult:
        if request.step_id in self.fail_steps:
            raise StepExecutionError(
                f"MockAdapter forced failure for step '{request.step_id}'.",
                details={
                    "step_id": request.step_id,
                    "agent_id": request.agent_id,
                    "reason": self.fail_steps[request.step_id],
                },
            )

        output = self._resolve_output(request)
        return AdapterStepResult(
            output=output,
            provider=self.name,
            model=request.model,
            raw={
                "mock": True,
                "workflow_id": request.workflow_id,
                "step_id": request.step_id,
                "agent_id": request.agent_id,
                "role": request.role,
                "model_policy_ref": request.model_policy_ref,
                "prompt_version": request.prompt_version,
                "instructions_present": bool(request.instructions),
            },
        )

    def _resolve_output(self, request: AdapterStepRequest) -> Any:
        candidate = self.scripted_responses.get(request.step_id)
        if candidate is None:
            candidate = self.scripted_responses.get(request.agent_id)
        if candidate is None:
            candidate = self.scripted_responses.get("__default__")

        if callable(candidate):
            responder: ScriptedResponder = candidate
            return responder(request)
        if candidate is not None:
            return candidate
        if request.workflow_id == "h1.lite":
            return self._build_h1_lite_output(request)
        return {
            "message": (
                f"Mock output for workflow '{request.workflow_id}', step '{request.step_id}', "
                f"agent '{request.agent_id}'."
            ),
            "role": request.role,
            "model": request.model,
            "model_policy_ref": request.model_policy_ref,
            "prompt_version": request.prompt_version,
        }

    def _build_h1_lite_output(self, request: AdapterStepRequest) -> dict[str, Any]:
        idea = _clean_text(request.input_payload.get("idea"), fallback="Unspecified startup idea")
        intake_output = _step_output(request, "intake")
        planner_output = _step_output(request, "planner")

        if request.step_id == "intake":
            return {
                "idea_summary": idea,
                "target_user": "Early-stage operators who need structured founder support.",
                "core_problem": f"The user needs a sharper version of: {idea}.",
                "assumptions": [
                    "A fast first-pass refinement workflow is more useful than broad brainstorming.",
                    "The first user values clarity, risk framing, and concrete next steps.",
                ],
                "open_questions": [
                    "What exact founder segment feels this pain most intensely?",
                    "Which workflow output would make the idea immediately more actionable?",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "planner":
            normalized_summary = _clean_text(intake_output.get("idea_summary"), fallback=idea)
            return {
                "validation_axes": [
                    "problem urgency",
                    "founder workflow fit",
                    "differentiation against generic AI assistants",
                ],
                "top_risks": [
                    f"The concept '{normalized_summary}' may still be too broad for an MVP.",
                    "The target user may not pay for refinement unless it saves clear decision time.",
                ],
                "unknowns_to_test": [
                    "Which one user persona gets immediate value?",
                    "What narrow output format is strongest for a first release?",
                ],
                "evidence_needed": [
                    "3-5 founder interviews about ideation-to-MVP friction",
                    "A lightweight prototype used on one real startup idea",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
                "based_on_intake": normalized_summary,
            }

        if request.step_id == "synthesizer":
            strongest_assumptions = intake_output.get("assumptions")
            if not isinstance(strongest_assumptions, list) or not strongest_assumptions:
                strongest_assumptions = [
                    "A structured refinement workflow is more useful than open-ended brainstorming.",
                ]

            weak_points = planner_output.get("top_risks")
            if not isinstance(weak_points, list) or not weak_points:
                weak_points = ["MVP scope is still broad and needs tighter positioning."]

            return {
                "refined_concept": (
                    "An AI founder assistant that turns raw startup ideas into a structured brief, "
                    "risk map, and next-step validation plan."
                ),
                "strongest_assumptions": strongest_assumptions,
                "weak_points": weak_points,
                "alternatives": [
                    "Narrow the product to founder interview prep only.",
                    "Turn it into a project decomposition assistant for technical builders.",
                ],
                "recommended_mvp_direction": (
                    "Ship a constrained founder-idea refinement flow with explicit sections and a "
                    "validation-first output rather than a general startup copilot."
                ),
                "next_3_validation_steps": [
                    "Interview 3 founders about their earliest idea-clarification pain.",
                    "Run this H1-lite flow on 5 real ideas and compare usefulness manually.",
                    "Test whether structured outputs improve next-step decision speed.",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        return {
            "message": f"No specialized mock output configured for step '{request.step_id}'.",
            "role": request.role,
            "model": request.model,
            "model_policy_ref": request.model_policy_ref,
            "prompt_version": request.prompt_version,
        }


def _step_output(request: AdapterStepRequest, step_id: str) -> dict[str, Any]:
    step_results = request.context.get("step_results")
    if not isinstance(step_results, Mapping):
        return {}

    step_result = step_results.get(step_id)
    if not isinstance(step_result, Mapping):
        return {}

    output = step_result.get("output")
    if isinstance(output, Mapping):
        return dict(output)
    return {}


def _clean_text(value: Any, *, fallback: str) -> str:
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned:
            return cleaned
    return fallback
