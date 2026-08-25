import { canonicalize, parseStrictJson, sha256 } from "./contracts.js";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { CapabilityProbe, CapabilityProbeProjection, SnapshotCorrelationMode } from "./control-plane.js";

export interface TransportBinding {
  origin: string;
  server_fingerprint: string;
  session_id: string;
  username: string;
  password: string;
  directory?: string;
}

export interface CommandResponse {
  info: {
    id: string;
    role: string;
    sessionID: string;
    parentID?: string;
    created_at?: number;
  };
  parts: Array<{
    id: string;
    type: string;
    messageID: string;
    sessionID: string;
    text?: string;
    synthetic?: boolean;
    ignored?: boolean;
    content_sha256: string;
  }>;
}

export interface TransportReceipt {
  status: number;
  message_id: string;
  parent_id: string;
  session_sha256: string;
  response_sha256: string;
  terminal_markdown: string;
  terminal_sha256: string;
  ignored_part_set_sha256: string;
}

export interface SnapshotCandidate {
  id: string;
  parent_id: string;
  session_id: string;
  text: string;
  after_baseline: boolean;
  command_root_correlated?: boolean;
}

export interface SnapshotResolution {
  status: "TRANSCRIPT_RECONCILED" | "UNCERTAIN";
  candidate?: SnapshotCandidate;
  reason: string;
}

export interface SnapshotBaseline {
  message_id: string;
  identity_sha256: string;
  captured_at: string;
}

export interface SnapshotReadResult {
  candidates: SnapshotCandidate[];
  baseline_present: boolean;
  message_set_sha256: string;
  captured_at: string;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ServerInstanceProjection {
  server_binary_sha256: string;
  server_instance_identity_sha256: string;
}

export type ServerInstanceMeasurer = (origin: URL, expectedBinarySha256: string) => ServerInstanceProjection;

export class CommandClient {
  constructor(private readonly fetchImpl: FetchLike = fetch, private readonly maximumBytes = 1024 * 1024) {}

  async send(binding: TransportBinding, command: string, argument: string, timeoutMs: number): Promise<TransportReceipt> {
    assertPrivateTransportBinding(binding);
    const origin = validateOrigin(binding.origin);
    if (!binding.session_id || !binding.username || !binding.password) throw new Error("Transport binding is incomplete");
    const endpoint = new URL(`/session/${encodeURIComponent(binding.session_id)}/command`, origin);
    if (binding.directory) endpoint.searchParams.set("directory", binding.directory);
    const authorization = `Basic ${Buffer.from(`${binding.username}:${binding.password}`, "utf8").toString("base64")}`;
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ command, arguments: argument }),
    });
    if (response.status >= 300 && response.status < 400) throw new Error("Redirect response is forbidden");
    if (!response.ok) throw new Error(`Command transport returned HTTP ${response.status}`);
    const bytes = await readBoundedBody(response, this.maximumBytes);
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = parseCommandResponse(parseStrictJson(raw));
    const projection = extractCommandResponseProjection(parsed, binding.session_id);
    return {
      status: response.status,
      message_id: parsed.info.id,
      parent_id: parsed.info.parentID ?? "",
      session_sha256: sha256(binding.session_id),
      response_sha256: sha256(bytes),
      terminal_markdown: projection.terminal_markdown,
      terminal_sha256: sha256(projection.terminal_markdown),
      ignored_part_set_sha256: projection.ignored_part_set_sha256,
    };
  }
}

export class InstalledCapabilityProbe implements CapabilityProbe {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly maximumBytes = 4 * 1024 * 1024,
    private readonly measureServerInstance: ServerInstanceMeasurer = measureWindowsServerInstance,
  ) {}

  async probe(input: { origin: string; username: string; password: string; directory: string; expected_binary_sha256: string; required_commands: readonly string[]; timeout_ms: number }): Promise<CapabilityProbeProjection> {
    const origin = validateOrigin(input.origin);
    if (!input.username || !input.password) throw new Error("Capability probe authentication is unavailable");
    const authorization = basicAuthorization(input.username, input.password);
    const [healthBytes, docBytes, commandBytes] = await Promise.all([
      this.get(new URL("/global/health", origin), authorization, input.timeout_ms),
      this.get(new URL("/doc", origin), authorization, input.timeout_ms),
      this.get(commandRegistryUrl(origin, input.directory), authorization, input.timeout_ms),
    ]);
    const sse = await this.probeSse(origin, authorization, input.directory, Math.min(input.timeout_ms, 5_000));
    const health = parseHealth(parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(healthBytes)));
    const commandRegistry = parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(commandBytes));
    const supportedCommands = parseCommandRegistry(commandRegistry);
    for (const required of input.required_commands) if (!supportedCommands.includes(required)) throw new Error("Installed command registry lacks the requested command");
    const instance = this.measureServerInstance(origin, input.expected_binary_sha256);
    const directoryItem = lstatSync(input.directory);
    if (!directoryItem.isDirectory() || directoryItem.isSymbolicLink()) throw new Error("Capability target directory must be ordinary");
    return {
      server_version: health.version,
      ...instance,
      target_directory_sha256: sha256(`fal-router-target-directory/v1\n${realpathSync(input.directory)}`),
      health_identity_sha256: sha256(canonicalize(health)),
      doc_sha256: sha256(docBytes),
      // Bind the complete semantic command definitions, not restart-sensitive
      // response ordering, JSON member order, or serialization whitespace.
      command_registry_sha256: commandRegistryIdentity(commandRegistry),
      supported_commands: supportedCommands,
      sse,
    };
  }

  private async get(endpoint: URL, authorization: string, timeoutMs: number): Promise<Uint8Array> {
    const response = await this.fetchImpl(endpoint, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { authorization, accept: "application/json" } });
    if (response.status >= 300 && response.status < 400) throw new Error("Capability probe redirect is forbidden");
    if (!response.ok) throw new Error("Installed server capability probe failed");
    return readBoundedBody(response, this.maximumBytes);
  }

  private async probeSse(origin: URL, authorization: string, directory: string, timeoutMs: number): Promise<CapabilityProbeProjection["sse"]> {
    const endpoint = new URL("/event", origin);
    endpoint.searchParams.set("directory", directory);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await this.fetchImpl(endpoint, { method: "GET", redirect: "manual", signal: controller.signal, headers: { authorization, accept: "text/event-stream" } });
      if (response.status >= 300 && response.status < 400) return sseProjection("FAILED", sha256(canonicalize({ status: response.status, redirect: true })));
      if (!response.ok || !/^text\/event-stream(?:;|$)/i.test(response.headers.get("content-type") ?? "")) return sseProjection("UNSUPPORTED", sha256(canonicalize({ status: response.status, content_type: response.headers.get("content-type") ?? "" })));
      if (!response.body) return sseProjection("FAILED", sha256("SSE_BODY_MISSING"));
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total <= 16 * 1024) {
        const current = await reader.read();
        if (current.done) break;
        chunks.push(current.value);
        total += current.value.byteLength;
        const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (/\r?\n\r?\n/.test(text)) {
          const verified = /^event:\s*message\r?\ndata:\s*\{[^\r\n]*"type"\s*:\s*"server\.connected"[^\r\n]*\}\r?\n\r?\n/m.test(text);
          return stableSseProjection(verified ? "VERIFIED" : "FAILED", verified ? "server.connected" : "unexpected", "text/event-stream");
        }
      }
      return sseProjection("FAILED", sha256("SSE_INITIAL_EVENT_INCOMPLETE"));
    } catch {
      return sseProjection("FAILED", sha256("SSE_PROBE_FAILED"));
    } finally {
      clearTimeout(timer);
      try { await reader?.cancel(); } catch { /* bounded diagnostic probe */ }
    }
  }
}

const WINDOWS_POWERSHELL = "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const WINDOWS_POWERSHELL_SHA256 = "7600ffe12da441fe89d035b13801e8e91d064bc544a27b19a5cf49f6ab8b18f5";
const SERVER_INSTANCE_COMMAND = [
  "$ErrorActionPreference='Stop'",
  "$rows=@(Get-NetTCPConnection -State Listen -LocalPort ([int]$env:OC_ROUTER_PROBE_PORT) | Where-Object { $_.LocalAddress -ceq $env:OC_ROUTER_PROBE_ADDRESS })",
  "if($rows.Count -ne 1){throw 'Listener identity is missing or ambiguous'}",
  "$process=Get-Process -Id ([int]$rows[0].OwningProcess)",
  "$path=$process.Path",
  "if([string]::IsNullOrWhiteSpace($path)){throw 'Listener executable path is unavailable'}",
  "[ordered]@{pid=[int]$process.Id;started_at=$process.StartTime.ToUniversalTime().ToString('o');port=[int]$rows[0].LocalPort;local_address=[string]$rows[0].LocalAddress;binary_path=$path;binary_sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()} | ConvertTo-Json -Compress",
].join(";");

export function measureWindowsServerInstance(origin: URL, expectedBinarySha256: string): ServerInstanceProjection {
  if (process.platform !== "win32") throw new Error("Installed server instance measurement is Windows-only");
  if (!/^[a-f0-9]{64}$/.test(expectedBinarySha256)) throw new Error("Expected server binary SHA-256 is invalid");
  const executable = path.resolve(WINDOWS_POWERSHELL);
  const item = lstatSync(executable);
  if (!item.isFile() || item.isSymbolicLink() || sha256(readFileSync(executable)) !== WINDOWS_POWERSHELL_SHA256) throw new Error("Server instance measurement broker is unavailable");
  const address = origin.hostname === "127.0.0.1" ? "127.0.0.1" : "::1";
  const result = spawnSync(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SERVER_INSTANCE_COMMAND], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 32 * 1024,
    env: { SystemRoot: process.env.SystemRoot!, WINDIR: process.env.WINDIR!, OC_ROUTER_PROBE_PORT: String(Number(origin.port) || (origin.protocol === "https:" ? 443 : 80)), OC_ROUTER_PROBE_ADDRESS: address },
  });
  if (result.status !== 0 || !result.stdout) throw new Error("Installed server instance could not be measured");
  const record = parseStrictJson(result.stdout) as Record<string, unknown>;
  const expectedKeys = ["binary_path", "binary_sha256", "local_address", "pid", "port", "started_at"];
  if (!record || typeof record !== "object" || Array.isArray(record) || canonicalize(Object.keys(record).sort()) !== canonicalize(expectedKeys)) throw new Error("Installed server instance projection is invalid");
  if (!Number.isSafeInteger(record.pid) || !Number.isSafeInteger(record.port) || record.port !== (Number(origin.port) || (origin.protocol === "https:" ? 443 : 80)) || record.local_address !== address || typeof record.started_at !== "string" || !record.started_at.endsWith("Z") || !Number.isFinite(Date.parse(record.started_at)) || typeof record.binary_path !== "string" || !path.isAbsolute(record.binary_path) || typeof record.binary_sha256 !== "string") throw new Error("Installed server instance projection is invalid");
  const binaryItem = lstatSync(record.binary_path);
  if (!binaryItem.isFile() || binaryItem.isSymbolicLink() || sha256(readFileSync(record.binary_path)) !== record.binary_sha256 || record.binary_sha256 !== expectedBinarySha256) throw new Error("Installed server binary identity mismatch");
  const sanitized = {
    domain: "fal-router-server-instance/v1",
    binary_sha256: record.binary_sha256,
    process_id_sha256: sha256(`fal-router-process-id/v1\n${record.pid}`),
    process_started_at_sha256: sha256(`fal-router-process-start/v1\n${record.started_at}`),
    port: record.port,
    local_address: record.local_address,
  };
  return { server_binary_sha256: record.binary_sha256, server_instance_identity_sha256: sha256(canonicalize(sanitized)) };
}

export class InstalledSnapshotClient {
  constructor(private readonly fetchImpl: FetchLike = fetch, private readonly maximumBytes = 4 * 1024 * 1024) {}

  async captureBaseline(binding: TransportBinding, timeoutMs: number): Promise<SnapshotBaseline> {
    const messages = (await this.readMessagePage(binding, timeoutMs, 1)).messages;
    const latest = messages.at(-1)?.info.id ?? "EMPTY";
    return { message_id: latest, identity_sha256: snapshotSetIdentity(messages), captured_at: new Date().toISOString() };
  }

  async collect(binding: TransportBinding, baseline: SnapshotBaseline, _mode: SnapshotCorrelationMode, timeoutMs: number, expectedCommand?: { name: string; argument: string }): Promise<SnapshotReadResult> {
    const messages = await this.readMessagesThroughBaseline(binding, baseline.message_id, timeoutMs);
    const baselineIndex = baseline.message_id === "EMPTY" ? -1 : messages.findIndex((message) => message.info.id === baseline.message_id);
    const baselinePresent = baseline.message_id === "EMPTY" || baselineIndex >= 0;
    const postBaseline = baselinePresent ? messages.slice(baselineIndex + 1) : [];
    const expectedPrompt = expectedCommand ? await this.readExpandedCommandPrompt(binding, expectedCommand, timeoutMs) : undefined;
    const commandRoots = expectedPrompt === undefined ? [] : postBaseline.filter((message) =>
      message.info.role === "user"
      && !message.info.parentID
      && message.parts.filter((part) => part.type === "text" && part.synthetic !== true && part.ignored !== true).map((part) => part.text ?? "").join("") === expectedPrompt,
    );
    const candidates: SnapshotCandidate[] = [];
    for (const message of postBaseline) {
      if (message.info.role !== "assistant") continue;
      const textParts = message.parts.filter((part) => part.type === "text" && part.synthetic !== true && part.ignored !== true);
      if (textParts.length === 0) continue;
      candidates.push({
        id: message.info.id,
        parent_id: message.info.parentID ?? "",
        session_id: message.info.sessionID,
        text: textParts.map((part) => part.text ?? "").join(""),
        after_baseline: true,
        ...(commandRoots.length === 1 && message.info.parentID === commandRoots[0]!.info.id ? { command_root_correlated: true } : {}),
      });
    }
    return { candidates, baseline_present: baselinePresent, message_set_sha256: snapshotSetIdentity(messages), captured_at: new Date().toISOString() };
  }

  private async readMessagesThroughBaseline(binding: TransportBinding, baselineMessageId: string, timeoutMs: number): Promise<CommandResponse[]> {
    const pageSize = 40;
    const maximumPages = 6;
    const messages: CommandResponse[] = [];
    const seen = new Set<string>();
    let before: string | undefined;
    for (let page = 0; page < maximumPages; page += 1) {
      const currentPage = await this.readMessagePage(binding, timeoutMs, pageSize, before);
      const current = currentPage.messages;
      if (current.length === 0) break;
      for (const message of current) {
        if (seen.has(message.info.id)) throw new Error("Snapshot pagination contains a duplicate message");
        seen.add(message.info.id);
        messages.push(message);
      }
      if (baselineMessageId === "EMPTY" || current.some((message) => message.info.id === baselineMessageId)) break;
      if (current.length < pageSize) break;
      if (!currentPage.next_cursor) break;
      before = currentPage.next_cursor;
    }
    return messages.sort((left, right) => (left.info.created_at ?? 0) - (right.info.created_at ?? 0));
  }

  private async readMessagePage(binding: TransportBinding, timeoutMs: number, limit: number, before?: string): Promise<{ messages: CommandResponse[]; next_cursor?: string }> {
    assertPrivateTransportBinding(binding);
    const origin = validateOrigin(binding.origin);
    const endpoint = new URL(`/session/${encodeURIComponent(binding.session_id)}/message`, origin);
    endpoint.searchParams.set("limit", String(limit));
    if (before) endpoint.searchParams.set("before", before);
    if (binding.directory) endpoint.searchParams.set("directory", binding.directory);
    const response = await this.fetchImpl(endpoint, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { authorization: basicAuthorization(binding.username, binding.password), accept: "application/json" } });
    if (response.status >= 300 && response.status < 400) throw new Error("Snapshot redirect is forbidden");
    if (!response.ok) throw new Error("Snapshot read failed");
    const nextCursor = response.headers.get("x-next-cursor") ?? undefined;
    if (nextCursor !== undefined && !/^[A-Za-z0-9_-]{1,2048}$/.test(nextCursor)) throw new Error("Snapshot next cursor is invalid");
    const bytes = await readBoundedBody(response, this.maximumBytes);
    const parsed = parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const rawMessages = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).messages) ? (parsed as Record<string, unknown>).messages as unknown[] : undefined;
    if (!rawMessages) throw new Error("Snapshot message collection shape is unsupported");
    const messages = rawMessages.map(parseSnapshotMessage).sort((left, right) => (left.info.created_at ?? 0) - (right.info.created_at ?? 0));
    for (const message of messages) if (message.info.sessionID !== binding.session_id || message.parts.some((part) => part.sessionID !== binding.session_id || part.messageID !== message.info.id)) throw new Error("Snapshot message identity mismatch");
    return { messages, ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }) };
  }

  private async readExpandedCommandPrompt(binding: TransportBinding, expected: { name: string; argument: string }, timeoutMs: number): Promise<string> {
    if (!binding.directory) throw new Error("Snapshot command-root recovery requires an exact target directory");
    const origin = validateOrigin(binding.origin);
    const endpoint = commandRegistryUrl(origin, binding.directory);
    const response = await this.fetchImpl(endpoint, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { authorization: basicAuthorization(binding.username, binding.password), accept: "application/json" } });
    if (response.status >= 300 && response.status < 400) throw new Error("Snapshot command-registry redirect is forbidden");
    if (!response.ok) throw new Error("Snapshot command-registry read failed");
    const bytes = await readBoundedBody(response, this.maximumBytes);
    const registry = parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const template = commandTemplate(registry, expected.name);
    return template.replaceAll("$ARGUMENTS", expected.argument);
  }
}

function sseProjection(probeStatus: CapabilityProbeProjection["sse"]["probe_status"], proofSha256: string): CapabilityProbeProjection["sse"] {
  return { probe_status: probeStatus, proof_sha256: proofSha256, enabled: false };
}

function stableSseProjection(probeStatus: CapabilityProbeProjection["sse"]["probe_status"], eventKind: string, contentType: string): CapabilityProbeProjection["sse"] {
  return sseProjection(probeStatus, sha256(canonicalize({ domain: "fal-router-sse-capability/v1", probe_status: probeStatus, event_kind: eventKind, content_type: contentType, enabled: false })));
}

export function assertPrivateTransportBinding(binding: TransportBinding): void {
  for (const [field, value] of Object.entries({
    server_fingerprint: binding.server_fingerprint,
    session_id: binding.session_id,
    username: binding.username,
    password: binding.password,
  })) {
    if (typeof value !== "string" || value.length < 4) throw new Error(`Private transport binding ${field} is too short`);
  }
}

async function readBoundedBody(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number.isFinite(Number(declaredLength)) && Number(declaredLength) > maximumBytes) {
    await response.body?.cancel();
    throw new Error("Command response exceeds byte limit");
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error("Command response exceeds byte limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total));
}

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function commandRegistryUrl(origin: URL, directory: string): URL {
  const result = new URL("/command", origin);
  result.searchParams.set("directory", directory);
  return result;
}

export function validateOrigin(value: string): URL {
  const origin = new URL(value);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error("Server origin must contain only scheme, host, and port");
  if (origin.protocol !== "http:" && origin.protocol !== "https:") throw new Error("Server origin scheme is unsupported");
  const host = origin.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "[::1]" && host !== "::1") throw new Error("Server origin requires a literal loopback address");
  return origin;
}

export function isValidTransportIdentity(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:@+~-]{0,199}$/.test(value);
}

export function extractCommandResponse(response: CommandResponse, expectedSession: string): string {
  return extractCommandResponseProjection(response, expectedSession).terminal_markdown;
}

function extractCommandResponseProjection(response: CommandResponse, expectedSession: string): { terminal_markdown: string; ignored_part_set_sha256: string } {
  if (!response.info || response.info.role !== "assistant" || response.info.sessionID !== expectedSession || !response.info.id) {
    throw new Error("Command response identity mismatch");
  }
  if (!Array.isArray(response.parts) || response.parts.length === 0) throw new Error("Command response has no parts");
  const text: string[] = [];
  const ignored: Array<{ type: string; id_sha256: string; content_sha256: string }> = [];
  for (const part of response.parts) {
    if (part.messageID !== response.info.id || part.sessionID !== expectedSession) throw new Error("Command response part identity mismatch");
    if (part.type === "text" && part.synthetic !== true && part.ignored !== true) text.push(part.text ?? "");
    else ignored.push({ type: part.type, id_sha256: sha256(part.id), content_sha256: part.content_sha256 });
  }
  if (text.length === 0) throw new Error("Command response has no non-synthetic terminal text");
  return { terminal_markdown: text.join(""), ignored_part_set_sha256: sha256(canonicalize(ignored)) };
}

function parseCommandResponse(value: unknown): CommandResponse {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Command response must be an object");
  const response = value as Record<string, unknown>;
  if (response.info === null || typeof response.info !== "object" || Array.isArray(response.info)) throw new Error("Command response info is invalid");
  const info = response.info as Record<string, unknown>;
  for (const field of ["id", "role", "sessionID"] as const) if (typeof info[field] !== "string" || info[field].length === 0) throw new Error(`Command response ${field} is invalid`);
  if (info.parentID !== undefined && typeof info.parentID !== "string") throw new Error("Command response parentID is invalid");
  if (!Array.isArray(response.parts)) throw new Error("Command response parts are invalid");
  const parts = response.parts.map((value, index) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`Command response part ${index} is invalid`);
    const part = value as Record<string, unknown>;
    for (const field of ["id", "type", "messageID", "sessionID"] as const) if (typeof part[field] !== "string" || part[field].length === 0) throw new Error(`Command response part ${field} is invalid`);
    const type = part.type as string;
    const allowed = type === "text" ? ["id", "type", "messageID", "sessionID", "text", "synthetic", "ignored", "time", "metadata"]
      : type === "reasoning" ? ["id", "type", "messageID", "sessionID", "text", "time", "metadata"]
        : type === "step-start" ? ["id", "type", "messageID", "sessionID", "snapshot"]
          : type === "step-finish" ? ["id", "type", "messageID", "sessionID", "reason", "snapshot", "cost", "tokens"]
            : undefined;
    if (!allowed) throw new Error(`Command response part type ${type} is not an inert audited part`);
    if (Object.keys(part).some((key) => !allowed.includes(key))) throw new Error(`Command response ${type} part has unknown fields`);
    if ((type === "text" || type === "reasoning") && typeof part.text !== "string") throw new Error("Command response part text payload is invalid");
    if (part.synthetic !== undefined && typeof part.synthetic !== "boolean") throw new Error("Command response text synthetic flag is invalid");
    if (part.ignored !== undefined && typeof part.ignored !== "boolean") throw new Error("Command response text ignored flag is invalid");
    if (part.metadata !== undefined && (!part.metadata || typeof part.metadata !== "object" || Array.isArray(part.metadata))) throw new Error("Command response part metadata is invalid");
    if (type === "text" && part.time !== undefined) assertTimeShape(part.time, false);
    if (type === "reasoning") assertTimeShape(part.time, true);
    if (type === "step-start" && part.snapshot !== undefined && typeof part.snapshot !== "string") throw new Error("Command response step-start snapshot is invalid");
    if (type === "step-finish") assertStepFinishShape(part);
    return {
      id: part.id as string,
      type,
      messageID: part.messageID as string,
      sessionID: part.sessionID as string,
      ...(part.text === undefined ? {} : { text: part.text as string }),
      ...(part.synthetic === undefined ? {} : { synthetic: part.synthetic as boolean }),
      ...(part.ignored === undefined ? {} : { ignored: part.ignored as boolean }),
      content_sha256: sha256(canonicalize(part)),
    };
  });
  return {
    info: { id: info.id as string, role: info.role as string, sessionID: info.sessionID as string, ...(info.parentID === undefined ? {} : { parentID: info.parentID as string }) },
    parts,
  };
}

function parseSnapshotMessage(value: unknown): CommandResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Snapshot message must be an object");
  const response = value as Record<string, unknown>;
  if (!response.info || typeof response.info !== "object" || Array.isArray(response.info) || !Array.isArray(response.parts)) throw new Error("Snapshot message envelope is invalid");
  const info = response.info as Record<string, unknown>;
  for (const field of ["id", "role", "sessionID"] as const) if (typeof info[field] !== "string" || !info[field]) throw new Error(`Snapshot message ${field} is invalid`);
  if (info.parentID !== undefined && typeof info.parentID !== "string") throw new Error("Snapshot message parentID is invalid");
  const time = info.time;
  if (!time || typeof time !== "object" || Array.isArray(time) || !finiteNumber((time as Record<string, unknown>).created)) throw new Error("Snapshot message creation time is invalid");
  const snapshotInfo = { id: info.id as string, role: info.role as string, sessionID: info.sessionID as string, ...(info.parentID === undefined ? {} : { parentID: info.parentID as string }), created_at: (time as Record<string, unknown>).created as number };
  if (info.role === "assistant") return parseSnapshotAssistantMessage(response, info);
  const parts = response.parts.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Snapshot non-assistant part ${index} is invalid`);
    const part = raw as Record<string, unknown>;
    for (const field of ["id", "type", "messageID", "sessionID"] as const) if (typeof part[field] !== "string" || !part[field]) throw new Error(`Snapshot non-assistant part ${field} is invalid`);
    if (part.messageID !== info.id || part.sessionID !== info.sessionID) throw new Error("Snapshot non-assistant part identity mismatch");
    if (part.type === "text" && typeof part.text !== "string") throw new Error("Snapshot user text payload is invalid");
    if (part.synthetic !== undefined && typeof part.synthetic !== "boolean") throw new Error("Snapshot user synthetic flag is invalid");
    if (part.ignored !== undefined && typeof part.ignored !== "boolean") throw new Error("Snapshot user ignored flag is invalid");
    return {
      id: part.id as string,
      type: part.type as string,
      messageID: part.messageID as string,
      sessionID: part.sessionID as string,
      ...(part.text === undefined ? {} : { text: part.text as string }),
      ...(part.synthetic === undefined ? {} : { synthetic: part.synthetic as boolean }),
      ...(part.ignored === undefined ? {} : { ignored: part.ignored as boolean }),
      content_sha256: sha256(canonicalize(part)),
    };
  });
  return { info: snapshotInfo, parts };
}

function parseSnapshotAssistantMessage(response: Record<string, unknown>, info: Record<string, unknown>): CommandResponse {
  const time = info.time;
  if (!time || typeof time !== "object" || Array.isArray(time) || !finiteNumber((time as Record<string, unknown>).completed)) throw new Error("Snapshot assistant message is not completed");
  const parts = (response.parts as unknown[]).map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Snapshot assistant part ${index} is invalid`);
    const part = raw as Record<string, unknown>;
    for (const field of ["id", "type", "messageID", "sessionID"] as const) if (typeof part[field] !== "string" || !part[field]) throw new Error(`Snapshot assistant part ${field} is invalid`);
    if (part.messageID !== info.id || part.sessionID !== info.sessionID) throw new Error("Snapshot assistant part identity mismatch");
    const type = part.type as string;
    if (["text", "reasoning", "step-start", "step-finish"].includes(type)) return parseCommandResponse({ info, parts: [part] }).parts[0]!;
    if (type === "tool") validateCompletedSnapshotToolPart(part);
    else if (type === "patch") validateSnapshotPatchPart(part);
    else if (type === "compaction") validateSnapshotCompactionPart(part);
    else throw new Error(`Snapshot assistant part type ${type} is unsupported`);
    return { id: part.id as string, type, messageID: part.messageID as string, sessionID: part.sessionID as string, content_sha256: sha256(canonicalize(part)) };
  });
  return { info: { id: info.id as string, role: info.role as string, sessionID: info.sessionID as string, ...(info.parentID === undefined ? {} : { parentID: info.parentID as string }), created_at: (time as Record<string, unknown>).created as number }, parts };
}

function validateCompletedSnapshotToolPart(part: Record<string, unknown>): void {
  const allowed = ["callID", "id", "messageID", "metadata", "sessionID", "state", "tool", "type"];
  if (Object.keys(part).sort().join("\n") !== allowed.sort().join("\n")) throw new Error("Snapshot tool part has unknown or missing fields");
  if (typeof part.callID !== "string" || !part.callID || typeof part.tool !== "string" || !part.tool) throw new Error("Snapshot tool part identity is invalid");
  if (!part.metadata || typeof part.metadata !== "object" || Array.isArray(part.metadata)) throw new Error("Snapshot tool part metadata is invalid");
  if (!part.state || typeof part.state !== "object" || Array.isArray(part.state)) throw new Error("Snapshot tool part state is invalid");
  const state = part.state as Record<string, unknown>;
  if (state.status === "completed") {
    const completed = ["input", "metadata", "output", "status", "time", "title"];
    if (Object.keys(state).sort().join("\n") !== completed.sort().join("\n") || typeof state.output !== "string" || typeof state.title !== "string" || !state.metadata || typeof state.metadata !== "object" || Array.isArray(state.metadata)) throw new Error("Snapshot completed tool part is invalid");
  } else if (state.status === "error") {
    const failed = ["error", "input", "status", "time"];
    if (Object.keys(state).sort().join("\n") !== failed.sort().join("\n") || typeof state.error !== "string") throw new Error("Snapshot failed tool part is invalid");
  } else {
    throw new Error("Snapshot tool part is still active");
  }
  if (!state.input || typeof state.input !== "object" || Array.isArray(state.input)) throw new Error("Snapshot tool part input is invalid");
  assertTimeShape(state.time, true);
}

function validateSnapshotPatchPart(part: Record<string, unknown>): void {
  const allowed = ["files", "hash", "id", "messageID", "sessionID", "type"];
  if (Object.keys(part).sort().join("\n") !== allowed.sort().join("\n") || !Array.isArray(part.files) || typeof part.hash !== "string" || !part.hash) throw new Error("Snapshot patch part is invalid");
}

function validateSnapshotCompactionPart(part: Record<string, unknown>): void {
  const allowed = ["auto", "id", "messageID", "sessionID", "tail_start_id", "type"];
  if (Object.keys(part).sort().join("\n") !== allowed.sort().join("\n") || typeof part.auto !== "boolean" || typeof part.tail_start_id !== "string" || !isValidTransportIdentity(part.tail_start_id)) throw new Error("Snapshot compaction part is invalid");
}

function assertTimeShape(value: unknown, required: boolean): void {
  if (value === undefined && !required) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Command response part time is invalid");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["start", "end"].includes(key)) || !finiteNumber(record.start) || (record.end !== undefined && !finiteNumber(record.end))) throw new Error("Command response part time is invalid");
}

function assertStepFinishShape(part: Record<string, unknown>): void {
  if (typeof part.reason !== "string" || !part.reason || !finiteNumber(part.cost)) throw new Error("Command response step-finish fields are invalid");
  if (part.snapshot !== undefined && typeof part.snapshot !== "string") throw new Error("Command response step-finish snapshot is invalid");
  if (!part.tokens || typeof part.tokens !== "object" || Array.isArray(part.tokens)) throw new Error("Command response step-finish tokens are invalid");
  const tokens = part.tokens as Record<string, unknown>;
  if (Object.keys(tokens).some((key) => !["total", "input", "output", "reasoning", "cache"].includes(key)) || !finiteNumber(tokens.input) || !finiteNumber(tokens.output) || !finiteNumber(tokens.reasoning) || (tokens.total !== undefined && !finiteNumber(tokens.total)) || !tokens.cache || typeof tokens.cache !== "object" || Array.isArray(tokens.cache)) throw new Error("Command response step-finish tokens are invalid");
  const cache = tokens.cache as Record<string, unknown>;
  if (Object.keys(cache).sort().join("\n") !== ["read", "write"].join("\n") || !finiteNumber(cache.read) || !finiteNumber(cache.write)) throw new Error("Command response step-finish cache tokens are invalid");
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseHealth(value: unknown): { healthy: boolean; version: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Installed health response is invalid");
  const record = value as Record<string, unknown>;
  if (record.healthy !== true || typeof record.version !== "string" || !record.version) throw new Error("Installed health response is unsupported");
  return { healthy: true, version: record.version };
}

function parseCommandRegistry(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).commands) ? (value as Record<string, unknown>).commands as unknown[] : undefined;
  if (!entries) throw new Error("Installed command registry shape is unsupported");
  const names = entries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof (entry as Record<string, unknown>).name !== "string" || !(entry as Record<string, unknown>).name) throw new Error("Installed command registry entry is invalid");
    return (entry as Record<string, unknown>).name as string;
  }).sort();
  if (new Set(names).size !== names.length) throw new Error("Installed command registry contains duplicate commands");
  return names;
}

function commandRegistryIdentity(value: unknown): string {
  const entries = commandRegistryEntries(value);
  return sha256(canonicalize({ domain: "fal-router-command-registry/v2", entries }));
}

function commandTemplate(value: unknown, commandName: string): string {
  const matches = commandRegistryEntries(value).filter((entry) => entry.name === commandName);
  if (matches.length !== 1 || typeof matches[0]!.template !== "string" || !matches[0]!.template.includes("$ARGUMENTS")) throw new Error("Installed command template is unavailable or ambiguous");
  return matches[0]!.template as string;
}

function commandRegistryEntries(value: unknown): Array<Record<string, unknown>> {
  const entries = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).commands) ? (value as Record<string, unknown>).commands as unknown[] : undefined;
  if (!entries) throw new Error("Installed command registry shape is unsupported");
  const records = entries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof (entry as Record<string, unknown>).name !== "string" || !(entry as Record<string, unknown>).name) throw new Error("Installed command registry entry is invalid");
    return entry as Record<string, unknown>;
  }).sort((left, right) => (left.name as string).localeCompare(right.name as string));
  if (new Set(records.map((entry) => entry.name)).size !== records.length) throw new Error("Installed command registry contains duplicate commands");
  return records;
}

function snapshotSetIdentity(messages: readonly CommandResponse[]): string {
  return sha256(canonicalize(messages.map((message) => ({
    id_sha256: sha256(message.info.id),
    parent_sha256: sha256(message.info.parentID ?? ""),
    role: message.info.role,
    parts: message.parts.map((part) => ({ id_sha256: sha256(part.id), type: part.type, text_sha256: sha256(part.text ?? "") })),
  }))));
}

export function reconcileSnapshot(candidates: readonly SnapshotCandidate[], expected: { sessionSha256: string; parentId: string; messageId?: string; terminalSha256?: string; terminal: (text: string) => boolean }): SnapshotResolution {
  if (!isValidTransportIdentity(expected.parentId)) return { status: "UNCERTAIN", reason: "response parent identity is missing or invalid" };
  const matches = candidates.filter((candidate) => candidate.after_baseline && isValidTransportIdentity(candidate.parent_id) && sha256(candidate.session_id) === expected.sessionSha256 && candidate.parent_id === expected.parentId && (expected.messageId === undefined || candidate.id === expected.messageId) && (expected.terminalSha256 === undefined || sha256(candidate.text) === expected.terminalSha256) && expected.terminal(candidate.text));
  if (matches.length === 1) return { status: "TRANSCRIPT_RECONCILED", candidate: matches[0]!, reason: "exactly one correlated post-baseline candidate" };
  return { status: "UNCERTAIN", reason: matches.length === 0 ? "no exactly correlated candidate" : "multiple exactly correlated candidates" };
}

export const _test = { parseHealth, parseCommandRegistry, commandRegistryIdentity, snapshotSetIdentity };
