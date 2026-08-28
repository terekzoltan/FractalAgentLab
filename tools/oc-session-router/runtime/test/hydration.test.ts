import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { _test } from "../src/cli.js";
import { authoritySha256, parseRunRequest, sha256, type RunAuthority, type StageInvocation, type StageRequest } from "../src/contracts.js";
import { StageEngine, promotedSourcesForStage, runAuthorityMatchesAcrossOperationalRefresh } from "../src/stage-engine.js";
import { StateStore } from "../src/state-store.js";
import { GitWorktreeReader, worktreeProofSha256 } from "../src/worktree-reader.js";

test("target state and exact Combined heading remain authority", () => {
  const state = "State revision: `s1`\nCombined selector: `HEADING:3. Current`\n";
  assert.equal(_test.label(state, "State revision"), "s1");
  const combined = "# Root\n\n## Old\nold\n\n## 3. Current\ncurrent\n\n## Next\nnext\n";
  assert.equal(_test.headingSpan(combined, "HEADING:3. Current"), "## 3. Current\ncurrent\n\n");
});

test("compact summary cannot become run authority", () => {
  assert.throws(() => parseRunRequest({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a", compact_summary: "continue" }), /unknown fields/);
});

test("duplicate target-state labels fail closed", () => {
  assert.throws(() => _test.label("State revision: `a`\nState revision: `b`\n", "State revision"), /exactly one/);
});

test("CLI and PowerShell launcher derive authority from target state and fail on stale Active Route", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-cli-"));
  try {
    const target = path.join(root, "target");
    const runtime = path.join(root, "runtime");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "plans"), { recursive: true });
    mkdirSync(path.join(target, ".fal"), { recursive: true });
    mkdirSync(runtime);
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), [
      "State revision: `s1`", "Configuration identity: `c1`", "Wave: `W`", "Epic: `E`", "Combined selector: `HEADING:3. Current`",
      "Pinned artifact: `plans/epic.md`", "Pinned artifact logical identity: `plan-1`", "Candidate identity: `candidate-1`", "Review cycle: `0`",
      "Stage source manifest: `plans/stage-sources.json`", `Stage source manifest SHA-256: \`${sha256(JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "PLAN_REVIEW", plan_class: "EPIC_PLAN", sources: [{ path: "plans/epic.md", source_class: "PLAN", logical_identity: "plan-1", producer: "target-state", sha256: sha256("EPIC IMPLEMENTATION PLAN\nReadiness: READY\n"), order: 0 }] }] }))}\``, "Workflow phase: `PLAN_REVIEW`", "Next actor: `Meta`", "Next command: `/terv-review`", "",
    ].join("\n"));
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## 3. Current\n| Epic | Status |\n| E | OPEN |\n");
    writeFileSync(path.join(target, "plans", "epic.md"), "EPIC IMPLEMENTATION PLAN\nReadiness: READY\n");
    writeFileSync(path.join(target, "plans", "stage-sources.json"), JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "PLAN_REVIEW", plan_class: "EPIC_PLAN", sources: [{ path: "plans/epic.md", source_class: "PLAN", logical_identity: "plan-1", producer: "target-state", sha256: sha256("EPIC IMPLEMENTATION PLAN\nReadiness: READY\n"), order: 0 }] }] }));
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    const activeBase = {
      schema_version: "1", contract: "agent-workflow-active-route/v1", created_utc: "2026-08-12T00:00:00.000Z", project_id: "fal", profile_id: "profile-1", workflow_phase: "PLAN_REVIEW",
      state: { path: "ops/PROJECT_STATE.md", sha256: "0".repeat(64), state_revision: "s1" }, combined: { path: "ops/Combined.md", selector: "HEADING:3. Current", sha256: "0".repeat(64), wave_id: "W", epic_id: "E" },
      stage: { path: "plans/epic.md", sha256: sha256("EPIC IMPLEMENTATION PLAN\nReadiness: READY\n"), logical_identity: "plan-1" }, candidate_identity: "candidate-1", configuration_identity: "c1",
      worktree_identity: "git:a", next_actor: "Meta", next_command: "/terv-review", route_input: { mode: "PINNED_ARTIFACT", path: "plans/epic.md", sha256: sha256("EPIC IMPLEMENTATION PLAN\nReadiness: READY\n"), logical_identity: "plan-1" },
    };
    writeFileSync(path.join(target, ".fal", "ACTIVE_ROUTE.json"), JSON.stringify({ ...activeBase, generation_id: _test.activeRouteGeneration(activeBase as never) }));
    const registryPath = path.join(root, "registry.json");
    const registry = {
      schema_version: "router-control-registry.v1",
      targets: { fal: {
        profile_identity: "profile-1", target_identity: "FractalAgentLab", worktree_identity: "git:a", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target,
        state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md",
        active_route_path: ".fal/ACTIVE_ROUTE.json", require_active_route: true,
        server: { origin: "http://127.0.0.1:1", fingerprint: "fixture" }, sessions: { Meta: { id: "private-fixture" } },
      } },
    };
    writeFileSync(registryPath, JSON.stringify(registry));
    const requestPath = path.join(root, "request.json");
    writeFileSync(requestPath, JSON.stringify({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }));
    const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/cli.js");
    const stale = spawnSync(process.execPath, [cli, "new-run", "--request", requestPath], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath } });
    assert.equal(stale.status, 3);
    assert.match(stale.stderr, /SOURCE_IDENTITY_CHANGED/);
    registry.targets.fal.require_active_route = false;
    writeFileSync(registryPath, JSON.stringify(registry));
    const resolver = new _test.FileAuthorityResolver(registryPath);
    const firstAuthority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-registry-1", createdAt: "2026-08-10T00:00:00.000Z" });
    assert.equal(firstAuthority.active_route_generation, "UNDECLARED");
    const optionalChanged = { ...activeBase, created_utc: "2026-08-12T00:00:01.000Z", route_input: { ...activeBase.route_input, path: "plans/other.md" }, generation_id: "" };
    optionalChanged.generation_id = _test.activeRouteGeneration(optionalChanged as never);
    writeFileSync(path.join(target, ".fal", "ACTIVE_ROUTE.json"), JSON.stringify(optionalChanged));
    const optionalChangedAuthority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-registry-optional", createdAt: "2026-08-10T00:00:00.500Z" });
    assert.equal(optionalChangedAuthority.active_route_generation, "UNDECLARED");
    registry.targets.fal.profile_identity = "profile-2";
    writeFileSync(registryPath, JSON.stringify(registry));
    const secondAuthority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-registry-2", createdAt: "2026-08-10T00:00:01.000Z" });
    assert.notEqual(secondAuthority.target_profile_sha256, firstAuthority.target_profile_sha256);
    assert.equal(secondAuthority.target_profile_identity, "profile-2");
    assert.equal(secondAuthority.active_route_generation, "UNDECLARED");
    registry.targets.fal.profile_identity = "profile-1";
    if (process.platform === "win32") {
      symlinkSync(path.join(target, "ops"), path.join(target, "linked-ops"), "junction");
      registry.targets.fal.state_path = "linked-ops/PROJECT_STATE.md";
      writeFileSync(registryPath, JSON.stringify(registry));
      const linked = spawnSync(process.execPath, [cli, "new-run", "--request", requestPath], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath } });
      assert.equal(linked.status, 3);
      assert.match(linked.stderr, /UNSAFE_PATH/);
      registry.targets.fal.state_path = "ops/PROJECT_STATE.md";
    }
    writeFileSync(registryPath, JSON.stringify(registry));
    const created = spawnSync(process.execPath, [cli, "new-run", "--request", requestPath], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath } });
    assert.equal(created.status, 0, created.stderr);
    const result = JSON.parse(created.stdout) as { run_id: string; auto_advance: boolean };
    assert.match(result.run_id, /^run-/);
    assert.equal(result.auto_advance, false);

    if (process.platform === "win32") {
      const launcher = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../scripts/Invoke-OCRouter.ps1");
      const launched = spawnSync("powershell.exe", [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcher, "-Operation", "new-run", "-RequestPath", requestPath,
      ], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath } });
      assert.notEqual(launched.status, 0, "production launcher must reject caller-selected legacy runtime/registry paths");
      assert.match(launched.stderr, /Fixed router root is missing|Ambient LOCALAPPDATA differs|"error_code":"RUN_AUTHORITY_BLOCKED"/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI resolve-stage preserves UNCERTAIN while production launcher rejects alternate runtime authority", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-cli-resolve-"));
  try {
    const runtime = path.join(root, "runtime");
    mkdirSync(runtime);
    const registryPath = path.join(root, "registry.json");
    writeFileSync(registryPath, JSON.stringify({ schema_version: "router-control-registry.v1", targets: {} }));
    const authority: RunAuthority = {
      schema_version: "run-authority.v1",
      run_id: "run-resolve-fixture",
      created_at: "2026-08-10T00:00:00.000Z",
      target_id: "fal",
      target_identity: "FractalAgentLab",
      worktree_identity: "git:a",
      wave: "W",
      epic: "E",
      accountable_lane: "Track D",
      accountable_class: "TRACK",
      accountable_profile: "track-d",
      target_profile_identity: "profile-1",
      target_profile_sha256: "a".repeat(64),
      state_path: "ops/PROJECT_STATE.md",
      state_revision: "s1",
      state_sha256: "b".repeat(64),
      combined_path: "ops/Combined.md",
      combined_selector: "HEADING:Current",
      combined_span_sha256: "c".repeat(64),
      pinned_artifact_path: "plans/epic.md",
      pinned_artifact_identity: "plan-1",
      pinned_artifact_sha256: "d".repeat(64),
      overlay_identity: "overlay-1",
      accountable_role_identity: "role-1",
      configuration_identity: "config-1",
      active_route_generation: "UNDECLARED",
      review_cycle: "0",
      stage_source_manifest_path: "plans/stage-sources.json",
      stage_source_manifest_sha256: "e".repeat(64),
      next_command: "/terv-review",
    };
    const store = new StateStore(runtime);
    store.createRun(authority, authoritySha256(authority));
    const invocation = {
      schema_version: "stage-invocation.v1",
      operation_id: "op-resolve-fixture",
      run_id: authority.run_id,
      requested_stage: "PLAN_REVIEW",
      recipient_session_sha256: sha256("private-session"),
      semantic_key: sha256("resolve-fixture"),
    } as StageInvocation;
    const operation = store.createOperation(authority.run_id, invocation, { schema_version: "dispatch-intent.v1" }, sha256("intent"));
    store.updateOperation(authority.run_id, operation.operation_id, operation.revision, { status: "DISPATCHING" });

    const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/cli.js");
    writeFileSync(registryPath, "{ malformed registry");
    const env = { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath };
    const withoutRegistry: NodeJS.ProcessEnv = { ...env };
    delete withoutRegistry.OC_ROUTER_CONTROL_REGISTRY;
    const projected = spawnSync(process.execPath, [cli, "get-run", "--run-id", authority.run_id], { encoding: "utf8", env: withoutRegistry });
    assert.equal(projected.status, 0, projected.stderr);
    assert.equal((JSON.parse(projected.stdout) as { review_cycle: string }).review_cycle, "0");
    const resolved = spawnSync(process.execPath, [cli, "resolve-stage", "--run-id", authority.run_id, "--operation-id", operation.operation_id], { encoding: "utf8", env });
    assert.equal(resolved.status, 0, resolved.stderr);
    const cliResult = JSON.parse(resolved.stdout) as { operation_status: string; transport_status: string; output_status: string };
    assert.equal(cliResult.operation_status, "UNCERTAIN");
    assert.equal(cliResult.transport_status, "NO_SEND");
    assert.equal(cliResult.output_status, "AMBIGUOUS");

    if (process.platform === "win32") {
      const launcher = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../scripts/Invoke-OCRouter.ps1");
      const launched = spawnSync("powershell.exe", [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcher, "-Operation", "resolve-stage", "-RunId", authority.run_id, "-OperationId", operation.operation_id,
      ], { encoding: "utf8", env: withoutRegistry });
      assert.notEqual(launched.status, 0);
      assert.match(launched.stderr, /Fixed router root is missing|Ambient LOCALAPPDATA differs|"error_code":"STATE_STORE_BLOCKED"/);
      assert.equal(store.loadOperation(authority.run_id, operation.operation_id).status, "UNCERTAIN");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-012/017: real resolver reloads protected manifest and stage sources", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-source-manifest-"));
  const previousUsername = process.env.OPENCODE_SERVER_USERNAME;
  const previousPassword = process.env.OPENCODE_SERVER_PASSWORD;
  try {
    const target = path.join(root, "target");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "evidence"), { recursive: true });
    const implementationPath = "evidence/implementation.md";
    const acceptancePath = "evidence/acceptance.md";
    const implementation = "IMPLEMENTATION RESULT\nfixture\n";
    const acceptance = "ACCEPTANCE EVIDENCE\nfixture\n";
    writeFileSync(path.join(target, implementationPath), implementation);
    writeFileSync(path.join(target, acceptancePath), acceptance);
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## 3. Current\n| E | OPEN |\n");
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    writeFileSync(path.join(target, "evidence", "pinned.md"), "pinned\n");
    const sources = [
      { path: implementationPath, source_class: "IMPLEMENTATION_RESULT", logical_identity: "candidate-1", producer: "target-state", sha256: sha256(implementation), order: 0 },
      { path: acceptancePath, source_class: "ACCEPTANCE_EVIDENCE", logical_identity: "acceptance-1", producer: "target-state", sha256: sha256(acceptance), order: 1 },
    ];
    const manifestPath = path.join(target, "evidence", "stage-sources.json");
    const manifest = (entries = sources) => JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "STEP_REVIEW", plan_class: "EPIC_PLAN", sources: entries }] });
    const state = (manifestSha: string, includeManifest = true) => [
      "State revision: `s1`", "Configuration identity: `c1`", "Wave: `W`", "Epic: `E`", "Candidate identity: `candidate-1`", "Review cycle: `0`",
      "Combined selector: `HEADING:3. Current`", "Pinned artifact: `evidence/pinned.md`", "Pinned artifact logical identity: `plan-1`",
      ...(includeManifest ? ["Stage source manifest: `evidence/stage-sources.json`", `Stage source manifest SHA-256: \`${manifestSha}\``] : []),
      "Workflow phase: `STEP_REVIEW`", "Next actor: `Meta`", "Next command: `/step-review`", "",
    ].join("\n");
    const validManifest = manifest();
    writeFileSync(manifestPath, validManifest);
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), state(sha256(validManifest)));
    const registryPath = path.join(root, "registry.json");
    writeFileSync(registryPath, JSON.stringify({ schema_version: "router-control-registry.v1", targets: { fal: {
      profile_identity: "profile-1", target_identity: "fal", worktree_identity: "git:a", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target,
      state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md",
      server: { origin: "http://127.0.0.1:1", fingerprint: "fingerprint" }, sessions: { Meta: { id: "private-session" } },
    } } }));
    process.env.OPENCODE_SERVER_USERNAME = "fixture-user";
    process.env.OPENCODE_SERVER_PASSWORD = "fixture-password";
    const resolver = new _test.FileAuthorityResolver(registryPath);
    const authority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-manifest-1", createdAt: "2026-08-10T00:00:00.000Z" });
    const stage: StageRequest = {
      schema_version: "stage-request.v1", request_id: "request-manifest-1", run_id: authority.run_id, issued_at: authority.created_at, issued_by: "orchestrator", run_authority_sha256: authoritySha256(authority),
      requested_stage: "STEP_REVIEW", plan_class: "EPIC_PLAN", target_id: authority.target_id, worktree_identity: authority.worktree_identity, state_revision: authority.state_revision,
      state_sha256: authority.state_sha256, combined_selector: authority.combined_selector, combined_span_sha256: authority.combined_span_sha256, expected_sources: sources as StageRequest["expected_sources"],
      wave: authority.wave, epic: authority.epic, accountable_lane: authority.accountable_lane, accountable_class: authority.accountable_class, accountable_profile: authority.accountable_profile,
      sender_role: "Track D", recipient_role: "Meta", plan_identity: "plan-1", candidate_identity: "candidate-1", review_cycle: "0", finding_ids: [], review_risk: "high_risk",
      project_review_context: "fixture", expected_contract_version: "awc-3.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND", configuration_identity: authority.configuration_identity,
      active_route_generation: authority.active_route_generation,
    };
    const resolved = await resolver.resolveStageAuthority(authority, stage);
    assert.equal(resolved.sources.length, 2);
    assert.equal(resolved.capability.mode, "FIXTURE_ONLY");

    writeFileSync(path.join(target, implementationPath), `${implementation}drift\n`);
    await assert.rejects(() => resolver.resolveStageAuthority(authority, stage), /hash mismatch/);
    writeFileSync(path.join(target, implementationPath), implementation);

    const reordered = manifest([{ ...sources[1]!, order: 0 }, { ...sources[0]!, order: 1 }]);
    writeFileSync(manifestPath, reordered);
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), state(sha256(reordered)));
    const reorderedAuthority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-manifest-2", createdAt: "2026-08-10T00:00:01.000Z" });
    await assert.rejects(() => resolver.resolveStageAuthority(reorderedAuthority, { ...stage, run_id: reorderedAuthority.run_id, run_authority_sha256: authoritySha256(reorderedAuthority), state_sha256: reorderedAuthority.state_sha256, expected_sources: [{ ...sources[1]!, order: 0 }, { ...sources[0]!, order: 1 }] as StageRequest["expected_sources"] }), /source classes/);

    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), state(sha256(reordered), false));
    await assert.rejects(() => resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-manifest-3", createdAt: "2026-08-10T00:00:02.000Z" }), /Stage source manifest/);
  } finally {
    if (previousUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME; else process.env.OPENCODE_SERVER_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = previousPassword;
    rmSync(root, { recursive: true, force: true });
  }
});

test("operational registry refresh preserves an immutable run and its promoted next-stage source", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-operational-refresh-"));
  const previousUsername = process.env.OPENCODE_SERVER_USERNAME;
  const previousPassword = process.env.OPENCODE_SERVER_PASSWORD;
  try {
    const target = path.join(root, "target");
    const runtime = path.join(root, "runtime");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "plans"), { recursive: true });
    mkdirSync(runtime);
    const planning = "PLANNING CONTEXT\nfixture\n";
    const planningBinding = { path: "plans/context.md", source_class: "PLANNING_CONTEXT", logical_identity: "context-1", producer: "target-state", sha256: sha256(planning), order: 0 };
    const manifest = JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "ringfall", epic: "A4-E", candidate_identity: "UNDECLARED", entries: [{ stage: "SEQ_NEXT", plan_class: "EPIC_PLAN", sources: [planningBinding] }] });
    writeFileSync(path.join(target, "plans", "context.md"), planning);
    writeFileSync(path.join(target, "plans", "stage-sources.json"), manifest);
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## Current\n| A4-E | OPEN |\n");
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), [
      "State revision: `s1`", "Configuration identity: `c1`", "Wave: `A4`", "Epic: `A4-E`", "Candidate identity: `UNDECLARED`", "Review cycle: `0`",
      "Combined selector: `HEADING:Current`", "Pinned artifact: `plans/context.md`", "Pinned artifact logical identity: `context-1`",
      "Stage source manifest: `plans/stage-sources.json`", `Stage source manifest SHA-256: \`${sha256(manifest)}\``, "Workflow phase: `SEQ_NEXT`", "Next actor: `Track D`", "Next command: `/seq-next`", "",
    ].join("\n"));
    const registryPath = path.join(root, "registry.json");
    const registry = { schema_version: "router-control-registry.v1", targets: { ringfall: {
      profile_identity: "ringfall-profile", target_identity: "RingFall", worktree_identity: "git:ringfall", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target,
      state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md",
      server: { origin: "http://127.0.0.1:1", fingerprint: "fixture-before" }, sessions: { Meta: { id: "private-meta-session" }, "Track D": { id: "private-track-session" } },
    } } };
    writeFileSync(registryPath, JSON.stringify(registry));
    process.env.OPENCODE_SERVER_USERNAME = "fixture-user";
    process.env.OPENCODE_SERVER_PASSWORD = "fixture-password";
    const store = new StateStore(runtime);
    const resolver = new _test.FileAuthorityResolver(registryPath, undefined, undefined, undefined, undefined, store);
    const authority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "ringfall", expected_worktree_identity: "git:ringfall" }, { runId: "run-refresh-1", createdAt: "2026-08-26T00:00:00.000Z" });
    store.createRun(authority, authoritySha256(authority));
    const invocation = { schema_version: "stage-invocation.v1", operation_id: "op-seq-next", run_id: authority.run_id, requested_stage: "SEQ_NEXT" } as StageInvocation;
    const operation = store.createOperation(authority.run_id, invocation, { schema_version: "dispatch-intent.v1" }, sha256("intent"));
    const terminal = [
      "EPIC IMPLEMENTATION PLAN", "Target: RingFall", "Epic: A4-E", "Wave: A4", "Accountable Lane / class / profile: Track D / TRACK / track-d",
      "Prerequisites/current state: ready", "Scope/non-goals: bounded", "Interfaces/ownership: Track D", "Feature -> User Story -> Task: F -> US -> T",
      "Risks: none", "Ordered implementation plan: T", "Acceptance -> verification -> evidence: AC -> test", "Handoffs/exact blockers: none",
      "Plan artifact: ringfall-a4-e-plan", "Next route: /terv-review", "Readiness: READY", "",
    ].join("\n");
    store.writeArtifact(authority.run_id, operation.operation_id, "terminal", terminal);
    store.writeResult(authority.run_id, operation.operation_id, { operation_status: "SUCCEEDED", output_status: "VALID", binding_status: "BOUND", terminal_status: "VALID", artifact_sha256: sha256(Buffer.from(terminal, "utf8")), allowed_next: ["PLAN_REVIEW"] });
    store.updateOperation(authority.run_id, operation.operation_id, operation.revision, { status: "SUCCEEDED" });
    const promoted = promotedSourcesForStage(store, authority.run_id, "PLAN_REVIEW");
    const stage: StageRequest = {
      schema_version: "stage-request.v1", request_id: "request-plan-review", run_id: authority.run_id, issued_at: authority.created_at, issued_by: "orchestrator", run_authority_sha256: authoritySha256(authority),
      requested_stage: "PLAN_REVIEW", plan_class: "EPIC_PLAN", target_id: authority.target_id, worktree_identity: authority.worktree_identity, state_revision: authority.state_revision,
      state_sha256: authority.state_sha256, combined_selector: authority.combined_selector, combined_span_sha256: authority.combined_span_sha256, expected_sources: promoted.map((source) => source.binding),
      wave: authority.wave, epic: authority.epic, accountable_lane: authority.accountable_lane, accountable_class: authority.accountable_class, accountable_profile: authority.accountable_profile,
      sender_role: "Track D", recipient_role: "Meta", plan_identity: "ringfall-a4-e-plan", candidate_identity: "UNDECLARED", review_cycle: "0", finding_ids: [], review_risk: "focused",
      project_review_context: "fixture", expected_contract_version: "awc-4.1.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND", configuration_identity: authority.configuration_identity,
      active_route_generation: authority.active_route_generation,
    };

    registry.targets.ringfall.server.fingerprint = "fixture-after";
    writeFileSync(registryPath, JSON.stringify(registry));
    const refreshed = await resolver.resolveStageAuthority(authority, stage);
    assert.equal(authoritySha256(refreshed.run_authority), authoritySha256(authority));
    assert.equal(refreshed.sources[0]!.binding.producer, "FAL_ROUTER_OUTPUT");
    const current = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "ringfall", expected_worktree_identity: "git:ringfall" }, { runId: authority.run_id, createdAt: authority.created_at });
    assert.notEqual(current.target_profile_sha256, authority.target_profile_sha256);
    assert.equal(runAuthorityMatchesAcrossOperationalRefresh(current, authority), true);

    registry.targets.ringfall.profile_identity = "ringfall-profile-drift";
    writeFileSync(registryPath, JSON.stringify(registry));
    await assert.rejects(() => resolver.resolveStageAuthority(authority, stage), /semantic authority drifted/);
  } finally {
    if (previousUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME; else process.env.OPENCODE_SERVER_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = previousPassword;
    rmSync(root, { recursive: true, force: true });
  }
});

test("production resolver creates a protected follow-on run from FIX_PLAN_REQUIRED without target-state mutation", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-real-follow-on-"));
  const previousUsername = process.env.OPENCODE_SERVER_USERNAME;
  const previousPassword = process.env.OPENCODE_SERVER_PASSWORD;
  try {
    const target = path.join(root, "target");
    const runtime = path.join(root, "runtime");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "evidence"), { recursive: true });
    mkdirSync(runtime);
    const pinned = "fixture\n";
    const synthesis = "FINAL STEP REVIEW SYNTHESIS\nfixture\n";
    const manifest = JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "DELIVERY_RESPONSE", plan_class: "EPIC_PLAN", sources: [{ path: "evidence/synthesis.md", source_class: "FINAL_SYNTHESIS", logical_identity: "synthesis-1", producer: "target-state", sha256: sha256(synthesis), order: 0 }] }] });
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), [
      "State revision: `s1`", "Configuration identity: `c1`", "Wave: `W`", "Epic: `E`", "Combined selector: `HEADING:Current`",
      "Pinned artifact: `evidence/pinned.md`", "Pinned artifact logical identity: `pinned-1`", "Candidate identity: `candidate-1`", "Review cycle: `0`",
      "Stage source manifest: `evidence/stage-sources.json`", `Stage source manifest SHA-256: \`${sha256(manifest)}\``, "Workflow phase: `REVIEW_RESPONSE`", "Next actor: `Track D`", "Next command: `/step-review-utan`", "",
    ].join("\n"));
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## Current\n| E | OPEN |\n");
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    writeFileSync(path.join(target, "evidence", "pinned.md"), pinned);
    writeFileSync(path.join(target, "evidence", "synthesis.md"), synthesis);
    writeFileSync(path.join(target, "evidence", "stage-sources.json"), manifest);
    const registryPath = path.join(root, "registry.json");
    writeFileSync(registryPath, JSON.stringify({ schema_version: "router-control-registry.v1", targets: { fal: {
      profile_identity: "profile-1", target_identity: "fal", worktree_identity: "git:a", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target,
      state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md", require_active_route: false,
      server: { origin: "http://127.0.0.1:1", fingerprint: "fixture" }, sessions: { Meta: { id: "private-meta" }, "Track D": { id: "private-track" } },
    } } }));
    const store = new StateStore(runtime);
    const resolver = new _test.FileAuthorityResolver(registryPath, undefined, undefined, undefined, "FIXTURE_ONLY", store);
    const authority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-predecessor", createdAt: "2026-08-28T00:00:00.000Z" });
    store.createRun(authority, authoritySha256(authority));
    const invocation = { schema_version: "stage-invocation.v1", operation_id: "op-delivery", run_id: authority.run_id, requested_stage: "DELIVERY_RESPONSE", candidate_identity: "candidate-1", finding_ids: ["FSR-002"] } as StageInvocation;
    const operation = store.createOperation(authority.run_id, invocation, { schema_version: "dispatch-intent.v1" }, sha256("intent"));
    const fixPlan = [
      "FIX_PLAN_REQUIRED", "Target: fal", "Epic: E", "Candidate: candidate-1", "Accountable Lane / class / profile: Track D / TRACK / track-d",
      'Accepted finding IDs: ["FSR-002"]', "Allowed surfaces: runtime", "Forbidden surfaces: protected", "Finding -> change -> acceptance/check: FSR-002 -> fix -> test",
      "Dependencies: none", "Fix-plan artifact: fix-plan-1", "FIX_PLAN_READY_FOR_IMPLEMENT", "",
    ].join("\n");
    store.writeArtifact(authority.run_id, operation.operation_id, "terminal", fixPlan);
    store.updateResult(authority.run_id, operation.operation_id, { allowed_next: [], reason: "FOLLOW_ON_REVIEW_CYCLE_RUN_REQUIRED" });
    store.updateOperation(authority.run_id, operation.operation_id, operation.revision, { status: "SUCCEEDED" });
    const engine = new StageEngine(store, resolver);
    const followOnRequest = { schema_version: "follow-on-run-request.v1" as const, predecessor_run_id: authority.run_id, delivery_operation_id: operation.operation_id };
    const followOn = await engine.newFollowOnRun(followOnRequest);
    assert.equal(followOn.review_cycle, "1");
    assert.equal(followOn.next_stage_sources[0]?.expected_sources[0]?.logical_identity, "fix-plan-1");
    const nextAuthority = store.loadRun(followOn.run_id).authority;
    assert.equal(nextAuthority.next_command, "/terv-review");
    const followOnRequestPath = path.join(root, "follow-on-request.json");
    writeFileSync(followOnRequestPath, JSON.stringify(followOnRequest));
    const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/cli.js");
    const cliResult = spawnSync(process.execPath, [cli, "new-follow-on-run", "--request", followOnRequestPath], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath } });
    assert.equal(cliResult.status, 0, cliResult.stderr);
    const repeated = JSON.parse(cliResult.stdout) as { run_id: string; created: boolean; review_cycle: string };
    assert.equal(repeated.run_id, followOn.run_id);
    assert.equal(repeated.created, false);
    assert.equal(repeated.review_cycle, "1");
    const request: StageRequest = {
      schema_version: "stage-request.v1", request_id: "request-follow-on-review", run_id: followOn.run_id, issued_at: "2026-08-28T00:00:01.000Z", issued_by: "orchestrator", run_authority_sha256: followOn.run_authority_sha256,
      requested_stage: "PLAN_REVIEW", plan_class: "REVIEW_FIX_PLAN", target_id: "fal", worktree_identity: "git:a", state_revision: nextAuthority.state_revision, state_sha256: nextAuthority.state_sha256,
      combined_selector: nextAuthority.combined_selector, combined_span_sha256: nextAuthority.combined_span_sha256, expected_sources: followOn.next_stage_sources[0]!.expected_sources,
      wave: "W", epic: "E", accountable_lane: "Track D", accountable_class: "TRACK", accountable_profile: "track-d", sender_role: "Track D", recipient_role: "Meta",
      plan_identity: "fix-plan-1", candidate_identity: "candidate-1", review_cycle: "1", finding_ids: ["FSR-002"], review_risk: "normal", project_review_context: "fixture",
      expected_contract_version: "awc-4.1.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND", configuration_identity: nextAuthority.configuration_identity, active_route_generation: nextAuthority.active_route_generation,
    };
    process.env.OPENCODE_SERVER_USERNAME = "fixture";
    process.env.OPENCODE_SERVER_PASSWORD = "fixture";
    const resolved = await resolver.resolveStageAuthority(nextAuthority, request);
    assert.equal(resolved.sources.length, 1);
    assert.equal(resolved.sources[0]?.binding.source_class, "PLAN");
    assert.equal(resolved.sources[0]?.content, fixPlan);
    assert.equal(readFileSync(path.join(target, "ops", "PROJECT_STATE.md"), "utf8").includes("Review cycle: `0`"), true);
  } finally {
    if (previousUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME; else process.env.OPENCODE_SERVER_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = previousPassword;
    rmSync(root, { recursive: true, force: true });
  }
});

test("v29 real resolver revalidates one carried target PLAN binding in a follow-on review cycle", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-v29-real-carry-"));
  const previousUsername = process.env.OPENCODE_SERVER_USERNAME;
  const previousPassword = process.env.OPENCODE_SERVER_PASSWORD;
  try {
    const target = path.join(root, "target");
    const runtime = path.join(root, "runtime");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "plans"), { recursive: true });
    mkdirSync(runtime);
    const plan = [
      "FIX_PLAN_REQUIRED", "Target: fal", "Epic: E", "Candidate: candidate-1", "Accountable Lane / class / profile: Track D / TRACK / track-d",
      'Accepted finding IDs: ["FSR-002"]', "Allowed surfaces: runtime", "Forbidden surfaces: protected",
      "Finding -> change -> acceptance/check: FSR-002 -> repair -> focused test", "Dependencies: none", "Fix-plan artifact: fix-plan-1",
      "FIX_PLAN_READY_FOR_IMPLEMENT", "",
    ].join("\n");
    const planBinding = { path: "plans/fix-plan.md", source_class: "PLAN", logical_identity: "fix-plan-1", producer: "target-state", sha256: sha256(plan), order: 0 } as const;
    const manifest = JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "PLAN_REVIEW", plan_class: "REVIEW_FIX_PLAN", sources: [planBinding] }] });
    writeFileSync(path.join(target, "plans", "fix-plan.md"), plan);
    writeFileSync(path.join(target, "plans", "stage-sources.json"), manifest);
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## Current\n| E | FIX_REVIEW |\n");
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), [
      "State revision: `s1`", "Configuration identity: `c1`", "Wave: `W`", "Epic: `E`", "Candidate identity: `candidate-1`", "Review cycle: `1`",
      "Combined selector: `HEADING:Current`", "Pinned artifact: `plans/fix-plan.md`", "Pinned artifact logical identity: `fix-plan-1`",
      "Stage source manifest: `plans/stage-sources.json`", `Stage source manifest SHA-256: \`${sha256(manifest)}\``, "Workflow phase: `PLAN_REVIEW`", "Next actor: `Meta`", "Next command: `/terv-review`", "",
    ].join("\n"));
    const registryPath = path.join(root, "registry.json");
    writeFileSync(registryPath, JSON.stringify({ schema_version: "router-control-registry.v1", targets: { fal: {
      profile_identity: "profile-v29", target_identity: "fal", worktree_identity: "git:a", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target,
      state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md",
      server: { origin: "http://127.0.0.1:1", fingerprint: "fixture" }, sessions: { Meta: { id: "session-meta" }, "Track D": { id: "session-track" } },
    } } }));
    process.env.OPENCODE_SERVER_USERNAME = "fixture-user";
    process.env.OPENCODE_SERVER_PASSWORD = "fixture-password";
    const store = new StateStore(runtime);
    const resolver = new _test.FileAuthorityResolver(registryPath, undefined, undefined, undefined, undefined, store);
    const authority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-v29-real-carry", createdAt: "2026-08-28T00:00:00.000Z" });
    store.createRun(authority, authoritySha256(authority));
    const reviewRequest: StageRequest = {
      schema_version: "stage-request.v1", request_id: "request-v29-real-review", run_id: authority.run_id, issued_at: authority.created_at, issued_by: "orchestrator", run_authority_sha256: authoritySha256(authority),
      requested_stage: "PLAN_REVIEW", plan_class: "REVIEW_FIX_PLAN", target_id: authority.target_id, worktree_identity: authority.worktree_identity, state_revision: authority.state_revision,
      state_sha256: authority.state_sha256, combined_selector: authority.combined_selector, combined_span_sha256: authority.combined_span_sha256, expected_sources: [planBinding],
      wave: authority.wave, epic: authority.epic, accountable_lane: authority.accountable_lane, accountable_class: authority.accountable_class, accountable_profile: authority.accountable_profile,
      sender_role: "Track D", recipient_role: "Meta", plan_identity: "fix-plan-1", candidate_identity: "candidate-1", review_cycle: "1", finding_ids: ["FSR-002"], review_risk: "focused",
      project_review_context: "fixture", expected_contract_version: "awc-4.1.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND", configuration_identity: authority.configuration_identity,
      active_route_generation: authority.active_route_generation,
    };
    const invocation = { ...reviewRequest, schema_version: "stage-invocation.v1", operation_id: "op-v29-real-review" } as unknown as StageInvocation;
    const operation = store.createOperation(authority.run_id, invocation, { schema_version: "dispatch-intent.v1" }, sha256("intent-v29-real-carry"));
    const metaReview = [
      "META PLAN REVIEW", "Target: fal", "Epic: E", "Plan class: REVIEW_FIX_PLAN", "Plan artifact: fix-plan-1",
      "Accountable Lane / class / profile: Track D / TRACK / track-d", "Overall verdict: GREEN", "Blocking corrections: none", "Non-blocking improvements: none",
      "Ownership/dependency decision: accepted", "Acceptance/evidence decision: accepted", "Exact Delivery Lane action: invoke /terv-review-utan with this review", "",
    ].join("\n");
    store.writeArtifact(authority.run_id, operation.operation_id, "terminal", metaReview);
    store.writeResult(authority.run_id, operation.operation_id, { operation_status: "SUCCEEDED", output_status: "VALID", binding_status: "BOUND", terminal_status: "VALID", artifact_sha256: sha256(Buffer.from(metaReview, "utf8")), allowed_next: ["PLAN_REVISION"] });
    store.updateOperation(authority.run_id, operation.operation_id, operation.revision, { status: "SUCCEEDED" });
    const promoted = promotedSourcesForStage(store, authority.run_id, "PLAN_REVISION");
    const revisionRequest: StageRequest = { ...reviewRequest, request_id: "request-v29-real-revision", requested_stage: "PLAN_REVISION", sender_role: "Meta", recipient_role: "Track D", expected_sources: [planBinding, ...promoted.map((source) => source.binding)] };
    const resolved = await resolver.resolveStageAuthority(authority, revisionRequest);
    assert.deepEqual(resolved.sources.map((source) => source.binding.source_class), ["PLAN", "META_PLAN_REVIEW"]);
    assert.equal(resolved.sources[0]!.content, plan);
    assert.equal(resolved.sources[1]!.content, metaReview);
  } finally {
    if (previousUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME; else process.env.OPENCODE_SERVER_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = previousPassword;
    rmSync(root, { recursive: true, force: true });
  }
});

test("v29 CLI installs closeout authority only in protected runtime and launcher exposes the no-send route", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-v29-cli-owner-install-"));
  try {
    const target = path.join(root, "target");
    const runtime = path.join(root, "runtime");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "plans"), { recursive: true });
    mkdirSync(path.join(target, "src"), { recursive: true });
    mkdirSync(runtime);
    const pinned = "PINNED\n";
    const manifest = JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "DELIVERY_RESPONSE", plan_class: "EPIC_PLAN", sources: [{ path: "plans/pinned.md", source_class: "FINAL_SYNTHESIS", logical_identity: "candidate-1", producer: "target-state", sha256: sha256(pinned), order: 0 }] }] });
    writeFileSync(path.join(target, "plans", "pinned.md"), pinned);
    writeFileSync(path.join(target, "plans", "stage-sources.json"), manifest);
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## Current\n| E | REVIEWED |\n");
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    writeFileSync(path.join(target, "src", "candidate.ts"), "export const value = 1;\n");
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), [
      "State revision: `s1`", "Configuration identity: `c1`", "Wave: `W`", "Epic: `E`", "Candidate identity: `candidate-1`", "Review cycle: `0`",
      "Combined selector: `HEADING:Current`", "Pinned artifact: `plans/pinned.md`", "Pinned artifact logical identity: `plan-1`",
      "Stage source manifest: `plans/stage-sources.json`", `Stage source manifest SHA-256: \`${sha256(manifest)}\``, "Workflow phase: `DELIVERY_RESPONSE`", "Next actor: `Track D`", "Next command: `/step-review-utan`", "",
    ].join("\n"));
    const registryPath = path.join(root, "registry.json");
    writeFileSync(registryPath, JSON.stringify({ schema_version: "router-control-registry.v1", targets: { fal: {
      profile_identity: "profile-v29", target_identity: "fal", worktree_identity: "git:a", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target,
      state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md",
      server: { origin: "http://127.0.0.1:1", fingerprint: "fixture" }, sessions: { Meta: { id: "session-meta" }, "Track D": { id: "session-track" } },
    } } }));
    const lookup = spawnSync(process.platform === "win32" ? "where.exe" : "which", ["git"], { encoding: "utf8", shell: false });
    assert.equal(lookup.status, 0, lookup.stderr);
    const gitPath = lookup.stdout.split(/\r?\n/).find(Boolean)!;
    const git = (...args: string[]) => {
      const result = spawnSync(gitPath, ["-C", target, ...args], { encoding: "utf8", shell: false });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    git("init");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "user.name", "Fixture");
    git("add", ".");
    git("commit", "-m", "fixture");
    writeFileSync(path.join(target, "src", "candidate.ts"), "export const value = 2;\n");
    const worktree = new GitWorktreeReader(gitPath, sha256(readFileSync(gitPath))).inspect(target);
    assert.deepEqual(worktree.changed_paths, ["src/candidate.ts"]);

    const store = new StateStore(runtime);
    const resolver = new _test.FileAuthorityResolver(registryPath, new GitWorktreeReader(gitPath, sha256(readFileSync(gitPath))), undefined, undefined, undefined, store);
    const authority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-v29-cli-install", createdAt: "2026-08-28T00:00:00.000Z" });
    store.createRun(authority, authoritySha256(authority));
    const invocation = (operationId: string, requestedStage: StageRequest["requested_stage"]): StageInvocation => ({
      schema_version: "stage-invocation.v1", operation_id: operationId, request_id: `request-${operationId}`, run_id: authority.run_id, issued_at: authority.created_at, issued_by: "orchestrator",
      run_authority_sha256: authoritySha256(authority), requested_stage: requestedStage, plan_class: "EPIC_PLAN", target_id: authority.target_id, worktree_identity: authority.worktree_identity,
      state_revision: authority.state_revision, state_sha256: authority.state_sha256, combined_selector: authority.combined_selector, combined_span_sha256: authority.combined_span_sha256,
      expected_sources: [], wave: authority.wave, epic: authority.epic, accountable_lane: authority.accountable_lane, accountable_class: authority.accountable_class, accountable_profile: authority.accountable_profile,
      sender_role: requestedStage === "DELIVERY_RESPONSE" ? "Meta" : "Track D", recipient_role: requestedStage === "STEP_REVIEW" ? "Meta" : "Track D", plan_identity: "plan-1", candidate_identity: "candidate-1",
      review_cycle: "0", finding_ids: [], review_risk: "focused", project_review_context: "fixture", expected_contract_version: "awc-4.1.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND",
      configuration_identity: authority.configuration_identity, active_route_generation: authority.active_route_generation, canon_phase: requestedStage === "IMPLEMENT" ? "IMPLEMENT" : requestedStage === "STEP_REVIEW" ? "STEP_REVIEW" : "REVIEW_RESPONSE",
      command_name: requestedStage === "IMPLEMENT" ? "implement" : requestedStage === "STEP_REVIEW" ? "step-review" : "step-review-utan", command_argument_sha256: sha256(operationId), command_body_sha256: sha256(`${operationId}-body`), semantic_key: sha256(`${operationId}-semantic`), recipient_session_sha256: sha256("fixture-session"),
    });
    const persistSuccess = (stageInvocation: StageInvocation, terminal: string, extraResult: Record<string, unknown> = {}) => {
      const operation = store.createOperation(authority.run_id, stageInvocation, { schema_version: "dispatch-intent.v1" }, sha256(`${stageInvocation.operation_id}-intent`));
      store.writeArtifact(authority.run_id, operation.operation_id, "terminal", terminal);
      store.writeResult(authority.run_id, operation.operation_id, { schema_version: "stage-result.v1", run_id: authority.run_id, operation_id: operation.operation_id, operation_status: "SUCCEEDED", transport_status: "RESPONSE_ACCEPTED", output_status: "VALID", binding_status: "BOUND", terminal_status: "VALID", allowed_next: [], artifact_sha256: sha256(Buffer.from(terminal, "utf8")), message_id_sha256: sha256(operation.operation_id), response_sha256: sha256(`${operation.operation_id}-response`), reason: "fixture", auto_advance: false, ...extraResult });
      store.updateOperation(authority.run_id, operation.operation_id, operation.revision, { status: "SUCCEEDED" });
      return operation;
    };
    const implementation = [
      "IMPLEMENTATION RESULT", "Target: fal", "Epic: E", "Accountable Lane / class / profile: Track D / TRACK / track-d", "Plan/fix-plan identity: plan-1",
      "Changed artifacts: src/candidate.ts", "Explicit non-changes: governance", "Acceptance mapping: PASS", "Checks/results: PASS", "Candidate identity/worktree limitations: candidate-1; none",
      "Diff self-review: PASS", "Unresolved risks/findings: none", "Exact route: Meta /step-review", "REVIEW_READY",
    ].join("\n");
    const implementationInvocation = invocation("op-v29-cli-implement", "IMPLEMENT");
    const scopeContent = `${JSON.stringify({ schema_version: "frozen-candidate-scope.v1", implementation_operation_id: implementationInvocation.operation_id, candidate_identity: "candidate-1", worktree_identity: "git:a", candidate_paths: ["src/candidate.ts"], worktree_proof_sha256: worktreeProofSha256(worktree) })}\n`;
    const implementationOperation = persistSuccess(implementationInvocation, implementation, { candidate_scope_sha256: sha256(Buffer.from(scopeContent, "utf8")) });
    store.writeArtifact(authority.run_id, implementationOperation.operation_id, "candidate-scope", scopeContent);
    const synthesis = [
      "FINAL STEP REVIEW SYNTHESIS", "Target: fal", "Epic: E", "Candidate: candidate-1", "Accountable Lane / class / profile: Track D / TRACK / track-d", "Reviewed scope: src/candidate.ts",
      "Overall verdict: GREEN", "Review routing: fixture", "Acceptance/evidence matrix: PASS", "Accepted findings: NONE", "Rejected/downgraded findings: NONE", "Verification result: PASS",
      "Proposed closeout delta: NONE", "Closeout disposition: ALLOWED", "Commit status: DEFERRED_TO_CLOSEOUT", "Exact Delivery Lane action: invoke /step-review-utan with this exact synthesis",
    ].join("\n");
    persistSuccess(invocation("op-v29-cli-review", "STEP_REVIEW"), synthesis);
    const deliveryOperation = persistSuccess(invocation("op-v29-cli-delivery", "DELIVERY_RESPONSE"), "ACK_ONLY\n");
    const requestPath = path.join(root, "install.json");
    writeFileSync(requestPath, JSON.stringify({ schema_version: "closeout-authority-install.v1", run_id: authority.run_id, delivery_operation_id: deliveryOperation.operation_id, closeout_authority: {
      schema_version: "closeout-authority-intent.v1", candidate_identity: "candidate-1", candidate_paths: ["src/candidate.ts"], worktree_identity: "git:a", allowed_paths: ["src/candidate.ts"], commit_scope: { mode: "COMMIT", paths: ["src/candidate.ts"] }, staging_precondition: "EMPTY", global_apply: false, restart: false,
    } }));
    const beforeStatus = git("status", "--porcelain=v1");
    const beforeState = readFileSync(path.join(target, "ops", "PROJECT_STATE.md"));
    const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/cli.js");
    const installed = spawnSync(process.execPath, [cli, "install-closeout-authority", "--request", requestPath], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath } });
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal((JSON.parse(installed.stdout) as { status: string; auto_advance: boolean }).status, "INSTALLED");
    assert.equal((JSON.parse(installed.stdout) as { auto_advance: boolean }).auto_advance, false);
    assert.equal(store.listOperations(authority.run_id).length, 3);
    assert.equal(git("status", "--porcelain=v1"), beforeStatus);
    assert.deepEqual(readFileSync(path.join(target, "ops", "PROJECT_STATE.md")), beforeState);
    assert.equal(existsSync(store.resolve("runs", authority.run_id, "owner-sources", "closeout-authority.json")), true);
    const launcher = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../scripts/Invoke-OCRouter.ps1"), "utf8");
    assert.match(launcher, /ValidateSet\('new-run','new-follow-on-run','invoke-stage','install-closeout-authority'/);
    assert.match(launcher, /install-closeout-authority'.*RequestPath/s);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-031: real registry contributes selected and unselected session privacy values", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-registry-privacy-"));
  const previousUsername = process.env.OPENCODE_SERVER_USERNAME;
  const previousPassword = process.env.OPENCODE_SERVER_PASSWORD;
  try {
    const target = path.join(root, "target");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "plans"), { recursive: true });
    const plan = "EPIC IMPLEMENTATION PLAN\nReadiness: READY\n";
    const sources = [{ path: "plans/epic.md", source_class: "PLAN", logical_identity: "plan-1", producer: "target-state", sha256: sha256(plan), order: 0 }];
    const manifest = JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "PLAN_REVIEW", plan_class: "EPIC_PLAN", sources }] });
    writeFileSync(path.join(target, "plans", "epic.md"), plan);
    writeFileSync(path.join(target, "plans", "stage-sources.json"), manifest);
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## Current\n| E | OPEN |\n");
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), ["State revision: `s1`", "Configuration identity: `c1`", "Wave: `W`", "Epic: `E`", "Candidate identity: `candidate-1`", "Review cycle: `0`", "Combined selector: `HEADING:Current`", "Pinned artifact: `plans/epic.md`", "Pinned artifact logical identity: `plan-1`", "Stage source manifest: `plans/stage-sources.json`", `Stage source manifest SHA-256: \`${sha256(manifest)}\``, "Workflow phase: `PLAN_REVIEW`", "Next actor: `Meta`", "Next command: `/terv-review`", ""].join("\n"));
    const registryPath = path.join(root, "registry.json");
    const unselected = "session-unselected-private";
    writeFileSync(registryPath, JSON.stringify({ schema_version: "router-control-registry.v1", targets: { fal: { profile_identity: "profile-1", target_identity: "fal", worktree_identity: "git:a", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target, state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md", server: { origin: "http://127.0.0.1:1", fingerprint: "fingerprint" }, sessions: { Meta: { id: "session-selected-private" }, "Track D": { id: unselected } } } } }));
    process.env.OPENCODE_SERVER_USERNAME = "fixture-user";
    process.env.OPENCODE_SERVER_PASSWORD = "fixture-password";
    const resolver = new _test.FileAuthorityResolver(registryPath);
    const authority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-registry-private", createdAt: "2026-08-12T00:00:00.000Z" });
    const request: StageRequest = { schema_version: "stage-request.v1", request_id: "request-registry-private", run_id: authority.run_id, issued_at: authority.created_at, issued_by: "orchestrator", run_authority_sha256: authoritySha256(authority), requested_stage: "PLAN_REVIEW", plan_class: "EPIC_PLAN", target_id: authority.target_id, worktree_identity: authority.worktree_identity, state_revision: authority.state_revision, state_sha256: authority.state_sha256, combined_selector: authority.combined_selector, combined_span_sha256: authority.combined_span_sha256, expected_sources: sources as StageRequest["expected_sources"], wave: authority.wave, epic: authority.epic, accountable_lane: authority.accountable_lane, accountable_class: authority.accountable_class, accountable_profile: authority.accountable_profile, sender_role: "Track D", recipient_role: "Meta", plan_identity: "plan-1", candidate_identity: "candidate-1", review_cycle: "0", finding_ids: [], review_risk: "normal", project_review_context: "fixture", expected_contract_version: "awc-3.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND", configuration_identity: authority.configuration_identity, active_route_generation: authority.active_route_generation };
    const resolved = await resolver.resolveStageAuthority(authority, request);
    assert.ok(resolved.privacy.private_values?.includes(unselected));
    for (const variant of [unselected, encodeURI(unselected), encodeURIComponent(unselected), Buffer.from(unselected).toString("base64")]) assert.throws(() => _test.assertArtifactPrivate(JSON.stringify({ value: variant }), resolved.privacy.private_values!), /private registry sentinel/);
  } finally {
    if (previousUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME; else process.env.OPENCODE_SERVER_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = previousPassword;
    rmSync(root, { recursive: true, force: true });
  }
});

test("FSR-025: production-bound CLOSEOUT resolver derives authority from a protected real Git reader", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-router-closeout-real-git-"));
  const previousUsername = process.env.OPENCODE_SERVER_USERNAME;
  const previousPassword = process.env.OPENCODE_SERVER_PASSWORD;
  try {
    const target = path.join(root, "target");
    mkdirSync(path.join(target, "ops"), { recursive: true });
    mkdirSync(path.join(target, "evidence"), { recursive: true });
    for (const name of ["synthesis.md", "delivery.md", "delta.txt", "closeout.json", "pinned.md"]) writeFileSync(path.join(target, "evidence", name), `${name}\n`);
    writeFileSync(path.join(target, "ops", "Combined.md"), "# Root\n\n## 3. Current\n| E | OPEN |\n");
    writeFileSync(path.join(target, "ops", "OVERLAY.md"), "overlay\n");
    writeFileSync(path.join(target, "ops", "ROLE.md"), "role\n");
    const sourceSpecs = [
      ["evidence/synthesis.md", "FINAL_SYNTHESIS"], ["evidence/delivery.md", "DELIVERY_RESPONSE"],
      ["evidence/delta.txt", "PROPOSED_DELTA"], ["evidence/closeout.json", "CLOSEOUT_AUTHORITY"],
    ] as const;
    const sources = sourceSpecs.map(([sourcePath, sourceClass], order) => ({ path: sourcePath, source_class: sourceClass, logical_identity: `closeout-${order}`, producer: "target-state", sha256: sha256(readFileSync(path.join(target, sourcePath))), order }));
    const manifest = JSON.stringify({ schema_version: "stage-source-manifest.v1", target_id: "fal", epic: "E", candidate_identity: "candidate-1", entries: [{ stage: "CLOSEOUT", plan_class: "EPIC_PLAN", sources }] });
    writeFileSync(path.join(target, "evidence", "stage-sources.json"), manifest);
    writeFileSync(path.join(target, "ops", "PROJECT_STATE.md"), [
      "State revision: `s1`", "Configuration identity: `c1`", "Wave: `W`", "Epic: `E`", "Candidate identity: `candidate-1`", "Review cycle: `0`",
      "Combined selector: `HEADING:3. Current`", "Pinned artifact: `evidence/pinned.md`", "Pinned artifact logical identity: `plan-1`",
      "Stage source manifest: `evidence/stage-sources.json`", `Stage source manifest SHA-256: \`${sha256(manifest)}\``, "Workflow phase: `CLOSEOUT`", "Next actor: `Meta`", "Next command: `/closeout-commit`", "",
    ].join("\n"));
    const registryPath = path.join(root, "registry.json");
    writeFileSync(registryPath, JSON.stringify({ schema_version: "router-control-registry.v1", targets: { fal: {
      profile_identity: "profile-1", target_identity: "fal", worktree_identity: "git:a", accountable: { lane: "Track D", class: "TRACK", profile: "track-d" }, root: target,
      state_path: "ops/PROJECT_STATE.md", combined_path: "ops/Combined.md", overlay_path: "ops/OVERLAY.md", accountable_role_path: "ops/ROLE.md",
      server: { origin: "http://127.0.0.1:1", fingerprint: "fingerprint" }, sessions: { Meta: { id: "private-session" } },
    } } }));
    const lookup = spawnSync(process.platform === "win32" ? "where.exe" : "which", ["git"], { encoding: "utf8", shell: false });
    assert.equal(lookup.status, 0, lookup.stderr);
    const gitPath = lookup.stdout.split(/\r?\n/).find(Boolean)!;
    const git = (...args: string[]) => {
      const result = spawnSync(gitPath, ["-C", target, ...args], { encoding: "utf8", shell: false });
      assert.equal(result.status, 0, result.stderr);
    };
    git("init");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "user.name", "Fixture");
    git("add", ".");
    git("commit", "-m", "fixture");
    process.env.OPENCODE_SERVER_USERNAME = "fixture-user";
    process.env.OPENCODE_SERVER_PASSWORD = "fixture-password";
    const resolver = new _test.FileAuthorityResolver(registryPath, new GitWorktreeReader(gitPath, sha256(readFileSync(gitPath))));
    const authority = await resolver.deriveRunAuthority({ schema_version: "run-request.v1", target_id: "fal", expected_worktree_identity: "git:a" }, { runId: "run-closeout-real-git", createdAt: "2026-08-12T00:00:00.000Z" });
    const request: StageRequest = {
      schema_version: "stage-request.v1", request_id: "request-closeout-real-git", run_id: authority.run_id, issued_at: authority.created_at, issued_by: "orchestrator", run_authority_sha256: authoritySha256(authority),
      requested_stage: "CLOSEOUT", plan_class: "EPIC_PLAN", target_id: authority.target_id, worktree_identity: authority.worktree_identity, state_revision: authority.state_revision,
      state_sha256: authority.state_sha256, combined_selector: authority.combined_selector, combined_span_sha256: authority.combined_span_sha256, expected_sources: sources as StageRequest["expected_sources"],
      wave: authority.wave, epic: authority.epic, accountable_lane: authority.accountable_lane, accountable_class: authority.accountable_class, accountable_profile: authority.accountable_profile,
      sender_role: "Track D", recipient_role: "Meta", plan_identity: "plan-1", candidate_identity: "candidate-1", review_cycle: "0", finding_ids: [], review_risk: "high_risk",
      project_review_context: "fixture", expected_contract_version: "awc-3.1", allowed_side_effect_class: "ADDRESSED_SESSION_COMMAND", configuration_identity: authority.configuration_identity,
      active_route_generation: authority.active_route_generation,
    };
    const resolved = await resolver.resolveStageAuthority(authority, request);
    const closeoutPreflight = await resolver.resolveCloseoutPreflight(authority);
    assert.equal(resolved.capability.mode, "FIXTURE_ONLY");
    assert.equal(resolved.worktree?.status_clean, true);
    assert.deepEqual(resolved.worktree?.staged_paths, []);
    assert.equal(closeoutPreflight.worktree.status_clean, true);
    assert.deepEqual(closeoutPreflight.worktree.changed_paths, []);
    assert.equal(resolved.sources.length, 4);
  } finally {
    if (previousUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME; else process.env.OPENCODE_SERVER_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = previousPassword;
    rmSync(root, { recursive: true, force: true });
  }
});
