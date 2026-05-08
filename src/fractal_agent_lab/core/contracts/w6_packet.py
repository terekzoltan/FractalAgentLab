from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Mapping, TypeVar


W6_PACKET_SCHEMA_VERSION = "w6.packet.v1"

KNOWN_SOURCE_COMMANDS = {
    "/seq-next",
    "/terv-review",
    "/terv-review-utan",
    "/implement",
    "/step-review",
    "/deep-review",
    "/review-fix",
    "manual_operator_action",
}

REQUIRED_VISIBILITY_AUDIT_FIELDS = {
    "execution_mode",
    "git_visible_state",
    "local_only_sources",
    "data_artifacts_consulted",
    "notes",
}

SAFE_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
WINDOWS_RESERVED_DEVICE_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}
RESERVED_PACKET_IDS = {"ledger"}

TStrEnum = TypeVar("TStrEnum", bound=StrEnum)


class W6PacketStage(StrEnum):
    PLAN_READY_FOR_META_REVIEW = "plan_ready_for_meta_review"
    META_PLAN_REVIEW_DONE = "meta_plan_review_done"
    PLAN_REVIEW_ACKNOWLEDGED = "plan_review_acknowledged"
    IMPLEMENTATION_DONE = "implementation_done"
    STEP_REVIEW_DONE = "step_review_done"
    STEP_REVIEW_ACKNOWLEDGED = "step_review_acknowledged"
    REVIEW_FIX_DONE = "review_fix_done"


class W6PacketDecision(StrEnum):
    GREENLIT = "greenlit"
    CHANGES_REQUESTED = "changes_requested"
    BLOCKED = "blocked"
    PASS = "pass"
    FIX_REQUIRED = "fix_required"
    HOLD = "hold"
    DEEP_REVIEW_NEEDED = "deep_review_needed"


class W6PacketActor(StrEnum):
    META = "meta"
    TRACK = "track"
    ROUTER = "router"


class W6TrackLabel(StrEnum):
    TRACK_A = "track_a"
    TRACK_B = "track_b"
    TRACK_C = "track_c"
    TRACK_D = "track_d"
    TRACK_E = "track_e"
    META = "meta"
    UNKNOWN = "unknown"


class W6PrivacyClassification(StrEnum):
    PRIVATE_RAW = "private_raw"
    SANITIZED_PUBLIC = "sanitized_public"
    MIXED = "mixed"


class W6ValidationStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"


DECISIONS_BY_STAGE: dict[W6PacketStage, set[W6PacketDecision]] = {
    W6PacketStage.META_PLAN_REVIEW_DONE: {
        W6PacketDecision.GREENLIT,
        W6PacketDecision.CHANGES_REQUESTED,
        W6PacketDecision.BLOCKED,
    },
    W6PacketStage.STEP_REVIEW_DONE: {
        W6PacketDecision.PASS,
        W6PacketDecision.FIX_REQUIRED,
        W6PacketDecision.HOLD,
        W6PacketDecision.DEEP_REVIEW_NEEDED,
    },
}

REQUIRED_PAYLOAD_FIELDS_BY_STAGE: dict[W6PacketStage, set[str]] = {
    W6PacketStage.PLAN_READY_FOR_META_REVIEW: {
        "implementation_plan_summary",
        "assumptions",
        "risks",
        "dependencies",
        "affected_files_or_surfaces",
        "proposed_acceptance_checks",
        "explicit_non_goals",
    },
    W6PacketStage.META_PLAN_REVIEW_DONE: {
        "findings_first_plan_review",
        "required_plan_changes",
        "blockers",
        "residual_risks",
        "meta_guidance",
        "track_facing_handoff_summary",
    },
    W6PacketStage.PLAN_REVIEW_ACKNOWLEDGED: {
        "consumed_review_packet_reference",
        "track_response",
        "planned_next_action",
    },
    W6PacketStage.IMPLEMENTATION_DONE: {
        "implementation_summary",
        "changed_files",
        "tests_checks_run",
        "missing_tests_or_skipped_checks",
        "deviations_from_accepted_plan",
        "known_gaps",
        "exact_review_request",
    },
    W6PacketStage.STEP_REVIEW_DONE: {
        "findings_first_implementation_review",
        "missing_tests",
        "required_fixes",
        "residual_risks",
        "commit_readiness_recommendation",
        "deep_review_needed",
    },
    W6PacketStage.STEP_REVIEW_ACKNOWLEDGED: {
        "consumed_review_packet_reference",
        "track_response",
        "final_completion_acknowledgement_or_next_action",
    },
    W6PacketStage.REVIEW_FIX_DONE: {
        "fixed_findings",
        "files_changed_during_fix",
        "validation_rerun_summary",
        "residual_risk_note",
        "re_review_request",
    },
}


@dataclass(slots=True)
class W6ArtifactRef:
    path: str
    kind: str
    privacy_classification: W6PrivacyClassification = W6PrivacyClassification.PRIVATE_RAW

    def as_dict(self) -> dict[str, str]:
        return {
            "path": self.path,
            "kind": self.kind,
            "privacy_classification": self.privacy_classification.value,
        }


@dataclass(slots=True)
class W6Packet:
    packet_id: str
    loop_id: str
    stage: W6PacketStage
    producer: W6PacketActor
    consumer: W6PacketActor
    originating_track: W6TrackLabel
    target_track: W6TrackLabel
    sequence_ref: str
    source_command: str
    decision: W6PacketDecision | None
    created_at: str
    parent_packet_id: str | None
    artifact_refs: list[W6ArtifactRef]
    payload_summary: str
    payload: dict[str, Any]
    visibility_audit_state: dict[str, Any]
    privacy_classification: W6PrivacyClassification = W6PrivacyClassification.PRIVATE_RAW
    validation: dict[str, Any] = field(default_factory=dict)
    schema_version: str = W6_PACKET_SCHEMA_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "packet_id": self.packet_id,
            "loop_id": self.loop_id,
            "stage": self.stage.value,
            "producer": self.producer.value,
            "consumer": self.consumer.value,
            "originating_track": self.originating_track.value,
            "target_track": self.target_track.value,
            "sequence_ref": self.sequence_ref,
            "source_command": self.source_command,
            "decision": self.decision.value if self.decision else None,
            "created_at": self.created_at,
            "parent_packet_id": self.parent_packet_id,
            "artifact_refs": [artifact_ref.as_dict() for artifact_ref in self.artifact_refs],
            "payload_summary": self.payload_summary,
            "payload": dict(self.payload),
            "visibility_audit_state": dict(self.visibility_audit_state),
            "privacy_classification": self.privacy_classification.value,
            "validation": dict(self.validation),
        }


@dataclass(slots=True)
class W6PacketValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    packet: W6Packet | None = None

    @property
    def passed(self) -> bool:
        return not self.errors

    @property
    def validation_status(self) -> W6ValidationStatus:
        if self.errors:
            return W6ValidationStatus.FAIL
        if self.warnings:
            return W6ValidationStatus.WARNING
        return W6ValidationStatus.PASS


def validate_w6_packet(payload: Mapping[str, Any]) -> W6PacketValidationResult:
    result = W6PacketValidationResult()

    schema_version = _required_text(payload, "schema_version", result.errors)
    if schema_version and schema_version != W6_PACKET_SCHEMA_VERSION:
        result.errors.append(
            f"Packet has unsupported schema_version '{schema_version}' (expected {W6_PACKET_SCHEMA_VERSION}).",
        )

    packet_id = _required_safe_identifier(
        payload,
        "packet_id",
        result.errors,
        reserved_names=RESERVED_PACKET_IDS,
    )
    loop_id = _required_safe_identifier(payload, "loop_id", result.errors)
    sequence_ref = _required_text(payload, "sequence_ref", result.errors)
    source_command = _required_text(payload, "source_command", result.errors)
    created_at = _required_text(payload, "created_at", result.errors)
    parent_packet_id = _optional_safe_identifier(payload, "parent_packet_id", result.errors)
    payload_summary = _required_text(payload, "payload_summary", result.errors)

    if source_command and source_command not in KNOWN_SOURCE_COMMANDS:
        result.warnings.append(f"Packet source_command is not a known label: {source_command}")
    if created_at:
        _validate_iso8601(created_at, field_name="created_at", errors=result.errors)

    stage = _enum_value(W6PacketStage, payload.get("stage"), "stage", result.errors)
    producer = _enum_value(W6PacketActor, payload.get("producer"), "producer", result.errors)
    consumer = _enum_value(W6PacketActor, payload.get("consumer"), "consumer", result.errors)
    originating_track = _enum_value(W6TrackLabel, payload.get("originating_track"), "originating_track", result.errors)
    target_track = _enum_value(W6TrackLabel, payload.get("target_track"), "target_track", result.errors)
    decision = _optional_enum_value(W6PacketDecision, payload.get("decision"), "decision", result.errors)
    privacy_classification = _enum_value(
        W6PrivacyClassification,
        payload.get("privacy_classification"),
        "privacy_classification",
        result.errors,
    )

    if originating_track == W6TrackLabel.UNKNOWN:
        result.warnings.append("Packet originating_track is 'unknown'.")
    if target_track == W6TrackLabel.UNKNOWN:
        result.warnings.append("Packet target_track is 'unknown'.")

    artifact_refs = _parse_artifact_refs(payload.get("artifact_refs"), result)
    packet_payload = _required_mapping(payload, "payload", result.errors)
    visibility_audit_state = _required_mapping(payload, "visibility_audit_state", result.errors)
    validation = _required_mapping(payload, "validation", result.errors)

    if visibility_audit_state is not None:
        _validate_visibility_audit_state(visibility_audit_state, result.errors)

    if stage is not None:
        allowed_decisions = DECISIONS_BY_STAGE.get(stage)
        if allowed_decisions is None:
            if decision is not None:
                result.errors.append(f"Stage '{stage.value}' requires decision to be null.")
        elif decision is None:
            result.errors.append(f"Stage '{stage.value}' requires a non-null decision.")
        elif decision not in allowed_decisions:
            allowed = ", ".join(sorted(item.value for item in allowed_decisions))
            result.errors.append(
                f"Stage '{stage.value}' does not allow decision '{decision.value}' (allowed: {allowed}).",
            )

        if packet_payload is not None:
            missing_payload_fields = sorted(REQUIRED_PAYLOAD_FIELDS_BY_STAGE[stage].difference(packet_payload))
            for field_name in missing_payload_fields:
                result.errors.append(f"Stage '{stage.value}' payload missing required field '{field_name}'.")

    if result.errors:
        return result

    result.packet = W6Packet(
        packet_id=packet_id or "",
        loop_id=loop_id or "",
        stage=stage or W6PacketStage.PLAN_READY_FOR_META_REVIEW,
        producer=producer or W6PacketActor.TRACK,
        consumer=consumer or W6PacketActor.META,
        originating_track=originating_track or W6TrackLabel.UNKNOWN,
        target_track=target_track or W6TrackLabel.UNKNOWN,
        sequence_ref=sequence_ref or "",
        source_command=source_command or "",
        decision=decision,
        created_at=created_at or "",
        parent_packet_id=parent_packet_id,
        artifact_refs=artifact_refs,
        payload_summary=payload_summary or "",
        payload=dict(packet_payload or {}),
        visibility_audit_state=dict(visibility_audit_state or {}),
        privacy_classification=privacy_classification or W6PrivacyClassification.PRIVATE_RAW,
        validation=dict(validation or {}),
        schema_version=W6_PACKET_SCHEMA_VERSION,
    )
    return result


def require_w6_path_identifier(
    value: str,
    *,
    field_name: str,
    reserved_names: set[str] | frozenset[str] = frozenset(),
) -> str:
    errors: list[str] = []
    identifier = _validate_safe_identifier(value, field_name, errors, reserved_names=reserved_names)
    if errors or identifier is None:
        raise ValueError(" ".join(errors))
    return identifier


def _required_text(payload: Mapping[str, Any], key: str, errors: list[str]) -> str | None:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    errors.append(f"Packet missing non-empty '{key}'.")
    return None


def _required_safe_identifier(
    payload: Mapping[str, Any],
    key: str,
    errors: list[str],
    *,
    reserved_names: set[str] | frozenset[str] = frozenset(),
) -> str | None:
    return _validate_safe_identifier(payload.get(key), key, errors, reserved_names=reserved_names)


def _optional_safe_identifier(payload: Mapping[str, Any], key: str, errors: list[str]) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    return _validate_safe_identifier(value, key, errors)


def _validate_safe_identifier(
    value: Any,
    field_name: str,
    errors: list[str],
    *,
    reserved_names: set[str] | frozenset[str] = frozenset(),
) -> str | None:
    if not isinstance(value, str) or not value:
        errors.append(f"Packet field '{field_name}' must be a non-empty path-safe identifier.")
        return None
    if value != value.strip():
        errors.append(f"Packet field '{field_name}' must not contain leading or trailing whitespace.")
        return None
    if not SAFE_IDENTIFIER_PATTERN.fullmatch(value):
        errors.append(
            f"Packet field '{field_name}' must contain only ASCII letters, digits, '_' or '-'.",
        )
        return None
    if value.upper() in WINDOWS_RESERVED_DEVICE_NAMES:
        errors.append(f"Packet field '{field_name}' must not use Windows reserved device name '{value}'.")
        return None
    if value.lower() in reserved_names:
        errors.append(f"Packet field '{field_name}' uses reserved identifier '{value}'.")
        return None
    return value


def _optional_text(payload: Mapping[str, Any], key: str, errors: list[str]) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if isinstance(value, str) and value.strip():
        return value.strip()
    errors.append(f"Packet field '{key}' must be null or a non-empty string.")
    return None


def _required_mapping(payload: Mapping[str, Any], key: str, errors: list[str]) -> dict[str, Any] | None:
    value = payload.get(key)
    if isinstance(value, Mapping):
        return dict(value)
    errors.append(f"Packet field '{key}' must be an object.")
    return None


def _enum_value(enum_type: type[TStrEnum], value: Any, field_name: str, errors: list[str]) -> TStrEnum | None:
    if isinstance(value, str):
        try:
            return enum_type(value)
        except ValueError:
            pass
    allowed = ", ".join(item.value for item in enum_type)
    errors.append(f"Packet field '{field_name}' has unknown value {value!r} (allowed: {allowed}).")
    return None


def _optional_enum_value(
    enum_type: type[TStrEnum],
    value: Any,
    field_name: str,
    errors: list[str],
) -> TStrEnum | None:
    if value is None:
        return None
    return _enum_value(enum_type, value, field_name, errors)


def _parse_artifact_refs(value: Any, result: W6PacketValidationResult) -> list[W6ArtifactRef]:
    if not isinstance(value, list):
        result.errors.append("Packet field 'artifact_refs' must be a list.")
        return []

    artifact_refs: list[W6ArtifactRef] = []
    for index, item in enumerate(value, start=1):
        if not isinstance(item, Mapping):
            result.errors.append(f"Artifact ref #{index} must be an object.")
            continue
        path = item.get("path")
        kind = item.get("kind")
        privacy = item.get("privacy_classification")
        if not isinstance(path, str) or not path.strip():
            result.errors.append(f"Artifact ref #{index} missing non-empty 'path'.")
            continue
        if not isinstance(kind, str) or not kind.strip():
            result.errors.append(f"Artifact ref #{index} missing non-empty 'kind'.")
            continue
        privacy_classification = _enum_value(
            W6PrivacyClassification,
            privacy,
            f"artifact_refs[{index}].privacy_classification",
            result.errors,
        )
        if privacy_classification is None:
            continue
        artifact_refs.append(
            W6ArtifactRef(
                path=path.strip(),
                kind=kind.strip(),
                privacy_classification=privacy_classification,
            ),
        )
    return artifact_refs


def _validate_visibility_audit_state(value: Mapping[str, Any], errors: list[str]) -> None:
    missing = sorted(REQUIRED_VISIBILITY_AUDIT_FIELDS.difference(value))
    for field_name in missing:
        errors.append(f"visibility_audit_state missing required field '{field_name}'.")

    if "local_only_sources" in value and not isinstance(value.get("local_only_sources"), list):
        errors.append("visibility_audit_state.local_only_sources must be a list.")
    if "data_artifacts_consulted" in value and not isinstance(value.get("data_artifacts_consulted"), list):
        errors.append("visibility_audit_state.data_artifacts_consulted must be a list.")
    for text_field in ("execution_mode", "git_visible_state", "notes"):
        if text_field in value and not isinstance(value.get(text_field), str):
            errors.append(f"visibility_audit_state.{text_field} must be a string.")


def _validate_iso8601(value: str, *, field_name: str, errors: list[str]) -> None:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        errors.append(f"Packet field '{field_name}' must be an ISO-8601 timestamp.")
