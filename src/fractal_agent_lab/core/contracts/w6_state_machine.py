from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Sequence

from fractal_agent_lab.core.contracts.w6_packet import (
    W6Packet,
    W6PacketDecision,
    W6PacketStage,
    W6PacketValidationResult,
)


class W6LoopFinalState(StrEnum):
    AWAITING_PLAN_REVIEW = "awaiting_plan_review"
    AWAITING_PLAN_ACK = "awaiting_plan_ack"
    AWAITING_IMPLEMENTATION = "awaiting_implementation"
    AWAITING_STEP_REVIEW = "awaiting_step_review"
    FIX_REQUIRED = "fix_required"
    HOLD = "hold"
    EXTENSION_REQUIRED = "extension_required"
    CLOSED_PASS = "closed_pass"
    BLOCKED = "blocked"


@dataclass(slots=True)
class W6StateMachineValidationResult:
    loop_id: str | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    final_state: W6LoopFinalState | None = None
    closed: bool = False
    commit_ready_candidate: bool = False

    @property
    def passed(self) -> bool:
        return not self.errors


def validate_w6_packet_history(
    validation_results: Sequence[W6PacketValidationResult],
) -> W6StateMachineValidationResult:
    result = W6StateMachineValidationResult()
    packets = _collect_valid_packets(validation_results, result)
    if result.errors:
        return result

    _validate_history_identity(packets, result)
    if result.errors:
        return result

    _validate_transitions(packets, result)
    _finalize_result_state(result)
    return result


def _finalize_result_state(result: W6StateMachineValidationResult) -> None:
    if result.errors:
        result.final_state = None
        result.closed = False
        result.commit_ready_candidate = False
        return

    result.closed = result.final_state == W6LoopFinalState.CLOSED_PASS
    result.commit_ready_candidate = result.closed


def _collect_valid_packets(
    validation_results: Sequence[W6PacketValidationResult],
    result: W6StateMachineValidationResult,
) -> list[W6Packet]:
    if not validation_results:
        result.errors.append("W6 packet history must contain at least one packet.")
        return []

    packets: list[W6Packet] = []
    for index, validation_result in enumerate(validation_results, start=1):
        if validation_result.warnings:
            for warning in validation_result.warnings:
                result.warnings.append(f"Packet #{index}: {warning}")
        if not validation_result.passed or validation_result.packet is None:
            result.errors.append(f"Packet #{index} failed W6 packet validation and cannot enter state validation.")
            continue
        packets.append(validation_result.packet)
    return packets


def _validate_history_identity(packets: Sequence[W6Packet], result: W6StateMachineValidationResult) -> None:
    result.loop_id = packets[0].loop_id
    sequence_ref = packets[0].sequence_ref
    seen_packet_ids: set[str] = set()

    for index, packet in enumerate(packets, start=1):
        if packet.loop_id != result.loop_id:
            result.errors.append(
                f"Packet #{index} loop_id '{packet.loop_id}' does not match history loop_id '{result.loop_id}'.",
            )
        if packet.sequence_ref != sequence_ref:
            result.warnings.append(
                f"Packet #{index} sequence_ref '{packet.sequence_ref}' differs from initial sequence_ref '{sequence_ref}'.",
            )
        if packet.packet_id in seen_packet_ids:
            result.errors.append(f"Packet #{index} duplicates packet_id '{packet.packet_id}'.")
        if packet.parent_packet_id is not None:
            if packet.parent_packet_id == packet.packet_id:
                result.errors.append(f"Packet #{index} parent_packet_id must not reference itself.")
            elif packet.parent_packet_id not in seen_packet_ids:
                result.errors.append(
                    f"Packet #{index} parent_packet_id '{packet.parent_packet_id}' does not reference an earlier packet.",
                )
        seen_packet_ids.add(packet.packet_id)


def _validate_transitions(packets: Sequence[W6Packet], result: W6StateMachineValidationResult) -> None:
    state = W6LoopFinalState.AWAITING_PLAN_REVIEW
    plan_ready_available = False
    pending_plan_decision: W6PacketDecision | None = None
    pending_step_decision: W6PacketDecision | None = None

    for index, packet in enumerate(packets, start=1):
        stage = packet.stage
        decision = packet.decision

        if state == W6LoopFinalState.CLOSED_PASS:
            result.errors.append(f"Packet #{index} appears after a closed pass loop.")
            continue

        if state == W6LoopFinalState.EXTENSION_REQUIRED and stage != W6PacketStage.STEP_REVIEW_ACKNOWLEDGED:
            result.errors.append(
                f"Packet #{index} cannot follow deep_review_needed without a future explicit extension route.",
            )
            continue

        if state == W6LoopFinalState.HOLD and stage != W6PacketStage.STEP_REVIEW_ACKNOWLEDGED:
            result.errors.append(f"Packet #{index} cannot continue automatically from hold state.")
            continue

        if state == W6LoopFinalState.BLOCKED and stage != W6PacketStage.PLAN_READY_FOR_META_REVIEW:
            result.errors.append(f"Packet #{index} cannot continue a blocked loop without a new plan packet.")
            continue

        if pending_step_decision == W6PacketDecision.PASS and stage != W6PacketStage.STEP_REVIEW_ACKNOWLEDGED:
            result.errors.append(f"Packet #{index} cannot continue after pass without step review acknowledgement.")
            continue

        if stage == W6PacketStage.PLAN_READY_FOR_META_REVIEW:
            if state not in {
                W6LoopFinalState.AWAITING_PLAN_REVIEW,
                W6LoopFinalState.BLOCKED,
            }:
                result.errors.append(f"Packet #{index} plan packet is not valid while state is '{state.value}'.")
                continue
            state = W6LoopFinalState.AWAITING_PLAN_REVIEW
            plan_ready_available = True
            pending_plan_decision = None
            pending_step_decision = None
            continue

        if stage == W6PacketStage.META_PLAN_REVIEW_DONE:
            if state != W6LoopFinalState.AWAITING_PLAN_REVIEW or not plan_ready_available:
                result.errors.append(f"Packet #{index} plan review is not valid while state is '{state.value}'.")
                continue
            state = W6LoopFinalState.AWAITING_PLAN_ACK
            plan_ready_available = False
            pending_plan_decision = decision
            continue

        if stage == W6PacketStage.PLAN_REVIEW_ACKNOWLEDGED:
            if state != W6LoopFinalState.AWAITING_PLAN_ACK or pending_plan_decision is None:
                result.errors.append(f"Packet #{index} plan review acknowledgement has no pending plan review.")
                continue
            if pending_plan_decision == W6PacketDecision.GREENLIT:
                state = W6LoopFinalState.AWAITING_IMPLEMENTATION
            elif pending_plan_decision == W6PacketDecision.CHANGES_REQUESTED:
                state = W6LoopFinalState.AWAITING_PLAN_REVIEW
            elif pending_plan_decision == W6PacketDecision.BLOCKED:
                state = W6LoopFinalState.BLOCKED
            pending_plan_decision = None
            continue

        if stage == W6PacketStage.IMPLEMENTATION_DONE:
            if state != W6LoopFinalState.AWAITING_IMPLEMENTATION:
                result.errors.append(
                    f"Packet #{index} implementation requires a greenlit and acknowledged plan review.",
                )
                continue
            state = W6LoopFinalState.AWAITING_STEP_REVIEW
            pending_step_decision = None
            continue

        if stage == W6PacketStage.STEP_REVIEW_DONE:
            if state != W6LoopFinalState.AWAITING_STEP_REVIEW:
                result.errors.append(
                    f"Packet #{index} step review requires a preceding implementation or review fix.",
                )
                continue
            pending_step_decision = decision
            if decision == W6PacketDecision.PASS:
                state = W6LoopFinalState.AWAITING_STEP_REVIEW
            elif decision == W6PacketDecision.FIX_REQUIRED:
                state = W6LoopFinalState.FIX_REQUIRED
            elif decision == W6PacketDecision.HOLD:
                state = W6LoopFinalState.HOLD
            elif decision == W6PacketDecision.DEEP_REVIEW_NEEDED:
                state = W6LoopFinalState.EXTENSION_REQUIRED
            continue

        if stage == W6PacketStage.REVIEW_FIX_DONE:
            if state != W6LoopFinalState.FIX_REQUIRED:
                result.errors.append(f"Packet #{index} review_fix_done requires a pending fix_required step review.")
                continue
            state = W6LoopFinalState.AWAITING_STEP_REVIEW
            pending_step_decision = None
            continue

        if stage == W6PacketStage.STEP_REVIEW_ACKNOWLEDGED:
            if pending_step_decision is None:
                result.errors.append(f"Packet #{index} step review acknowledgement has no pending step review.")
                continue
            if pending_step_decision == W6PacketDecision.PASS:
                state = W6LoopFinalState.CLOSED_PASS
            elif pending_step_decision == W6PacketDecision.FIX_REQUIRED:
                state = W6LoopFinalState.FIX_REQUIRED
            elif pending_step_decision == W6PacketDecision.HOLD:
                state = W6LoopFinalState.HOLD
            elif pending_step_decision == W6PacketDecision.DEEP_REVIEW_NEEDED:
                state = W6LoopFinalState.EXTENSION_REQUIRED
            pending_step_decision = None
            continue

    result.final_state = state
