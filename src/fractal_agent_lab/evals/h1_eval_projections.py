from __future__ import annotations

from typing import Any

from fractal_agent_lab.agents import extract_prompt_tags_from_output_payload
from fractal_agent_lab.evals.h1_eval_contracts import (
    H1_COMPARABLE_OUTPUT_KEYS,
    H1_VARIANT_WORKFLOW_IDS,
)


def is_h1_variant_workflow(workflow_id: str | None) -> bool:
    return isinstance(workflow_id, str) and workflow_id in H1_VARIANT_WORKFLOW_IDS


def extract_h1_comparable_output(*, workflow_id: str | None, output_payload: Any) -> dict[str, Any]:
    return extract_h1_comparable_output_for_keys(
        workflow_id=workflow_id,
        output_payload=output_payload,
        comparable_keys=H1_COMPARABLE_OUTPUT_KEYS,
    )


def extract_h1_comparable_output_for_keys(
    *,
    workflow_id: str | None,
    output_payload: Any,
    comparable_keys: tuple[str, ...],
) -> dict[str, Any]:
    if not isinstance(workflow_id, str) or workflow_id not in H1_VARIANT_WORKFLOW_IDS:
        return {
            "present": False,
            "complete": False,
            "fields": {key: None for key in comparable_keys},
            "missing_keys": list(comparable_keys),
        }

    if not isinstance(output_payload, dict):
        output_payload = {}

    source: dict[str, Any] | None = None
    if workflow_id == "h1.single.v1":
        step_results = output_payload.get("step_results")
        if isinstance(step_results, dict):
            single_step = step_results.get("single")
            if isinstance(single_step, dict):
                single_output = single_step.get("output")
                if isinstance(single_output, dict):
                    source = single_output
    else:
        final_output = output_payload.get("final_output")
        if isinstance(final_output, dict):
            source = final_output

    fields = {key: source.get(key) if source is not None else None for key in comparable_keys}
    missing_keys = sorted(key for key, value in fields.items() if value is None)
    return {
        "present": source is not None,
        "complete": source is not None and not missing_keys,
        "fields": fields,
        "missing_keys": missing_keys,
    }


def extract_h1_prompt_tags(output_payload: Any) -> dict[str, Any] | None:
    return extract_prompt_tags_from_output_payload(output_payload)
