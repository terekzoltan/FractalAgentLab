import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { digest, StoreError, text, type Json } from "./contracts.js";
import type { OpenCodeAdapter, OpenCodeMessage } from "./opencode-adapter.js";
import { observeOwnerAttention } from "./owner-attention.js";
import { isTerminalMessage } from "./reconcile.js";
import { resolveRole, RouterError, sameDirectory, sessionDirectory, type RouterConfiguration } from "./routing.js";

export interface HandoffRequest {
  project: string;
  handoffKey: string;
  scope: string;
  stoppingPoint: string;
  exclusions: string;
  message: string;
  /** References the actual Owner instruction; this string is NOT human attestation. */
  instructionReference: string;
}
export interface HandoffBoundary {
  headDigest: string;
  selection: { agent: string; providerID: string; modelID: string; variant: string | null };
}
export interface HandoffPreview {
  version: 1;
  handoffId: string;
  request: HandoffRequest;
  requestDigest: string;
  bindingDigest: string;
  boundary: HandoffBoundary;
  createdAt: string;
  expiresAt: string;
  previewDigest: string;
}
type Reader = Pick<OpenCodeAdapter, "getSession" | "getStatus" | "getHistory" | "getMessage" | "getPendingInteractions">;

export function exactFields(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new StoreError("INVALID_INPUT");
}
export function validateHandoffRequest(request: HandoffRequest): void {
  exactFields(request, ["project", "handoffKey", "scope", "stoppingPoint", "exclusions", "message", "instructionReference"]);
  for (const value of Object.values(request)) text(value);
  for (const key of ["project", "handoffKey", "scope", "stoppingPoint", "exclusions", "message", "instructionReference"] as const) text(request[key]);
  if (request.project.length > 128 || request.handoffKey.length > 256 || Buffer.byteLength(request.message, "utf8") > 16_384 ||
      Buffer.byteLength(JSON.stringify(request), "utf8") > 24_576) throw new StoreError("INVALID_INPUT");
}
export function handoffBinding(configuration: RouterConfiguration, project: string, sending = false) {
  text(project);
  const bridge = configuration.orchestratorBridge;
  if (sending && bridge?.enabled !== true) throw new RouterError("HANDOFF_SEND_DISABLED");
  const enrollment = bridge?.projects && Object.hasOwn(bridge.projects, project) ? bridge.projects[project] : undefined;
  if (!enrollment?.instructionReference?.trim() || !enrollment.controlTarget || !enrollment.governedTarget) throw new RouterError("ORCHESTRATOR_NOT_ENROLLED");
  const resolved = resolveRole(configuration, enrollment.controlTarget, enrollment.recipientRole);
  const product = Object.hasOwn(configuration.targets, enrollment.governedTarget) ? configuration.targets[enrollment.governedTarget] : undefined;
  if (resolved.role.capability !== "ORCHESTRATOR" || !product || !path.isAbsolute(product.directory) ||
      !product.project || !product.namespace) throw new RouterError("ORCHESTRATOR_ENROLLMENT_INVALID");
  const home = sessionDirectory(resolved.target, resolved.role);
  const originKey = (origin: string) => {
    try {
      const url = new URL(origin);
      if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
          url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
      return `loopback:${url.port || "80"}`;
    } catch { throw new RouterError("ORCHESTRATOR_ENROLLMENT_INVALID"); }
  };
  const controlOrigin = originKey(resolved.target.origin);
  // The selected control participant may not be aliased under a product lane
  // capability or another namespace: claims must share one canonical identity.
  for (const target of Object.values(configuration.targets)) {
    for (const role of Object.values(target.roles)) {
      if (role.session === resolved.role.session && originKey(target.origin) === controlOrigin &&
          (role.capability !== "ORCHESTRATOR" || target.namespace !== resolved.target.namespace ||
           target.project !== resolved.target.project || !sameDirectory(sessionDirectory(target, role), home))) {
        throw new RouterError("ORCHESTRATOR_ALIAS_CONFLICT");
      }
    }
  }
  return { ...resolved, home, enrollment, bindingDigest: digest({ enrollment, target: resolved.target, product }) };
}

function messageBoundary(message: OpenCodeMessage): Json {
  return { id: message.id, parentId: message.parentId ?? null, role: message.role,
    created: message.timeCreated ?? null, completed: message.timeCompleted ?? null, finish: message.finish ?? null,
    error: message.error ?? false, summary: message.summary ?? false, compact: message.hasCompactionPart,
    autoCompact: message.autoCompaction ?? false, continuation: message.compactionContinue ?? false,
    agent: message.agent ?? null, providerID: message.providerID ?? null, modelID: message.modelID ?? null,
    variant: message.variant ?? null, textDigest: digest(message.text) };
}

/** Bounded GETs, no store writes. No attempt to infer an unavailable selection. */
export async function inspectHandoffBoundary(reader: Reader, expected: { session: string; project: string; directory: string }): Promise<HandoffBoundary> {
  const session = await reader.getSession();
  if (session.problem || session.value?.id !== expected.session || session.value.projectID !== expected.project ||
      !sameDirectory(session.value.directory, expected.directory) || session.value.parentID) throw new RouterError("PARTICIPANT_IDENTITY_MISMATCH");
  if (session.value.reverted) throw new RouterError("HANDOFF_SESSION_REVERTED");
  const status = await reader.getStatus();
  if (status.problem || !status.value || status.value === "UNKNOWN") throw new RouterError("SESSION_ACTIVITY_UNAVAILABLE");
  if (status.value !== "IDLE") throw new RouterError("PARTICIPANT_BUSY");
  const attention = await observeOwnerAttention(reader);
  if (attention.state !== "CLEAR") throw new RouterError(attention.state === "WAITING_FOR_OWNER" ? "HANDOFF_OWNER_ATTENTION" : "HANDOFF_ATTENTION_UNAVAILABLE");
  const page = await reader.getHistory({ limit: 12 });
  if (page.problem || !page.value || page.value.messages.length > 12 ||
      page.value.messages.some(message => message.session !== expected.session)) throw new RouterError("HANDOFF_HEAD_UNAVAILABLE");
  const messages = page.value.messages;
  const head = messages.at(-1);
  let user = [...messages].reverse().find(message => message.role === "user");
  // Long completed turns may place their root outside the newest page. Retrieve
  // that exact parent once; never scan older history or infer it from prose.
  if (!user && head?.role === "assistant" && head.parentId?.startsWith("msg")) {
    const root = await reader.getMessage(head.parentId);
    if (!root.problem && root.value?.id === head.parentId && root.value.session === expected.session &&
        root.value.role === "user" && root.value.parentId === undefined) user = root.value;
  }
  // Last assistant-call success is not enough: the head must terminate the latest
  // normal user turn. An unavailable exact parent remains explicitly unavailable.
  if (!head || !user || head.role !== "assistant" || !isTerminalMessage(head) || head.error ||
      head.parentId !== user.id || user.hasCompactionPart || user.compactionContinue || head.summary) throw new RouterError("HANDOFF_TURN_NOT_QUIESCENT");
  const turn = messages.slice(Math.max(0, messages.indexOf(user)));
  if (turn.some(message => message.hasCompactionPart || message.summary || message.error)) throw new RouterError("HANDOFF_TURN_NOT_QUIESCENT");
  if (!user.agent?.trim() || !user.providerID?.trim() || !user.modelID?.trim()) throw new RouterError("HANDOFF_SELECTION_UNAVAILABLE");
  const selection = { agent: user.agent, providerID: user.providerID, modelID: user.modelID, variant: user.variant ?? null };
  if (head.providerID && head.providerID !== selection.providerID || head.modelID && head.modelID !== selection.modelID ||
      head.agent && head.agent !== selection.agent || head.variant && head.variant !== selection.variant) throw new RouterError("HANDOFF_SELECTION_CONFLICT");
  // Catch a head change during observation; no UI-draft visibility is claimed.
  const confirmed = await reader.getHistory({ limit: 12 });
  const pageDigest = digest(messages.map(messageBoundary));
  const headDigest = digest([pageDigest, messageBoundary(user)]);
  if (confirmed.problem || !confirmed.value || digest(confirmed.value.messages.map(messageBoundary)) !== pageDigest) throw new RouterError("HANDOFF_STALE_PREVIEW");
  // The parent may have been fetched separately; protect selection from edits.
  const confirmedRoot = await reader.getMessage(user.id);
  if (confirmedRoot.problem || !confirmedRoot.value || digest(messageBoundary(confirmedRoot.value)) !== digest(messageBoundary(user))) throw new RouterError("HANDOFF_STALE_PREVIEW");
  const finalStatus = await reader.getStatus();
  if (finalStatus.problem || finalStatus.value !== "IDLE") throw new RouterError("PARTICIPANT_BUSY");
  return { headDigest, selection };
}

function previewPath(stateRoot: string, id: string): string {
  if (!path.isAbsolute(stateRoot) || !/^handoff-[a-f0-9]{64}$/.test(id)) throw new StoreError("INVALID_INPUT");
  const full = path.join(stateRoot, "handoff-previews", `${id}.json`);
  for (let current = full; ; current = path.dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new RouterError("HANDOFF_STORAGE_UNSAFE");
    if (path.dirname(current) === current) break;
  }
  return full;
}
export function handoffId(request: HandoffRequest): string { return `handoff-${digest([request.project, request.handoffKey])}`; }
export function renderHandoff(request: HandoffRequest): string {
  return `${request.message}\n\nApproved scope: ${request.scope}\nStopping point: ${request.stoppingPoint}\nExclusions: ${request.exclusions}\nOwner instruction reference: ${request.instructionReference}\nUse the current fal-orchestrate-target skill. Record downstream work authority normally; this handoff does not amend or unpause an existing work.`;
}
export function readHandoffPreview(stateRoot: string, id: string): HandoffPreview {
  const file = previewPath(stateRoot, id);
  let preview: HandoffPreview;
  try {
    if (lstatSync(file).size > 48_000) throw new Error();
    preview = JSON.parse(readFileSync(file, "utf8")) as HandoffPreview;
  } catch { throw new RouterError("HANDOFF_PREVIEW_UNAVAILABLE"); }
  validatePreview(preview);
  if (preview.handoffId !== id) throw new RouterError("HANDOFF_PREVIEW_INVALID");
  return preview;
}
export function validatePreview(preview: HandoffPreview): void {
  exactFields(preview, ["version", "handoffId", "request", "requestDigest", "bindingDigest", "boundary", "createdAt", "expiresAt", "previewDigest"]);
  validateHandoffRequest(preview.request);
  const { previewDigest, ...body } = preview;
  if (preview.version !== 1 || preview.handoffId !== handoffId(preview.request) ||
      preview.requestDigest !== digest(preview.request) || digest(body) !== previewDigest ||
      !Number.isFinite(Date.parse(preview.createdAt)) || Date.parse(preview.expiresAt) - Date.parse(preview.createdAt) !== 600_000) throw new RouterError("HANDOFF_PREVIEW_INVALID");
}
export function existingPreview(stateRoot: string, request: HandoffRequest): HandoffPreview | undefined {
  validateHandoffRequest(request);
  const id = handoffId(request);
  if (!existsSync(previewPath(stateRoot, id))) return undefined;
  const previous = readHandoffPreview(stateRoot, id);
  if (previous.requestDigest !== digest(request)) throw new StoreError("INPUT_CONFLICT");
  return previous;
}
export function savePreview(stateRoot: string, request: HandoffRequest, bindingDigest: string, boundary: HandoffBoundary): HandoffPreview {
  const previous = existingPreview(stateRoot, request);
  if (previous) return previous;
  const now = Date.now();
  const body = { version: 1 as const, handoffId: handoffId(request), request, requestDigest: digest(request), bindingDigest, boundary,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 600_000).toISOString() };
  const preview = { ...body, previewDigest: digest(body) };
  const file = previewPath(stateRoot, preview.handoffId);
  const serialized = JSON.stringify(preview);
  if (Buffer.byteLength(serialized, "utf8") > 48_000) throw new StoreError("INVALID_INPUT");
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try { writeFileSync(file, serialized, { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new RouterError("HANDOFF_PREVIEW_WRITE_FAILED");
    return existingPreview(stateRoot, request)!;
  }
  return preview;
}
export function assertPreviewCurrent(preview: HandoffPreview, bindingDigest: string, boundary: HandoffBoundary): void {
  validatePreview(preview);
  if (Date.now() > Date.parse(preview.expiresAt) || Date.now() < Date.parse(preview.createdAt) ||
      preview.bindingDigest !== bindingDigest || digest(preview.boundary) !== digest(boundary)) throw new RouterError("HANDOFF_STALE_PREVIEW");
}
