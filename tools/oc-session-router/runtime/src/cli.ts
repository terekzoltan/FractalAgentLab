import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeRelativePath,
  assertOpaqueId,
  assertSha256,
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
import { StageEngine, type AuthorityResolver, type ResolvedSource, type ResolvedStageAuthority } from "./stage-engine.js";
import { StateStore } from "./state-store.js";
import { CommandClient } from "./transport.js";
import { GitWorktreeReader, type WorktreeReader } from "./worktree-reader.js";

interface RegistryTarget {
  profile_identity: string;
  target_identity: string;
  worktree_identity: string;
  accountable: { lane: string; class: string; profile: string };
  root: string;
  state_path: string;
  combined_path: string;
  overlay_path: string;
  accountable_role_path: string;
  active_route_path?: string;
  require_active_route?: boolean;
  server: { origin: string; fingerprint: string };
  sessions: Record<string, { id: string }>;
}

interface ControlRegistry {
  schema_version: "router-control-registry.v1";
  targets: Record<string, RegistryTarget>;
}

interface ExecutableAttestation {
  schema_version: "router-executable-attestation.v2";
  node_executable_path: string;
  node_executable_sha256: string;
  git_executable_path: string;
  git_executable_sha256: string;
  compiled_entry_path: string;
  compiled_entry_sha256: string;
  compiled_manifest_sha256: string;
  source_manifest_identity: string;
  source_manifest_sha256: string;
}

const PRODUCTION_GIT_EXECUTABLE = "C:\\Program Files\\Git\\cmd\\git.exe";
const PRODUCTION_GIT_SHA256 = "054dfe58df35f7fcfbae184ff9d6a7c0da1e3743bf0401d951e012e290217c73";

class FileAuthorityResolver implements AuthorityResolver {
  constructor(private readonly registryPath: string, private readonly worktreeReader?: WorktreeReader) {
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
    const root = this.targetRoot(target);
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

  async resolveStageCapability(_runAuthority: RunAuthority, _request: StageRequest): Promise<ResolvedStageAuthority["capability"]> {
    return { mode: "DISABLED", identity_sha256: sha256("P0B_REQUIRED") };
  }

  async resolveStageAuthority(runAuthority: RunAuthority, request: StageRequest): Promise<ResolvedStageAuthority> {
    const loaded = this.loadRegistry();
    const current = this.deriveRunAuthorityFromRegistry(
      { schema_version: "run-request.v1", target_id: runAuthority.target_id, expected_worktree_identity: runAuthority.worktree_identity },
      { runId: runAuthority.run_id, createdAt: runAuthority.created_at },
      loaded,
    );
    const target = this.target(runAuthority.target_id, loaded.registry);
    const root = this.targetRoot(target);
    const sources = this.resolveSources(root, current, request);
    const recipient = target.sessions[request.recipient_role];
    if (!recipient?.id) throw new Error("Protected registry has no exact recipient role mapping");
    const username = process.env.OPENCODE_SERVER_USERNAME;
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    if (!username || !password) throw new Error("Process-scoped OpenCode authentication is unavailable");
    return {
      run_authority: current,
      sources,
      transport: { origin: target.server.origin, server_fingerprint: target.server.fingerprint, session_id: recipient.id, username, password },
      capability: { mode: "DISABLED", identity_sha256: sha256("P0B_REQUIRED") },
      privacy: { absolute_paths: [root, path.dirname(this.registryPath), this.registryPath], private_values: this.privateValues(loaded.registry) },
      ...(request.requested_stage === "CLOSEOUT" && this.worktreeReader ? { worktree: this.worktreeReader.inspect(root) } : {}),
    };
  }

  private resolveSources(root: string, authority: RunAuthority, request: StageRequest): ResolvedSource[] {
    const manifest = this.readTargetFile(root, authority.stage_source_manifest_path);
    if (manifest.sha256 !== authority.stage_source_manifest_sha256) throw new Error("SOURCE_IDENTITY_CHANGED: stage source manifest drifted");
    const parsed = parseStageSourceManifest(parseStrictJson(manifest.text));
    if (parsed.target_id !== authority.target_id || parsed.epic !== authority.epic || (request.candidate_identity !== "UNDECLARED" && parsed.candidate_identity !== request.candidate_identity)) throw new Error("Stage source manifest authority binding mismatch");
    const matches = parsed.entries.filter((entry) => entry.stage === request.requested_stage && entry.plan_class === request.plan_class);
    if (matches.length !== 1) throw new Error("Stage source manifest has no unique current stage entry");
    const expectedClasses = requiredSourceClasses(request.requested_stage);
    if (matches[0]!.sources.length !== expectedClasses.length || matches[0]!.sources.some((source, index) => source.source_class !== expectedClasses[index])) throw new Error("Stage source manifest source classes are invalid for stage");
    return matches[0]!.sources.map((binding) => {
      const source = this.readTargetFile(root, binding.path);
      if (source.sha256 !== binding.sha256) throw new Error("Stage source manifest hash mismatch");
      return { binding, content: source.text };
    });
  }

  private loadRegistry(): { registry: ControlRegistry; sha256: string } {
    if (lstatSync(this.registryPath).isSymbolicLink()) throw new Error("Control registry must remain an ordinary file");
    const bytes = readFileSync(this.registryPath);
    const registry = parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as ControlRegistry;
    if (registry.schema_version !== "router-control-registry.v1" || !registry.targets || typeof registry.targets !== "object" || Array.isArray(registry.targets)) throw new Error("Control registry schema mismatch");
    return { registry, sha256: sha256(bytes) };
  }

  private privateValues(registry: ControlRegistry): string[] {
    const values = [this.registryPath, path.dirname(this.registryPath)];
    for (const target of Object.values(registry.targets)) {
      values.push(target.root, target.server.origin, target.server.fingerprint);
      for (const session of Object.values(target.sessions)) values.push(session.id);
    }
    return values;
  }

  private target(id: string, registry: ControlRegistry): RegistryTarget {
    const target = registry.targets[id];
    if (!target) throw new Error("Protected registry has no target mapping");
    return target;
  }

  private targetRoot(target: RegistryTarget): string {
    if (!path.isAbsolute(target.root) || lstatSync(target.root).isSymbolicLink()) throw new Error("Target root is unsafe");
    return realpathSync(target.root);
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

function productionAuthorityResolver(registryPath: string): FileAuthorityResolver {
  return new FileAuthorityResolver(registryPath, new GitWorktreeReader(PRODUCTION_GIT_EXECUTABLE, PRODUCTION_GIT_SHA256));
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

async function main(): Promise<void> {
  const operation = process.argv[2];
  if (!operation || !["new-run", "invoke-stage", "resolve-stage", "get-run"].includes(operation)) throw new Error("Unknown router operation");
  const args = argumentsMap(process.argv.slice(3));
  validateOperationArguments(operation, args);
  const runtimeRoot = process.env.OC_ROUTER_RUNTIME_ROOT;
  if (!runtimeRoot) throw new Error("Router runtime root must be process-scoped");
  const store = new StateStore(runtimeRoot);
  const dispatchOperation = operation === "new-run" || operation === "invoke-stage";
  const registryPath = process.env.OC_ROUTER_CONTROL_REGISTRY;
  if (dispatchOperation && !registryPath) throw new Error("Protected control registry must be process-scoped for dispatch operations");
  const engine = dispatchOperation
    ? new StageEngine(store, productionAuthorityResolver(registryPath!), new CommandClient(), { collect: async () => [] })
    : new StageEngine(store, undefined, undefined, { collect: async () => [] });
  let result: unknown;
  if (operation === "new-run") {
    result = await engine.newRun(parseRunRequest(parseStrictJson(readFileSync(required(args, "--request"), "utf8"))));
  } else if (operation === "invoke-stage") {
    result = await engine.invokeStage(parseStageRequest(parseStrictJson(readFileSync(required(args, "--request"), "utf8"))));
  } else if (operation === "resolve-stage") {
    result = await engine.resolveStage(required(args, "--run-id"), required(args, "--operation-id"));
  } else {
    result = engine.getRun(required(args, "--run-id"));
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function validateOperationArguments(operation: string, args: Map<string, string>): void {
  const allowed = operation === "new-run" || operation === "invoke-stage"
    ? new Set(["--request"])
    : operation === "resolve-stage"
      ? new Set(["--run-id", "--operation-id"])
      : new Set(["--run-id"]);
  for (const key of args.keys()) if (!allowed.has(key)) throw new Error(`Argument ${key} is not allowed for ${operation}`);
}

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

const isEntry = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isEntry) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const errorCode = message.includes("SOURCE_IDENTITY_CHANGED") ? "SOURCE_IDENTITY_CHANGED"
      : /link|junction|escapes root/i.test(message) ? "UNSAFE_PATH"
        : /P0B|dispatch is disabled/i.test(message) ? "P0B_REQUIRED"
          : "BLOCKED";
    process.stderr.write(`${JSON.stringify({ error_code: errorCode })}\n`);
    process.exitCode = 3;
  });
}

export const _test = { headingSpan, label, optionalLabel, argumentsMap, validateOperationArguments, FileAuthorityResolver, productionAuthorityResolver, requiredSourceClasses, parseActiveRoute, activeRouteGeneration, assertActiveRouteBinding, assertArtifactPrivate };
