import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { RouterEngine, type AdapterFactory } from "../../src/v2/engine.js";
import { OperationStore } from "../../src/v2/state-store.js";
import { digest, StoreError } from "../../src/v2/contracts.js";
import { handoffBinding, inspectHandoffBoundary } from "../../src/v2/orchestrator-handoff.js";
import { maintenanceFrontier, saveMaintenancePreview, validateMaintenanceRequest, type MaintenanceRequest } from "../../src/v2/orchestrator-maintenance.js";
import { RouterError, type RouterConfiguration } from "../../src/v2/routing.js";
import type { AdapterReply, MessageSubmission, OpenCodeMessage, OpenCodeSession } from "../../src/v2/opencode-adapter.js";

const reply = <T>(value: T): AdapterReply<T> => ({ status: 200, bodySha256: "fixture", value });
const code = (value: string) => (e: unknown) => (e instanceof StoreError || e instanceof RouterError) && e.code === value;
function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(process.cwd(), ".maintenance-test-"));
  const product = path.join(root, "product"); mkdirSync(product); writeFileSync(path.join(product, "STATE.md"), "Current state");
  const store = new OperationStore(path.join(root, "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const config: RouterConfiguration = { schemaVersion: 2, targets: {
    control: { namespace: "control", project: "control-project", directory: root, origin: "http://127.0.0.1:1", roles: { Orchestrator: { capability: "ORCHESTRATOR", profile: "orchestrator", session: "ses_orch", agent: "WRONG", model: "WRONG/default", variant: "WRONG" } } },
    product: { namespace: "product", project: "product-project", directory: product, origin: "http://127.0.0.1:2", roles: {} },
  }, orchestratorBridge: { enabled: true, maintenanceEnabled: true, projects: { demo: { controlTarget: "control", governedTarget: "product", recipientRole: "Orchestrator", instructionReference: "Owner enrollment" } } } };
  const state = { activity: "IDLE" as "IDLE" | "BUSY", permissions: 0, compactCalls: 0, uncertain: false,
    delayBaseline: false, baselineReads: 0, onHistory: undefined as (() => void) | undefined, incomplete: false, messages: [
      { id: "msg_user", session: "ses_orch", role: "user", text: "Old grant", agent: "build", providerID: "fixture", modelID: "selected", variant: "high", hasCompactionPart: false },
      { id: "msg_answer", session: "ses_orch", role: "assistant", parentId: "msg_user", text: "Stopped", agent: "build", providerID: "fixture", modelID: "selected", variant: "high", hasCompactionPart: false, finish: "stop", timeCompleted: 1 },
    ] as OpenCodeMessage[], submissions: [] as MessageSubmission[] };
  const adapter = {
    getSession: async () => reply({ id: "ses_orch", projectID: "control-project", directory: root } as OpenCodeSession),
    getStatus: async () => reply(state.activity),
    getPendingInteractions: async () => ({ permissions: state.permissions, questions: 0 }),
    getHistory: async ({ limit }: { limit: number }) => { state.onHistory?.(); if (limit === 1 && state.delayBaseline) await delay(10 * ++state.baselineReads); return reply({ messages: structuredClone(state.messages.slice(-limit)) }); },
    getMessage: async (id: string) => { const m = state.messages.find(m => m.id === id); return m ? reply(m) : { status: 404, problem: "HTTP_ERROR" as const, bodySha256: "fixture" }; },
    listCommands: async () => { throw new Error("Must preserve selection using message restore"); },
    submitCommand: async () => { throw new Error("Must not invoke plan command defaults"); },
    summarize: async (payload: { providerID: string; modelID: string; auto?: boolean }) => {
      assert.deepEqual(payload, { providerID: "fixture", modelID: "selected", auto: false }); state.compactCalls++;
      if (state.uncertain) return { status: 0, bodySha256: "fixture", problem: "HTTP_ERROR" as const };
      state.messages.push({ id: "msg_compact", session: "ses_orch", role: "user", text: "", hasCompactionPart: true, manualCompaction: true, autoCompaction: false, agent: "build", providerID: "fixture", modelID: "selected", variant: "high" },
        { id: "msg_summary", session: "ses_orch", role: "assistant", parentId: "msg_compact", text: "Summary", hasCompactionPart: false, summary: true, agent: "compaction", providerID: "fixture", modelID: "selected", ...(state.incomplete ? {} : { finish: "stop", timeCompleted: 2 }) });
      return reply(true);
    },
    submitMessage: async (m: MessageSubmission) => { state.submissions.push(m); return reply({ id: "msg_restored", session: "ses_orch", role: "assistant" as const, parentId: m.messageID, text: "RESTORED; no workflow command sent", finish: "stop", timeCompleted: 3, hasCompactionPart: false }); },
  };
  const engine = new RouterEngine(store, config, { username: "fixture", password: "fixture" }, (() => adapter) as AdapterFactory);
  engine.openWork({ workId: "named", target: "product", directory: product, scope: "Planning only", allowedEffects: ["READ_ONLY"], instructionReference: "Owner planning grant", stoppingPoint: "Reviewed plan" });
  store.recordOwnerPause("named", true, "Owner pause remains");
  const request: MaintenanceRequest = { project: "demo", maintenanceKey: "one", mode: "compact_restore", instructionReference: "Owner requested compact and restore", packet: { frontiers: [{ workId: "named", statePath: "STATE.md" }], note: "Observed today: lane output pending; interpretation is advisory." } };
  const preview = async () => saveMaintenancePreview(root, request, handoffBinding(config, "demo").bindingDigest,
    await inspectHandoffBoundary(adapter, { session: "ses_orch", project: "control-project", directory: root }), maintenanceFrontier(store, config, request));
  return { root, product, store, config, engine, state, request, preview };
}

test("compact and restore are separately dispatched once, preserve selection and paused product authority", async t => {
  const f = fixture(t), original = f.store.getWork("named"), p = await f.preview();
  assert.equal(f.store.listRecentWorkIds("control").length, 0);
  const c = (await f.engine.prepareOrchestratorMaintenance(p, "compact")).operation;
  await f.engine.execute(c.operationId); await f.engine.execute(c.operationId);
  assert.equal(f.state.compactCalls, 1); assert.equal(f.state.submissions.length, 0);
  assert.equal(f.store.getOperation(c.operationId).outcome?.execution, "COMPLETED");
  const r = (await f.engine.prepareOrchestratorMaintenance(p, "restore")).operation;
  await f.engine.execute(r.operationId); await f.engine.execute(r.operationId);
  assert.equal(f.state.submissions.length, 1);
  assert.deepEqual(f.state.submissions[0], { messageID: r.messageId, text: p.exactRestoreMessage, agent: "build", model: { providerID: "fixture", modelID: "selected" }, variant: "high" });
  assert.deepEqual(f.store.getWork("named"), original);
  assert.equal(f.store.getWork(p.maintenanceId).operations.length, 2);
  assert.match(p.exactRestoreMessage, /Owner pause remains/);
  assert.match(p.exactRestoreMessage, /OCoS advisory context/);
});
test("restore-only does not summarize", async t => {
  const f = fixture(t); f.request.mode = "restore"; const p = await f.preview();
  const op = (await f.engine.prepareOrchestratorMaintenance(p, "restore")).operation; await f.engine.execute(op.operationId);
  assert.equal(f.state.compactCalls, 0); assert.equal(f.state.submissions.length, 1);
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "compact"), code("INVALID_INPUT"));
});
test("concurrent same-phase prepares return the same operation despite different observation times", async t => {
  const f = fixture(t), p = await f.preview(); f.state.delayBaseline = true;
  const [a, b] = await Promise.all([f.engine.prepareOrchestratorMaintenance(p, "compact"), f.engine.prepareOrchestratorMaintenance(p, "compact")]);
  assert.equal(a.operation.operationId, b.operation.operationId); assert.equal(Number(a.created) + Number(b.created), 1);
  assert.equal(f.store.getWork(p.maintenanceId).operations.length, 1); assert.equal(f.state.compactCalls, 0);
});
test("missing source is an explicit degraded context, appearing source invalidates snapshot", async t => {
  const f = fixture(t); f.request.mode = "restore"; f.request.packet.frontiers[0]!.statePath = "missing.md";
  const p = await f.preview(); assert.match(p.exactRestoreMessage, /SOURCE_UNAVAILABLE/);
  writeFileSync(path.join(f.product, "missing.md"), "Now available");
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "restore"), code("MAINTENANCE_STALE_PREVIEW"));
  assert.equal(f.state.submissions.length, 0);
});
test("source directory links cannot widen restore access", async t => {
  const f = fixture(t), outside = path.join(f.root, "outside"); mkdirSync(outside); writeFileSync(path.join(outside, "STATE.md"), "Not a selected work source");
  symlinkSync(outside, path.join(f.product, "linked"), process.platform === "win32" ? "junction" : "dir");
  f.request.packet.frontiers[0]!.statePath = "linked/STATE.md";
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("SOURCE_PATH_UNSAFE"));
});
for (const change of ["disabled", "busy", "attention", "head", "file", "pause", "binding"] as const) test(`refuses ${change} after preview without mutation`, async t => {
  const f = fixture(t), p = await f.preview();
  if (change === "disabled") delete f.config.orchestratorBridge!.maintenanceEnabled;
  if (change === "busy") f.state.activity = "BUSY";
  if (change === "attention") f.state.permissions = 1;
  if (change === "head") f.state.messages[1]!.text += " changed";
  if (change === "file") writeFileSync(path.join(f.product, "STATE.md"), "Changed");
  if (change === "pause") f.store.recordOwnerPause("named", false, "Other Owner decision");
  if (change === "binding") f.config.targets.control!.roles.Orchestrator!.session = "ses_other";
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "compact"));
  assert.equal(f.state.compactCalls, 0); assert.equal(f.state.submissions.length, 0);
});
test("executor independently rechecks approval activation and head", async t => {
  const f = fixture(t), p = await f.preview(); const c = (await f.engine.prepareOrchestratorMaintenance(p, "compact")).operation;
  f.config.orchestratorBridge!.maintenanceEnabled = false;
  await assert.rejects(f.engine.execute(c.operationId), code("ORCHESTRATOR_MAINTENANCE_DISABLED"));
  assert.equal(f.state.compactCalls, 0);
  f.config.orchestratorBridge!.maintenanceEnabled = true; f.state.messages[1]!.text = "Changed";
  await assert.rejects(f.engine.execute(c.operationId), code("MAINTENANCE_STALE_PREVIEW"));
});
test("frontier change during final asynchronous executor GETs blocks dispatch", async t => {
  const f = fixture(t); f.request.mode = "restore"; const p = await f.preview();
  const r = (await f.engine.prepareOrchestratorMaintenance(p, "restore")).operation;
  f.state.onHistory = () => { f.state.onHistory = undefined; f.store.recordOwnerPause("named", false, "Intervening Owner change"); };
  await assert.rejects(f.engine.execute(r.operationId), code("MAINTENANCE_STALE_PREVIEW"));
  assert.equal(f.state.submissions.length, 0); assert.equal(f.store.getOperation(r.operationId).dispatchStartedAt, null);
});
for (const mode of ["uncertain", "incomplete"] as const) test(`${mode} compact never permits restore or repeated compact`, async t => {
  const f = fixture(t), p = await f.preview(); f.state[mode] = true;
  const c = (await f.engine.prepareOrchestratorMaintenance(p, "compact")).operation; await f.engine.execute(c.operationId);
  await f.engine.reconcile(c.operationId); await f.engine.execute(c.operationId);
  assert.equal(f.state.compactCalls, 1); assert.equal(f.store.getOperation(c.operationId).outcome, null);
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "restore"));
  assert.equal(f.state.submissions.length, 0);
});
test("frontier drift after compact permits fresh restore-only preview but never repeats compact", async t => {
  const f = fixture(t), p = await f.preview(); const c = (await f.engine.prepareOrchestratorMaintenance(p, "compact")).operation; await f.engine.execute(c.operationId);
  writeFileSync(path.join(f.product, "STATE.md"), "Lane progressed while orchestrator compacted");
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "restore"), code("MAINTENANCE_STALE_PREVIEW"));
  f.request.maintenanceKey = "fresh-restore"; f.request.mode = "restore";
  const fresh = await f.preview(); const r = (await f.engine.prepareOrchestratorMaintenance(fresh, "restore")).operation; await f.engine.execute(r.operationId);
  assert.equal(f.state.compactCalls, 1); assert.equal(f.state.submissions.length, 1);
});
test("ordinary compact remains forbidden, retained handoff claim cannot be bypassed", async t => {
  const f = fixture(t), p = await f.preview();
  f.engine.openWork({ workId: "ordinary", target: "control", directory: f.root, scope: "No bridge authority", instructionReference: "fixture", allowedEffects: ["SESSION_MAINTENANCE", "ORCHESTRATOR_HANDOFF"], stoppingPoint: "Stop" });
  await assert.rejects(f.engine.prepareCompact({ workId: "ordinary", actionKey: "compact", recipientRole: "Orchestrator" }), code("ORCHESTRATOR_COMPACT_IS_MANUAL"));
  await assert.rejects(f.engine.prepare({ workId: "ordinary", actionKey: "restore", recipientRole: "Orchestrator", kind: "RESTORE" }), code("ORCHESTRATOR_RESTORE_REQUIRES_PREVIEW"));
  f.store.prepareAction({ workId: "ordinary", actionKey: "pending", participant: handoffBinding(f.config, "demo").participant, recipientRole: "Orchestrator", kind: "ORCHESTRATOR_HANDOFF", effect: "ORCHESTRATOR_HANDOFF", command: "orchestrator-handoff", predecessor: null, input: { address: { origin: "http://127.0.0.1:1", directory: f.root, session: "ses_orch" } } });
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "compact"), code("PARTICIPANT_BUSY"));
});
test("unknown work, foreign project, unsafe paths, oversized notes and changed key content are rejected", async t => {
  const f = fixture(t); const p = await f.preview();
  f.request.packet.note = "changed"; await assert.rejects(f.preview(), code("INPUT_CONFLICT"));
  f.request.maintenanceKey = "other"; f.request.packet.frontiers[0]!.workId = "missing";
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("NOT_FOUND"));
  f.request.packet.frontiers[0]!.workId = "named"; f.config.targets.product!.project = "other";
  // Frozen preview cannot be altered to substitute an unrelated enrollment.
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "compact"), code("MAINTENANCE_STALE_PREVIEW"));
  f.request.packet.frontiers[0]!.statePath = "../STATE.md"; assert.throws(() => validateMaintenanceRequest(f.request));
  f.request.packet.frontiers[0]!.statePath = "STATE.md"; f.request.packet.note = "x".repeat(4097); assert.throws(() => validateMaintenanceRequest(f.request));
  assert.notEqual(digest(f.request), p.requestDigest);
});

function externalFixture(t: TestContext) {
  const f = fixture(t), externalPath = path.join(f.root, "canonical-router.json");
  const target = structuredClone(f.config.targets.product!);
  f.config.targets["current-worktree"] = target;
  f.engine.openWork({ workId: "new-target-work", target: "current-worktree", directory: f.product, scope: "Existing work on newly enrolled target", instructionReference: "Existing Owner grant", allowedEffects: ["READ_ONLY"], stoppingPoint: "Keep stopped" });
  delete f.config.targets["current-worktree"];
  const external = { schemaVersion: 2, targets: { "current-worktree": target } };
  writeFileSync(externalPath, JSON.stringify(external));
  f.config.orchestratorBridge!.frontierConfigurationPath = externalPath;
  f.request.mode = "restore"; f.request.packet.frontiers[0]!.workId = "new-target-work";
  return { ...f, externalPath, external };
}
test("explicit frontier source resolves a newly enrolled work target without widening control enrollment", async t => {
  const f = externalFixture(t);
  writeFileSync(f.externalPath, JSON.stringify({ ...f.external, targets: { ...f.external.targets, control: { project: "evil", namespace: "evil", directory: f.root, roles: {} } }, orchestratorBridge: { enabled: false, maintenanceEnabled: false } }));
  const p = await f.preview(); assert.match(p.exactRestoreMessage, /EXPLICIT_FRONTIER_CONFIGURATION/);
  const r = (await f.engine.prepareOrchestratorMaintenance(p, "restore")).operation; await f.engine.execute(r.operationId);
  assert.equal(f.state.submissions.length, 1); assert.equal(r.action.participant.session, "ses_orch");
  assert.equal(f.config.targets["current-worktree"], undefined, "Lookup must not merge targets into bridge config");
  assert.equal(f.config.targets.control!.project, "control-project");
});
for (const field of ["project", "namespace", "directory"] as const) test(`explicit frontier source rejects mismatched ${field}`, t => {
  const f = externalFixture(t);
  f.external.targets["current-worktree"][field] = field === "directory" ? f.root : "different";
  writeFileSync(f.externalPath, JSON.stringify(f.external));
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("MAINTENANCE_FRONTIER_TARGET_MISMATCH"));
});
test("explicit frontier source missing/invalid file or missing named target does not fall back", t => {
  const f = externalFixture(t);
  f.config.orchestratorBridge!.frontierConfigurationPath = path.join(f.root, "missing-config.json");
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("MAINTENANCE_FRONTIER_CONFIG_UNAVAILABLE"));
  f.config.orchestratorBridge!.frontierConfigurationPath = f.externalPath; writeFileSync(f.externalPath, "{}");
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("MAINTENANCE_FRONTIER_CONFIG_UNAVAILABLE"));
  writeFileSync(f.externalPath, JSON.stringify({ schemaVersion: 2, targets: {} }));
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("MAINTENANCE_FRONTIER_TARGET_MISMATCH"));
});
test("explicit frontier config path must be absolute and cannot traverse a link", t => {
  const f = externalFixture(t);
  f.config.orchestratorBridge!.frontierConfigurationPath = "canonical-router.json";
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("MAINTENANCE_FRONTIER_CONFIG_UNSAFE"));
  const linked = path.join(f.product, "config-link");
  symlinkSync(f.root, linked, process.platform === "win32" ? "junction" : "dir");
  f.config.orchestratorBridge!.frontierConfigurationPath = path.join(linked, "canonical-router.json");
  assert.throws(() => maintenanceFrontier(f.store, f.config, f.request), code("MAINTENANCE_FRONTIER_CONFIG_UNSAFE"));
});
test("only the selected canonical target content invalidates the preview", async t => {
  const f = externalFixture(t), p = await f.preview();
  const parsed = JSON.parse(readFileSync(f.externalPath, "utf8"));
  parsed.targets.unrelated = { project: "other", namespace: "other", directory: f.root };
  writeFileSync(f.externalPath, JSON.stringify(parsed));
  assert.equal(digest(maintenanceFrontier(f.store, f.config, f.request)), p.frontierDigest);
  parsed.targets["current-worktree"].roles = { NewLane: { session: "ses_new", profile: "new", capability: "DELIVERY" } };
  writeFileSync(f.externalPath, JSON.stringify(parsed));
  await assert.rejects(f.engine.prepareOrchestratorMaintenance(p, "restore"), code("MAINTENANCE_STALE_PREVIEW"));
  assert.equal(f.state.submissions.length, 0);
});
