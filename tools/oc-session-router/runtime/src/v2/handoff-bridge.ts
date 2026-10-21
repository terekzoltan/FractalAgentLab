import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { OperationStore } from "./state-store.js";
import { RouterEngine } from "./engine.js";
import { OpenCodeAdapter, type OpenCodeCredentials } from "./opencode-adapter.js";
import { RouterError, type RouterConfiguration } from "./routing.js";
import { StoreError } from "./contracts.js";
import { operationView, retainExecutor } from "./cli.js";
import { exactFields, existingPreview, handoffBinding, inspectHandoffBoundary, readHandoffPreview, renderHandoff, savePreview,
  validateHandoffRequest, type HandoffRequest, type HandoffPreview } from "./orchestrator-handoff.js";

export type HandoffTool = "inspect_orchestrator" | "prepare_handoff" | "send_handoff" | "inspect_handoff" | "reconcile_handoff";
export const handoffTools: HandoffTool[] = ["inspect_orchestrator", "prepare_handoff", "send_handoff", "inspect_handoff", "reconcile_handoff"];
function previewView(preview: HandoffPreview) {
  return { handoffId: preview.handoffId, project: preview.request.project, scope: preview.request.scope,
    stoppingPoint: preview.request.stoppingPoint, exclusions: preview.request.exclusions,
    instructionReference: preview.request.instructionReference, exactMessage: renderHandoff(preview.request),
    selection: preview.boundary.selection, selectionBasis: "LAST_COMPLETED_NORMAL_USER_TURN_NOT_UI_SELECTION",
    manualCompactCompleted: preview.boundary.manualCompactCompleted === true,
    previewDigest: preview.previewDigest, expiresAt: preview.expiresAt,
    remoteSendPerformedByThisCall: false, previewOnlyCall: true,
    hostApprovalRequiredForSend: true, authorityAttestedByServer: false };
}
function credentials(): OpenCodeCredentials {
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (!password) throw new RouterError("CREDENTIALS_UNAVAILABLE");
  return { username: process.env.OPENCODE_SERVER_USERNAME || "opencode", password };
}
function configuration(file: string): RouterConfiguration {
  try {
    const config = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as RouterConfiguration;
    if (config.schemaVersion !== 2 || !config.targets) throw new Error();
    return config;
  } catch { throw new RouterError("CONFIGURATION_UNAVAILABLE"); }
}
function existingOperation(store: OperationStore, preview: HandoffPreview) {
  try {
    const operation = store.getWork(preview.handoffId).operations.find(item => item.action.actionKey === "handoff");
    if (operation && (operation.action.kind !== "ORCHESTRATOR_HANDOFF" || operation.action.input.previewDigest !== preview.previewDigest)) throw new StoreError("INPUT_CONFLICT");
    return operation;
  } catch (error) { if (error instanceof StoreError && error.code === "NOT_FOUND") return undefined; throw error; }
}

/** Narrow facade only. Dispatch/recovery remain in RouterEngine and its one store. */
export async function callHandoffTool(tool: HandoffTool, args: unknown, stateRoot: string, configPath: string): Promise<unknown> {
  if (!path.isAbsolute(stateRoot) || !path.isAbsolute(configPath)) throw new StoreError("INVALID_INPUT");
  if (tool === "inspect_orchestrator" || tool === "prepare_handoff") {
    exactFields(args, tool === "inspect_orchestrator" ? ["project"] :
      ["project", "handoffKey", "scope", "stoppingPoint", "exclusions", "message", "instructionReference"]);
    const request = args as unknown as HandoffRequest;
    if (tool === "prepare_handoff") {
      validateHandoffRequest(request);
      const previous = existingPreview(stateRoot, request);
      if (previous) return previewView(previous);
    }
    const config = configuration(configPath);
    const binding = handoffBinding(config, String(args.project ?? ""));
    const adapter = new OpenCodeAdapter({ origin: binding.target.origin, directory: binding.home, session: binding.role.session }, credentials(), { getBudgetMs: 20_000 });
    const boundary = await inspectHandoffBoundary(adapter, { session: binding.role.session, project: binding.target.project, directory: binding.home });
    if (tool === "inspect_orchestrator") return { project: args.project, identityVerified: true, activity: "IDLE",
      ownerAttention: "CLEAR", completedLatestTurn: true, selection: boundary.selection,
      manualCompactCompleted: boundary.manualCompactCompleted === true,
      selectionBasis: "LAST_COMPLETED_NORMAL_USER_TURN_NOT_UI_SELECTION", observedAt: new Date().toISOString(),
      sendEnabled: config.orchestratorBridge?.enabled === true, browserDraftVisibility: false, remoteMutation: false };
    return previewView(savePreview(stateRoot, request, binding.bindingDigest, boundary));
  }
  if (!["send_handoff", "inspect_handoff", "reconcile_handoff"].includes(tool)) throw new RouterError("HANDOFF_TOOL_UNSUPPORTED");
  exactFields(args, ["handoffId"]);
  const preview = readHandoffPreview(stateRoot, String(args.handoffId ?? ""));
  const database = path.join(stateRoot, "router.sqlite");
  // Retained inspection and dispatched duplicates do not require today's routing,
  // credentials or enabled switch and do not open a writer.
  if (existsSync(database)) {
    const reader = new OperationStore(database, { readOnly: true });
    try {
      const old = existingOperation(reader, preview);
      if (tool === "inspect_handoff") return old ? { handoffId: preview.handoffId, ...operationView(old) }
        : { handoffId: preview.handoffId, delivery: "NOT_SENT", execution: "PREVIEW_ONLY", autoAdvance: false };
      if (tool === "send_handoff" && old && (old.dispatchStartedAt || old.completedAt)) return { handoffId: preview.handoffId, ...operationView(old), created: false };
    } finally { reader.close(); }
  } else if (tool === "inspect_handoff") return { handoffId: preview.handoffId, delivery: "NOT_SENT", execution: "PREVIEW_ONLY", autoAdvance: false };
  const config = configuration(configPath);
  if (tool === "send_handoff") handoffBinding(config, preview.request.project, true);
  const store = new OperationStore(database);
  try {
    const old = existingOperation(store, preview);
    if (tool === "send_handoff" && old && (old.dispatchStartedAt || old.completedAt)) return { handoffId: preview.handoffId, ...operationView(old), created: false };
    if (tool === "reconcile_handoff" && !old) throw new RouterError("HANDOFF_NOT_SUBMITTED");
    const engine = new RouterEngine(store, config, credentials());
    if (tool === "reconcile_handoff") return { handoffId: preview.handoffId, ...operationView((await engine.reconcile(old!.operationId)).operation), remoteMutation: false, localEvidenceMutation: true };
    const prepared = await engine.prepareHandoff(preview);
    await retainExecutor(stateRoot, configPath, prepared.operation.operationId);
    return { handoffId: preview.handoffId, ...operationView(store.getOperation(prepared.operation.operationId)), created: prepared.created, executorRequested: true };
  } finally { store.close(); }
}
