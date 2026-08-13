import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/contracts.js";
import { CommandClient, reconcileSnapshot, type FetchLike } from "../src/transport.js";

const session = "session-fixture";
const responseBody = {
  info: { id: "assistant-1", role: "assistant", sessionID: session, parentID: "user-send-1" },
  parts: [{ id: "part-1", type: "text", text: "META PLAN REVIEW\nOverall verdict: GREEN", messageID: "assistant-1", sessionID: session }],
};

test("command client is response-first and disables redirects", async () => {
  let calls = 0;
  const fake: FetchLike = async (_input, init) => {
    calls += 1;
    assert.equal(init?.redirect, "manual");
    assert.match(String((init?.headers as Record<string, string>).authorization), /^Basic /);
    return new Response(JSON.stringify(responseBody), { status: 200 });
  };
  const receipt = await new CommandClient(fake).send({
    origin: "http://127.0.0.1:4321",
    server_fingerprint: "fake-server",
    session_id: session,
    username: "fixture",
    password: "process-only",
  }, "terv-review", "plan", 1000);
  assert.equal(calls, 1);
  assert.equal(receipt.message_id, "assistant-1");
  assert.match(receipt.terminal_markdown, /Overall verdict: GREEN/);
});

test("FSR-018: short private bindings are rejected before fetch", async () => {
  let calls = 0;
  const client = new CommandClient(async () => { calls += 1; return new Response(); });
  for (const field of ["server_fingerprint", "session_id", "username", "password"] as const) {
    const binding = {
      origin: "http://127.0.0.1:4321",
      server_fingerprint: "fingerprint-fixture",
      session_id: session,
      username: "fixture",
      password: "process-only",
      [field]: "x",
    };
    await assert.rejects(() => client.send(binding, "implement", "", 1000), /private transport binding/i);
  }
  assert.equal(calls, 0);
});

test("redirect and cross-origin HTTP are rejected", async () => {
  const redirect: FetchLike = async () => new Response("", { status: 302, headers: { location: "https://example.test" } });
  const client = new CommandClient(redirect);
  await assert.rejects(() => client.send({ origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password" }, "implement", "", 1000), /Redirect/);
  await assert.rejects(() => client.send({ origin: "http://example.test:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password" }, "implement", "", 1000), /loopback/);
});

test("HTTP 5xx is delivery-uncertain and never retried by the command client", async () => {
  let calls = 0;
  const fake: FetchLike = async () => { calls += 1; return new Response("failure", { status: 503 }); };
  await assert.rejects(() => new CommandClient(fake).send({ origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password" }, "implement", "", 1000), /HTTP 503/);
  assert.equal(calls, 1);
});

test("command response rejects duplicate members and non-text payload values", async () => {
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password" };
  const duplicate: FetchLike = async () => new Response('{"info":{"id":"assistant-1","role":"assistant","role":"user","sessionID":"session-fixture"},"parts":[]}');
  await assert.rejects(() => new CommandClient(duplicate).send(binding, "implement", "", 1000), /Duplicate JSON member/);

  const nonText: FetchLike = async () => new Response(JSON.stringify({
    info: { id: "assistant-1", role: "assistant", sessionID: session },
    parts: [{ id: "part-1", type: "text", text: 42, messageID: "assistant-1", sessionID: session }],
  }));
  await assert.rejects(() => new CommandClient(nonText).send(binding, "implement", "", 1000), /text payload/);
});

test("command response byte limit cancels the stream before unbounded buffering", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("123456"));
      controller.enqueue(new TextEncoder().encode("789"));
      controller.close();
    },
    cancel() { cancelled = true; },
  });
  const fake: FetchLike = async () => new Response(body, { status: 200 });
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password" };
  await assert.rejects(() => new CommandClient(fake, 5).send(binding, "implement", "", 1000), /byte limit/);
  assert.equal(cancelled, true);
});

test("snapshot reconciliation requires one exact candidate", () => {
  const candidate = { id: "assistant-1", parent_id: "user-send-1", session_id: session, text: "PLAN_REVIEW_COMPLETE", after_baseline: true };
  const expected = { sessionSha256: sha256(session), parentId: "user-send-1", terminal: (text: string) => text.endsWith("PLAN_REVIEW_COMPLETE") };
  assert.equal(reconcileSnapshot([candidate], expected).status, "TRANSCRIPT_RECONCILED");
  assert.equal(reconcileSnapshot([{ ...candidate, session_id: "other" }], expected).status, "UNCERTAIN");
  assert.equal(reconcileSnapshot([candidate, { ...candidate, id: "assistant-2" }], expected).status, "UNCERTAIN");
});
