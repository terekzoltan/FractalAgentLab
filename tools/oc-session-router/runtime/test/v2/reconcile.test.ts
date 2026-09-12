import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { OperationStore } from "../../src/v2/state-store.js";
import { type ActionInput, type Operation, StoreError } from "../../src/v2/contracts.js";
import { reconcileOperation, outcomeForMessage, type ReconcileReader } from "../../src/v2/reconcile.js";
import type { AdapterReply, MessageHistory, OpenCodeMessage, OpenCodeSession } from "../../src/v2/opencode-adapter.js";

function ok<T>(value: T): AdapterReply<T> { return { status: 200, bodySha256: "fixture-digest", value }; }
function missing<T>(): AdapterReply<T> { return { status: 404, bodySha256: "fixture-digest", problem: "HTTP_ERROR" }; }
function rootMessage(operation: Operation): OpenCodeMessage {
  return { id: operation.messageId, session: operation.action.participant.session, role: "user", text: "dispatch-time installed command bytes", timeCreated: 1, hasCompactionPart: false };
}
function answer(operation: Operation, id = "msg_answer", overrides: Partial<OpenCodeMessage> = {}): OpenCodeMessage {
  return { id, session: operation.action.participant.session, parentId: operation.messageId, role: "assistant", text: "Review requires changes; exact wording is not acceptance.", timeCreated: 20, timeCompleted: 30, finish: "stop", hasCompactionPart: false, ...overrides };
}
function fixture(t: TestContext, kind: ActionInput["kind"] = "LIFECYCLE", started = true) {
  const directory = mkdtempSync(path.join(tmpdir(), "router-v2-reconcile-"));
  const store = new OperationStore(path.join(directory, "router.sqlite"));
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  store.openWork({ workId: "work", target: "project", directory, instructionReference: "fixture/owner", scope: "Read-only synthetic recovery", allowedEffects: ["READ_ONLY"], stoppingPoint: "Return evidence" });
  const action: ActionInput = { workId: "work", actionKey: "action", participant: { namespace: "fixture", project: "project", session: "ses_fixture" }, recipientRole: "review", kind, effect: "READ_ONLY", command: "review", predecessor: null, input: { commandBody: "old command template", source: "old-source-reference" } };
  const operation = store.prepareAction(action).operation;
  if (started) store.startDispatch(operation.operationId);
  const reader = new FakeReader(operation, directory);
  return { directory, store, action, operation, reader };
}
class FakeReader implements ReconcileReader {
  calls: string[] = [];
  messages = new Map<string, AdapterReply<OpenCodeMessage>>();
  pages = new Map<string, AdapterReply<MessageHistory>>();
  session: AdapterReply<OpenCodeSession>;
  activity: AdapterReply<"BUSY" | "IDLE" | "UNKNOWN"> = ok("IDLE");
  failMessages = false;
  constructor(operation: Operation, directory: string) {
    this.session = ok({ id: operation.action.participant.session, directory, projectID: operation.action.participant.project });
    this.messages.set(operation.messageId, ok(rootMessage(operation)));
    this.pages.set("newest", ok({ messages: [rootMessage(operation)] }));
  }
  async getSession() { this.calls.push("session"); return this.session; }
  async getStatus() { this.calls.push("status"); return this.activity; }
  async getMessage(id: string) { this.calls.push(`message:${id}`); if (this.failMessages) throw new Error("private fixture exception must not persist"); return this.messages.get(id) ?? missing<OpenCodeMessage>(); }
  async getHistory(options: { limit: number; before?: string }) { this.calls.push(`history:${options.before ?? "newest"}`); return this.pages.get(options.before ?? "newest") ?? missing<MessageHistory>(); }
  async submitCommand(): Promise<never> { throw new Error("No reconciliation sends allowed"); }
  async abort(): Promise<never> { throw new Error("No reconciliation aborts allowed"); }
  async listCommands(): Promise<never> { throw new Error("Historical recovery must not read today's template"); }
}

function compactChain(operation: Operation): OpenCodeMessage[] {
  return [rootMessage(operation), answer(operation, "msg_progress", { finish: "tool-calls", timeCreated: 2, timeCompleted: 3 }),
    { ...rootMessage(operation), id: "msg_compact", timeCreated: 4, hasCompactionPart: true, autoCompaction: true },
    answer(operation, "msg_summary", { parentId: "msg_compact", summary: true, timeCreated: 5, timeCompleted: 6 }),
    { ...rootMessage(operation), id: "msg_continue", timeCreated: 7, compactionContinue: true, text: "" },
    answer(operation, "msg_final", { parentId: "msg_continue", timeCreated: 8, timeCompleted: 9 })];
}
function installHistory(reader: FakeReader, history: OpenCodeMessage[]) {
  reader.pages.set("newest", ok({ messages: history }));
  for (const message of history) reader.messages.set(message.id, ok(message));
}

test("native compaction continuation completes original operation without rewriting actual parent or sending", async t => {
  const { store, operation, reader } = fixture(t);
  installHistory(reader, compactChain(operation));
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(result.disposition, "COMPLETED");
  assert.equal(result.operation.outcome?.response?.rootMessageId, operation.messageId);
  assert.equal(result.operation.outcome?.response?.parentMessageId, "msg_continue");
  assert.ok(result.operation.outcome?.evidenceReferences.some(e => e.startsWith("opencode-native-continuation-sha256:")));
  assert.equal(store.startDispatch(operation.operationId), false);
  assert.equal((await reconcileOperation(store, operation.operationId, reader)).disposition, "STORED");
});

test("missing marker, manual compact, failed summary, extra user or missing history cannot donate a result", async t => {
  for (const mutation of ["marker", "manual", "summary", "user", "gap"] as const) {
    const { store, operation, reader } = fixture(t);
    const history = compactChain(operation);
    if (mutation === "marker") history[4]!.compactionContinue = false;
    if (mutation === "manual") history[2]!.autoCompaction = false;
    if (mutation === "summary") history[3]!.error = true;
    if (mutation === "user") history.splice(4, 0, { ...rootMessage(operation), id: "msg_other", timeCreated: 6.5 });
    if (mutation === "gap") history.splice(3, 1);
    installHistory(reader, history);
    const result = await reconcileOperation(store, operation.operationId, reader);
    assert.equal(result.operation.completedAt, null, mutation);
    assert.ok(result.operation.acknowledgedAt, mutation);
  }
});

test("multiple continuation terminals are ambiguous; later independent answer is not selected", async t => {
  const { store, operation, reader } = fixture(t);
  const history = compactChain(operation);
  history.push(answer(operation, "msg_second", { parentId: "msg_continue", timeCreated: 10, timeCompleted: 11 }));
  installHistory(reader, history);
  assert.equal((await reconcileOperation(store, operation.operationId, reader)).disposition, "AMBIGUOUS");
  const isolated = fixture(t);
  const valid = compactChain(isolated.operation);
  valid.push({ ...rootMessage(isolated.operation), id: "msg_independent", timeCreated: 10 },
    answer(isolated.operation, "msg_unrelated", { parentId: "msg_independent", timeCreated: 11, timeCompleted: 12 }));
  installHistory(isolated.reader, valid);
  const result = await reconcileOperation(isolated.store, isolated.operation.operationId, isolated.reader);
  assert.equal(result.operation.outcome?.response?.messageId, "msg_final");
  const mixed = fixture(t);
  const competing = compactChain(mixed.operation);
  competing.push(answer(mixed.operation, "msg_late_direct", {timeCreated: 10, timeCompleted: 11}));
  installHistory(mixed.reader, competing);
  assert.equal((await reconcileOperation(mixed.store, mixed.operation.operationId, mixed.reader)).disposition, "AMBIGUOUS");
});

test("continuation metadata spans bounded pages and revalidates anchors before finishing", async t => {
  const { store, operation, reader } = fixture(t);
  const history = compactChain(operation);
  for (const message of history) reader.messages.set(message.id, ok(message));
  reader.pages.set("newest", ok({ messages: history.slice(4), nextCursor: "middle" }));
  reader.pages.set("middle", ok({ messages: history.slice(2,4), nextCursor: "root" }));
  reader.pages.set("root", ok({ messages: history.slice(0,2) }));
  assert.equal((await reconcileOperation(store, operation.operationId, reader, {pageBudget: 1})).disposition, "CONTINUE");
  reader.messages.set("msg_continue", ok({...history[4]!, compactionContinue: false}));
  assert.equal((await reconcileOperation(store, operation.operationId, reader, {pageBudget: 1})).operation.observation?.context?.reason, "CONTINUATION_PROOF_CHANGED");
  reader.messages.set("msg_continue", ok(history[4]!));
  assert.equal((await reconcileOperation(store, operation.operationId, reader, {pageBudget: 1})).disposition, "COMPLETED");
});

test("repeated native compactions retain the original root and release its claim only on completion", async t => {
  const {store, operation, reader, action} = fixture(t);
  const history = compactChain(operation);
  history[5] = {...history[5]!, finish: "tool-calls"};
  history.push({...rootMessage(operation), id: "msg_compact2", timeCreated: 10, hasCompactionPart: true, autoCompaction: true},
    answer(operation, "msg_summary2", {parentId: "msg_compact2", summary: true, timeCreated: 11, timeCompleted: 12}),
    {...rootMessage(operation), id: "msg_continue2", timeCreated: 13, compactionContinue: true},
    answer(operation, "msg_final2", {parentId: "msg_continue2", timeCreated: 14, timeCompleted: 15}));
  installHistory(reader, history);
  store.recordOwnerPause("work", true, "Owner pause remains");
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(result.disposition, "COMPLETED");
  assert.equal(result.operation.outcome?.response?.rootMessageId, operation.messageId);
  assert.equal(result.operation.outcome?.response?.parentMessageId, "msg_continue2");
  assert.equal(store.getWork("work").paused, true);
  store.recordOwnerPause("work", false, "synthetic test only");
  assert.ok(store.prepareAction({...action, actionKey: "next-fixture"}).created);
});

test("changing newest history during proof and foreign-session links never finish", async t => {
  for (const mode of ["head", "session"] as const) {
    const {store, operation, reader} = fixture(t);
    const history = compactChain(operation);
    if (mode === "session") history[3]!.session = "ses_other";
    installHistory(reader, history);
    if (mode === "head") {
      let calls=0;
      reader.getHistory = async () => ok({messages: ++calls === 1 ? history : [...history, {...rootMessage(operation), id: "msg_new", timeCreated: 11}]});
    }
    const result = await reconcileOperation(store, operation.operationId, reader);
    assert.equal(result.operation.completedAt, null);
    assert.equal(result.operation.observation?.context?.reason, mode === "head" ? "CONTINUATION_HISTORY_CHANGED" : "HISTORY_IDENTITY_CONFLICT");
  }
});

test("old no-terminal cache is rebuilt and conflicting response pins remain explicit ambiguity", async t => {
  for (const pinned of [false,true]) {
    const {store, operation, reader} = fixture(t);
    const history = compactChain(operation);
    installHistory(reader, history);
    store.observe(operation.operationId, {observedAt: new Date().toISOString(), activity: "IDLE", context: {
      reconcile: {headId: "msg_final", candidateIds: [], complete: true}
    }});
    if (pinned) store.acknowledge(operation.operationId, {rootMessageId: operation.messageId, responseMessageId: "msg_progress"});
    const result = await reconcileOperation(store, operation.operationId, reader);
    assert.equal(result.disposition, pinned ? "AMBIGUOUS" : "COMPLETED");
    if (pinned) assert.equal(result.operation.observation?.context?.reason, "CONTINUATION_RESPONSE_PIN_CONFLICT");
  }
});

test("prepared and completed operations return without network, compact stays explicitly pending", async t => {
  for (const kind of ["LIFECYCLE", "COMPACT"] as const) {
    const { store, operation, reader } = fixture(t, kind, false);
    assert.equal((await reconcileOperation(store, operation.operationId, reader)).disposition, "PREPARED");
    assert.deepEqual(reader.calls, []);
    store.startDispatch(operation.operationId);
    if (kind === "COMPACT") {
      assert.equal((await reconcileOperation(store, operation.operationId, reader)).disposition, "COMPACT_PENDING");
      assert.deepEqual(reader.calls, []);
    } else {
      store.finish(operation.operationId, outcomeForMessage(answer(operation)));
      assert.equal((await reconcileOperation(store, operation.operationId, reader)).disposition, "STORED");
      assert.deepEqual(reader.calls, []);
    }
  }
});

test("a different project cannot supply historical response evidence", async t => {
  const { store, operation, reader, directory } = fixture(t);
  reader.session = ok({ id: operation.action.participant.session, directory, projectID: "different-project" });
  reader.pages.set("newest", ok({ messages: [rootMessage(operation), answer(operation)] }));
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(result.disposition, "PENDING");
  assert.equal(result.operation.observation?.context?.reason, "SESSION_ADDRESS_CONFLICT");
  assert.equal(result.operation.completedAt, null);
  assert.deepEqual(reader.calls, ["session"]);
});

test("exact delivered root survives progress text, idle status and an Owner pause", async t => {
  const { store, operation, reader, action } = fixture(t);
  const progress = answer(operation, "msg_progress", { text: "IMPLEMENTATION_COMPLETE", timeCompleted: 30, finish: "tool-calls" });
  reader.pages.set("newest", ok({ messages: [rootMessage(operation), progress] }));
  store.recordOwnerPause(action.workId, true, "fixture/pause");
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(result.disposition, "PENDING");
  assert.ok(result.operation.acknowledgedAt);
  assert.equal(result.operation.completedAt, null);
  assert.equal(result.operation.interpretation, null);
  assert.equal(store.getWork(action.workId).paused, true);
  store.recordOwnerPause(action.workId, false, "fixture/resume");
  assert.throws(() => store.prepareAction({ ...action, actionKey: "next" }), { code: "PARTICIPANT_BUSY" });
});

for (const kind of ["LIFECYCLE", "CLARIFICATION", "RESTORE"] as const) {
  test(`${kind} final is attributable after tools and a later native compaction summary`, async t => {
    const { store, operation, reader } = fixture(t, kind);
    const final = answer(operation);
    reader.messages.set(final.id, ok(final));
    reader.pages.set("newest", ok({ messages: [rootMessage(operation), answer(operation, "msg_tool", { finish: "tool-calls", text: "" }), final,
      answer(operation, "msg_summary", { summary: true, text: "New compact summary" }),
      answer(operation, "msg_native", { hasCompactionPart: true, text: "Compaction marker" }),
      answer(operation, "msg_other", { parentId: "msg_other_root", text: "Unrelated answer" })] }));
    const result = await reconcileOperation(store, operation.operationId, reader);
    assert.equal(result.disposition, "COMPLETED");
    assert.equal(result.operation.outcome?.response?.messageId, final.id);
    assert.equal(result.operation.interpretation, null);
    assert.equal(result.operation.action.input.commandBody, "old command template");
    const calls = reader.calls.length;
    assert.deepEqual((await reconcileOperation(store, operation.operationId, reader)).operation, result.operation);
    assert.equal(reader.calls.length, calls);
  });
}

test("persisted correlated response bypasses unneeded history and survives unavailable root GET", async t => {
  const { store, operation, reader } = fixture(t);
  const final = answer(operation);
  store.acknowledge(operation.operationId, { rootMessageId: operation.messageId, responseMessageId: final.id });
  reader.messages.set(operation.messageId, missing());
  reader.messages.set(final.id, ok(final));
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(result.disposition, "COMPLETED");
  assert.equal(reader.calls.some(call => call.startsWith("history:")), false);
});

test("history continuation plus newest recheck finds a late response without losing older candidates", async t => {
  const { store, operation, reader } = fixture(t);
  const progress = answer(operation, "msg_progress", { finish: "tool-calls" });
  reader.pages.set("newest", ok({ messages: [progress], nextCursor: "opaque:first" }));
  reader.pages.set("opaque:first", ok({ messages: [answer(operation, "msg_older_tool", { finish: "tool-calls" })], nextCursor: "opaque:second" }));
  const first = await reconcileOperation(store, operation.operationId, reader, { pageLimit: 1, pageBudget: 1 });
  assert.equal(first.disposition, "CONTINUE");
  assert.equal(first.nextCursor, "opaque:second");
  const final = answer(operation);
  reader.messages.set(final.id, ok(final));
  reader.pages.set("newest", ok({ messages: [progress, final], nextCursor: "new:irrelevant" }));
  reader.pages.set("opaque:second", ok({ messages: [rootMessage(operation)] }));
  const second = await reconcileOperation(store, operation.operationId, reader, { pageLimit: 2, pageBudget: 1 });
  assert.equal(second.disposition, "COMPLETED");
  assert.equal(second.nextCursor, undefined);
  assert.ok(reader.calls.includes("history:opaque:second"));
  assert.equal(reader.calls.includes("history:new:irrelevant"), false);
});

test("candidate discovered before page exhaustion is retained for later ambiguity proof", async t => {
  const { store, operation, reader } = fixture(t);
  const final = answer(operation);
  reader.messages.set(final.id, ok(final));
  reader.pages.set("newest", ok({ messages: [final], nextCursor: "older-1" }));
  reader.pages.set("older-1", ok({ messages: [answer(operation, "msg_tool", { finish: "tool-calls" })], nextCursor: "older-2" }));
  assert.equal((await reconcileOperation(store, operation.operationId, reader, { pageBudget: 1 })).disposition, "CONTINUE");
  reader.pages.set("older-2", ok({ messages: [rootMessage(operation), answer(operation, "msg_second_final")] }));
  const result = await reconcileOperation(store, operation.operationId, reader, { pageBudget: 1 });
  assert.equal(result.disposition, "AMBIGUOUS");
  assert.equal(result.operation.completedAt, null);
  assert.ok(result.operation.acknowledgedAt);
});

test("more than one page of new arrivals restarts contiguous scan instead of hiding a gap", async t => {
  const { store, operation, reader } = fixture(t);
  const old = answer(operation, "msg_old_head", { finish: "tool-calls" });
  reader.pages.set("newest", ok({ messages: [old], nextCursor: "old-1" }));
  reader.pages.set("old-1", ok({ messages: [], nextCursor: "old-2" }));
  await reconcileOperation(store, operation.operationId, reader, { pageBudget: 1 });
  const final = answer(operation, "msg_new_final");
  reader.messages.set(final.id, ok(final));
  reader.pages.set("newest", ok({ messages: [final], nextCursor: "gap" }));
  reader.pages.set("gap", ok({ messages: [answer(operation, "msg_hidden_final")], nextCursor: "old-1" }));
  const result = await reconcileOperation(store, operation.operationId, reader, { pageBudget: 1 });
  assert.equal(result.disposition, "AMBIGUOUS");
  assert.ok(reader.calls.includes("history:gap"));
  assert.equal(reader.calls.includes("history:old-2"), false);
});

test("wrong user root identity never establishes delivery and wrong response parent cannot finish", async t => {
  const { store, operation, reader } = fixture(t);
  reader.messages.set(operation.messageId, ok({ ...rootMessage(operation), role: "assistant" }));
  const wrongRoot = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(wrongRoot.operation.acknowledgedAt, null);
  assert.equal(wrongRoot.operation.observation?.context?.reason, "ROOT_IDENTITY_CONFLICT");
  reader.messages.set(operation.messageId, ok(rootMessage(operation)));
  store.acknowledge(operation.operationId, { rootMessageId: operation.messageId, responseMessageId: "msg_answer" });
  reader.messages.set("msg_answer", ok(answer(operation, "msg_answer", { parentId: "msg_elsewhere" })));
  const wrongParent = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(wrongParent.operation.completedAt, null);
  assert.equal(wrongParent.operation.observation?.context?.reason, "RESPONSE_PARENT_CONFLICT");
});

test("unavailable reads preserve delivery and only sanitized diagnostic reason", async t => {
  const { store, operation, reader } = fixture(t);
  store.acknowledge(operation.operationId, { rootMessageId: operation.messageId });
  reader.failMessages = true;
  reader.pages.set("newest", missing());
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(result.operation.correlation.rootMessageId, operation.messageId);
  assert.equal(result.operation.completedAt, null);
  assert.equal(JSON.stringify(result.operation.observation).includes("private fixture exception"), false);
});

test("native Owner abort evidence finishes failed execution without treating it as rollback", async t => {
  const { store, operation, reader } = fixture(t);
  const aborted = answer(operation, "msg_aborted", { error: true, text: "Partial work remains", finish: "unknown" });
  reader.pages.set("newest", ok({ messages: [rootMessage(operation), aborted] }));
  reader.messages.set(aborted.id, ok(aborted));
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(result.disposition, "FAILED");
  assert.equal(result.operation.outcome?.reason, "REMOTE_EXECUTION_FAILED");
  assert.equal(result.operation.outcome?.response?.text, "Partial work remains");
  assert.equal(store.startDispatch(operation.operationId), false);
});

test("shared outcome ignores observation-only token/time changes and finalization is repeatable", async t => {
  const { store, operation, reader } = fixture(t);
  const final = answer(operation);
  const updated = { ...final, timeCompleted: 80, tokens: { input: 123, output: 45 } };
  assert.deepEqual(outcomeForMessage(final), outcomeForMessage(updated));
  reader.pages.set("newest", ok({ messages: [rootMessage(operation), final] }));
  reader.messages.set(final.id, ok(updated));
  const result = await reconcileOperation(store, operation.operationId, reader);
  assert.deepEqual(store.finish(operation.operationId, outcomeForMessage(final)), result.operation);
  assert.throws(() => outcomeForMessage(answer(operation, "msg_progress", { finish: "tool-calls" })), StoreError);
});

test("root absent from exact GET can be verified in history but idle alone cannot supply it", async t => {
  const { store, operation, reader } = fixture(t);
  reader.messages.set(operation.messageId, missing());
  reader.pages.set("newest", ok({ messages: [] }));
  const absent = await reconcileOperation(store, operation.operationId, reader);
  assert.equal(absent.operation.acknowledgedAt, null);
  assert.equal(absent.operation.completedAt, null);
  reader.pages.set("newest", ok({ messages: [rootMessage(operation)] }));
  const found = await reconcileOperation(store, operation.operationId, reader);
  assert.ok(found.operation.acknowledgedAt);
  assert.equal(found.operation.completedAt, null);
});

test("long session recovers through repeated bounded windows with hundreds of tool turns", async t => {
  const { store, operation, reader } = fixture(t);
  const final = answer(operation, "msg_final", { timeCreated: 600, timeCompleted: 601 });
  const history: OpenCodeMessage[] = [rootMessage(operation)];
  for (let i = 1; i <= 480; i += 1) history.push(answer(operation, `msg_tool_${i}`, { timeCreated: i + 1, timeCompleted: i + 1, finish: "tool-calls", text: i % 9 === 0 ? "Progress report" : "" }));
  history.push(final, answer(operation, "msg_later_summary", { summary: true, timeCreated: 700, timeCompleted: 701 }));
  reader.messages.set(final.id, ok(final));
  let key = "newest";
  for (let end = history.length; end > 0; end -= 40) {
    const start = Math.max(0, end - 40);
    const next = start > 0 ? `opaque-page-${start}` : undefined;
    reader.pages.set(key, ok({ messages: history.slice(start, end), ...(next === undefined ? {} : { nextCursor: next }) }));
    key = next ?? "done";
  }
  let result = await reconcileOperation(store, operation.operationId, reader, { pageLimit: 40, pageBudget: 2 });
  let rounds = 1;
  while (result.disposition === "CONTINUE" && rounds < 10) {
    result = await reconcileOperation(store, operation.operationId, reader, { pageLimit: 40, pageBudget: 2 });
    rounds += 1;
  }
  assert.ok(rounds > 1 && rounds < 10);
  assert.equal(result.disposition, "COMPLETED");
  assert.equal(result.operation.outcome?.response?.messageId, final.id);
  assert.equal(reader.calls.filter(call => call === "history:newest").length, rounds);
});
