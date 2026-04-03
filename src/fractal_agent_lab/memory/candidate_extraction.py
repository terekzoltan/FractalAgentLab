from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


MEMORY_CANDIDATE_SCHEMA_VERSION = "memory.candidate.v1"
MEMORY_CANDIDATE_ARTIFACT_VERSION = "1.0"

H1_MANAGER_WORKFLOW_ID = "h1.manager.v1"
H1_HANDOFF_WORKFLOW_ID = "h1.handoff.v1"
H1_SINGLE_WORKFLOW_ID = "h1.single.v1"

H1_WORKFLOW_IDS: set[str] = {
    H1_MANAGER_WORKFLOW_ID,
    H1_HANDOFF_WORKFLOW_ID,
    H1_SINGLE_WORKFLOW_ID,
}


def extract_memory_candidates(*, run_state: RunState) -> list[dict[str, Any]]:
    if run_state.status != RunStatus.SUCCEEDED:
        return []
    if run_state.workflow_id not in H1_WORKFLOW_IDS:
        return []

    session_id = _extract_session_id(run_state)
    if session_id is None:
        return []

    source = _extract_h1_memory_source(run_state)
    if source is None:
        return []

    candidates: list[dict[str, Any]] = []

    clarified_idea = source.get("clarified_idea")
    if isinstance(clarified_idea, str) and clarified_idea.strip():
        candidates.append(
            _candidate(
                run_state=run_state,
                session_id=session_id,
                candidate_type="decision",
                content=clarified_idea.strip(),
                reason="final clarified idea from successful H1 run",
                source_path="output_payload.final_output.clarified_idea",
            ),
        )

    mvp_direction = source.get("recommended_mvp_direction")
    if isinstance(mvp_direction, str) and mvp_direction.strip():
        candidates.append(
            _candidate(
                run_state=run_state,
                session_id=session_id,
                candidate_type="decision",
                content=mvp_direction.strip(),
                reason="recommended MVP direction from successful H1 run",
                source_path="output_payload.final_output.recommended_mvp_direction",
            ),
        )

    weak_points = source.get("weak_points")
    if isinstance(weak_points, list):
        for weak_point in weak_points:
            if not isinstance(weak_point, str) or not weak_point.strip():
                continue
            candidates.append(
                _candidate(
                    run_state=run_state,
                    session_id=session_id,
                    candidate_type="risk",
                    content=weak_point.strip(),
                    reason="weak point repeatedly worth remembering across session",
                    source_path="output_payload.final_output.weak_points[]",
                ),
            )

    next_steps = source.get("next_3_validation_steps")
    if isinstance(next_steps, list):
        for next_step in next_steps:
            if not isinstance(next_step, str) or not next_step.strip():
                continue
            candidates.append(
                _candidate(
                    run_state=run_state,
                    session_id=session_id,
                    candidate_type="next_step",
                    content=next_step.strip(),
                    reason="explicit follow-up step from successful H1 run",
                    source_path="output_payload.final_output.next_3_validation_steps[]",
                ),
            )

    return candidates


def write_memory_candidates_artifact(
    *,
    run_state: RunState,
    data_dir: str | Path,
) -> Path | None:
    session_id = _extract_session_id(run_state)
    if session_id is None:
        return None
    if run_state.status != RunStatus.SUCCEEDED:
        return None
    if run_state.workflow_id not in H1_WORKFLOW_IDS:
        return None

    candidates = extract_memory_candidates(run_state=run_state)

    artifact_dir = run_artifact_dir_path(run_id=run_state.run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "memory_candidates.json"
    payload = {
        "artifact_type": "memory_candidates",
        "artifact_version": MEMORY_CANDIDATE_ARTIFACT_VERSION,
        "candidate_schema_version": MEMORY_CANDIDATE_SCHEMA_VERSION,
        "run_id": run_state.run_id,
        "workflow_id": run_state.workflow_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "candidate_count": len(candidates),
        "candidates": candidates,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def _extract_session_id(run_state: RunState) -> str | None:
    context_session = run_state.context.get("session_id")
    if isinstance(context_session, str) and context_session.strip():
        return context_session.strip()

    payload_session = run_state.input_payload.get("session_id")
    if isinstance(payload_session, str) and payload_session.strip():
        return payload_session.strip()
    return None


def _extract_h1_memory_source(run_state: RunState) -> dict[str, Any] | None:
    output_payload = run_state.output_payload
    if not isinstance(output_payload, dict):
        return None

    if run_state.workflow_id in {H1_MANAGER_WORKFLOW_ID, H1_HANDOFF_WORKFLOW_ID}:
        final_output = output_payload.get("final_output")
        if isinstance(final_output, dict):
            return final_output
        return None

    if run_state.workflow_id == H1_SINGLE_WORKFLOW_ID:
        step_results = output_payload.get("step_results")
        if not isinstance(step_results, dict):
            return None

        single_step = step_results.get("single")
        if not isinstance(single_step, dict):
            return None

        single_output = single_step.get("output")
        if isinstance(single_output, dict):
            return single_output

    return None


def _candidate(
    *,
    run_state: RunState,
    session_id: str,
    candidate_type: str,
    content: str,
    reason: str,
    source_path: str,
) -> dict[str, Any]:
    return {
        "schema_version": MEMORY_CANDIDATE_SCHEMA_VERSION,
        "run_id": run_state.run_id,
        "workflow_id": run_state.workflow_id,
        "session_id": session_id,
        "candidate_type": candidate_type,
        "content": content,
        "reason": reason,
        "source_path": source_path,
        "confidence": "medium",
    }
