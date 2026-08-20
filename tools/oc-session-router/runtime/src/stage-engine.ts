import { randomUUID } from "node:crypto";
import {
  authoritySha256,
  assertSafeRelativePath,
  canonicalFindingIds,
  canonicalize,
  commandForStage,
  parseStrictJson,
  parseOutputShape,
  resolveCanonPhase,
  sameSources,
  sha256,
  validateOutputBinding,
  type RunAuthority,
  type RunRequest,
  type SourceBinding,
  type SourceClass,
  type StageInvocation,
  type StageRequest,
} from "./contracts.js";
import { StateStore } from "./state-store.js";
import { CommandClient, assertPrivateTransportBinding, reconcileSnapshot, type SnapshotCandidate, type TransportBinding } from "./transport.js";
import { worktreeProofSha256, type WorktreeProof } from "./worktree-reader.js";

export interface ResolvedSource {
  binding: SourceBinding;
  content: string;
}

export interface ResolvedStageAuthority {
  run_authority: RunAuthority;
  sources: ResolvedSource[];
  transport: TransportBinding;
  capability: { mode: "DISABLED" | "FIXTURE_ONLY"; identity_sha256: string };
  privacy: { absolute_paths: string[]; private_values?: string[] };
  worktree?: WorktreeProof;
}

export interface AuthorityResolver {
  deriveRunAuthority(request: RunRequest, identity: { runId: string; createdAt: string }): Promise<RunAuthority>;
  resolveStageCapability(runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority["capability"]>;
  resolveStageAuthority(runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority>;
}

export interface SnapshotReader {
  collect(runId: string, operationId: string): Promise<SnapshotCandidate[]>;
}

export interface StageResult {
  schema_version: "stage-result.v1";
  run_id: string;
  operation_id: string;
  operation_status: string;
  transport_status: string;
  output_status: string;
  binding_status: string;
  terminal_status: string;
  allowed_next: string[];
  artifact_sha256: string;
  message_id_sha256: string;
  response_sha256: string;
  reason: string;
  auto_advance: false;
}

export class StageEngine {
  constructor(
    private readonly store: StateStore,
    private readonly resolver?: AuthorityResolver,
    private readonly client?: CommandClient,
    private readonly snapshots?: SnapshotReader,
  ) {}

  async newRun(request: RunRequest): Promise<{ run_id: string; run_authority_sha256: string; auto_advance: false }> {
    if (!this.resolver) throw new Error("Authority resolver is unavailable for new-run");
    const runId = `run-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const authority = await this.resolver.deriveRunAuthority(request, { runId, createdAt });
    if (authority.run_id !== runId || authority.created_at !== createdAt || authority.target_id !== request.target_id || authority.worktree_identity !== request.expected_worktree_identity) {
      throw new Error("Derived run authority does not bind the run request");
    }
    const digest = authoritySha256(authority);
    this.store.createRun(authority, digest);
    return { run_id: runId, run_authority_sha256: digest, auto_advance: false };
  }

  getRun(runId: string): unknown {
    const loaded = this.store.loadRun(runId);
    return { schema_version: "run-projection.v1", run_id: loaded.run.run_id, target_id: loaded.run.target_id, worktree_identity: loaded.run.worktree_identity, run_authority_sha256: loaded.run.run_authority_sha256, review_cycle: loaded.authority.review_cycle, auto_advance: false };
  }

  async invokeStage(input: StageRequest): Promise<StageResult> {
    if (!this.resolver || !this.client) throw new Error("Dispatch dependencies are unavailable for invoke-stage");
    const request: StageRequest = { ...input, finding_ids: canonicalFindingIds(input.finding_ids) };
    const loaded = this.store.loadRun(request.run_id);
    if (loaded.run.run_authority_sha256 !== request.run_authority_sha256 || authoritySha256(loaded.authority) !== request.run_authority_sha256) throw new Error("Run authority hash mismatch");
    if (request.target_id !== loaded.authority.target_id || request.worktree_identity !== loaded.authority.worktree_identity) throw new Error("Stage request run binding mismatch");
    this.assertRequestAuthority(request, loaded.authority);
    const capability = await this.resolver.resolveStageCapability(loaded.authority, request);
    if (capability.mode !== "FIXTURE_ONLY") throw new Error("Production command dispatch is disabled until a reviewed P0B capability transaction");
    const resolved = await this.resolver.resolveStageAuthority(loaded.authority, request);
    if (authoritySha256(resolved.run_authority) !== request.run_authority_sha256) throw new Error("Current target authority drifted");
    if (canonicalize(resolved.capability) !== canonicalize(capability)) throw new Error("Dispatch capability drifted before authority resolution");
    assertPrivateTransportBinding(resolved.transport);
    assertArtifactSafe(canonicalize(request), resolved.transport, resolved.privacy.absolute_paths, resolved.privacy.private_values);
    const resolvedBindings = resolved.sources.map((source) => source.binding);
    if (!sameSources(request.expected_sources, resolvedBindings)) throw new Error("SOURCE_SUBSTITUTION: expected sources differ from current protected authority");
    for (const source of resolved.sources) if (sha256(Buffer.from(source.content, "utf8")) !== source.binding.sha256) throw new Error("Source content hash mismatch");
    assertSourceLineage(request, resolved.sources, loaded.authority, resolved.worktree);
    this.assertTransition(request);
    const argument = renderCommandArgument(request, resolved.sources);
    for (const source of resolved.sources) assertArtifactSafe(source.content, resolved.transport, resolved.privacy.absolute_paths, resolved.privacy.private_values);
    assertArtifactSafe(argument, resolved.transport, resolved.privacy.absolute_paths, resolved.privacy.private_values);
    const command = commandForStage(request.requested_stage);
    const operationId = `op-${randomUUID()}`;
    const recipientSessionSha256 = sha256(resolved.transport.session_id);
    const semanticKey = sha256(canonicalize({ target_id: request.target_id, worktree_identity: request.worktree_identity, stage: request.requested_stage, canon_phase: resolveCanonPhase(request.requested_stage, request.plan_class), sources: resolvedBindings, plan: request.plan_identity, candidate: request.candidate_identity, cycle: request.review_cycle, findings: request.finding_ids, review_risk: request.review_risk, project_review_context: request.project_review_context, recipient_session_sha256: recipientSessionSha256, active_route_generation: resolved.run_authority.active_route_generation }));
    const invocation: StageInvocation = {
      ...request,
      schema_version: "stage-invocation.v1",
      operation_id: operationId,
      canon_phase: resolveCanonPhase(request.requested_stage, request.plan_class),
      command_name: command,
      command_argument_sha256: sha256(argument),
      command_body_sha256: sha256(canonicalize({ command, arguments: argument })),
      semantic_key: semanticKey,
      recipient_session_sha256: recipientSessionSha256,
    };
    const intent = {
      schema_version: "dispatch-intent.v1",
      operation_id: operationId,
      command_name: command,
      command_body_sha256: invocation.command_body_sha256,
      recipient_session_sha256: invocation.recipient_session_sha256,
      authority_sha256: request.run_authority_sha256,
      created_at: new Date().toISOString(),
    };
    const intentHash = sha256(canonicalize(intent));
    const leaseKey = sha256(`${resolved.transport.server_fingerprint}\n${resolved.transport.session_id}`);
    this.store.claimSemanticAction(semanticKey, request.run_id, operationId);
    let release: (() => void) | undefined;
    try {
      release = this.store.acquireLease(leaseKey, { schema_version: "dispatch-lease.v1", server_fingerprint_sha256: sha256(resolved.transport.server_fingerprint), session_sha256: recipientSessionSha256, operation_class: request.requested_stage, holder: operationId, acquired_at: new Date().toISOString(), fencing_generation: randomUUID() });
      let operation;
      let responseReceived = false;
      let sendAttempted = false;
      try {
        operation = this.store.createOperation(request.run_id, invocation, intent, intentHash);
        operation = this.store.updateOperation(request.run_id, operationId, operation.revision, { status: "DISPATCHING" });
        const preSend = await this.resolver.resolveStageAuthority(loaded.authority, request);
        assertResolvedStageStable(preSend, resolved, request.run_authority_sha256);
        sendAttempted = true;
        const receipt = await this.client.send(preSend.transport, command, argument, 120_000);
        responseReceived = true;
        assertArtifactSafe(receipt.terminal_markdown, preSend.transport, preSend.privacy.absolute_paths, preSend.privacy.private_values);
        const parsed = parseOutputShape(request.requested_stage, receipt.terminal_markdown);
        const postResponse = await this.resolver.resolveStageAuthority(loaded.authority, request);
        assertResolvedStagePostResponse(postResponse, preSend, request, parsed.fields, request.run_authority_sha256);
        assertOutputSourceLineage(request, preSend.sources, parsed.terminal, parsed.fields, preSend.worktree);
        validateOutputBinding(parsed, {
          target: loaded.authority.target_identity,
          epic: loaded.authority.epic,
          lane: `${loaded.authority.accountable_lane} / ${loaded.authority.accountable_class} / ${loaded.authority.accountable_profile}`,
          ...(request.candidate_identity === "UNDECLARED" || !["STEP_REVIEW", "CLOSEOUT"].includes(request.requested_stage) ? {} : { candidate: request.candidate_identity }),
          plan: request.plan_identity,
          plan_class: request.plan_class,
        });
        const artifact = request.requested_stage === "CLOSEOUT" && parsed.fields.Commit?.startsWith("sha=")
          ? closeoutDurableProjection(receipt.terminal_markdown, parsed.fields.Commit)
          : `${receipt.terminal_markdown.replace(/\r\n/g, "\n").trim()}\n`;
        this.store.writeArtifact(request.run_id, operationId, "terminal", artifact);
        const result = makeResult(request, operationId, "SUCCEEDED", "RESPONSE_ACCEPTED", "VALID", "BOUND", "VALID", allowedNext(request.requested_stage, parsed.terminal), sha256(Buffer.from(artifact, "utf8")), "synchronous response validated", sha256(receipt.message_id), receipt.response_sha256);
        this.store.writeResult(request.run_id, operationId, result);
        this.store.updateOperation(request.run_id, operationId, operation.revision, { status: "SUCCEEDED" });
        this.store.settleSemanticAction(semanticKey, request.run_id, operationId, "CONSUMED");
        return result;
      } catch (error) {
        if (!operation) {
          this.store.settleSemanticAction(semanticKey, request.run_id, operationId, "RELEASED");
          throw error;
        }
        const current = this.store.loadOperation(request.run_id, operationId);
        const failedStatus = responseReceived ? "FAILED_OUTPUT" : sendAttempted ? "UNCERTAIN" : "FAILED_TRANSPORT";
        if (["CREATED", "DISPATCHING", "ACTIVE", "RECONCILING"].includes(current.status)) this.store.updateOperation(request.run_id, operationId, current.revision, { status: failedStatus });
        const result = makeResult(
          request,
          operationId,
          failedStatus,
          responseReceived ? "RESPONSE_ACCEPTED" : sendAttempted ? "DELIVERY_UNCERTAIN" : "NOT_SENT",
          responseReceived ? "INVALID" : "UNVALIDATED",
          "UNVALIDATED",
          "UNVALIDATED",
          [],
          "",
          safeFailureReason(error, resolved.transport),
        );
        this.store.writeResult(request.run_id, operationId, result);
        this.store.settleSemanticAction(semanticKey, request.run_id, operationId, sendAttempted || responseReceived ? "CONSUMED" : "RELEASED");
        return result;
      }
    } catch (error) {
      if (!release) this.store.settleSemanticAction(semanticKey, request.run_id, operationId, "RELEASED");
      throw error;
    } finally {
      release?.();
    }
  }

  private assertTransition(request: StageRequest): void {
    const operations = this.store.listOperations(request.run_id);
    const previous = operations.at(-1);
    if (!previous) {
      const authority = this.store.loadRun(request.run_id).authority;
      if (authority.next_command !== `/${commandForStage(request.requested_stage)}`) throw new Error("Requested first stage does not match current target-state command authority");
      return;
    }
    if (previous.status === "SUCCEEDED") {
      const result = this.store.loadResult(request.run_id, previous.operation_id) as { allowed_next?: unknown };
      if (!Array.isArray(result.allowed_next) || !result.allowed_next.includes(request.requested_stage)) throw new Error("Requested stage is not an allowed transition");
      if (previous.invocation.requested_stage === "PLAN_REVISION" && request.requested_stage === "IMPLEMENT" && (previous.invocation.plan_class !== request.plan_class || previous.invocation.plan_identity !== request.plan_identity)) throw new Error("PLAN_REVISION to IMPLEMENT plan class or identity changed");
      return;
    }
    if (previous.invocation.requested_stage !== request.requested_stage) throw new Error("Failed stage may only be retried as the same explicit stage transition");
  }

  private assertRequestAuthority(request: StageRequest, authority: RunAuthority): void {
    const bindings: Array<[keyof StageRequest, unknown]> = [
      ["state_revision", authority.state_revision],
      ["state_sha256", authority.state_sha256],
      ["combined_selector", authority.combined_selector],
      ["combined_span_sha256", authority.combined_span_sha256],
      ["configuration_identity", authority.configuration_identity],
      ["active_route_generation", authority.active_route_generation],
      ["review_cycle", authority.review_cycle],
      ["wave", authority.wave],
      ["epic", authority.epic],
      ["accountable_lane", authority.accountable_lane],
      ["accountable_class", authority.accountable_class],
      ["accountable_profile", authority.accountable_profile],
    ];
    for (const [field, expected] of bindings) if (request[field] !== expected) throw new Error(`${field} binding mismatch`);
    if (request.issued_by !== "orchestrator") throw new Error("Stage request issued_by is not orchestrator authority");
    if (request.expected_contract_version !== "awc-3.1") throw new Error("Stage request contract version mismatch");
    if (request.allowed_side_effect_class !== "ADDRESSED_SESSION_COMMAND") throw new Error("Stage request side-effect class does not authorize addressed command transport");
    const metaStages = new Set(["PLAN_REVIEW", "STEP_REVIEW", "CLOSEOUT"]);
    const expectedRecipient = metaStages.has(request.requested_stage) ? "Meta" : authority.accountable_lane;
    if (request.recipient_role !== expectedRecipient) throw new Error("Stage request recipient role does not match protected stage authority");
    const expectedSender = new Set(["PLAN_REVISION", "DELIVERY_RESPONSE"]).has(request.requested_stage) ? "Meta" : authority.accountable_lane;
    if (request.sender_role !== expectedSender) throw new Error("Stage request sender role does not match protected stage authority");
  }

  async resolveStage(runId: string, operationId: string): Promise<StageResult> {
    let operation = this.store.loadOperation(runId, operationId);
    if (!["DISPATCHING", "ACTIVE", "UNCERTAIN", "RECONCILING"].includes(operation.status)) throw new Error("Operation is not reconcilable");
    if (!this.snapshots) throw new Error("Snapshot reconciliation capability is unavailable");
    if (operation.status !== "RECONCILING") operation = this.store.updateOperation(runId, operationId, operation.revision, { status: "RECONCILING" });
    const candidates = await this.snapshots.collect(runId, operationId);
    const resolution = reconcileSnapshot(candidates, {
      sessionSha256: operation.invocation.recipient_session_sha256,
      parentId: `user-${operation.send_attempt_id}`,
      terminal: (text) => {
        try { parseOutputShape(operation.invocation.requested_stage, text); return true; } catch { return false; }
      },
    });
    const result = resolution.status !== "TRANSCRIPT_RECONCILED" || !resolution.candidate
      ? makeResult(operation.invocation, operationId, "UNCERTAIN", "NO_SEND", "AMBIGUOUS", "UNVALIDATED", "UNVALIDATED", [], "", resolution.reason)
      : makeResult(operation.invocation, operationId, "UNCERTAIN", "NO_SEND", "CORRELATION_NOT_PROVEN_ON_INSTALLED_SERVER", "UNVALIDATED", "UNVALIDATED", [], "", "fixture correlation cannot promote installed-server success before P0B");
    this.store.updateResult(runId, operationId, result);
    this.store.updateOperation(runId, operationId, operation.revision, { status: "UNCERTAIN" });
    return result;
  }
}

const SOURCE_CLASSES: Record<StageRequest["requested_stage"], readonly SourceClass[]> = {
  SEQ_NEXT: ["PLANNING_CONTEXT"],
  PLAN_REVIEW: ["PLAN"],
  PLAN_REVISION: ["PLAN", "META_PLAN_REVIEW"],
  IMPLEMENT: ["REVISED_PLAN"],
  STEP_REVIEW: ["IMPLEMENTATION_RESULT", "ACCEPTANCE_EVIDENCE"],
  DELIVERY_RESPONSE: ["FINAL_SYNTHESIS"],
  CLOSEOUT: ["FINAL_SYNTHESIS", "DELIVERY_RESPONSE", "PROPOSED_DELTA", "CLOSEOUT_AUTHORITY"],
};

function sourceField(text: string, name: string): string {
  const matches = [...text.replace(/\r\n/g, "\n").matchAll(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.+)$`, "gm"))];
  const values = [...new Set(matches.map((match) => match[1]?.trim()).filter((value): value is string => Boolean(value)))];
  if (values.length !== 1) throw new Error(`Protected source must contain one stable ${name}`);
  const value = values[0]!;
  return value.startsWith("`") && value.endsWith("`") && value.length > 2 ? value.slice(1, -1) : value;
}

function authorityBinding(authority: RunAuthority): { target: string; epic: string; lane: string } {
  return { target: authority.target_identity, epic: authority.epic, lane: `${authority.accountable_lane} / ${authority.accountable_class} / ${authority.accountable_profile}` };
}

function planReceipt(plan: string, request: StageRequest, authority: RunAuthority): { planClass: StageRequest["plan_class"]; planIdentity: string } {
  const parsed = parseOutputShape(plan.trimStart().startsWith("FIX_PLAN_REQUIRED\n") ? "DELIVERY_RESPONSE" : "SEQ_NEXT", plan);
  const planClass = parsed.plan_class ?? "EPIC_PLAN";
  const identityField = planClass === "REVIEW_FIX_PLAN" ? "Fix-plan artifact" : "Plan artifact";
  validateOutputBinding(parsed, { ...authorityBinding(authority), ...(request.candidate_identity === "UNDECLARED" ? {} : { candidate: request.candidate_identity }), plan_class: planClass });
  return { planClass, planIdentity: parsed.fields[identityField]! };
}

function parseProposedDelta(value: string): string[] {
  if (value === "NONE") return [];
  const parsed = parseStrictJson(value);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((entry) => typeof entry !== "string") || new Set(parsed).size !== parsed.length) throw new Error("Proposed closeout delta is malformed");
  for (const entry of parsed as string[]) assertSafeRelativePath(entry, "proposed closeout path");
  return parsed as string[];
}

function parseAcceptedFindingIds(value: string): string[] {
  if (value === "NONE") return [];
  const findings = parseStrictJson(value);
  if (!Array.isArray(findings) || findings.some((finding) => !finding || typeof finding !== "object" || Array.isArray(finding) || typeof (finding as { id?: unknown }).id !== "string")) throw new Error("Final synthesis accepted findings are malformed");
  return canonicalFindingIds(findings.map((finding) => (finding as { id: string }).id));
}

function synthesisReceipt(synthesis: string, request: StageRequest, authority: RunAuthority): { candidate: string; findingIds: string[]; disposition: string; proposedDelta: string[] } {
  const output = parseOutputShape("STEP_REVIEW", synthesis);
  validateOutputBinding(output, { ...authorityBinding(authority), candidate: request.candidate_identity });
  const parsed = output.fields["Accepted findings"]!;
  const findingIds = parseAcceptedFindingIds(parsed);
  return {
    candidate: output.fields.Candidate!,
    findingIds,
    disposition: output.fields["Closeout disposition"]!,
    proposedDelta: parseProposedDelta(output.fields["Proposed closeout delta"]!),
  };
}

function acceptanceEvidenceReceipt(content: string): { candidate: string; reviewMode?: "INITIAL" | "FIX_RECHECK"; repairedFindingIds: string[] } {
  const text = content.replace(/\r\n/g, "\n").trim();
  if (!/^# FAL Explicit-Stage Router AC01-AC87 Reconciliation\n/.test(text) && !/^ACCEPTANCE EVIDENCE\n/.test(text)) throw new Error("Acceptance evidence source shape mismatch");
  const reviewMode = /^Review mode:/m.test(text) ? sourceField(text, "Review mode") : undefined;
  if (reviewMode !== undefined && reviewMode !== "INITIAL" && reviewMode !== "FIX_RECHECK") throw new Error("Acceptance evidence review mode is invalid");
  const repairedFindingIds = /^Repaired finding IDs:/m.test(text)
    ? parseFindingIdArray(sourceField(text, "Repaired finding IDs"), "Acceptance evidence")
    : [];
  return { candidate: sourceField(text, "Candidate"), ...(reviewMode ? { reviewMode } : {}), repairedFindingIds };
}

function reviewModeForRequest(request: StageRequest): "INITIAL" | "FIX_RECHECK" {
  if (!/^(0|[1-9][0-9]*)$/.test(request.review_cycle)) throw new Error("STEP_REVIEW review cycle is invalid");
  if (request.review_cycle === "0") {
    if (request.plan_class !== "EPIC_PLAN" || request.finding_ids.length !== 0) throw new Error("INITIAL STEP_REVIEW requires EPIC_PLAN and no repaired finding IDs");
    return "INITIAL";
  }
  if (request.plan_class !== "REVIEW_FIX_PLAN" || request.finding_ids.length === 0) throw new Error("FIX_RECHECK STEP_REVIEW requires REVIEW_FIX_PLAN and repaired finding IDs");
  return "FIX_RECHECK";
}

interface CloseoutAuthorityReceipt {
  allowedPaths: string[];
  commitScope: { mode: "NO_COMMIT"; reason: string } | { mode: "COMMIT"; paths: string[] };
}

function closeoutAuthorityReceipt(text: string, request: StageRequest, authority?: RunAuthority, worktree?: WorktreeProof): CloseoutAuthorityReceipt {
  const parsed = parseStrictJson(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Closeout authority envelope mismatch");
  const envelope = parsed as Record<string, unknown>;
  const expectedKeys = ["allowed_paths", "candidate_identity", "commit_scope", "global_apply", "restart", "schema_version", "staging_precondition", "worktree_identity", "worktree_proof_sha256"];
  if (canonicalize(Object.keys(envelope).sort()) !== canonicalize(expectedKeys)) throw new Error("Closeout authority envelope mismatch");
  if (!worktree || envelope.schema_version !== "closeout-authority.v1" || envelope.candidate_identity !== request.candidate_identity || envelope.worktree_identity !== request.worktree_identity || (authority && envelope.worktree_identity !== authority.worktree_identity) || envelope.worktree_proof_sha256 !== worktreeProofSha256(worktree) || envelope.global_apply !== false || envelope.restart !== false) throw new Error("Closeout authority envelope mismatch");
  if (!Array.isArray(envelope.allowed_paths) || envelope.allowed_paths.some((entry) => typeof entry !== "string") || new Set(envelope.allowed_paths).size !== envelope.allowed_paths.length) throw new Error("Closeout authority allowed paths are invalid");
  const allowedPaths = envelope.allowed_paths as string[];
  for (const allowedPath of allowedPaths) assertSafeRelativePath(allowedPath, "closeout allowed path");
  const scope = envelope.commit_scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) throw new Error("Closeout authority commit scope is invalid");
  const commitScope = scope as Record<string, unknown>;
  if (commitScope.mode === "NO_COMMIT") {
    if (canonicalize(Object.keys(commitScope).sort()) !== canonicalize(["mode", "reason"]) || typeof commitScope.reason !== "string" || !commitScope.reason.trim() || envelope.staging_precondition !== "EMPTY" || worktree.staged_paths.length !== 0 || !worktree.status_clean) throw new Error("Closeout NO_COMMIT authority is invalid");
    return { allowedPaths, commitScope: { mode: "NO_COMMIT", reason: commitScope.reason.trim() } };
  }
  if (commitScope.mode === "COMMIT") {
    if (canonicalize(Object.keys(commitScope).sort()) !== canonicalize(["mode", "paths"]) || !Array.isArray(commitScope.paths) || commitScope.paths.some((entry) => typeof entry !== "string") || canonicalize(commitScope.paths) !== canonicalize(allowedPaths) || canonicalize(commitScope.paths) !== canonicalize(worktree.staged_paths) || envelope.staging_precondition !== "EXACT" || worktree.has_unstaged_or_untracked) throw new Error("Closeout COMMIT authority is invalid");
    return { allowedPaths, commitScope: { mode: "COMMIT", paths: commitScope.paths as string[] } };
  }
  throw new Error("Closeout authority commit scope is invalid");
}

function assertSourceLineage(request: StageRequest, sources: readonly ResolvedSource[], authority: RunAuthority, worktree?: WorktreeProof): void {
  const expectedClasses = SOURCE_CLASSES[request.requested_stage];
  if (sources.length !== expectedClasses.length || sources.some((source, index) => source.binding.source_class !== expectedClasses[index])) throw new Error("Protected source classes are missing, reordered, or invalid for stage");
  const byClass = new Map(sources.map((source) => [source.binding.source_class, source.content] as const));
  const plan = byClass.get("PLAN");
  if (request.requested_stage === "PLAN_REVIEW" && plan) {
    const receipt = planReceipt(plan, request, authority);
    if (request.plan_class !== receipt.planClass || request.plan_identity !== receipt.planIdentity) throw new Error("Protected plan class or identity does not match stage request");
    assertFindingLineage(request, receipt.planClass === "REVIEW_FIX_PLAN" ? parseFindingIdArray(parseOutputShape("DELIVERY_RESPONSE", plan).fields["Accepted finding IDs"] ?? "", "Fix plan") : []);
  }
  if (request.requested_stage === "PLAN_REVISION" && plan) {
    const receipt = planReceipt(plan, request, authority);
    const review = byClass.get("META_PLAN_REVIEW")!;
    const parsedReview = parseOutputShape("PLAN_REVIEW", review);
    validateOutputBinding(parsedReview, { ...authorityBinding(authority), plan: receipt.planIdentity, plan_class: receipt.planClass });
    if (receipt.planClass !== request.plan_class || receipt.planIdentity !== request.plan_identity) throw new Error("Meta plan review lineage mismatch");
    assertFindingLineage(request, receipt.planClass === "REVIEW_FIX_PLAN" ? parseFindingIdArray(parseOutputShape("DELIVERY_RESPONSE", plan).fields["Accepted finding IDs"] ?? "", "Fix plan") : []);
  }
  if (request.requested_stage === "IMPLEMENT") {
    const revised = byClass.get("REVISED_PLAN")!;
    const parsedRevision = parseOutputShape("PLAN_REVISION", revised);
    validateOutputBinding(parsedRevision, { ...authorityBinding(authority), plan_class: request.plan_class });
    if (parsedRevision.terminal !== "IMPLEMENT_READY" || parsedRevision.fields["Final plan artifact"] !== request.plan_identity) throw new Error("Revised plan lineage or readiness mismatch");
    const sourceFindingIds = parsedRevision.plan_class === "REVIEW_FIX_PLAN"
      ? parseFindingIdArray(parsedRevision.fields["Accepted finding IDs"] ?? "", "Revised fix plan")
      : [];
    assertFindingLineage(request, sourceFindingIds);
  }
  if (request.requested_stage === "STEP_REVIEW") {
    const reviewMode = reviewModeForRequest(request);
    const implementation = byClass.get("IMPLEMENTATION_RESULT")!;
    const parsedImplementation = parseOutputShape("IMPLEMENT", implementation);
    if (request.candidate_identity === "UNDECLARED") throw new Error("Implementation candidate or plan lineage mismatch");
    validateOutputBinding(parsedImplementation, { ...authorityBinding(authority), candidate: request.candidate_identity, plan: request.plan_identity });
    const acceptance = acceptanceEvidenceReceipt(byClass.get("ACCEPTANCE_EVIDENCE")!);
    if (acceptance.candidate !== request.candidate_identity) throw new Error("Acceptance evidence candidate lineage mismatch");
    if (reviewMode === "INITIAL") {
      if (acceptance.reviewMode === "FIX_RECHECK" || acceptance.repairedFindingIds.length !== 0) throw new Error("INITIAL acceptance evidence contains repair lineage");
    } else if (acceptance.reviewMode !== "FIX_RECHECK" || canonicalize(acceptance.repairedFindingIds) !== canonicalize(request.finding_ids)) {
      throw new Error("FIX_RECHECK acceptance evidence finding lineage mismatch");
    }
  }
  if (request.requested_stage === "DELIVERY_RESPONSE" || request.requested_stage === "CLOSEOUT") {
    const receipt = synthesisReceipt(byClass.get("FINAL_SYNTHESIS")!, request, authority);
    if (request.candidate_identity === "UNDECLARED" || receipt.candidate !== request.candidate_identity) throw new Error("Final synthesis candidate lineage mismatch");
    assertFindingLineage(request, receipt.findingIds);
    if (request.requested_stage === "CLOSEOUT") {
      if (receipt.disposition !== "ALLOWED" || receipt.findingIds.length !== 0) throw new Error("Closeout requires an ALLOWED synthesis with no accepted findings");
      parseOutputShape("DELIVERY_RESPONSE", byClass.get("DELIVERY_RESPONSE")!);
      if (byClass.get("DELIVERY_RESPONSE")!.trim() !== "ACK_ONLY") throw new Error("Closeout requires exact ACK_ONLY delivery response");
      const proposedDelta = parseProposedDelta(byClass.get("PROPOSED_DELTA")!.trim());
      if (canonicalize(proposedDelta) !== canonicalize(receipt.proposedDelta)) throw new Error("Closeout proposed delta lineage mismatch");
      const closeout = closeoutAuthorityReceipt(byClass.get("CLOSEOUT_AUTHORITY")!, request, authority, worktree);
      if (closeout.commitScope.mode === "NO_COMMIT" ? proposedDelta.length !== 0 : canonicalize(closeout.commitScope.paths) !== canonicalize(proposedDelta)) throw new Error("Closeout commit scope is not authorized by synthesis proposed delta");
    }
  }
  if (request.requested_stage === "SEQ_NEXT") assertFindingLineage(request, []);
}

function assertFindingLineage(request: StageRequest, sourceFindingIds: readonly string[]): void {
  if (canonicalize(sourceFindingIds) !== canonicalize(request.finding_ids)) throw new Error("Protected source finding lineage mismatch");
}

function parseFindingIdArray(value: string, label: string): string[] {
  const parsed = parseStrictJson(value);
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) throw new Error(`${label} finding IDs are malformed`);
  return canonicalFindingIds(parsed as string[]);
}

function assertOutputSourceLineage(request: StageRequest, sources: readonly ResolvedSource[], terminal: string, fields: Readonly<Record<string, string>>, worktree?: WorktreeProof): void {
  if (request.requested_stage === "DELIVERY_RESPONSE") {
    const synthesis = parseOutputShape("STEP_REVIEW", sources[0]!.content);
    const receipt = {
      disposition: synthesis.fields["Closeout disposition"]!,
      findingIds: parseAcceptedFindingIds(synthesis.fields["Accepted findings"]!),
    };
    if (terminal === "ACK_ONLY" && (receipt.disposition !== "ALLOWED" || receipt.findingIds.length !== 0)) throw new Error("ACK_ONLY requires an ALLOWED synthesis with no accepted findings");
    if (terminal === "FIX_PLAN_REQUIRED") {
      if (receipt.disposition !== "FIX_REQUIRED" || receipt.findingIds.length === 0 || fields.Candidate !== request.candidate_identity) throw new Error("FIX_PLAN_REQUIRED requires the exact candidate and a fix-required synthesis with accepted findings");
      const responseIds = parseStrictJson(fields["Accepted finding IDs"] ?? "");
      if (!Array.isArray(responseIds) || responseIds.some((id) => typeof id !== "string") || canonicalize([...responseIds].sort()) !== canonicalize([...receipt.findingIds].sort())) throw new Error("Delivery response finding lineage mismatch");
    }
    return;
  }
  if (request.requested_stage === "CLOSEOUT") {
    const receipt = closeoutAuthorityReceipt(sources[3]!.content, request, undefined, worktree);
    if (receipt.commitScope.mode === "NO_COMMIT") {
      if (fields.Commit !== `NO_COMMIT reason=${receipt.commitScope.reason}` || fields["Staged explicit paths"] !== "NONE") throw new Error("Closeout result does not match NO_COMMIT authority");
    } else {
      const staged = parseStrictJson(fields["Staged explicit paths"] ?? "");
      if (!Array.isArray(staged) || staged.some((entry) => typeof entry !== "string") || canonicalize(staged) !== canonicalize(receipt.commitScope.paths) || !fields.Commit?.startsWith("sha=")) throw new Error("Closeout result does not match COMMIT authority");
    }
  }
}

function assertResolvedStageStable(current: ResolvedStageAuthority, baseline: ResolvedStageAuthority, expectedAuthoritySha256: string): void {
  if (authoritySha256(current.run_authority) !== expectedAuthoritySha256) throw new Error("Current target authority drifted during immediate transport revalidation");
  if (!sameSources(current.sources.map((source) => source.binding), baseline.sources.map((source) => source.binding))) throw new Error("Current stage sources drifted during immediate transport revalidation");
  for (const source of current.sources) if (sha256(Buffer.from(source.content, "utf8")) !== source.binding.sha256) throw new Error("Current stage source content drifted during immediate transport revalidation");
  if (canonicalize(current.transport) !== canonicalize(baseline.transport)) throw new Error("Protected transport binding drifted during immediate transport revalidation");
  if (canonicalize(current.capability) !== canonicalize(baseline.capability)) throw new Error("Dispatch capability drifted during immediate transport revalidation");
  if (canonicalize(current.privacy) !== canonicalize(baseline.privacy)) throw new Error("Privacy authority drifted during immediate transport revalidation");
  if (canonicalize(current.worktree ?? null) !== canonicalize(baseline.worktree ?? null)) throw new Error("Worktree authority drifted during immediate transport revalidation");
}

function assertResolvedStagePostResponse(current: ResolvedStageAuthority, baseline: ResolvedStageAuthority, request: StageRequest, fields: Readonly<Record<string, string>>, expectedAuthoritySha256: string): void {
  const commit = request.requested_stage === "CLOSEOUT" ? /^sha=([a-f0-9]{40}|[a-f0-9]{64});\s*tree=([a-f0-9]{40}|[a-f0-9]{64});/.exec(fields.Commit ?? "") : null;
  if (!commit) {
    assertResolvedStageStable(current, baseline, expectedAuthoritySha256);
    return;
  }
  const mutableAuthority = new Set<keyof RunAuthority>(["state_revision", "state_sha256", "combined_span_sha256", "pinned_artifact_path", "pinned_artifact_identity", "pinned_artifact_sha256", "stage_source_manifest_path", "stage_source_manifest_sha256", "next_command"]);
  for (const key of Object.keys(baseline.run_authority) as Array<keyof RunAuthority>) {
    if (!mutableAuthority.has(key) && canonicalize(current.run_authority[key]) !== canonicalize(baseline.run_authority[key])) throw new Error(`Closeout immutable authority drifted: ${key}`);
  }
  if (!sameSources(current.sources.map((source) => source.binding), baseline.sources.map((source) => source.binding))) throw new Error("Closeout source authority drifted");
  if (canonicalize(current.transport) !== canonicalize(baseline.transport) || canonicalize(current.capability) !== canonicalize(baseline.capability) || canonicalize(current.privacy) !== canonicalize(baseline.privacy)) throw new Error("Closeout protected binding drifted");
  const reportedPaths = parseStrictJson(fields["Staged explicit paths"] ?? "");
  if (!Array.isArray(reportedPaths) || reportedPaths.some((entry) => typeof entry !== "string")) throw new Error("Closeout committed path postcondition failed");
  if (!current.worktree || !baseline.worktree || current.worktree.head_sha256 !== sha256(commit[1]!) || current.worktree.head_tree_sha256 !== sha256(commit[2]!) || current.worktree.head_parent_count !== 1 || current.worktree.sole_parent_sha256 !== baseline.worktree.head_sha256 || canonicalize(current.worktree.committed_paths) !== canonicalize([...reportedPaths].sort()) || !current.worktree.status_clean || current.worktree.staged_paths.length !== 0 || current.worktree.has_unstaged_or_untracked) throw new Error("Closeout committed worktree postcondition failed");
  if (canonicalize(current.worktree) === canonicalize(baseline.worktree ?? null)) throw new Error("Closeout COMMIT did not change worktree authority");
}

function assertArtifactSafe(markdown: string, transport: TransportBinding, absolutePaths: readonly string[], privateValues: readonly string[] = []): void {
  const rawValues = [transport.origin, transport.server_fingerprint, transport.username, transport.password, transport.session_id, ...absolutePaths, ...privateValues];
  const exactPrivateValues = new Set<string>();
  for (const value of rawValues) {
    exactPrivateValues.add(value);
    exactPrivateValues.add(encodeURIComponent(value));
    exactPrivateValues.add(encodeURI(value));
    exactPrivateValues.add(Buffer.from(value, "utf8").toString("base64"));
    exactPrivateValues.add(value.replace(/\\/g, "/"));
  }
  exactPrivateValues.add(Buffer.from(`${transport.username}:${transport.password}`, "utf8").toString("base64"));
  if ([...exactPrivateValues].some((value) => value.length > 0 && markdown.includes(value)) || /(?:https?:\/\/|sk-[A-Za-z0-9_-]{4,}|Bearer\s+[A-Za-z0-9._~+\/-]{4,}|Basic\s+[A-Za-z0-9+/=]{4,}|(?:^|[^A-Za-z0-9])ses_[A-Za-z0-9_-]*|(?:[A-Za-z]:[\\/]|\/(?:home|Users|var|tmp)\/)[^\s`"']+)/i.test(markdown)) {
    throw new Error("Output contains a private transport sentinel and cannot be persisted");
  }
}

function closeoutDurableProjection(markdown: string, commitField: string): string {
  const match = /^sha=([a-f0-9]{40}|[a-f0-9]{64});\s*tree=([a-f0-9]{40}|[a-f0-9]{64});/.exec(commitField);
  if (!match) throw new Error("Closeout durable projection requires validated commit identity");
  return [
    "CLOSEOUT DURABLE PROJECTION",
    "schema_version: closeout-durable-projection.v1",
    `commit_sha256: ${sha256(match[1]!)}`,
    `tree_sha256: ${sha256(match[2]!)}`,
    `validated_response_sha256: ${sha256(markdown)}`,
    "raw_canonical_output_persisted: false",
    "",
  ].join("\n");
}

function safeFailureReason(error: unknown, transport: TransportBinding): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("private transport sentinel")) return "PRIVATE_OUTPUT_REJECTED";
  if (/authority|source|(?:transport binding|capability|privacy|worktree).*drift/i.test(message)) return "AUTHORITY_REVALIDATION_FAILED";
  if (/output|binding|terminal|plan|candidate|closeout|ACK_ONLY|FIX_PLAN_REQUIRED|finding lineage/i.test(message)) return "OUTPUT_VALIDATION_FAILED";
  void transport;
  return "STAGE_OPERATION_FAILED";
}

function renderSources(sources: readonly ResolvedSource[]): string {
  return sources.map((source, index) => `--- FAL SOURCE ${index} ${source.binding.logical_identity} ${source.binding.sha256} ---\n${source.content.replace(/\r\n/g, "\n").trimEnd()}\n--- END FAL SOURCE ${index} ---`).join("\n");
}

function renderCommandArgument(request: StageRequest, sources: readonly ResolvedSource[]): string {
  if (request.requested_stage !== "STEP_REVIEW") return renderSources(sources);
  const reviewMode = reviewModeForRequest(request);
  const envelope = canonicalize({
    schema_version: "fal-review-envelope.v1",
    review_mode: reviewMode,
    review_cycle: request.review_cycle,
    candidate_identity: request.candidate_identity,
    repaired_finding_ids: request.finding_ids,
    review_boundary: reviewMode === "FIX_RECHECK" ? "REPAIRED_FINDINGS_AND_MINIMAL_REGRESSION" : "FROZEN_CANDIDATE",
    scope_promotion_policy: "NEXUS_ONLY",
    scope_expansion_authority: "NONE",
  });
  return `--- FAL VERIFIED REVIEW ENVELOPE ---\n${envelope}\n--- END FAL VERIFIED REVIEW ENVELOPE ---\n${renderSources(sources)}`;
}

function allowedNext(stage: StageRequest["requested_stage"], terminal: string): string[] {
  if (stage === "SEQ_NEXT" && terminal === "READY") return ["PLAN_REVIEW"];
  if (stage === "PLAN_REVIEW") return ["PLAN_REVISION"];
  if (stage === "PLAN_REVISION" && terminal === "IMPLEMENT_READY") return ["IMPLEMENT"];
  if (stage === "IMPLEMENT" && terminal === "REVIEW_READY") return ["STEP_REVIEW"];
  if (stage === "STEP_REVIEW") return ["DELIVERY_RESPONSE"];
  if (stage === "DELIVERY_RESPONSE" && terminal === "ACK_ONLY") return ["CLOSEOUT"];
  if (stage === "DELIVERY_RESPONSE" && terminal === "FIX_PLAN_REQUIRED") return ["PLAN_REVIEW"];
  return [];
}

function makeResult(request: Pick<StageRequest, "run_id">, operationId: string, operationStatus: string, transportStatus: string, outputStatus: string, bindingStatus: string, terminalStatus: string, allowed: string[], artifactSha: string, reason: string, messageIdSha = "", responseSha = ""): StageResult {
  return { schema_version: "stage-result.v1", run_id: request.run_id, operation_id: operationId, operation_status: operationStatus, transport_status: transportStatus, output_status: outputStatus, binding_status: bindingStatus, terminal_status: terminalStatus, allowed_next: allowed, artifact_sha256: artifactSha, message_id_sha256: messageIdSha, response_sha256: responseSha, reason, auto_advance: false };
}

export const _test = { assertSourceLineage, assertOutputSourceLineage, assertResolvedStagePostResponse, SOURCE_CLASSES };
