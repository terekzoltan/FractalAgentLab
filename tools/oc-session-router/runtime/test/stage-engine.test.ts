import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { authoritySha256, canonicalize, sha256, type RunAuthority, type RunRequest, type StageRequest } from "../src/contracts.js";
import { StageEngine, _test as stageTest, promotedSourcesForStage, type AuthorityResolver, type ResolvedSource, type ResolvedStageAuthority } from "../src/stage-engine.js";
import { ROUTER_PROTOCOL_IDENTITY, buildSharedFenceBinding } from "../src/control-plane.js";
import { StateStore } from "../src/state-store.js";
import { CommandClient, type FetchLike } from "../src/transport.js";
import { worktreeProofSha256, type WorktreeProof } from "../src/worktree-reader.js";

class FakeResolver implements AuthorityResolver {
  authority?: RunAuthority;
  sourceContent = [
    "EPIC IMPLEMENTATION PLAN", "Target: fal", "Epic: E", "Wave: W", "Accountable Lane / class / profile: Track D / TRACK / track-d",
    "Prerequisites/current state: ready", "Scope/non-goals: fixture", "Interfaces/ownership: fixture", "Feature -> User Story -> Task: F -> US -> T",
    "Risks: none", "Ordered implementation plan: T", "Acceptance -> verification -> evidence: AC -> test", "Handoffs/exact blockers: none",
    "Plan artifact: plan-1", "Next route: /terv-review", "Readiness: READY", "",
  ].join("\n");
  revisedPlanContent = [
    "REVISED EPIC IMPLEMENTATION PLAN", "Target: fal", "Epic: E", "Wave: W", "Accountable Lane / class / profile: Track D / TRACK / track-d",
    "Prerequisites/current state: ready", "Scope/non-goals: fixture", "Interfaces/ownership: fixture", "Feature -> User Story -> Task: F -> US -> T",
    "Risks: none", "Ordered implementation plan: T", "Acceptance -> verification -> evidence: AC -> test", "Handoffs/exact blockers: none",
    "Plan artifact: plan-1", "Next route: /implement", "Readiness: READY", "DELIVERY PLAN REVISION", "Target: fal", "Epic: E",
    "Accountable Lane / class / profile: Track D / TRACK / track-d", "Applied review items: all", "Rejected/unclear items: none",
    "Final plan artifact: plan-1", "PLAN_REVISION_COMPLETE", "IMPLEMENT_READY", "",
  ].join("\n");
  resolutionCalls = 0;
  driftOnResolutionCall = 0;
  capabilityMode: "DISABLED" | "FIXTURE_ONLY" | "P0B_ISOLATED" | "PRODUCTION_RESPONSE_FIRST" = "FIXTURE_ONLY";
  capabilityIdentityGeneration = "";
  capabilityDriftOnCall = 0;
  worktreeAfterResponse?: WorktreeProof;
  nextCommand = "/terv-review";
  reviewCycle = "0";
  activeRouteGeneration = "generation-0";
  recipientSessionId = "session-meta";
  privateValues: string[] = [];
  fenceTargetRoot?: string;
  resolvedSources?: ResolvedSource[];
  worktree: WorktreeProof = { schema_version: "worktree-proof.v1", head_sha256: "1".repeat(64), head_tree_sha256: "9".repeat(64), head_parent_count: 1, sole_parent_sha256: "0".repeat(64), committed_paths: [], index_sha256: "2".repeat(64), status_sha256: "3".repeat(64), staged_paths: [], status_clean: true, has_unstaged_or_untracked: false };

  async deriveRunAuthority(request: RunRequest, identity: { runId: string; createdAt: string }): Promise<RunAuthority> {
    this.authority = {
      schema_version: "run-authority.v1",
      run_id: identity.runId,
      created_at: identity.createdAt,
      target_id: request.target_id,
      target_identity: "fal",
      worktree_identity: request.expected_worktree_identity,
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
      pinned_artifact_identity: "plan-1",
      pinned_artifact_sha256: sha256(this.sourceContent),
      overlay_identity: "overlay-v1",
      accountable_role_identity: "track-d-v1",
      configuration_identity: "config-v1",
      active_route_generation: this.activeRouteGeneration,
      review_cycle: this.reviewCycle,
      stage_source_manifest_path: "plans/stage-sources.json",
      stage_source_manifest_sha256: "e".repeat(64),
      next_command: this.nextCommand,
    };
    return this.authority!;
  }

  async resolveStageCapability(_runAuthority: RunAuthority, _request: StageRequest): Promise<ResolvedStageAuthority["capability"]> {
    return this.capability(this.capabilityMode);
  }

  private capability(mode: typeof this.capabilityMode): ResolvedStageAuthority["capability"] {
    return mode === "P0B_ISOLATED" || mode === "PRODUCTION_RESPONSE_FIRST"
      ? { mode, identity_sha256: sha256(`${mode}${this.capabilityIdentityGeneration}`), router_protocol_identity: ROUTER_PROTOCOL_IDENTITY, snapshot_correlation: "EXACT_PARENT_LINK", sse_enabled: false, retention_policy_sha256: "7".repeat(64), live_probe_sha256: "8".repeat(64), ...(mode === "P0B_ISOLATED" ? { authorization_use_sha256: sha256(mode) } : {}), server_instance_identity_sha256: sha256("fixture-live-instance"), server_binary_sha256: sha256("fixture-server-binary"), target_directory_sha256: sha256("fixture-target-directory"), command_timeout_ms: 300_000 }
      : { mode, identity_sha256: sha256(mode) };
  }

  async resolveStageAuthority(_runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority> {
    if (!this.authority) throw new Error("run missing");
    this.resolutionCalls += 1;
    const runAuthority = this.resolutionCalls === this.driftOnResolutionCall ? { ...this.authority, state_revision: "drifted" } : this.authority;
    const isImplement = request.requested_stage === "IMPLEMENT";
    const sourceContent = isImplement ? this.revisedPlanContent : this.sourceContent;
    const sources = this.resolvedSources ?? [{ binding: { path: isImplement ? "plans/revised.md" : "plans/epic.md", source_class: isImplement ? "REVISED_PLAN" as const : "PLAN" as const, logical_identity: request.plan_identity, producer: "target-state", sha256: sha256(sourceContent), order: 0 }, content: sourceContent }];
    return {
      run_authority: runAuthority,
      sources,
      transport: { origin: "http://127.0.0.1:4321", server_fingerprint: "server-fingerprint-private", session_id: this.recipientSessionId, username: "router-user-private", password: "process-only", ...(this.fenceTargetRoot ? { directory: this.fenceTargetRoot } : {}) },
      capability: this.capability(this.resolutionCalls === this.capabilityDriftOnCall ? "DISABLED" : this.capabilityMode),
      privacy: { absolute_paths: ["C:\\fixture-target", "C:\\fixture-control"], private_values: this.privateValues },
      ...(this.capabilityMode === "P0B_ISOLATED" || this.capabilityMode === "PRODUCTION_RESPONSE_FIRST" ? { shared_fence: buildSharedFenceBinding(this.fenceTargetRoot ?? (() => { throw new Error("production fence root missing"); })(), this.recipientSessionId) } : {}),
      ...(request.requested_stage === "CLOSEOUT" ? { worktree: this.worktreeAfterResponse && this.resolutionCalls >= 3 ? this.worktreeAfterResponse : this.worktree } : {}),
    };
  }
}

function resolvedSource(sourceClass: ResolvedSource["binding"]["source_class"], content: string, order: number, logicalIdentity?: string): ResolvedSource {
  return {
    binding: { path: `evidence/source-${order}.md`, source_class: sourceClass, logical_identity: logicalIdentity ?? (sourceClass === "IMPLEMENTATION_RESULT" ? "candidate-1" : `${sourceClass.toLowerCase()}-${order}`), producer: "target-state", sha256: sha256(content), order },
    content,
  };
}

function planReviewSource(planClass = "EPIC_PLAN", planIdentity = "plan-1"): string {
  return [
    "META PLAN REVIEW", "Target: fal", "Epic: E", `Plan class: ${planClass}`, `Plan artifact: ${planIdentity}`,
    "Accountable Lane / class / profile: Track D / TRACK / track-d", "Overall verdict: GREEN", "Blocking corrections: none",
    "Non-blocking improvements: none", "Ownership/dependency decision: accepted", "Acceptance/evidence decision: accepted",
    "Exact Delivery Lane action: invoke /terv-review-utan with this review",
  ].join("\n");
}

function implementationSource(candidate: string, planIdentity = "plan-1"): string {
  return [
    "IMPLEMENTATION RESULT", "Target: fal", "Epic: E", "Accountable Lane / class / profile: Track D / TRACK / track-d",
    `Plan/fix-plan identity: ${planIdentity}`, "Changed artifacts: runtime", "Explicit non-changes: protected", "Acceptance mapping: PASS",
    "Checks/results: PASS", `Candidate identity/worktree limitations: ${candidate}; none`, "Diff self-review: PASS",
    "Unresolved risks/findings: none", "Exact route: Meta /step-review", "REVIEW_READY",
  ].join("\n");
}

function reviewFixRevisionSource(): string {
  return [
    "REVISED REVIEW-FIX PLAN", "Target: fal", "Epic: E", "Candidate: candidate-1", "Accountable Lane / class / profile: Track D / TRACK / track-d",
    'Accepted finding IDs: ["FSR-010"]', "Allowed surfaces: fixture", "Forbidden surfaces: protected", "Finding -> change -> acceptance/check: FSR-010 -> fix -> test",
    "Dependencies: none", "Fix-plan artifact: fix-plan-1", "Next route: /implement", "Readiness: READY", "FIX_PLAN_READY_FOR_IMPLEMENT",
    "DELIVERY PLAN REVISION", "Target: fal", "Epic: E", "Accountable Lane / class / profile: Track D / TRACK / track-d", "Applied review items: all",
    "Rejected/unclear items: none", "Final plan artifact: fix-plan-1", "PLAN_REVISION_COMPLETE", "IMPLEMENT_READY", "",
  ].join("\n");
}

function synthesisSource(disposition: "ALLOWED" | "FIX_REQUIRED", findings: string, proposedDelta = "NONE"): string {
  return [
    "FINAL STEP REVIEW SYNTHESIS", "Target: fal", "Epic: E", "Candidate: candidate-1", "Accountable Lane / class / profile: Track D / TRACK / track-d",
    "Reviewed scope: fixture", `Overall verdict: ${disposition === "ALLOWED" ? "GREEN" : "RED"}`, "Review routing: fixture", "Acceptance/evidence matrix: fixture",
    `Accepted findings: ${findings}`, "Rejected/downgraded findings: NONE", "Verification result: PASS", `Proposed closeout delta: ${proposedDelta}`,
    `Closeout disposition: ${disposition}`, "Commit status: DEFERRED_TO_CLOSEOUT", "Exact Delivery Lane action: invoke /step-review-utan with this exact synthesis",
  ].join("\n");
}

function allPersistentText(root: string): string {
  const chunks: string[] = [];
  for (const entry of readdirSync(root)) {
    const candidate = path.join(root, entry);
    if (statSync(candidate).isDirectory()) chunks.push(allPersistentText(candidate));
    else chunks.push(readFileSync(candidate, "utf8"));
  }
  return chunks.join("\n");
}

function implementRequest(base: StageRequest, resolver: FakeResolver, requestId: string): StageRequest {
  return {
    ...base,
    request_id: requestId,
    requested_stage: "IMPLEMENT",
    recipient_role: "Track D",
    expected_sources: [{ path: "plans/revised.md", source_class: "REVISED_PLAN", logical_identity: "plan-1", producer: "target-state", sha256: sha256(resolver.revisedPlanContent), order: 0 }],
  };
}

function request(runId: string, authorityHash: string, sourceSha: string): StageRequest {
  return {
    schema_version: "stage-request.v1",
    request_id: "request-1",
    run_id: runId,
    issued_at: "2026-08-10T00:00:00.000Z",
    issued_by: "orchestrator",
    run_authority_sha256: authorityHash,
    requested_stage: "PLAN_REVIEW",
    plan_class: "EPIC_PLAN",
    target_id: "fal",
    worktree_identity: "git:abc",
    state_revision: "state-v1",
    state_sha256: "b".repeat(64),
    combined_selector: "HEADING:Current",
    combined_span_sha256: "c".repeat(64),
    expected_sources: [{ path: "plans/epic.md", source_class: "PLAN", logical_identity: "plan-1", producer: "target-state", sha256: sourceSha, order: 0 }],
    wave: "W",
    epic: "E",
    accountable_lane: "Track D",
    accountable_class: "TRACK",
    accountable_profile: "track-d",
    sender_role: "Track D",
    recipient_role: "Meta",
    plan_identity: "plan-1",
    candidate_identity: "UNDECLARED",
    review_cycle: "0",
    finding_ids: [],
    review_risk: "normal",
    project_review_context: "fal",
    expected_contract_version: "awc-3.1",
    allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND",
    configuration_identity: "config-v1",
    active_route_generation: "generation-0",
  };
}

test("one explicit stage uses one response and never auto-advances", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-engine-"));
  try {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls += 1;
      return new Response(JSON.stringify({
        info: { id: "assistant-1", role: "assistant", sessionID: "session-meta", parentID: "user-1" },
        parts: [{ id: "part-1", type: "text", text: "META PLAN REVIEW\nTarget: fal\nEpic: E\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nAccountable Lane / class / profile: Track D / TRACK / track-d\nOverall verdict: GREEN\nBlocking corrections: none\nNon-blocking improvements: none\nOwnership/dependency decision: accepted\nAcceptance/evidence decision: accepted\nExact Delivery Lane action: invoke /terv-review-utan with this review", messageID: "assistant-1", sessionID: "session-meta" }],
      }), { status: 200 });
    };
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(fakeFetch));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    assert.equal(created.run_authority_sha256, authoritySha256(resolver.authority!));
    const result = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    assert.equal(calls, 1);
    assert.equal(result.operation_status, "SUCCEEDED", JSON.stringify(result));
    assert.deepEqual(result.allowed_next, ["PLAN_REVISION"]);
    assert.equal(result.auto_advance, false);
    assert.equal(resolver.resolutionCalls, 3);
    const artifact = readFileSync(path.join(root, "runs", created.run_id, "operations", result.operation_id, "terminal.md"));
    assert.equal(result.artifact_sha256, sha256(artifact));
    assert.equal((result as typeof result & { message_id_sha256?: string }).message_id_sha256, sha256("assistant-1"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("immediate pre-send authority drift fails closed before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-presend-drift-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.driftOnResolutionCall = 2;
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({
        info: { id: "assistant-retry", role: "assistant", sessionID: "session-meta", parentID: "user-retry" },
        parts: [{ id: "part-retry", type: "text", text: "META PLAN REVIEW\nTarget: fal\nEpic: E\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nAccountable Lane / class / profile: Track D / TRACK / track-d\nOverall verdict: GREEN\nBlocking corrections: none\nNon-blocking improvements: none\nOwnership/dependency decision: accepted\nAcceptance/evidence decision: accepted\nExact Delivery Lane action: invoke /terv-review-utan with this review", messageID: "assistant-retry", sessionID: "session-meta" }],
      }));
    }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const result = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    assert.equal(result.operation_status, "FAILED_TRANSPORT");
    assert.equal(result.reason, "AUTHORITY_REVALIDATION_FAILED");
    assert.equal(calls, 0);
    resolver.driftOnResolutionCall = 0;
    assert.equal((await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)))).operation_status, "SUCCEEDED");
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("credential or raw session sentinel is rejected before artifact persistence", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-private-sink-"));
  try {
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => new Response(JSON.stringify({
      info: { id: "assistant-private", role: "assistant", sessionID: "session-meta", parentID: "user-private" },
      parts: [{ id: "part-private", type: "text", text: "META PLAN REVIEW\nTarget: fal\nEpic: E\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nAccountable Lane / class / profile: Track D / TRACK / track-d\nOverall verdict: GREEN\nBlocking corrections: none\nNon-blocking improvements: process-only\nOwnership/dependency decision: accepted\nAcceptance/evidence decision: accepted\nExact Delivery Lane action: invoke /terv-review-utan with this review", messageID: "assistant-private", sessionID: "session-meta" }],
    }))));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const result = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    assert.equal(result.operation_status, "FAILED_OUTPUT");
    assert.equal(result.reason, "PRIVATE_OUTPUT_REJECTED");
    const operationDir = path.join(root, "runs", created.run_id, "operations", result.operation_id);
    assert.equal(existsSync(path.join(operationDir, "terminal.md")), false);
    for (const name of readdirSync(operationDir)) {
      const file = path.join(operationDir, name);
      if (!name.endsWith(".lock")) assert.doesNotMatch(readFileSync(file, "utf8"), /process-only|session-meta/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-018: private request context is rejected before operation persistence", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-private-request-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const privateRequest = { ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), project_review_context: "process-only" };
    await assert.rejects(() => engine.invokeStage(privateRequest), /private transport sentinel/);
    assert.equal(calls, 0);
    assert.equal(store.listOperations(created.run_id).length, 0);
    assert.doesNotMatch(allPersistentText(root), /process-only/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-043: private protected source content is rejected before operation persistence", async () => {
  for (const privateSource of ["candidate-ses_", "candidate-ses_a"]) {
    const root = mkdtempSync(path.join(tmpdir(), "fal-router-private-source-"));
    try {
      let calls = 0;
      const resolver = new FakeResolver();
      resolver.sourceContent = resolver.sourceContent.replace("Scope/non-goals: fixture", `Scope/non-goals: ${privateSource}`);
      const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; throw new Error("must not send"); }));
      const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
      await assert.rejects(() => engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent))), /private transport sentinel/);
      assert.equal(calls, 0);
      assert.equal(existsSync(path.join(root, "runs", created.run_id, "operations")), false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("origin, fingerprint, username, and endpoint sentinels never reach persistent sinks", async () => {
  for (const sentinel of ["http://127.0.0.1:4321", "server-fingerprint-private", "router-user-private", "https://private.example/path", encodeURIComponent("process-only"), Buffer.from("router-user-private:process-only").toString("base64"), "C:\\fixture-target"]) {
    const root = mkdtempSync(path.join(tmpdir(), "fal-router-private-sink-all-"));
    try {
      const resolver = new FakeResolver();
      const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => new Response(JSON.stringify({
        info: { id: "assistant-private-all", role: "assistant", sessionID: "session-meta", parentID: "user-private-all" },
        parts: [{ id: "part-private-all", type: "text", text: `META PLAN REVIEW\nTarget: fal\nEpic: E\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nAccountable Lane / class / profile: Track D / TRACK / track-d\nOverall verdict: GREEN\nBlocking corrections: none\nNon-blocking improvements: ${sentinel}\nOwnership/dependency decision: accepted\nAcceptance/evidence decision: accepted\nExact Delivery Lane action: invoke /terv-review-utan with this review`, messageID: "assistant-private-all", sessionID: "session-meta" }],
      }))));
      const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
      const result = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
      assert.equal(result.operation_status, "FAILED_OUTPUT");
      assert.equal(result.reason, "PRIVATE_OUTPUT_REJECTED");
       assert.doesNotMatch(allPersistentText(root), new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("FSR-017: ineligible ACK_ONLY is consumed across runs without resend", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-ineligible-ack-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.nextCommand = "/step-review-utan";
    const synthesis = synthesisSource("FIX_REQUIRED", '[{"id":"FSR-017"}]');
    resolver.resolvedSources = [resolvedSource("FINAL_SYNTHESIS", synthesis, 0)];
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({ info: { id: "assistant-ack", role: "assistant", sessionID: "session-meta" }, parts: [{ id: "part-ack", type: "text", text: "ACK_ONLY", messageID: "assistant-ack", sessionID: "session-meta" }] }));
    }));
    const invoke = async (requestId: string) => {
      const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
      const stage: StageRequest = { ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), request_id: requestId, requested_stage: "DELIVERY_RESPONSE", sender_role: "Meta", recipient_role: "Track D", candidate_identity: "candidate-1", finding_ids: ["FSR-017"], expected_sources: resolver.resolvedSources!.map((source) => source.binding) };
      return { created, stage };
    };
    const first = await invoke("request-ineligible-ack-1");
    assert.equal((await engine.invokeStage(first.stage)).operation_status, "FAILED_OUTPUT");
    const second = await invoke("request-ineligible-ack-2");
    await assert.rejects(() => engine.invokeStage(second.stage), /semantic action/i);
    assert.equal(calls, 1);
    assert.equal(new StateStore(root).listOperations(second.created.run_id).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-017: malformed synthesis and non-ALLOWED closeout fail before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-lineage-operating-path-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    resolver.nextCommand = "/step-review-utan";
    resolver.resolvedSources = [resolvedSource("FINAL_SYNTHESIS", "FINAL STEP REVIEW SYNTHESIS\nCandidate: candidate-1\n", 0)];
    const deliveryRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const delivery: StageRequest = { ...request(deliveryRun.run_id, deliveryRun.run_authority_sha256, sha256(resolver.sourceContent)), request_id: "request-malformed-synthesis", requested_stage: "DELIVERY_RESPONSE", sender_role: "Meta", recipient_role: "Track D", candidate_identity: "candidate-1", expected_sources: resolver.resolvedSources.map((source) => source.binding) };
    await assert.rejects(() => engine.invokeStage(delivery), /missing required field|output shape|terminal/i);
    assert.equal(store.listOperations(deliveryRun.run_id).length, 0);

    resolver.nextCommand = "/closeout-commit";
    const synthesis = synthesisSource("FIX_REQUIRED", '[{"id":"FSR-017"}]');
    resolver.resolvedSources = [
      resolvedSource("FINAL_SYNTHESIS", synthesis, 0), resolvedSource("DELIVERY_RESPONSE", "ACK_ONLY\n", 1), resolvedSource("PROPOSED_DELTA", "NONE\n", 2),
      resolvedSource("CLOSEOUT_AUTHORITY", JSON.stringify({ schema_version: "closeout-authority.v1", candidate_identity: "candidate-1", worktree_identity: "git:abc", worktree_proof_sha256: worktreeProofSha256(resolver.worktree), allowed_paths: [], commit_scope: { mode: "NO_COMMIT", reason: "fixture" }, staging_precondition: "EMPTY", global_apply: false, restart: false }), 3),
    ];
    const closeoutRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const closeout: StageRequest = { ...request(closeoutRun.run_id, closeoutRun.run_authority_sha256, sha256(resolver.sourceContent)), request_id: "request-nonallowed-closeout", requested_stage: "CLOSEOUT", recipient_role: "Meta", candidate_identity: "candidate-1", finding_ids: ["FSR-017"], expected_sources: resolver.resolvedSources.map((source) => source.binding) };
    await assert.rejects(() => engine.invokeStage(closeout), /Closeout requires an ALLOWED synthesis/);
    assert.equal(store.listOperations(closeoutRun.run_id).length, 0);
    assert.equal(calls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-017: post-response capability drift consumes without retry", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-capability-drift-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.capabilityDriftOnCall = 3;
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({ info: { id: "assistant-drift", role: "assistant", sessionID: "session-meta" }, parts: [{ id: "part-drift", type: "text", text: planReviewSource(), messageID: "assistant-drift", sessionID: "session-meta" }] }));
    }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const stage = request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent));
    const result = await engine.invokeStage(stage);
    assert.equal(result.operation_status, "FAILED_OUTPUT");
    assert.equal(result.reason, "AUTHORITY_REVALIDATION_FAILED");
    await assert.rejects(() => engine.invokeStage({ ...stage, request_id: "request-capability-drift-retry" }), /semantic action/i);
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("valid-hash source substitution fails before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-source-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const forged = request(created.run_id, created.run_authority_sha256, "f".repeat(64));
    forged.expected_sources[0]!.path = "plans/other.md";
    await assert.rejects(() => engine.invokeStage(forged), /SOURCE_SUBSTITUTION/);
    assert.equal(calls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("first stage must match the current target-state command authority", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-initial-transition-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const invalid = implementRequest(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), resolver, "request-initial-invalid");
    await assert.rejects(() => engine.invokeStage(invalid), /current target-state command/i);
    assert.equal(calls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-010: IMPLEMENT rejects revised-plan class substitution before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-plan-class-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.nextCommand = "/implement";
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const substituted = { ...implementRequest(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), resolver, "request-plan-class-substitution"), plan_class: "REVIEW_FIX_PLAN" as const };
    await assert.rejects(() => engine.invokeStage(substituted), /Plan class binding mismatch/);
    assert.equal(calls, 0);
    assert.equal(new StateStore(root).listOperations(created.run_id).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-010: EPIC and REVIEW_FIX revisions each reach their matching IMPLEMENT edge", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-plan-class-positive-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.nextCommand = "/implement";
    let responsePlan = "plan-1";
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({ info: { id: `assistant-class-${calls}`, role: "assistant", sessionID: "session-meta" }, parts: [{ id: `part-class-${calls}`, type: "text", text: implementationSource(`candidate-${calls}`, responsePlan), messageID: `assistant-class-${calls}`, sessionID: "session-meta" }] }));
    }));
    for (const item of [
      { planClass: "EPIC_PLAN" as const, planIdentity: "plan-1", source: resolver.revisedPlanContent },
      { planClass: "REVIEW_FIX_PLAN" as const, planIdentity: "fix-plan-1", source: reviewFixRevisionSource() },
    ]) {
      resolver.revisedPlanContent = item.source;
      responsePlan = item.planIdentity;
      const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
      const stage: StageRequest = {
        ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), request_id: `request-${item.planClass.toLowerCase()}`,
        requested_stage: "IMPLEMENT", recipient_role: "Track D", plan_class: item.planClass, plan_identity: item.planIdentity, candidate_identity: "candidate-1",
        finding_ids: item.planClass === "REVIEW_FIX_PLAN" ? ["FSR-010"] : [],
        expected_sources: [{ path: "plans/revised.md", source_class: "REVISED_PLAN", logical_identity: item.planIdentity, producer: "target-state", sha256: sha256(item.source), order: 0 }],
      };
      assert.equal((await engine.invokeStage(stage)).operation_status, "SUCCEEDED");
    }
    assert.equal(calls, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PLAN_REVISION promotes its final plan identity into the same-run IMPLEMENT edge", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-plan-identity-promotion-"));
  try {
    let calls = 0;
    const finalPlanIdentity = "plan-final-v2";
    const revisedPlan = new FakeResolver().revisedPlanContent.replaceAll("plan-1", finalPlanIdentity);
    const resolver = new FakeResolver();
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => {
      calls += 1;
      const text = calls === 1
        ? planReviewSource()
        : calls === 2
          ? revisedPlan
          : implementationSource("candidate-1", finalPlanIdentity);
      return new Response(JSON.stringify({
        info: { id: `assistant-promotion-${calls}`, role: "assistant", sessionID: "session-meta" },
        parts: [{ id: `part-promotion-${calls}`, type: "text", text, messageID: `assistant-promotion-${calls}`, sessionID: "session-meta" }],
      }));
    }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const base = request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent));
    assert.equal((await engine.invokeStage(base)).operation_status, "SUCCEEDED");

    const promotedReview = promotedSourcesForStage(store, created.run_id, "PLAN_REVISION");
    const revisionSources = [
      resolvedSource("PLAN", resolver.sourceContent, 0),
      { ...promotedReview[0]!, binding: { ...promotedReview[0]!.binding, order: 1 } },
    ];
    resolver.resolvedSources = revisionSources;
    const revisionRequest: StageRequest = {
      ...base,
      request_id: "request-plan-identity-revision",
      requested_stage: "PLAN_REVISION",
      sender_role: "Meta",
      recipient_role: "Track D",
      expected_sources: revisionSources.map((source) => source.binding),
    };
    assert.equal((await engine.invokeStage(revisionRequest)).operation_status, "SUCCEEDED");

    const promotedPlan = promotedSourcesForStage(store, created.run_id, "IMPLEMENT");
    resolver.resolvedSources = promotedPlan;
    const implementRequestV2: StageRequest = {
      ...base,
      request_id: "request-plan-identity-implement",
      requested_stage: "IMPLEMENT",
      recipient_role: "Track D",
      plan_identity: finalPlanIdentity,
      expected_sources: promotedPlan.map((source) => source.binding),
    };
    await assert.rejects(() => engine.invokeStage({ ...implementRequestV2, request_id: "request-plan-identity-forged", plan_identity: "forged-final-plan" }), /Revised plan lineage/);
    assert.equal(store.listOperations(created.run_id).length, 2);
    assert.equal((await engine.invokeStage(implementRequestV2)).operation_status, "SUCCEEDED");
    assert.equal(calls, 3);
    assert.equal(store.listOperations(created.run_id).length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stage request authority, recipient, contract, and side-effect class bind before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-stage-authority-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const base = request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent));
    await assert.rejects(() => engine.invokeStage({ ...base, state_revision: "forged" }), /state_revision binding mismatch/);
    await assert.rejects(() => engine.invokeStage({ ...base, recipient_role: "Track D" }), /recipient role/);
    await assert.rejects(() => engine.invokeStage({ ...base, expected_contract_version: "awc-other" }), /contract version/);
    await assert.rejects(() => engine.invokeStage({ ...base, allowed_side_effect_class: "ROUTER_PRIVATE_ONLY" }), /side-effect class/);
    assert.equal(calls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("production-disabled capability blocks before operation creation and POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-capability-disabled-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.capabilityMode = "DISABLED";
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    await assert.rejects(() => engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent))), /disabled.*P0B/i);
    assert.equal(calls, 0);
    assert.equal(resolver.resolutionCalls, 0);
    assert.equal(store.listOperations(created.run_id).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-020: canonical source findings block duplicate, arbitrary, and permuted resend", async () => {
  for (const responseMode of ["timeout", "invalid-output"] as const) {
    const root = mkdtempSync(path.join(tmpdir(), `fal-router-finding-${responseMode}-`));
    try {
      let calls = 0;
      const resolver = new FakeResolver();
      resolver.nextCommand = "/step-review-utan";
      const synthesis = synthesisSource("FIX_REQUIRED", '[{"id":"FSR-021"},{"id":"FSR-020"}]');
      resolver.resolvedSources = [resolvedSource("FINAL_SYNTHESIS", synthesis, 0)];
      const store = new StateStore(root);
      const engine = new StageEngine(store, resolver, new CommandClient(async () => {
        calls += 1;
        if (responseMode === "timeout") throw new Error("delivery unknown");
        return new Response(JSON.stringify({ info: { id: "assistant-invalid", role: "assistant", sessionID: "session-meta" }, parts: [{ id: "part-invalid", type: "text", text: "invalid", messageID: "assistant-invalid", sessionID: "session-meta" }] }));
      }));
      const makeStage = async (requestId: string, findingIds: string[]) => {
        const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
        return {
          created,
          stage: { ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), request_id: requestId, requested_stage: "DELIVERY_RESPONSE" as const, sender_role: "Meta", recipient_role: "Track D", candidate_identity: "candidate-1", finding_ids: findingIds, expected_sources: resolver.resolvedSources!.map((source) => source.binding) },
        };
      };
      const first = await makeStage(`request-finding-${responseMode}-1`, ["FSR-020", "FSR-021"]);
      assert.equal((await engine.invokeStage(first.stage)).operation_status, responseMode === "timeout" ? "UNCERTAIN" : "FAILED_OUTPUT");
      const permuted = await makeStage(`request-finding-${responseMode}-2`, ["FSR-021", "FSR-020"]);
      await assert.rejects(() => engine.invokeStage(permuted.stage), /semantic action/i);
      assert.equal(store.listOperations(permuted.created.run_id).length, 0);
      const arbitrary = await makeStage(`request-finding-${responseMode}-3`, ["FSR-020", "FSR-999"]);
      await assert.rejects(() => engine.invokeStage(arbitrary.stage), /finding lineage/i);
      assert.equal(store.listOperations(arbitrary.created.run_id).length, 0);
      const duplicate = await makeStage(`request-finding-${responseMode}-4`, ["FSR-020", "FSR-020"]);
      await assert.rejects(() => engine.invokeStage(duplicate.stage), /duplicates/i);
      assert.equal(store.listOperations(duplicate.created.run_id).length, 0);
      assert.equal(calls, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("FSR-024: an unselected registry-session sentinel is rejected in request and output sinks", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-all-session-private-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const unselected = "session-unselected-private";
    const originalResolve = resolver.resolveStageAuthority.bind(resolver);
    resolver.resolveStageAuthority = async (authority, stage) => {
      const resolved = await originalResolve(authority, stage);
      return { ...resolved, privacy: { ...resolved.privacy, private_values: [unselected] } };
    };
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({ info: { id: "assistant-private-other", role: "assistant", sessionID: "session-meta" }, parts: [{ id: "part-private-other", type: "text", text: planReviewSource().replace("Non-blocking improvements: none", `Non-blocking improvements: ${Buffer.from(unselected).toString("base64")}`), messageID: "assistant-private-other", sessionID: "session-meta" }] }));
    }));
    const first = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    await assert.rejects(() => engine.invokeStage({ ...request(first.run_id, first.run_authority_sha256, sha256(resolver.sourceContent)), project_review_context: encodeURIComponent(unselected) }), /private transport sentinel/);
    assert.equal(store.listOperations(first.run_id).length, 0);
    const second = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const result = await engine.invokeStage({ ...request(second.run_id, second.run_authority_sha256, sha256(resolver.sourceContent)), request_id: "request-private-other-output" });
    assert.equal(result.operation_status, "FAILED_OUTPUT");
    assert.equal(result.reason, "PRIVATE_OUTPUT_REJECTED");
    assert.doesNotMatch(allPersistentText(root), new RegExp(Buffer.from(unselected).toString("base64")));
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ambiguous transport failure creates UNCERTAIN without resend", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-uncertain-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; throw new Error("timeout after acceptance unknown"); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const result = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    assert.equal(calls, 1);
    assert.equal(result.operation_status, "UNCERTAIN");
    assert.equal(result.auto_advance, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("received but invalid output is FAILED_OUTPUT, not delivery uncertainty", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-invalid-output-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({
        info: { id: "assistant-1", role: "assistant", sessionID: "session-meta", parentID: "user-1" },
        parts: [{ id: "part-1", type: "text", text: "progress only", messageID: "assistant-1", sessionID: "session-meta" }],
      }), { status: 200 });
    }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const result = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    assert.equal(calls, 1);
    assert.equal(result.operation_status, "FAILED_OUTPUT");
    assert.equal(result.transport_status, "RESPONSE_ACCEPTED");
    const secondRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    await assert.rejects(() => engine.invokeStage(request(secondRun.run_id, secondRun.run_authority_sha256, sha256(resolver.sourceContent))), /semantic action/i);
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-015: recipient remap and authority generation distinguish semantic actions", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-semantic-generation-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; throw new Error("delivery unknown"); }));
    const invokeCurrent = async (requestId: string) => {
      const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
      return engine.invokeStage({ ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), request_id: requestId, active_route_generation: resolver.activeRouteGeneration });
    };
    assert.equal((await invokeCurrent("request-generation-0")).operation_status, "UNCERTAIN");
    resolver.activeRouteGeneration = "generation-1";
    assert.equal((await invokeCurrent("request-generation-1")).operation_status, "UNCERTAIN");
    resolver.recipientSessionId = "session-remapped";
    assert.equal((await invokeCurrent("request-session-remap")).operation_status, "UNCERTAIN");
    assert.equal(calls, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ambiguous semantic action remains blocked across new runs", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-cross-run-semantic-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => { calls += 1; throw new Error("delivery unknown"); }));
    const firstRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const first = await engine.invokeStage(request(firstRun.run_id, firstRun.run_authority_sha256, sha256(resolver.sourceContent)));
    assert.equal(first.operation_status, "UNCERTAIN");
    const secondRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    await assert.rejects(() => engine.invokeStage(request(secondRun.run_id, secondRun.run_authority_sha256, sha256(resolver.sourceContent))), /semantic action/i);
    assert.equal(calls, 1);
    assert.equal(store.listOperations(secondRun.run_id).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("shared lease conflict does not strand a nonterminal operation", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-lease-"));
  try {
    const store = new StateStore(root);
    const resolver = new FakeResolver();
    const engine = new StageEngine(store, resolver, new CommandClient(async () => new Response()));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const release = store.acquireLease(sha256(canonicalize({ domain: "fal-router-global-session-lease/v1", server_instance_identity_sha256: sha256("server-fingerprint-private"), session_sha256: sha256("session-meta") })), { schema_version: "dispatch-lease.v1", server_fingerprint_sha256: sha256("server-fingerprint-private"), session_sha256: sha256("session-meta"), operation_class: "PLAN_REVIEW", holder: "other", acquired_at: new Date().toISOString(), fencing_generation: "fixture-generation" });
    try {
      await assert.rejects(() => engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent))), /exist|EEXIST/i);
      const operations = path.join(root, "runs", created.run_id, "operations");
      assert.equal(existsSync(operations) ? readdirSync(operations).length : 0, 0);
    } finally {
      release();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent invoke race creates exactly one operation and one POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-invoke-race-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({
        info: { id: "assistant-race", role: "assistant", sessionID: "session-meta", parentID: "user-race" },
        parts: [{ id: "part-race", type: "text", text: "META PLAN REVIEW\nTarget: fal\nEpic: E\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nAccountable Lane / class / profile: Track D / TRACK / track-d\nOverall verdict: GREEN\nBlocking corrections: none\nNon-blocking improvements: none\nOwnership/dependency decision: accepted\nAcceptance/evidence decision: accepted\nExact Delivery Lane action: invoke /terv-review-utan with this review", messageID: "assistant-race", sessionID: "session-meta" }],
      }));
    }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const first = request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent));
    const second = { ...first, request_id: "request-race-2" };
    const outcomes = await Promise.allSettled([engine.invokeStage(first), engine.invokeStage(second)]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
    assert.equal(calls, 1);
    assert.equal(new StateStore(root).listOperations(created.run_id).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("successful stage gates the next explicit stage", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-transition-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({
        info: { id: `assistant-${calls}`, role: "assistant", sessionID: "session-meta", parentID: `user-${calls}` },
        parts: [{ id: `part-${calls}`, type: "text", text: "META PLAN REVIEW\nTarget: fal\nEpic: E\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nAccountable Lane / class / profile: Track D / TRACK / track-d\nOverall verdict: GREEN\nBlocking corrections: none\nNon-blocking improvements: none\nOwnership/dependency decision: accepted\nAcceptance/evidence decision: accepted\nExact Delivery Lane action: invoke /terv-review-utan with this review", messageID: `assistant-${calls}`, sessionID: "session-meta" }],
      }));
    }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const first = request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent));
    assert.equal((await engine.invokeStage(first)).operation_status, "SUCCEEDED");
    const skipped = implementRequest(first, resolver, "request-2");
    await assert.rejects(() => engine.invokeStage(skipped), /transition/i);
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-014: review cycle is protected state authority across one-stage runs", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-review-cycle-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({
        info: { id: "assistant-cycle", role: "assistant", sessionID: "session-meta", parentID: "user-cycle" },
        parts: [{ id: "part-cycle", type: "text", text: "META PLAN REVIEW\nTarget: fal\nEpic: E\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nAccountable Lane / class / profile: Track D / TRACK / track-d\nOverall verdict: GREEN\nBlocking corrections: none\nNon-blocking improvements: none\nOwnership/dependency decision: accepted\nAcceptance/evidence decision: accepted\nExact Delivery Lane action: invoke /terv-review-utan with this review", messageID: "assistant-cycle", sessionID: "session-meta" }],
      }));
    }));
    const cycle0 = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const first = request(cycle0.run_id, cycle0.run_authority_sha256, sha256(resolver.sourceContent));
    await assert.rejects(() => engine.invokeStage({ ...first, request_id: "request-cycle-forged", review_cycle: "1" }), /review_cycle binding mismatch/);
    assert.equal(new StateStore(root).listOperations(cycle0.run_id).length, 0);
    assert.equal((await engine.invokeStage(first)).operation_status, "SUCCEEDED");

    resolver.reviewCycle = "1";
    const cycle1 = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const second = { ...request(cycle1.run_id, cycle1.run_authority_sha256, sha256(resolver.sourceContent)), request_id: "request-cycle-1", review_cycle: "1" };
    assert.equal((await engine.invokeStage(second)).operation_status, "SUCCEEDED");
    assert.equal(calls, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("STEP_REVIEW sends a verified INITIAL or FIX_RECHECK envelope", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-review-envelope-"));
  try {
    const argumentsSent: string[] = [];
    const resolver = new FakeResolver();
    resolver.nextCommand = "/step-review";
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { arguments: string };
      argumentsSent.push(body.arguments);
      return new Response(JSON.stringify({
        info: { id: `assistant-review-${argumentsSent.length}`, role: "assistant", sessionID: "session-meta", parentID: `user-review-${argumentsSent.length}` },
        parts: [{ id: `part-review-${argumentsSent.length}`, type: "text", text: synthesisSource("ALLOWED", "NONE"), messageID: `assistant-review-${argumentsSent.length}`, sessionID: "session-meta" }],
      }));
    }));

    resolver.resolvedSources = [
      resolvedSource("IMPLEMENTATION_RESULT", implementationSource("candidate-1"), 0),
      resolvedSource("ACCEPTANCE_EVIDENCE", "ACCEPTANCE EVIDENCE\nCandidate: candidate-1\n", 1),
    ];
    const initialRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const initial: StageRequest = {
      ...request(initialRun.run_id, initialRun.run_authority_sha256, sha256(resolver.sourceContent)),
      request_id: "request-initial-review-envelope",
      requested_stage: "STEP_REVIEW",
      candidate_identity: "candidate-1",
      expected_sources: resolver.resolvedSources.map((source) => source.binding),
    };
    assert.equal((await engine.invokeStage(initial)).operation_status, "SUCCEEDED");

    resolver.reviewCycle = "1";
    resolver.resolvedSources = [
      resolvedSource("IMPLEMENTATION_RESULT", implementationSource("candidate-1", "fix-plan-1"), 0),
      resolvedSource("ACCEPTANCE_EVIDENCE", 'ACCEPTANCE EVIDENCE\nCandidate: candidate-1\nReview mode: FIX_RECHECK\nRepaired finding IDs: ["FSR-010"]\n', 1),
    ];
    const fixRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const fixRecheck: StageRequest = {
      ...request(fixRun.run_id, fixRun.run_authority_sha256, sha256(resolver.sourceContent)),
      request_id: "request-fix-recheck-envelope",
      requested_stage: "STEP_REVIEW",
      plan_class: "REVIEW_FIX_PLAN",
      plan_identity: "fix-plan-1",
      candidate_identity: "candidate-1",
      review_cycle: "1",
      finding_ids: ["FSR-010"],
      review_risk: "focused",
      project_review_context: "repair-only",
      expected_sources: resolver.resolvedSources.map((source) => source.binding),
    };
    assert.equal((await engine.invokeStage(fixRecheck)).operation_status, "SUCCEEDED");

    assert.equal(argumentsSent.length, 2);
    assert.match(argumentsSent[0]!, /"review_mode":"INITIAL"/);
    assert.match(argumentsSent[0]!, /"scope_promotion_policy":"NEXUS_ONLY"/);
    assert.match(argumentsSent[1]!, /"review_mode":"FIX_RECHECK"/);
    assert.match(argumentsSent[1]!, /"repaired_finding_ids":\["FSR-010"\]/);
    assert.match(argumentsSent[1]!, /"review_boundary":"REPAIRED_FINDINGS_AND_MINIMAL_REGRESSION"/);
    assert.doesNotMatch(argumentsSent[1]!, /repair-only/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("STEP_REVIEW rejects unbound repair scope before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-review-envelope-negative-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.nextCommand = "/step-review";
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; return new Response(); }));

    resolver.resolvedSources = [
      resolvedSource("IMPLEMENTATION_RESULT", implementationSource("candidate-1"), 0),
      resolvedSource("ACCEPTANCE_EVIDENCE", "ACCEPTANCE EVIDENCE\nCandidate: candidate-1\n", 1),
    ];
    const initialRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const initialBase: StageRequest = {
      ...request(initialRun.run_id, initialRun.run_authority_sha256, sha256(resolver.sourceContent)),
      requested_stage: "STEP_REVIEW",
      candidate_identity: "candidate-1",
      expected_sources: resolver.resolvedSources.map((source) => source.binding),
    };
    await assert.rejects(() => engine.invokeStage({ ...initialBase, request_id: "request-initial-with-finding", plan_class: "REVIEW_FIX_PLAN", finding_ids: ["FSR-010"] }), /INITIAL STEP_REVIEW/);

    resolver.reviewCycle = "1";
    resolver.resolvedSources = [
      resolvedSource("IMPLEMENTATION_RESULT", implementationSource("candidate-1", "fix-plan-1"), 0),
      resolvedSource("ACCEPTANCE_EVIDENCE", 'ACCEPTANCE EVIDENCE\nCandidate: candidate-1\nReview mode: FIX_RECHECK\nRepaired finding IDs: ["FSR-999"]\n', 1),
    ];
    const fixRun = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const fixBase: StageRequest = {
      ...request(fixRun.run_id, fixRun.run_authority_sha256, sha256(resolver.sourceContent)),
      requested_stage: "STEP_REVIEW",
      plan_class: "REVIEW_FIX_PLAN",
      plan_identity: "fix-plan-1",
      candidate_identity: "candidate-1",
      review_cycle: "1",
      finding_ids: ["FSR-010"],
      expected_sources: resolver.resolvedSources.map((source) => source.binding),
    };
    await assert.rejects(() => engine.invokeStage({ ...fixBase, request_id: "request-fix-empty", finding_ids: [] }), /FIX_RECHECK STEP_REVIEW/);
    await assert.rejects(() => engine.invokeStage({ ...fixBase, request_id: "request-fix-mismatch" }), /acceptance evidence finding lineage/i);
    assert.equal(calls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-002 source lineage rejects forged lifecycle receipts before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-lineage-zero-post-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.nextCommand = "/step-review";
    const implementation = implementationSource("other-candidate");
    const acceptance = "ACCEPTANCE EVIDENCE\nCandidate: `candidate-1`\n";
    resolver.resolvedSources = [resolvedSource("IMPLEMENTATION_RESULT", implementation, 0, "other-candidate"), resolvedSource("ACCEPTANCE_EVIDENCE", acceptance, 1)];
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const forged: StageRequest = {
      ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)),
      request_id: "request-cross-candidate",
      requested_stage: "STEP_REVIEW",
      recipient_role: "Meta",
      candidate_identity: "candidate-1",
      expected_sources: resolver.resolvedSources.map((source) => source.binding),
    };
    await assert.rejects(() => engine.invokeStage(forged), /candidate|plan lineage/i);
    assert.equal(calls, 0);
    assert.equal(new StateStore(root).listOperations(created.run_id).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-016: incomplete predecessor artifacts reject on operating paths before POST", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-predecessor-parser-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => { calls += 1; return new Response(); }));
    const cases: Array<{ name: string; next: string; sources: ResolvedSource[]; build: (base: StageRequest) => StageRequest }> = [
      {
        name: "plan", next: "/terv-review", sources: [resolvedSource("PLAN", "EPIC IMPLEMENTATION PLAN\nPlan artifact: plan-1\nReadiness: READY\n", 0)],
        build: (base) => base,
      },
      {
        name: "review", next: "/terv-review-utan", sources: [resolvedSource("PLAN", resolver.sourceContent, 0), resolvedSource("META_PLAN_REVIEW", "META PLAN REVIEW\nPlan class: EPIC_PLAN\nPlan artifact: plan-1\nOverall verdict: GREEN\n", 1)],
        build: (base) => ({ ...base, requested_stage: "PLAN_REVISION", sender_role: "Meta", recipient_role: "Track D" }),
      },
      {
        name: "revision", next: "/implement", sources: [resolvedSource("REVISED_PLAN", "REVISED EPIC IMPLEMENTATION PLAN\nFinal plan artifact: plan-1\nPLAN_REVISION_COMPLETE\nIMPLEMENT_READY\n", 0)],
        build: (base) => ({ ...base, requested_stage: "IMPLEMENT", recipient_role: "Track D" }),
      },
      {
        name: "implementation", next: "/step-review", sources: [resolvedSource("IMPLEMENTATION_RESULT", "IMPLEMENTATION RESULT\nCandidate identity: candidate-1\nPlan/fix-plan identity: plan-1\nREVIEW_READY\n", 0), resolvedSource("ACCEPTANCE_EVIDENCE", "ACCEPTANCE EVIDENCE\nCandidate: candidate-1\n", 1)],
        build: (base) => ({ ...base, requested_stage: "STEP_REVIEW", candidate_identity: "candidate-1" }),
      },
    ];
    for (const item of cases) {
      resolver.nextCommand = item.next;
      resolver.resolvedSources = item.sources;
      const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
      const stage = item.build({ ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), request_id: `request-incomplete-${item.name}`, expected_sources: item.sources.map((source) => source.binding) });
      await assert.rejects(() => engine.invokeStage(stage), /missing required field|output shape|canonical plan header/i);
      assert.equal(store.listOperations(created.run_id).length, 0);
    }
    assert.equal(calls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-002 ordered source and closeout lineage matrix", async () => {
  const resolver = new FakeResolver();
  const authority = await resolver.deriveRunAuthority(
    { schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" },
    { runId: "run-lineage", createdAt: "2026-08-10T00:00:00.000Z" },
  );
  const base = request("run-lineage", authoritySha256(authority), sha256(resolver.sourceContent));
  const review = planReviewSource();
  const revisionSources = [resolvedSource("PLAN", resolver.sourceContent, 0), resolvedSource("META_PLAN_REVIEW", review, 1)];
  const revisionRequest: StageRequest = { ...base, requested_stage: "PLAN_REVISION", recipient_role: "Track D", sender_role: "Meta", expected_sources: revisionSources.map((source) => source.binding) };
  assert.doesNotThrow(() => stageTest.assertSourceLineage(revisionRequest, revisionSources, authority));
  assert.throws(() => stageTest.assertSourceLineage(revisionRequest, [...revisionSources].reverse(), authority), /missing, reordered, or invalid/);
  assert.throws(() => stageTest.assertSourceLineage({ ...revisionRequest, plan_identity: "forged-plan" }, revisionSources, authority), /review lineage/);

  const allowedSynthesis = synthesisSource("ALLOWED", "NONE");
  const responseRequest: StageRequest = { ...base, requested_stage: "DELIVERY_RESPONSE", recipient_role: "Track D", sender_role: "Meta", candidate_identity: "candidate-1", expected_sources: [] };
  const allowedSource = [resolvedSource("FINAL_SYNTHESIS", allowedSynthesis, 0)];
  assert.doesNotThrow(() => stageTest.assertSourceLineage(responseRequest, allowedSource, authority));
  assert.doesNotThrow(() => stageTest.assertOutputSourceLineage(responseRequest, allowedSource, "ACK_ONLY", {}));

  const fixSynthesis = synthesisSource("FIX_REQUIRED", '[{"id":"FSR-002"}]');
  const fixSource = [resolvedSource("FINAL_SYNTHESIS", fixSynthesis, 0)];
  const fixRequest = { ...responseRequest, finding_ids: ["FSR-002"] };
  assert.throws(() => stageTest.assertOutputSourceLineage(fixRequest, fixSource, "ACK_ONLY", {}), /ACK_ONLY requires/);
  assert.doesNotThrow(() => stageTest.assertOutputSourceLineage(fixRequest, fixSource, "FIX_PLAN_REQUIRED", { Candidate: "candidate-1", "Accepted finding IDs": '["FSR-002"]' }));
  assert.throws(() => stageTest.assertOutputSourceLineage(fixRequest, fixSource, "FIX_PLAN_REQUIRED", { Candidate: "candidate-1", "Accepted finding IDs": '["FSR-999"]' }), /finding lineage/);
  assert.throws(() => stageTest.assertOutputSourceLineage(fixRequest, fixSource, "FIX_PLAN_REQUIRED", { Candidate: "other", "Accepted finding IDs": '["FSR-002"]' }), /exact candidate/);

  const closeoutSources = [
    resolvedSource("FINAL_SYNTHESIS", allowedSynthesis, 0),
    resolvedSource("DELIVERY_RESPONSE", "ACK_ONLY\n", 1),
    resolvedSource("PROPOSED_DELTA", "NONE\n", 2),
    resolvedSource("CLOSEOUT_AUTHORITY", JSON.stringify({ schema_version: "closeout-authority.v1", candidate_identity: "candidate-1", worktree_identity: "git:abc", worktree_proof_sha256: worktreeProofSha256(resolver.worktree), allowed_paths: [], commit_scope: { mode: "NO_COMMIT", reason: "fixture" }, staging_precondition: "EMPTY", global_apply: false, restart: false }), 3),
  ];
  const closeoutRequest: StageRequest = { ...base, requested_stage: "CLOSEOUT", recipient_role: "Meta", candidate_identity: "candidate-1", expected_sources: closeoutSources.map((source) => source.binding) };
  assert.doesNotThrow(() => stageTest.assertSourceLineage(closeoutRequest, closeoutSources, authority, resolver.worktree));
  assert.doesNotThrow(() => stageTest.assertOutputSourceLineage(closeoutRequest, closeoutSources, "NOT_PERFORMED", { Commit: "NO_COMMIT reason=fixture", "Staged explicit paths": "NONE" }, resolver.worktree));
  assert.throws(() => stageTest.assertOutputSourceLineage(closeoutRequest, closeoutSources, "NOT_PERFORMED", { Commit: "NO_COMMIT reason=forged", "Staged explicit paths": "NONE" }, resolver.worktree), /NO_COMMIT authority/);
  const dirtyProof: WorktreeProof = { ...resolver.worktree, status_clean: false, has_unstaged_or_untracked: true, status_sha256: "6".repeat(64) };
  const dirtySources = [...closeoutSources];
  dirtySources[3] = resolvedSource("CLOSEOUT_AUTHORITY", JSON.stringify({ schema_version: "closeout-authority.v1", candidate_identity: "candidate-1", worktree_identity: "git:abc", worktree_proof_sha256: worktreeProofSha256(dirtyProof), allowed_paths: [], commit_scope: { mode: "NO_COMMIT", reason: "fixture" }, staging_precondition: "EMPTY", global_apply: false, restart: false }), 3);
  assert.throws(() => stageTest.assertSourceLineage(closeoutRequest, dirtySources, authority, dirtyProof), /NO_COMMIT authority/);
  assert.throws(() => stageTest.assertSourceLineage(closeoutRequest, closeoutSources.slice(0, 3), authority), /missing, reordered, or invalid/);
  const commitSources = [...closeoutSources];
  commitSources[0] = resolvedSource("FINAL_SYNTHESIS", synthesisSource("ALLOWED", "NONE", '["ops/PROJECT_STATE.md"]'), 0);
  commitSources[2] = resolvedSource("PROPOSED_DELTA", '["ops/PROJECT_STATE.md"]\n', 2);
  const commitProof: WorktreeProof = { ...resolver.worktree, staged_paths: ["ops/PROJECT_STATE.md"], index_sha256: "4".repeat(64), status_sha256: "5".repeat(64) };
  commitSources[3] = resolvedSource("CLOSEOUT_AUTHORITY", JSON.stringify({ schema_version: "closeout-authority.v1", candidate_identity: "candidate-1", worktree_identity: "git:abc", worktree_proof_sha256: worktreeProofSha256(commitProof), allowed_paths: ["ops/PROJECT_STATE.md"], commit_scope: { mode: "COMMIT", paths: ["ops/PROJECT_STATE.md"] }, staging_precondition: "EXACT", global_apply: false, restart: false }), 3);
  assert.doesNotThrow(() => stageTest.assertSourceLineage(closeoutRequest, commitSources, authority, commitProof));
  assert.doesNotThrow(() => stageTest.assertOutputSourceLineage(closeoutRequest, commitSources, "NOT_PERFORMED", { Commit: `sha=${"a".repeat(40)}; tree=${"b".repeat(40)}; message=fixture`, "Staged explicit paths": '["ops/PROJECT_STATE.md"]' }, commitProof));
  assert.throws(() => stageTest.assertOutputSourceLineage(closeoutRequest, commitSources, "NOT_PERFORMED", { Commit: `sha=${"a".repeat(40)}; tree=${"b".repeat(40)}; message=fixture`, "Staged explicit paths": '["other.md"]' }, commitProof), /COMMIT authority/);
  const forgedAuthority = [...closeoutSources];
  forgedAuthority[3] = resolvedSource("CLOSEOUT_AUTHORITY", JSON.stringify({ schema_version: "closeout-authority.v1", candidate_identity: "other", worktree_identity: "git:abc", worktree_proof_sha256: worktreeProofSha256(resolver.worktree), allowed_paths: [], commit_scope: { mode: "NO_COMMIT", reason: "fixture" }, staging_precondition: "EMPTY", global_apply: false, restart: false }), 3);
  assert.throws(() => stageTest.assertSourceLineage(closeoutRequest, forgedAuthority, authority, resolver.worktree), /authority envelope/);
});

test("FSR-030: COMMIT CLOSEOUT accepts only the authorized changed postcondition", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-closeout-postcondition-"));
  try {
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.nextCommand = "/closeout-commit";
    const commitSha = "a".repeat(40);
    const before: WorktreeProof = { ...resolver.worktree, staged_paths: ["ops/PROJECT_STATE.md"], status_clean: false, has_unstaged_or_untracked: false };
    resolver.worktree = before;
    resolver.worktreeAfterResponse = { ...before, head_sha256: sha256(commitSha), head_tree_sha256: sha256("b".repeat(40)), head_parent_count: 1, sole_parent_sha256: before.head_sha256, committed_paths: ["ops/PROJECT_STATE.md"], index_sha256: "7".repeat(64), status_sha256: sha256(Buffer.alloc(0)), staged_paths: [], status_clean: true, has_unstaged_or_untracked: false };
    const synthesis = synthesisSource("ALLOWED", "NONE", '["ops/PROJECT_STATE.md"]');
    resolver.resolvedSources = [
      resolvedSource("FINAL_SYNTHESIS", synthesis, 0), resolvedSource("DELIVERY_RESPONSE", "ACK_ONLY\n", 1), resolvedSource("PROPOSED_DELTA", '["ops/PROJECT_STATE.md"]\n', 2),
      resolvedSource("CLOSEOUT_AUTHORITY", JSON.stringify({ schema_version: "closeout-authority.v1", candidate_identity: "candidate-1", worktree_identity: "git:abc", worktree_proof_sha256: worktreeProofSha256(before), allowed_paths: ["ops/PROJECT_STATE.md"], commit_scope: { mode: "COMMIT", paths: ["ops/PROJECT_STATE.md"] }, staging_precondition: "EXACT", global_apply: false, restart: false }), 3),
    ];
    const response = [
      "CLOSEOUT + COMMIT RESULT", "Target: fal", "Epic: E", "Accountable Lane / class / profile: Track D / TRACK / track-d",
      "workflow_verdict: COMPLETE", "domain_verdict: ACCEPTED", "routing_verdict: CLOSED", "next_role_action: NONE",
      "State/Combined/findings/evidence reconciliation: result=PASS; details=reconciled", "Candidate identity: candidate-1",
      'Staged explicit paths: ["ops/PROJECT_STATE.md"]', `Verification: result=PASS; candidate=candidate-1; committed_tree=${"b".repeat(40)}; details=verified`,
      `Commit: sha=${commitSha}; tree=${"b".repeat(40)}; message=closeout`, "Push: NOT_PERFORMED",
    ].join("\n");
    const engine = new StageEngine(new StateStore(root), resolver, new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({ info: { id: "assistant-closeout", role: "assistant", sessionID: "session-meta" }, parts: [{ id: "part-closeout", type: "text", text: response, messageID: "assistant-closeout", sessionID: "session-meta" }] }));
    }));
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const stage: StageRequest = { ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), request_id: "request-closeout-postcondition", requested_stage: "CLOSEOUT", recipient_role: "Meta", candidate_identity: "candidate-1", expected_sources: resolver.resolvedSources.map((source) => source.binding) };
    const baselineResolved = await resolver.resolveStageAuthority(resolver.authority!, stage);
    const postResolved = await resolver.resolveStageAuthority(resolver.authority!, stage);
    const postResolvedFinal = await resolver.resolveStageAuthority(resolver.authority!, stage);
    const closeoutFields = { Commit: `sha=${commitSha}; tree=${"b".repeat(40)}; message=closeout`, "Staged explicit paths": '["ops/PROJECT_STATE.md"]' };
    assert.doesNotThrow(() => stageTest.assertResolvedStagePostResponse(postResolvedFinal, baselineResolved, stage, closeoutFields, created.run_authority_sha256));
    assert.throws(() => stageTest.assertResolvedStagePostResponse({ ...postResolvedFinal, worktree: { ...postResolvedFinal.worktree!, head_tree_sha256: sha256("c".repeat(40)) } }, baselineResolved, stage, closeoutFields, created.run_authority_sha256), /postcondition failed/);
    assert.throws(() => stageTest.assertResolvedStagePostResponse({ ...postResolvedFinal, worktree: { ...postResolvedFinal.worktree!, committed_paths: ["other.md"] } }, baselineResolved, stage, closeoutFields, created.run_authority_sha256), /postcondition failed/);
    assert.throws(() => stageTest.assertResolvedStagePostResponse({ ...postResolvedFinal, worktree: { ...postResolvedFinal.worktree!, head_parent_count: 2 } }, baselineResolved, stage, closeoutFields, created.run_authority_sha256), /postcondition failed/);
    assert.throws(() => stageTest.assertResolvedStagePostResponse({ ...postResolvedFinal, worktree: { ...postResolvedFinal.worktree!, sole_parent_sha256: "f".repeat(64) } }, baselineResolved, stage, closeoutFields, created.run_authority_sha256), /postcondition failed/);
    resolver.resolutionCalls = 0;
    const result = await engine.invokeStage(stage);
    assert.equal(result.operation_status, "SUCCEEDED", JSON.stringify(result));
    assert.equal(calls, 1);
    const terminal = readFileSync(path.join(root, "runs", created.run_id, "operations", result.operation_id, "terminal.md"), "utf8");
    assert.match(terminal, /CLOSEOUT DURABLE PROJECTION/);
    assert.doesNotMatch(terminal, new RegExp(commitSha));
    assert.doesNotMatch(terminal, new RegExp("b".repeat(40)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolve-stage reconciles a crash-left DISPATCHING operation without sending", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-crash-reconcile-"));
  try {
    let calls = 0;
    const store = new StateStore(root);
    const resolver = new FakeResolver();
    const engine = new StageEngine(store, resolver, new CommandClient(async () => {
      calls += 1;
      throw new Error("delivery unknown");
    }), { collect: async () => [] });
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const uncertain = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    const operation = store.loadOperation(created.run_id, uncertain.operation_id);
    store.updateOperation(created.run_id, operation.operation_id, operation.revision, { status: "DISPATCHING" });

    const reconciled = await engine.resolveStage(created.run_id, operation.operation_id);
    assert.equal(reconciled.operation_status, "UNCERTAIN");
    assert.equal(reconciled.transport_status, "NO_SEND");
    assert.equal(calls, 1);
    assert.equal(store.loadOperation(created.run_id, operation.operation_id).status, "UNCERTAIN");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolve-stage recovers one exact command-root terminal after an uncertain POST without resending", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-command-root-reconcile-"));
  try {
    mkdirSync(path.join(root, ".opencode-router"));
    let calls = 0;
    const store = new StateStore(root);
    const resolver = new FakeResolver();
    resolver.capabilityMode = "PRODUCTION_RESPONSE_FIRST";
    resolver.fenceTargetRoot = root;
    const recovered = {
      id: "assistant-recovered",
      parent_id: "user-command-root",
      session_id: resolver.recipientSessionId,
      text: planReviewSource(),
      after_baseline: true,
      command_root_correlated: true,
    };
    const engine = new StageEngine(store, resolver, new CommandClient(async () => {
      calls += 1;
      throw new Error("delivery unknown");
    }), {
      captureBaseline: async () => ({ message_id: "assistant-baseline", identity_sha256: sha256("assistant-baseline"), captured_at: new Date().toISOString() }),
      collect: async () => [recovered],
    });
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const uncertain = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    assert.equal(uncertain.operation_status, "UNCERTAIN");
    resolver.capabilityIdentityGeneration = "-rotated-after-dispatch";
    resolver.authority = { ...resolver.authority!, target_profile_sha256: sha256("rotated-profile") };

    const reconciled = await engine.resolveStage(created.run_id, uncertain.operation_id);
    assert.equal(reconciled.operation_status, "SUCCEEDED", JSON.stringify(reconciled));
    assert.equal(reconciled.transport_status, "TRANSCRIPT_RECONCILED");
    assert.deepEqual(reconciled.allowed_next, ["PLAN_REVISION"]);
    assert.equal(calls, 1);
    assert.equal(store.loadOperation(created.run_id, uncertain.operation_id).status, "SUCCEEDED");
    assert.match(readFileSync(path.join(root, "runs", created.run_id, "operations", uncertain.operation_id, "terminal.md"), "utf8"), /Plan artifact: plan-1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolve-stage keeps command-root recovery uncertain when strict terminals are ambiguous", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-command-root-ambiguous-"));
  try {
    mkdirSync(path.join(root, ".opencode-router"));
    let calls = 0;
    const store = new StateStore(root);
    const resolver = new FakeResolver();
    resolver.capabilityMode = "PRODUCTION_RESPONSE_FIRST";
    resolver.fenceTargetRoot = root;
    const candidate = (id: string) => ({ id, parent_id: "user-command-root", session_id: resolver.recipientSessionId, text: resolver.sourceContent, after_baseline: true, command_root_correlated: true });
    const engine = new StageEngine(store, resolver, new CommandClient(async () => {
      calls += 1;
      throw new Error("delivery unknown");
    }), {
      captureBaseline: async () => ({ message_id: "assistant-baseline", identity_sha256: sha256("assistant-baseline"), captured_at: new Date().toISOString() }),
      collect: async () => [candidate("assistant-one"), candidate("assistant-two")],
    });
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const uncertain = await engine.invokeStage(request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)));
    const reconciled = await engine.resolveStage(created.run_id, uncertain.operation_id);
    assert.equal(reconciled.operation_status, "UNCERTAIN");
    assert.equal(reconciled.transport_status, "NO_SEND");
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("P0B production mode reaches response-first stage engine and consumes its grant once", { skip: process.platform !== "win32" }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-p0b-engine-"));
  try {
    mkdirSync(path.join(root, ".opencode-router"));
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.capabilityMode = "P0B_ISOLATED";
    resolver.fenceTargetRoot = root;
    const terminal = planReviewSource();
    const client = new CommandClient(async () => {
      calls += 1;
      return new Response(JSON.stringify({
        info: { id: "assistant-p0b", role: "assistant", sessionID: "session-meta", parentID: "user-p0b" },
        parts: [
          { id: "step-start-p0b", type: "step-start", messageID: "assistant-p0b", sessionID: "session-meta", snapshot: "before" },
          { id: "text-p0b", type: "text", text: terminal, messageID: "assistant-p0b", sessionID: "session-meta" },
          { id: "step-finish-p0b", type: "step-finish", messageID: "assistant-p0b", sessionID: "session-meta", reason: "stop", snapshot: "after", cost: 0, tokens: { total: 1, input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } },
        ],
      }));
    });
    const store = new StateStore(root);
    const snapshots = { captureBaseline: async () => ({ message_id: "baseline-p0b", identity_sha256: sha256("baseline-p0b"), captured_at: new Date().toISOString() }), collect: async () => [] };
    const engine = new StageEngine(store, resolver, client, snapshots);
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const current = { ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), expected_contract_version: "awc-4.1.1" as const };
    const result = await engine.invokeStage(current);
    assert.equal(result.operation_status, "SUCCEEDED", JSON.stringify(result));
    assert.equal(calls, 1);
    const capabilitySha = sha256("P0B_ISOLATED");
    assert.match(readFileSync(path.join(root, "capability-uses", `${capabilitySha}.json`), "utf8"), /"status":"CONSUMED"/);

    const next = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const replay = { ...request(next.run_id, next.run_authority_sha256, sha256(resolver.sourceContent)), request_id: "request-p0b-replay", review_risk: "high_risk" as const, expected_contract_version: "awc-4.1.1" as const };
    await assert.rejects(() => engine.invokeStage(replay), /one-use capability is already claimed or consumed/);
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("P0B grant remains consumed for HTTP, timeout, and malformed-response POST outcomes", { skip: process.platform !== "win32" }, async () => {
  const cases: Array<[string, FetchLike]> = [
    ["http", async () => new Response("failure", { status: 503 })],
    ["timeout", async () => { throw new Error("timeout after POST"); }],
    ["malformed", async () => new Response('{"info":')],
  ];
  for (const [name, fetch] of cases) {
    const root = mkdtempSync(path.join(tmpdir(), `fal-router-p0b-${name}-`));
    try {
      mkdirSync(path.join(root, ".opencode-router"));
      const resolver = new FakeResolver();
      resolver.capabilityMode = "P0B_ISOLATED";
      resolver.fenceTargetRoot = root;
      const store = new StateStore(root);
      const engine = new StageEngine(store, resolver, new CommandClient(fetch), { captureBaseline: async () => ({ message_id: `baseline-${name}`, identity_sha256: sha256(`baseline-${name}`), captured_at: new Date().toISOString() }), collect: async () => [] });
      const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
      const result = await engine.invokeStage({ ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), request_id: `request-${name}`, expected_contract_version: "awc-4.1.1" });
      assert.equal(result.operation_status, "UNCERTAIN", `${name}: ${JSON.stringify(result)}`);
      assert.equal(result.transport_status, "DELIVERY_UNCERTAIN");
      assert.match(readFileSync(path.join(root, "capability-uses", `${sha256("P0B_ISOLATED")}.json`), "utf8"), /"status":"CONSUMED"/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("P0B pre-POST capability drift sends nothing and releases an unconsumed grant", { skip: process.platform !== "win32" }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-p0b-drift-"));
  try {
    mkdirSync(path.join(root, ".opencode-router"));
    let calls = 0;
    const resolver = new FakeResolver();
    resolver.capabilityMode = "P0B_ISOLATED";
    resolver.capabilityDriftOnCall = 2;
    resolver.fenceTargetRoot = root;
    const store = new StateStore(root);
    const engine = new StageEngine(store, resolver, new CommandClient(async () => { calls += 1; return new Response(); }), { captureBaseline: async () => ({ message_id: "baseline-drift", identity_sha256: sha256("baseline-drift"), captured_at: new Date().toISOString() }), collect: async () => [] });
    const created = await engine.newRun({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:abc" });
    const result = await engine.invokeStage({ ...request(created.run_id, created.run_authority_sha256, sha256(resolver.sourceContent)), expected_contract_version: "awc-4.1.1" });
    assert.equal(result.operation_status, "FAILED_TRANSPORT");
    assert.equal(result.transport_status, "NOT_SENT");
    assert.equal(calls, 0);
    assert.match(readFileSync(path.join(root, "capability-uses", `${sha256("P0B_ISOLATED")}.json`), "utf8"), /"status":"RELEASED"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
