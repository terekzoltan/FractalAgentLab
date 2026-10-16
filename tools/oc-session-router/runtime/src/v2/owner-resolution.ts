import { createHash } from "node:crypto";
import { digest, text, type Json, type Operation } from "./contracts.js";
import { isTerminalMessage, type ReconcileReader } from "./reconcile.js";
import type { AdapterReply } from "./opencode-adapter.js";
import type { OperationStore } from "./state-store.js";
import { RouterError, sameDirectory } from "./routing.js";

export interface OwnerStoppedRequest {
  operationId: string; expectedInputDigest: string; terminalMessageId: string;
  terminalTextSha256: string; instructionReference: string; ownerDecision: string;
  disposition: "STOPPED_BEFORE_IMPLEMENTATION"; acknowledgeUnverifiedNativeLineage: true;
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function required<T>(r: AdapterReply<T>): T {
  if (r.problem || r.status < 200 || r.status >= 300 || r.value === undefined) throw new RouterError("OWNER_RESOLUTION_EVIDENCE_UNAVAILABLE");
  return r.value;
}

/** Explicit negative Owner disposition, NOT native recovery or successful adoption. */
export async function resolveOwnerStopped(store: OperationStore, request: OwnerStoppedRequest, adapter: ReconcileReader): Promise<Operation> {
  const fields = ["operationId", "expectedInputDigest", "terminalMessageId", "terminalTextSha256", "instructionReference", "ownerDecision", "disposition", "acknowledgeUnverifiedNativeLineage"];
  if (!request || typeof request !== "object" || Object.keys(request).some(k => !fields.includes(k))) throw new RouterError("OWNER_RESOLUTION_REQUEST_INVALID");
  for (const key of fields.slice(0, 6)) text(request[key as keyof OwnerStoppedRequest]);
  if (request.disposition !== "STOPPED_BEFORE_IMPLEMENTATION" || request.acknowledgeUnverifiedNativeLineage !== true ||
      !/^[a-f0-9]{64}$/.test(request.expectedInputDigest) || !/^[a-f0-9]{64}$/.test(request.terminalTextSha256)) throw new RouterError("OWNER_RESOLUTION_REQUEST_INVALID");
  const op = store.getOperation(request.operationId), requestDigest = digest(request);
  if (op.completedAt) {
    if (op.outcome?.ownerResolution?.requestDigest === requestDigest) return op;
    throw new RouterError("OWNER_RESOLUTION_RESULT_CONFLICT");
  }
  if (!op.dispatchStartedAt || !op.acknowledgedAt || op.correlation.rootMessageId !== op.messageId ||
      op.inputDigest !== request.expectedInputDigest || op.action.kind !== "LIFECYCLE" || op.action.command !== "implement") throw new RouterError("OWNER_RESOLUTION_INELIGIBLE");
  const address = op.action.input.address as { directory?: string } | undefined;
  const work = store.getWork(op.action.workId);
  const verify = async () => {
    const s = required(await adapter.getSession());
    if (s.id !== op.action.participant.session || s.projectID !== op.action.participant.project ||
        !sameDirectory(s.directory, address?.directory ?? work.context.directory)) throw new RouterError("OWNER_RESOLUTION_ADDRESS_MISMATCH");
    if (required(await adapter.getStatus()) !== "IDLE") throw new RouterError("OWNER_RESOLUTION_NOT_IDLE");
    for (const id of new Set([op.messageId, op.correlation.responseMessageId].filter((v): v is string => !!v))) {
      const r = await adapter.getMessage(id);
      if (r.status !== 404 || r.value !== undefined) throw new RouterError("OWNER_RESOLUTION_ORIGINAL_NOT_MISSING");
    }
  };
  await verify();
  const terminal = required(await adapter.getMessage(request.terminalMessageId));
  if (terminal.id !== request.terminalMessageId || terminal.session !== op.action.participant.session || terminal.role !== "assistant" ||
      !isTerminalMessage(terminal) || terminal.error || !terminal.parentId || terminal.parentId === op.messageId ||
      !terminal.text.trim() || sha(terminal.text) !== request.terminalTextSha256 ||
      !Number.isFinite(terminal.timeCreated) || terminal.timeCreated! < Date.parse(op.createdAt)) throw new RouterError("OWNER_RESOLUTION_TERMINAL_INVALID");
  const parent = required(await adapter.getMessage(terminal.parentId));
  if (parent.id !== terminal.parentId || parent.session !== terminal.session || parent.role !== "user" || parent.parentId ||
      parent.hasCompactionPart || parent.autoCompaction || parent.compactionContinue || !parent.text.trim() ||
      !Number.isFinite(parent.timeCreated) || parent.timeCreated! < Date.parse(op.createdAt) || parent.timeCreated! > terminal.timeCreated!) throw new RouterError("OWNER_RESOLUTION_PARENT_INVALID");
  const head = required(await adapter.getHistory({ limit: 12 }));
  if (!head.messages.some(m => m.id === terminal.id) || head.messages.some(m => m.session !== terminal.session ||
      !Number.isFinite(m.timeCreated) || (m.role === "user" && m.id !== parent.id && m.timeCreated! >= parent.timeCreated!) ||
      (m.role === "assistant" && m.id !== terminal.id && m.timeCreated! > terminal.timeCreated!))) throw new RouterError("OWNER_RESOLUTION_NEWER_ACTIVITY");
  if (digest(required(await adapter.getMessage(terminal.id))) !== digest(terminal) ||
      digest(required(await adapter.getMessage(parent.id))) !== digest(parent) ||
      digest(required(await adapter.getHistory({ limit: 12 }))) !== digest(head)) throw new RouterError("OWNER_RESOLUTION_EVIDENCE_CHANGED");
  await verify();
  return store.finish(op.operationId, {
    execution: "FAILED", reason: "OWNER_RESOLVED_STOPPED_BEFORE_IMPLEMENTATION",
    artifact: { text: terminal.text, sha256: request.terminalTextSha256 },
    evidenceReferences: [`owner-resolution-request-sha256:${requestDigest}`, `owner-resolution-terminal-sha256:${request.terminalTextSha256}`],
    ownerResolution: {
      requestDigest, request: request as unknown as Json, originalCorrelation: op.correlation as unknown as Json,
      previousObservation: op.observation as unknown as Json, nativeLineageRestored: false, implementationAccepted: false,
      exhaustiveHistoryVerified: false, evidenceBasis: "EXPLICIT_OWNER_DECISION_WITH_VERIFIED_EXTERNAL_TERMINAL",
      terminal: terminal as unknown as Json, parent: parent as unknown as Json, headDigest: digest(head), workContextDigest: digest(work.context),
    },
  }, digest(op));
}
