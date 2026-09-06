import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import type { Operation, WorkContext } from "./contracts.js";
import { StoreError, text } from "./contracts.js";
import { RouterEngine, type CompactRequest, type SubmitRequest } from "./engine.js";
import { OperationStore } from "./state-store.js";
import { RouterError, type RouterConfiguration } from "./routing.js";
import { importLegacyOperation, type LegacyImportRequest } from "./legacy-import.js";

const here = fileURLToPath(import.meta.url);
function jsonFile<T>(file: string): T {
  try { return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as T; }
  catch { throw new RouterError("INPUT_FILE_UNREADABLE"); }
}
function options(argv: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || Object.hasOwn(values, key)) throw new RouterError("INVALID_ARGUMENTS");
    values[key] = value;
  }
  return values;
}
function required(values: Record<string, string>, key: string): string {
  const value = values[key]; text(value); return value;
}

/** Normal status contains no origin, credential, session/root message IDs or transcript. */
export function operationView(operation: Operation) {
  return {
    operationId: operation.operationId, workId: operation.action.workId,
    actionKey: operation.action.actionKey, recipientRole: operation.action.recipientRole,
    kind: operation.action.kind, command: operation.action.command,
    delivery: operation.acknowledgedAt ? "DELIVERED" : operation.dispatchStartedAt || operation.action.kind === "LEGACY" ? "POSSIBLE" : "NOT_SENT",
    execution: operation.outcome?.execution ?? (operation.dispatchStartedAt || operation.action.kind === "LEGACY" ? "PENDING" : "PREPARED"),
    outputAvailable: Boolean(operation.outcome?.response?.text ?? operation.outcome?.artifact?.text), resultDigest: operation.resultDigest,
    interpretation: operation.interpretation ? { responsibleRole: operation.interpretation.responsibleRole, decision: operation.interpretation.decision } : null,
    observedAt: operation.observation?.observedAt ?? null,
    // Finished operation facts outrank stale pending diagnostics. Current session
    // activity remains separately available in the work's session observations.
    activity: operation.completedAt ? operation.outcome?.execution ?? "UNKNOWN" : operation.observation?.activity ?? "UNKNOWN",
    reason: operation.completedAt ? operation.outcome?.reason ?? null : operation.observation?.context?.reason ?? null,
    autoAdvance: false,
  };
}

async function retainExecutor(stateRoot: string, configurationPath: string, operationId: string): Promise<void> {
  // A transport waiter, not a daemon or scheduler. It exits after this one request.
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "LOCALAPPDATA", "USERPROFILE", "OPENCODE_SERVER_USERNAME", "OPENCODE_SERVER_PASSWORD"]) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  const child = spawn(process.execPath, ["--experimental-sqlite", here, "execute-operation", "--state-root", stateRoot, "--config", configurationPath, "--operation-id", operationId], {
    detached: true, windowsHide: true, stdio: "ignore", env: environment,
    cwd: path.resolve(path.dirname(here), "../../.."),
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", () => reject(new RouterError("EXECUTOR_START_FAILED")));
    child.once("spawn", resolve);
  });
  child.unref();
}

export async function runCli(argv: string[]): Promise<unknown> {
  const [action, ...rest] = argv;
  if (!action || action === "help" || action === "--help") return {
    interface: "fal-router/v2", actions: ["open-work", "submit", "compact", "restore", "inspect", "read-result", "wait", "reconcile", "interpret", "observe-session", "record-pause", "import-legacy"],
    configuration: "Private router-config.json; credentials are process environment only.",
  };
  if (!["open-work", "submit", "compact", "restore", "inspect", "read-result", "wait", "reconcile", "interpret", "observe-session", "record-pause", "import-legacy", "execute-operation"].includes(action)) throw new RouterError("ACTION_UNSUPPORTED");
  const values = options(rest);
  const actionOptions: Record<string, string[]> = {
    "open-work": ["--request"], submit: ["--request"], compact: ["--request"], restore: ["--request"],
    inspect: ["--operation-id", "--work-id"], "read-result": ["--operation-id"], wait: ["--operation-id", "--wait-ms"],
    reconcile: ["--operation-id"], interpret: ["--request"], "observe-session": ["--work-id", "--role"],
    "record-pause": ["--request"], "import-legacy": ["--request"], "execute-operation": ["--operation-id", "--idle-wait-ms"],
  };
  const accepted = new Set(["--state-root", "--config", ...actionOptions[action]!]);
  if (Object.keys(values).some(key => !accepted.has(key))) throw new RouterError("INVALID_ARGUMENTS");
  const stateRoot = required(values, "--state-root");
  if (!path.isAbsolute(stateRoot)) throw new RouterError("STATE_ROOT_MUST_BE_ABSOLUTE");
  const configurationPath = values["--config"] ?? path.join(stateRoot, "router-config.json");
  const database = path.join(stateRoot, "router.sqlite");
  if (action !== "open-work" && !existsSync(database)) throw new RouterError("WORK_STORE_NOT_FOUND");
  const store = new OperationStore(database);
  const engine = () => {
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    if (!password) throw new RouterError("CREDENTIALS_UNAVAILABLE");
    return new RouterEngine(store, jsonFile<RouterConfiguration>(configurationPath), {
      username: process.env.OPENCODE_SERVER_USERNAME || "opencode", password,
    });
  };
  const readRequest = <T>() => jsonFile<T>(required(values, "--request"));
  try {
    if (action === "open-work") {
      const context = readRequest<WorkContext>();
      const configuration = jsonFile<RouterConfiguration>(configurationPath);
      // Opening local intent does not need a server or credentials.
      const localEngine = new RouterEngine(store, configuration, { username: "", password: "" });
      const work = localEngine.openWork(context);
      return { workId: work.context.workId, target: work.context.target, paused: work.paused, operationCount: work.operations.length, autoAdvance: false };
    }
    if (action === "inspect") {
      if (values["--operation-id"]) return operationView(store.getOperation(values["--operation-id"]));
      const work = store.getWork(required(values, "--work-id"));
      return { workId: work.context.workId, target: work.context.target, instructionReference: work.context.instructionReference, stoppingPoint: work.context.stoppingPoint,
        paused: work.paused, pauseReference: work.pauseReference, observations: work.observations, operations: work.operations.map(operationView), autoAdvance: false };
    }
    if (action === "read-result") {
      const operation = store.getOperation(required(values, "--operation-id"));
      // Explicit private artifact read, not normal status or a full history export.
      return { operationId: operation.operationId, resultDigest: operation.resultDigest, text: operation.outcome?.response?.text ?? operation.outcome?.artifact?.text ?? null };
    }
    if (action === "import-legacy") {
      const imported = importLegacyOperation(store, jsonFile<RouterConfiguration>(configurationPath), readRequest<LegacyImportRequest>());
      return { ...operationView(imported.operation), created: imported.created, imported: true, workPaused: store.getWork(imported.operation.action.workId).paused, lifecycleSend: false };
    }
    if (action === "record-pause") {
      const request = readRequest<{ workId: string; paused: boolean; instructionReference: string }>();
      store.recordOwnerPause(request.workId, request.paused, request.instructionReference);
      return { workId: request.workId, paused: request.paused, sessionInterrupted: false };
    }
    if (action === "interpret") {
      const request = readRequest<{ operationId: string; responsibleRole: string; decision: string; evidenceReferences: string[]; resultDigest?: string }>();
      const operation = store.getOperation(request.operationId);
      if (request.responsibleRole !== operation.action.recipientRole) throw new RouterError("INTERPRETATION_ROLE_MISMATCH");
      if (!operation.resultDigest) throw new RouterError("RESULT_UNAVAILABLE");
      return operationView(store.interpret(request.operationId, {
        resultDigest: request.resultDigest ?? operation.resultDigest, responsibleRole: request.responsibleRole,
        decision: request.decision, evidenceReferences: request.evidenceReferences,
      }));
    }
    if (action === "submit" || action === "restore") {
      const request = readRequest<SubmitRequest>();
      const prepared = await engine().prepare(action === "restore" ? { ...request, kind: "RESTORE" } : request);
      if (!prepared.operation.dispatchStartedAt && !prepared.operation.completedAt) await retainExecutor(stateRoot, configurationPath, prepared.operation.operationId);
      return { ...operationView(store.getOperation(prepared.operation.operationId)), created: prepared.created };
    }
    if (action === "compact") {
      const prepared = await engine().prepareCompact(readRequest<CompactRequest>());
      if (!prepared.operation) return { disposition: prepared.disposition, created: false, delivery: "NOT_SENT", autoAdvance: false };
      if (!prepared.operation.dispatchStartedAt && !prepared.operation.completedAt) await retainExecutor(stateRoot, configurationPath, prepared.operation.operationId);
      return { ...operationView(store.getOperation(prepared.operation.operationId)), created: prepared.created };
    }
    if (action === "observe-session") return await engine().observe(required(values, "--work-id"), required(values, "--role"));
    const operationId = required(values, "--operation-id");
    if (action === "execute-operation") {
      const idleWaitMs = Number(values["--idle-wait-ms"] ?? 3_600_000);
      if (!Number.isSafeInteger(idleWaitMs) || idleWaitMs < 0 || idleWaitMs > 3_600_000) throw new RouterError("WAIT_RANGE_INVALID");
      const idleDeadline = performance.now() + idleWaitMs;
      let cadence = 1000;
      while (true) {
        try { return operationView(await engine().execute(operationId)); }
        catch (error) {
          const code = error instanceof RouterError || error instanceof StoreError ? error.code : "EXECUTOR_FAILED";
          const operation = store.getOperation(operationId);
          const previous = operation.observation;
          store.observe(operationId, { observedAt: new Date().toISOString(), activity: code === "PARTICIPANT_BUSY" ? "BUSY" : "UNKNOWN",
            context: { ...previous?.context, reason: code } });
          const mayObserveAgain = !operation.dispatchStartedAt && !operation.completedAt &&
            ["PARTICIPANT_BUSY", "SESSION_ACTIVITY_UNAVAILABLE"].includes(code) && performance.now() < idleDeadline;
          if (mayObserveAgain) {
            await delay(Math.min(cadence, Math.max(0, idleDeadline - performance.now())));
            cadence = Math.min(15_000, cadence * 2);
            continue; // Pre-send GET observation only; no POST has been attempted.
          }
          const permanentPreparationFailure = ["SOURCE_CHANGED", "SOURCE_UNAVAILABLE", "COMMAND_CHANGED_BEFORE_SEND", "COMMAND_EFFECT_CHANGED", "PARTICIPANT_BINDING_CHANGED", "PARTICIPANT_IDENTITY_MISMATCH", "ROLE_COMMAND_NOT_ALLOWED", "MODEL_CONFIGURATION_INVALID", "MAINTENANCE_BASELINE_CHANGED", "ORCHESTRATOR_COMPACT_IS_MANUAL"].includes(code);
          if (!operation.dispatchStartedAt && !operation.completedAt && permanentPreparationFailure) store.abandonPrepared(operationId, code);
          return operationView(store.getOperation(operationId));
        }
      }
    }
    if (action === "reconcile") return { ...operationView((await engine().reconcile(operationId)).operation) };
    const waitMs = Number(values["--wait-ms"] ?? 3_600_000);
    if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 3_600_000) throw new RouterError("WAIT_RANGE_INVALID");
    const deadline = performance.now() + waitMs;
    let cadence = 1000;
    while (true) {
      const stored = store.getOperation(operationId);
      if (stored.completedAt || performance.now() >= deadline || store.getWork(stored.action.workId).paused) return {
        ...operationView(stored), disposition: stored.completedAt ? "STORED" : "PENDING", observationEnded: true, sessionInterrupted: false,
      };
      const currentEngine = engine();
      const result = await currentEngine.reconcile(operationId);
      if (result.operation.completedAt || performance.now() >= deadline || result.disposition === "AMBIGUOUS" || store.getWork(result.operation.action.workId).paused) return {
        ...operationView(result.operation), disposition: result.disposition, observationEnded: true, sessionInterrupted: false,
      };
      await currentEngine.observeOptional(result.operation.action.workId, result.operation.action.recipientRole, Math.min(15_000, Math.max(0, deadline - performance.now())));
      await delay(Math.min(cadence, Math.max(0, deadline - performance.now())));
      cadence = Math.min(15_000, cadence * 2);
    }
  } finally { store.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === here) {
  runCli(process.argv.slice(2)).then(value => process.stdout.write(`${JSON.stringify(value)}\n`)).catch(error => {
    const code = error instanceof RouterError || error instanceof StoreError ? error.code : "ROUTER_ERROR";
    process.stdout.write(`${JSON.stringify({ error_code: code })}\n`);
    process.exitCode = 1;
  });
}
