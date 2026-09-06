import { createHash } from "node:crypto";
import { request } from "node:http";
export { generateMessageId } from "./contracts.js";

// Source contract: anomalyco/opencode tag v1.18.28, session/prompt.ts,
// session/message-v2.ts and server/routes/instance/httpapi/{groups,handlers}/session.ts.
// Source inspection is not live binary/disconnect qualification. Command preparation
// precedes the instance-scoped runner fork; loss before that fork stays uncertain.

/** Private addressing and credentials are process inputs, never diagnostic output. */
export interface OpenCodeTarget { origin: string; directory: string; session: string }
export interface OpenCodeCredentials { username: string; password: string }
export interface AdapterOptions { getTimeoutMs?: number; maxResponseBytes?: number; getBudgetMs?: number }
export type AdapterProblem = "HTTP_ERROR" | "INVALID_RESPONSE" | "IDENTITY_MISMATCH";
export interface Acknowledgement {
  status: number;
  observedAt: string;
  rootMessageId?: string;
  responseMessageId?: string;
}
export type Acknowledge = (fact: Acknowledgement) => void | Promise<void>;
export interface AdapterReply<T> {
  status: number;
  bodySha256: string;
  value?: T;
  problem?: AdapterProblem;
  correlation?: { rootMessageId?: string; responseMessageId: string };
}
export interface MessageTokens {
  input?: number;
  output?: number;
  reasoning?: number;
  total?: number;
  cache?: { read?: number; write?: number };
}
export interface OpenCodeMessage {
  id: string;
  session: string;
  role: "user" | "assistant";
  parentId?: string;
  timeCreated?: number;
  timeCompleted?: number;
  finish?: string;
  summary?: boolean;
  error?: boolean;
  providerID?: string;
  modelID?: string;
  hasCompactionPart: boolean;
  /** Visible text only. Completion must also be established from message facts. */
  text: string;
  /** Last assistant-call token counts, not a measured remaining-context budget. */
  tokens?: MessageTokens;
}
export interface OpenCodeSession { id: string; directory: string; projectID?: string; parentID?: string }
export interface OpenCodeModelInfo {
  providerID: string;
  modelID: string;
  contextLimit?: number;
  inputLimit?: number;
  outputLimit?: number;
}
export interface OpenCodeCommand {
  name: string;
  template: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
  description?: string;
}
export interface CommandSubmission {
  /** Generate and persist before recording dispatch-started. This is not an idempotency key. */
  messageID: string;
  command: string;
  arguments: string;
  agent?: string;
  model?: string;
  variant?: string;
}
export interface SummarizeSubmission { providerID: string; modelID: string; auto?: boolean }
export interface MessageSubmission {
  messageID: string;
  text: string;
  agent?: string;
  model?: { providerID: string; modelID: string };
  variant?: string;
}
export interface MessageHistory { messages: OpenCodeMessage[]; nextCursor?: string }
export class AdapterError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "GET_TIMEOUT" | "NETWORK_ERROR" | "RESPONSE_TOO_LARGE" | "ACKNOWLEDGEMENT_FAILED", readonly status?: number) {
    super(code);
    this.name = "AdapterError";
  }
}

interface RawResponse { status: number; body: Buffer; nextCursor?: string }
type RecordValue = Record<string, unknown>;
class ShapeError extends Error {
  constructor(readonly problem: AdapterProblem) { super(problem); }
}
function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ShapeError("INVALID_RESPONSE");
  return value as RecordValue;
}
function nonempty(value: unknown): value is string { return typeof value === "string" && value.length > 0 && !value.includes("\0"); }
function identity(value: unknown, prefix: string): value is string { return nonempty(value) && value.startsWith(prefix); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function input(ok: boolean): asserts ok { if (!ok) throw new AdapterError("INVALID_INPUT"); }
function optionalString(value: RecordValue, key: string): string | undefined {
  const found = value[key];
  if (found === undefined) return undefined;
  if (!nonempty(found)) throw new ShapeError("INVALID_RESPONSE");
  return found;
}
function messageInfo(value: unknown, session: string, expectedId?: string, expectedRoot?: string): RecordValue {
  const info = record(record(value).info);
  if (!identity(info.id, "msg") || !identity(info.sessionID, "ses") || !["user", "assistant"].includes(String(info.role))) throw new ShapeError("INVALID_RESPONSE");
  if (info.parentID !== undefined && !identity(info.parentID, "msg")) throw new ShapeError("INVALID_RESPONSE");
  if (info.sessionID !== session || (expectedId !== undefined && info.id !== expectedId)
    || (expectedRoot !== undefined && (info.role !== "assistant" || info.parentID !== expectedRoot))) throw new ShapeError("IDENTITY_MISMATCH");
  return info;
}
function normalizedMessage(value: unknown, session: string, expectedId?: string): OpenCodeMessage {
  const raw = record(value);
  const info = messageInfo(raw, session, expectedId);
  if (!Array.isArray(raw.parts)) throw new ShapeError("INVALID_RESPONSE");
  const text: string[] = [];
  for (const rawPart of raw.parts) {
    const part = record(rawPart);
    // Validate identity when provided, without interpreting unknown tool internals.
    if ((part.sessionID !== undefined && part.sessionID !== session) || (part.messageID !== undefined && part.messageID !== info.id)) throw new ShapeError("IDENTITY_MISMATCH");
    if (part.type !== "text") continue;
    if (typeof part.text !== "string" || (part.synthetic !== undefined && typeof part.synthetic !== "boolean") || (part.ignored !== undefined && typeof part.ignored !== "boolean")) throw new ShapeError("INVALID_RESPONSE");
    if (part.synthetic !== true && part.ignored !== true) text.push(part.text);
  }
  const result: OpenCodeMessage = { id: info.id as string, session, role: info.role as "user" | "assistant", text: text.join(""), hasCompactionPart: raw.parts.some(part => (part as RecordValue).type === "compaction") };
  if (typeof info.parentID === "string") result.parentId = info.parentID;
  const time = info.time && typeof info.time === "object" && !Array.isArray(info.time) ? info.time as RecordValue : {};
  if (finite(time.created)) result.timeCreated = time.created;
  if (finite(time.completed)) result.timeCompleted = time.completed;
  if (typeof info.finish === "string") result.finish = info.finish;
  if (typeof info.summary === "boolean") result.summary = info.summary;
  if (info.error !== undefined && info.error !== null) result.error = true;
  if (typeof info.providerID === "string") result.providerID = info.providerID;
  if (typeof info.modelID === "string") result.modelID = info.modelID;
  if (info.tokens && typeof info.tokens === "object" && !Array.isArray(info.tokens)) {
    const source = info.tokens as RecordValue;
    const tokens: MessageTokens = {};
    for (const key of ["input", "output", "reasoning", "total"] as const) if (finite(source[key])) tokens[key] = source[key];
    if (source.cache && typeof source.cache === "object" && !Array.isArray(source.cache)) {
      const cache = source.cache as RecordValue;
      tokens.cache = {};
      if (finite(cache.read)) tokens.cache.read = cache.read;
      if (finite(cache.write)) tokens.cache.write = cache.write;
    }
    result.tokens = tokens;
  }
  return result;
}

/** One-shot transport only: no lifecycle state, retries, cancellation API, DB or worker. */
export class OpenCodeAdapter {
  readonly #origin: URL;
  readonly #directory: string;
  readonly #session: string;
  readonly #authorization: string;
  readonly #getTimeoutMs: number;
  readonly #getDeadline: number | undefined;
  readonly #maxResponseBytes: number;

  constructor(target: OpenCodeTarget, credentials: OpenCodeCredentials, options: AdapterOptions = {}) {
    try { this.#origin = new URL(target.origin); } catch { throw new AdapterError("INVALID_INPUT"); }
    input(this.#origin.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(this.#origin.hostname)
      && this.#origin.pathname === "/" && !this.#origin.search && !this.#origin.hash && !this.#origin.username && !this.#origin.password);
    input(nonempty(target.directory) && identity(target.session, "ses"));
    input(nonempty(credentials.username) && !credentials.username.includes(":") && nonempty(credentials.password));
    this.#directory = target.directory;
    this.#session = target.session;
    this.#authorization = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`;
    this.#getTimeoutMs = options.getTimeoutMs ?? 15_000;
    if (options.getBudgetMs !== undefined) input(Number.isFinite(options.getBudgetMs) && options.getBudgetMs >= 0);
    this.#getDeadline = options.getBudgetMs === undefined ? undefined : performance.now() + options.getBudgetMs;
    this.#maxResponseBytes = options.maxResponseBytes ?? 4 * 1024 * 1024;
    input(Number.isSafeInteger(this.#getTimeoutMs) && this.#getTimeoutMs > 0 && this.#getTimeoutMs <= 2_147_483_647);
    input(Number.isSafeInteger(this.#maxResponseBytes) && this.#maxResponseBytes > 0);
  }

  async getSession(): Promise<AdapterReply<OpenCodeSession>> {
    return this.#read(this.#sessionPath(), value => {
      const session = record(value);
      if (!identity(session.id, "ses") || !nonempty(session.directory)) throw new ShapeError("INVALID_RESPONSE");
      if (session.id !== this.#session) throw new ShapeError("IDENTITY_MISMATCH");
      const result: OpenCodeSession = { id: session.id, directory: session.directory };
      if (typeof session.projectID === "string") result.projectID = session.projectID;
      if (typeof session.parentID === "string") result.parentID = session.parentID;
      return result;
    });
  }

  async listCommands(): Promise<AdapterReply<OpenCodeCommand[]>> {
    return this.#read("/command", value => {
      if (!Array.isArray(value)) throw new ShapeError("INVALID_RESPONSE");
      const names = new Set<string>();
      return value.map(item => {
        const raw = record(item);
        if (!nonempty(raw.name) || typeof raw.template !== "string" || names.has(raw.name)) throw new ShapeError("INVALID_RESPONSE");
        names.add(raw.name);
        const result: OpenCodeCommand = { name: raw.name, template: raw.template };
        for (const key of ["agent", "model", "description"] as const) {
          // The live 1.18 API serializes unset optional command fields as null.
          const found = raw[key] === null ? undefined : optionalString(raw, key);
          if (found !== undefined) result[key] = found;
        }
        if (raw.subtask !== undefined && raw.subtask !== null) {
          if (typeof raw.subtask !== "boolean") throw new ShapeError("INVALID_RESPONSE");
          result.subtask = raw.subtask;
        }
        return result;
      });
    });
  }

  /** GET /provider exposes all[].models; return only the selected model's limits. */
  async getModelInfo(providerID: string, modelID: string): Promise<AdapterReply<OpenCodeModelInfo | null>> {
    input(nonempty(providerID) && nonempty(modelID));
    return this.#read("/provider", value => {
      const catalog = record(value);
      if (!Array.isArray(catalog.all)) throw new ShapeError("INVALID_RESPONSE");
      const providers = catalog.all.filter(value => value && typeof value === "object" && !Array.isArray(value) && (value as RecordValue).id === providerID);
      if (providers.length === 0) return null;
      if (providers.length !== 1) throw new ShapeError("INVALID_RESPONSE");
      const models = record(record(providers[0]).models);
      if (!Object.hasOwn(models, modelID)) return null;
      const model = record(models[modelID]);
      if (model.id !== modelID || (model.providerID !== undefined && model.providerID !== providerID)) throw new ShapeError("IDENTITY_MISMATCH");
      const selected: OpenCodeModelInfo = { providerID, modelID };
      if (model.limit && typeof model.limit === "object" && !Array.isArray(model.limit)) {
        const limits = model.limit as RecordValue;
        for (const [source, destination] of [["context", "contextLimit"], ["input", "inputLimit"], ["output", "outputLimit"]] as const) {
          const limit = limits[source];
          if (typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0) selected[destination] = limit;
        }
      }
      return selected;
    });
  }

  async getStatus(): Promise<AdapterReply<"BUSY" | "IDLE" | "UNKNOWN">> {
    return this.#read("/session/status", value => {
      const statuses = record(value);
      // The caller must pair omission with getSession() before treating it as idle.
      if (statuses[this.#session] === undefined) return "IDLE";
      const status = record(statuses[this.#session]);
      if (status.type === "busy" || status.type === "retry") return "BUSY";
      if (status.type === "idle") return "IDLE";
      return "UNKNOWN";
    });
  }

  async getMessage(messageId: string): Promise<AdapterReply<OpenCodeMessage>> {
    input(identity(messageId, "msg"));
    return this.#read(`${this.#sessionPath()}/message/${encodeURIComponent(messageId)}`, value => normalizedMessage(value, this.#session, messageId));
  }

  async getHistory(options: { limit: number; before?: string }): Promise<AdapterReply<MessageHistory>> {
    input(Number.isSafeInteger(options.limit) && options.limit > 0 && options.limit <= 1000);
    if (options.before !== undefined) input(nonempty(options.before) && options.before.length <= 8192 && !/[\r\n]/.test(options.before));
    const query = new URLSearchParams({ limit: String(options.limit) });
    if (options.before !== undefined) query.set("before", options.before);
    const response = await this.#request("GET", `${this.#sessionPath()}/message`, undefined, query);
    return this.#decode(response, value => {
      if (!Array.isArray(value)) throw new ShapeError("INVALID_RESPONSE");
      // Server page order is chronological (created, ID). Preserve it verbatim.
      const messages = value.map(item => normalizedMessage(item, this.#session));
      if (new Set(messages.map(message => message.id)).size !== messages.length) throw new ShapeError("INVALID_RESPONSE");
      if (response.nextCursor !== undefined && (!nonempty(response.nextCursor) || response.nextCursor.length > 8192 || /[\r\n]/.test(response.nextCursor))) throw new ShapeError("INVALID_RESPONSE");
      return { messages, ...(response.nextCursor === undefined ? {} : { nextCursor: response.nextCursor }) };
    });
  }

  async submitCommand(command: CommandSubmission, onAcknowledgement?: Acknowledge): Promise<AdapterReply<OpenCodeMessage>> {
    input(identity(command.messageID, "msg") && nonempty(command.command) && !command.command.startsWith("/") && !/\s/.test(command.command) && typeof command.arguments === "string");
    const body: RecordValue = { messageID: command.messageID, command: command.command, arguments: command.arguments };
    for (const key of ["agent", "model", "variant"] as const) if (command[key] !== undefined) { input(nonempty(command[key])); body[key] = command[key]; }
    const response = await this.#request("POST", `${this.#sessionPath()}/command`, body, undefined, onAcknowledgement);
    return this.#submittedMessage(response, command.messageID, onAcknowledgement);
  }

  /** Clarification prompt only; this endpoint does not perform installed /command expansion. */
  async submitMessage(message: MessageSubmission, onAcknowledgement?: Acknowledge): Promise<AdapterReply<OpenCodeMessage>> {
    input(identity(message.messageID, "msg") && nonempty(message.text));
    const body: RecordValue = { messageID: message.messageID, parts: [{ type: "text", text: message.text }] };
    for (const key of ["agent", "variant"] as const) if (message[key] !== undefined) { input(nonempty(message[key])); body[key] = message[key]; }
    if (message.model !== undefined) {
      input(nonempty(message.model.providerID) && nonempty(message.model.modelID));
      body.model = { providerID: message.model.providerID, modelID: message.model.modelID };
    }
    const response = await this.#request("POST", `${this.#sessionPath()}/message`, body, undefined, onAcknowledgement);
    return this.#submittedMessage(response, message.messageID, onAcknowledgement);
  }

  async #submittedMessage(response: RawResponse, root: string, onAcknowledgement?: Acknowledge): Promise<AdapterReply<OpenCodeMessage>> {
    const identityReply = this.#decode(response, value => messageInfo(value, this.#session, undefined, root));
    if (!identityReply.value) return { status: identityReply.status, bodySha256: identityReply.bodySha256, problem: identityReply.problem ?? "INVALID_RESPONSE" };
    const correlation = { rootMessageId: root, responseMessageId: identityReply.value.id as string };
    // Persist correlation before text extraction; malformed prose/parts cannot erase it.
    await this.#acknowledge(onAcknowledgement, { status: response.status, observedAt: new Date().toISOString(), ...correlation });
    return { ...this.#decode(response, value => normalizedMessage(value, this.#session)), correlation };
  }

  async summarize(body: SummarizeSubmission, onAcknowledgement?: Acknowledge): Promise<AdapterReply<boolean>> {
    input(nonempty(body.providerID) && nonempty(body.modelID) && (body.auto === undefined || typeof body.auto === "boolean"));
    const payload = { providerID: body.providerID, modelID: body.modelID, ...(body.auto === undefined ? {} : { auto: body.auto }) };
    const response = await this.#request("POST", `${this.#sessionPath()}/summarize`, payload, undefined, onAcknowledgement);
    return this.#decode(response, value => { if (value !== true) throw new ShapeError("INVALID_RESPONSE"); return true; });
  }

  #sessionPath(): string { return `/session/${encodeURIComponent(this.#session)}`; }
  async #read<T>(path: string, normalize: (value: unknown) => T): Promise<AdapterReply<T>> {
    return this.#decode(await this.#request("GET", path), normalize);
  }
  #decode<T>(response: RawResponse, normalize: (value: unknown) => T): AdapterReply<T> {
    const base = { status: response.status, bodySha256: createHash("sha256").update(response.body).digest("hex") };
    if (response.status < 200 || response.status >= 300) return { ...base, problem: "HTTP_ERROR" };
    try {
      const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(response.body));
      return { ...base, value: normalize(value) };
    } catch (error) { return { ...base, problem: error instanceof ShapeError ? error.problem : "INVALID_RESPONSE" }; }
  }
  async #acknowledge(callback: Acknowledge | undefined, fact: Acknowledgement): Promise<void> {
    try { await callback?.(fact); } catch { throw new AdapterError("ACKNOWLEDGEMENT_FAILED", fact.status); }
  }
  #request(method: "GET" | "POST", path: string, body?: unknown, query?: URLSearchParams, callback?: Acknowledge): Promise<RawResponse> {
    const getTimeout = Math.min(this.#getTimeoutMs, this.#getDeadline === undefined ? Infinity : Math.max(0, this.#getDeadline - performance.now()));
    if (method === "GET" && getTimeout <= 0) return Promise.reject(new AdapterError("GET_TIMEOUT"));
    const url = new URL(path, this.#origin);
    url.search = query?.toString() ?? "";
    url.searchParams.set("directory", this.#directory);
    // Avoid consulting DNS for localhost while preserving its Host header.
    const host = url.host;
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    return new Promise((resolve, reject) => {
      let status: number | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fail = (error: unknown) => {
        if (timer) clearTimeout(timer);
        reject(error instanceof AdapterError ? error : new AdapterError("NETWORK_ERROR", status));
      };
      const req = request(url, {
        method, agent: false,
        headers: { host, authorization: this.#authorization, accept: "application/json", ...(payload === undefined ? {} : { "content-type": "application/json", "content-length": payload.length }) },
      }, res => {
        status = res.statusCode ?? 0;
        const responseStatus = status;
        // Consume the response even if persistence fails: no callback failure interrupts work.
        const acknowledged = this.#acknowledge(callback, { status, observedAt: new Date().toISOString() }).then(() => undefined, error => error as AdapterError);
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > this.#maxResponseBytes) {
            res.destroy(new AdapterError("RESPONSE_TOO_LARGE", responseStatus));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", fail);
        res.on("end", () => {
          if (timer) clearTimeout(timer);
          void acknowledged.then(error => {
            if (error) { fail(error); return; }
            const cursor = res.headers["x-next-cursor"];
            resolve({ status: responseStatus, body: Buffer.concat(chunks), ...(typeof cursor === "string" ? { nextCursor: cursor } : {}) });
          });
        });
      });
      req.on("error", fail);
      // POST has no automatic deadline. Its owning executor must survive local observation exit.
      req.setTimeout(0);
      if (method === "GET") timer = setTimeout(() => req.destroy(new AdapterError("GET_TIMEOUT", status)), getTimeout);
      req.end(payload);
    });
  }
}
