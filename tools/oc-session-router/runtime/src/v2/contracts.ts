import { createHash, randomBytes } from "node:crypto";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Effect = "READ_ONLY" | "WORKSPACE_WRITE" | "LOCAL_COMMIT" | "SESSION_MAINTENANCE";

export interface WorkContext {
  workId: string;
  target: string;
  directory: string;
  instructionReference: string;
  scope: string;
  allowedEffects: Effect[];
  stoppingPoint: string;
}

/** Private addressing. Aliases of one session must use the same verified tuple. */
export interface Participant {
  namespace: string;
  project: string;
  session: string;
}

export interface ActionInput {
  workId: string;
  actionKey: string;
  participant: Participant;
  recipientRole: string;
  kind: "LIFECYCLE" | "CLARIFICATION" | "COMPACT" | "RESTORE" | "LEGACY";
  effect: Effect;
  command: string;
  predecessor: string | null;
  /** Frozen expanded command and source provenance; never credentials. */
  input: { [key: string]: Json };
}

export interface Correlation {
  rootMessageId?: string;
  responseMessageId?: string;
}

export interface Observation {
  observedAt: string;
  activity: "BUSY" | "IDLE" | "UNKNOWN" | "COMPLETED" | "FAILED";
  cursor?: string;
  context?: { [key: string]: Json };
}

export interface TerminalOutcome {
  execution: "COMPLETED" | "FAILED";
  /** Actual terminal evidence, not inference from idle, timeout or process death. */
  evidenceReferences: string[];
  response?: { messageId: string; rootMessageId?: string; parentMessageId?: string; text: string };
  /** Historical accepted artifact; never fabricated as an OpenCode message. */
  artifact?: { text: string; sha256: string };
  reason?: string;
}

export interface Interpretation {
  resultDigest: string;
  responsibleRole: string;
  decision: string;
  evidenceReferences: string[];
}

export interface Operation {
  operationId: string;
  /** Chosen once inside action creation; correlation, not remote idempotency. */
  messageId: string;
  action: ActionInput;
  participantKey: string;
  inputDigest: string;
  createdAt: string;
  dispatchStartedAt: string | null;
  acknowledgedAt: string | null;
  correlation: Correlation;
  observation: Observation | null;
  completedAt: string | null;
  outcome: TerminalOutcome | null;
  resultDigest: string | null;
  interpretation: Interpretation | null;
}

export interface WorkView {
  context: WorkContext;
  paused: boolean;
  pauseReference: string | null;
  observations: { [role: string]: Json };
  operations: Operation[];
}

export type StoreErrorCode = "STORE_UNAVAILABLE" | "SCHEMA_UNSUPPORTED" |
  "INVALID_INPUT" | "NOT_FOUND" | "INPUT_CONFLICT" | "PARTICIPANT_BUSY" |
  "WORK_PAUSED" | "EFFECT_NOT_ALLOWED" | "DISPATCH_NOT_STARTED" |
  "RESULT_CONFLICT" | "CORRELATION_CONFLICT";

export class StoreError extends Error {
  constructor(readonly code: StoreErrorCode) { super(code); this.name = "StoreError"; }
}

export function text(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new StoreError("INVALID_INPUT");
}

/** Reject lossy JSON inputs; stable digests must not silently omit undefined. */
export function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${Array.from(value, canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  throw new StoreError("INVALID_INPUT");
}

export function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function participantKey(participant: Participant): string {
  text(participant.namespace); text(participant.project); text(participant.session);
  return digest([participant.namespace, participant.project, participant.session]);
}

let lastTimestamp = 0;
let counter = 0;
/** OpenCode-compatible six-byte ID layout; chronology uses server timestamps. */
export function generateMessageId(): string {
  const now = Date.now();
  if (now !== lastTimestamp) { lastTimestamp = now; counter = 0; }
  counter += 1;
  const encoded = BigInt(now) * 0x1000n + BigInt(counter);
  const bytes = Buffer.alloc(6);
  for (let i = 0; i < 6; i += 1) bytes[i] = Number((encoded >> BigInt(40 - 8 * i)) & 0xffn);
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const suffix = Array.from(randomBytes(14), byte => alphabet[byte % 62]).join("");
  return `msg_${bytes.toString("hex")}${suffix}`;
}
