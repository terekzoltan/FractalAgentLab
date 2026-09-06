import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { OperationStore } from "../../src/v2/state-store.js";
import { RouterEngine, type SubmitRequest } from "../../src/v2/engine.js";
import type { RouterConfiguration } from "../../src/v2/routing.js";
import type { WorkContext } from "../../src/v2/contracts.js";

const cliPath = fileURLToPath(new URL("../../src/v2/cli.js", import.meta.url));
const credentials = { username: "fixture-cli-user", password: "fixture-cli-password" };
type Output = Record<string, unknown>;

async function eventually(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Fixture did not reach ${label}`);
    await delay(25);
  }
}

async function runCli(root: string, action: string, args: string[] = [], authenticated = true) {
  const environment = { ...process.env };
  delete environment.OPENCODE_SERVER_USERNAME;
  delete environment.OPENCODE_SERVER_PASSWORD;
  if (authenticated) {
    environment.OPENCODE_SERVER_USERNAME = credentials.username;
    environment.OPENCODE_SERVER_PASSWORD = credentials.password;
  }
  const child = spawn(process.execPath, ["--experimental-sqlite", cliPath, action, "--state-root", root, ...args], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: environment });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data: string) => { stdout += data; });
  child.stderr.on("data", (data: string) => { stderr += data; });
  const exitCode = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  assert.ok(stdout.trim(), `CLI emitted no JSON: ${stderr}`);
  return { exitCode, value: JSON.parse(stdout.trim()) as Output, stdout, stderr };
}

function writeJson(root: string, name: string, value: unknown): string {
  const file = path.join(root, name);
  writeFileSync(file, JSON.stringify(value));
  return file;
}

function localFixture(t: TestContext) {
  const root = mkdtempSync(path.join(process.cwd(), ".router-v2-cli-"));
  const work: WorkContext = { workId: "cli-fixture-work", target: "cli-fixture", directory: root, instructionReference: "fixture/owner", scope: "Fixture scope", allowedEffects: ["WORKSPACE_WRITE", "READ_ONLY"], stoppingPoint: "Return fixture evidence" };
  const configuration: RouterConfiguration = { schemaVersion: 2, targets: { "cli-fixture": { namespace: "cli-fixture-server", project: "cli-fixture-project", directory: root, origin: "http://127.0.0.1:1", roles: { Delivery: { session: "ses_cli_fixture", profile: "delivery", capability: "DELIVERY" } } } } };
  const configPath = writeJson(root, "router-config.json", configuration);
  const workPath = writeJson(root, "work.json", work);
  const request: SubmitRequest = { workId: work.workId, actionKey: "cli-fixture-action", recipientRole: "Delivery", command: "implement", arguments: "Apply the local fixture" };
  const requestPath = writeJson(root, "submit.json", request);
  const store = new OperationStore(path.join(root, "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  return { root, work, configuration, configPath, workPath, request, requestPath, store };
}

async function httpFixture(t: TestContext) {
  // Register server/worker cleanup before filesystem cleanup (after hooks run in
  // registration order); release held responses even if an assertion fails.
  let cleanup: (() => Promise<void>) | undefined;
  t.after(async () => { await cleanup?.(); });
  const fixture = localFixture(t);
  const session = "ses_cli_fixture";
  const state = {
    busy: false, hold: true, postClosedEarly: false,
    posts: [] as Array<{ body: { messageID: string; command: string; arguments: string }; response: ServerResponse; operationId: string; released: boolean }>,
    calls: [] as Array<{ method: string; path: string; directory: string | null; authorized: boolean }>,
    messages: [] as Array<{ info: Record<string, unknown>; parts: Array<{ type: string; text: string }> }>,
    template: "implement: $ARGUMENTS",
  };
  const rawResponse = (rootMessageId: string) => ({ info: { id: `msg_cli_response_${state.posts.length}`, sessionID: session, role: "assistant", parentID: rootMessageId, time: { created: 100, completed: 200 }, finish: "stop" }, parts: [{ type: "text", text: "Private fixture result without an acceptance envelope." }] });
  const release = () => {
    for (const post of state.posts) {
      if (post.released) continue;
      post.released = true;
      const terminal = rawResponse(post.body.messageID);
      state.messages.push(terminal);
      post.response.writeHead(200, { "content-type": "application/json", connection: "close" });
      post.response.end(JSON.stringify(terminal));
    }
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://127.0.0.1");
    state.calls.push({ method: request.method!, path: url.pathname, directory: url.searchParams.get("directory"), authorized: request.headers.authorization === `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}` });
    const send = (status: number, value: unknown) => { response.writeHead(status, { "content-type": "application/json", connection: "close" }); response.end(JSON.stringify(value)); };
    if (request.method === "GET" && url.pathname === `/session/${session}`) return send(200, { id: session, directory: fixture.root, projectID: "cli-fixture-project" });
    if (request.method === "GET" && url.pathname === "/session/status") return send(200, { [session]: { type: state.busy ? "busy" : "idle" } });
    if (request.method === "GET" && url.pathname === "/command") return send(200, [{ name: "implement", template: state.template }]);
    if (request.method === "GET" && url.pathname === `/session/${session}/message`) return send(200, state.messages);
    if (request.method === "GET" && url.pathname.startsWith(`/session/${session}/message/`)) {
      const message = state.messages.find(item => item.info.id === url.pathname.split("/").at(-1));
      return send(message ? 200 : 404, message ?? {});
    }
    if (request.method === "POST" && url.pathname === `/session/${session}/command`) {
      let body = ""; request.setEncoding("utf8");
      request.on("data", (chunk: string) => { body += chunk; });
      request.on("end", () => {
        const parsed = JSON.parse(body) as { messageID: string; command: string; arguments: string };
        const operation = fixture.store.getWork(fixture.work.workId).operations.find(item => item.messageId === parsed.messageID);
        // Observe durability inside the synthetic server before accepting POST.
        assert.ok(operation, "Message identity must already exist before POST");
        assert.notEqual(operation.dispatchStartedAt, null);
        state.messages.push({ info: { id: parsed.messageID, sessionID: session, role: "user", time: { created: 100 } }, parts: [{ type: "text", text: parsed.arguments }] });
        const post = { body: parsed, response, operationId: operation.operationId, released: false };
        state.posts.push(post);
        response.on("close", () => { if (!post.released) state.postClosedEarly = true; });
        if (!state.hold) release();
      });
      return;
    }
    send(404, {});
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  fixture.configuration.targets["cli-fixture"]!.origin = `http://127.0.0.1:${address.port}`;
  writeJson(fixture.root, "router-config.json", fixture.configuration);
  cleanup = async () => {
    state.hold = false; release();
    await eventually(() => state.posts.every(post => fixture.store.getOperation(post.operationId).completedAt !== null), "worker completion");
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    // Completion becomes visible just before the detached worker closes SQLite.
    await delay(50);
  };
  const opened = await runCli(fixture.root, "open-work", ["--request", fixture.workPath], false);
  assert.equal(opened.exitCode, 0);
  const engine = new RouterEngine(fixture.store, fixture.configuration, credentials);
  return { ...fixture, state, release, engine };
}

function privacy(output: string, root: string, messageIds: string[] = []): void {
  for (const secret of [credentials.username, credentials.password, "ses_cli_fixture", root, ...messageIds]) assert.ok(!output.includes(secret), "Normal projection exposed a private fixture value");
  assert.doesNotMatch(output, /http:\/\/|Private fixture result|Apply the local fixture/);
}

test("CLI opens and reads local work/results without credentials or a server", async t => {
  const { root, work, workPath, store } = localFixture(t);
  const opened = await runCli(root, "open-work", ["--request", workPath], false);
  assert.equal(opened.exitCode, 0);
  assert.equal(opened.value.operationCount, 0);
  const operation = store.prepareAction({ workId: work.workId, actionKey: "local-result", participant: { namespace: "fixture", project: "fixture", session: "ses_cli_fixture" }, recipientRole: "Delivery", kind: "LIFECYCLE", effect: "WORKSPACE_WRITE", command: "implement", predecessor: null, input: {} }).operation;
  store.startDispatch(operation.operationId);
  store.finish(operation.operationId, { execution: "COMPLETED", evidenceReferences: ["fixture/local-result"], response: { messageId: "msg_local_response", rootMessageId: operation.messageId, text: "Explicit private artifact" } });
  const inspected = await runCli(root, "inspect", ["--work-id", work.workId], false);
  assert.equal(inspected.exitCode, 0);
  privacy(inspected.stdout, root, [operation.messageId, "msg_local_response"]);
  const result = await runCli(root, "read-result", ["--operation-id", operation.operationId], false);
  assert.equal(result.value.text, "Explicit private artifact");
  const waited = await runCli(root, "wait", ["--operation-id", operation.operationId, "--wait-ms", "0", "--config", path.join(root, "absent-config.json")], false);
  assert.equal(waited.exitCode, 0);
  assert.equal(waited.value.execution, "COMPLETED");
  assert.equal(waited.value.disposition, "STORED");
  assert.equal(waited.value.observationEnded, true);
  assert.equal(waited.value.sessionInterrupted, false);
  privacy(waited.stdout, root, [operation.messageId, "msg_local_response"]);
  const pause = writeJson(root, "pause.json", { workId: work.workId, paused: true, instructionReference: "fixture/owner-pause" });
  const paused = await runCli(root, "record-pause", ["--request", pause], false);
  assert.equal(paused.value.sessionInterrupted, false);
  assert.equal(store.getWork(work.workId).paused, true);
});

test("CLI missing credentials and missing/malformed config produce bounded errors before send", async t => {
  const { root, workPath, configPath, requestPath, store, work } = localFixture(t);
  assert.equal((await runCli(root, "open-work", ["--request", workPath], false)).exitCode, 0);
  const missingCredentials = await runCli(root, "submit", ["--request", requestPath], false);
  assert.equal(missingCredentials.exitCode, 1);
  assert.equal(missingCredentials.value.error_code, "CREDENTIALS_UNAVAILABLE");
  const missingConfig = await runCli(root, "submit", ["--request", requestPath, "--config", path.join(root, "missing.json")]);
  assert.equal(missingConfig.value.error_code, "INPUT_FILE_UNREADABLE");
  writeFileSync(configPath, "{invalid-json");
  const invalid = await runCli(root, "submit", ["--request", requestPath]);
  assert.equal(invalid.value.error_code, "INPUT_FILE_UNREADABLE");
  privacy(missingCredentials.stdout + missingConfig.stdout + invalid.stdout, root);
  assert.equal(store.getWork(work.workId).operations.length, 0);
});

test("submit exits while executor retains POST; bounded wait and duplicate CLI calls never interrupt or resend", async t => {
  const { root, work, requestPath, state, store, release } = await httpFixture(t);
  const submitted = await runCli(root, "submit", ["--request", requestPath]);
  assert.equal(submitted.exitCode, 0);
  const operationId = String(submitted.value.operationId);
  await eventually(() => state.posts.length === 1, "detached executor POST");
  const operation = store.getOperation(operationId);
  assert.equal(state.posts[0]!.body.messageID, operation.messageId);
  assert.equal(state.posts[0]!.released, false);
  assert.equal(state.postClosedEarly, false);
  const waiting = await runCli(root, "wait", ["--operation-id", operationId, "--wait-ms", "75"]);
  assert.equal(waiting.exitCode, 0);
  assert.equal(waiting.value.observationEnded, true);
  assert.equal(waiting.value.sessionInterrupted, false);
  assert.equal(waiting.value.execution, "PENDING");
  assert.equal(state.postClosedEarly, false);
  assert.equal(state.posts[0]!.released, false);
  const duplicate = await runCli(root, "submit", ["--request", requestPath]);
  const executor = await runCli(root, "execute-operation", ["--operation-id", operationId]);
  assert.equal(duplicate.value.created, false);
  assert.equal(duplicate.value.operationId, operationId);
  assert.equal(executor.exitCode, 0);
  assert.equal(state.posts.length, 1);
  const pausePath = writeJson(root, "pause.json", { workId: work.workId, paused: true, instructionReference: "fixture/pause-in-flight" });
  await runCli(root, "record-pause", ["--request", pausePath], false);
  release();
  await eventually(() => store.getOperation(operationId).completedAt !== null, "retained response persistence");
  const inspected = await runCli(root, "inspect", ["--operation-id", operationId], false);
  const reconciled = await runCli(root, "reconcile", ["--operation-id", operationId]);
  assert.equal(inspected.value.execution, "COMPLETED");
  assert.equal(inspected.value.delivery, "DELIVERED");
  assert.equal(reconciled.value.operationId, operationId);
  assert.equal(reconciled.value.execution, "COMPLETED");
  assert.equal(inspected.value.interpretation, null);
  assert.equal(store.getWork(work.workId).paused, true);
  const result = await runCli(root, "read-result", ["--operation-id", operationId], false);
  assert.equal(result.value.text, "Private fixture result without an acceptance envelope.");
  privacy(submitted.stdout + waiting.stdout + duplicate.stdout + executor.stdout + inspected.stdout + reconciled.stdout, root, [operation.messageId, "msg_cli_response_1"]);
  assert.equal(state.posts.length, 1);
  assert.equal(state.postClosedEarly, false);
  assert.equal(state.calls.some(call => /abort|interrupt|cancel/.test(call.path)), false);
  assert.ok(state.calls.every(call => call.directory === root && call.authorized));
});

test("busy executor keeps unsent preparation claimed and can later resume the same action", async t => {
  const { root, store, engine, request, state } = await httpFixture(t);
  const prepared = await engine.prepare(request);
  state.busy = true;
  const blocked = await runCli(root, "execute-operation", ["--operation-id", prepared.operation.operationId, "--idle-wait-ms", "0"]);
  assert.equal(blocked.value.execution, "PREPARED");
  assert.equal(blocked.value.delivery, "NOT_SENT");
  assert.equal(blocked.value.reason, "PARTICIPANT_BUSY");
  assert.equal(state.posts.length, 0);
  assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
  state.busy = false;
  await assert.rejects(engine.prepare({ ...request, actionKey: "conflicting-action" }), error => error instanceof Error && "code" in error && error.code === "PARTICIPANT_BUSY");
  state.hold = false;
  const resumed = await runCli(root, "execute-operation", ["--operation-id", prepared.operation.operationId]);
  assert.equal(resumed.value.execution, "COMPLETED");
  assert.equal(state.posts.length, 1);
  assert.equal(state.posts[0]!.body.messageID, prepared.operation.messageId);
});

test("bounded executor observes busy-to-idle automatically while wait stays attached through PREPARED", async t => {
  const { root, store, engine, request, state } = await httpFixture(t);
  const prepared = await engine.prepare(request);
  state.busy = true; state.hold = false;
  const executor = runCli(root, "execute-operation", ["--operation-id", prepared.operation.operationId, "--idle-wait-ms", "2500"]);
  await eventually(() => store.getOperation(prepared.operation.operationId).observation?.context?.reason === "PARTICIPANT_BUSY", "pre-send busy observation");
  assert.equal(state.posts.length, 0);
  let waitExited = false;
  const waiter = runCli(root, "wait", ["--operation-id", prepared.operation.operationId, "--wait-ms", "2500"]).then(result => { waitExited = true; return result; });
  // A wait observing PREPARED must remain available for the retained executor.
  await delay(300);
  assert.equal(waitExited, false);
  assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
  state.busy = false;
  const [executed, waited] = await Promise.all([executor, waiter]);
  assert.equal(executed.value.execution, "COMPLETED");
  assert.equal(waited.value.execution, "COMPLETED");
  assert.equal(waited.value.sessionInterrupted, false);
  assert.equal(state.posts.length, 1);
  assert.equal(state.posts[0]!.body.messageID, prepared.operation.messageId);
});

test("unknown no-send flag is rejected before preparation or any POST", async t => {
  const { root, requestPath, state, store, work } = await httpFixture(t);
  const before = state.calls.length;
  const rejected = await runCli(root, "submit", ["--request", requestPath, "--no-send", "true"]);
  assert.equal(rejected.exitCode, 1);
  assert.equal(rejected.value.error_code, "INVALID_ARGUMENTS");
  assert.equal(store.getWork(work.workId).operations.length, 0);
  assert.equal(state.posts.length, 0);
  assert.equal(state.calls.length, before);
});

test("observe-session persists a sanitized snapshot visible through offline inspect", async t => {
  const { root, work, state } = await httpFixture(t);
  const observed = await runCli(root, "observe-session", ["--work-id", work.workId, "--role", "Delivery"]);
  assert.equal(observed.exitCode, 0, observed.stdout);
  const inspected = await runCli(root, "inspect", ["--work-id", work.workId], false);
  const snapshots = inspected.value.observations as Record<string, { activity: string }>;
  assert.equal(snapshots.Delivery!.activity, "IDLE");
  privacy(observed.stdout + inspected.stdout, root);
  assert.equal(state.posts.length, 0);
});

for (const failure of ["source", "configuration"] as const) {
  test(`permanent pre-send ${failure} failure releases only the known-unsent claim`, async t => {
    const { root, engine, request, store, state, configuration } = await httpFixture(t);
    const source = path.join(root, "source.md"); writeFileSync(source, "Frozen fixture source");
    const prepared = await engine.prepare({ ...request, sources: [{ path: "source.md" }] });
    if (failure === "source") writeFileSync(source, "Changed fixture source");
    else {
      configuration.targets["cli-fixture"]!.roles.Delivery!.allowedCommands = [];
      writeJson(root, "router-config.json", configuration);
    }
    const failed = await runCli(root, "execute-operation", ["--operation-id", prepared.operation.operationId]);
    assert.equal(failed.exitCode, 0);
    assert.equal(failed.value.execution, "FAILED");
    assert.equal(failed.value.delivery, "NOT_SENT");
    assert.equal(failed.value.reason, "NOT_DISPATCHED");
    assert.equal(store.getOperation(prepared.operation.operationId).dispatchStartedAt, null);
    assert.equal(state.posts.length, 0);
    const original = store.getOperation(prepared.operation.operationId);
    assert.deepEqual((await runCli(root, "execute-operation", ["--operation-id", original.operationId])).value, failed.value);
    writeFileSync(source, "Frozen fixture source");
    delete configuration.targets["cli-fixture"]!.roles.Delivery!.allowedCommands;
    writeJson(root, "router-config.json", configuration);
    const next = await engine.prepare({ ...request, actionKey: "replacement-after-unsent" });
    assert.equal(next.created, true);
    assert.notEqual(next.operation.operationId, original.operationId);
    assert.equal(state.posts.length, 0);
  });
}
