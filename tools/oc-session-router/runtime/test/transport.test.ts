import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { sha256 } from "../src/contracts.js";
import { _test as snapshotReaderTest } from "../src/snapshot-reader.js";
import { CommandClient, InstalledCapabilityProbe, InstalledSnapshotClient, _test, reconcileSnapshot, type FetchLike } from "../src/transport.js";

const session = "session-fixture";
const responseBody = {
  info: { id: "assistant-1", role: "assistant", sessionID: session, parentID: "user-send-1" },
  parts: [{ id: "part-1", type: "text", text: "META PLAN REVIEW\nOverall verdict: GREEN", messageID: "assistant-1", sessionID: session }],
};

test("snapshot command-root lookup is limited to receipt-free or FAILED_OUTPUT recovery", () => {
  assert.equal(snapshotReaderTest.needsCommandRootCorrelation(true, false), false);
  assert.equal(snapshotReaderTest.needsCommandRootCorrelation(false, false), true);
  assert.equal(snapshotReaderTest.needsCommandRootCorrelation(true, true), true);
});

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
  await assert.rejects(() => client.send({ origin: "http://localhost:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password" }, "implement", "", 1000), /literal loopback/);
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

test("installed capability probe binds target directory and records SSE without enabling it", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fal-router-probe-"));
  const seen: string[] = [];
  let eventOrdinal = 0;
  const fake: FetchLike = async (input, init) => {
    const endpoint = new URL(String(input));
    seen.push(`${endpoint.pathname}${endpoint.search}`);
    assert.match(String((init?.headers as Record<string, string>).authorization), /^Basic /);
    if (endpoint.pathname === "/global/health") return new Response('{"healthy":true,"version":"1.18.19"}');
    if (endpoint.pathname === "/doc") return new Response('{"openapi":"3.1.0"}');
    if (endpoint.pathname === "/command") {
      assert.equal(endpoint.searchParams.get("directory"), directory);
      return new Response('[{"name":"implement","template":"implement $ARGUMENTS"},{"name":"terv-review","template":"review $ARGUMENTS"}]');
    }
    if (endpoint.pathname === "/event") {
      assert.equal(endpoint.searchParams.get("directory"), directory);
      assert.equal((init?.headers as Record<string, string>).accept, "text/event-stream");
      eventOrdinal += 1;
      return new Response(`event: message\ndata: {"id":"random-${eventOrdinal}","type":"server.connected","properties":{}}\n\n`, { headers: { "content-type": "text/event-stream" } });
    }
    throw new Error("unexpected probe endpoint");
  };
  const expectedBinary = "9".repeat(64);
  const measure = (_origin: URL, binary: string) => {
    assert.equal(binary, expectedBinary);
    return { server_binary_sha256: expectedBinary, server_instance_identity_sha256: "8".repeat(64) };
  };
  try {
    const probe = new InstalledCapabilityProbe(fake, 4 * 1024 * 1024, measure);
    const input = { origin: "http://127.0.0.1:4096", username: "owner", password: "process-only", directory, expected_binary_sha256: expectedBinary, required_commands: ["terv-review"] as const, timeout_ms: 1000 };
    const result = await probe.probe(input);
    const revalidated = await probe.probe(input);
    assert.equal(result.server_version, "1.18.19");
    assert.deepEqual(result.supported_commands, ["implement", "terv-review"]);
    assert.equal(result.sse.probe_status, "VERIFIED");
    assert.equal(result.sse.enabled, false);
    assert.equal(result.sse.proof_sha256, revalidated.sse.proof_sha256);
    assert.equal(eventOrdinal, 2);
    assert.equal(seen.some((entry) => entry.startsWith("/event?directory=")), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("installed capability probe retries one transient GET-only round and never sends a lifecycle POST", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fal-router-probe-retry-"));
  const calls: Array<{ path: string; method: string }> = [];
  let healthAttempts = 0;
  const fake: FetchLike = async (input, init) => {
    const endpoint = new URL(String(input));
    calls.push({ path: endpoint.pathname, method: init?.method ?? "" });
    if (endpoint.pathname === "/global/health" && ++healthAttempts === 1) return new Response("busy", { status: 503 });
    if (endpoint.pathname === "/global/health") return new Response('{"healthy":true,"version":"1.18.19"}');
    if (endpoint.pathname === "/doc") return new Response('{"openapi":"3.1.0"}');
    if (endpoint.pathname === "/command") return new Response('[{"name":"implement","template":"implement $ARGUMENTS"}]');
    if (endpoint.pathname === "/event") return new Response('event: message\ndata: {"type":"server.connected"}\n\n', { headers: { "content-type": "text/event-stream" } });
    throw new Error("unexpected endpoint");
  };
  try {
    const probe = new InstalledCapabilityProbe(fake, 4 * 1024 * 1024, () => ({ server_binary_sha256: "9".repeat(64), server_instance_identity_sha256: "8".repeat(64) }), async () => {});
    const result = await probe.probe({ origin: "http://127.0.0.1:4096", username: "owner", password: "process-only", directory, expected_binary_sha256: "9".repeat(64), required_commands: ["implement"], timeout_ms: 1000 });
    assert.equal(result.server_version, "1.18.19");
    assert.equal(healthAttempts, 2);
    assert.equal(calls.filter((call) => call.path === "/event").length, 1);
    assert.equal(calls.every((call) => call.method === "GET"), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("transient capability recovery leaves the subsequent explicit lifecycle transport at exactly one POST", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fal-router-probe-then-send-"));
  let healthAttempts = 0;
  let lifecyclePosts = 0;
  const fake: FetchLike = async (input, init) => {
    const endpoint = new URL(String(input));
    if (init?.method === "POST") { lifecyclePosts += 1; return new Response(JSON.stringify(responseBody)); }
    if (endpoint.pathname === "/global/health" && ++healthAttempts === 1) return new Response("busy", { status: 503 });
    if (endpoint.pathname === "/global/health") return new Response('{"healthy":true,"version":"1.18.19"}');
    if (endpoint.pathname === "/doc") return new Response('{"openapi":"3.1.0"}');
    if (endpoint.pathname === "/command") return new Response('[{"name":"implement","template":"implement $ARGUMENTS"}]');
    if (endpoint.pathname === "/event") return new Response('event: message\ndata: {"type":"server.connected"}\n\n', { headers: { "content-type": "text/event-stream" } });
    throw new Error("unexpected endpoint");
  };
  try {
    const probe = new InstalledCapabilityProbe(fake, 4 * 1024 * 1024, () => ({ server_binary_sha256: "9".repeat(64), server_instance_identity_sha256: "8".repeat(64) }), async () => {});
    await probe.probe({ origin: "http://127.0.0.1:4096", username: "owner", password: "process-only", directory, expected_binary_sha256: "9".repeat(64), required_commands: ["implement"], timeout_ms: 1000 });
    await new CommandClient(fake).send({ origin: "http://127.0.0.1:4096", server_fingerprint: "fingerprint", session_id: session, username: "owner", password: "process-only" }, "implement", "plan", 1000);
    assert.equal(healthAttempts, 2);
    assert.equal(lifecyclePosts, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("installed capability probe exhausts one transient retry without reaching SSE or a lifecycle send", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fal-router-probe-exhaust-"));
  let healthAttempts = 0;
  let eventAttempts = 0;
  const fake: FetchLike = async (input, init) => {
    assert.equal(init?.method, "GET");
    const endpoint = new URL(String(input));
    if (endpoint.pathname === "/global/health") { healthAttempts += 1; return new Response("busy", { status: 503 }); }
    if (endpoint.pathname === "/doc") return new Response('{"openapi":"3.1.0"}');
    if (endpoint.pathname === "/command") return new Response('[{"name":"implement","template":"implement $ARGUMENTS"}]');
    if (endpoint.pathname === "/event") { eventAttempts += 1; return new Response(); }
    throw new Error("unexpected endpoint");
  };
  try {
    const probe = new InstalledCapabilityProbe(fake, 4 * 1024 * 1024, () => ({ server_binary_sha256: "9".repeat(64), server_instance_identity_sha256: "8".repeat(64) }), async () => {});
    await assert.rejects(
      () => probe.probe({ origin: "http://127.0.0.1:4096", username: "owner", password: "process-only", directory, expected_binary_sha256: "9".repeat(64), required_commands: ["implement"], timeout_ms: 1000 }),
      /transient retry exhausted/,
    );
    assert.equal(healthAttempts, 2);
    assert.equal(eventAttempts, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("installed capability probe never retries authentication or semantic command mismatch", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fal-router-probe-nonretry-"));
  try {
    let authenticationAttempts = 0;
    const authenticationProbe = new InstalledCapabilityProbe(async (input) => {
      const endpoint = new URL(String(input));
      if (endpoint.pathname === "/global/health") { authenticationAttempts += 1; return new Response("busy", { status: 503 }); }
      return new Response("denied", { status: 401 });
    }, 4 * 1024 * 1024, () => ({ server_binary_sha256: "9".repeat(64), server_instance_identity_sha256: "8".repeat(64) }), async () => {});
    await assert.rejects(
      () => authenticationProbe.probe({ origin: "http://127.0.0.1:4096", username: "owner", password: "process-only", directory, expected_binary_sha256: "9".repeat(64), required_commands: ["implement"], timeout_ms: 1000 }),
      /capability probe failed/i,
    );
    assert.equal(authenticationAttempts, 1);

    let commandAttempts = 0;
    const semanticProbe = new InstalledCapabilityProbe(async (input) => {
      const endpoint = new URL(String(input));
      if (endpoint.pathname === "/global/health") return new Response('{"healthy":true,"version":"1.18.19"}');
      if (endpoint.pathname === "/doc") return new Response('{"openapi":"3.1.0"}');
      if (endpoint.pathname === "/command") { commandAttempts += 1; return new Response('[{"name":"terv-review","template":"review $ARGUMENTS"}]'); }
      return new Response('event: message\ndata: {"type":"server.connected"}\n\n', { headers: { "content-type": "text/event-stream" } });
    }, 4 * 1024 * 1024, () => ({ server_binary_sha256: "9".repeat(64), server_instance_identity_sha256: "8".repeat(64) }), async () => {});
    await assert.rejects(
      () => semanticProbe.probe({ origin: "http://127.0.0.1:4096", username: "owner", password: "process-only", directory, expected_binary_sha256: "9".repeat(64), required_commands: ["implement"], timeout_ms: 1000 }),
      /lacks the requested command/,
    );
    assert.equal(commandAttempts, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("installed capability probe hashes execution semantics independent of restart-only metadata", () => {
  const first = [
    { name: "terv-review", description: "review", hints: ["old hint"], source: "startup-a", agent: "build-xhigh", model: null, subtask: null, template: "exact review body" },
    { name: "implement", description: "implement", hints: [], source: "startup-a", agent: "build-xhigh", model: "openai/gpt-5.6-sol", subtask: false, template: "exact implementation body" },
  ];
  const restarted = [
    { template: "exact implementation body", name: "implement", description: "changed UI copy", hints: ["new hint"], source: "startup-b", agent: "build-xhigh", model: "openai/gpt-5.6-sol", subtask: false },
    { template: "exact review body", description: "changed review copy", hints: [], source: "startup-b", name: "terv-review", agent: "build-xhigh" },
  ];
  assert.deepEqual(_test.parseCommandRegistry(first), _test.parseCommandRegistry(restarted));
  assert.equal(_test.commandRegistryIdentity(first), _test.commandRegistryIdentity(restarted));
  assert.notEqual(_test.commandRegistryIdentity(first), _test.commandRegistryIdentity([{ ...first[0], template: "changed body" }, first[1]]));
  assert.notEqual(_test.commandRegistryIdentity(first), _test.commandRegistryIdentity([{ ...first[0], agent: "other-agent" }, first[1]]));
  assert.notEqual(_test.commandRegistryIdentity(first), _test.commandRegistryIdentity([{ ...first[0], model: "openai/other-model" }, first[1]]));
  assert.notEqual(_test.commandRegistryIdentity(first), _test.commandRegistryIdentity([{ ...first[0], subtask: true }, first[1]]));
  assert.throws(() => _test.commandRegistryIdentity([{ ...first[0], futureExecutionField: true }, first[1]]), /unsupported semantic fields/);
});

test("installed response lifecycle parts are audited while only authoritative text is extracted", async () => {
  const installed = {
    info: { id: "assistant-installed", role: "assistant", sessionID: session, parentID: "user-installed" },
    parts: [
      { id: "step-a", type: "step-start", messageID: "assistant-installed", sessionID: session, snapshot: "tree-a" },
      { id: "reason-a", type: "reasoning", messageID: "assistant-installed", sessionID: session, text: "private reasoning", time: { start: 1, end: 2 } },
      { id: "synthetic-a", type: "text", messageID: "assistant-installed", sessionID: session, text: "synthetic", synthetic: true },
      { id: "ignored-a", type: "text", messageID: "assistant-installed", sessionID: session, text: "ignored", ignored: true },
      { id: "text-a", type: "text", messageID: "assistant-installed", sessionID: session, text: "META PLAN REVIEW\nOverall verdict: GREEN" },
      { id: "step-b", type: "step-finish", messageID: "assistant-installed", sessionID: session, reason: "stop", snapshot: "tree-b", cost: 0.01, tokens: { total: 12, input: 8, output: 4, reasoning: 0, cache: { read: 0, write: 0 } } },
    ],
  };
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password" };
  const receipt = await new CommandClient(async () => new Response(JSON.stringify(installed))).send(binding, "implement", "", 1000);
  assert.equal(receipt.terminal_markdown, "META PLAN REVIEW\nOverall verdict: GREEN");
  assert.match(receipt.ignored_part_set_sha256, /^[a-f0-9]{64}$/);
  for (const rejectedType of ["tool", "subtask", "file", "patch", "snapshot", "unknown"]) {
    const invalid = { ...installed, parts: [{ id: "bad", type: rejectedType, messageID: "assistant-installed", sessionID: session }] };
    await assert.rejects(() => new CommandClient(async () => new Response(JSON.stringify(invalid))).send(binding, "implement", "", 1000), /not an inert audited part/);
  }
});

test("installed snapshot reader is GET-only, directory-bound, and preserves exact assistant correlation", async () => {
  let reads = 0;
  const baselineMessage = { info: { id: "assistant-baseline", role: "assistant", sessionID: session, parentID: "user-baseline", time: { created: 1, completed: 2 } }, parts: [{ id: "text-baseline", type: "text", text: "BASELINE", messageID: "assistant-baseline", sessionID: session }] };
  const currentMessage = {
    info: { id: "assistant-current", role: "assistant", sessionID: session, parentID: "user-current", time: { created: 3, completed: 4 } },
    parts: [
      { id: "step-current-a", type: "step-start", snapshot: "before", messageID: "assistant-current", sessionID: session },
      { id: "text-current", type: "text", text: "PLAN_REVIEW_COMPLETE", messageID: "assistant-current", sessionID: session },
      { id: "step-current-b", type: "step-finish", reason: "stop", snapshot: "after", cost: 0, tokens: { total: 1, input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }, messageID: "assistant-current", sessionID: session },
    ],
  };
  const fake: FetchLike = async (input, init) => {
    reads += 1;
    const endpoint = new URL(String(input));
    assert.equal(init?.method, "GET");
    assert.equal(endpoint.searchParams.get("directory"), "C:\\synthetic-target");
    return new Response(JSON.stringify(reads === 1 ? [baselineMessage] : [currentMessage, baselineMessage]));
  };
  const client = new InstalledSnapshotClient(fake);
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password", directory: "C:\\synthetic-target" };
  const baseline = await client.captureBaseline(binding, 1000);
  assert.equal(baseline.message_id, "assistant-baseline");
  const snapshot = await client.collect(binding, baseline, "EXACT_PARENT_LINK", 1000);
  assert.equal(snapshot.baseline_present, true);
  assert.deepEqual(snapshot.candidates, [{ id: "assistant-current", parent_id: "user-current", session_id: session, text: "PLAN_REVIEW_COMPLETE", after_baseline: true }]);
  assert.match(snapshot.message_set_sha256, /^[a-f0-9]{64}$/);
});

test("installed snapshot reader uses chronological baseline and exact expanded command root", async () => {
  let messageReads = 0;
  const directory = "C:\\synthetic-target";
  const oldAssistant = { info: { id: "assistant-old", role: "assistant", sessionID: session, parentID: "user-old", time: { created: 1, completed: 2 } }, parts: [{ id: "text-old", type: "text", text: "OLD", messageID: "assistant-old", sessionID: session }] };
  const baselineAssistant = { info: { id: "assistant-baseline", role: "assistant", sessionID: session, parentID: "user-baseline", time: { created: 3, completed: 4 } }, parts: [{ id: "text-baseline", type: "text", text: "BASELINE", messageID: "assistant-baseline", sessionID: session }] };
  const commandRoot = { info: { id: "user-command", role: "user", sessionID: session, time: { created: 5 } }, parts: [{ id: "text-command", type: "text", text: "Canonical prompt\nSOURCE", messageID: "user-command", sessionID: session }] };
  const progress = { info: { id: "assistant-progress", role: "assistant", sessionID: session, parentID: "user-command", time: { created: 6, completed: 7 } }, parts: [{ id: "text-progress", type: "text", text: "PROGRESS", messageID: "assistant-progress", sessionID: session }] };
  const terminal = { info: { id: "assistant-terminal", role: "assistant", sessionID: session, parentID: "user-command", time: { created: 8, completed: 9 } }, parts: [{ id: "text-terminal", type: "text", text: "EPIC IMPLEMENTATION PLAN", messageID: "assistant-terminal", sessionID: session }] };
  const fake: FetchLike = async (input, init) => {
    const endpoint = new URL(String(input));
    assert.equal(init?.method, "GET");
    assert.equal(endpoint.searchParams.get("directory"), directory);
    if (endpoint.pathname === "/command") return new Response(JSON.stringify([{ description: "fixture", template: "Canonical prompt\n$ARGUMENTS", name: "seq-next" }]));
    if (!endpoint.pathname.endsWith("/message")) throw new Error("unexpected endpoint");
    messageReads += 1;
    return new Response(JSON.stringify(messageReads === 1
      ? [baselineAssistant, oldAssistant]
      : [terminal, oldAssistant, commandRoot, progress, baselineAssistant]));
  };
  const client = new InstalledSnapshotClient(fake);
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password", directory };
  const baseline = await client.captureBaseline(binding, 1000);
  assert.equal(baseline.message_id, "assistant-baseline");
  const snapshot = await client.collect(binding, baseline, "EXACT_PARENT_LINK", 1000, { name: "seq-next", argument: "SOURCE" });
  assert.equal(snapshot.baseline_present, true);
  assert.deepEqual(snapshot.candidates, [
    { id: "assistant-progress", parent_id: "user-command", session_id: session, text: "PROGRESS", after_baseline: true, command_root_correlated: true },
    { id: "assistant-terminal", parent_id: "user-command", session_id: session, text: "EPIC IMPLEMENTATION PLAN", after_baseline: true, command_root_correlated: true },
  ]);
});

test("installed snapshot reader fails closed when the exact command root is ambiguous", async () => {
  const directory = "C:\\synthetic-target";
  const baselineMessage = { info: { id: "assistant-baseline", role: "assistant", sessionID: session, parentID: "user-baseline", time: { created: 1, completed: 2 } }, parts: [{ id: "text-baseline", type: "text", text: "BASELINE", messageID: "assistant-baseline", sessionID: session }] };
  const roots = [3, 4].map((created) => ({ info: { id: `user-command-${created}`, role: "user", sessionID: session, time: { created } }, parts: [{ id: `text-command-${created}`, type: "text", text: "Prompt\nSOURCE", messageID: `user-command-${created}`, sessionID: session }] }));
  const terminal = { info: { id: "assistant-terminal", role: "assistant", sessionID: session, parentID: "user-command-4", time: { created: 5, completed: 6 } }, parts: [{ id: "text-terminal", type: "text", text: "TERMINAL", messageID: "assistant-terminal", sessionID: session }] };
  let reads = 0;
  const client = new InstalledSnapshotClient(async (input) => {
    const endpoint = new URL(String(input));
    if (endpoint.pathname === "/command") return new Response(JSON.stringify([{ name: "seq-next", template: "Prompt\n$ARGUMENTS" }]));
    reads += 1;
    return new Response(JSON.stringify(reads === 1 ? [baselineMessage] : [baselineMessage, ...roots, terminal]));
  });
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password", directory };
  const baseline = await client.captureBaseline(binding, 1000);
  const snapshot = await client.collect(binding, baseline, "EXACT_PARENT_LINK", 1000, { name: "seq-next", argument: "SOURCE" });
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0]?.command_root_correlated, undefined);
});

test("installed snapshot reader pages backward to the exact baseline within bounded pages", async () => {
  const directory = "C:\\synthetic-target";
  const message = (id: string, created: number, role: "user" | "assistant", parentID?: string) => ({
    info: { id, role, sessionID: session, ...(parentID ? { parentID } : {}), time: { created, ...(role === "assistant" ? { completed: created + 0.5 } : {}) } },
    parts: [{ id: `text-${id}`, type: "text", text: id === "user-command" ? "Prompt\nSOURCE" : id.toUpperCase(), messageID: id, sessionID: session }],
  });
  const baselineMessage = message("assistant-baseline", 1, "assistant", "user-old");
  const commandRoot = message("user-command", 2, "user");
  const terminal = message("assistant-terminal", 3, "assistant", "user-command");
  const fillers = Array.from({ length: 39 }, (_, index) => message(`assistant-fill-${index}`, 4 + index, "assistant", "user-command"));
  let messageReads = 0;
  const client = new InstalledSnapshotClient(async (input) => {
    const endpoint = new URL(String(input));
    if (endpoint.pathname === "/command") return new Response(JSON.stringify([{ name: "seq-next", template: "Prompt\n$ARGUMENTS" }]));
    messageReads += 1;
    assert.equal(endpoint.searchParams.get("limit"), "40");
    if (messageReads === 1) {
      assert.equal(endpoint.searchParams.has("before"), false);
      return new Response(JSON.stringify([terminal, ...fillers]), { headers: { "x-next-cursor": "cursor-page-2" } });
    }
    assert.equal(endpoint.searchParams.get("before"), "cursor-page-2");
    return new Response(JSON.stringify([baselineMessage, commandRoot]));
  });
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password", directory };
  const baseline = { message_id: "assistant-baseline", identity_sha256: sha256("baseline"), captured_at: new Date().toISOString() };
  const snapshot = await client.collect(binding, baseline, "EXACT_PARENT_LINK", 1000, { name: "seq-next", argument: "SOURCE" });
  assert.equal(messageReads, 2);
  assert.equal(snapshot.baseline_present, true);
  assert.equal(snapshot.candidates.find((candidate) => candidate.id === "assistant-terminal")?.command_root_correlated, true);
});

test("production snapshot history accepts completed tool, patch, and compaction parts as hash-only inert evidence", async () => {
  const historical = {
    info: { id: "assistant-history", role: "assistant", sessionID: session, parentID: "user-history", time: { created: 1, completed: 2 } },
    parts: [
      { id: "tool-complete", type: "tool", callID: "call-complete", tool: "read", state: { status: "completed", input: { path: "private" }, output: "private output", title: "Read", metadata: {}, time: { start: 1, end: 2 } }, metadata: {}, messageID: "assistant-history", sessionID: session },
      { id: "tool-error", type: "tool", callID: "call-error", tool: "bash", state: { status: "error", input: { command: "private" }, error: "private error", time: { start: 2, end: 3 } }, metadata: {}, messageID: "assistant-history", sessionID: session },
      { id: "patch-history", type: "patch", files: ["private-file"], hash: "patch-hash", messageID: "assistant-history", sessionID: session },
      { id: "compaction-history", type: "compaction", auto: true, tail_start_id: "assistant-tail", messageID: "assistant-history", sessionID: session },
      { id: "text-history", type: "text", text: "HISTORICAL TERMINAL", messageID: "assistant-history", sessionID: session },
    ],
  };
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password", directory: "C:\\synthetic-target" };
  const baseline = await new InstalledSnapshotClient(async () => new Response(JSON.stringify([historical]))).captureBaseline(binding, 1000);
  assert.equal(baseline.message_id, "assistant-history");
  assert.match(baseline.identity_sha256, /^[a-f0-9]{64}$/);
  for (const privateValue of ["private output", "private error", "private-file"]) assert.equal(JSON.stringify(baseline).includes(privateValue), false);
});

test("production snapshot history remains fail-closed for active tools, incomplete assistants, unknown parts, and identity drift", async () => {
  const binding = { origin: "http://127.0.0.1:1", server_fingerprint: "fingerprint", session_id: session, username: "user", password: "password", directory: "C:\\synthetic-target" };
  const base = { info: { id: "assistant-history", role: "assistant", sessionID: session, parentID: "user-history", time: { created: 1, completed: 2 } } };
  const rejected = [
    { ...base, parts: [{ id: "active", type: "tool", callID: "call-active", tool: "read", state: { status: "running", input: {}, time: { start: 1 } }, metadata: {}, messageID: "assistant-history", sessionID: session }] },
    { info: { ...base.info, time: { created: 1 } }, parts: [{ id: "text", type: "text", text: "INCOMPLETE", messageID: "assistant-history", sessionID: session }] },
    { ...base, parts: [{ id: "unknown", type: "subtask", messageID: "assistant-history", sessionID: session }] },
    { ...base, parts: [{ id: "patch", type: "patch", files: [], hash: "hash", unexpected: true, messageID: "assistant-history", sessionID: session }] },
    { ...base, parts: [{ id: "compaction", type: "compaction", auto: true, tail_start_id: "bad identity with spaces", messageID: "assistant-history", sessionID: session }] },
    { ...base, parts: [{ id: "text", type: "text", text: "DRIFT", messageID: "assistant-other", sessionID: session }] },
  ];
  for (const history of rejected) {
    const client = new InstalledSnapshotClient(async () => new Response(JSON.stringify([history])));
    await assert.rejects(() => client.captureBaseline(binding, 1000), /Snapshot/);
  }
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
  const expected = { sessionSha256: sha256(session), parentId: "user-send-1", messageId: "assistant-1", terminalSha256: sha256(candidate.text), terminal: (text: string) => text.endsWith("PLAN_REVIEW_COMPLETE") };
  assert.equal(reconcileSnapshot([candidate], expected).status, "TRANSCRIPT_RECONCILED");
  assert.equal(reconcileSnapshot([{ ...candidate, session_id: "other" }], expected).status, "UNCERTAIN");
  assert.equal(reconcileSnapshot([{ ...candidate, id: "assistant-other" }], expected).status, "UNCERTAIN");
  assert.equal(reconcileSnapshot([{ ...candidate, text: `${candidate.text}\ndrift` }], expected).status, "UNCERTAIN");
  assert.equal(reconcileSnapshot([candidate, { ...candidate }], expected).status, "UNCERTAIN");
  assert.equal(reconcileSnapshot([{ ...candidate, parent_id: "" }], expected).status, "UNCERTAIN");
  assert.equal(reconcileSnapshot([{ ...candidate, parent_id: "" }], { ...expected, parentId: "" }).status, "UNCERTAIN");
});
