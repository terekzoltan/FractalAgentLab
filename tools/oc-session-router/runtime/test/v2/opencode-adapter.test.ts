import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { AdapterError, OpenCodeAdapter, generateMessageId, type Acknowledgement, type AdapterOptions } from "../../src/v2/opencode-adapter.js";

const session = "ses_fixture";
const root = "msg_fixture_root";
const directory = "C:\\synthetic\\project with space";
function message(overrides: Record<string, unknown> = {}, parts?: unknown[]) {
  return {
    info: { id: "msg_fixture_answer", sessionID: session, parentID: root, role: "assistant", time: { created: 100, completed: 200 }, finish: "stop", ...overrides },
    parts: parts ?? [{ type: "text", id: "prt_fixture", messageID: "msg_fixture_answer", sessionID: session, text: "A useful answer" }],
  };
}
function json(res: ServerResponse, value: unknown, status = 200, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}
async function fixture(t: TestContext, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>, options?: AdapterOptions) {
  const failures: unknown[] = [];
  const server = createServer((req, res) => {
    Promise.resolve().then(() => handler(req, res)).catch(error => { failures.push(error); if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); assert.deepEqual(failures, []); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  return { origin, adapter: new OpenCodeAdapter({ origin, directory, session }, { username: "fixture-user", password: "fixture-password" }, options) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test("shared GET budget prevents later requests while an expired budget leaves command POST intact", async t => {
  const postStarted = deferred<void>();
  const releasePost = deferred<void>();
  let gets = 0, posts = 0, postClosedEarly = false;
  const { adapter } = await fixture(t, async (req, res) => {
    if (req.method === "GET") {
      gets += 1;
      if (gets === 1) {
        await delay(50);
        json(res, { id: session, directory, projectID: "fixture-project" });
      }
      return; // The next synthetic GET consumes the remaining shared budget.
    }
    posts += 1;
    await body(req);
    res.on("close", () => { if (!res.writableEnded) postClosedEarly = true; });
    postStarted.resolve();
    await releasePost.promise;
    json(res, message());
  }, { getTimeoutMs: 1000, getBudgetMs: 200 });
  assert.equal((await adapter.getSession()).value?.id, session);
  await assert.rejects(adapter.getStatus(), error => error instanceof AdapterError && error.code === "GET_TIMEOUT");
  await delay(15); // Account for sub-millisecond timer rounding at the deadline.
  await assert.rejects(adapter.listCommands(), error => error instanceof AdapterError && error.code === "GET_TIMEOUT");
  await assert.rejects(adapter.getHistory({ limit: 40 }), error => error instanceof AdapterError && error.code === "GET_TIMEOUT");
  assert.equal(gets, 2);
  const command = adapter.submitCommand({ messageID: root, command: "implement", arguments: "Fixture command" });
  try {
    await postStarted.promise;
    const state = await Promise.race([command.then(() => "completed"), delay(75).then(() => "still-pending")]);
    assert.equal(state, "still-pending");
    assert.equal(postClosedEarly, false);
    assert.equal(posts, 1);
  } finally { releasePost.resolve(); }
  assert.equal((await command).value?.id, "msg_fixture_answer");
  assert.equal(posts, 1);
  assert.equal(postClosedEarly, false);
});

test("command retains installed slash semantics and correlates before parsing output", async t => {
  const facts: Acknowledgement[] = [];
  let calls = 0;
  const { adapter } = await fixture(t, async (req, res) => {
    calls += 1;
    const url = new URL(req.url!, "http://fixture");
    assert.equal(req.method, "POST");
    assert.equal(url.pathname, `/session/${session}/command`);
    assert.equal(url.searchParams.get("directory"), directory);
    assert.equal(req.headers.authorization, `Basic ${Buffer.from("fixture-user:fixture-password").toString("base64")}`);
    assert.deepEqual(await body(req), { messageID: root, command: "implement", arguments: "keep $ARGUMENTS and quotes intact", agent: "track", model: "provider/model", variant: "high" });
    json(res, message({}, [{ type: "text", text: 123 }]));
  });
  const result = await adapter.submitCommand({ messageID: root, command: "implement", arguments: "keep $ARGUMENTS and quotes intact", agent: "track", model: "provider/model", variant: "high" }, fact => { facts.push(fact); });
  assert.equal(calls, 1);
  assert.equal(result.status, 200);
  assert.equal(result.problem, "INVALID_RESPONSE");
  assert.deepEqual(result.correlation, { rootMessageId: root, responseMessageId: "msg_fixture_answer" });
  assert.equal(facts.length, 2);
  assert.equal(facts[0]!.rootMessageId, undefined);
  assert.equal(facts[1]!.rootMessageId, root);
  assert.match(result.bodySha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(adapter), "{}");
});

test("message submission is a typed clarification prompt, not a command expansion", async t => {
  const { adapter } = await fixture(t, async (req, res) => {
    assert.equal(new URL(req.url!, "http://fixture").pathname, `/session/${session}/message`);
    assert.deepEqual(await body(req), { messageID: root, parts: [{ type: "text", text: "Clarify the evidence reference." }], agent: "review", model: { providerID: "provider", modelID: "model" }, variant: "high" });
    json(res, message());
  });
  const result = await adapter.submitMessage({ messageID: root, text: "Clarify the evidence reference.", agent: "review", model: { providerID: "provider", modelID: "model" }, variant: "high" });
  assert.equal(result.value?.text, "A useful answer");
  assert.equal(result.correlation?.rootMessageId, root);
});

test("unknown tools and provider fields do not invalidate known correlation", async t => {
  const { adapter } = await fixture(t, (_req, res) => json(res, message({ providerID: "provider", modelID: "model", tokens: { input: 30, output: 10, reasoning: 5, cache: { read: 7, write: 2 }, future: "ignored" }, future: { unsupported: true } }, [
    { type: "tool", messageID: "msg_fixture_answer", sessionID: session, state: { entirely: "new tool shape" } },
    { type: "reasoning", text: "private reasoning", newField: true },
    { type: "new-provider-part", opaque: [1, 2, 3] },
    { type: "text", text: "visible" }, { type: "text", text: "synthetic", synthetic: true }, { type: "text", text: "ignored", ignored: true },
    { type: "compaction", newShape: true },
  ])));
  const result = await adapter.submitCommand({ messageID: root, command: "review", arguments: "" });
  assert.equal(result.problem, undefined);
  assert.equal(result.value?.text, "visible");
  assert.equal(result.value?.hasCompactionPart, true);
  assert.equal(result.value?.providerID, "provider");
  assert.equal(result.value?.modelID, "model");
  assert.deepEqual(result.value?.tokens, { input: 30, output: 10, reasoning: 5, cache: { read: 7, write: 2 } });
  assert.equal(result.value?.timeCompleted, 200);
});

test("wrong session or parent remains HTTP evidence without correlated acknowledgement", async t => {
  let sequence = 0;
  const { adapter } = await fixture(t, (_req, res) => json(res, message(sequence++ === 0 ? { parentID: "msg_other" } : { sessionID: "ses_other" })));
  for (let i = 0; i < 2; i += 1) {
    const facts: Acknowledgement[] = [];
    const result = await adapter.submitCommand({ messageID: root, command: "review", arguments: "" }, fact => { facts.push(fact); });
    assert.equal(result.status, 200);
    assert.equal(result.problem, "IDENTITY_MISMATCH");
    assert.equal(result.correlation, undefined);
    assert.deepEqual(facts.map(fact => fact.rootMessageId), [undefined]);
  }
});

test("bound GET timeout and local observation completion leave the command POST alive", async t => {
  const started = deferred<void>();
  const release = deferred<void>();
  let postClosedEarly = false;
  let posts = 0;
  const { adapter } = await fixture(t, async (req, res) => {
    if (req.method === "GET") return; // Deliberately stalled synthetic observation.
    posts += 1;
    await body(req);
    res.on("close", () => { if (!res.writableEnded) postClosedEarly = true; });
    started.resolve();
    await release.promise;
    json(res, message());
  }, { getTimeoutMs: 25 });
  const post = adapter.submitCommand({ messageID: root, command: "implement", arguments: "" });
  await started.promise;
  await assert.rejects(adapter.getStatus(), error => error instanceof AdapterError && error.code === "GET_TIMEOUT");
  assert.equal(postClosedEarly, false);
  const snapshot = await Promise.race([post.then(() => "settled"), Promise.resolve("observation-ended")]);
  assert.equal(snapshot, "observation-ended");
  release.resolve();
  assert.equal((await post).value?.text, "A useful answer");
  assert.equal(postClosedEarly, false);
  assert.equal(posts, 1);
});

test("history carries opaque cursor exactly and preserves server chronology", async t => {
  const cursor = "opaque.next/+==:token";
  let calls = 0;
  const { adapter } = await fixture(t, (req, res) => {
    const url = new URL(req.url!, "http://fixture");
    assert.equal(url.searchParams.get("limit"), "2");
    calls += 1;
    if (calls === 1) {
      assert.equal(url.searchParams.has("before"), false);
      json(res, [message({ id: "msg_z", time: { created: 10 } }, []), message({ id: "msg_a", time: { created: 20 } }, [])], 200, { "X-Next-Cursor": cursor });
    } else {
      assert.equal(url.searchParams.get("before"), cursor);
      json(res, [message({ id: "msg_older", time: { created: 1 } }, [])]);
    }
  });
  const first = await adapter.getHistory({ limit: 2 });
  assert.deepEqual(first.value?.messages.map(item => item.id), ["msg_z", "msg_a"]);
  assert.equal(first.value?.nextCursor, cursor);
  const second = await adapter.getHistory({ limit: 2, before: first.value!.nextCursor! });
  assert.equal(second.value?.nextCursor, undefined);
  assert.equal(calls, 2);
  await assert.rejects(adapter.getHistory({ limit: 0 }), { code: "INVALID_INPUT" });
});

test("exact message lookup validates ID and text part session while allowing partial execution", async t => {
  let calls = 0;
  const { adapter } = await fixture(t, (req, res) => {
    assert.equal(new URL(req.url!, "http://fixture").pathname, `/session/${session}/message/msg_expected`);
    if (calls++ === 0) json(res, message({ id: "msg_other" }, []));
    else if (calls === 2) json(res, message({ id: "msg_expected" }, [{ type: "text", text: "wrong", sessionID: "ses_other" }]));
    else json(res, message({ id: "msg_expected", time: { created: 3 }, finish: undefined }, [{ type: "text", text: "still working" }]));
  });
  assert.equal((await adapter.getMessage("msg_expected")).problem, "IDENTITY_MISMATCH");
  assert.equal((await adapter.getMessage("msg_expected")).problem, "IDENTITY_MISMATCH");
  const partial = await adapter.getMessage("msg_expected");
  assert.equal(partial.value?.timeCompleted, undefined);
  assert.equal(partial.value?.text, "still working");
});

test("redirects, errors and async-only acknowledgements never trigger a POST retry", async t => {
  let posts = 0;
  const statuses = [302, 500, 204];
  const { adapter } = await fixture(t, (_req, res) => {
    const status = statuses[posts++];
    assert.ok(status);
    if (status === 204) { res.writeHead(status); res.end(); }
    else json(res, { error: "fixture" }, status, { location: "/should-not-follow" });
  });
  for (const status of statuses) {
    const result = await adapter.submitCommand({ messageID: root, command: "review", arguments: "" });
    assert.equal(result.status, status);
    assert.equal(result.correlation, undefined);
    assert.equal(result.problem, status === 204 ? "INVALID_RESPONSE" : "HTTP_ERROR");
  }
  assert.equal(posts, 3);
});

test("socket loss is sanitized ambiguity and never retried", async t => {
  let posts = 0;
  const { adapter } = await fixture(t, async (req, _res) => { await body(req); posts += 1; req.socket.destroy(); });
  await assert.rejects(adapter.submitCommand({ messageID: root, command: "review", arguments: "" }), error => error instanceof AdapterError && error.message === "NETWORK_ERROR");
  assert.equal(posts, 1);
});

test("bounded response rejects excessive bytes and preserves received status", async t => {
  const { adapter } = await fixture(t, (_req, res) => json(res, "x".repeat(1000)), { maxResponseBytes: 40 });
  await assert.rejects(adapter.getSession(), error => error instanceof AdapterError && error.code === "RESPONSE_TOO_LARGE" && error.status === 200);
});

test("live nullable optional command metadata is absence, not a registry failure", async t => {
  const { adapter } = await fixture(t, (_req, res) => json(res, [
    { name: "pilot", template: "$ARGUMENTS", agent: null, model: null, description: null, subtask: null },
    { name: "explicit", template: "work", subtask: false },
  ]));
  const result = await adapter.listCommands();
  assert.equal(result.problem, undefined);
  assert.deepEqual(result.value, [{ name: "pilot", template: "$ARGUMENTS" }, { name: "explicit", template: "work", subtask: false }]);
});

test("non-null malformed command metadata remains invalid", async t => {
  const { adapter } = await fixture(t, (_req, res) => json(res, [{ name: "bad", template: "work", subtask: "false" }]));
  assert.equal((await adapter.listCommands()).problem, "INVALID_RESPONSE");
});

test("read methods normalize session, current commands and status without strict unknown-field rejection", async t => {
  const { adapter } = await fixture(t, (req, res) => {
    const url = new URL(req.url!, "http://fixture");
    if (url.pathname === "/command") json(res, [{ name: "review", template: "review $ARGUMENTS", agent: "reviewer", model: "provider/model", subtask: false, future: true }]);
    else if (url.pathname === "/session/status") json(res, { [session]: { type: "retry", attempt: 4, next: 999 } });
    else json(res, { id: session, directory, projectID: "project_fixture", future: true });
  });
  assert.equal((await adapter.getSession()).value?.projectID, "project_fixture");
  assert.equal((await adapter.listCommands()).value?.[0]?.template, "review $ARGUMENTS");
  assert.equal((await adapter.getStatus()).value, "BUSY");
});

test("summarize uses supported maintenance body and makes no command or abort calls", async t => {
  let calls = 0;
  const { adapter } = await fixture(t, async (req, res) => {
    calls += 1;
    assert.equal(req.method, "POST");
    assert.equal(new URL(req.url!, "http://fixture").pathname, `/session/${session}/summarize`);
    assert.deepEqual(await body(req), { providerID: "provider", modelID: "model", auto: false });
    json(res, true);
  });
  assert.equal((await adapter.summarize({ providerID: "provider", modelID: "model", auto: false })).value, true);
  assert.equal(calls, 1);
});

test("message ID generation follows official timestamp-and-base62 layout", () => {
  const before = Date.now();
  const ids = Array.from({ length: 100 }, () => generateMessageId());
  const after = Date.now();
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(id, /^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/);
    const timestamp = Number(BigInt(`0x${id.slice(4, 16)}`) / 0x1000n);
    // Official six-byte encoding keeps 36 timestamp bits plus 12 counter bits.
    const modulus = 2 ** 36;
    assert.ok(timestamp >= before % modulus && timestamp <= after % modulus);
  }
  assert.deepEqual([...ids].sort(), ids);
});

test("private origin constraints and invalid command inputs fail before transport", async () => {
  for (const origin of ["https://127.0.0.1", "http://example.com", "http://127.0.0.1/path", "http://user:password@127.0.0.1", "http://127.0.0.1?query=1"]) {
    assert.throws(() => new OpenCodeAdapter({ origin, directory, session }, { username: "user", password: "password" }), { code: "INVALID_INPUT" });
  }
  const adapter = new OpenCodeAdapter({ origin: "http://127.0.0.1", directory, session }, { username: "user", password: "password" });
  await assert.rejects(adapter.submitCommand({ messageID: "a-plain-uuid", command: "review", arguments: "" }), { code: "INVALID_INPUT" });
  await assert.rejects(adapter.submitCommand({ messageID: root, command: "/review", arguments: "" }), { code: "INVALID_INPUT" });
});

test("selected model lookup exposes only matched limits, never the provider catalog", async t => {
  const { adapter } = await fixture(t, (req, res) => {
    const url = new URL(req.url!, "http://fixture");
    assert.equal(req.method, "GET");
    assert.equal(url.pathname, "/provider");
    assert.equal(url.searchParams.get("directory"), directory);
    json(res, { all: [{ id: "provider", options: { privateFixture: "must-not-return" }, models: {
      selected: { id: "selected", providerID: "provider", limit: { context: 500000, input: 450000, output: 128000 }, privateFixture: "must-not-return" },
      other: { id: "other", providerID: "provider", limit: { context: 999999 } },
      wrong: { id: "not-the-key", providerID: "provider", limit: { context: 999 } },
    } }], default: { provider: "other" }, connected: ["provider"] });
  });
  const result = await adapter.getModelInfo("provider", "selected");
  assert.deepEqual(result.value, { providerID: "provider", modelID: "selected", contextLimit: 500000, inputLimit: 450000, outputLimit: 128000 });
  assert.equal(JSON.stringify(result).includes("must-not-return"), false);
  assert.equal((await adapter.getModelInfo("provider", "missing")).value, null);
  assert.equal((await adapter.getModelInfo("provider", "wrong")).problem, "IDENTITY_MISMATCH");
});

test("provider-only 16 MiB allowance admits the real-size catalog without widening other responses", async t => {
  let paddingBytes = 6 * 1024 * 1024;
  const { adapter } = await fixture(t, (_req, res) => {
    json(res, { padding: "x".repeat(paddingBytes), all: [{ id: "p", models: { m: { id: "m", providerID: "p", limit: { context: 400000, input: 272000, output: 128000 } } } }] });
  });
  assert.equal((await adapter.getModelInfo("p", "m")).value?.inputLimit, 272000);
  await assert.rejects(adapter.listCommands(), { code: "RESPONSE_TOO_LARGE" });
  await assert.rejects(adapter.submitCommand({ messageID: root, command: "implement", arguments: "fixture" }), { code: "RESPONSE_TOO_LARGE" });
  paddingBytes = 17 * 1024 * 1024;
  await assert.rejects(adapter.getModelInfo("p", "m"), { code: "RESPONSE_TOO_LARGE" });
});
