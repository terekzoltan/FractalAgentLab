"""Optional offline workflow measurement. No dispatch, acceptance or router writes."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import secrets
import sqlite3
import sys
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path

APP_ID = 0x46574558
SCHEMA = 1
MAX_REQUEST_BYTES = 65536
TASKS = {"documentation", "code", "tests", "configuration", "workflow"}
EFFORTS = {"unknown", "low", "medium", "high", "xhigh", "max", "ultra"}
DEVIATIONS = {"extra_omitted", "treatment_changed", "version_drift", "evaluation_unblinded",
              "carryover", "interrupted", "missing_evidence", "budget_stop", "correction"}


class ExperimentError(ValueError):
    """Bounded code-only diagnostics; never echo submitted content or DB paths."""


def fail(code):
    raise ExperimentError(code)


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def exact(obj, names):
    if not isinstance(obj, dict) or set(obj) != set(names.split()):
        fail("INVALID_FIELDS")


def text(value, maximum=2000):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum or "\x00" in value:
        fail("INVALID_TEXT")
    return value


def ident(value):
    text(value, 160)
    if not all(c.isascii() and (c.isalnum() or c in "-_.:/") for c in value):
        fail("INVALID_IDENTIFIER")
    return value


def sha(value):
    if not isinstance(value, str) or len(value) != 64 or any(c not in "0123456789abcdef" for c in value):
        fail("INVALID_SHA256")
    return value


def enum(value, allowed):
    if not isinstance(value, (str, type(None))) or value not in allowed:
        fail("INVALID_ENUM")
    return value


def integer(value, low, high):
    if type(value) is not int or not low <= value <= high:
        fail("INVALID_INTEGER")


def timestamp(value):
    try:
        if not isinstance(value, str) or not value.endswith("Z") or "T" not in value:
            fail("INVALID_TIMESTAMP")
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo != timezone.utc:
            fail("INVALID_TIMESTAMP")
        return parsed
    except (ValueError, TypeError):
        fail("INVALID_TIMESTAMP")


def versions(value):
    exact(value, "workflow model prompt")
    for item in value.values():
        sha(item)


def contract(value):
    exact(value, "schemaVersion studyId mode question variants mandatoryChecks allowedWorkIds eligibleTaskTypes eligibleRisks strata primaryOutcome maxUnits followupDays stopRule expiresAt budget evaluationRule ownerApprovalRef versions")
    if type(value["schemaVersion"]) is not int or value["schemaVersion"] != SCHEMA:
        fail("UNSUPPORTED_SCHEMA")
    ident(value["studyId"])
    enum(value["mode"], {"synthetic", "live"})
    for key in ("question", "stopRule", "budget", "evaluationRule"):
        text(value[key])
    exact(value["variants"], "A B")
    for desc in value["variants"].values():
        text(desc)
    if not isinstance(value["mandatoryChecks"], list) or not 1 <= len(value["mandatoryChecks"]) <= 30:
        fail("MANDATORY_CHECKS_REQUIRED")
    for check in value["mandatoryChecks"]:
        text(check, 300)
    if not isinstance(value["allowedWorkIds"], list) or not 1 <= len(value["allowedWorkIds"]) <= 1000:
        fail("WORK_SCOPE_REQUIRED")
    for work in value["allowedWorkIds"]:
        ident(work)
    if len(set(value["allowedWorkIds"])) != len(value["allowedWorkIds"]):
        fail("DUPLICATE_WORK_SCOPE")
    for key, allowed in (("eligibleTaskTypes", TASKS), ("eligibleRisks", {"low"})):
        if not isinstance(value[key], list) or not value[key]:
            fail("INVALID_ELIGIBILITY")
        for item in value[key]:
            enum(item, allowed)
        if len(set(value[key])) != len(value[key]):
            fail("INVALID_ELIGIBILITY")
    if not isinstance(value["strata"], list) or not 1 <= len(value["strata"]) <= 20:
        fail("INVALID_STRATA")
    ids = set()
    for item in value["strata"]:
        exact(item, "id taskType risk difficulty")
        ident(item["id"])
        if item["id"] in ids:
            fail("DUPLICATE_STRATUM")
        ids.add(item["id"])
        enum(item["taskType"], value["eligibleTaskTypes"])
        enum(item["risk"], value["eligibleRisks"])
        enum(item["difficulty"], {"small", "medium", "large"})
    enum(value["primaryOutcome"], {"verified_material_findings"})
    integer(value["maxUnits"], 2, 10000)
    integer(value["followupDays"], 1, 365)
    timestamp(value["expiresAt"])
    sha(value["ownerApprovalRef"])
    versions(value["versions"])
    return value


def load_request(file):
    try:
        with Path(file).open("rb") as reader:
            data = reader.read(MAX_REQUEST_BYTES + 1)
        if len(data) > MAX_REQUEST_BYTES:
            fail("REQUEST_TOO_LARGE")
        def no_duplicates(pairs):
            result = {}
            for key, item in pairs:
                if key in result:
                    fail("DUPLICATE_JSON_KEY")
                result[key] = item
            return result
        return json.loads(data.decode("utf-8-sig"), parse_constant=lambda _: fail("NONFINITE_NUMBER"), object_pairs_hook=no_duplicates)
    except (OSError, UnicodeError, json.JSONDecodeError):
        fail("REQUEST_UNREADABLE")


class Ledger:
    def __init__(self, file, *, readonly=False):
        self.path = Path(file)
        if not self.path.is_absolute():
            fail("ABSOLUTE_LEDGER_REQUIRED")
        for part in (self.path, *self.path.parents):
            if part.is_symlink() or part.is_junction():
                fail("SYMLINK_PATH_REJECTED")
        if readonly and not self.path.is_file():
            fail("LEDGER_NOT_FOUND")
        # Inspect existing databases read-only before any journal/schema write.
        if self.path.exists() and self.path.stat().st_size:
            with closing(sqlite3.connect(self.path.as_uri() + "?mode=ro", uri=True)) as check:
                if check.execute("PRAGMA application_id").fetchone()[0] != APP_ID:
                    fail("NOT_EXPERIMENT_LEDGER")
                if check.execute("PRAGMA user_version").fetchone()[0] != SCHEMA:
                    fail("UNSUPPORTED_SCHEMA")
        self.db = sqlite3.connect(self.path.as_uri() + ("?mode=ro" if readonly else "?mode=rwc"), uri=True, timeout=3)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        try:
            if readonly:
                self.db.execute("PRAGMA query_only=ON")
            else:
                self._init()
        except BaseException:
            self.db.close()
            raise

    def _init(self):
        tables = {r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if tables and "meta" not in tables:
            fail("NOT_EXPERIMENT_LEDGER")
        self.db.executescript("""
          CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS studies (id TEXT PRIMARY KEY, contract_json TEXT NOT NULL, digest TEXT NOT NULL, created TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS controls (id INTEGER PRIMARY KEY, study TEXT NOT NULL REFERENCES studies(id), action TEXT NOT NULL, approval TEXT NOT NULL, created TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS blocks (study TEXT NOT NULL, stratum TEXT NOT NULL, idx INTEGER NOT NULL, sequence TEXT NOT NULL, PRIMARY KEY(study,stratum,idx));
          CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, study TEXT NOT NULL REFERENCES studies(id), work_ref TEXT NOT NULL, cycle_ref TEXT NOT NULL, stratum TEXT NOT NULL, arm TEXT NOT NULL, request_json TEXT NOT NULL, request_digest TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(study,work_ref,cycle_ref));
          CREATE TABLE IF NOT EXISTS observations (id INTEGER PRIMARY KEY, unit TEXT NOT NULL REFERENCES units(id), event_key TEXT NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(unit,event_key));
          CREATE TABLE IF NOT EXISTS operation_links (id INTEGER PRIMARY KEY, unit TEXT NOT NULL REFERENCES units(id), operation_ref TEXT NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(unit,digest));
          CREATE TABLE IF NOT EXISTS omissions (id INTEGER PRIMARY KEY, study TEXT NOT NULL REFERENCES studies(id), request_ref TEXT NOT NULL, reason TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(study,request_ref,reason));
        """)
        self.db.execute("INSERT OR IGNORE INTO meta VALUES ('salt',?)", (secrets.token_hex(32),))
        for table in ("studies", "controls", "blocks", "units", "observations", "operation_links", "omissions", "meta"):
            for action in ("UPDATE", "DELETE"):
                self.db.execute(f"CREATE TRIGGER IF NOT EXISTS immutable_{table}_{action} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END")
        self.db.execute(f"PRAGMA application_id={APP_ID}")
        self.db.execute(f"PRAGMA user_version={SCHEMA}")
        self.db.commit()
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")

    def close(self):
        self.db.close()

    def ref(self, value):
        salt = self.db.execute("SELECT value FROM meta WHERE key='salt'").fetchone()[0]
        return digest([salt, value])

    @contextmanager
    def transaction(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.commit()
        except BaseException:
            self.db.rollback()
            raise

    def study(self, study_id):
        row = self.db.execute("SELECT * FROM studies WHERE id=?", (ident(study_id),)).fetchone()
        if not row:
            fail("STUDY_NOT_FOUND")
        return json.loads(row["contract_json"]), row

    def init_study(self, value):
        contract(value)
        with self.transaction():
            prior = self.db.execute("SELECT digest FROM studies WHERE id=?", (value["studyId"],)).fetchone()
            if prior and prior[0] != digest(value):
                fail("CONTRACT_IMMUTABLE")
            self.db.execute("INSERT OR IGNORE INTO studies VALUES (?,?,?,?)", (value["studyId"], canonical(value), digest(value), now()))
        return {"status": "REGISTERED", "studyDigest": digest(value), "active": self.active(value["studyId"]), "dispatch": False}

    def active(self, study_id):
        row = self.db.execute("SELECT action FROM controls WHERE study=? ORDER BY id DESC LIMIT 1", (study_id,)).fetchone()
        return bool(row and row[0] == "activate")

    def control(self, value, action, *, allow_live=False):
        exact(value, "studyId approvalRef")
        sha(value["approvalRef"])
        with self.transaction():
            c, _ = self.study(value["studyId"])
            if action == "activate":
                if c["mode"] == "live" and not allow_live:
                    fail("EXPLICIT_LIVE_ACTIVATION_REQUIRED")
                if timestamp(c["expiresAt"]) <= timestamp(now()):
                    fail("STUDY_EXPIRED")
                if self.db.execute("SELECT 1 FROM controls WHERE study=? AND action='stop'", (c["studyId"],)).fetchone():
                    fail("STOPPED_STUDY_IMMUTABLE")
            prior = self.db.execute("SELECT action,approval FROM controls WHERE study=? ORDER BY id DESC LIMIT 1", (c["studyId"],)).fetchone()
            if not prior or tuple(prior) != (action, value["approvalRef"]):
                self.db.execute("INSERT INTO controls(study,action,approval,created) VALUES (?,?,?,?)", (c["studyId"], action, value["approvalRef"], now()))
        return {"active": self.active(c["studyId"]), "mode": c["mode"], "dispatch": False}

    def assign(self, value):
        exact(value, "studyId workId candidateDigest reviewCycle stratumId taskType risk difficulty versions carryover eligibilityEvidenceHash preOutcome")
        for key in ("studyId", "workId", "reviewCycle", "stratumId"):
            ident(value[key])
        sha(value["candidateDigest"])
        sha(value["eligibilityEvidenceHash"])
        versions(value["versions"])
        enum(value["carryover"], {"none", "possible", "known", "unknown"})
        if value["preOutcome"] is not True:
            fail("PRE_OUTCOME_ASSIGNMENT_REQUIRED")
        with self.transaction():
            c, _ = self.study(value["studyId"])
            work_ref, cycle_ref = self.ref(value["workId"]), self.ref(value["reviewCycle"])
            unit = self.ref([c["studyId"], value["workId"], value["reviewCycle"]])
            prior = self.db.execute("SELECT * FROM units WHERE id=?", (unit,)).fetchone()
            request = {**value, "studyId": self.ref(value["studyId"]), "workId": work_ref, "reviewCycle": cycle_ref, "stratumId": self.ref(value["stratumId"])}
            if prior:
                if prior["request_digest"] != digest(request):
                    fail("ASSIGNMENT_IMMUTABLE_USE_ORIGINAL_IDENTITY")
                return {"status": "ASSIGNED", "unitId": unit, "arm": prior["arm"], "reused": True, "experimentalExtraAllowed": prior["arm"] == "B" and self.active(c["studyId"]) and timestamp(c["expiresAt"]) > timestamp(now()), "dispatch": False}
            if not self.active(c["studyId"]):
                return {"status": "SKIPPED", "reason": "DISABLED", "arm": "baseline", "experimentalExtraAllowed": False, "dispatch": False}
            if timestamp(c["expiresAt"]) <= timestamp(now()):
                return self.omit(c["studyId"], request, "EXPIRED")
            if value["workId"] not in c["allowedWorkIds"]:
                return self.omit(c["studyId"], request, "WORK_NOT_AUTHORIZED_FOR_STUDY")
            self.check_candidate_alias(c["studyId"], work_ref, value["candidateDigest"], unit)
            stratum = next((s for s in c["strata"] if s["id"] == value["stratumId"]), None)
            if not stratum or any(value[k] != stratum[k] for k in ("taskType", "risk", "difficulty")):
                return self.omit(c["studyId"], request, "NOT_ELIGIBLE")
            if value["versions"] != c["versions"]:
                return self.omit(c["studyId"], request, "VERSION_DRIFT")
            count = self.db.execute("SELECT COUNT(*) FROM units WHERE study=?", (c["studyId"],)).fetchone()[0]
            if count >= c["maxUnits"]:
                return self.omit(c["studyId"], request, "SAMPLE_CAP")
            stratum_ref = self.ref(stratum["id"])
            count = self.db.execute("SELECT COUNT(*) FROM units WHERE study=? AND stratum=?", (c["studyId"], stratum_ref)).fetchone()[0]
            block, offset = divmod(count, 4)
            saved = self.db.execute("SELECT sequence FROM blocks WHERE study=? AND stratum=? AND idx=?", (c["studyId"], stratum_ref, block)).fetchone()
            if saved:
                sequence = saved[0]
            else:
                arms = list("AABB")
                secrets.SystemRandom().shuffle(arms)
                sequence = "".join(arms)
                self.db.execute("INSERT INTO blocks VALUES (?,?,?,?)", (c["studyId"], stratum_ref, block, sequence))
            arm = sequence[offset]
            self.db.execute("INSERT INTO units VALUES (?,?,?,?,?,?,?,?,?)", (unit, c["studyId"], work_ref, cycle_ref, stratum_ref, arm, canonical(request), digest(request), now()))
        return {"status": "ASSIGNED", "unitId": unit, "arm": arm, "reused": False, "experimentalExtraAllowed": arm == "B", "dispatch": False}

    def omit(self, study_id, request, reason):
        receipt = self.ref(request)
        self.db.execute("INSERT OR IGNORE INTO omissions(study,request_ref,reason,created) VALUES (?,?,?,?)", (study_id, receipt, reason, now()))
        return {"status": "SKIPPED", "reason": reason, "omissionRef": receipt, "arm": "baseline", "experimentalExtraAllowed": False, "dispatch": False}

    def check_candidate_alias(self, study_id, work_ref, candidate, unit):
        collision = self.db.execute("""SELECT 1 FROM units u LEFT JOIN observations o ON o.unit=u.id
            WHERE u.study=? AND u.work_ref=? AND u.id<>? AND
            (json_extract(u.request_json,'$.candidateDigest')=? OR json_extract(o.payload,'$.currentCandidateDigest')=?) LIMIT 1""",
            (study_id, work_ref, unit, candidate, candidate)).fetchone()
        if collision:
            fail("CANDIDATE_ALREADY_BOUND_USE_ORIGINAL_REVIEW_FAMILY")

    def unit(self, unit_id):
        sha(unit_id)
        row = self.db.execute("SELECT * FROM units WHERE id=?", (unit_id,)).fetchone()
        if not row:
            fail("UNIT_NOT_FOUND")
        return row

    def observe(self, value):
        validate_observation(value)
        with self.transaction():
            unit = self.unit(value["unitId"])
            self.check_candidate_alias(unit["study"], unit["work_ref"], value["currentCandidateDigest"], unit["id"])
            original_candidate = json.loads(unit["request_json"])["candidateDigest"]
            if value["currentCandidateDigest"] != original_candidate and not value["candidateLineageEvidenceHash"]:
                fail("REPAIRED_CANDIDATE_LINEAGE_REQUIRED")
            event_key = self.ref(value["observationKey"])
            payload = {**value, "observationKey": event_key}
            prior = self.db.execute("SELECT digest FROM observations WHERE unit=? AND event_key=?", (unit["id"], event_key)).fetchone()
            if prior:
                if prior[0] != digest(payload):
                    fail("OBSERVATION_KEY_CONFLICT")
                return {"status": "RECORDED", "observationDigest": prior[0], "reused": True}
            latest = self.db.execute("SELECT digest,payload FROM observations WHERE unit=? ORDER BY id DESC LIMIT 1", (unit["id"],)).fetchone()
            if value["supersedes"] != (latest["digest"] if latest else None):
                fail("OBSERVATION_PREDECESSOR_REQUIRED")
            if latest and json.loads(latest["payload"])["state"] != "pending" and "correction" not in value["deviations"]:
                fail("EXPLICIT_CORRECTION_REQUIRED")
            self.db.execute("INSERT INTO observations(unit,event_key,payload,digest,created) VALUES (?,?,?,?,?)", (unit["id"], event_key, canonical(payload), digest(payload), now()))
        return {"status": "RECORDED", "observationDigest": digest(payload), "reused": False}

    def link_operation(self, study_id, unit_id, router_db, operation_id):
        c, _ = self.study(study_id)
        unit = self.unit(unit_id)
        if unit["study"] != c["studyId"]:
            fail("UNIT_STUDY_MISMATCH")
        source = Path(router_db)
        if not source.is_absolute() or not source.is_file() or source.resolve() == self.path.resolve():
            fail("INVALID_ROUTER_SOURCE")
        ident(operation_id)
        with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=3)) as reader:
            reader.execute("PRAGMA query_only=ON")
            reader.execute("BEGIN")
            if reader.execute("PRAGMA user_version").fetchone()[0] not in (1, 2):
                fail("UNSUPPORTED_ROUTER_SCHEMA")
            row = reader.execute("""SELECT o.work_id,o.input_digest,o.created_at,o.dispatch_started_at,o.acknowledged_at,o.completed_at,
              json_extract(o.action_json,'$.kind'),json_extract(o.action_json,'$.command'),
              json_extract(r.outcome_json,'$.execution'),r.result_digest
              FROM operations o LEFT JOIN results r ON r.operation_id=o.operation_id WHERE o.operation_id=?""", (operation_id,)).fetchone()
        if not row:
            fail("OPERATION_NOT_FOUND")
        work, inp, created, sent, ack, completed, kind, command, execution, result = row
        if self.ref(work) != unit["work_ref"]:
            fail("OPERATION_WORK_MISMATCH")
        sha(inp)
        if result is not None:
            sha(result)
        enum(kind, {"LIFECYCLE", "CLARIFICATION", "COMPACT", "RESTORE", "ORCHESTRATOR_HANDOFF", "LEGACY", "RECOVERED_RESULT"})
        if command is not None:
            ident(command)
        enum(execution, {None, "COMPLETED", "FAILED", "PENDING", "PREPARED"})
        for item in (created, sent, ack, completed):
            if item is not None:
                timestamp(item)
        if completed and timestamp(completed) <= timestamp(unit["created"]):
            fail("OUTCOME_PRECEDES_ASSIGNMENT")
        payload = {"operationRef": self.ref(operation_id), "inputDigest": inp, "kind": kind,
                   "commandRef": self.ref(command) if command else None,
                   "delivery": "DELIVERED" if ack else "POSSIBLE" if sent else "NOT_SENT",
                   "execution": execution or ("PENDING" if sent else "PREPARED"), "resultDigest": result,
                   "createdAt": created, "completedAt": completed, "productAcceptance": "not_observed",
                   "sourceQuality": "router_observed", "reviewerModel": "not_observed", "usage": "not_observed"}
        with self.transaction():
            other = self.db.execute("SELECT 1 FROM operation_links WHERE operation_ref=? AND unit<>?", (payload["operationRef"], unit_id)).fetchone()
            if other:
                fail("OPERATION_ALREADY_BOUND_TO_OTHER_UNIT")
            self.db.execute("INSERT OR IGNORE INTO operation_links(unit,operation_ref,payload,digest,created) VALUES (?,?,?,?,?)", (unit_id, payload["operationRef"], canonical(payload), digest(payload), now()))
        return {"status": "LINKED", "facts": payload, "factsDigest": digest(payload)}

    def export(self, study_id):
        c, study = self.study(study_id)
        units = []
        for row in self.db.execute("SELECT * FROM units WHERE study=? ORDER BY created,id", (study_id,)):
            observations = [{"digest": r["digest"], "recordedAt": r["created"], "value": json.loads(r["payload"])} for r in self.db.execute("SELECT * FROM observations WHERE unit=? ORDER BY id", (row["id"],))]
            links = [json.loads(r["payload"]) for r in self.db.execute("SELECT * FROM operation_links WHERE unit=? ORDER BY id", (row["id"],))]
            units.append({"unitId": row["id"], "arm": row["arm"], "stratumRef": row["stratum"], "assignedAt": row["created"], "preOutcome": json.loads(row["request_json"]), "observations": observations, "operationFacts": links})
        return {"schemaVersion": SCHEMA, "studyRef": self.ref(study_id), "studyDigest": study["digest"], "mode": c["mode"], "active": self.active(study_id),
                "primaryOutcome": c["primaryOutcome"], "maxUnits": c["maxUnits"], "followupDays": c["followupDays"], "expiresAt": c["expiresAt"], "versions": c["versions"],
                "units": units, "omissions": [{"requestRef": r["request_ref"], "reason": r["reason"], "recordedAt": r["created"]} for r in self.db.execute("SELECT * FROM omissions WHERE study=? ORDER BY id", (study_id,))],
                "privacy": "Allowlisted typed facts and salted references; no contract prose, source output, session IDs or credentials.",
                "authority": "Measurement only; no product acceptance, dispatch or routing change."}

    def report(self, study_id):
        exported = self.export(study_id)
        c, _ = self.study(study_id)
        arms = {arm: aggregate(exported["units"], arm, c) for arm in "AB"}
        strata = {s: {arm: aggregate([u for u in exported["units"] if u["stratumRef"] == s], arm, c) for arm in "AB"} for s in sorted({u["stratumRef"] for u in exported["units"]})}
        omissions = {}
        for item in exported["omissions"]:
            omissions[item["reason"]] = omissions.get(item["reason"], 0) + 1
        return {"schemaVersion": SCHEMA, "studyRef": exported["studyRef"], "studyDigest": exported["studyDigest"], "mode": c["mode"], "active": exported["active"],
                "assignedUnits": len(exported["units"]), "arms": arms, "strata": strata, "preAssignmentOmissions": omissions,
                "uncertainty": "Descriptive evidence only. Small/missing/deviating samples, version drift, persistent-session carryover and unequal follow-up limit causal interpretation. No significance test, automatic winner or pooled causal estimate.",
                "causalConclusion": "NOT_ESTABLISHED", "automaticRoutingChange": False}


def validate_observation(v):
    exact(v, "unitId observationKey supersedes currentCandidateDigest candidateLineageEvidenceHash state actualVariant versions deviations carryover independentEvaluation evaluationBlinded evaluatorRef evaluationEvidenceHash findings elapsedSeconds usage followup reviewer")
    sha(v["unitId"])
    sha(v["currentCandidateDigest"])
    if v["candidateLineageEvidenceHash"] is not None:
        sha(v["candidateLineageEvidenceHash"])
    ident(v["observationKey"])
    if v["supersedes"] is not None:
        sha(v["supersedes"])
    enum(v["state"], {"pending", "completed", "failed", "aborted"})
    enum(v["actualVariant"], {"A", "B", "baseline", "not_run", "unknown"})
    versions(v["versions"])
    if not isinstance(v["deviations"], list) or len(v["deviations"]) > len(DEVIATIONS):
        fail("INVALID_DEVIATIONS")
    for d in v["deviations"]:
        enum(d, DEVIATIONS)
    enum(v["carryover"], {"none", "possible", "known", "unknown"})
    if type(v["independentEvaluation"]) is not bool or (v["evaluationBlinded"] is not None and type(v["evaluationBlinded"]) is not bool):
        fail("INVALID_EVALUATION")
    for key in ("evaluatorRef", "evaluationEvidenceHash"):
        if v[key] is not None:
            sha(v[key])
    if v["independentEvaluation"] and (not v["evaluatorRef"] or not v["evaluationEvidenceHash"]):
        fail("EVALUATION_PROOF_REQUIRED")
    if not isinstance(v["findings"], list) or len(v["findings"]) > 100:
        fail("INVALID_FINDINGS")
    seen = set()
    for f in v["findings"]:
        exact(f, "findingHash disposition material")
        sha(f["findingHash"])
        if f["findingHash"] in seen:
            fail("DUPLICATE_FINDING")
        seen.add(f["findingHash"])
        enum(f["disposition"], {"accepted", "rejected", "unresolved"})
        if type(f["material"]) is not bool:
            fail("INVALID_FINDING")
    metric(v["elapsedSeconds"])
    exact(v["usage"], "tokens costUSD quality evidenceHash")
    quality = enum(v["usage"]["quality"], {"unknown", "provider_reported", "billed"})
    metric(v["usage"]["tokens"], whole=True)
    metric(v["usage"]["costUSD"])
    if v["usage"]["evidenceHash"] is not None:
        sha(v["usage"]["evidenceHash"])
    if quality == "unknown" and any(v["usage"][k] is not None for k in ("tokens", "costUSD", "evidenceHash")):
        fail("UNKNOWN_USAGE_MUST_BE_NULL")
    if quality != "unknown" and not v["usage"]["evidenceHash"]:
        fail("USAGE_EVIDENCE_REQUIRED")
    exact(v["followup"], "observedDays regressions evidenceHash")
    metric(v["followup"]["observedDays"], whole=True)
    metric(v["followup"]["regressions"], whole=True)
    if v["followup"]["evidenceHash"] is not None:
        sha(v["followup"]["evidenceHash"])
    if v["followup"]["regressions"] is not None and (v["followup"]["observedDays"] is None or v["followup"]["evidenceHash"] is None):
        fail("FOLLOWUP_EVIDENCE_REQUIRED")
    exact(v["reviewer"], "modelHash effort sourceQuality evidenceHash")
    if v["reviewer"]["modelHash"] is not None:
        sha(v["reviewer"]["modelHash"])
    enum(v["reviewer"]["effort"], EFFORTS)
    enum(v["reviewer"]["sourceQuality"], {"unknown", "reported", "observed"})
    if v["reviewer"]["evidenceHash"] is not None:
        sha(v["reviewer"]["evidenceHash"])
    if v["reviewer"]["sourceQuality"] == "unknown" and (v["reviewer"]["modelHash"] is not None or v["reviewer"]["effort"] != "unknown" or v["reviewer"]["evidenceHash"] is not None):
        fail("UNKNOWN_REVIEWER_MUST_BE_UNKNOWN")
    if v["reviewer"]["sourceQuality"] != "unknown" and not v["reviewer"]["evidenceHash"]:
        fail("REVIEWER_EVIDENCE_REQUIRED")


def metric(value, whole=False):
    if value is None:
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > 1e12 or (whole and type(value) is not int):
        fail("INVALID_METRIC")


def aggregate(units, arm, c):
    selected = [u for u in units if u["arm"] == arm]
    result = {"assigned": len(selected), "noOutcome": 0, "pending": 0, "completed": 0, "failed": 0, "aborted": 0,
              "independentlyEvaluated": 0, "materialAcceptedFindings": 0, "rejectedFindings": 0, "unresolvedFindings": 0,
              "deviatingUnits": 0, "versionDriftUnits": 0, "carryoverUnits": 0, "unblindedOrUnknownEvaluation": 0,
              "actualVariants": {}, "usageObservedUnits": 0, "costObservedUnits": 0, "elapsedObservedUnits": 0,
              "observedTokens": None, "observedCostUSD": None, "observedElapsedSeconds": None,
              "followupCompleteUnits": 0, "observedRegressions": None}
    for unit in selected:
        if not unit["observations"]:
            result["noOutcome"] += 1
            continue
        obs = unit["observations"][-1]["value"]
        result[obs["state"]] += 1
        actual = obs["actualVariant"]
        result["actualVariants"][actual] = result["actualVariants"].get(actual, 0) + 1
        result["versionDriftUnits"] += obs["versions"] != c["versions"]
        result["carryoverUnits"] += obs["carryover"] != "none" or unit["preOutcome"]["carryover"] != "none"
        result["deviatingUnits"] += bool(obs["deviations"]) or actual != arm
        result["unblindedOrUnknownEvaluation"] += obs["evaluationBlinded"] is not True
        if obs["independentEvaluation"] and obs["state"] != "pending":
            result["independentlyEvaluated"] += 1
            result["materialAcceptedFindings"] += sum(f["disposition"] == "accepted" and f["material"] for f in obs["findings"])
            result["rejectedFindings"] += sum(f["disposition"] == "rejected" for f in obs["findings"])
            result["unresolvedFindings"] += sum(f["disposition"] == "unresolved" for f in obs["findings"])
        for field, value, count in (("observedTokens", obs["usage"]["tokens"], "usageObservedUnits"), ("observedCostUSD", obs["usage"]["costUSD"], "costObservedUnits"), ("observedElapsedSeconds", obs["elapsedSeconds"], "elapsedObservedUnits")):
            if value is not None:
                result[field] = (result[field] or 0) + value
                result[count] += 1
        if obs["followup"]["regressions"] is not None and obs["followup"]["observedDays"] >= c["followupDays"]:
            result["followupCompleteUnits"] += 1
            result["observedRegressions"] = (result["observedRegressions"] or 0) + obs["followup"]["regressions"]
    result["primaryOutcomeMissingUnits"] = result["assigned"] - result["independentlyEvaluated"]
    result["followupMissingOrIncompleteUnits"] = result["assigned"] - result["followupCompleteUnits"]
    result["observedMeanMaterialFindings"] = result["materialAcceptedFindings"] / result["independentlyEvaluated"] if result["independentlyEvaluated"] else None
    result["meanDenominator"] = "independentlyEvaluated (complete cases); assigned denominator retained, missing outcomes are not zero"
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["init-study", "activate-study", "stop-study", "assign", "observe", "link-operation", "report", "export", "technical-pilot"])
    parser.add_argument("--ledger", required=True)
    parser.add_argument("--request")
    parser.add_argument("--study-id")
    parser.add_argument("--unit-id")
    parser.add_argument("--router-db")
    parser.add_argument("--operation-id")
    parser.add_argument("--allow-live", action="store_true")
    args = parser.parse_args(argv)
    ledger = None
    try:
        if args.action == "technical-pilot":
            from technical_pilot import run_pilot
            output = run_pilot(args.ledger)
        else:
            ledger = Ledger(args.ledger, readonly=args.action in {"report", "export"})
            if args.action in {"init-study", "assign", "observe", "activate-study", "stop-study"}:
                if not args.request:
                    fail("REQUEST_REQUIRED")
                value = load_request(args.request)
                if args.action == "init-study":
                    output = ledger.init_study(value)
                elif args.action == "assign":
                    output = ledger.assign(value)
                elif args.action == "observe":
                    output = ledger.observe(value)
                else:
                    output = ledger.control(value, "activate" if args.action == "activate-study" else "stop", allow_live=args.allow_live)
            elif args.action == "link-operation":
                if not all((args.study_id, args.unit_id, args.router_db, args.operation_id)):
                    fail("LINK_ARGUMENTS_REQUIRED")
                output = ledger.link_operation(args.study_id, args.unit_id, args.router_db, args.operation_id)
            elif args.action == "report":
                output = ledger.report(args.study_id)
            else:
                output = ledger.export(args.study_id)
        print(canonical(output))
        return 0
    except (ExperimentError, sqlite3.Error, OSError, TypeError, KeyError, RecursionError) as error:
        code = str(error) if isinstance(error, ExperimentError) else "MEASUREMENT_UNAVAILABLE"
        print(canonical({"status": "UNAVAILABLE", "reason": code, "experimentalExtraAllowed": False, "normalWorkflow": "CONTINUE_BASELINE", "dispatch": False}))
        return 2
    finally:
        if ledger:
            ledger.close()


if __name__ == "__main__":
    sys.exit(main())
