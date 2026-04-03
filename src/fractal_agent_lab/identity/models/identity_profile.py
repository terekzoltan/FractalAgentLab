from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


IDENTITY_PROFILE_VECTOR_VERSION_V0 = "identity.vector.v0"


def _clamp_dimension(value: float) -> float:
    return max(0.0, min(1.0, value))


def _normalize_dimension(value: Any, *, field_name: str) -> float:
    if not isinstance(value, (int, float)):
        raise ValueError(f"IdentityProfile field '{field_name}' must be numeric.")
    return _clamp_dimension(float(value))


def _validate_optional_iso_timestamp(value: str | None, *, field_name: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value:
        raise ValueError(f"IdentityProfile field '{field_name}' must be a non-empty string or None.")

    try:
        datetime.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"IdentityProfile field '{field_name}' must be ISO-8601 datetime.") from error
    return value


@dataclass(slots=True)
class IdentityProfile:
    agent_id: str
    profile_version: int = 0
    vector_version: str = IDENTITY_PROFILE_VECTOR_VERSION_V0
    baseline_ref: str | None = None
    caution: float = 0.5
    initiative: float = 0.5
    delegation: float = 0.5
    coherence: float = 0.5
    reflectiveness: float = 0.5
    update_count: int = 0
    last_updated_at: str | None = None
    last_run_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not isinstance(self.agent_id, str) or not self.agent_id:
            raise ValueError("IdentityProfile.agent_id must be a non-empty string.")
        if not isinstance(self.profile_version, int) or self.profile_version < 0:
            raise ValueError("IdentityProfile.profile_version must be a non-negative integer.")
        if not isinstance(self.vector_version, str) or not self.vector_version:
            raise ValueError("IdentityProfile.vector_version must be a non-empty string.")
        if self.baseline_ref is not None and (not isinstance(self.baseline_ref, str) or not self.baseline_ref):
            raise ValueError("IdentityProfile.baseline_ref must be a non-empty string or None.")

        self.caution = _normalize_dimension(self.caution, field_name="caution")
        self.initiative = _normalize_dimension(self.initiative, field_name="initiative")
        self.delegation = _normalize_dimension(self.delegation, field_name="delegation")
        self.coherence = _normalize_dimension(self.coherence, field_name="coherence")
        self.reflectiveness = _normalize_dimension(self.reflectiveness, field_name="reflectiveness")

        if not isinstance(self.update_count, int) or self.update_count < 0:
            raise ValueError("IdentityProfile.update_count must be a non-negative integer.")

        self.last_updated_at = _validate_optional_iso_timestamp(
            self.last_updated_at,
            field_name="last_updated_at",
        )
        if self.last_run_id is not None and (not isinstance(self.last_run_id, str) or not self.last_run_id):
            raise ValueError("IdentityProfile.last_run_id must be a non-empty string or None.")

        if not isinstance(self.metadata, dict):
            raise ValueError("IdentityProfile.metadata must be a dict.")

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "profile_version": self.profile_version,
            "vector_version": self.vector_version,
            "baseline_ref": self.baseline_ref,
            "caution": self.caution,
            "initiative": self.initiative,
            "delegation": self.delegation,
            "coherence": self.coherence,
            "reflectiveness": self.reflectiveness,
            "update_count": self.update_count,
            "last_updated_at": self.last_updated_at,
            "last_run_id": self.last_run_id,
            "metadata": dict(self.metadata),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> IdentityProfile:
        if not isinstance(payload, dict):
            raise ValueError("IdentityProfile payload must be a dict.")

        return cls(
            agent_id=payload.get("agent_id"),
            profile_version=payload.get("profile_version", 0),
            vector_version=payload.get("vector_version", IDENTITY_PROFILE_VECTOR_VERSION_V0),
            baseline_ref=payload.get("baseline_ref"),
            caution=payload.get("caution", 0.5),
            initiative=payload.get("initiative", 0.5),
            delegation=payload.get("delegation", 0.5),
            coherence=payload.get("coherence", 0.5),
            reflectiveness=payload.get("reflectiveness", 0.5),
            update_count=payload.get("update_count", 0),
            last_updated_at=payload.get("last_updated_at"),
            last_run_id=payload.get("last_run_id"),
            metadata=payload.get("metadata", {}),
        )
