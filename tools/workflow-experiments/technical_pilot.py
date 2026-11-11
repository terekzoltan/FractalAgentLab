"""Known synthetic cases: validate instrumentation, never reviewer efficacy."""
from __future__ import annotations

import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

from workflow_experiments import Ledger, canonical, digest, fail, now


def sample_contract():
    return {"schemaVersion": 1, "studyId": "synthetic-review-pilot", "mode": "synthetic",
            "question": "Does the measurement pipeline preserve eight known synthetic cases?",
            "variants": {"A": "Required baseline checks", "B": "Same required checks plus synthetic extra reviewer"},
            "mandatoryChecks": ["Existing mandatory independent review and acceptance remain unchanged"],
            "allowedWorkIds": ["synthetic-work"], "eligibleTaskTypes": ["documentation"], "eligibleRisks": ["low"],
            "strata": [{"id": "docs-small", "taskType": "documentation", "risk": "low", "difficulty": "small"}],
            "primaryOutcome": "verified_material_findings", "maxUnits": 8, "followupDays": 7,
            "stopRule": "Eight fixed synthetic cases; no live sessions or provider calls", "expiresAt": "2099-01-01T00:00:00Z",
            "budget": "Local standard-library fixtures only; zero paid calls", "evaluationRule": "Known synthetic oracle, identical for both labels",
            "ownerApprovalRef": digest("synthetic-technical-pilot-approval"),
            "versions": {k: digest("fixture-" + k) for k in ("workflow", "model", "prompt")}}


def sample_assignment(index=0):
    c = sample_contract()
    return {"studyId": c["studyId"], "workId": "synthetic-work", "candidateDigest": digest(["candidate", index]),
            "reviewCycle": "review-family-" + str(index), "stratumId": "docs-small", "taskType": "documentation",
            "risk": "low", "difficulty": "small", "versions": c["versions"], "carryover": "none",
            "eligibilityEvidenceHash": digest(["pre-outcome-eligibility", index]), "preOutcome": True}


def sample_observation(assignment, index=0):
    return {"unitId": assignment["unitId"], "observationKey": "initial-outcome", "supersedes": None,
            "currentCandidateDigest": sample_assignment(index)["candidateDigest"], "candidateLineageEvidenceHash": None,
            "state": "completed", "actualVariant": assignment["arm"], "versions": sample_contract()["versions"],
            "deviations": [], "carryover": "none", "independentEvaluation": True, "evaluationBlinded": True,
            "evaluatorRef": digest("synthetic-independent-evaluator"), "evaluationEvidenceHash": digest(["oracle", index]),
            "findings": [{"findingHash": digest(["finding", index]), "disposition": "accepted", "material": True}],
            "elapsedSeconds": None, "usage": {"tokens": None, "costUSD": None, "quality": "unknown", "evidenceHash": None},
            "followup": {"observedDays": None, "regressions": None, "evidenceHash": None},
            "reviewer": {"modelHash": None, "effort": "unknown", "sourceQuality": "unknown", "evidenceHash": None}}


def make_router_fixture(path, *, work="synthetic-work", completed=None):
    if Path(path).exists():
        fail("PILOT_SOURCE_ALREADY_EXISTS")
    completed = completed or now()
    with closing(sqlite3.connect(path)) as db:
        db.executescript("""
          CREATE TABLE operations (operation_id TEXT PRIMARY KEY, work_id TEXT, input_digest TEXT, created_at TEXT,
          dispatch_started_at TEXT, acknowledged_at TEXT, completed_at TEXT, action_json TEXT);
          CREATE TABLE results (operation_id TEXT PRIMARY KEY, outcome_json TEXT, result_digest TEXT);
          PRAGMA user_version=2;
        """)
        db.execute("INSERT INTO operations VALUES (?,?,?,?,?,?,?,?)", ("op-synthetic-review", work, digest("input"), completed,
            completed, completed, completed, canonical({"kind": "LIFECYCLE", "command": "step-review", "input": {"session": "ses_PRIVATE_SENTINEL", "text": "PRIVATE_TRANSCRIPT_SENTINEL"}})))
        db.execute("INSERT INTO results VALUES (?,?,?)", ("op-synthetic-review", canonical({"execution": "COMPLETED", "response": {"text": "PRIVATE_RESULT_SENTINEL", "password": "PRIVATE_SECRET_SENTINEL"}}), digest("synthetic-result")))
        db.commit()


def run_pilot(path):
    path = Path(path)
    if not path.is_absolute() or path.exists():
        fail("PILOT_REQUIRES_NEW_ABSOLUTE_LEDGER")
    ledger = Ledger(path)
    try:
        c = sample_contract()
        assert ledger.init_study(c)["active"] is False
        assert ledger.assign(sample_assignment())["reason"] == "DISABLED"
        ledger.control({"studyId": c["studyId"], "approvalRef": digest("synthetic-pilot-activation")}, "activate")
        assigned = [ledger.assign(sample_assignment(i)) for i in range(8)]
        assert len({a["unitId"] for a in assigned}) == 8
        assert sum(a["arm"] == "A" for a in assigned) == 4
        assert ledger.assign(sample_assignment(0))["unitId"] == assigned[0]["unitId"]
        for i, a in enumerate(assigned[:7]):
            obs = sample_observation(a, i)
            if i >= 4:
                obs.update(state={4: "failed", 5: "aborted", 6: "pending"}[i], actualVariant="not_run",
                           independentEvaluation=False, evaluationBlinded=None, evaluatorRef=None,
                           evaluationEvidenceHash=None, findings=[], deviations=["interrupted"])
            ledger.observe(obs)
        with tempfile.TemporaryDirectory(prefix="experiment-router-fixture-", dir=path.parent) as temporary:
            router = Path(temporary) / "router-fixture.sqlite"
            make_router_fixture(router)
            before = router.read_bytes()
            ledger.link_operation(c["studyId"], assigned[0]["unitId"], router, "op-synthetic-review")
            assert before == router.read_bytes()
        ledger.control({"studyId": c["studyId"], "approvalRef": digest("synthetic-pilot-complete")}, "stop")
        report = ledger.report(c["studyId"])
        assert report["assignedUnits"] == 8
        assert sum(a["noOutcome"] for a in report["arms"].values()) == 1
        assert sum(a["independentlyEvaluated"] for a in report["arms"].values()) == 4
        assert sum(a["failed"] for a in report["arms"].values()) == 1
        assert sum(a["aborted"] for a in report["arms"].values()) == 1
        exported = canonical(ledger.export(c["studyId"]))
        assert "PRIVATE_" not in exported and "synthetic-work" not in exported and "op-synthetic-review" not in exported
        return {"technicalPilot": "PASS", "syntheticUnits": 8, "liveStudiesActivated": 0, "routerBytesUnchanged": True,
                "active": False, "reviewerEfficacyEstablished": False, "report": report}
    finally:
        ledger.close()
