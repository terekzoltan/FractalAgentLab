from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fractal_agent_lab.identity.models.identity_profile import IdentityProfile


IDENTITY_SNAPSHOT_SCHEMA_VERSION = "identity.snapshot.v0"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class IdentitySnapshot:
    agent_id: str
    profile: IdentityProfile
    captured_at: str
    run_id: str | None = None
    reason: str | None = None
    schema_version: str = IDENTITY_SNAPSHOT_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not isinstance(self.agent_id, str) or not self.agent_id:
            raise ValueError("IdentitySnapshot.agent_id must be a non-empty string.")
        if not isinstance(self.profile, IdentityProfile):
            raise ValueError("IdentitySnapshot.profile must be IdentityProfile.")
        if self.profile.agent_id != self.agent_id:
            raise ValueError("IdentitySnapshot.agent_id must match profile.agent_id.")

        if not isinstance(self.captured_at, str) or not self.captured_at:
            raise ValueError("IdentitySnapshot.captured_at must be a non-empty ISO-8601 string.")
        try:
            datetime.fromisoformat(self.captured_at)
        except ValueError as error:
            raise ValueError("IdentitySnapshot.captured_at must be ISO-8601 datetime.") from error

        if self.run_id is not None and (not isinstance(self.run_id, str) or not self.run_id):
            raise ValueError("IdentitySnapshot.run_id must be a non-empty string or None.")
        if self.reason is not None and (not isinstance(self.reason, str) or not self.reason):
            raise ValueError("IdentitySnapshot.reason must be a non-empty string or None.")
        if self.schema_version != IDENTITY_SNAPSHOT_SCHEMA_VERSION:
            raise ValueError(
                f"IdentitySnapshot.schema_version must be '{IDENTITY_SNAPSHOT_SCHEMA_VERSION}'.",
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "profile": self.profile.to_dict(),
            "captured_at": self.captured_at,
            "run_id": self.run_id,
            "reason": self.reason,
            "schema_version": self.schema_version,
        }

    @classmethod
    def from_profile(
        cls,
        *,
        profile: IdentityProfile,
        run_id: str | None = None,
        reason: str | None = None,
        captured_at: str | None = None,
    ) -> IdentitySnapshot:
        return cls(
            agent_id=profile.agent_id,
            profile=profile,
            captured_at=captured_at or _utc_now_iso(),
            run_id=run_id,
            reason=reason,
        )

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> IdentitySnapshot:
        if not isinstance(payload, dict):
            raise ValueError("IdentitySnapshot payload must be a dict.")

        profile_payload = payload.get("profile")
        return cls(
            agent_id=payload.get("agent_id"),
            profile=IdentityProfile.from_dict(profile_payload),
            captured_at=payload.get("captured_at"),
            run_id=payload.get("run_id"),
            reason=payload.get("reason"),
            schema_version=payload.get("schema_version", IDENTITY_SNAPSHOT_SCHEMA_VERSION),
        )
