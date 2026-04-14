from __future__ import annotations

from typing import Any

from fractal_agent_lab.evals.h2_eval_contracts import H2_COMPARABLE_OUTPUT_KEYS


def extract_h2_comparable_output(output_payload: Any) -> dict[str, Any]:
    if not isinstance(output_payload, dict):
        output_payload = {}

    final_output = output_payload.get("final_output")
    source = final_output if isinstance(final_output, dict) else None

    fields = {key: source.get(key) if source is not None else None for key in H2_COMPARABLE_OUTPUT_KEYS}
    missing_keys = [key for key, value in fields.items() if value is None]

    key_order_matches = bool(source is not None and list(source.keys()) == list(H2_COMPARABLE_OUTPUT_KEYS))
    implementation_waves_valid = _is_valid_implementation_waves(fields.get("implementation_waves"))
    recommended_starting_slice_present = _is_non_empty_text(fields.get("recommended_starting_slice"))

    return {
        "present": source is not None,
        "complete": source is not None and not missing_keys,
        "fields": fields,
        "missing_keys": sorted(missing_keys),
        "key_order_matches": key_order_matches,
        "implementation_waves_valid": implementation_waves_valid,
        "recommended_starting_slice_present": recommended_starting_slice_present,
    }


def _is_valid_implementation_waves(value: Any) -> bool:
    if not isinstance(value, list) or not value:
        return False

    for item in value:
        if not isinstance(item, dict):
            return False
        if not _is_non_empty_text(item.get("wave")):
            return False
        focus = item.get("focus")
        if not isinstance(focus, list) or not focus:
            return False
    return True


def _is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())
