from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts.w6_ledger import (
    W6_LEDGER_SCHEMA_VERSION,
    W6LedgerDocument,
    ledger_entry_from_validated_packet,
)
from fractal_agent_lab.core.contracts.w6_packet import W6_PACKET_SCHEMA_VERSION, validate_w6_packet


class W6LedgerContractTests(unittest.TestCase):
    def test_validated_packet_converts_to_ledger_entry(self) -> None:
        validation = validate_w6_packet(_sample_packet())

        entry = ledger_entry_from_validated_packet(
            validation,
            received_at="2026-05-08T12:01:00+00:00",
            changed_files=["src/fractal_agent_lab/core/contracts/w6_packet.py"],
            tests_run=["tests.core.contracts.test_w6_packet_contract"],
            missing_tests=[],
        )

        self.assertEqual(W6_LEDGER_SCHEMA_VERSION, entry.ledger_schema_version)
        self.assertEqual("loop-1", entry.loop_id)
        self.assertEqual("packet-1", entry.packet_id)
        self.assertEqual("plan_ready_for_meta_review", entry.stage)
        self.assertIsNone(entry.decision)
        self.assertEqual("private_raw", entry.privacy_classification)
        self.assertEqual("pass", entry.validation_status)
        self.assertEqual(["src/fractal_agent_lab/core/contracts/w6_packet.py"], entry.changed_files)

    def test_invalid_packet_cannot_become_clean_ledger_entry(self) -> None:
        payload = _sample_packet()
        del payload["packet_id"]
        validation = validate_w6_packet(payload)

        with self.assertRaises(ValueError):
            _ = ledger_entry_from_validated_packet(validation)

    def test_warning_packet_preserves_warning_status(self) -> None:
        payload = _sample_packet()
        payload["source_command"] = "operator_freeform_step"
        validation = validate_w6_packet(payload)

        entry = ledger_entry_from_validated_packet(validation)

        self.assertEqual("warning", entry.validation_status)
        self.assertTrue(entry.validation_warnings)

    def test_ledger_document_shape_is_object_with_entries(self) -> None:
        validation = validate_w6_packet(_sample_packet())
        entry = ledger_entry_from_validated_packet(validation)
        document = W6LedgerDocument(loop_id="loop-1", entries=[entry])

        payload = document.as_dict()

        self.assertEqual(W6_LEDGER_SCHEMA_VERSION, payload["ledger_schema_version"])
        self.assertEqual("loop-1", payload["loop_id"])
        self.assertEqual(1, len(payload["entries"]))
        self.assertEqual("packet-1", payload["entries"][0]["packet_id"])


def _sample_packet() -> dict[str, object]:
    return {
        "schema_version": W6_PACKET_SCHEMA_VERSION,
        "packet_id": "packet-1",
        "loop_id": "loop-1",
        "stage": "plan_ready_for_meta_review",
        "producer": "track",
        "consumer": "meta",
        "originating_track": "track_b",
        "target_track": "meta",
        "sequence_ref": "W6-S1/READY-W6-A",
        "source_command": "/seq-next",
        "decision": None,
        "created_at": "2026-05-08T12:00:00+00:00",
        "parent_packet_id": None,
        "artifact_refs": [
            {
                "path": "docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md",
                "kind": "planning_doc",
                "privacy_classification": "private_raw",
            },
        ],
        "payload_summary": "Track B W6-A implementation plan is ready for Meta review.",
        "payload": {
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
