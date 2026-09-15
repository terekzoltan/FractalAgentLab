import { StoreError, type Operation } from "./contracts.js";
import { RouterError } from "./routing.js";
import { AdapterError } from "./opencode-adapter.js";
import type { OperationStore } from "./state-store.js";

export type PreparationPhase = "ARGUMENTS" | "STORE_OPEN" | "REQUEST_READ" | "CONFIGURATION" |
  "REQUEST_VALIDATION" | "WORK_CONTEXT" | "PARTICIPANT_BINDING" | "PARTICIPANT_VERIFICATION" |
  "COMPACT_BASELINE" | "SOURCE_PACKET" | "COMMAND_RESOLUTION" | "PERSISTENCE" | "EXECUTOR_START" | "RESULT_VIEW";
export type PreparationReporter = (phase: PreparationPhase) => void;

// Only fixed router-owned codes enter normal output. Error messages, names,
// stacks, causes, requests and native filesystem/SQLite errors stay private.
const categories: Record<string, readonly string[]> = {
  REQUEST_INPUT: ["INPUT_FILE_UNREADABLE", "INVALID_INPUT", "INVALID_ARGUMENTS", "ACTION_KIND_UNSUPPORTED", "STATE_ROOT_MUST_BE_ABSOLUTE"],
  SOURCE_INPUT: ["SOURCE_REFERENCES_INVALID", "SOURCE_REFERENCE_INVALID", "SOURCE_MODE_INVALID", "SOURCE_SELECTION_MODE_INVALID", "SOURCE_SELECTION_AMBIGUOUS", "SOURCE_LINES_INVALID", "SOURCE_HEADING_INVALID", "SOURCE_HEADING_AMBIGUOUS", "SOURCE_HEADING_NOT_FOUND", "SOURCE_PATH_UNSAFE"],
  SOURCE_UNAVAILABLE: ["SOURCE_UNAVAILABLE", "SOURCE_CHANGED", "SOURCE_TOO_LARGE", "SOURCE_TEXT_ENCODING_INVALID", "RESULT_SOURCE_UNAVAILABLE"],
  AUTHORITY: ["WORK_PAUSED", "EFFECT_NOT_ALLOWED", "ROLE_COMMAND_NOT_ALLOWED", "ORCHESTRATOR_COMPACT_IS_MANUAL"],
  CONFLICT: ["INPUT_CONFLICT", "AUTHORIZATION_CHANGED", "WORK_HAS_PENDING_OPERATIONS"],
  CONFIGURATION: ["CONFIGURATION_UNSUPPORTED", "PARTICIPANT_NOT_CONFIGURED", "TARGET_DIRECTORY_MISMATCH", "REVIEWER_AUTHOR_COLLISION", "CREDENTIALS_UNAVAILABLE"],
  PARTICIPANT: ["PARTICIPANT_IDENTITY_MISMATCH", "PARTICIPANT_BUSY", "SESSION_ACTIVITY_UNAVAILABLE"],
  COMMAND: ["COMMAND_UNAVAILABLE", "COMPACT_MODEL_UNAVAILABLE"],
  STORE: ["STORE_UNAVAILABLE", "SCHEMA_UNSUPPORTED", "NOT_FOUND", "WORK_STORE_NOT_FOUND"],
  EXECUTOR: ["EXECUTOR_START_FAILED"],
};

type Facts = {
  operationExists: boolean | null; operationId: string | null; dispatchStarted: boolean | null;
  delivery: "NOT_SENT" | "POSSIBLE" | "DELIVERED" | "UNKNOWN";
  factsSource: "STORE_SNAPSHOT" | "PRIOR_STORE_SNAPSHOT" | "PREPARE_RESULT" | "UNAVAILABLE"; factsObservedAt: string | null;
};
export class PreparationFailure extends Error {
  constructor(readonly view: {
    error_code: string; phase: PreparationPhase; category: string; operationCreated: boolean | null;
    recovery: "INSPECT_EXISTING_OPERATION" | "RECONCILE_EXISTING_OPERATION" | "CORRECT_INPUT" | "INSPECT_WORK_BEFORE_RETRY";
  } & Facts) { super(view.error_code); this.name = "PreparationFailure"; }
}

/** Invocation-local diagnostics only: never creates, retries or alters an operation. */
export class PreparationDiagnostics {
  private phase: PreparationPhase = "ARGUMENTS";
  private persistenceEntered = false;
  private store?: Pick<OperationStore, "getWork" | "getOperation">;
  private identity?: { workId: string; actionKey: string };
  private existingSnapshot?: { operation: Operation; observedAt: string };
  private preparedResult?: { operation: Operation; created: boolean; observedAt: string };

  readonly at: PreparationReporter = phase => {
    this.phase = phase;
    if (phase === "PERSISTENCE") this.persistenceEntered = true;
  };
  useStore(store: Pick<OperationStore, "getWork" | "getOperation">): void { this.store = store; }
  identify(request: unknown): void {
    if (!request || typeof request !== "object" || Array.isArray(request)) return;
    const { workId, actionKey } = request as Record<string, unknown>;
    if (typeof workId !== "string" || !workId.trim() || typeof actionKey !== "string" || !actionKey.trim()) return;
    this.identity = { workId, actionKey };
    try {
      const operation = this.store?.getWork(workId).operations.find(item => item.action.actionKey === actionKey);
      if (operation) this.existingSnapshot = { operation, observedAt: new Date().toISOString() };
    } catch { /* Diagnostic reads never decide admission or hide its actual error. */ }
  }
  prepared(result: { operation: Operation; created: boolean }): void {
    this.preparedResult = { ...result, observedAt: new Date().toISOString() };
  }
  private facts(): Facts {
    const unknown: Facts = { operationExists: null, operationId: null, dispatchStarted: null, delivery: "UNKNOWN", factsSource: "UNAVAILABLE", factsObservedAt: null };
    try {
      if (!this.store || (!this.identity && !this.preparedResult)) return unknown;
      const operation = this.preparedResult ? this.store.getOperation(this.preparedResult.operation.operationId)
        : this.store.getWork(this.identity!.workId).operations.find(item => item.action.actionKey === this.identity!.actionKey);
      const factsObservedAt = new Date().toISOString();
      if (!operation) return { ...unknown, operationExists: false, dispatchStarted: false, delivery: "NOT_SENT", factsSource: "STORE_SNAPSHOT", factsObservedAt };
      return { operationExists: true, operationId: operation.operationId, dispatchStarted: operation.dispatchStartedAt !== null,
        delivery: operation.acknowledgedAt ? "DELIVERED" : operation.dispatchStartedAt || operation.action.kind === "LEGACY" ? "POSSIBLE" : "NOT_SENT",
        factsSource: "STORE_SNAPSHOT", factsObservedAt };
    } catch {
      // A stale prepared result can prove existing delivery, but cannot prove
      // that a detached executor has still not started since that result.
      const retained = this.preparedResult ?? this.existingSnapshot;
      if (!retained) return unknown;
      const operation = retained.operation;
      return { operationExists: true, operationId: operation.operationId, dispatchStarted: operation.dispatchStartedAt ? true : null,
        delivery: operation.acknowledgedAt ? "DELIVERED" : operation.dispatchStartedAt || operation.action.kind === "LEGACY" ? "POSSIBLE" : "UNKNOWN",
        factsSource: this.preparedResult ? "PREPARE_RESULT" : "PRIOR_STORE_SNAPSHOT", factsObservedAt: retained.observedAt };
    }
  }
  failure(error: unknown): PreparationFailure {
    if (error instanceof PreparationFailure) return error;
    const adapterCode = error instanceof AdapterError && ["INVALID_INPUT", "GET_TIMEOUT", "NETWORK_ERROR", "RESPONSE_TOO_LARGE", "ACKNOWLEDGEMENT_FAILED"].includes(error.code) ? error.code : undefined;
    const known = adapterCode ?? (error instanceof RouterError || error instanceof StoreError ? error.code : undefined);
    const category = adapterCode ? "ADAPTER" : Object.entries(categories).find(([, codes]) => known !== undefined && codes.includes(known))?.[0];
    const facts = this.facts();
    return new PreparationFailure({ error_code: category ? known! : "PREPARATION_FAILED", phase: this.phase,
      category: category ?? "UNEXPECTED_FAILURE", operationCreated: this.preparedResult?.created ?? (this.persistenceEntered ? null : false), ...facts,
      recovery: facts.operationExists ? (facts.delivery === "POSSIBLE" ? "RECONCILE_EXISTING_OPERATION" : "INSPECT_EXISTING_OPERATION")
        : facts.operationExists === false && !this.persistenceEntered ? "CORRECT_INPUT" : "INSPECT_WORK_BEFORE_RETRY" });
  }
}
