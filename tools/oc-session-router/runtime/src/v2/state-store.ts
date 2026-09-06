import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonical, digest, generateMessageId, participantKey, StoreError, text } from "./contracts.js";
import type { ActionInput, Correlation, Interpretation, Json, Observation, Operation, TerminalOutcome, WorkContext, WorkView } from "./contracts.js";

type Row = Record<string, string | number | bigint | Uint8Array | null>;
export type StoreCheckpoint = "PREPARE_OPERATION_INSERTED" | "PREPARE_COMMITTED" |
  "DISPATCH_COMMITTED" | "RESULT_INSERTED" | "RESULT_COMMITTED";
interface StoreOptions {
  /** Test seam only. Not configurable from CLI or a submitted work request. */
  checkpoint?: (point: StoreCheckpoint) => void;
  now?: () => string;
}

const effects = new Set(["READ_ONLY", "WORKSPACE_WRITE", "LOCAL_COMMIT", "SESSION_MAINTENANCE"]);
const kinds = new Set(["LIFECYCLE", "CLARIFICATION", "COMPACT", "RESTORE"]);
const activities = new Set(["BUSY", "IDLE", "UNKNOWN", "COMPLETED", "FAILED"]);

/** All transactions are synchronous and short; HTTP/model work belongs outside. */
export class OperationStore {
  private readonly db: DatabaseSync;
  private readonly options: StoreOptions;

  constructor(databasePath: string, options: StoreOptions = {}) {
    this.options = options;
    if (!path.isAbsolute(databasePath)) throw new StoreError("INVALID_INPUT");
    const resolved = path.resolve(databasePath);
    for (let current = resolved; ; current = path.dirname(current)) {
      if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new StoreError("INVALID_INPUT");
      if (path.dirname(current) === current) break;
    }
    let opened: DatabaseSync | undefined;
    try {
      mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
      opened = new DatabaseSync(resolved);
      this.db = opened;
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
      this.transaction(() => {
        const version = Number(this.db.prepare("PRAGMA user_version").get()!.user_version);
        if (version !== 0 && version !== 1) throw new StoreError("SCHEMA_UNSUPPORTED");
        if (version === 0) {
          const existing = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
          if (existing.length) throw new StoreError("SCHEMA_UNSUPPORTED");
          this.db.exec(`
            CREATE TABLE work_items (
              work_id TEXT PRIMARY KEY, context_json TEXT NOT NULL,
              created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
              paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)), pause_reference TEXT,
              observations_json TEXT NOT NULL DEFAULT '{}'
            );
            CREATE TABLE operations (
              operation_id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE,
              work_id TEXT NOT NULL REFERENCES work_items(work_id),
              action_key TEXT NOT NULL, participant_key TEXT NOT NULL,
              action_json TEXT NOT NULL, input_digest TEXT NOT NULL,
              created_at TEXT NOT NULL, dispatch_started_at TEXT, acknowledged_at TEXT,
              correlation_json TEXT NOT NULL DEFAULT '{}', observation_json TEXT,
              completed_at TEXT, UNIQUE(work_id, action_key)
            );
            CREATE TABLE results (
              operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
              outcome_json TEXT NOT NULL, result_digest TEXT NOT NULL,
              interpretation_json TEXT
            );
            CREATE TABLE session_claims (
              participant_key TEXT PRIMARY KEY,
              operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id)
            );
            PRAGMA user_version=1;
          `);
        }
        // Validate required structure without scanning history on each CLI start.
        this.db.prepare("SELECT w.context_json, w.observations_json, o.action_json, o.message_id, r.result_digest, s.participant_key FROM work_items w LEFT JOIN operations o ON o.work_id=w.work_id LEFT JOIN results r ON r.operation_id=o.operation_id LEFT JOIN session_claims s ON s.operation_id=o.operation_id LIMIT 0").all();
      });
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
    } catch (error) {
      opened?.close();
      throw error instanceof StoreError ? error : new StoreError("STORE_UNAVAILABLE");
    }
  }

  close(): void { this.db.close(); }
  private now(): string { return this.options.now?.() ?? new Date().toISOString(); }

  private transaction<T>(action: () => T): T {
    let begun = false;
    try {
      this.db.exec("BEGIN IMMEDIATE"); begun = true;
      const result = action();
      this.db.exec("COMMIT"); begun = false;
      return result;
    } catch (error) {
      if (begun) { try { this.db.exec("ROLLBACK"); } catch { /* preserve original failure */ } }
      throw error instanceof StoreError ? error : new StoreError("STORE_UNAVAILABLE");
    }
  }

  private row(operationId: string): Row {
    text(operationId);
    const row = this.db.prepare(`SELECT o.*, r.outcome_json, r.result_digest, r.interpretation_json
      FROM operations o LEFT JOIN results r ON r.operation_id=o.operation_id WHERE o.operation_id=?`).get(operationId);
    if (!row) throw new StoreError("NOT_FOUND");
    return row as Row;
  }

  getOperation(operationId: string): Operation {
    try {
      const row = this.row(operationId);
      return {
        operationId: String(row.operation_id), messageId: String(row.message_id), action: JSON.parse(String(row.action_json)) as ActionInput,
        participantKey: String(row.participant_key), inputDigest: String(row.input_digest), createdAt: String(row.created_at),
        dispatchStartedAt: row.dispatch_started_at as string | null, acknowledgedAt: row.acknowledged_at as string | null,
        correlation: JSON.parse(String(row.correlation_json)) as Correlation,
        observation: row.observation_json ? JSON.parse(String(row.observation_json)) as Observation : null,
        completedAt: row.completed_at as string | null,
        outcome: row.outcome_json ? JSON.parse(String(row.outcome_json)) as TerminalOutcome : null,
        resultDigest: row.result_digest as string | null,
        interpretation: row.interpretation_json ? JSON.parse(String(row.interpretation_json)) as Interpretation : null,
      };
    } catch (error) { throw error instanceof StoreError ? error : new StoreError("STORE_UNAVAILABLE"); }
  }

  openWork(context: WorkContext): WorkView {
    for (const field of [context.workId, context.target, context.directory, context.instructionReference, context.scope, context.stoppingPoint]) text(field);
    if (!path.isAbsolute(context.directory) || !Array.isArray(context.allowedEffects) ||
        !context.allowedEffects.length || context.allowedEffects.some(effect => !effects.has(effect))) throw new StoreError("INVALID_INPUT");
    const encoded = canonical(context);
    this.transaction(() => {
      const old = this.db.prepare("SELECT context_json FROM work_items WHERE work_id=?").get(context.workId);
      if (old) {
        if (old.context_json !== encoded) throw new StoreError("INPUT_CONFLICT");
        return;
      }
      const now = this.now();
      this.db.prepare("INSERT INTO work_items(work_id,context_json,created_at,updated_at) VALUES(?,?,?,?)").run(context.workId, encoded, now, now);
    });
    return this.getWork(context.workId);
  }

  getWork(workId: string): WorkView {
    text(workId);
    try {
      // A read transaction produces one consistent view, without a write lock.
      this.db.exec("BEGIN");
      const row = this.db.prepare("SELECT * FROM work_items WHERE work_id=?").get(workId);
      if (!row) throw new StoreError("NOT_FOUND");
      const operations = this.db.prepare("SELECT operation_id FROM operations WHERE work_id=? ORDER BY created_at, rowid").all(workId);
      const view: WorkView = {
        context: JSON.parse(String(row.context_json)) as WorkContext,
        paused: row.paused === 1, pauseReference: row.pause_reference as string | null,
        observations: JSON.parse(String(row.observations_json)) as WorkView["observations"],
        operations: operations.map(operation => this.getOperation(String(operation.operation_id))),
      };
      this.db.exec("COMMIT");
      return view;
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch { /* no transaction may be active */ }
      throw error instanceof StoreError ? error : new StoreError("STORE_UNAVAILABLE");
    }
  }

  /** The caller must supply the actual Owner instruction, including for resume. */
  recordOwnerPause(workId: string, paused: boolean, instructionReference: string): void {
    text(workId); text(instructionReference);
    if (typeof paused !== "boolean") throw new StoreError("INVALID_INPUT");
    this.transaction(() => {
      const changed = this.db.prepare("UPDATE work_items SET paused=?,pause_reference=?,updated_at=? WHERE work_id=?")
        .run(paused ? 1 : 0, instructionReference, this.now(), workId);
      if (!changed.changes) throw new StoreError("NOT_FOUND");
    });
  }

  recordSessionObservation(workId: string, role: string, observation: { [key: string]: Json }): void {
    text(workId); text(role); text(observation.observedAt);
    if (!Number.isFinite(Date.parse(observation.observedAt))) throw new StoreError("INVALID_INPUT");
    canonical(observation);
    this.transaction(() => {
      const work = this.db.prepare("SELECT observations_json FROM work_items WHERE work_id=?").get(workId);
      if (!work) throw new StoreError("NOT_FOUND");
      const previous = JSON.parse(String(work.observations_json)) as Record<string, { observedAt?: string }>;
      const previousRole = Object.hasOwn(previous, role) ? previous[role] : undefined;
      if (previousRole?.observedAt && Date.parse(previousRole.observedAt) > Date.parse(String(observation.observedAt))) return;
      this.db.prepare("UPDATE work_items SET observations_json=?,updated_at=? WHERE work_id=?")
        .run(canonical({ ...previous, [role]: observation }), this.now(), workId);
    });
  }

  prepareAction(action: ActionInput): { operation: Operation; created: boolean } {
    for (const field of [action.workId, action.actionKey, action.recipientRole, action.command]) text(field);
    if (!kinds.has(action.kind) || !effects.has(action.effect) || !action.input || typeof action.input !== "object" || Array.isArray(action.input)) throw new StoreError("INVALID_INPUT");
    if (action.predecessor !== null) text(action.predecessor);
    const key = participantKey(action.participant), inputDigest = digest(action), encoded = canonical(action);
    const prepared = this.transaction(() => {
      const prior = this.db.prepare("SELECT operation_id,input_digest FROM operations WHERE work_id=? AND action_key=?").get(action.workId, action.actionKey);
      if (prior) {
        if (prior.input_digest !== inputDigest) throw new StoreError("INPUT_CONFLICT");
        return { operationId: String(prior.operation_id), created: false };
      }
      const work = this.db.prepare("SELECT context_json,paused FROM work_items WHERE work_id=?").get(action.workId);
      if (!work) throw new StoreError("NOT_FOUND");
      if (work.paused === 1) throw new StoreError("WORK_PAUSED");
      if (!(JSON.parse(String(work.context_json)) as WorkContext).allowedEffects.includes(action.effect)) throw new StoreError("EFFECT_NOT_ALLOWED");
      if (action.predecessor) {
        const previous = this.row(action.predecessor);
        if (previous.work_id !== action.workId || !previous.completed_at) throw new StoreError("INPUT_CONFLICT");
      }
      if (this.db.prepare("SELECT operation_id FROM session_claims WHERE participant_key=?").get(key)) throw new StoreError("PARTICIPANT_BUSY");
      const operationId = `op-${randomUUID()}`;
      this.db.prepare("INSERT INTO operations(operation_id,message_id,work_id,action_key,participant_key,action_json,input_digest,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(operationId, generateMessageId(), action.workId, action.actionKey, key, encoded, inputDigest, this.now());
      this.options.checkpoint?.("PREPARE_OPERATION_INSERTED");
      this.db.prepare("INSERT INTO session_claims(participant_key,operation_id) VALUES(?,?)").run(key, operationId);
      return { operationId, created: true };
    });
    if (prepared.created) this.options.checkpoint?.("PREPARE_COMMITTED");
    return { operation: this.getOperation(prepared.operationId), created: prepared.created };
  }

  /** True for exactly one caller. False never authorizes another network attempt. */
  startDispatch(operationId: string): boolean {
    const started = this.transaction(() => {
      const operation = this.row(operationId);
      if ((JSON.parse(String(operation.action_json)) as ActionInput).kind === "LEGACY") return false;
      if (operation.dispatch_started_at !== null || operation.completed_at !== null) return false;
      const work = this.db.prepare("SELECT paused FROM work_items WHERE work_id=?").get(String(operation.work_id))!;
      if (work.paused === 1) throw new StoreError("WORK_PAUSED");
      const claim = this.db.prepare("SELECT operation_id FROM session_claims WHERE participant_key=?").get(String(operation.participant_key));
      if (claim?.operation_id !== operationId) throw new StoreError("INPUT_CONFLICT");
      this.db.prepare("UPDATE operations SET dispatch_started_at=? WHERE operation_id=?").run(this.now(), operationId);
      return true;
    });
    if (started) this.options.checkpoint?.("DISPATCH_COMMITTED");
    return started;
  }

  /** Close only a proven unsent local preparation; never interrupts a session. */
  abandonPrepared(operationId: string, reason: string): Operation {
    text(reason);
    const outcome: TerminalOutcome = { execution: "FAILED", evidenceReferences: [`pre-dispatch:${reason}`], reason: "NOT_DISPATCHED" };
    const encoded = canonical(outcome), resultDigest = digest(outcome);
    this.transaction(() => {
      const row = this.row(operationId);
      if (row.dispatch_started_at !== null || (JSON.parse(String(row.action_json)) as ActionInput).kind === "LEGACY") throw new StoreError("INPUT_CONFLICT");
      if (row.result_digest) {
        if (row.result_digest !== resultDigest) throw new StoreError("RESULT_CONFLICT");
        return;
      }
      this.db.prepare("INSERT INTO results(operation_id,outcome_json,result_digest) VALUES(?,?,?)").run(operationId, encoded, resultDigest);
      this.db.prepare("UPDATE operations SET completed_at=? WHERE operation_id=?").run(this.now(), operationId);
      this.db.prepare("DELETE FROM session_claims WHERE operation_id=?").run(operationId);
    });
    return this.getOperation(operationId);
  }

  acknowledge(operationId: string, correlation: Correlation): Operation {
    if (!correlation.rootMessageId && !correlation.responseMessageId) throw new StoreError("INVALID_INPUT");
    for (const value of Object.values(correlation)) text(value);
    this.transaction(() => {
      const row = this.row(operationId);
      if (!row.dispatch_started_at && (JSON.parse(String(row.action_json)) as ActionInput).kind !== "LEGACY") throw new StoreError("DISPATCH_NOT_STARTED");
      const previous = JSON.parse(String(row.correlation_json)) as Correlation;
      for (const key of ["rootMessageId", "responseMessageId"] as const) {
        if (previous[key] && correlation[key] && previous[key] !== correlation[key]) throw new StoreError("CORRELATION_CONFLICT");
      }
      const combined = { ...previous, ...correlation };
      this.db.prepare("UPDATE operations SET acknowledged_at=COALESCE(acknowledged_at,?),correlation_json=? WHERE operation_id=?")
        .run(this.now(), canonical(combined), operationId);
    });
    return this.getOperation(operationId);
  }

  observe(operationId: string, observation: Observation): Operation {
    if (!activities.has(observation.activity) || !Number.isFinite(Date.parse(observation.observedAt))) throw new StoreError("INVALID_INPUT");
    const encoded = canonical(observation);
    this.transaction(() => {
      const row = this.row(operationId);
      const previous = row.observation_json ? JSON.parse(String(row.observation_json)) as Observation : null;
      if (previous && Date.parse(previous.observedAt) > Date.parse(observation.observedAt)) return;
      this.db.prepare("UPDATE operations SET observation_json=? WHERE operation_id=?").run(encoded, operationId);
    });
    return this.getOperation(operationId);
  }

  finish(operationId: string, outcome: TerminalOutcome): Operation {
    if (!["COMPLETED", "FAILED"].includes(outcome.execution) || !Array.isArray(outcome.evidenceReferences) || !outcome.evidenceReferences.length) throw new StoreError("INVALID_INPUT");
    outcome.evidenceReferences.forEach(text);
    if (outcome.response) {
      text(outcome.response.messageId);
      if (outcome.response.rootMessageId !== undefined) text(outcome.response.rootMessageId);
      if (typeof outcome.response.text !== "string") throw new StoreError("INVALID_INPUT");
    }
    const encoded = canonical(outcome), resultDigest = digest(outcome);
    const changed = this.transaction(() => {
      const row = this.row(operationId);
      if (!row.dispatch_started_at && (JSON.parse(String(row.action_json)) as ActionInput).kind !== "LEGACY") throw new StoreError("DISPATCH_NOT_STARTED");
      if (row.result_digest) {
        if (row.result_digest !== resultDigest) throw new StoreError("RESULT_CONFLICT");
        return false;
      }
      const correlation = JSON.parse(String(row.correlation_json)) as Correlation;
      if (outcome.response) {
        if ((correlation.responseMessageId && correlation.responseMessageId !== outcome.response.messageId) ||
            (correlation.rootMessageId && outcome.response.rootMessageId && correlation.rootMessageId !== outcome.response.rootMessageId)) throw new StoreError("CORRELATION_CONFLICT");
        correlation.responseMessageId = outcome.response.messageId;
        if (outcome.response.rootMessageId) correlation.rootMessageId = outcome.response.rootMessageId;
      }
      this.db.prepare("INSERT INTO results(operation_id,outcome_json,result_digest) VALUES(?,?,?)").run(operationId, encoded, resultDigest);
      this.options.checkpoint?.("RESULT_INSERTED");
      const now = this.now();
      this.db.prepare("UPDATE operations SET completed_at=?,acknowledged_at=COALESCE(acknowledged_at,?),correlation_json=? WHERE operation_id=?")
        .run(now, outcome.response ? now : null, canonical(correlation), operationId);
      this.db.prepare("DELETE FROM session_claims WHERE operation_id=?").run(operationId);
      return true;
    });
    if (changed) this.options.checkpoint?.("RESULT_COMMITTED");
    return this.getOperation(operationId);
  }

  interpret(operationId: string, interpretation: Interpretation): Operation {
    text(interpretation.resultDigest); text(interpretation.responsibleRole); text(interpretation.decision);
    if (!Array.isArray(interpretation.evidenceReferences) || !interpretation.evidenceReferences.length) throw new StoreError("INVALID_INPUT");
    interpretation.evidenceReferences.forEach(text);
    const encoded = canonical(interpretation);
    this.transaction(() => {
      const row = this.row(operationId);
      if (!row.result_digest || row.result_digest !== interpretation.resultDigest) throw new StoreError("RESULT_CONFLICT");
      const outcome = JSON.parse(String(row.outcome_json)) as TerminalOutcome;
      if (!outcome.response && !outcome.artifact) throw new StoreError("RESULT_CONFLICT");
      if (row.interpretation_json && row.interpretation_json !== encoded) throw new StoreError("RESULT_CONFLICT");
      this.db.prepare("UPDATE results SET interpretation_json=? WHERE operation_id=?").run(encoded, operationId);
    });
    return this.getOperation(operationId);
  }

  /** Import is a local historical fact, not prepare+startDispatch. Always pause. */
  importLegacy(action: ActionInput, evidence: { rootMessageId?: string; responseMessageId?: string; outcome?: TerminalOutcome; pauseReference: string }): { operation: Operation; created: boolean } {
    if (action.kind !== "LEGACY") throw new StoreError("INVALID_INPUT");
    for (const field of [action.workId, action.actionKey, action.recipientRole, action.command, evidence.pauseReference]) text(field);
    for (const id of [evidence.rootMessageId, evidence.responseMessageId]) if (id !== undefined && !/^msg[\w-]+$/.test(id)) throw new StoreError("INVALID_INPUT");
    const key = participantKey(action.participant), encoded = canonical(action), inputDigest = digest(action);
    const imported = this.transaction(() => {
      const prior = this.db.prepare("SELECT operation_id,input_digest FROM operations WHERE work_id=? AND action_key=?").get(action.workId, action.actionKey);
      if (prior) {
        if (prior.input_digest !== inputDigest) throw new StoreError("INPUT_CONFLICT");
        return { operationId: String(prior.operation_id), created: false };
      }
      if (!this.db.prepare("SELECT work_id FROM work_items WHERE work_id=?").get(action.workId)) throw new StoreError("NOT_FOUND");
      if (!evidence.outcome && this.db.prepare("SELECT operation_id FROM session_claims WHERE participant_key=?").get(key)) throw new StoreError("PARTICIPANT_BUSY");
      const now = this.now(), operationId = `op-${randomUUID()}`;
      // A local surrogate is deliberately NOT an OpenCode message ID.
      const messageId = evidence.rootMessageId ?? `legacy-${randomUUID()}`;
      const correlation: Correlation = { ...(evidence.rootMessageId ? { rootMessageId: evidence.rootMessageId } : {}), ...(evidence.responseMessageId ? { responseMessageId: evidence.responseMessageId } : {}) };
      const acknowledged = Object.keys(correlation).length > 0 || evidence.outcome ? now : null;
      const observation: Observation = { observedAt: now, activity: evidence.outcome ? "COMPLETED" : "UNKNOWN", context: { reason: evidence.outcome ? "LEGACY_ACCEPTED_ARTIFACT" : "LEGACY_IMPORTED_UNRESOLVED" } };
      this.db.prepare("INSERT INTO operations(operation_id,message_id,work_id,action_key,participant_key,action_json,input_digest,created_at,acknowledged_at,correlation_json,observation_json,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(operationId, messageId, action.workId, action.actionKey, key, encoded, inputDigest, now, acknowledged, canonical(correlation), canonical(observation), evidence.outcome ? now : null);
      if (evidence.outcome) this.db.prepare("INSERT INTO results(operation_id,outcome_json,result_digest) VALUES(?,?,?)").run(operationId, canonical(evidence.outcome), digest(evidence.outcome));
      else this.db.prepare("INSERT INTO session_claims(participant_key,operation_id) VALUES(?,?)").run(key, operationId);
      this.db.prepare("UPDATE work_items SET paused=1,pause_reference=?,updated_at=? WHERE work_id=?").run(evidence.pauseReference, now, action.workId);
      return { operationId, created: true };
    });
    return { operation: this.getOperation(imported.operationId), created: imported.created };
  }

  /** Only importer recovery binds an otherwise unknown historical root. */
  bindLegacyRoot(operationId: string, rootMessageId: string): Operation {
    if (!/^msg[\w-]+$/.test(rootMessageId)) throw new StoreError("INVALID_INPUT");
    this.transaction(() => {
      const row = this.row(operationId);
      if ((JSON.parse(String(row.action_json)) as ActionInput).kind !== "LEGACY" || row.completed_at) throw new StoreError("INPUT_CONFLICT");
      if (String(row.message_id).startsWith("msg") && row.message_id !== rootMessageId) throw new StoreError("CORRELATION_CONFLICT");
      this.db.prepare("UPDATE operations SET message_id=? WHERE operation_id=?").run(rootMessageId, operationId);
    });
    return this.acknowledge(operationId, { rootMessageId });
  }
}
