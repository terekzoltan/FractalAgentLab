import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunAuthority, StageInvocation } from "../src/contracts.js";
import { authoritySha256, sha256 } from "../src/contracts.js";
import { promotedSourcesForStage } from "../src/stage-engine.js";
import { StateStore } from "../src/state-store.js";

function makeAuthority(): RunAuthority {
  return {
    schema_version: "run-authority.v1",
    run_id: "run-1",
    created_at: "2026-08-10T00:00:00.000Z",
    target_id: "fal",
    target_identity: "FractalAgentLab",
    worktree_identity: "git:abc",
    wave: "W",
    epic: "E",
    accountable_lane: "Track D",
    accountable_class: "TRACK",
    accountable_profile: "track-d",
    target_profile_identity: "profile-v1",
    target_profile_sha256: "a".repeat(64),
    state_path: "ops/PROJECT_STATE.md",
    state_revision: "state-v1",
    state_sha256: "b".repeat(64),
    combined_path: "ops/Combined.md",
    combined_selector: "HEADING:Current",
    combined_span_sha256: "c".repeat(64),
    pinned_artifact_path: "plans/epic.md",
    pinned_artifact_identity: "plan-v1",
    pinned_artifact_sha256: "d".repeat(64),
    overlay_identity: "overlay-v1",
    accountable_role_identity: "track-d-v1",
    configuration_identity: "config-v1",
    active_route_generation: "UNDECLARED",
    review_cycle: "0",
    stage_source_manifest_path: "plans/stage-sources.json",
    stage_source_manifest_sha256: "e".repeat(64),
    next_command: "/terv-review",
  };
}

function makeInvocation(operationId: string, semanticKey = "semantic-1"): StageInvocation {
  return {
    schema_version: "stage-invocation.v1",
    request_id: "request-1",
    run_id: "run-1",
    issued_at: "2026-08-10T00:00:00.000Z",
    issued_by: "orchestrator",
    run_authority_sha256: "e".repeat(64),
    requested_stage: "PLAN_REVIEW",
    plan_class: "EPIC_PLAN",
    target_id: "fal",
    worktree_identity: "git:abc",
    state_revision: "state-v1",
    state_sha256: "b".repeat(64),
    combined_selector: "HEADING:Current",
    combined_span_sha256: "c".repeat(64),
    expected_sources: [],
    wave: "W",
    epic: "E",
    accountable_lane: "Track D",
    accountable_class: "TRACK",
    accountable_profile: "track-d",
    sender_role: "Track D",
    recipient_role: "Meta",
    plan_identity: "plan-v1",
    candidate_identity: "UNDECLARED",
    review_cycle: "0",
    finding_ids: [],
    review_risk: "normal",
    project_review_context: "fal",
    expected_contract_version: "awc-3.1",
    allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND",
    configuration_identity: "config-v1",
    active_route_generation: "UNDECLARED",
    operation_id: operationId,
    canon_phase: "PLAN_REVIEW",
    command_name: "terv-review",
    command_argument_sha256: "f".repeat(64),
    command_body_sha256: "f".repeat(64),
    semantic_key: semanticKey,
    recipient_session_sha256: "a".repeat(64),
  };
}

test("run and authority are immutable BOM-free files", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-state-"));
  try {
    const store = new StateStore(root);
    const authority = makeAuthority();
    store.createRun(authority, authoritySha256(authority));
    assert.deepEqual(store.loadRun("run-1").authority, authority);
    const bytes = readFileSync(path.join(root, "runs", "run-1", "run.json"));
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.throws(() => store.createRun(authority, authoritySha256(authority)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CAS, one nonterminal operation, and terminal immutability", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-cas-"));
  try {
    const store = new StateStore(root);
    const authority = makeAuthority();
    store.createRun(authority, authoritySha256(authority));
    const created = store.createOperation("run-1", makeInvocation("op-1"), { operation_id: "op-1" }, "1".repeat(64));
    assert.throws(() => store.createOperation("run-1", makeInvocation("op-2"), { operation_id: "op-2" }, "2".repeat(64)), /nonterminal|Equivalent/);
    const terminal = store.updateOperation("run-1", "op-1", created.revision, { status: "SUCCEEDED" });
    assert.throws(() => store.updateOperation("run-1", "op-1", created.revision, { status: "BLOCKED" }), /Stale/);
    assert.throws(() => store.updateOperation("run-1", "op-1", terminal.revision, { status: "BLOCKED" }), /immutable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("containment rejects traversal", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-path-"));
  try {
    const store = new StateStore(root);
    assert.throws(() => store.resolve("..", "escape"), /escapes/);
    assert.throws(() => store.loadRun("run:ads"), /filesystem-safe/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale run lock blocks operation creation and is never stolen", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-lock-"));
  try {
    const store = new StateStore(root);
    const authority = makeAuthority();
    store.createRun(authority, authoritySha256(authority));
    const lockPath = path.join(root, "runs", "run-1", "operation-create.lock");
    writeFileSync(lockPath, "stale but not stealable\n");
    assert.throws(() => store.createOperation("run-1", makeInvocation("op-1"), {}, "1".repeat(64)), /exist|EEXIST/i);
    assert.equal(readFileSync(lockPath, "utf8"), "stale but not stealable\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("filesystem-bound operation and artifact IDs reject Windows ADS forms", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-ads-"));
  try {
    const store = new StateStore(root);
    const authority = makeAuthority();
    store.createRun(authority, authoritySha256(authority));
    const operation = store.createOperation("run-1", makeInvocation("op-1"), {}, "1".repeat(64));
    assert.throws(() => store.loadOperation("run-1", "op:ads"), /filesystem-safe/);
    assert.throws(() => store.writeArtifact("run-1", operation.operation_id, "terminal:ads", "x"), /filesystem-safe/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validated SEQ_NEXT output becomes an exact append-only PLAN source for the next stage", () => {
  const root = mkdtempSync(path.join(tmpdir(), "router-promoted-source-"));
  try {
    const store = new StateStore(root);
    const authority = { ...makeAuthority(), run_id: "run-promote-1", next_command: "/seq-next" };
    store.createRun(authority, authoritySha256(authority));
    const invocation = { ...makeInvocation("op-promote-1"), run_id: authority.run_id, requested_stage: "SEQ_NEXT" as const, canon_phase: "SEQ_NEXT" as const, command_name: "seq-next", plan_identity: "plan-promoted" };
    const operation = store.createOperation(authority.run_id, invocation, { schema_version: "dispatch-intent.v1" }, sha256("intent"));
    const terminal = [
      "EPIC IMPLEMENTATION PLAN", "Target: FractalAgentLab", "Epic: E", "Wave: W", "Accountable Lane / class / profile: Track D / TRACK / track-d",
      "Prerequisites/current state: ready", "Scope/non-goals: bounded", "Interfaces/ownership: Track D", "Feature -> User Story -> Task: F -> US -> T",
      "Risks: none", "Ordered implementation plan: T", "Acceptance -> verification -> evidence: AC -> test", "Handoffs/exact blockers: none",
      "Plan artifact: plan-promoted", "Next route: /terv-review", "Readiness: READY", "",
    ].join("\n");
    store.writeArtifact(authority.run_id, operation.operation_id, "terminal", terminal);
    store.writeResult(authority.run_id, operation.operation_id, { operation_status: "SUCCEEDED", output_status: "VALID", binding_status: "BOUND", terminal_status: "VALID", artifact_sha256: sha256(Buffer.from(terminal, "utf8")), allowed_next: ["PLAN_REVIEW"] });
    store.updateOperation(authority.run_id, operation.operation_id, operation.revision, { status: "SUCCEEDED" });

    const promoted = promotedSourcesForStage(store, authority.run_id, "PLAN_REVIEW");
    assert.equal(promoted.length, 1);
    assert.equal(promoted[0]!.binding.source_class, "PLAN");
    assert.equal(promoted[0]!.binding.logical_identity, "plan-promoted");
    assert.equal(promoted[0]!.binding.producer, "FAL_ROUTER_OUTPUT");
    assert.equal(promoted[0]!.content, terminal);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("router-owned promotion rejects terminal artifact tampering", () => {
  const root = mkdtempSync(path.join(tmpdir(), "router-promoted-tamper-"));
  try {
    const store = new StateStore(root);
    const authority = { ...makeAuthority(), run_id: "run-promote-2", next_command: "/seq-next" };
    store.createRun(authority, authoritySha256(authority));
    const invocation = { ...makeInvocation("op-promote-2"), run_id: authority.run_id, requested_stage: "SEQ_NEXT" as const, canon_phase: "SEQ_NEXT" as const, command_name: "seq-next" };
    const operation = store.createOperation(authority.run_id, invocation, { schema_version: "dispatch-intent.v1" }, sha256("intent"));
    store.writeArtifact(authority.run_id, operation.operation_id, "terminal", "tampered\n");
    store.writeResult(authority.run_id, operation.operation_id, { operation_status: "SUCCEEDED", output_status: "VALID", binding_status: "BOUND", terminal_status: "VALID", artifact_sha256: "f".repeat(64), allowed_next: ["PLAN_REVIEW"] });
    store.updateOperation(authority.run_id, operation.operation_id, operation.revision, { status: "SUCCEEDED" });
    assert.throws(() => promotedSourcesForStage(store, authority.run_id, "PLAN_REVIEW"), /artifact hash mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
