from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_prompt_tags
from fractal_agent_lab.cli.config_loader import build_runtime_limits, load_run_configs, resolve_data_dir
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.evals.artifact_replay import replay_run_artifacts_by_id
from fractal_agent_lab.memory import (
    JSONSessionMemoryStore,
    SessionMemory,
    load_session_memory_context,
    write_memory_candidates_artifact,
    write_session_memory_snapshot_artifact,
)
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.state import InMemoryRunStateStore
from fractal_agent_lab.tracing import InMemoryTraceEmitter, write_run_artifact, write_trace_artifact
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


DEFAULT_MANDATORY_WORKFLOW = "h1.manager.v1"
OPTIONAL_WORKFLOWS: tuple[str, ...] = ("h1.single.v1", "h1.handoff.v1")


def run_h2_l_h1_memory_materiality(
    *,
    input_payload: dict[str, Any],
    session_memory_payload: dict[str, Any],
    session_id: str,
    provider: str = "mock",
    runtime_config_path: str = "configs/runtime.example.yaml",
    providers_config_path: str = "configs/providers.example.yaml",
    model_policy_config_path: str = "configs/model_policy.example.yaml",
    data_dir: str | Path | None = None,
    include_single: bool = False,
    include_handoff: bool = False,
) -> dict[str, Any]:
    if not isinstance(session_id, str) or not session_id.strip():
        raise ValueError("session_id must be a non-empty string.")
    if not isinstance(session_memory_payload, dict) or not session_memory_payload:
        raise ValueError("session_memory_payload must be a non-empty JSON object.")

    runtime_config, providers_config, model_policy_config = load_run_configs(
        runtime_config_path=runtime_config_path,
        providers_config_path=providers_config_path,
        model_policy_config_path=model_policy_config_path,
    )
    _apply_provider_override(providers_config, provider)
    limits = build_runtime_limits(runtime_config)
    target_data_dir = Path(data_dir) if data_dir is not None else resolve_data_dir(runtime_config)

    workflows = [DEFAULT_MANDATORY_WORKFLOW]
    if include_single:
        workflows.append("h1.single.v1")
    if include_handoff:
        workflows.append("h1.handoff.v1")

    pairs: list[dict[str, Any]] = []
    for workflow_id in workflows:
        branch_input = dict(input_payload)
        branch_input["session_id"] = session_id
        store = JSONSessionMemoryStore(data_dir=target_data_dir)
        original_store_state = _capture_session_store_state(store=store, session_id=session_id)
        try:
            without_memory = _run_memory_branch(
                workflow_id=workflow_id,
                branch_name="without_memory",
                input_payload=branch_input,
                seed_memory=None,
                session_id=session_id,
                target_data_dir=target_data_dir,
                store=store,
                providers_config=providers_config,
                model_policy_config=model_policy_config,
                limits=limits,
            )
            with_memory = _run_memory_branch(
                workflow_id=workflow_id,
                branch_name="with_memory",
                input_payload=branch_input,
                seed_memory=session_memory_payload,
                session_id=session_id,
                target_data_dir=target_data_dir,
                store=store,
                providers_config=providers_config,
                model_policy_config=model_policy_config,
                limits=limits,
            )
        finally:
            _restore_session_store_state(
                store=store,
                session_id=session_id,
                original_state=original_store_state,
            )

        pair_summary = _build_pair_summary(without_memory=without_memory, with_memory=with_memory)
        pairs.append(
            {
                "workflow_id": workflow_id,
                "session_id": session_id,
                "without_memory": without_memory,
                "with_memory": with_memory,
                "memory_loaded_on_seeded_branch": bool(with_memory.get("session_memory_loaded")),
                "memory_seed_summary": {
                    "source": "explicit_session_memory_payload",
                    "session_id": session_id,
                    "seed_keys": sorted(session_memory_payload.keys()),
                },
                "with_memory_candidate_artifact_summary": with_memory.get("candidate_artifact_summary"),
                "continuity_signals": pair_summary["continuity_signals"],
                "materiality_signal": pair_summary["materiality_signal"],
            },
        )

    all_artifacts_valid = all(
        _bool_nested(branch, "artifact_validation", "passed")
        for pair in pairs
        for branch in (pair["without_memory"], pair["with_memory"])
    )
    all_replay_ready = all(
        bool(branch.get("replay_ready"))
        for pair in pairs
        for branch in (pair["without_memory"], pair["with_memory"])
    )
    all_outputs_complete = all(
        _bool_nested(branch, "comparable_output", "complete")
        for pair in pairs
        for branch in (pair["without_memory"], pair["with_memory"])
    )
    all_seeded_loaded = all(bool(pair.get("memory_loaded_on_seeded_branch")) for pair in pairs)

    materiality_labels = [
        pair.get("materiality_signal", {}).get("label", "not_structurally_ready")
        for pair in pairs
    ]
    difference_observed_count = sum(1 for label in materiality_labels if label == "difference_observed")
    no_difference_observed_count = sum(
        1
        for label in materiality_labels
        if label == "no_difference_observed"
    )
    not_structurally_ready_count = sum(
        1
        for label in materiality_labels
        if label == "not_structurally_ready"
    )

    structural_ready = bool(
        all_artifacts_valid
        and all_replay_ready
        and all_outputs_complete
        and all_seeded_loaded
    )

    if not structural_ready:
        materiality_signal = "not_structurally_ready"
        recommendation = "fix_structural_readiness_first"
    elif difference_observed_count > 0:
        materiality_signal = "difference_observed"
        recommendation = "encouraging_followup"
    elif no_difference_observed_count > 0:
        materiality_signal = "no_difference_observed"
        recommendation = "needs_more_evidence"
    else:
        materiality_signal = "not_structurally_ready"
        recommendation = "needs_more_evidence"

    return {
        "report_version": "h2_l.h1_memory_materiality.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "evaluation_scope": {
            "mandatory_workflow": DEFAULT_MANDATORY_WORKFLOW,
            "optional_workflows_included": {
                "h1.single.v1": include_single,
                "h1.handoff.v1": include_handoff,
            },
            "provider": provider,
        },
        "input_payload": dict(input_payload),
        "memory_seed_summary": {
            "source": "explicit_session_memory_payload",
            "session_id": session_id,
            "seed_keys": sorted(session_memory_payload.keys()),
        },
        "pairs": pairs,
        "summary": {
            "pair_count": len(pairs),
            "all_artifacts_valid": all_artifacts_valid,
            "all_replay_ready": all_replay_ready,
            "all_comparable_outputs_complete": all_outputs_complete,
            "all_seeded_branches_loaded_session_context": all_seeded_loaded,
            "structural_ready": structural_ready,
            "difference_observed_count": difference_observed_count,
            "no_difference_observed_count": no_difference_observed_count,
            "not_structurally_ready_count": not_structurally_ready_count,
            "materiality_signal": materiality_signal,
            "recommendation": recommendation,
        },
        "known_limits": [
            "This eval validates structural readiness and memory plumbing first, not broad quality superiority.",
            "Mock-backed runs are useful for structure/plumbing checks but are not a fair quality benchmark.",
            "Candidate sidecar provenance for h1.single.v1 currently carries known source_path imprecision.",
        ],
    }


def _run_memory_branch(
    *,
    workflow_id: str,
    branch_name: str,
    input_payload: dict[str, Any],
    seed_memory: dict[str, Any] | None,
    session_id: str,
    target_data_dir: Path,
    store: JSONSessionMemoryStore,
    providers_config: dict[str, Any],
    model_policy_config: dict[str, Any],
    limits,
) -> dict[str, Any]:
    _prepare_session_store_for_branch(
        store=store,
        session_id=session_id,
        seed_memory=seed_memory,
    )

    run_context = load_session_memory_context(input_payload=input_payload, data_dir=target_data_dir)

    workflow = get_workflow_spec(workflow_id)
    workflow_agent_specs = get_workflow_agent_specs(workflow_id)
    emitter = InMemoryTraceEmitter()
    state_store = InMemoryRunStateStore()
    executor = WorkflowExecutor(
        step_runner=build_step_runner(
            agent_specs_by_id=workflow_agent_specs,
            providers_config=providers_config,
            model_policy_config=model_policy_config,
        ),
        emitter=emitter,
        state_store=state_store,
        limits=limits,
    )

    run_state = executor.execute(
        workflow=workflow,
        input_payload=dict(input_payload),
        context=run_context,
    )
    _inject_h1_prompt_tags(
        run_state=run_state,
        workflow=workflow,
        workflow_agent_specs=workflow_agent_specs,
    )

    run_artifact_path = write_run_artifact(run_state, data_dir=target_data_dir)
    trace_artifact_path = write_trace_artifact(
        emitter.events,
        run_id=run_state.run_id,
        data_dir=target_data_dir,
    )
    _ = write_session_memory_snapshot_artifact(
        run_id=run_state.run_id,
        workflow_id=run_state.workflow_id,
        run_context=run_state.context,
        data_dir=target_data_dir,
    )
    candidate_artifact_path = write_memory_candidates_artifact(
        run_state=run_state,
        data_dir=target_data_dir,
    )

    replay = replay_run_artifacts_by_id(run_state.run_id, data_dir=target_data_dir)
    comparable_output = _nested_dict(replay, "h1_projection", "comparable_output")
    candidate_artifact_summary = _load_candidate_artifact_summary(
        run_id=run_state.run_id,
        data_dir=target_data_dir,
        candidate_artifact_path=candidate_artifact_path,
    )

    return {
        "branch": branch_name,
        "run_id": run_state.run_id,
        "status": run_state.status.value,
        "run_artifact_path": run_artifact_path.as_posix(),
        "trace_artifact_path": trace_artifact_path.as_posix(),
        "artifact_validation": replay.get("artifact_validation"),
        "replay_ready": replay.get("replay_ready"),
        "run_summary": replay.get("run_summary"),
        "comparable_output": comparable_output,
        "prompt_tags": _nested_dict(replay, "h1_projection", "prompt_tags"),
        "session_memory_loaded": _has_loaded_session_memory(run_state.context),
        "session_memory_context_keys": sorted(
            run_state.context.get("session_memory", {}).get("memory", {}).keys()
            if isinstance(run_state.context.get("session_memory"), dict)
            else [],
        ),
        "smoke_ready": bool(
            _bool_nested(replay, "artifact_validation", "passed")
            and bool(replay.get("replay_ready"))
            and bool(comparable_output.get("complete"))
            and run_state.status == RunStatus.SUCCEEDED
        ),
        "candidate_artifact_summary": candidate_artifact_summary,
    }


def _build_pair_summary(*, without_memory: dict[str, Any], with_memory: dict[str, Any]) -> dict[str, Any]:
    without_fields = _nested_dict(without_memory, "comparable_output", "fields")
    with_fields = _nested_dict(with_memory, "comparable_output", "fields")

    changed_field_count = 0
    for key, without_value in without_fields.items():
        if with_fields.get(key) != without_value:
            changed_field_count += 1

    seeded_loaded = bool(with_memory.get("session_memory_loaded"))
    with_complete = bool(_bool_nested(with_memory, "comparable_output", "complete"))
    without_complete = bool(_bool_nested(without_memory, "comparable_output", "complete"))

    if not (seeded_loaded and with_complete and without_complete):
        label = "not_structurally_ready"
    elif changed_field_count > 0:
        label = "difference_observed"
    else:
        label = "no_difference_observed"

    continuity_signals = {
        "seeded_session_loaded": seeded_loaded,
        "changed_field_count": changed_field_count,
        "with_memory_comparable_complete": with_complete,
        "without_memory_comparable_complete": without_complete,
    }
    return {
        "continuity_signals": continuity_signals,
        "materiality_signal": {
            "label": label,
            "changed_field_count": changed_field_count,
        },
    }


def _load_candidate_artifact_summary(
    *,
    run_id: str,
    data_dir: Path,
    candidate_artifact_path: Path | None,
) -> dict[str, Any]:
    artifact_path = candidate_artifact_path
    if artifact_path is None:
        artifact_path = run_artifact_dir_path(run_id=run_id, data_dir=data_dir) / "memory_candidates.json"
    if not artifact_path.exists():
        return {
            "present": False,
            "candidate_count": 0,
            "path": artifact_path.as_posix(),
        }

    payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    candidates = payload.get("candidates") if isinstance(payload.get("candidates"), list) else []
    return {
        "present": True,
        "path": artifact_path.as_posix(),
        "candidate_count": len(candidates),
        "session_id": payload.get("session_id"),
        "workflow_id": payload.get("workflow_id"),
    }


def _prepare_session_store_for_branch(
    *,
    store: JSONSessionMemoryStore,
    session_id: str,
    seed_memory: dict[str, Any] | None,
) -> None:
    _clear_session_store_state(store=store, session_id=session_id)
    if seed_memory is None:
        return
    store.save_session(SessionMemory(session_id=session_id, memory=dict(seed_memory)))


def _capture_session_store_state(
    *,
    store: JSONSessionMemoryStore,
    session_id: str,
) -> list[tuple[Path, str]]:
    original_state: list[tuple[Path, str]] = []
    for path in _session_store_paths(store=store, session_id=session_id):
        if not path.exists():
            continue
        original_state.append((path, path.read_text(encoding="utf-8")))
    return original_state


def _restore_session_store_state(
    *,
    store: JSONSessionMemoryStore,
    session_id: str,
    original_state: list[tuple[Path, str]],
) -> None:
    _clear_session_store_state(store=store, session_id=session_id)
    for path, content in original_state:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def _clear_session_store_state(*, store: JSONSessionMemoryStore, session_id: str) -> None:
    for path in _session_store_paths(store=store, session_id=session_id):
        if path.exists():
            path.unlink()


def _session_store_paths(*, store: JSONSessionMemoryStore, session_id: str) -> tuple[Path, ...]:
    preferred = store.session_path(session_id=session_id)
    legacy = _legacy_session_path(store=store, session_id=session_id)
    if legacy == preferred:
        return (preferred,)
    return (preferred, legacy)


def _legacy_session_path(*, store: JSONSessionMemoryStore, session_id: str) -> Path:
    safe_stem = re.sub(r"[^a-zA-Z0-9_.-]", "_", session_id)
    return store.root_dir / "sessions" / f"{safe_stem}.json"


def _has_loaded_session_memory(run_context: dict[str, Any]) -> bool:
    session_memory = run_context.get("session_memory")
    if not isinstance(session_memory, dict):
        return False
    memory_payload = session_memory.get("memory")
    return isinstance(memory_payload, dict) and bool(memory_payload)


def _inject_h1_prompt_tags(*, run_state, workflow, workflow_agent_specs) -> None:
    prompt_tags = build_h1_prompt_tags(
        workflow=workflow,
        agent_specs_by_id=workflow_agent_specs,
        step_results=run_state.step_results,
    )
    if prompt_tags is None:
        return
    output_payload = dict(run_state.output_payload or {})
    output_payload["prompt_tags"] = prompt_tags
    run_state.output_payload = output_payload


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


def _nested_dict(payload: Any, *keys: str) -> dict[str, Any]:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return {}
        current = current.get(key)
    return current if isinstance(current, dict) else {}


def _bool_nested(payload: Any, *keys: str) -> bool:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return False
        current = current.get(key)
    return bool(current)
