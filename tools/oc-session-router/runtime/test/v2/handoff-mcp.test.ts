import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import path from "node:path";
import { PassThrough } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { serveHandoffMcp, toolDefinitions } from "../../src/v2/handoff-mcp.js";
import { OperationStore } from "../../src/v2/state-store.js";
import { callHandoffTool } from "../../src/v2/handoff-bridge.js";
import type { RouterConfiguration } from "../../src/v2/routing.js";
import type { HandoffRequest } from "../../src/v2/orchestrator-handoff.js";

async function wire(lines: unknown[], invoke = async () => ({})) {
  const input = new PassThrough(), output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });
  const running = serveHandoffMcp(input, output, invoke);
  for (const value of lines) input.write(`${typeof value === "string" ? value : JSON.stringify(value)}\n`);
  input.end();
  await running;
  return text.trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as Record<string, any>);
}
const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "fixture", version: "1" } } };
const ready = { jsonrpc: "2.0", method: "notifications/initialized" };

test("MCP actual newline wire negotiates tools only and separates readonly from local/remote mutation", async () => {
  const output = await wire([init, ready, { jsonrpc: "2.0", id: 2, method: "tools/list" }]);
  assert.equal(output[0]!.result.protocolVersion, "2025-03-26");
  assert.deepEqual(Object.keys(output[0]!.result.capabilities), ["tools"]);
  assert.deepEqual(output[1]!.result.tools.map((tool: { name: string }) => tool.name),
    ["read_session_context", "inspect_orchestrator", "prepare_handoff", "send_handoff", "inspect_handoff", "reconcile_handoff"]);
  assert.deepEqual(toolDefinitions.filter(tool => tool.annotations.readOnlyHint).map(tool => tool.name), ["read_session_context", "inspect_orchestrator", "inspect_handoff"]);
  assert.equal(toolDefinitions.find(tool => tool.name === "send_handoff")!.annotations.destructiveHint, true);
});

test("MCP cannot call tools before initialize, via notifications or through arbitrary proxy methods", async () => {
  let invoked = 0;
  const output = await wire([
    { jsonrpc: "2.0", id: 0, method: "tools/call", params: { name: "send_handoff", arguments: {} } },
    init, ready,
    { jsonrpc: "2.0", method: "tools/call", params: { name: "send_handoff", arguments: {} } },
    ...["post", "shell", "sql", "create_session", "answer_permission"].map((name, index) =>
      ({ jsonrpc: "2.0", id: index + 2, method: "tools/call", params: { name, arguments: {} } })),
    { jsonrpc: "2.0", id: 99, method: "resources/read", params: { uri: "secret" } },
  ], async () => { invoked++; return {}; });
  assert.equal(invoked, 0);
  assert.equal(output[0]!.error.code, -32000);
  assert.equal(output.at(-1)!.error.code, -32601);
  assert.equal(output.filter(item => item.error?.code === -32602).length, 5);
});

test("MCP bounds malformed input and redacts unknown exceptions", async () => {
  const output = await wire(["not-json", "界".repeat(24_000), init, ready,
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "inspect_orchestrator", arguments: { project: "fixture" } } }],
  async () => { throw new Error("PASSWORD=must-never-escape C:/private http://private"); });
  assert.equal(output[0]!.error.code, -32700);
  assert.equal(output[1]!.error.code, -32600);
  assert.equal(output.at(-1)!.result.isError, true);
  assert.doesNotMatch(JSON.stringify(output), /must-never-escape|private/);
});

async function eventually(predicate: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Fixture wait exceeded");
    await delay(20);
  }
}

test("MCP subprocess disconnect leaves FAL executor alive; duplicate/restart/disabled inspection does not resend", async t => {
  const root = mkdtempSync(path.join(process.cwd(), ".router-v2-mcp-wire-"));
  const dbPath = path.join(root, "router.sqlite");
  const store = new OperationStore(dbPath);
  const session = "ses_mcp_orchestrator";
  const messages: Array<{ info: Record<string, unknown>; parts: Array<{ type: string; text: string }> }> = [
    { info: { id: "msg_old_user", sessionID: session, role: "user", agent: "build", variant: "high", model: { providerID: "fixture", modelID: "chosen" }, time: { created: 1 } }, parts: [{ type: "text", text: "Previous scope" }] },
    { info: { id: "msg_old_answer", sessionID: session, role: "assistant", parentID: "msg_old_user", agent: "build", providerID: "fixture", modelID: "chosen", time: { created: 2, completed: 3 }, finish: "stop" }, parts: [{ type: "text", text: "Previous final" }] },
  ];
  const posts: Array<{ body: Record<string, any>; response: ServerResponse; operationId: string; released: boolean }> = [];
  const calls: string[] = [];
  let busy = false;
  const release = () => {
    for (const post of posts) {
      if (post.released) continue;
      post.released = true;
      const response = { info: { id: `msg_result_${posts.length}`, sessionID: session, role: "assistant", parentID: post.body.messageID,
        agent: "build", providerID: "fixture", modelID: "chosen", time: { created: Date.now(), completed: Date.now() }, finish: "stop" },
        parts: [{ type: "text", text: "Useful retained response; product acceptance is separate" }] };
      messages.push(response);
      post.response.writeHead(200, { "content-type": "application/json", connection: "close" });
      post.response.end(JSON.stringify(response));
    }
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://127.0.0.1");
    calls.push(`${request.method} ${url.pathname}`);
    const send = (value: unknown, status = 200) => { response.writeHead(status, { "content-type": "application/json", connection: "close" }); response.end(JSON.stringify(value)); };
    if (request.headers.authorization !== `Basic ${Buffer.from("fixture:fixture-password").toString("base64")}`) return send({}, 401);
    if (request.method === "GET" && url.pathname === `/session/${session}`) return send({ id: session, directory: root, projectID: "control" });
    if (request.method === "GET" && url.pathname === "/session/status") return send({ [session]: { type: busy ? "busy" : "idle" } });
    if (request.method === "GET" && ["/permission", "/question"].includes(url.pathname)) return send([]);
    if (request.method === "GET" && url.pathname === `/session/${session}/message`) return send(messages);
    if (request.method === "GET" && url.pathname.startsWith(`/session/${session}/message/`)) {
      const found = messages.find(message => message.info.id === url.pathname.split("/").at(-1));
      return send(found ?? {}, found ? 200 : 404);
    }
    if (request.method === "GET" && url.pathname === "/provider") return send({ all: [] });
    if (request.method === "POST" && url.pathname === `/session/${session}/message`) {
      let raw = "";
      request.setEncoding("utf8"); request.on("data", (chunk: string) => { raw += chunk; });
      request.on("end", () => {
        const body = JSON.parse(raw) as Record<string, any>;
        const workId = store.listRecentWorkIds("control")[0]!;
        const operation = store.getWork(workId).operations[0]!;
        assert.equal(operation.messageId, body.messageID);
        assert.ok(operation.dispatchStartedAt);
        assert.equal(operation.action.kind, "ORCHESTRATOR_HANDOFF");
        posts.push({ body, response, operationId: operation.operationId, released: false });
      });
      return;
    }
    send({}, 404);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const config: RouterConfiguration = { schemaVersion: 2, targets: {
    control: { namespace: "fixture", project: "control", directory: root, origin: `http://127.0.0.1:${address.port}`,
      roles: { Orchestrator: { session, capability: "ORCHESTRATOR", profile: "fixture", model: "wrong/model", agent: "wrong", variant: "low" } } },
    product: { namespace: "product", project: "product", directory: path.join(root, "product"), origin: "http://127.0.0.1:1", roles: {} },
  }, orchestratorBridge: { enabled: true, projects: { fixture: { controlTarget: "control", governedTarget: "product", recipientRole: "Orchestrator", instructionReference: "owner/enrollment" } } } };
  const configPath = path.join(root, "router-config.json");
  writeFileSync(configPath, JSON.stringify(config));
  const entry = fileURLToPath(new URL("../../src/v2/handoff-mcp.js", import.meta.url));
  const child = spawn(process.execPath, ["--experimental-sqlite", entry, "--state-root", root, "--config", configPath],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, OPENCODE_SERVER_USERNAME: "fixture", OPENCODE_SERVER_PASSWORD: "fixture-password" } });
  const outputs: Array<Record<string, any>> = [];
  let text = "", stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    text += chunk;
    while (text.includes("\n")) {
      const index = text.indexOf("\n");
      outputs.push(JSON.parse(text.slice(0, index)) as Record<string, any>);
      text = text.slice(index + 1);
    }
  });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  const exited = new Promise<number | null>(resolve => child.once("close", resolve));
  t.after(async () => {
    child.stdin.end(); release();
    await exited;
    await eventually(() => posts.every(post => store.getOperation(post.operationId).completedAt !== null));
    await new Promise<void>(resolve => server.close(() => resolve()));
    await delay(150);
    store.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  const send = (value: unknown) => child.stdin.write(`${JSON.stringify(value)}\n`);
  const call = async (id: number, name: string, args: unknown) => {
    send({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
    await eventually(() => outputs.some(output => output.id === id));
    const found = outputs.find(output => output.id === id)!;
    assert.ok(!found.error, JSON.stringify(found));
    assert.equal(found.result.isError, false, JSON.stringify(found));
    return JSON.parse(found.result.content[0].text) as Record<string, any>;
  };
  send(init); send(ready);
  const request: HandoffRequest = { project: "fixture", handoffKey: "wire-1", scope: "Plan only", stoppingPoint: "Reviewed plan",
    exclusions: "No code or publication", instructionReference: "owner/test", message: "Continue the plan — árvíztűrő." };
  const preview = await call(2, "prepare_handoff", request);
  assert.equal(posts.length, 0);
  const before = readFileSync(dbPath);
  await call(3, "inspect_handoff", { handoffId: preview.handoffId });
  assert.deepEqual(readFileSync(dbPath), before);
  const sent = await call(4, "send_handoff", { handoffId: preview.handoffId });
  assert.equal(sent.executorRequested, true);
  child.stdin.end();
  assert.equal(await exited, 0, stderr);
  await eventually(() => posts.length === 1);
  assert.equal(posts[0]!.body.parts[0].text, preview.exactMessage);
  assert.deepEqual(posts[0]!.body.model, { providerID: "fixture", modelID: "chosen" });
  assert.equal(posts[0]!.body.agent, "build");
  assert.equal(posts[0]!.body.variant, "high");
  assert.ok(!posts[0]!.response.destroyed, "Closing MCP must not abort executor POST");
  busy = true;
  config.orchestratorBridge!.enabled = false;
  writeFileSync(configPath, "{bad config");
  const old = await callHandoffTool("send_handoff", { handoffId: preview.handoffId }, root, configPath) as Record<string, unknown>;
  assert.equal(old.operationId, sent.operationId);
  assert.equal(posts.length, 1);
  const inspected = await callHandoffTool("inspect_handoff", { handoffId: preview.handoffId }, root, configPath) as Record<string, unknown>;
  assert.equal(inspected.delivery, "POSSIBLE");
  const oldPreview = await callHandoffTool("prepare_handoff", request, root, configPath) as Record<string, unknown>;
  assert.equal(oldPreview.remoteSendPerformedByThisCall, false);
  assert.equal(oldPreview.previewOnlyCall, true);
  assert.equal(Object.hasOwn(oldPreview, "delivery"), false);
  assert.equal(Object.hasOwn(oldPreview, "delivered"), false);
  writeFileSync(configPath, JSON.stringify(config));
  busy = false; release();
  await eventually(() => store.getOperation(String(sent.operationId)).completedAt !== null);
  assert.equal(store.getOperation(String(sent.operationId)).outcome?.execution, "COMPLETED");
  assert.equal(calls.filter(call => call.startsWith("POST ")).length, 1);
  assert.ok(!calls.some(call => /command|summarize|permission.*POST/.test(call)));
});
