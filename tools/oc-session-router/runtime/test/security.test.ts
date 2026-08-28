import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { _test } from "../src/cli.js";
import { parseFollowOnRunRequest, parseRunRequest, parseStageRequest, parseStrictJson } from "../src/contracts.js";
import { StateStore } from "../src/state-store.js";

test("closed request schemas reject authority injection", () => {
  assert.throws(() => parseRunRequest({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a", server: "http://attacker" }), /unknown fields/);
  assert.throws(() => parseFollowOnRunRequest({ schema_version: "follow-on-run-request.v1", predecessor_run_id: "run-1", delivery_operation_id: "op-1", finding_ids: ["FORGED"] }), /unknown fields/);
  const base = {
    schema_version: "stage-request.v1", request_id: "request-1", run_id: "run-1", issued_at: "2026-08-10T00:00:00Z", issued_by: "o",
    run_authority_sha256: "a".repeat(64), requested_stage: "IMPLEMENT", plan_class: "EPIC_PLAN", target_id: "fal", worktree_identity: "git:a",
    state_revision: "s", state_sha256: "b".repeat(64), combined_selector: "HEADING:X", combined_span_sha256: "c".repeat(64), expected_sources: [],
    wave: "W", epic: "E", accountable_lane: "Track D", accountable_class: "TRACK", accountable_profile: "track-d", sender_role: "Track D",
    recipient_role: "Meta", plan_identity: "plan", candidate_identity: "candidate", review_cycle: "0", finding_ids: [], review_risk: "normal",
    project_review_context: "fal", expected_contract_version: "awc-3.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND",
    configuration_identity: "config", active_route_generation: "UNDECLARED",
  };
  assert.doesNotThrow(() => parseStageRequest(base));
  assert.throws(() => parseStageRequest({ ...base, session_id: "forged" }), /unknown fields/);
  assert.throws(() => parseStageRequest({ ...base, expected_sources: [{ path: "../escape", source_class: "REVISED_PLAN", logical_identity: "x", producer: "x", sha256: "d".repeat(64), order: 0 }] }), /safe relative path/);
});

test("strict JSON rejects duplicate members at every depth", () => {
  assert.throws(() => parseStrictJson('{"target_id":"fal","target_id":"other"}'), /Duplicate JSON member/);
  assert.throws(() => parseStrictJson('{"outer":{"sha256":"a","sha256":"b"}}'), /Duplicate JSON member/);
  assert.deepEqual(parseStrictJson('{"a":[1,true,null,"x"]}'), { a: [1, true, null, "x"] });
});

test("FSR-023: Active Route uses a bounded closed schema and opaque generation", () => {
  const base = {
    schema_version: "1", contract: "agent-workflow-active-route/v1", created_utc: "2026-08-12T00:00:00.000Z", project_id: "fal", profile_id: "track-d",
    workflow_phase: "STEP_REVIEW", state: { path: "ops/PROJECT_STATE.md", sha256: "a".repeat(64), state_revision: "state-1" },
    combined: { path: "ops/Combined.md", selector: "HEADING:Current", sha256: "b".repeat(64), wave_id: "W", epic_id: "E" },
    stage: { path: "evidence/result.md", sha256: "c".repeat(64), logical_identity: "result-1" }, candidate_identity: "candidate-1",
    configuration_identity: "config-1", worktree_identity: "git:abc", next_actor: "Meta", next_command: "/step-review",
    route_input: { mode: "PINNED_ARTIFACT", path: "evidence/result.md", sha256: "c".repeat(64), logical_identity: "result-1" },
  };
  const valid = JSON.stringify({ ...base, generation_id: _test.activeRouteGeneration(base as never) });
  const parsed = _test.parseActiveRoute(valid);
  assert.match(parsed.generation_id, /^[a-f0-9]{64}$/);
  const expected = { targetId: "fal", profileId: "track-d", workflowPhase: "STEP_REVIEW", statePath: "ops/PROJECT_STATE.md", stateRevision: "state-1", stateSha256: "a".repeat(64), combinedPath: "ops/Combined.md", combinedSelector: "HEADING:Current", combinedSha256: "b".repeat(64), wave: "W", epic: "E", stagePath: "evidence/result.md", stageSha256: "c".repeat(64), stageIdentity: "result-1", candidateIdentity: "candidate-1", configurationIdentity: "config-1", worktreeIdentity: "git:abc", nextActor: "Meta", nextCommand: "/step-review" };
  assert.doesNotThrow(() => _test.assertActiveRouteBinding(parsed, expected));
  const changedRoute = { ...base, route_input: { ...base.route_input, path: "evidence/other.md" }, generation_id: "" };
  changedRoute.generation_id = _test.activeRouteGeneration(changedRoute as never);
  assert.throws(() => _test.assertActiveRouteBinding(_test.parseActiveRoute(JSON.stringify(changedRoute)), expected), /binding mismatch/);
  assert.throws(() => _test.parseActiveRoute(valid.replace(_test.activeRouteGeneration(base as never), "d".repeat(64))), /generation mismatch/);
  assert.throws(() => _test.parseActiveRoute(valid.replace("candidate-1", "sk-abcdefghijklmnop")), /private registry sentinel/);
  const sessionIdentity = { ...base, candidate_identity: "ses_private", generation_id: "" };
  sessionIdentity.generation_id = _test.activeRouteGeneration(sessionIdentity as never);
  assert.throws(() => _test.parseActiveRoute(JSON.stringify(sessionIdentity)), /private registry sentinel/);
  for (const delimiter of ["-", ".", "@", ":", "+", "~"]) {
    const delimited = { ...base, candidate_identity: `candidate${delimiter}ses_private`, generation_id: "" };
    delimited.generation_id = _test.activeRouteGeneration(delimited as never);
    assert.throws(() => _test.parseActiveRoute(JSON.stringify(delimited)), /private registry sentinel/);
  }
  const bareSuffix = { ...base, candidate_identity: "candidate-ses_", generation_id: "" };
  bareSuffix.generation_id = _test.activeRouteGeneration(bareSuffix as never);
  assert.throws(() => _test.parseActiveRoute(JSON.stringify(bareSuffix)), /private registry sentinel/);
  const exactEmpty = { ...base, route_input: { mode: "EXACT_EMPTY" }, generation_id: "" };
  exactEmpty.generation_id = _test.activeRouteGeneration(exactEmpty as never);
  assert.throws(() => _test.parseActiveRoute(JSON.stringify(exactEmpty)), /EXACT_EMPTY is disabled/);
  const none = { ...base, next_command: "NONE", route_input: { mode: "NOT_APPLICABLE" }, generation_id: "" };
  none.generation_id = _test.activeRouteGeneration(none as never);
  assert.doesNotThrow(() => _test.parseActiveRoute(JSON.stringify(none)));
  const wrongNone = { ...base, next_command: "NONE", generation_id: "" };
  wrongNone.generation_id = _test.activeRouteGeneration(wrongNone as never);
  assert.throws(() => _test.parseActiveRoute(JSON.stringify(wrongNone)), /command and route input mismatch/);
  assert.throws(() => _test.parseActiveRoute(JSON.stringify({ generation_id: "generation-1", state: { sha256: "a".repeat(64) }, combined: { sha256: "b".repeat(64) } })), /schema mismatch/);
  assert.throws(() => _test.parseActiveRoute(valid.replace("}", ',"unknown":true}')), /schema mismatch/);
  assert.throws(() => _test.parseActiveRoute(valid.replace('"schema_version":"1"', '"schema_version":"1","schema_version":"1"')), /Duplicate JSON member/);
  assert.throws(() => _test.parseActiveRoute(`${valid}${" ".repeat(64 * 1024)}`), /byte limit/);
});

test("FSR-024: all-session exact and encoded private values fail closed", () => {
  const sentinel = "session-unselected-private";
  for (const variant of [sentinel, encodeURI(sentinel), encodeURIComponent(sentinel), Buffer.from(sentinel).toString("base64")]) {
    assert.throws(() => _test.assertArtifactPrivate(JSON.stringify({ generation: variant }), [sentinel]), /private registry sentinel/);
  }
});

test("CLI rejects endpoint and session overrides", () => {
  assert.throws(() => _test.validateOperationArguments("invoke-stage", new Map([["--request", "r.json"], ["--server", "http://attacker"]])), /not allowed/);
  assert.throws(() => _test.validateOperationArguments("new-run", new Map([["--request", "r.json"], ["--session", "foreign"]])), /not allowed/);
  assert.throws(() => _test.validateOperationArguments("new-follow-on-run", new Map([["--request", "r.json"], ["--review-cycle", "99"]])), /not allowed/);
  assert.throws(() => _test.validateOperationArguments("install-closeout-authority", new Map([["--request", "r.json"], ["--target-root", "foreign"]])), /not allowed/);
});

test("runtime root must be pre-created and contained", () => {
  const parent = mkdtempSync(path.join(tmpdir(), "fal-router-security-"));
  try {
    assert.throws(() => new StateStore(path.join(parent, "missing")), /pre-created/);
    const store = new StateStore(parent);
    assert.throws(() => store.resolve("safe", "..", "..", "escape"), /escapes/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
