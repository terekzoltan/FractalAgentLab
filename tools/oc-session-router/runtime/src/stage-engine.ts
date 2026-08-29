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
  stageRequestFromInvocation,
  validateOutputBinding,
  type CloseoutAuthorityInstallRequest,
  type FollowOnRunRequest,
  type RunAuthority,
  type RunRequest,
  type SourceBinding,
  type SourceClass,
  type StageInvocation,
  type StageRequest,
} from "./contracts.js";
import { ROUTER_PROTOCOL_IDENTITY, SharedSessionFence, type ResolvedCapability, type SharedFenceBinding, type SharedFenceLease } from "./control-plane.js";
import { StateStore, type OperationDocument } from "./state-store.js";
import { CommandClient, assertPrivateTransportBinding, reconcileSnapshot, type SnapshotBaseline, type SnapshotCandidate, type TransportBinding } from "./transport.js";
import { worktreeProofSha256, type WorktreeProof } from "./worktree-reader.js";

export interface ResolvedSource {
  binding: SourceBinding;
  content: string;
}

export interface ResolvedStageAuthority {
  run_authority: RunAuthority;
  sources: ResolvedSource[];
  transport: TransportBinding;
  capability: ResolvedCapability;
  privacy: { absolute_paths: string[]; private_values?: string[] };
  shared_fence?: SharedFenceBinding;
  worktree?: WorktreeProof;
}

export interface AuthorityResolver {
  deriveRunAuthority(request: RunRequest, identity: { runId: string; createdAt: string }): Promise<RunAuthority>;
  resolveStageCapability(runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority["capability"]>;
  resolveStageAuthority(runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority>;
  resolveCloseoutPreflight(runAuthority: RunAuthority): Promise<{ run_authority: RunAuthority; worktree: WorktreeProof }>;
}

export interface SnapshotReader {
  captureBaseline?(resolved: ResolvedStageAuthority): Promise<SnapshotBaseline>;
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
  candidate_scope_sha256?: string;
  reason: string;
  auto_advance: false;
}

export interface ResolveStageOptions {
  wait_ms?: number;
  poll_interval_ms?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface RouterOwnedSourceCandidate {
  source_class: SourceClass;
  logical_identity: string;
  producer: string;
  path: string;
  sha256: string;
  content: string;
}

interface ProposedDeltaEntry {
  path: string;
  field: string;
  value: string;
}

export class StageEngine {
  constructor(
    private readonly store: StateStore,
    private readonly resolver?: AuthorityResolver,
    private readonly client?: CommandClient,
    private readonly snapshots?: SnapshotReader,
    private readonly sharedFence: SharedSessionFence = new SharedSessionFence(),
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

  async newFollowOnRun(request: FollowOnRunRequest): Promise<{ schema_version: "follow-on-run-result.v1"; run_id: string; run_authority_sha256: string; predecessor_run_id: string; predecessor_operation_id: string; review_cycle: string; next_stage_sources: Array<{ requested_stage: "PLAN_REVIEW"; expected_sources: SourceBinding[] }>; created: boolean; auto_advance: false }> {
    if (!this.resolver) throw new Error("Authority resolver is unavailable for follow-on run");
    const predecessor = this.store.loadRun(request.predecessor_run_id);
    const operations = this.store.listOperations(request.predecessor_run_id);
    const delivery = operations.at(-1);
    if (!delivery || delivery.operation_id !== request.delivery_operation_id || delivery.status !== "SUCCEEDED" || delivery.invocation.requested_stage !== "DELIVERY_RESPONSE") throw new Error("Follow-on run requires the exact successful terminal Delivery response operation");
    const content = this.store.readArtifact(request.predecessor_run_id, request.delivery_operation_id, "terminal");
    const parsed = parseOutputShape("DELIVERY_RESPONSE", content);
    if (parsed.terminal !== "FIX_PLAN_REQUIRED") throw new Error("Follow-on run requires exact FIX_PLAN_REQUIRED authority");
    const findingIds = canonicalFindingIds(parseFindingIdArray(parsed.fields["Accepted finding IDs"] ?? "", "Fix plan"));
    if (findingIds.length === 0 || canonicalize(findingIds) !== canonicalize(delivery.invocation.finding_ids) || parsed.fields.Candidate !== delivery.invocation.candidate_identity) throw new Error("Follow-on run finding or candidate lineage mismatch");
    const predecessorCycle = Number(predecessor.authority.review_cycle);
    if (!Number.isSafeInteger(predecessorCycle) || predecessorCycle < 0 || predecessorCycle >= Number.MAX_SAFE_INTEGER) throw new Error("Predecessor review cycle cannot be incremented safely");
    const reviewCycle = String(predecessorCycle + 1);
    const runId = `run-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const current = await this.resolver.deriveRunAuthority(
      { schema_version: "run-request.v1", target_id: predecessor.authority.target_id, expected_worktree_identity: predecessor.authority.worktree_identity },
      { runId, createdAt },
    );
    const predecessorCurrentIdentity: RunAuthority = { ...current, run_id: predecessor.authority.run_id, created_at: predecessor.authority.created_at };
    if (!targetAuthorityMatchesRun(this.store, predecessorCurrentIdentity, predecessor.authority)) throw new Error("Current target authority drifted from the predecessor review cycle");
    const authority: RunAuthority = { ...current, review_cycle: reviewCycle, next_command: "/terv-review" };
    const normalizedContent = `${content.replace(/\r\n/g, "\n").trim()}\n`;
    const binding: SourceBinding = {
      path: "router-predecessor/fix-plan.md",
      source_class: "PLAN",
      logical_identity: parsed.fields["Fix-plan artifact"]!,
      producer: "FAL_ROUTER_OUTPUT",
      sha256: sha256(Buffer.from(normalizedContent, "utf8")),
      order: 0,
    };
    const digest = authoritySha256(authority);
    const installed = this.store.createFollowOnRun(authority, digest, {
      schema_version: "installed-follow-on-source.v1",
      predecessor_run_id: request.predecessor_run_id,
      predecessor_operation_id: request.delivery_operation_id,
      predecessor_run_authority_sha256: predecessor.run.run_authority_sha256,
      base_review_cycle: current.review_cycle,
      base_next_command: current.next_command,
      predecessor_review_cycle: predecessor.authority.review_cycle,
      review_cycle: reviewCycle,
      candidate_identity: parsed.fields.Candidate!,
      finding_ids: findingIds,
      binding,
      content: normalizedContent,
    });
    const loaded = this.store.loadRun(installed.run.run_id);
    const source = this.store.loadFollowOnSource(installed.run.run_id);
    if (!source) throw new Error("Follow-on source receipt was not installed");
    return {
      schema_version: "follow-on-run-result.v1",
      run_id: installed.run.run_id,
      run_authority_sha256: loaded.run.run_authority_sha256,
      predecessor_run_id: source.predecessor_run_id,
      predecessor_operation_id: source.predecessor_operation_id,
      review_cycle: loaded.authority.review_cycle,
      next_stage_sources: [{ requested_stage: "PLAN_REVIEW", expected_sources: [{ ...source.binding, order: 0 }] }],
      created: installed.created,
      auto_advance: false,
    };
  }

  async installCloseoutAuthority(request: CloseoutAuthorityInstallRequest): Promise<unknown> {
    if (!this.resolver) throw new Error("Authority resolver is unavailable for closeout authority installation");
    const loaded = this.store.loadRun(request.run_id);
    const previous = this.store.listOperations(request.run_id).at(-1);
    if (!previous || previous.operation_id !== request.delivery_operation_id || previous.status !== "SUCCEEDED" || previous.invocation.requested_stage !== "DELIVERY_RESPONSE") throw new Error("Closeout authority installation requires the exact successful Delivery response operation");
    const delivery = parseOutputShape("DELIVERY_RESPONSE", this.store.readArtifact(request.run_id, previous.operation_id, "terminal"));
    if (delivery.terminal !== "ACK_ONLY" || previous.invocation.candidate_identity === "UNDECLARED") throw new Error("Closeout authority installation requires exact candidate-bound ACK_ONLY");
    const implementation = this.store.listOperations(request.run_id).filter((operation) => operation.status === "SUCCEEDED" && operation.invocation.requested_stage === "IMPLEMENT").at(-1);
    if (!implementation || implementation.sequence >= previous.sequence || implementation.invocation.candidate_identity !== previous.invocation.candidate_identity) throw new Error("Closeout authority installation requires the exact successful candidate implementation");
    const frozenScope = frozenCandidateScopeReceipt(this.store, request.run_id, implementation);
    const preflight = await this.resolver.resolveCloseoutPreflight(loaded.authority);
    if (!runAuthorityMatchesAcrossOperationalRefresh(preflight.run_authority, loaded.authority)) throw new Error("Closeout authority installation target authority drifted");
    if (canonicalize(frozenScope.candidatePaths) !== canonicalize([...preflight.worktree.changed_paths].sort())) throw new Error("Current worktree differs from the frozen reviewed candidate scope");
    const materializedAuthority = materializeCloseoutAuthorityIntent(request.closeout_authority, previous.invocation, preflight.worktree, frozenScope.candidatePaths);
    const content = `${canonicalize(materializedAuthority)}\n`;
    const contentSha = sha256(Buffer.from(content, "utf8"));
    const binding: SourceBinding = { path: "owner-sources/closeout-authority.json", source_class: "CLOSEOUT_AUTHORITY", logical_identity: `closeout-authority-${contentSha.slice(0, 16)}`, producer: "FAL_OWNER_RUNTIME", sha256: contentSha, order: 3 };
    const predecessorSources = promotedSourcesForStage(this.store, request.run_id, "CLOSEOUT").filter((source) => source.binding.source_class !== "CLOSEOUT_AUTHORITY");
    if (predecessorSources.length !== 3) throw new Error("Closeout authority installation requires the exact synthesis, acknowledgement, and delta sources");
    const closeoutRequest: StageRequest = {
      ...stageRequestFromInvocation(previous.invocation),
      requested_stage: "CLOSEOUT",
      sender_role: loaded.authority.accountable_lane,
      recipient_role: "Meta",
      expected_sources: [...predecessorSources.map((source) => source.binding), binding],
    };
    assertSourceLineage(closeoutRequest, [...predecessorSources, { binding, content }], loaded.authority, preflight.worktree);
    const installed = this.store.installOwnerSource(request.run_id, previous.operation_id, binding, content);
    return { schema_version: "closeout-authority-install-receipt.v1", run_id: request.run_id, delivery_operation_id: previous.operation_id, binding: installed.binding, worktree_proof_sha256: worktreeProofSha256(preflight.worktree), status: "INSTALLED", auto_advance: false };
  }

  getRun(runId: string): unknown {
    const loaded = this.store.loadRun(runId);
    const operations = this.store.listOperations(runId);
    const previous = operations.at(-1);
    let next_stage_sources: Array<{ requested_stage: StageRequest["requested_stage"]; expected_sources: SourceBinding[] }> = [];
    let available_stage_sources: Array<{ requested_stage: StageRequest["requested_stage"]; expected_sources: SourceBinding[] }> = [];
    let continuation_requirements: Array<{ requested_stage: StageRequest["requested_stage"]; requirement: "TARGET_SOURCE_REQUIRED" | "OWNER_SOURCE_REQUIRED" | "FOLLOW_ON_RUN_REQUIRED"; source_classes: SourceClass[]; reason: string }> = [];
    const followOn = this.store.loadFollowOnSource(runId);
    if (!previous && followOn) next_stage_sources.push({ requested_stage: "PLAN_REVIEW", expected_sources: [{ ...followOn.binding, order: 0 }] });
    if (previous?.status === "SUCCEEDED") {
      const { allowedNextStages, continuationReason } = this.storedContinuation(runId, previous);
      if (allowedNextStages.length > 0) {
        for (const requested_stage of allowedNextStages.filter((stage): stage is StageRequest["requested_stage"] => typeof stage === "string" && Object.hasOwn(SOURCE_CLASSES, stage))) {
          const promoted = promotedSourcesForStage(this.store, runId, requested_stage);
          const projected = SOURCE_CLASSES[requested_stage].flatMap((sourceClass, order) => {
            const routerOwned = promoted.find((source) => source.binding.source_class === sourceClass)?.binding;
            if (routerOwned) return [{ ...routerOwned, order }];
            const carried = previous.invocation.expected_sources.find((source) => source.source_class === sourceClass);
            return carried ? [{ ...carried, order }] : [];
          });
          const projectedClasses = new Set(projected.map((source) => source.source_class));
          const missing = SOURCE_CLASSES[requested_stage].filter((sourceClass) => !projectedClasses.has(sourceClass));
          if (missing.length === 0) next_stage_sources.push({ requested_stage, expected_sources: projected });
          else {
            if (projected.length > 0) available_stage_sources.push({ requested_stage, expected_sources: projected });
            continuation_requirements.push({ requested_stage, requirement: "TARGET_SOURCE_REQUIRED", source_classes: [...missing], reason: "Protected target or Owner source preflight is required before this stage" });
          }
        }
      }
      if (continuationReason === "FOLLOW_ON_REVIEW_CYCLE_RUN_REQUIRED") {
        continuation_requirements.push({ requested_stage: "PLAN_REVIEW", requirement: "FOLLOW_ON_RUN_REQUIRED", source_classes: ["PLAN"], reason: "A new immutable run with a monotonically incremented review cycle and exact accepted finding lineage is required" });
      } else if (continuationReason === "OWNER_CLOSEOUT_AUTHORITY_REQUIRED") {
        const available = promotedSourcesForStage(this.store, runId, "CLOSEOUT");
        if (available.length > 0) available_stage_sources.push({ requested_stage: "CLOSEOUT", expected_sources: available.map((source) => source.binding) });
        continuation_requirements.push({ requested_stage: "CLOSEOUT", requirement: "OWNER_SOURCE_REQUIRED", source_classes: ["CLOSEOUT_AUTHORITY"], reason: "Install one fresh Owner closeout authority in the protected runtime before explicit same-run closeout dispatch" });
      }
    }
    return { schema_version: "run-projection.v1", run_id: loaded.run.run_id, target_id: loaded.run.target_id, worktree_identity: loaded.run.worktree_identity, run_authority_sha256: loaded.run.run_authority_sha256, review_cycle: loaded.authority.review_cycle, next_stage_sources, available_stage_sources, continuation_requirements, auto_advance: false };
  }

  async invokeStage(input: StageRequest): Promise<StageResult> {
    if (!this.resolver || !this.client) throw new Error("Dispatch dependencies are unavailable for invoke-stage");
    const request: StageRequest = { ...input, finding_ids: canonicalFindingIds(input.finding_ids) };
    const loaded = this.store.loadRun(request.run_id);
    if (loaded.run.run_authority_sha256 !== request.run_authority_sha256 || authoritySha256(loaded.authority) !== request.run_authority_sha256) throw new Error("Run authority hash mismatch");
    if (request.target_id !== loaded.authority.target_id || request.worktree_identity !== loaded.authority.worktree_identity) throw new Error("Stage request run binding mismatch");
    this.assertRequestAuthority(request, loaded.authority);
    this.assertTransition(request);
    const capability = await this.resolver.resolveStageCapability(loaded.authority, request);
    if (!["FIXTURE_ONLY", "P0B_ISOLATED", "PRODUCTION_RESPONSE_FIRST"].includes(capability.mode)) throw new Error("Production command dispatch is disabled until a reviewed P0B capability transaction");
    if (capability.mode !== "FIXTURE_ONLY" && (capability.router_protocol_identity !== ROUTER_PROTOCOL_IDENTITY || capability.sse_enabled !== false || !capability.snapshot_correlation || !capability.server_instance_identity_sha256 || !capability.target_directory_sha256 || capability.command_timeout_ms === undefined)) throw new Error("Production capability contract is incomplete");
    if (capability.mode === "P0B_ISOLATED" && !capability.authorization_use_sha256) throw new Error("P0B capability lacks a stable authorization-use identity");
    const resolved = await this.resolver.resolveStageAuthority(loaded.authority, request);
    if (authoritySha256(resolved.run_authority) !== request.run_authority_sha256) throw new Error("Current target authority drifted");
    if (canonicalize(resolved.capability) !== canonicalize(capability)) throw new Error("Dispatch capability drifted before authority resolution");
    assertPrivateTransportBinding(resolved.transport);
    assertArtifactSafe(canonicalize(request), resolved.transport, resolved.privacy.absolute_paths, resolved.privacy.private_values);
    const resolvedBindings = resolved.sources.map((source) => source.binding);
    if (!sameSources(request.expected_sources, resolvedBindings)) throw new Error("SOURCE_SUBSTITUTION: expected sources differ from current protected authority");
    for (const source of resolved.sources) if (sha256(Buffer.from(source.content, "utf8")) !== source.binding.sha256) throw new Error("Source content hash mismatch");
    assertSourceLineage(request, resolved.sources, loaded.authority, resolved.worktree);
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
      ...(capability.mode === "FIXTURE_ONLY" ? {} : {
        router_protocol_identity: ROUTER_PROTOCOL_IDENTITY,
        capability_receipt_sha256: capability.identity_sha256,
        snapshot_correlation: capability.snapshot_correlation!,
      }),
    };
    const leaseKey = sha256(canonicalize({ domain: "fal-router-global-session-lease/v1", server_instance_identity_sha256: resolved.capability.server_instance_identity_sha256 ?? sha256(resolved.transport.server_fingerprint), session_sha256: recipientSessionSha256 }));
    const authorizationUseSha256 = capability.authorization_use_sha256;
    this.store.claimSemanticAction(semanticKey, request.run_id, operationId);
    let release: (() => void) | undefined;
    let sharedLease: SharedFenceLease | undefined;
    let oneUseClaimed = false;
    let oneUseConsumed = false;
    try {
      if (resolved.shared_fence) sharedLease = await this.sharedFence.acquire(resolved.shared_fence);
      else if (capability.mode !== "FIXTURE_ONLY") throw new Error("Production dispatch requires the shared Compact/lifecycle session fence");
      release = this.store.acquireLease(leaseKey, { schema_version: "dispatch-lease.v1", server_fingerprint_sha256: sha256(resolved.transport.server_fingerprint), session_sha256: recipientSessionSha256, operation_class: request.requested_stage, holder: operationId, acquired_at: new Date().toISOString(), fencing_generation: randomUUID() });
      let operation;
      let responseReceived = false;
      let sendAttempted = false;
      try {
        const baseline = capability.mode === "FIXTURE_ONLY"
          ? undefined
          : this.snapshots?.captureBaseline
            ? await this.snapshots.captureBaseline(resolved)
            : (() => { throw new Error("Production snapshot baseline reader is unavailable"); })();
        const intent = {
          schema_version: "dispatch-intent.v1",
          operation_id: operationId,
          command_name: command,
          command_body_sha256: invocation.command_body_sha256,
          recipient_session_sha256: invocation.recipient_session_sha256,
          authority_sha256: request.run_authority_sha256,
          capability_receipt_sha256: capability.identity_sha256,
          ...(baseline ? { baseline } : {}),
          created_at: new Date().toISOString(),
        };
        const intentHash = sha256(canonicalize(intent));
        if (capability.mode === "P0B_ISOLATED") {
          this.store.claimOneUseCapability(authorizationUseSha256!, request.run_id, operationId);
          oneUseClaimed = true;
        }
        operation = this.store.createOperation(request.run_id, invocation, intent, intentHash);
        operation = this.store.updateOperation(request.run_id, operationId, operation.revision, { status: "DISPATCHING" });
        const preSend = await this.resolver.resolveStageAuthority(loaded.authority, request);
        assertResolvedStageStable(preSend, resolved, request.run_authority_sha256);
        sharedLease?.assertHeld();
        if (capability.mode === "P0B_ISOLATED") {
          this.store.settleOneUseCapability(authorizationUseSha256!, request.run_id, operationId, "CONSUMED");
          oneUseConsumed = true;
        }
        sendAttempted = true;
        const receipt = await this.client.send(preSend.transport, command, argument, preSend.capability.command_timeout_ms ?? 120_000);
        responseReceived = true;
        this.store.writeTransportReceipt(request.run_id, operationId, {
          schema_version: "minimized-transport-receipt.v1",
          status: receipt.status,
          message_id: receipt.message_id,
          parent_id: receipt.parent_id,
          session_sha256: receipt.session_sha256,
          response_sha256: receipt.response_sha256,
          terminal_sha256: receipt.terminal_sha256,
          ignored_part_set_sha256: receipt.ignored_part_set_sha256,
          raw_response_persisted: false,
        });
        assertArtifactSafe(receipt.terminal_markdown, preSend.transport, preSend.privacy.absolute_paths, preSend.privacy.private_values);
        const parsed = parseOutputShape(request.requested_stage, receipt.terminal_markdown);
        const postResponse = await this.resolver.resolveStageAuthority(loaded.authority, request);
        assertResolvedStagePostResponse(postResponse, preSend, request, parsed.fields, request.run_authority_sha256);
        assertOutputSourceLineage(request, preSend.sources, parsed.terminal, parsed.fields, preSend.worktree);
        validateOutputBinding(parsed, {
          target: loaded.authority.target_identity,
          epic: loaded.authority.epic,
          lane: `${loaded.authority.accountable_lane} / ${loaded.authority.accountable_class} / ${loaded.authority.accountable_profile}`,
          ...(request.candidate_identity === "UNDECLARED" || !["IMPLEMENT", "STEP_REVIEW", "CLOSEOUT"].includes(request.requested_stage) ? {} : { candidate: request.candidate_identity }),
          plan: request.plan_identity,
          plan_class: request.plan_class,
        });
        const candidateScope = request.requested_stage === "IMPLEMENT"
          ? await this.captureCandidateScope(loaded.authority, request, operationId)
          : undefined;
        const artifact = request.requested_stage === "CLOSEOUT" && parsed.fields.Commit?.startsWith("sha=")
          ? closeoutDurableProjection(receipt.terminal_markdown, parsed.fields.Commit)
          : `${receipt.terminal_markdown.replace(/\r\n/g, "\n").trim()}\n`;
        this.store.writeArtifact(request.run_id, operationId, "terminal", artifact);
        const result = makeResult(request, operationId, "SUCCEEDED", "RESPONSE_ACCEPTED", "VALID", "BOUND", "VALID", allowedNext(request.requested_stage, parsed.terminal), sha256(Buffer.from(artifact, "utf8")), successReason(request.requested_stage, parsed.terminal, "synchronous response validated"), sha256(receipt.message_id), receipt.response_sha256, candidateScope?.sha256);
        this.store.writeResult(request.run_id, operationId, result);
        this.store.updateOperation(request.run_id, operationId, operation.revision, { status: "SUCCEEDED" });
        this.store.settleSemanticAction(semanticKey, request.run_id, operationId, "CONSUMED");
        return result;
      } catch (error) {
        if (oneUseClaimed && !oneUseConsumed) {
          this.store.settleOneUseCapability(authorizationUseSha256!, request.run_id, operationId, "RELEASED");
          oneUseClaimed = false;
        }
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
      await sharedLease?.release();
    }
  }

  private async captureCandidateScope(authority: RunAuthority, request: StageRequest, operationId: string): Promise<{ content: string; sha256: string }> {
    if (!this.resolver || request.candidate_identity === "UNDECLARED") throw new Error("Implementation candidate scope cannot be frozen without protected authority");
    const preflight = await this.resolver.resolveCloseoutPreflight(authority);
    if (!runAuthorityMatchesAcrossOperationalRefresh(preflight.run_authority, authority)) throw new Error("Candidate scope target authority drifted");
    if (preflight.worktree.staged_paths.length !== 0) throw new Error("Candidate scope cannot be frozen with a pre-staged index");
    const candidatePaths = [...preflight.worktree.changed_paths].sort();
    for (const candidatePath of candidatePaths) assertSafeRelativePath(candidatePath, "candidate scope path");
    const content = `${canonicalize({
      schema_version: "frozen-candidate-scope.v1",
      implementation_operation_id: operationId,
      candidate_identity: request.candidate_identity,
      worktree_identity: request.worktree_identity,
      candidate_paths: candidatePaths,
      worktree_proof_sha256: worktreeProofSha256(preflight.worktree),
    })}\n`;
    const digest = sha256(Buffer.from(content, "utf8"));
    this.store.writeArtifact(request.run_id, operationId, "candidate-scope", content);
    return { content, sha256: digest };
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
      const { allowedNextStages } = this.storedContinuation(request.run_id, previous);
      if (!allowedNextStages.includes(request.requested_stage)) throw new Error("Requested stage is not an allowed transition");
      if (previous.invocation.requested_stage === "PLAN_REVISION" && request.requested_stage === "IMPLEMENT" && previous.invocation.plan_class !== request.plan_class) throw new Error("PLAN_REVISION to IMPLEMENT plan class changed");
      return;
    }
    if (previous.invocation.requested_stage !== request.requested_stage) throw new Error("Failed stage may only be retried as the same explicit stage transition");
  }

  private storedContinuation(runId: string, operation: OperationDocument): { allowedNextStages: unknown[]; continuationReason: string } {
    const result = this.store.loadResult(runId, operation.operation_id) as { allowed_next?: unknown; reason?: unknown };
    let allowedNextStages = Array.isArray(result.allowed_next) ? result.allowed_next : [];
    let continuationReason = typeof result.reason === "string" ? result.reason : "";
    if (operation.invocation.requested_stage !== "DELIVERY_RESPONSE") return { allowedNextStages, continuationReason };
    const terminal = parseOutputShape("DELIVERY_RESPONSE", this.store.readArtifact(runId, operation.operation_id, "terminal")).terminal;
    if (terminal === "FIX_PLAN_REQUIRED") return { allowedNextStages: [], continuationReason: "FOLLOW_ON_REVIEW_CYCLE_RUN_REQUIRED" };
    if (terminal === "ACK_ONLY") {
      const installed = this.store.loadOwnerSource(runId);
      return installed?.predecessor_operation_id === operation.operation_id
        ? { allowedNextStages: ["CLOSEOUT"], continuationReason: "OWNER_CLOSEOUT_AUTHORITY_INSTALLED" }
        : { allowedNextStages: [], continuationReason: "OWNER_CLOSEOUT_AUTHORITY_REQUIRED" };
    }
    return { allowedNextStages, continuationReason };
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
    if (request.expected_contract_version !== "awc-3.1" && request.expected_contract_version !== "awc-4.1.1") throw new Error("Stage request contract version mismatch");
    if (request.allowed_side_effect_class !== "ADDRESSED_SESSION_COMMAND") throw new Error("Stage request side-effect class does not authorize addressed command transport");
    const metaStages = new Set(["PLAN_REVIEW", "STEP_REVIEW", "CLOSEOUT"]);
    const expectedRecipient = metaStages.has(request.requested_stage) ? "Meta" : authority.accountable_lane;
    if (request.recipient_role !== expectedRecipient) throw new Error("Stage request recipient role does not match protected stage authority");
    const expectedSender = new Set(["PLAN_REVISION", "DELIVERY_RESPONSE"]).has(request.requested_stage) ? "Meta" : authority.accountable_lane;
    if (request.sender_role !== expectedSender) throw new Error("Stage request sender role does not match protected stage authority");
  }

  async resolveStage(runId: string, operationId: string, options: ResolveStageOptions = {}): Promise<StageResult> {
    let operation = this.store.loadOperation(runId, operationId);
    if (operation.status === "SUCCEEDED") {
      const stored = this.store.loadResult(runId, operationId) as Partial<StageResult>;
      if (
        stored.schema_version !== "stage-result.v1" ||
        stored.run_id !== runId ||
        stored.operation_id !== operationId ||
        stored.operation_status !== "SUCCEEDED" ||
        stored.output_status !== "VALID" ||
        stored.binding_status !== "BOUND" ||
        stored.terminal_status !== "VALID" ||
        !Array.isArray(stored.allowed_next) ||
        stored.auto_advance !== false
      ) throw new Error("Stored successful operation result is invalid");
      return stored as StageResult;
    }
    if (operation.status === "FAILED_OUTPUT") operation = this.store.beginFailedOutputRecovery(runId, operationId, operation.revision);
    const failedOutputRecovery = this.store.hasFailedOutputRecovery(runId, operationId);
    if (!["DISPATCHING", "ACTIVE", "UNCERTAIN", "RECONCILING"].includes(operation.status)) throw new Error("Operation is not reconcilable");
    if (!this.snapshots) throw new Error("Snapshot reconciliation capability is unavailable");
    if (operation.status !== "RECONCILING") operation = this.store.updateOperation(runId, operationId, operation.revision, { status: "RECONCILING" });
    const transportReceipt = this.store.loadTransportReceipt<{
      schema_version: "minimized-transport-receipt.v1";
      message_id: string;
      parent_id: string;
      session_sha256: string;
      response_sha256: string;
      terminal_sha256: string;
    }>(runId, operationId);
    const exactCorrelation = operation.invocation.snapshot_correlation === "EXACT_PARENT_LINK" && transportReceipt !== undefined;
    const stageRequest = stageRequestFromInvocation(operation.invocation);
    const waitMs = boundedResolveWait(options.wait_ms ?? 0);
    const pollIntervalMs = boundedResolvePoll(options.poll_interval_ms ?? 5_000);
    const now = options.now ?? Date.now;
    const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const deadline = now() + waitMs;
    let candidates: SnapshotCandidate[] = [];
    let rawCommandRootCandidates: SnapshotCandidate[] = [];
    let commandRootCandidates: SnapshotCandidate[] = [];
    let recoveredCandidate: SnapshotCandidate | undefined;
    let recoveredFromCommandRoot = false;
    do {
      try {
        candidates = await this.snapshots.collect(runId, operationId);
      } catch {
        // Snapshot access is read-only evidence. A transient read failure may be
        // retried inside this one bounded reconciliation call, but it can never
        // become a lifecycle resend or success without exact correlation.
        candidates = [];
      }
      const resolution = reconcileSnapshot(candidates, {
        sessionSha256: operation.invocation.recipient_session_sha256,
        parentId: transportReceipt?.parent_id ?? "NO_RESPONSE_PARENT_AVAILABLE",
        ...(transportReceipt ? { messageId: transportReceipt.message_id, terminalSha256: transportReceipt.terminal_sha256 } : {}),
        terminal: (text) => {
          try { parseOutputShape(operation.invocation.requested_stage, text); return true; } catch { return false; }
        },
      });
      rawCommandRootCandidates = transportReceipt && !failedOutputRecovery ? [] : candidates.filter((candidate) =>
        candidate.command_root_correlated === true && sha256(candidate.session_id) === operation.invocation.recipient_session_sha256,
      );
      commandRootCandidates = rawCommandRootCandidates.filter((candidate) => {
        try { parseOutputShape(operation.invocation.requested_stage, candidate.text); return true; } catch { return false; }
      });
      const receiptCandidate = exactCorrelation && resolution.status === "TRANSCRIPT_RECONCILED" ? resolution.candidate : undefined;
      const commandRootCandidate = (!transportReceipt || failedOutputRecovery) && commandRootCandidates.length === 1 ? commandRootCandidates[0] : undefined;
      recoveredCandidate = receiptCandidate ?? commandRootCandidate;
      recoveredFromCommandRoot = recoveredCandidate !== undefined && recoveredCandidate === commandRootCandidate && recoveredCandidate !== receiptCandidate;
      if (recoveredCandidate || now() >= deadline) break;
      await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - now())));
    } while (now() <= deadline);
    if (recoveredCandidate && this.resolver) {
      try {
        const loaded = this.store.loadRun(runId);
        const resolved = await this.resolver.resolveStageAuthority(loaded.authority, stageRequest);
        if (!runAuthorityMatchesAcrossOperationalRefresh(resolved.run_authority, loaded.authority) || !["P0B_ISOLATED", "PRODUCTION_RESPONSE_FIRST"].includes(resolved.capability.mode) || resolved.capability.snapshot_correlation !== "EXACT_PARENT_LINK") throw new Error("Snapshot production authority drifted");
        assertPrivateTransportBinding(resolved.transport);
        assertArtifactSafe(recoveredCandidate.text, resolved.transport, resolved.privacy.absolute_paths, resolved.privacy.private_values);
        const parsed = parseOutputShape(operation.invocation.requested_stage, recoveredCandidate.text);
        assertSourceLineage(stageRequest, resolved.sources, loaded.authority, resolved.worktree);
        assertOutputSourceLineage(stageRequest, resolved.sources, parsed.terminal, parsed.fields, resolved.worktree);
        validateOutputBinding(parsed, {
          target: loaded.authority.target_identity,
          epic: loaded.authority.epic,
          lane: `${loaded.authority.accountable_lane} / ${loaded.authority.accountable_class} / ${loaded.authority.accountable_profile}`,
          ...(operation.invocation.candidate_identity === "UNDECLARED" || !["IMPLEMENT", "STEP_REVIEW", "CLOSEOUT"].includes(operation.invocation.requested_stage) ? {} : { candidate: operation.invocation.candidate_identity }),
          plan: operation.invocation.plan_identity,
          plan_class: operation.invocation.plan_class,
        });
        const candidateScope = operation.invocation.requested_stage === "IMPLEMENT"
          ? await this.captureCandidateScope(loaded.authority, stageRequest, operationId)
          : undefined;
        const artifact = `${recoveredCandidate.text.replace(/\r\n/g, "\n").trim()}\n`;
        this.store.writeArtifact(runId, operationId, "terminal", artifact);
        const responseEvidenceSha256 = transportReceipt && !recoveredFromCommandRoot ? transportReceipt.response_sha256 : sha256(canonicalize({
          domain: "fal-router-command-root-transcript-recovery/v1",
          command_body_sha256: operation.invocation.command_body_sha256,
          message_id_sha256: sha256(recoveredCandidate.id),
          parent_id_sha256: sha256(recoveredCandidate.parent_id),
          terminal_sha256: sha256(recoveredCandidate.text),
        }));
        const succeeded = makeResult(operation.invocation, operationId, "SUCCEEDED", "TRANSCRIPT_RECONCILED", "VALID", "BOUND", "VALID", allowedNext(operation.invocation.requested_stage, parsed.terminal), sha256(Buffer.from(artifact, "utf8")), successReason(operation.invocation.requested_stage, parsed.terminal, recoveredFromCommandRoot ? "exact installed command-root transcript correlation validated" : "exact installed response correlation validated"), sha256(recoveredCandidate.id), responseEvidenceSha256, candidateScope?.sha256);
        this.store.updateResult(runId, operationId, succeeded);
        if (failedOutputRecovery) this.store.writeFailedOutputRecoveryReceipt(runId, operationId, {
          schema_version: "failed-output-recovery-receipt.v1",
          run_id: runId,
          operation_id: operationId,
          result: "RECOVERED",
          command_root_candidate_count: rawCommandRootCandidates.length,
          valid_command_root_candidate_count: commandRootCandidates.length,
          recovered_terminal_sha256: sha256(recoveredCandidate.text),
          transport_resent: false,
          raw_output_persisted: false,
        });
        this.store.updateOperation(runId, operationId, operation.revision, { status: "SUCCEEDED" });
        return succeeded;
      } catch {
        // Exact correlation is necessary but not sufficient; any authority,
        // privacy, shape, binding, or finalization failure remains non-success.
      }
    }
    const reason = exactCorrelation || commandRootCandidates.length === 1
      ? "correlated snapshot failed authoritative validation"
      : rawCommandRootCandidates.length === 1
        ? "exact command-root response failed the stage terminal contract"
        : "snapshot evidence is diagnostic without one exact installed response or command-root correlation";
    if (failedOutputRecovery) {
      this.store.writeFailedOutputRecoveryReceipt(runId, operationId, {
        schema_version: "failed-output-recovery-receipt.v1",
        run_id: runId,
        operation_id: operationId,
        result: "NOT_RECOVERED",
        command_root_candidate_count: rawCommandRootCandidates.length,
        valid_command_root_candidate_count: commandRootCandidates.length,
        diagnostic_reason_sha256: sha256(reason),
        transport_resent: false,
        raw_output_persisted: false,
      });
      this.store.updateOperation(runId, operationId, operation.revision, { status: "FAILED_OUTPUT" });
      return this.store.loadResult(runId, operationId) as StageResult;
    }
    const result = makeResult(operation.invocation, operationId, "UNCERTAIN", "NO_SEND", "AMBIGUOUS", "UNVALIDATED", "UNVALIDATED", [], "", reason);
    this.store.updateResult(runId, operationId, result);
    this.store.updateOperation(runId, operationId, operation.revision, { status: "UNCERTAIN" });
    return result;
  }
}

function boundedResolveWait(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 3_600_000) throw new Error("Resolve wait must be between 0 and 3600000 milliseconds");
  return value;
}

function boundedResolvePoll(value: number): number {
  if (!Number.isSafeInteger(value) || value < 250 || value > 30_000) throw new Error("Resolve poll interval must be between 250 and 30000 milliseconds");
  return value;
}

export function runAuthorityMatchesAcrossOperationalRefresh(current: RunAuthority, original: RunAuthority): boolean {
  const { target_profile_sha256: _currentProfileSha, ...currentStable } = current;
  const { target_profile_sha256: _originalProfileSha, ...originalStable } = original;
  return canonicalize(currentStable) === canonicalize(originalStable);
}

export function targetAuthorityMatchesRun(store: StateStore, current: RunAuthority, run: RunAuthority): boolean {
  const followOn = store.loadFollowOnSource(run.run_id);
  if (!followOn) return runAuthorityMatchesAcrossOperationalRefresh(current, run);
  if (followOn.review_cycle !== run.review_cycle || run.next_command !== "/terv-review" || followOn.predecessor_run_authority_sha256 !== store.loadRun(followOn.predecessor_run_id).run.run_authority_sha256) return false;
  const base: RunAuthority = { ...run, review_cycle: followOn.base_review_cycle, next_command: followOn.base_next_command };
  return runAuthorityMatchesAcrossOperationalRefresh(current, base);
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

function routerOwnedSourceCandidates(store: StateStore, runId: string, requiredSourceClasses: readonly SourceClass[]): RouterOwnedSourceCandidate[] {
  const required = new Set(requiredSourceClasses);
  const candidates: RouterOwnedSourceCandidate[] = [];
  const followOn = store.loadFollowOnSource(runId);
  if (followOn && required.has("PLAN")) candidates.push({ ...followOn.binding, content: followOn.content });
  for (const operation of store.listOperations(runId)) {
    if (operation.status !== "SUCCEEDED") continue;
    if (operation.invocation.requested_stage === "CLOSEOUT") continue;
    const result = store.loadResult(runId, operation.operation_id) as { operation_status?: unknown; output_status?: unknown; binding_status?: unknown; terminal_status?: unknown; artifact_sha256?: unknown; candidate_scope_sha256?: unknown };
    if (result.operation_status !== "SUCCEEDED" || result.output_status !== "VALID" || result.binding_status !== "BOUND" || result.terminal_status !== "VALID" || typeof result.artifact_sha256 !== "string") throw new Error("Router-owned source producer result is not valid and bound");
    const content = store.readArtifact(runId, operation.operation_id, "terminal");
    const contentSha = sha256(Buffer.from(content, "utf8"));
    if (contentSha !== result.artifact_sha256) throw new Error("Router-owned source artifact hash mismatch");
    const parsed = parseOutputShape(operation.invocation.requested_stage, content);
    const base = { producer: "FAL_ROUTER_OUTPUT", path: `router-output/${operation.operation_id}/terminal.md`, sha256: contentSha, content };
    if (operation.invocation.requested_stage === "SEQ_NEXT") {
      if (required.has("PLAN")) candidates.push({ ...base, source_class: "PLAN", logical_identity: parsed.fields[parsed.plan_class === "REVIEW_FIX_PLAN" ? "Fix-plan artifact" : "Plan artifact"]! });
    } else if (operation.invocation.requested_stage === "PLAN_REVIEW") {
      if (required.has("META_PLAN_REVIEW")) candidates.push({ ...base, source_class: "META_PLAN_REVIEW", logical_identity: `meta-review-${contentSha.slice(0, 16)}` });
    } else if (operation.invocation.requested_stage === "PLAN_REVISION") {
      if (required.has("REVISED_PLAN")) candidates.push({ ...base, source_class: "REVISED_PLAN", logical_identity: parsed.fields["Final plan artifact"]! });
    } else if (operation.invocation.requested_stage === "IMPLEMENT") {
      if (operation.invocation.candidate_identity === "UNDECLARED") throw new Error("Implementation producer candidate identity is undeclared");
      if (required.has("IMPLEMENTATION_RESULT")) candidates.push({ ...base, source_class: "IMPLEMENTATION_RESULT", logical_identity: operation.invocation.candidate_identity });
      if (required.has("ACCEPTANCE_EVIDENCE")) {
        const frozenScope = frozenCandidateScopeReceipt(store, runId, operation);
        const reviewMode = operation.invocation.review_cycle === "0" ? "INITIAL" : "FIX_RECHECK";
        const acceptanceEvidence = [
          "ACCEPTANCE EVIDENCE",
          `Candidate: ${operation.invocation.candidate_identity}`,
          `Candidate paths: ${canonicalize(frozenScope.candidatePaths)}`,
          `Frozen candidate scope SHA-256: ${frozenScope.sha256}`,
          `Review mode: ${reviewMode}`,
          `Repaired finding IDs: ${canonicalize(operation.invocation.finding_ids)}`,
          `Acceptance mapping: ${parsed.fields["Acceptance mapping"]!}`,
          `Checks/results: ${parsed.fields["Checks/results"]!}`,
          "Evidence producer: FAL_ROUTER_OUTPUT",
          "",
        ].join("\n");
        const acceptanceSha = sha256(Buffer.from(acceptanceEvidence, "utf8"));
        candidates.push({
          source_class: "ACCEPTANCE_EVIDENCE",
          logical_identity: `acceptance-evidence-${acceptanceSha.slice(0, 16)}`,
          producer: "FAL_ROUTER_OUTPUT",
          path: `router-output/${operation.operation_id}/acceptance-evidence.md`,
          sha256: acceptanceSha,
          content: acceptanceEvidence,
        });
      }
    } else if (operation.invocation.requested_stage === "STEP_REVIEW") {
      if (required.has("FINAL_SYNTHESIS")) candidates.push({ ...base, source_class: "FINAL_SYNTHESIS", logical_identity: parsed.fields.Candidate! });
      if (required.has("PROPOSED_DELTA")) {
        const proposedDelta = `${parsed.fields["Proposed closeout delta"]!}\n`;
        candidates.push({ source_class: "PROPOSED_DELTA", logical_identity: `proposed-delta-${contentSha.slice(0, 16)}`, producer: "FAL_ROUTER_OUTPUT", path: `router-output/${operation.operation_id}/proposed-delta.md`, sha256: sha256(Buffer.from(proposedDelta, "utf8")), content: proposedDelta });
      }
    } else if (operation.invocation.requested_stage === "DELIVERY_RESPONSE") {
      if (parsed.terminal === "ACK_ONLY") {
        if (required.has("DELIVERY_RESPONSE")) candidates.push({ ...base, source_class: "DELIVERY_RESPONSE", logical_identity: `delivery-response-${contentSha.slice(0, 16)}` });
      } else if (required.has("PLAN")) candidates.push({ ...base, source_class: "PLAN", logical_identity: parsed.fields["Fix-plan artifact"]! });
    }
  }
  const ownerSource = store.loadOwnerSource(runId);
  if (ownerSource && required.has("CLOSEOUT_AUTHORITY")) candidates.push({ ...ownerSource.binding, content: ownerSource.content });
  return candidates;
}

export function promotedSourcesForStage(store: StateStore, runId: string, stage: StageRequest["requested_stage"]): ResolvedSource[] {
  const candidates = routerOwnedSourceCandidates(store, runId, SOURCE_CLASSES[stage]);
  return SOURCE_CLASSES[stage].flatMap((sourceClass, order) => {
    const matches = candidates.filter((candidate) => candidate.source_class === sourceClass);
    const selected = matches.at(-1);
    return selected ? [{ binding: { path: selected.path, source_class: selected.source_class, logical_identity: selected.logical_identity, producer: selected.producer, sha256: selected.sha256, order }, content: selected.content }] : [];
  });
}

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

function parseProposedDelta(value: string): ProposedDeltaEntry[] {
  if (value === "NONE") return [];
  const parsed = parseStrictJson(value);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Proposed closeout delta is malformed");
  const entries = parsed.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Proposed closeout delta is malformed");
    const record = entry as Record<string, unknown>;
    if (canonicalize(Object.keys(record).sort()) !== canonicalize(["field", "path", "value"]) || typeof record.path !== "string" || typeof record.field !== "string" || typeof record.value !== "string" || !record.field.trim() || !record.value.trim()) throw new Error("Proposed closeout delta is malformed");
    assertSafeRelativePath(record.path, "proposed closeout path");
    return { path: record.path, field: record.field, value: record.value };
  });
  if (new Set(entries.map((entry) => canonicalize([entry.path, entry.field]))).size !== entries.length) throw new Error("Proposed closeout delta contains contradictory or duplicate path-field entries");
  return entries.sort((left, right) => {
    const leftKey = canonicalize([left.path, left.field, left.value]);
    const rightKey = canonicalize([right.path, right.field, right.value]);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function parseAcceptedFindingIds(value: string): string[] {
  if (value === "NONE") return [];
  const findings = parseStrictJson(value);
  if (!Array.isArray(findings) || findings.some((finding) => !finding || typeof finding !== "object" || Array.isArray(finding) || typeof (finding as { id?: unknown }).id !== "string")) throw new Error("Final synthesis accepted findings are malformed");
  return canonicalFindingIds(findings.map((finding) => (finding as { id: string }).id));
}

function synthesisReceipt(synthesis: string, request: StageRequest, authority: RunAuthority): { candidate: string; findingIds: string[]; disposition: string; proposedDelta: ProposedDeltaEntry[]; proposedDeltaPaths: string[] } {
  const output = parseOutputShape("STEP_REVIEW", synthesis);
  validateOutputBinding(output, { ...authorityBinding(authority), candidate: request.candidate_identity });
  const parsed = output.fields["Accepted findings"]!;
  const findingIds = parseAcceptedFindingIds(parsed);
  const proposedDelta = parseProposedDelta(output.fields["Proposed closeout delta"]!);
  return {
    candidate: output.fields.Candidate!,
    findingIds,
    disposition: output.fields["Closeout disposition"]!,
    proposedDelta,
    proposedDeltaPaths: [...new Set(proposedDelta.map((entry) => entry.path))].sort(),
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

function frozenCandidateScopeReceipt(store: StateStore, runId: string, operation: OperationDocument): { candidatePaths: string[]; sha256: string } {
  const result = store.loadResult(runId, operation.operation_id) as { candidate_scope_sha256?: unknown };
  if (typeof result.candidate_scope_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(result.candidate_scope_sha256)) throw new Error("Successful implementation lacks frozen candidate scope evidence");
  const content = store.readArtifact(runId, operation.operation_id, "candidate-scope");
  if (sha256(Buffer.from(content, "utf8")) !== result.candidate_scope_sha256) throw new Error("Frozen candidate scope artifact hash mismatch");
  const parsed = parseStrictJson(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Frozen candidate scope evidence is malformed");
  const scope = parsed as Record<string, unknown>;
  const expectedKeys = ["candidate_identity", "candidate_paths", "implementation_operation_id", "schema_version", "worktree_identity", "worktree_proof_sha256"];
  if (canonicalize(Object.keys(scope).sort()) !== canonicalize(expectedKeys) || scope.schema_version !== "frozen-candidate-scope.v1" || scope.implementation_operation_id !== operation.operation_id || scope.candidate_identity !== operation.invocation.candidate_identity || scope.worktree_identity !== operation.invocation.worktree_identity || typeof scope.worktree_proof_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(scope.worktree_proof_sha256)) throw new Error("Frozen candidate scope evidence binding mismatch");
  if (!Array.isArray(scope.candidate_paths) || scope.candidate_paths.some((entry) => typeof entry !== "string") || new Set(scope.candidate_paths).size !== scope.candidate_paths.length) throw new Error("Frozen candidate scope paths are invalid");
  const candidatePaths = [...(scope.candidate_paths as string[])].sort();
  for (const candidatePath of candidatePaths) assertSafeRelativePath(candidatePath, "frozen candidate scope path");
  if (canonicalize(scope.candidate_paths) !== canonicalize(candidatePaths)) throw new Error("Frozen candidate scope paths are not canonical");
  return { candidatePaths, sha256: result.candidate_scope_sha256 };
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
  candidatePaths: string[];
  allowedPaths: string[];
  commitScope: { mode: "NO_COMMIT"; reason: string } | { mode: "COMMIT"; paths: string[] };
}

function materializeCloseoutAuthorityIntent(intent: Record<string, unknown>, request: Pick<StageRequest, "candidate_identity" | "worktree_identity">, worktree: WorktreeProof, frozenCandidatePaths: readonly string[]): Record<string, unknown> {
  const expectedKeys = ["allowed_paths", "candidate_identity", "candidate_paths", "commit_scope", "global_apply", "restart", "schema_version", "staging_precondition", "worktree_identity"];
  if (canonicalize(Object.keys(intent).sort()) !== canonicalize(expectedKeys) || intent.schema_version !== "closeout-authority-intent.v1" || intent.candidate_identity !== request.candidate_identity || intent.worktree_identity !== request.worktree_identity || !Array.isArray(intent.candidate_paths) || intent.candidate_paths.some((entry) => typeof entry !== "string") || new Set(intent.candidate_paths).size !== intent.candidate_paths.length) throw new Error("Closeout authority intent mismatch");
  const intentCandidatePaths = [...(intent.candidate_paths as string[])].sort();
  for (const candidatePath of intentCandidatePaths) assertSafeRelativePath(candidatePath, "closeout candidate path");
  if (canonicalize(intentCandidatePaths) !== canonicalize(frozenCandidatePaths)) throw new Error("Closeout candidate paths differ from the frozen reviewed scope");
  return { ...intent, candidate_paths: [...frozenCandidatePaths], schema_version: "closeout-authority.v2", worktree_proof_sha256: worktreeProofSha256(worktree) };
}

function closeoutAuthorityReceipt(text: string, request: StageRequest, authority?: RunAuthority, worktree?: WorktreeProof): CloseoutAuthorityReceipt {
  const parsed = parseStrictJson(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Closeout authority envelope mismatch");
  const envelope = parsed as Record<string, unknown>;
  const expectedKeys = ["allowed_paths", "candidate_identity", "candidate_paths", "commit_scope", "global_apply", "restart", "schema_version", "staging_precondition", "worktree_identity", "worktree_proof_sha256"];
  if (canonicalize(Object.keys(envelope).sort()) !== canonicalize(expectedKeys)) throw new Error("Closeout authority envelope mismatch");
  if (!worktree || envelope.schema_version !== "closeout-authority.v2" || envelope.candidate_identity !== request.candidate_identity || envelope.worktree_identity !== request.worktree_identity || (authority && envelope.worktree_identity !== authority.worktree_identity) || envelope.worktree_proof_sha256 !== worktreeProofSha256(worktree) || envelope.global_apply !== false || envelope.restart !== false) throw new Error("Closeout authority envelope mismatch");
  if (!Array.isArray(envelope.candidate_paths) || envelope.candidate_paths.some((entry) => typeof entry !== "string") || new Set(envelope.candidate_paths).size !== envelope.candidate_paths.length) throw new Error("Closeout authority candidate paths are invalid");
  const candidatePaths = [...(envelope.candidate_paths as string[])].sort();
  for (const candidatePath of candidatePaths) assertSafeRelativePath(candidatePath, "closeout candidate path");
  if (!Array.isArray(envelope.allowed_paths) || envelope.allowed_paths.some((entry) => typeof entry !== "string") || new Set(envelope.allowed_paths).size !== envelope.allowed_paths.length) throw new Error("Closeout authority allowed paths are invalid");
  const allowedPaths = [...(envelope.allowed_paths as string[])].sort();
  for (const allowedPath of allowedPaths) assertSafeRelativePath(allowedPath, "closeout allowed path");
  const scope = envelope.commit_scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) throw new Error("Closeout authority commit scope is invalid");
  const commitScope = scope as Record<string, unknown>;
  if (commitScope.mode === "NO_COMMIT") {
    if (canonicalize(Object.keys(commitScope).sort()) !== canonicalize(["mode", "reason"]) || typeof commitScope.reason !== "string" || !commitScope.reason.trim() || candidatePaths.length !== 0 || allowedPaths.length !== 0 || envelope.staging_precondition !== "EMPTY" || worktree.staged_paths.length !== 0 || !worktree.status_clean) throw new Error("Closeout NO_COMMIT authority is invalid");
    return { candidatePaths, allowedPaths, commitScope: { mode: "NO_COMMIT", reason: commitScope.reason.trim() } };
  }
  if (commitScope.mode === "COMMIT") {
    if (canonicalize(Object.keys(commitScope).sort()) !== canonicalize(["mode", "paths"]) || !Array.isArray(commitScope.paths) || commitScope.paths.length === 0 || commitScope.paths.some((entry) => typeof entry !== "string") || new Set(commitScope.paths).size !== commitScope.paths.length || canonicalize([...(commitScope.paths as string[])].sort()) !== canonicalize(allowedPaths) || canonicalize(candidatePaths) !== canonicalize([...worktree.changed_paths].sort()) || envelope.staging_precondition !== "EMPTY" || worktree.staged_paths.length !== 0) throw new Error("Closeout COMMIT authority is invalid");
    return { candidatePaths, allowedPaths, commitScope: { mode: "COMMIT", paths: [...(commitScope.paths as string[])].sort() } };
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
    const implementationSource = sources.find((source) => source.binding.source_class === "IMPLEMENTATION_RESULT")!;
    if (implementationSource.binding.logical_identity !== request.candidate_identity) throw new Error("Implementation candidate source lineage mismatch");
    validateOutputBinding(parsedImplementation, { ...authorityBinding(authority), plan: request.plan_identity });
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
      if (closeout.commitScope.mode === "NO_COMMIT") {
        if (proposedDelta.length !== 0) throw new Error("Closeout commit scope is not authorized by synthesis proposed delta");
      } else {
        const commitPaths = closeout.commitScope.paths;
        const exactCommitPaths = [...new Set([...closeout.candidatePaths, ...receipt.proposedDeltaPaths])].sort();
        if (canonicalize(commitPaths) !== canonicalize(exactCommitPaths)) throw new Error("Closeout commit scope is not the exact candidate and synthesis-delta union");
      }
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
      if (!Array.isArray(staged) || staged.some((entry) => typeof entry !== "string") || new Set(staged).size !== staged.length || canonicalize([...(staged as string[])].sort()) !== canonicalize(receipt.commitScope.paths) || !fields.Commit?.startsWith("sha=")) throw new Error("Closeout result does not match COMMIT authority");
    }
  }
}

function assertResolvedStageStable(current: ResolvedStageAuthority, baseline: ResolvedStageAuthority, expectedAuthoritySha256: string): void {
  if (authoritySha256(current.run_authority) !== expectedAuthoritySha256) throw new Error("Current target authority drifted during immediate transport revalidation");
  if (!sameSources(current.sources.map((source) => source.binding), baseline.sources.map((source) => source.binding))) throw new Error("Current stage sources drifted during immediate transport revalidation");
  for (const source of current.sources) if (sha256(Buffer.from(source.content, "utf8")) !== source.binding.sha256) throw new Error("Current stage source content drifted during immediate transport revalidation");
  if (canonicalize(current.transport) !== canonicalize(baseline.transport)) throw new Error("Protected transport binding drifted during immediate transport revalidation");
  if (canonicalize(current.capability) !== canonicalize(baseline.capability)) throw new Error("Dispatch capability drifted during immediate transport revalidation");
  if (canonicalize(current.shared_fence ?? null) !== canonicalize(baseline.shared_fence ?? null)) throw new Error("Shared Compact/lifecycle fence drifted during immediate transport revalidation");
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
  if (canonicalize(current.transport) !== canonicalize(baseline.transport) || canonicalize(current.capability) !== canonicalize(baseline.capability) || canonicalize(current.shared_fence ?? null) !== canonicalize(baseline.shared_fence ?? null) || canonicalize(current.privacy) !== canonicalize(baseline.privacy)) throw new Error("Closeout protected binding drifted");
  const reportedPaths = parseStrictJson(fields["Staged explicit paths"] ?? "");
  if (!Array.isArray(reportedPaths) || reportedPaths.some((entry) => typeof entry !== "string")) throw new Error("Closeout committed path postcondition failed");
  if (!current.worktree || !baseline.worktree || current.worktree.head_sha256 !== sha256(commit[1]!) || current.worktree.head_tree_sha256 !== sha256(commit[2]!) || current.worktree.head_parent_count !== 1 || current.worktree.sole_parent_sha256 !== baseline.worktree.head_sha256 || canonicalize([...current.worktree.committed_paths].sort()) !== canonicalize([...(reportedPaths as string[])].sort()) || !current.worktree.status_clean || current.worktree.staged_paths.length !== 0 || current.worktree.has_unstaged_or_untracked) throw new Error("Closeout committed worktree postcondition failed");
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

export function renderCommandArgument(request: StageRequest, sources: readonly ResolvedSource[]): string {
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
  if (stage === "DELIVERY_RESPONSE" && terminal === "ACK_ONLY") return [];
  if (stage === "DELIVERY_RESPONSE" && terminal === "FIX_PLAN_REQUIRED") return [];
  return [];
}

function successReason(stage: StageRequest["requested_stage"], terminal: string, fallback: string): string {
  if (stage === "DELIVERY_RESPONSE" && terminal === "FIX_PLAN_REQUIRED") return "FOLLOW_ON_REVIEW_CYCLE_RUN_REQUIRED";
  if (stage === "DELIVERY_RESPONSE" && terminal === "ACK_ONLY") return "OWNER_CLOSEOUT_AUTHORITY_REQUIRED";
  return fallback;
}

function makeResult(request: Pick<StageRequest, "run_id">, operationId: string, operationStatus: string, transportStatus: string, outputStatus: string, bindingStatus: string, terminalStatus: string, allowed: string[], artifactSha: string, reason: string, messageIdSha = "", responseSha = "", candidateScopeSha?: string): StageResult {
  return { schema_version: "stage-result.v1", run_id: request.run_id, operation_id: operationId, operation_status: operationStatus, transport_status: transportStatus, output_status: outputStatus, binding_status: bindingStatus, terminal_status: terminalStatus, allowed_next: allowed, artifact_sha256: artifactSha, message_id_sha256: messageIdSha, response_sha256: responseSha, ...(candidateScopeSha ? { candidate_scope_sha256: candidateScopeSha } : {}), reason, auto_advance: false };
}

export const _test = { assertSourceLineage, assertOutputSourceLineage, assertResolvedStagePostResponse, closeoutAuthorityReceipt, parseProposedDelta, SOURCE_CLASSES };
