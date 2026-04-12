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
        if request.workflow_id == "h1.handoff.v1":
            return self._build_h1_handoff_output(request)
        if request.workflow_id == "h1.manager.v1":
            return self._build_h1_manager_output(request)
        if request.workflow_id == "h2.manager.v1":
            return self._build_h2_manager_output(request)
        if request.workflow_id == "h3.manager.v1":
            return self._build_h3_manager_output(request)
        if request.workflow_id == "h1.single.v1":
            return self._build_h1_single_output(request)
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

    def _build_h1_manager_output(self, request: AdapterStepRequest) -> dict[str, Any]:
        idea = _clean_text(request.input_payload.get("idea"), fallback="Unspecified startup idea")
        intake_output = _step_output(request, "intake")
        planner_output = _step_output(request, "planner")
        critic_output = _step_output(request, "critic")

        if request.step_id == "synthesizer":
            if not intake_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "intake",
                        "reason": "missing_intake_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not planner_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "planner",
                        "reason": "missing_planner_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not critic_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "critic",
                        "reason": "missing_critic_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }

            strongest_assumptions = intake_output.get("assumptions")
            if not isinstance(strongest_assumptions, list) or not strongest_assumptions:
                strongest_assumptions = [
                    "Founders value concrete problem framing before broad ideation.",
                ]

            weak_points = critic_output.get("weak_points")
            if not isinstance(weak_points, list) or not weak_points:
                weak_points = ["Differentiation against generic AI assistants remains weak."]

            alternatives = critic_output.get("alternatives")
            if not isinstance(alternatives, list) or not alternatives:
                alternatives = ["Narrow scope to founder interview preparation workflow."]

            return {
                "control": {
                    "action": "finalize",
                    "reason": "all_workers_completed",
                    "output": {
                        "clarified_idea": (
                            "AI startup refinement assistant that structures idea framing, "
                            "validation planning, and critical stress-testing in one guided flow."
                        ),
                        "strongest_assumptions": strongest_assumptions,
                        "weak_points": weak_points,
                        "alternatives": alternatives,
                        "recommended_mvp_direction": (
                            "Ship a constrained H1 workflow that produces structured outputs and "
                            "validation-first next actions for founders."
                        ),
                        "next_3_validation_steps": [
                            "Interview 3 target founders about early idea validation pain.",
                            "Run the H1 manager workflow on 5 real ideas and review usefulness.",
                            "Measure whether structured outputs shorten decision time.",
                        ],
                    },
                },
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "intake":
            return {
                "idea_summary": idea,
                "target_user": "Early-stage founders validating first product direction.",
                "core_problem": f"The founder needs sharper positioning for: {idea}.",
                "assumptions": [
                    "Structured critique is more useful than open brainstorming.",
                    "Validation planning increases confidence before MVP build.",
                ],
                "constraints": [
                    "Limited time for discovery.",
                    "Need concrete next actions after each iteration.",
                ],
                "open_questions": [
                    "Which founder segment has the strongest urgency?",
                    "Which output format drives immediate action?",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "planner":
            _require_manager_context(request=request, required_step_id="intake")
            normalized_summary = _clean_text(intake_output.get("idea_summary"), fallback=idea)
            return {
                "validation_axes": [
                    "problem urgency",
                    "solution credibility",
                    "distribution feasibility",
                ],
                "hypothesis_to_test": [
                    f"Founders will pay for tighter framing of '{normalized_summary}'.",
                    "A guided manager workflow beats single-shot ideation quality.",
                ],
                "riskiest_assumptions": [
                    "Users prefer structured outputs over conversational free-form answers.",
                    "The proposed flow can stay narrow enough for MVP scope.",
                ],
                "evidence_needed": [
                    "Interview notes from 3-5 founders",
                    "Usability feedback from first workflow runs",
                ],
                "first_experiments": [
                    "Run concierge tests with manual synthesis",
                    "Compare H1 manager output against single-agent output",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "critic":
            _require_manager_context(request=request, required_step_id="intake")
            _require_manager_context(request=request, required_step_id="planner")
            return {
                "weak_points": [
                    "Value proposition may overlap with broad-purpose assistants.",
                    "Target segment may still be too broad.",
                ],
                "failure_modes": [
                    "Outputs remain generic and do not change founder decisions.",
                    "Workflow feels too long relative to perceived value.",
                ],
                "hidden_dependencies": [
                    "Quality depends on user providing sufficiently concrete input.",
                    "Model quality drift can reduce consistency across runs.",
                ],
                "counterarguments": [
                    "Some founders may prefer direct MVP scoping over idea refinement.",
                    "General AI tools may be enough for low-complexity ideas.",
                ],
                "alternatives": [
                    "Narrow to one niche: technical founders pre-MVP.",
                    "Focus on critic-only addon instead of full workflow assistant.",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        return {
            "message": f"No specialized h1.manager.v1 output for step '{request.step_id}'.",
            "role": request.role,
            "model": request.model,
            "model_policy_ref": request.model_policy_ref,
            "prompt_version": request.prompt_version,
        }

    def _build_h2_manager_output(self, request: AdapterStepRequest) -> dict[str, Any]:
        goal = _clean_text(request.input_payload.get("goal"), fallback="Unspecified project goal")
        intake_output = _step_output(request, "intake")
        planner_output = _step_output(request, "planner")
        architect_output = _step_output(request, "architect")
        critic_output = _step_output(request, "critic")

        if request.step_id == "synthesizer":
            if not intake_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "intake",
                        "reason": "missing_intake_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not planner_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "planner",
                        "reason": "missing_planner_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not architect_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "architect",
                        "reason": "missing_architect_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not critic_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "critic",
                        "reason": "missing_critic_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }

            project_summary = _require_mock_text_field(
                request=request,
                step_id="intake",
                output=intake_output,
                field_name="project_summary",
            )
            tracks = _require_mock_list_field(
                request=request,
                step_id="architect",
                output=architect_output,
                field_name="tracks",
            )
            modules = _require_mock_list_field(
                request=request,
                step_id="architect",
                output=architect_output,
                field_name="modules",
            )
            phases = _require_mock_list_field(
                request=request,
                step_id="architect",
                output=architect_output,
                field_name="phases",
            )
            dependency_order = _require_mock_list_field(
                request=request,
                step_id="planner",
                output=planner_output,
                field_name="dependency_order",
            )
            implementation_waves = _require_mock_list_field(
                request=request,
                step_id="planner",
                output=planner_output,
                field_name="implementation_waves",
            )
            implementation_waves = _require_mock_wave_list_field(
                request=request,
                step_id="planner",
                values=implementation_waves,
            )
            recommended_starting_slice = _require_mock_text_field(
                request=request,
                step_id="planner",
                output=planner_output,
                field_name="recommended_starting_slice",
            )
            risk_zones = _require_mock_list_field(
                request=request,
                step_id="critic",
                output=critic_output,
                field_name="risk_zones",
            )
            open_questions = _require_mock_list_field(
                request=request,
                step_id="critic",
                output=critic_output,
                field_name="open_questions",
            )

            return {
                "control": {
                    "action": "finalize",
                    "reason": "all_workers_completed",
                    "output": {
                        "project_summary": project_summary,
                        "tracks": tracks,
                        "modules": modules,
                        "phases": phases,
                        "dependency_order": dependency_order,
                        "implementation_waves": implementation_waves,
                        "recommended_starting_slice": recommended_starting_slice,
                        "risk_zones": risk_zones,
                        "open_questions": open_questions,
                    },
                },
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "intake":
            return {
                "project_summary": goal,
                "primary_goal": "Turn broad idea into implementable decomposition plan.",
                "constraints": [
                    "Keep scope bounded to current wave sequencing.",
                    "Avoid runtime-contract churn unless justified by evidence.",
                ],
                "assumptions": [
                    "Manager workflow remains the lowest-risk orchestration baseline.",
                    "Role separation should improve decomposition clarity.",
                ],
                "unknowns": [
                    "Which decomposition slice should be first productionized path?",
                    "Where should stricter acceptance gates be introduced later?",
                ],
                "success_criteria": [
                    "Clear track/module/phase boundaries.",
                    "Dependency-aware implementation order.",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "planner":
            _require_manager_context(request=request, required_step_id="intake")
            return {
                "decomposition_strategy": ["contracts_first", "runnable_surface_second", "quality_gates_last"],
                "dependency_order": [
                    "workflow_schema",
                    "role_pack",
                    "output_template",
                    "smoke_rubric",
                ],
                "implementation_waves": [
                    {"wave": "W3-S1", "focus": ["R3-A", "R3-B", "R3-C", "R3-D"]},
                    {"wave": "W3-S2", "focus": ["R3-E", "R3-F", "R3-G", "R3-H"]},
                ],
                "recommended_starting_slice": "stabilize_h2_template_contract",
                "blocking_dependencies": ["schema_contract_alignment", "registry_binding"],
                "sequencing_rationale": "Stabilize contracts and roles before template polish and smoke finalization.",
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "architect":
            _require_manager_context(request=request, required_step_id="intake")
            _require_manager_context(request=request, required_step_id="planner")
            return {
                "tracks": ["core", "workflow", "quality"],
                "modules": ["workflows", "agents", "adapters", "tests", "docs"],
                "phases": ["contract", "pack", "template", "smoke"],
                "interface_boundaries": [
                    "workflow_spec_to_agent_pack",
                    "registry_to_executor",
                    "mock_adapter_to_runtime",
                ],
                "ownership_notes": [
                    "Track C owns workflow/agent role semantics.",
                    "Track B owns runtime/core contracts.",
                    "Track E owns smoke and acceptance quality gates.",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "critic":
            _require_manager_context(request=request, required_step_id="intake")
            _require_manager_context(request=request, required_step_id="planner")
            _require_manager_context(request=request, required_step_id="architect")
            return {
                "risk_zones": [
                    "scope_sprawl_between_r3_b_and_r3_c",
                    "registry_pack_drift",
                    "false_green_from_fallback_paths",
                ],
                "failure_modes": [
                    "Role overlap dilutes planner vs architect responsibility.",
                    "Manager finalization hides unresolved unknowns.",
                ],
                "merge_risks": [
                    "Cross-track status misalignment in coordination docs.",
                    "Implicit assumptions leaking into runtime contracts.",
                ],
                "overbuild_warnings": [
                    "Avoid H2 prompt tags before evaluation needs demand them.",
                    "Avoid CLI formatting polish before output template is frozen.",
                ],
                "open_questions": [
                    "Which final output ordering should become R3-C canonical template?",
                    "What minimum smoke rubric should block false-green in R3-D?",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        return {
            "message": f"No specialized h2.manager.v1 output for step '{request.step_id}'.",
            "role": request.role,
            "model": request.model,
            "model_policy_ref": request.model_policy_ref,
            "prompt_version": request.prompt_version,
        }

    def _build_h3_manager_output(self, request: AdapterStepRequest) -> dict[str, Any]:
        goal = _clean_text(request.input_payload.get("goal"), fallback="Unspecified architecture review goal")
        intake_output = _step_output(request, "intake")
        planner_output = _step_output(request, "planner")
        systems_output = _step_output(request, "systems")
        critic_output = _step_output(request, "critic")

        if request.step_id == "synthesizer":
            if not intake_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "intake",
                        "reason": "missing_intake_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not planner_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "planner",
                        "reason": "missing_planner_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not systems_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "systems",
                        "reason": "missing_systems_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }
            if not critic_output:
                return {
                    "control": {
                        "action": "delegate",
                        "target_step_id": "critic",
                        "reason": "missing_critic_output",
                    },
                    "role": request.role,
                    "prompt_version": request.prompt_version,
                }

            strengths = _require_mock_list_field(
                request=request,
                step_id="systems",
                output=systems_output,
                field_name="architectural_strengths",
            )
            bottlenecks = _require_mock_list_field(
                request=request,
                step_id="critic",
                output=critic_output,
                field_name="bottlenecks",
            )
            merge_risks = _require_mock_list_field(
                request=request,
                step_id="critic",
                output=critic_output,
                field_name="merge_risks",
            )
            refactor_ideas = _require_mock_list_field(
                request=request,
                step_id="critic",
                output=critic_output,
                field_name="refactor_candidates",
            )

            return {
                "control": {
                    "action": "finalize",
                    "reason": "all_workers_completed",
                    "output": {
                        "strengths": strengths,
                        "bottlenecks": bottlenecks,
                        "merge_risks": merge_risks,
                        "refactor_ideas": refactor_ideas,
                    },
                },
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "intake":
            return {
                "review_scope": goal,
                "system_summary": "Architecture review should prioritize runtime boundaries and orchestration clarity.",
                "constraints": [
                    "Keep claims grounded in observable repo surfaces.",
                    "Use canonical H3 section naming and ordering from the frozen template.",
                ],
                "unknowns": [
                    "Which hotspots carry the highest merge risk under current sprint sequencing?",
                    "Which refactor ideas are safe without cross-track contract churn?",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "planner":
            _require_manager_context(request=request, required_step_id="intake")
            return {
                "review_sequence": ["runtime_boundaries", "workflow_specs", "agent_packs", "adapters"],
                "focus_areas": ["separation_of_concerns", "integration_pressure", "test_signal_quality"],
                "hotspot_priorities": ["manager_contract_boundaries", "false_green_paths"],
                "evidence_gaps": ["real-provider variance", "cross-wave architectural debt tracking"],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "systems":
            _require_manager_context(request=request, required_step_id="intake")
            _require_manager_context(request=request, required_step_id="planner")
            return {
                "architectural_strengths": [
                    "Manager envelope compatibility remains stable across workflow families.",
                    "Workflow and agent contracts are explicitly versioned and test-covered.",
                ],
                "boundary_map": ["core/contracts", "workflows", "agents", "adapters/mock", "tests"],
                "interface_pressures": ["workflow_registry_dual_map_consistency", "prompt_version_alignment"],
                "coupling_hotspots": ["adapter_mock_vs_prompt_contract", "docs_status_vs_code_surface"],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "critic":
            _require_manager_context(request=request, required_step_id="intake")
            _require_manager_context(request=request, required_step_id="planner")
            _require_manager_context(request=request, required_step_id="systems")
            return {
                "bottlenecks": [
                    "Cross-track sequencing updates can lag behind executable code changes.",
                    "Mock-path assumptions can drift from role prompt intent without strict tests.",
                ],
                "merge_risks": [
                    "Cross-surface drift can reintroduce non-canonical H3 section naming.",
                    "Registry/pack mismatches causing non-runnable workflow ids.",
                ],
                "failure_modes": [
                    "Manager finalize without complete worker context.",
                    "Role overlap between systems and critic reducing review signal quality.",
                ],
                "refactor_candidates": [
                    "Introduce shared helpers for manager-output shape checks across workflow families.",
                    "Consolidate repeated manager-turn assertions in reusable test utilities.",
                ],
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        return {
            "message": f"No specialized h3.manager.v1 output for step '{request.step_id}'.",
            "role": request.role,
            "model": request.model,
            "model_policy_ref": request.model_policy_ref,
            "prompt_version": request.prompt_version,
        }

    def _build_h1_handoff_output(self, request: AdapterStepRequest) -> dict[str, Any]:
        idea = _clean_text(request.input_payload.get("idea"), fallback="Unspecified startup idea")
        intake_output = _step_output(request, "intake")
        planner_output = _step_output(request, "planner")
        critic_output = _step_output(request, "critic")

        if request.step_id == "intake":
            return {
                "idea_summary": idea,
                "target_user": "Early-stage founders validating first product direction.",
                "core_problem": f"The founder needs sharper positioning for: {idea}.",
                "assumptions": [
                    "Structured critique is more useful than open brainstorming.",
                    "Validation planning increases confidence before MVP build.",
                ],
                "constraints": [
                    "Limited time for discovery.",
                    "Need concrete next actions after each iteration.",
                ],
                "open_questions": [
                    "Which founder segment has the strongest urgency?",
                    "Which output format drives immediate action?",
                ],
                "control": {
                    "action": "handoff",
                    "target_step_id": "planner",
                    "reason": "intake_complete",
                },
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "planner":
            _require_manager_context(request=request, required_step_id="intake")
            normalized_summary = _clean_text(intake_output.get("idea_summary"), fallback=idea)
            return {
                "validation_axes": [
                    "problem urgency",
                    "solution credibility",
                    "distribution feasibility",
                ],
                "hypothesis_to_test": [
                    f"Founders will pay for tighter framing of '{normalized_summary}'.",
                    "A handoff chain can preserve specialization without manager loops.",
                ],
                "riskiest_assumptions": [
                    "Each step receives enough context to keep quality stable.",
                    "Sequential handoff will not feel too slow for practical use.",
                ],
                "evidence_needed": [
                    "Interview notes from 3-5 founders",
                    "A/B feedback across single/manager/handoff variants",
                ],
                "first_experiments": [
                    "Run 5 same-input comparisons against manager variant",
                    "Measure clarity and actionability of next-step outputs",
                ],
                "control": {
                    "action": "handoff",
                    "target_step_id": "critic",
                    "reason": "planning_complete",
                },
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "critic":
            _require_manager_context(request=request, required_step_id="intake")
            _require_manager_context(request=request, required_step_id="planner")
            return {
                "weak_points": [
                    "Value proposition may overlap with broad-purpose assistants.",
                    "Target segment may still be too broad.",
                ],
                "failure_modes": [
                    "Outputs remain generic and do not change founder decisions.",
                    "Handoff chain loses nuance between planner and synthesizer.",
                ],
                "hidden_dependencies": [
                    "Quality depends on user providing sufficiently concrete input.",
                    "Prompt consistency is required across all handoff steps.",
                ],
                "counterarguments": [
                    "A manager loop may outperform rigid chains on complex ideas.",
                    "Single-agent baseline might be good enough for simple cases.",
                ],
                "alternatives": [
                    "Narrow to one founder segment before broad rollout.",
                    "Use manager mode when critic identifies severe uncertainty.",
                ],
                "control": {
                    "action": "handoff",
                    "target_step_id": "synthesizer",
                    "reason": "critique_complete",
                },
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        if request.step_id == "synthesizer":
            _require_manager_context(request=request, required_step_id="intake")
            _require_manager_context(request=request, required_step_id="planner")
            _require_manager_context(request=request, required_step_id="critic")

            strongest_assumptions = intake_output.get("assumptions")
            if not isinstance(strongest_assumptions, list) or not strongest_assumptions:
                strongest_assumptions = [
                    "Founders value concrete problem framing before broad ideation.",
                ]

            weak_points = critic_output.get("weak_points")
            if not isinstance(weak_points, list) or not weak_points:
                weak_points = ["Differentiation against generic AI assistants remains weak."]

            alternatives = critic_output.get("alternatives")
            if not isinstance(alternatives, list) or not alternatives:
                alternatives = ["Narrow scope to founder interview preparation workflow."]

            return {
                "control": {
                    "action": "finalize",
                    "reason": "handoff_chain_complete",
                    "output": {
                        "clarified_idea": (
                            "Handoff-chain startup refinement assistant that passes idea context "
                            "through intake, planner, critic, then synthesis finalization."
                        ),
                        "strongest_assumptions": strongest_assumptions,
                        "weak_points": weak_points,
                        "alternatives": alternatives,
                        "recommended_mvp_direction": (
                            "Ship a constrained handoff chain for structured startup idea refinement "
                            "and compare decision quality against manager and single baselines."
                        ),
                        "next_3_validation_steps": [
                            "Run 5 matched ideas across single/manager/handoff workflows.",
                            "Collect per-variant usefulness ratings from founders.",
                            "Measure actionability of next-step recommendations.",
                        ],
                    },
                },
                "role": request.role,
                "prompt_version": request.prompt_version,
            }

        return {
            "message": f"No specialized h1.handoff.v1 output for step '{request.step_id}'.",
            "role": request.role,
            "model": request.model,
            "model_policy_ref": request.model_policy_ref,
            "prompt_version": request.prompt_version,
        }

    def _build_h1_single_output(self, request: AdapterStepRequest) -> dict[str, Any]:
        idea = _clean_text(request.input_payload.get("idea"), fallback="Unspecified startup idea")

        if request.step_id != "single":
            return {
                "message": f"No specialized h1.single.v1 output for step '{request.step_id}'.",
                "role": request.role,
                "model": request.model,
                "model_policy_ref": request.model_policy_ref,
                "prompt_version": request.prompt_version,
            }

        return {
            "clarified_idea": (
                "Single-agent founder refinement assistant focused on turning rough startup ideas into "
                "a structured decision package."
            ),
            "strongest_assumptions": [
                f"The idea '{idea}' has enough potential signal to justify an MVP framing pass.",
                "Founders benefit from concrete next steps over broad brainstorming.",
            ],
            "weak_points": [
                "Single-agent reasoning may miss specialist blind spots.",
                "Without role separation, critique depth can be inconsistent.",
            ],
            "alternatives": [
                "Use manager-based multi-agent workflow for stronger adversarial critique.",
                "Narrow scope to one founder segment before broad validation planning.",
            ],
            "recommended_mvp_direction": (
                "Ship a constrained idea-refinement flow with mandatory structured output sections and "
                "explicit validation tasks."
            ),
            "next_3_validation_steps": [
                "Run the baseline on 5 real ideas and capture where outputs stay generic.",
                "Compare baseline outputs against h1.manager.v1 on the same inputs.",
                "Record decision-quality delta before choosing default orchestration.",
            ],
            "role": request.role,
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


def _require_manager_context(*, request: AdapterStepRequest, required_step_id: str) -> None:
    upstream = _step_output(request, required_step_id)
    if upstream:
        return

    raise StepExecutionError(
        (
            "MockAdapter strict manager context check failed: "
            f"step '{request.step_id}' requires upstream step '{required_step_id}'."
        ),
        details={
            "workflow_id": request.workflow_id,
            "step_id": request.step_id,
            "required_step_id": required_step_id,
            "reason": "missing_upstream_context",
        },
    )


def _require_mock_list_field(
    *,
    request: AdapterStepRequest,
    step_id: str,
    output: Mapping[str, Any],
    field_name: str,
) -> list[Any]:
    value = output.get(field_name)
    if isinstance(value, list) and value:
        return list(value)

    raise StepExecutionError(
        (
            "MockAdapter strict structured-output check failed: "
            f"step '{request.step_id}' requires non-empty list field '{field_name}' from upstream step '{step_id}'."
        ),
        details={
            "workflow_id": request.workflow_id,
            "step_id": request.step_id,
            "required_step_id": step_id,
            "required_field": field_name,
            "reason": "malformed_upstream_output",
        },
    )


def _require_mock_text_field(
    *,
    request: AdapterStepRequest,
    step_id: str,
    output: Mapping[str, Any],
    field_name: str,
) -> str:
    value = output.get(field_name)
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned:
            return cleaned

    raise StepExecutionError(
        (
            "MockAdapter strict structured-output check failed: "
            f"step '{request.step_id}' requires non-empty text field '{field_name}' from upstream step '{step_id}'."
        ),
        details={
            "workflow_id": request.workflow_id,
            "step_id": request.step_id,
            "required_step_id": step_id,
            "required_field": field_name,
            "reason": "malformed_upstream_output",
        },
    )


def _require_mock_wave_list_field(
    *,
    request: AdapterStepRequest,
    step_id: str,
    values: list[Any],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, value in enumerate(values):
        if not isinstance(value, Mapping):
            raise StepExecutionError(
                (
                    "MockAdapter strict structured-output check failed: "
                    f"step '{request.step_id}' requires implementation_waves[{index}] to be an object "
                    f"from upstream step '{step_id}'."
                ),
                details={
                    "workflow_id": request.workflow_id,
                    "step_id": request.step_id,
                    "required_step_id": step_id,
                    "required_field": "implementation_waves",
                    "reason": "malformed_upstream_output",
                },
            )

        wave_value = value.get("wave")
        focus_value = value.get("focus")
        if not isinstance(wave_value, str) or not wave_value.strip():
            raise StepExecutionError(
                (
                    "MockAdapter strict structured-output check failed: "
                    f"step '{request.step_id}' requires implementation_waves[{index}].wave to be non-empty text "
                    f"from upstream step '{step_id}'."
                ),
                details={
                    "workflow_id": request.workflow_id,
                    "step_id": request.step_id,
                    "required_step_id": step_id,
                    "required_field": "implementation_waves.wave",
                    "reason": "malformed_upstream_output",
                },
            )
        if not isinstance(focus_value, list) or not focus_value:
            raise StepExecutionError(
                (
                    "MockAdapter strict structured-output check failed: "
                    f"step '{request.step_id}' requires implementation_waves[{index}].focus to be a non-empty list "
                    f"from upstream step '{step_id}'."
                ),
                details={
                    "workflow_id": request.workflow_id,
                    "step_id": request.step_id,
                    "required_step_id": step_id,
                    "required_field": "implementation_waves.focus",
                    "reason": "malformed_upstream_output",
                },
            )

        normalized.append({"wave": wave_value.strip(), "focus": list(focus_value)})

    return normalized


def _clean_text(value: Any, *, fallback: str) -> str:
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned:
            return cleaned
    return fallback
