from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fractal_agent_lab.runtime import RuntimeLimits


def load_run_configs(
    *,
    runtime_config_path: str,
    providers_config_path: str,
    model_policy_config_path: str,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    runtime_config = load_mapping_file(runtime_config_path)
    providers_config = load_mapping_file(providers_config_path)
    model_policy_config = load_mapping_file(model_policy_config_path)
    return runtime_config, providers_config, model_policy_config


def build_runtime_limits(runtime_config: dict[str, Any]) -> RuntimeLimits:
    runtime_block = runtime_config.get("runtime", {})
    if not isinstance(runtime_block, dict):
        runtime_block = {}

    timeout_seconds = _to_optional_float(runtime_block.get("default_timeout_seconds"))
    max_retries = _to_int(runtime_block.get("max_retries"), default=0)
    return RuntimeLimits(timeout_seconds=timeout_seconds, max_retries_per_step=max_retries)


def resolve_data_dir(runtime_config: dict[str, Any]) -> Path:
    paths_block = runtime_config.get("paths", {})
    if not isinstance(paths_block, dict):
        return Path("data")

    raw_data_dir = paths_block.get("data_dir", "data")
    if isinstance(raw_data_dir, str) and raw_data_dir.strip():
        return Path(raw_data_dir)
    return Path("data")


def load_mapping_file(path_value: str) -> dict[str, Any]:
    path = Path(path_value)
    if not path.exists():
        raise ValueError(f"Config file not found: {path}")

    text = path.read_text(encoding="utf-8")
    stripped = text.lstrip()
    if stripped.startswith("{"):
        parsed = json.loads(text)
    else:
        parsed = _parse_simple_yaml_mapping(text)

    if not isinstance(parsed, dict):
        raise ValueError(f"Config root must be a mapping: {path}")
    return parsed


def _parse_simple_yaml_mapping(text: str) -> dict[str, Any]:
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-1, root)]

    for line_number, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        if indent % 2 != 0:
            raise ValueError(f"Unsupported YAML indentation at line {line_number}.")

        while stack and indent <= stack[-1][0]:
            stack.pop()
        if not stack:
            raise ValueError(f"Invalid YAML nesting at line {line_number}.")

        if ":" not in stripped:
            raise ValueError(f"Expected key/value mapping at line {line_number}.")
        key, raw_value = stripped.split(":", 1)
        key = key.strip()
        raw_value = raw_value.strip()

        parent = stack[-1][1]
        if raw_value == "":
            child: dict[str, Any] = {}
            parent[key] = child
            stack.append((indent, child))
            continue

        parent[key] = _parse_scalar(raw_value)

    return root


def _parse_scalar(raw: str) -> Any:
    if raw in {"{}", "{ }"}:
        return {}

    lower_raw = raw.lower()
    if lower_raw == "true":
        return True
    if lower_raw == "false":
        return False

    if raw.startswith('"') and raw.endswith('"') and len(raw) >= 2:
        return raw[1:-1]
    if raw.startswith("'") and raw.endswith("'") and len(raw) >= 2:
        return raw[1:-1]

    try:
        return int(raw)
    except ValueError:
        pass

    try:
        return float(raw)
    except ValueError:
        return raw


def _to_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    raise ValueError("runtime.default_timeout_seconds must be a number when provided.")


def _to_int(value: Any, *, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, int):
        return value
    raise ValueError("runtime.max_retries must be an integer.")
