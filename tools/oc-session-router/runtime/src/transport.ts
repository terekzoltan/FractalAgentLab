import { parseStrictJson, sha256 } from "./contracts.js";

export interface TransportBinding {
  origin: string;
  server_fingerprint: string;
  session_id: string;
  username: string;
  password: string;
}

export interface CommandResponse {
  info: {
    id: string;
    role: string;
    sessionID: string;
    parentID?: string;
  };
  parts: Array<{
    id: string;
    type: string;
    text: string;
    messageID: string;
    sessionID: string;
  }>;
}

export interface TransportReceipt {
  status: number;
  message_id: string;
  parent_id: string;
  session_sha256: string;
  response_sha256: string;
  terminal_markdown: string;
}

export interface SnapshotCandidate {
  id: string;
  parent_id: string;
  session_id: string;
  text: string;
  after_baseline: boolean;
}

export interface SnapshotResolution {
  status: "TRANSCRIPT_RECONCILED" | "UNCERTAIN";
  candidate?: SnapshotCandidate;
  reason: string;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class CommandClient {
  constructor(private readonly fetchImpl: FetchLike = fetch, private readonly maximumBytes = 1024 * 1024) {}

  async send(binding: TransportBinding, command: string, argument: string, timeoutMs: number): Promise<TransportReceipt> {
    assertPrivateTransportBinding(binding);
    const origin = validateOrigin(binding.origin);
    if (!binding.session_id || !binding.username || !binding.password) throw new Error("Transport binding is incomplete");
    const endpoint = new URL(`/session/${encodeURIComponent(binding.session_id)}/command`, origin);
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
    const terminal = extractCommandResponse(parsed, binding.session_id);
    return {
      status: response.status,
      message_id: parsed.info.id,
      parent_id: parsed.info.parentID ?? "",
      session_sha256: sha256(binding.session_id),
      response_sha256: sha256(bytes),
      terminal_markdown: terminal,
    };
  }
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

export function validateOrigin(value: string): URL {
  const origin = new URL(value);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error("Server origin must contain only scheme, host, and port");
  if (origin.protocol === "http:") {
    const host = origin.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "[::1]" && host !== "::1" && host !== "localhost") throw new Error("Plain HTTP is restricted to loopback");
  } else if (origin.protocol !== "https:") {
    throw new Error("Server origin scheme is unsupported");
  }
  return origin;
}

export function extractCommandResponse(response: CommandResponse, expectedSession: string): string {
  if (!response.info || response.info.role !== "assistant" || response.info.sessionID !== expectedSession || !response.info.id) {
    throw new Error("Command response identity mismatch");
  }
  if (!Array.isArray(response.parts) || response.parts.length === 0) throw new Error("Command response has no parts");
  return response.parts.map((part) => {
    if (part.type !== "text" || part.messageID !== response.info.id || part.sessionID !== expectedSession) throw new Error("Command response part identity mismatch");
    return part.text;
  }).join("");
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
    if (typeof part.text !== "string") throw new Error("Command response part text payload is invalid");
    return { id: part.id as string, type: part.type as string, text: part.text, messageID: part.messageID as string, sessionID: part.sessionID as string };
  });
  return {
    info: { id: info.id as string, role: info.role as string, sessionID: info.sessionID as string, ...(info.parentID === undefined ? {} : { parentID: info.parentID as string }) },
    parts,
  };
}

export function reconcileSnapshot(candidates: readonly SnapshotCandidate[], expected: { sessionSha256: string; parentId: string; terminal: (text: string) => boolean }): SnapshotResolution {
  const matches = candidates.filter((candidate) => candidate.after_baseline && sha256(candidate.session_id) === expected.sessionSha256 && candidate.parent_id === expected.parentId && expected.terminal(candidate.text));
  if (matches.length === 1) return { status: "TRANSCRIPT_RECONCILED", candidate: matches[0]!, reason: "exactly one correlated post-baseline candidate" };
  return { status: "UNCERTAIN", reason: matches.length === 0 ? "no exactly correlated candidate" : "multiple exactly correlated candidates" };
}
