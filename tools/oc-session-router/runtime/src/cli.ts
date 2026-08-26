import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeRelativePath,
  assertOpaqueId,
  assertSha256,
  canonicalize,
  parseRunRequest,
  parseStageSourceManifest,
  parseStrictJson,
  parseStageRequest,
  sha256,
  type RunAuthority,
  type RunRequest,
  type StageRequest,
  type SourceClass,
} from "./contracts.js";
import {
  buildSharedFenceBinding,
  FENCE_BROKER_EXECUTABLE,
  FENCE_BROKER_EXECUTABLE_SHA256,
  parseControlRegistry,
  parseRetentionPolicy,
  p0bIsolationRootSha256,
  purgeExpiredPrivateEvidence,
  resolveCompactProtectedAuthority,
  resolveProtectedCapability,
  resolveProtectedTargetDirectory,
  writeAtomicPrivateJson,
  type CapabilityProbe,
  type CompactProtectedAuthorityPacket,
  type ControlRegistry,
  type RegistryTarget,
} from "./control-plane.js";
import { StageEngine, promotedSourcesForStage, runAuthorityMatchesAcrossOperationalRefresh, type AuthorityResolver, type ResolvedSource, type ResolvedStageAuthority } from "./stage-engine.js";
import { StateStore } from "./state-store.js";
import { InstalledSnapshotReader } from "./snapshot-reader.js";
import { CommandClient, InstalledCapabilityProbe, InstalledSnapshotClient } from "./transport.js";
import { GitWorktreeReader, type WorktreeReader } from "./worktree-reader.js";
import { parseP0bProofReceipt, writeP0bProofReceipt } from "./p0b-proof.js";

const PRODUCTION_GIT_EXECUTABLE = "C:\\Program Files\\Git\\cmd\\git.exe";
const PRODUCTION_GIT_SHA256 = "054dfe58df35f7fcfbae184ff9d6a7c0da1e3743bf0401d951e012e290217c73";

const CLI_ERROR_CODES = [
  "REQUEST_INVALID",
  "ROOT_AUTHORITY_BLOCKED",
  "RUN_AUTHORITY_BLOCKED",
  "STATE_STORE_ACCESS",
  "STATE_STORE_BLOCKED",
  "TOOL_ATTESTATION_BLOCKED",
  "UNSAFE_PATH",
  "P0B_REQUIRED",
  "SOURCE_IDENTITY_CHANGED",
  "PARTICIPANT_FENCE_BLOCKED",
  "DISPATCH_LEASE_BLOCKED",
  "SNAPSHOT_BASELINE_BLOCKED",
  "OUTPUT_CHANNEL_BLOCKED",
  "BLOCKED",
] as const;

type CliErrorCode = (typeof CLI_ERROR_CODES)[number];

class ClassifiedCliError extends Error {
  constructor(readonly errorCode: CliErrorCode) {
    super(errorCode);
    this.name = "ClassifiedCliError";
  }
}

class ClassifiedStateStore extends StateStore {
  override createRun(...args: Parameters<StateStore["createRun"]>): ReturnType<StateStore["createRun"]> {
    try { return super.createRun(...args); }
    catch (error) { throw new ClassifiedCliError(stateStoreErrorCode(error)); }
  }
}

class FileAuthorityResolver implements AuthorityResolver {
  constructor(
    private readonly registryPath: string,
    private readonly worktreeReader?: WorktreeReader,
    private readonly protectedControlRoot?: string,
    private readonly capabilityProbe: CapabilityProbe = new InstalledCapabilityProbe(),
    private readonly rootAuthorityClass: "FIXTURE_ONLY" | "OS_KNOWN_FOLDER" | "P0B_TEST_ONLY" = "FIXTURE_ONLY",
    private readonly stateStore?: StateStore,
  ) {
    if (!path.isAbsolute(registryPath) || lstatSync(registryPath).isSymbolicLink()) throw new Error("Control registry must be an ordinary absolute file");
    this.loadRegistry();
  }

  async deriveRunAuthority(request: RunRequest, identity: { runId: string; createdAt: string }): Promise<RunAuthority> {
    const loaded = this.loadRegistry();
    const authority = this.deriveRunAuthorityFromRegistry(request, identity, loaded);
    assertArtifactPrivate(canonicalizeRunAuthority(authority), this.privateValues(loaded.registry));
    return authority;
  }

  private deriveRunAuthorityFromRegistry(request: RunRequest, identity: { runId: string; createdAt: string }, loaded: { registry: ControlRegistry; sha256: string }): RunAuthority {
    const target = this.target(request.target_id, loaded.registry);
    if (target.worktree_identity !== request.expected_worktree_identity) throw new Error("Expected worktree identity mismatch");
    const root = this.targetRoot(loaded.registry, target);
    const state = this.readTargetFile(root, target.state_path);
    const stateText = state.text;
    const stateRevision = label(stateText, "State revision");
    const configurationIdentity = label(stateText, "Configuration identity");
    const wave = label(stateText, "Wave");
    const epic = label(stateText, "Epic");
    const combinedSelector = label(stateText, "Combined selector");
    const pinnedPath = label(stateText, "Pinned artifact");
    const pinnedIdentity = label(stateText, "Pinned artifact logical identity");
    const candidateIdentity = label(stateText, "Candidate identity");
    const reviewCycle = label(stateText, "Review cycle");
    if (!/^(?:0|[1-9]\d*)$/.test(reviewCycle)) throw new Error("Target state review cycle is invalid");
    const stageSourceManifestPath = label(stateText, "Stage source manifest");
    const stageSourceManifestSha256 = label(stateText, "Stage source manifest SHA-256");
    const nextCommand = label(stateText, "Next command");
    const nextActor = label(stateText, "Next actor");
    const combined = this.readTargetFile(root, target.combined_path);
    const combinedSpan = headingSpan(combined.text, combinedSelector);
    const pinned = this.readTargetFile(root, pinnedPath);
    const sourceManifest = this.readTargetFile(root, stageSourceManifestPath);
    if (sourceManifest.sha256 !== stageSourceManifestSha256) throw new Error("SOURCE_IDENTITY_CHANGED: stage source manifest hash differs from target state");
    const parsedManifest = parseStageSourceManifest(parseStrictJson(sourceManifest.text));
    if (parsedManifest.target_id !== request.target_id || parsedManifest.epic !== epic || parsedManifest.candidate_identity !== candidateIdentity) throw new Error("SOURCE_IDENTITY_CHANGED: stage source manifest authority binding mismatch");
    const overlay = this.readTargetFile(root, target.overlay_path);
    const role = this.readTargetFile(root, target.accountable_role_path);
    let activeRouteGeneration = "UNDECLARED";
    if (target.active_route_path) {
      const active = this.readTargetFile(root, target.active_route_path);
      const projection = parseActiveRoute(active.text);
      if (target.require_active_route && (projection.state?.sha256 !== state.sha256 || projection.combined?.sha256 !== sha256(combinedSpan))) throw new Error("SOURCE_IDENTITY_CHANGED: active route is stale");
      if (target.require_active_route) {
        assertActiveRouteBinding(projection, {
          targetId: request.target_id, profileId: target.profile_identity, workflowPhase: label(stateText, "Workflow phase"), statePath: target.state_path,
          stateRevision, stateSha256: state.sha256, combinedPath: target.combined_path, combinedSelector, combinedSha256: sha256(combinedSpan), wave,
          epic, stagePath: pinnedPath, stageSha256: pinned.sha256, stageIdentity: pinnedIdentity, candidateIdentity, configurationIdentity,
          worktreeIdentity: target.worktree_identity, nextActor, nextCommand,
        });
        activeRouteGeneration = projection.generation_id;
      }
    }
    return {
      schema_version: "run-authority.v1",
      run_id: identity.runId,
      created_at: identity.createdAt,
      target_id: request.target_id,
      target_identity: target.target_identity,
      worktree_identity: target.worktree_identity,
      wave,
      epic,
      accountable_lane: target.accountable.lane,
      accountable_class: target.accountable.class,
      accountable_profile: target.accountable.profile,
      target_profile_identity: target.profile_identity,
      target_profile_sha256: loaded.sha256,
      state_path: target.state_path,
      state_revision: stateRevision,
      state_sha256: state.sha256,
      combined_path: target.combined_path,
      combined_selector: combinedSelector,
      combined_span_sha256: sha256(combinedSpan),
      pinned_artifact_path: pinnedPath,
      pinned_artifact_identity: pinnedIdentity,
      pinned_artifact_sha256: pinned.sha256,
      overlay_identity: sha256(overlay.text),
      accountable_role_identity: sha256(role.text),
      configuration_identity: configurationIdentity,
      active_route_generation: activeRouteGeneration,
      review_cycle: reviewCycle,
      stage_source_manifest_path: stageSourceManifestPath,
      stage_source_manifest_sha256: stageSourceManifestSha256,
      next_command: nextCommand,
    };
  }

  async resolveStageCapability(runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority["capability"]> {
    const loaded = this.loadRegistry();
    const target = this.target(runAuthority.target_id, loaded.registry);
    return this.resolveCapability(loaded.registry, runAuthority.target_id, target, request);
  }

  async resolveStageAuthority(runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority> {
    const loaded = this.loadRegistry();
    const current = this.deriveRunAuthorityFromRegistry(
      { schema_version: "run-request.v1", target_id: runAuthority.target_id, expected_worktree_identity: runAuthority.worktree_identity },
      { runId: runAuthority.run_id, createdAt: runAuthority.created_at },
      loaded,
    );
    const target = this.target(runAuthority.target_id, loaded.registry);
    const root = this.targetRoot(loaded.registry, target);
    if (!runAuthorityMatchesAcrossOperationalRefresh(current, runAuthority)) throw new Error("Current target semantic authority drifted");
    const sources = this.resolveSources(root, current, request);
    const recipient = target.sessions[request.recipient_role];
    if (!recipient?.id) throw new Error("Protected registry has no exact recipient role mapping");
    const capability = await this.resolveCapability(loaded.registry, runAuthority.target_id, target, request);
    const username = process.env.OPENCODE_SERVER_USERNAME;
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    if (!username || !password) throw new Error("Process-scoped OpenCode authentication is unavailable");
    return {
      run_authority: runAuthority,
      sources,
      transport: { origin: target.server.origin, server_fingerprint: capability.server_instance_identity_sha256 ?? target.server.fingerprint ?? "FIXTURE_ONLY", session_id: recipient.id, username, password, directory: root },
      capability,
      privacy: { absolute_paths: [root, path.dirname(this.registryPath), this.registryPath], private_values: this.privateValues(loaded.registry) },
      ...(["P0B_ISOLATED", "PRODUCTION_RESPONSE_FIRST"].includes(capability.mode) ? { shared_fence: buildSharedFenceBinding(root, recipient.id) } : {}),
      ...(request.requested_stage === "CLOSEOUT" && this.worktreeReader ? { worktree: this.worktreeReader.inspect(root) } : {}),
    };
  }

  private async resolveCapability(registry: ControlRegistry, targetId: string, target: RegistryTarget, request: StageRequest): Promise<ResolvedStageAuthority["capability"]> {
    if (registry.schema_version === "router-control-registry.v1") return { mode: "FIXTURE_ONLY", identity_sha256: sha256("FIXTURE_ONLY") };
    return resolveProtectedCapability({
      registry,
      registry_path: this.registryPath,
      ...(this.protectedControlRoot === undefined ? {} : { protected_control_root: this.protectedControlRoot }),
      target_id: targetId,
      target,
      request,
      probe: this.capabilityProbe,
      credentials: () => ({ username: process.env.OPENCODE_SERVER_USERNAME ?? "", password: process.env.OPENCODE_SERVER_PASSWORD ?? "" }),
      ...(process.env.OC_ROUTER_EXECUTABLE_ATTESTATION_SHA256 === undefined ? {} : { executable_attestation_sha256: process.env.OC_ROUTER_EXECUTABLE_ATTESTATION_SHA256 }),
    });
  }

  private resolveSources(root: string, authority: RunAuthority, request: StageRequest): ResolvedSource[] {
    const manifest = this.readTargetFile(root, authority.stage_source_manifest_path);
    if (manifest.sha256 !== authority.stage_source_manifest_sha256) throw new Error("SOURCE_IDENTITY_CHANGED: stage source manifest drifted");
    const parsed = parseStageSourceManifest(parseStrictJson(manifest.text));
    if (parsed.target_id !== authority.target_id || parsed.epic !== authority.epic || (request.candidate_identity !== "UNDECLARED" && parsed.candidate_identity !== request.candidate_identity)) throw new Error("Stage source manifest authority binding mismatch");
    const matches = parsed.entries.filter((entry) => entry.stage === request.requested_stage && entry.plan_class === request.plan_class);
    if (matches.length > 1) throw new Error("Stage source manifest has no unique current stage entry");
    const expectedClasses = requiredSourceClasses(request.requested_stage);
    if (matches.length === 1 && (matches[0]!.sources.length !== expectedClasses.length || matches[0]!.sources.some((source, index) => source.source_class !== expectedClasses[index]))) throw new Error("Stage source manifest source classes are invalid for stage");
    const targetSources = matches.length === 0 ? [] : matches[0]!.sources.map((binding) => {
      const source = this.readTargetFile(root, binding.path);
      if (source.sha256 !== binding.sha256) throw new Error("Stage source manifest hash mismatch");
      return { binding, content: source.text };
    });
    const promoted = this.stateStore ? promotedSourcesForStage(this.stateStore, request.run_id, request.requested_stage) : [];
    const resolved = expectedClasses.map((sourceClass, order) => {
      const targetMatches = targetSources.filter((source) => source.binding.source_class === sourceClass);
      const promotedMatches = promoted.filter((source) => source.binding.source_class === sourceClass);
      if (targetMatches.length > 1 || promotedMatches.length > 1) throw new Error("SOURCE_SUBSTITUTION: conflicting target and router-owned source authority");
      if (targetMatches.length === 1 && promotedMatches.length === 1 && (targetMatches[0]!.binding.sha256 !== promotedMatches[0]!.binding.sha256 || targetMatches[0]!.binding.logical_identity !== promotedMatches[0]!.binding.logical_identity)) throw new Error("SOURCE_SUBSTITUTION: conflicting target and router-owned source authority");
      const selected = promotedMatches[0] ?? targetMatches[0];
      if (!selected) throw new Error("Stage source manifest and router-owned outputs do not provide the required stage source");
      return { binding: { ...selected.binding, order }, content: selected.content };
    });
    if (resolved.some((source, index) => source.binding.source_class !== expectedClasses[index])) throw new Error("Stage source manifest source classes are invalid for stage");
    return resolved;
  }

  private loadRegistry(): { registry: ControlRegistry; sha256: string } {
    if (lstatSync(this.registryPath).isSymbolicLink()) throw new Error("Control registry must remain an ordinary file");
    const bytes = readFileSync(this.registryPath);
    const registry = parseControlRegistry(parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (this.rootAuthorityClass === "P0B_TEST_ONLY" && registry.schema_version === "router-control-registry.v2" && registry.mode === "PRODUCTION_RESPONSE_FIRST") throw new Error("Test-only KnownFolder authority cannot authorize production");
    if (this.rootAuthorityClass === "P0B_TEST_ONLY" && registry.schema_version === "router-control-registry.v2") {
      if (!this.protectedControlRoot) throw new Error("Test-only authority requires the fixed protected control root");
      const expectedIsolationRoot = path.join(path.dirname(this.protectedControlRoot), "runtime", "p0b-isolation");
      if (!sameFilesystemPath(registry.p0b_isolation_root, expectedIsolationRoot) || registry.p0b_isolation_root_sha256 !== p0bIsolationRootSha256(expectedIsolationRoot)) throw new Error("Test-only authority requires the dedicated fixed P0B fixture root");
    }
    return { registry, sha256: sha256(bytes) };
  }

  private privateValues(registry: ControlRegistry): string[] {
    const values = [this.registryPath, path.dirname(this.registryPath)];
    if (registry.schema_version === "router-control-registry.v2") values.push(registry.p0b_isolation_root);
    for (const target of Object.values(registry.targets)) {
      values.push(target.root, target.server.origin);
      if (target.server.fingerprint) values.push(target.server.fingerprint);
      for (const session of Object.values(target.sessions)) values.push(session.id);
    }
    return values;
  }

  private target(id: string, registry: ControlRegistry): RegistryTarget {
    const target = registry.targets[id];
    if (!target) throw new Error("Protected registry has no target mapping");
    return target;
  }

  private targetRoot(registry: ControlRegistry, target: RegistryTarget): string {
    return resolveProtectedTargetDirectory(registry, target.root, "target root");
  }

  private readTargetFile(root: string, relative: string): { text: string; sha256: string } {
    assertSafeRelativePath(relative, "target file path");
    const candidate = path.resolve(root, relative);
    const rel = path.relative(root, candidate);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Target file escapes root");
    let current = root;
    for (const segment of rel.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      if (lstatSync(current).isSymbolicLink()) throw new Error("Target file path traverses a link or junction");
    }
    const resolved = realpathSync(candidate);
    if (path.relative(root, resolved).startsWith("..")) throw new Error("Resolved target file escapes root");
    const bytes = readFileSync(resolved);
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), sha256: sha256(bytes) };
  }
}

interface ActiveRouteManifest {
  schema_version: "1";
  contract: "agent-workflow-active-route/v1";
  generation_id: string;
  created_utc: string;
  project_id: string;
  profile_id: string;
  workflow_phase: string;
  state: { path: string; sha256: string; state_revision: string };
  combined: { path: string; selector: string; sha256: string; wave_id: string; epic_id: string };
  stage: { path: string; sha256: string; logical_identity: string };
  candidate_identity: string;
  configuration_identity: string;
  worktree_identity?: string;
  next_actor: string;
  next_command: string;
  route_input: { mode: "PINNED_ARTIFACT"; path: string; sha256: string; logical_identity: string } | { mode: "EXACT_EMPTY" | "NOT_APPLICABLE" };
}

function parseActiveRoute(text: string): ActiveRouteManifest {
  if (Buffer.byteLength(text, "utf8") > 64 * 1024) throw new Error("Active Route exceeds byte limit");
  const parsed = parseStrictJson(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Active Route schema mismatch");
  const record = parsed as Record<string, unknown>;
  const required = ["candidate_identity", "combined", "configuration_identity", "contract", "created_utc", "generation_id", "next_actor", "next_command", "profile_id", "project_id", "route_input", "schema_version", "stage", "state", "workflow_phase"];
  const actual = Object.keys(record).sort();
  if (record.worktree_identity !== undefined) required.push("worktree_identity");
  if (JSON.stringify(actual) !== JSON.stringify(required.sort())) throw new Error("Active Route schema mismatch");
  if (record.schema_version !== "1" || record.contract !== "agent-workflow-active-route/v1") throw new Error("Active Route contract mismatch");
  const exactRecord = (value: unknown, keys: string[], labelName: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value as object).sort()) !== JSON.stringify([...keys].sort())) throw new Error(`Active Route ${labelName} schema mismatch`);
    return value as Record<string, unknown>;
  };
  const state = exactRecord(record.state, ["path", "sha256", "state_revision"], "state");
  const combined = exactRecord(record.combined, ["path", "selector", "sha256", "wave_id", "epic_id"], "combined");
  const stage = exactRecord(record.stage, ["path", "sha256", "logical_identity"], "stage");
  const route = record.route_input as Record<string, unknown>;
  const routeMode = route?.mode;
  const routeKeys = routeMode === "PINNED_ARTIFACT" ? ["mode", "path", "sha256", "logical_identity"] : ["mode"];
  exactRecord(route, routeKeys, "route_input");
  const string = (value: unknown, labelName: string): string => { if (typeof value !== "string" || !value) throw new Error(`Active Route ${labelName} mismatch`); return value; };
  const digest = (value: unknown, labelName: string): string => { const result = string(value, labelName); assertSha256(result, labelName); return result; };
  const relative = (value: unknown, labelName: string): string => { const result = string(value, labelName); assertSafeRelativePath(result, labelName); return result.replace(/\\/g, "/"); };
  const identity = (value: unknown, labelName: string): string => { const result = string(value, labelName); assertOpaqueId(result, labelName); if (/(?:^|[^A-Za-z0-9])ses_[A-Za-z0-9_-]*/i.test(result)) throw new Error(`Active Route ${labelName} contains a private registry sentinel`); return result; };
  const manifest: ActiveRouteManifest = {
    schema_version: "1", contract: "agent-workflow-active-route/v1", generation_id: digest(record.generation_id, "generation_id"),
    created_utc: string(record.created_utc, "created_utc"), project_id: identity(record.project_id, "project_id"), profile_id: identity(record.profile_id, "profile_id"),
    workflow_phase: string(record.workflow_phase, "workflow_phase"),
    state: { path: relative(state.path, "state.path"), sha256: digest(state.sha256, "state.sha256"), state_revision: identity(state.state_revision, "state.state_revision") },
    combined: { path: relative(combined.path, "combined.path"), selector: string(combined.selector, "combined.selector"), sha256: digest(combined.sha256, "combined.sha256"), wave_id: identity(combined.wave_id, "combined.wave_id"), epic_id: identity(combined.epic_id, "combined.epic_id") },
    stage: { path: relative(stage.path, "stage.path"), sha256: digest(stage.sha256, "stage.sha256"), logical_identity: identity(stage.logical_identity, "stage.logical_identity") },
    candidate_identity: identity(record.candidate_identity, "candidate_identity"), configuration_identity: identity(record.configuration_identity, "configuration_identity"),
    ...(record.worktree_identity === undefined ? {} : { worktree_identity: identity(record.worktree_identity, "worktree_identity") }),
    next_actor: string(record.next_actor, "next_actor"), next_command: string(record.next_command, "next_command"),
    route_input: routeMode === "PINNED_ARTIFACT"
      ? { mode: "PINNED_ARTIFACT", path: relative(route.path, "route_input.path"), sha256: digest(route.sha256, "route_input.sha256"), logical_identity: identity(route.logical_identity, "route_input.logical_identity") }
      : { mode: routeMode === "EXACT_EMPTY" ? "EXACT_EMPTY" : routeMode === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : (() => { throw new Error("Active Route route mode mismatch"); })() },
  };
  if (!/^(?:NOT_STARTED|SEQ_NEXT|PLAN_REVIEW|PLAN_REVISION|IMPLEMENT|STEP_REVIEW|REVIEW_RESPONSE|FIX_PLAN_REVIEW|FIX_PLAN_REVISION|FIX_IMPLEMENT|CLOSEOUT|COMPLETE)$/.test(manifest.workflow_phase)) throw new Error("Active Route phase mismatch");
  if (!Number.isFinite(Date.parse(manifest.created_utc)) || !manifest.created_utc.endsWith("Z") || !manifest.combined.selector.startsWith("HEADING:")) throw new Error("Active Route timestamp or selector mismatch");
  if ((manifest.next_command === "NONE") !== (manifest.route_input.mode === "NOT_APPLICABLE")) throw new Error("Active Route command and route input mismatch");
  if (manifest.route_input.mode === "EXACT_EMPTY") throw new Error("Active Route EXACT_EMPTY is disabled by the current Canon contract");
  assertArtifactPrivate(canonicalizeRunAuthority(manifest as unknown as RunAuthority), []);
  if (activeRouteGeneration(manifest) !== manifest.generation_id) throw new Error("Active Route generation mismatch");
  return manifest;
}

function activeRouteGeneration(manifest: Omit<ActiveRouteManifest, "generation_id" | "created_utc"> | ActiveRouteManifest): string {
  const route = manifest.route_input;
  const rows = [
    `contract=${manifest.contract}`, `project_id=${manifest.project_id}`, `profile_id=${manifest.profile_id}`, `workflow_phase=${manifest.workflow_phase}`,
    `state.path=${manifest.state.path}`, `state.sha256=${manifest.state.sha256}`, `state.state_revision=${manifest.state.state_revision}`,
    `combined.path=${manifest.combined.path}`, `combined.selector=${manifest.combined.selector}`, `combined.sha256=${manifest.combined.sha256}`,
    `combined.wave_id=${manifest.combined.wave_id}`, `combined.epic_id=${manifest.combined.epic_id}`, `stage.path=${manifest.stage.path}`,
    `stage.sha256=${manifest.stage.sha256}`, `stage.logical_identity=${manifest.stage.logical_identity}`, `candidate_identity=${manifest.candidate_identity}`,
    `configuration_identity=${manifest.configuration_identity}`, `worktree_identity=${manifest.worktree_identity ?? "ABSENT"}`, `next_actor=${manifest.next_actor}`,
    `next_command=${manifest.next_command}`, `route_input.mode=${route.mode}`, `route_input.path=${"path" in route ? route.path : "ABSENT"}`,
    `route_input.sha256=${"sha256" in route ? route.sha256 : "ABSENT"}`, `route_input.logical_identity=${"logical_identity" in route ? route.logical_identity : "ABSENT"}`,
  ];
  return sha256(rows.join("\n"));
}

function assertActiveRouteBinding(manifest: ActiveRouteManifest, expected: { targetId: string; profileId: string; workflowPhase: string; statePath: string; stateRevision: string; stateSha256: string; combinedPath: string; combinedSelector: string; combinedSha256: string; wave: string; epic: string; stagePath: string; stageSha256: string; stageIdentity: string; candidateIdentity: string; configurationIdentity: string; worktreeIdentity: string; nextActor: string; nextCommand: string }): void {
  const route = manifest.route_input;
  const actual = [manifest.project_id, manifest.profile_id, manifest.workflow_phase, manifest.state.path, manifest.state.state_revision, manifest.state.sha256, manifest.combined.path, manifest.combined.selector, manifest.combined.sha256, manifest.combined.wave_id, manifest.combined.epic_id, manifest.stage.path, manifest.stage.sha256, manifest.stage.logical_identity, manifest.candidate_identity, manifest.configuration_identity, manifest.worktree_identity ?? "UNDECLARED", manifest.next_actor, manifest.next_command, route.mode, "path" in route ? route.path : "ABSENT", "sha256" in route ? route.sha256 : "ABSENT", "logical_identity" in route ? route.logical_identity : "ABSENT"];
  const expectedRoute = expected.nextCommand === "NONE" ? ["NOT_APPLICABLE", "ABSENT", "ABSENT", "ABSENT"] : ["PINNED_ARTIFACT", expected.stagePath, expected.stageSha256, expected.stageIdentity];
  const wanted = [expected.targetId, expected.profileId, expected.workflowPhase, expected.statePath, expected.stateRevision, expected.stateSha256, expected.combinedPath, expected.combinedSelector, expected.combinedSha256, expected.wave, expected.epic, expected.stagePath, expected.stageSha256, expected.stageIdentity, expected.candidateIdentity, expected.configurationIdentity, expected.worktreeIdentity, expected.nextActor, expected.nextCommand, ...expectedRoute];
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error("SOURCE_IDENTITY_CHANGED: Active Route binding mismatch");
}

function canonicalizeRunAuthority(authority: unknown): string {
  return JSON.stringify(authority);
}

function assertArtifactPrivate(value: string, privateValues: readonly string[]): void {
  for (const item of privateValues) {
    for (const variant of [item, encodeURI(item), encodeURIComponent(item), Buffer.from(item, "utf8").toString("base64"), item.replace(/\\/g, "/")]) {
      if (variant && value.includes(variant)) throw new Error("Run authority contains a private registry sentinel");
    }
  }
  if (/(?:https?:\/\/|(?:[A-Za-z]:[\\/]|\/(?:home|Users|var|tmp)\/)[^\s`"']+|(?:^|[^A-Za-z0-9])ses_[A-Za-z0-9_-]*|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/i.test(value)) throw new Error("Run authority contains a private registry sentinel");
}

interface RootAuthorityProof {
  known_folder_root: string;
  authority_class: "OS_KNOWN_FOLDER" | "P0B_TEST_ONLY";
  proof_sha256: string;
}

function productionAuthorityResolver(registryPath: string, explicitTestProof?: RootAuthorityProof, stateStore?: StateStore): FileAuthorityResolver {
  const authority = productionAuthorityContext(registryPath, explicitTestProof);
  return new FileAuthorityResolver(registryPath, new GitWorktreeReader(PRODUCTION_GIT_EXECUTABLE, PRODUCTION_GIT_SHA256), authority.controlRoot, new InstalledCapabilityProbe(), authority.authorityClass, stateStore);
}

function dispatchAuthorityResolver(registryPath: string, stateStore?: StateStore): FileAuthorityResolver {
  const registry = parseControlRegistry(parseStrictJson(readFileSync(registryPath, "utf8")));
  return registry.schema_version === "router-control-registry.v1"
    ? new FileAuthorityResolver(registryPath, new GitWorktreeReader(PRODUCTION_GIT_EXECUTABLE, PRODUCTION_GIT_SHA256))
    : productionAuthorityResolver(registryPath, undefined, stateStore);
}

function productionAuthorityContext(registryPath: string, explicitTestProof?: RootAuthorityProof): { controlRoot: string; runtimeRoot: string; authorityClass: RootAuthorityProof["authority_class"] } {
  let authorityClass: RootAuthorityProof["authority_class"];
  let knownFolderRoot: string;
  if (explicitTestProof) {
    if (explicitTestProof.authority_class !== "P0B_TEST_ONLY") throw new Error("Only the bounded P0B test authority may be injected");
    if (!path.isAbsolute(explicitTestProof.known_folder_root)) throw new Error("KnownFolder test authority proof is unavailable");
    knownFolderRoot = assertOrdinaryPathSegments(explicitTestProof.known_folder_root, explicitTestProof.known_folder_root, "KnownFolder test root");
    const expectedProof = sha256(`fal-router-known-folder-authority/v1\nP0B_TEST_ONLY\n${knownFolderRoot}`);
    if (explicitTestProof.proof_sha256 !== expectedProof) throw new Error("KnownFolder test authority proof mismatch");
    authorityClass = "P0B_TEST_ONLY";
  } else if (process.env.OC_ROUTER_ROOT_AUTHORITY_CLASS === "P0B_TEST_ONLY") {
    const candidate = process.env.OC_ROUTER_KNOWN_FOLDER_ROOT ?? "";
    if (!path.isAbsolute(candidate)) throw new Error("KnownFolder test authority proof is unavailable");
    knownFolderRoot = assertOrdinaryPathSegments(candidate, candidate, "KnownFolder test root");
    const expectedProof = sha256(`fal-router-known-folder-authority/v1\nP0B_TEST_ONLY\n${knownFolderRoot}`);
    if (process.env.OC_ROUTER_ROOT_AUTHORITY_SHA256 !== expectedProof) throw new Error("KnownFolder test authority proof mismatch");
    authorityClass = "P0B_TEST_ONLY";
  } else {
    if (process.env.OC_ROUTER_ROOT_AUTHORITY_CLASS && process.env.OC_ROUTER_ROOT_AUTHORITY_CLASS !== "OS_KNOWN_FOLDER") throw new Error("KnownFolder authority class is invalid");
    knownFolderRoot = resolveOsKnownFolderRoot();
    authorityClass = "OS_KNOWN_FOLDER";
    const declaredRoot = process.env.OC_ROUTER_KNOWN_FOLDER_ROOT;
    if (declaredRoot && (!path.isAbsolute(declaredRoot) || !sameFilesystemPath(realpathSync(declaredRoot), knownFolderRoot))) throw new Error("Declared LocalAppData differs from the OS KnownFolder authority");
    const expectedProof = sha256(`fal-router-known-folder-authority/v1\nOS_KNOWN_FOLDER\n${knownFolderRoot}`);
    if (process.env.OC_ROUTER_ROOT_AUTHORITY_SHA256 && process.env.OC_ROUTER_ROOT_AUTHORITY_SHA256 !== expectedProof) throw new Error("Declared KnownFolder authority proof mismatch");
    const ambient = process.env.LOCALAPPDATA;
    if (ambient && (!path.isAbsolute(ambient) || !sameFilesystemPath(realpathSync(ambient), knownFolderRoot))) throw new Error("Ambient LocalAppData differs from the OS KnownFolder authority");
  }
  const fixedRoot = assertOrdinaryPathSegments(knownFolderRoot, path.join(knownFolderRoot, "FractalAgentLab", "oc-router"), "fixed router root");
  const controlRoot = assertOrdinaryPathSegments(knownFolderRoot, path.join(fixedRoot, "control"), "fixed control root");
  const runtimeRoot = assertOrdinaryPathSegments(knownFolderRoot, path.join(fixedRoot, "runtime"), "fixed runtime root");
  const expectedRegistry = path.join(controlRoot, "control-registry.json");
  if (!sameFilesystemPath(realpathSync(registryPath), realpathSync(expectedRegistry))) throw new Error("Control registry differs from the KnownFolder authority");
  if (authorityClass === "P0B_TEST_ONLY") {
    const registry = parseControlRegistry(parseStrictJson(readFileSync(expectedRegistry, "utf8")));
    if (registry.schema_version !== "router-control-registry.v2" || registry.mode === "PRODUCTION_RESPONSE_FIRST") throw new Error("Test-only KnownFolder authority cannot authorize production");
    const expectedIsolationRoot = assertOrdinaryPathSegments(runtimeRoot, path.join(runtimeRoot, "p0b-isolation"), "dedicated P0B fixture root");
    if (!sameFilesystemPath(registry.p0b_isolation_root, expectedIsolationRoot) || registry.p0b_isolation_root_sha256 !== p0bIsolationRootSha256(expectedIsolationRoot)) throw new Error("Test-only authority requires the dedicated fixed P0B fixture root");
  }
  return { controlRoot, runtimeRoot, authorityClass };
}

function resolveOsKnownFolderRoot(): string {
  if (process.platform !== "win32") throw new Error("OS KnownFolder authority is Windows-only");
  const executable = FENCE_BROKER_EXECUTABLE;
  const item = lstatSync(executable);
  if (!item.isFile() || item.isSymbolicLink() || sha256(readFileSync(executable)) !== FENCE_BROKER_EXECUTABLE_SHA256) throw new Error("KnownFolder authority broker is unavailable");
  const systemRoot = path.resolve(path.dirname(executable), "..", "..", "..");
  const query = "[Console]::Out.Write([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData))";
  const child = spawnSync(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", query], {
    encoding: "utf8",
    env: { SystemRoot: systemRoot, WINDIR: systemRoot },
    timeout: 10_000,
    windowsHide: true,
  });
  if (child.status !== 0 || child.error || child.stderr || !child.stdout || /[\r\n\0]/.test(child.stdout)) throw new Error("OS KnownFolder authority query failed");
  const root = child.stdout;
  if (!path.isAbsolute(root)) throw new Error("OS KnownFolder authority query returned an invalid path");
  return assertOrdinaryPathSegments(root, root, "OS LocalApplicationData KnownFolder");
}

async function resolveCompactAuthorityOperation(options: {
  registryPath: string;
  controlRoot: string;
  targetId: string;
  recipientRole: string;
  store: StateStore;
  probe: CapabilityProbe;
  credentials: () => { username: string; password: string };
  executableAttestationSha256?: string;
  rootAuthorityClass?: RootAuthorityProof["authority_class"];
  consume: boolean;
  attemptId?: string;
  now?: Date;
}): Promise<CompactProtectedAuthorityPacket> {
  const registry = parseControlRegistry(parseStrictJson(readFileSync(options.registryPath, "utf8")));
  if (options.rootAuthorityClass === "P0B_TEST_ONLY" && registry.schema_version === "router-control-registry.v2" && registry.mode === "PRODUCTION_RESPONSE_FIRST") throw new Error("Test-only KnownFolder authority cannot authorize production Compact dispatch");
  const packet = await resolveCompactProtectedAuthority({
    registry,
    registry_path: options.registryPath,
    protected_control_root: options.controlRoot,
    target_id: options.targetId,
    recipient_role: options.recipientRole,
    probe: options.probe,
    credentials: options.credentials,
    ...(options.executableAttestationSha256 === undefined ? {} : { executable_attestation_sha256: options.executableAttestationSha256 }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  if (!options.consume) return packet;
  const attemptId = options.attemptId;
  if (!attemptId) throw new Error("Compact authority consumption requires an attempt ID");
  assertOpaqueId(attemptId, "Compact attempt ID");
  if (packet.mode === "P0B_ISOLATED") {
    const operationId = `compact-${sha256(attemptId).slice(0, 40)}`;
    options.store.claimOneUseCapability(packet.authorization_use_sha256, "compact-lite", operationId);
    options.store.settleOneUseCapability(packet.authorization_use_sha256, "compact-lite", operationId, "CONSUMED");
    return { ...packet, authorization_state: "CONSUMED" };
  }
  return { ...packet, authorization_state: "NOT_APPLICABLE" };
}

function compactAuthorityStatus(packet: CompactProtectedAuthorityPacket, handoffToken: string): unknown {
  if (!/^[a-f0-9]{32}$/.test(handoffToken)) throw new Error("Compact authority handoff token is invalid");
  return {
    schema_version: "compact-protected-authority-status.v1",
    authorization_state: packet.authorization_state,
    mode: packet.mode,
    target_id: packet.target_id,
    logical_session_ref: packet.logical_session_ref,
    target_directory_sha256: packet.target_directory_sha256,
    session_sha256: packet.session_sha256,
    server_binary_sha256: packet.server_binary_sha256,
    server_instance_identity_sha256: packet.server_instance_identity_sha256,
    capability_receipt_sha256: packet.capability_receipt_sha256,
    authorization_use_sha256: packet.authorization_use_sha256,
    command_timeout_ms: packet.command_timeout_ms,
    handoff_token: handoffToken,
  };
}

function writeCompactAuthorityHandoff(runtimeRoot: string, packet: CompactProtectedAuthorityPacket, handoffToken: string): unknown {
  const status = compactAuthorityStatus(packet, handoffToken);
  const handoffRoot = assertOrdinaryPathSegments(runtimeRoot, path.join(runtimeRoot, "compact-authority-handoffs"), "Compact authority handoff root");
  const handoffPath = path.join(handoffRoot, `${handoffToken}.json`);
  try { lstatSync(handoffPath); throw new Error("Compact authority handoff already exists"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  writeAtomicPrivateJson(handoffPath, packet);
  return status;
}

function assertOrdinaryPathSegments(containmentRoot: string, candidate: string, labelName: string): string {
  const root = path.resolve(containmentRoot);
  const full = path.resolve(candidate);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${labelName} escapes KnownFolder authority`);
  let current = root;
  for (const segment of ["", ...relative.split(path.sep).filter(Boolean)]) {
    if (segment) current = path.join(current, segment);
    const item = lstatSync(current);
    if (!item.isDirectory() || item.isSymbolicLink()) throw new Error(`${labelName} traverses a reparse point or non-directory`);
  }
  return realpathSync(full);
}

function sameFilesystemPath(left: string, right: string): boolean {
  return process.platform === "win32" ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase() : path.resolve(left) === path.resolve(right);
}

function requiredSourceClasses(stage: StageRequest["requested_stage"]): readonly SourceClass[] {
  const classes: Record<StageRequest["requested_stage"], readonly SourceClass[]> = {
    SEQ_NEXT: ["PLANNING_CONTEXT"],
    PLAN_REVIEW: ["PLAN"],
    PLAN_REVISION: ["PLAN", "META_PLAN_REVIEW"],
    IMPLEMENT: ["REVISED_PLAN"],
    STEP_REVIEW: ["IMPLEMENTATION_RESULT", "ACCEPTANCE_EVIDENCE"],
    DELIVERY_RESPONSE: ["FINAL_SYNTHESIS"],
    CLOSEOUT: ["FINAL_SYNTHESIS", "DELIVERY_RESPONSE", "PROPOSED_DELTA", "CLOSEOUT_AUTHORITY"],
  };
  return classes[stage];
}

function label(text: string, name: string): string {
  const matches = [...text.matchAll(new RegExp(`^${escapeRegex(name)}:\\s*\`([^\`]+)\`\\s*$`, "gm"))];
  if (matches.length !== 1 || !matches[0]?.[1]) throw new Error(`Target state must declare exactly one ${name}`);
  return matches[0][1];
}

function optionalLabel(text: string, name: string): string | undefined {
  const matches = [...text.matchAll(new RegExp(`^${escapeRegex(name)}:\\s*\`([^\`]+)\`\\s*$`, "gm"))];
  if (matches.length > 1) throw new Error(`Target state declares multiple ${name} values`);
  return matches[0]?.[1];
}

function headingSpan(text: string, selector: string): string {
  if (!selector.startsWith("HEADING:")) throw new Error("Combined selector is not a heading selector");
  const heading = selector.slice("HEADING:".length);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const starts = lines.map((line, index) => ({ line, index, match: /^(#{1,6})\s+(.+?)\s*$/.exec(line) })).filter((item) => item.match?.[2] === heading);
  if (starts.length !== 1) throw new Error("Combined heading selector is missing or ambiguous");
  const start = starts[0]!;
  const level = start.match![1]!.length;
  let end = lines.length;
  for (let index = start.index + 1; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index] ?? "");
    if (match && match[1]!.length <= level) { end = index; break; }
  }
  return `${lines.slice(start.index, end).join("\n")}\n`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function argumentsMap(values: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined || result.has(key)) throw new Error("CLI arguments must be unique --name value pairs");
    result.set(key, value);
  }
  return result;
}

function nativeErrorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") return "";
  return /^[A-Z0-9_]{1,32}$/.test(error.code) ? error.code : "";
}

function stateStoreErrorCode(error: unknown): CliErrorCode {
  return ["EACCES", "EPERM", "EROFS"].includes(nativeErrorCode(error)) ? "STATE_STORE_ACCESS" : "STATE_STORE_BLOCKED";
}

function classifyCliError(error: unknown, fallback: CliErrorCode = "BLOCKED"): CliErrorCode {
  if (error instanceof ClassifiedCliError) return error.errorCode;
  if (fallback === "REQUEST_INVALID") return "REQUEST_INVALID";
  if (fallback === "STATE_STORE_BLOCKED" && stateStoreErrorCode(error) === "STATE_STORE_ACCESS") return "STATE_STORE_ACCESS";
  const message = error instanceof Error ? error.message : "";
  if (/SOURCE_IDENTITY_CHANGED|SOURCE_SUBSTITUTION|stage source manifest|source content hash mismatch|Active Route (?:is stale|binding mismatch)/i.test(message)) return "SOURCE_IDENTITY_CHANGED";
  if (/Git executable|Node executable|executable attestation|compiled (?:router|entry|manifest)|reviewed source manifest|runtime (?:package|lock|release manifest)|control-plane verifier|fence broker executable|KnownFolder authority broker/i.test(message)) return "TOOL_ATTESTATION_BLOCKED";
  if (/link|junction|reparse|escapes (?:root|KnownFolder authority|protected control root|router root)|unsafe path|must (?:be|remain) an ordinary (?:absolute )?file|cannot be a link/i.test(message)) return "UNSAFE_PATH";
  if (/KnownFolder|LocalAppData|fixed (?:router|control) root|control registry differs from the KnownFolder authority/i.test(message)) return "ROOT_AUTHORITY_BLOCKED";
  if (/P0B|dispatch is disabled/i.test(message)) return "P0B_REQUIRED";
  if (/Participant transport|Shared session fence/i.test(message)) return "PARTICIPANT_FENCE_BLOCKED";
  if (/dispatch lease|dispatch-leases/i.test(message)) return "DISPATCH_LEASE_BLOCKED";
  if (/Snapshot|message collection shape/i.test(message)) return "SNAPSHOT_BASELINE_BLOCKED";
  if (fallback === "STATE_STORE_BLOCKED") return stateStoreErrorCode(error);
  return fallback;
}

function rethrowClassified(error: unknown, fallback: CliErrorCode): never {
  throw new ClassifiedCliError(classifyCliError(error, fallback));
}

function classified<T>(fallback: CliErrorCode, action: () => T): T {
  try { return action(); }
  catch (error) { return rethrowClassified(error, fallback); }
}

async function classifiedAsync<T>(fallback: CliErrorCode, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) { return rethrowClassified(error, fallback); }
}

function cliErrorReceipt(error: unknown, fallback: CliErrorCode = "BLOCKED"): { error_code: CliErrorCode } {
  return { error_code: classifyCliError(error, fallback) };
}

function cliErrorJson(error: unknown, fallback: CliErrorCode = "BLOCKED"): string {
  return serializeCliJsonRow(cliErrorReceipt(error, fallback));
}

type CliRowWriter = (fd: 1 | 2, row: string) => void;

function serializeCliJsonRow(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("CLI result is not JSON-serializable");
    return `${serialized}\n`;
  } catch {
    throw new ClassifiedCliError("OUTPUT_CHANNEL_BLOCKED");
  }
}

function writeCliJsonRow(fd: 1 | 2, value: unknown, writer: CliRowWriter = writeCliRowToFd): void {
  const row = serializeCliJsonRow(value);
  try { writer(fd, row); }
  catch { throw new ClassifiedCliError("OUTPUT_CHANNEL_BLOCKED"); }
}

function writeCliRowToFd(fd: 1 | 2, row: string): void {
  writeFileSync(fd, row, { encoding: "utf8" });
}

async function main(): Promise<void> {
  const operation = process.argv[2];
  if (!operation || !["new-run", "invoke-stage", "resolve-stage", "get-run", "purge-retention", "write-p0b-proof", "resolve-compact-authority", "consume-compact-authority"].includes(operation)) throw new ClassifiedCliError("REQUEST_INVALID");
  const args = classified("REQUEST_INVALID", () => argumentsMap(process.argv.slice(3)));
  classified("REQUEST_INVALID", () => validateOperationArguments(operation, args));
  const runtimeRoot = process.env.OC_ROUTER_RUNTIME_ROOT;
  if (!runtimeRoot) throw new ClassifiedCliError("STATE_STORE_BLOCKED");
  const store = classified("STATE_STORE_BLOCKED", () => new ClassifiedStateStore(runtimeRoot));
  const dispatchOperation = operation === "new-run" || operation === "invoke-stage";
  const compactOperation = operation === "resolve-compact-authority" || operation === "consume-compact-authority";
  const registryPath = process.env.OC_ROUTER_CONTROL_REGISTRY;
  if ((dispatchOperation || compactOperation) && !registryPath) throw new ClassifiedCliError("ROOT_AUTHORITY_BLOCKED");
  let resolver: FileAuthorityResolver | undefined;
  if (dispatchOperation) resolver = classified("ROOT_AUTHORITY_BLOCKED", () => dispatchAuthorityResolver(registryPath!, store));
  else if (operation === "resolve-stage" && registryPath) {
    try { resolver = productionAuthorityResolver(registryPath, undefined, store); }
    catch { resolver = undefined; }
  }
  const snapshots = resolver ? new InstalledSnapshotReader(store, resolver, new InstalledSnapshotClient()) : { collect: async () => [] };
  const engine = dispatchOperation
    ? new StageEngine(store, resolver, new CommandClient(), snapshots)
    : new StageEngine(store, resolver, undefined, snapshots);
  let result: unknown;
  if (operation === "new-run") {
    const request = classified("REQUEST_INVALID", () => parseRunRequest(parseStrictJson(readFileSync(required(args, "--request"), "utf8"))));
    result = await classifiedAsync("RUN_AUTHORITY_BLOCKED", () => engine.newRun(request));
  } else if (operation === "invoke-stage") {
    const request = classified("REQUEST_INVALID", () => parseStageRequest(parseStrictJson(readFileSync(required(args, "--request"), "utf8"))));
    result = await classifiedAsync("BLOCKED", () => engine.invokeStage(request));
  } else if (operation === "resolve-stage") {
    result = await classifiedAsync("STATE_STORE_BLOCKED", () => engine.resolveStage(required(args, "--run-id"), required(args, "--operation-id")));
  } else if (operation === "get-run") {
    result = classified("STATE_STORE_BLOCKED", () => engine.getRun(required(args, "--run-id")));
  } else if (compactOperation) {
    const authority = classified("ROOT_AUTHORITY_BLOCKED", () => productionAuthorityContext(registryPath!));
    if (!sameFilesystemPath(store.root, authority.runtimeRoot)) throw new Error("Compact runtime root differs from KnownFolder authority");
    const packet = await classifiedAsync("BLOCKED", () => resolveCompactAuthorityOperation({
      registryPath: registryPath!,
      controlRoot: authority.controlRoot,
      targetId: required(args, "--target-id"),
      recipientRole: required(args, "--recipient-role"),
      store,
      probe: new InstalledCapabilityProbe(),
      credentials: () => ({ username: process.env.OPENCODE_SERVER_USERNAME ?? "", password: process.env.OPENCODE_SERVER_PASSWORD ?? "" }),
      ...(process.env.OC_ROUTER_EXECUTABLE_ATTESTATION_SHA256 === undefined ? {} : { executableAttestationSha256: process.env.OC_ROUTER_EXECUTABLE_ATTESTATION_SHA256 }),
      rootAuthorityClass: authority.authorityClass,
      consume: operation === "consume-compact-authority",
      ...(operation === "consume-compact-authority" ? { attemptId: required(args, "--attempt-id") } : {}),
    }));
    result = classified("STATE_STORE_BLOCKED", () => writeCompactAuthorityHandoff(authority.runtimeRoot, packet, process.env.OC_ROUTER_COMPACT_HANDOFF_TOKEN ?? ""));
  } else if (operation === "purge-retention") {
    if (!registryPath) throw new ClassifiedCliError("ROOT_AUTHORITY_BLOCKED");
    classified("ROOT_AUTHORITY_BLOCKED", () => productionAuthorityResolver(registryPath));
    result = classified("STATE_STORE_BLOCKED", () => purgeProtectedRuntimeEvidence(registryPath, runtimeRoot));
  } else {
    if (!registryPath) throw new ClassifiedCliError("ROOT_AUTHORITY_BLOCKED");
    classified("ROOT_AUTHORITY_BLOCKED", () => productionAuthorityResolver(registryPath));
    const proof = classified("REQUEST_INVALID", () => parseP0bProofReceipt(parseStrictJson(readFileSync(required(args, "--request"), "utf8"))));
    if (!process.env.OC_ROUTER_EXECUTABLE_ATTESTATION_SHA256 || proof.executable_attestation_sha256 !== process.env.OC_ROUTER_EXECUTABLE_ATTESTATION_SHA256) throw new Error("P0B proof executable attestation binding mismatch");
    result = classified("STATE_STORE_BLOCKED", () => writeP0bProofReceipt(runtimeRoot, proof));
  }
  writeCliJsonRow(1, result);
}

function validateOperationArguments(operation: string, args: Map<string, string>): void {
  const requiredKeys = operation === "new-run" || operation === "invoke-stage"
    ? ["--request"]
    : operation === "resolve-stage"
      ? ["--run-id", "--operation-id"]
      : operation === "get-run"
        ? ["--run-id"]
        : operation === "write-p0b-proof"
          ? ["--request"]
          : operation === "resolve-compact-authority"
            ? ["--target-id", "--recipient-role"]
            : operation === "consume-compact-authority"
              ? ["--target-id", "--recipient-role", "--attempt-id"]
              : [];
  const allowed = new Set(requiredKeys);
  for (const key of args.keys()) if (!allowed.has(key)) throw new Error(`Argument ${key} is not allowed for ${operation}`);
  for (const key of requiredKeys) if (!args.get(key)) throw new Error(`Argument ${key} is required for ${operation}`);
}

function purgeProtectedRuntimeEvidence(registryPath: string, runtimeRoot: string): unknown {
  const registry = parseControlRegistry(parseStrictJson(readFileSync(registryPath, "utf8")));
  if (registry.schema_version !== "router-control-registry.v2" || registry.mode !== "DISABLED") throw new Error("Retention purge requires the protected DISABLED kill switch");
  const controlRoot = realpathSync(path.dirname(registryPath));
  const fixedRoot = realpathSync(path.dirname(controlRoot));
  const expectedRuntime = realpathSync(path.join(fixedRoot, "runtime"));
  if (!sameFilesystemPath(realpathSync(runtimeRoot), expectedRuntime)) throw new Error("Retention runtime root differs from protected authority");
  assertSafeRelativePath(registry.retention_policy_path, "retention policy path");
  const policyPath = path.resolve(controlRoot, registry.retention_policy_path);
  if (!sameFilesystemPath(path.dirname(policyPath), controlRoot) || lstatSync(policyPath).isSymbolicLink()) throw new Error("Retention policy path is unsafe");
  const policy = parseRetentionPolicy(parseStrictJson(readFileSync(policyPath, "utf8")));
  const receipt = purgeExpiredPrivateEvidence(expectedRuntime, policy);
  const receiptIdentity = sha256(canonicalize(receipt));
  const receiptsRoot = assertOrdinaryPathSegments(path.dirname(fixedRoot), path.join(fixedRoot, "receipts"), "retention receipts root");
  writeAtomicPrivateJson(path.join(receiptsRoot, `retention-purge.${receiptIdentity}.json`), receipt);
  return receipt;
}

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

const isEntry = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isEntry) {
  main().catch((error: unknown) => {
    process.exitCode = 3;
    try { writeCliJsonRow(2, cliErrorReceipt(error)); }
    catch { /* No retry, alternate channel, or raw native error is safe here. */ }
  });
}

export const _test = { headingSpan, label, optionalLabel, argumentsMap, validateOperationArguments, FileAuthorityResolver, dispatchAuthorityResolver, productionAuthorityResolver, productionAuthorityContext, resolveOsKnownFolderRoot, resolveCompactAuthorityOperation, compactAuthorityStatus, writeCompactAuthorityHandoff, requiredSourceClasses, parseActiveRoute, activeRouteGeneration, assertActiveRouteBinding, assertArtifactPrivate, CLI_ERROR_CODES, classifyCliError, stateStoreErrorCode, cliErrorReceipt, cliErrorJson, serializeCliJsonRow, writeCliJsonRow };
