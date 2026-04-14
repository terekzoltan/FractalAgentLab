from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


PROJECT_MEMORY_SCHEMA_VERSION = "project_memory.v1"
PROJECT_MEMORY_ENTRY_SCHEMA_VERSION = "project_memory.entry.v1"

ALLOWED_ENTRY_TYPES = {"stable_decision", "workflow_learning"}


@dataclass(slots=True)
class ProjectMemoryEntry:
    entry_type: str
    entry_subtype: str
    content: str
    workflow_id: str
    source_path: str
    first_seen_run_id: str
    last_seen_run_id: str
    times_observed: int = 1
    confidence: str = "medium"
    last_updated_at: str | None = None
    schema_version: str = PROJECT_MEMORY_ENTRY_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.entry_type not in ALLOWED_ENTRY_TYPES:
            raise ValueError("ProjectMemoryEntry.entry_type must be stable_decision or workflow_learning.")
        for field_name in (
            "entry_subtype",
            "content",
            "workflow_id",
            "source_path",
            "first_seen_run_id",
            "last_seen_run_id",
            "confidence",
        ):
            value = getattr(self, field_name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"ProjectMemoryEntry.{field_name} must be a non-empty string.")
        if not isinstance(self.times_observed, int) or self.times_observed < 1:
            raise ValueError("ProjectMemoryEntry.times_observed must be an integer >= 1.")
        if self.last_updated_at is not None:
            if not isinstance(self.last_updated_at, str) or not self.last_updated_at.strip():
                raise ValueError("ProjectMemoryEntry.last_updated_at must be ISO-8601 string or None.")
            try:
                datetime.fromisoformat(self.last_updated_at)
            except ValueError as error:
                raise ValueError("ProjectMemoryEntry.last_updated_at must be ISO-8601 datetime.") from error
        if self.schema_version != PROJECT_MEMORY_ENTRY_SCHEMA_VERSION:
            raise ValueError(
                f"ProjectMemoryEntry.schema_version must be '{PROJECT_MEMORY_ENTRY_SCHEMA_VERSION}'.",
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "entry_type": self.entry_type,
            "entry_subtype": self.entry_subtype,
            "content": self.content,
            "workflow_id": self.workflow_id,
            "source_path": self.source_path,
            "first_seen_run_id": self.first_seen_run_id,
            "last_seen_run_id": self.last_seen_run_id,
            "times_observed": self.times_observed,
            "confidence": self.confidence,
            "last_updated_at": self.last_updated_at,
            "schema_version": self.schema_version,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> ProjectMemoryEntry:
        if not isinstance(payload, dict):
            raise ValueError("ProjectMemoryEntry payload must be a dict.")

        return cls(
            entry_type=payload.get("entry_type"),
            entry_subtype=payload.get("entry_subtype"),
            content=payload.get("content"),
            workflow_id=payload.get("workflow_id"),
            source_path=payload.get("source_path"),
            first_seen_run_id=payload.get("first_seen_run_id"),
            last_seen_run_id=payload.get("last_seen_run_id"),
            times_observed=payload.get("times_observed", 1),
            confidence=payload.get("confidence", "medium"),
            last_updated_at=payload.get("last_updated_at"),
            schema_version=payload.get("schema_version", PROJECT_MEMORY_ENTRY_SCHEMA_VERSION),
        )


@dataclass(slots=True)
class ProjectMemory:
    project_id: str
    stable_decisions: list[ProjectMemoryEntry] = field(default_factory=list)
    workflow_learnings: list[ProjectMemoryEntry] = field(default_factory=list)
    prompt_observations: list[ProjectMemoryEntry] = field(default_factory=list)
    updated_at: str | None = None
    schema_version: str = PROJECT_MEMORY_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not isinstance(self.project_id, str) or not self.project_id.strip():
            raise ValueError("ProjectMemory.project_id must be a non-empty string.")
        for field_name in ("stable_decisions", "workflow_learnings", "prompt_observations"):
            value = getattr(self, field_name)
            if not isinstance(value, list):
                raise ValueError(f"ProjectMemory.{field_name} must be a list.")
            if not all(isinstance(item, ProjectMemoryEntry) for item in value):
                raise ValueError(f"ProjectMemory.{field_name} must contain ProjectMemoryEntry values.")
        if self.updated_at is not None:
            if not isinstance(self.updated_at, str) or not self.updated_at.strip():
                raise ValueError("ProjectMemory.updated_at must be ISO-8601 string or None.")
            try:
                datetime.fromisoformat(self.updated_at)
            except ValueError as error:
                raise ValueError("ProjectMemory.updated_at must be ISO-8601 datetime.") from error
        if self.schema_version != PROJECT_MEMORY_SCHEMA_VERSION:
            raise ValueError(f"ProjectMemory.schema_version must be '{PROJECT_MEMORY_SCHEMA_VERSION}'.")

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "stable_decisions": [entry.to_dict() for entry in self.stable_decisions],
            "workflow_learnings": [entry.to_dict() for entry in self.workflow_learnings],
            "prompt_observations": [entry.to_dict() for entry in self.prompt_observations],
            "updated_at": self.updated_at,
            "schema_version": self.schema_version,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> ProjectMemory:
        if not isinstance(payload, dict):
            raise ValueError("ProjectMemory payload must be a dict.")
        return cls(
            project_id=payload.get("project_id"),
            stable_decisions=_load_entries(payload.get("stable_decisions")),
            workflow_learnings=_load_entries(payload.get("workflow_learnings")),
            prompt_observations=_load_entries(payload.get("prompt_observations")),
            updated_at=payload.get("updated_at"),
            schema_version=payload.get("schema_version", PROJECT_MEMORY_SCHEMA_VERSION),
        )


def _load_entries(payload: Any) -> list[ProjectMemoryEntry]:
    if payload is None:
        return []
    if not isinstance(payload, list):
        raise ValueError("ProjectMemory entry collection must be a list.")
    entries: list[ProjectMemoryEntry] = []
    for item in payload:
        entries.append(ProjectMemoryEntry.from_dict(item))
    return entries
