import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { alreadyCompacted, captureCompactBaseline, observeCompactCompletion, type CompactBaseline, type CompactReader } from "../../src/v2/session-maintenance.js";
import { observeSession } from "../../src/v2/session-observation.js";
import type { AdapterReply, MessageHistory, OpenCodeMessage, OpenCodeSession } from "../../src/v2/opencode-adapter.js";

const expected = { session: "ses_fixture", directory: path.resolve("maintenance-fixture"), providerID: "requested-provider", modelID: "requested-model" };
function ok<T>(value: T): AdapterReply<T> { return { status: 200, bodySha256: "fixture", value }; }
function unavailable<T>(): AdapterReply<T> { return { status: 503, bodySha256: "fixture", problem: "HTTP_ERROR" }; }
function head(): OpenCodeMessage { return { id: "msg_head", session: expected.session, role: "assistant", text: "old finished stage", timeCreated: 1, timeCompleted: 2, finish: "stop", hasCompactionPart: false }; }
function marker(id = "msg_marker"): OpenCodeMessage { return { id, session: expected.session, role: "user", text: "arbitrary marker text", timeCreated: 3, hasCompactionPart: true }; }
function summary(id = "msg_summary", changes: Partial<OpenCodeMessage> = {}): OpenCodeMessage {
  return { id, session: expected.session, parentId: "msg_marker", role: "assistant", summary: true, timeCreated: 4, timeCompleted: 5, finish: "stop", hasCompactionPart: false, text: "Varied natural-language summary", providerID: expected.providerID, modelID: expected.modelID, tokens: { total: 450000 }, ...changes };
}
class FakeReader implements CompactReader {
  calls: string[] = [];
  session: AdapterReply<OpenCodeSession> = ok({ id: expected.session, directory: expected.directory });
  activity: AdapterReply<"BUSY" | "IDLE" | "UNKNOWN"> = ok("IDLE");
  pages = new Map<string, AdapterReply<MessageHistory>>([["newest", ok({ messages: [head()] })]]);
  messages = new Map<string, AdapterReply<OpenCodeMessage>>();
  async getSession() { this.calls.push("session"); return this.session; }
  async getStatus() { this.calls.push("status"); return this.activity; }
  async getHistory(options: { limit: number; before?: string }) { this.calls.push(`history:${options.before ?? "newest"}:${options.limit}`); return this.pages.get(options.before ?? "newest") ?? unavailable<MessageHistory>(); }
  async getMessage(id: string) { this.calls.push(`message:${id}`); return this.messages.get(id) ?? unavailable<OpenCodeMessage>(); }
  async submitCommand(): Promise<never> { throw new Error("No maintenance sends allowed"); }
  async summarize(): Promise<never> { throw new Error("No maintenance sends allowed"); }
  async abort(): Promise<never> { throw new Error("No maintenance aborts allowed"); }
  history(messages: OpenCodeMessage[]) {
    this.pages.set("newest", ok({ messages }));
    for (const message of messages) this.messages.set(message.id, ok(message));
  }
}
async function fixture() {
  const reader = new FakeReader();
  const baseline = await captureCompactBaseline(reader);
  reader.calls = [];
  return { reader, baseline };
}

test("baseline captures actual latest message and verifies its session with a one-message window", async () => {
  const { reader, baseline } = await fixture();
  assert.equal(baseline.headMessageId, "msg_head");
  assert.equal(baseline.session, expected.session);
  assert.equal(baseline.directory, expected.directory);
  assert.ok(Number.isFinite(Date.parse(baseline.capturedAt)));
  reader.history([{ ...head(), id: "msg_newest_user", role: "user" }]);
  assert.equal((await captureCompactBaseline(reader)).headMessageId, "msg_newest_user");
  assert.deepEqual(reader.calls, ["session", "history:newest:1"]);
  reader.history([{ ...head(), session: "ses_elsewhere" }]);
  await assert.rejects(captureCompactBaseline(reader), { code: "INVALID_INPUT" });
});

test("one new marker plus its exact-parent terminal summary proves a complete observed effect", async () => {
  const { reader, baseline } = await fixture();
  reader.history([head(), marker(), summary()]);
  const result = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(result.state, "COMPLETE");
  assert.equal(result.coverage.baselineFound, true);
  assert.equal(result.coverage.complete, true);
  assert.equal(result.markerMessageId, "msg_marker");
  assert.equal(result.summaryMessageId, "msg_summary");
  assert.equal(result.model.matchesRequested, true);
  assert.equal(result.provenance, "UNIQUE_POST_BASELINE_EFFECT_OBSERVATION");
  assert.match(result.evidenceReferences![0]!, /^opencode-compact-effect-sha256:[a-f0-9]{64}$/);
  assert.ok(reader.calls.includes("message:msg_marker"));
  assert.ok(reader.calls.includes("message:msg_summary"));
});

test("marker-only, incomplete summary and busy without effect stay pending", async () => {
  const { reader, baseline } = await fixture();
  reader.history([head(), marker()]);
  const onlyMarker = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(onlyMarker.state, "PENDING");
  assert.equal(onlyMarker.reason, "SUMMARY_NOT_OBSERVED");
  reader.activity = ok("BUSY");
  const pendingSummary = summary();
  delete pendingSummary.timeCompleted;
  reader.history([head(), marker(), pendingSummary]);
  assert.equal((await observeCompactCompletion(reader, baseline, expected)).reason, "SUMMARY_NOT_TERMINAL");
  reader.history([head()]);
  const busy = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(busy.state, "PENDING");
  assert.equal(busy.activity, "BUSY");
  assert.equal(busy.reason, "BUSY_WITHOUT_COMPACTION_EVIDENCE");
});

test("terminal failed summary is failure evidence without rollback or resend inference", async () => {
  const { reader, baseline } = await fixture();
  reader.history([head(), marker(), summary("msg_failed", { error: true, finish: "unknown", text: "Partial summary" })]);
  const result = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(result.state, "FAILED");
  assert.equal(result.reason, "SUMMARY_EXECUTION_FAILED");
  assert.equal(result.summary?.text, "Partial summary");
  assert.equal(result.summaryMessageId, "msg_failed");
});

test("two new compaction markers or two summaries remain ambiguous", async () => {
  const { reader, baseline } = await fixture();
  reader.history([head(), marker(), summary(), marker("msg_other_marker"), summary("msg_other_summary", { parentId: "msg_other_marker" })]);
  const twoMarkers = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(twoMarkers.state, "AMBIGUOUS");
  assert.equal(twoMarkers.reason, "MULTIPLE_NEW_COMPACTION_MARKERS");
  assert.equal(twoMarkers.summary, undefined);
  reader.history([head(), marker(), summary(), summary("msg_second_summary")]);
  const twoSummaries = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(twoSummaries.state, "AMBIGUOUS");
  assert.equal(twoSummaries.reason, "MULTIPLE_SUMMARY_CANDIDATES");
});

test("summary wording and unrelated newest chat do not control effect correlation", async () => {
  const { reader, baseline } = await fixture();
  for (const text of ["", "Summary ready.", "Összefoglaló — váratlan szóhasználat.", "NOT_RESTORED is ordinary summary text here"]) {
    reader.history([head(), marker(), summary("msg_summary", { text }), summary("msg_newest_unrelated", { parentId: "msg_different_root", summary: false, text: "latest unrelated answer", timeCreated: 50, timeCompleted: 51 })]);
    const result = await observeCompactCompletion(reader, baseline, expected);
    assert.equal(result.state, "COMPLETE");
    assert.equal(result.summaryMessageId, "msg_summary");
    assert.equal(result.summary?.text, text);
  }
});

test("opaque pagination reads back through the exact frozen head before selecting effect", async () => {
  const { reader, baseline } = await fixture();
  reader.history([head(), marker(), summary()]);
  reader.pages.set("newest", ok({ messages: [summary()], nextCursor: "opaque:next/+=" }));
  reader.pages.set("opaque:next/+=", ok({ messages: [head(), marker()], nextCursor: "older-before-baseline" }));
  const result = await observeCompactCompletion(reader, baseline, expected, { pageLimit: 1, pageBudget: 2 });
  assert.equal(result.state, "COMPLETE");
  assert.equal(result.coverage.pagesRead, 2);
  assert.equal(result.coverage.nextCursor, undefined);
  assert.ok(reader.calls.includes("history:opaque:next/+=:1"));
  assert.equal(reader.calls.some(call => call.includes("older-before-baseline")), false);
});

test("missing or partially covered baseline never implies a unique new effect", async () => {
  const { reader, baseline } = await fixture();
  reader.history([marker(), summary()]);
  assert.equal((await observeCompactCompletion(reader, baseline, expected)).reason, "BASELINE_NOT_FOUND");
  reader.pages.set("newest", ok({ messages: [marker(), summary()], nextCursor: "opaque-older" }));
  const partial = await observeCompactCompletion(reader, baseline, expected, { pageBudget: 1 });
  assert.equal(partial.state, "PENDING");
  assert.equal(partial.coverage.complete, false);
  assert.equal(partial.coverage.nextCursor, "opaque-older");
  assert.equal(partial.markerMessageId, undefined);
  const calls = reader.calls.length;
  assert.equal((await observeCompactCompletion(reader, null, expected)).reason, "BASELINE_UNAVAILABLE");
  assert.equal(reader.calls.length, calls);
});

test("prior compaction before the frozen head is excluded while imported IDs need not sort chronologically", async () => {
  const { reader } = await fixture();
  const baseline: CompactBaseline = { session: expected.session, directory: expected.directory, headMessageId: "msg_z_old_head", capturedAt: new Date().toISOString() };
  const newMarker = marker("msg_a_new_marker");
  const newSummary = summary("msg_a_new_summary", { parentId: newMarker.id });
  reader.history([marker("msg_prior_marker"), summary("msg_prior_summary", { parentId: "msg_prior_marker" }), { ...head(), id: baseline.headMessageId! }, newMarker, newSummary]);
  const result = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(result.state, "COMPLETE");
  assert.equal(result.markerMessageId, newMarker.id);
});

test("documented compaction-agent model override completes with requested/effective provenance", async () => {
  const { reader, baseline } = await fixture();
  reader.history([head(), marker(), summary("msg_summary", { providerID: "effective-provider", modelID: "compaction-agent-model" })]);
  const result = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(result.state, "COMPLETE");
  assert.deepEqual(result.model.requested, { providerID: expected.providerID, modelID: expected.modelID });
  assert.deepEqual(result.model.effective, { providerID: "effective-provider", modelID: "compaction-agent-model" });
  assert.equal(result.model.matchesRequested, false);
  assert.ok(result.limitations.includes("SUMMARY_MODEL_DIFFERS_REQUESTED"));
  const withoutModel = summary(); delete withoutModel.providerID; delete withoutModel.modelID;
  reader.history([head(), marker(), withoutModel]);
  const unknownModel = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(unknownModel.state, "COMPLETE");
  assert.equal(unknownModel.model.matchesRequested, null);
  assert.ok(unknownModel.limitations.includes("SUMMARY_MODEL_UNAVAILABLE"));
});

test("wrong parent, stale marker or wrong session are real non-success", async () => {
  const { reader, baseline } = await fixture();
  reader.history([head(), marker(), summary()]);
  reader.messages.set("msg_summary", ok(summary("msg_summary", { parentId: "msg_wrong" })));
  assert.equal((await observeCompactCompletion(reader, baseline, expected)).reason, "SUMMARY_PARENT_OR_MARKER_CONFLICT");
  reader.history([head(), marker(), summary()]);
  reader.messages.set("msg_marker", ok({ ...marker(), hasCompactionPart: false }));
  assert.equal((await observeCompactCompletion(reader, baseline, expected)).state, "PENDING");
  reader.history([head(), marker(), summary("msg_summary", { session: "ses_other" })]);
  assert.equal((await observeCompactCompletion(reader, baseline, expected)).reason, "HISTORY_IDENTITY_CONFLICT");
});

test("native/manual completed summary is already compacted despite high old-context usage", async () => {
  const { reader } = await fixture();
  for (const text of ["manual compact", "automatic compact"]) {
    reader.history([head(), { ...marker(), text }, summary()]);
    const snapshot = await observeSession(reader, expected);
    assert.equal(snapshot.lastCompaction?.completed, true);
    assert.equal(snapshot.latestCompletedCall?.freshness, "COMPACTION_AFTER_CALL");
    assert.equal(alreadyCompacted(snapshot), true);
    assert.equal(alreadyCompacted({ ...snapshot, identity: { ...snapshot.identity, verified: false } }), false);
    assert.equal(alreadyCompacted({ ...snapshot, lastCompaction: { ...snapshot.lastCompaction!, completed: false } }), false);
    assert.equal(alreadyCompacted({ ...snapshot, latestCompletedCall: { ...snapshot.latestCompletedCall!, freshness: "NO_NEWER_MESSAGES_OBSERVED" } }), false);
  }
});

test("verified empty session baseline is valid but requires reading history to its end", async () => {
  const reader = new FakeReader();
  reader.history([]);
  const baseline = await captureCompactBaseline(reader);
  assert.equal(baseline.headMessageId, null);
  reader.history([marker(), summary()]);
  const result = await observeCompactCompletion(reader, baseline, expected);
  assert.equal(result.state, "COMPLETE");
  assert.equal(result.coverage.baselineFound, true);
  reader.pages.set("newest", ok({ messages: [marker(), summary()], nextCursor: "more" }));
  assert.equal((await observeCompactCompletion(reader, baseline, expected, { pageBudget: 1 })).state, "PENDING");
});
