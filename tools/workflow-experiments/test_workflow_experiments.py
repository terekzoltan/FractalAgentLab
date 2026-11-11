"""Behavioral checks for optional measurement, privacy and unchanged router state."""
import copy
import io
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import redirect_stdout
from pathlib import Path

from workflow_experiments import ExperimentError, Ledger, canonical, digest, load_request, main, timestamp
from technical_pilot import make_router_fixture, run_pilot, sample_assignment, sample_contract, sample_observation


class ExperimentsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="fal-experiment-test-")
        self.root = Path(self.temporary.name)
        self.path = self.root / "experiments.sqlite"
        self.ledger = Ledger(self.path)
        self.contract = sample_contract()
        self.study = self.contract["studyId"]
        self.ledger.init_study(self.contract)

    def tearDown(self):
        self.ledger.close()
        self.temporary.cleanup()

    def activate(self):
        self.ledger.control({"studyId": self.study, "approvalRef": digest("test-approval")}, "activate")

    def assign(self, index=0):
        self.activate()
        return self.ledger.assign(sample_assignment(index))

    def assert_error(self, code, action):
        with self.assertRaisesRegex(ExperimentError, "^" + code + "$"):
            action()

    def test_inactive_by_default_and_no_unit_when_disabled(self):
        result = self.ledger.assign(sample_assignment())
        self.assertEqual(result["reason"], "DISABLED")
        self.assertFalse(result["experimentalExtraAllowed"])
        self.assertFalse(result["dispatch"])
        self.assertEqual(self.ledger.report(self.study)["assignedUnits"], 0)

    def test_contract_immutable_and_registration_idempotent(self):
        self.assertFalse(self.ledger.init_study(self.contract)["active"])
        altered = {**self.contract, "maxUnits": 20}
        self.assert_error("CONTRACT_IMMUTABLE", lambda: self.ledger.init_study(altered))

    def test_live_requires_explicit_activation_and_stopped_cannot_restart(self):
        live = {**self.contract, "studyId": "live-example", "mode": "live"}
        self.ledger.init_study(live)
        request = {"studyId": "live-example", "approvalRef": digest("new-owner-grant")}
        self.assert_error("EXPLICIT_LIVE_ACTIVATION_REQUIRED", lambda: self.ledger.control(request, "activate"))
        # This test only activates an isolated fixture, never a real project.
        self.assertTrue(self.ledger.control(request, "activate", allow_live=True)["active"])
        self.ledger.control(request, "stop")
        self.assert_error("STOPPED_STUDY_IMMUTABLE", lambda: self.ledger.control(request, "activate", allow_live=True))

    def test_retry_and_recovery_keep_assignment_and_no_second_sample(self):
        original = self.assign()
        for _ in range(4):
            repeat = self.ledger.assign(sample_assignment())
            self.assertEqual((repeat["unitId"], repeat["arm"]), (original["unitId"], original["arm"]))
            self.assertTrue(repeat["reused"])
        self.assertEqual(self.ledger.report(self.study)["assignedUnits"], 1)
        self.ledger.control({"studyId": self.study, "approvalRef": digest("stop")}, "stop")
        self.assertFalse(self.ledger.assign(sample_assignment())["experimentalExtraAllowed"])

    def test_assignment_change_and_candidate_relabel_forbidden(self):
        self.assign()
        altered = sample_assignment()
        altered["candidateDigest"] = digest("repaired-candidate")
        self.assert_error("ASSIGNMENT_IMMUTABLE_USE_ORIGINAL_IDENTITY", lambda: self.ledger.assign(altered))
        alias = sample_assignment()
        alias["reviewCycle"] = "retry-disguised-as-new-unit"
        self.assert_error("CANDIDATE_ALREADY_BOUND_USE_ORIGINAL_REVIEW_FAMILY", lambda: self.ledger.assign(alias))

    def test_repairs_need_lineage_and_remain_same_unit(self):
        assigned = self.assign()
        obs = sample_observation(assigned)
        obs["currentCandidateDigest"] = digest("repair")
        self.assert_error("REPAIRED_CANDIDATE_LINEAGE_REQUIRED", lambda: self.ledger.observe(obs))
        obs["candidateLineageEvidenceHash"] = digest("review-fix-chain")
        self.ledger.observe(obs)
        alias = sample_assignment(1)
        alias["candidateDigest"] = obs["currentCandidateDigest"]
        self.assert_error("CANDIDATE_ALREADY_BOUND_USE_ORIGINAL_REVIEW_FAMILY", lambda: self.ledger.assign(alias))
        self.assertEqual(self.ledger.report(self.study)["assignedUnits"], 1)

    def test_random_blocks_balance_and_only_b_allows_extra(self):
        self.activate()
        samples = [self.ledger.assign(sample_assignment(i)) for i in range(8)]
        for block in (samples[:4], samples[4:]):
            self.assertEqual(sorted(s["arm"] for s in block), list("AABB"))
        for sample in samples:
            self.assertEqual(sample["experimentalExtraAllowed"], sample["arm"] == "B")
        self.assertEqual(self.ledger.assign(sample_assignment(8))["reason"], "SAMPLE_CAP")
        self.assertEqual(self.ledger.report(self.study)["preAssignmentOmissions"], {"SAMPLE_CAP": 1})

    def test_concurrent_assignments_unique_and_balanced(self):
        self.activate()
        def assign_in_connection(i):
            ledger = Ledger(self.path)
            try:
                return ledger.assign(sample_assignment(i))
            finally:
                ledger.close()
        with ThreadPoolExecutor(max_workers=4) as pool:
            samples = list(pool.map(assign_in_connection, range(8)))
        self.assertEqual(len({s["unitId"] for s in samples}), 8)
        self.assertEqual(sum(s["arm"] == "B" for s in samples), 4)

    def test_scope_eligibility_and_version_omissions_retained_without_assignment(self):
        self.activate()
        changes = [("workId", "unapproved-work", "WORK_NOT_AUTHORIZED_FOR_STUDY"),
                   ("difficulty", "large", "NOT_ELIGIBLE"),
                   ("versions", {**self.contract["versions"], "model": digest("new-model")}, "VERSION_DRIFT")]
        for key, value, reason in changes:
            request = {**sample_assignment(), key: value}
            self.assertEqual(self.ledger.assign(request)["reason"], reason)
            self.assertEqual(self.ledger.assign(request)["reason"], reason)
        report = self.ledger.report(self.study)
        self.assertEqual(report["assignedUnits"], 0)
        self.assertEqual(sum(report["preAssignmentOmissions"].values()), 3)
        self.assert_error("PRE_OUTCOME_ASSIGNMENT_REQUIRED", lambda: self.ledger.assign({**sample_assignment(), "preOutcome": False}))

    def test_observations_idempotent_and_explicit_corrections_preserve_original(self):
        assigned = self.assign()
        obs = sample_observation(assigned)
        first = self.ledger.observe(obs)
        self.assertTrue(self.ledger.observe(obs)["reused"])
        conflict = {**obs, "actualVariant": "not_run"}
        self.assert_error("OBSERVATION_KEY_CONFLICT", lambda: self.ledger.observe(conflict))
        correction = {**obs, "observationKey": "correction", "supersedes": first["observationDigest"], "findings": []}
        self.assert_error("EXPLICIT_CORRECTION_REQUIRED", lambda: self.ledger.observe(correction))
        correction["deviations"] = ["correction"]
        self.ledger.observe(correction)
        export = self.ledger.export(self.study)
        self.assertEqual(len(export["units"][0]["observations"]), 2)
        self.assertEqual(sum(a["materialAcceptedFindings"] for a in self.ledger.report(self.study)["arms"].values()), 0)

    def test_database_immutability(self):
        self.assign()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "APPEND_ONLY"):
            self.ledger.db.execute("UPDATE units SET arm='B'")
        self.ledger.db.rollback()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "APPEND_ONLY"):
            self.ledger.db.execute("DELETE FROM studies")
        self.ledger.db.rollback()

    def test_pending_partial_findings_not_primary_complete_case(self):
        assigned = self.assign()
        obs = {**sample_observation(assigned), "state": "pending"}
        self.ledger.observe(obs)
        result = self.ledger.report(self.study)["arms"][assigned["arm"]]
        self.assertEqual(result["independentlyEvaluated"], 0)
        self.assertEqual(result["primaryOutcomeMissingUnits"], 1)
        self.assertIsNone(result["observedMeanMaterialFindings"])

    def test_failure_abort_missing_are_denominator_and_unknown_not_zero(self):
        self.activate()
        samples = [self.ledger.assign(sample_assignment(i)) for i in range(4)]
        for i in (0, 1):
            obs = sample_observation(samples[i], i)
            obs.update(state="failed" if i == 0 else "aborted", actualVariant="not_run", independentEvaluation=False, findings=[], evaluatorRef=None, evaluationEvidenceHash=None)
            self.ledger.observe(obs)
        report = self.ledger.report(self.study)
        self.assertEqual(report["assignedUnits"], 4)
        self.assertEqual(sum(a["noOutcome"] for a in report["arms"].values()), 2)
        self.assertEqual(sum(a["primaryOutcomeMissingUnits"] for a in report["arms"].values()), 4)
        for arm in report["arms"].values():
            self.assertIsNone(arm["observedCostUSD"])
            self.assertIsNone(arm["observedRegressions"])

    def test_version_carryover_usage_and_followup_quality(self):
        assigned = self.assign()
        obs = sample_observation(assigned)
        obs["versions"]["model"] = digest("changed-model-config")
        obs["carryover"] = "possible"
        obs["usage"] = {"tokens": 100, "costUSD": 0.02, "quality": "provider_reported", "evidenceHash": digest("usage")}
        obs["followup"] = {"observedDays": 2, "regressions": 0, "evidenceHash": digest("followup")}
        self.ledger.observe(obs)
        report = self.ledger.report(self.study)["arms"][assigned["arm"]]
        self.assertEqual(report["versionDriftUnits"], 1)
        self.assertEqual(report["carryoverUnits"], 1)
        self.assertEqual(report["observedTokens"], 100)
        self.assertEqual(report["followupCompleteUnits"], 0)
        self.assertIsNone(report["observedRegressions"])

    def test_invalid_unknown_context_billing_nonfinite_and_extra_fields_rejected(self):
        assigned = self.assign()
        bad = sample_observation(assigned)
        bad["usage"]["tokens"] = 500000
        self.assert_error("UNKNOWN_USAGE_MUST_BE_NULL", lambda: self.ledger.observe(bad))
        bad = sample_observation(assigned)
        bad["usage"]["quality"] = "context_estimate"
        self.assert_error("INVALID_ENUM", lambda: self.ledger.observe(bad))
        for number in (-1, float("nan"), float("inf"), True):
            bad = sample_observation(assigned)
            bad["elapsedSeconds"] = number
            self.assert_error("INVALID_METRIC", lambda: self.ledger.observe(bad))
        self.assert_error("INVALID_FIELDS", lambda: self.ledger.observe({**sample_observation(assigned), "rawTranscript": "PRIVATE_SENTINEL"}))

    def test_independent_findings_need_proof_and_duplicates_rejected(self):
        assigned = self.assign()
        bad = sample_observation(assigned)
        bad["evaluationEvidenceHash"] = None
        self.assert_error("EVALUATION_PROOF_REQUIRED", lambda: self.ledger.observe(bad))
        bad = sample_observation(assigned)
        bad["findings"] *= 2
        self.assert_error("DUPLICATE_FINDING", lambda: self.ledger.observe(bad))

    def test_router_projection_readonly_workbound_private_and_no_acceptance(self):
        assigned = self.assign()
        other = self.assign(1)
        router = self.root / "router.sqlite"
        make_router_fixture(router)
        before = router.read_bytes()
        result = self.ledger.link_operation(self.study, assigned["unitId"], router, "op-synthetic-review")
        self.assertEqual(before, router.read_bytes())
        self.assertEqual(result["facts"]["execution"], "COMPLETED")
        self.assertEqual(result["facts"]["productAcceptance"], "not_observed")
        self.ledger.link_operation(self.study, assigned["unitId"], router, "op-synthetic-review")
        self.assertEqual(len(self.ledger.export(self.study)["units"][0]["operationFacts"]), 1)
        text = canonical(self.ledger.export(self.study))
        for excluded in ("PRIVATE_", "ses_", "op-synthetic-review", "synthetic-work", self.contract["question"], self.contract["budget"]):
            self.assertNotIn(excluded, text)
        self.assert_error("OPERATION_ALREADY_BOUND_TO_OTHER_UNIT", lambda: self.ledger.link_operation(self.study, other["unitId"], router, "op-synthetic-review"))

    def test_router_wrong_work_old_outcome_and_wrong_database_rejected(self):
        assigned = self.assign()
        other = self.root / "wrong-work.sqlite"
        make_router_fixture(other, work="different-work")
        self.assert_error("OPERATION_WORK_MISMATCH", lambda: self.ledger.link_operation(self.study, assigned["unitId"], other, "op-synthetic-review"))
        old = self.root / "old.sqlite"
        make_router_fixture(old, completed="2020-01-01T00:00:00Z")
        self.assert_error("OUTCOME_PRECEDES_ASSIGNMENT", lambda: self.ledger.link_operation(self.study, assigned["unitId"], old, "op-synthetic-review"))
        before = old.read_bytes()
        self.assert_error("NOT_EXPERIMENT_LEDGER", lambda: Ledger(old))
        self.assertEqual(old.read_bytes(), before)

    def test_readonly_report_does_not_write_and_cannot_mutate(self):
        self.assign()
        self.ledger.db.execute("PRAGMA wal_checkpoint(FULL)")
        before = self.path.read_bytes()
        readonly = Ledger(self.path, readonly=True)
        try:
            self.assertEqual(readonly.report(self.study)["assignedUnits"], 1)
            with self.assertRaises(sqlite3.OperationalError):
                readonly.init_study({**self.contract, "studyId": "another"})
        finally:
            readonly.close()
        self.assertEqual(before, self.path.read_bytes())

    def test_input_bounds_duplicate_keys_and_timestamps(self):
        request = self.root / "request.json"
        request.write_text('{"studyId":"one","studyId":"two"}', encoding="utf8")
        self.assert_error("DUPLICATE_JSON_KEY", lambda: load_request(request))
        request.write_bytes(b" " * 65537)
        self.assert_error("REQUEST_TOO_LARGE", lambda: load_request(request))
        request.write_text('{"number":NaN}', encoding="utf8")
        self.assert_error("NONFINITE_NUMBER", lambda: load_request(request))
        for invalid in ("2026-01-01Z", "2026-01-01T12:00:00", "not-time"):
            self.assert_error("INVALID_TIMESTAMP", lambda: timestamp(invalid))

    def test_cli_error_is_baseline_fallback_without_input_content(self):
        request = self.root / "request.json"
        request.write_text('{"rawPassword":"PRIVATE_SENTINEL"}', encoding="utf8")
        output = io.StringIO()
        with redirect_stdout(output):
            code = main(["assign", "--ledger", str(self.path), "--request", str(request)])
        result = json.loads(output.getvalue())
        self.assertEqual(code, 2)
        self.assertEqual(result["normalWorkflow"], "CONTINUE_BASELINE")
        self.assertFalse(result["experimentalExtraAllowed"])
        self.assertNotIn("PRIVATE_SENTINEL", output.getvalue())

    def test_technical_pilot_and_cli_load(self):
        pilot = run_pilot(self.root / "pilot.sqlite")
        self.assertEqual(pilot["technicalPilot"], "PASS")
        self.assertEqual(pilot["liveStudiesActivated"], 0)
        self.assertFalse(pilot["active"])
        self.assertFalse(pilot["reviewerEfficacyEstablished"])
        process = subprocess.run([sys.executable, "-B", str(Path(__file__).with_name("workflow_experiments.py")), "report", "--ledger", str(self.path), "--study-id", self.study], capture_output=True, text=True, check=True)
        self.assertFalse(json.loads(process.stdout)["active"])


if __name__ == "__main__":
    unittest.main()
