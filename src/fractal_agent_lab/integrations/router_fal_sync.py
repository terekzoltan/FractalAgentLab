from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fractal_agent_lab.core.contracts.w7_5_context_digest import write_context_digest
from fractal_agent_lab.evals.opencode_workflow_metrics import (
    write_review_findings_ledger,
    write_workflow_metrics,
)
from fractal_agent_lab.ingest.opencode_loop import write_w7_opencode_loop_artifacts
from fractal_agent_lab.tracing.artifact_layout import run_artifact_dir_path


MARKER_START = "=== FAL CHECKPOINT START ==="
MARKER_END = "=== FAL CHECKPOINT END ==="
SYNC_REGISTRY_SCHEMA_VERSION = "fal.sync_registry.v1"
CHECKPOINT_SYNC_ARTIFACT_SCHEMA_VERSION = "fal.checkpoint_sync.v1"
ACTIVE_CONTEXT_SCHEMA_VERSION = "fal.active_context.v1"
DEFAULT_ROUTER_DIR_NAME = ".opencode-router"
ALLOWED_SYNC_MODES = {"live_checkpoint", "batch_reconcile"}
ALLOWED_OUTCOMES = {"green", "yellow", "red", "mixed", "blocked"}
DEFAULT_HARD_CONSTRAINTS = [
    "No automatic commit or push.",
    "No public output approval without the proper FAL gate.",
    "RingFall implementation remains target-repo work, not FAL-repo work.",
    "Checkpoint sync records packets/checkpoints, not raw transcript truth.",
]


class RouterFalSyncError(ValueError):
    pass


@dataclass(slots=True)
class ParsedReviewFinding:
    finding_id: str
    severity: str | None
    category: str | None
    human_label: str
    summary: str


@dataclass(slots=True)
class ParsedLearningCandidateRef:
    candidate_id: str
    candidate_type: str | None
    status: str | None
    source_evidence_ref: str | None


@dataclass(slots=True)
class ParsedCheckpoint:
    checkpoint_stage: str | None = None
    target: str | None = None
    origin_session: str | None = None
    decision: str | None = None
    summary: str | None = None
    next_action: str | None = None
    accepted_scope_summary: str | None = None
    validation_state: str | None = None
    overall_outcome: str | None = None
    artifact_refs: list[str] | None = None
    key_findings: list[str] | None = None
    required_followups: list[str] | None = None
    blocking_conditions: list[str] | None = None
    learning_candidate_refs: list[ParsedLearningCandidateRef] | None = None
    review_findings: list[ParsedReviewFinding] | None = None
    loaded_context_refs: list[str] | None = None
    deferred_context_refs: list[str] | None = None
    manual_restore_steps: list[str] | None = None


@dataclass(slots=True)
class SyncRegistryEntry:
    idempotency_key: str
    run_id: str
    project_id: str
    checkpoint_stage: str
    target: str
    decision: str | None
    message_identity: str
    source_session: str
    source_path: str
    packet_path: str | None
    sync_mode: str
    synced_at: str


@dataclass(slots=True)
class SyncCheckpointResult:
    run_id: str
    idempotency_key: str
    synced: bool
    reason: str | None
    source_path: str
    packet_path: str | None
    checkpoint_stage: str
    target: str
    decision: str | None
    artifact_dir: str
    workflow_metrics_path: str | None = None
    review_findings_ledger_path: str | None = None
    context_digest_path: str | None = None
    active_context_markdown_path: str | None = None
    active_context_json_path: str | None = None
    registry_path: str | None = None


@dataclass(slots=True)
class ReconcileResult:
    project_id: str
    processed_packet_count: int
    synced_count: int
    skipped_count: int
    results: list[SyncCheckpointResult]


def sync_checkpoint(
    *,
    target_repo_path: str | Path,
    project_id: str,
    source_session: str,
    stage: str,
    target: str,
    data_dir: str | Path = "data",
    project_name: str | None = None,
    router_dir: str = DEFAULT_ROUTER_DIR_NAME,
    source_path: str | Path | None = None,
    packet_path: str | Path | None = None,
    decision: str | None = None,
    summary: str | None = None,
    next_action: str | None = None,
    accepted_scope_summary: str | None = None,
    sync_mode: str = "live_checkpoint",
    manual_override: bool = False,
    hydration_level: str = "L1",
    recovery_success_label: str = "restored",
    update_active_context: bool = True,
) -> SyncCheckpointResult:
    if sync_mode not in ALLOWED_SYNC_MODES:
        raise RouterFalSyncError("sync_mode must be live_checkpoint or batch_reconcile.")

    target_repo = Path(target_repo_path).resolve()
    if not target_repo.exists() or not target_repo.is_dir():
        raise RouterFalSyncError(f"target_repo_path must be an existing directory: {target_repo}")
    router_root = target_repo / router_dir
    artifact_root = router_root / "artifacts"
    registry_path = router_root / "fal-sync-registry.json"

    packet_payload = _load_packet_if_present(target_repo=target_repo, packet_path=packet_path)
    source_file = _resolve_source_path(
        target_repo=target_repo,
        router_root=router_root,
        artifact_root=artifact_root,
        source_session=source_session,
        source_path=source_path,
        packet_payload=packet_payload,
    )
    source_text = source_file.read_text(encoding="utf-8")
    parsed = parse_checkpoint_block(source_text)

    checkpoint_stage = _choose_non_empty(stage, _packet_field(packet_payload, "stage"), parsed.checkpoint_stage)
    checkpoint_target = _choose_non_empty(target, _packet_field(packet_payload, "target"), parsed.target)
    checkpoint_source_session = _choose_non_empty(source_session, _packet_field(packet_payload, "from"), parsed.origin_session)
    checkpoint_decision = _nullable_non_empty(decision) or _nullable_non_empty(_packet_field(packet_payload, "decision")) or _nullable_non_empty(parsed.decision)
    checkpoint_summary = _nullable_non_empty(summary) or _nullable_non_empty(parsed.summary) or _fallback_summary(source_text)
    checkpoint_next_action = _nullable_non_empty(next_action) or _nullable_non_empty(parsed.next_action) or _default_next_action(checkpoint_stage, checkpoint_decision)
    checkpoint_scope = _nullable_non_empty(accepted_scope_summary) or _nullable_non_empty(parsed.accepted_scope_summary) or _default_scope_summary(checkpoint_stage)
    validation_state = _nullable_non_empty(parsed.validation_state) or "ok"
    overall_outcome = _nullable_non_empty(parsed.overall_outcome) or _derive_overall_outcome(checkpoint_decision)

    if checkpoint_stage is None:
        raise RouterFalSyncError("Could not determine checkpoint stage from arguments, packet, or marker block.")
    if checkpoint_target is None:
        raise RouterFalSyncError("Could not determine checkpoint target from arguments, packet, or marker block.")
    if checkpoint_source_session is None:
        raise RouterFalSyncError("Could not determine source session from arguments, packet, or marker block.")
    if checkpoint_summary is None:
        raise RouterFalSyncError("Could not determine checkpoint summary from arguments or source output.")
    if checkpoint_next_action is None:
        raise RouterFalSyncError("Could not determine next action from arguments, marker block, or checkpoint defaults.")
    if checkpoint_scope is None:
        raise RouterFalSyncError("Could not determine accepted_scope_summary from arguments or checkpoint defaults.")
    if overall_outcome not in ALLOWED_OUTCOMES:
        raise RouterFalSyncError(f"overall_outcome must resolve to one of {sorted(ALLOWED_OUTCOMES)}.")

    message_identity = _message_identity(source_text=source_text, packet_path=packet_payload.get("_resolved_path") if packet_payload else None)
    idempotency_key = _build_idempotency_key(
        project_id=project_id,
        target=checkpoint_target,
        checkpoint_stage=checkpoint_stage,
        decision=checkpoint_decision,
        message_identity=message_identity,
    )
    run_id = _build_run_id(
        project_id=project_id,
        target=checkpoint_target,
        checkpoint_stage=checkpoint_stage,
        message_identity=message_identity,
    )

    registry = _load_registry(registry_path)
    existing_entry = _find_registry_entry(registry, idempotency_key)
    artifact_dir = run_artifact_dir_path(run_id=run_id, data_dir=data_dir)
    if existing_entry is not None or artifact_dir.exists():
        return SyncCheckpointResult(
            run_id=run_id,
            idempotency_key=idempotency_key,
            synced=False,
            reason="already_synced",
            source_path=source_file.as_posix(),
            packet_path=(packet_payload.get("_resolved_path") if packet_payload else None),
            checkpoint_stage=checkpoint_stage,
            target=checkpoint_target,
            decision=checkpoint_decision,
            artifact_dir=artifact_dir.as_posix(),
            registry_path=registry_path.as_posix(),
        )

    target_status = _git_status(target_repo)
    target_head = _git_head(target_repo)
    project_display_name = project_name or target_repo.name
    artifact_refs = _dedupe_strings(
        [
            *_ensure_list(parsed.artifact_refs),
            _display_relative_path(source_file, target_repo),
            *([_display_relative_path(Path(packet_payload["_resolved_path"]), target_repo)] if packet_payload else []),
        ]
    )
    key_findings = _ensure_list(parsed.key_findings)
    required_followups = _ensure_list(parsed.required_followups)
    blocking_conditions = _normalize_blocking_conditions(_ensure_list(parsed.blocking_conditions))
    learning_candidate_refs = [
        _learning_candidate_ref_to_dict(candidate_ref) for candidate_ref in (parsed.learning_candidate_refs or [])
    ]
    review_findings = [
        _review_finding_to_manual_dict(finding, checkpoint_stage) for finding in (parsed.review_findings or [])
    ]
    marker_present = MARKER_START in source_text and MARKER_END in source_text
    stripped_excerpt = _extract_clean_excerpt(source_text)
    sync_warnings = _build_warning_list(marker_present=marker_present, parsed=parsed)
    if overall_outcome == "green" and (sync_warnings or review_findings):
        overall_outcome = "yellow"

    payload = {
        "run_id": run_id,
        "target_project_id": project_id,
        "target_project_name": project_display_name,
        "target_repo_path": target_repo.as_posix(),
        "sequence_ref": checkpoint_target,
        "target_track": checkpoint_source_session.replace("-", "_"),
        "meta_track_pair": f"fal_sync_{checkpoint_source_session.replace('-', '_')}",
        "loop_entry_mode": "router_assisted" if sync_mode == "live_checkpoint" and not manual_override else "fal_cli_assisted",
        "automation_mode": "router_assisted" if sync_mode == "live_checkpoint" and not manual_override else "fal_cli_assisted",
        "entry_stage": checkpoint_stage,
        "external_loop_id": run_id,
        "source_refs": [
            _display_relative_path(source_file, target_repo),
            *([_display_relative_path(Path(packet_payload["_resolved_path"]), target_repo)] if packet_payload else []),
        ],
        "warnings": sync_warnings,
        "validation_state": validation_state,
        "target_project_context": {
            "schema_version": "external_project_context.v0",
            "target_repo_status": target_status,
            "target_repo_head": target_head,
        },
        "router_context": {
            "sync_mode": sync_mode,
            "manual_override": manual_override,
            "source_session": checkpoint_source_session,
            "router_dir": router_dir,
            "marker_present": marker_present,
            "message_identity": message_identity,
        },
        "approval_policy": {
            "human_in_loop": True,
            "cross_session_send_approved": sync_mode == "live_checkpoint",
        },
        "privacy_audit_state": {
            "retention_mode": "structured_extracts_only",
            "raw_transcript_retained": False,
            "excerpt_max_chars": 4000,
            "body_retention_allowed": False,
            "body_path_policy": "none",
            "thought_or_reasoning_retained": False,
            "privacy_classification": "private_coordination",
            "public_export_state": "blocked",
        },
        "step_results": {
            checkpoint_stage: {
                "output": {
                    "stage": checkpoint_stage,
                    "source_session": checkpoint_source_session,
                    "decision": checkpoint_decision,
                    "summary": checkpoint_summary,
                    "extract_ref": _display_relative_path(source_file, target_repo),
                    "selected_text_excerpt": stripped_excerpt,
                },
                "raw": {
                    "source_kind": "router_selected_output",
                },
            }
        },
        "packet_ledger": {
            "schema_version": "w7.packet_ledger.v1",
            "run_id": run_id,
            "loop_id": run_id,
            "entries": [
                {
                    "sequence": 1,
                    "stage": checkpoint_stage,
                    "producer": checkpoint_source_session,
                    "consumer": "fal-governance",
                    "source_command": checkpoint_stage,
                    "decision": checkpoint_decision,
                    "packet_ref": f"pkt-{_short_hash(message_identity)}",
                    "selected_output_ref": f"out-{_short_hash(message_identity)}",
                    "approval_ref": f"chk-{_short_hash(message_identity)}",
                    "summary": checkpoint_summary,
                    "validation_state": validation_state,
                }
            ],
        },
        "selected_outputs": {
            "schema_version": "w7.selected_outputs.v1",
            "run_id": run_id,
            "outputs": [
                {
                    "output_id": f"out-{_short_hash(message_identity)}",
                    "stage": checkpoint_stage,
                    "source_session": checkpoint_source_session,
                    "message_id": _nullable_non_empty(_packet_field(packet_payload, "_message_id")),
                    "capture_mode": "router_structured_extract" if marker_present else "router_markdown_fallback",
                    "summary": checkpoint_summary,
                    "excerpt": stripped_excerpt,
                    "excerpt_max_chars": 4000,
                    "excerpt_truncated": _excerpt_truncated(source_text),
                    "body_path": None,
                    "body_retention_allowed": False,
                    "body_path_policy": "none",
                    "privacy_classification": "private_coordination",
                }
            ],
        },
        "review_synthesis": _build_review_synthesis(
            run_id=run_id,
            checkpoint_stage=checkpoint_stage,
            decision=checkpoint_decision,
            summary=checkpoint_summary,
            next_action=checkpoint_next_action,
        ),
        "approval_log": {
            "schema_version": "w7.approval_log.v1",
            "run_id": run_id,
            "checkpoints": [
                {
                    "checkpoint_id": f"chk-{_short_hash(message_identity)}",
                    "action_kind": "fal_checkpoint_sync",
                    "target_session": checkpoint_source_session,
                    "stage": checkpoint_stage,
                    "approved": True,
                    "approved_at": _utc_now(),
                    "approval_mode": "router_checkpoint_capture",
                }
            ],
        },
        "final_output": {
            "overall_outcome": overall_outcome,
            "terminal_stage": checkpoint_stage,
            "final_decision": checkpoint_decision,
            "next_recommended_action": checkpoint_next_action,
            "accepted_scope_summary": checkpoint_scope,
            "blocking_conditions": blocking_conditions,
            "required_followups": required_followups,
            "key_findings": key_findings,
            "artifact_refs": artifact_refs,
            "learning_candidate_refs": learning_candidate_refs,
            "review_synthesis_present": True,
        },
    }

    ingest_result = write_w7_opencode_loop_artifacts(payload, data_dir=data_dir)
    workflow_metrics_path = write_workflow_metrics(run_id, data_dir=data_dir)
    review_findings_path = write_review_findings_ledger(run_id, data_dir=data_dir, manual_findings=review_findings)
    context_digest_path = write_context_digest(
        run_id,
        data_dir=data_dir,
        hydration_level=hydration_level,
        loaded_context_refs=_dedupe_strings(
            [
                _display_relative_path(source_file, target_repo),
                *([_display_relative_path(Path(packet_payload["_resolved_path"]), target_repo)] if packet_payload else []),
                *_ensure_list(parsed.loaded_context_refs),
            ]
        ),
        deferred_context_refs=_ensure_list(parsed.deferred_context_refs),
        token_estimate=None,
        manual_restore_steps=_dedupe_strings(_ensure_list(parsed.manual_restore_steps) + [
            f"Mode A captured checkpoint '{checkpoint_stage}'.",
            f"Mode B ingested checkpoint via {sync_mode}.",
        ]),
        recovery_success_label=recovery_success_label,
        operator_notes=f"Checkpoint sync captured for {checkpoint_target} from {checkpoint_source_session}; target repo status {target_status}.",
    )

    checkpoint_sync_artifact = {
        "schema_version": CHECKPOINT_SYNC_ARTIFACT_SCHEMA_VERSION,
        "run_id": run_id,
        "project_id": project_id,
        "checkpoint_stage": checkpoint_stage,
        "target": checkpoint_target,
        "source_session": checkpoint_source_session,
        "decision": checkpoint_decision,
        "summary": checkpoint_summary,
        "next_action": checkpoint_next_action,
        "accepted_scope_summary": checkpoint_scope,
        "sync_mode": sync_mode,
        "manual_override": manual_override,
        "idempotency_key": idempotency_key,
        "source_path": _display_relative_path(source_file, target_repo),
        "packet_path": _display_relative_path(Path(packet_payload["_resolved_path"]), target_repo) if packet_payload else None,
        "artifact_refs": artifact_refs,
        "learning_candidate_refs": learning_candidate_refs,
        "review_findings": review_findings,
        "target_repo_status": target_status,
        "target_repo_head": target_head,
        "created_at": _utc_now(),
    }
    checkpoint_sync_path = artifact_dir / "fal_checkpoint_sync.json"
    checkpoint_sync_path.write_text(json.dumps(checkpoint_sync_artifact, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    active_context_md_path = None
    active_context_json_path = None
    if update_active_context:
        active_context_md_path, active_context_json_path = _write_active_context(
            target_repo=target_repo,
            project_id=project_id,
            project_name=project_display_name,
            run_id=run_id,
            checkpoint_stage=checkpoint_stage,
            target=checkpoint_target,
            source_session=checkpoint_source_session,
            decision=checkpoint_decision,
            summary=checkpoint_summary,
            next_action=checkpoint_next_action,
            artifact_refs=artifact_refs,
            blocking_conditions=blocking_conditions,
            sync_mode=sync_mode,
            manual_override=manual_override,
            target_repo_status=target_status,
        )

    entry = SyncRegistryEntry(
        idempotency_key=idempotency_key,
        run_id=run_id,
        project_id=project_id,
        checkpoint_stage=checkpoint_stage,
        target=checkpoint_target,
        decision=checkpoint_decision,
        message_identity=message_identity,
        source_session=checkpoint_source_session,
        source_path=source_file.as_posix(),
        packet_path=packet_payload.get("_resolved_path") if packet_payload else None,
        sync_mode=sync_mode,
        synced_at=_utc_now(),
    )
    _append_registry_entry(registry_path, registry, entry)

    return SyncCheckpointResult(
        run_id=run_id,
        idempotency_key=idempotency_key,
        synced=True,
        reason=None,
        source_path=source_file.as_posix(),
        packet_path=packet_payload.get("_resolved_path") if packet_payload else None,
        checkpoint_stage=checkpoint_stage,
        target=checkpoint_target,
        decision=checkpoint_decision,
        artifact_dir=artifact_dir.as_posix(),
        workflow_metrics_path=workflow_metrics_path.as_posix(),
        review_findings_ledger_path=review_findings_path.as_posix(),
        context_digest_path=context_digest_path.as_posix(),
        active_context_markdown_path=active_context_md_path,
        active_context_json_path=active_context_json_path,
        registry_path=registry_path.as_posix(),
    )


def reconcile_loop(
    *,
    target_repo_path: str | Path,
    project_id: str,
    data_dir: str | Path = "data",
    project_name: str | None = None,
    router_dir: str = DEFAULT_ROUTER_DIR_NAME,
    hydration_level: str = "L1",
    recovery_success_label: str = "restored",
    update_active_context: bool = True,
) -> ReconcileResult:
    target_repo = Path(target_repo_path).resolve()
    processed_dir = target_repo / router_dir / "processed"
    if not processed_dir.exists():
        raise RouterFalSyncError(f"Processed packet directory not found: {processed_dir}")

    packet_paths = sorted(processed_dir.glob("*.json"))
    results: list[SyncCheckpointResult] = []
    synced_count = 0
    skipped_count = 0
    relevant_packets = [path for path in packet_paths if _packet_stage_if_relevant(path) is not None]
    for index, packet_path in enumerate(relevant_packets):
        packet_payload = _load_packet_json(packet_path)
        stage = str(packet_payload.get("stage"))
        source_session = str(packet_payload.get("from"))
        target = str(packet_payload.get("target")) if packet_payload.get("target") else f"reconcile-{index + 1}"
        result = sync_checkpoint(
            target_repo_path=target_repo,
            project_id=project_id,
            project_name=project_name,
            source_session=source_session,
            stage=stage,
            target=target,
            data_dir=data_dir,
            router_dir=router_dir,
            packet_path=packet_path,
            sync_mode="batch_reconcile",
            manual_override=False,
            hydration_level=hydration_level,
            recovery_success_label=recovery_success_label,
            update_active_context=update_active_context and index == len(relevant_packets) - 1,
        )
        results.append(result)
        if result.synced:
            synced_count += 1
        else:
            skipped_count += 1

    return ReconcileResult(
        project_id=project_id,
        processed_packet_count=len(relevant_packets),
        synced_count=synced_count,
        skipped_count=skipped_count,
        results=results,
    )


def parse_checkpoint_block(text: str) -> ParsedCheckpoint:
    if not isinstance(text, str):
        return ParsedCheckpoint()
    match = re.search(re.escape(MARKER_START) + r"(.*?)" + re.escape(MARKER_END), text, flags=re.DOTALL)
    if not match:
        return ParsedCheckpoint()
    block = match.group(1)
    parsed: dict[str, Any] = {}
    list_field_map = {
        "ARTIFACT_REFS": "artifact_refs",
        "KEY_FINDINGS": "key_findings",
        "REQUIRED_FOLLOWUPS": "required_followups",
        "BLOCKING_CONDITIONS": "blocking_conditions",
        "LEARNING_CANDIDATE_REFS": "learning_candidate_refs",
        "REVIEW_FINDINGS": "review_findings",
        "LOADED_CONTEXT_REFS": "loaded_context_refs",
        "DEFERRED_CONTEXT_REFS": "deferred_context_refs",
        "MANUAL_RESTORE_STEPS": "manual_restore_steps",
    }
    scalar_field_map = {
        "CHECKPOINT_STAGE": "checkpoint_stage",
        "TARGET": "target",
        "ORIGIN_SESSION": "origin_session",
        "DECISION": "decision",
        "SUMMARY": "summary",
        "NEXT_ACTION": "next_action",
        "ACCEPTED_SCOPE_SUMMARY": "accepted_scope_summary",
        "VALIDATION_STATE": "validation_state",
        "OVERALL_OUTCOME": "overall_outcome",
    }
    current_list: str | None = None
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        key_match = re.match(r"^([A-Z_]+):\s*(.*)$", line)
        if key_match:
            current_list = None
            key = key_match.group(1)
            remainder = key_match.group(2).strip()
            if key in scalar_field_map:
                parsed[scalar_field_map[key]] = remainder or None
                continue
            if key in list_field_map:
                current_list = list_field_map[key]
                parsed.setdefault(current_list, [])
                if remainder and remainder not in {"[]", "none", "NONE"}:
                    parsed[current_list].append(remainder)
                continue
        if line.startswith("- ") and current_list is not None:
            parsed.setdefault(current_list, []).append(line[2:].strip())

    learning_candidate_refs = [_parse_learning_candidate_ref(item) for item in parsed.get("learning_candidate_refs", [])]
    review_findings = [_parse_review_finding(item) for item in parsed.get("review_findings", [])]
    return ParsedCheckpoint(
        checkpoint_stage=parsed.get("checkpoint_stage"),
        target=parsed.get("target"),
        origin_session=parsed.get("origin_session"),
        decision=parsed.get("decision"),
        summary=parsed.get("summary"),
        next_action=parsed.get("next_action"),
        accepted_scope_summary=parsed.get("accepted_scope_summary"),
        validation_state=parsed.get("validation_state"),
        overall_outcome=parsed.get("overall_outcome"),
        artifact_refs=parsed.get("artifact_refs") or [],
        key_findings=parsed.get("key_findings") or [],
        required_followups=parsed.get("required_followups") or [],
        blocking_conditions=parsed.get("blocking_conditions") or [],
        learning_candidate_refs=learning_candidate_refs,
        review_findings=review_findings,
        loaded_context_refs=parsed.get("loaded_context_refs") or [],
        deferred_context_refs=parsed.get("deferred_context_refs") or [],
        manual_restore_steps=parsed.get("manual_restore_steps") or [],
    )


def _parse_learning_candidate_ref(raw: str) -> ParsedLearningCandidateRef:
    parts = [part.strip() for part in raw.split("|")]
    while len(parts) < 4:
        parts.append("")
    return ParsedLearningCandidateRef(
        candidate_id=parts[0],
        candidate_type=parts[1] or None,
        status=parts[2] or None,
        source_evidence_ref=parts[3] or None,
    )


def _parse_review_finding(raw: str) -> ParsedReviewFinding:
    parts = [part.strip() for part in raw.split("|")]
    while len(parts) < 5:
        parts.append("")
    return ParsedReviewFinding(
        finding_id=parts[0],
        severity=parts[1] or None,
        category=parts[2] or None,
        human_label=parts[3] or "uncertain",
        summary=parts[4],
    )


def _load_packet_if_present(*, target_repo: Path, packet_path: str | Path | None) -> dict[str, Any] | None:
    if packet_path is None:
        return None
    resolved = Path(packet_path)
    if not resolved.is_absolute():
        resolved = (target_repo / resolved).resolve()
    return _load_packet_json(resolved)


def _load_packet_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RouterFalSyncError(f"Packet JSON must be an object: {path}")
    payload["_resolved_path"] = path.as_posix()
    return payload


def _resolve_source_path(
    *,
    target_repo: Path,
    router_root: Path,
    artifact_root: Path,
    source_session: str,
    source_path: str | Path | None,
    packet_payload: dict[str, Any] | None,
) -> Path:
    candidates: list[Path] = []
    if source_path is not None:
        candidate = Path(source_path)
        if not candidate.is_absolute():
            candidate = (target_repo / candidate).resolve()
        candidates.append(candidate)
    if packet_payload is not None and packet_payload.get("body_path"):
        packet_body = Path(str(packet_payload["body_path"]))
        if not packet_body.is_absolute():
            candidates.append((target_repo / packet_body).resolve())
            candidates.append((router_root / packet_body).resolve())
    if not candidates:
        prefix = f"latest-{source_session}-"
        artifact_candidates = sorted(artifact_root.glob(f"{prefix}*.md"), key=lambda path: path.stat().st_mtime, reverse=True)
        candidates.extend(artifact_candidates)
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()
    raise RouterFalSyncError(f"Could not resolve source output artifact for session '{source_session}'.")


def _packet_field(packet_payload: dict[str, Any] | None, field_name: str) -> str | None:
    if not packet_payload:
        return None
    value = packet_payload.get(field_name)
    return value if isinstance(value, str) and value.strip() else None


def _choose_non_empty(*values: str | None) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _nullable_non_empty(value: str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _fallback_summary(text: str) -> str | None:
    cleaned = _strip_checkpoint_block(text)
    for line in cleaned.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped[:400]
    return None


def _default_next_action(stage: str, decision: str | None) -> str | None:
    stage_value = stage.lower()
    decision_value = (decision or "").lower()
    if stage_value == "meta_plan_review_done":
        if decision_value == "greenlit":
            return "Target Track may run /terv-review-utan and then proceed toward /implement when appropriate."
        if decision_value == "changes_requested":
            return "Target Track should revise the plan and re-emit plan_ready_for_meta_review."
        if decision_value == "blocked":
            return "Target loop should stop and resolve the blocker before implementation."
    if stage_value == "step_review_done":
        if decision_value == "pass":
            return "Target Track may acknowledge /step-review-utan and close the loop when appropriate."
        if decision_value == "fix_required":
            return "Target Track should prepare a fix plan and enter the review-fix cycle."
        if decision_value == "hold":
            return "Target loop should stop and resolve the hold before continuing."
        if decision_value == "deep_review_needed":
            return "Target loop should escalate to deeper review before continuing."
    return f"Checkpoint '{stage}' captured for later governance review."


def _default_scope_summary(stage: str) -> str | None:
    if stage == "meta_plan_review_done":
        return "Planning checkpoint captured from target repo router flow."
    if stage == "step_review_done":
        return "Implementation review checkpoint captured from target repo router flow."
    return "Target repo checkpoint captured for FAL governance."


def _derive_overall_outcome(decision: str | None) -> str:
    decision_value = (decision or "").strip().lower()
    if decision_value in {"greenlit", "pass"}:
        return "green"
    if decision_value in {"changes_requested", "fix_required", "deep_review_needed", "narrow", "continue"}:
        return "yellow"
    if decision_value in {"blocked", "hold", "stop", "fail"}:
        return "red"
    return "yellow"


def _message_identity(*, source_text: str, packet_path: str | None) -> str:
    if packet_path:
        return f"packet:{Path(packet_path).name}"
    digest = hashlib.sha256(source_text.encode("utf-8")).hexdigest()[:16]
    return f"text:{digest}"


def _build_idempotency_key(*, project_id: str, target: str, checkpoint_stage: str, decision: str | None, message_identity: str) -> str:
    return f"{project_id}:{checkpoint_stage}:{target}:{decision or 'none'}:{message_identity}"


def _build_run_id(*, project_id: str, target: str, checkpoint_stage: str, message_identity: str) -> str:
    target_fragment = _slug_fragment(target, max_length=24)
    stage_fragment = _slug_fragment(checkpoint_stage, max_length=24)
    hash_fragment = _short_hash(message_identity)
    return f"falcp-{_slug_fragment(project_id, max_length=16)}-{target_fragment}-{stage_fragment}-{hash_fragment}"


def _slug_fragment(value: str, *, max_length: int) -> str:
    lowered = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    if not lowered:
        lowered = "checkpoint"
    return lowered[:max_length].strip("-") or "checkpoint"


def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]


def _load_registry(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "schema_version": SYNC_REGISTRY_SCHEMA_VERSION,
            "entries": [],
        }
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RouterFalSyncError(f"Sync registry must be a JSON object: {path}")
    if payload.get("schema_version") != SYNC_REGISTRY_SCHEMA_VERSION:
        raise RouterFalSyncError(f"Unsupported sync registry schema_version at {path}")
    if not isinstance(payload.get("entries"), list):
        raise RouterFalSyncError(f"Sync registry entries must be a list: {path}")
    return payload


def _find_registry_entry(registry: dict[str, Any], idempotency_key: str) -> dict[str, Any] | None:
    for entry in registry.get("entries", []):
        if isinstance(entry, dict) and entry.get("idempotency_key") == idempotency_key:
            return entry
    return None


def _append_registry_entry(path: Path, registry: dict[str, Any], entry: SyncRegistryEntry) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    registry.setdefault("entries", []).append(
        {
            "idempotency_key": entry.idempotency_key,
            "run_id": entry.run_id,
            "project_id": entry.project_id,
            "checkpoint_stage": entry.checkpoint_stage,
            "target": entry.target,
            "decision": entry.decision,
            "message_identity": entry.message_identity,
            "source_session": entry.source_session,
            "source_path": entry.source_path,
            "packet_path": entry.packet_path,
            "sync_mode": entry.sync_mode,
            "synced_at": entry.synced_at,
        }
    )
    path.write_text(json.dumps(registry, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def _build_warning_list(*, marker_present: bool, parsed: ParsedCheckpoint) -> list[str]:
    warnings: list[str] = []
    if not marker_present:
        warnings.append("checkpoint_marker_missing_markdown_fallback")
    if parsed.review_findings:
        warnings.append(f"review_findings_count:{len(parsed.review_findings)}")
    if parsed.learning_candidate_refs:
        warnings.append(f"learning_candidate_refs_count:{len(parsed.learning_candidate_refs)}")
    return warnings


def _review_finding_to_manual_dict(finding: ParsedReviewFinding, source_stage: str) -> dict[str, Any]:
    return {
        "finding_id": finding.finding_id,
        "source_stage": source_stage,
        "severity": finding.severity,
        "category": finding.category,
        "summary": finding.summary,
        "affected_files": [],
        "required_fix": None,
        "human_label": finding.human_label,
        "resolution_status": None,
        "resolved_by_run_id": None,
    }


def _learning_candidate_ref_to_dict(candidate_ref: ParsedLearningCandidateRef) -> dict[str, Any]:
    return {
        "candidate_id": candidate_ref.candidate_id,
        "candidate_type": candidate_ref.candidate_type,
        "status": candidate_ref.status,
        "source_evidence_ref": candidate_ref.source_evidence_ref,
    }


def _build_review_synthesis(*, run_id: str, checkpoint_stage: str, decision: str | None, summary: str, next_action: str) -> dict[str, Any]:
    synthesis = {
        "schema_version": "w7.review_synthesis.v1",
        "run_id": run_id,
        "checkpoint_sync": {
            "stage": checkpoint_stage,
            "decision": decision,
            "summary": summary,
            "next_action": next_action,
        },
    }
    if checkpoint_stage == "meta_plan_review_done":
        synthesis["plan_review"] = {
            "verdict": decision,
            "summary": summary,
        }
    if checkpoint_stage == "step_review_done":
        synthesis["step_review"] = {
            "final_verdict": decision,
            "final_summary": summary,
        }
    return synthesis


def _ensure_list(values: list[str] | None) -> list[str]:
    return [value for value in (values or []) if isinstance(value, str) and value.strip()]


def _dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        stripped = value.strip()
        if not stripped or stripped in seen:
            continue
        seen.add(stripped)
        ordered.append(stripped)
    return ordered


def _normalize_blocking_conditions(values: list[str]) -> list[str]:
    normalized = []
    for value in values:
        if value.lower() in {"none", "[]"}:
            continue
        normalized.append(value)
    return normalized


def _extract_clean_excerpt(text: str, excerpt_max_chars: int = 4000) -> str:
    cleaned = _strip_checkpoint_block(text).strip()
    if len(cleaned) <= excerpt_max_chars:
        return cleaned
    return cleaned[:excerpt_max_chars]


def _excerpt_truncated(text: str, excerpt_max_chars: int = 4000) -> bool:
    return len(_strip_checkpoint_block(text).strip()) > excerpt_max_chars


def _strip_checkpoint_block(text: str) -> str:
    return re.sub(re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END), "", text, flags=re.DOTALL).strip()


def _git_status(repo_path: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return "unknown"
    if result.returncode != 0:
        return "unknown"
    return "clean" if not result.stdout.strip() else "dirty"


def _git_head(repo_path: Path) -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    return value or None


def _display_relative_path(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def _write_active_context(
    *,
    target_repo: Path,
    project_id: str,
    project_name: str,
    run_id: str,
    checkpoint_stage: str,
    target: str,
    source_session: str,
    decision: str | None,
    summary: str,
    next_action: str,
    artifact_refs: list[str],
    blocking_conditions: list[str],
    sync_mode: str,
    manual_override: bool,
    target_repo_status: str,
) -> tuple[str, str]:
    fal_dir = target_repo / ".fal"
    fal_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = fal_dir / "ACTIVE_CONTEXT.md"
    json_path = fal_dir / "ACTIVE_CONTEXT.json"
    payload = {
        "schema_version": ACTIVE_CONTEXT_SCHEMA_VERSION,
        "project_id": project_id,
        "project_name": project_name,
        "target_repo_path": target_repo.as_posix(),
        "latest_fal_run_id": run_id,
        "latest_checkpoint_stage": checkpoint_stage,
        "latest_target": target,
        "latest_source_session": source_session,
        "latest_decision": decision,
        "latest_summary": summary,
        "next_action": next_action,
        "hard_constraints": list(DEFAULT_HARD_CONSTRAINTS),
        "blocking_conditions": blocking_conditions,
        "artifact_refs": artifact_refs,
        "sync_mode": sync_mode,
        "manual_override": manual_override,
        "target_repo_status": target_repo_status,
        "updated_at": _utc_now(),
    }
    markdown_lines = [
        "# RingFall ACTIVE_CONTEXT",
        "",
        "## Current Status",
        "",
        f"- project_id: `{project_id}`",
        f"- latest_fal_run_id: `{run_id}`",
        f"- latest_checkpoint_stage: `{checkpoint_stage}`",
        f"- latest_target: `{target}`",
        f"- latest_source_session: `{source_session}`",
        f"- latest_decision: `{decision or 'none'}`",
        f"- target_repo_status: `{target_repo_status}`",
        f"- sync_mode: `{sync_mode}`",
        f"- manual_override: `{str(manual_override).lower()}`",
        "",
        "## Summary",
        "",
        summary,
        "",
        "## Next Action",
        "",
        next_action,
        "",
        "## Hard Constraints",
        "",
        *[f"- {item}" for item in DEFAULT_HARD_CONSTRAINTS],
        "",
        "## Blocking Conditions",
        "",
        *( [f"- {item}" for item in blocking_conditions] if blocking_conditions else ["- none"] ),
        "",
        "## Artifact Refs",
        "",
        *( [f"- `{item}`" for item in artifact_refs] if artifact_refs else ["- none"] ),
        "",
        "## Read First",
        "",
        "- `.fal/FAL-Target-Project-Local-Runbook-v01.md`",
        "- `.fal/Ringfall-Checkpoint-Output-Contract-v01.md`",
    ]
    markdown_path.write_text("\n".join(markdown_lines).rstrip() + "\n", encoding="utf-8")
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return markdown_path.as_posix(), json_path.as_posix()


def _packet_stage_if_relevant(packet_path: Path) -> str | None:
    payload = _load_packet_json(packet_path)
    stage = payload.get("stage")
    if stage in {"meta_plan_review_done", "step_review_done"}:
        return str(stage)
    return None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cli_sync_checkpoint(args: argparse.Namespace) -> int:
    result = sync_checkpoint(
        target_repo_path=args.target_repo_path,
        project_id=args.project_id,
        project_name=args.project_name,
        source_session=args.source_session,
        stage=args.stage,
        target=args.target,
        data_dir=args.data_dir,
        router_dir=args.router_dir,
        source_path=args.source_path,
        packet_path=args.packet_path,
        decision=args.decision,
        summary=args.summary,
        next_action=args.next_action,
        accepted_scope_summary=args.accepted_scope_summary,
        sync_mode=args.sync_mode,
        manual_override=args.manual_override,
        hydration_level=args.hydration_level,
        recovery_success_label=args.recovery_success_label,
        update_active_context=not args.no_active_context_update,
    )
    print(json.dumps(result.__dict__, indent=2, ensure_ascii=True))
    return 0


def _cli_reconcile(args: argparse.Namespace) -> int:
    result = reconcile_loop(
        target_repo_path=args.target_repo_path,
        project_id=args.project_id,
        project_name=args.project_name,
        data_dir=args.data_dir,
        router_dir=args.router_dir,
        hydration_level=args.hydration_level,
        recovery_success_label=args.recovery_success_label,
        update_active_context=not args.no_active_context_update,
    )
    print(
        json.dumps(
            {
                "project_id": result.project_id,
                "processed_packet_count": result.processed_packet_count,
                "synced_count": result.synced_count,
                "skipped_count": result.skipped_count,
                "results": [item.__dict__ for item in result.results],
            },
            indent=2,
            ensure_ascii=True,
        )
    )
    return 0


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="FAL checkpoint sync helpers for router-driven target repos.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync_parser = subparsers.add_parser("sync-checkpoint", help="Sync one target checkpoint into FAL artifacts.")
    sync_parser.add_argument("--target-repo-path", required=True)
    sync_parser.add_argument("--project-id", required=True)
    sync_parser.add_argument("--project-name")
    sync_parser.add_argument("--source-session", required=True)
    sync_parser.add_argument("--stage", required=True)
    sync_parser.add_argument("--target", required=True)
    sync_parser.add_argument("--data-dir", default="data")
    sync_parser.add_argument("--router-dir", default=DEFAULT_ROUTER_DIR_NAME)
    sync_parser.add_argument("--source-path")
    sync_parser.add_argument("--packet-path")
    sync_parser.add_argument("--decision")
    sync_parser.add_argument("--summary")
    sync_parser.add_argument("--next-action")
    sync_parser.add_argument("--accepted-scope-summary")
    sync_parser.add_argument("--sync-mode", default="live_checkpoint", choices=sorted(ALLOWED_SYNC_MODES))
    sync_parser.add_argument("--manual-override", action="store_true")
    sync_parser.add_argument("--hydration-level", default="L1")
    sync_parser.add_argument("--recovery-success-label", default="restored")
    sync_parser.add_argument("--no-active-context-update", action="store_true")
    sync_parser.set_defaults(func=_cli_sync_checkpoint)

    reconcile_parser = subparsers.add_parser("reconcile-loop", help="Reconcile processed router packets into FAL artifacts.")
    reconcile_parser.add_argument("--target-repo-path", required=True)
    reconcile_parser.add_argument("--project-id", required=True)
    reconcile_parser.add_argument("--project-name")
    reconcile_parser.add_argument("--data-dir", default="data")
    reconcile_parser.add_argument("--router-dir", default=DEFAULT_ROUTER_DIR_NAME)
    reconcile_parser.add_argument("--hydration-level", default="L1")
    reconcile_parser.add_argument("--recovery-success-label", default="restored")
    reconcile_parser.add_argument("--no-active-context-update", action="store_true")
    reconcile_parser.set_defaults(func=_cli_reconcile)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
