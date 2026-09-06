import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { RouterEngine, type Adapter, type AdapterFactory, type SubmitRequest } from "../../src/v2/engine.js";
import { OperationStore } from "../../src/v2/state-store.js";
import { StoreError, type WorkContext } from "../../src/v2/contracts.js";
import { RouterError, type RouterConfiguration } from "../../src/v2/routing.js";
import type { AdapterReply, CommandSubmission, MessageSubmission, OpenCodeCommand, OpenCodeMessage, OpenCodeSession, OpenCodeTarget } from "../../src/v2/opencode-adapter.js";

function reply<T>(value: T): AdapterReply<T> { return { status: 200, bodySha256: "fixture-body-digest", value }; }
function code(expected: string) { return (error: unknown) => (error instanceof RouterError || error instanceof StoreError) && error.code === expected; }
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(t: TestContext) {
  // Keep source fixtures inside the writable checkout: Windows sandbox traversal
  // can reject realpath through the account directory that contains os.tmpdir().
  const root = mkdtempSync(path.join(process.cwd(), ".router-v2-engine-"));
  const store = new OperationStore(path.join(root, "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const configuration: RouterConfiguration = {
    schemaVersion: 2,
    targets: { fixture: {
      namespace: "fixture-server", project: "fixture-project", directory: root, origin: "http://fixture.invalid",
      roles: {
        Delivery: { session: "ses_fixture_delivery", profile: "delivery", capability: "DELIVERY" },
        Meta: { session: "ses_fixture_meta", profile: "meta", capability: "META" },
      },
    } },
  };
  const state: {
    activity: "IDLE" | "BUSY" | "UNKNOWN";
    session: Partial<OpenCodeSession>;
    commands: OpenCodeCommand[];
    submissions: Array<{ target: OpenCodeTarget; command?: CommandSubmission; message?: MessageSubmission }>;
    addresses: OpenCodeTarget[];
    registryReads: number;
    historyReads: number;
    responseText: string;
    returnUnavailable: boolean;
    sendGate?: Promise<void>;
    sendEntered?: () => void;
    history: OpenCodeMessage[];
  } = {
    activity: "IDLE", session: {},
    commands: ["implement", "step-review", "seq-next", "terv-review", "terv-review-utan", "step-review-utan", "closeout-commit", "after-compact"].map(name => ({ name, template: `${name}: $ARGUMENTS` })),
    submissions: [], addresses: [], registryReads: 0, historyReads: 0,
    responseText: "A useful result with unusual prose, no acceptance envelope.", returnUnavailable: false, history: [],
  };
  const factory: AdapterFactory = target => {
    state.addresses.push({ ...target });
    async function submitted(submission: CommandSubmission | MessageSubmission) {
      state.submissions.push("command" in submission ? { target, command: submission } : { target, message: submission });
      state.sendEntered?.();
      if (state.sendGate) await state.sendGate;
      if (state.returnUnavailable) return { status: 502, bodySha256: "fixture-unavailable", problem: "HTTP_ERROR" as const };
      return reply<OpenCodeMessage>({ id: `msg_fixture_response_${state.submissions.length}`, session: target.session, role: "assistant", parentId: submission.messageID, text: state.responseText, hasCompactionPart: false, timeCompleted: 100, finish: "stop" });
    }
    const adapter: Adapter = {
      getSession: async () => reply({ id: target.session, directory: root, projectID: "fixture-project", ...state.session }),
      getStatus: async () => reply(state.activity),
      listCommands: async () => { state.registryReads += 1; return reply(state.commands); },
      getMessage: async id => {
        const found = state.history.find(message => message.id === id);
        return found ? reply(found) : { status: 404, bodySha256: "fixture-missing", problem: "HTTP_ERROR" };
      },
      getHistory: async () => { state.historyReads += 1; return reply({ messages: state.history }); },
      submitCommand: async submission => submitted(submission),
      submitMessage: async submission => submitted(submission),
      summarize: async () => { throw new Error("Unexpected summarize path"); },
    };
    return adapter;
  };
  const engine = new RouterEngine(store, configuration, { username: "fixture", password: "fixture-only" }, factory);
  const work: WorkContext = {
    workId: "fixture-work", target: "fixture", directory: root, instructionReference: "fixture/owner",
    scope: "Implement the fixture change", allowedEffects: ["READ_ONLY", "WORKSPACE_WRITE", "LOCAL_COMMIT", "SESSION_MAINTENANCE"], stoppingPoint: "Return evidence",
  };
  engine.openWork(work);
  const request: SubmitRequest = { workId: work.workId, actionKey: "implement-fixture", recipientRole: "Delivery", command: "/implement", arguments: "Apply the fixture plan" };
  return { root, store, configuration, state, engine, work, request };
}

test("engine freezes configured address and command effect; absent optional telemetry permits dispatch", async t => {
  const { engine, store, state, configuration, request } = fixture(t);
  const prepared = await engine.prepare(request);
  assert.deepEqual(prepared.operation.action.participant, { namespace: "fixture-server", project: "fixture-project", session: "ses_fixture_delivery" });
  assert.equal(prepared.operation.action.effect, "WORKSPACE_WRITE");
  assert.equal(prepared.operation.action.command, "implement");
  assert.equal(prepared.operation.dispatchStartedAt, null);
  const completed = await engine.execute(prepared.operation.operationId);
  assert.equal(state.submissions.length, 1);
  assert.deepEqual(state.submissions[0]!.target, { origin: configuration.targets.fixture!.origin, directory: configuration.targets.fixture!.directory, session: "ses_fixture_delivery" });
  assert.equal(state.submissions[0]!.command!.messageID, prepared.operation.messageId);
  assert.equal(store.getOperation(completed.operationId).messageId, prepared.operation.messageId);
  assert.equal(completed.outcome?.execution, "COMPLETED");
  assert.equal(completed.outcome?.response?.text, state.responseText);
  assert.equal(completed.interpretation, null);
  assert.equal(completed.correlation.rootMessageId, prepared.operation.messageId);
});

test("role-command restrictions and target/effect mismatch reject before action creation", async t => {
  const { engine, store, configuration, request, work, state, root } = fixture(t);
  await assert.rejects(engine.prepare({ ...request, recipientRole: "Meta" }), code("ROLE_COMMAND_NOT_ALLOWED"));
  configuration.targets.fixture!.roles.Delivery!.allowedCommands = ["seq-next"];
  await assert.rejects(engine.prepare(request), code("ROLE_COMMAND_NOT_ALLOWED"));
  assert.throws(() => engine.openWork({ ...work, workId: "wrong-directory", directory: path.join(root, "other") }), code("TARGET_DIRECTORY_MISMATCH"));
  engine.openWork({ ...work, workId: "read-only-work", allowedEffects: ["READ_ONLY"] });
  delete configuration.targets.fixture!.roles.Delivery!.allowedCommands;
  await assert.rejects(engine.prepare({ ...request, workId: "read-only-work" }), code("EFFECT_NOT_ALLOWED"));
  assert.equal(store.getWork(work.workId).operations.length, 0);
  assert.equal(state.submissions.length, 0);
  const review = await engine.prepare({ ...request, actionKey: "review", recipientRole: "Meta", command: "step-review" });
  assert.equal(review.operation.action.effect, "READ_ONLY");
  assert.equal(review.operation.action.participant.session, "ses_fixture_meta");
});

test("wave-start is a Meta workspace write and never a Delivery command", async t => {
  const { engine, state, request, store, work } = fixture(t);
  state.commands.push({ name: "wave-start", template: "Start accepted wave: $ARGUMENTS" });
  await assert.rejects(engine.prepare({ ...request, command: "wave-start" }), code("ROLE_COMMAND_NOT_ALLOWED"));
  assert.equal(store.getWork(work.workId).operations.length, 0);
  engine.openWork({ ...work, workId: "read-only-wave", allowedEffects: ["READ_ONLY"] });
  await assert.rejects(engine.prepare({ ...request, workId: "read-only-wave", recipientRole: "Meta", command: "wave-start" }), code("EFFECT_NOT_ALLOWED"));
  const prepared = await engine.prepare({ ...request, recipientRole: "Meta", command: "/wave-start" });
  assert.equal(prepared.operation.action.effect, "WORKSPACE_WRITE");
  assert.equal(prepared.operation.action.participant.session, "ses_fixture_meta");
  await engine.execute(prepared.operation.operationId);
  assert.equal(state.submissions.length, 1);
  assert.equal(state.submissions[0]!.command!.command, "wave-start");
});

test("declared project command respects capability, allowed commands and work effect scope", async t => {
  const { engine, state, request, configuration, store, work } = fixture(t);
  const target = configuration.targets.fixture!;
  state.commands.push({ name: "project-evidence", template: "Project evidence: $ARGUMENTS" });
  const projectRequest = { ...request, command: "project-evidence" };
  await assert.rejects(engine.prepare(projectRequest), code("ROLE_COMMAND_NOT_ALLOWED"));
  target.commands = { "project-evidence": { capability: "DELIVERY", effect: "WORKSPACE_WRITE" } };
  await assert.rejects(engine.prepare({ ...projectRequest, recipientRole: "Meta" }), code("ROLE_COMMAND_NOT_ALLOWED"));
  target.roles.Delivery!.allowedCommands = ["implement"];
  await assert.rejects(engine.prepare(projectRequest), code("ROLE_COMMAND_NOT_ALLOWED"));
  delete target.roles.Delivery!.allowedCommands;
  engine.openWork({ ...work, workId: "read-only-project-command", allowedEffects: ["READ_ONLY"] });
  await assert.rejects(engine.prepare({ ...projectRequest, workId: "read-only-project-command" }), code("EFFECT_NOT_ALLOWED"));
  assert.equal(store.getWork(work.workId).operations.length, 0);
  const prepared = await engine.prepare(projectRequest);
  assert.equal(prepared.operation.action.effect, "WORKSPACE_WRITE");
  assert.equal(prepared.operation.action.recipientRole, "Delivery");
  await engine.execute(prepared.operation.operationId);
  assert.equal(state.submissions[0]!.command!.command, "project-evidence");
  assert.equal(state.submissions.length, 1);
});

test("project declarations cannot override core command capability or effect", async t => {
  const { engine, state, request, configuration } = fixture(t);
  configuration.targets.fixture!.commands = {
    "step-review": { capability: "DELIVERY", effect: "WORKSPACE_WRITE" },
    implement: { capability: "META", effect: "READ_ONLY" },
  };
  await assert.rejects(engine.prepare({ ...request, command: "step-review" }), code("ROLE_COMMAND_NOT_ALLOWED"));
  await assert.rejects(engine.prepare({ ...request, recipientRole: "Meta" }), code("ROLE_COMMAND_NOT_ALLOWED"));
  const review = await engine.prepare({ ...request, actionKey: "core-review", recipientRole: "Meta", command: "step-review" });
  assert.equal(review.operation.action.effect, "READ_ONLY");
  const implementation = await engine.prepare(request);
  assert.equal(implementation.operation.action.effect, "WORKSPACE_WRITE");
  await engine.execute(review.operation.operationId);
  await engine.execute(implementation.operation.operationId);
  assert.equal(state.submissions.length, 2);
});

test("project LOCAL_COMMIT commands are restricted to Meta", async t => {
  const { engine, state, request, configuration, work, store } = fixture(t);
  const target = configuration.targets.fixture!;
  state.commands.push({ name: "project-local-commit", template: "Local commit: $ARGUMENTS" });
  target.commands = { "project-local-commit": { capability: "DELIVERY", effect: "LOCAL_COMMIT" } };
  const commitRequest = { ...request, command: "project-local-commit" };
  await assert.rejects(engine.prepare(commitRequest), code("ROLE_COMMAND_NOT_ALLOWED"));
  target.roles.Delivery!.capability = "SUPPORT";
  target.commands["project-local-commit"]!.capability = "SUPPORT";
  await assert.rejects(engine.prepare(commitRequest), code("ROLE_COMMAND_NOT_ALLOWED"));
  target.commands["project-local-commit"]!.capability = "META";
  assert.equal(store.getWork(work.workId).operations.length, 0);
  const prepared = await engine.prepare({ ...commitRequest, recipientRole: "Meta" });
  assert.equal(prepared.operation.action.effect, "LOCAL_COMMIT");
  await engine.execute(prepared.operation.operationId);
  assert.equal(state.submissions[0]!.target.session, "ses_fixture_meta");
  assert.equal(state.submissions.length, 1);
});

for (const [original, changed] of [["READ_ONLY", "WORKSPACE_WRITE"], ["WORKSPACE_WRITE", "READ_ONLY"], ["READ_ONLY", "LOCAL_COMMIT"]] as const) {
  test(`project effect change ${original} to ${changed} is rejected before dispatch`, async t => {
    const { engine, state, request, configuration, store } = fixture(t);
    const target = configuration.targets.fixture!;
    target.commands = { "project-stage": { capability: "META", effect: original } };
    state.commands.push({ name: "project-stage", template: "Project stage: $ARGUMENTS" });
    const prepared = await engine.prepare({ ...request, recipientRole: "Meta", command: "project-stage" });
    assert.equal(prepared.operation.action.effect, original);
    target.commands["project-stage"]!.effect = changed;
    await assert.rejects(engine.execute(prepared.operation.operationId), code("COMMAND_EFFECT_CHANGED"));
    assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
    assert.equal(state.submissions.length, 0);
    target.commands["project-stage"]!.effect = original;
    await engine.execute(prepared.operation.operationId);
    assert.equal(state.submissions.length, 1);
  });
}

for (const condition of ["busy", "project", "directory", "session"] as const) {
  test(`${condition} mismatch blocks both initial prepare and later execute before send`, async t => {
    const { engine, store, state, request, work, root } = fixture(t);
    const alter = () => {
      if (condition === "busy") state.activity = "BUSY";
      if (condition === "project") state.session.projectID = "wrong-project";
      if (condition === "directory") state.session.directory = path.join(root, "wrong-directory");
      if (condition === "session") state.session.id = "ses_wrong_session";
    };
    const expected = condition === "busy" ? "PARTICIPANT_BUSY" : "PARTICIPANT_IDENTITY_MISMATCH";
    alter();
    await assert.rejects(engine.prepare(request), code(expected));
    assert.equal(store.getWork(work.workId).operations.length, 0);
    state.activity = "IDLE"; state.session = {};
    const prepared = await engine.prepare(request);
    alter();
    await assert.rejects(engine.execute(prepared.operation.operationId), code(expected));
    assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
    assert.equal(state.submissions.length, 0);
  });
}

test("repeated and concurrent request/execute calls retain one operation and one submission", async t => {
  const { engine, store, state, request, work } = fixture(t);
  const prepares = await Promise.all([engine.prepare(request), engine.prepare(request)]);
  assert.equal(prepares[0]!.operation.operationId, prepares[1]!.operation.operationId);
  assert.deepEqual(prepares.map(prepared => prepared.created).sort(), [false, true]);
  const operationId = prepares[0]!.operation.operationId;
  const gate = deferred(), entered = deferred();
  state.sendGate = gate.promise; state.sendEntered = entered.resolve;
  const first = engine.execute(operationId);
  const competing = engine.execute(operationId);
  await entered.promise;
  const second = await competing;
  assert.equal(second.completedAt, null);
  assert.equal(state.submissions.length, 1);
  gate.resolve();
  await first;
  await engine.execute(operationId);
  assert.equal((await engine.prepare(request)).created, false);
  await assert.rejects(engine.prepare({ ...request, arguments: "Changed request" }), code("INPUT_CONFLICT"));
  assert.equal(store.getWork(work.workId).operations.length, 1);
  assert.equal(state.submissions.length, 1);
});

test("source bytes and selected command semantics are revalidated before send boundary", async t => {
  const { engine, store, state, request, root } = fixture(t);
  const source = path.join(root, "plan.md");
  writeFileSync(source, "Frozen plan fixture.");
  const prepared = await engine.prepare({ ...request, sources: [{ path: "plan.md" }] });
  writeFileSync(source, "Changed plan fixture.");
  await assert.rejects(engine.execute(prepared.operation.operationId), code("SOURCE_CHANGED"));
  assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
  writeFileSync(source, "Frozen plan fixture.");
  const selected = state.commands.find(command => command.name === "implement")!;
  selected.template = "Changed selected template";
  await assert.rejects(engine.execute(prepared.operation.operationId), code("COMMAND_CHANGED_BEFORE_SEND"));
  assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
  assert.equal(state.submissions.length, 0);
  selected.template = "implement: $ARGUMENTS";
  state.commands.find(command => command.name === "step-review")!.template = "Unrelated change";
  selected.description = "Display description changed";
  assert.notEqual((await engine.execute(prepared.operation.operationId)).completedAt, null);
  assert.match(state.submissions[0]!.command!.arguments, /Frozen plan fixture/);
});

test("Owner pause during an in-flight command survives late completion and blocks successor", async t => {
  const { engine, store, state, work, request } = fixture(t);
  const prepared = await engine.prepare(request);
  const gate = deferred(), entered = deferred();
  state.sendGate = gate.promise; state.sendEntered = entered.resolve;
  const executing = engine.execute(prepared.operation.operationId);
  await entered.promise;
  store.recordOwnerPause(work.workId, true, "fixture/pause-during-execution");
  gate.resolve();
  const completed = await executing;
  assert.notEqual(completed.completedAt, null);
  assert.equal(completed.interpretation, null);
  assert.equal(store.getWork(work.workId).paused, true);
  await assert.rejects(engine.prepare({ ...request, actionKey: "next" }), code("WORK_PAUSED"));
  assert.equal(state.submissions.length, 1);
});

test("clarification uses a distinct message with prior response provenance and never resends implementation", async t => {
  const { engine, store, state, configuration, request } = fixture(t);
  const implemented = await engine.execute((await engine.prepare(request)).operation.operationId);
  configuration.targets.fixture!.roles.Delivery!.model = "fixture-provider/fixture-model";
  const clarification = await engine.prepare({ workId: request.workId, actionKey: "clarify-fixture", recipientRole: "Delivery", kind: "CLARIFICATION", arguments: "Which check failed?", predecessor: implemented.operationId, sources: [{ operationId: implemented.operationId }] });
  assert.notEqual(clarification.operation.messageId, implemented.messageId);
  const registryReads = state.registryReads;
  const completed = await engine.execute(clarification.operation.operationId);
  assert.equal(state.registryReads, registryReads);
  assert.equal(state.submissions.filter(item => item.command).length, 1);
  assert.equal(state.submissions.filter(item => item.message).length, 1);
  const message = state.submissions[1]!.message!;
  assert.equal(message.messageID, clarification.operation.messageId);
  assert.deepEqual(message.model, { providerID: "fixture-provider", modelID: "fixture-model" });
  assert.match(message.text, /Do not implement again/);
  assert.match(message.text, /Which check failed/);
  assert.ok(message.text.includes(implemented.outcome!.response!.text));
  assert.equal(completed.action.effect, "READ_ONLY");
  assert.deepEqual(store.getOperation(implemented.operationId), implemented);
});

test("historical recovery uses frozen identity despite today's command template changes", async t => {
  const { engine, state, request } = fixture(t);
  const prepared = await engine.prepare(request);
  state.returnUnavailable = true;
  const uncertain = await engine.execute(prepared.operation.operationId);
  assert.equal(uncertain.completedAt, null);
  assert.equal(uncertain.acknowledgedAt, null);
  state.commands.find(command => command.name === "implement")!.template = "Today's different template";
  state.history = [
    { id: uncertain.messageId, session: "ses_fixture_delivery", role: "user", text: "Frozen original command", hasCompactionPart: false },
    { id: "msg_historical_response", session: "ses_fixture_delivery", role: "assistant", parentId: uncertain.messageId, text: "Old attributable response", hasCompactionPart: false, timeCompleted: 200, finish: "stop" },
  ];
  const registryReads = state.registryReads;
  const recovered = await engine.reconcile(uncertain.operationId);
  assert.equal(recovered.disposition, "COMPLETED");
  assert.equal(recovered.operation.outcome?.response?.text, "Old attributable response");
  assert.equal(recovered.operation.interpretation, null);
  assert.equal(state.registryReads, registryReads);
  assert.equal(state.submissions.length, 1);
  assert.equal((await engine.prepare(request)).operation.messageId, uncertain.messageId);
});

test("invalid clarification model is rejected before dispatch boundary or POST", async t => {
  const { engine, store, state, configuration, request } = fixture(t);
  configuration.targets.fixture!.roles.Delivery!.model = "missing-provider-separator";
  const prepared = await engine.prepare({ workId: request.workId, actionKey: "bad-model", recipientRole: "Delivery", kind: "CLARIFICATION", arguments: "Explain the existing result" });
  await assert.rejects(engine.execute(prepared.operation.operationId), code("MODEL_CONFIGURATION_INVALID"));
  assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
  assert.equal(state.submissions.length, 0);
});
