import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { digest, text, type Json, type Operation } from "./contracts.js";
import type { OperationStore } from "./state-store.js";
import type { AdapterReply, OpenCodeAdapter } from "./opencode-adapter.js";
import { isTerminalMessage, type ReconcileReader } from "./reconcile.js";
import { RouterError, sameDirectory } from "./routing.js";
import { observeOwnerAttention } from "./owner-attention.js";

export interface OwnerFilingRequest {
  operationId: string; expectedInputDigest: string; terminalMessageId: string;
  terminalTextSha256: string; instructionReference: string; ownerDecision: string;
  disposition: "ACCEPT_DOCUMENTATION_FILING"; acknowledgeUnverifiedNativeLineage: true;
  files: Array<{ path: string; sha256: string }>;
}
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function required<T>(reply: AdapterReply<T>): T {
  if (reply.problem || reply.status < 200 || reply.status >= 300 || reply.value === undefined) throw new RouterError("OWNER_FILING_EVIDENCE_UNAVAILABLE");
  return reply.value;
}
function verifyFiles(root: string, files: OwnerFilingRequest["files"]) {
  for (const file of files) {
    const full = path.resolve(root, file.path);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new RouterError("OWNER_FILING_FILE_INVALID");
    // No traversal through links, including ancestors of the execution root.
    for (let current = full; ; current = path.dirname(current)) {
      if (lstatSync(current).isSymbolicLink()) throw new RouterError("OWNER_FILING_FILE_INVALID");
      if (path.dirname(current) === current) break;
    }
    const stat = lstatSync(full);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024 || sha(readFileSync(full)) !== file.sha256) throw new RouterError("OWNER_FILING_FILE_MISMATCH");
  }
}

/** Owner acceptance of documentation only; never a claim of restored native lineage. */
export async function resolveOwnerFiling(store: OperationStore, request: OwnerFilingRequest, reader: ReconcileReader & Partial<Pick<OpenCodeAdapter, "getPendingInteractions">>, apply = true): Promise<Operation> {
  const fields = ["operationId", "expectedInputDigest", "terminalMessageId", "terminalTextSha256", "instructionReference", "ownerDecision", "disposition", "acknowledgeUnverifiedNativeLineage", "files"];
  if (!request || typeof request !== "object" || Object.keys(request).some(k => !fields.includes(k))) throw new RouterError("OWNER_FILING_REQUEST_INVALID");
  for (const key of fields.slice(0, 6)) text(request[key as keyof OwnerFilingRequest]);
  if (request.disposition !== "ACCEPT_DOCUMENTATION_FILING" || request.acknowledgeUnverifiedNativeLineage !== true ||
      !/^[a-f0-9]{64}$/.test(request.expectedInputDigest) || !/^[a-f0-9]{64}$/.test(request.terminalTextSha256) ||
      !Array.isArray(request.files) || request.files.length < 1 || request.files.length > 8) throw new RouterError("OWNER_FILING_REQUEST_INVALID");
  const paths = new Set<string>();
  for (const file of request.files) {
    if (!file || Object.keys(file).some(k => !["path", "sha256"].includes(k)) || typeof file.path !== "string" ||
        !/^(ops|docs|Docs)\/[A-Za-z0-9_./-]+\.md$/.test(file.path) || file.path.split("/").some(p => !p || p === "." || p === "..") ||
        !/^[a-f0-9]{64}$/.test(file.sha256) || paths.has(file.path.toLowerCase())) throw new RouterError("OWNER_FILING_FILE_INVALID");
    paths.add(file.path.toLowerCase());
  }
  const op = store.getOperation(request.operationId), requestDigest = digest(request);
  if (op.completedAt) {
    if (op.outcome?.ownerFiling?.requestDigest === requestDigest && op.outcome.ownerFiling.disposition === request.disposition) return op;
    throw new RouterError("OWNER_FILING_RESULT_CONFLICT");
  }
  if (!op.dispatchStartedAt || !op.acknowledgedAt || op.correlation.rootMessageId !== op.messageId ||
      op.inputDigest !== request.expectedInputDigest || op.action.kind !== "CLARIFICATION" || op.action.command !== "clarification" ||
      op.action.recipientRole !== "Meta" || typeof op.action.input.arguments !== "string" || !op.action.input.arguments.trim()) throw new RouterError("OWNER_FILING_INELIGIBLE");
  const work = store.getWork(op.action.workId);
  const address = op.action.input.address as { directory?: string } | undefined;
  const verify = async () => {
    const session = required(await reader.getSession());
    if (session.id !== op.action.participant.session || session.projectID !== op.action.participant.project || session.parentID || session.reverted ||
        !sameDirectory(session.directory, address?.directory ?? work.context.directory)) throw new RouterError("OWNER_FILING_ADDRESS_MISMATCH");
    if (required(await reader.getStatus()) !== "IDLE" || (await observeOwnerAttention(reader)).state !== "CLEAR") throw new RouterError("OWNER_FILING_NOT_QUIESCENT");
    for (const id of new Set([op.messageId, op.correlation.responseMessageId].filter((id): id is string => !!id))) {
      const original = await reader.getMessage(id);
      if (original.status !== 404 || original.value !== undefined) throw new RouterError("OWNER_FILING_ORIGINAL_NOT_MISSING");
    }
    verifyFiles(work.context.directory, request.files);
  };
  await verify();
  const terminal = required(await reader.getMessage(request.terminalMessageId));
  if (terminal.id !== request.terminalMessageId || terminal.session !== op.action.participant.session || terminal.role !== "assistant" ||
      !isTerminalMessage(terminal) || terminal.error || !terminal.parentId || terminal.parentId === op.messageId ||
      !terminal.text.trim() || sha(terminal.text) !== request.terminalTextSha256 || !Number.isFinite(terminal.timeCreated) ||
      terminal.timeCreated! < Date.parse(op.createdAt)) throw new RouterError("OWNER_FILING_TERMINAL_INVALID");
  const parent = required(await reader.getMessage(terminal.parentId));
  if (parent.id !== terminal.parentId || parent.session !== terminal.session || parent.role !== "user" || parent.parentId || parent.error ||
      parent.hasCompactionPart || parent.autoCompaction || parent.compactionContinue || parent.text !== op.action.input.arguments ||
      !Number.isFinite(parent.timeCreated) || parent.timeCreated! < Date.parse(op.createdAt) || parent.timeCreated! > terminal.timeCreated!) throw new RouterError("OWNER_FILING_PARENT_INVALID");
  const head = required(await reader.getHistory({ limit: 12 }));
  if (head.messages.length > 12 || !head.messages.some(m => m.id === terminal.id) || head.messages.some(m => m.session !== terminal.session ||
      !Number.isFinite(m.timeCreated) || (m.role === "user" && m.id !== parent.id && m.timeCreated! >= parent.timeCreated!) ||
      (m.role === "assistant" && m.id !== terminal.id && (m.timeCreated! >= terminal.timeCreated! || (m.parentId === parent.id && isTerminalMessage(m)))))) throw new RouterError("OWNER_FILING_NEWER_OR_COMPETING_ACTIVITY");
  if (digest(required(await reader.getMessage(terminal.id))) !== digest(terminal) || digest(required(await reader.getMessage(parent.id))) !== digest(parent) ||
      digest(required(await reader.getHistory({ limit: 12 }))) !== digest(head)) throw new RouterError("OWNER_FILING_EVIDENCE_CHANGED");
  await verify();
  if (digest(store.getOperation(op.operationId)) !== digest(op)) throw new RouterError("OWNER_FILING_OPERATION_CHANGED");
  if (!apply) return op;
  return store.finish(op.operationId, {
    execution: "COMPLETED", reason: "OWNER_ACCEPTED_DOCUMENTATION_FILING_UNVERIFIED_LINEAGE",
    artifact: { text: terminal.text, sha256: request.terminalTextSha256 },
    evidenceReferences: [`owner-filing-request-sha256:${requestDigest}`, `owner-filing-terminal-sha256:${request.terminalTextSha256}`],
    ownerFiling: { disposition: request.disposition, requestDigest, request: request as unknown as Json,
      originalCorrelation: op.correlation as unknown as Json, previousObservation: op.observation as unknown as Json,
      nativeLineageRestored: false, exhaustiveHistoryVerified: false, manualContinuationAsserted: false,
      implementationAccepted: false, productAcceptance: false, filingAcceptedByOwner: true,
      evidenceBasis: "EXPLICIT_OWNER_ACCEPTANCE_OF_DOCUMENTATION_WITH_VERIFIED_EXTERNAL_TERMINAL",
      terminal: terminal as unknown as Json, parent: parent as unknown as Json, headDigest: digest(head), workContextDigest: digest(work.context) },
  }, digest(op));
}
