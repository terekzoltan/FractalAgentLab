import { closeSync, existsSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertOpaqueId, assertSha256, canonicalize, parseStrictJson, sha256 } from "./contracts.js";

const ROUTER_PROTOCOL_IDENTITY = "fal-explicit-stage-router/v1" as const;
const RUNTIME_RELEASE_VERSION = "0.2.0" as const;

export interface P0bProofReceipt {
  schema_version: "router-p0b-proof-receipt.v1";
  router_protocol_identity: typeof ROUTER_PROTOCOL_IDENTITY;
  runtime_release_version: typeof RUNTIME_RELEASE_VERSION;
  executable_attestation_sha256: string;
  opencode_server_version: string;
  server_binary_sha256: string;
  server_instance_identity_sha256: string;
  target_directory_sha256: string;
  capability_grant_sha256: string;
  authorization_use_sha256: string;
  run_authority_sha256: string;
  operation_id_sha256: string;
  operation_result_sha256: string;
  transport_receipt_sha256: string;
  snapshot_diagnostic_sha256: string;
  cleanup_receipt_sha256: string;
  session_sha256: string;
  command_name: string;
  command_argument_sha256: string;
  command_body_sha256: string;
  response_message_id_sha256: string;
  response_parent_id_sha256: string;
  response_parent_bound: boolean;
  response_sha256: string;
  terminal_sha256: string;
  operation_status: "SUCCEEDED" | "NOT_SUCCEEDED";
  transport_status: "RESPONSE_ACCEPTED" | "NOT_ACCEPTED";
  one_use_status: "CONSUMED" | "NOT_CONSUMED";
  snapshot_result: "EXACT_CANDIDATE" | "NOT_EXACT";
  cleanup_status: "VERIFIED" | "UNVERIFIED";
  sse_enabled: false;
  accepted: boolean;
  gate_failures: string[];
  created_at: string;
  raw_paths_persisted: false;
  raw_origin_persisted: false;
  raw_session_id_persisted: false;
  raw_response_persisted: false;
  raw_reasoning_persisted: false;
  raw_event_payload_persisted: false;
}

const DIGEST_FIELDS = [
  "executable_attestation_sha256", "server_binary_sha256", "server_instance_identity_sha256", "target_directory_sha256",
  "capability_grant_sha256", "authorization_use_sha256", "run_authority_sha256", "operation_id_sha256", "operation_result_sha256",
  "transport_receipt_sha256", "snapshot_diagnostic_sha256", "cleanup_receipt_sha256", "session_sha256", "command_argument_sha256",
  "command_body_sha256", "response_message_id_sha256", "response_parent_id_sha256", "response_sha256", "terminal_sha256",
] as const;

export function parseP0bProofReceipt(value: unknown): P0bProofReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("P0B proof receipt must be an object");
  const record = value as Record<string, unknown>;
  const keys = [
    "schema_version", "router_protocol_identity", "runtime_release_version", "executable_attestation_sha256", "opencode_server_version",
    "server_binary_sha256", "server_instance_identity_sha256", "target_directory_sha256", "capability_grant_sha256", "authorization_use_sha256",
    "run_authority_sha256", "operation_id_sha256", "operation_result_sha256", "transport_receipt_sha256", "snapshot_diagnostic_sha256",
    "cleanup_receipt_sha256", "session_sha256", "command_name", "command_argument_sha256", "command_body_sha256", "response_message_id_sha256",
    "response_parent_id_sha256", "response_parent_bound", "response_sha256", "terminal_sha256", "operation_status", "transport_status", "one_use_status", "snapshot_result",
    "cleanup_status", "sse_enabled", "accepted", "gate_failures", "created_at", "raw_paths_persisted", "raw_origin_persisted",
    "raw_session_id_persisted", "raw_response_persisted", "raw_reasoning_persisted", "raw_event_payload_persisted",
  ];
  if (canonicalize(Object.keys(record).sort()) !== canonicalize(keys.sort())) throw new Error("P0B proof receipt has missing or unknown fields");
  if (record.schema_version !== "router-p0b-proof-receipt.v1" || record.router_protocol_identity !== ROUTER_PROTOCOL_IDENTITY || record.runtime_release_version !== RUNTIME_RELEASE_VERSION) throw new Error("P0B proof receipt identity mismatch");
  for (const field of DIGEST_FIELDS) {
    if (typeof record[field] !== "string") throw new Error(`P0B proof ${field} is invalid`);
    assertSha256(record[field] as string, `P0B proof ${field}`);
  }
  if (typeof record.opencode_server_version !== "string" || !record.opencode_server_version || typeof record.command_name !== "string" || !record.command_name) throw new Error("P0B proof server or command identity is invalid");
  assertOpaqueId(record.command_name as string, "P0B proof command name");
  if (!["SUCCEEDED", "NOT_SUCCEEDED"].includes(record.operation_status as string) || !["RESPONSE_ACCEPTED", "NOT_ACCEPTED"].includes(record.transport_status as string) || !["CONSUMED", "NOT_CONSUMED"].includes(record.one_use_status as string) || !["EXACT_CANDIDATE", "NOT_EXACT"].includes(record.snapshot_result as string) || !["VERIFIED", "UNVERIFIED"].includes(record.cleanup_status as string)) throw new Error("P0B proof gate status is invalid");
  if (record.sse_enabled !== false || record.raw_paths_persisted !== false || record.raw_origin_persisted !== false || record.raw_session_id_persisted !== false || record.raw_response_persisted !== false || record.raw_reasoning_persisted !== false || record.raw_event_payload_persisted !== false) throw new Error("P0B proof privacy or SSE gate is invalid");
  if (typeof record.response_parent_bound !== "boolean") throw new Error("P0B proof response parent binding is invalid");
  if (typeof record.created_at !== "string" || !record.created_at.endsWith("Z") || !Number.isFinite(Date.parse(record.created_at))) throw new Error("P0B proof timestamp is invalid");
  const failures = expectedGateFailures(record);
  if (!Array.isArray(record.gate_failures) || record.gate_failures.some((item) => typeof item !== "string") || canonicalize(record.gate_failures) !== canonicalize(failures)) throw new Error("P0B proof gate failures are not deterministic");
  if (typeof record.accepted !== "boolean" || record.accepted !== (failures.length === 0)) throw new Error("P0B proof acceptance does not match exact gates");
  return record as unknown as P0bProofReceipt;
}

export function p0bProofSha256(receipt: P0bProofReceipt): string {
  return sha256(canonicalize(parseP0bProofReceipt(receipt)));
}

export function writeP0bProofReceipt(runtimeRoot: string, value: unknown): { schema_version: "router-p0b-proof-write-receipt.v1"; p0b_proof_sha256: string; accepted: true; paths_emitted: false; network_send: false } {
  const receipt = parseP0bProofReceipt(value);
  if (!receipt.accepted) throw new Error("Only an exact accepted P0B proof may be persisted as production-install authority");
  const root = ordinaryDirectory(runtimeRoot, "P0B proof runtime root");
  const directory = ordinaryDirectory(path.join(root, "validated-evidence"), "P0B validated evidence root");
  const identity = p0bProofSha256(receipt);
  const destination = path.join(directory, `p0b-proof.${identity}.json`);
  if (existsSync(destination)) throw new Error("P0B proof identity is already persisted");
  const temporary = `${destination}.tmp.${randomUUID()}`;
  const descriptor = openSync(temporary, "wx", 0o600);
  try { writeFileSync(descriptor, `${canonicalize(receipt)}\n`, "utf8"); } finally { closeSync(descriptor); }
  try { renameSync(temporary, destination); } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  return { schema_version: "router-p0b-proof-write-receipt.v1", p0b_proof_sha256: identity, accepted: true, paths_emitted: false, network_send: false };
}

export function readP0bProofReceipt(runtimeRoot: string, identity: string): P0bProofReceipt {
  assertSha256(identity, "P0B proof identity");
  const directory = ordinaryDirectory(path.join(ordinaryDirectory(runtimeRoot, "P0B proof runtime root"), "validated-evidence"), "P0B validated evidence root");
  const candidate = path.join(directory, `p0b-proof.${identity}.json`);
  const item = lstatSync(candidate);
  if (!item.isFile() || item.isSymbolicLink()) throw new Error("P0B proof authority is missing or unsafe");
  const proof = parseP0bProofReceipt(parseStrictJson(readFileSync(candidate, "utf8")));
  if (p0bProofSha256(proof) !== identity) throw new Error("P0B proof canonical identity mismatch");
  return proof;
}

function expectedGateFailures(record: Record<string, unknown>): string[] {
  const failures: string[] = [];
  if (record.operation_status !== "SUCCEEDED") failures.push("OPERATION_NOT_SUCCEEDED");
  if (record.transport_status !== "RESPONSE_ACCEPTED") failures.push("RESPONSE_NOT_ACCEPTED");
  if (record.response_parent_bound !== true) failures.push("RESPONSE_PARENT_NOT_BOUND");
  if (record.one_use_status !== "CONSUMED") failures.push("ONE_USE_NOT_CONSUMED");
  if (record.snapshot_result !== "EXACT_CANDIDATE") failures.push("SNAPSHOT_NOT_EXACT");
  if (record.cleanup_status !== "VERIFIED") failures.push("CLEANUP_NOT_VERIFIED");
  return failures.sort();
}

function ordinaryDirectory(candidate: string, label: string): string {
  if (!path.isAbsolute(candidate) || !existsSync(candidate)) throw new Error(`${label} must be a pre-created absolute directory`);
  const item = lstatSync(candidate);
  if (!item.isDirectory() || item.isSymbolicLink()) throw new Error(`${label} must be an ordinary directory`);
  return realpathSync(candidate);
}
