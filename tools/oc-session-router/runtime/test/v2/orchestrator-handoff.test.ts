import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { RouterEngine, type AdapterFactory } from "../../src/v2/engine.js";
import { OperationStore } from "../../src/v2/state-store.js";
import { RouterError, type RouterConfiguration } from "../../src/v2/routing.js";
import { StoreError } from "../../src/v2/contracts.js";
import { assertPreviewCurrent, existingPreview, handoffBinding, inspectHandoffBoundary, readHandoffPreview, renderHandoff,
  savePreview, type HandoffRequest } from "../../src/v2/orchestrator-handoff.js";
import type { AdapterReply, MessageSubmission, OpenCodeMessage, OpenCodeSession } from "../../src/v2/opencode-adapter.js";

function reply<T>(value: T): AdapterReply<T> { return { status: 200, bodySha256: "fixture", value }; }
const code = (expected: string) => (error: unknown) => (error instanceof RouterError || error instanceof StoreError) && error.code === expected;
function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(process.cwd(), ".router-v2-handoff-"));
  const database = path.join(root, "router.sqlite");
  const store = new OperationStore(database);
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const configuration: RouterConfiguration = { schemaVersion: 2, targets: {
    control: { namespace: "fixture", project: "control-project", directory: root, origin: "http://127.0.0.1:1",
      roles: { Orchestrator: { capability: "ORCHESTRATOR", profile: "orchestrator", session: "ses_orchestrator", agent: "WRONG", model: "WRONG/default", variant: "WRONG" } } },
    product: { namespace: "fixture-product", project: "different-repository", directory: path.join(root, "product"), origin: "http://127.0.0.1:2",
      roles: { Delivery: { capability: "DELIVERY", profile: "delivery", session: "ses_delivery" } } },
  }, orchestratorBridge: { enabled: true, projects: { demo: { controlTarget: "control", governedTarget: "product", recipientRole: "Orchestrator", instructionReference: "fixture/owner/enrollment" } } } };
  const state = {
    session: { id: "ses_orchestrator", projectID: "control-project", directory: root } as OpenCodeSession,
    activity: "IDLE" as "IDLE" | "BUSY" | "UNKNOWN",
    permissions: 0 as number | null, questions: 0 as number | null, uncertain: false, getCount: 0,
    messages: [
      { id: "msg_user", session: "ses_orchestrator", role: "user", text: "Previous authorized request", hasCompactionPart: false, agent: "build", providerID: "fixture", modelID: "selected", variant: "high" },
      { id: "msg_answer", session: "ses_orchestrator", role: "assistant", parentId: "msg_user", text: "Previous final response", hasCompactionPart: false, finish: "stop", timeCompleted: 123, agent: "build", providerID: "fixture", modelID: "selected" },
    ] as OpenCodeMessage[],
    submissions: [] as MessageSubmission[],
    hold: undefined as Promise<void> | undefined,
  };
  const adapter = {
    getSession: async () => { state.getCount++; return reply(state.session); },
    getStatus: async () => reply(state.activity),
    getPendingInteractions: async () => ({ permissions: state.permissions, questions: state.questions }),
    getHistory: async () => reply({ messages: structuredClone(state.messages) }),
    getMessage: async (id: string) => {
      const value = state.messages.find(message => message.id === id);
      return value ? reply(value) : { status: 404, bodySha256: "fixture", problem: "HTTP_ERROR" as const };
    },
    listCommands: async () => { throw new Error("Handoff must not invoke an installed command"); },
    submitCommand: async () => { throw new Error("Handoff must not invoke an installed command"); },
    summarize: async () => { throw new Error("Handoff must not compact"); },
    submitMessage: async (message: MessageSubmission) => {
      state.submissions.push(message);
      await state.hold;
      if (state.uncertain) return { status: 0, bodySha256: "fixture", problem: "HTTP_ERROR" as const };
      return reply({ id: "msg_handoff_result", session: "ses_orchestrator", parentId: message.messageID, role: "assistant" as const,
        text: "Response, not product acceptance", hasCompactionPart: false, finish: "stop", timeCompleted: 124 });
    },
  };
  const factory: AdapterFactory = () => adapter;
  const engine = new RouterEngine(store, configuration, { username: "fixture", password: "fixture" }, factory);
  const request: HandoffRequest = { project: "demo", handoffKey: "scope-1", scope: "Plan only", stoppingPoint: "Meta-reviewed plan",
    exclusions: "No implementation or publication", message: "Continue the bounded planning work.", instructionReference: "fixture/owner/real-grant" };
  const preview = async () => {
    const binding = handoffBinding(configuration, "demo");
    const boundary = await inspectHandoffBoundary(adapter, { session: "ses_orchestrator", project: "control-project", directory: root });
    return savePreview(root, request, binding.bindingDigest, boundary);
  };
  return { root, database, store, configuration, state, adapter, factory, engine, request, preview };
}

test("handoff uses explicit type/effect, separate control work, exact frozen message and observed selection", async t => {
  const f = fixture(t);
  f.engine.openWork({ workId: "product-existing", target: "product", directory: f.configuration.targets.product!.directory,
    scope: "Original product scope", allowedEffects: ["READ_ONLY"], stoppingPoint: "Keep paused", instructionReference: "fixture/old-owner" });
  f.store.recordOwnerPause("product-existing", true, "fixture/owner/pause");
  const original = f.store.getWork("product-existing");
  const preview = await f.preview();
  assert.equal(f.store.listRecentWorkIds("control").length, 0, "Preview does not claim or open work");
  const prepared = await f.engine.prepareHandoff(preview);
  assert.equal(prepared.operation.action.kind, "ORCHESTRATOR_HANDOFF");
  assert.equal(prepared.operation.action.effect, "ORCHESTRATOR_HANDOFF");
  const result = await f.engine.execute(prepared.operation.operationId);
  assert.equal(result.outcome?.execution, "COMPLETED");
  assert.equal(result.interpretation, null);
  assert.deepEqual(f.state.submissions[0], { messageID: prepared.operation.messageId, text: renderHandoff(f.request),
    agent: "build", model: { providerID: "fixture", modelID: "selected" }, variant: "high" });
  assert.deepEqual(f.store.getWork("product-existing"), original);
});

test("activation absent/disabled rejects a new send, while prepare stays no-send", async t => {
  const f = fixture(t);
  const preview = await f.preview();
  f.configuration.orchestratorBridge!.enabled = false;
  await assert.rejects(f.engine.prepareHandoff(preview), code("HANDOFF_SEND_DISABLED"));
  assert.equal(f.state.submissions.length, 0);
  assert.equal(f.store.listRecentWorkIds("control").length, 0);
  delete f.configuration.orchestratorBridge;
  assert.throws(() => handoffBinding(f.configuration, "demo"), code("ORCHESTRATOR_NOT_ENROLLED"));
});

for (const condition of ["busy", "unknown", "permission", "question", "attention-unknown", "identity", "child", "revert", "incomplete", "new-user", "compact", "no-selection", "selection-conflict"] as const) {
  test(`handoff preflight blocks ${condition} without operation or send`, async t => {
    const f = fixture(t), preview = await f.preview();
    if (condition === "busy") f.state.activity = "BUSY";
    if (condition === "unknown") f.state.activity = "UNKNOWN";
    if (condition === "permission") f.state.permissions = 1;
    if (condition === "question") f.state.questions = 1;
    if (condition === "attention-unknown") f.state.questions = null;
    if (condition === "identity") f.state.session.projectID = "other-project";
    if (condition === "child") f.state.session.parentID = "ses_parent";
    if (condition === "revert") f.state.session.reverted = true;
    if (condition === "incomplete") delete f.state.messages[1]!.timeCompleted;
    if (condition === "new-user") f.state.messages.push({ id: "msg_new_owner", session: "ses_orchestrator", role: "user", text: "Wait!", hasCompactionPart: false });
    if (condition === "compact") f.state.messages[0]!.hasCompactionPart = true;
    if (condition === "no-selection") delete f.state.messages[0]!.agent;
    if (condition === "selection-conflict") f.state.messages[1]!.modelID = "other";
    await assert.rejects(f.engine.prepareHandoff(preview));
    assert.equal(f.store.listRecentWorkIds("control").length, 0);
    assert.equal(f.state.submissions.length, 0);
  });
}

test("changed head text, selection or enrollment invalidates exact preview, including at execute", async t => {
  const f = fixture(t), preview = await f.preview();
  f.state.messages[1]!.text = "Later edit";
  await assert.rejects(f.engine.prepareHandoff(preview), code("HANDOFF_STALE_PREVIEW"));
  f.state.messages[1]!.text = "Previous final response";
  const operation = (await f.engine.prepareHandoff(preview)).operation;
  f.configuration.targets.product!.directory = path.join(f.root, "changed-product");
  await assert.rejects(f.engine.execute(operation.operationId), code("HANDOFF_STALE_PREVIEW"));
  assert.equal(f.store.getOperation(operation.operationId).dispatchStartedAt, null);
  assert.equal(f.state.submissions.length, 0);
});

test("long completed turn uses only exact parent reads, never history pagination", async t => {
  const f = fixture(t);
  const final = f.state.messages.pop()!;
  for (let index = 0; index < 20; index++) f.state.messages.push({ id: `msg_tool_${index}`, session: "ses_orchestrator", parentId: "msg_user",
    role: "assistant", text: "Tool step", hasCompactionPart: false, timeCompleted: index + 5, finish: "tool-calls" });
  f.state.messages.push(final);
  let pages = 0;
  f.adapter.getHistory = async () => { pages++; return reply({ messages: structuredClone(f.state.messages.slice(-12)) }); };
  const preview = await f.preview();
  assert.equal(pages, 2);
  assert.equal(preview.boundary.selection.agent, "build");
  assert.equal(preview.boundary.selection.variant, "high");
  f.adapter.getMessage = async () => ({ status: 404, bodySha256: "fixture", problem: "HTTP_ERROR" });
  await assert.rejects(f.engine.prepareHandoff(preview), code("HANDOFF_TURN_NOT_QUIESCENT"));
  assert.equal(f.state.submissions.length, 0);
});

test("preview is immutable and duplicate/changed action key payload never overwrites it", async t => {
  const f = fixture(t), preview = await f.preview();
  const file = path.join(f.root, "handoff-previews", `${preview.handoffId}.json`);
  const bytes = readFileSync(file);
  assert.deepEqual(existingPreview(f.root, f.request), preview);
  assert.throws(() => existingPreview(f.root, { ...f.request, message: "Changed intent" }), code("INPUT_CONFLICT"));
  assert.deepEqual(readFileSync(file), bytes);
  assert.deepEqual(readHandoffPreview(f.root, preview.handoffId), preview);
  assert.throws(() => readHandoffPreview(f.root, "../router"), code("INVALID_INPUT"));
  assert.throws(() => assertPreviewCurrent(preview, "wrong-binding", preview.boundary), code("HANDOFF_STALE_PREVIEW"));
});

test("duplicate uncertain send returns same operation before busy, disabled, stale or remote checks", async t => {
  const f = fixture(t), preview = await f.preview();
  f.state.uncertain = true;
  const op = (await f.engine.prepareHandoff(preview)).operation;
  await f.engine.execute(op.operationId);
  f.state.activity = "BUSY";
  f.configuration.orchestratorBridge!.enabled = false;
  f.state.messages = [];
  const getCount = f.state.getCount;
  assert.equal((await f.engine.prepareHandoff(preview)).operation.operationId, op.operationId);
  assert.equal(f.state.getCount, getCount);
  await f.engine.execute(op.operationId);
  assert.equal(f.state.submissions.length, 1);
  assert.equal(f.store.getOperation(op.operationId).acknowledgedAt, null);
  assert.ok(f.store.getOperation(op.operationId).dispatchStartedAt);
});

test("concurrent preparations and executions share store claim/dispatch latch", async t => {
  const f = fixture(t), preview = await f.preview();
  const results = await Promise.all([f.engine.prepareHandoff(preview), f.engine.prepareHandoff(preview)]);
  assert.equal(results[0]!.operation.operationId, results[1]!.operation.operationId);
  assert.deepEqual(results.map(value => value.created).sort(), [false, true]);
  await Promise.all(results.map(value => f.engine.execute(value.operation.operationId)));
  assert.equal(f.state.submissions.length, 1);
});

test("one actual orchestrator shares participant exclusion across handoffs", async t => {
  const f = fixture(t), first = await f.preview();
  const second = savePreview(f.root, { ...f.request, handoffKey: "second" }, first.bindingDigest, first.boundary);
  await f.engine.prepareHandoff(first);
  await assert.rejects(f.engine.prepareHandoff(second), code("PARTICIPANT_BUSY"));
  assert.equal(f.state.submissions.length, 0);
});

test("retained uncertain physical session claim survives namespace and origin-alias replacement", async t => {
  const f = fixture(t), first = await f.preview();
  const op = (await f.engine.prepareHandoff(first)).operation;
  f.state.uncertain = true;
  await f.engine.execute(op.operationId);
  f.configuration.targets.control!.namespace = "replacement-namespace";
  f.configuration.targets.control!.origin = "http://localhost:1";
  const binding = handoffBinding(f.configuration, "demo");
  const second = savePreview(f.root, { ...f.request, handoffKey: "different-key" }, binding.bindingDigest, first.boundary);
  await assert.rejects(f.engine.prepareHandoff(second), code("PARTICIPANT_BUSY"));
  assert.equal(f.state.submissions.length, 1);
  assert.equal(f.store.getOperation(op.operationId).completedAt, null);
});

test("worker disabled after preparation abandons unsent handoff and releases only its claim", async t => {
  const f = fixture(t), preview = await f.preview();
  const operation = (await f.engine.prepareHandoff(preview)).operation;
  f.configuration.orchestratorBridge!.enabled = false;
  writeFileSync(path.join(f.root, "router-config.json"), JSON.stringify(f.configuration));
  const cli = fileURLToPath(new URL("../../src/v2/cli.js", import.meta.url));
  const result = JSON.parse(execFileSync(process.execPath, ["--experimental-sqlite", cli, "execute-operation",
    "--state-root", f.root, "--operation-id", operation.operationId], { encoding: "utf8", windowsHide: true,
    env: { ...process.env, OPENCODE_SERVER_USERNAME: "fixture", OPENCODE_SERVER_PASSWORD: "fixture" } })) as Record<string, unknown>;
  assert.equal(result.delivery, "NOT_SENT");
  assert.equal(result.execution, "FAILED");
  assert.equal(result.reason, "NOT_DISPATCHED");
  assert.deepEqual(f.store.getOperation(operation.operationId).outcome?.evidenceReferences, ["pre-dispatch:HANDOFF_SEND_DISABLED"]);
  assert.equal(f.state.submissions.length, 0);
  f.configuration.orchestratorBridge!.enabled = true;
  const second = savePreview(f.root, { ...f.request, handoffKey: "new-approved-key" }, preview.bindingDigest, preview.boundary);
  assert.equal((await f.engine.prepareHandoff(second)).created, true);
});

test("UTF-8 byte budgets reject oversized multibyte requests before persisting and retain accepted ones", async t => {
  const f = fixture(t), first = await f.preview();
  assert.throws(() => savePreview(f.root, { ...f.request, handoffKey: "oversize", message: "界".repeat(16_000) }, first.bindingDigest, first.boundary), code("INVALID_INPUT"));
  const accepted = savePreview(f.root, { ...f.request, handoffKey: "multibyte", message: "界".repeat(5_000) }, first.bindingDigest, first.boundary);
  assert.deepEqual(readHandoffPreview(f.root, accepted.handoffId), accepted);
});

test("enrollment cannot select a Delivery lane or alias the control session as another capability", t => {
  const f = fixture(t);
  f.configuration.orchestratorBridge!.projects.demo!.controlTarget = "product";
  f.configuration.orchestratorBridge!.projects.demo!.recipientRole = "Delivery";
  assert.throws(() => handoffBinding(f.configuration, "demo"), code("ORCHESTRATOR_ENROLLMENT_INVALID"));
  f.configuration.orchestratorBridge!.projects.demo!.controlTarget = "control";
  f.configuration.orchestratorBridge!.projects.demo!.recipientRole = "Orchestrator";
  f.configuration.targets.control!.roles.Other = { session: "ses_orchestrator", profile: "delivery", capability: "DELIVERY" };
  assert.throws(() => handoffBinding(f.configuration, "demo"), code("ORCHESTRATOR_ALIAS_CONFLICT"));
});

test("restart recovery retains POSSIBLE then attributes terminal without resend", async t => {
  const f = fixture(t), preview = await f.preview();
  f.state.uncertain = true;
  const op = (await f.engine.prepareHandoff(preview)).operation;
  await f.engine.execute(op.operationId);
  f.state.messages = [
    { id: op.messageId, session: "ses_orchestrator", role: "user", text: renderHandoff(f.request), hasCompactionPart: false },
    { id: "msg_recovered", session: "ses_orchestrator", role: "assistant", parentId: op.messageId, text: "Retained answer", timeCompleted: 500, finish: "stop", hasCompactionPart: false },
  ];
  const reopened = new OperationStore(f.database);
  try {
    const engine = new RouterEngine(reopened, f.configuration, { username: "fixture", password: "fixture" }, f.factory);
    const recovered = await engine.reconcile(op.operationId);
    assert.equal(recovered.operation.outcome?.execution, "COMPLETED");
    assert.equal(recovered.operation.outcome?.response?.text, "Retained answer");
    assert.equal(f.state.submissions.length, 1);
  } finally { reopened.close(); }
});

test("read-only store inspections cannot initialize or write", async t => {
  const f = fixture(t), preview = await f.preview();
  const op = (await f.engine.prepareHandoff(preview)).operation;
  const reader = new OperationStore(f.database, { readOnly: true });
  try {
    assert.equal(reader.getOperation(op.operationId).operationId, op.operationId);
    assert.throws(() => reader.recordOwnerPause(op.action.workId, true, "not-authorized"));
  } finally { reader.close(); }
  assert.equal(f.store.getWork(op.action.workId).paused, false);
  assert.throws(() => new OperationStore(path.join(f.root, "absent.sqlite"), { readOnly: true }), code("NOT_FOUND"));
  const unsupported = path.join(f.root, "unsupported.sqlite");
  const db = new DatabaseSync(unsupported);
  db.exec("CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES('keep'); PRAGMA user_version=42;");
  db.close();
  const bytes = readFileSync(unsupported);
  assert.throws(() => new OperationStore(unsupported, { readOnly: true }), code("SCHEMA_UNSUPPORTED"));
  assert.deepEqual(readFileSync(unsupported), bytes);
});
