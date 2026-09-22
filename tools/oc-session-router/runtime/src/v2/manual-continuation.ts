import { createHash } from "node:crypto";
import { digest, text, type Json, type Operation } from "./contracts.js";
import type { OpenCodeMessage, AdapterReply } from "./opencode-adapter.js";
import { isTerminalMessage, type ReconcileReader } from "./reconcile.js";
import { RouterError, sameDirectory } from "./routing.js";
import type { OperationStore } from "./state-store.js";

export interface ManualContinuationRequest {
  operationId: string;
  expectedInputDigest: string;
  manualRootMessageId: string;
  manualRootTextSha256: string;
  terminalMessageId: string;
  terminalTextSha256: string;
  instructionReference: string;
  intentVerificationReference: string;
}
export const textSha256 = (value: string) => createHash("sha256").update(value).digest("hex");
function requireValue<T>(reply: AdapterReply<T>): T {
  if (reply.problem || reply.status < 200 || reply.status >= 300 || reply.value === undefined) throw new RouterError("MANUAL_EVIDENCE_UNAVAILABLE");
  return reply.value;
}

/** GET-only remote verification; one local append-only result transaction. */
export async function adoptManualContinuation(store: OperationStore, request: ManualContinuationRequest, adapter: ReconcileReader): Promise<Operation> {
  const fields = ["operationId", "expectedInputDigest", "manualRootMessageId", "manualRootTextSha256", "terminalMessageId", "terminalTextSha256", "instructionReference", "intentVerificationReference"];
  if (!request || typeof request !== "object" || Object.keys(request).some(key => !fields.includes(key))) throw new RouterError("MANUAL_REQUEST_INVALID");
  for (const key of fields) text(request[key as keyof ManualContinuationRequest]);
  for (const value of [request.expectedInputDigest, request.manualRootTextSha256, request.terminalTextSha256]) if (!/^[a-f0-9]{64}$/.test(value)) throw new RouterError("MANUAL_REQUEST_INVALID");
  const operation = store.getOperation(request.operationId);
  const requestDigest = digest(request);
  if (operation.completedAt) {
    if (operation.outcome?.manualRecovery?.requestDigest === requestDigest) return operation;
    throw new RouterError("MANUAL_RESULT_CONFLICT");
  }
  if (!operation.dispatchStartedAt || !operation.acknowledgedAt || operation.correlation.rootMessageId !== operation.messageId ||
      operation.inputDigest !== request.expectedInputDigest || !["LIFECYCLE", "CLARIFICATION", "RESTORE"].includes(operation.action.kind)) throw new RouterError("MANUAL_OPERATION_INELIGIBLE");
  const address = operation.action.input.address as { directory?: string } | undefined;
  const work = store.getWork(operation.action.workId);
  const verify = async () => {
    const session = requireValue(await adapter.getSession());
    if (session.id !== operation.action.participant.session || session.projectID !== operation.action.participant.project ||
        !sameDirectory(session.directory, address?.directory ?? work.context.directory)) throw new RouterError("MANUAL_SESSION_MISMATCH");
    if (requireValue(await adapter.getStatus()) !== "IDLE") throw new RouterError("MANUAL_SESSION_NOT_IDLE");
  };
  const scan = async (): Promise<OpenCodeMessage[]> => {
    const messages: OpenCodeMessage[] = [], seen = new Set<string>(), cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const history = requireValue(await adapter.getHistory({ limit: 100, ...(cursor ? { before: cursor } : {}) }));
      for (const message of history.messages) {
        if (message.session !== operation.action.participant.session || seen.has(message.id)) throw new RouterError("MANUAL_HISTORY_AMBIGUOUS");
        seen.add(message.id); messages.push(message);
      }
      if (seen.has(operation.messageId)) return messages;
      if (!history.nextCursor) return messages;
      if (cursors.has(history.nextCursor)) break;
      cursor = history.nextCursor; cursors.add(cursor);
    }
    throw new RouterError("MANUAL_HISTORY_INCOMPLETE");
  };
  await verify();
  const first = await scan();
  const original = first.find(m => m.id === operation.messageId);
  const originalRead = await adapter.getMessage(operation.messageId);
  // Explicit Owner adoption can use an immutable delivered request whose remote
  // root was removed. This is NOT native correlation: preserve that limitation.
  // An unavailable server or a live root missing from the scan is not equivalent.
  const originalUnavailable = !original && originalRead.status === 404 && originalRead.value === undefined;
  if (!originalUnavailable && (!original || digest(requireValue(originalRead)) !== digest(original))) throw new RouterError("MANUAL_ORIGINAL_ROOT_UNVERIFIED");
  const root = first.find(m => m.id === request.manualRootMessageId);
  const terminal = first.find(m => m.id === request.terminalMessageId);
  if ((original && (original.role !== "user" || original.parentId)) || !root || root.id === operation.messageId || root.role !== "user" || root.parentId ||
      root.hasCompactionPart || root.compactionContinue || root.autoCompaction || !root.text.trim() ||
      !Number.isFinite(root.timeCreated) || (original ? !Number.isFinite(original.timeCreated) || root.timeCreated! <= original.timeCreated! : root.timeCreated! <= Date.parse(operation.createdAt)) ||
      textSha256(root.text) !== request.manualRootTextSha256) throw new RouterError("MANUAL_ROOT_MISMATCH");
  if (!terminal || terminal.role !== "assistant" || terminal.parentId !== root.id || !isTerminalMessage(terminal) || terminal.error ||
      !terminal.text.trim() || textSha256(terminal.text) !== request.terminalTextSha256 ||
      !Number.isFinite(terminal.timeCreated) || terminal.timeCreated! < root.timeCreated! || terminal.timeCompleted! < terminal.timeCreated!) throw new RouterError("MANUAL_TERMINAL_MISMATCH");
  // No guessing between competing successful originals or manual continuations.
  if (first.some(m => m.role === "assistant" && m.parentId === operation.messageId && isTerminalMessage(m) && !m.error) ||
      first.filter(m => m.role === "assistant" && m.parentId === root.id && isTerminalMessage(m) && !m.error).length !== 1 ||
      first.some(m => m.role === "user" && m.id !== root.id && (!Number.isFinite(m.timeCreated) || m.timeCreated! >= root.timeCreated!))) throw new RouterError("MANUAL_HISTORY_AMBIGUOUS");
  const second = await scan();
  if (digest(first) !== digest(second)) throw new RouterError("MANUAL_HISTORY_CHANGED");
  for (const message of [...(original ? [original] : []), root, terminal]) if (digest(requireValue(await adapter.getMessage(message.id))) !== digest(message)) throw new RouterError("MANUAL_HISTORY_CHANGED");
  if (originalUnavailable) {
    const currentRoot = await adapter.getMessage(operation.messageId);
    if (currentRoot.status !== 404 || currentRoot.value !== undefined) throw new RouterError("MANUAL_HISTORY_CHANGED");
  }
  await verify();
  const head = requireValue(await adapter.getHistory({ limit: 100 }));
  if (digest(head.messages) !== digest(first.slice(0, head.messages.length))) throw new RouterError("MANUAL_HISTORY_CHANGED");
  // Caller attests meaning within the Owner envelope; the router verifies identity,
  // not plan acceptance, findings or semantic equivalence using string heuristics.
  return store.finish(request.operationId, {
    execution: "COMPLETED", reason: "MANUAL_CONTINUATION_ADOPTED",
    artifact: { text: terminal.text, sha256: request.terminalTextSha256 },
    evidenceReferences: [`manual-continuation-request-sha256:${requestDigest}`, `manual-history-sha256:${digest(first)}`],
    manualRecovery: {
      requestDigest, request: request as unknown as Json,
      originalMessageId: operation.messageId, inputDigest: operation.inputDigest,
      originalCorrelation: operation.correlation as unknown as Json,
      previousObservation: operation.observation as unknown as Json,
      manualRoot: root as unknown as Json, terminal: terminal as unknown as Json,
      workContextDigest: digest(work.context), historyDigest: digest(first),
      originalRootEvidence: originalUnavailable ? "DURABLE_ACKNOWLEDGEMENT_REMOTE_ROOT_NOT_FOUND" : "LIVE_ROOT_AND_DURABLE_ACKNOWLEDGEMENT",
    },
  }, digest(operation));
}
