import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, type WorkContext } from "./contracts.js";
import { RouterError, readContainedSource } from "./routing.js";
import type { OperationStore } from "./state-store.js";
import { stateAuthorityDigest } from "./state-projection.js";

export type Selection = { heading?: string; lines?: { start: number; end: number } };
export type SourceReference = ({ path: string; sha256?: string } | { operationId: string }) & Selection & {
  mode?: "auto" | "inline" | "reference" | "excerpt";
};
export interface SourceSnapshot {
  sourceClass: "FILE" | "RESULT"; reference: string; sha256: string; content: string;
  sourceId: string; mode: "inline" | "reference" | "excerpt"; selection: Selection;
  authoritySha256?: string;
}
const bytes = (value: string) => Buffer.byteLength(value, "utf8");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

/** Explicit, unique selection; no silent truncation and no prose summarization. */
export function selectSource(content: string, selection: Selection): string {
  if (selection.heading !== undefined && selection.lines !== undefined) throw new RouterError("SOURCE_SELECTION_AMBIGUOUS");
  const lines = content.split(/\r?\n/);
  if (selection.lines !== undefined) {
    const { start, end } = selection.lines;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > lines.length) throw new RouterError("SOURCE_LINES_INVALID");
    return lines.slice(start - 1, end).join("\n");
  }
  if (selection.heading !== undefined) {
    if (typeof selection.heading !== "string" || !/^#{1,6} [^\r\n]+$/.test(selection.heading)) throw new RouterError("SOURCE_HEADING_INVALID");
    // Ignore fenced examples when resolving Markdown sections.
    let fence: { char: string; length: number } | undefined;
    const headings: Array<{ index: number; level: number; text: string }> = [];
    lines.forEach((line, index) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (marker) {
        if (!fence) fence = { char: marker[1]![0]!, length: marker[1]!.length };
        else if (fence.char === marker[1]![0] && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
        return;
      }
      if (!fence) { const heading = /^(#{1,6}) (.+)$/.exec(line); if (heading) headings.push({ index, level: heading[1]!.length, text: line.trimEnd() }); }
    });
    const matches = headings.filter(item => item.text === selection.heading);
    if (matches.length !== 1) throw new RouterError(matches.length ? "SOURCE_HEADING_AMBIGUOUS" : "SOURCE_HEADING_NOT_FOUND");
    const start = matches[0]!;
    const end = headings.find(item => item.index > start.index && item.level <= start.level)?.index ?? lines.length;
    return lines.slice(start.index, end).join("\n");
  }
  return content;
}

function sourceIdentity(workId: string, source: Pick<SourceSnapshot, "sourceClass" | "reference" | "sha256" | "content">): string {
  return digest({ workId, sourceClass: source.sourceClass, reference: source.reference, sha256: source.sha256, content: source.content });
}

export function freezeSources(store: OperationStore, work: WorkContext, references: SourceReference[], restore = false, projectionPath?: string): SourceSnapshot[] {
  if (!Array.isArray(references)) throw new RouterError("SOURCE_REFERENCES_INVALID");
  const seen = new Set<string>();
  const result: SourceSnapshot[] = [];
  for (const reference of references) {
    if (!reference || ("path" in reference) === ("operationId" in reference)) throw new RouterError("SOURCE_REFERENCE_INVALID");
    const requested = reference.mode ?? "auto";
    if (!["auto", "inline", "reference", "excerpt"].includes(requested)) throw new RouterError("SOURCE_MODE_INVALID");
    const selection: Selection = { ...(reference.heading === undefined ? {} : { heading: reference.heading }), ...(reference.lines === undefined ? {} : { lines: reference.lines }) };
    if ((requested === "excerpt") !== !!Object.keys(selection).length) throw new RouterError("SOURCE_SELECTION_MODE_INVALID");
    let raw: Pick<SourceSnapshot, "sourceClass" | "reference" | "sha256" | "content">;
    if ("path" in reference) {
      const source = readContainedSource(work.directory, reference.path);
      if (sha(source.content) !== source.sha256) throw new RouterError("SOURCE_TEXT_ENCODING_INVALID");
      if (reference.sha256 !== undefined && source.sha256 !== reference.sha256) throw new RouterError("SOURCE_CHANGED");
      raw = { sourceClass: "FILE", reference: source.path, sha256: source.sha256, content: source.content };
    } else {
      const operation = store.getOperation(reference.operationId);
      const content = operation.outcome?.response?.text ?? operation.outcome?.artifact?.text;
      if (operation.action.workId !== work.workId || !operation.completedAt || content === undefined || !operation.resultDigest) throw new RouterError("RESULT_SOURCE_UNAVAILABLE");
      raw = { sourceClass: "RESULT", reference: operation.operationId, sha256: operation.resultDigest, content };
    }
    selectSource(raw.content, selection); // Fail ambiguous caller selection before creating an operation.
    const sourceId = sourceIdentity(work.workId, raw);
    const mode = requested === "auto" ? (restore || bytes(raw.content) > 16 * 1024 ? "reference" : "inline") : requested;
    const key = digest({ sourceId, selection, mode });
    if (seen.has(key)) continue;
    seen.add(key);
    const normalizedPath = (value: string) => process.platform === "win32" ? value.replaceAll("\\", "/").toLowerCase() : value;
    let authoritySha256: string | undefined;
    if (raw.sourceClass === "FILE" && projectionPath && normalizedPath(raw.reference) === normalizedPath(projectionPath)) {
      try { authoritySha256 = stateAuthorityDigest(raw.content); }
      catch (error) { if (!(error instanceof RouterError) || error.code !== "PROJECTION_MARKERS_INVALID") throw error; }
      // Missing optional enrollment markers retain the whole-file fence; they
      // are projection debt, not a new lifecycle admission requirement.
    }
    result.push({ ...raw, sourceId, selection, mode,
      ...(authoritySha256 ? { authoritySha256 } : {}) });
  }
  return result;
}

export function renderSources(workId: string, sources: SourceSnapshot[], databasePath?: string) {
  const readerContext = sources.some(source => source.mode !== "inline") ? `\n\nFrozen-source reader (local, read-only): ${JSON.stringify({ entryPoint: fileURLToPath(new URL("../../../../scripts/Invoke-OCRouter.ps1", import.meta.url)), ...(databasePath ? { stateRoot: path.dirname(databasePath) } : {}) })}. Use these explicit paths, not a guessed default store.` : "";
  return readerContext + sources.map(source => {
    const reader = JSON.stringify({ workId, sourceId: source.sourceId });
    const prefix = `\n\nReference data (${source.reference}):`;
    if (source.mode === "inline") return `${prefix}\n${source.content}`;
    const handle = `Frozen source SHA-256: ${source.sha256}; full bytes: ${bytes(source.content)}.\nFAL Invoke-OCRouter.ps1 -Action read-source accepts -WorkId and -SourceId from ${reader}; optionally -Heading or -StartLine/-EndLine. No JSON file, credential or new operation is needed. No selector returns the complete snapshot.`;
    return source.mode === "reference" ? `${prefix} [REFERENCE ONLY]\n${handle}\nAvailable context, not an instruction to read everything. Retrieve the plan/evidence required for this stage; use targeted sections for roadmap/history and do not eagerly reload all references.`
      : `${prefix} [EXPLICIT EXCERPT ${JSON.stringify(source.selection)}]\n${selectSource(source.content, source.selection)}\n${handle}`;
  }).join("");
}

export function packetSummary(argument: string, sources: SourceSnapshot[]) {
  const inlineBytes = bytes(argument);
  return { argumentBytes: inlineBytes, retainedSourceBytes: sources.reduce((sum, source) => sum + bytes(source.content), 0),
    sourceCount: sources.length, warning: inlineBytes > 32 * 1024 ? "LARGE_PACKET_REVIEW_SOURCE_SELECTION" : null,
    largestSources: sources.map(source => ({ reference: source.reference, mode: source.mode, bytes: bytes(source.content) })).sort((a, b) => b.bytes - a.bytes).slice(0, 3) };
}

export function readFrozenSource(store: OperationStore, request: { workId: string; sourceId: string } & Selection) {
  if (!/^[a-f0-9]{64}$/.test(request.sourceId)) throw new RouterError("SOURCE_ID_INVALID");
  for (const operation of store.getWork(request.workId).operations) {
    for (const source of (operation.action.input.sources ?? []) as unknown as SourceSnapshot[]) {
      if (source.sourceId !== request.sourceId) continue;
      if (sourceIdentity(request.workId, source) !== request.sourceId) throw new RouterError("SOURCE_SNAPSHOT_CORRUPT");
      const content = selectSource(source.content, request);
      return { sourceId: source.sourceId, reference: source.reference, sourceSha256: source.sha256, selectedTextSha256: sha(content), content, lifecycleSend: false };
    }
  }
  throw new RouterError("SOURCE_SNAPSHOT_NOT_FOUND");
}
