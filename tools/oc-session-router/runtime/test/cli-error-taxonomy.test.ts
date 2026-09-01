import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { _test } from "../src/cli.js";

const CLI_ENTRY = fileURLToPath(new URL("../src/cli.js", import.meta.url));

const EXPECTED_CODES = [
  "REQUEST_INVALID",
  "ROOT_AUTHORITY_BLOCKED",
  "RUN_AUTHORITY_BLOCKED",
  "STATE_STORE_ACCESS",
  "STATE_STORE_BLOCKED",
  "TOOL_ATTESTATION_BLOCKED",
  "UNSAFE_PATH",
  "P0B_REQUIRED",
  "CAPABILITY_PROBE_BLOCKED",
  "SOURCE_IDENTITY_CHANGED",
  "PARTICIPANT_FENCE_BLOCKED",
  "DISPATCH_LEASE_BLOCKED",
  "SNAPSHOT_BASELINE_BLOCKED",
  "COMPACT_PREFLIGHT_BLOCKED",
  "OUTPUT_CHANNEL_BLOCKED",
  "BLOCKED",
] as const;

test("CLI exposes only the reviewed finite error-code vocabulary", () => {
  assert.deepEqual(_test.CLI_ERROR_CODES, EXPECTED_CODES);
});

test("production compact hooks select Meta or the exact accountable delivery profile", () => {
  const base = {
    target_id: "ringfall",
    requested_stage: "PLAN_REVIEW",
    accountable_profile: "ringfall.track-d",
    recipient_role: "Meta",
  } as Parameters<typeof _test.compactProfileForStage>[0];
  assert.deepEqual(_test.compactProfileForStage(base), { profileId: "ringfall.meta", logicalSessionRef: "meta", roleHint: "Meta" });
  assert.deepEqual(_test.compactProfileForStage({ ...base, requested_stage: "PLAN_REVISION", recipient_role: "Track D" }), { profileId: "ringfall.track-d", logicalSessionRef: "track-d", roleHint: "Track D" });
  assert.throws(() => _test.compactProfileForStage({ ...base, requested_stage: "PLAN_REVISION", accountable_profile: "worldsim.track-d", recipient_role: "Track D" }), /does not belong/);
});

test("Compact preflight keeps WARN nonblocking and waits only for a bounded busy critical session", async () => {
  const warn = { disposition: "WAIT_SAFE_BOUNDARY", reason: "SESSION_NOT_IDLE", pressure_state: "warn", session_state: "busy" };
  const warnResult = await _test.resolveCompactPreflight(() => warn, { max_wait_ms: 0, poll_interval_ms: 1 });
  assert.equal(warnResult.result, warn);
  assert.equal(warnResult.wait_attempts, 0);

  let clock = 0;
  let probes = 0;
  const criticalResult = await _test.resolveCompactPreflight(
    () => ++probes === 1
      ? { disposition: "WAIT_SAFE_BOUNDARY", reason: "SESSION_NOT_IDLE", pressure_state: "critical", session_state: "busy" }
      : { disposition: "CONTINUE", reason: "PRESSURE_NORMAL", pressure_state: "normal", session_state: "idle" },
    { max_wait_ms: 30, poll_interval_ms: 10, now: () => clock, sleep: async (milliseconds) => { clock += milliseconds; } },
  );
  assert.equal(criticalResult.wait_attempts, 1);
  assert.equal(criticalResult.wait_elapsed_ms, 10);
  assert.equal(probes, 2);
});

test("Compact preflight timeout emits a privacy-safe actionable receipt without a lifecycle send", async () => {
  let clock = 0;
  let caught: unknown;
  try {
    await _test.resolveCompactPreflight(
      () => ({ disposition: "WAIT_SAFE_BOUNDARY", reason: "SESSION_NOT_IDLE", pressure_state: "critical", session_state: "busy" }),
      { max_wait_ms: 30, poll_interval_ms: 10, now: () => clock, sleep: async (milliseconds) => { clock += milliseconds; } },
    );
  } catch (error) { caught = error; }
  assert.deepEqual(_test.cliErrorReceipt(caught), {
    error_code: "COMPACT_PREFLIGHT_BLOCKED",
    compact_preflight: {
      schema_version: "compact-preflight-diagnostic.v1",
      disposition: "WAIT_SAFE_BOUNDARY",
      reason: "SESSION_NOT_IDLE",
      pressure_state: "CRITICAL",
      session_state: "BUSY",
      wait_attempts: 3,
      wait_elapsed_ms: 30,
      lifecycle_send: false,
    },
  });
});

test("Compact uncertainty still blocks immediately and sanitizes unreviewed diagnostic tokens", async () => {
  let caught: unknown;
  try {
    await _test.resolveCompactPreflight(
      () => ({ disposition: "COMPACT_UNCERTAIN", reason: "private C:\\secret", pressure_state: "critical", session_state: "idle" }),
      { max_wait_ms: 0, poll_interval_ms: 1 },
    );
  } catch (error) { caught = error; }
  const receipt = _test.cliErrorReceipt(caught);
  assert.equal(receipt.error_code, "COMPACT_PREFLIGHT_BLOCKED");
  assert.equal(receipt.compact_preflight?.reason, "UNCLASSIFIED");
  assert.equal(JSON.stringify(receipt).includes("secret"), false);
});

test("Compact hook execution failure is observable without exposing the native error", async () => {
  let caught: unknown;
  try {
    await _test.resolveCompactPreflight(() => { throw new Error("private C:\\secret\\hook.log"); }, { max_wait_ms: 0, poll_interval_ms: 1 });
  } catch (error) { caught = error; }
  const receipt = _test.cliErrorReceipt(caught);
  assert.equal(receipt.error_code, "COMPACT_PREFLIGHT_BLOCKED");
  assert.equal(receipt.compact_preflight?.disposition, "HOOK_FAILED");
  assert.equal(receipt.compact_preflight?.reason, "HOOK_EXECUTION_FAILED");
  assert.equal(JSON.stringify(receipt).includes("secret"), false);
});

test("ordinary pre-dispatch hook execution failure becomes a privacy-safe nonblocking warning", async () => {
  const request = {
    target_id: "ringfall",
    requested_stage: "IMPLEMENT",
    accountable_profile: "ringfall.track-d",
    recipient_role: "Track D",
  } as Parameters<typeof _test.runCompactLitePreflightHook>[0];
  const warning = _test.runCompactLitePreflightHook(request, "C:\\protected\\registry.json", () => {
    throw new Error("private C:\\secret\\hook.log");
  });
  assert.deepEqual(warning, {
    schema_version: "compact-lite-result/v1",
    contract: "opencode-compact-lite/v1",
    logical_session_ref: "track-d",
    role_hint: "Track D",
    event_type: "before_dispatch",
    disposition: "CONTINUE",
    reason: "HOOK_EXECUTION_FAILED_NONBLOCKING",
    pressure_state: "unknown",
    session_state: "unknown",
    workflow_command_sent: false,
    terminal: true,
    privacy: {
      absolute_roots_emitted: false,
      credentials_emitted: false,
      endpoints_emitted: false,
      ports_emitted: false,
      raw_session_ids_emitted: false,
      transcripts_emitted: false,
    },
  });
  const resolved = await _test.resolveCompactPreflight(() => warning, { max_wait_ms: 0, poll_interval_ms: 1 });
  assert.equal(resolved.result, warning);
  assert.equal(JSON.stringify(warning).includes("secret"), false);
});

test("CLOSEOUT keeps pre-dispatch Compact hook execution failure fail-closed", () => {
  const request = {
    target_id: "ringfall",
    requested_stage: "CLOSEOUT",
    accountable_profile: "ringfall.track-d",
    recipient_role: "Meta",
  } as Parameters<typeof _test.runCompactLitePreflightHook>[0];
  assert.throws(
    () => _test.runCompactLitePreflightHook(request, "C:\\protected\\registry.json", () => { throw new Error("hook failed"); }),
    /hook failed/,
  );
});

test("CLI error classifier separates bounded operational failure classes", () => {
  const cases: ReadonlyArray<readonly [Error, Parameters<typeof _test.classifyCliError>[1], string]> = [
    [new Error("request parser rejected private C:\\secret\\request.json"), "REQUEST_INVALID", "REQUEST_INVALID"],
    [new Error("KnownFolder authority proof mismatch at C:\\private"), "BLOCKED", "ROOT_AUTHORITY_BLOCKED"],
    [new Error("run derivation failed with target secret"), "RUN_AUTHORITY_BLOCKED", "RUN_AUTHORITY_BLOCKED"],
    [new Error("Git executable hash mismatch at C:\\Program Files\\Git"), "BLOCKED", "TOOL_ATTESTATION_BLOCKED"],
    [new Error("KnownFolder authority broker is unavailable at C:\\Windows"), "BLOCKED", "TOOL_ATTESTATION_BLOCKED"],
    [new Error("target path traverses a link or junction at C:\\private"), "BLOCKED", "UNSAFE_PATH"],
    [new Error("Production command dispatch is disabled until a reviewed P0B capability transaction"), "BLOCKED", "P0B_REQUIRED"],
    [new Error("Installed capability probe transient retry exhausted"), "BLOCKED", "CAPABILITY_PROBE_BLOCKED"],
    [new Error("SOURCE_IDENTITY_CHANGED: stage source manifest hash differs at C:\\private"), "BLOCKED", "SOURCE_IDENTITY_CHANGED"],
    [new Error("Participant transport is locked by Compact or lifecycle dispatch"), "BLOCKED", "PARTICIPANT_FENCE_BLOCKED"],
    [new Error("EEXIST at private dispatch-leases path"), "BLOCKED", "DISPATCH_LEASE_BLOCKED"],
    [new Error("Snapshot assistant part type tool is unsupported"), "BLOCKED", "SNAPSHOT_BASELINE_BLOCKED"],
    [new Error("unclassified internal failure at C:\\private"), "BLOCKED", "BLOCKED"],
  ];
  for (const [error, fallback, expected] of cases) assert.equal(_test.classifyCliError(error, fallback), expected);
});

test("only transient pre-operation live capability failures permit the exact same request", () => {
  const safe = new _test.StageDispatchBlockedError(
    "CAPABILITY_PROBE_BLOCKED",
    _test.stageDispatchDiagnostic("CAPABILITY_PROBE_BLOCKED", false, false),
  );
  assert.deepEqual(_test.cliErrorReceipt(safe), {
    error_code: "CAPABILITY_PROBE_BLOCKED",
    stage_dispatch: {
      schema_version: "stage-dispatch-diagnostic.v2",
      phase: "LIVE_CAPABILITY",
      reason_class: "LIVE_CAPABILITY_UNAVAILABLE",
      stability_attempts: 0,
      operation_created: false,
      lifecycle_send: false,
      retry_disposition: "SAFE_SAME_REQUEST",
    },
  });

  const semantic = new _test.StageDispatchBlockedError(
    "SOURCE_IDENTITY_CHANGED",
    _test.stageDispatchDiagnostic("SOURCE_IDENTITY_CHANGED", false, false),
  );
  assert.equal(_test.cliErrorReceipt(semantic).stage_dispatch?.retry_disposition, "NO_AUTOMATIC_RETRY");

  const unstable = new _test.PreOperationStabilityError(new Error("Dispatch capability drifted before authority resolution"), 1);
  assert.deepEqual(_test.stageDispatchDiagnostic("BLOCKED", false, false, unstable), {
    schema_version: "stage-dispatch-diagnostic.v2",
    phase: "LIVE_CAPABILITY",
    reason_class: "LIVE_CAPABILITY_UNSTABLE",
    stability_attempts: 1,
    operation_created: false,
    lifecycle_send: false,
    retry_disposition: "SAFE_SAME_REQUEST",
  });

  const postOperation = new _test.StageDispatchBlockedError(
    "CAPABILITY_PROBE_BLOCKED",
    _test.stageDispatchDiagnostic("CAPABILITY_PROBE_BLOCKED", true, false),
  );
  assert.deepEqual(_test.cliErrorReceipt(postOperation).stage_dispatch, {
    schema_version: "stage-dispatch-diagnostic.v2",
    phase: "POST_OPERATION_FINALIZATION",
    reason_class: "POST_OPERATION_FAILURE",
    stability_attempts: 0,
    operation_created: true,
    lifecycle_send: false,
    retry_disposition: "NO_AUTOMATIC_RETRY",
  });
});

test("pre-operation diagnostics classify semantic guards without leaking native messages", () => {
  const cases = [
    [new Error("state_revision binding mismatch at C:\\private"), "REQUEST_AUTHORITY", "REQUEST_AUTHORITY_MISMATCH"],
    [new Error("Requested stage is not an allowed transition"), "STAGE_TRANSITION", "STAGE_TRANSITION_BLOCKED"],
    [new Error("Installed server command registry drifted from protected receipt"), "LIVE_CAPABILITY", "COMMAND_REGISTRY_DRIFT"],
    [new Error("Current target semantic authority drifted"), "CURRENT_AUTHORITY", "CURRENT_AUTHORITY_DRIFT"],
    [new Error("Protected source finding lineage mismatch"), "SOURCE_AUTHORITY", "SOURCE_AUTHORITY_MISMATCH"],
    [new Error("Semantic action is already consumed or unresolved"), "DUPLICATE_ACTION", "DUPLICATE_ACTION_BLOCKED"],
    [new Error("Run authority contains a private transport sentinel"), "PRIVACY_BOUNDARY", "PRIVACY_BOUNDARY_REJECTED"],
  ] as const;
  for (const [error, phase, reasonClass] of cases) {
    const diagnostic = _test.stageDispatchDiagnostic("BLOCKED", false, false, error);
    assert.equal(diagnostic.phase, phase);
    assert.equal(diagnostic.reason_class, reasonClass);
    assert.equal(diagnostic.retry_disposition, "NO_AUTOMATIC_RETRY");
    assert.equal(JSON.stringify(diagnostic).includes("private"), false);
  }
});

test("request boundary remains authoritative when private paths contain taxonomy keywords", () => {
  for (const privatePath of ["C:\\private\\P0B\\request.json", "C:\\private\\KnownFolder\\request.json", "C:\\private\\link\\request.json"]) {
    const error = Object.assign(new Error(`ENOENT: request file is unavailable, open '${privatePath}'`), { code: "ENOENT" });
    assert.equal(_test.classifyCliError(error, "REQUEST_INVALID"), "REQUEST_INVALID");
  }
});

test("state-store classifier distinguishes access denial from other persistence failures", () => {
  const accessCases = [
    ["EACCES", "C:\\private\\P0B\\state.json"],
    ["EPERM", "C:\\private\\KnownFolder\\state.json"],
    ["EROFS", "C:\\private\\link\\state.json"],
  ] as const;
  for (const [code, privatePath] of accessCases) {
    const error = Object.assign(new Error(`${code}: private native failure at ${privatePath}`), { code });
    assert.equal(_test.stateStoreErrorCode(error), "STATE_STORE_ACCESS");
    assert.equal(_test.classifyCliError(error, "STATE_STORE_BLOCKED"), "STATE_STORE_ACCESS");
  }
  for (const code of ["EIO", "ENOSPC", "EEXIST", "PRIVATE_NATIVE_CODE"]) {
    assert.equal(_test.stateStoreErrorCode(Object.assign(new Error("private native failure"), { code })), "STATE_STORE_BLOCKED");
  }
  assert.equal(_test.stateStoreErrorCode(new Error("no native code")), "STATE_STORE_BLOCKED");
});

test("CLI failure receipt never emits raw messages, paths, native codes, or injected JSON", () => {
  const secret = "C:\\Users\\ASUS\\.config\\opencode\\secret.json";
  const error = Object.assign(new Error(`failure at ${secret}\n{\"leaked\":true}`), { code: "TOP_SECRET_NATIVE_CODE" });
  const receipt = _test.cliErrorReceipt(error);
  const json = _test.cliErrorJson(error);

  assert.deepEqual(Object.keys(receipt), ["error_code"]);
  assert.deepEqual(receipt, { error_code: "BLOCKED" });
  assert.equal(json, '{"error_code":"BLOCKED"}\n');
  assert.deepEqual(JSON.parse(json), { error_code: "BLOCKED" });
  assert.equal(json.split("\n").filter(Boolean).length, 1);
  for (const forbidden of [secret, "failure at", "leaked", "TOP_SECRET_NATIVE_CODE"]) assert.equal(json.includes(forbidden), false);
});

test("output channel failures are finite and never leak private native details", () => {
  const privatePath = "C:\\private\\P0B\\KnownFolder\\link\\result.json";
  for (const code of ["EPIPE", "ERR_STREAM_DESTROYED"]) {
    let caught: unknown;
    let writes = 0;
    try {
      _test.writeCliJsonRow(1, { ok: true }, () => {
        writes += 1;
        throw Object.assign(new Error(`${code}: output failed at ${privatePath}`), { code });
      });
    } catch (error) { caught = error; }
    assert.equal(writes, 1);
    assert.deepEqual(_test.cliErrorReceipt(caught), { error_code: "OUTPUT_CHANNEL_BLOCKED" });
    const json = _test.cliErrorJson(caught);
    assert.equal(json, '{"error_code":"OUTPUT_CHANNEL_BLOCKED"}\n');
    for (const forbidden of [code, privatePath, "P0B", "KnownFolder", "link"]) assert.equal(json.includes(forbidden), false);
  }
});

test("serialization completes before the single output write and cannot emit a partial row", () => {
  const circular: { self?: unknown } = {};
  circular.self = circular;
  let writes = 0;
  let caught: unknown;
  try { _test.writeCliJsonRow(1, circular, () => { writes += 1; }); }
  catch (error) { caught = error; }
  assert.equal(writes, 0);
  assert.deepEqual(_test.cliErrorReceipt(caught), { error_code: "OUTPUT_CHANNEL_BLOCKED" });
});

test("successful output emission writes exactly one UTF-8 JSON row to the selected channel", () => {
  const calls: Array<{ fd: number; row: string }> = [];
  _test.writeCliJsonRow(1, { ok: true, auto_advance: false }, (fd, row) => calls.push({ fd, row }));
  assert.deepEqual(calls, [{ fd: 1, row: '{"ok":true,"auto_advance":false}\n' }]);

  const failures: Array<{ fd: number; row: string }> = [];
  _test.writeCliJsonRow(2, _test.cliErrorReceipt(new Error("private failure")), (fd, row) => failures.push({ fd, row }));
  assert.deepEqual(failures, [{ fd: 2, row: '{"error_code":"BLOCKED"}\n' }]);
});

test("CLI process preserves exit 3 and JSON-only stderr for invalid requests", () => {
  const result = spawnSync(process.execPath, [CLI_ENTRY, "not-a-router-operation"], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 3);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, '{"error_code":"REQUEST_INVALID"}\n');
  assert.deepEqual(JSON.parse(result.stderr), { error_code: "REQUEST_INVALID" });
});

test("every operation rejects each missing required key as REQUEST_INVALID", () => {
  const operationKeys = [
    ["new-run", ["--request"]],
    ["new-follow-on-run", ["--request"]],
    ["invoke-stage", ["--request"]],
    ["install-closeout-authority", ["--request"]],
    ["resolve-stage", ["--run-id", "--operation-id"]],
    ["get-run", ["--run-id"]],
    ["write-p0b-proof", ["--request"]],
    ["resolve-compact-authority", ["--target-id", "--recipient-role"]],
    ["consume-compact-authority", ["--target-id", "--recipient-role", "--attempt-id"]],
  ] as const;
  for (const [operation, keys] of operationKeys) {
    for (const missing of keys) {
      const args = keys.filter((key) => key !== missing).flatMap((key) => [key, "fixture"]);
      const result = spawnSync(process.execPath, [CLI_ENTRY, operation, ...args], { encoding: "utf8", windowsHide: true });
      assert.equal(result.status, 3, `${operation} without ${missing}`);
      assert.equal(result.stdout, "", `${operation} without ${missing}`);
      assert.equal(result.stderr, '{"error_code":"REQUEST_INVALID"}\n', `${operation} without ${missing}`);
    }
  }
});
