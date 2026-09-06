import path from "node:path";
import { digest } from "./contracts.js";
import { AdapterError, type AdapterReply, type OpenCodeAdapter, type OpenCodeMessage } from "./opencode-adapter.js";
import type { ModelIdentity, SessionObservation } from "./session-observation.js";

export type CompactReader = Pick<OpenCodeAdapter, "getSession" | "getStatus" | "getMessage" | "getHistory">;
/** Private dispatch provenance, persisted by the operation store's existing owner. */
export interface CompactBaseline { session: string; directory: string; headMessageId: string | null; capturedAt: string }
export interface CompactCompletionObservation {
  state: "PENDING" | "COMPLETE" | "FAILED" | "AMBIGUOUS";
  reason: string;
  activity: "BUSY" | "IDLE" | "UNKNOWN";
  coverage: { baselineFound: boolean; complete: boolean; pagesRead: number; messagesRead: number; nextCursor?: string };
  markerMessageId?: string;
  summaryMessageId?: string;
  summary?: OpenCodeMessage;
  evidenceReferences?: string[];
  model: { requested: ModelIdentity; effective?: ModelIdentity; matchesRequested: boolean | null };
  provenance: "UNIQUE_POST_BASELINE_EFFECT_OBSERVATION";
  limitations: string[];
}
function sameDirectory(left: string, right: string): boolean {
  if (!path.isAbsolute(left) || !path.isAbsolute(right)) return false;
  const normalize = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}
function validId(value: unknown): value is string { return typeof value === "string" && value.startsWith("msg") && !value.includes("\0"); }
async function read<T>(call: () => Promise<AdapterReply<T>>): Promise<T | undefined> {
  try { const reply = await call(); return reply.status >= 200 && reply.status < 300 && !reply.problem ? reply.value : undefined; } catch { return undefined; }
}

/** Captures the real latest head, not the latest assistant or most recent summary. */
export async function captureCompactBaseline(adapter: Pick<CompactReader, "getSession" | "getHistory">): Promise<CompactBaseline> {
  const session = await read(() => adapter.getSession());
  if (!session || !session.id.startsWith("ses") || !path.isAbsolute(session.directory)) throw new AdapterError("INVALID_INPUT");
  const page = await read(() => adapter.getHistory({ limit: 1 }));
  if (!page || page.messages.length > 1 || (page.messages.length === 0 && page.nextCursor !== undefined)) throw new AdapterError("INVALID_INPUT");
  const head = page.messages.at(-1);
  if (head && (!validId(head.id) || head.session !== session.id)) throw new AdapterError("INVALID_INPUT");
  return { session: session.id, directory: session.directory, headMessageId: head?.id ?? null, capturedAt: new Date().toISOString() };
}

/** A completed native effect with old-context summary usage is not a fresh compact trigger. */
export function alreadyCompacted(snapshot: SessionObservation): boolean {
  return snapshot.identity.verified && snapshot.lastCompaction?.source === "NATIVE_COMPACTION_PART" && snapshot.lastCompaction.completed
    && snapshot.latestCompletedCall?.freshness === "COMPACTION_AFTER_CALL";
}

/** No POST, DB, retry or workflow control. OpenCode summarize has no caller-chosen
 * root ID; this observes a unique effect after the frozen head in the personal
 * same-user coordination scope, not universal remote exactly-once execution.
 * Official v1.18.28 compaction.ts creates a user compaction part and an assistant
 * summary with parentID pointing to it; compaction agent.model may override the
 * requested model, so model differences are recorded rather than denied. */
export async function observeCompactCompletion(
  adapter: CompactReader,
  baseline: CompactBaseline | null | undefined,
  expected: { session: string; directory: string; providerID: string; modelID: string },
  options: { pageLimit?: number; pageBudget?: number } = {},
): Promise<CompactCompletionObservation> {
  const pageLimit = options.pageLimit ?? 40, pageBudget = options.pageBudget ?? 6;
  if (!expected.session.startsWith("ses") || !path.isAbsolute(expected.directory) || !expected.providerID.trim() || !expected.modelID.trim()
    || !Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > 1000 || !Number.isSafeInteger(pageBudget) || pageBudget < 1 || pageBudget > 100) throw new AdapterError("INVALID_INPUT");
  const result: CompactCompletionObservation = {
    state: "PENDING", reason: "BASELINE_UNAVAILABLE", activity: "UNKNOWN",
    coverage: { baselineFound: false, complete: false, pagesRead: 0, messagesRead: 0 },
    model: { requested: { providerID: expected.providerID, modelID: expected.modelID }, matchesRequested: null },
    provenance: "UNIQUE_POST_BASELINE_EFFECT_OBSERVATION",
    limitations: ["SUMMARIZE_HAS_NO_CALLER_CHOSEN_ROOT_ID", "PERSONAL_SCOPE_EFFECT_CORRELATION_NOT_REMOTE_EXACTLY_ONCE"],
  };
  const pending = (reason: string) => { result.reason = reason; return result; };
  if (!baseline || !Number.isFinite(Date.parse(baseline.capturedAt)) || (baseline.headMessageId !== null && !validId(baseline.headMessageId))) return result;
  if (baseline.session !== expected.session || !sameDirectory(baseline.directory, expected.directory)) return pending("BASELINE_ADDRESS_CONFLICT");
  const session = await read(() => adapter.getSession());
  if (!session) return pending("SESSION_READ_UNAVAILABLE");
  if (session.id !== expected.session || !sameDirectory(session.directory, expected.directory)) return pending("SESSION_ADDRESS_CONFLICT");
  result.activity = await read(() => adapter.getStatus()) ?? "UNKNOWN";
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  const messages = new Map<string, OpenCodeMessage>();
  // Each server page is chronological; traversal itself runs newest page to oldest.
  // Cut at the exact frozen head, never by English output or ID-string ordering.
  for (let index = 0; index < pageBudget; index += 1) {
    const page = await read(() => adapter.getHistory({ limit: pageLimit, ...(cursor === undefined ? {} : { before: cursor }) }));
    if (!page) return pending("HISTORY_READ_UNAVAILABLE");
    result.coverage.pagesRead += 1;
    if (page.messages.some(message => message.session !== expected.session || !validId(message.id))) return pending("HISTORY_IDENTITY_CONFLICT");
    const boundary = baseline.headMessageId === null ? -1 : page.messages.findIndex(message => message.id === baseline.headMessageId);
    const after = boundary >= 0 ? page.messages.slice(boundary + 1) : page.messages;
    for (const message of after) {
      const prior = messages.get(message.id);
      if (prior && digest(prior) !== digest(message)) return pending("HISTORY_CHANGED_DURING_READ");
      messages.set(message.id, message);
    }
    result.coverage.messagesRead = messages.size;
    if (boundary >= 0 || (baseline.headMessageId === null && page.nextCursor === undefined)) {
      result.coverage.baselineFound = true;
      result.coverage.complete = true;
      delete result.coverage.nextCursor;
      break;
    }
    if (page.nextCursor === undefined) return pending("BASELINE_NOT_FOUND");
    result.coverage.nextCursor = page.nextCursor;
    if (seenCursors.has(page.nextCursor)) return pending("HISTORY_CURSOR_CYCLE");
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  if (!result.coverage.complete) return pending("HISTORY_COVERAGE_PARTIAL");
  const after = [...messages.values()];
  const markers = after.filter(message => message.role === "user" && message.hasCompactionPart);
  if (markers.length > 1) { result.state = "AMBIGUOUS"; return pending("MULTIPLE_NEW_COMPACTION_MARKERS"); }
  if (markers.length === 0) return pending(result.activity === "BUSY" ? "BUSY_WITHOUT_COMPACTION_EVIDENCE" : "NO_NEW_COMPACTION_MARKER");
  const marker = markers[0]!;
  if (marker.parentId !== undefined) return pending("COMPACTION_MARKER_IDENTITY_CONFLICT");
  result.markerMessageId = marker.id;
  const summaries = after.filter(message => message.role === "assistant" && message.parentId === marker.id && message.summary === true);
  if (summaries.length > 1) { result.state = "AMBIGUOUS"; return pending("MULTIPLE_SUMMARY_CANDIDATES"); }
  if (summaries.length === 0) return pending("SUMMARY_NOT_OBSERVED");
  const summaryId = summaries[0]!.id;
  // Observe current evidence by exact ID after page traversal, without choosing newer chat.
  const [currentMarker, summary] = await Promise.all([read(() => adapter.getMessage(marker.id)), read(() => adapter.getMessage(summaryId))]);
  if (!currentMarker || !summary) return pending("EXACT_EVIDENCE_READ_UNAVAILABLE");
  if (currentMarker.id !== marker.id || currentMarker.session !== expected.session || currentMarker.role !== "user" || currentMarker.parentId !== undefined || !currentMarker.hasCompactionPart
    || summary.id !== summaryId || summary.session !== expected.session || summary.role !== "assistant" || summary.parentId !== marker.id || summary.summary !== true) return pending("SUMMARY_PARENT_OR_MARKER_CONFLICT");
  result.summaryMessageId = summary.id;
  if (summary.providerID && summary.modelID) {
    result.model.effective = { providerID: summary.providerID, modelID: summary.modelID };
    result.model.matchesRequested = summary.providerID === expected.providerID && summary.modelID === expected.modelID;
    if (!result.model.matchesRequested) result.limitations.push("SUMMARY_MODEL_DIFFERS_REQUESTED");
  } else result.limitations.push("SUMMARY_MODEL_UNAVAILABLE");
  if (typeof summary.timeCompleted !== "number" || !Number.isFinite(summary.timeCompleted) || summary.timeCompleted < 0) return pending("SUMMARY_NOT_TERMINAL");
  if (summary.error !== true && (!summary.finish || ["tool-calls", "unknown"].includes(summary.finish))) return pending("SUMMARY_NOT_TERMINAL");
  result.summary = summary;
  result.state = summary.error === true ? "FAILED" : "COMPLETE";
  result.reason = summary.error === true ? "SUMMARY_EXECUTION_FAILED" : "UNIQUE_COMPACTION_EFFECT_OBSERVED";
  result.evidenceReferences = [`opencode-compact-effect-sha256:${digest({ session: expected.session, head: baseline.headMessageId, marker: marker.id, summary: summary.id, text: summary.text, execution: result.state })}`];
  return result;
}
