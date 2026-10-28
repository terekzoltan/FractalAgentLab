import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { digest, type ActionInput, type Json, type TerminalOutcome } from "../../src/v2/contracts.js";
import { freezeSources, readFrozenSource, renderSources } from "../../src/v2/context-packet.js";
import { attachLateResult } from "../../src/v2/late-result.js";
import { textSha256 } from "../../src/v2/manual-continuation.js";
import type { AdapterReply, OpenCodeAdapter, OpenCodeMessage } from "../../src/v2/opencode-adapter.js";
import type { ReconcileReader } from "../../src/v2/reconcile.js";
import { OperationStore } from "../../src/v2/state-store.js";

const ok = <T>(value: T): AdapterReply<T> => ({ status: 200, value, bodySha256: "offline-fixture" });

function fixture(t: TestContext, options: { manual?: boolean; pending?: boolean; successful?: boolean; amended?: boolean } = {}) {
  const directory = mkdtempSync(path.join(process.cwd(), ".late-result-test-"));
  const store = new OperationStore(path.join(directory, "router.sqlite"));
  const sql = new DatabaseSync(store.databasePath);
  t.after(() => { sql.close(); store.close(); rmSync(directory, { recursive: true, force: true }); });
  store.openWork({ workId: "w", target: "fixture", directory, instructionReference: "owner:planning", scope: "prerequisite planning and review", allowedEffects: ["READ_ONLY"], stoppingPoint: "reviewed plan only" });
  if (options.amended) store.amendWork({ workId: "w", amendmentKey: "later-planning", expectedAuthorizationRevision: store.getWork("w").authorization.revision, instructionReference: "owner:later-planning", constraints: "same planning, no execution", addEffects: ["WORKSPACE_WRITE"] });
  const action: ActionInput = { workId: "w", actionKey: "review", participant: { namespace: "fixture", project: "p", session: "ses_meta" }, recipientRole: "Meta", kind: "LIFECYCLE", effect: "READ_ONLY", command: "terv-review", predecessor: null, input: { arguments: "Review the exact retained INITIAL", address: { origin: "http://127.0.0.1:1", directory, session: "ses_meta" } } };
  let operation = store.prepareAction(action).operation;
  store.startDispatch(operation.operationId);
  operation = store.acknowledge(operation.operationId, { rootMessageId: operation.messageId });
  if (!options.pending) operation = store.finish(operation.operationId, { execution: options.successful ? "COMPLETED" : "FAILED", reason: options.successful ? "DONE" : "REMOTE_EXECUTION_FAILED", evidenceReferences: ["fixture:original-remote-failure"] });
  const at = Date.parse(operation.completedAt ?? operation.createdAt) + 1000;
  const message = (id: string, role: "user" | "assistant", created: number, extra: Partial<OpenCodeMessage> = {}): OpenCodeMessage => ({ id, role, session: "ses_meta", text: "", timeCreated: created, hasCompactionPart: false, ...extra });
  const original = message(operation.messageId, "user", Date.parse(operation.createdAt), { text: action.input.arguments as string });
  const failed = message("msg_failed", "assistant", at - 1000, { parentId: original.id, error: true, timeCompleted: at - 1000, finish: "error" });
  const root = options.manual ? message("msg_manual", "user", at, { text: "Continue the same existing review; no new review" }) : original;
  const terminal = message("msg_late", "assistant", at + 1, { parentId: root.id, timeCompleted: at + 2, finish: "stop", text: "META PLAN REVIEW\nRED\nC1PR-01 requires bounded planning correction." });
  const state = { messages: [original, failed, ...(options.manual ? [root] : []), terminal], busy: false, wrongSession: false, wrongDirectory: false, mutate: false, reads: 0 };
  const adapter: ReconcileReader & Pick<OpenCodeAdapter, "getPendingInteractions"> = {
    getSession: async () => ok({ id: state.wrongSession ? "ses_other" : "ses_meta", projectID: "p", directory: state.wrongDirectory ? path.join(directory, "other") : directory }),
    getStatus: async () => ok(state.busy ? "BUSY" : "IDLE"),
    getPendingInteractions: async () => ({ permissions: 0, questions: 0 }),
    getMessage: async id => { const item = state.messages.find(m => m.id === id); return item ? ok(structuredClone(item)) : { status: 404, bodySha256: "missing", problem: "HTTP_ERROR" }; },
    getHistory: async () => {
      state.reads++;
      return ok({ messages: structuredClone(state.messages).map(m => state.mutate && state.reads >= 2 && m.id === terminal.id ? { ...m, text: "changed" } : m) });
    },
  };
  const request = { operationId: operation.operationId, expectedInputDigest: operation.inputDigest, expectedResultDigest: operation.resultDigest ?? "0".repeat(64), rootMessageId: root.id, rootTextSha256: textSha256(root.text), terminalMessageId: terminal.id, terminalTextSha256: textSha256(terminal.text), instructionReference: "owner:recover-existing-review", intentVerificationReference: "same INITIAL and existing review; no acceptance or execution" };
  const snapshot = () => JSON.stringify(sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all().map(table => ({ table, rows: sql.prepare(`SELECT * FROM "${String(table.name).replaceAll('"', '""')}" ORDER BY rowid`).all() })));
  return { directory, store, sql, action, operation, original, failed, root, terminal, state, adapter, request, snapshot };
}

for (const manual of [false, true]) {
  test(`late review is separate local evidence and preserves failed original (${manual ? "manual" : "same"} root)`, async t => {
    const f = fixture(t, { manual });
    const pending = f.store.prepareAction({ ...f.action, actionKey: "unrelated", participant: { ...f.action.participant, session: "ses_unrelated" } }).operation;
    f.store.recordOwnerPause("w", true, "owner:still-paused");
    const before = f.store.getWork("w");
    const claims = f.sql.prepare("SELECT * FROM session_claims ORDER BY participant_key").all();
    const result = await attachLateResult(f.store, f.request, f.adapter);
    const recovered = result.operation;
    assert.equal(result.attached, true);
    assert.equal(result.verifiedOnly, false);
    assert.equal(result.verificationPerformed, true);
    assert.notEqual(recovered.operationId, f.operation.operationId);
    assert.equal(recovered.action.workId, "w");
    assert.equal(recovered.action.kind, "RECOVERED_RESULT");
    assert.equal(recovered.action.predecessor, null);
    assert.equal(recovered.dispatchStartedAt, null);
    assert.equal(recovered.acknowledgedAt, null);
    assert.deepEqual(recovered.correlation, {});
    assert.equal(recovered.outcome?.artifact?.text, f.terminal.text);
    assert.equal(recovered.outcome?.artifact?.sha256, f.request.terminalTextSha256);
    assert.equal(recovered.outcome?.response, undefined);
    assert.equal(recovered.outcome?.lateRecovery?.evidenceOnly, true);
    assert.equal(recovered.outcome?.lateRecovery?.nativeLineageRestored, false);
    assert.equal(recovered.outcome?.lateRecovery?.productAcceptance, false);
    assert.equal(recovered.outcome?.lateRecovery?.implementationAccepted, false);
    assert.equal(recovered.outcome?.lateRecovery?.originalInputDigest, f.operation.inputDigest);
    assert.equal(recovered.outcome?.lateRecovery?.originalResultDigest, f.operation.resultDigest);
    assert.equal(recovered.interpretation, null);
    assert.deepEqual(f.store.getOperation(f.operation.operationId), f.operation);
    assert.deepEqual(f.store.getOperation(pending.operationId), pending);
    assert.deepEqual(f.sql.prepare("SELECT * FROM session_claims ORDER BY participant_key").all(), claims);
    assert.equal(f.store.getWork("w").paused, true);
    assert.equal(f.store.getWork("w").pauseReference, "owner:still-paused");
    assert.deepEqual(f.store.getWork("w").authorization, before.authorization);
    assert.deepEqual(f.store.getWork("w").context, before.context);
    assert.equal(f.store.startDispatch(recovered.operationId), false);
    f.store.recordOwnerPause("w", false, "test only: verify predecessor refusal");
    assert.throws(() => f.store.prepareAction({ ...f.action, actionKey: "forbidden-dependent-dispatch", predecessor: recovered.operationId }));
    const reads = f.state.reads;
    assert.equal((await attachLateResult(f.store, f.request, f.adapter)).operation.operationId, recovered.operationId);
    assert.equal(f.state.reads, reads);
    await assert.rejects(attachLateResult(f.store, { ...f.request, intentVerificationReference: "different attestation" }, f.adapter));
  });
}

test("dry-run verifies through a read-only store without changing SQLite bytes or rows", async t => {
  const f = fixture(t, { manual: true });
  f.store.recordOwnerPause("w", true, "owner:pause");
  const before = f.snapshot();
  const files = [f.store.databasePath, `${f.store.databasePath}-wal`].filter(existsSync);
  const bytes = files.map(file => readFileSync(file));
  const reader = new OperationStore(f.store.databasePath, { readOnly: true });
  try {
    const result = await attachLateResult(reader, f.request, f.adapter, false);
    assert.equal(result.verifiedOnly, true);
    assert.equal(result.verificationPerformed, true);
    assert.equal(result.attached, false);
    assert.deepEqual(result.operation, f.operation);
  } finally { reader.close(); }
  assert.equal(f.snapshot(), before);
  files.forEach((file, index) => assert.deepEqual(readFileSync(file), bytes[index]));
  assert.ok(f.state.reads >= 2);
});

test("schema-2 amended work retains its authorization and pause", async t => {
  const f = fixture(t, { amended: true, manual: true });
  f.store.recordOwnerPause("w", true, "owner:pause");
  const authorization = f.store.getWork("w").authorization;
  const recovered = (await attachLateResult(f.store, f.request, f.adapter)).operation;
  assert.equal(f.sql.prepare("PRAGMA user_version").get()!.user_version, 2);
  assert.deepEqual(f.store.getWork("w").authorization, authorization);
  assert.equal(recovered.authorizationRevision, authorization.revision);
  assert.equal(f.store.getWork("w").paused, true);
});

test("a missing original remote root stays an explicit provenance limitation", async t => {
  const f = fixture(t, { manual: true });
  f.state.messages = f.state.messages.filter(m => m.id !== f.original.id);
  const recovered = (await attachLateResult(f.store, f.request, f.adapter)).operation;
  const proof = recovered.outcome?.lateRecovery?.sourceProof as Record<string, Json>;
  assert.equal(proof.originalRootEvidence, "DURABLE_ACKNOWLEDGEMENT_REMOTE_ROOT_NOT_FOUND");
  assert.equal(proof.rootMatchesOriginal, false);
  assert.equal(proof.exhaustiveHistoryVerified, false);
  assert.equal(recovered.outcome?.lateRecovery?.nativeLineageRestored, false);
  assert.deepEqual(f.store.getOperation(f.operation.operationId), f.operation);
});

test("unavailable original evidence is not treated as a missing original root", async t => {
  const f = fixture(t, { manual: true });
  const getMessage = f.adapter.getMessage;
  f.adapter.getMessage = async id => id === f.original.id ? { status: 503, bodySha256: "unavailable", problem: "HTTP_ERROR" } : getMessage(id);
  const before = f.snapshot();
  await assert.rejects(attachLateResult(f.store, f.request, f.adapter));
  assert.equal(f.snapshot(), before);
});

test("same-original-root recovery rejects alternating missing and present root reads", async t => {
  const f = fixture(t);
  const getMessage = f.adapter.getMessage;
  let rootReads = 0;
  f.adapter.getMessage = async id => {
    if (id === f.original.id && ++rootReads === 1) return { status: 404, bodySha256: "missing", problem: "HTTP_ERROR" };
    return getMessage(id);
  };
  const before = f.snapshot();
  await assert.rejects(attachLateResult(f.store, f.request, f.adapter));
  assert.equal(f.snapshot(), before);
});

test("already-attached dry-run labels retained evidence without fresh verification or GET calls", async t => {
  const f = fixture(t);
  const attached = await attachLateResult(f.store, f.request, f.adapter);
  assert.equal(attached.verificationPerformed, true);
  f.state.busy = true;
  f.state.messages = [];
  let calls = 0;
  const unavailable = async (): Promise<never> => { calls++; throw new Error("changed server must not be consulted for retained evidence"); };
  f.adapter.getSession = unavailable;
  f.adapter.getStatus = unavailable;
  f.adapter.getMessage = unavailable;
  f.adapter.getHistory = unavailable;
  f.adapter.getPendingInteractions = unavailable;
  const before = f.snapshot();
  const retained = await attachLateResult(f.store, f.request, f.adapter, false);
  assert.equal(retained.attached, true);
  assert.equal(retained.verifiedOnly, false);
  assert.equal(retained.verificationPerformed, false);
  assert.deepEqual(retained.operation, attached.operation);
  assert.equal(calls, 0);
  assert.equal(f.snapshot(), before);
});

for (const scenario of ["completed-success", "pending", "wrong-input", "wrong-result", "wrong-root-hash", "wrong-terminal-hash", "wrong-root", "wrong-parent", "wrong-session", "wrong-directory", "busy", "terminal-error", "nonterminal", "summary", "truncated", "competing-terminal", "later-user", "later-assistant", "changing-history", "terminal-before-failure", "missing-attestation"] as const) {
  test(`late review rejects ${scenario} without changing operations, claims, pause or schema`, async t => {
    const f = fixture(t, { manual: true, successful: scenario === "completed-success", pending: scenario === "pending" });
    f.store.recordOwnerPause("w", true, "owner:pause");
    if (scenario === "wrong-input") f.request.expectedInputDigest = "0".repeat(64);
    if (scenario === "wrong-result") f.request.expectedResultDigest = "0".repeat(64);
    if (scenario === "wrong-root-hash") f.request.rootTextSha256 = "0".repeat(64);
    if (scenario === "wrong-terminal-hash") f.request.terminalTextSha256 = "0".repeat(64);
    if (scenario === "wrong-root") f.root.role = "assistant";
    if (scenario === "wrong-parent") f.terminal.parentId = "msg_other";
    if (scenario === "wrong-session") f.state.wrongSession = true;
    if (scenario === "wrong-directory") f.state.wrongDirectory = true;
    if (scenario === "busy") f.state.busy = true;
    if (scenario === "terminal-error") f.terminal.error = true;
    if (scenario === "nonterminal") delete f.terminal.timeCompleted;
    if (scenario === "summary") f.terminal.summary = true;
    if (scenario === "truncated") f.state.messages = f.state.messages.filter(m => m.id !== f.root.id);
    if (scenario === "competing-terminal") f.state.messages.push({ ...f.terminal, id: "msg_competing" });
    if (scenario === "later-user") f.state.messages.push({ ...f.root, id: "msg_later_user", timeCreated: f.terminal.timeCompleted! + 1 });
    if (scenario === "later-assistant") f.state.messages.push({ ...f.terminal, id: "msg_later_assistant", parentId: "msg_unrelated", timeCreated: f.terminal.timeCompleted! + 1, timeCompleted: f.terminal.timeCompleted! + 2 });
    if (scenario === "changing-history") f.state.mutate = true;
    if (scenario === "terminal-before-failure") { f.terminal.timeCreated = Date.parse(f.operation.completedAt!) - 2; f.terminal.timeCompleted = Date.parse(f.operation.completedAt!) - 1; }
    if (scenario === "missing-attestation") f.request.intentVerificationReference = "";
    const before = f.snapshot();
    await assert.rejects(attachLateResult(f.store, f.request, f.adapter));
    assert.equal(f.snapshot(), before);
  });
}

test("idempotency conflicts retain the previously attached artifact", async t => {
  const f = fixture(t);
  const first = (await attachLateResult(f.store, f.request, f.adapter)).operation;
  const before = f.snapshot();
  await assert.rejects(attachLateResult(f.store, { ...f.request, terminalTextSha256: digest("different terminal") }, f.adapter));
  assert.equal(f.snapshot(), before);
  assert.deepEqual(f.store.getOperation(first.operationId), first);
});

test("frozen result sources expose recovery provenance and preserve the exact raw review", async t => {
  const f = fixture(t, { manual: true });
  const recovered = (await attachLateResult(f.store, f.request, f.adapter)).operation;
  const sources = freezeSources(f.store, f.store.getWork("w").context, [{ operationId: recovered.operationId, mode: "inline" }]);
  const provenance = { originalOperationId: f.operation.operationId, originalInputDigest: f.operation.inputDigest, originalResultDigest: f.operation.resultDigest, evidenceOnly: true, nativeLineageRestored: false, productAcceptance: false };
  assert.equal(sources[0]!.content, f.terminal.text);
  assert.deepEqual(sources[0]!.recoveryProvenance, provenance);
  const rendered = renderSources("w", sources);
  assert.match(rendered, /recover/i);
  assert.match(rendered, /evidence/i);
  assert.ok(rendered.includes(f.operation.operationId));
  assert.ok(rendered.includes(f.terminal.text));
  f.store.prepareAction({ ...f.action, actionKey: "consumer-with-frozen-review", input: { sources: sources as unknown as Json } });
  const before = f.snapshot();
  const source = readFrozenSource(f.store, { workId: "w", sourceId: sources[0]!.sourceId });
  assert.equal(source.content, f.terminal.text);
  assert.equal(source.selectedTextSha256, f.request.terminalTextSha256);
  assert.deepEqual(source.recoveryProvenance, provenance);
  assert.equal(source.lifecycleSend, false);
  assert.equal(f.snapshot(), before);
});

function localReceipt(f: ReturnType<typeof fixture>): TerminalOutcome {
  return { execution: "COMPLETED", evidenceReferences: ["fixture:verified-late-review"], artifact: { text: f.terminal.text, sha256: f.request.terminalTextSha256 }, lateRecovery: { requestDigest: digest(f.request), originalOperationId: f.operation.operationId, originalInputDigest: f.operation.inputDigest, originalResultDigest: f.operation.resultDigest, evidenceOnly: true, nativeLineageRestored: false, productAcceptance: false } };
}
function workDigest(f: ReturnType<typeof fixture>) {
  const { context, authorization, paused, pauseReference } = f.store.getWork("w");
  return digest({ context, authorization, paused, pauseReference });
}

test("direct local attachment enforces source and work compare-and-swap before inserting evidence", t => {
  const f = fixture(t);
  const outcome = localReceipt(f), requestDigest = digest(f.request);
  const before = f.snapshot();
  assert.throws(() => f.store.attachRecoveredResult(f.operation.operationId, requestDigest, outcome, "0".repeat(64), workDigest(f)));
  assert.equal(f.snapshot(), before);
  assert.throws(() => f.store.attachRecoveredResult(f.operation.operationId, requestDigest, outcome, digest(f.operation), "0".repeat(64)));
  assert.equal(f.snapshot(), before);
  assert.throws(() => f.store.attachRecoveredResult(f.operation.operationId, requestDigest, { ...outcome, artifact: { text: "altered", sha256: f.request.terminalTextSha256 } }, digest(f.operation), workDigest(f)));
  assert.equal(f.snapshot(), before);
  assert.throws(() => f.store.prepareAction({ ...f.action, actionKey: "manufactured-receipt", kind: "RECOVERED_RESULT" }));
  assert.equal(f.snapshot(), before);
});

test("local receipt and result insertion roll back together at the result checkpoint", t => {
  const f = fixture(t);
  const before = f.snapshot();
  const crashing = new OperationStore(f.store.databasePath, { checkpoint: checkpoint => { if (checkpoint === "RESULT_INSERTED") throw new Error("offline fixture crash"); } });
  try {
    assert.throws(() => crashing.attachRecoveredResult(f.operation.operationId, digest(f.request), localReceipt(f), digest(f.operation), workDigest(f)));
  } finally { crashing.close(); }
  assert.equal(f.snapshot(), before);
  const recovered = f.store.attachRecoveredResult(f.operation.operationId, digest(f.request), localReceipt(f), digest(f.operation), workDigest(f));
  assert.equal(recovered.action.kind, "RECOVERED_RESULT");
  assert.deepEqual(f.store.getOperation(f.operation.operationId), f.operation);
});
