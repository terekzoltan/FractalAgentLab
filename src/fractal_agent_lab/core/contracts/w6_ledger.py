from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from fractal_agent_lab.core.contracts.w6_packet import (
    W6Packet,
    W6PacketValidationResult,
    W6PrivacyClassification,
    W6ValidationStatus,
)


W6_LEDGER_SCHEMA_VERSION = "w6.evidence_ledger.v1"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class W6LedgerEntry:
    loop_id: str
    packet_id: str
    stage: str
    decision: str | None
    producer: str
    consumer: str
    originating_track: str
    sequence_ref: str
    created_at: str
    received_at: str | None = None
    artifact_refs: list[dict[str, Any]] = field(default_factory=list)
    changed_files: list[str] = field(default_factory=list)
    tests_run: list[str] = field(default_factory=list)
    missing_tests: list[str] = field(default_factory=list)
    findings_count: int | None = None
    accepted_findings_count: int | None = None
    rejected_findings_count: int | None = None
    manual_intervention_count: int | None = None
    copy_paste_avoided_count: int | None = None
    privacy_classification: str = W6PrivacyClassification.PRIVATE_RAW.value
    validation_status: str = W6ValidationStatus.PASS.value
    validation_warnings: list[str] = field(default_factory=list)
    ledger_schema_version: str = W6_LEDGER_SCHEMA_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {
            "ledger_schema_version": self.ledger_schema_version,
            "loop_id": self.loop_id,
            "packet_id": self.packet_id,
            "stage": self.stage,
            "decision": self.decision,
            "producer": self.producer,
            "consumer": self.consumer,
            "originating_track": self.originating_track,
            "sequence_ref": self.sequence_ref,
            "created_at": self.created_at,
            "received_at": self.received_at,
            "artifact_refs": list(self.artifact_refs),
            "changed_files": list(self.changed_files),
            "tests_run": list(self.tests_run),
            "missing_tests": list(self.missing_tests),
            "findings_count": self.findings_count,
            "accepted_findings_count": self.accepted_findings_count,
            "rejected_findings_count": self.rejected_findings_count,
            "manual_intervention_count": self.manual_intervention_count,
            "copy_paste_avoided_count": self.copy_paste_avoided_count,
            "privacy_classification": self.privacy_classification,
            "validation_status": self.validation_status,
            "validation_warnings": list(self.validation_warnings),
        }


@dataclass(slots=True)
class W6LedgerDocument:
    loop_id: str
    entries: list[W6LedgerEntry] = field(default_factory=list)
    ledger_schema_version: str = W6_LEDGER_SCHEMA_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {
            "ledger_schema_version": self.ledger_schema_version,
            "loop_id": self.loop_id,
            "entries": [entry.as_dict() for entry in self.entries],
        }


def ledger_entry_from_validated_packet(
    validation_result: W6PacketValidationResult,
    *,
    received_at: str | None = None,
    changed_files: list[str] | None = None,
    tests_run: list[str] | None = None,
    missing_tests: list[str] | None = None,
) -> W6LedgerEntry:
    if not validation_result.passed or validation_result.packet is None:
        raise ValueError("Cannot create W6 ledger entry from an invalid packet validation result.")
    packet: W6Packet = validation_result.packet
    return W6LedgerEntry(
        loop_id=packet.loop_id,
        packet_id=packet.packet_id,
        stage=packet.stage.value,
        decision=packet.decision.value if packet.decision else None,
        producer=packet.producer.value,
        consumer=packet.consumer.value,
        originating_track=packet.originating_track.value,
        sequence_ref=packet.sequence_ref,
        created_at=packet.created_at,
        received_at=received_at or _utc_now_iso(),
        artifact_refs=[artifact_ref.as_dict() for artifact_ref in packet.artifact_refs],
        changed_files=list(changed_files or []),
        tests_run=list(tests_run or []),
        missing_tests=list(missing_tests or []),
        privacy_classification=packet.privacy_classification.value,
        validation_status=validation_result.validation_status.value,
        validation_warnings=list(validation_result.warnings),
    )
