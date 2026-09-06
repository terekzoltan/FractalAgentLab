import { createHash } from "node:crypto";
import path from "node:path";
import { canonical, digest, text, type ActionInput, type Json, type TerminalOutcome } from "./contracts.js";
import { readContainedSource, resolveRole, RouterError, sameDirectory, type RouterConfiguration } from "./routing.js";
import { OperationStore } from "./state-store.js";
import { reconcileOperation, type ReconcileReader, type ReconcileResult } from "./reconcile.js";
import type { OpenCodeMessage } from "./opencode-adapter.js";

export interface LegacyImportRequest {
  workId: string;
  legacyRoot: string;
  runId: string;
  operationId: string;
  recipientRole: string;
  pauseReference: string;
}
type ObjectValue = Record<string, unknown>;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const messageId = (value: unknown): value is string => typeof value === "string" && /^msg[\w-]+$/.test(value);
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RouterError("LEGACY_SOURCE_INVALID");
  return value as ObjectValue;
}

/** No network dependency, no old engine dependency, no writes to source records. */
export function importLegacyOperation(store: OperationStore, configuration: RouterConfiguration, request: LegacyImportRequest) {
  for (const value of [request.workId, request.recipientRole, request.pauseReference]) text(value);
  if (!path.isAbsolute(request.legacyRoot) || !/^run-[\w-]+$/.test(request.runId) || !/^op-[\w-]+$/.test(request.operationId)) throw new RouterError("LEGACY_SOURCE_INVALID");
  const work = store.getWork(request.workId);
  const { target, participant } = resolveRole(configuration, work.context.target, request.recipientRole);
  if (!sameDirectory(target.directory, work.context.directory)) throw new RouterError("TARGET_DIRECTORY_MISMATCH");
  const base = `runs/${request.runId}/operations/${request.operationId}`;
  const sources: Array<{ path: string; sha256: string }> = [];
  const read = (relative: string, optional = false) => {
    try {
      const source = readContainedSource(request.legacyRoot, relative);
      sources.push({ path: source.path, sha256: source.sha256 });
      return source;
    } catch (error) {
      if (optional && error instanceof RouterError && error.code === "SOURCE_UNAVAILABLE") return undefined;
      throw error;
    }
  };
  const json = (relative: string, optional = false): ObjectValue | undefined => {
    const source = read(relative, optional);
    if (!source) return undefined;
    try { return object(JSON.parse(source.content.replace(/^\uFEFF/, ""))); }
    catch { throw new RouterError("LEGACY_SOURCE_INVALID"); }
  };
  const run = json(`runs/${request.runId}/run.json`)!;
  const authority = json(`runs/${request.runId}/run-authority.json`)!;
  const record = json(`${base}/operation.json`)!;
  const invocation = object(record.invocation);
  const intent = json(`${base}/intent.json`)!;
  const result = json(`${base}/result.json`, true);
  const receipt = json(`${base}/transport-receipt.json`, true);
  const terminal = read(`${base}/terminal.md`, true);
  if (run.schema_version !== "run.v1" || run.run_id !== request.runId || run.target_id !== work.context.target ||
      record.schema_version !== "operation.v1" || record.operation_id !== request.operationId || record.run_id !== request.runId ||
      invocation.operation_id !== request.operationId || invocation.run_id !== request.runId || invocation.target_id !== work.context.target ||
      intent.schema_version !== "dispatch-intent.v1" || intent.operation_id !== request.operationId ||
      invocation.recipient_role !== request.recipientRole || invocation.recipient_session_sha256 !== sha(participant.session) ||
      intent.recipient_session_sha256 !== invocation.recipient_session_sha256) throw new RouterError("LEGACY_IDENTITY_MISMATCH");
  text(invocation.command_name);
  if (intent.command_name !== invocation.command_name || intent.command_body_sha256 !== invocation.command_body_sha256 ||
      !hash(invocation.command_argument_sha256) || !hash(invocation.command_body_sha256)) throw new RouterError("LEGACY_COMMAND_PROVENANCE_INVALID");
  if (!hash(record.intent_sha256) || record.intent_sha256 !== sha(canonical(intent))) throw new RouterError("LEGACY_SOURCE_CHANGED");
  if (result && (result.schema_version !== "stage-result.v1" || result.operation_id !== request.operationId || result.run_id !== request.runId)) throw new RouterError("LEGACY_IDENTITY_MISMATCH");
  if (!hash(run.run_authority_sha256) || run.run_authority_sha256 !== digest(authority) ||
      authority.run_id !== request.runId || authority.target_id !== work.context.target ||
      !hash(invocation.run_authority_sha256) || invocation.run_authority_sha256 !== intent.authority_sha256) throw new RouterError("LEGACY_AUTHORITY_PROVENANCE_INVALID");
  if (receipt && receipt.session_sha256 !== sha(participant.session)) throw new RouterError("LEGACY_IDENTITY_MISMATCH");
  let outcome: TerminalOutcome | undefined;
  if (result?.operation_status === "SUCCEEDED" && result.output_status === "VALID" && result.binding_status === "BOUND" && result.terminal_status === "VALID") {
    if (!terminal || terminal.sha256 !== result.artifact_sha256) throw new RouterError("LEGACY_ARTIFACT_CHANGED");
    outcome = { execution: "COMPLETED", artifact: { text: terminal.content, sha256: terminal.sha256 },
      evidenceReferences: [`legacy-source:${request.runId}/${request.operationId}:${digest(sources)}`], reason: "LEGACY_ACCEPTED_ARTIFACT" };
  }
  const baseline = intent.baseline ? object(intent.baseline) : undefined;
  const legacy: Record<string, Json> = {
    runId: request.runId, operationId: request.operationId, sourceRoot: path.resolve(request.legacyRoot),
    sources, originalStatus: String(record.status), sourceDigest: digest(sources),
    argumentSha256: invocation.command_argument_sha256, bodySha256: invocation.command_body_sha256,
    baselineMessageId: typeof baseline?.message_id === "string" ? baseline.message_id : null,
    responseMessageSha256: hash(result?.message_id_sha256) ? result.message_id_sha256 : null,
    candidate: typeof invocation.candidate_identity === "string" ? invocation.candidate_identity : null,
    reviewCycle: typeof invocation.review_cycle === "string" ? invocation.review_cycle : null,
    findingIds: Array.isArray(invocation.finding_ids) ? invocation.finding_ids.filter((id): id is string => typeof id === "string") : [],
  };
  const action: ActionInput = { workId: request.workId, actionKey: `legacy:${request.runId}:${request.operationId}`, participant,
    recipientRole: request.recipientRole, kind: "LEGACY", effect: "READ_ONLY", command: invocation.command_name.replace(/^\//, ""), predecessor: null,
    input: { legacy, address: { origin: target.origin, directory: target.directory, session: participant.session }, sources: [] } };
  return store.importLegacy(action, { pauseReference: request.pauseReference, ...(outcome ? { outcome } : {}),
    ...(messageId(receipt?.parent_id) ? { rootMessageId: receipt.parent_id } : {}),
    ...(messageId(receipt?.message_id) ? { responseMessageId: receipt.message_id } : {}) });
}

/** Exact retained V1 argument bytes, not today's command template or output prose. */
function matchesLegacyRoot(message: OpenCodeMessage, command: string, legacy: ObjectValue): boolean {
  if (message.role !== "user" || message.parentId || message.hasCompactionPart) return false;
  const starts = [...message.text.matchAll(/^--- FAL (?:SOURCE 0 |VERIFIED (?:OUTPUT FIELD BINDING|REVIEW ENVELOPE) ---)/gm)].map(match => match.index!);
  const ends = [...message.text.matchAll(/--- END FAL SOURCE \d+ ---/g)].map(match => match.index! + match[0].length);
  // Ordinary V1 packets have few source sections. An unusual input remains unresolved.
  if (starts.length > 32 || ends.length > 64) return false;
  return starts.some(start => ends.some(end => {
    if (end <= start) return false;
    const argument = message.text.slice(start, end);
    return sha(argument) === legacy.argumentSha256 && digest({ command, arguments: argument }) === legacy.bodySha256;
  }));
}

/** Bounded GET-only bootstrap when V1 never stored an actual root ID. */
export async function reconcileLegacyOperation(store: OperationStore, operationId: string, adapter: ReconcileReader): Promise<ReconcileResult> {
  let operation = store.getOperation(operationId);
  if (operation.completedAt) return { operation, disposition: "STORED" };
  if (operation.action.kind !== "LEGACY") throw new RouterError("LEGACY_SOURCE_INVALID");
  if (messageId(operation.messageId)) return reconcileOperation(store, operationId, adapter);
  const legacy = object(operation.action.input.legacy);
  const work = store.getWork(operation.action.workId);
  const fail = (reason: string, disposition: ReconcileResult["disposition"] = "PENDING"): ReconcileResult => ({
    operation: store.observe(operationId, { observedAt: new Date().toISOString(), activity: "UNKNOWN", context: { ...store.getOperation(operationId).observation?.context, reason } }), disposition,
  });
  const session = await adapter.getSession();
  if (session.problem || !session.value) return fail("LEGACY_SESSION_UNAVAILABLE");
  if (session.value.id !== operation.action.participant.session || session.value.projectID !== operation.action.participant.project || !sameDirectory(session.value.directory, work.context.directory)) return fail("LEGACY_SESSION_MISMATCH");
  let cursor = operation.observation?.cursor;
  const oldScan = operation.observation?.context?.legacyScan as { headId?: string; roots?: string[] } | undefined;
  let roots = new Set(oldScan?.roots ?? []);
  let headId: string | undefined;
  let covered = false;
  for (let page = 0; page < 7; page += 1) {
    const reply = await adapter.getHistory({ limit: 40, ...(page === 0 || !cursor ? {} : { before: cursor }) });
    if (reply.problem || !reply.value) return fail("LEGACY_HISTORY_UNAVAILABLE");
    const messages = reply.value.messages;
    if (messages.some(message => message.session !== operation.action.participant.session)) return fail("LEGACY_HISTORY_IDENTITY_MISMATCH");
    if (page === 0) {
      headId = messages.at(-1)?.id;
      if (cursor && oldScan?.headId && !messages.some(message => message.id === oldScan.headId)) { cursor = undefined; roots = new Set(); }
    }
    const baselineIndex = messages.findIndex(message => message.id === legacy.baselineMessageId);
    const relevant = baselineIndex >= 0 ? messages.slice(baselineIndex + 1) : messages;
    for (const message of relevant) {
      if (hash(legacy.responseMessageSha256) && sha(message.id) === legacy.responseMessageSha256 && message.role === "assistant" && messageId(message.parentId)) {
        // The old accepted-result receipt itself binds this response ID; don't
        // confuse a newest assistant summary with the original result.
        operation = store.bindLegacyRoot(operationId, message.parentId);
        store.acknowledge(operationId, { rootMessageId: message.parentId, responseMessageId: message.id });
        return reconcileOperation(store, operationId, adapter);
      }
      if (matchesLegacyRoot(message, operation.action.command, legacy)) roots.add(message.id);
    }
    if (roots.size > 1) return fail("LEGACY_MULTIPLE_MATCHING_ROOTS", "AMBIGUOUS");
    if (baselineIndex >= 0 || (legacy.baselineMessageId === "EMPTY" && !reply.value.nextCursor)) { covered = true; cursor = undefined; break; }
    if (!reply.value.nextCursor) { cursor = undefined; break; }
    if (page !== 0 || !cursor) cursor = reply.value.nextCursor;
  }
  operation = store.observe(operationId, { observedAt: new Date().toISOString(), activity: "UNKNOWN", ...(cursor ? { cursor } : {}),
    context: { ...operation.observation?.context, reason: covered ? "LEGACY_BASELINE_COVERED" : "LEGACY_COVERAGE_INCOMPLETE", legacyScan: { ...(headId ? { headId } : {}), roots: [...roots] } } });
  if (!covered || roots.size !== 1) return { operation, disposition: cursor ? "CONTINUE" : "PENDING", ...(cursor ? { nextCursor: cursor } : {}) };
  store.bindLegacyRoot(operationId, [...roots][0]!);
  return reconcileOperation(store, operationId, adapter);
}
