import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculatePressure, observeSession, type ObservationReader } from "../../src/v2/session-observation.js";
import type { AdapterReply, MessageHistory, MessageTokens, OpenCodeMessage, OpenCodeModelInfo, OpenCodeSession } from "../../src/v2/opencode-adapter.js";

const expected = { session: "ses_private_fixture", directory: path.resolve("private-observation-fixture") };
function ok<T>(value: T): AdapterReply<T> { return { status: 200, bodySha256: "fixture", value }; }
function unavailable<T>(): AdapterReply<T> { return { status: 503, bodySha256: "fixture", problem: "HTTP_ERROR" }; }
function assistant(id = "msg_private_answer", changes: Partial<OpenCodeMessage> = {}): OpenCodeMessage {
  return { id, session: expected.session, role: "assistant", parentId: "msg_private_root", timeCreated: 1000, timeCompleted: 2000, finish: "stop", providerID: "provider", modelID: "model", text: "private response text must not appear", hasCompactionPart: false, tokens: { input: 260000, output: 10000, reasoning: 5000, cache: { read: 8000, write: 2000 } }, ...changes };
}
class FakeReader implements ObservationReader {
  calls: string[] = [];
  session: AdapterReply<OpenCodeSession> = ok({ id: expected.session, directory: expected.directory });
  status: AdapterReply<"IDLE" | "BUSY" | "UNKNOWN"> = ok("IDLE");
  pages = new Map<string, AdapterReply<MessageHistory>>([["newest", ok({ messages: [assistant()] })]]);
  model: AdapterReply<OpenCodeModelInfo | null> = ok({ providerID: "provider", modelID: "model", contextLimit: 500000, inputLimit: 450000, outputLimit: 128000 });
  async getSession() { this.calls.push("session"); return this.session; }
  async getStatus() { this.calls.push("status"); return this.status; }
  async getHistory(options: { limit: number; before?: string }) { this.calls.push(`history:${options.before ?? "newest"}`); return this.pages.get(options.before ?? "newest") ?? unavailable<MessageHistory>(); }
  async getModelInfo(providerID: string, modelID: string) { this.calls.push(`model:${providerID}/${modelID}`); return this.model; }
  async submitCommand(): Promise<never> { throw new Error("Observation never submits"); }
  async summarize(): Promise<never> { throw new Error("Observation never compacts"); }
  async abort(): Promise<never> { throw new Error("Observation never interrupts"); }
}

test("reported total wins and fallback counts cache exactly once without adding reasoning", () => {
  const reported = calculatePressure({ total: 280000, input: 1, output: 2, reasoning: 900000, cache: { read: 3, write: 4 } }, 500000);
  assert.equal(reported.bestAvailableTokens, 280000);
  assert.equal(reported.totalSource, "provider_reported_total");
  assert.equal(reported.state, "warn");
  assert.equal(reported.warnTokens, 250000);
  assert.equal(reported.criticalTokens, 310000);
  const fallback = calculatePressure({ total: 0, input: 330000, output: 10000, reasoning: 100000, cache: { read: 12000, write: 2000 } }, 500000);
  assert.equal(fallback.bestAvailableTokens, 354000);
  assert.equal(fallback.totalSource, "computed_opencode_overflow_formula");
  assert.equal(fallback.state, "critical");
  assert.equal(fallback.recommendation, "recommend_at_next_safe_boundary");
});

test("boundaries preserve recommendations and absent optional data is unknown", () => {
  for (const [total, state, recommendation] of [
    [249999, "normal", "none"], [250000, "warn", "monitor_and_prepare_boundary"],
    [310000, "critical", "recommend_at_next_safe_boundary"], [500000, "over_limit", "urgent_recovery_required_no_automatic_compact"],
  ] as const) {
    const pressure = calculatePressure({ total }, 500000);
    assert.equal(pressure.state, state);
    assert.equal(pressure.recommendation, recommendation);
  }
  assert.equal(calculatePressure(undefined, 500000).state, "unknown");
  assert.equal(calculatePressure({}, 500000).bestAvailableTokens, null);
  assert.equal(calculatePressure({ reasoning: 100 }, 500000).bestAvailableTokens, null);
  assert.equal(calculatePressure({ total: 300000 }).state, "unknown");
  assert.equal(calculatePressure({ input: 0, output: 0 }, 500000).state, "normal");
  assert.equal(calculatePressure({ total: -1, input: Number.NaN }, 500000).state, "unknown");
  assert.throws(() => calculatePressure({}, 500000, { warnRatio: 0.7, criticalRatio: 0.6 }), { code: "INVALID_INPUT" });
});

test("pressure fixtures agree with the existing pure PowerShell helper", { skip: process.platform !== "win32" }, () => {
  const cases: Array<{ tokens?: MessageTokens; contextLimit: number; warnRatio: number; criticalRatio: number }> = [
    { tokens: { total: 280000, input: 1, output: 2 }, contextLimit: 500000, warnRatio: 0.5, criticalRatio: 0.62 },
    { tokens: { input: 330000, output: 10000, reasoning: 90000, cache: { read: 12000 } }, contextLimit: 500000, warnRatio: 0.5, criticalRatio: 0.62 },
    { tokens: { total: 0, input: 330000, output: 10000, reasoning: 90000, cache: { read: 12000, write: 2000 } }, contextLimit: 500000, warnRatio: 0.5, criticalRatio: 0.62 },
    { tokens: { total: 515000 }, contextLimit: 500000, warnRatio: 0.5, criticalRatio: 0.62 },
    { tokens: { input: 0, output: 0 }, contextLimit: 500000, warnRatio: 0.5, criticalRatio: 0.62 },
    { contextLimit: 500000, warnRatio: 0.5, criticalRatio: 0.62 },
    { tokens: { total: 0, input: 400000 }, contextLimit: 0, warnRatio: 0.5, criticalRatio: 0.62 },
    { tokens: { total: 310000 }, contextLimit: 500000, warnRatio: 0.4, criticalRatio: 0.6 },
    { tokens: { total: 1240001 }, contextLimit: 2000000, warnRatio: 0.5, criticalRatio: 0.62 },
  ];
  const helper = fileURLToPath(new URL("../../../../scripts/session-context-status-core.ps1", import.meta.url));
  // Fixed read-only helper; fixture JSON crosses stdin, never command interpolation.
  const script = `
$ErrorActionPreference = 'Stop'
. '${helper.replaceAll("'", "''")}'
$fixtureCases = [Console]::In.ReadToEnd() | ConvertFrom-Json
$fixtureResults = @()
foreach ($fixtureCase in $fixtureCases) {
  $fixtureMessages = @()
  if ($null -ne $fixtureCase.tokens) {
    $fixtureMessages = @([pscustomobject]@{info=[pscustomobject]@{role='assistant'; providerID='fixture'; modelID='model'; time=[pscustomobject]@{created=10; completed=20}; tokens=$fixtureCase.tokens}})
  }
  $fixtureCatalog = [pscustomobject]@{all=@([pscustomobject]@{id='fixture'; models=[pscustomobject]@{model=[pscustomobject]@{id='model'; limit=[pscustomobject]@{context=$fixtureCase.contextLimit}}}})}
  $fixtureReport = New-OCRouterSessionContextReport -QueryScope self -Messages $fixtureMessages -ActiveContext @() -ProviderCatalog $fixtureCatalog -SessionModel ([pscustomobject]@{providerID='fixture';modelID='model'}) -WarnRatio $fixtureCase.warnRatio -CriticalRatio $fixtureCase.criticalRatio
  $fixtureResults += [pscustomobject]@{
    bestAvailableTokens=$fixtureReport.pressure.best_available_tokens; totalSource=$fixtureReport.provider_observation.total_source;
    bestAvailableSource=$fixtureReport.pressure.best_available_source; usageRatio=$fixtureReport.pressure.usage_ratio; usagePercent=$fixtureReport.pressure.usage_percent;
    warnRatio=$fixtureReport.pressure.warn_ratio; criticalRatio=$fixtureReport.pressure.critical_ratio; warnTokens=$fixtureReport.pressure.warn_tokens; criticalTokens=$fixtureReport.pressure.critical_tokens;
    state=$fixtureReport.pressure.state; recommendation=$fixtureReport.pressure.recommendation
  }
}
ConvertTo-Json -InputObject $fixtureResults -Depth 8 -Compress
`;
  const command = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const result = spawnSync(command, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { input: JSON.stringify(cases), encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), cases.map(item => calculatePressure(item.tokens, item.contextLimit, item)));
});

test("verified session snapshot exposes last-call pressure without private IDs or text", async () => {
  const reader = new FakeReader();
  const snapshot = await observeSession(reader, expected);
  assert.equal(snapshot.identity.verified, true);
  assert.equal(snapshot.activity, "IDLE");
  assert.equal(snapshot.latestCompletedCall?.completedAt, "1970-01-01T00:00:02.000Z");
  assert.equal(snapshot.pressure.bestAvailableTokens, 280000);
  assert.equal(snapshot.pressure.state, "warn");
  assert.equal(snapshot.model?.contextLimit, 500000);
  assert.equal(snapshot.model?.limitSource, "opencode_provider_catalog");
  assert.equal(snapshot.history.coverage, "COMPLETE");
  assert.equal(snapshot.activeContext.estimatedTokens, null);
  assert.deepEqual(snapshot.capabilities, { readOnly: true, maySend: false, mayCompact: false, mayMutate: false });
  const encoded = JSON.stringify(snapshot);
  for (const privateText of [expected.session, "msg_private_answer", "msg_private_root", "private response text", "private-observation-fixture"]) assert.equal(encoded.includes(privateText), false);
  assert.ok(reader.calls.includes("model:provider/model"));
});

test("latest completed call uses completed time and never substitutes an older token-rich call", async () => {
  const reader = new FakeReader();
  reader.pages.set("newest", ok({ messages: [assistant("msg_old", { timeCompleted: 5000 }), assistant("msg_latest", { timeCreated: 500, timeCompleted: 6000, tokens: {} })] }));
  const snapshot = await observeSession(reader, expected);
  assert.equal(snapshot.latestCompletedCall?.completedAt, "1970-01-01T00:00:06.000Z");
  assert.equal(snapshot.pressure.state, "unknown");
  assert.equal(snapshot.pressure.bestAvailableTokens, null);
  assert.ok(snapshot.limitations.includes("LAST_CALL_TOKENS_UNAVAILABLE"));
});

test("bounded pages find last visible compaction and disclose stale last-call pressure", async () => {
  const reader = new FakeReader();
  const marker: OpenCodeMessage = { id: "msg_compact", session: expected.session, role: "user", timeCreated: 3000, text: "private compact summary", hasCompactionPart: true };
  reader.pages.set("newest", ok({ messages: [marker], nextCursor: "opaque-next" }));
  reader.pages.set("opaque-next", ok({ messages: [assistant()], nextCursor: "opaque-older" }));
  const snapshot = await observeSession(reader, expected, { pageLimit: 1, pageBudget: 2 });
  assert.equal(snapshot.history.coverage, "BOUNDED");
  assert.equal(snapshot.history.nextCursor, "opaque-older");
  assert.equal(snapshot.history.pagesRead, 2);
  assert.equal(snapshot.lastCompaction?.createdAt, "1970-01-01T00:00:03.000Z");
  assert.equal(snapshot.lastCompaction?.source, "NATIVE_COMPACTION_PART");
  assert.equal(snapshot.latestCompletedCall?.freshness, "COMPACTION_AFTER_CALL");
  assert.ok(snapshot.limitations.includes("LAST_CALL_PRESSURE_MAY_BE_STALE"));
  assert.equal(snapshot.pressure.bestAvailableSource, "provider_observed_last_completion");
  assert.equal(snapshot.activeContext.status, "unavailable");
});

test("partial text-only history does not create an active-context estimate", async () => {
  const reader = new FakeReader();
  reader.pages.set("newest", ok({ messages: [{ id: "msg_user", session: expected.session, role: "user", text: "x".repeat(10000), hasCompactionPart: false }], nextCursor: "older" }));
  const snapshot = await observeSession(reader, expected, { pageBudget: 1, model: { providerID: "provider", modelID: "model" } });
  assert.equal(snapshot.pressure.state, "unknown");
  assert.equal(snapshot.activeContext.estimatedTokens, null);
  assert.equal(snapshot.latestCompletedCall, null);
  assert.equal(snapshot.model?.contextLimit, 500000);
});

test("compaction summary's high old-context usage after its marker is stale, not a new compact recommendation", async () => {
  const reader = new FakeReader();
  const marker: OpenCodeMessage = { id: "msg_compact", session: expected.session, role: "user", timeCreated: 3000, text: "compact request", hasCompactionPart: true };
  const summary = assistant("msg_compact_summary", { parentId: marker.id, summary: true, timeCreated: 3100, timeCompleted: 4000, tokens: { total: 450000 } });
  reader.pages.set("newest", ok({ messages: [assistant(), marker, summary] }));
  const snapshot = await observeSession(reader, expected);
  assert.equal(snapshot.latestCompletedCall?.completedAt, "1970-01-01T00:00:04.000Z");
  assert.equal(snapshot.latestCompletedCall?.fromCompactionSummary, true);
  assert.equal(snapshot.latestCompletedCall?.freshness, "COMPACTION_AFTER_CALL");
  assert.equal(snapshot.lastCompaction?.completed, true);
  assert.equal(snapshot.pressure.bestAvailableTokens, 450000);
  assert.ok(snapshot.limitations.includes("SUMMARY_CALL_COUNTS_PRE_COMPACTION_CONTEXT"));
  assert.ok(snapshot.limitations.includes("LAST_CALL_PRESSURE_MAY_BE_STALE"));
  assert.equal(snapshot.capabilities.mayCompact, false);
  reader.pages.set("newest", ok({ messages: [assistant(), marker, { ...summary, error: true }] }));
  const failed = await observeSession(reader, expected);
  assert.equal(failed.lastCompaction?.completed, false);
  assert.equal(failed.latestCompletedCall?.freshness, "UNKNOWN");
});

test("matching override is explicit and a mismatched override cannot replace actual model limits", async () => {
  const reader = new FakeReader();
  const matching = await observeSession(reader, expected, { modelOverride: { providerID: "provider", modelID: "model", contextLimit: 400000 } });
  assert.equal(matching.model?.contextLimit, 400000);
  assert.equal(matching.model?.limitSource, "matching_configured_override");
  assert.equal(reader.calls.some(call => call.startsWith("model:")), false);
  const mismatch = await observeSession(reader, expected, { model: { providerID: "different", modelID: "model" }, modelOverride: { providerID: "different", modelID: "model", contextLimit: 1000000 } });
  assert.equal(mismatch.model?.contextLimit, 500000);
  assert.ok(mismatch.limitations.includes("MODEL_LIMIT_OVERRIDE_MISMATCH"));
  reader.model = unavailable();
  const absent = await observeSession(reader, expected, { modelOverride: { providerID: "different", modelID: "model", contextLimit: 1000000 } });
  assert.equal(absent.pressure.state, "unknown");
  assert.equal(absent.model?.contextLimit, undefined);
});

test("missing optional catalog and history remain unavailable telemetry without blocking identity", async () => {
  const reader = new FakeReader();
  reader.model = unavailable();
  const withoutCatalog = await observeSession(reader, expected);
  assert.equal(withoutCatalog.identity.verified, true);
  assert.equal(withoutCatalog.pressure.bestAvailableTokens, 280000);
  assert.equal(withoutCatalog.pressure.state, "unknown");
  assert.ok(withoutCatalog.limitations.includes("CONTEXT_LIMIT_UNAVAILABLE"));
  reader.pages.set("newest", unavailable());
  const withoutHistory = await observeSession(reader, expected);
  assert.equal(withoutHistory.identity.verified, true);
  assert.equal(withoutHistory.activity, "IDLE");
  assert.equal(withoutHistory.history.coverage, "UNAVAILABLE");
  assert.equal(withoutHistory.pressure.state, "unknown");
});

test("conflicting session or history identities never contribute usage", async () => {
  const reader = new FakeReader();
  reader.session = ok({ id: "ses_wrong", directory: expected.directory });
  const wrongSession = await observeSession(reader, expected);
  assert.equal(wrongSession.identity.verified, false);
  assert.deepEqual(reader.calls, ["session"]);
  reader.session = ok({ id: expected.session, directory: expected.directory });
  reader.pages.set("newest", ok({ messages: [assistant("msg_other", { session: "ses_wrong" })] }));
  const wrongHistory = await observeSession(reader, expected);
  assert.equal(wrongHistory.pressure.state, "unknown");
  assert.ok(wrongHistory.limitations.includes("HISTORY_IDENTITY_CONFLICT"));
});

test("busy and later user activity make last completion freshness explicit", async () => {
  const reader = new FakeReader();
  reader.status = ok("BUSY");
  const busy = await observeSession(reader, expected);
  assert.equal(busy.activity, "BUSY");
  assert.equal(busy.latestCompletedCall?.freshness, "NEWER_ACTIVITY_OBSERVED");
  reader.status = ok("IDLE");
  reader.pages.set("newest", ok({ messages: [assistant(), { id: "msg_new_user", session: expected.session, role: "user", timeCreated: 5000, text: "later request", hasCompactionPart: false }] }));
  const later = await observeSession(reader, expected);
  assert.equal(later.latestCompletedCall?.freshness, "NEWER_ACTIVITY_OBSERVED");
  assert.equal(later.pressure.state, "warn");
});

test("catalog identity mismatch and unknown status remain visibly unavailable", async () => {
  const reader = new FakeReader();
  reader.model = ok({ providerID: "other", modelID: "model", contextLimit: 1000000 });
  reader.status = unavailable();
  const snapshot = await observeSession(reader, expected);
  assert.equal(snapshot.activity, "UNKNOWN");
  assert.equal(snapshot.pressure.state, "unknown");
  assert.ok(snapshot.limitations.includes("MODEL_CATALOG_IDENTITY_CONFLICT"));
  assert.ok(snapshot.limitations.includes("ACTIVITY_UNAVAILABLE"));
});
