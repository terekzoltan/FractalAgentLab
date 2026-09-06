import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { RouterEngine, type Adapter, type CompactRequest, type SubmitRequest } from "../../src/v2/engine.js";
import { OperationStore } from "../../src/v2/state-store.js";
import { StoreError, type WorkContext } from "../../src/v2/contracts.js";
import { RouterError, type RouterConfiguration } from "../../src/v2/routing.js";
import type { AdapterReply, CommandSubmission, OpenCodeMessage, SummarizeSubmission } from "../../src/v2/opencode-adapter.js";

function reply<T>(value: T): AdapterReply<T> { return { status: 200, bodySha256: "fixture-digest", value }; }
function errorCode(expected: string) { return (error: unknown) => (error instanceof RouterError || error instanceof StoreError) && error.code === expected; }

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(process.cwd(), ".router-v2-maintenance-"));
  const store = new OperationStore(path.join(root, "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const session = "ses_maintenance_fixture";
  const configuration: RouterConfiguration = { schemaVersion: 2, targets: { fixture: {
    namespace: "maintenance-fixture", project: "maintenance-project", directory: root, origin: "http://fixture.invalid",
    roles: { Delivery: { session, profile: "delivery", capability: "DELIVERY", model: "requested-provider/requested-model", contextLimit: 100_000 } },
  } } };
  const base: OpenCodeMessage = { id: "msg_before_compact", session, role: "assistant", parentId: "msg_previous_root", text: "Prior lifecycle response", hasCompactionPart: false,
    timeCreated: 100, timeCompleted: 200, finish: "stop", providerID: "requested-provider", modelID: "requested-model", tokens: { total: 85_000 } };
  const state: {
    history: OpenCodeMessage[]; busy: boolean; summaries: SummarizeSubmission[]; commands: CommandSubmission[];
    emitEffect: boolean; historyCalls: number; onHistory?: (limit: number, call: number) => void;
  } = { history: [base], busy: false, summaries: [], commands: [], emitEffect: true, historyCalls: 0 };
  function addNativeCompact() {
    state.history.push(
      { id: "msg_native_marker", session, role: "user", text: "", hasCompactionPart: true, timeCreated: 300 },
      { id: "msg_native_summary", session, role: "assistant", parentId: "msg_native_marker", text: "Private fixture summary", hasCompactionPart: false, summary: true,
        timeCreated: 310, timeCompleted: 400, finish: "stop", providerID: "effective-provider", modelID: "effective-model", tokens: { total: 85_000 } },
    );
  }
  const adapter: Adapter = {
    getSession: async () => reply({ id: session, directory: root, projectID: "maintenance-project" }),
    getStatus: async () => reply(state.busy ? "BUSY" : "IDLE"),
    getHistory: async options => {
      state.historyCalls += 1; state.onHistory?.(options.limit, state.historyCalls);
      return reply({ messages: state.history.slice(-options.limit) });
    },
    getMessage: async id => {
      const message = state.history.find(item => item.id === id);
      return message ? reply(message) : { status: 404, bodySha256: "fixture-missing", problem: "HTTP_ERROR" };
    },
    listCommands: async () => reply([{ name: "after-compact", template: "Restore $ARGUMENTS" }, { name: "implement", template: "Implement $ARGUMENTS" }]),
    submitCommand: async command => {
      state.commands.push(command);
      return reply<OpenCodeMessage>({ id: "msg_restore_response", session, role: "assistant", parentId: command.messageID, text: "Restored context only", hasCompactionPart: false, timeCompleted: 500, finish: "stop" });
    },
    submitMessage: async () => { throw new Error("Unexpected message continuation"); },
    summarize: async submission => {
      state.summaries.push(submission);
      if (state.emitEffect) addNativeCompact();
      return reply(true);
    },
  };
  const engine = new RouterEngine(store, configuration, { username: "fixture", password: "fixture" }, () => adapter);
  const work: WorkContext = { workId: "maintenance-work", target: "fixture", directory: root, instructionReference: "fixture/owner", scope: "Maintain the accepted fixture work", allowedEffects: ["SESSION_MAINTENANCE", "WORKSPACE_WRITE", "READ_ONLY"], stoppingPoint: "Return review evidence" };
  engine.openWork(work);
  const compact: CompactRequest = { workId: work.workId, actionKey: "compact-once", recipientRole: "Delivery", model: { providerID: "requested-provider", modelID: "requested-model" } };
  const restore: SubmitRequest = { workId: work.workId, actionKey: "restore-once", recipientRole: "Delivery", kind: "RESTORE" };
  return { root, store, engine, configuration, work, compact, restore, state, addNativeCompact, session };
}

test("compact and restore use one operation/claim path; summary model difference remains evidence", async t => {
  const { store, engine, work, compact, restore, state } = fixture(t);
  const prepared = await engine.prepareCompact(compact);
  assert.ok(prepared.operation);
  assert.equal(prepared.operation.action.kind, "COMPACT");
  assert.equal(prepared.operation.action.effect, "SESSION_MAINTENANCE");
  await assert.rejects(engine.prepare(restore), errorCode("PARTICIPANT_BUSY"));
  const completed = await engine.execute(prepared.operation.operationId);
  assert.equal(completed.outcome?.execution, "COMPLETED");
  assert.equal(completed.outcome?.response, undefined);
  assert.equal(completed.interpretation, null);
  assert.deepEqual(state.summaries, [{ providerID: "requested-provider", modelID: "requested-model", auto: false }]);
  assert.deepEqual(completed.observation?.context?.model, {
    requested: { providerID: "requested-provider", modelID: "requested-model" },
    effective: { providerID: "effective-provider", modelID: "effective-model" }, matchesRequested: false,
  });
  assert.equal(state.commands.length, 0, "Compaction must not dispatch a hidden continuation");
  assert.equal((await engine.prepareCompact(compact)).operation!.operationId, completed.operationId);
  await engine.execute(completed.operationId);
  assert.equal(state.summaries.length, 1);
  const restoreRequest = { ...restore, predecessor: completed.operationId };
  const preparedRestore = await engine.prepare(restoreRequest);
  assert.equal(preparedRestore.operation.action.command, "after-compact");
  assert.equal(preparedRestore.operation.participantKey, completed.participantKey);
  const restored = await engine.execute(preparedRestore.operation.operationId);
  assert.equal(restored.outcome?.execution, "COMPLETED");
  assert.equal(state.commands.length, 1);
  assert.equal(state.commands[0]!.messageID, restored.messageId);
  assert.equal(state.commands[0]!.command, "after-compact");
  assert.ok(state.commands[0]!.arguments.startsWith("fixture delivery"));
  for (const reference of [work.workId, work.scope, work.stoppingPoint, completed.operationId]) assert.ok(state.commands[0]!.arguments.includes(reference));
  assert.match(state.commands[0]!.arguments, /do not start or repeat lifecycle work/);
  assert.doesNotMatch(state.commands[0]!.arguments, /Private fixture summary/);
  assert.equal((await engine.prepare(restoreRequest)).created, false);
  await engine.execute(restored.operationId);
  assert.equal(state.commands.length, 1);
  assert.equal(store.getWork(work.workId).operations.length, 2);
});

test("busy compact remains unresolved; observed completion preserves Owner pause", async t => {
  const { store, engine, work, compact, restore, state, addNativeCompact } = fixture(t);
  state.busy = true;
  const observation = await engine.observe(work.workId, "Delivery");
  assert.equal(observation.activity, "BUSY");
  await assert.rejects(engine.prepareCompact(compact), errorCode("PARTICIPANT_BUSY"));
  assert.equal(store.getWork(work.workId).operations.length, 0);
  state.busy = false;
  const prepared = await engine.prepareCompact(compact);
  state.emitEffect = false;
  const pending = await engine.execute(prepared.operation!.operationId);
  assert.equal(pending.completedAt, null);
  assert.equal(pending.acknowledgedAt, null, "HTTP acceptance alone does not prove a compact effect");
  state.busy = true;
  const working = await engine.reconcile(pending.operationId);
  assert.equal(working.operation.completedAt, null);
  assert.equal(working.operation.observation?.activity, "BUSY");
  assert.equal(state.summaries.length, 1);
  store.recordOwnerPause(work.workId, true, "fixture/pause");
  addNativeCompact(); state.busy = false;
  const completed = await engine.reconcile(pending.operationId);
  assert.equal(completed.operation.outcome?.execution, "COMPLETED");
  assert.equal(store.getWork(work.workId).paused, true);
  await assert.rejects(engine.prepare(restore), errorCode("WORK_PAUSED"));
  assert.equal(state.commands.length, 0);
  assert.equal(state.summaries.length, 1);
});

test("native completed compact and empty session are no-send outcomes without operation claims", async t => {
  const { store, engine, work, compact, state, addNativeCompact } = fixture(t);
  addNativeCompact();
  const native = await engine.prepareCompact(compact);
  assert.equal(native.disposition, "ALREADY_COMPACTED");
  assert.equal(native.operation, null);
  assert.equal(state.summaries.length, 0);
  state.history = [];
  const empty = await engine.prepareCompact({ ...compact, actionKey: "empty" });
  assert.equal(empty.disposition, "EMPTY_SESSION");
  assert.equal(empty.operation, null);
  assert.equal(store.getWork(work.workId).operations.length, 0);
});

test("session observation is stored publicly without raw identity or transcript; orchestrator compact is manual", async t => {
  const { store, engine, work, configuration, compact, state, root, session } = fixture(t);
  const snapshot = await engine.observe(work.workId, "Delivery");
  assert.equal(snapshot.activity, "IDLE");
  assert.equal(snapshot.pressure.state, "critical");
  assert.deepEqual(store.getWork(work.workId).observations.Delivery, snapshot);
  const serialized = JSON.stringify(store.getWork(work.workId).observations);
  for (const privateValue of [session, root, "Prior lifecycle response", "msg_before_compact"]) assert.ok(!serialized.includes(privateValue));
  configuration.targets.fixture!.roles.Delivery!.capability = "ORCHESTRATOR";
  await assert.rejects(engine.prepareCompact(compact), errorCode("ORCHESTRATOR_COMPACT_IS_MANUAL"));
  assert.equal(state.summaries.length, 0);
  assert.equal(store.getWork(work.workId).operations.length, 0);
});

test("native compact arriving between baseline capture and observation prevents an extra summarize", async t => {
  const { engine, compact, state, addNativeCompact, store, work } = fixture(t);
  const limits: number[] = [];
  state.onHistory = (limit, call) => {
    limits.push(limit);
    if (call === 2) addNativeCompact();
  };
  const prepared = await engine.prepareCompact(compact);
  assert.equal(limits[0], 1, "Freeze latest head before broader observation");
  assert.equal(prepared.disposition, "ALREADY_COMPACTED");
  assert.equal(state.summaries.length, 0);
  assert.equal(store.getWork(work.workId).operations.length, 0);
});

test("head changes after preparation block summarize before the durable send boundary", async t => {
  const { engine, compact, state, addNativeCompact, store } = fixture(t);
  const prepared = await engine.prepareCompact(compact);
  addNativeCompact();
  await assert.rejects(engine.execute(prepared.operation!.operationId), errorCode("MAINTENANCE_BASELINE_CHANGED"));
  assert.equal(store.getOperation(prepared.operation!.operationId).dispatchStartedAt, null);
  assert.equal(state.summaries.length, 0);
  assert.equal(state.commands.length, 0);
});
