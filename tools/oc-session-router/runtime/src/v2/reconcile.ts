import path from "node:path";
import { digest, StoreError, type Json, type Observation, type Operation, type TerminalOutcome } from "./contracts.js";
import type { AdapterReply, OpenCodeAdapter, OpenCodeMessage } from "./opencode-adapter.js";
import type { OperationStore } from "./state-store.js";
import { linkFacts, nativeContinuation, type ContinuationProof } from "./native-continuation.js";

export type ReconcileReader = Pick<OpenCodeAdapter, "getSession" | "getStatus" | "getMessage" | "getHistory">;
export interface ReconcileResult {
  operation: Operation;
  disposition: "STORED" | "PREPARED" | "COMPACT_PENDING" | "COMPLETED" | "FAILED" | "PENDING" | "CONTINUE" | "AMBIGUOUS";
  nextCursor?: string;
}
interface ScanState { headId?: string; candidateIds: string[]; complete: boolean; links?: OpenCodeMessage[]; linksOverflow?: boolean }
function scanState(operation: Operation): ScanState {
  const raw = operation.observation?.context?.reconcile;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { candidateIds: [], complete: false };
  return {
    ...(typeof raw.headId === "string" ? { headId: raw.headId } : {}),
    candidateIds: Array.isArray(raw.candidateIds) ? raw.candidateIds.filter((id): id is string => typeof id === "string" && id.startsWith("msg")).slice(0, 2) : [],
    complete: raw.complete === true,
    ...(Array.isArray(raw.links) ? { links: raw.links as unknown as OpenCodeMessage[] } : {}),
    linksOverflow: raw.linksOverflow === true,
  };
}
function sameDirectory(left: string, right: string): boolean {
  const normalize = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}
function good<T>(reply: AdapterReply<T> | undefined): reply is AdapterReply<T> & { value: T } {
  return reply !== undefined && reply.status >= 200 && reply.status < 300 && reply.problem === undefined && reply.value !== undefined;
}
async function read<T>(call: () => Promise<AdapterReply<T>>): Promise<AdapterReply<T> | undefined> {
  try { return await call(); } catch { return undefined; } // Never retain a private transport exception string.
}
function exactRoot(message: OpenCodeMessage, operation: Operation): boolean {
  return message.id === operation.messageId && message.session === operation.action.participant.session && message.role === "user" && message.parentId === undefined;
}
function child(message: OpenCodeMessage, operation: Operation): boolean {
  return message.id.startsWith("msg") && message.session === operation.action.participant.session && message.role === "assistant" && message.parentId === operation.messageId;
}
export function isTerminalMessage(message: OpenCodeMessage): boolean {
  return message.summary !== true && !message.hasCompactionPart && typeof message.timeCompleted === "number" && Number.isFinite(message.timeCompleted)
    && message.timeCompleted >= 0 && (message.error === true || (typeof message.finish === "string" && message.finish.length > 0 && !["tool-calls", "unknown"].includes(message.finish)));
}

/** Shared by POST completion and GET recovery; no observation-time or template input. */
export function outcomeForMessage(message: OpenCodeMessage): TerminalOutcome {
  if (!isTerminalMessage(message) || message.role !== "assistant" || !message.parentId?.startsWith("msg")) throw new StoreError("INVALID_INPUT");
  const execution = message.error === true ? "FAILED" : "COMPLETED";
  const evidence = { session: message.session, messageId: message.id, rootMessageId: message.parentId, text: message.text, execution };
  return {
    execution,
    evidenceReferences: [`opencode-message-sha256:${digest(evidence)}`],
    response: { messageId: message.id, rootMessageId: message.parentId, text: message.text },
    ...(message.error === true ? { reason: "REMOTE_EXECUTION_FAILED" } : {}),
  };
}

/** GET-only recovery. Delivery/execution facts are separate from responsible interpretation. */
export async function reconcileOperation(
  store: OperationStore,
  operationId: string,
  adapter: ReconcileReader,
  // pageBudget bounds backfill pages in addition to the mandatory newest-page read.
  options: { pageLimit?: number; pageBudget?: number } = {},
): Promise<ReconcileResult> {
  let operation = store.getOperation(operationId);
  if (operation.completedAt) return { operation, disposition: "STORED" };
  if (!operation.dispatchStartedAt && operation.action.kind !== "LEGACY") return { operation, disposition: "PREPARED" };
  if (operation.action.kind === "COMPACT") return { operation, disposition: "COMPACT_PENDING" };
  const pageLimit = options.pageLimit ?? 40;
  const pageBudget = options.pageBudget ?? 6;
  if (!Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > 1000 || !Number.isSafeInteger(pageBudget) || pageBudget < 1 || pageBudget > 100) throw new StoreError("INVALID_INPUT");
  let activity: Observation["activity"] = "UNKNOWN";
  let scan = scanState(operation);
  let cursor = operation.observation?.cursor;

  const observed = (reason: string, disposition: ReconcileResult["disposition"] = "PENDING", message?: OpenCodeMessage): ReconcileResult => {
    const current = store.getOperation(operationId);
    if (current.completedAt) return { operation: current, disposition: "STORED" };
    const context: { [key: string]: Json } = {
      ...current.observation?.context,
      reason,
      reconcile: JSON.parse(JSON.stringify({ ...scan, candidateIds: [...scan.candidateIds] })) as Json,
    };
    if (message?.tokens) { context.tokenObservation = JSON.parse(JSON.stringify(message.tokens)) as Json; context.tokenObservationKind = "LAST_ASSISTANT_CALL"; }
    operation = store.observe(operationId, { observedAt: new Date().toISOString(), activity, ...(cursor === undefined ? {} : { cursor }), context });
    return { operation, disposition, ...(cursor === undefined ? {} : { nextCursor: cursor }) };
  };
  const acknowledgeRoot = () => { operation = store.acknowledge(operationId, { rootMessageId: operation.messageId }); };
  const finish = (message: OpenCodeMessage, proof?: ContinuationProof): ReconcileResult => {
    const current = store.getOperation(operationId);
    if (current.completedAt) return { operation: current, disposition: "STORED" };
    // Identity was checked before this call. Commit correlation before reading semantic prose.
    operation = store.acknowledge(operationId, { rootMessageId: operation.messageId, responseMessageId: message.id });
    activity = message.error === true ? "FAILED" : "COMPLETED";
    cursor = undefined;
    observed("TERMINAL_EXECUTION_OBSERVED", "PENDING", message);
    const outcome = outcomeForMessage(message);
    if (proof) {
      // Keep actual immediate parent distinct from the proven original operation root.
      outcome.response = { ...outcome.response!, rootMessageId: operation.messageId, parentMessageId: message.parentId! };
      outcome.evidenceReferences.push(`opencode-native-continuation-sha256:${digest(proof.anchors)}`);
    }
    try { operation = store.finish(operationId, outcome); }
    catch (error) {
      const latest = store.getOperation(operationId);
      if (error instanceof StoreError && error.code === "RESULT_CONFLICT" && latest.completedAt) return { operation: latest, disposition: "STORED" };
      throw error;
    }
    return { operation, disposition: outcome.execution };
  };

  if (operation.correlation.rootMessageId && operation.correlation.rootMessageId !== operation.messageId) return observed("ROOT_CORRELATION_CONFLICT");
  const session = await read(() => adapter.getSession());
  if (!good(session)) return observed("SESSION_READ_UNAVAILABLE");
  const work = store.getWork(operation.action.workId);
  if (session.value.id !== operation.action.participant.session || session.value.projectID !== operation.action.participant.project || !sameDirectory(session.value.directory, work.context.directory)) return observed("SESSION_ADDRESS_CONFLICT");
  const status = await read(() => adapter.getStatus());
  if (good(status)) activity = status.value;

  const root = await read(() => adapter.getMessage(operation.messageId));
  if (good(root)) {
    if (!exactRoot(root.value, operation)) return observed("ROOT_IDENTITY_CONFLICT");
    acknowledgeRoot();
  } else if (root?.problem === "IDENTITY_MISMATCH") return observed("ROOT_IDENTITY_CONFLICT");
  // A prior durable acknowledgement survives later unavailable history/root reads.
  let delivered = operation.correlation.rootMessageId === operation.messageId;
  const responseId = operation.correlation.responseMessageId;
  if (responseId) {
    const reply = await read(() => adapter.getMessage(responseId));
    if (!good(reply)) return observed("RESPONSE_READ_UNAVAILABLE");
    if (reply.value.id !== responseId) return observed("RESPONSE_PARENT_CONFLICT");
    if (child(reply.value, operation) && isTerminalMessage(reply.value)) return finish(reply.value);
    // Acknowledged tool-only responses can later finish under a native continuation.
    // A different parent still requires the complete proof below, never a bypass.
  }

  const newest = await read(() => adapter.getHistory({ limit: pageLimit }));
  if (!good(newest)) return observed("HISTORY_READ_UNAVAILABLE");
  const oldHead = scan.headId;
  const newestMessages = newest.value.messages;
  const overlaps = oldHead !== undefined && newestMessages.some(message => message.id === oldHead);
  // If more than a page arrived since the last read, jumping to the saved older
  // cursor would hide a gap. Restart the contiguous scan; the next call can resume.
  if (!overlaps || !scan.links) { cursor = newest.value.nextCursor; scan.complete = false; scan.links = []; scan.linksOverflow = false; }
  if (newestMessages.length) scan.headId = newestMessages.at(-1)!.id;
  const candidates = new Set(scan.candidateIds);
  const consume = (messages: OpenCodeMessage[]): boolean => {
    let reachedRoot = false;
    for (const message of messages) {
      if (message.session !== operation.action.participant.session) return false;
      const index = scan.links!.findIndex(item => item.id === message.id);
      if (index >= 0) scan.links![index] = linkFacts(message);
      else if (scan.links!.length < 2048) scan.links!.push(linkFacts(message));
      else scan.linksOverflow = true;
      if (message.id === operation.messageId) {
        if (!exactRoot(message, operation)) return false;
        if (!delivered) { acknowledgeRoot(); delivered = true; }
        reachedRoot = true;
      }
      if (child(message, operation) && isTerminalMessage(message) && candidates.size < 2) candidates.add(message.id);
    }
    scan.candidateIds = [...candidates];
    if (reachedRoot) { scan.complete = true; cursor = undefined; }
    return true;
  };
  if (!consume(newestMessages)) return observed("HISTORY_IDENTITY_CONFLICT");
  if (!overlaps && newest.value.nextCursor === undefined) scan.complete = true;
  let pages = 0;
  const seenCursors = new Set<string>();
  while (!scan.complete && cursor !== undefined && pages < pageBudget && candidates.size < 2) {
    if (seenCursors.has(cursor)) return observed("HISTORY_CURSOR_CYCLE");
    seenCursors.add(cursor);
    const page = await read(() => adapter.getHistory({ limit: pageLimit, before: cursor! }));
    if (!good(page)) return observed("HISTORY_READ_UNAVAILABLE");
    pages += 1;
    if (page.value.nextCursor === cursor) return observed("HISTORY_CURSOR_CYCLE");
    const previousCursor = cursor;
    cursor = page.value.nextCursor;
    if (!consume(page.value.messages)) { cursor = previousCursor; return observed("HISTORY_IDENTITY_CONFLICT"); }
    if (cursor === undefined) scan.complete = true;
  }
  if (candidates.size > 1) return observed("MULTIPLE_TERMINAL_CHILDREN", "AMBIGUOUS");
  if (!scan.complete) return observed("HISTORY_CONTINUATION", "CONTINUE");
  cursor = undefined;
  if (!delivered) return observed("ROOT_NOT_VERIFIED");
  const proof = scan.linksOverflow ? undefined : nativeContinuation(scan.links ?? [], operation.messageId, isTerminalMessage);
  if (proof && proof.candidates.length > 1) return observed("MULTIPLE_CONTINUATION_TERMINALS", "AMBIGUOUS");
  const candidateId = scan.candidateIds[0];
  if (!candidateId) {
    if (!proof) return observed("NATIVE_CONTINUATION_SCAN_LIMIT");
    const continuedId = proof.candidates[0];
    if (!continuedId) return observed(responseId ? "RESPONSE_PARENT_CONFLICT" : "NO_TERMINAL_CHILD");
    // Re-read proof identities and latest head; pagination/cache text alone cannot finish.
    for (const anchor of proof.anchors) {
      const reply = await read(() => adapter.getMessage(anchor.id));
      if (!good(reply) || digest(linkFacts(reply.value)) !== digest(anchor)) return observed("CONTINUATION_PROOF_CHANGED");
    }
    const reply = await read(() => adapter.getMessage(continuedId));
    if (!good(reply) || reply.value.id !== continuedId || reply.value.session !== operation.action.participant.session ||
      reply.value.parentId !== proof.parent || !isTerminalMessage(reply.value)) return observed("CONTINUATION_CANDIDATE_CHANGED");
    const head = await read(() => adapter.getHistory({ limit: pageLimit }));
    if (!good(head) || digest(head.value.messages.map(linkFacts)) !== digest(newestMessages.map(linkFacts))) return observed("CONTINUATION_HISTORY_CHANGED");
    // An earlier tool-call acknowledgement is evidence, not a terminal response pin.
    if (responseId && responseId !== continuedId) return observed("CONTINUATION_RESPONSE_PIN_CONFLICT", "AMBIGUOUS");
    return finish(reply.value, proof);
  }
  // Re-read the selected identity after pagination; never finalize stale page text.
  const candidate = await read(() => adapter.getMessage(candidateId));
  if (!good(candidate)) return observed("CANDIDATE_READ_UNAVAILABLE");
  if (candidate.value.id !== candidateId || !child(candidate.value, operation)) return observed("CANDIDATE_PARENT_CONFLICT");
  if (!isTerminalMessage(candidate.value)) return observed("CANDIDATE_NOT_TERMINAL");
  return finish(candidate.value);
}
