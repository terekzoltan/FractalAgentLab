import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { callHandoffTool } from "../../src/v2/handoff-bridge.js";
import { contextBinding, contextRequest, contextText, readSessionContext } from "../../src/v2/session-context.js";
import type { OpenCodeMessage } from "../../src/v2/opencode-adapter.js";
import type { RouterConfiguration } from "../../src/v2/routing.js";

const session = "ses_fixture";
const expected = { session, project: "fixture", directory: path.resolve("fixture") };
const message: OpenCodeMessage = { id: "msg_answer", session, role: "assistant", hasCompactionPart: false, timeCompleted: 2, finish: "stop", text: "Done" };
const ok = <T>(value: T) => ({ status: 200, bodySha256: "fixture", value });
function reader(messages: OpenCodeMessage[] = [message]) {
  return { getSession: async () => ok({ id: session, projectID: "fixture", directory: expected.directory }),
    getStatus: async () => ok("IDLE" as const), getHistory: async ({ limit }: { limit: number }) => { assert.equal(limit, 12); return ok({ messages }); },
    getPendingInteractions: async () => ({ permissions: 0, questions: 0 }) };
}
test("context accepts only bounded role requests", () => {
  assert.deepEqual(contextRequest({ project: "p", role: "Meta" }), { project: "p", role: "Meta", count: 1 });
  for (const args of [{ project: "p", role: "Meta", count: 4 }, { project: "p", role: "Meta", url: "http://x" }, { role: "Meta" }]) assert.throws(() => contextRequest(args));
});
test("context uses enrolled homes without asserting damaged execution roots", () => {
  const role = { session, profile: "x", capability: "META" as const, sessionHome: { directory: expected.directory, instructionReference: "owner" } };
  const target = { namespace: "n", project: "fixture", directory: path.resolve("missing-worktree"), origin: "http://127.0.0.1:1234", roles: { Meta: role } };
  const config: RouterConfiguration = { schemaVersion: 2, targets: { p: target }, orchestratorBridge: { enabled: false, projects: { p: { controlTarget: "p", governedTarget: "p", recipientRole: "Meta", instructionReference: "owner" } } } };
  assert.equal(contextBinding(config, "p", "Meta").home, expected.directory);
  assert.throws(() => contextBinding(config, "other", "Meta"));
  assert.throws(() => contextBinding(config, "p", "__proto__"));
  assert.throws(() => contextBinding(config, "p", "orchestrator"));
  target.origin = "http://example.com";
  assert.throws(() => contextBinding(config, "p", "Meta"));
});
test("stable outputs omit IDs and retain digest, no state writes required", async () => {
  const result = await readSessionContext(reader(), expected, 1);
  assert.equal(result.evidence, "LIVE_OUTPUT_STABLE");
  assert.equal(result.outputs[0]!.text, "Done");
  assert.equal(result.localEvidenceMutation, false);
  assert.equal(result.operationCorrelationVerified, false);
  assert.doesNotMatch(JSON.stringify(result), /ses_fixture|msg_answer/);
});
test("busy, changed window and unknown status never claim stable evidence", async () => {
  const r = reader();
  let n = 0;
  r.getHistory = async () => ok({ messages: [{ ...message, text: String(n++) }] });
  assert.equal((await readSessionContext(r, expected, 1)).evidence, "IN_FLIGHT_SNAPSHOT");
  const busy = { ...reader(), getStatus: async () => ok("BUSY" as const) };
  assert.equal((await readSessionContext(busy, expected, 1)).evidence, "IN_FLIGHT_SNAPSHOT");
});
test("summaries, errors, partial and tool-only responses excluded; output is capped", async () => {
  const messages = [{ ...message, text: "x".repeat(17000) }, { ...message, summary: true }, { ...message, error: true }, { ...message, finish: "tool-calls" }, { ...message, text: "" }];
  const result = await readSessionContext(reader(messages), expected, 3);
  assert.equal(result.outputs.length, 1);
  assert.equal(result.outputs[0]!.text.length, 16000);
  assert.equal(result.outputs[0]!.truncated, true);
});
test("wrong session identity or history rejects, unavailable attention stays unknown", async () => {
  await assert.rejects(readSessionContext({ ...reader(), getSession: async () => ok({ id: "ses_other", projectID: "fixture", directory: expected.directory }) }, expected, 1));
  await assert.rejects(readSessionContext(reader([{ ...message, session: "ses_other" }]), expected, 1));
  const result = await readSessionContext({ ...reader(), getPendingInteractions: async () => ({ permissions: null, questions: null }) }, expected, 1);
  assert.equal(result.ownerAttention.state, "UNAVAILABLE");
});
test("known credential, auth strings, raw IDs and common keys are redacted", () => {
  const safe = contextText('ses_example msg_example sk-example Bearer abc123 password="hidden" private-password', ["private-password"]);
  assert.doesNotMatch(safe, /ses_example|msg_example|sk-example|abc123|hidden|private-password/);
});

test("facade reads orchestrator, Meta and lane by GET only with disabled sending and no store", async t => {
  const root = mkdtempSync(path.join(tmpdir(), "fal-context-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const methods: string[] = [];
  const server = createServer((req, res) => {
    methods.push(req.method!);
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === `/session/${session}`) res.end(JSON.stringify({ id: session, projectID: "fixture", directory: expected.directory }));
    else if (url.pathname.endsWith("/message")) res.end(JSON.stringify([{ info: { id: "msg_final", sessionID: session, role: "assistant", time: { created: 1, completed: 2 }, finish: "stop" }, parts: [{ type: "text", text: "visible" }, { type: "reasoning", text: "private reasoning" }, { type: "text", text: "synthetic", synthetic: true }] }]));
    else res.end(url.pathname === "/session/status" ? "{}" : "[]");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const port = (server.address() as { port: number }).port;
  const role = (capability: string) => ({ session, capability, profile: "fixture" });
  const target = { namespace: "n", project: "fixture", directory: expected.directory, origin: `http://127.0.0.1:${port}`, roles: { Meta: role("META"), "Track B": role("DELIVERY"), Orch: role("ORCHESTRATOR") } };
  const file = path.join(root, "config.json");
  writeFileSync(file, JSON.stringify({ schemaVersion: 2, targets: { p: target }, orchestratorBridge: { enabled: false, projects: { p: { controlTarget: "p", governedTarget: "p", recipientRole: "Orch", instructionReference: "fixture" } } } }));
  const old = process.env.OPENCODE_SERVER_PASSWORD;
  process.env.OPENCODE_SERVER_PASSWORD = "fixture-secret";
  t.after(() => { if (old === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = old; });
  for (const role of ["orchestrator", "Meta", "Track B"]) {
    const result = await callHandoffTool("read_session_context", { project: "p", role }, root, file) as { outputs: { text: string }[] };
    assert.equal(result.outputs[0]!.text, "visible");
  }
  assert.ok(methods.length > 0 && methods.every(method => method === "GET"));
  assert.deepEqual(readdirSync(root), ["config.json"]);
});
