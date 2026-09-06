import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { digest, StoreError, type WorkContext } from "../../src/v2/contracts.js";
import { importLegacyOperation, reconcileLegacyOperation, type LegacyImportRequest } from "../../src/v2/legacy-import.js";
import { OperationStore } from "../../src/v2/state-store.js";
import { RouterEngine, type Adapter } from "../../src/v2/engine.js";
import { RouterError, type RouterConfiguration } from "../../src/v2/routing.js";
import type { ReconcileReader } from "../../src/v2/reconcile.js";
import type { AdapterReply, OpenCodeMessage, OpenCodeTarget } from "../../src/v2/opencode-adapter.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const errorCode = (expected: string) => (error: unknown) => (error instanceof RouterError || error instanceof StoreError) && error.code === expected;
const legacyFailure = (error: unknown) => error instanceof RouterError && error.code.startsWith("LEGACY_");
const argument = "--- FAL SOURCE 0 PLAN ---\nFrozen original plan, not today's template.\n--- END FAL SOURCE 0 ---";

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(process.cwd(), ".router-v2-legacy-"));
  const legacyRoot = path.join(root, "legacy-input");
  const runId = "run-legacy-fixture", operationId = "op-legacy-fixture", session = "ses_legacy_fixture";
  const base = `runs/${runId}/operations/${operationId}`;
  mkdirSync(path.join(legacyRoot, base), { recursive: true });
  const store = new OperationStore(path.join(root, "v2", "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const work: WorkContext = { workId: "legacy-work", target: "legacy-fixture", directory: root, instructionReference: "fixture/owner", scope: "Recover existing work", allowedEffects: ["READ_ONLY", "WORKSPACE_WRITE"], stoppingPoint: "Inspect recovery evidence" };
  store.openWork(work);
  const configuration: RouterConfiguration = { schemaVersion: 2, targets: { "legacy-fixture": { namespace: "legacy-namespace", project: "legacy-project", directory: root, origin: "http://fixture.invalid", roles: { Delivery: { session, profile: "delivery", capability: "DELIVERY" } } } } };
  const authority = { schema_version: "run-authority.v1", run_id: runId, target_id: work.target, worktree_identity: "fixture-worktree", created_at: "2026-08-01T12:00:00.000Z" };
  const authorityDigest = digest(authority);
  const run = { schema_version: "run.v1", run_id: runId, target_id: work.target, worktree_identity: "fixture-worktree", run_authority_sha256: authorityDigest, run_authority_path: "run-authority.json", created_at: authority.created_at };
  const invocation = { schema_version: "stage-invocation.v1", operation_id: operationId, run_id: runId, target_id: work.target, run_authority_sha256: authorityDigest, recipient_role: "Delivery", recipient_session_sha256: sha(session), command_name: "implement", command_argument_sha256: sha(argument), command_body_sha256: digest({ command: "implement", arguments: argument }), candidate_identity: "fixture-candidate", review_cycle: "2", finding_ids: ["fixture-finding"] };
  const intent = { schema_version: "dispatch-intent.v1", operation_id: operationId, recipient_session_sha256: sha(session), command_name: "implement", command_body_sha256: invocation.command_body_sha256, authority_sha256: authorityDigest, baseline: { message_id: "msg_legacy_baseline", captured_at: authority.created_at }, created_at: authority.created_at };
  const record = { schema_version: "operation.v1", operation_id: operationId, run_id: runId, sequence: 0, revision: 2, status: "UNCERTAIN", invocation, intent_sha256: digest(intent), result_path: "result.json", updated_at: authority.created_at };
  const files = new Map<string, string>();
  const write = (relative: string, value: unknown, raw = false) => {
    const content = raw ? String(value) : JSON.stringify(value);
    writeFileSync(path.join(legacyRoot, relative), content);
    files.set(relative, content);
  };
  write(`runs/${runId}/run-authority.json`, authority);
  write(`runs/${runId}/run.json`, run);
  write(`${base}/operation.json`, record);
  write(`${base}/intent.json`, intent);
  write(`${base}/stage-invocation.json`, invocation);
  const request: LegacyImportRequest = { workId: work.workId, legacyRoot, runId, operationId, recipientRole: "Delivery", pauseReference: "fixture/import-pause" };
  function unchanged() { for (const [relative, content] of files) assert.equal(readFileSync(path.join(legacyRoot, relative), "utf8"), content); }
  function accepted() {
    const artifact = "Retained accepted artifact; acceptance remains historical.\n";
    write(`${base}/terminal.md`, artifact, true);
    write(`${base}/result.json`, { schema_version: "stage-result.v1", operation_id: operationId, run_id: runId, operation_status: "SUCCEEDED", output_status: "VALID", binding_status: "BOUND", terminal_status: "VALID", artifact_sha256: sha(artifact), message_id_sha256: sha("msg_legacy_response") });
    write(`${base}/transport-receipt.json`, { schema_version: "minimized-transport-receipt.v1", session_sha256: sha(session), message_id: "msg_legacy_response", parent_id: "msg_legacy_root", raw_response_persisted: false });
    return artifact;
  }
  function messages(): OpenCodeMessage[] {
    return [
      { id: "msg_legacy_baseline", session, role: "assistant", text: "Previous turn", hasCompactionPart: false },
      { id: "msg_legacy_root", session, role: "user", text: `Old installed command expansion\n${argument}\nOld footer`, hasCompactionPart: false },
      { id: "msg_legacy_response", session, role: "assistant", parentId: "msg_legacy_root", text: "Recovered old response without new acceptance", timeCreated: 200, timeCompleted: 300, finish: "stop", hasCompactionPart: false },
    ];
  }
  return { root, store, configuration, work, request, run, invocation, intent, record, base, write, unchanged, accepted, messages, session };
}

function reader(root: string, session: string, history: OpenCodeMessage[]) {
  const calls: Array<{ method: string; before?: string }> = [];
  const cursors = new Map<string, number>();
  const reply = <T>(value: T): AdapterReply<T> => ({ status: 200, bodySha256: "fixture-digest", value });
  const adapter: ReconcileReader = {
    getSession: async () => { calls.push({ method: "GET session" }); return reply({ id: session, directory: root, projectID: "legacy-project" }); },
    getStatus: async () => { calls.push({ method: "GET status" }); return reply("IDLE"); },
    getMessage: async id => {
      calls.push({ method: "GET message" });
      const message = history.find(item => item.id === id);
      return message ? reply(message) : { status: 404, bodySha256: "fixture-missing", problem: "HTTP_ERROR" };
    },
    getHistory: async options => {
      calls.push({ method: "GET history", ...(options.before ? { before: options.before } : {}) });
      const end = options.before ? cursors.get(options.before) : history.length;
      assert.notEqual(end, undefined, "Recovery must use an issued opaque cursor");
      const start = Math.max(0, end! - options.limit);
      const nextCursor = `fixture-opaque/${start}/page`;
      if (start > 0) cursors.set(nextCursor, start);
      return reply({ messages: history.slice(start, end), ...(start > 0 ? { nextCursor } : {}) });
    },
  };
  return { adapter, calls };
}

test("accepted legacy artifact preserves checksum and receipt without fake response, new approval or send", t => {
  const f = fixture(t), artifact = f.accepted();
  const imported = importLegacyOperation(f.store, f.configuration, f.request);
  assert.equal(imported.created, true);
  assert.equal(imported.operation.action.kind, "LEGACY");
  assert.equal(imported.operation.dispatchStartedAt, null);
  assert.equal(imported.operation.outcome?.artifact?.text, artifact);
  assert.equal(imported.operation.outcome?.artifact?.sha256, sha(artifact));
  assert.equal(imported.operation.outcome?.response, undefined);
  assert.equal(imported.operation.interpretation, null);
  assert.deepEqual(imported.operation.correlation, { rootMessageId: "msg_legacy_root", responseMessageId: "msg_legacy_response" });
  assert.equal(f.store.getWork(f.work.workId).paused, true);
  assert.equal(f.store.startDispatch(imported.operation.operationId), false);
  assert.deepEqual(importLegacyOperation(f.store, f.configuration, f.request), { operation: imported.operation, created: false });
  f.unchanged();
});

test("ambiguous import is non-executable and claims participant until recovery even after explicit resume", t => {
  const f = fixture(t);
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  assert.match(imported.messageId, /^legacy-/);
  assert.equal(imported.completedAt, null);
  assert.equal(imported.dispatchStartedAt, null);
  f.store.recordOwnerPause(f.work.workId, false, "fixture/resume");
  assert.equal(f.store.startDispatch(imported.operationId), false);
  assert.throws(() => f.store.prepareAction({ ...imported.action, kind: "LIFECYCLE", actionKey: "replacement" }), errorCode("PARTICIPANT_BUSY"));
  f.unchanged();
});

test("changed source after import conflicts instead of mutating the imported record", t => {
  const f = fixture(t);
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  f.write(`${f.base}/operation.json`, { ...f.record, status: "FAILED_OUTPUT" });
  assert.throws(() => importLegacyOperation(f.store, f.configuration, f.request), errorCode("INPUT_CONFLICT"));
  assert.deepEqual(f.store.getOperation(imported.operationId), imported);
});

for (const damage of ["malformed", "target", "session", "receipt-session", "intent-changed", "intent-hash-invalid", "run-authority", "artifact"] as const) {
  test(`legacy ${damage} evidence is rejected before import`, t => {
    const f = fixture(t);
    if (damage === "malformed") f.write(`${f.base}/operation.json`, "{broken", true);
    if (damage === "target") f.write(`runs/${f.request.runId}/run.json`, { ...f.run, target_id: "another-target" });
    if (damage === "session") f.write(`${f.base}/operation.json`, { ...f.record, invocation: { ...f.invocation, recipient_session_sha256: sha("ses_other") } });
    if (damage === "receipt-session") f.write(`${f.base}/transport-receipt.json`, { session_sha256: sha("ses_other"), parent_id: "msg_other_root" });
    if (damage === "intent-changed") f.write(`${f.base}/intent.json`, { ...f.intent, created_at: "2026-08-02T12:00:00.000Z" });
    if (damage === "intent-hash-invalid") f.write(`${f.base}/operation.json`, { ...f.record, intent_sha256: "invalid-digest" });
    if (damage === "run-authority") f.write(`runs/${f.request.runId}/run.json`, { ...f.run, run_authority_sha256: sha("different-authority") });
    if (damage === "artifact") { f.accepted(); f.write(`${f.base}/terminal.md`, "Tampered accepted output", true); }
    assert.throws(() => importLegacyOperation(f.store, f.configuration, f.request), legacyFailure);
    assert.equal(f.store.getWork(f.work.workId).operations.length, 0);
    f.unchanged();
  });
}

test("known historical receipt recovers through GETs without today's template or another send", async t => {
  const f = fixture(t);
  f.write(`${f.base}/transport-receipt.json`, { schema_version: "minimized-transport-receipt.v1", session_sha256: sha(f.session), parent_id: "msg_legacy_root", message_id: "msg_legacy_response" });
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const { adapter, calls } = reader(f.root, f.session, f.messages());
  const recovered = await reconcileLegacyOperation(f.store, imported.operationId, adapter);
  assert.equal(recovered.disposition, "COMPLETED");
  assert.equal(recovered.operation.outcome?.response?.text, "Recovered old response without new acceptance");
  assert.equal(recovered.operation.interpretation, null);
  assert.equal(recovered.operation.dispatchStartedAt, null);
  assert.equal(f.store.getWork(f.work.workId).paused, true);
  assert.ok(calls.every(call => call.method.startsWith("GET")));
  f.unchanged();
});

test("unresolved legacy recovery uses frozen session after its current role mapping is removed", async t => {
  const f = fixture(t);
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const frozen = { origin: f.configuration.targets[f.work.target]!.origin, directory: f.root, session: f.session };
  delete f.configuration.targets[f.work.target]!.roles.Delivery;
  const { adapter: reads, calls } = reader(f.root, f.session, f.messages());
  const adapter: Adapter = {
    ...reads,
    listCommands: async () => { throw new Error("Historical recovery must not use current command semantics"); },
    submitCommand: async () => { throw new Error("Historical recovery must not send"); },
    submitMessage: async () => { throw new Error("Historical recovery must not send"); },
    summarize: async () => { throw new Error("Historical recovery must not compact"); },
  };
  const addresses: OpenCodeTarget[] = [];
  const engine = new RouterEngine(f.store, f.configuration, { username: "fixture", password: "fixture" }, target => { addresses.push(target); return adapter; });
  const recovered = await engine.reconcile(imported.operationId);
  assert.equal(recovered.operation.outcome?.execution, "COMPLETED");
  assert.equal(recovered.operation.dispatchStartedAt, null);
  assert.equal(recovered.operation.interpretation, null);
  assert.deepEqual(addresses, [frozen]);
  assert.ok(calls.length > 0 && calls.every(call => call.method.startsWith("GET")));
  assert.equal(f.store.getWork(f.work.workId).paused, true);
  f.unchanged();
});

test("unique post-baseline root uses both exact old arguments hash and command body hash", async t => {
  const f = fixture(t);
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const history = f.messages();
  history.splice(1, 0, { ...history[1]!, id: "msg_decoy_root", text: argument.replace("Frozen original", "Different") });
  const { adapter } = reader(f.root, f.session, history);
  const recovered = await reconcileLegacyOperation(f.store, imported.operationId, adapter);
  assert.equal(recovered.disposition, "COMPLETED");
  assert.equal(recovered.operation.messageId, "msg_legacy_root");
  assert.equal(recovered.operation.dispatchStartedAt, null);
  f.unchanged();
});

test("inline command argument expansion recovers by exact hashes without a line-start requirement", async t => {
  const f = fixture(t);
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const history = f.messages();
  history[1]!.text = `Command input: ${argument}\nFooter`;
  const { adapter, calls } = reader(f.root, f.session, history);
  const recovered = await reconcileLegacyOperation(f.store, imported.operationId, adapter);
  assert.equal(recovered.disposition, "COMPLETED");
  assert.equal(recovered.operation.messageId, "msg_legacy_root");
  assert.equal(recovered.operation.dispatchStartedAt, null);
  assert.equal(recovered.operation.interpretation, null);
  assert.ok(calls.every(call => call.method.startsWith("GET")));
  f.unchanged();
});

test("old response message hash identifies its actual parent rather than a newer matching-looking output", async t => {
  const f = fixture(t);
  f.write(`${f.base}/result.json`, { schema_version: "stage-result.v1", operation_id: f.request.operationId, run_id: f.request.runId, operation_status: "UNCERTAIN", message_id_sha256: sha("msg_legacy_response") });
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const history = f.messages();
  history[1]!.text = "Old arguments not reconstructible from this page";
  history.push({ ...history[2]!, id: "msg_newer_decoy", parentId: "msg_decoy_root", text: "Newer irrelevant output" });
  const recovered = await reconcileLegacyOperation(f.store, imported.operationId, reader(f.root, f.session, history).adapter);
  assert.equal(recovered.disposition, "COMPLETED");
  assert.equal(recovered.operation.correlation.responseMessageId, "msg_legacy_response");
  f.unchanged();
});

test("matching argument bytes alone cannot recover a root with a different command body hash", async t => {
  const f = fixture(t);
  const differentBody = digest({ command: "different-installed-command", arguments: argument });
  const intent = { ...f.intent, command_body_sha256: differentBody };
  f.write(`${f.base}/intent.json`, intent);
  f.write(`${f.base}/operation.json`, { ...f.record, invocation: { ...f.invocation, command_body_sha256: differentBody }, intent_sha256: digest(intent) });
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const result = await reconcileLegacyOperation(f.store, imported.operationId, reader(f.root, f.session, f.messages()).adapter);
  assert.equal(result.disposition, "PENDING");
  assert.match(result.operation.messageId, /^legacy-/);
  assert.equal(result.operation.completedAt, null);
  f.unchanged();
});

test("legacy pagination continues beyond a page budget without losing an older exact root", async t => {
  const f = fixture(t);
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const history = f.messages();
  for (let index = 0; index < 320; index += 1) history.push({ id: `msg_filler_${index}`, session: f.session, role: "user", text: "Unrelated fixture history", hasCompactionPart: false });
  const { adapter, calls } = reader(f.root, f.session, history);
  let result = await reconcileLegacyOperation(f.store, imported.operationId, adapter);
  assert.equal(result.disposition, "CONTINUE");
  assert.ok(result.nextCursor);
  for (let round = 0; round < 5 && result.operation.completedAt === null; round += 1) result = await reconcileLegacyOperation(f.store, imported.operationId, adapter);
  assert.equal(result.operation.outcome?.execution, "COMPLETED");
  assert.ok(calls.filter(call => call.before).length > 6);
  assert.equal(result.operation.dispatchStartedAt, null);
  f.unchanged();
});

test("multiple exact historical roots stay ambiguous and missing baseline stays pending", async t => {
  const f = fixture(t);
  const imported = importLegacyOperation(f.store, f.configuration, f.request).operation;
  const history = f.messages();
  history.splice(2, 0, { ...history[1]!, id: "msg_second_matching_root" });
  const ambiguous = await reconcileLegacyOperation(f.store, imported.operationId, reader(f.root, f.session, history).adapter);
  assert.equal(ambiguous.disposition, "AMBIGUOUS");
  assert.equal(ambiguous.operation.completedAt, null);
  assert.match(ambiguous.operation.messageId, /^legacy-/);
  const missingBaseline = await reconcileLegacyOperation(f.store, imported.operationId, reader(f.root, f.session, f.messages().slice(1)).adapter);
  assert.equal(missingBaseline.disposition, "PENDING");
  assert.equal(missingBaseline.operation.completedAt, null);
  assert.match(missingBaseline.operation.messageId, /^legacy-/);
  f.unchanged();
});
