from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


SESSION_MEMORY_SCHEMA_VERSION = "session_memory.v1"


@dataclass(slots=True)
class SessionMemory:
    session_id: str
    memory: dict[str, Any] = field(default_factory=dict)
    updated_at: str | None = None
    schema_version: str = SESSION_MEMORY_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not isinstance(self.session_id, str) or not self.session_id:
            raise ValueError("SessionMemory.session_id must be a non-empty string.")
        if not isinstance(self.memory, dict):
            raise ValueError("SessionMemory.memory must be a dict.")
        if self.updated_at is not None:
            if not isinstance(self.updated_at, str) or not self.updated_at:
                raise ValueError("SessionMemory.updated_at must be a non-empty ISO-8601 string or None.")
            try:
                datetime.fromisoformat(self.updated_at)
            except ValueError as error:
                raise ValueError("SessionMemory.updated_at must be ISO-8601 datetime.") from error
        if self.schema_version != SESSION_MEMORY_SCHEMA_VERSION:
            raise ValueError(
                f"SessionMemory.schema_version must be '{SESSION_MEMORY_SCHEMA_VERSION}'.",
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "memory": dict(self.memory),
            "updated_at": self.updated_at,
            "schema_version": self.schema_version,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> SessionMemory:
        if not isinstance(payload, dict):
            raise ValueError("SessionMemory payload must be a dict.")

        return cls(
            session_id=payload.get("session_id"),
            memory=payload.get("memory", {}),
            updated_at=payload.get("updated_at"),
            schema_version=payload.get("schema_version", SESSION_MEMORY_SCHEMA_VERSION),
        )
