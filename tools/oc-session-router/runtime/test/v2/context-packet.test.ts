import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { freezeSources, renderSources, readFrozenSource, packetSummary, selectSource } from "../../src/v2/context-packet.js";
import { OperationStore } from "../../src/v2/state-store.js";
import type { WorkContext, Json } from "../../src/v2/contracts.js";

test("large sources stay exact and readable, but shrink the request without truncation", t => {
  const root = mkdtempSync(path.join(process.cwd(), ".packet-fixture-"));
  const store = new OperationStore(path.join(root, "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 }); });
  const work: WorkContext = { workId: "packet-work", target: "fixture", directory: root, instructionReference: "owner", scope: "fixture", allowedEffects: ["READ_ONLY"], stoppingPoint: "return" };
  store.openWork(work);
  const combined = "# Combined\n\n## Current Epic\nRelevant scope\n\n## History\n" + "Unrelated history\n".repeat(9000);
  writeFileSync(path.join(root, "combined.md"), combined);
  const sources = freezeSources(store, work, [{ path: "combined.md" }, { path: "./combined.md" }]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0]!.mode, "reference");
  assert.equal(sources[0]!.content, combined);
  const rendered = renderSources(work.workId, sources, store.databasePath);
  assert.ok(Buffer.byteLength(rendered) < Buffer.byteLength(combined) / 20);
  assert.ok(rendered.includes("stateRoot"));
  assert.ok(!rendered.includes("Unrelated history"));
  const operation = store.prepareAction({ workId: work.workId, actionKey: "frozen", participant: { namespace: "test", project: "p", session: "ses_test" }, recipientRole: "Meta", kind: "LIFECYCLE", effect: "READ_ONLY", command: "step-review", predecessor: null, input: { sources: sources as unknown as Json } }).operation;
  writeFileSync(path.join(root, "combined.md"), "Changed after the frozen snapshot");
  assert.equal(readFrozenSource(store, { workId: work.workId, sourceId: sources[0]!.sourceId }).content, combined);
  assert.equal(readFrozenSource(store, { workId: work.workId, sourceId: sources[0]!.sourceId, heading: "## Current Epic" }).content.trim(), "## Current Epic\nRelevant scope");
  assert.equal(store.getOperation(operation.operationId).dispatchStartedAt, null);
  const other = { ...work, workId: "other" }; store.openWork(other);
  assert.throws(() => readFrozenSource(store, { workId: other.workId, sourceId: sources[0]!.sourceId }), { code: "SOURCE_SNAPSHOT_NOT_FOUND" });
});

test("explicit selections reject ambiguity and ignore fenced headings", () => {
  const content = "# Root\n```md\n## Slice\nfake\n```\n## Slice\nreal\n### Nested\nkeep\n## Next\nno";
  assert.equal(selectSource(content, { heading: "## Slice" }), "## Slice\nreal\n### Nested\nkeep");
  assert.equal(selectSource(content, { lines: { start: 7, end: 7 } }), "real");
  assert.throws(() => selectSource("## X\n## X", { heading: "## X" }), { code: "SOURCE_HEADING_AMBIGUOUS" });
  assert.throws(() => selectSource(content, { heading: "## Missing" }), { code: "SOURCE_HEADING_NOT_FOUND" });
  assert.throws(() => selectSource(content, { lines: { start: 0, end: 2 } }), { code: "SOURCE_LINES_INVALID" });
  assert.throws(() => selectSource(content, { heading: "## Slice", lines: { start: 1, end: 2 } }), { code: "SOURCE_SELECTION_AMBIGUOUS" });
});

test("restore defaults to references; explicit inline is allowed and merely warns when large", t => {
  const root = mkdtempSync(path.join(process.cwd(), ".packet-fixture-"));
  const store = new OperationStore(path.join(root, "router.sqlite"));
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const work: WorkContext = { workId: "restore", target: "p", directory: root, instructionReference: "owner", scope: "fixture", allowedEffects: ["READ_ONLY"], stoppingPoint: "return" };
  store.openWork(work);
  writeFileSync(path.join(root, "small.md"), "Small exact text");
  writeFileSync(path.join(root, "large.md"), "large".repeat(10000));
  assert.equal(freezeSources(store, work, [{ path: "small.md" }], true)[0]!.mode, "reference");
  const inline = freezeSources(store, work, [{ path: "large.md", mode: "inline" }]);
  assert.equal(packetSummary(renderSources(work.workId, inline), inline).warning, "LARGE_PACKET_REVIEW_SOURCE_SELECTION");
  assert.throws(() => freezeSources(store, work, [{ path: "small.md", heading: "# Heading" }]), { code: "SOURCE_SELECTION_MODE_INVALID" });
  assert.throws(() => freezeSources(store, work, [{ path: "../outside" }]), { code: "SOURCE_PATH_UNSAFE" });
  writeFileSync(path.join(root, "binary.dat"), Buffer.from([255, 254, 0]));
  assert.throws(() => freezeSources(store, work, [{ path: "binary.dat" }]), { code: "SOURCE_TEXT_ENCODING_INVALID" });
});
