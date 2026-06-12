from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote


LEARNING_CANDIDATE_SCHEMA_VERSION = "learning_candidate.v1"
LEARNING_CANDIDATE_BACKLOG_SCHEMA_VERSION = "learning_candidate_backlog.v1"

ALLOWED_CANDIDATE_TYPES = {
    "review_gate_rule",
    "prompt_adjustment",
    "context_hydration_rule",
    "router_policy_hint",
    "doc_cleanup_candidate",
    "metric_gap",
}
ALLOWED_CONFIDENCE = {"low", "medium", "high"}
ALLOWED_STATUSES = {"proposed", "reviewed", "accepted", "rejected", "implemented", "validated", "retired"}
ALLOWED_TRANSITIONS = {
    "proposed": {"reviewed"},
    "reviewed": {"accepted", "rejected"},
    "accepted": {"implemented"},
    "implemented": {"validated"},
    "validated": {"retired"},
    "rejected": {"retired"},
    "retired": set(),
}
RAW_BODY_FIELD_NAMES = {
    "raw_body",
    "body",
    "transcript",
    "raw_transcript",
    "reasoning",
    "thoughts",
    "chain_of_thought",
}
AUTHORIZATION_FIELD_NAMES = {
    "execution_authorized",
    "prompt_rewrite_authorized",
    "routing_authorized",
    "commit_or_push_authorized",
    "public_export_authorized",
}


class LearningCandidateBacklogError(ValueError):
    pass


@dataclass(slots=True)
class LearningCandidate:
    candidate_id: str
    candidate_type: str
    proposed_change: str
    source_run_ids: list[str]
    source_paths: list[str]
    evidence_count: int
    confidence: str
    status: str
    created_at: str
    updated_at: str
    expected_effect: str | None = None
    risk_level: str | None = None
    owner_decision: str | None = None
    implementation_refs: list[str] = field(default_factory=list)
    validation_refs: list[str] = field(default_factory=list)
    execution_authorized: bool = False
    prompt_rewrite_authorized: bool = False
    routing_authorized: bool = False
    commit_or_push_authorized: bool = False
    public_export_authorized: bool = False
    schema_version: str = LEARNING_CANDIDATE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        for field_name in ("candidate_id", "proposed_change", "created_at", "updated_at"):
            _require_non_empty_string(getattr(self, field_name), f"LearningCandidate.{field_name}")
        if self.candidate_type not in ALLOWED_CANDIDATE_TYPES:
            raise LearningCandidateBacklogError("LearningCandidate.candidate_type is not supported.")
        if self.confidence not in ALLOWED_CONFIDENCE:
            raise LearningCandidateBacklogError("LearningCandidate.confidence is not supported.")
        if self.status not in ALLOWED_STATUSES:
            raise LearningCandidateBacklogError("LearningCandidate.status is not supported.")
        if not isinstance(self.evidence_count, int) or self.evidence_count < 1:
            raise LearningCandidateBacklogError("LearningCandidate.evidence_count must be an integer >= 1.")
        self.source_run_ids = _require_non_empty_string_list(self.source_run_ids, "LearningCandidate.source_run_ids")
        self.source_paths = _require_non_empty_string_list(self.source_paths, "LearningCandidate.source_paths")
        self.implementation_refs = _string_list(self.implementation_refs, "LearningCandidate.implementation_refs")
        self.validation_refs = _string_list(self.validation_refs, "LearningCandidate.validation_refs")
        for field_name in ("expected_effect", "risk_level", "owner_decision"):
            value = getattr(self, field_name)
            if value is not None and (not isinstance(value, str) or not value.strip()):
                raise LearningCandidateBacklogError(f"LearningCandidate.{field_name} must be a non-empty string or None.")
        _validate_iso_datetime(self.created_at, "LearningCandidate.created_at")
        _validate_iso_datetime(self.updated_at, "LearningCandidate.updated_at")
        _validate_non_execution_flags(self)
        if self.confidence == "high" and not self.validation_refs:
            raise LearningCandidateBacklogError("LearningCandidate.high confidence requires validation_refs.")
        if self.status in {"accepted", "rejected"} and not self.owner_decision:
            raise LearningCandidateBacklogError("LearningCandidate.accepted/rejected status requires owner_decision.")
        if self.status == "implemented" and not self.implementation_refs:
            raise LearningCandidateBacklogError("LearningCandidate.implemented status requires implementation_refs.")
        if self.status == "validated" and not self.validation_refs:
            raise LearningCandidateBacklogError("LearningCandidate.validated status requires validation_refs.")
        if self.schema_version != LEARNING_CANDIDATE_SCHEMA_VERSION:
            raise LearningCandidateBacklogError(
                f"LearningCandidate.schema_version must be '{LEARNING_CANDIDATE_SCHEMA_VERSION}'."
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate_id": self.candidate_id,
            "candidate_type": self.candidate_type,
            "proposed_change": self.proposed_change,
            "source_run_ids": list(self.source_run_ids),
            "source_paths": list(self.source_paths),
            "evidence_count": self.evidence_count,
            "confidence": self.confidence,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "expected_effect": self.expected_effect,
            "risk_level": self.risk_level,
            "owner_decision": self.owner_decision,
            "implementation_refs": list(self.implementation_refs),
            "validation_refs": list(self.validation_refs),
            "execution_authorized": False,
            "prompt_rewrite_authorized": False,
            "routing_authorized": False,
            "commit_or_push_authorized": False,
            "public_export_authorized": False,
            "schema_version": self.schema_version,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> LearningCandidate:
        if not isinstance(payload, dict):
            raise LearningCandidateBacklogError("LearningCandidate payload must be an object.")
        _reject_forbidden_payload_keys(payload)
        return cls(
            candidate_id=payload.get("candidate_id"),
            candidate_type=payload.get("candidate_type"),
            proposed_change=payload.get("proposed_change"),
            source_run_ids=payload.get("source_run_ids"),
            source_paths=payload.get("source_paths"),
            evidence_count=payload.get("evidence_count"),
            confidence=payload.get("confidence"),
            status=payload.get("status"),
            created_at=payload.get("created_at"),
            updated_at=payload.get("updated_at"),
            expected_effect=_optional_string(payload.get("expected_effect")),
            risk_level=_optional_string(payload.get("risk_level")),
            owner_decision=_optional_string(payload.get("owner_decision")),
            implementation_refs=payload.get("implementation_refs", []),
            validation_refs=payload.get("validation_refs", []),
            execution_authorized=payload.get("execution_authorized", False),
            prompt_rewrite_authorized=payload.get("prompt_rewrite_authorized", False),
            routing_authorized=payload.get("routing_authorized", False),
            commit_or_push_authorized=payload.get("commit_or_push_authorized", False),
            public_export_authorized=payload.get("public_export_authorized", False),
            schema_version=payload.get("schema_version", LEARNING_CANDIDATE_SCHEMA_VERSION),
        )


@dataclass(slots=True)
class LearningCandidateBacklog:
    project_id: str
    candidates: list[LearningCandidate] = field(default_factory=list)
    updated_at: str | None = None
    schema_version: str = LEARNING_CANDIDATE_BACKLOG_SCHEMA_VERSION

    def __post_init__(self) -> None:
        _require_non_empty_string(self.project_id, "LearningCandidateBacklog.project_id")
        if not isinstance(self.candidates, list) or not all(isinstance(item, LearningCandidate) for item in self.candidates):
            raise LearningCandidateBacklogError("LearningCandidateBacklog.candidates must contain LearningCandidate values.")
        if self.updated_at is not None:
            _validate_iso_datetime(self.updated_at, "LearningCandidateBacklog.updated_at")
        if self.schema_version != LEARNING_CANDIDATE_BACKLOG_SCHEMA_VERSION:
            raise LearningCandidateBacklogError(
                f"LearningCandidateBacklog.schema_version must be '{LEARNING_CANDIDATE_BACKLOG_SCHEMA_VERSION}'."
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "candidates": [candidate.to_dict() for candidate in self.candidates],
            "updated_at": self.updated_at,
            "schema_version": self.schema_version,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> LearningCandidateBacklog:
        if not isinstance(payload, dict):
            raise LearningCandidateBacklogError("LearningCandidateBacklog payload must be an object.")
        candidates = payload.get("candidates", [])
        if not isinstance(candidates, list):
            raise LearningCandidateBacklogError("LearningCandidateBacklog.candidates must be a list.")
        return cls(
            project_id=payload.get("project_id"),
            candidates=[LearningCandidate.from_dict(candidate) for candidate in candidates],
            updated_at=payload.get("updated_at"),
            schema_version=payload.get("schema_version", LEARNING_CANDIDATE_BACKLOG_SCHEMA_VERSION),
        )


class JSONLearningCandidateBacklogStore:
    def __init__(self, *, data_dir: str | Path = "data") -> None:
        self._root_dir = Path(data_dir) / "learning_candidates"

    @property
    def root_dir(self) -> Path:
        return self._root_dir

    def load_backlog(self, *, project_id: str) -> LearningCandidateBacklog | None:
        path = self.backlog_path(project_id=project_id)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise LearningCandidateBacklogError(f"Invalid learning candidate backlog JSON at {path.as_posix()}: {error}") from error
        return LearningCandidateBacklog.from_dict(payload)

    def save_backlog(self, backlog: LearningCandidateBacklog) -> Path:
        path = self.backlog_path(project_id=backlog.project_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(backlog.to_dict(), indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        return path

    def backlog_path(self, *, project_id: str) -> Path:
        _require_non_empty_string(project_id, "project_id")
        return self._root_dir / f"{_encoded_file_stem(project_id)}.json"


def merge_candidate(
    *,
    backlog: LearningCandidateBacklog,
    candidate: LearningCandidate,
    now: str | None = None,
) -> LearningCandidateBacklog:
    timestamp = now or _utc_now()
    for index, existing in enumerate(backlog.candidates):
        if _candidate_merge_key(existing) != _candidate_merge_key(candidate):
            continue
        merged_run_ids = _dedupe_strings([*existing.source_run_ids, *candidate.source_run_ids])
        merged_source_paths = _dedupe_strings([*existing.source_paths, *candidate.source_paths])
        backlog.candidates[index] = replace(
            existing,
            source_run_ids=merged_run_ids,
            source_paths=merged_source_paths,
            evidence_count=max(existing.evidence_count, candidate.evidence_count, len(merged_run_ids), len(merged_source_paths)),
            updated_at=timestamp,
        )
        backlog.updated_at = timestamp
        return backlog
    backlog.candidates.append(replace(candidate, updated_at=timestamp))
    backlog.updated_at = timestamp
    return backlog


def transition_candidate(
    candidate: LearningCandidate,
    new_status: str,
    *,
    owner_decision: str | None = None,
    implementation_refs: list[str] | None = None,
    validation_refs: list[str] | None = None,
    now: str | None = None,
) -> LearningCandidate:
    if new_status not in ALLOWED_STATUSES:
        raise LearningCandidateBacklogError("LearningCandidate transition target status is not supported.")
    if new_status not in ALLOWED_TRANSITIONS[candidate.status]:
        raise LearningCandidateBacklogError(f"Invalid learning candidate transition: {candidate.status} -> {new_status}")
    next_owner_decision = owner_decision if owner_decision is not None else candidate.owner_decision
    if new_status in {"accepted", "rejected"} and not next_owner_decision:
        raise LearningCandidateBacklogError("LearningCandidate.accepted/rejected status requires owner_decision.")
    refs_for_implementation = implementation_refs if implementation_refs is not None else candidate.implementation_refs
    refs_for_validation = validation_refs if validation_refs is not None else candidate.validation_refs
    return replace(
        candidate,
        status=new_status,
        owner_decision=next_owner_decision,
        implementation_refs=refs_for_implementation,
        validation_refs=refs_for_validation,
        updated_at=now or _utc_now(),
    )


def _reject_forbidden_payload_keys(payload: dict[str, Any]) -> None:
    for key in payload:
        if key in RAW_BODY_FIELD_NAMES:
            raise LearningCandidateBacklogError(f"LearningCandidate payload contains forbidden raw body/transcript field: {key}")
        if key in AUTHORIZATION_FIELD_NAMES and payload.get(key) is True:
            raise LearningCandidateBacklogError(f"LearningCandidate payload must not authorize execution field: {key}")


def _validate_non_execution_flags(candidate: LearningCandidate) -> None:
    for field_name in AUTHORIZATION_FIELD_NAMES:
        if getattr(candidate, field_name) is not False:
            raise LearningCandidateBacklogError(f"LearningCandidate.{field_name} must remain false.")


def _require_non_empty_string(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise LearningCandidateBacklogError(f"{field_name} must be a non-empty string.")
    return value.strip()


def _require_non_empty_string_list(value: Any, field_name: str) -> list[str]:
    result = _string_list(value, field_name)
    if not result:
        raise LearningCandidateBacklogError(f"{field_name} must be a non-empty list.")
    return result


def _string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise LearningCandidateBacklogError(f"{field_name} must be a list.")
    result = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise LearningCandidateBacklogError(f"{field_name} must contain only non-empty strings.")
        result.append(item.strip())
    return result


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise LearningCandidateBacklogError("Optional learning candidate strings must be non-empty strings or None.")
    return value.strip()


def _validate_iso_datetime(value: str, field_name: str) -> None:
    try:
        datetime.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise LearningCandidateBacklogError(f"{field_name} must be an ISO-8601 datetime.") from error


def _candidate_merge_key(candidate: LearningCandidate) -> tuple[str, str]:
    return (candidate.candidate_type, _normalize(candidate.proposed_change))


def _dedupe_strings(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        if value not in result:
            result.append(value)
    return result


def _normalize(value: str) -> str:
    return " ".join(value.split()).strip().lower()


def _encoded_file_stem(value: str) -> str:
    return quote(value, safe="-_.")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
