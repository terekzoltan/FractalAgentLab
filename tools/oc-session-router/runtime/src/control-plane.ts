import { closeSync, existsSync, lstatSync, openSync, readFileSync, realpathSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  assertOpaqueId,
  assertSafeRelativePath,
  assertSha256,
  canonicalize,
  commandForStage,
  parseStrictJson,
  sha256,
  type StageRequest,
} from "./contracts.js";
import { validateOrigin } from "./transport.js";
import { readP0bProofReceipt, type P0bProofReceipt } from "./p0b-proof.js";

export const ROUTER_PROTOCOL_IDENTITY = "fal-explicit-stage-router/v1" as const;
export const SUPPORTED_AWC_CONTRACTS = ["awc-3.1", "awc-4.1.1"] as const;
export const FENCE_BROKER_EXECUTABLE = "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" as const;
export const FENCE_BROKER_EXECUTABLE_SHA256 = "7600ffe12da441fe89d035b13801e8e91d064bc544a27b19a5cf49f6ab8b18f5" as const;

export type ProductionMode = "DISABLED" | "P0B_ISOLATED" | "PRODUCTION_RESPONSE_FIRST";
export type ActiveProductionMode = Exclude<ProductionMode, "DISABLED">;
export type SnapshotCorrelationMode = "DIAGNOSTIC_ONLY" | "EXACT_PARENT_LINK";

export interface RegistryTarget {
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
  server: { origin: string; fingerprint?: string; binary_sha256?: string; command_timeout_ms?: number };
  sessions: Record<string, { id: string }>;
  capability_receipt_path?: string;
  isolation_class?: "SYNTHETIC_TEST_ONLY" | "PRODUCTION_TARGET";
}

export interface LegacyControlRegistry {
  schema_version: "router-control-registry.v1";
  targets: Record<string, RegistryTarget>;
}

export interface ProtectedControlRegistry {
  schema_version: "router-control-registry.v2";
  router_protocol_identity: typeof ROUTER_PROTOCOL_IDENTITY;
  mode: ProductionMode;
  retention_policy_path: string;
  p0b_isolation_root: string;
  p0b_isolation_root_sha256: string;
  targets: Record<string, RegistryTarget>;
}

export type ControlRegistry = LegacyControlRegistry | ProtectedControlRegistry;

export interface CapabilityReceipt {
  schema_version: "router-capability-receipt.v1";
  router_protocol_identity: typeof ROUTER_PROTOCOL_IDENTITY;
  mode: ActiveProductionMode;
  authorization_class: "P0B_ONE_USE" | "PRODUCTION_INSTALL";
  authorization_id: string;
  target_id: string;
  isolation_class: "SYNTHETIC_TEST_ONLY" | "PRODUCTION_TARGET";
  p0b_isolation_root_sha256: string;
  target_identity_sha256: string;
  worktree_identity_sha256: string;
  target_directory_sha256: string;
  origin_sha256: string;
  server_binary_sha256: string;
  server_instance_identity_sha256: string;
  authorized_session_set_sha256: string;
  authorized_command_set_sha256: string;
  command_timeout_ms: number;
  server_version: string;
  health_identity_sha256: string;
  doc_sha256: string;
  command_registry_sha256: string;
  supported_commands: string[];
  authorized_commands: string[];
  compatible_awc_contracts: Array<(typeof SUPPORTED_AWC_CONTRACTS)[number]>;
  command_response_contract: "SYNC_WITH_PARTS_V1";
  snapshot_correlation: SnapshotCorrelationMode;
  sse: { probe_status: "VERIFIED" | "UNSUPPORTED" | "FAILED"; proof_sha256: string; enabled: false };
  p0b_proof_sha256: string;
  issued_at: string;
  expires_at: string;
}

export interface RetentionPolicy {
  schema_version: "router-retention-policy.v2";
  compact_handoff_minutes: 15;
  quarantine_days: 7;
  diagnostic_days: 30;
  validated_evidence_days: 180;
  terminal_run_evidence_days: 180;
  active_evidence_retention: "PRESERVE_UNTIL_TERMINAL";
  authority_ledger_retention: "NON_EXPIRING_DUPLICATE_SEND_AUTHORITY";
  raw_reasoning_retained: false;
  raw_event_payloads_retained: false;
  public_export: "DENY";
  purge_receipts: "SANITIZED_COUNTS_AND_HASHES_ONLY";
}

export interface CapabilityProbeProjection {
  server_version: string;
  server_binary_sha256: string;
  server_instance_identity_sha256: string;
  target_directory_sha256: string;
  health_identity_sha256: string;
  doc_sha256: string;
  command_registry_sha256: string;
  supported_commands: string[];
  sse: { probe_status: "VERIFIED" | "UNSUPPORTED" | "FAILED"; proof_sha256: string; enabled: false };
}

export interface CapabilityProbe {
  probe(input: { origin: string; username: string; password: string; directory: string; expected_binary_sha256: string; required_commands: readonly string[]; timeout_ms: number }): Promise<CapabilityProbeProjection>;
}

export interface ResolvedCapability {
  mode: ProductionMode | "FIXTURE_ONLY";
  identity_sha256: string;
  router_protocol_identity?: typeof ROUTER_PROTOCOL_IDENTITY;
  snapshot_correlation?: SnapshotCorrelationMode;
  sse_enabled?: false;
  retention_policy_sha256?: string;
  live_probe_sha256?: string;
  authorization_use_sha256?: string;
  server_instance_identity_sha256?: string;
  server_binary_sha256?: string;
  target_directory_sha256?: string;
  command_timeout_ms?: number;
}

export function isP0bProofCompatibleWithInstalledServer(
  proof: Pick<P0bProofReceipt, "opencode_server_version" | "server_binary_sha256">,
  installed: Pick<CapabilityReceipt, "server_version" | "server_binary_sha256">,
): boolean {
  if (proof.opencode_server_version === installed.server_version) {
    return proof.server_binary_sha256 === installed.server_binary_sha256;
  }
  const proven = strictPatchVersion(proof.opencode_server_version);
  const current = strictPatchVersion(installed.server_version);
  return proven !== undefined && current !== undefined
    && proven.major === current.major
    && proven.minor === current.minor
    && current.patch > proven.patch;
}

function strictPatchVersion(value: string): { major: number; minor: number; patch: number } | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return undefined;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) return undefined;
  return { major, minor, patch };
}

export interface SharedFenceBinding {
  path: string;
  private_session_identity_sha256: string;
  identity_sha256: string;
}

export interface CompactProtectedAuthorityPacket {
  schema_version: "compact-protected-authority.v1";
  router_protocol_identity: typeof ROUTER_PROTOCOL_IDENTITY;
  authorization_state: "RESOLVED" | "CONSUMED" | "NOT_APPLICABLE";
  mode: ActiveProductionMode;
  target_id: string;
  logical_session_ref: string;
  target_root: string;
  origin: string;
  session_id: string;
  target_directory_sha256: string;
  session_sha256: string;
  server_binary_sha256: string;
  server_instance_identity_sha256: string;
  capability_receipt_sha256: string;
  authorization_use_sha256: string;
  command_timeout_ms: number;
}

export interface SharedFenceLease {
  assertHeld(): void;
  release(): Promise<void>;
}

export function parseControlRegistry(value: unknown): ControlRegistry {
  const record = exactRecord(value, "control registry");
  if (record.schema_version === "router-control-registry.v1") {
    exactKeys(record, ["schema_version", "targets"], "legacy control registry");
    return { schema_version: "router-control-registry.v1", targets: parseTargets(record.targets, false) };
  }
  exactKeys(record, ["schema_version", "router_protocol_identity", "mode", "retention_policy_path", "p0b_isolation_root", "p0b_isolation_root_sha256", "targets"], "protected control registry");
  if (record.schema_version !== "router-control-registry.v2" || record.router_protocol_identity !== ROUTER_PROTOCOL_IDENTITY) throw new Error("Control registry schema or router protocol mismatch");
  const mode = stringValue(record.mode, "control registry mode");
  if (!isProductionMode(mode)) throw new Error("Control registry production mode is invalid");
  const retentionPath = stringValue(record.retention_policy_path, "retention policy path");
  assertSafeRelativePath(retentionPath, "retention policy path");
  const p0bIsolationRoot = stringValue(record.p0b_isolation_root, "P0B isolation root");
  if (!path.isAbsolute(p0bIsolationRoot)) throw new Error("P0B isolation root must be absolute");
  const p0bIsolationRootSha256 = stringValue(record.p0b_isolation_root_sha256, "P0B isolation-root SHA-256");
  assertSha256(p0bIsolationRootSha256, "P0B isolation-root SHA-256");
  return {
    schema_version: "router-control-registry.v2",
    router_protocol_identity: ROUTER_PROTOCOL_IDENTITY,
    mode,
    retention_policy_path: retentionPath,
    p0b_isolation_root: p0bIsolationRoot,
    p0b_isolation_root_sha256: p0bIsolationRootSha256,
    targets: parseTargets(record.targets, true),
  };
}

function parseTargets(value: unknown, protectedShape: boolean): Record<string, RegistryTarget> {
  const record = exactRecord(value, "control registry targets");
  const targets: Record<string, RegistryTarget> = {};
  const sessionOwners = new Map<string, string>();
  for (const [targetId, raw] of Object.entries(record)) {
    assertOpaqueId(targetId, "control registry target ID");
    const target = exactRecord(raw, `control registry target ${targetId}`);
    const required = ["profile_identity", "target_identity", "worktree_identity", "accountable", "root", "state_path", "combined_path", "overlay_path", "accountable_role_path", "server", "sessions"];
    const optional = ["active_route_path", "require_active_route"];
    if (protectedShape) required.push("capability_receipt_path", "isolation_class");
    exactKeys(target, [...required, ...optional.filter((key) => target[key] !== undefined)], `control registry target ${targetId}`);
    const accountable = exactRecord(target.accountable, "target accountable binding");
    exactKeys(accountable, ["lane", "class", "profile"], "target accountable binding");
    const server = exactRecord(target.server, "target server binding");
    exactKeys(server, protectedShape ? ["origin", "binary_sha256", "command_timeout_ms"] : ["origin", "fingerprint"], "target server binding");
    const origin = stringValue(server.origin, "server origin");
    validateOrigin(origin);
    const binarySha256 = protectedShape ? stringValue(server.binary_sha256, "server binary SHA-256") : undefined;
    if (binarySha256) assertSha256(binarySha256, "server binary SHA-256");
    const commandTimeoutMs = protectedShape ? integerValue(server.command_timeout_ms, "command timeout milliseconds") : undefined;
    if (commandTimeoutMs !== undefined && (commandTimeoutMs < 120_000 || commandTimeoutMs > 3_600_000)) throw new Error("Command timeout must be between 120000 and 3600000 milliseconds");
    const sessionsRecord = exactRecord(target.sessions, "target sessions");
    if (Object.keys(sessionsRecord).length === 0) throw new Error("Target sessions cannot be empty");
    const sessions: Record<string, { id: string }> = {};
    for (const [role, rawSession] of Object.entries(sessionsRecord)) {
      if (!role.trim()) throw new Error("Target session role is empty");
      const session = exactRecord(rawSession, `target session ${role}`);
      exactKeys(session, ["id"], `target session ${role}`);
      const id = stringValue(session.id, "target session ID");
      if (id.length < 4) throw new Error("Target session ID is too short");
      if (protectedShape) {
        const priorOwner = sessionOwners.get(id);
        if (priorOwner) throw new Error(`Protected session identity is duplicated across ${priorOwner} and ${targetId}/${role}`);
        sessionOwners.set(id, `${targetId}/${role}`);
      }
      sessions[role] = { id };
    }
    const relativeFields = ["state_path", "combined_path", "overlay_path", "accountable_role_path", ...(target.active_route_path === undefined ? [] : ["active_route_path"])] as const;
    for (const field of relativeFields) assertSafeRelativePath(stringValue(target[field], field), field);
    const profileIdentity = stringValue(target.profile_identity, "profile identity");
    const targetIdentity = stringValue(target.target_identity, "target identity");
    assertOpaqueId(profileIdentity, "profile identity");
    assertOpaqueId(targetIdentity, "target identity");
    const result: RegistryTarget = {
      profile_identity: profileIdentity,
      target_identity: targetIdentity,
      worktree_identity: stringValue(target.worktree_identity, "worktree identity"),
      accountable: { lane: stringValue(accountable.lane, "accountable lane"), class: stringValue(accountable.class, "accountable class"), profile: stringValue(accountable.profile, "accountable profile") },
      root: stringValue(target.root, "target root"),
      state_path: stringValue(target.state_path, "state path"),
      combined_path: stringValue(target.combined_path, "combined path"),
      overlay_path: stringValue(target.overlay_path, "overlay path"),
      accountable_role_path: stringValue(target.accountable_role_path, "accountable role path"),
      server: protectedShape
        ? { origin, binary_sha256: binarySha256!, command_timeout_ms: commandTimeoutMs! }
        : { origin, fingerprint: stringValue(server.fingerprint, "server fingerprint") },
      sessions,
      ...(target.active_route_path === undefined ? {} : { active_route_path: stringValue(target.active_route_path, "active route path") }),
      ...(target.require_active_route === undefined ? {} : { require_active_route: booleanValue(target.require_active_route, "require_active_route") }),
    };
    if (protectedShape) {
      const capabilityPath = stringValue(target.capability_receipt_path, "capability receipt path");
      assertSafeRelativePath(capabilityPath, "capability receipt path");
      const isolationClass = stringValue(target.isolation_class, "isolation class");
      if (isolationClass !== "SYNTHETIC_TEST_ONLY" && isolationClass !== "PRODUCTION_TARGET") throw new Error("Target isolation class is invalid");
      result.capability_receipt_path = capabilityPath;
      result.isolation_class = isolationClass;
    }
    targets[targetId] = result;
  }
  return targets;
}

export function parseCapabilityReceipt(value: unknown): CapabilityReceipt {
  const record = exactRecord(value, "capability receipt");
  exactKeys(record, ["schema_version", "router_protocol_identity", "mode", "authorization_class", "authorization_id", "target_id", "isolation_class", "p0b_isolation_root_sha256", "target_identity_sha256", "worktree_identity_sha256", "target_directory_sha256", "origin_sha256", "server_binary_sha256", "server_instance_identity_sha256", "authorized_session_set_sha256", "authorized_command_set_sha256", "command_timeout_ms", "server_version", "health_identity_sha256", "doc_sha256", "command_registry_sha256", "supported_commands", "authorized_commands", "compatible_awc_contracts", "command_response_contract", "snapshot_correlation", "sse", "p0b_proof_sha256", "issued_at", "expires_at"], "capability receipt");
  if (record.schema_version !== "router-capability-receipt.v1" || record.router_protocol_identity !== ROUTER_PROTOCOL_IDENTITY) throw new Error("Capability receipt schema or router protocol mismatch");
  const mode = stringValue(record.mode, "capability mode");
  if (mode !== "P0B_ISOLATED" && mode !== "PRODUCTION_RESPONSE_FIRST") throw new Error("Capability receipt mode is invalid");
  const authorizationClass = stringValue(record.authorization_class, "authorization class");
  if (authorizationClass !== "P0B_ONE_USE" && authorizationClass !== "PRODUCTION_INSTALL") throw new Error("Capability authorization class is invalid");
  const authorizationId = stringValue(record.authorization_id, "authorization ID");
  assertOpaqueId(authorizationId, "authorization ID");
  const targetId = stringValue(record.target_id, "capability target ID");
  assertOpaqueId(targetId, "capability target ID");
  const isolationClass = stringValue(record.isolation_class, "capability isolation class");
  if (isolationClass !== "SYNTHETIC_TEST_ONLY" && isolationClass !== "PRODUCTION_TARGET") throw new Error("Capability isolation class is invalid");
  for (const field of ["p0b_isolation_root_sha256", "target_identity_sha256", "worktree_identity_sha256", "target_directory_sha256", "origin_sha256", "server_binary_sha256", "server_instance_identity_sha256", "authorized_session_set_sha256", "authorized_command_set_sha256", "health_identity_sha256", "doc_sha256", "command_registry_sha256", "p0b_proof_sha256"] as const) assertSha256(stringValue(record[field], field), field);
  const commandTimeoutMs = integerValue(record.command_timeout_ms, "command timeout milliseconds");
  if (commandTimeoutMs < 120_000 || commandTimeoutMs > 3_600_000) throw new Error("Capability command timeout is outside the bounded policy");
  if (!Array.isArray(record.supported_commands) || record.supported_commands.length === 0 || record.supported_commands.some((item) => typeof item !== "string")) throw new Error("Capability supported commands are invalid");
  const supportedCommands = [...record.supported_commands] as string[];
  for (const command of supportedCommands) assertOpaqueId(command, "supported command");
  if (new Set(supportedCommands).size !== supportedCommands.length || canonicalize(supportedCommands) !== canonicalize([...supportedCommands].sort())) throw new Error("Capability supported commands must be unique and sorted");
  if (!Array.isArray(record.authorized_commands) || record.authorized_commands.length === 0 || record.authorized_commands.some((item) => typeof item !== "string")) throw new Error("Capability authorized commands are invalid");
  const authorizedCommands = [...record.authorized_commands] as string[];
  for (const command of authorizedCommands) assertOpaqueId(command, "authorized command");
  if (new Set(authorizedCommands).size !== authorizedCommands.length || canonicalize(authorizedCommands) !== canonicalize([...authorizedCommands].sort()) || authorizedCommands.some((command) => !supportedCommands.includes(command))) throw new Error("Capability authorized commands must be a unique sorted supported subset");
  if (!Array.isArray(record.compatible_awc_contracts) || record.compatible_awc_contracts.length === 0 || record.compatible_awc_contracts.some((item) => !(SUPPORTED_AWC_CONTRACTS as readonly unknown[]).includes(item))) throw new Error("Capability AWC compatibility is invalid");
  const compatible = [...record.compatible_awc_contracts] as Array<(typeof SUPPORTED_AWC_CONTRACTS)[number]>;
  if (new Set(compatible).size !== compatible.length || canonicalize(compatible) !== canonicalize([...compatible].sort())) throw new Error("Capability AWC compatibility must be unique and sorted");
  if (record.command_response_contract !== "SYNC_WITH_PARTS_V1") throw new Error("Capability command response contract is unsupported");
  const correlation = stringValue(record.snapshot_correlation, "snapshot correlation");
  if (correlation !== "DIAGNOSTIC_ONLY" && correlation !== "EXACT_PARENT_LINK") throw new Error("Capability snapshot correlation is invalid");
  const sse = exactRecord(record.sse, "SSE capability");
  exactKeys(sse, ["probe_status", "proof_sha256", "enabled"], "SSE capability");
  const probeStatus = stringValue(sse.probe_status, "SSE probe status");
  if (!(["VERIFIED", "UNSUPPORTED", "FAILED"] as const).includes(probeStatus as "VERIFIED")) throw new Error("SSE probe status is invalid");
  assertSha256(stringValue(sse.proof_sha256, "SSE proof SHA-256"), "SSE proof SHA-256");
  if (sse.enabled !== false) throw new Error("SSE must remain disabled for this release");
  const issuedAt = timestamp(record.issued_at, "capability issued_at");
  const expiresAt = timestamp(record.expires_at, "capability expires_at");
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error("Capability receipt expiry must follow issuance");
  return {
    schema_version: "router-capability-receipt.v1",
    router_protocol_identity: ROUTER_PROTOCOL_IDENTITY,
    mode,
    authorization_class: authorizationClass,
    authorization_id: authorizationId,
    target_id: targetId,
    isolation_class: isolationClass,
    p0b_isolation_root_sha256: stringValue(record.p0b_isolation_root_sha256, "P0B isolation-root SHA-256"),
    target_identity_sha256: stringValue(record.target_identity_sha256, "target identity SHA-256"),
    worktree_identity_sha256: stringValue(record.worktree_identity_sha256, "worktree identity SHA-256"),
    target_directory_sha256: stringValue(record.target_directory_sha256, "target directory SHA-256"),
    origin_sha256: stringValue(record.origin_sha256, "origin SHA-256"),
    server_binary_sha256: stringValue(record.server_binary_sha256, "server binary SHA-256"),
    server_instance_identity_sha256: stringValue(record.server_instance_identity_sha256, "server instance identity SHA-256"),
    authorized_session_set_sha256: stringValue(record.authorized_session_set_sha256, "authorized session set SHA-256"),
    authorized_command_set_sha256: stringValue(record.authorized_command_set_sha256, "authorized command set SHA-256"),
    command_timeout_ms: commandTimeoutMs,
    server_version: stringValue(record.server_version, "server version"),
    health_identity_sha256: stringValue(record.health_identity_sha256, "health identity SHA-256"),
    doc_sha256: stringValue(record.doc_sha256, "OpenAPI SHA-256"),
    command_registry_sha256: stringValue(record.command_registry_sha256, "command registry SHA-256"),
    supported_commands: supportedCommands,
    authorized_commands: authorizedCommands,
    compatible_awc_contracts: compatible,
    command_response_contract: "SYNC_WITH_PARTS_V1",
    snapshot_correlation: correlation,
    sse: { probe_status: probeStatus as CapabilityReceipt["sse"]["probe_status"], proof_sha256: stringValue(sse.proof_sha256, "SSE proof SHA-256"), enabled: false },
    p0b_proof_sha256: stringValue(record.p0b_proof_sha256, "P0B proof SHA-256"),
    issued_at: issuedAt,
    expires_at: expiresAt,
  };
}

export function parseRetentionPolicy(value: unknown): RetentionPolicy {
  const record = exactRecord(value, "retention policy");
  exactKeys(record, ["schema_version", "compact_handoff_minutes", "quarantine_days", "diagnostic_days", "validated_evidence_days", "terminal_run_evidence_days", "active_evidence_retention", "authority_ledger_retention", "raw_reasoning_retained", "raw_event_payloads_retained", "public_export", "purge_receipts"], "retention policy");
  if (record.schema_version !== "router-retention-policy.v2" || record.compact_handoff_minutes !== 15 || record.quarantine_days !== 7 || record.diagnostic_days !== 30 || record.validated_evidence_days !== 180 || record.terminal_run_evidence_days !== 180 || record.active_evidence_retention !== "PRESERVE_UNTIL_TERMINAL" || record.authority_ledger_retention !== "NON_EXPIRING_DUPLICATE_SEND_AUTHORITY" || record.raw_reasoning_retained !== false || record.raw_event_payloads_retained !== false || record.public_export !== "DENY" || record.purge_receipts !== "SANITIZED_COUNTS_AND_HASHES_ONLY") throw new Error("Retention policy does not match AC87");
  return record as unknown as RetentionPolicy;
}

export async function resolveProtectedCapability(options: {
  registry: ControlRegistry;
  registry_path: string;
  protected_control_root?: string;
  target_id: string;
  target: RegistryTarget;
  request: StageRequest;
  probe: CapabilityProbe;
  credentials: () => { username: string; password: string };
  executable_attestation_sha256?: string;
  now?: Date;
}): Promise<ResolvedCapability> {
  if (options.registry.schema_version === "router-control-registry.v1" || options.registry.mode === "DISABLED") return { mode: "DISABLED", identity_sha256: sha256("P0B_REQUIRED") };
  if (!options.protected_control_root) throw new Error("Protected control root is required for active production mode");
  const root = ordinaryDirectory(options.protected_control_root, "protected control root");
  const expectedRegistry = path.join(root, "control-registry.json");
  if (!samePath(realpathSync(options.registry_path), expectedRegistry)) throw new Error("Active control registry must use the fixed protected control-plane path");
  if (!options.target.capability_receipt_path || !options.target.isolation_class) throw new Error("Active target lacks protected capability authority");
  if (options.registry.mode === "P0B_ISOLATED" && options.target.isolation_class !== "SYNTHETIC_TEST_ONLY") throw new Error("P0B_ISOLATED admits synthetic test targets only");
  if (options.registry.mode === "PRODUCTION_RESPONSE_FIRST" && options.target.isolation_class !== "PRODUCTION_TARGET") throw new Error("Production response-first requires a production target binding");
  const policyFile = readContainedJson(root, options.registry.retention_policy_path, "retention policy");
  parseRetentionPolicy(policyFile.value);
  const capabilityFile = readContainedJson(root, options.target.capability_receipt_path, "capability receipt");
  const receipt = parseCapabilityReceipt(capabilityFile.value);
  const now = options.now ?? new Date();
  if (Date.parse(receipt.issued_at) > now.getTime() + 60_000 || Date.parse(receipt.expires_at) <= now.getTime()) throw new Error("Capability receipt is not currently valid");
  const sessionBindings = Object.entries(options.target.sessions).sort(([left], [right]) => left.localeCompare(right)).map(([role, session]) => ({ role, session_sha256: sha256(session.id) }));
  const selectedSession = options.target.sessions[options.request.recipient_role];
  const expectedSessionSet = options.registry.mode === "P0B_ISOLATED" ? selectedSession ? sha256(selectedSession.id) : "" : sha256(canonicalize(sessionBindings));
  const targetDirectory = resolveProtectedTargetDirectory(options.registry, options.target.root, "capability target directory");
  const targetDirectorySha256 = sha256(`fal-router-target-directory/v1\n${targetDirectory}`);
  const expectedBinarySha256 = options.target.server.binary_sha256;
  const expectedCommandTimeoutMs = options.target.server.command_timeout_ms;
  if (!expectedBinarySha256 || expectedCommandTimeoutMs === undefined) throw new Error("Protected target server authority is incomplete");
  if (receipt.mode !== options.registry.mode || receipt.target_id !== options.target_id || receipt.isolation_class !== options.target.isolation_class || receipt.p0b_isolation_root_sha256 !== options.registry.p0b_isolation_root_sha256 || receipt.target_identity_sha256 !== sha256(options.target.target_identity) || receipt.worktree_identity_sha256 !== sha256(options.target.worktree_identity) || receipt.target_directory_sha256 !== targetDirectorySha256 || receipt.origin_sha256 !== sha256(options.target.server.origin) || receipt.server_binary_sha256 !== expectedBinarySha256 || receipt.command_timeout_ms !== expectedCommandTimeoutMs || receipt.authorized_session_set_sha256 !== expectedSessionSet) throw new Error("Capability receipt protected binding mismatch");
  const command = commandForStage(options.request.requested_stage);
  if (receipt.authorized_command_set_sha256 !== sha256(canonicalize(receipt.authorized_commands))) throw new Error("Capability command-set binding mismatch");
  if (receipt.mode === "P0B_ISOLATED" && (receipt.authorization_class !== "P0B_ONE_USE" || receipt.isolation_class !== "SYNTHETIC_TEST_ONLY" || receipt.authorized_commands.length !== 1 || receipt.p0b_proof_sha256 !== "0".repeat(64) || Date.parse(receipt.expires_at) - Date.parse(receipt.issued_at) > 15 * 60_000)) throw new Error("P0B grant must be synthetic, one-use, proof-pending, and short-lived");
  if (receipt.mode === "PRODUCTION_RESPONSE_FIRST" && (receipt.authorization_class !== "PRODUCTION_INSTALL" || receipt.isolation_class !== "PRODUCTION_TARGET" || receipt.p0b_proof_sha256 === "0".repeat(64))) throw new Error("Production install requires a nonzero P0B proof binding");
  if (receipt.mode === "PRODUCTION_RESPONSE_FIRST") {
    const runtimeRoot = ordinaryDirectory(path.join(path.dirname(root), "runtime"), "protected runtime root");
    const proof = readP0bProofReceipt(runtimeRoot, receipt.p0b_proof_sha256);
    const executableAttestationSha256 = options.executable_attestation_sha256;
    if (!executableAttestationSha256) throw new Error("Production install requires the launcher-attested executable identity");
    assertSha256(executableAttestationSha256, "executable attestation SHA-256");
    if (!proof.accepted || proof.router_protocol_identity !== ROUTER_PROTOCOL_IDENTITY || proof.runtime_release_version !== "0.2.0" || proof.executable_attestation_sha256 !== executableAttestationSha256 || !isP0bProofCompatibleWithInstalledServer(proof, receipt) || proof.sse_enabled !== false) throw new Error("Production install P0B proof binding mismatch");
  }
  if (options.request.expected_contract_version !== "awc-4.1.1" || !receipt.compatible_awc_contracts.includes("awc-4.1.1")) throw new Error("Active production modes require current AWC 4.1.1 compatibility");
  if (!receipt.authorized_commands.includes(command)) throw new Error("Capability receipt does not admit the requested command");
  const credentials = options.credentials();
  if (!credentials.username || !credentials.password) throw new Error("Process-scoped OpenCode authentication is unavailable");
  const live = await options.probe.probe({ origin: options.target.server.origin, username: credentials.username, password: credentials.password, directory: targetDirectory, expected_binary_sha256: expectedBinarySha256, required_commands: [command], timeout_ms: 15_000 });
  if (!installedCapabilityMatchesReceipt(live, receipt)) throw new Error("Installed server capability drifted from protected receipt");
  const authorizationUseSha256 = capabilityAuthorizationUseSha256(receipt);
  return {
    mode: receipt.mode,
    identity_sha256: capabilityFile.sha256,
    router_protocol_identity: ROUTER_PROTOCOL_IDENTITY,
    snapshot_correlation: receipt.snapshot_correlation,
    sse_enabled: false,
    retention_policy_sha256: policyFile.sha256,
    live_probe_sha256: sha256(canonicalize(live)),
    ...(receipt.mode === "P0B_ISOLATED" ? { authorization_use_sha256: authorizationUseSha256 } : {}),
    server_instance_identity_sha256: live.server_instance_identity_sha256,
    server_binary_sha256: live.server_binary_sha256,
    target_directory_sha256: live.target_directory_sha256,
    command_timeout_ms: receipt.command_timeout_ms,
  };
}

export function capabilityAuthorizationUseSha256(receipt: Pick<CapabilityReceipt, "authorization_id" | "target_id" | "mode" | "authorization_class">): string {
  return sha256(canonicalize({
    domain: "fal-router-one-use-authorization/v1",
    authorization_id: receipt.authorization_id,
    target_id: receipt.target_id,
    mode: receipt.mode,
    authorization_class: receipt.authorization_class,
  }));
}

export function p0bIsolationRootSha256(value: string): string {
  const root = ordinaryDirectoryTree(value, "P0B isolation root");
  const identityPath = process.platform === "win32" ? root.replace(/\//g, "\\").toLowerCase() : root;
  return sha256(`fal-router-p0b-isolation-root/v1\n${identityPath}`);
}

export function resolveProtectedTargetDirectory(registry: ControlRegistry, value: string, label: string): string {
  if (registry.schema_version !== "router-control-registry.v2" || registry.mode !== "P0B_ISOLATED") return ordinaryDirectory(value, label);
  const isolationRoot = ordinaryDirectoryTree(registry.p0b_isolation_root, "P0B isolation root");
  if (p0bIsolationRootSha256(isolationRoot) !== registry.p0b_isolation_root_sha256) throw new Error("P0B isolation-root identity mismatch");
  const target = ordinaryDirectoryTree(value, label);
  const relative = path.relative(isolationRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} is outside the protected P0B isolation root`);
  return target;
}

export async function resolveCompactProtectedAuthority(options: {
  registry: ControlRegistry;
  registry_path: string;
  protected_control_root: string;
  target_id: string;
  recipient_role: string;
  probe: CapabilityProbe;
  credentials: () => { username: string; password: string };
  executable_attestation_sha256?: string;
  now?: Date;
}): Promise<CompactProtectedAuthorityPacket> {
  assertOpaqueId(options.target_id, "Compact target ID");
  if (!options.recipient_role.trim()) throw new Error("Compact logical session reference is empty");
  if (options.registry.schema_version !== "router-control-registry.v2" || options.registry.mode === "DISABLED") throw new Error("Compact dispatch requires an active protected v2 registry");
  const root = ordinaryDirectory(options.protected_control_root, "protected control root");
  if (!samePath(realpathSync(options.registry_path), path.join(root, "control-registry.json"))) throw new Error("Compact authority must use the fixed protected control-plane path");
  const target = options.registry.targets[options.target_id];
  if (!target) throw new Error("Compact target is absent from protected authority");
  if (!target.capability_receipt_path || !target.isolation_class) throw new Error("Compact target lacks protected capability authority");
  const logicalMatches = Object.keys(target.sessions).filter((role) => role.toLocaleLowerCase("en-US") === options.recipient_role.toLocaleLowerCase("en-US"));
  if (logicalMatches.length !== 1) throw new Error("Compact logical session reference is unknown or ambiguous");
  const logicalSessionRef = logicalMatches[0]!;
  const sessionId = target.sessions[logicalSessionRef]!.id;
  if (options.registry.mode === "P0B_ISOLATED" && target.isolation_class !== "SYNTHETIC_TEST_ONLY") throw new Error("P0B Compact authority admits synthetic test targets only");
  if (options.registry.mode === "PRODUCTION_RESPONSE_FIRST" && target.isolation_class !== "PRODUCTION_TARGET") throw new Error("Production Compact authority requires a production target binding");
  parseRetentionPolicy(readContainedJson(root, options.registry.retention_policy_path, "retention policy").value);
  const capabilityFile = readContainedJson(root, target.capability_receipt_path, "capability receipt");
  const receipt = parseCapabilityReceipt(capabilityFile.value);
  const now = options.now ?? new Date();
  if (Date.parse(receipt.issued_at) > now.getTime() + 60_000 || Date.parse(receipt.expires_at) <= now.getTime()) throw new Error("Compact capability receipt is not currently valid");
  const targetRoot = resolveProtectedTargetDirectory(options.registry, target.root, "Compact target directory");
  const targetDirectorySha256 = sha256(`fal-router-target-directory/v1\n${targetRoot}`);
  const expectedBinarySha256 = target.server.binary_sha256;
  const expectedCommandTimeoutMs = target.server.command_timeout_ms;
  if (!expectedBinarySha256 || expectedCommandTimeoutMs === undefined) throw new Error("Compact protected server authority is incomplete");
  const sessionBindings = Object.entries(target.sessions).sort(([left], [right]) => left.localeCompare(right)).map(([role, session]) => ({ role, session_sha256: sha256(session.id) }));
  const expectedSessionSet = options.registry.mode === "P0B_ISOLATED" ? sha256(sessionId) : sha256(canonicalize(sessionBindings));
  if (receipt.mode !== options.registry.mode || receipt.target_id !== options.target_id || receipt.isolation_class !== target.isolation_class || receipt.p0b_isolation_root_sha256 !== options.registry.p0b_isolation_root_sha256 || receipt.target_identity_sha256 !== sha256(target.target_identity) || receipt.worktree_identity_sha256 !== sha256(target.worktree_identity) || receipt.target_directory_sha256 !== targetDirectorySha256 || receipt.origin_sha256 !== sha256(target.server.origin) || receipt.server_binary_sha256 !== expectedBinarySha256 || receipt.command_timeout_ms !== expectedCommandTimeoutMs || receipt.authorized_session_set_sha256 !== expectedSessionSet) throw new Error("Compact capability receipt protected binding mismatch");
  if (receipt.authorized_command_set_sha256 !== sha256(canonicalize(receipt.authorized_commands))) throw new Error("Compact capability command-set binding mismatch");
  if (!receipt.compatible_awc_contracts.includes("awc-4.1.1")) throw new Error("Compact authority requires AWC 4.1.1 compatibility");
  if (!receipt.authorized_commands.includes("after-compact")) throw new Error("Compact capability does not authorize after-compact");
  if (receipt.mode === "P0B_ISOLATED" && (receipt.authorization_class !== "P0B_ONE_USE" || receipt.authorized_commands.length !== 1 || receipt.p0b_proof_sha256 !== "0".repeat(64) || Date.parse(receipt.expires_at) - Date.parse(receipt.issued_at) > 15 * 60_000)) throw new Error("P0B Compact grant must be one-use, proof-pending, and short-lived");
  if (receipt.mode === "PRODUCTION_RESPONSE_FIRST") {
    if (receipt.authorization_class !== "PRODUCTION_INSTALL" || receipt.p0b_proof_sha256 === "0".repeat(64)) throw new Error("Production Compact install requires a nonzero P0B proof binding");
    const proof = readP0bProofReceipt(ordinaryDirectory(path.join(path.dirname(root), "runtime"), "protected runtime root"), receipt.p0b_proof_sha256);
    const attestation = options.executable_attestation_sha256;
    if (!attestation) throw new Error("Production Compact install requires launcher-attested executable identity");
    assertSha256(attestation, "executable attestation SHA-256");
    if (!proof.accepted || proof.router_protocol_identity !== ROUTER_PROTOCOL_IDENTITY || proof.runtime_release_version !== "0.2.0" || proof.executable_attestation_sha256 !== attestation || !isP0bProofCompatibleWithInstalledServer(proof, receipt) || proof.sse_enabled !== false) throw new Error("Production Compact P0B proof binding mismatch");
  }
  const credentials = options.credentials();
  if (!credentials.username || !credentials.password) throw new Error("Process-scoped OpenCode authentication is unavailable");
  const live = await options.probe.probe({ origin: target.server.origin, username: credentials.username, password: credentials.password, directory: targetRoot, expected_binary_sha256: expectedBinarySha256, required_commands: ["after-compact"], timeout_ms: 15_000 });
  if (!installedCapabilityMatchesReceipt(live, receipt)) throw new Error("Installed Compact server capability drifted from protected receipt");
  return {
    schema_version: "compact-protected-authority.v1",
    router_protocol_identity: ROUTER_PROTOCOL_IDENTITY,
    authorization_state: "RESOLVED",
    mode: receipt.mode,
    target_id: options.target_id,
    logical_session_ref: logicalSessionRef,
    target_root: targetRoot,
    origin: target.server.origin,
    session_id: sessionId,
    target_directory_sha256: live.target_directory_sha256,
    session_sha256: sha256(sessionId),
    server_binary_sha256: live.server_binary_sha256,
    server_instance_identity_sha256: live.server_instance_identity_sha256,
    capability_receipt_sha256: capabilityFile.sha256,
    authorization_use_sha256: receipt.mode === "P0B_ISOLATED" ? capabilityAuthorizationUseSha256(receipt) : "0".repeat(64),
    command_timeout_ms: receipt.command_timeout_ms,
  };
}

function installedCapabilityMatchesReceipt(live: CapabilityProbeProjection, receipt: CapabilityReceipt): boolean {
  // A one-use P0B grant stays bound to the exact synthetic server process that
  // was reviewed. A durable production install instead admits a clean restart
  // of the same measured server; the current process identity is still carried
  // in ResolvedCapability and must remain byte-identical across the individual
  // dispatch's baseline, immediate pre-POST, and post-response revalidations.
  const exactInstanceRequired = receipt.mode === "P0B_ISOLATED";
  return live.server_version === receipt.server_version
    && live.server_binary_sha256 === receipt.server_binary_sha256
    && (!exactInstanceRequired || live.server_instance_identity_sha256 === receipt.server_instance_identity_sha256)
    && live.target_directory_sha256 === receipt.target_directory_sha256
    && live.health_identity_sha256 === receipt.health_identity_sha256
    && live.doc_sha256 === receipt.doc_sha256
    && live.command_registry_sha256 === receipt.command_registry_sha256
    && canonicalize(live.supported_commands) === canonicalize(receipt.supported_commands)
    && canonicalize(live.sse) === canonicalize(receipt.sse);
}

export function buildSharedFenceBinding(targetRoot: string, privateSessionId: string): SharedFenceBinding {
  const routerRoot = ordinaryDirectory(path.join(targetRoot, ".opencode-router"), "target router root");
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(privateSessionId)) throw new Error("Shared session fence requires an exact private session identity");
  const privateSessionIdentitySha256 = sha256(`fal-router-private-session-fence/v1\n${privateSessionId}`);
  const fencePath = path.join(routerRoot, `.participant-transport.${privateSessionIdentitySha256}.lock`);
  return { path: fencePath, private_session_identity_sha256: privateSessionIdentitySha256, identity_sha256: sha256(`${realpathSync(routerRoot)}\n${privateSessionIdentitySha256}`) };
}

const FENCE_BROKER_COMMAND = [
  "$ErrorActionPreference='Stop'",
  "$stream=$null",
  "try {",
  "  $stream=[System.IO.File]::Open($env:OC_ROUTER_FENCE_PATH,[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)",
  "  [Console]::Out.WriteLine('LOCKED')",
  "  [Console]::Out.Flush()",
  "  [void][Console]::In.ReadLine()",
  "} catch { [Console]::Out.WriteLine('BUSY'); [Console]::Out.Flush(); exit 73 }",
  "finally { if ($null -ne $stream) { $stream.Dispose() } }",
].join("\n");

export class SharedSessionFence {
  async acquire(binding: SharedFenceBinding): Promise<SharedFenceLease> {
    assertSha256(binding.private_session_identity_sha256, "shared fence private session identity SHA-256");
    assertSha256(binding.identity_sha256, "shared fence identity SHA-256");
    const parent = ordinaryDirectory(path.dirname(binding.path), "shared fence parent");
    if (lstatIfExists(binding.path)?.isSymbolicLink()) throw new Error("Shared session fence cannot be a link or junction");
    if (sha256(`${parent}\n${binding.private_session_identity_sha256}`) !== binding.identity_sha256) throw new Error("Shared session fence identity mismatch");
    if (process.platform !== "win32") throw new Error("Shared session fence broker is unavailable");
    const executable = FENCE_BROKER_EXECUTABLE;
    const systemRoot = path.resolve(path.dirname(executable), "..", "..", "..");
    const executableItem = lstatIfExists(executable);
    if (!executableItem?.isFile() || executableItem.isSymbolicLink() || sha256(readFileSync(executable)) !== FENCE_BROKER_EXECUTABLE_SHA256) throw new Error("Shared session fence broker executable is unavailable");
    const broker = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", FENCE_BROKER_COMMAND], {
      env: { SystemRoot: systemRoot, WINDIR: systemRoot, OC_ROUTER_FENCE_PATH: binding.path },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const status = await brokerStatus(broker, 10_000);
    if (status !== "LOCKED") {
      if (broker.exitCode === null) broker.kill();
      throw new Error("Participant transport is locked by Compact or lifecycle dispatch");
    }
    let released = false;
    return {
      assertHeld: () => {
        if (released || broker.exitCode !== null || broker.killed) throw new Error("Participant transport fence was lost before POST");
      },
      release: async () => {
        if (released) return;
        released = true;
        broker.stdin.end("\n");
        await waitForBrokerExit(broker, 5_000);
      },
    };
  }
}

function brokerStatus(broker: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let output = "";
    const finish = (value?: string, error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      broker.stdout.removeAllListeners();
      broker.removeListener("error", onError);
      broker.removeListener("exit", onExit);
      if (error) reject(error); else resolve(value ?? "");
    };
    const onError = (): void => finish(undefined, new Error("Shared session fence broker failed"));
    const onExit = (): void => finish(output.trim());
    const timer = setTimeout(() => {
      broker.kill();
      finish(undefined, new Error("Shared session fence broker timed out"));
    }, timeoutMs);
    broker.stdout.setEncoding("utf8");
    broker.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > 32) { broker.kill(); finish(undefined, new Error("Shared session fence broker emitted an invalid response")); return; }
      const newline = output.indexOf("\n");
      if (newline !== -1) finish(output.slice(0, newline).trim());
    });
    broker.once("error", onError);
    broker.once("exit", onExit);
  });
}

function waitForBrokerExit(broker: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<void> {
  if (broker.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { broker.kill(); finish(); }, timeoutMs);
    broker.once("exit", finish);
    broker.once("error", finish);
  });
}

export interface RetentionPurgeReceipt {
  schema_version: "router-retention-purge-receipt.v1";
  policy_sha256: string;
  cutoff_class_counts: { ephemeral_handoffs_15m: number; quarantine_7d: number; diagnostics_30d: number; validated_180d: number; terminal_runs_180d: number };
  preserved_class_counts: { active_or_uncertain_runs: number; duplicate_send_authority_records: number; active_dispatch_leases: number };
  deleted_identity_set_sha256: string;
  completed_at: string;
  paths_emitted: false;
  raw_content_emitted: false;
}

export function purgeExpiredPrivateEvidence(runtimeRoot: string, policy: RetentionPolicy, now = new Date()): RetentionPurgeReceipt {
  const root = ordinaryDirectory(runtimeRoot, "runtime root");
  const buckets: Array<{ name: "quarantine_7d" | "diagnostics_30d" | "validated_180d"; relative: string; days: number }> = [
    { name: "quarantine_7d", relative: "quarantine", days: policy.quarantine_days },
    { name: "diagnostics_30d", relative: "diagnostics", days: policy.diagnostic_days },
    { name: "validated_180d", relative: "validated-evidence", days: policy.validated_evidence_days },
  ];
  const counts = { ephemeral_handoffs_15m: 0, quarantine_7d: 0, diagnostics_30d: 0, validated_180d: 0, terminal_runs_180d: 0 };
  const preserved = { active_or_uncertain_runs: 0, duplicate_send_authority_records: 0, active_dispatch_leases: 0 };
  const deleted: string[] = [];
  const supportedRootEntries = new Set(["compact-authority-handoffs", "p0b-isolation", "quarantine", "diagnostics", "validated-evidence", "runs", "semantic-actions", "capability-uses", "dispatch-leases"]);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!supportedRootEntries.has(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) throw new Error("Runtime root contains an unsupported retention class");
  }
  const handoffRoot = path.join(root, "compact-authority-handoffs");
  if (existsSync(handoffRoot)) {
    ordinaryDirectory(handoffRoot, "ephemeral Compact handoff directory");
    for (const entry of readdirSync(handoffRoot, { withFileTypes: true })) {
      const candidate = path.join(handoffRoot, entry.name);
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Ephemeral Compact handoff retention item is unsafe");
      if (now.getTime() - statSync(candidate).mtimeMs >= policy.compact_handoff_minutes * 60_000) {
        unlinkSync(candidate);
        counts.ephemeral_handoffs_15m += 1;
        deleted.push(`ephemeral_handoffs_15m:${sha256(entry.name)}`);
      }
    }
  }
  for (const bucket of buckets) {
    const directory = path.join(root, bucket.relative);
    if (!existsSync(directory)) continue;
    ordinaryDirectory(directory, `retention ${bucket.name} directory`);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Retention bucket contains an unsupported entry");
      const candidate = path.join(directory, entry.name);
      if (now.getTime() - statSync(candidate).mtimeMs < bucket.days * 86_400_000) continue;
      unlinkSync(candidate);
      counts[bucket.name] += 1;
      deleted.push(`${bucket.name}:${sha256(entry.name)}`);
    }
  }
  const runsDirectory = path.join(root, "runs");
  if (existsSync(runsDirectory)) {
    ordinaryDirectory(runsDirectory, "retention runs directory");
    for (const runEntry of readdirSync(runsDirectory, { withFileTypes: true })) {
      if (!runEntry.isDirectory() || runEntry.isSymbolicLink()) throw new Error("Runs retention class contains an unsupported entry");
      assertOpaqueId(runEntry.name, "retention run ID");
      const runDirectory = path.join(runsDirectory, runEntry.name);
      const operationsDirectory = path.join(runDirectory, "operations");
      if (!existsSync(operationsDirectory)) { preserved.active_or_uncertain_runs += 1; continue; }
      ordinaryDirectory(operationsDirectory, "retention operations directory");
      const operationEntries = readdirSync(operationsDirectory, { withFileTypes: true });
      if (operationEntries.length === 0) { preserved.active_or_uncertain_runs += 1; continue; }
      let preserveRun = false;
      let latestTerminal = 0;
      const operationDirectories: string[] = [];
      for (const operationEntry of operationEntries) {
        if (!operationEntry.isDirectory() || operationEntry.isSymbolicLink()) throw new Error("Operation retention class contains an unsupported entry");
        assertOpaqueId(operationEntry.name, "retention operation ID");
        const operationDirectory = path.join(operationsDirectory, operationEntry.name);
        operationDirectories.push(operationDirectory);
        const operationPath = path.join(operationDirectory, "operation.json");
        const operationItem = lstatIfExists(operationPath);
        if (!operationItem?.isFile() || operationItem.isSymbolicLink()) throw new Error("Operation retention metadata is missing or unsafe");
        const operation = exactRecord(parseStrictJson(readFileSync(operationPath, "utf8")), "retention operation");
        const status = stringValue(operation.status, "retention operation status");
        const updatedAt = timestamp(operation.updated_at, "retention operation updated_at");
        if (["CREATED", "DISPATCHING", "ACTIVE", "RECONCILING", "WAITING_ACTION", "STALLED_SUSPECTED", "UNCERTAIN"].includes(status)) preserveRun = true;
        else if (!["SUCCEEDED", "FAILED_OUTPUT", "FAILED_TRANSPORT", "BLOCKED", "CANCELLED"].includes(status)) throw new Error("Operation retention status is unsupported");
        latestTerminal = Math.max(latestTerminal, Date.parse(updatedAt));
      }
      if (preserveRun) { preserved.active_or_uncertain_runs += 1; continue; }
      if (now.getTime() - latestTerminal >= policy.terminal_run_evidence_days * 86_400_000) {
        assertOrdinaryTree(runDirectory);
        rmSync(runDirectory, { recursive: true, force: false });
        counts.terminal_runs_180d += 1;
        deleted.push(`terminal_runs_180d:${sha256(runEntry.name)}`);
        continue;
      }
      for (const operationDirectory of operationDirectories) {
        const diagnosticPath = path.join(operationDirectory, "snapshot-diagnostic.json");
        const item = lstatIfExists(diagnosticPath);
        if (!item) continue;
        if (!item.isFile() || item.isSymbolicLink()) throw new Error("Snapshot diagnostic retention item is unsafe");
        if (now.getTime() - statSync(diagnosticPath).mtimeMs >= policy.diagnostic_days * 86_400_000) {
          unlinkSync(diagnosticPath);
          counts.diagnostics_30d += 1;
          deleted.push(`diagnostics_30d:${sha256(`${runEntry.name}/${path.basename(operationDirectory)}`)}`);
        }
      }
    }
  }
  for (const authorityDirectoryName of ["semantic-actions", "capability-uses"]) {
    const authorityDirectory = path.join(root, authorityDirectoryName);
    if (!existsSync(authorityDirectory)) continue;
    ordinaryDirectory(authorityDirectory, `retention ${authorityDirectoryName} directory`);
    for (const entry of readdirSync(authorityDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || (!entry.name.endsWith(".json") && !entry.name.endsWith(".lock"))) throw new Error("Duplicate-send authority class contains an unsupported entry");
      preserved.duplicate_send_authority_records += 1;
    }
  }
  const leasesDirectory = path.join(root, "dispatch-leases");
  if (existsSync(leasesDirectory)) {
    ordinaryDirectory(leasesDirectory, "retention dispatch leases directory");
    for (const entry of readdirSync(leasesDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".lock")) throw new Error("Dispatch lease class contains an unsupported entry");
      preserved.active_dispatch_leases += 1;
    }
  }
  return { schema_version: "router-retention-purge-receipt.v1", policy_sha256: sha256(canonicalize(policy)), cutoff_class_counts: counts, preserved_class_counts: preserved, deleted_identity_set_sha256: sha256(deleted.sort().join("\n")), completed_at: now.toISOString(), paths_emitted: false, raw_content_emitted: false };
}

function assertOrdinaryTree(root: string): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) throw new Error("Retention deletion tree contains an unsupported entry");
    if (entry.isDirectory()) assertOrdinaryTree(candidate);
  }
}

export function writeAtomicPrivateJson(filePath: string, value: unknown): void {
  const temp = `${filePath}.tmp.${randomUUID()}`;
  const descriptor = openSync(temp, "wx", 0o600);
  try { writeFileSync(descriptor, `${JSON.stringify(value)}\n`, "utf8"); } finally { closeSync(descriptor); }
  renameSync(temp, filePath);
}

function readContainedJson(root: string, relative: string, label: string): { value: unknown; sha256: string; path: string } {
  assertSafeRelativePath(relative, label);
  const candidate = path.resolve(root, relative);
  const rel = path.relative(root, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`${label} escapes protected control root`);
  let current = root;
  for (const segment of rel.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const item = lstatIfExists(current);
    if (!item || item.isSymbolicLink()) throw new Error(`${label} path is missing or traverses a link or junction`);
  }
  const bytes = readFileSync(candidate);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { value: parseStrictJson(text), sha256: sha256(bytes), path: candidate };
}

function exactRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  if (canonicalize(Object.keys(record).sort()) !== canonicalize([...keys].sort())) throw new Error(`${label} has missing or unknown fields`);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a nonempty string`);
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
  return value;
}

function integerValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${label} must be an integer`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  const result = stringValue(value, label);
  if (!result.endsWith("Z") || !Number.isFinite(Date.parse(result))) throw new Error(`${label} is invalid`);
  return result;
}

function isProductionMode(value: string): value is ProductionMode {
  return value === "DISABLED" || value === "P0B_ISOLATED" || value === "PRODUCTION_RESPONSE_FIRST";
}

function ordinaryDirectory(value: string, label: string): string {
  if (!path.isAbsolute(value) || !existsSync(value)) throw new Error(`${label} must be a pre-created absolute directory`);
  const item = lstatSync(value);
  if (!item.isDirectory() || item.isSymbolicLink()) throw new Error(`${label} must be an ordinary directory`);
  return realpathSync(value);
}

function ordinaryDirectoryTree(value: string, label: string): string {
  if (!path.isAbsolute(value) || !existsSync(value)) throw new Error(`${label} must be a pre-created absolute directory`);
  if (process.platform === "win32" && !/^[A-Za-z]:[\\/]/.test(value)) throw new Error(`${label} must be on a local Windows volume`);
  const full = path.resolve(value);
  const parsed = path.parse(full);
  let current = parsed.root;
  const segments = full.slice(parsed.root.length).split(path.sep).filter(Boolean);
  const rootItem = lstatSync(current);
  if (!rootItem.isDirectory() || rootItem.isSymbolicLink()) throw new Error(`${label} traverses a reparse point or non-directory`);
  for (const segment of segments) {
    current = path.join(current, segment);
    const item = lstatSync(current);
    if (!item.isDirectory() || item.isSymbolicLink()) throw new Error(`${label} traverses a reparse point or non-directory`);
  }
  return realpathSync(full);
}

function lstatIfExists(value: string): ReturnType<typeof lstatSync> | undefined {
  try { return lstatSync(value); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase() : path.resolve(left) === path.resolve(right);
}

export const _test = { parseTargets, readContainedJson, exactKeys, ordinaryDirectory, ordinaryDirectoryTree };
