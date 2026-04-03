from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_prompt_tags, extract_prompt_tags_from_output_payload
from fractal_agent_lab.cli.config_loader import build_runtime_limits, load_run_configs, resolve_data_dir
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec
from fractal_agent_lab.core.contracts import AgentSpec, WorkflowSpec
from fractal_agent_lab.core.events import TraceEvent
from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.evals.artifact_acceptance import ArtifactValidationResult, validate_run_trace_by_run_id
from fractal_agent_lab.evals.h1_eval_contracts import H1_COMPARABLE_OUTPUT_KEYS, H1_VARIANT_WORKFLOW_IDS
from fractal_agent_lab.evals.h1_eval_projections import extract_h1_comparable_output_for_keys
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.state import InMemoryRunStateStore
from fractal_agent_lab.tracing import InMemoryTraceEmitter, write_run_artifact, write_trace_artifact


H1_SMOKE_VARIANTS: tuple[str, ...] = H1_VARIANT_WORKFLOW_IDS

COMPARABLE_OUTPUT_KEYS: tuple[str, ...] = H1_COMPARABLE_OUTPUT_KEYS


def run_h1_smoke_comparison(
    *,
    input_payload: dict[str, Any],
    provider: str = "mock",
    runtime_config_path: str = "configs/runtime.example.yaml",
    providers_config_path: str = "configs/providers.example.yaml",
    model_policy_config_path: str = "configs/model_policy.example.yaml",
    data_dir: str | Path | None = None,
) -> dict[str, Any]:
    runtime_config, providers_config, model_policy_config = load_run_configs(
        runtime_config_path=runtime_config_path,
        providers_config_path=providers_config_path,
        model_policy_config_path=model_policy_config_path,
    )
    _apply_provider_override(providers_config, provider)
    limits = build_runtime_limits(runtime_config)
    target_data_dir = Path(data_dir) if data_dir is not None else resolve_data_dir(runtime_config)

    variant_reports: list[dict[str, Any]] = []
    for workflow_id in H1_SMOKE_VARIANTS:
        workflow = get_workflow_spec(workflow_id)
        agent_specs = get_workflow_agent_specs(workflow_id)

        emitter = InMemoryTraceEmitter()
        state_store = InMemoryRunStateStore()
        executor = WorkflowExecutor(
            step_runner=build_step_runner(
                agent_specs_by_id=agent_specs,
                providers_config=providers_config,
                model_policy_config=model_policy_config,
            ),
            emitter=emitter,
            state_store=state_store,
            limits=limits,
        )
        run_state = executor.execute(workflow=workflow, input_payload=dict(input_payload))
        _inject_h1_prompt_tags(
            run_state=run_state,
            workflow=workflow,
            workflow_agent_specs=agent_specs,
        )

        run_artifact_path = write_run_artifact(run_state, data_dir=target_data_dir)
        trace_artifact_path = write_trace_artifact(
            emitter.events,
            run_id=run_state.run_id,
            data_dir=target_data_dir,
        )
        artifact_validation = validate_run_trace_by_run_id(run_state.run_id, data_dir=target_data_dir)

        variant_reports.append(
            _build_variant_report(
                run_state=run_state,
                events=emitter.events,
                run_artifact_path=run_artifact_path,
                trace_artifact_path=trace_artifact_path,
                artifact_validation=artifact_validation,
            ),
        )

    all_succeeded = all(report["status"] == RunStatus.SUCCEEDED.value for report in variant_reports)
    all_artifacts_valid = all(report["artifact_validation"]["passed"] for report in variant_reports)
    all_output_envelopes_present = all(
        report["comparable_output"]["present"] for report in variant_reports
    )
    all_outputs_complete = all(report["comparable_output"]["complete"] for report in variant_reports)

    return {
        "report_version": "l1_i.h1_smoke_comparison.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_payload": dict(input_payload),
        "provider": provider,
        "variants": variant_reports,
        "summary": {
            "variant_count": len(variant_reports),
            "all_succeeded": all_succeeded,
            "all_artifacts_valid": all_artifacts_valid,
            "all_comparable_output_envelopes_present": all_output_envelopes_present,
            "all_comparable_outputs_complete": all_outputs_complete,
            "all_comparable_outputs_present": all_outputs_complete,
        },
        "known_limits": [
            "Mock outputs are variant-authored and not a fair quality benchmark.",
            "Comparison reports structural/smoke evidence, not winner scoring.",
            "Cross-variant envelope differences are normalized for comparability only.",
        ],
    }


def _build_variant_report(
    *,
    run_state: RunState,
    events: list[TraceEvent],
    run_artifact_path: Path,
    trace_artifact_path: Path,
    artifact_validation: ArtifactValidationResult,
) -> dict[str, Any]:
    event_counts = _collect_event_counts(events)
    return {
        "workflow_id": run_state.workflow_id,
        "run_id": run_state.run_id,
        "status": run_state.status.value,
        "run_artifact_path": run_artifact_path.as_posix(),
        "trace_artifact_path": trace_artifact_path.as_posix(),
        "artifact_validation": {
            "passed": artifact_validation.passed,
            "errors": list(artifact_validation.errors),
            "warnings": list(artifact_validation.warnings),
        },
        "trace": {
            "event_counts": event_counts,
            "lane_counts": _collect_lane_counts(events),
            "handoff_event_counts": {
                "handoff_decided": event_counts.get("handoff_decided", 0),
                "handoff_failed": event_counts.get("handoff_failed", 0),
            },
            "linked_events": {
                "with_parent_event_id": sum(1 for event in events if event.parent_event_id),
                "with_correlation_id": sum(1 for event in events if event.correlation_id),
            },
        },
        "orchestration": _extract_orchestration_summary(run_state),
        "comparable_output": _extract_comparable_output(run_state),
        "prompt_tags": _extract_prompt_tags(run_state),
    }


def _extract_orchestration_summary(run_state: RunState) -> dict[str, Any]:
    output_payload = run_state.output_payload if isinstance(run_state.output_payload, dict) else {}
    manager_orchestration = output_payload.get("manager_orchestration")
    handoff_orchestration = output_payload.get("handoff_orchestration")

    summary: dict[str, Any] = {
        "workflow_id": run_state.workflow_id,
        "manager": None,
        "handoff": None,
    }

    if isinstance(manager_orchestration, dict):
        raw_turns = manager_orchestration.get("turns")
        turns = raw_turns if isinstance(raw_turns, list) else []
        summary["manager"] = {
            "manager_step_id": manager_orchestration.get("manager_step_id"),
            "worker_step_ids": manager_orchestration.get("worker_step_ids"),
            "turn_count": len(turns),
        }

    if isinstance(handoff_orchestration, dict):
        path = handoff_orchestration.get("path") if isinstance(handoff_orchestration.get("path"), list) else []
        summary["handoff"] = {
            "entrypoint_step_id": handoff_orchestration.get("entrypoint_step_id"),
            "path": path,
            "handoff_count": handoff_orchestration.get("handoff_count"),
            "final_step_id": handoff_orchestration.get("final_step_id"),
        }

    return summary


def _extract_comparable_output(run_state: RunState) -> dict[str, Any]:
    return extract_h1_comparable_output_for_keys(
        workflow_id=run_state.workflow_id,
        output_payload=run_state.output_payload,
        comparable_keys=COMPARABLE_OUTPUT_KEYS,
    )


def _collect_event_counts(events: list[TraceEvent]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        key = event.event_type.value
        counts[key] = counts.get(key, 0) + 1
    return counts


def _collect_lane_counts(events: list[TraceEvent]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        lane = event.payload.get("lane") if isinstance(event.payload, dict) else None
        if not isinstance(lane, str) or not lane:
            continue
        counts[lane] = counts.get(lane, 0) + 1
    return counts


def _apply_provider_override(providers_config: dict[str, Any], provider: str) -> None:
    providers_config["default_provider"] = provider
    providers = providers_config.get("providers")
    if not isinstance(providers, dict):
        providers = {}
        providers_config["providers"] = providers

    provider_block = providers.get(provider)
    if not isinstance(provider_block, dict):
        provider_block = {}
        providers[provider] = provider_block
    provider_block["enabled"] = True


def _inject_h1_prompt_tags(
    *,
    run_state: RunState,
    workflow: WorkflowSpec,
    workflow_agent_specs: dict[str, AgentSpec],
) -> None:
    prompt_tags = build_h1_prompt_tags(
        workflow=workflow,
        agent_specs_by_id=workflow_agent_specs,
        step_results=run_state.step_results,
    )
    if prompt_tags is None:
        return

    payload = dict(run_state.output_payload or {})
    payload["prompt_tags"] = prompt_tags
    run_state.output_payload = payload


def _extract_prompt_tags(run_state: RunState) -> dict[str, Any] | None:
    prompt_tags = extract_prompt_tags_from_output_payload(run_state.output_payload)
    if prompt_tags is None:
        return None
    return prompt_tags
