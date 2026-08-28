import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RunAuthority, SourceBinding, StageInvocation } from "./contracts.js";
import { assertFilesystemId, assertOpaqueId, assertSafeRelativePath, assertSha256, canonicalize, sha256 } from "./contracts.js";

export type OperationStatus = "CREATED" | "DISPATCHING" | "ACTIVE" | "RECONCILING" | "WAITING_ACTION" | "STALLED_SUSPECTED" | "SUCCEEDED" | "FAILED_OUTPUT" | "FAILED_TRANSPORT" | "UNCERTAIN" | "BLOCKED" | "CANCELLED";

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

  loadRun(runId: string): { run: RunDocument; authority: RunAuthority } {
    assertFilesystemId(runId, "run_id");
    const dir = this.resolve("runs", runId);
    return {
      run: JSON.parse(readFileSync(path.join(dir, "run.json"), "utf8")) as RunDocument,
      authority: JSON.parse(readFileSync(path.join(dir, "run-authority.json"), "utf8")) as RunAuthority,
    };
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

  loadIntent<T = unknown>(runId: string, operationId: string): T {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return JSON.parse(readFileSync(this.resolve("runs", runId, "operations", operationId, "intent.json"), "utf8")) as T;
  }

  listOperations(runId: string): OperationDocument[] {
    assertFilesystemId(runId, "run_id");
    return this.listOperationIds(runId).map((operationId) => this.loadOperation(runId, operationId)).sort((left, right) => left.sequence - right.sequence);
  }

  loadResult(runId: string, operationId: string): unknown {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    return JSON.parse(readFileSync(this.resolve("runs", runId, "operations", operationId, "result.json"), "utf8")) as unknown;
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

  writeResult(runId: string, operationId: string, result: unknown): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    this.writeJsonExclusive(this.resolve("runs", runId, "operations", operationId, "result.json"), result);
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

  writeArtifact(runId: string, operationId: string, name: string, content: string): void {
    assertFilesystemId(runId, "run_id");
    assertFilesystemId(operationId, "operation_id");
    assertFilesystemId(name, "artifact name");
    const filePath = this.resolve("runs", runId, "operations", operationId, `${name}.md`);
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
      if (current.run_id !== runId || current.operation_id !== operationId || current.status !== "CLAIMED") throw new Error("Semantic action claim identity mismatch");
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
