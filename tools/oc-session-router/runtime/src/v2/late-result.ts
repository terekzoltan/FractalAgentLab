import { createHash } from "node:crypto";
import { digest, text, type Json, type Operation, type TerminalOutcome } from "./contracts.js";
import type { AdapterReply, OpenCodeAdapter, OpenCodeMessage } from "./opencode-adapter.js";
import { observeOwnerAttention } from "./owner-attention.js";
import { isTerminalMessage, type ReconcileReader } from "./reconcile.js";
import { RouterError, sameDirectory } from "./routing.js";
import type { OperationStore } from "./state-store.js";

export interface LateResultRequest {
  operationId: string;
  expectedInputDigest: string;
  expectedResultDigest: string;
  rootMessageId: string;
  rootTextSha256: string;
  terminalMessageId: string;
  terminalTextSha256: string;
  instructionReference: string;
  intentVerificationReference: string;
}

export interface LateResultReply {
  /** Original operation for a fresh preflight; separate receipt after attachment. */
  operation: Operation;
  verifiedOnly: boolean;
  attached: boolean;
  verificationPerformed: boolean;
}

type Reader = ReconcileReader & Partial<Pick<OpenCodeAdapter, "getPendingInteractions">>;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function required<T>(reply: AdapterReply<T>): T {
  if (reply.problem || reply.status < 200 || reply.status >= 300 || reply.value === undefined) throw new RouterError("LATE_RESULT_EVIDENCE_UNAVAILABLE");
  return reply.value;
}
function normalRoot(message: OpenCodeMessage): boolean {
  return message.role === "user" && !message.parentId && !message.error && !message.summary &&
    !message.hasCompactionPart && !message.autoCompaction && !message.manualCompaction && !message.compactionContinue &&
    !!message.text.trim() && Number.isFinite(message.timeCreated);
}

/** Bounded GET verification, followed only on apply by a separate local evidence receipt. */
export async function attachLateResult(store: OperationStore, request: LateResultRequest, reader: Reader, apply = true): Promise<LateResultReply> {
  const fields = ["operationId", "expectedInputDigest", "expectedResultDigest", "rootMessageId", "rootTextSha256", "terminalMessageId", "terminalTextSha256", "instructionReference", "intentVerificationReference"];
  if (!request || typeof request !== "object" || Array.isArray(request) || Object.keys(request).some(key => !fields.includes(key)) || typeof apply !== "boolean") throw new RouterError("LATE_RESULT_REQUEST_INVALID");
  for (const key of fields) text(request[key as keyof LateResultRequest]);
  for (const value of [request.expectedInputDigest, request.expectedResultDigest, request.rootTextSha256, request.terminalTextSha256]) {
    if (!/^[a-f0-9]{64}$/.test(value)) throw new RouterError("LATE_RESULT_REQUEST_INVALID");
  }
  const original = store.getOperation(request.operationId), requestDigest = digest(request);
  if (!original.dispatchStartedAt || !original.acknowledgedAt || !original.completedAt || !original.resultDigest ||
      original.correlation.rootMessageId !== original.messageId || original.outcome?.execution !== "FAILED" ||
      original.action.kind !== "LIFECYCLE" || original.action.command !== "terv-review" ||
      original.inputDigest !== request.expectedInputDigest || original.resultDigest !== request.expectedResultDigest ||
      !Number.isFinite(Date.parse(original.completedAt))) throw new RouterError("LATE_RESULT_OPERATION_INELIGIBLE");
  const existing = store.getRecoveredResult(request.operationId);
  if (existing) {
    if (existing.action.kind !== "RECOVERED_RESULT" || existing.outcome?.lateRecovery?.requestDigest !== requestDigest) throw new RouterError("LATE_RESULT_CONFLICT");
    // Idempotency returns retained evidence; it does not claim a fresh live check.
    return { operation: existing, verifiedOnly: false, attached: true, verificationPerformed: false };
  }
  const work = store.getWork(original.action.workId);
  const workDigest = digest({ context: work.context, authorization: work.authorization, paused: work.paused, pauseReference: work.pauseReference });
  const originalDigest = digest(original);
  const address = original.action.input.address as { directory?: string } | undefined;
  const verify = async () => {
    const session = required(await reader.getSession());
    if (session.id !== original.action.participant.session || session.projectID !== original.action.participant.project || session.parentID || session.reverted ||
        !sameDirectory(session.directory, address?.directory ?? work.context.directory)) throw new RouterError("LATE_RESULT_SESSION_MISMATCH");
    if (required(await reader.getStatus()) !== "IDLE" || (await observeOwnerAttention(reader)).state !== "CLEAR") throw new RouterError("LATE_RESULT_NOT_QUIESCENT");
  };
  const readOriginal = async (): Promise<OpenCodeMessage | null> => {
    const reply = await reader.getMessage(original.messageId);
    // A durable delivered failure survives remote root deletion; absence proves no ancestry.
    if (reply.status === 404 && reply.value === undefined) return null;
    const root = required(reply);
    if (root.id !== original.messageId || root.session !== original.action.participant.session || !normalRoot(root)) throw new RouterError("LATE_RESULT_ORIGINAL_ROOT_INVALID");
    return root;
  };
  await verify();
  const originalRoot = await readOriginal();
  const root = required(await reader.getMessage(request.rootMessageId));
  const terminal = required(await reader.getMessage(request.terminalMessageId));
  if (root.id !== request.rootMessageId || root.session !== original.action.participant.session || !normalRoot(root) ||
      sha(root.text) !== request.rootTextSha256 || root.timeCreated! < Date.parse(original.createdAt)) throw new RouterError("LATE_RESULT_ROOT_INVALID");
  if (root.id === original.messageId && (!originalRoot || digest(originalRoot) !== digest(root))) throw new RouterError("LATE_RESULT_EVIDENCE_CHANGED");
  if (terminal.id !== request.terminalMessageId || terminal.session !== original.action.participant.session || terminal.role !== "assistant" ||
      terminal.parentId !== root.id || !isTerminalMessage(terminal) || terminal.error || !terminal.text.trim() ||
      sha(terminal.text) !== request.terminalTextSha256 || !Number.isFinite(terminal.timeCreated) ||
      terminal.timeCreated! < root.timeCreated! || terminal.timeCompleted! < terminal.timeCreated! ||
      terminal.timeCompleted! <= Date.parse(original.completedAt)) throw new RouterError("LATE_RESULT_TERMINAL_INVALID");
  const head = required(await reader.getHistory({ limit: 100 }));
  if (head.messages.length > 100) throw new RouterError("LATE_RESULT_HISTORY_INCOMPLETE");
  const ids = new Set<string>();
  for (const message of head.messages) {
    if (message.session !== original.action.participant.session || ids.has(message.id) || !Number.isFinite(message.timeCreated)) throw new RouterError("LATE_RESULT_HISTORY_AMBIGUOUS");
    ids.add(message.id);
  }
  // The newest contiguous window must include the selected root, so all later activity is covered.
  const headRoot = head.messages.find(message => message.id === root.id);
  const headTerminal = head.messages.find(message => message.id === terminal.id);
  if (!headRoot || !headTerminal) throw new RouterError("LATE_RESULT_HISTORY_INCOMPLETE");
  if (digest(headRoot) !== digest(root) || digest(headTerminal) !== digest(terminal)) throw new RouterError("LATE_RESULT_EVIDENCE_CHANGED");
  if (head.messages.filter(message => message.role === "assistant" && message.parentId === root.id && isTerminalMessage(message) && !message.error).length !== 1 ||
      head.messages.some(message => (message.role === "user" && message.id !== root.id && message.timeCreated! >= root.timeCreated!) ||
        (message.role === "assistant" && message.id !== terminal.id && message.timeCreated! >= terminal.timeCreated!))) throw new RouterError("LATE_RESULT_HISTORY_AMBIGUOUS");
  if (digest(required(await reader.getMessage(root.id))) !== digest(root) || digest(required(await reader.getMessage(terminal.id))) !== digest(terminal) ||
      digest(await readOriginal()) !== digest(originalRoot)) throw new RouterError("LATE_RESULT_EVIDENCE_CHANGED");
  await verify();
  if (digest(required(await reader.getHistory({ limit: 100 }))) !== digest(head)) throw new RouterError("LATE_RESULT_EVIDENCE_CHANGED");
  const currentWork = store.getWork(original.action.workId);
  if (digest(store.getOperation(original.operationId)) !== originalDigest ||
      digest({ context: currentWork.context, authorization: currentWork.authorization, paused: currentWork.paused, pauseReference: currentWork.pauseReference }) !== workDigest) throw new RouterError("LATE_RESULT_SOURCE_CHANGED");
  if (!apply) return { operation: original, verifiedOnly: true, attached: false, verificationPerformed: true };
  const outcome: TerminalOutcome = {
    execution: "COMPLETED", reason: "LATE_REVIEW_EVIDENCE_ATTACHED",
    artifact: { text: terminal.text, sha256: request.terminalTextSha256 },
    evidenceReferences: [`late-result-request-sha256:${requestDigest}`, `late-result-history-sha256:${digest(head)}`],
    lateRecovery: {
      evidenceOnly: true, requestDigest, request: request as unknown as Json,
      originalOperationId: original.operationId, originalInputDigest: original.inputDigest, originalResultDigest: original.resultDigest,
      originalOperationDigest: originalDigest, originalCorrelation: original.correlation as unknown as Json,
      originalExecution: "FAILED", originalCompletedAt: original.completedAt,
      nativeLineageRestored: false, manualContinuationAsserted: false, productAcceptance: false, implementationAccepted: false,
      evidenceBasis: "EXPLICIT_OWNER_MAPPING_OF_VERIFIED_LATE_REVIEW", workDigest,
      sourceProof: {
        root: root as unknown as Json, terminal: terminal as unknown as Json, historyDigest: digest(head),
        originalRootEvidence: originalRoot ? "LIVE_ROOT_AND_DURABLE_ACKNOWLEDGEMENT" : "DURABLE_ACKNOWLEDGEMENT_REMOTE_ROOT_NOT_FOUND",
        rootMatchesOriginal: root.id === original.messageId, boundedHistoryLimit: 100, exhaustiveHistoryVerified: false,
      },
    },
  };
  const operation = store.attachRecoveredResult(original.operationId, requestDigest, outcome, originalDigest, workDigest);
  return { operation, verifiedOnly: false, attached: true, verificationPerformed: true };
}
