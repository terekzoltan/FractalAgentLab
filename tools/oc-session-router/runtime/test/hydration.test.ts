import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { _test } from "../src/cli.js";
import { authoritySha256, parseRunRequest, sha256, type RunAuthority, type StageInvocation, type StageRequest } from "../src/contracts.js";
import { StateStore } from "../src/state-store.js";
import { GitWorktreeReader } from "../src/worktree-reader.js";

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
        "-NoProfile", "-File", launcher, "-Operation", "new-run", "-RequestPath", requestPath,
      ], { encoding: "utf8", env: { ...process.env, OC_ROUTER_RUNTIME_ROOT: runtime, OC_ROUTER_CONTROL_REGISTRY: registryPath } });
      assert.equal(launched.status, 0, launched.stderr);
      const launcherResult = JSON.parse(launched.stdout) as { run_id: string; auto_advance: boolean };
      assert.match(launcherResult.run_id, /^run-/);
      assert.notEqual(launcherResult.run_id, result.run_id);
      assert.equal(launcherResult.auto_advance, false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI and PowerShell resolve-stage preserve UNCERTAIN with no send", () => {
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
        "-NoProfile", "-File", launcher, "-Operation", "resolve-stage", "-RunId", authority.run_id, "-OperationId", operation.operation_id,
      ], { encoding: "utf8", env: withoutRegistry });
      assert.equal(launched.status, 0, launched.stderr);
      const launcherResult = JSON.parse(launched.stdout) as { operation_status: string; transport_status: string; output_status: string };
      assert.equal(launcherResult.operation_status, "UNCERTAIN");
      assert.equal(launcherResult.transport_status, "NO_SEND");
      assert.equal(launcherResult.output_status, "AMBIGUOUS");
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
    assert.equal(resolved.capability.mode, "DISABLED");

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
    const resolver = _test.productionAuthorityResolver(registryPath);
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
    assert.equal(resolved.capability.mode, "DISABLED");
    assert.equal(resolved.worktree?.status_clean, true);
    assert.deepEqual(resolved.worktree?.staged_paths, []);
    assert.equal(resolved.sources.length, 4);
  } finally {
    if (previousUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME; else process.env.OPENCODE_SERVER_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = previousPassword;
    rmSync(root, { recursive: true, force: true });
  }
});
