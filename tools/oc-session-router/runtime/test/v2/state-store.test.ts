import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { OperationStore } from "../../src/v2/state-store.js";
import { StoreError, type ActionInput, type TerminalOutcome, type WorkContext } from "../../src/v2/contracts.js";

const terminal: TerminalOutcome = {
  execution: "COMPLETED", evidenceReferences: ["fixture/response"],
  response: { messageId: "fixture-response", rootMessageId: "fixture-root", text: "Review needs changes." },
};

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), "router-v2-store-test-"));
  const database = path.join(root, "router.sqlite");
  const stores: OperationStore[] = [];
  const connect = () => { const store = new OperationStore(database); stores.push(store); return store; };
  t.after(() => { for (const store of stores) store.close(); rmSync(root, { recursive: true, force: true }); });
  const store = connect();
  const work: WorkContext = {
    workId: "fixture-work", target: "fixture-project", directory: root,
    instructionReference: "fixture/owner", scope: "Disposable store verification",
    allowedEffects: ["READ_ONLY", "WORKSPACE_WRITE"], stoppingPoint: "Return evidence",
  };
  store.openWork(work);
  const action: ActionInput = {
    workId: work.workId, actionKey: "fixture-action",
    participant: { namespace: "fixture-config", project: "fixture-project", session: "fixture-session" },
    recipientRole: "Reviewer", kind: "LIFECYCLE", effect: "READ_ONLY", command: "review",
    predecessor: null, input: { commandBody: "Review frozen fixture", source: { reference: "fixture/source", digest: "fixture-digest" } },
  };
  return { root, database, store, connect, work, action };
}

function rejectsCode(action: () => unknown, code: StoreError["code"]): void {
  assert.throws(action, (error: unknown) => error instanceof StoreError && error.code === code);
}

interface ChildResult { code: number | null; messages: Array<{ result?: unknown; error?: string; ready?: boolean }>; stderr: string }
async function child(database: string, payload: object) {
  const processChild = spawn(process.execPath, ["--experimental-sqlite", fileURLToPath(new URL("./store-child.js", import.meta.url)), database, JSON.stringify(payload)], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let stdout = "", stderr = "";
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  processChild.stdout.setEncoding("utf8");
  processChild.stderr.setEncoding("utf8");
  processChild.stdout.on("data", (data: string) => { stdout += data; if (stdout.includes('"ready":true')) readyResolve(); });
  processChild.stderr.on("data", (data: string) => { stderr += data; });
  const done = new Promise<ChildResult>((resolve, reject) => {
    processChild.on("error", error => { readyReject(error); reject(error); });
    processChild.on("close", code => {
      if (!stdout.includes('"ready":true')) readyReject(new Error(`Fixture child failed before ready: ${stderr}`));
      resolve({ code, messages: stdout.trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as ChildResult["messages"][number]), stderr });
    });
  });
  await ready;
  return { run: () => { processChild.stdin.end("go\n"); return done; } };
}

test("stable action and work identity are idempotent; changed input never overwrites provenance", t => {
  const { store, connect, action, work } = fixture(t);
  assert.deepEqual(store.openWork(work).context, work);
  rejectsCode(() => store.openWork({ ...work, scope: "Changed scope" }), "INPUT_CONFLICT");
  const first = store.prepareAction(action);
  assert.equal(first.created, true);
  const repeated = connect().prepareAction({ ...action, input: { source: action.input.source!, commandBody: action.input.commandBody! } });
  assert.equal(repeated.created, false);
  assert.deepEqual(repeated.operation, first.operation);
  for (const changed of [{ input: { commandBody: "Changed" } }, { command: "implement" }, { recipientRole: "Delivery" }, { participant: { ...action.participant, session: "other" } }]) {
    rejectsCode(() => store.prepareAction({ ...action, ...changed }), "INPUT_CONFLICT");
  }
  assert.deepEqual(store.getOperation(first.operation.operationId).action, action);
  assert.equal(store.getWork(work.workId).operations.length, 1);
});

test("concurrent clients create one stable action and exactly one dispatch winner", async t => {
  const { database, action, store } = fixture(t);
  const clients = await Promise.all([child(database, { mode: "prepare", action }), child(database, { mode: "prepare", action })]);
  const outcomes = await Promise.all(clients.map(client => client.run()));
  outcomes.forEach(result => assert.equal(result.code, 0, result.stderr));
  const prepared = outcomes.map(result => result.messages.at(-1)!.result as { created: boolean; operation: { operationId: string } });
  assert.deepEqual(prepared.map(result => result.created).sort(), [false, true]);
  assert.equal(prepared[0]!.operation.operationId, prepared[1]!.operation.operationId);
  const operationId = prepared[0]!.operation.operationId;
  const senders = await Promise.all([child(database, { mode: "dispatch", operationId }), child(database, { mode: "dispatch", operationId })]);
  const started = await Promise.all(senders.map(client => client.run()));
  started.forEach(result => assert.equal(result.code, 0, result.stderr));
  assert.deepEqual(started.map(result => result.messages.at(-1)!.result).sort(), [false, true]);
  assert.notEqual(store.getOperation(operationId).dispatchStartedAt, null);
});

test("aliases share exclusion while independent participants proceed during unresolved work", async t => {
  const { store, work, action, database } = fixture(t);
  const first = store.prepareAction(action).operation;
  store.startDispatch(first.operationId);
  store.openWork({ ...work, workId: "alias-work" });
  rejectsCode(() => store.prepareAction({ ...action, workId: "alias-work", actionKey: "alias-action", recipientRole: "Alias" }), "PARTICIPANT_BUSY");
  const other = { ...action, actionKey: "independent", participant: { ...action.participant, session: "independent-session" } };
  const independent = await child(database, { mode: "prepare", action: other });
  const result = await independent.run();
  assert.equal(result.code, 0, result.stderr);
  const operation = (result.messages.at(-1)!.result as { operation: { operationId: string } }).operation;
  assert.equal(store.startDispatch(operation.operationId), true);
  store.finish(operation.operationId, terminal);
  assert.equal(store.getOperation(first.operationId).completedAt, null);
  rejectsCode(() => store.prepareAction({ ...action, actionKey: "still-busy" }), "PARTICIPANT_BUSY");
  assert.equal(store.prepareAction({ ...action, actionKey: "different-namespace", participant: { ...action.participant, namespace: "unrelated-config" } }).created, true);
});

test("process exit within prepare rolls back both action and claim", async t => {
  const { database, action, connect, work } = fixture(t);
  const crashed = await (await child(database, { mode: "prepare", action, crash: "PREPARE_OPERATION_INSERTED" })).run();
  assert.equal(crashed.code, 93);
  const restarted = connect();
  assert.equal(restarted.getWork(work.workId).operations.length, 0);
  assert.equal(restarted.prepareAction(action).created, true);
});

test("committed prepared action resumes under the original identity after process exit", async t => {
  const { database, action, connect, work } = fixture(t);
  const crashed = await (await child(database, { mode: "prepare", action, crash: "PREPARE_COMMITTED" })).run();
  assert.equal(crashed.code, 93);
  const restarted = connect();
  const existing = restarted.getWork(work.workId).operations[0]!;
  assert.equal(existing.dispatchStartedAt, null);
  const repeat = restarted.prepareAction(action);
  assert.equal(repeat.created, false);
  assert.equal(repeat.operation.operationId, existing.operationId);
  assert.equal(restarted.startDispatch(existing.operationId), true);
  assert.equal(restarted.startDispatch(existing.operationId), false);
});

test("committed send boundary survives exit without inventing receipt or allowing resend", async t => {
  const { database, action, store, connect } = fixture(t);
  const operationId = store.prepareAction(action).operation.operationId;
  const crashed = await (await child(database, { mode: "dispatch", operationId, crash: "DISPATCH_COMMITTED" })).run();
  assert.equal(crashed.code, 93);
  const restarted = connect();
  const operation = restarted.prepareAction(action).operation;
  assert.notEqual(operation.dispatchStartedAt, null);
  assert.equal(operation.acknowledgedAt, null);
  assert.deepEqual(operation.correlation, {});
  assert.equal(restarted.startDispatch(operationId), false);
  restarted.observe(operationId, { activity: "IDLE", observedAt: "2026-09-06T12:00:00Z", context: { processExited: true, waitExpired: true } });
  assert.equal(restarted.getOperation(operationId).completedAt, null);
  rejectsCode(() => restarted.prepareAction({ ...action, actionKey: "replacement" }), "PARTICIPANT_BUSY");
});

for (const checkpoint of ["RESULT_INSERTED", "RESULT_COMMITTED"] as const) {
  test(`finalization is atomic when process exits at ${checkpoint}`, async t => {
    const { database, store, connect, action } = fixture(t);
    const operationId = store.prepareAction(action).operation.operationId;
    store.startDispatch(operationId);
    store.acknowledge(operationId, { rootMessageId: "fixture-root" });
    const crashed = await (await child(database, { mode: "finish", operationId, outcome: terminal, crash: checkpoint })).run();
    assert.equal(crashed.code, 93);
    const restarted = connect();
    const recovered = restarted.getOperation(operationId);
    if (checkpoint === "RESULT_INSERTED") {
      assert.equal(recovered.outcome, null);
      assert.equal(recovered.resultDigest, null);
      assert.equal(recovered.completedAt, null);
      assert.deepEqual(recovered.correlation, { rootMessageId: "fixture-root" });
      rejectsCode(() => restarted.prepareAction({ ...action, actionKey: "next" }), "PARTICIPANT_BUSY");
    } else {
      assert.deepEqual(recovered.outcome, terminal);
      assert.notEqual(recovered.completedAt, null);
      assert.equal(recovered.correlation.responseMessageId, terminal.response!.messageId);
    }
    const finalized = restarted.finish(operationId, terminal);
    assert.deepEqual(restarted.finish(operationId, terminal), finalized);
    rejectsCode(() => restarted.finish(operationId, { ...terminal, execution: "FAILED" }), "RESULT_CONFLICT");
    assert.equal(restarted.prepareAction({ ...action, actionKey: "next", predecessor: operationId }).created, true);
    assert.equal(restarted.prepareAction(action).operation.operationId, operationId);
    assert.equal(restarted.startDispatch(operationId), false);
  });
}

test("delivery and semantic interpretation stay separate; Owner pause survives late completion", t => {
  const { store, connect, action, work } = fixture(t);
  const operationId = store.prepareAction(action).operation.operationId;
  rejectsCode(() => store.acknowledge(operationId, { rootMessageId: "fixture-root" }), "DISPATCH_NOT_STARTED");
  rejectsCode(() => store.finish(operationId, terminal), "DISPATCH_NOT_STARTED");
  store.startDispatch(operationId);
  const ack = store.acknowledge(operationId, { rootMessageId: "fixture-root" });
  assert.notEqual(ack.acknowledgedAt, null);
  assert.equal(ack.completedAt, null);
  assert.equal(ack.interpretation, null);
  rejectsCode(() => store.acknowledge(operationId, { rootMessageId: "wrong-root" }), "CORRELATION_CONFLICT");
  store.recordOwnerPause(work.workId, true, "fixture/owner-pause");
  const completed = store.finish(operationId, terminal);
  assert.equal(completed.interpretation, null);
  const interpretation = { resultDigest: completed.resultDigest!, responsibleRole: "Meta", decision: "CHANGES_REQUIRED", evidenceReferences: ["fixture/response"] };
  rejectsCode(() => store.interpret(operationId, { ...interpretation, resultDigest: "wrong-result" }), "RESULT_CONFLICT");
  assert.deepEqual(store.interpret(operationId, interpretation).interpretation, interpretation);
  assert.deepEqual(store.interpret(operationId, interpretation).interpretation, interpretation);
  rejectsCode(() => store.interpret(operationId, { ...interpretation, decision: "ACCEPTED" }), "RESULT_CONFLICT");
  const resumedStore = connect();
  assert.equal(resumedStore.getWork(work.workId).paused, true);
  assert.equal(resumedStore.getWork(work.workId).pauseReference, "fixture/owner-pause");
  rejectsCode(() => resumedStore.prepareAction({ ...action, actionKey: "next" }), "WORK_PAUSED");
  resumedStore.recordOwnerPause(work.workId, false, "fixture/owner-resume");
  assert.equal(resumedStore.prepareAction({ ...action, actionKey: "next" }).created, true);
});

test("corrupt, unrelated and unsupported databases are rejected without overwriting bytes", t => {
  const root = mkdtempSync(path.join(tmpdir(), "router-v2-invalid-store-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const kind of ["corrupt", "unrelated", "unsupported"] as const) {
    const database = path.join(root, `${kind}.sqlite`);
    if (kind === "corrupt") writeFileSync(database, "This is not a SQLite database.\n");
    else {
      const db = new DatabaseSync(database);
      db.exec("CREATE TABLE unrelated (value TEXT); INSERT INTO unrelated VALUES ('preserve fixture');");
      if (kind === "unsupported") db.exec("PRAGMA user_version=999;");
      db.close();
    }
    const before = readFileSync(database);
    rejectsCode(() => new OperationStore(database), kind === "corrupt" ? "STORE_UNAVAILABLE" : "SCHEMA_UNSUPPORTED");
    assert.deepEqual(readFileSync(database), before);
  }
  rejectsCode(() => new OperationStore(root), "STORE_UNAVAILABLE");
});

test("pause after prepare prevents dispatch; disallowed effects never create an operation", t => {
  const { store, action, work } = fixture(t);
  rejectsCode(() => store.prepareAction({ ...action, effect: "LOCAL_COMMIT" }), "EFFECT_NOT_ALLOWED");
  assert.equal(store.getWork(work.workId).operations.length, 0);
  const prepared = store.prepareAction(action).operation;
  store.recordOwnerPause(work.workId, true, "fixture/pause-before-send");
  rejectsCode(() => store.startDispatch(prepared.operationId), "WORK_PAUSED");
  assert.equal(store.getOperation(prepared.operationId).dispatchStartedAt, null);
  assert.equal(store.prepareAction(action).created, false);
  store.recordOwnerPause(work.workId, false, "fixture/resume-same-action");
  assert.equal(store.startDispatch(prepared.operationId), true);
});

test("lossy or malformed action input is rejected before any durable claim", t => {
  const { store, action, work } = fixture(t);
  for (const input of [17, undefined, { missing: undefined }, { sparse: new Array(2) }, { nonfinite: NaN }]) {
    rejectsCode(() => store.prepareAction({ ...action, input } as ActionInput), "INVALID_INPUT");
  }
  assert.equal(store.getWork(work.workId).operations.length, 0);
  assert.equal(store.prepareAction(action).created, true);
});

test("an unsent preparation can close locally, but a dispatch boundary cannot be cancelled", t => {
  const { store, action } = fixture(t);
  const prepared = store.prepareAction(action).operation;
  const closed = store.abandonPrepared(prepared.operationId, "SOURCE_CHANGED");
  assert.equal(closed.dispatchStartedAt, null);
  assert.equal(closed.outcome?.reason, "NOT_DISPATCHED");
  rejectsCode(() => store.interpret(closed.operationId, { resultDigest: closed.resultDigest!, responsibleRole: "Meta", decision: "ACCEPTED", evidenceReferences: ["fixture/unrelated-acceptance"] }), "RESULT_CONFLICT");
  assert.equal(store.getOperation(closed.operationId).interpretation, null);
  assert.deepEqual(store.abandonPrepared(prepared.operationId, "SOURCE_CHANGED"), closed);
  assert.equal(store.startDispatch(prepared.operationId), false);
  const next = store.prepareAction({ ...action, actionKey: "corrected-source" }).operation;
  assert.equal(store.startDispatch(next.operationId), true);
  rejectsCode(() => store.abandonPrepared(next.operationId, "SOURCE_CHANGED"), "INPUT_CONFLICT");
  rejectsCode(() => store.prepareAction({ ...action, actionKey: "not-a-retry" }), "PARTICIPANT_BUSY");
});
