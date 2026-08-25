import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { authoritySha256, canonicalize, parseStageSourceManifest, parseStrictJson, sha256, type RunAuthority, type StageInvocation, type StageRequest } from "../src/contracts.js";
import {
  ROUTER_PROTOCOL_IDENTITY,
  SharedSessionFence,
  buildSharedFenceBinding,
  capabilityAuthorizationUseSha256,
  isP0bProofCompatibleWithInstalledServer,
  parseCapabilityReceipt,
  parseControlRegistry,
  parseRetentionPolicy,
  p0bIsolationRootSha256,
  purgeExpiredPrivateEvidence,
  resolveCompactProtectedAuthority,
  resolveProtectedCapability,
  type CapabilityProbeProjection,
  type RegistryTarget,
  type RetentionPolicy,
} from "../src/control-plane.js";
import { _test as cliTest } from "../src/cli.js";
import { parseP0bProofReceipt, p0bProofSha256, readP0bProofReceipt, writeP0bProofReceipt, type P0bProofReceipt } from "../src/p0b-proof.js";
import { StateStore } from "../src/state-store.js";

const fixedNow = new Date("2026-08-21T12:00:00.000Z");
const policy: RetentionPolicy = {
  schema_version: "router-retention-policy.v2",
  compact_handoff_minutes: 15,
  quarantine_days: 7,
  diagnostic_days: 30,
  validated_evidence_days: 180,
  terminal_run_evidence_days: 180,
  active_evidence_retention: "PRESERVE_UNTIL_TERMINAL",
  authority_ledger_retention: "NON_EXPIRING_DUPLICATE_SEND_AUTHORITY",
  raw_reasoning_retained: false,
  raw_event_payloads_retained: false,
  public_export: "DENY",
  purge_receipts: "SANITIZED_COUNTS_AND_HASHES_ONLY",
};

function stageRequest(contract: "awc-3.1" | "awc-4.1.1" = "awc-4.1.1"): StageRequest {
  return {
    schema_version: "stage-request.v1", request_id: "request-p0b", run_id: "run-p0b", issued_at: fixedNow.toISOString(), issued_by: "orchestrator",
    run_authority_sha256: "a".repeat(64), requested_stage: "PLAN_REVIEW", plan_class: "EPIC_PLAN", target_id: "synthetic-p0b", worktree_identity: "git:synthetic",
    state_revision: "state-1", state_sha256: "b".repeat(64), combined_selector: "HEADING:Current", combined_span_sha256: "c".repeat(64), expected_sources: [],
    wave: "P0B", epic: "P0B", accountable_lane: "Track D", accountable_class: "TRACK", accountable_profile: "track-d", sender_role: "Track D", recipient_role: "Meta",
    plan_identity: "plan-p0b", candidate_identity: "UNDECLARED", review_cycle: "0", finding_ids: [], review_risk: "high_risk", project_review_context: "synthetic",
    expected_contract_version: contract, allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND", configuration_identity: "config-p0b", active_route_generation: "UNDECLARED",
  };
}

function retentionAuthority(runId: string): RunAuthority {
  return {
    schema_version: "run-authority.v1", run_id: runId, created_at: fixedNow.toISOString(), target_id: "synthetic-p0b", target_identity: "synthetic-target",
    worktree_identity: "git:synthetic", wave: "P0B", epic: "P0B", accountable_lane: "Track D", accountable_class: "TRACK", accountable_profile: "track-d",
    target_profile_identity: "synthetic-profile", target_profile_sha256: "1".repeat(64), state_path: "ops/PROJECT_STATE.md", state_revision: "state-1",
    state_sha256: "2".repeat(64), combined_path: "ops/Combined.md", combined_selector: "HEADING:Current", combined_span_sha256: "3".repeat(64),
    pinned_artifact_path: "plans/p0b.md", pinned_artifact_identity: "p0b-plan", pinned_artifact_sha256: "4".repeat(64), overlay_identity: "overlay-p0b",
    accountable_role_identity: "track-d-p0b", configuration_identity: "config-p0b", active_route_generation: "UNDECLARED", review_cycle: "0",
    stage_source_manifest_path: "plans/stage-sources.json", stage_source_manifest_sha256: "5".repeat(64), next_command: "/terv-review",
  };
}

function retentionInvocation(runId: string, operationId: string): StageInvocation {
  return {
    ...stageRequest(), schema_version: "stage-invocation.v1", run_id: runId, operation_id: operationId, canon_phase: "PLAN_REVIEW", command_name: "terv-review",
    command_argument_sha256: "6".repeat(64), command_body_sha256: "7".repeat(64), semantic_key: sha256(`semantic:${runId}`), recipient_session_sha256: "8".repeat(64),
  };
}

function acceptedP0bProof(): P0bProofReceipt {
  return {
    schema_version: "router-p0b-proof-receipt.v1", router_protocol_identity: ROUTER_PROTOCOL_IDENTITY, runtime_release_version: "0.2.0",
    executable_attestation_sha256: "1".repeat(64), opencode_server_version: "1.18.19", server_binary_sha256: "2".repeat(64), server_instance_identity_sha256: "3".repeat(64),
    target_directory_sha256: "4".repeat(64), capability_grant_sha256: "5".repeat(64), authorization_use_sha256: "6".repeat(64), run_authority_sha256: "7".repeat(64),
    operation_id_sha256: "8".repeat(64), operation_result_sha256: "9".repeat(64), transport_receipt_sha256: "a".repeat(64), snapshot_diagnostic_sha256: "b".repeat(64),
    cleanup_receipt_sha256: "c".repeat(64), session_sha256: "d".repeat(64), command_name: "terv-review", command_argument_sha256: "e".repeat(64), command_body_sha256: "f".repeat(64),
    response_message_id_sha256: "1".repeat(64), response_parent_id_sha256: "2".repeat(64), response_parent_bound: true, response_sha256: "3".repeat(64), terminal_sha256: "4".repeat(64),
    operation_status: "SUCCEEDED", transport_status: "RESPONSE_ACCEPTED", one_use_status: "CONSUMED", snapshot_result: "EXACT_CANDIDATE", cleanup_status: "VERIFIED",
    sse_enabled: false, accepted: true, gate_failures: [], created_at: fixedNow.toISOString(), raw_paths_persisted: false, raw_origin_persisted: false,
    raw_session_id_persisted: false, raw_response_persisted: false, raw_reasoning_persisted: false, raw_event_payload_persisted: false,
  };
}

test("P0B server proof is reusable only for a forward patch on the same compatibility line", () => {
  const proof = acceptedP0bProof();
  const installed = (server_version: string, server_binary_sha256 = "2".repeat(64)) => ({ server_version, server_binary_sha256 });
  assert.equal(isP0bProofCompatibleWithInstalledServer(proof, installed("1.18.19")), true);
  assert.equal(isP0bProofCompatibleWithInstalledServer(proof, installed("1.18.22", "9".repeat(64))), true);
  assert.equal(isP0bProofCompatibleWithInstalledServer(proof, installed("1.18.19", "9".repeat(64))), false);
  assert.equal(isP0bProofCompatibleWithInstalledServer(proof, installed("1.18.18", "9".repeat(64))), false);
  assert.equal(isP0bProofCompatibleWithInstalledServer(proof, installed("1.19.0", "9".repeat(64))), false);
  assert.equal(isP0bProofCompatibleWithInstalledServer(proof, installed("2.18.0", "9".repeat(64))), false);
  assert.equal(isP0bProofCompatibleWithInstalledServer(proof, installed("1.18.20-beta.1", "9".repeat(64))), false);
  assert.equal(isP0bProofCompatibleWithInstalledServer({ ...proof, opencode_server_version: "not-semver" }, installed("1.18.22", "9".repeat(64))), false);
});

test("P0B protected capability is closed, short-lived, AWC 4.1.1-only, and directory-bound", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-control-"));
  try {
    const control = path.join(root, "control");
    const isolationRoot = path.join(root, "p0b-isolation");
    const targetRoot = path.join(isolationRoot, "synthetic-target");
    mkdirSync(path.join(control, "capability-receipts"), { recursive: true });
    mkdirSync(targetRoot, { recursive: true });
    const isolationRootSha256 = p0bIsolationRootSha256(isolationRoot);
    const target: RegistryTarget = {
      profile_identity: "synthetic-profile", target_identity: "synthetic-target", worktree_identity: "git:synthetic", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" },
      root: targetRoot, state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/PROJECT_OVERLAY.md", accountable_role_path: "ops/roles/DELIVERY.md",
      server: { origin: "http://127.0.0.1:4096", binary_sha256: "9".repeat(64), command_timeout_ms: 300_000 }, sessions: { Meta: { id: "session-synthetic-p0b" } },
      capability_receipt_path: "capability-receipts/p0b-grant.json", isolation_class: "SYNTHETIC_TEST_ONLY",
    };
    const registryValue = { schema_version: "router-control-registry.v2", router_protocol_identity: ROUTER_PROTOCOL_IDENTITY, mode: "P0B_ISOLATED", retention_policy_path: "retention-policy.json", p0b_isolation_root: isolationRoot, p0b_isolation_root_sha256: isolationRootSha256, targets: { "synthetic-p0b": target } } as const;
    const registry = parseControlRegistry(registryValue);
    assert.throws(() => parseControlRegistry({ ...registryValue, mode_from_environment: "P0B_ISOLATED" }), /unknown fields/);
    const aliasTarget = { ...target, target_identity: "synthetic-alias", sessions: { Delivery: { id: target.sessions.Meta!.id } }, capability_receipt_path: "capability-receipts/alias.json" };
    assert.throws(() => parseControlRegistry({ ...registryValue, targets: { "synthetic-p0b": target, "synthetic-alias": aliasTarget } }), /session identity is duplicated/);
    const registryPath = path.join(control, "control-registry.json");
    writeFileSync(registryPath, JSON.stringify(registryValue));
    writeFileSync(path.join(control, "retention-policy.json"), JSON.stringify(policy));
    const live: CapabilityProbeProjection = {
      server_version: "1.18.19",
      server_binary_sha256: target.server.binary_sha256!,
      server_instance_identity_sha256: "8".repeat(64),
      target_directory_sha256: sha256(`fal-router-target-directory/v1\n${realpathSync(targetRoot)}`),
      health_identity_sha256: "1".repeat(64),
      doc_sha256: "2".repeat(64),
      command_registry_sha256: "3".repeat(64),
      supported_commands: ["implement", "terv-review"],
      sse: { probe_status: "VERIFIED", proof_sha256: "4".repeat(64), enabled: false },
    };
    const grant = {
      schema_version: "router-capability-receipt.v1", router_protocol_identity: ROUTER_PROTOCOL_IDENTITY, mode: "P0B_ISOLATED", authorization_class: "P0B_ONE_USE", authorization_id: "grant-p0b-1",
      target_id: "synthetic-p0b", isolation_class: "SYNTHETIC_TEST_ONLY", p0b_isolation_root_sha256: isolationRootSha256, target_identity_sha256: sha256(target.target_identity), worktree_identity_sha256: sha256(target.worktree_identity),
      target_directory_sha256: live.target_directory_sha256, origin_sha256: sha256(target.server.origin), server_binary_sha256: live.server_binary_sha256, server_instance_identity_sha256: live.server_instance_identity_sha256, authorized_session_set_sha256: sha256(target.sessions.Meta!.id),
      authorized_command_set_sha256: sha256(canonicalize(["terv-review"])), server_version: live.server_version, health_identity_sha256: live.health_identity_sha256,
      command_timeout_ms: target.server.command_timeout_ms,
      doc_sha256: live.doc_sha256, command_registry_sha256: live.command_registry_sha256, supported_commands: live.supported_commands, authorized_commands: ["terv-review"], compatible_awc_contracts: ["awc-4.1.1"],
      command_response_contract: "SYNC_WITH_PARTS_V1", snapshot_correlation: "EXACT_PARENT_LINK", sse: live.sse,
      p0b_proof_sha256: "0".repeat(64), issued_at: "2026-08-21T11:55:00.000Z", expires_at: "2026-08-21T12:05:00.000Z",
    } as const;
    assert.equal(parseCapabilityReceipt(grant).compatible_awc_contracts.includes("awc-4.1.1"), true);
    writeFileSync(path.join(control, target.capability_receipt_path!), JSON.stringify(grant));
    let probes = 0;
    const resolved = await resolveProtectedCapability({
      registry, registry_path: registryPath, protected_control_root: control, target_id: "synthetic-p0b", target, request: stageRequest(), now: fixedNow,
      credentials: () => ({ username: "owner-process", password: "process-secret" }),
      probe: { probe: async (input) => {
        probes += 1;
        assert.equal(input.directory, targetRoot);
        assert.deepEqual(input.required_commands, ["terv-review"]);
        return live;
      } },
    });
    assert.equal(resolved.mode, "P0B_ISOLATED");
    assert.equal(resolved.router_protocol_identity, "fal-explicit-stage-router/v1");
    assert.equal(resolved.sse_enabled, false);
    assert.equal(probes, 1);
    const outsideRoot = path.join(root, "outside-real-project");
    mkdirSync(outsideRoot);
    const outsideTarget = { ...target, root: outsideRoot };
    await assert.rejects(() => resolveProtectedCapability({ registry, registry_path: registryPath, protected_control_root: control, target_id: "synthetic-p0b", target: outsideTarget, request: stageRequest(), now: fixedNow, credentials: () => ({ username: "owner-process", password: "process-secret" }), probe: { probe: async () => { throw new Error("outside fixture must not probe"); } } }), /outside the protected P0B isolation root/);
    await assert.rejects(() => resolveProtectedCapability({ registry, registry_path: registryPath, protected_control_root: control, target_id: "synthetic-p0b", target, request: stageRequest("awc-3.1"), now: fixedNow, credentials: () => ({ username: "owner-process", password: "process-secret" }), probe: { probe: async () => live } }), /AWC 4\.1\.1/);
    const disabled = parseControlRegistry({ ...registryValue, mode: "DISABLED" });
    const killSwitch = await resolveProtectedCapability({ registry: disabled, registry_path: registryPath, protected_control_root: control, target_id: "synthetic-p0b", target, request: stageRequest(), now: fixedNow, credentials: () => { throw new Error("must not resolve credentials"); }, probe: { probe: async () => { throw new Error("must not probe"); } } });
    assert.equal(killSwitch.mode, "DISABLED");

    const runtime = path.join(root, "runtime");
    mkdirSync(path.join(runtime, "validated-evidence"), { recursive: true });
    const productionProof = { ...acceptedP0bProof(), executable_attestation_sha256: sha256("attested-runtime-v4"), opencode_server_version: live.server_version, server_binary_sha256: live.server_binary_sha256, server_instance_identity_sha256: live.server_instance_identity_sha256, target_directory_sha256: live.target_directory_sha256 };
    const proofIdentity = writeP0bProofReceipt(runtime, productionProof).p0b_proof_sha256;
    const productionTarget: RegistryTarget = { ...target, isolation_class: "PRODUCTION_TARGET" };
    const productionGrant = {
      ...grant,
      mode: "PRODUCTION_RESPONSE_FIRST",
      authorization_class: "PRODUCTION_INSTALL",
      isolation_class: "PRODUCTION_TARGET",
      authorized_session_set_sha256: sha256(canonicalize([{ role: "Meta", session_sha256: sha256(target.sessions.Meta!.id) }])),
      p0b_proof_sha256: proofIdentity,
    } as const;
    writeFileSync(path.join(control, target.capability_receipt_path!), JSON.stringify(productionGrant));
    const productionRegistry = parseControlRegistry({ ...registryValue, mode: "PRODUCTION_RESPONSE_FIRST", targets: { "synthetic-p0b": productionTarget } });
    const productionResolved = await resolveProtectedCapability({ registry: productionRegistry, registry_path: registryPath, protected_control_root: control, target_id: "synthetic-p0b", target: productionTarget, request: stageRequest(), now: fixedNow, credentials: () => ({ username: "owner-process", password: "process-secret" }), executable_attestation_sha256: productionProof.executable_attestation_sha256, probe: { probe: async () => live } });
    assert.equal(productionResolved.mode, "PRODUCTION_RESPONSE_FIRST");

    const patchLive: CapabilityProbeProjection = {
      ...live,
      server_version: "1.18.22",
      server_binary_sha256: "7".repeat(64),
      server_instance_identity_sha256: "6".repeat(64),
    };
    const patchTarget: RegistryTarget = { ...productionTarget, server: { ...productionTarget.server, binary_sha256: patchLive.server_binary_sha256 } };
    const patchGrant = {
      ...productionGrant,
      server_version: patchLive.server_version,
      server_binary_sha256: patchLive.server_binary_sha256,
      server_instance_identity_sha256: patchLive.server_instance_identity_sha256,
    } as const;
    writeFileSync(path.join(control, target.capability_receipt_path!), JSON.stringify(patchGrant));
    const patchRegistry = parseControlRegistry({ ...registryValue, mode: "PRODUCTION_RESPONSE_FIRST", targets: { "synthetic-p0b": patchTarget } });
    const patchResolved = await resolveProtectedCapability({ registry: patchRegistry, registry_path: registryPath, protected_control_root: control, target_id: "synthetic-p0b", target: patchTarget, request: stageRequest(), now: fixedNow, credentials: () => ({ username: "owner-process", password: "process-secret" }), executable_attestation_sha256: productionProof.executable_attestation_sha256, probe: { probe: async () => patchLive } });
    assert.equal(patchResolved.server_binary_sha256, patchLive.server_binary_sha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Compact authority derives protected target and case-insensitive unique session, then consumes stable P0B authority once", async () => {
  const sandboxTemp = path.join(process.cwd(), ".test-tmp");
  mkdirSync(sandboxTemp, { recursive: true });
  const root = mkdtempSync(path.join(sandboxTemp, "fal-router-compact-authority-"));
  try {
    const control = path.join(root, "control");
    const runtime = path.join(root, "runtime");
    const isolationRoot = path.join(root, "p0b-isolation");
    const targetRoot = path.join(isolationRoot, "protected-target");
    mkdirSync(path.join(control, "capability-receipts"), { recursive: true });
    mkdirSync(runtime);
    mkdirSync(path.join(targetRoot, ".opencode-router"), { recursive: true });
    const isolationRootSha256 = p0bIsolationRootSha256(isolationRoot);
    writeFileSync(path.join(targetRoot, ".opencode-router", "sessions.json"), JSON.stringify({ Meta: { id: "caller-local-map-must-not-authorize" } }));
    writeFileSync(path.join(control, "retention-policy.json"), JSON.stringify(policy));
    const target: RegistryTarget = {
      profile_identity: "compact-profile", target_identity: "compact-target", worktree_identity: "git:compact", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" },
      root: targetRoot, state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/PROJECT_OVERLAY.md", accountable_role_path: "ops/roles/DELIVERY.md",
      server: { origin: "http://127.0.0.1:4096", binary_sha256: "9".repeat(64), command_timeout_ms: 300_000 }, sessions: { Meta: { id: "session-protected-compact" } },
      capability_receipt_path: "capability-receipts/compact-grant.json", isolation_class: "SYNTHETIC_TEST_ONLY",
    };
    const registryValue = { schema_version: "router-control-registry.v2", router_protocol_identity: ROUTER_PROTOCOL_IDENTITY, mode: "P0B_ISOLATED", retention_policy_path: "retention-policy.json", p0b_isolation_root: isolationRoot, p0b_isolation_root_sha256: isolationRootSha256, targets: { "compact-target": target } } as const;
    const registryPath = path.join(control, "control-registry.json");
    writeFileSync(registryPath, JSON.stringify(registryValue));
    const live: CapabilityProbeProjection = {
      server_version: "1.18.19", server_binary_sha256: target.server.binary_sha256!, server_instance_identity_sha256: "8".repeat(64),
      target_directory_sha256: sha256(`fal-router-target-directory/v1\n${realpathSync(targetRoot)}`), health_identity_sha256: "1".repeat(64), doc_sha256: "2".repeat(64),
      command_registry_sha256: "3".repeat(64), supported_commands: ["after-compact"], sse: { probe_status: "VERIFIED", proof_sha256: "4".repeat(64), enabled: false },
    };
    const grant = {
      schema_version: "router-capability-receipt.v1", router_protocol_identity: ROUTER_PROTOCOL_IDENTITY, mode: "P0B_ISOLATED", authorization_class: "P0B_ONE_USE", authorization_id: "compact-grant-1",
      target_id: "compact-target", isolation_class: "SYNTHETIC_TEST_ONLY", p0b_isolation_root_sha256: isolationRootSha256, target_identity_sha256: sha256(target.target_identity), worktree_identity_sha256: sha256(target.worktree_identity),
      target_directory_sha256: live.target_directory_sha256, origin_sha256: sha256(target.server.origin), server_binary_sha256: live.server_binary_sha256, server_instance_identity_sha256: live.server_instance_identity_sha256,
      authorized_session_set_sha256: sha256(target.sessions.Meta!.id), authorized_command_set_sha256: sha256(canonicalize(["after-compact"])), command_timeout_ms: target.server.command_timeout_ms,
      server_version: live.server_version, health_identity_sha256: live.health_identity_sha256, doc_sha256: live.doc_sha256, command_registry_sha256: live.command_registry_sha256,
      supported_commands: live.supported_commands, authorized_commands: ["after-compact"], compatible_awc_contracts: ["awc-4.1.1"], command_response_contract: "SYNC_WITH_PARTS_V1",
      snapshot_correlation: "EXACT_PARENT_LINK", sse: live.sse, p0b_proof_sha256: "0".repeat(64), issued_at: "2026-08-21T11:55:00.000Z", expires_at: "2026-08-21T12:05:00.000Z",
    } as const;
    const capabilityPath = path.join(control, target.capability_receipt_path!);
    writeFileSync(capabilityPath, JSON.stringify(grant));
    const registry = parseControlRegistry(registryValue);
    assert.doesNotThrow(() => cliTest.validateOperationArguments("resolve-compact-authority", new Map([["--target-id", "compact-target"], ["--recipient-role", "Meta"]])));
    assert.doesNotThrow(() => cliTest.validateOperationArguments("consume-compact-authority", new Map([["--target-id", "compact-target"], ["--recipient-role", "Meta"], ["--attempt-id", "compact-attempt-1"]])));
    assert.throws(() => cliTest.validateOperationArguments("resolve-compact-authority", new Map([["--server", "http://127.0.0.1:9999"]])), /not allowed/);
    assert.throws(() => cliTest.validateOperationArguments("resolve-compact-authority", new Map([["--target-root", targetRoot]])), /not allowed/);
    let probes = 0;
    const probe = { probe: async (input: Parameters<NonNullable<Parameters<typeof resolveCompactProtectedAuthority>[0]["probe"]["probe"]>>[0]) => {
      probes += 1;
      assert.equal(input.origin, target.server.origin);
      assert.equal(input.directory, realpathSync(targetRoot));
      assert.deepEqual(input.required_commands, ["after-compact"]);
      return live;
    } };
    const common = { registry, registry_path: registryPath, protected_control_root: control, target_id: "compact-target", probe, credentials: () => ({ username: "owner-process", password: "process-secret" }), now: fixedNow } as const;
    const exact = await resolveCompactProtectedAuthority({ ...common, recipient_role: "Meta" });
    const alias = await resolveCompactProtectedAuthority({ ...common, recipient_role: "mEtA" });
    assert.equal(exact.logical_session_ref, "Meta");
    assert.equal(alias.session_id, exact.session_id);
    assert.equal(exact.session_id, "session-protected-compact");
    assert.notEqual(exact.session_id, "caller-local-map-must-not-authorize");
    assert.equal(exact.target_root, realpathSync(targetRoot));
    assert.equal(exact.origin, target.server.origin);
    const handoffRoot = path.join(runtime, "compact-authority-handoffs");
    mkdirSync(handoffRoot);
    const handoffToken = "a".repeat(32);
    const status = cliTest.writeCompactAuthorityHandoff(runtime, exact, handoffToken) as Record<string, unknown>;
    const statusJson = JSON.stringify(status);
    for (const sentinel of [exact.target_root, exact.origin, exact.session_id, Buffer.from(exact.target_root).toString("base64"), Buffer.from(exact.origin).toString("base64"), Buffer.from(exact.session_id).toString("base64")]) assert.equal(statusJson.includes(sentinel), false, "Compact stdout status must contain digests only");
    assert.equal(status.schema_version, "compact-protected-authority-status.v1");
    assert.equal(status.handoff_token, handoffToken);
    const durableHandoff = path.join(handoffRoot, `${handoffToken}.json`);
    assert.equal((JSON.parse(readFileSync(durableHandoff, "utf8")) as { session_id: string }).session_id, exact.session_id);
    unlinkSync(durableHandoff);
    await assert.rejects(() => resolveCompactProtectedAuthority({ ...common, recipient_role: "Delivery" }), /unknown or ambiguous/);
    await assert.rejects(() => resolveCompactProtectedAuthority({ ...common, target_id: "caller-selected-target", recipient_role: "Meta" }), /absent from protected authority/);
    const outsideRoot = path.join(root, "outside-compact-target");
    mkdirSync(outsideRoot);
    const outsideTarget = { ...target, root: outsideRoot };
    const outsideRegistry = parseControlRegistry({ ...registryValue, targets: { "compact-target": outsideTarget } });
    await assert.rejects(() => resolveCompactProtectedAuthority({ ...common, registry: outsideRegistry, recipient_role: "Meta", probe: { probe: async () => { throw new Error("outside Compact fixture must not probe"); } } }), /outside the protected P0B isolation root/);

    const ambiguousTarget = { ...target, sessions: { Meta: { id: "session-protected-compact-a" }, meta: { id: "session-protected-compact-b" } } };
    const ambiguousRegistry = parseControlRegistry({ ...registryValue, targets: { "compact-target": ambiguousTarget } });
    await assert.rejects(() => resolveCompactProtectedAuthority({ ...common, registry: ambiguousRegistry, recipient_role: "META" }), /unknown or ambiguous/);

    const store = new StateStore(runtime);
    const consumed = await cliTest.resolveCompactAuthorityOperation({ registryPath, controlRoot: control, targetId: "compact-target", recipientRole: "meta", store, probe, credentials: () => ({ username: "owner-process", password: "process-secret" }), consume: true, attemptId: "compact-attempt-1", now: fixedNow });
    assert.equal("authorization_state" in consumed ? consumed.authorization_state : undefined, "CONSUMED");
    const firstReceiptBytes = readFileSync(capabilityPath);
    writeFileSync(capabilityPath, `${JSON.stringify(grant, null, 2)}\n`);
    assert.notEqual(sha256(firstReceiptBytes), sha256(readFileSync(capabilityPath)));
    const reserialized = await resolveCompactProtectedAuthority({ ...common, recipient_role: "META" });
    assert.equal(reserialized.authorization_use_sha256, exact.authorization_use_sha256);
    await assert.rejects(() => cliTest.resolveCompactAuthorityOperation({ registryPath, controlRoot: control, targetId: "compact-target", recipientRole: "Meta", store: new StateStore(runtime), probe, credentials: () => ({ username: "owner-process", password: "process-secret" }), consume: true, attemptId: "compact-attempt-2", now: fixedNow }), /already claimed or consumed/);
    assert.equal(probes, 5);

    const wrongCommand = { ...grant, supported_commands: ["terv-review"], authorized_commands: ["terv-review"], authorized_command_set_sha256: sha256(canonicalize(["terv-review"])) } as const;
    writeFileSync(capabilityPath, JSON.stringify(wrongCommand));
    await assert.rejects(() => resolveCompactProtectedAuthority({ ...common, recipient_role: "Meta" }), /does not authorize after-compact/);
    const noAwc = { ...grant, compatible_awc_contracts: ["awc-3.1"] } as const;
    writeFileSync(capabilityPath, JSON.stringify(noAwc));
    await assert.rejects(() => resolveCompactProtectedAuthority({ ...common, recipient_role: "Meta" }), /AWC 4\.1\.1/);

    mkdirSync(path.join(runtime, "validated-evidence"), { recursive: true });
    const executableAttestationSha256 = sha256("compact-production-attestation");
    const productionProof = { ...acceptedP0bProof(), executable_attestation_sha256: executableAttestationSha256, opencode_server_version: live.server_version, server_binary_sha256: live.server_binary_sha256, server_instance_identity_sha256: live.server_instance_identity_sha256, target_directory_sha256: live.target_directory_sha256 };
    const proofSha256 = writeP0bProofReceipt(runtime, productionProof).p0b_proof_sha256;
    const productionTarget = { ...target, isolation_class: "PRODUCTION_TARGET" } as const;
    const productionGrant = {
      ...grant, mode: "PRODUCTION_RESPONSE_FIRST", authorization_class: "PRODUCTION_INSTALL", isolation_class: "PRODUCTION_TARGET",
      authorized_session_set_sha256: sha256(canonicalize([{ role: "Meta", session_sha256: sha256(target.sessions.Meta!.id) }])), p0b_proof_sha256: proofSha256,
    } as const;
    writeFileSync(registryPath, JSON.stringify({ ...registryValue, mode: "PRODUCTION_RESPONSE_FIRST", targets: { "compact-target": productionTarget } }));
    writeFileSync(capabilityPath, JSON.stringify(productionGrant));
    await assert.rejects(() => cliTest.resolveCompactAuthorityOperation({ registryPath, controlRoot: control, targetId: "compact-target", recipientRole: "META", store: new StateStore(runtime), probe, credentials: () => ({ username: "owner-process", password: "process-secret" }), executableAttestationSha256, rootAuthorityClass: "P0B_TEST_ONLY", consume: true, attemptId: "compact-test-root-production", now: fixedNow }), /Test-only KnownFolder authority cannot authorize production/);
    const productionRevalidation = await cliTest.resolveCompactAuthorityOperation({ registryPath, controlRoot: control, targetId: "compact-target", recipientRole: "META", store: new StateStore(runtime), probe, credentials: () => ({ username: "owner-process", password: "process-secret" }), executableAttestationSha256, consume: true, attemptId: "compact-production-attempt", now: fixedNow });
    assert.equal("authorization_state" in productionRevalidation ? productionRevalidation.authorization_state : undefined, "NOT_APPLICABLE");
    assert.equal(productionRevalidation.authorization_use_sha256, "0".repeat(64));
    assert.equal(existsSync(path.join(runtime, "capability-uses", `${"0".repeat(64)}.json`)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("one-use grant claims survive crash and reject racing or replayed dispatches", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-one-use-"));
  try {
    const semanticGrant = { authorization_id: "owner-grant-1", target_id: "synthetic-p0b", mode: "P0B_ISOLATED", authorization_class: "P0B_ONE_USE" } as const;
    const reorderedGrantBytes = '{\n  "authorization_class": "P0B_ONE_USE", "mode": "P0B_ISOLATED",\n  "target_id": "synthetic-p0b", "authorization_id": "owner-grant-1"\n}\n';
    const originalGrantBytes = JSON.stringify(semanticGrant);
    assert.notEqual(sha256(originalGrantBytes), sha256(reorderedGrantBytes));
    const reorderedGrant = parseStrictJson(reorderedGrantBytes) as typeof semanticGrant;
    const digest = capabilityAuthorizationUseSha256(semanticGrant);
    assert.equal(capabilityAuthorizationUseSha256(reorderedGrant), digest);
    const first = new StateStore(root);
    first.claimOneUseCapability(digest, "run-one", "op-one");
    assert.throws(() => first.claimOneUseCapability(digest, "run-two", "op-two"), /already claimed or consumed/);
    const afterCrash = new StateStore(root);
    assert.throws(() => afterCrash.claimOneUseCapability(digest, "run-two", "op-two"), /already claimed or consumed/);
    afterCrash.settleOneUseCapability(digest, "run-one", "op-one", "CONSUMED");
    assert.throws(() => afterCrash.claimOneUseCapability(digest, "run-three", "op-three"), /already claimed or consumed/);
    const persisted = readFileSync(path.join(root, "capability-uses", `${digest}.json`), "utf8");
    assert.match(persisted, /"status":"CONSUMED"/);
    assert.doesNotMatch(persisted, /session|password|origin|command body/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("AC87 purge receipts contain counts and hashes, never names, paths, or raw content", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-retention-"));
  try {
    assert.deepEqual(parseRetentionPolicy(policy), policy);
    const entries: Array<[string, string, number]> = [
      ["quarantine", "private-session-alpha.json", 8],
      ["diagnostics", "private-origin-beta.json", 31],
      ["validated-evidence", "private-transcript-gamma.json", 181],
    ];
    for (const [bucket, name, age] of entries) {
      const directory = path.join(root, bucket);
      mkdirSync(directory);
      const file = path.join(directory, name);
      writeFileSync(file, "raw-private-content");
      const modified = new Date(fixedNow.getTime() - age * 86_400_000);
      utimesSync(file, modified, modified);
    }
    const handoffRoot = path.join(root, "compact-authority-handoffs");
    mkdirSync(handoffRoot);
    const staleHandoff = path.join(handoffRoot, "private-handoff.json");
    writeFileSync(staleHandoff, "raw-private-content");
    const staleHandoffTime = new Date(fixedNow.getTime() - 16 * 60_000);
    utimesSync(staleHandoff, staleHandoffTime, staleHandoffTime);
    const receipt = purgeExpiredPrivateEvidence(root, policy, fixedNow);
    assert.deepEqual(receipt.cutoff_class_counts, { ephemeral_handoffs_15m: 1, quarantine_7d: 1, diagnostics_30d: 1, validated_180d: 1, terminal_runs_180d: 0 });
    assert.equal(existsSync(staleHandoff), false);
    const durable = JSON.stringify(receipt);
    assert.doesNotMatch(durable, /private-|raw-private-content|fal-router-retention|[A-Z]:\\/i);
    assert.equal(receipt.paths_emitted, false);
    assert.equal(receipt.raw_content_emitted, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("AC87 purge expires runtime-created terminal evidence while preserving active, uncertain, and duplicate-send authority", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-runtime-retention-"));
  let releaseLease: (() => void) | undefined;
  try {
    const store = new StateStore(root);
    for (const [runId, status] of [["terminal-run", "SUCCEEDED"], ["active-run", "CREATED"], ["uncertain-run", "UNCERTAIN"]] as const) {
      const authority = retentionAuthority(runId);
      store.createRun(authority, authoritySha256(authority));
      const operation = store.createOperation(runId, retentionInvocation(runId, `${runId}-op`), { schema_version: "dispatch-intent.v1" }, sha256(`intent:${runId}`));
      if (status !== "CREATED") store.updateOperation(runId, operation.operation_id, operation.revision, { status });
      if (runId === "terminal-run") store.writeSnapshotDiagnostic(runId, operation.operation_id, { schema_version: "router-snapshot-diagnostic.v1", raw_snapshot_persisted: false });
    }
    const semanticKey = sha256("semantic-authority");
    const authorizationUse = sha256("one-use-authority");
    store.claimSemanticAction(semanticKey, "terminal-run", "terminal-run-op");
    store.settleSemanticAction(semanticKey, "terminal-run", "terminal-run-op", "CONSUMED");
    store.claimOneUseCapability(authorizationUse, "terminal-run", "terminal-run-op");
    store.settleOneUseCapability(authorizationUse, "terminal-run", "terminal-run-op", "CONSUMED");
    const leaseKey = sha256("measured-instance-and-session");
    releaseLease = store.acquireLease(leaseKey, { schema_version: "dispatch-lease.v1", server_fingerprint_sha256: "a".repeat(64), session_sha256: "b".repeat(64), operation_class: "PLAN_REVIEW", holder: "retention-test", acquired_at: fixedNow.toISOString(), fencing_generation: "retention-generation" });

    const diagnosticPurgeAt = new Date(Date.now() + 31 * 86_400_000 + 60_000);
    const first = purgeExpiredPrivateEvidence(root, policy, diagnosticPurgeAt);
    assert.equal(first.cutoff_class_counts.diagnostics_30d, 1);
    assert.equal(existsSync(path.join(root, "runs", "terminal-run", "operations", "terminal-run-op", "snapshot-diagnostic.json")), false);
    assert.equal(existsSync(path.join(root, "runs", "terminal-run")), true);

    const terminalPurgeAt = new Date(Date.now() + 181 * 86_400_000 + 60_000);
    const second = purgeExpiredPrivateEvidence(root, policy, terminalPurgeAt);
    assert.equal(second.cutoff_class_counts.terminal_runs_180d, 1);
    assert.equal(existsSync(path.join(root, "runs", "terminal-run")), false);
    assert.equal(existsSync(path.join(root, "runs", "active-run")), true);
    assert.equal(existsSync(path.join(root, "runs", "uncertain-run")), true);
    assert.equal(existsSync(path.join(root, "semantic-actions", `${semanticKey}.json`)), true);
    assert.equal(existsSync(path.join(root, "capability-uses", `${authorizationUse}.json`)), true);
    assert.equal(existsSync(path.join(root, "dispatch-leases", `${leaseKey}.lock`)), true);
    assert.equal(second.preserved_class_counts.active_or_uncertain_runs, 2);
    const durable = JSON.stringify(second);
    assert.doesNotMatch(durable, /terminal-run|active-run|uncertain-run|retention-test|[A-Z]:\\/i);
  } finally {
    releaseLease?.();
    rmSync(root, { recursive: true, force: true });
  }
});

test("canonical sanitized P0B proof is deterministic, privacy-minimized, and accepted-only authority", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-p0b-proof-"));
  try {
    mkdirSync(path.join(root, "validated-evidence"));
    const proof = acceptedP0bProof();
    assert.deepEqual(parseP0bProofReceipt(proof), proof);
    const identity = p0bProofSha256(proof);
    const reordered = Object.fromEntries(Object.entries(proof).reverse());
    assert.equal(p0bProofSha256(parseP0bProofReceipt(reordered)), identity);
    const write = writeP0bProofReceipt(root, proof);
    assert.deepEqual(write, { schema_version: "router-p0b-proof-write-receipt.v1", p0b_proof_sha256: identity, accepted: true, paths_emitted: false, network_send: false });
    assert.deepEqual(readP0bProofReceipt(root, identity), proof);
    const durable = readFileSync(path.join(root, "validated-evidence", `p0b-proof.${identity}.json`), "utf8");
    assert.doesNotMatch(durable, /https?:\/\/|[A-Z]:\\|ses_[A-Za-z0-9_-]+|private reasoning|event:\s*message/i);
    const rejected = { ...proof, response_parent_bound: false, accepted: false, gate_failures: ["RESPONSE_PARENT_NOT_BOUND"] };
    assert.equal(parseP0bProofReceipt(rejected).accepted, false);
    assert.throws(() => writeP0bProofReceipt(root, rejected), /Only an exact accepted/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fixed control-plane layout and runtime 0.2.0 release are a public operator contract", () => {
  const routerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
  const bootstrap = readFileSync(path.join(routerRoot, "scripts", "Initialize-OCRouterControlPlane.ps1"), "utf8");
  for (const binding of ["control\\control-registry.json", "control\\retention-policy.json", "control\\capability-receipts", "runtime\\p0b-isolation", "runtime\\compact-authority-handoffs", "runtime\\quarantine", "runtime\\diagnostics", "runtime\\validated-evidence", "receipts"]) assert.match(bootstrap, new RegExp(binding.replace(/\\/g, "\\\\"), "i"));
  assert.match(bootstrap, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(bootstrap, /default_mode = 'DISABLED'/);
  const retired = readFileSync(path.join(routerRoot, "scripts", "init-router-runtime.ps1"), "utf8");
  assert.match(retired, /FAL_EXPLICIT_STAGE_ROUTER_RETIRED/);
  const packageJson = JSON.parse(readFileSync(path.join(routerRoot, "runtime", "package.json"), "utf8")) as { version: string };
  assert.equal(packageJson.version, "0.2.0");
});

test("bootstrap creates and verifies the fixed owner-only tree without touching real LocalAppData", { skip: process.platform !== "win32" }, () => {
  const localAppData = mkdtempSync(path.join(tmpdir(), "fal-router-bootstrap-"));
  try {
    const routerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
    const script = path.join(routerRoot, "scripts", "Initialize-OCRouterControlPlane.ps1");
    const powerShell = path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const env = { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TEMP: process.env.TEMP!, TMP: process.env.TMP! };
    const run = (action: "Bootstrap" | "Verify") => spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Action", action, "-TestOnlyKnownFolderRoot", localAppData], { encoding: "utf8", env });
    const spoofed = spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Action", "Bootstrap"], { encoding: "utf8", env: { ...env, LOCALAPPDATA: localAppData } });
    assert.notEqual(spoofed.status, 0);
    assert.match(spoofed.stderr, /Ambient LOCALAPPDATA differs from the OS KnownFolder authority/);
    assert.equal(existsSync(path.join(localAppData, "FractalAgentLab")), false, "spoofed ambient LocalAppData must not relocate authority");
    const bootstrapped = run("Bootstrap");
    assert.equal(bootstrapped.status, 0, bootstrapped.stderr);
    const receipt = JSON.parse(bootstrapped.stdout) as { default_mode: string; owner_only_acl: boolean; paths_emitted: boolean };
    assert.deepEqual(receipt, { ...receipt, default_mode: "DISABLED", owner_only_acl: true, paths_emitted: false });
    const fixed = path.join(localAppData, "FractalAgentLab", "oc-router");
    for (const relative of ["control/control-registry.json", "control/retention-policy.json", "control/capability-receipts", "runtime/p0b-isolation", "runtime/compact-authority-handoffs", "runtime/quarantine", "runtime/diagnostics", "runtime/validated-evidence", "receipts"]) assert.equal(existsSync(path.join(fixed, relative)), true, relative);
    const registryPath = path.join(fixed, "control", "control-registry.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as { mode: string; targets: object; p0b_isolation_root: string; p0b_isolation_root_sha256: string };
    assert.equal(registry.mode, "DISABLED");
    assert.deepEqual(registry.targets, {});
    assert.equal(realpathSync(registry.p0b_isolation_root), realpathSync(path.join(fixed, "runtime", "p0b-isolation")));
    assert.equal(registry.p0b_isolation_root_sha256, p0bIsolationRootSha256(registry.p0b_isolation_root));
    const priorRootClass = process.env.OC_ROUTER_ROOT_AUTHORITY_CLASS;
    const priorDeclaredRoot = process.env.OC_ROUTER_KNOWN_FOLDER_ROOT;
    const priorDeclaredProof = process.env.OC_ROUTER_ROOT_AUTHORITY_SHA256;
    const priorLocalAppData = process.env.LOCALAPPDATA;
    try {
      process.env.OC_ROUTER_ROOT_AUTHORITY_CLASS = "OS_KNOWN_FOLDER";
      process.env.OC_ROUTER_KNOWN_FOLDER_ROOT = localAppData;
      process.env.OC_ROUTER_ROOT_AUTHORITY_SHA256 = sha256(`fal-router-known-folder-authority/v1\nOS_KNOWN_FOLDER\n${realpathSync(localAppData)}`);
      process.env.LOCALAPPDATA = localAppData;
      assert.throws(() => cliTest.productionAuthorityContext(registryPath), /differs from the OS KnownFolder authority|operation not permitted|EPERM/, "direct Node cannot forge OS KnownFolder authority with deterministic environment values");
    } finally {
      if (priorRootClass === undefined) delete process.env.OC_ROUTER_ROOT_AUTHORITY_CLASS; else process.env.OC_ROUTER_ROOT_AUTHORITY_CLASS = priorRootClass;
      if (priorDeclaredRoot === undefined) delete process.env.OC_ROUTER_KNOWN_FOLDER_ROOT; else process.env.OC_ROUTER_KNOWN_FOLDER_ROOT = priorDeclaredRoot;
      if (priorDeclaredProof === undefined) delete process.env.OC_ROUTER_ROOT_AUTHORITY_SHA256; else process.env.OC_ROUTER_ROOT_AUTHORITY_SHA256 = priorDeclaredProof;
      if (priorLocalAppData === undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA = priorLocalAppData;
    }
    const verified = run("Verify");
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal((JSON.parse(verified.stdout) as { owner_only_acl: boolean }).owner_only_acl, true);

    const runtimeRoot = path.join(fixed, "runtime");
    const store = new StateStore(runtimeRoot);
    const authority = retentionAuthority("acl-runtime-run");
    store.createRun(authority, authoritySha256(authority));
    const authorizationUse = sha256("acl-runtime-one-use");
    store.claimOneUseCapability(authorizationUse, "acl-runtime-run", "acl-runtime-op");
    const verifiedAfterRuntimeWrite = run("Verify");
    assert.equal(verifiedAfterRuntimeWrite.status, 0, verifiedAfterRuntimeWrite.stderr);
    const launcher = path.join(routerRoot, "scripts", "Invoke-OCRouter.ps1");
    const launchedWithoutRouterEnvironment = spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", launcher, "-Operation", "get-run", "-RunId", authority.run_id, "-TestOnlyKnownFolderRoot", localAppData], { encoding: "utf8", env });
    assert.equal(launchedWithoutRouterEnvironment.status, 0, launchedWithoutRouterEnvironment.stderr);
    assert.equal(launchedWithoutRouterEnvironment.stderr, "");
    assert.equal(launchedWithoutRouterEnvironment.stdout.split(/\r?\n/).filter(Boolean).length, 1, "redirected launcher success emits exactly one stdout row");
    assert.equal((JSON.parse(launchedWithoutRouterEnvironment.stdout) as { run_id: string }).run_id, authority.run_id, "launcher derives fixed registry/runtime paths without caller OC_ROUTER variables");

    const aclItem = path.join(runtimeRoot, "capability-uses", `${authorizationUse}.json`);
    const mutateAcl = (command: string) => spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command], { encoding: "utf8", env: { ...env, OC_ROUTER_ACL_ITEM: aclItem } });
    const extraRule = "$acl=Get-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM;$sid=New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-546');$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'ReadAndExecute','None','None','Allow');[void]$acl.AddAccessRule($rule);Set-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM -AclObject $acl";
    assert.equal(mutateAcl(extraRule).status, 0);
    const extraRejected = run("Verify");
    assert.notEqual(extraRejected.status, 0);
    assert.match(extraRejected.stderr, /unexpected effective principal/);
    const removeExtra = "$acl=Get-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM;$sid=New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-546');$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'ReadAndExecute','None','None','Allow');[void]$acl.RemoveAccessRuleSpecific($rule);Set-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM -AclObject $acl";
    assert.equal(mutateAcl(removeExtra).status, 0);
    assert.equal(run("Verify").status, 0);
    const denyRule = "$acl=Get-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM;$sid=New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18');$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'ReadData','None','None','Deny');[void]$acl.AddAccessRule($rule);Set-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM -AclObject $acl";
    assert.equal(mutateAcl(denyRule).status, 0);
    const denyRejected = run("Verify");
    assert.notEqual(denyRejected.status, 0);
    assert.match(denyRejected.stderr, /contains a deny rule/);
    const removeDeny = "$acl=Get-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM;$sid=New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18');$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'ReadData','None','None','Deny');[void]$acl.RemoveAccessRuleSpecific($rule);Set-Acl -LiteralPath $env:OC_ROUTER_ACL_ITEM -AclObject $acl";
    assert.equal(mutateAcl(removeDeny).status, 0);
    assert.equal(run("Verify").status, 0);
    const secondBootstrap = run("Bootstrap");
    assert.notEqual(secondBootstrap.status, 0);
    assert.match(secondBootstrap.stderr, /will not overwrite/);
  } finally {
    rmSync(localAppData, { recursive: true, force: true });
  }
});

test("KnownFolder ancestor junction blocks bootstrap before redirected authority is created", { skip: process.platform !== "win32" }, (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-knownfolder-link-"));
  const knownFolder = path.join(root, "known");
  const redirected = path.join(root, "redirected");
  const junction = path.join(knownFolder, "FractalAgentLab");
  mkdirSync(knownFolder);
  mkdirSync(redirected);
  try {
    try { symlinkSync(redirected, junction, "junction"); }
    catch { context.skip("Junction creation is unavailable on this Windows runner"); return; }
    const routerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
    const script = path.join(routerRoot, "scripts", "Initialize-OCRouterControlPlane.ps1");
    const powerShell = path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const result = spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Action", "Bootstrap", "-TestOnlyKnownFolderRoot", knownFolder], { encoding: "utf8", env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TEMP: process.env.TEMP!, TMP: process.env.TMP! } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /traverses a reparse point/);
    assert.equal(existsSync(path.join(redirected, "oc-router")), false);
  } finally {
    if (existsSync(junction)) unlinkSync(junction);
    rmSync(root, { recursive: true, force: true });
  }
});

test("bounded prepare path hashes only explicitly named sources and performs no send", { skip: process.platform !== "win32" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-prepare-"));
  try {
    const target = path.join(root, "target");
    const output = path.join(root, "output");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "plans"), { recursive: true });
    mkdirSync(output);
    const state = "State revision: `state-p0b`\n";
    const source = "EPIC IMPLEMENTATION PLAN\nReadiness: READY\n";
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), state);
    writeFileSync(path.join(target, "plans", "epic.md"), source);
    const specification = {
      schema_version: "router-stage-prepare-spec.v1", target_id: "fal", epic: "P0B", candidate_identity: "candidate-p0b",
      target_state_path: "ops/PROJECT_STATE.md", expected_target_state_sha256: sha256(state), manifest_target_path: "plans/stage-sources.json",
      entries: [{ stage: "PLAN_REVIEW", plan_class: "EPIC_PLAN", sources: [{ path: "plans/epic.md", source_class: "PLAN", logical_identity: "plan-p0b", producer: "owner-explicit", order: 0 }] }],
    };
    const specPath = path.join(root, "prepare.json");
    writeFileSync(specPath, JSON.stringify(specification));
    const routerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
    const script = path.join(routerRoot, "scripts", "Prepare-OCRouterStage.ps1");
    const powerShell = path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const result = spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-TargetRoot", target, "-SpecificationPath", specPath, "-OutputDirectory", output], { encoding: "utf8", env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TEMP: process.env.TEMP!, TMP: process.env.TMP! } });
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(result.stdout) as { network_send: boolean; paths_emitted: boolean; stage_source_manifest_sha256: string };
    assert.equal(receipt.network_send, false);
    assert.equal(receipt.paths_emitted, false);
    const manifestBytes = readFileSync(path.join(output, "stage-sources.candidate.json"));
    assert.equal(sha256(manifestBytes), receipt.stage_source_manifest_sha256);
    const manifest = parseStageSourceManifest(parseStrictJson(manifestBytes.toString("utf8")));
    assert.equal(manifest.entries[0]!.sources[0]!.sha256, sha256(source));
    const packet = JSON.parse(readFileSync(path.join(output, "stage-state-packet.candidate.json"), "utf8")) as { authority_source_selection: string; network_send: boolean; manifest_target_path: string };
    assert.deepEqual(packet, { ...packet, authority_source_selection: "OPERATOR_EXPLICIT", network_send: false, manifest_target_path: "plans/stage-sources.json" });
    assert.doesNotMatch(result.stdout, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

    const collisionOutput = path.join(root, "collision-output");
    mkdirSync(collisionOutput);
    writeFileSync(path.join(collisionOutput, "stage-state-packet.candidate.json"), "owner-existing");
    const collision = spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-TargetRoot", target, "-SpecificationPath", specPath, "-OutputDirectory", collisionOutput], { encoding: "utf8", env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TEMP: process.env.TEMP!, TMP: process.env.TMP! } });
    assert.notEqual(collision.status, 0);
    assert.equal(existsSync(path.join(collisionOutput, "stage-sources.candidate.json")), false, "pair preflight must not leave the first candidate behind");
    assert.equal(readFileSync(path.join(collisionOutput, "stage-state-packet.candidate.json"), "utf8"), "owner-existing");

    const duplicateOutput = path.join(root, "duplicate-output");
    mkdirSync(duplicateOutput);
    const duplicateSpecPath = path.join(root, "prepare-duplicate.json");
    writeFileSync(duplicateSpecPath, JSON.stringify(specification).replace('"target_id":"fal"', '"target_id":"fal","target_id":"forged"'));
    const duplicate = spawnSync(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-TargetRoot", target, "-SpecificationPath", duplicateSpecPath, "-OutputDirectory", duplicateOutput], { encoding: "utf8", env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TEMP: process.env.TEMP!, TMP: process.env.TMP! } });
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /Duplicate JSON object member/);
    assert.equal(existsSync(path.join(duplicateOutput, "stage-sources.candidate.json")), false);
    assert.equal(existsSync(path.join(duplicateOutput, "stage-state-packet.candidate.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("active Compact Lite and lifecycle independently derive one exact session fence in both acquisition orders", { skip: process.platform !== "win32" }, async () => {
  const root = mkdtempSync(path.join(process.cwd(), ".test-tmp-fence-"));
  let lifecycle: ChildProcessWithoutNullStreams | undefined;
  let compact: ChildProcessWithoutNullStreams | undefined;
  try {
    const fixture = createCompactFenceFixture(root);
    const powerShell = path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    compact = spawnCompactHarness(powerShell, fixture, path.join(root, "compact-first.signal"), path.join(root, "compact-first.release"));
    let compactFirstError = "";
    let compactFirstOutput = "";
    compact.stderr.setEncoding("utf8");
    compact.stderr.on("data", (chunk: string) => { compactFirstError += chunk; });
    compact.stdout.setEncoding("utf8");
    compact.stdout.on("data", (chunk: string) => { compactFirstOutput += chunk; });
    try { await waitForFile(path.join(root, "compact-first.signal")); }
    catch (error) { throw new Error(`${error instanceof Error ? error.message : "Compact signal failed"}: exit=${compact.exitCode}; stdout=${compactFirstOutput}; stderr=${compactFirstError}`); }

    const moduleUrl = new URL("../src/control-plane.js", import.meta.url).href;
    const lifecycleScript = `import { SharedSessionFence, buildSharedFenceBinding } from ${JSON.stringify(moduleUrl)}; const binding=buildSharedFenceBinding(process.env.TARGET_ROOT,process.env.PRIVATE_SESSION_ID); try { const lease=await new SharedSessionFence().acquire(binding); console.log('LOCKED'); if(process.env.HOLD==='true') await new Promise((resolve)=>process.stdin.once('data',resolve)); await lease.release(); } catch { console.log('BUSY'); process.exitCode=73; }`;
    const contender = spawn(process.execPath, ["--input-type=module", "-e", lifecycleScript], { env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TARGET_ROOT: fixture.target, PRIVATE_SESSION_ID: fixture.privateSessionId, HOLD: "false", LEGACY_ROLE_ALIAS: "META" }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let contenderError = "";
    contender.stderr.setEncoding("utf8");
    contender.stderr.on("data", (chunk: string) => { contenderError += chunk; });
    let contenderLine: string;
    try { contenderLine = await firstLine(contender); }
    catch (error) { throw new Error(`${error instanceof Error ? error.message : "lifecycle contender failed"}: ${contenderError}`); }
    assert.equal(contenderLine, "BUSY");
    await childExit(contender);
    writeFileSync(path.join(root, "compact-first.release"), "release");
    await childExit(compact);
    assert.notEqual(compact.exitCode, 0, "fixture stops after proving the real Lite fence is held");
    compact = undefined;

    lifecycle = spawn(process.execPath, ["--input-type=module", "-e", lifecycleScript], { env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TARGET_ROOT: fixture.target, PRIVATE_SESSION_ID: fixture.privateSessionId, HOLD: "true", LEGACY_ROLE_ALIAS: "meta" }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    assert.equal(await firstLine(lifecycle), "LOCKED");
    const lifecycleFirstSignal = path.join(root, "lifecycle-first.signal");
    compact = spawnCompactHarness(powerShell, fixture, lifecycleFirstSignal, path.join(root, "never-release"));
    let compactError = "";
    compact.stderr.setEncoding("utf8");
    compact.stderr.on("data", (chunk: string) => { compactError += chunk; });
    compact.stdout.resume();
    await childExit(compact);
    assert.notEqual(compact.exitCode, 0);
    assert.match(compactError, /participant transport is locked/i);
    assert.equal(existsSync(lifecycleFirstSignal), false, "Compact must fail before any telemetry/network call");
    compact = undefined;
    lifecycle.stdin.end("\n");
    await childExit(lifecycle);
    lifecycle = undefined;
    const postRelease = await new SharedSessionFence().acquire(buildSharedFenceBinding(fixture.target, fixture.privateSessionId));
    postRelease.assertHeld();
    await postRelease.release();
  } finally {
    if (compact?.exitCode === null) compact.kill();
    if (lifecycle?.exitCode === null) lifecycle.kill();
    rmSync(root, { recursive: true, force: true });
  }
});

function createCompactFenceFixture(root: string): { target: string; canonRoot: string; policyPath: string; privateSessionId: string; compactScript: string; harnessPath: string; contractSha256: string; profileSha256: string; policySha256: string } {
  const target = path.join(root, "target");
  const routerDirectory = path.join(target, ".opencode-router");
  const canonRoot = path.join(root, "canon");
  mkdirSync(routerDirectory, { recursive: true });
  mkdirSync(path.join(canonRoot, "canon"), { recursive: true });
  mkdirSync(path.join(canonRoot, "registry", "projects"), { recursive: true });
  const privateSessionId = "SessionCaseSensitiveP0B";
  writeFileSync(path.join(target, ".opencode-router", "sessions.json"), JSON.stringify({ server: "http://127.0.0.1:4096", sessions: { "delivery-alias": { sessionId: privateSessionId } } }));
  writeFileSync(path.join(target, "AGENTS.md"), "Compact Lite fence fixture");
  const contractPath = path.join(canonRoot, "canon", "CANONICAL-CONTRACT.json");
  writeFileSync(contractPath, JSON.stringify({ canon_version: "4.1.1", compact_lite_contract: { contract: "opencode-compact-lite/v1", active_path_after_apply: "COMPACT_LITE_ONLY" } }));
  const profilePath = path.join(canonRoot, "registry", "projects", "fixture.json");
  writeFileSync(profilePath, JSON.stringify({ schema_version: "2", project_id: "fixture", synchronization_identity: "fixture-compact-lite", enrollment_status: "ACTIVE", canon_compatibility: { maximum_major_version: 4 }, root_locator: { markers: [{ path: "AGENTS.md", contains: "Compact Lite" }] }, profiles: [{ profile_id: "fixture.delivery-alias", base_capability: "META" }] }));
  const policyPath = path.join(root, "global-policy.json");
  writeFileSync(policyPath, JSON.stringify({ schema_version: "1", contract: "opencode-compact-policy/v1", scope: "global", mode: "auto_safe", checks: ["before_dispatch", "after_stage_output", "epic_closeout"], warn_ratio: 0.5, critical_ratio: 0.62, compact_warn_at_first_safe_boundary: true, block_long_stage_at_critical: true, compact_epic_participants_after_closeout: true, safe_boundary_required: true, maximum_retry_count: 1, project_override: "tighten_only", excluded_role_profiles: [], required_gates: [] }));
  const routerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
  const fixtureScripts = path.join(root, "scripts");
  mkdirSync(fixtureScripts);
  for (const script of ["invoke-session-compact-lite.ps1", "oc-router-common.ps1", "session-compact-flow-core.ps1", "session-compact-lite-core.ps1"]) copyFileSync(path.join(routerRoot, "scripts", script), path.join(fixtureScripts, script));
  writeFileSync(path.join(fixtureScripts, "session-context-status.ps1"), "param([string]$SessionId,[string]$Server,[double]$WarnRatio,[double]$CriticalRatio,[string]$PolicyIdentity)\n[pscustomobject]@{pressure=[pscustomobject]@{state='warn'};session=[pscustomobject]@{state='idle'};model=[pscustomobject]@{provider_id='provider';model_id='model'};policy=[pscustomobject]@{identity=$PolicyIdentity;warn_ratio=$WarnRatio;critical_ratio=$CriticalRatio}}|ConvertTo-Json -Depth 10 -Compress\n");
  const compactScript = path.join(fixtureScripts, "invoke-session-compact-lite.ps1");
  const harnessPath = path.join(root, "compact-harness.ps1");
  writeFileSync(harnessPath, [
    "$ErrorActionPreference='Stop'",
    "function global:Invoke-RestMethod {",
    "  param($Method,$Uri,$Headers,$ContentType,$Body,$TimeoutSec,$MaximumRedirection)",
    "  [IO.File]::WriteAllText($env:NETWORK_SIGNAL,'called')",
    "  while(-not (Test-Path -LiteralPath $env:NETWORK_RELEASE)){Start-Sleep -Milliseconds 20}",
    "  throw 'FENCE_PROOF_STOP'",
    "}",
    "& $env:COMPACT_SCRIPT -ProjectId fixture -ProfileId fixture.delivery-alias -AttemptId fence-proof -TargetRoot $env:TARGET_ROOT -CanonRoot $env:CANON_ROOT -CanonContractSha256 $env:CONTRACT_SHA256 -ProjectProfileSha256 $env:PROFILE_SHA256 -Target delivery-alias -RoleHint 'Meta Coordinator' -EventType before_dispatch -Server 'http://127.0.0.1:4096' -GlobalPolicyPath $env:POLICY_PATH -GlobalPolicySha256 $env:POLICY_SHA256 -TestOnlyLegacyAuthority",
  ].join("\r\n"));
  return { target, canonRoot, policyPath, privateSessionId, compactScript, harnessPath, contractSha256: sha256(readFileSync(contractPath)), profileSha256: sha256(readFileSync(profilePath)), policySha256: sha256(readFileSync(policyPath)) };
}

function spawnCompactHarness(powerShell: string, fixture: ReturnType<typeof createCompactFenceFixture>, signalPath: string, releasePath: string): ChildProcessWithoutNullStreams {
  return spawn(powerShell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", fixture.harnessPath], {
    env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, TEMP: path.dirname(fixture.target), TMP: path.dirname(fixture.target), COMPACT_SCRIPT: fixture.compactScript, TARGET_ROOT: fixture.target, CANON_ROOT: fixture.canonRoot, POLICY_PATH: fixture.policyPath, CONTRACT_SHA256: fixture.contractSha256, PROFILE_SHA256: fixture.profileSha256, POLICY_SHA256: fixture.policySha256, PRIVATE_SESSION_ID: fixture.privateSessionId, NETWORK_SIGNAL: signalPath, NETWORK_RELEASE: releasePath },
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
}

function waitForFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = (): void => {
      if (existsSync(filePath)) { resolve(); return; }
      if (Date.now() - started > 15_000) { reject(new Error("Compact fence signal timed out")); return; }
      setTimeout(poll, 20);
    };
    poll();
  });
}

function firstLine(child: ChildProcessWithoutNullStreams): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("child process handshake timed out")); }, 15_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      const newline = output.indexOf("\n");
      if (newline === -1) return;
      clearTimeout(timer);
      resolve(output.slice(0, newline).trim());
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { if (!output.includes("\n")) { clearTimeout(timer); reject(new Error(`child process exited before handshake: ${code ?? "signal"}`)); } });
  });
}

function childExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("child process did not exit")); }, 15_000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}
