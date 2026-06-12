from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.memory.learning_candidates import (
    JSONLearningCandidateBacklogStore,
    LearningCandidate,
    LearningCandidateBacklog,
    LearningCandidateBacklogError,
    merge_candidate,
    transition_candidate,
)


NOW = "2026-06-12T12:00:00+00:00"
LATER = "2026-06-12T13:00:00+00:00"


class LearningCandidateTests(unittest.TestCase):
    def test_backlog_store_roundtrip_uses_encoded_project_id(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-learning-candidates-") as tmp_dir:
            store = JSONLearningCandidateBacklogStore(data_dir=tmp_dir)
            backlog = LearningCandidateBacklog(project_id="repo/main", candidates=[_candidate()])

            path = store.save_backlog(backlog)
            loaded = store.load_backlog(project_id="repo/main")

            self.assertEqual(Path(tmp_dir) / "learning_candidates" / "repo%2Fmain.json", path)
            self.assertTrue(path.exists())
            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual("repo/main", loaded.project_id)
            self.assertEqual(1, len(loaded.candidates))

    def test_unsafe_project_id_cannot_escape_store_root(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-learning-candidates-") as tmp_dir:
            store = JSONLearningCandidateBacklogStore(data_dir=tmp_dir)
            path = store.backlog_path(project_id="../escaped")

            self.assertEqual(Path(tmp_dir) / "learning_candidates", path.parent)
            self.assertNotIn("..", path.parts)
            self.assertFalse((Path(tmp_dir) / "escaped.json").exists())

    def test_invalid_transition_rejected(self) -> None:
        with self.assertRaisesRegex(LearningCandidateBacklogError, "Invalid learning candidate transition"):
            transition_candidate(_candidate(status="proposed"), "implemented", implementation_refs=["commit:abc"], now=LATER)

    def test_implemented_requires_implementation_refs(self) -> None:
        reviewed = transition_candidate(_candidate(), "reviewed", now=LATER)
        accepted = transition_candidate(reviewed, "accepted", owner_decision="Meta accepted for implementation planning.", now=LATER)

        with self.assertRaisesRegex(LearningCandidateBacklogError, "implemented status requires implementation_refs"):
            transition_candidate(accepted, "implemented", now=LATER)

    def test_validated_requires_validation_refs(self) -> None:
        implemented = _candidate(status="implemented", implementation_refs=["commit:abc"])

        with self.assertRaisesRegex(LearningCandidateBacklogError, "validated status requires validation_refs"):
            transition_candidate(implemented, "validated", now=LATER)

    def test_high_confidence_requires_validation_refs(self) -> None:
        with self.assertRaisesRegex(LearningCandidateBacklogError, "high confidence requires validation_refs"):
            _candidate(confidence="high")

    def test_duplicate_observation_merges_without_status_or_confidence_promotion(self) -> None:
        backlog = LearningCandidateBacklog(project_id="repo-main", candidates=[_candidate()])
        incoming = _candidate(
            candidate_id="lc-2",
            source_run_ids=["run-2"],
            source_paths=["review_findings_ledger.findings[1].summary"],
            evidence_count=1,
            confidence="medium",
            status="reviewed",
        )

        updated = merge_candidate(backlog=backlog, candidate=incoming, now=LATER)

        self.assertEqual(1, len(updated.candidates))
        candidate = updated.candidates[0]
        self.assertEqual(["run-1", "run-2"], candidate.source_run_ids)
        self.assertEqual(2, candidate.evidence_count)
        self.assertEqual("low", candidate.confidence)
        self.assertEqual("proposed", candidate.status)
        self.assertEqual(LATER, candidate.updated_at)

    def test_raw_body_transcript_reasoning_keys_rejected(self) -> None:
        payload = _candidate().to_dict()
        for key in ("raw_body", "transcript", "reasoning", "chain_of_thought"):
            with self.subTest(key=key):
                bad_payload = dict(payload)
                bad_payload[key] = "private text"
                with self.assertRaisesRegex(LearningCandidateBacklogError, "forbidden raw body/transcript field"):
                    LearningCandidate.from_dict(bad_payload)

    def test_authorization_fields_are_never_true(self) -> None:
        payload = _candidate(candidate_type="router_policy_hint").to_dict()

        self.assertFalse(payload["execution_authorized"])
        self.assertFalse(payload["prompt_rewrite_authorized"])
        self.assertFalse(payload["routing_authorized"])
        self.assertFalse(payload["commit_or_push_authorized"])
        self.assertFalse(payload["public_export_authorized"])

        bad_payload = dict(payload)
        bad_payload["routing_authorized"] = True
        with self.assertRaisesRegex(LearningCandidateBacklogError, "must not authorize execution field"):
            LearningCandidate.from_dict(bad_payload)

    def test_accepted_remains_non_executing(self) -> None:
        reviewed = transition_candidate(_candidate(), "reviewed", now=LATER)
        accepted = transition_candidate(reviewed, "accepted", owner_decision="Reviewed by Meta.", now=LATER)
        payload = accepted.to_dict()

        self.assertEqual("accepted", payload["status"])
        self.assertEqual("Reviewed by Meta.", payload["owner_decision"])
        self.assertFalse(payload["execution_authorized"])
        self.assertFalse(payload["prompt_rewrite_authorized"])
        self.assertFalse(payload["routing_authorized"])

    def test_accepted_or_rejected_requires_owner_decision(self) -> None:
        reviewed = transition_candidate(_candidate(), "reviewed", now=LATER)

        for status in ("accepted", "rejected"):
            with self.subTest(status=status):
                with self.assertRaisesRegex(LearningCandidateBacklogError, "requires owner_decision"):
                    transition_candidate(reviewed, status, now=LATER)

    def test_persisted_accepted_or_rejected_requires_owner_decision(self) -> None:
        for status in ("accepted", "rejected"):
            with self.subTest(status=status):
                payload = _candidate().to_dict()
                payload["status"] = status
                payload["owner_decision"] = None
                with self.assertRaisesRegex(LearningCandidateBacklogError, "requires owner_decision"):
                    LearningCandidate.from_dict(payload)

    def test_invalid_candidate_type_rejected(self) -> None:
        with self.assertRaisesRegex(LearningCandidateBacklogError, "candidate_type"):
            _candidate(candidate_type="automatic_rewrite")

    def test_validated_high_confidence_candidate_serializes(self) -> None:
        candidate = _candidate(
            status="validated",
            confidence="high",
            implementation_refs=["commit:abc"],
            validation_refs=["tests.memory.test_learning_candidates"],
        )

        payload = candidate.to_dict()
        self.assertEqual("validated", payload["status"])
        self.assertEqual("high", payload["confidence"])
        self.assertEqual(["tests.memory.test_learning_candidates"], payload["validation_refs"])

    def test_store_rejects_malformed_json_payload(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-learning-candidates-") as tmp_dir:
            store = JSONLearningCandidateBacklogStore(data_dir=tmp_dir)
            path = store.backlog_path(project_id="repo-main")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps([]), encoding="utf-8")

            with self.assertRaisesRegex(LearningCandidateBacklogError, "payload must be an object"):
                store.load_backlog(project_id="repo-main")


def _candidate(**overrides: object) -> LearningCandidate:
    payload: dict[str, object] = {
        "candidate_id": "lc-1",
        "candidate_type": "review_gate_rule",
        "proposed_change": "Require explicit missing-tests section before GREEN.",
        "source_run_ids": ["run-1"],
        "source_paths": ["review_findings_ledger.findings[0].summary"],
        "evidence_count": 1,
        "confidence": "low",
        "status": "proposed",
        "created_at": NOW,
        "updated_at": NOW,
        "expected_effect": "reduce false green from missing tests",
        "risk_level": "low",
    }
    payload.update(overrides)
    return LearningCandidate(**payload)  # type: ignore[arg-type]
