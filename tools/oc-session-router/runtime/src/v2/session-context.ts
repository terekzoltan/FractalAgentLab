import path from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { digest, StoreError } from "./contracts.js";
import { exactFields } from "./orchestrator-handoff.js";
import { RouterError, sameDirectory, type RouterConfiguration } from "./routing.js";
import { observeOwnerAttention } from "./owner-attention.js";
import { isTerminalMessage } from "./reconcile.js";
import type { OpenCodeAdapter, OpenCodeMessage } from "./opencode-adapter.js";

type Reader = Pick<OpenCodeAdapter, "getSession" | "getStatus" | "getHistory" | "getPendingInteractions">;
export function contextRequest(args: unknown) {
  exactFields(args, ["project", "role", "count"]);
  const { project, role, count = 1 } = args;
  if (typeof project !== "string" || !project.trim() || project.length > 128 ||
      typeof role !== "string" || !role.trim() || role.length > 128 ||
      !Number.isSafeInteger(count) || Number(count) < 1 || Number(count) > 3) throw new StoreError("INVALID_INPUT");
  return { project, role, count: Number(count) };
}

/** Observation home only: deliberately does not attest execution-worktree health. */
export function contextBinding(config: RouterConfiguration, project: string, roleName: string) {
  const projects = config.orchestratorBridge?.projects;
  const enrollment = projects && Object.hasOwn(projects, project) ? projects[project] : undefined;
  if (!enrollment?.instructionReference?.trim()) throw new RouterError("ORCHESTRATOR_NOT_ENROLLED");
  const key = roleName === "orchestrator" ? enrollment.controlTarget : enrollment.governedTarget;
  const name = roleName === "orchestrator" ? enrollment.recipientRole : roleName;
  const target = Object.hasOwn(config.targets, key) ? config.targets[key] : undefined;
  const role = target && Object.hasOwn(target.roles, name) ? target.roles[name] : undefined;
  if (!target || !role || !target.project || !role.session ||
      (roleName === "orchestrator" ? role.capability !== "ORCHESTRATOR" : role.capability === "ORCHESTRATOR")) throw new RouterError("CONTEXT_ROLE_NOT_ENROLLED");
  const home = role.sessionHome?.directory ?? target.directory;
  if (!path.isAbsolute(home) || (role.sessionHome && !role.sessionHome.instructionReference?.trim())) throw new RouterError("SESSION_HOME_NOT_ENROLLED");
  try {
    const url = new URL(target.origin);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
  } catch { throw new RouterError("CONTEXT_ORIGIN_INVALID"); }
  return { target, role, home };
}

// Best-effort defensive redaction, not a guarantee that arbitrary prose has no secrets.
export function contextText(value: string, secrets: string[] = []): string {
  let text = value;
  for (const secret of secrets.filter(value => value.length > 0)) text = text.split(secret).join("[REDACTED]");
  return text.replace(/\b(?:ses|msg)_[A-Za-z0-9_-]+\b/g, "[PRIVATE_ID]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+\/_=.-]+/gi, "[REDACTED_AUTH]")
    .replace(/((?:password|api[_-]?key|access[_-]?token|secret)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[REDACTED]");
}
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export async function readSessionContext(reader: Reader, expected: { session: string; project: string; directory: string }, count: number, secrets: string[] = []) {
  const identity = async () => {
    const reply = await reader.getSession();
    if (reply.problem || reply.value?.id !== expected.session || reply.value.projectID !== expected.project ||
        !sameDirectory(reply.value.directory, expected.directory) || reply.value.parentID || reply.value.reverted) throw new RouterError("PARTICIPANT_IDENTITY_MISMATCH");
  };
  await identity();
  const firstStatus = await reader.getStatus();
  const page = async () => {
    const reply = await reader.getHistory({ limit: 12 });
    if (reply.problem || !reply.value || reply.value.messages.length > 12 || reply.value.messages.some(m => m.session !== expected.session)) throw new RouterError("CONTEXT_HISTORY_UNAVAILABLE");
    return reply.value.messages;
  };
  const first = await page();
  await delay(100);
  const last = await page();
  const status = await reader.getStatus();
  await identity();
  const attention = await observeOwnerAttention(reader);
  const stable = digest(first) === digest(last);
  const activity = status.problem ? "UNKNOWN" : status.value ?? "UNKNOWN";
  const head = last.at(-1);
  const latestVisibleMessageCompleted = head?.role === "assistant" && !head.error &&
    (isTerminalMessage(head) || (head.summary === true && head.finish === "stop" && Number.isFinite(head.timeCompleted)));
  const inFlight = !stable || !latestVisibleMessageCompleted || activity !== "IDLE" || firstStatus.problem || firstStatus.value !== "IDLE";
  const finals = last.filter(m => m.role === "assistant" && isTerminalMessage(m) && !m.error && m.text.trim()).slice(-count);
  // No raw IDs or user prompts, reasoning, tool parts, compact summaries or pagination cursor.
  const outputs = finals.map((m: OpenCodeMessage) => {
    const safe = contextText(m.text, secrets);
    return { completedAt: m.timeCompleted, text: safe.slice(0, 16000), truncated: safe.length > 16000,
      sourceTextSha256: sha(m.text), returnedTextSha256: sha(safe.slice(0, 16000)), redacted: safe !== m.text };
  });
  return { observedAt: new Date().toISOString(), identityVerified: true, activity, ownerAttention: attention,
    stability: stable ? "STABLE_WINDOW" : "CHANGED_WINDOW",
    evidence: inFlight ? "IN_FLIGHT_SNAPSHOT" : outputs.length ? "LIVE_OUTPUT_STABLE" : "NO_FINAL_IN_WINDOW",
    boundedWindow: 12, outputs, latestVisibleMessageCompleted, historicalOutputsOnly: true, executionRootVerified: false,
    operationCorrelationVerified: false, remoteMutation: false, localEvidenceMutation: false };
}
