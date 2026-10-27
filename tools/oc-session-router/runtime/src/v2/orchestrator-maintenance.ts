import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonical, digest, StoreError, text, type Json } from "./contracts.js";
import { type OperationStore } from "./state-store.js";
import { readContainedSource, RouterError, sameDirectory, type RouterConfiguration, type TargetBinding } from "./routing.js";
import { exactFields, handoffBinding, type HandoffBoundary } from "./orchestrator-handoff.js";

export interface MaintenanceRequest {
  project: string;
  maintenanceKey: string;
  mode: "compact_restore" | "restore";
  instructionReference: string;
  packet: { frontiers: { workId: string; statePath?: string; combinedPath?: string }[]; note?: string };
}
export interface MaintenancePreview {
  version: 1;
  maintenanceId: string;
  request: MaintenanceRequest;
  requestDigest: string;
  bindingDigest: string;
  boundary: HandoffBoundary;
  frontier: Json;
  frontierDigest: string;
  exactRestoreMessage: string;
  createdAt: string;
  expiresAt: string;
  previewDigest: string;
}

export function validateMaintenanceRequest(r: MaintenanceRequest): void {
  exactFields(r, ["project", "maintenanceKey", "mode", "instructionReference", "packet"]);
  text(r.project); text(r.maintenanceKey); text(r.instructionReference);
  if (!["compact_restore", "restore"].includes(r.mode)) throw new StoreError("INVALID_INPUT");
  exactFields(r.packet, ["frontiers", "note"]);
  if (!Array.isArray(r.packet.frontiers) || r.packet.frontiers.length < 1 || r.packet.frontiers.length > 8) throw new StoreError("INVALID_INPUT");
  const ids = new Set<string>();
  for (const f of r.packet.frontiers) {
    exactFields(f, ["workId", "statePath", "combinedPath"]); text(f.workId);
    if (ids.has(f.workId)) throw new StoreError("INVALID_INPUT"); ids.add(f.workId);
    for (const p of [f.statePath, f.combinedPath]) if (p !== undefined && (typeof p !== "string" || !p.endsWith(".md") || path.isAbsolute(p) || p.split(/[\\/]/).some(s => s === ".." || s === "." || s === ""))) throw new StoreError("INVALID_INPUT");
  }
  if (r.packet.note !== undefined && (typeof r.packet.note !== "string" || Buffer.byteLength(r.packet.note) > 4096)) throw new StoreError("INVALID_INPUT");
  if (r.project.length > 128 || r.maintenanceKey.length > 256 || Buffer.byteLength(JSON.stringify(r)) > 12_288) throw new StoreError("INVALID_INPUT");
}

/** An explicit operator-owned source for product frontier lookup only. Never
 * merged into bridge enrollment or passed to the send/compact binding resolver. */
function frontierTargets(config: RouterConfiguration): { targets: Record<string, TargetBinding>; source: string; referenceDigest: string | null } {
  const file = config.orchestratorBridge?.frontierConfigurationPath;
  if (file === undefined) return { targets: config.targets, source: "BRIDGE_CONFIGURATION", referenceDigest: null };
  if (typeof file !== "string" || !path.isAbsolute(file) || file.includes("\0")) throw new RouterError("MAINTENANCE_FRONTIER_CONFIG_UNSAFE");
  for (let p = file; ; p = path.dirname(p)) {
    if (existsSync(p) && lstatSync(p).isSymbolicLink()) throw new RouterError("MAINTENANCE_FRONTIER_CONFIG_UNSAFE");
    if (p === path.dirname(p)) break;
  }
  try {
    const info = lstatSync(file);
    if (!info.isFile() || info.size > 4 * 1024 * 1024) throw new Error();
    const external = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as RouterConfiguration;
    if (external.schemaVersion !== 2 || !external.targets || typeof external.targets !== "object" || Array.isArray(external.targets)) throw new Error();
    return { targets: external.targets, source: "EXPLICIT_FRONTIER_CONFIGURATION", referenceDigest: digest(path.resolve(file)) };
  } catch { throw new RouterError("MAINTENANCE_FRONTIER_CONFIG_UNAVAILABLE"); }
}

/** Named scope only, no target enumeration or latest-primary inference. */
export function maintenanceFrontier(store: OperationStore, config: RouterConfiguration, r: MaintenanceRequest): Json {
  validateMaintenanceRequest(r);
  const binding = handoffBinding(config, r.project);
  const governed = config.targets[binding.enrollment.governedTarget]!;
  const lookup = frontierTargets(config);
  return r.packet.frontiers.map(f => {
    const w = store.getWork(f.workId), t = Object.hasOwn(lookup.targets, w.context.target) ? lookup.targets[w.context.target] : undefined;
    if (!t || t.project !== governed.project || t.namespace !== governed.namespace || typeof t.directory !== "string" || !sameDirectory(t.directory, w.context.directory)) throw new RouterError("MAINTENANCE_FRONTIER_TARGET_MISMATCH");
    const sources = [f.statePath, f.combinedPath].filter((s): s is string => s !== undefined).map(reference => {
      try {
        const source = readContainedSource(w.context.directory, reference);
        return { reference, status: "AVAILABLE", sha256: source.sha256 };
      } catch (e) {
        if (!(e instanceof RouterError && e.code === "SOURCE_UNAVAILABLE")) throw e;
        return { reference, status: "UNAVAILABLE", reason: e.code };
      }
    });
    // Keep every pending operation and the latest completed operation per role.
    // Bind all retained operation facts for freshness, without dumping history.
    const latest = new Map<string, string>();
    for (const o of w.operations) if (o.completedAt !== null) latest.set(o.action.recipientRole, o.operationId);
    const operations = w.operations.map(o => ({ operationId: o.operationId, role: o.action.recipientRole,
      command: o.action.command, completed: o.completedAt !== null,
      delivery: o.acknowledgedAt ? "DELIVERED" : o.dispatchStartedAt || o.action.kind === "LEGACY" ? "POSSIBLE" : "NOT_SENT",
      execution: o.outcome?.execution ?? (o.dispatchStartedAt || o.action.kind === "LEGACY" ? "PENDING" : "PREPARED"),
      resultDigest: o.resultDigest, decision: o.interpretation?.decision ?? null }));
    const selected = operations.filter(o => !o.completed || latest.get(o.role) === o.operationId);
    if (selected.length > 40) throw new RouterError("MAINTENANCE_FRONTIER_TOO_LARGE");
    return { workId: f.workId, target: w.context.target, executionRoot: w.context.directory,
      executionRootVerified: false,
      targetSource: lookup.source, targetSourceReferenceDigest: lookup.referenceDigest, targetBindingDigest: digest(t),
      instructionReference: w.context.instructionReference, scope: w.context.scope,
      authorization: w.authorization as unknown as Json, paused: w.paused, pauseReference: w.pauseReference,
      sources, operationFactsDigest: digest(operations), totalOperations: operations.length,
      omittedCompletedOperations: operations.length - selected.length, operations: selected };
  });
}

export function assertMaintenanceEnabled(config: RouterConfiguration, project: string): ReturnType<typeof handoffBinding> {
  const binding = handoffBinding(config, project, true);
  if (config.orchestratorBridge?.maintenanceEnabled !== true) throw new RouterError("ORCHESTRATOR_MAINTENANCE_DISABLED");
  return binding;
}

function location(root: string, id: string): string {
  if (!path.isAbsolute(root) || !/^maintenance-[a-f0-9]{64}$/.test(id)) throw new StoreError("INVALID_INPUT");
  const file = path.join(root, "orchestrator-maintenance", `${id}.json`);
  for (let p = file; ; p = path.dirname(p)) {
    if (existsSync(p) && lstatSync(p).isSymbolicLink()) throw new RouterError("MAINTENANCE_STORAGE_UNSAFE");
    if (p === path.dirname(p)) break;
  }
  return file;
}
export const maintenanceId = (r: MaintenanceRequest) => `maintenance-${digest([r.project, r.maintenanceKey])}`;
export function validateMaintenancePreview(p: MaintenancePreview): void {
  exactFields(p, ["version", "maintenanceId", "request", "requestDigest", "bindingDigest", "boundary", "frontier", "frontierDigest", "exactRestoreMessage", "createdAt", "expiresAt", "previewDigest"]);
  validateMaintenanceRequest(p.request);
  const { previewDigest, ...body } = p;
  if (p.version !== 1 || p.maintenanceId !== maintenanceId(p.request) || p.requestDigest !== digest(p.request) || p.frontierDigest !== digest(p.frontier) ||
      previewDigest !== digest(body) || !Number.isFinite(Date.parse(p.createdAt)) || Date.parse(p.expiresAt) - Date.parse(p.createdAt) !== 600_000 ||
      p.exactRestoreMessage !== renderRestore(p.request, p.frontier)) throw new RouterError("MAINTENANCE_PREVIEW_INVALID");
}
export function readMaintenancePreview(root: string, id: string): MaintenancePreview {
  const file = location(root, id); let p: MaintenancePreview;
  try { if (lstatSync(file).size > 128_000) throw new Error(); p = JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new RouterError("MAINTENANCE_PREVIEW_UNAVAILABLE"); }
  validateMaintenancePreview(p);
  if (p.maintenanceId !== id) throw new RouterError("MAINTENANCE_PREVIEW_INVALID");
  return p;
}
export function existingMaintenancePreview(root: string, r: MaintenanceRequest): MaintenancePreview | undefined {
  validateMaintenanceRequest(r);
  if (!existsSync(location(root, maintenanceId(r)))) return undefined;
  const p = readMaintenancePreview(root, maintenanceId(r));
  if (p.requestDigest !== digest(r)) throw new StoreError("INPUT_CONFLICT");
  return p;
}
export function saveMaintenancePreview(root: string, request: MaintenanceRequest, bindingDigest: string, boundary: HandoffBoundary, frontier: Json): MaintenancePreview {
  const existing = existingMaintenancePreview(root, request); if (existing) return existing;
  const now = Date.now();
  const body = { version: 1 as const, maintenanceId: maintenanceId(request), request: structuredClone(request), requestDigest: digest(request), bindingDigest, boundary,
    frontier, frontierDigest: digest(frontier), exactRestoreMessage: renderRestore(request, frontier),
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 600_000).toISOString() };
  const p = { ...body, previewDigest: digest(body) }, encoded = JSON.stringify(p);
  if (Buffer.byteLength(encoded) > 128_000 || Buffer.byteLength(p.exactRestoreMessage) > 48_000) throw new RouterError("MAINTENANCE_FRONTIER_TOO_LARGE");
  const file = location(root, p.maintenanceId); mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try { writeFileSync(file, encoded, { flag: "wx", mode: 0o600 }); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw new RouterError("MAINTENANCE_PREVIEW_WRITE_FAILED"); return existingMaintenancePreview(root, request)!; }
  return p;
}
export function renderRestore(r: MaintenanceRequest, frontier: Json): string {
  return `Restore context only for ${r.project} orchestrator. Use the installed context-restore orchestrator procedure and fal-orchestrate-target skill. Do not dispatch, reconcile operations, compact again, edit project state, unpause work or resume lifecycle during this restore.\nOwner maintenance instruction: ${r.instructionReference}\nVerified named work frontier (frozen observation, not new scope): ${canonical(frontier)}\nHydrate each named work from its execution root, not the session home or guessed primary. Refresh changed factual evidence read-only; distinguish current authorization, retained operations, role acceptance and dated State/Combined. Keep every named stream and its pause; missing/conflicting essentials block only dependent actions. Do not reread full history or invent completion.\nOCoS advisory context (not authority; source/time and uncertainty must be distinguished):\n${r.packet.note ?? "None supplied."}\nReport project/role, sources actually read, RESTORED/DEGRADED/BLOCKED, each named stream's first unfinished action/stop and any discrepancy. Workflow command sent: false. Stop after restore; further continuation requires its separately authorized handoff.`;
}
export function assertMaintenanceSnapshot(store: OperationStore, config: RouterConfiguration, p: MaintenancePreview, expiry = true): void {
  validateMaintenancePreview(p);
  const b = assertMaintenanceEnabled(config, p.request.project);
  if ((expiry && (Date.now() > Date.parse(p.expiresAt) || Date.now() < Date.parse(p.createdAt))) || b.bindingDigest !== p.bindingDigest ||
      digest(maintenanceFrontier(store, config, p.request)) !== p.frontierDigest) throw new RouterError("MAINTENANCE_STALE_PREVIEW");
}
