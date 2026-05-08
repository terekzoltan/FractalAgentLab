from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts.w6_packet import (
    W6_PACKET_SCHEMA_VERSION,
    W6PacketDecision,
    W6PacketStage,
    W6ValidationStatus,
    validate_w6_packet,
)


class W6PacketContractTests(unittest.TestCase):
    def test_valid_plan_ready_packet_passes(self) -> None:
        result = validate_w6_packet(_sample_packet())

        self.assertTrue(result.passed)
        self.assertEqual([], result.warnings)
        self.assertIsNotNone(result.packet)
        self.assertEqual(W6PacketStage.PLAN_READY_FOR_META_REVIEW, result.packet.stage)
        self.assertIsNone(result.packet.decision)
        self.assertEqual(W6ValidationStatus.PASS, result.validation_status)

    def test_missing_packet_id_fails(self) -> None:
        payload = _sample_packet()
        del payload["packet_id"]

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertIn("Packet field 'packet_id' must be a non-empty path-safe identifier.", result.errors)
        self.assertIsNone(result.packet)

    def test_missing_loop_id_fails(self) -> None:
        payload = _sample_packet()
        del payload["loop_id"]

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertIn("Packet field 'loop_id' must be a non-empty path-safe identifier.", result.errors)

    def test_unknown_stage_fails(self) -> None:
        payload = _sample_packet(stage="not_a_stage")

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertTrue(any("stage" in error and "unknown value" in error for error in result.errors))

    def test_required_decision_stage_rejects_none(self) -> None:
        payload = _sample_packet(
            stage="meta_plan_review_done",
            decision=None,
            payload={
                "findings_first_plan_review": "Findings",
                "required_plan_changes": [],
                "blockers": [],
                "residual_risks": [],
                "meta_guidance": "Proceed only after ack.",
                "track_facing_handoff_summary": "Greenlit.",
            },
        )

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertIn("Stage 'meta_plan_review_done' requires a non-null decision.", result.errors)

    def test_required_decision_stage_rejects_disallowed_decision(self) -> None:
        payload = _sample_packet(
            stage="meta_plan_review_done",
            decision="pass",
            payload={
                "findings_first_plan_review": "Findings",
                "required_plan_changes": [],
                "blockers": [],
                "residual_risks": [],
                "meta_guidance": "Proceed only after ack.",
                "track_facing_handoff_summary": "Greenlit.",
            },
        )

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertTrue(any("does not allow decision 'pass'" in error for error in result.errors))

    def test_null_decision_stage_rejects_accidental_decision(self) -> None:
        payload = _sample_packet(decision="greenlit")

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertIn("Stage 'plan_ready_for_meta_review' requires decision to be null.", result.errors)

    def test_missing_privacy_classification_fails(self) -> None:
        payload = _sample_packet()
        del payload["privacy_classification"]

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertTrue(any("privacy_classification" in error for error in result.errors))

    def test_sanitized_public_is_never_implicit(self) -> None:
        result = validate_w6_packet(_sample_packet())

        self.assertTrue(result.passed)
        self.assertIsNotNone(result.packet)
        self.assertEqual("private_raw", result.packet.privacy_classification.value)

    def test_unknown_source_command_is_warning_not_error(self) -> None:
        payload = _sample_packet(source_command="manual_step_from_operator_notes")

        result = validate_w6_packet(payload)

        self.assertTrue(result.passed)
        self.assertEqual(W6ValidationStatus.WARNING, result.validation_status)
        self.assertTrue(any("source_command" in warning for warning in result.warnings))

    def test_unknown_track_label_is_warning_not_clean(self) -> None:
        payload = _sample_packet(originating_track="unknown")

        result = validate_w6_packet(payload)

        self.assertTrue(result.passed)
        self.assertIn("Packet originating_track is 'unknown'.", result.warnings)

    def test_visibility_audit_state_must_be_structured_object(self) -> None:
        payload = _sample_packet()
        payload["visibility_audit_state"] = "git visible only"

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertIn("Packet field 'visibility_audit_state' must be an object.", result.errors)

    def test_visibility_audit_state_requires_core_fields(self) -> None:
        payload = _sample_packet()
        payload["visibility_audit_state"] = {"execution_mode": "opencode_assisted"}

        result = validate_w6_packet(payload)

        self.assertFalse(result.passed)
        self.assertTrue(any("visibility_audit_state missing required field" in error for error in result.errors))

    def test_implementation_done_does_not_require_transition_history_in_w6_a(self) -> None:
        payload = _sample_packet(
            stage="implementation_done",
            decision=None,
            payload={
                "implementation_summary": "Implemented the scoped contract.",
                "changed_files": ["src/fractal_agent_lab/core/contracts/w6_packet.py"],
                "tests_checks_run": ["tests.core.contracts.test_w6_packet_contract"],
                "missing_tests_or_skipped_checks": [],
                "deviations_from_accepted_plan": [],
                "known_gaps": [],
                "exact_review_request": "Review W6-A contract scope.",
            },
        )

        result = validate_w6_packet(payload)

        self.assertTrue(result.passed)

    def test_packet_as_dict_preserves_contract_fields(self) -> None:
        result = validate_w6_packet(_sample_packet())

        self.assertTrue(result.passed)
        self.assertIsNotNone(result.packet)
        packet = result.packet.as_dict()
        self.assertEqual(W6_PACKET_SCHEMA_VERSION, packet["schema_version"])
        self.assertEqual("private_raw", packet["privacy_classification"])
        self.assertEqual("plan_ready_for_meta_review", packet["stage"])

    def test_unsafe_loop_ids_fail(self) -> None:
        for loop_id in (
            "../x",
            "/",
            "\\",
            "x/child",
            "x\\child",
            ".",
            "..",
            " loop-1 ",
            "CON",
            "PRN",
            "AUX",
            "NUL",
            "COM1",
            "LPT1",
        ):
            with self.subTest(loop_id=loop_id):
                result = validate_w6_packet(_sample_packet(loop_id=loop_id))

                self.assertFalse(result.passed)
                self.assertTrue(any("loop_id" in error for error in result.errors))

    def test_unsafe_packet_ids_fail(self) -> None:
        for packet_id in (
            "../ledger",
            "/",
            "\\",
            "x/child",
            "x\\child",
            ".",
            "..",
            " packet-1 ",
            "CON",
            "PRN",
            "AUX",
            "NUL",
            "COM1",
            "LPT1",
        ):
            with self.subTest(packet_id=packet_id):
                result = validate_w6_packet(_sample_packet(packet_id=packet_id))

                self.assertFalse(result.passed)
                self.assertTrue(any("packet_id" in error for error in result.errors))

    def test_reserved_ledger_packet_id_fails_case_insensitively(self) -> None:
        for packet_id in ("ledger", "LEDGER"):
            with self.subTest(packet_id=packet_id):
                result = validate_w6_packet(_sample_packet(packet_id=packet_id))

                self.assertFalse(result.passed)
                self.assertTrue(any("reserved identifier" in error for error in result.errors))

    def test_unsafe_parent_packet_id_fails_when_present(self) -> None:
        result = validate_w6_packet(_sample_packet(parent_packet_id="../packet-1"))

        self.assertFalse(result.passed)
        self.assertTrue(any("parent_packet_id" in error for error in result.errors))

    def test_safe_uppercase_and_underscore_ids_pass(self) -> None:
        result = validate_w6_packet(_sample_packet(loop_id="LOOP_1", packet_id="PACKET_1"))

        self.assertTrue(result.passed)


def _sample_packet(
    *,
    stage: str = "plan_ready_for_meta_review",
    decision: str | None = None,
    payload: dict[str, object] | None = None,
    source_command: str = "/seq-next",
    originating_track: str = "track_b",
    loop_id: str = "loop-1",
    packet_id: str = "packet-1",
    parent_packet_id: str | None = None,
) -> dict[str, object]:
    return {
        "schema_version": W6_PACKET_SCHEMA_VERSION,
        "packet_id": packet_id,
        "loop_id": loop_id,
        "stage": stage,
        "producer": "track",
        "consumer": "meta",
        "originating_track": originating_track,
        "target_track": "meta",
        "sequence_ref": "W6-S1/READY-W6-A",
        "source_command": source_command,
        "decision": decision,
        "created_at": "2026-05-08T12:00:00+00:00",
        "parent_packet_id": parent_packet_id,
        "artifact_refs": [
            {
                "path": "docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md",
                "kind": "planning_doc",
                "privacy_classification": "private_raw",
            },
        ],
        "payload_summary": "Track B W6-A implementation plan is ready for Meta review.",
        "payload": payload
        or {
            "implementation_plan_summary": "Implement packet and ledger contract boundaries.",
            "assumptions": [],
            "risks": [],
            "dependencies": ["Wave 5 closed"],
            "affected_files_or_surfaces": ["core/contracts"],
            "proposed_acceptance_checks": ["targeted unit tests"],
            "explicit_non_goals": ["no recorder"],
        },
        "visibility_audit_state": {
            "execution_mode": "opencode_assisted",
            "git_visible_state": "tracked diff plus local-only ops docs consulted",
            "local_only_sources": ["ops/Combined-Execution-Sequencing-Plan.md"],
            "data_artifacts_consulted": [],
            "notes": "Private Wave 6 plan consulted.",
        },
        "privacy_classification": "private_raw",
        "validation": {},
    }


if __name__ == "__main__":
    unittest.main()
