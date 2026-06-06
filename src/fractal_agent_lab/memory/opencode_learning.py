from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.memory.json_store import JSONProjectMemoryStore
from fractal_agent_lab.memory.project_memory import ProjectMemory, ProjectMemoryEntry, PROJECT_MEMORY_SCHEMA_VERSION
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


W7_OPENCODE_LEARNING_UPDATE_ARTIFACT_VERSION = "1.0"
W7_OPENCODE_LOOP_WORKFLOW_ID = "opencode.meta_track.loop.v1"
GLOBAL_LEARNING_TOPIC_SCHEMA_VERSION = "global_learning.topic.v1"
GLOBAL_LEARNING_ENTRY_SCHEMA_VERSION = "global_learning.entry.v1"
GLOBAL_LEARNING_TOPICS = {
    "opencode_review_patterns",
    "router_transport_lessons",
    "manual_smoke_gate_patterns",
    "meta_triage_patterns",
    "review_fix_patterns",
}
W7_SIDECAR_SCHEMA_VERSIONS = {
    "opencode_loop_summary": "w7.opencode_loop_summary.v1",
    "packet_ledger": "w7.packet_ledger.v1",
    "selected_outputs": "w7.selected_outputs.v1",
    "review_synthesis": "w7.review_synthesis.v1",
    "approval_log": "w7.approval_log.v1",
    "ingest_report": "w7.ingest_report.v1",
}


@dataclass(slots=True)
class GlobalLearningEntry:
    topic: str
    lesson: str
    source_run_ids: list[str]
    source_paths: list[str]
    times_observed: int = 1
    confidence: str = "low"
    deidentified: bool = True
    last_updated_at: str | None = None
    schema_version: str = GLOBAL_LEARNING_ENTRY_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.topic not in GLOBAL_LEARNING_TOPICS:
            raise ValueError("GlobalLearningEntry.topic is not supported.")
        for field_name in ("lesson", "confidence"):
            value = getattr(self, field_name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"GlobalLearningEntry.{field_name} must be a non-empty string.")
        for field_name in ("source_run_ids", "source_paths"):
            value = getattr(self, field_name)
            if not isinstance(value, list) or not value:
                raise ValueError(f"GlobalLearningEntry.{field_name} must be a non-empty list.")
            if not all(isinstance(item, str) and item.strip() for item in value):
                raise ValueError(f"GlobalLearningEntry.{field_name} must contain non-empty strings.")
        if not isinstance(self.times_observed, int) or self.times_observed < 1:
            raise ValueError("GlobalLearningEntry.times_observed must be an integer >= 1.")
        if self.deidentified is not True:
            raise ValueError("GlobalLearningEntry.deidentified must be true.")
        if self.last_updated_at is not None:
            datetime.fromisoformat(self.last_updated_at)
        if self.schema_version != GLOBAL_LEARNING_ENTRY_SCHEMA_VERSION:
            raise ValueError(
                f"GlobalLearningEntry.schema_version must be '{GLOBAL_LEARNING_ENTRY_SCHEMA_VERSION}'."
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "topic": self.topic,
            "lesson": self.lesson,
            "source_run_ids": list(self.source_run_ids),
            "source_paths": list(self.source_paths),
            "times_observed": self.times_observed,
            "confidence": self.confidence,
            "deidentified": self.deidentified,
            "last_updated_at": self.last_updated_at,
            "schema_version": self.schema_version,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> GlobalLearningEntry:
        if not isinstance(payload, dict):
            raise ValueError("GlobalLearningEntry payload must be a dict.")
        return cls(
            topic=payload.get("topic"),
            lesson=payload.get("lesson"),
            source_run_ids=payload.get("source_run_ids"),
            source_paths=payload.get("source_paths"),
            times_observed=payload.get("times_observed", 1),
            confidence=payload.get("confidence", "low"),
            deidentified=payload.get("deidentified", True),
            last_updated_at=payload.get("last_updated_at"),
            schema_version=payload.get("schema_version", GLOBAL_LEARNING_ENTRY_SCHEMA_VERSION),
        )


@dataclass(slots=True)
class W7OpenCodeLearningUpdateResult:
    run_id: str
    write: bool
    accepted: bool
    project_id: str | None = None
    skipped_reasons: list[str] = field(default_factory=list)
    project_candidates: list[dict[str, Any]] = field(default_factory=list)
    global_candidates: list[dict[str, Any]] = field(default_factory=list)
    project_created_count: int = 0
    project_updated_count: int = 0
    project_skipped_count: int = 0
    global_created_count: int = 0
    global_updated_count: int = 0
    global_skipped_count: int = 0
    sidecar_path: Path | None = None


class JSONGlobalLearningStore:
    def __init__(self, *, data_dir: str | Path = "data", data_subdir: str = "memory") -> None:
        if not isinstance(data_subdir, str) or not data_subdir.strip():
            raise ValueError("data_subdir must be a non-empty string.")
        self._root_dir = Path(data_dir) / data_subdir
        self._global_dir = self._root_dir / "global"

    def load_topic(self, *, topic: str) -> list[GlobalLearningEntry]:
        self._validate_topic(topic)
        path = self.topic_path(topic=topic)
        if not path.exists():
            return []
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"Invalid global learning JSON file at {path.as_posix()}: {error}") from error
        if not isinstance(payload, dict):
            raise ValueError(f"Global learning JSON file must be an object: {path.as_posix()}")
        if payload.get("schema_version") != GLOBAL_LEARNING_TOPIC_SCHEMA_VERSION:
            raise ValueError("Global learning topic schema version is unsupported.")
        if payload.get("topic") != topic:
            raise ValueError("Global learning topic payload does not match path topic.")
        entries = payload.get("entries")
        if not isinstance(entries, list):
            raise ValueError("Global learning topic entries must be a list.")
        return [GlobalLearningEntry.from_dict(entry) for entry in entries]

    def save_topic(self, *, topic: str, entries: list[GlobalLearningEntry]) -> Path:
        self._validate_topic(topic)
        if not all(isinstance(entry, GlobalLearningEntry) for entry in entries):
            raise ValueError("entries must contain GlobalLearningEntry values.")
        path = self.topic_path(topic=topic)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": GLOBAL_LEARNING_TOPIC_SCHEMA_VERSION,
            "topic": topic,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "entries": [entry.to_dict() for entry in entries],
        }
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
        return path

    def topic_path(self, *, topic: str) -> Path:
        self._validate_topic(topic)
        return self._global_dir / f"{topic}.json"

    def _validate_topic(self, topic: str) -> None:
        if topic not in GLOBAL_LEARNING_TOPICS:
            raise ValueError("Unsupported global learning topic.")


def run_w7_opencode_learning_update(
    run_id: str,
    *,
    data_dir: str | Path = "data",
    write: bool = False,
) -> W7OpenCodeLearningUpdateResult:
    from fractal_agent_lab.evals.artifact_acceptance import validate_run_trace_by_run_id

    result = W7OpenCodeLearningUpdateResult(run_id=run_id, write=write, accepted=False)
    validation = validate_run_trace_by_run_id(run_id, data_dir=data_dir)
    if not validation.passed or validation.run_payload is None:
        result.skipped_reasons.extend([f"artifact_acceptance:{error}" for error in validation.errors])
        return result

    run_payload = validation.run_payload
    if run_payload.get("workflow_id") != W7_OPENCODE_LOOP_WORKFLOW_ID:
        result.skipped_reasons.append("unsupported_workflow")
        return result
    if run_payload.get("status") != "succeeded":
        result.skipped_reasons.append("run_not_succeeded")
        return result

    sidecars = _load_sidecars(run_id=run_id, data_dir=data_dir, skipped_reasons=result.skipped_reasons)
    if sidecars is None:
        return result

    project_id = _extract_project_id(run_payload)
    if project_id is None:
        result.skipped_reasons.append("missing_project_id")
        return result
    result.project_id = project_id

    privacy_terms = _privacy_sensitive_terms(run_payload, sidecars)
    project_entries = _extract_project_entries(run_payload=run_payload, project_id=project_id)
    global_entries, global_skipped = _extract_global_entries(
        run_payload=run_payload,
        sidecars=sidecars,
        privacy_terms=privacy_terms,
    )
    result.skipped_reasons.extend(global_skipped)
    result.project_candidates = [entry.to_dict() for entry in project_entries]
    result.global_candidates = [entry.to_dict() for entry in global_entries]
    result.accepted = True

    if not write:
        return result

    result.project_created_count, result.project_updated_count, result.project_skipped_count = _write_project_entries(
        project_id=project_id,
        entries=project_entries,
        data_dir=data_dir,
    )
    result.global_created_count, result.global_updated_count, result.global_skipped_count = _write_global_entries(
        entries=global_entries,
        data_dir=data_dir,
    )
    result.sidecar_path = _write_learning_update_sidecar(result=result, data_dir=data_dir)
    return result


def _load_sidecars(
    *,
    run_id: str,
    data_dir: str | Path,
    skipped_reasons: list[str],
) -> dict[str, dict[str, Any]] | None:
    artifact_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir)
    loaded: dict[str, dict[str, Any]] = {}
    for name, schema_version in W7_SIDECAR_SCHEMA_VERSIONS.items():
        path = artifact_dir / f"{name}.json"
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            skipped_reasons.append(f"missing_sidecar:{name}")
            return None
        except (OSError, json.JSONDecodeError) as error:
            skipped_reasons.append(f"invalid_sidecar:{name}:{error}")
            return None
        if not isinstance(payload, dict):
            skipped_reasons.append(f"invalid_sidecar:{name}:root_not_object")
            return None
        if not _validate_sidecar_metadata(
            payload=payload,
            sidecar_name=name,
            expected_schema_version=schema_version,
            run_id=run_id,
            skipped_reasons=skipped_reasons,
        ):
            return None
        loaded[name] = payload
    return loaded


def _validate_sidecar_metadata(
    *,
    payload: dict[str, Any],
    sidecar_name: str,
    expected_schema_version: str,
    run_id: str,
    skipped_reasons: list[str],
) -> bool:
    if payload.get("schema_version") != expected_schema_version:
        skipped_reasons.append(f"invalid_sidecar:{sidecar_name}:schema_version")
        return False
    if payload.get("run_id") != run_id:
        skipped_reasons.append(f"invalid_sidecar:{sidecar_name}:run_id")
        return False
    return True


def _extract_project_id(run_payload: dict[str, Any]) -> str | None:
    input_payload = run_payload.get("input_payload")
    if isinstance(input_payload, dict):
        project_id = input_payload.get("target_project_id")
        if isinstance(project_id, str) and project_id.strip():
            return project_id.strip()
    context = run_payload.get("context")
    target_context = context.get("target_project_context") if isinstance(context, dict) else None
    if isinstance(target_context, dict):
        project_id = target_context.get("target_project_id")
        if isinstance(project_id, str) and project_id.strip():
            return project_id.strip()
    return None


def _extract_project_entries(*, run_payload: dict[str, Any], project_id: str) -> list[ProjectMemoryEntry]:
    _ = project_id
    final_output = _final_output(run_payload)
    now = datetime.now(timezone.utc).isoformat()
    run_id = str(run_payload["run_id"])
    entries: list[ProjectMemoryEntry] = []

    accepted_scope = final_output.get("accepted_scope_summary")
    if isinstance(accepted_scope, str) and accepted_scope.strip():
        entries.append(
            _project_entry(
                subtype="validation_expectation",
                content=f"Accepted scope: {accepted_scope.strip()}",
                source_path="output_payload.final_output.accepted_scope_summary",
                run_id=run_id,
                timestamp=now,
            )
        )

    for source_path, subtype in (
        ("output_payload.final_output.required_followups[]", "validation_expectation"),
        ("output_payload.final_output.blocking_conditions[]", "repo_specific_caution"),
        ("output_payload.final_output.key_findings[]", "review_gate_rule"),
    ):
        values = _list_at_final_output(final_output, source_path)
        for value in values:
            entries.append(_project_entry(subtype=subtype, content=value, source_path=source_path, run_id=run_id, timestamp=now))
    return entries


def _extract_global_entries(
    *,
    run_payload: dict[str, Any],
    sidecars: dict[str, dict[str, Any]],
    privacy_terms: list[str],
) -> tuple[list[GlobalLearningEntry], list[str]]:
    final_output = _final_output(run_payload)
    now = datetime.now(timezone.utc).isoformat()
    run_ref = _deidentified_run_ref(str(run_payload["run_id"]))
    entries: list[GlobalLearningEntry] = []
    skipped: list[str] = []

    candidates: list[tuple[str, str, str, str]] = []
    if final_output.get("review_synthesis_present") is True:
        candidates.append(
            (
                "opencode_review_patterns",
                "Review synthesis should be preserved as structured evidence before learning from OpenCode-backed loops.",
                "output_payload.final_output.review_synthesis_present",
                "low",
            )
        )
    approval_log = sidecars["approval_log"]
    checkpoints = approval_log.get("checkpoints")
    if isinstance(checkpoints, list) and any(isinstance(item, dict) and item.get("approved") is True for item in checkpoints):
        candidates.append(
            (
                "meta_triage_patterns",
                "Explicit approval checkpoints improve replay value for OpenCode-backed Meta/Track loops.",
                "approval_log.checkpoints[]",
                "low",
            )
        )
    if _has_warning_or_invalid(run_payload=run_payload, sidecars=sidecars):
        candidates.append(
            (
                "router_transport_lessons",
                "Warning or invalid ingest states should remain low-confidence learning inputs until reviewed.",
                "validation_state",
                "low",
            )
        )

    for topic, lesson, source_path, confidence in candidates:
        if _contains_sensitive_term(lesson, privacy_terms):
            skipped.append(f"global_deidentification_rejected:{topic}:{source_path}")
            continue
        entries.append(
            GlobalLearningEntry(
                topic=topic,
                lesson=lesson,
                source_run_ids=[run_ref],
                source_paths=[source_path],
                confidence=confidence,
                last_updated_at=now,
            )
        )
    return entries, skipped


def _project_entry(*, subtype: str, content: str, source_path: str, run_id: str, timestamp: str) -> ProjectMemoryEntry:
    return ProjectMemoryEntry(
        entry_type="workflow_learning",
        entry_subtype=subtype,
        content=content.strip(),
        workflow_id=W7_OPENCODE_LOOP_WORKFLOW_ID,
        source_path=source_path,
        first_seen_run_id=run_id,
        last_seen_run_id=run_id,
        confidence="medium",
        last_updated_at=timestamp,
    )


def _write_project_entries(
    *,
    project_id: str,
    entries: list[ProjectMemoryEntry],
    data_dir: str | Path,
) -> tuple[int, int, int]:
    if not entries:
        return 0, 0, 0
    store = JSONProjectMemoryStore(data_dir=data_dir)
    project_memory = store.load_project(project_id=project_id) or ProjectMemory(project_id=project_id)
    created, updated, skipped = _merge_project_entries(project_memory=project_memory, entries=entries)
    if created or updated:
        project_memory.updated_at = datetime.now(timezone.utc).isoformat()
        store.save_project(project_memory)
    return created, updated, skipped


def _write_global_entries(*, entries: list[GlobalLearningEntry], data_dir: str | Path) -> tuple[int, int, int]:
    if not entries:
        return 0, 0, 0
    store = JSONGlobalLearningStore(data_dir=data_dir)
    created = 0
    updated = 0
    skipped = 0
    by_topic: dict[str, list[GlobalLearningEntry]] = {}
    for entry in entries:
        by_topic.setdefault(entry.topic, []).append(entry)
    for topic, incoming_entries in by_topic.items():
        existing_entries = store.load_topic(topic=topic)
        topic_created, topic_updated, topic_skipped = _merge_global_entries(
            existing_entries=existing_entries,
            incoming_entries=incoming_entries,
        )
        created += topic_created
        updated += topic_updated
        skipped += topic_skipped
        if topic_created or topic_updated:
            store.save_topic(topic=topic, entries=existing_entries)
    return created, updated, skipped


def _merge_project_entries(*, project_memory: ProjectMemory, entries: list[ProjectMemoryEntry]) -> tuple[int, int, int]:
    created = 0
    updated = 0
    skipped = 0
    for incoming in entries:
        target_list = project_memory.workflow_learnings
        existing = next(
            (
                candidate
                for candidate in target_list
                if candidate.workflow_id == incoming.workflow_id
                and candidate.entry_type == incoming.entry_type
                and candidate.entry_subtype == incoming.entry_subtype
                and _normalize(candidate.content) == _normalize(incoming.content)
            ),
            None,
        )
        if existing is None:
            target_list.append(incoming)
            created += 1
            continue
        if existing.last_seen_run_id == incoming.last_seen_run_id:
            skipped += 1
            continue
        existing.last_seen_run_id = incoming.last_seen_run_id
        existing.last_updated_at = incoming.last_updated_at
        existing.times_observed += 1
        updated += 1
    return created, updated, skipped


def _merge_global_entries(
    *,
    existing_entries: list[GlobalLearningEntry],
    incoming_entries: list[GlobalLearningEntry],
) -> tuple[int, int, int]:
    created = 0
    updated = 0
    skipped = 0
    for incoming in incoming_entries:
        existing = next(
            (
                candidate
                for candidate in existing_entries
                if candidate.topic == incoming.topic and _normalize(candidate.lesson) == _normalize(incoming.lesson)
            ),
            None,
        )
        if existing is None:
            existing_entries.append(incoming)
            created += 1
            continue
        new_run_ids = [run_id for run_id in incoming.source_run_ids if run_id not in existing.source_run_ids]
        if not new_run_ids:
            skipped += 1
            continue
        existing.source_run_ids.extend(new_run_ids)
        for source_path in incoming.source_paths:
            if source_path not in existing.source_paths:
                existing.source_paths.append(source_path)
        existing.last_updated_at = incoming.last_updated_at
        existing.times_observed += len(new_run_ids)
        updated += 1
    return created, updated, skipped


def _write_learning_update_sidecar(*, result: W7OpenCodeLearningUpdateResult, data_dir: str | Path) -> Path:
    artifact_dir = run_artifact_dir_path(run_id=result.run_id, data_dir=data_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    path = artifact_dir / "opencode_learning_update.json"
    payload = {
        "artifact_type": "opencode_learning_update",
        "artifact_version": W7_OPENCODE_LEARNING_UPDATE_ARTIFACT_VERSION,
        "project_memory_schema_version": PROJECT_MEMORY_SCHEMA_VERSION,
        "global_learning_topic_schema_version": GLOBAL_LEARNING_TOPIC_SCHEMA_VERSION,
        "run_id": result.run_id,
        "workflow_id": W7_OPENCODE_LOOP_WORKFLOW_ID,
        "project_id": result.project_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "write_mode": result.write,
        "project_created_count": result.project_created_count,
        "project_updated_count": result.project_updated_count,
        "project_skipped_count": result.project_skipped_count,
        "global_created_count": result.global_created_count,
        "global_updated_count": result.global_updated_count,
        "global_skipped_count": result.global_skipped_count,
        "skipped_reasons": list(result.skipped_reasons),
        "deidentification_summary": {
            "global_candidates_checked": len(result.global_candidates),
            "global_candidates_written": result.global_created_count + result.global_updated_count,
            "target_specific_global_content_allowed": False,
        },
        "track_e_validation_claim": False,
        "project_candidates": list(result.project_candidates),
        "global_candidates": list(result.global_candidates),
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return path


def _final_output(run_payload: dict[str, Any]) -> dict[str, Any]:
    output_payload = run_payload.get("output_payload")
    final_output = output_payload.get("final_output") if isinstance(output_payload, dict) else None
    return final_output if isinstance(final_output, dict) else {}


def _list_at_final_output(final_output: dict[str, Any], source_path: str) -> list[str]:
    key = source_path.rsplit(".", maxsplit=1)[-1].replace("[]", "")
    values = final_output.get(key)
    if not isinstance(values, list):
        return []
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


def _has_warning_or_invalid(*, run_payload: dict[str, Any], sidecars: dict[str, dict[str, Any]]) -> bool:
    final_output = _final_output(run_payload)
    if final_output.get("validation_state") in {"warning", "invalid"}:
        return True
    packet_entries = sidecars["packet_ledger"].get("entries")
    if isinstance(packet_entries, list):
        for entry in packet_entries:
            if isinstance(entry, dict) and entry.get("validation_state") in {"warning", "invalid"}:
                return True
    warnings = sidecars["ingest_report"].get("warnings")
    return isinstance(warnings, list) and bool(warnings)


def _privacy_sensitive_terms(run_payload: dict[str, Any], sidecars: dict[str, dict[str, Any]]) -> list[str]:
    terms: list[str] = []
    input_payload = run_payload.get("input_payload")
    context = run_payload.get("context")
    target_context = context.get("target_project_context") if isinstance(context, dict) else None
    for payload in (input_payload, target_context):
        if not isinstance(payload, dict):
            continue
        for key in ("target_project_name", "target_repo_path"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                terms.append(value.strip())
    selected_outputs = sidecars["selected_outputs"].get("outputs")
    if isinstance(selected_outputs, list):
        for output in selected_outputs:
            if isinstance(output, dict):
                excerpt = output.get("excerpt")
                if isinstance(excerpt, str) and excerpt.strip():
                    terms.append(excerpt.strip())
    terms.extend(["C:\\", ":\\"])
    return terms


def _contains_sensitive_term(value: str, terms: list[str]) -> bool:
    normalized = value.lower()
    for term in terms:
        if term and term.lower() in normalized:
            return True
    return False


def _normalize(value: str) -> str:
    return " ".join(value.split()).strip().lower()


def _deidentified_run_ref(run_id: str) -> str:
    digest = hashlib.sha256(run_id.encode("utf-8")).hexdigest()[:12]
    return f"run_sha256_{digest}"
