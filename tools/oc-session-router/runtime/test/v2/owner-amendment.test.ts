import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { canonical, digest, participantKey, StoreError, type ActionInput, type OwnerAmendmentRequest, type WorkContext } from "../../src/v2/contracts.js";
import { RouterEngine, type Adapter, type AdapterFactory, type SubmitRequest } from "../../src/v2/engine.js";
import type { AdapterReply, OpenCodeCommand, OpenCodeMessage } from "../../src/v2/opencode-adapter.js";
import { RouterError, type RouterConfiguration } from "../../src/v2/routing.js";
import { OperationStore } from "../../src/v2/state-store.js";

function code(expected: string) {
  return (error: unknown) => (error instanceof StoreError || error instanceof RouterError) && error.code === expected;
}

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(process.cwd(), ".router-v2-amendment-"));
  const database = path.join(root, "router.sqlite");
  const stores: OperationStore[] = [];
  const connect = () => { const store = new OperationStore(database); stores.push(store); return store; };
  const store = connect();
  const sql = new DatabaseSync(database);
  t.after(() => { sql.close(); for (const item of stores) item.close(); rmSync(root, { recursive: true, force: true }); });
  const work: WorkContext = {
    workId: "fixture-work", target: "fixture", directory: root, instructionReference: "fixture/original-owner-decision",
    scope: "The bounded diagnostic evidence package", allowedEffects: ["READ_ONLY"], stoppingPoint: "Stop before local commit",
  };
  store.openWork(work);
  const action: ActionInput = {
    workId: work.workId, actionKey: "original-review", recipientRole: "Meta", kind: "LIFECYCLE",
    participant: { namespace: "fixture-server", project: "fixture-project", session: "ses_fixture_meta" },
    effect: "READ_ONLY", command: "step-review", predecessor: null, input: { arguments: "Review bounded evidence" },
  };
  const amendment = (changes: Partial<OwnerAmendmentRequest> = {}): OwnerAmendmentRequest => ({
    workId: work.workId, amendmentKey: "owner-local-commit", expectedAuthorizationRevision: store.getWork(work.workId).authorization.revision,
    instructionReference: "fixture/later-owner-decision", constraints: "Commit only the accepted diagnostic package; no push or expanded scope",
    addEffects: ["LOCAL_COMMIT"], stoppingPoint: "Return the local commit and stop before publication", ...changes,
  });
  const version = () => Number(sql.prepare("PRAGMA user_version").get()!.user_version);
  return { root, database, store, sql, connect, work, action, amendment, version };
}

function complete(store: OperationStore, action: ActionInput) {
  const prepared = store.prepareAction(action).operation;
  assert.equal(store.startDispatch(prepared.operationId), true);
  const completed = store.finish(prepared.operationId, { execution: "COMPLETED", evidenceReferences: ["fixture/review-evidence"],
    response: { messageId: "msg_fixture_review", rootMessageId: prepared.messageId, text: "Bounded diagnostic evidence accepted" } });
  return store.interpret(prepared.operationId, { resultDigest: completed.resultDigest!, responsibleRole: "Meta",
    decision: "Accept the bounded diagnostic evidence", evidenceReferences: ["fixture/review-evidence"] });
}

test("ordinary work remains schema 1 and cannot acquire an effect through reopening or preparation", t => {
  const { store, connect, sql, work, action, version } = fixture(t);
  assert.deepEqual(store.getWork(work.workId).authorization, {
    revision: digest(work), allowedEffects: ["READ_ONLY"], stoppingPoint: work.stoppingPoint, amendments: [],
  });
  assert.deepEqual(connect().openWork(work).context, work);
  assert.throws(() => store.openWork({ ...work, allowedEffects: ["READ_ONLY", "LOCAL_COMMIT"] }), code("INPUT_CONFLICT"));
  assert.throws(() => store.prepareAction({ ...action, effect: "LOCAL_COMMIT", command: "closeout-commit" }), code("EFFECT_NOT_ALLOWED"));
  assert.equal(store.prepareAction(action).operation.authorizationRevision, undefined);
  assert.equal(version(), 1);
  assert.equal(sql.prepare("SELECT name FROM sqlite_master WHERE name='work_amendments'").get(), undefined);
  assert.equal(sql.prepare("PRAGMA table_info(operations)").all().some(column => column.name === "authorization_revision"), false);
});

test("Owner amendment preserves immutable context, completed history, interpretation and pause", t => {
  const { store, sql, work, action, amendment, version } = fixture(t);
  const historical = complete(store, action);
  store.recordSessionObservation(work.workId, "Meta", { observedAt: "2026-09-15T10:00:00Z", available: true });
  store.recordOwnerPause(work.workId, true, "fixture/owner-pause");
  const before = store.getWork(work.workId);
  const originalRow = sql.prepare("SELECT context_json,created_at,updated_at FROM work_items WHERE work_id=?").get(work.workId);
  const request = amendment();
  const amended = store.amendWork(request);
  assert.equal(amended.created, true);
  assert.equal(version(), 2);
  assert.deepEqual(amended.work.context, work);
  assert.deepEqual(amended.work.operations, [historical]);
  assert.deepEqual(amended.work.observations, before.observations);
  assert.equal(amended.work.paused, true);
  assert.equal(amended.work.pauseReference, "fixture/owner-pause");
  assert.deepEqual(sql.prepare("SELECT context_json,created_at,updated_at FROM work_items WHERE work_id=?").get(work.workId), originalRow);
  assert.equal(sql.prepare("SELECT authorization_revision FROM operations WHERE operation_id=?").get(historical.operationId)!.authorization_revision, null);
  assert.deepEqual(amended.work.authorization.allowedEffects, ["READ_ONLY", "LOCAL_COMMIT"]);
  assert.equal(amended.work.authorization.stoppingPoint, request.stoppingPoint);
  assert.equal(amended.work.authorization.revision, digest(request));
  assert.deepEqual(amended.work.authorization.amendments[0]!.request, request);
  assert.ok(Number.isFinite(Date.parse(amended.work.authorization.amendments[0]!.recordedAt)));
  assert.deepEqual(store.openWork(work).context, work);
  assert.throws(() => store.openWork({ ...work, scope: "Expanded product work" }), code("INPUT_CONFLICT"));
  assert.throws(() => store.prepareAction({ ...action, actionKey: "paused-closeout", effect: "LOCAL_COMMIT" }), code("WORK_PAUSED"));
});

test("invalid, empty, redundant and scope-changing amendments leave schema and authorization untouched", t => {
  const { store, work, amendment, version } = fixture(t);
  const before = store.getWork(work.workId);
  const invalid: unknown[] = [null, [], {},
    amendment({ instructionReference: " " }), amendment({ constraints: "" }), amendment({ amendmentKey: "" }),
    amendment({ expectedAuthorizationRevision: "not-a-revision" }), amendment({ stoppingPoint: " " }),
    amendment({ addEffects: [], stoppingPoint: work.stoppingPoint }),
    { ...amendment(), addEffects: [], stoppingPoint: undefined },
    amendment({ addEffects: ["READ_ONLY"] }), amendment({ addEffects: ["LOCAL_COMMIT", "LOCAL_COMMIT"] }),
    { ...amendment(), addEffects: ["PUSH_MAIN"] }, { ...amendment(), addEffects: "LOCAL_COMMIT" },
    { ...amendment(), scope: "Expanded scope" }, { ...amendment(), target: "another-project" },
    { ...amendment(), allowedEffects: ["LOCAL_COMMIT"] },
  ];
  for (const request of invalid) {
    assert.throws(() => store.amendWork(request as OwnerAmendmentRequest), code("INVALID_INPUT"));
    assert.equal(version(), 1);
    assert.deepEqual(store.getWork(work.workId), before);
  }
  assert.throws(() => store.amendWork(amendment({ workId: "missing-work" })), code("NOT_FOUND"));
  assert.throws(() => store.amendWork(amendment({ expectedAuthorizationRevision: "0".repeat(64) })), code("AUTHORIZATION_CHANGED"));
  assert.equal(version(), 1);
});

test("prepared, possibly sent and delivered nonterminal operations block a new amendment without clearing claims", async t => {
  for (const state of ["PREPARED", "POSSIBLY_SENT", "DELIVERED"] as const) await t.test(state, inner => {
    const { store, sql, work, action, amendment, version } = fixture(inner);
    const pending = store.prepareAction(action).operation;
    if (state !== "PREPARED") store.startDispatch(pending.operationId);
    if (state === "DELIVERED") store.acknowledge(pending.operationId, { rootMessageId: pending.messageId });
    const before = store.getWork(work.workId);
    const claims = sql.prepare("SELECT * FROM session_claims").all();
    assert.throws(() => store.amendWork(amendment()), code("WORK_HAS_PENDING_OPERATIONS"));
    assert.deepEqual(store.getWork(work.workId), before);
    assert.deepEqual(sql.prepare("SELECT * FROM session_claims").all(), claims);
    assert.equal(version(), 1);
    assert.equal(store.prepareAction(action).created, false);
    if (state !== "PREPARED") assert.equal(store.startDispatch(pending.operationId), false);
  });
});

test("exact amendment replay survives later revisions and pending work while changed replay conflicts", t => {
  const { store, work, action, amendment } = fixture(t);
  const firstRequest = amendment();
  const first = store.amendWork(firstRequest);
  const secondRequest = amendment({ amendmentKey: "owner-maintenance", addEffects: ["SESSION_MAINTENANCE"] });
  const second = store.amendWork(secondRequest);
  assert.notEqual(first.work.authorization.revision, second.work.authorization.revision);
  const pending = store.prepareAction({ ...action, actionKey: "pending-after-amendments" }).operation;
  store.startDispatch(pending.operationId);
  const before = store.getWork(work.workId);
  const replay = store.amendWork(firstRequest);
  assert.equal(replay.created, false);
  assert.deepEqual(replay.work, before);
  assert.throws(() => store.amendWork({ ...firstRequest, constraints: "Changed grant" }), code("INPUT_CONFLICT"));
  assert.throws(() => store.amendWork({ ...firstRequest, amendmentKey: "stale-new-grant", addEffects: ["WORKSPACE_WRITE"] }), code("AUTHORIZATION_CHANGED"));
  assert.deepEqual(store.getWork(work.workId), before);
  assert.equal(store.startDispatch(pending.operationId), false);
  assert.deepEqual(before.authorization.amendments.map(item => item.request), [firstRequest, secondRequest]);
});

test("a stopping-point-only amendment is auditable and does not add an effect", t => {
  const { store, work, amendment } = fixture(t);
  const request = amendment({ addEffects: [], stoppingPoint: "Return the review evidence and await Owner decision" });
  const result = store.amendWork(request).work;
  assert.deepEqual(result.context, work);
  assert.deepEqual(result.authorization.allowedEffects, ["READ_ONLY"]);
  assert.equal(result.authorization.stoppingPoint, request.stoppingPoint);
  assert.deepEqual(result.authorization.amendments[0]!.request, request);
});

test("clients opened before migration see current grants; stale preparation fails and old action replay is retained", t => {
  const { store, connect, work, action, amendment } = fixture(t);
  const other = connect();
  const oldRevision = other.getWork(work.workId).authorization.revision;
  const historical = complete(store, action);
  const current = store.amendWork(amendment()).work.authorization;
  assert.deepEqual(other.getWork(work.workId).authorization, current);
  const closeout: ActionInput = { ...action, actionKey: "new-closeout", effect: "LOCAL_COMMIT", command: "closeout-commit" };
  assert.throws(() => other.prepareAction(closeout, oldRevision), code("AUTHORIZATION_CHANGED"));
  assert.deepEqual(store.getWork(work.workId).operations, [historical]);
  const prepared = other.prepareAction(closeout, current.revision);
  assert.equal(prepared.created, true);
  assert.equal(prepared.operation.authorizationRevision, current.revision);
  assert.equal(prepared.operation.dispatchStartedAt, null);
  const replay = other.prepareAction(action, oldRevision);
  assert.equal(replay.created, false);
  assert.deepEqual(replay.operation, historical);
});

test("migration rejects baseline SQL writers for amended work and preserves unamended writer behavior", t => {
  const { store, sql, work, action, amendment } = fixture(t);
  store.openWork({ ...work, workId: "unaffected-work" });
  // Prepared before migration, with exactly the original INSERT column list.
  const originalInsert = sql.prepare("INSERT INTO operations(operation_id,message_id,work_id,action_key,participant_key,action_json,input_digest,created_at) VALUES(?,?,?,?,?,?,?,?)");
  const baselineInsert = (value: ActionInput, id: string) => originalInsert.run(id, `msg_${id}`, value.workId, value.actionKey,
    participantKey(value.participant), canonical(value), digest(value), "2026-09-15T10:00:00Z");
  store.amendWork(amendment());
  assert.throws(() => baselineInsert(action, "old-writer-amended"), /AUTHORIZATION_CHANGED/);
  assert.equal(store.getWork(work.workId).operations.length, 0);
  assert.equal(baselineInsert({ ...action, workId: "unaffected-work" }, "old-writer-unaffected").changes, 1);
  assert.equal(store.getWork("unaffected-work").operations.length, 1);
  assert.equal(store.getWork("unaffected-work").operations[0]!.authorizationRevision, undefined);
  const staleInsert = sql.prepare("INSERT INTO operations(operation_id,message_id,work_id,action_key,participant_key,action_json,input_digest,created_at,authorization_revision) VALUES(?,?,?,?,?,?,?,?,?)");
  assert.throws(() => staleInsert.run("stale-writer", "msg_stale_writer", work.workId, "stale", participantKey(action.participant),
    canonical({ ...action, actionKey: "stale" }), digest(action), "2026-09-15T10:00:00Z", digest(work)), /AUTHORIZATION_CHANGED/);
  assert.equal(store.getWork(work.workId).operations.length, 0);
});

function engineFixture(t: TestContext) {
  const data = fixture(t);
  const configuration: RouterConfiguration = { schemaVersion: 2, targets: { fixture: {
    namespace: "fixture-server", project: "fixture-project", directory: data.root, origin: "http://fixture.invalid",
    roles: {
      Meta: { session: "ses_fixture_meta", profile: "meta", capability: "META" },
      Delivery: { session: "ses_fixture_delivery", profile: "delivery", capability: "DELIVERY" },
    },
  } } };
  const reply = <T>(value: T): AdapterReply<T> => ({ status: 200, bodySha256: "fixture-response-digest", value });
  const state: { submissions: number; onCommands?: () => void } = { submissions: 0 };
  const factory: AdapterFactory = target => {
    const adapter: Adapter = {
      getSession: async () => reply({ id: target.session, directory: data.root, projectID: "fixture-project" }),
      getStatus: async () => reply("IDLE"),
      getHistory: async () => reply({ messages: [] }),
      getMessage: async () => ({ status: 404, bodySha256: "fixture-missing", problem: "HTTP_ERROR" }),
      listCommands: async () => {
        state.onCommands?.();
        return reply<OpenCodeCommand[]>(["step-review", "implement", "closeout-commit", "after-compact"].map(name => ({ name, template: `${name}: $ARGUMENTS` })));
      },
      submitCommand: async submission => {
        state.submissions += 1;
        return reply<OpenCodeMessage>({ id: `msg_fixture_closeout_${state.submissions}`, session: target.session, role: "assistant",
          parentId: submission.messageID, text: "Bounded local commit completed; stopped before publication", hasCompactionPart: false, timeCompleted: 100, finish: "stop" });
      },
      submitMessage: async () => { throw new Error("Unexpected fixture message send"); },
      summarize: async () => { throw new Error("Unexpected fixture compact"); },
    };
    return adapter;
  };
  const engine = new RouterEngine(data.store, configuration, { username: "fixture", password: "fixture-only" }, factory);
  const request: SubmitRequest = { workId: data.work.workId, actionKey: "bounded-closeout", recipientRole: "Meta", command: "closeout-commit" };
  return { ...data, engine, configuration, request, state };
}

test("an Owner grant permits Meta closeout with frozen constraints while other roles and effects remain bounded", async t => {
  const { store, work, engine, request, state, amendment } = engineFixture(t);
  await assert.rejects(engine.prepare(request), code("EFFECT_NOT_ALLOWED"));
  const decision = amendment();
  const authorization = store.amendWork(decision).work.authorization;
  await assert.rejects(engine.prepare({ ...request, actionKey: "delivery-closeout", recipientRole: "Delivery" }), code("ROLE_COMMAND_NOT_ALLOWED"));
  await assert.rejects(engine.prepare({ ...request, actionKey: "ungranted-implementation", recipientRole: "Delivery", command: "implement" }), code("EFFECT_NOT_ALLOWED"));
  const prepared = await engine.prepare(request);
  assert.equal(prepared.operation.authorizationRevision, authorization.revision);
  assert.equal(prepared.operation.action.effect, "LOCAL_COMMIT");
  const packet = String(prepared.operation.action.input.arguments);
  for (const expected of [work.scope, authorization.revision, decision.constraints, decision.instructionReference, decision.stoppingPoint!]) assert.ok(packet.includes(expected), expected);
  assert.equal(state.submissions, 0);
  const executed = await engine.execute(prepared.operation.operationId);
  assert.equal(executed.outcome?.execution, "COMPLETED");
  assert.equal(state.submissions, 1);
  assert.deepEqual((await engine.prepare(request)).operation, executed);
  assert.deepEqual(await engine.execute(prepared.operation.operationId), executed);
  assert.equal(state.submissions, 1);
  assert.deepEqual(store.getWork(work.workId).context, work);
});

test("stage and compact request extras cannot manufacture an Owner grant or rewrite work scope", async t => {
  const { engine, store, work, request, version } = engineFixture(t);
  for (const extra of [
    { allowedEffects: ["LOCAL_COMMIT"] }, { effect: "LOCAL_COMMIT" }, { scope: "All repository changes" },
    { stoppingPoint: "Publish" }, { authorization: { allowedEffects: ["LOCAL_COMMIT"] } },
    { instructionReference: "Unrecorded Owner claim" }, { addEffects: ["LOCAL_COMMIT"] },
  ]) {
    await assert.rejects(engine.prepare({ ...request, ...extra } as SubmitRequest), code("INVALID_INPUT"));
    await assert.rejects(engine.prepareCompact({ workId: work.workId, actionKey: "compact", recipientRole: "Meta", ...extra }), code("INVALID_INPUT"));
  }
  assert.deepEqual(store.getWork(work.workId).authorization.allowedEffects, ["READ_ONLY"]);
  assert.equal(store.getWork(work.workId).operations.length, 0);
  assert.equal(version(), 1);
});

test("authorization change during packet preparation is rejected before an operation or send is created", async t => {
  const { engine, store, work, request, state, amendment } = engineFixture(t);
  const review = { ...request, actionKey: "review-racing-owner", command: "step-review" };
  state.onCommands = () => { delete state.onCommands; store.amendWork(amendment()); };
  await assert.rejects(engine.prepare(review), code("AUTHORIZATION_CHANGED"));
  assert.equal(store.getWork(work.workId).operations.length, 0);
  assert.equal(state.submissions, 0);
  const fresh = await engine.prepare(review);
  assert.equal(fresh.operation.authorizationRevision, store.getWork(work.workId).authorization.revision);
  assert.equal(fresh.operation.dispatchStartedAt, null);
  assert.equal(state.submissions, 0);
});

test("amended restore packets retain original scope, current stopping point and every Owner constraint", async t => {
  const { engine, store, work, request, amendment, state } = engineFixture(t);
  const first = amendment();
  store.amendWork(first);
  const second = amendment({ amendmentKey: "bounded-restore", addEffects: ["SESSION_MAINTENANCE"],
    constraints: "Restore context only, preserving the accepted evidence and Owner pause", stoppingPoint: "Await review before closeout" });
  store.amendWork(second);
  const restore = await engine.prepare({ ...request, actionKey: "restore-context", kind: "RESTORE" });
  const packet = String(restore.operation.action.input.arguments);
  for (const expected of [work.scope, first.constraints, second.constraints, second.stoppingPoint!, "do not start or repeat lifecycle work"]) assert.ok(packet.includes(expected), expected);
  assert.equal(restore.operation.action.effect, "SESSION_MAINTENANCE");
  assert.equal(restore.operation.authorizationRevision, store.getWork(work.workId).authorization.revision);
  assert.equal(state.submissions, 0);
});
