from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts.w6_packet import W6_PACKET_SCHEMA_VERSION, validate_w6_packet
from fractal_agent_lab.core.contracts.w6_state_machine import (
    W6LoopFinalState,
    validate_w6_packet_history,
)


class W6StateMachineContractTests(unittest.TestCase):
    def test_happy_path_closes_as_commit_ready_candidate(self) -> None:
        result = validate_w6_packet_history(_happy_path())

        self.assertTrue(result.passed)
        self.assertEqual(W6LoopFinalState.CLOSED_PASS, result.final_state)
        self.assertTrue(result.closed)
        self.assertTrue(result.commit_ready_candidate)

    def test_changes_requested_reset_allows_new_greenlit_plan(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review"),
                _packet("review-1", "meta_plan_review_done", decision="changes_requested"),
                _packet("ack-1", "plan_review_acknowledged"),
                _packet("plan-2", "plan_ready_for_meta_review"),
                _packet("review-2", "meta_plan_review_done", decision="greenlit"),
                _packet("ack-2", "plan_review_acknowledged"),
                _packet("impl-1", "implementation_done"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertEqual(W6LoopFinalState.AWAITING_STEP_REVIEW, result.final_state)

    def test_blocked_reset_allows_new_plan_then_greenlit_ack(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review"),
                _packet("review-1", "meta_plan_review_done", decision="blocked"),
                _packet("ack-1", "plan_review_acknowledged"),
                _packet("plan-2", "plan_ready_for_meta_review"),
                _packet("review-2", "meta_plan_review_done", decision="greenlit"),
                _packet("ack-2", "plan_review_acknowledged"),
                _packet("impl-1", "implementation_done"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertEqual(W6LoopFinalState.AWAITING_STEP_REVIEW, result.final_state)

    def test_implementation_without_greenlit_fails(self) -> None:
        result = validate_w6_packet_history(_history(_packet("impl-1", "implementation_done")))

        self.assertFalse(result.passed)
        self.assertTrue(any("implementation requires" in error for error in result.errors))

    def test_implementation_after_greenlit_without_ack_fails(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review"),
                _packet("review-1", "meta_plan_review_done", decision="greenlit"),
                _packet("impl-1", "implementation_done"),
            ),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("implementation requires" in error for error in result.errors))

    def test_implementation_after_changes_requested_without_new_greenlit_ack_fails(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review"),
                _packet("review-1", "meta_plan_review_done", decision="changes_requested"),
                _packet("ack-1", "plan_review_acknowledged"),
                _packet("impl-1", "implementation_done"),
            ),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("implementation requires" in error for error in result.errors))

    def test_implementation_after_blocked_without_new_plan_greenlit_ack_fails(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review"),
                _packet("review-1", "meta_plan_review_done", decision="blocked"),
                _packet("ack-1", "plan_review_acknowledged"),
                _packet("impl-1", "implementation_done"),
            ),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("blocked loop" in error for error in result.errors))

    def test_pass_after_fix_required_without_review_fix_fails(self) -> None:
        result = validate_w6_packet_history(
            _history(
                *_through_implementation(),
                _packet("step-review-1", "step_review_done", decision="fix_required"),
                _packet("step-review-2", "step_review_done", decision="pass"),
            ),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("step review requires" in error for error in result.errors))

    def test_fix_required_can_close_after_review_fix_and_pass_ack(self) -> None:
        result = validate_w6_packet_history(
            _history(
                *_through_implementation(),
                _packet("step-review-1", "step_review_done", decision="fix_required"),
                _packet("fix-1", "review_fix_done"),
                _packet("step-review-2", "step_review_done", decision="pass"),
                _packet("step-ack-1", "step_review_acknowledged"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertEqual(W6LoopFinalState.CLOSED_PASS, result.final_state)
        self.assertTrue(result.closed)
        self.assertTrue(result.commit_ready_candidate)

    def test_review_fix_without_fix_required_fails(self) -> None:
        result = validate_w6_packet_history(_history(*_through_implementation(), _packet("fix-1", "review_fix_done")))

        self.assertFalse(result.passed)
        self.assertTrue(any("review_fix_done requires" in error for error in result.errors))

    def test_deep_review_needed_does_not_allow_review_fix(self) -> None:
        result = validate_w6_packet_history(
            _history(
                *_through_implementation(),
                _packet("step-review-1", "step_review_done", decision="deep_review_needed"),
                _packet("fix-1", "review_fix_done"),
            ),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("deep_review_needed" in error for error in result.errors))

    def test_hold_acknowledged_is_not_closed_or_commit_ready(self) -> None:
        result = validate_w6_packet_history(
            _history(
                *_through_implementation(),
                _packet("step-review-1", "step_review_done", decision="hold"),
                _packet("step-ack-1", "step_review_acknowledged"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertEqual(W6LoopFinalState.HOLD, result.final_state)
        self.assertFalse(result.closed)
        self.assertFalse(result.commit_ready_candidate)

    def test_pass_without_acknowledgement_is_not_closed_or_commit_ready(self) -> None:
        result = validate_w6_packet_history(
            _history(
                *_through_implementation(),
                _packet("step-review-1", "step_review_done", decision="pass"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertFalse(result.closed)
        self.assertFalse(result.commit_ready_candidate)

    def test_packet_after_closed_loop_clears_commit_ready_flags(self) -> None:
        history = _happy_path()
        history.extend(_history(_packet("plan-after-close", "plan_ready_for_meta_review")))

        result = validate_w6_packet_history(history)

        self.assertFalse(result.passed)
        self.assertTrue(any("after a closed pass loop" in error for error in result.errors))
        self.assertFalse(result.closed)
        self.assertFalse(result.commit_ready_candidate)
        self.assertIsNone(result.final_state)
        self.assertFalse(result.commit_ready_candidate and not result.passed)

    def test_deep_review_needed_is_extension_required_not_closed(self) -> None:
        result = validate_w6_packet_history(
            _history(
                *_through_implementation(),
                _packet("step-review-1", "step_review_done", decision="deep_review_needed"),
                _packet("step-ack-1", "step_review_acknowledged"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertEqual(W6LoopFinalState.EXTENSION_REQUIRED, result.final_state)
        self.assertFalse(result.closed)
        self.assertFalse(result.commit_ready_candidate)

    def test_invalid_packet_result_fails_history_validation(self) -> None:
        payload = _packet("plan-1", "plan_ready_for_meta_review")
        del payload["packet_id"]

        result = validate_w6_packet_history([validate_w6_packet(payload)])

        self.assertFalse(result.passed)
        self.assertTrue(any("failed W6 packet validation" in error for error in result.errors))

    def test_warning_grade_packet_can_pass_with_warning_propagated(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review", source_command="operator_note"),
                _packet("review-1", "meta_plan_review_done", decision="greenlit"),
                _packet("ack-1", "plan_review_acknowledged"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertTrue(any("source_command" in warning for warning in result.warnings))

    def test_duplicate_packet_ids_fail(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("packet-1", "plan_ready_for_meta_review"),
                _packet("packet-1", "meta_plan_review_done", decision="greenlit"),
            ),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("duplicates packet_id" in error for error in result.errors))

    def test_mixed_loop_ids_fail(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review", loop_id="loop-1"),
                _packet("review-1", "meta_plan_review_done", decision="greenlit", loop_id="loop-2"),
            ),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("does not match history loop_id" in error for error in result.errors))

    def test_parent_refs_must_reference_earlier_packet(self) -> None:
        for parent_packet_id in ("missing-parent", "review-1"):
            with self.subTest(parent_packet_id=parent_packet_id):
                result = validate_w6_packet_history(
                    _history(
                        _packet("plan-1", "plan_ready_for_meta_review", parent_packet_id=parent_packet_id),
                        _packet("review-1", "meta_plan_review_done", decision="greenlit"),
                    ),
                )

                self.assertFalse(result.passed)
                self.assertTrue(any("parent_packet_id" in error for error in result.errors))

    def test_self_parent_ref_fails(self) -> None:
        result = validate_w6_packet_history(
            _history(_packet("plan-1", "plan_ready_for_meta_review", parent_packet_id="plan-1")),
        )

        self.assertFalse(result.passed)
        self.assertTrue(any("must not reference itself" in error for error in result.errors))

    def test_sequence_ref_mismatch_is_warning_not_error(self) -> None:
        result = validate_w6_packet_history(
            _history(
                _packet("plan-1", "plan_ready_for_meta_review", sequence_ref="W6-S1/W6-B"),
                _packet("review-1", "meta_plan_review_done", decision="greenlit", sequence_ref="W6-S1/W6-C"),
                _packet("ack-1", "plan_review_acknowledged", sequence_ref="W6-S1/W6-B"),
            ),
        )

        self.assertTrue(result.passed)
        self.assertTrue(any("sequence_ref" in warning for warning in result.warnings))


def _happy_path():
    return _history(
        *_through_implementation(),
        _packet("step-review-1", "step_review_done", decision="pass"),
        _packet("step-ack-1", "step_review_acknowledged"),
    )


def _through_implementation() -> tuple[dict[str, object], ...]:
    return (
        _packet("plan-1", "plan_ready_for_meta_review"),
        _packet("review-1", "meta_plan_review_done", decision="greenlit"),
        _packet("ack-1", "plan_review_acknowledged"),
        _packet("impl-1", "implementation_done"),
    )


def _history(*packets: dict[str, object]):
    return [validate_w6_packet(packet) for packet in packets]


def _packet(
    packet_id: str,
    stage: str,
    *,
    decision: str | None = None,
    loop_id: str = "loop-1",
    sequence_ref: str = "W6-S1/W6-B",
    parent_packet_id: str | None = None,
    source_command: str = "/seq-next",
) -> dict[str, object]:
    return {
        "schema_version": W6_PACKET_SCHEMA_VERSION,
        "packet_id": packet_id,
        "loop_id": loop_id,
        "stage": stage,
        "producer": "track",
        "consumer": "meta",
        "originating_track": "track_b",
        "target_track": "meta",
        "sequence_ref": sequence_ref,
        "source_command": source_command,
        "decision": decision,
        "created_at": "2026-05-08T12:00:00+00:00",
        "parent_packet_id": parent_packet_id,
        "artifact_refs": [
            {
                "path": "docs/private/Wave6-W6-S1-TrackB-W6-B-State-Machine-Validator.md",
                "kind": "delivery_note",
                "privacy_classification": "private_raw",
            },
        ],
        "payload_summary": f"W6-B packet for {stage}.",
        "payload": _payload_for_stage(stage),
        "visibility_audit_state": {
            "execution_mode": "opencode_assisted",
            "git_visible_state": "tracked diff plus local-only ops docs consulted",
            "local_only_sources": ["ops/Combined-Execution-Sequencing-Plan.md"],
            "data_artifacts_consulted": [],
            "notes": "W6-B state-machine contract test packet.",
        },
        "privacy_classification": "private_raw",
        "validation": {},
    }


def _payload_for_stage(stage: str) -> dict[str, object]:
    if stage == "plan_ready_for_meta_review":
        return {
            "implementation_plan_summary": "Implement W6-B transition validation.",
            "assumptions": [],
            "risks": [],
            "dependencies": ["W6-A accepted"],
            "affected_files_or_surfaces": ["core/contracts/w6_state_machine.py"],
            "proposed_acceptance_checks": ["targeted W6-B tests"],
            "explicit_non_goals": ["no recorder"],
        }
    if stage == "meta_plan_review_done":
        return {
            "findings_first_plan_review": [],
            "required_plan_changes": [],
            "blockers": [],
            "residual_risks": [],
            "meta_guidance": "Proceed within scope.",
            "track_facing_handoff_summary": "Plan reviewed.",
        }
    if stage == "plan_review_acknowledged":
        return {
            "consumed_review_packet_reference": "review-1",
            "track_response": "Acknowledged.",
            "planned_next_action": "Proceed according to decision.",
        }
    if stage == "implementation_done":
        return {
            "implementation_summary": "Implemented W6-B state-machine validator.",
            "changed_files": ["src/fractal_agent_lab/core/contracts/w6_state_machine.py"],
            "tests_checks_run": ["tests.core.contracts.test_w6_state_machine_contract"],
            "missing_tests_or_skipped_checks": [],
            "deviations_from_accepted_plan": [],
            "known_gaps": [],
            "exact_review_request": "Review W6-B transition validation.",
        }
    if stage == "step_review_done":
        return {
            "findings_first_implementation_review": [],
            "missing_tests": [],
            "required_fixes": [],
            "residual_risks": [],
            "commit_readiness_recommendation": "candidate only",
            "deep_review_needed": False,
        }
    if stage == "step_review_acknowledged":
        return {
            "consumed_review_packet_reference": "step-review-1",
            "track_response": "Acknowledged.",
            "final_completion_acknowledgement_or_next_action": "Close or continue according to review decision.",
        }
    if stage == "review_fix_done":
        return {
            "fixed_findings": [],
            "files_changed_during_fix": ["src/fractal_agent_lab/core/contracts/w6_state_machine.py"],
            "validation_rerun_summary": "Targeted tests rerun.",
            "residual_risk_note": "None.",
            "re_review_request": "Review fix cycle.",
        }
    raise ValueError(f"Unsupported stage fixture: {stage}")


if __name__ == "__main__":
    unittest.main()
