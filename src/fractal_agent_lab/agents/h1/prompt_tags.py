from __future__ import annotations

from typing import Any, Mapping

from fractal_agent_lab.core.contracts import AgentSpec, WorkflowSpec


_H1_MANAGER_WORKFLOW_ID = "h1.manager.v1"
_H1_SINGLE_WORKFLOW_ID = "h1.single.v1"
_H1_HANDOFF_WORKFLOW_ID = "h1.handoff.v1"

_H1_VARIANT_BY_WORKFLOW_ID: dict[str, str] = {
    _H1_MANAGER_WORKFLOW_ID: "manager",
    _H1_SINGLE_WORKFLOW_ID: "single",
    _H1_HANDOFF_WORKFLOW_ID: "handoff",
}


def build_h1_prompt_tags(
    *,
    workflow: WorkflowSpec,
    agent_specs_by_id: Mapping[str, AgentSpec],
    step_results: Mapping[str, Any],
) -> dict[str, Any] | None:
    variant = _H1_VARIANT_BY_WORKFLOW_ID.get(workflow.workflow_id)
    if variant is None:
        return None

    role_prompt_versions: dict[str, str] = {}
    pack_prompt_version: str | None = None

    step_to_role_key: dict[str, str] = {}
    step_to_prompt_version: dict[str, str] = {}
    for step in workflow.steps:
        spec = agent_specs_by_id.get(step.agent_id)
        if spec is None:
            continue

        role_key = _role_key(spec.role)
        role_prompt_version = _metadata_str(spec, "prompt_version")
        if role_prompt_version is not None:
            role_prompt_versions[role_key] = role_prompt_version
            step_to_prompt_version[step.step_id] = role_prompt_version

        step_to_role_key[step.step_id] = role_key

        candidate_pack_version = _metadata_str(spec, "pack_prompt_version")
        if candidate_pack_version is not None:
            if pack_prompt_version is None:
                pack_prompt_version = candidate_pack_version
            elif pack_prompt_version != candidate_pack_version:
                pack_prompt_version = "mixed"

    executed_step_prompt_versions: dict[str, str] = {}
    for step_id in step_results:
        if step_id not in step_to_prompt_version:
            continue
        role_key = step_to_role_key.get(step_id, step_id)
        executed_step_prompt_versions[role_key] = step_to_prompt_version[step_id]

    return {
        "workflow_id": workflow.workflow_id,
        "variant": variant,
        "pack_prompt_version": pack_prompt_version,
        "role_prompt_versions": role_prompt_versions,
        "executed_step_prompt_versions": executed_step_prompt_versions,
    }


def extract_prompt_tags_from_output_payload(output_payload: Any) -> dict[str, Any] | None:
    if not isinstance(output_payload, dict):
        return None

    prompt_tags = output_payload.get("prompt_tags")
    if isinstance(prompt_tags, dict):
        return dict(prompt_tags)
    return None


def _metadata_str(spec: AgentSpec, key: str) -> str | None:
    value = spec.metadata.get(key)
    if isinstance(value, str) and value:
        return value
    return None


def _role_key(role: str) -> str:
    if not role:
        return "unknown"
    return role.rsplit(".", 1)[-1]
