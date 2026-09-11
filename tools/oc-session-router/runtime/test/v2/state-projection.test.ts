import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { refreshState, renderProgress, stateAuthorityDigest, PROGRESS_START, PROGRESS_END } from "../../src/v2/state-projection.js";
import { OperationStore } from "../../src/v2/state-store.js";
import { freezeSources } from "../../src/v2/context-packet.js";
import type { WorkContext, Json } from "../../src/v2/contracts.js";
import type { RouterConfiguration } from "../../src/v2/routing.js";

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(process.cwd(), ".state-projection-fixture-á-"));
  const store = new OperationStore(path.join(root, "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 }); });
  const statePath = path.join(root, "PROJECT_STATE.md");
  const original = `# Owner authority\r\nScope: unchanged\r\nStop before closeout\r\n${PROGRESS_START}\r\nold projection\r\n${PROGRESS_END}\r\nPrivate human notes remain unchanged.\r\n`;
  writeFileSync(statePath, original);
  const work: WorkContext = { workId: "epic-one", target: "fixture", directory: root, instructionReference: "owner-work", scope: "unchanged", allowedEffects: ["READ_ONLY"], stoppingPoint: "no closeout" };
  store.openWork(work);
  const configuration: RouterConfiguration = { schemaVersion: 2, targets: { fixture: { namespace: "test", project: "fixture", directory: root, origin: "http://fixture.invalid", roles: {}, stateProjection: { path: "PROJECT_STATE.md", instructionReference: "Owner approved observed block only" } } } };
  return { root, store, statePath, original, work, configuration };
}

test("only enrolled marked projection changes; human authority and Owner pause survive", { skip: process.platform !== "win32" }, t => {
  const { store, statePath, original, work, configuration } = fixture(t);
  store.recordOwnerPause(work.workId, true, "owner-stop");
  const result = refreshState(store, configuration, work.workId);
  assert.equal(result.status, "UPDATED", JSON.stringify(result));
  const after = readFileSync(statePath, "utf8");
  assert.equal(stateAuthorityDigest(after), stateAuthorityDigest(original));
  assert.ok(after.includes("| YES |"));
  assert.equal(store.getWork(work.workId).paused, true);
  assert.equal(refreshState(store, configuration, work.workId).status, "UNCHANGED");
  assert.equal(readFileSync(statePath, "utf8"), after);
  delete configuration.targets.fixture!.stateProjection;
  assert.equal(refreshState(store, configuration, work.workId).status, "NOT_ENROLLED");
  assert.equal(readFileSync(statePath, "utf8"), after);
});

test("malformed markers and wrong target paths do not overwrite state", t => {
  const { store, statePath, work, configuration, original } = fixture(t);
  writeFileSync(statePath, original + PROGRESS_START);
  assert.equal(refreshState(store, configuration, work.workId).reason, "PROJECTION_MARKERS_INVALID");
  configuration.targets.fixture!.stateProjection!.path = "../PROJECT_STATE.md";
  assert.equal(refreshState(store, configuration, work.workId).status, "DEFERRED");
  assert.equal(readFileSync(statePath, "utf8"), original + PROGRESS_START);
  assert.throws(() => stateAuthorityDigest("No markers"), { code: "PROJECTION_MARKERS_INVALID" });
  writeFileSync(statePath, "Human authority without projection markers");
  const frozen = freezeSources(store, work, [{ path: "PROJECT_STATE.md" }], false, "PROJECT_STATE.md");
  assert.equal(frozen[0]!.authoritySha256, undefined, "missing optional markers do not block source preparation");
});

test("concurrent work rows do not create acceptance, and legacy prepared sources defer writes", t => {
  const { store, statePath, work, configuration, original } = fixture(t);
  store.openWork({ ...work, workId: "epic-two" });
  const operation = store.prepareAction({ workId: work.workId, actionKey: "review", participant: { namespace: "p", project: "p", session: "ses_private" }, recipientRole: "Meta", kind: "LIFECYCLE", effect: "READ_ONLY", command: "step-review", predecessor: null,
    input: { sources: [{ sourceClass: "FILE", reference: "PROJECT_STATE.md", sha256: "old", content: original }] } }).operation;
  assert.equal(refreshState(store, configuration, work.workId).reason, "LEGACY_STATE_SOURCE_IN_FLIGHT");
  for (let index = 0; index < 14; index++) store.openWork({ ...work, workId: `new-${index}` });
  assert.equal(refreshState(store, configuration, "new-13").reason, "LEGACY_STATE_SOURCE_IN_FLIGHT", "old pending sources outside the displayed12 rows still matter");
  assert.equal(readFileSync(statePath, "utf8"), original);
  store.startDispatch(operation.operationId);
  store.finish(operation.operationId, { execution: "COMPLETED", evidenceReferences: ["fixture"], response: { messageId: "msg_private", rootMessageId: operation.messageId, text: "Not automatically accepted" } });
  const rendered = renderProgress([store.getWork(work.workId), store.getWork("epic-two")]);
  assert.ok(rendered.includes("epic-one") && rendered.includes("epic-two"));
  assert.ok(rendered.includes("NOT_RECORDED"));
  assert.ok(!rendered.includes("Not automatically accepted") && !rendered.includes("ses_private") && !rendered.includes("msg_private"));
});

test("generated progress is outside the human-source fence, but scope edits still change it", t => {
  const { store, statePath, work, original } = fixture(t);
  const frozen = freezeSources(store, work, [{ path: "PROJECT_STATE.md" }], false, "PROJECT_STATE.md");
  assert.equal(frozen[0]!.authoritySha256, stateAuthorityDigest(original));
  writeFileSync(statePath, original.replace("old projection", "new observed progress"));
  assert.equal(stateAuthorityDigest(readFileSync(statePath, "utf8")), frozen[0]!.authoritySha256);
  assert.notEqual(stateAuthorityDigest(original.replace("Scope: unchanged", "Scope: expanded")), frozen[0]!.authoritySha256);
  assert.ok(frozen[0]!.content.includes("old projection"), "full original snapshot is still retained");
});

test("Windows compare/replace refuses a newer human edit", { skip: process.platform !== "win32" }, t => {
  const { root, statePath, original } = fixture(t);
  const expectedSha256 = createHash("sha256").update(original).digest("hex");
  writeFileSync(statePath, original.replace("Scope: unchanged", "Scope: OWNER UPDATE"));
  const helper = fileURLToPath(new URL("../../../scripts/write-observed-progress.ps1", import.meta.url));
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper], { input: JSON.stringify({ root, relativePath: "PROJECT_STATE.md", expectedSha256, body: "new observed progress" }), encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).reason, "STATE_CHANGED");
  assert.ok(readFileSync(statePath, "utf8").includes("Scope: OWNER UPDATE"));
});

test("two concurrent writers have one winner and preserve human authority", { skip: process.platform !== "win32" }, async t => {
  const { root, statePath, original } = fixture(t);
  const helper = fileURLToPath(new URL("../../../scripts/write-observed-progress.ps1", import.meta.url));
  const expectedSha256 = createHash("sha256").update(original).digest("hex");
  const write = (body: string) => new Promise<{ status: string; reason?: string }>((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { error += chunk; });
    child.once("error", reject);
    child.once("close", code => { try { assert.equal(code, 0, error); resolve(JSON.parse(output)); } catch (failure) { reject(failure); } });
    child.stdin.end(JSON.stringify({ root, relativePath: "PROJECT_STATE.md", expectedSha256, body }));
  });
  const results = await Promise.all([write("first observed snapshot"), write("second observed snapshot")]);
  assert.equal(results.filter(result => result.status === "UPDATED").length, 1);
  assert.equal(results.filter(result => result.status === "DEFERRED").length, 1);
  assert.equal(stateAuthorityDigest(readFileSync(statePath, "utf8")), stateAuthorityDigest(original));
});
