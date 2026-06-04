from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping

DEFAULT_EXCERPT_MAX_CHARS = 4000
JSON_SOURCE_KINDS = {"router_selected_output", "selected_output_file"}
REASONING_KEYS = {
    "chain_of_thought",
    "cot",
    "reasoning",
    "reasoning_text",
    "thought",
    "thoughts",
}
WARNING_ARTIFACT_REFS_AUDIT_ONLY = "artifact_refs_audit_only"
WARNING_EXCERPT_TRUNCATED = "excerpt_truncated"
WARNING_MARKDOWN_FALLBACK = "markdown_fallback_warning_grade"
WARNING_MISSING_OPTIONAL_METADATA = "missing_optional_metadata"
WARNING_THOUGHT_OMITTED = "thought_or_reasoning_omitted"


class OpenCodeRouterSourceError(ValueError):
    """Raised when a selected-output source cannot be normalized safely."""


@dataclass(slots=True)
class SelectedOutputExtract:
    stage: str | None
    source_kind: str
    source_path: str
    source_session: str | None
    message_id: str | None
    decision: str | None
    summary: str
    selected_text_excerpt: str | None
    excerpt_truncated: bool
    artifact_refs: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def load_selected_output(
    source_path: str | Path,
    *,
    router_root: str | Path | None = None,
    excerpt_max_chars: int = DEFAULT_EXCERPT_MAX_CHARS,
) -> SelectedOutputExtract:
    path = Path(source_path).resolve()
    _validate_source_path(path=path, router_root=router_root)
    _validate_excerpt_max_chars(excerpt_max_chars)

    if path.suffix.lower() == ".json":
        return _load_selected_output_json(path=path, excerpt_max_chars=excerpt_max_chars)

    return _load_selected_output_markdown(path=path, excerpt_max_chars=excerpt_max_chars)


def load_selected_outputs(
    source_paths: Iterable[str | Path],
    *,
    router_root: str | Path | None = None,
    excerpt_max_chars: int = DEFAULT_EXCERPT_MAX_CHARS,
) -> list[SelectedOutputExtract]:
    return [
        load_selected_output(
            source_path,
            router_root=router_root,
            excerpt_max_chars=excerpt_max_chars,
        )
        for source_path in source_paths
    ]


def _load_selected_output_json(*, path: Path, excerpt_max_chars: int) -> SelectedOutputExtract:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise OpenCodeRouterSourceError(f"Selected-output JSON is invalid: {path}") from error

    if not isinstance(payload, Mapping):
        raise OpenCodeRouterSourceError(f"Selected-output JSON must be an object: {path}")

    stage = _require_string(payload, "stage", path)
    summary = _require_string(payload, "summary", path)
    source_kind = _require_string(payload, "source_kind", path)
    if source_kind not in JSON_SOURCE_KINDS:
        raise OpenCodeRouterSourceError(
            f"Selected-output JSON has unsupported source_kind '{source_kind}': {path}"
        )

    warnings: list[str] = []
    source_session = _optional_string(payload, "source_session", path)
    message_id = _optional_string(payload, "message_id", path)
    decision = _optional_string(payload, "decision", path)
    selected_text = _optional_string(payload, "selected_text", path)
    artifact_refs = _optional_string_list(payload, "artifact_refs", path)

    omitted_reasoning = _payload_contains_reasoning(payload)
    if omitted_reasoning:
        warnings.append(WARNING_THOUGHT_OMITTED)

    if artifact_refs:
        warnings.append(WARNING_ARTIFACT_REFS_AUDIT_ONLY)

    optional_fields = [source_session, message_id, decision, selected_text]
    if any(value is None for value in optional_fields):
        warnings.append(WARNING_MISSING_OPTIONAL_METADATA)

    excerpt, truncated = _bounded_excerpt(selected_text, excerpt_max_chars)
    if truncated:
        warnings.append(WARNING_EXCERPT_TRUNCATED)

    return SelectedOutputExtract(
        stage=stage,
        source_kind=source_kind,
        source_path=str(path),
        source_session=source_session,
        message_id=message_id,
        decision=decision,
        summary=summary,
        selected_text_excerpt=excerpt,
        excerpt_truncated=truncated,
        artifact_refs=artifact_refs,
        warnings=warnings,
    )


def _load_selected_output_markdown(*, path: Path, excerpt_max_chars: int) -> SelectedOutputExtract:
    content = path.read_text(encoding="utf-8")
    excerpt, truncated = _bounded_excerpt(content, excerpt_max_chars)
    warnings = [WARNING_MARKDOWN_FALLBACK, WARNING_MISSING_OPTIONAL_METADATA]
    if truncated:
        warnings.append(WARNING_EXCERPT_TRUNCATED)

    return SelectedOutputExtract(
        stage=None,
        source_kind="markdown_excerpt",
        source_path=str(path),
        source_session=None,
        message_id=None,
        decision=None,
        summary=_summarize_markdown_excerpt(excerpt),
        selected_text_excerpt=excerpt,
        excerpt_truncated=truncated,
        artifact_refs=[],
        warnings=warnings,
    )


def _validate_source_path(*, path: Path, router_root: str | Path | None) -> None:
    if not path.exists():
        raise OpenCodeRouterSourceError(f"Selected-output source does not exist: {path}")
    if not path.is_file():
        raise OpenCodeRouterSourceError(f"Selected-output source must be a file: {path}")
    if router_root is None:
        return
    root = Path(router_root).resolve()
    if not root.exists() or not root.is_dir():
        raise OpenCodeRouterSourceError(f"Router root must be an existing directory: {root}")
    try:
        path.relative_to(root)
    except ValueError as error:
        raise OpenCodeRouterSourceError(
            f"Selected-output source escapes the configured router root: {path}"
        ) from error


def _validate_excerpt_max_chars(value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise OpenCodeRouterSourceError("excerpt_max_chars must be a positive integer.")
    if value <= 0:
        raise OpenCodeRouterSourceError("excerpt_max_chars must be a positive integer.")


def _require_string(payload: Mapping[str, Any], key: str, path: Path) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise OpenCodeRouterSourceError(f"Selected-output JSON field '{key}' must be a non-empty string: {path}")
    return value.strip()


def _optional_string(payload: Mapping[str, Any], key: str, path: Path) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise OpenCodeRouterSourceError(f"Selected-output JSON field '{key}' must be a string or null: {path}")
    stripped = value.strip()
    return stripped or None


def _optional_string_list(payload: Mapping[str, Any], key: str, path: Path) -> list[str]:
    value = payload.get(key)
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise OpenCodeRouterSourceError(
            f"Selected-output JSON field '{key}' must be a list of non-empty strings: {path}"
        )
    return [item.strip() for item in value]


def _payload_contains_reasoning(payload: Mapping[str, Any]) -> bool:
    for key, value in payload.items():
        lowered = key.lower()
        if lowered in REASONING_KEYS:
            return True
        if isinstance(value, Mapping) and _payload_contains_reasoning(value):
            return True
        if isinstance(value, list) and any(isinstance(item, Mapping) and _payload_contains_reasoning(item) for item in value):
            return True
    return False


def _bounded_excerpt(selected_text: str | None, excerpt_max_chars: int) -> tuple[str | None, bool]:
    if selected_text is None:
        return None, False
    normalized = selected_text.strip()
    if not normalized:
        return None, False
    if len(normalized) <= excerpt_max_chars:
        return normalized, False
    return normalized[:excerpt_max_chars], True


def _summarize_markdown_excerpt(excerpt: str | None) -> str:
    if excerpt is None:
        return "Selected output excerpt captured from markdown fallback."
    first_line = next((line.strip() for line in excerpt.splitlines() if line.strip()), "")
    if not first_line:
        return "Selected output excerpt captured from markdown fallback."
    return first_line[:200]
