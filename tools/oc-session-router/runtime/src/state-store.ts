import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RouterWarningReceipt, RunAuthority, SourceBinding, StageInvocation } from "./contracts.js";
import { STAGES, assertFilesystemId, assertOpaqueId, assertSafeRelativePath, assertSha256, canonicalize, sha256 } from "./contracts.js";

export type OperationStatus = "CREATED" | "DISPATCHING" | "ACTIVE" | "RECONCILING" | "WAITING_ACTION" | "STALLED_SUSPECTED" | "SUCCEEDED" | "EVIDENCE_GAP" | "FAILED_OUTPUT" | "FAILED_TRANSPORT" | "UNCERTAIN" | "BLOCKED" | "CANCELLED";
export type ParticipantLifecycleState = "SETTLED" | "PENDING" | "UNCERTAIN";

export interface RunDocument {
  schema_version: "run.v1";
  run_id: string;
  created_at: string;
  target_id: string;
  worktree_identity: string;
  run_authority_sha256: string;
  run_authority_path: "run-authority.json";
}

export interface OperationDocument {
  schema_version: "operation.v1";
  operation_id: string;
  run_id: string;
  sequence: number;
  revision: number;
  status: OperationStatus;
  semantic_key: string;
  invocation: StageInvocation;
  send_attempt_id: string;
  intent_sha256: string;
  result_path: string;
  updated_at: string;
}

interface SemanticActionDocument {
  schema_version: "semantic-action.v1";
  semantic_key: string;
  run_id: string;
  operation_id: string;
  status: "CLAIMED" | "CONSUMED" | "RELEASED";
  updated_at: string;
}

interface CapabilityUseDocument {
  schema_version: "capability-use.v2";
  authorization_use_sha256: string;
  run_id: string;
  operation_id: string;
  status: "CLAIMED" | "CONSUMED" | "RELEASED";
  updated_at: string;
}

export interface DispatchLeaseDocument {
  schema_version: "dispatch-lease.v1";
  server_fingerprint_sha256: string;
  session_sha256: string;
  operation_class: string;
  holder: string;
  acquired_at: string;
  fencing_generation: string;
}

export interface InstalledOwnerSourceDocument {
  schema_version: "installed-owner-source.v1";
  run_id: string;
  predecessor_operation_id: string;
  binding: SourceBinding;
  content: string;
  installed_at: string;
}

export interface InstalledFollowOnSourceDocument {
  schema_version: "installed-follow-on-source.v1";
  run_id: string;
  predecessor_run_id: string;
  predecessor_operation_id: string;
  predecessor_run_authority_sha256: string;
  base_review_cycle: string;
  base_next_command: string;
  predecessor_review_cycle: string;
  review_cycle: string;
  candidate_identity: string;
  finding_ids: string[];
  binding: SourceBinding;
  content: string;
  installed_at: string;
}

interface FollowOnLinkDocument {
  schema_version: "follow-on-link.v1";
  predecessor_run_id: string;
  predecessor_operation_id: string;
  run_id: string;
  run_authority_sha256: string;
}

const NONTERMINAL = new Set<OperationStatus>(["CREATED", "DISPATCHING", "ACTIVE", "RECONCILING", "WAITING_ACTION", "STALLED_SUSPECTED", "UNCERTAIN"]);

export class StateStore {
  readonly root: string;

  constructor(root: string) {
    if (!path.isAbsolute(root)) throw new Error("Router root must be absolute");
    if (!existsSync(root)) throw new Error("Router root must be pre-created");
    if (lstatSync(root).isSymbolicLink()) throw new Error("Router root cannot be a link or junction");
    this.root = realpathSync(root);
  }

  resolve(...segments: string[]): string {
    const candidate = path.resolve(this.root, ...segments);
    const relative = path.relative(this.root, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Path escapes router root");
    let current = this.root;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error("Contained paths cannot traverse links or junctions");
    }
    return candidate;
  }

  createRun(authority: RunAuthority, authorityHash: string): RunDocument {
    assertFilesystemId(authority.run_id, "run_id");
    const runDir = this.resolve("runs", authority.run_id);
    mkdirSync(path.dirname(runDir), { recursive: true, mode: 0o700 });
    mkdirSync(runDir, { mode: 0o700 });
    const run: RunDocument = {
      schema_version: "run.v1",
      run_id: authority.run_id,
      created_at: authority.created_at,
      target_id: authority.target_id,
      worktree_identity: authority.worktree_identity,
      run_authority_sha256: authorityHash,
      run_authority_path: "run-authority.json",
    };
    this.writeJsonExclusive(path.join(runDir, "run-authority.json"), authority);
    this.writeJsonExclusive(path.join(runDir, "run.json"), run);
    return run;
  }

  createFollowOnRun(authority: RunAuthority, authorityHash: string, source: Omit<InstalledFollowOnSourceDocument, "run_id" | "installed_at">): { run: RunDocument; created: boolean } {
    assertFilesystemId(source.predecessor_run_id, "predecessor_run_id");
    assertFilesystemId(source.predecessor_operation_id, "predecessor_operation_id");
    assertSha256(source.predecessor_run_authority_sha256, "predecessor run authority sha256");
    const links = this.resolve("follow-on-links");
    mkdirSync(links, { recursive: true, mode: 0o700 });
    const key = sha256(canonicalize({ predecessor_run_id: source.predecessor_run_id, predecessor_operation_id: source.predecessor_operation_id }));
    return this.withExclusiveLock(this.resolve("follow-on-links", `${key}.lock`), () => {
      const linkPath = this.resolve("follow-on-links", `${key}.json`);
      if (existsSync(linkPath)) {
        const link = JSON.parse(readFileSync(linkPath, "utf8")) as FollowOnLinkDocument;
        const expectedLinkKeys = ["predecessor_operation_id", "predecessor_run_id", "run_authority_sha256", "run_id", "schema_version"];
        if (canonicalize(Object.keys(link).sort()) !== canonicalize(expectedLinkKeys) || link.schema_version !== "follow-on-link.v1" || link.predecessor_run_id !== source.predecessor_run_id || link.predecessor_operation_id !== source.predecessor_operation_id) throw new Error("Follow-on link receipt is invalid");
        assertFilesystemId(link.run_id, "follow-on run_id");
        assertSha256(link.run_authority_sha256, "follow-on run authority sha256");
        const existing = this.loadRun(link.run_id);
        const installed = this.loadFollowOnSource(link.run_id);
        if (!installed || existing.run.run_authority_sha256 !== link.run_authority_sha256 || installed.predecessor_run_id !== source.predecessor_run_id || installed.predecessor_operation_id !== source.predecessor_operation_id) throw new Error("Follow-on link target is invalid");
        return { run: existing.run, created: false };
      }
      const run = this.createRun(authority, authorityHash);
      this.installFollowOnSource(authority.run_id, source);
      const link: FollowOnLinkDocument = { schema_version: "follow-on-link.v1", predecessor_run_id: source.predecessor_run_id, predecessor_operation_id: source.predecessor_operation_id, run_id: authority.run_id, run_authority_sha256: authorityHash };
      this.writeJsonExclusive(linkPath, link);
      return { run, created: true };
    });
  }

  loadRun(runId: string): { run: RunDocument; authority: RunAuthority } {
    assertFilesystemId(runId, "run_id");
    const dir = this.resolve("runs", runId);
    return {
      run: JSON.parse(readFileSync(path.join(dir, "run.json"), "utf8")) as RunDocument,
      authority: JSON.parse(readFileSync(path.join(dir, "run-authority.json"), "utf8")) as RunAuthority,
    };
  }

  installFollowOnSource(runId: string, source: Omit<InstalledFollowOnSourceDocument, "run_id" | "installed_at">): InstalledFollowOnSourceDocument {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(source.predecessor_run_id, "predecessor_run_id");
    assertFilesystemId(source.predecessor_operation_id, "predecessor_operation_id");
    assertSha256(source.predecessor_run_authority_sha256, "predecessor run authority sha256");
    assertSafeRelativePath(source.binding.path, "follow-on source path");
    assertOpaqueId(source.binding.logical_identity, "follow-on source logical identity");
    assertOpaqueId(source.candidate_identity, "follow-on candidate identity");
    if (!/^(?:0|[1-9]\d*)$/.test(source.base_review_cycle) || !/^(?:0|[1-9]\d*)$/.test(source.predecessor_review_cycle) || !/^[1-9]\d*$/.test(source.review_cycle) || Number(source.review_cycle) !== Number(source.predecessor_review_cycle) + 1 || !Number.isSafeInteger(Number(source.review_cycle))) throw new Error("Follow-on review cycle is invalid");
    if (!source.base_next_command.startsWith("/")) throw new Error("Follow-on base command is invalid");
    if (source.finding_ids.length === 0 || source.finding_ids.some((finding) => typeof finding !== "string") || new Set(source.finding_ids).size !== source.finding_ids.length || canonicalize(source.finding_ids) !== canonicalize([...source.finding_ids].sort())) throw new Error("Follow-on finding lineage is invalid");
    for (const finding of source.finding_ids) assertOpaqueId(finding, "follow-on finding ID");
    if (source.binding.path !== "router-predecessor/fix-plan.md" || source.binding.source_class !== "PLAN" || source.binding.producer !== "FAL_ROUTER_OUTPUT" || source.binding.order !== 0 || sha256(Buffer.from(source.content, "utf8")) !== source.binding.sha256) throw new Error("Follow-on source binding is invalid");
    const documentPath = this.resolve("runs", runId, "follow-on-source.json");
    const document: InstalledFollowOnSourceDocument = { ...source, schema_version: "installed-follow-on-source.v1", run_id: runId, installed_at: new Date().toISOString() };
    this.writeJsonExclusive(documentPath, document);
    return document;
  }

  loadFollowOnSource(runId: string): InstalledFollowOnSourceDocument | undefined {
    assertFilesystemId(runId, "run_id");
    const documentPath = this.resolve("runs", runId, "follow-on-source.json");
    if (!existsSync(documentPath)) return undefined;
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as InstalledFollowOnSourceDocument;
    const expectedKeys = ["base_next_command", "base_review_cycle", "binding", "candidate_identity", "content", "finding_ids", "installed_at", "predecessor_operation_id", "predecessor_review_cycle", "predecessor_run_authority_sha256", "predecessor_run_id", "review_cycle", "run_id", "schema_version"];
    if (canonicalize(Object.keys(document).sort()) !== canonicalize(expectedKeys) || document.schema_version !== "installed-follow-on-source.v1" || document.run_id !== runId || typeof document.content !== "string" || typeof document.installed_at !== "string") throw new Error("Installed follow-on source receipt is invalid");
    assertFilesystemId(document.predecessor_run_id, "predecessor_run_id");
    assertFilesystemId(document.predecessor_operation_id, "predecessor_operation_id");
    assertSha256(document.predecessor_run_authority_sha256, "predecessor run authority sha256");
    assertSafeRelativePath(document.binding.path, "follow-on source path");
    assertOpaqueId(document.binding.logical_identity, "follow-on source logical identity");
    assertOpaqueId(document.candidate_identity, "follow-on candidate identity");
    if (!/^(?:0|[1-9]\d*)$/.test(document.base_review_cycle) || !/^(?:0|[1-9]\d*)$/.test(document.predecessor_review_cycle) || !/^[1-9]\d*$/.test(document.review_cycle) || Number(document.review_cycle) !== Number(document.predecessor_review_cycle) + 1 || !Number.isSafeInteger(Number(document.review_cycle)) || !document.base_next_command.startsWith("/")) throw new Error("Installed follow-on source receipt is invalid");
    if (!Array.isArray(document.finding_ids) || document.finding_ids.length === 0 || document.finding_ids.some((finding) => typeof finding !== "string") || new Set(document.finding_ids).size !== document.finding_ids.length || canonicalize(document.finding_ids) !== canonicalize([...document.finding_ids].sort())) throw new Error("Installed follow-on source receipt is invalid");
    for (const finding of document.finding_ids) assertOpaqueId(finding, "follow-on finding ID");
    if (document.binding.path !== "router-predecessor/fix-plan.md" || document.binding.source_class !== "PLAN" || document.binding.producer !== "FAL_ROUTER_OUTPUT" || document.binding.order !== 0 || sha256(Buffer.from(document.content, "utf8")) !== document.binding.sha256) throw new Error("Installed follow-on source receipt is invalid");
    return document;
  }

  createOperation(runId: string, invocation: StageInvocation, intent: unknown, intentSha256: string): OperationDocument {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(invocation.operation_id, "operation_id");
    const operationsDir = this.resolve("runs", runId, "operations");
    mkdirSync(operationsDir, { recursive: true, mode: 0o700 });
    return this.withExclusiveLock(this.resolve("runs", runId, "operation-create.lock"), () => {
      const operationIds = this.listOperationIds(runId);
      for (const entry of operationIds) {
        const existing = this.loadOperation(runId, entry);
        if (NONTERMINAL.has(existing.status)) {
          if (existing.semantic_key === invocation.semantic_key) throw new Error("Equivalent unsettled operation already exists");
          throw new Error("Run already has a nonterminal operation");
        }
      }
      const operation: OperationDocument = {
        schema_version: "operation.v1",
        operation_id: invocation.operation_id,
        run_id: runId,
        sequence: operationIds.length,
        revision: 0,
        status: "CREATED",
        semantic_key: invocation.semantic_key,
        invocation,
        send_attempt_id: randomUUID(),
        intent_sha256: intentSha256,
        result_path: "result.json",
        updated_at: new Date().toISOString(),
      };
      const dir = path.join(operationsDir, operation.operation_id);
      mkdirSync(dir, { mode: 0o700 });
      this.writeJsonExclusive(path.join(dir, "stage-invocation.json"), invocation);
      this.writeJsonExclusive(path.join(dir, "intent.json"), intent);
      this.writeJsonExclusive(path.join(dir, "operation.json"), operation);
      return operation;
    });
  }

  loadOperation(runId: string, operationId: string): OperationDocument {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return JSON.parse(readFileSync(this.resolve("runs", runId, "operations", operationId, "operation.json"), "utf8")) as OperationDocument;
  }

  loadStageInvocation(runId: string, operationId: string): StageInvocation {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return JSON.parse(readFileSync(this.resolve("runs", runId, "operations", operationId, "stage-invocation.json"), "utf8")) as StageInvocation;
  }

  loadIntent<T = unknown>(runId: string, operationId: string): T {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return JSON.parse(readFileSync(this.resolve("runs", runId, "operations", operationId, "intent.json"), "utf8")) as T;
  }

  listOperations(runId: string): OperationDocument[] {
    assertFilesystemId(runId, "run_id");
    return this.listOperationIds(runId).map((operationId) => this.loadOperation(runId, operationId)).sort((left, right) => left.sequence - right.sequence);
  }

  participantLifecycleState(targetId: string, recipientSessionSha256: string): ParticipantLifecycleState {
    assertOpaqueId(targetId, "participant target ID");
    assertSha256(recipientSessionSha256, "participant session SHA-256");
    const runsDir = this.resolve("runs");
    if (!existsSync(runsDir)) return "SETTLED";
    const runIds = readdirSync(runsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => {
        assertFilesystemId(entry.name, "participant run directory");
        return entry.name;
      });
    if (runIds.length > 1_000) return "UNCERTAIN";
    let state: ParticipantLifecycleState = "SETTLED";
    for (const runId of runIds) {
      const run = this.loadRun(runId).run;
      if (run.target_id !== targetId) continue;
      const operations = this.listOperations(runId);
      if (operations.length > 1_000) return "UNCERTAIN";
      for (const operation of operations) {
        if (operation.invocation.recipient_session_sha256 !== recipientSessionSha256) continue;
        if (operation.status === "UNCERTAIN") return "UNCERTAIN";
        if (["CREATED", "DISPATCHING", "ACTIVE", "RECONCILING", "WAITING_ACTION", "STALLED_SUSPECTED"].includes(operation.status)) state = "PENDING";
      }
    }
    return state;
  }

  loadResult(runId: string, operationId: string): unknown {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return JSON.parse(readFileSync(this.resolve("runs", runId, "operations", operationId, "result.json"), "utf8")) as unknown;
  }

  loadResultIfExists(runId: string, operationId: string): unknown | undefined {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    const resultPath = this.resolve("runs", runId, "operations", operationId, "result.json");
    return existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, "utf8")) as unknown : undefined;
  }

  updateOperation(runId: string, operationId: string, expectedRevision: number, patch: Partial<Pick<OperationDocument, "status" | "intent_sha256">>): OperationDocument {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return this.withExclusiveLock(this.resolve("runs", runId, "operations", operationId, "update.lock"), () => {
      const current = this.loadOperation(runId, operationId);
      if (current.revision !== expectedRevision) throw new Error("Stale operation revision");
      if (!NONTERMINAL.has(current.status)) throw new Error("Terminal operations are immutable");
      const next: OperationDocument = { ...current, ...patch, revision: current.revision + 1, updated_at: new Date().toISOString() };
      this.writeJsonAtomic(this.resolve("runs", runId, "operations", operationId, "operation.json"), next);
      return next;
    });
  }

  beginFailedOutputRecovery(runId: string, operationId: string, expectedRevision: number): OperationDocument {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return this.withExclusiveLock(this.resolve("runs", runId, "operations", operationId, "update.lock"), () => {
      const current = this.loadOperation(runId, operationId);
      if (current.revision !== expectedRevision) throw new Error("Stale operation revision");
      if (current.status !== "FAILED_OUTPUT") throw new Error("Only FAILED_OUTPUT operations admit failed-output recovery");
      const result = this.loadResult(runId, operationId) as Record<string, unknown>;
      if (
        result.schema_version !== "stage-result.v1" ||
        result.run_id !== runId ||
        result.operation_id !== operationId ||
        result.operation_status !== "FAILED_OUTPUT" ||
        result.transport_status !== "RESPONSE_ACCEPTED" ||
        result.output_status !== "INVALID" ||
        result.binding_status !== "UNVALIDATED" ||
        result.terminal_status !== "UNVALIDATED" ||
        result.reason !== "OUTPUT_VALIDATION_FAILED"
      ) throw new Error("FAILED_OUTPUT recovery origin is not eligible");
      const receiptPath = this.resolve("runs", runId, "operations", operationId, "transport-receipt.json");
      const terminalPath = this.resolve("runs", runId, "operations", operationId, "terminal.md");
      if (!existsSync(receiptPath) || existsSync(terminalPath)) throw new Error("FAILED_OUTPUT recovery evidence is incomplete or already finalized");
      const originPath = this.resolve("runs", runId, "operations", operationId, "failed-output-recovery-origin.json");
      const origin = {
        schema_version: "failed-output-recovery-origin.v1",
        run_id: runId,
        operation_id: operationId,
        original_status: "FAILED_OUTPUT",
        original_result_sha256: sha256(canonicalize(result)),
        original_result: result,
        raw_output_persisted: false,
      };
      if (existsSync(originPath)) {
        if (canonicalize(JSON.parse(readFileSync(originPath, "utf8"))) !== canonicalize(origin)) throw new Error("FAILED_OUTPUT recovery origin drifted");
      } else {
        this.writeJsonExclusive(originPath, origin);
      }
      const next: OperationDocument = { ...current, status: "RECONCILING", revision: current.revision + 1, updated_at: new Date().toISOString() };
      this.writeJsonAtomic(this.resolve("runs", runId, "operations", operationId, "operation.json"), next);
      return next;
    });
  }

  hasFailedOutputRecovery(runId: string, operationId: string): boolean {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return existsSync(this.resolve("runs", runId, "operations", operationId, "failed-output-recovery-origin.json"));
  }

  writeFailedOutputRecoveryReceipt(runId: string, operationId: string, receipt: unknown): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    const receiptPath = this.resolve("runs", runId, "operations", operationId, "failed-output-recovery-receipt.json");
    if (existsSync(receiptPath)) this.writeJsonAtomic(receiptPath, receipt);
    else this.writeJsonExclusive(receiptPath, receipt);
  }

  writeResult(runId: string, operationId: string, result: unknown): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    this.writeJsonExclusive(this.resolve("runs", runId, "operations", operationId, "result.json"), result);
  }

  writeFinalResult(runId: string, operationId: string, result: unknown, replaceableStatuses: readonly string[] = []): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    const resultPath = this.resolve("runs", runId, "operations", operationId, "result.json");
    if (!existsSync(resultPath)) {
      this.writeJsonExclusive(resultPath, result);
      return;
    }
    const current = JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, unknown>;
    if (canonicalize(current) === canonicalize(result)) return;
    if (current.run_id !== runId || current.operation_id !== operationId || typeof current.operation_status !== "string" || !replaceableStatuses.includes(current.operation_status)) {
      throw new Error("Final result identity collision");
    }
    this.writeJsonAtomic(resultPath, result);
  }

  updateResult(runId: string, operationId: string, result: unknown): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    this.writeJsonAtomic(this.resolve("runs", runId, "operations", operationId, "result.json"), result);
  }

  writeTransportReceipt(runId: string, operationId: string, receipt: unknown): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    this.writeJsonExclusive(this.resolve("runs", runId, "operations", operationId, "transport-receipt.json"), receipt);
  }

  loadTransportReceipt<T = unknown>(runId: string, operationId: string): T | undefined {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    const receiptPath = this.resolve("runs", runId, "operations", operationId, "transport-receipt.json");
    return existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) as T : undefined;
  }

  writeSnapshotDiagnostic(runId: string, operationId: string, diagnostic: unknown): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    const diagnosticPath = this.resolve("runs", runId, "operations", operationId, "snapshot-diagnostic.json");
    if (existsSync(diagnosticPath)) this.writeJsonAtomic(diagnosticPath, diagnostic);
    else this.writeJsonExclusive(diagnosticPath, diagnostic);
  }

  writeCompactHookReceipt(runId: string, operationId: string, receipt: unknown): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    this.writeJsonExclusive(this.resolve("runs", runId, "operations", operationId, "compact-hooks.json"), receipt);
  }

  writeRouterWarningReceipt(runId: string, operationId: string, receipt: RouterWarningReceipt): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    validateRouterWarningReceipt(receipt, runId, operationId);
    const directory = this.resolve("runs", runId, "operations", operationId, "warnings");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const receiptPath = this.resolve("runs", runId, "operations", operationId, "warnings", `${receipt.warning_id}.json`);
    if (existsSync(receiptPath)) {
      const current = JSON.parse(readFileSync(receiptPath, "utf8")) as RouterWarningReceipt;
      validateRouterWarningReceipt(current, runId, operationId);
      if (canonicalize(current) !== canonicalize(receipt)) throw new Error("Router warning receipt identity collision");
      return;
    }
    this.writeJsonExclusive(receiptPath, receipt);
  }

  listRouterWarningReceipts(runId: string, operationId?: string): RouterWarningReceipt[] {
    assertFilesystemId(runId, "run_id");
    const operationIds = operationId ? [operationId] : this.listOperationIds(runId);
    const receipts: RouterWarningReceipt[] = [];
    for (const currentOperationId of operationIds) {
      assertFilesystemId(currentOperationId, "operation_id");
      const operation = this.loadOperation(runId, currentOperationId);
      if (operation.status !== "SUCCEEDED" && operation.status !== "EVIDENCE_GAP") continue;
      const result = this.loadResult(runId, currentOperationId) as Record<string, unknown>;
      const expectedStatus = operation.status;
      if (
        result.schema_version !== "stage-result.v1" ||
        result.run_id !== runId ||
        result.operation_id !== currentOperationId ||
        result.operation_status !== expectedStatus ||
        !Array.isArray(result.allowed_next) ||
        result.auto_advance !== false ||
        typeof result.artifact_sha256 !== "string"
      ) throw new Error("Settled warning result binding is invalid");
      const terminalPath = this.resolve("runs", runId, "operations", currentOperationId, "terminal.md");
      if (!existsSync(terminalPath)) throw new Error("Settled warning terminal artifact is missing");
      const terminal = readFileSync(terminalPath, "utf8");
      if (sha256(Buffer.from(terminal, "utf8")) !== result.artifact_sha256) throw new Error("Settled warning terminal artifact hash mismatch");
      const policy = result.router_policy as Record<string, unknown> | undefined;
      if (!policy || policy.effective_mode !== "STANDARD" || !Array.isArray(policy.warning_rules) || typeof policy.input_sha256 !== "string" || typeof policy.normalized_output_sha256 !== "string") {
        const directory = this.resolve("runs", runId, "operations", currentOperationId, "warnings");
        if (existsSync(directory)) throw new Error("Settled warning receipt lacks an authoritative STANDARD result");
        continue;
      }
      assertSha256(policy.input_sha256, "settled warning input sha256");
      assertSha256(policy.normalized_output_sha256, "settled warning normalized output sha256");
      if (policy.normalized_output_sha256 !== sha256(terminal.replace(/\r\n/g, "\n").trim())) throw new Error("Settled warning normalized artifact hash mismatch");
      const directory = this.resolve("runs", runId, "operations", currentOperationId, "warnings");
      if (!existsSync(directory)) {
        if (policy.warning_rules.length > 0) throw new Error("Settled warning receipt set is missing");
        continue;
      }
      const entries = readdirSync(directory, { withFileTypes: true });
      if (entries.length > 1_000) throw new Error("Router warning receipt count exceeds the bounded limit");
      const operationReceipts: RouterWarningReceipt[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) throw new Error("Router warning receipt directory contains an unsafe entry");
        const receipt = JSON.parse(readFileSync(path.join(directory, entry.name), "utf8")) as RouterWarningReceipt;
        validateRouterWarningReceipt(receipt, runId, currentOperationId);
        if (entry.name !== `${receipt.warning_id}.json`) throw new Error("Router warning receipt filename mismatch");
        if (receipt.input_sha256 !== policy.input_sha256 || receipt.normalized_output_sha256 !== policy.normalized_output_sha256) throw new Error("Settled warning receipt hash binding mismatch");
        const successorProjected = receipt.consequence_class === "FORMAT_ONLY" && result.allowed_next.length > 0;
        if (receipt.successor_projected !== successorProjected) throw new Error("Settled warning successor projection mismatch");
        operationReceipts.push(receipt);
      }
      const receiptRules = [...new Set(operationReceipts.map((receipt) => receipt.rule))].sort();
      const policyRules = [...new Set(policy.warning_rules)].sort();
      if (canonicalize(receiptRules) !== canonicalize(policyRules)) throw new Error("Settled warning rule set mismatch");
      receipts.push(...operationReceipts);
    }
    return receipts.sort((left, right) => left.created_at.localeCompare(right.created_at) || left.warning_id.localeCompare(right.warning_id));
  }

  writeArtifact(runId: string, operationId: string, name: string, content: string): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    assertFilesystemId(name, "artifact name");
    const filePath = this.resolve("runs", runId, "operations", operationId, `${name}.md`);
    if (existsSync(filePath)) {
      if (readFileSync(filePath, "utf8") !== content) throw new Error("Artifact identity collision");
      return;
    }
    const descriptor = openSync(filePath, "wx", 0o600);
    try {
      writeFileSync(descriptor, content, { encoding: "utf8" });
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }

  readArtifact(runId: string, operationId: string, name: string): string {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    assertFilesystemId(name, "artifact name");
    return readFileSync(this.resolve("runs", runId, "operations", operationId, `${name}.md`), "utf8");
  }

  installOwnerSource(runId: string, predecessorOperationId: string, binding: SourceBinding, content: string): InstalledOwnerSourceDocument {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(predecessorOperationId, "predecessor_operation_id");
    assertSafeRelativePath(binding.path, "installed Owner source path");
    assertOpaqueId(binding.logical_identity, "installed Owner source logical identity");
    if (binding.path !== "owner-sources/closeout-authority.json" || binding.source_class !== "CLOSEOUT_AUTHORITY" || binding.producer !== "FAL_OWNER_RUNTIME" || binding.order !== 3 || sha256(Buffer.from(content, "utf8")) !== binding.sha256) throw new Error("Installed Owner source binding is invalid");
    const directory = this.resolve("runs", runId, "owner-sources");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const documentPath = this.resolve("runs", runId, "owner-sources", "closeout-authority.json");
    return this.withExclusiveLock(this.resolve("runs", runId, "owner-source-install.lock"), () => {
      if (existsSync(documentPath)) {
        const existing = this.loadOwnerSource(runId);
        if (!existing) throw new Error("Installed Owner source receipt disappeared");
        if (existing.predecessor_operation_id !== predecessorOperationId || canonicalize(existing.binding) !== canonicalize(binding) || existing.content !== content) throw new Error("A different Owner closeout authority is already installed");
        return existing;
      }
      const document: InstalledOwnerSourceDocument = { schema_version: "installed-owner-source.v1", run_id: runId, predecessor_operation_id: predecessorOperationId, binding, content, installed_at: new Date().toISOString() };
      this.writeJsonExclusive(documentPath, document);
      return document;
    });
  }

  loadOwnerSource(runId: string): InstalledOwnerSourceDocument | undefined {
    assertFilesystemId(runId, "run_id");
    const documentPath = this.resolve("runs", runId, "owner-sources", "closeout-authority.json");
    if (!existsSync(documentPath)) return undefined;
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as InstalledOwnerSourceDocument;
    if (canonicalize(Object.keys(document).sort()) !== canonicalize(["binding", "content", "installed_at", "predecessor_operation_id", "run_id", "schema_version"]) || document.schema_version !== "installed-owner-source.v1" || document.run_id !== runId || typeof document.content !== "string" || typeof document.installed_at !== "string") throw new Error("Installed Owner source receipt is invalid");
    assertFilesystemId(document.predecessor_operation_id, "predecessor_operation_id");
    assertSafeRelativePath(document.binding.path, "installed Owner source path");
    assertOpaqueId(document.binding.logical_identity, "installed Owner source logical identity");
    if (document.binding.path !== "owner-sources/closeout-authority.json" || document.binding.source_class !== "CLOSEOUT_AUTHORITY" || document.binding.producer !== "FAL_OWNER_RUNTIME" || document.binding.order !== 3 || sha256(Buffer.from(document.content, "utf8")) !== document.binding.sha256) throw new Error("Installed Owner source receipt is invalid");
    return document;
  }

  acquireLease(leaseKey: string, holder: DispatchLeaseDocument): () => void {
    assertSha256(holder.server_fingerprint_sha256, "server fingerprint sha256");
    assertSha256(holder.session_sha256, "session sha256");
    const leaseDir = this.resolve("dispatch-leases");
    mkdirSync(leaseDir, { recursive: true, mode: 0o700 });
    const leasePath = this.resolve("dispatch-leases", `${leaseKey}.lock`);
    this.writeJsonExclusive(leasePath, holder);
    return () => { if (existsSync(leasePath)) unlinkSync(leasePath); };
  }

  claimSemanticAction(semanticKey: string, runId: string, operationId: string): void {
    assertSha256(semanticKey, "semantic_key");
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    const dir = this.resolve("semantic-actions");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.withExclusiveLock(this.resolve("semantic-actions", `${semanticKey}.lock`), () => {
      const documentPath = this.resolve("semantic-actions", `${semanticKey}.json`);
      if (existsSync(documentPath)) {
        const existing = JSON.parse(readFileSync(documentPath, "utf8")) as SemanticActionDocument;
        if (existing.status !== "RELEASED") throw new Error("Semantic action is already consumed or unresolved");
      }
      const document: SemanticActionDocument = { schema_version: "semantic-action.v1", semantic_key: semanticKey, run_id: runId, operation_id: operationId, status: "CLAIMED", updated_at: new Date().toISOString() };
      if (existsSync(documentPath)) this.writeJsonAtomic(documentPath, document);
      else this.writeJsonExclusive(documentPath, document);
    });
  }

  settleSemanticAction(semanticKey: string, runId: string, operationId: string, status: "CONSUMED" | "RELEASED"): void {
    assertSha256(semanticKey, "semantic_key");
    this.withExclusiveLock(this.resolve("semantic-actions", `${semanticKey}.lock`), () => {
      const documentPath = this.resolve("semantic-actions", `${semanticKey}.json`);
      const current = JSON.parse(readFileSync(documentPath, "utf8")) as SemanticActionDocument;
      if (current.run_id !== runId || current.operation_id !== operationId) throw new Error("Semantic action claim identity mismatch");
      if (current.status === status) return;
      if (current.status !== "CLAIMED") throw new Error("Semantic action claim identity mismatch");
      this.writeJsonAtomic(documentPath, { ...current, status, updated_at: new Date().toISOString() });
    });
  }

  claimOneUseCapability(authorizationUseSha256: string, runId: string, operationId: string): void {
    assertSha256(authorizationUseSha256, "authorization use sha256");
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    const directory = this.resolve("capability-uses");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.withExclusiveLock(this.resolve("capability-uses", `${authorizationUseSha256}.lock`), () => {
      const documentPath = this.resolve("capability-uses", `${authorizationUseSha256}.json`);
      if (existsSync(documentPath)) {
        const existing = JSON.parse(readFileSync(documentPath, "utf8")) as CapabilityUseDocument;
        if (existing.status !== "RELEASED") throw new Error("P0B one-use capability is already claimed or consumed");
      }
      const document: CapabilityUseDocument = { schema_version: "capability-use.v2", authorization_use_sha256: authorizationUseSha256, run_id: runId, operation_id: operationId, status: "CLAIMED", updated_at: new Date().toISOString() };
      if (existsSync(documentPath)) this.writeJsonAtomic(documentPath, document);
      else this.writeJsonExclusive(documentPath, document);
    });
  }

  settleOneUseCapability(authorizationUseSha256: string, runId: string, operationId: string, status: "CONSUMED" | "RELEASED"): void {
    assertSha256(authorizationUseSha256, "authorization use sha256");
    this.withExclusiveLock(this.resolve("capability-uses", `${authorizationUseSha256}.lock`), () => {
      const documentPath = this.resolve("capability-uses", `${authorizationUseSha256}.json`);
      const current = JSON.parse(readFileSync(documentPath, "utf8")) as CapabilityUseDocument;
      if (current.run_id !== runId || current.operation_id !== operationId || current.status !== "CLAIMED") throw new Error("P0B capability claim identity mismatch");
      this.writeJsonAtomic(documentPath, { ...current, status, updated_at: new Date().toISOString() });
    });
  }

  private listOperationIds(runId: string): string[] {
    const dir = this.resolve("runs", runId, "operations");
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        assertFilesystemId(entry.name, "operation directory");
        return entry.name;
      });
  }

  private writeJsonExclusive(filePath: string, value: unknown): void {
    const descriptor = openSync(filePath, "wx", 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(value)}\n`, { encoding: "utf8" });
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }

  private writeJsonAtomic(filePath: string, value: unknown): void {
    const temp = `${filePath}.tmp.${randomUUID()}`;
    this.writeJsonExclusive(temp, value);
    try {
      for (let attempt = 0; ; attempt += 1) {
        try { renameSync(temp, filePath); break; }
        catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (process.platform !== "win32" || (code !== "EPERM" && code !== "EACCES") || attempt >= 5) throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * (2 ** attempt));
        }
      }
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
    }
  }

  private withExclusiveLock<T>(lockPath: string, action: () => T): T {
    this.writeJsonExclusive(lockPath, { schema_version: "exclusive-lock.v1", acquired_at: new Date().toISOString(), holder: process.pid });
    try {
      return action();
    } finally {
      if (existsSync(lockPath)) unlinkSync(lockPath);
    }
  }
}

function validateRouterWarningReceipt(receipt: RouterWarningReceipt, runId: string, operationId: string): void {
  const keys = ["consequence_class", "created_at", "input_sha256", "normalized_output_sha256", "operation_id", "raw_output_persisted", "router_policy_mode", "rule", "run_id", "schema_version", "stage", "successor_projected", "warning_id"];
  if (!receipt || typeof receipt !== "object" || canonicalize(Object.keys(receipt).sort()) !== canonicalize(keys)) throw new Error("Router warning receipt schema mismatch");
  if (receipt.schema_version !== "router-warning-receipt.v1" || receipt.run_id !== runId || receipt.operation_id !== operationId || receipt.router_policy_mode !== "STANDARD" || receipt.raw_output_persisted !== false) throw new Error("Router warning receipt binding mismatch");
  assertFilesystemId(receipt.warning_id, "warning_id");
  assertFilesystemId(receipt.run_id, "warning run_id");
  assertFilesystemId(receipt.operation_id, "warning operation_id");
  assertSha256(receipt.input_sha256, "warning input sha256");
  assertSha256(receipt.normalized_output_sha256, "warning normalized output sha256");
  if (!(STAGES as readonly string[]).includes(receipt.stage)) throw new Error("Router warning receipt stage is invalid");
  if (!["UNIQUE_CANONICAL_ENVELOPE", "DETERMINISTIC_OPTIONAL_DEFAULT", "REQUIRED_SEMANTIC_FACT_MISSING"].includes(receipt.rule)) throw new Error("Router warning receipt rule is invalid");
  if (receipt.consequence_class !== "FORMAT_ONLY" && receipt.consequence_class !== "NO_SUCCESSOR") throw new Error("Router warning receipt consequence is invalid");
  if (receipt.consequence_class === "NO_SUCCESSOR" && receipt.successor_projected) throw new Error("No-successor warning cannot project a successor");
  if (typeof receipt.successor_projected !== "boolean" || typeof receipt.created_at !== "string" || !receipt.created_at.endsWith("Z") || !Number.isFinite(Date.parse(receipt.created_at))) throw new Error("Router warning receipt metadata is invalid");
}
