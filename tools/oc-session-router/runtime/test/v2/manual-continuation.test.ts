import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { OperationStore } from "../../src/v2/state-store.js";
import { adoptManualContinuation, textSha256 } from "../../src/v2/manual-continuation.js";
import type { AdapterReply, OpenCodeMessage } from "../../src/v2/opencode-adapter.js";
import type { ReconcileReader } from "../../src/v2/reconcile.js";
import { operationView } from "../../src/v2/cli.js";

const reply = <T>(value: T): AdapterReply<T> => ({ status: 200, value, bodySha256: "fixture" });
function fixture(t: TestContext) {
  const directory = mkdtempSync(path.join(process.cwd(), ".manual-recovery-"));
  const store = new OperationStore(path.join(directory, "router.sqlite"));
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  store.openWork({ workId: "work", target: "fixture", directory, instructionReference: "owner", scope: "fix plan", allowedEffects: ["WORKSPACE_WRITE"], stoppingPoint: "review" });
  const action = { workId: "work", actionKey: "fix-plan", participant: { namespace: "fixture", project: "project", session: "ses_delivery" }, recipientRole: "Delivery", kind: "LIFECYCLE" as const, effect: "WORKSPACE_WRITE" as const, command: "step-review-utan", predecessor: null,
    input: { address: { origin: "http://fixture.invalid", directory, session: "ses_delivery" }, sources: [] } };
  let operation = store.prepareAction(action).operation;
  store.startDispatch(operation.operationId);
  operation = store.acknowledge(operation.operationId, { rootMessageId: operation.messageId });
  const message = (id: string, role: "user" | "assistant", at: number, extra: Partial<OpenCodeMessage> = {}): OpenCodeMessage => ({ id, role, session: "ses_delivery", text: "", timeCreated: at, hasCompactionPart: false, ...extra });
  const original = message(operation.messageId, "user", 1, { text: "Original fix plan request" });
  const root = message("msg_manual", "user", 3, { text: "Continue the interrupted fix plan, unchanged scope" });
  const terminal = message("msg_terminal", "assistant", 4, { parentId: root.id, text: "FIX_PLAN_REQUIRED\nSeven findings\nFIX_PLAN_READY_FOR_IMPLEMENT", timeCompleted: 5, finish: "stop" });
  const state = { messages: [original, root, terminal], activity: "IDLE" as "IDLE" | "BUSY", reads: 0, mutate: false, wrongSession: false, race: false, truncated: false };
  const adapter: ReconcileReader = {
    getSession: async () => reply({ id: state.wrongSession ? "ses_wrong" : "ses_delivery", directory, projectID: "project" }),
    getStatus: async () => reply(state.activity),
    getMessage: async id => reply(state.messages.find(m => m.id === id)!),
    getHistory: async () => {
      state.reads++;
      if (state.race && state.reads === 2) store.observe(operation.operationId, { observedAt: new Date().toISOString(), activity: "BUSY", context: { concurrent: true } });
      return reply({ messages: structuredClone(state.messages.filter(m => !state.truncated || m.id !== original.id)).map(m => state.mutate && state.reads >= 2 && m.id === terminal.id ? { ...m, text: "changed" } : m) });
    },
  };
  const request = { operationId: operation.operationId, expectedInputDigest: operation.inputDigest, manualRootMessageId: root.id, manualRootTextSha256: textSha256(root.text), terminalMessageId: terminal.id, terminalTextSha256: textSha256(terminal.text), instructionReference: "Owner approves manual adoption", intentVerificationReference: "Responsible lane verified same scope, candidate and all seven findings" };
  return { store, action, operation, original, root, terminal, state, adapter, request };
}

test("manual adoption retains original history, pause, provenance and unlocks same-work result without resend", async t => {
  const f = fixture(t);
  f.store.recordOwnerPause("work", true, "Owner pause");
  const outcome = await adoptManualContinuation(f.store, f.request, f.adapter);
  assert.equal(outcome.operationId, f.operation.operationId);
  assert.equal(outcome.messageId, f.operation.messageId);
  assert.equal(outcome.inputDigest, f.operation.inputDigest);
  assert.equal(outcome.acknowledgedAt, f.operation.acknowledgedAt);
  assert.deepEqual(outcome.correlation, f.operation.correlation);
  assert.equal(outcome.outcome?.response, undefined);
  assert.equal(outcome.outcome?.artifact?.text, f.terminal.text);
  assert.equal(outcome.outcome?.manualRecovery?.originalMessageId, f.original.id);
  assert.equal(f.store.getWork("work").paused, true);
  assert.equal(operationView(outcome).recovery?.kind, "MANUAL_CONTINUATION");
  const reads = f.state.reads;
  assert.equal((await adoptManualContinuation(f.store, f.request, f.adapter)).resultDigest, outcome.resultDigest);
  assert.equal(f.state.reads, reads); // Idempotent replay, no new HTTP needed.
  await assert.rejects(adoptManualContinuation(f.store, { ...f.request, instructionReference: "different" }, f.adapter));
  f.store.recordOwnerPause("work", false, "Owner resume");
  assert.equal(f.store.prepareAction({ ...f.action, actionKey: "next", predecessor: outcome.operationId }).created, true);
});

for (const scenario of ["busy", "wrong-session", "wrong-hash", "wrong-input", "wrong-parent", "multiple", "later-root", "original-success", "changed-history", "truncated", "race", "failed", "missing-attestation", "compaction", "wrong-time"]) {
  test(`manual adoption rejects ${scenario} without manufacturing a result`, async t => {
    const f = fixture(t);
    if (scenario === "busy") f.state.activity = "BUSY";
    if (scenario === "wrong-session") f.state.wrongSession = true;
    if (scenario === "wrong-hash") f.request.terminalTextSha256 = "0".repeat(64);
    if (scenario === "wrong-input") f.request.expectedInputDigest = "0".repeat(64);
    if (scenario === "wrong-parent") f.terminal.parentId = "msg_other";
    if (scenario === "multiple") f.state.messages.push({ ...f.terminal, id: "msg_competing" });
    if (scenario === "later-root") f.state.messages.push({ ...f.root, id: "msg_later", timeCreated: 6 });
    if (scenario === "original-success") f.state.messages.push({ ...f.terminal, id: "msg_original_result", parentId: f.original.id });
    if (scenario === "changed-history") f.state.mutate = true;
    if (scenario === "truncated") f.state.truncated = true;
    if (scenario === "race") f.state.race = true;
    if (scenario === "failed") f.terminal.error = true;
    if (scenario === "missing-attestation") f.request.intentVerificationReference = "";
    if (scenario === "compaction") f.root.hasCompactionPart = true;
    if (scenario === "wrong-time") f.root.timeCreated = 0;
    await assert.rejects(adoptManualContinuation(f.store, f.request, f.adapter));
    assert.equal(f.store.getOperation(f.operation.operationId).resultDigest, null);
    assert.throws(() => f.store.prepareAction({ ...f.action, actionKey: "duplicate" })); // Claim retained.
  });
}

test("manual adoption result insertion is transactional across a crash checkpoint", async t => {
  const f = fixture(t);
  const second = new OperationStore(f.store.databasePath, { checkpoint: point => { if (point === "RESULT_INSERTED") throw new Error("fixture crash"); } });
  try { await assert.rejects(adoptManualContinuation(second, f.request, f.adapter)); } finally { second.close(); }
  assert.equal(f.store.getOperation(f.operation.operationId).resultDigest, null);
  assert.equal((await adoptManualContinuation(f.store, f.request, f.adapter)).outcome?.execution, "COMPLETED");
  assert.equal(f.store.getWork("work").operations.length, 1);
});

test("explicit manual adoption preserves missing remote original root as a limitation, not invented native lineage", async t => {
  const f = fixture(t);
  f.state.messages = f.state.messages.filter(m => m.id !== f.original.id);
  const now = Date.now() + 1000;
  f.root.timeCreated = now; f.terminal.timeCreated = now + 1; f.terminal.timeCompleted = now + 2;
  const get = f.adapter.getMessage;
  f.adapter.getMessage = async id => id === f.original.id ? { status: 404, bodySha256: "missing", problem: "HTTP_ERROR" } : get(id);
  const recovered = await adoptManualContinuation(f.store, f.request, f.adapter);
  assert.equal(recovered.outcome?.manualRecovery?.originalRootEvidence, "DURABLE_ACKNOWLEDGEMENT_REMOTE_ROOT_NOT_FOUND");
  assert.deepEqual(recovered.correlation, f.operation.correlation);
  assert.equal(recovered.outcome?.response, undefined);
});

test("network failure is not missing-root evidence", async t => {
  const f = fixture(t);
  f.state.messages = f.state.messages.filter(m => m.id !== f.original.id);
  const get = f.adapter.getMessage;
  f.adapter.getMessage = async id => id === f.original.id ? { status: 503, bodySha256: "unavailable", problem: "HTTP_ERROR" } : get(id);
  await assert.rejects(adoptManualContinuation(f.store, f.request, f.adapter));
  assert.equal(f.store.getOperation(f.operation.operationId).resultDigest, null);
});

test("a POSSIBLE send cannot acquire delivered status through manual adoption", async t => {
  const f = fixture(t);
  const pending = f.store.prepareAction({ ...f.action, actionKey: "possible", participant: { ...f.action.participant, session: "ses_other" } }).operation;
  f.store.startDispatch(pending.operationId);
  await assert.rejects(adoptManualContinuation(f.store, { ...f.request, operationId: pending.operationId, expectedInputDigest: pending.inputDigest }, f.adapter));
  assert.equal(f.store.getOperation(pending.operationId).acknowledgedAt, null);
  assert.equal(f.store.getOperation(pending.operationId).resultDigest, null);
});

test("bounded paginated recovery double-reads the same contiguous slice", async t => {
  const f = fixture(t);
  f.adapter.getHistory = async options => options.before ? reply({ messages: [f.original] }) : reply({ messages: [f.root, f.terminal], nextCursor: "older" });
  assert.equal((await adoptManualContinuation(f.store, f.request, f.adapter)).outcome?.execution, "COMPLETED");
});
