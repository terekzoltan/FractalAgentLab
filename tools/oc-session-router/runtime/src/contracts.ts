import { createHash } from "node:crypto";

export const STAGES = [
  "SEQ_NEXT",
  "PLAN_REVIEW",
  "PLAN_REVISION",
  "IMPLEMENT",
  "STEP_REVIEW",
  "DELIVERY_RESPONSE",
  "CLOSEOUT",
] as const;

export type StageName = (typeof STAGES)[number];
export type PlanClass = "EPIC_PLAN" | "REVIEW_FIX_PLAN";
export type SourceClass = "PLANNING_CONTEXT" | "PLAN" | "META_PLAN_REVIEW" | "REVISED_PLAN" | "IMPLEMENTATION_RESULT" | "ACCEPTANCE_EVIDENCE" | "FINAL_SYNTHESIS" | "DELIVERY_RESPONSE" | "PROPOSED_DELTA" | "CLOSEOUT_AUTHORITY";
export type CanonPhase =
  | "SEQ_NEXT"
  | "PLAN_REVIEW"
  | "FIX_PLAN_REVIEW"
  | "PLAN_REVISION"
  | "FIX_PLAN_REVISION"
  | "IMPLEMENT"
  | "FIX_IMPLEMENT"
  | "STEP_REVIEW"
  | "REVIEW_RESPONSE"
  | "CLOSEOUT";

export interface SourceBinding {
  path: string;
  source_class: SourceClass;
  logical_identity: string;
  producer: string;
  sha256: string;
  order: number;
}

export interface StageSourceManifestEntry {
  stage: StageName;
  plan_class: PlanClass;
  sources: SourceBinding[];
}

export interface StageSourceManifest {
  schema_version: "stage-source-manifest.v1";
  target_id: string;
  epic: string;
  candidate_identity: string;
  entries: StageSourceManifestEntry[];
}

export interface RunRequest {
  schema_version: "run-request.v1";
  target_id: string;
  expected_worktree_identity: string;
}

export interface CloseoutAuthorityInstallRequest {
  schema_version: "closeout-authority-install.v1";
  run_id: string;
  delivery_operation_id: string;
  closeout_authority: Record<string, unknown>;
}

export interface RunAuthority {
  schema_version: "run-authority.v1";
  run_id: string;
  created_at: string;
  target_id: string;
  target_identity: string;
  worktree_identity: string;
  wave: string;
  epic: string;
  accountable_lane: string;
  accountable_class: string;
  accountable_profile: string;
  target_profile_identity: string;
  target_profile_sha256: string;
  state_path: string;
  state_revision: string;
  state_sha256: string;
  combined_path: string;
  combined_selector: string;
  combined_span_sha256: string;
  pinned_artifact_path: string;
  pinned_artifact_identity: string;
  pinned_artifact_sha256: string;
  overlay_identity: string;
  accountable_role_identity: string;
  configuration_identity: string;
  active_route_generation: string;
  review_cycle: string;
  stage_source_manifest_path: string;
  stage_source_manifest_sha256: string;
  next_command: string;
}

export interface StageRequest {
  schema_version: "stage-request.v1";
  request_id: string;
  run_id: string;
  issued_at: string;
  issued_by: string;
  run_authority_sha256: string;
  requested_stage: StageName;
  plan_class: PlanClass;
  target_id: string;
  worktree_identity: string;
  state_revision: string;
  state_sha256: string;
  combined_selector: string;
  combined_span_sha256: string;
  expected_sources: SourceBinding[];
  wave: string;
  epic: string;
  accountable_lane: string;
  accountable_class: string;
  accountable_profile: string;
  sender_role: string;
  recipient_role: string;
  plan_identity: string;
  candidate_identity: string;
  review_cycle: string;
  finding_ids: string[];
  review_risk: string;
  project_review_context: string;
  expected_contract_version: string;
  allowed_side_effect_class: "ROUTER_PRIVATE_ONLY" | "ADDRESSED_SESSION_COMMAND";
  configuration_identity: string;
  active_route_generation: string;
}

export interface StageInvocation extends Omit<StageRequest, "schema_version"> {
  schema_version: "stage-invocation.v1";
  operation_id: string;
  canon_phase: CanonPhase;
  command_name: string;
  command_argument_sha256: string;
  command_body_sha256: string;
  semantic_key: string;
  recipient_session_sha256: string;
  router_protocol_identity?: "fal-explicit-stage-router/v1";
  capability_receipt_sha256?: string;
  snapshot_correlation?: "DIAGNOSTIC_ONLY" | "EXACT_PARENT_LINK";
}

export interface ParsedOutput {
  kind: StageName;
  terminal: string;
  fields: Readonly<Record<string, string>>;
  raw_sha256: string;
  plan_class?: PlanClass;
}

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._@:+~-]{0,199}$/;
const OPAQUE_ID_CHAR = /^[A-Za-z0-9._@:+~-]$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*:)[^\0]+$/;

export function assertOpaqueId(value: string, label: string): void {
  if (typeof value !== "string" || !OPAQUE_ID.test(value)) throw new Error(`${label} is not a valid opaque ID`);
}

export function canonicalFindingIds(values: readonly string[]): string[] {
  for (const value of values) assertOpaqueId(value, "finding_id");
  if (new Set(values).size !== values.length) throw new Error("finding_ids must not contain duplicates");
  return [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

export function assertFilesystemId(value: string, label: string): void {
  assertOpaqueId(value, label);
  if (value.includes(":")) throw new Error(`${label} is not a filesystem-safe ID`);
}

export function assertSha256(value: string, label: string): void {
  if (!SHA256.test(value)) throw new Error(`${label} is not a lowercase SHA-256`);
}

export function assertSafeRelativePath(value: string, label: string): void {
  if (!SAFE_RELATIVE_PATH.test(value) || value.split(/[\\/]/).some((part) => part === "." || part.endsWith(".") || part.endsWith(" "))) {
    throw new Error(`${label} is not a safe relative path`);
  }
}

export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON forbids non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  throw new Error("Canonical JSON forbids undefined, bigint, symbol, and function values");
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function authoritySha256(authority: RunAuthority): string {
  return sha256(Buffer.from(canonicalize(authority), "utf8"));
}

export function resolveCanonPhase(stage: StageName, planClass: PlanClass): CanonPhase {
  if (stage === "PLAN_REVIEW") return planClass === "REVIEW_FIX_PLAN" ? "FIX_PLAN_REVIEW" : "PLAN_REVIEW";
  if (stage === "PLAN_REVISION") return planClass === "REVIEW_FIX_PLAN" ? "FIX_PLAN_REVISION" : "PLAN_REVISION";
  if (stage === "IMPLEMENT") return planClass === "REVIEW_FIX_PLAN" ? "FIX_IMPLEMENT" : "IMPLEMENT";
  if (stage === "DELIVERY_RESPONSE") return "REVIEW_RESPONSE";
  return stage;
}

export function commandForStage(stage: StageName): string {
  return ({
    SEQ_NEXT: "seq-next",
    PLAN_REVIEW: "terv-review",
    PLAN_REVISION: "terv-review-utan",
    IMPLEMENT: "implement",
    STEP_REVIEW: "step-review",
    DELIVERY_RESPONSE: "step-review-utan",
    CLOSEOUT: "closeout-commit",
  } as const)[stage];
}

export function parseOutputShape(stage: StageName, raw: string): ParsedOutput {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^([^:\n]+):\s*(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) {
      const name = match[1].trim();
      const value = match[2].trim();
      if (Object.hasOwn(fields, name) && fields[name] !== value) throw new Error(`Duplicate output field: ${name}`);
      fields[name] = value;
    }
  }
  const rules: Record<StageName, { start: string; terminals: RegExp }> = {
    SEQ_NEXT: { start: "EPIC IMPLEMENTATION PLAN", terminals: /^Readiness: (READY|NOT_READY|BLOCKED)$/m },
    PLAN_REVIEW: { start: "META PLAN REVIEW", terminals: /^Overall verdict: (GREEN|YELLOW|RED)$/m },
    PLAN_REVISION: { start: "REVISED ", terminals: /^PLAN_REVISION_COMPLETE\n(IMPLEMENT_READY|IMPLEMENT_BLOCKED)$/m },
    IMPLEMENT: { start: "IMPLEMENTATION RESULT", terminals: /^(REVIEW_READY|IMPLEMENT_BLOCKED)$/m },
    STEP_REVIEW: { start: "FINAL STEP REVIEW SYNTHESIS", terminals: /^Closeout disposition: (ALLOWED|FIX_REQUIRED|BLOCKED)$/m },
    DELIVERY_RESPONSE: { start: "", terminals: /^(ACK_ONLY|FIX_PLAN_REQUIRED|UNCLEAR)$/m },
    CLOSEOUT: { start: "CLOSEOUT + COMMIT RESULT", terminals: /^Push: NOT_PERFORMED$/m },
  };
  const rule = rules[stage];
  if (rule.start && !text.startsWith(rule.start)) throw new Error(`Output shape does not match ${stage}`);
  let outputPlanClass: PlanClass | undefined;
  if (stage === "SEQ_NEXT") outputPlanClass = "EPIC_PLAN";
  if (stage === "PLAN_REVIEW") {
    if (fields["Plan class"] !== "EPIC_PLAN" && fields["Plan class"] !== "REVIEW_FIX_PLAN") throw new Error("PLAN_REVIEW Plan class is invalid");
    outputPlanClass = fields["Plan class"];
  }
  if (stage === "PLAN_REVISION") {
    if (text.startsWith("REVISED EPIC IMPLEMENTATION PLAN\n")) outputPlanClass = "EPIC_PLAN";
    else if (text.startsWith("REVISED REVIEW-FIX PLAN\n")) outputPlanClass = "REVIEW_FIX_PLAN";
    else throw new Error("PLAN_REVISION canonical plan header is invalid");
  }
  if (stage === "DELIVERY_RESPONSE" && text.startsWith("FIX_PLAN_REQUIRED\n")) outputPlanClass = "REVIEW_FIX_PLAN";
  const terminalMatches = [...text.matchAll(new RegExp(rule.terminals.source, `${rule.terminals.flags.includes("g") ? rule.terminals.flags : `${rule.terminals.flags}g`}`))];
  if (terminalMatches.length !== 1) throw new Error(`Output has no unique ${stage} terminal`);
  const common = ["Target", "Epic"];
  const required: Partial<Record<StageName, string[]>> = {
    SEQ_NEXT: [...common, "Wave", "Accountable Lane / class / profile", "Prerequisites/current state", "Scope/non-goals", "Interfaces/ownership", "Feature -> User Story -> Task", "Risks", "Ordered implementation plan", "Acceptance -> verification -> evidence", "Handoffs/exact blockers", "Plan artifact", "Next route", "Readiness"],
    PLAN_REVIEW: [...common, "Plan class", "Plan artifact", "Accountable Lane / class / profile", "Overall verdict", "Blocking corrections", "Non-blocking improvements", "Ownership/dependency decision", "Acceptance/evidence decision", "Exact Delivery Lane action"],
    IMPLEMENT: [...common, "Accountable Lane / class / profile", "Plan/fix-plan identity", "Changed artifacts", "Explicit non-changes", "Acceptance mapping", "Checks/results", "Candidate identity/worktree limitations", "Diff self-review", "Unresolved risks/findings", "Exact route"],
    STEP_REVIEW: [...common, "Candidate", "Accountable Lane / class / profile", "Reviewed scope", "Overall verdict", "Review routing", "Acceptance/evidence matrix", "Accepted findings", "Rejected/downgraded findings", "Verification result", "Proposed closeout delta", "Closeout disposition", "Commit status", "Exact Delivery Lane action"],
    CLOSEOUT: [...common, "Accountable Lane / class / profile", "workflow_verdict", "domain_verdict", "routing_verdict", "next_role_action", "State/Combined/findings/evidence reconciliation", "Candidate identity", "Staged explicit paths", "Verification", "Commit", "Push"],
  };
  if (stage === "PLAN_REVISION") {
    const planFields = text.startsWith("REVISED REVIEW-FIX PLAN")
      ? [...common, "Candidate", "Accountable Lane / class / profile", "Accepted finding IDs", "Allowed surfaces", "Forbidden surfaces", "Finding -> change -> acceptance/check", "Dependencies", "Fix-plan artifact", "Next route", "Readiness", "Applied review items", "Rejected/unclear items", "Final plan artifact"]
      : [...common, "Wave", "Accountable Lane / class / profile", "Prerequisites/current state", "Scope/non-goals", "Interfaces/ownership", "Feature -> User Story -> Task", "Risks", "Ordered implementation plan", "Acceptance -> verification -> evidence", "Handoffs/exact blockers", "Plan artifact", "Next route", "Readiness", "Applied review items", "Rejected/unclear items", "Final plan artifact"];
    required.PLAN_REVISION = planFields;
  }
  if (stage === "DELIVERY_RESPONSE") {
    if (text === "ACK_ONLY") return { kind: stage, terminal: "ACK_ONLY", fields, raw_sha256: sha256(text) };
    if (text.startsWith("FIX_PLAN_REQUIRED")) required.DELIVERY_RESPONSE = [...common, "Candidate", "Accountable Lane / class / profile", "Accepted finding IDs", "Allowed surfaces", "Forbidden surfaces", "Finding -> change -> acceptance/check", "Dependencies", "Fix-plan artifact"];
    else if (!text.startsWith("UNCLEAR\n") || text.split("\n").length < 2) throw new Error("Delivery response must be exact bare ACK_ONLY or a complete FIX_PLAN_REQUIRED/UNCLEAR artifact");
  }
  for (const field of required[stage] ?? []) if (!fields[field]) throw new Error(`${stage} output is missing required field ${field}`);
  if (stage === "SEQ_NEXT" && !text.endsWith(`Next route: ${fields["Next route"]}\nReadiness: ${fields.Readiness}`)) throw new Error("SEQ_NEXT route and terminal are not the final ordered lines");
  if (stage === "PLAN_REVIEW" && !text.endsWith(`Exact Delivery Lane action: ${fields["Exact Delivery Lane action"]}`)) throw new Error("PLAN_REVIEW action is not the final line");
  if (stage === "PLAN_REVISION") {
    const planField = text.startsWith("REVISED REVIEW-FIX PLAN") ? "Fix-plan artifact" : "Plan artifact";
    if (fields[planField] !== fields["Final plan artifact"]) throw new Error("PLAN_REVISION plan identity mismatch");
    if (!text.endsWith(`PLAN_REVISION_COMPLETE\n${terminalMatches[0]?.[1]}`)) throw new Error("PLAN_REVISION terminals are not the final ordered lines");
    if (text.startsWith("REVISED REVIEW-FIX PLAN") && !text.includes("\nFIX_PLAN_READY_FOR_IMPLEMENT\n")) throw new Error("Review-fix revision is missing FIX_PLAN_READY_FOR_IMPLEMENT");
    assertOpaqueId(fields[planField]!, planField);
  }
  if (stage === "IMPLEMENT" && !text.endsWith(`Exact route: ${fields["Exact route"]}\n${terminalMatches[0]?.[0]}`)) throw new Error("IMPLEMENT route and terminal are not the final ordered lines");
  if (stage === "IMPLEMENT") {
    assertOpaqueId(fields["Plan/fix-plan identity"]!, "Plan/fix-plan identity");
    if (terminalMatches[0]?.[0] === "REVIEW_READY" && fields["Exact route"] !== "Meta /step-review") throw new Error("IMPLEMENT REVIEW_READY route must be Meta /step-review");
  }
  if (stage === "STEP_REVIEW" && !text.endsWith(`Exact Delivery Lane action: ${fields["Exact Delivery Lane action"]}`)) throw new Error("STEP_REVIEW action is not the final line");
  if (stage === "STEP_REVIEW") {
    if (!["GREEN", "YELLOW", "RED"].includes(fields["Overall verdict"]!)) throw new Error("STEP_REVIEW overall verdict is invalid");
    if (fields["Commit status"] !== "DEFERRED_TO_CLOSEOUT") throw new Error("STEP_REVIEW commit status is invalid");
    assertOpaqueId(fields.Candidate!, "Candidate");
  }
  if (stage === "DELIVERY_RESPONSE" && text.startsWith("FIX_PLAN_REQUIRED")) {
    if (!text.endsWith("FIX_PLAN_READY_FOR_IMPLEMENT")) throw new Error("FIX_PLAN_REQUIRED response is missing final FIX_PLAN_READY_FOR_IMPLEMENT");
    assertOpaqueId(fields.Candidate!, "Candidate");
    assertOpaqueId(fields["Fix-plan artifact"]!, "Fix-plan artifact");
  }
  if (stage === "CLOSEOUT") {
    if (!text.endsWith("Push: NOT_PERFORMED") || fields.Push !== "NOT_PERFORMED") throw new Error("CLOSEOUT Push must be the final NOT_PERFORMED line");
    if (!["COMPLETE", "INCOMPLETE", "BLOCKED", "NOT_YET_EVALUATED"].includes(fields.workflow_verdict!)) throw new Error("CLOSEOUT workflow verdict is invalid");
    if (!["ACCEPTED", "LIMITED", "REJECTED", "NOT_YET_EVALUATED"].includes(fields.domain_verdict!)) throw new Error("CLOSEOUT domain verdict is invalid");
    if (!["CONTINUE", "BLOCKED", "CLOSED", "NOT_YET_EVALUATED"].includes(fields.routing_verdict!)) throw new Error("CLOSEOUT routing verdict is invalid");
    assertOpaqueId(fields["Candidate identity"]!, "Candidate identity");
    const verifiedCandidate = /(?:^|;)\s*candidate=([^;]+)/.exec(fields.Verification!)?.[1]?.trim();
    if (verifiedCandidate !== fields["Candidate identity"]) throw new Error("CLOSEOUT candidate identity mismatch");
    const verificationResult = /^result=(PASS|FAIL|NOT_RUN);/.exec(fields.Verification!)?.[1];
    const committedTree = /(?:^|;)\s*committed_tree=([^;]+)/.exec(fields.Verification!)?.[1]?.trim();
    if (!verificationResult || !committedTree) throw new Error("CLOSEOUT Verification field is malformed");
    if (fields.Commit!.startsWith("NO_COMMIT reason=")) {
      if (fields["Staged explicit paths"] !== "NONE") throw new Error("CLOSEOUT NO_COMMIT requires Staged explicit paths: NONE");
      if (committedTree !== "NOT_APPLICABLE") throw new Error("CLOSEOUT NO_COMMIT requires committed_tree=NOT_APPLICABLE");
    } else {
      const commit = /^sha=([a-f0-9]{40}|[a-f0-9]{64});\s*tree=([a-f0-9]{40}|[a-f0-9]{64});\s*message=(.+)$/.exec(fields.Commit!);
      if (!commit || commit[2] !== committedTree) throw new Error("CLOSEOUT committed receipt is malformed or tree-mismatched");
      if (verificationResult !== "PASS") throw new Error("CLOSEOUT commit requires Verification result=PASS");
      const staged = parseStrictJson(fields["Staged explicit paths"]!);
      if (!Array.isArray(staged) || staged.length === 0 || staged.some((item) => typeof item !== "string")) throw new Error("CLOSEOUT commit requires nonempty staged path array");
      for (const stagedPath of staged as string[]) assertSafeRelativePath(stagedPath, "staged path");
    }
    if (fields.routing_verdict === "CLOSED") {
      const reconciliation = /^result=(PASS|NOT_REQUIRED);/.test(fields["State/Combined/findings/evidence reconciliation"]!);
      if (fields.workflow_verdict !== "COMPLETE" || !["ACCEPTED", "LIMITED"].includes(fields.domain_verdict!) || !reconciliation || verificationResult !== "PASS" || fields.next_role_action !== "NONE") {
        throw new Error("CLOSEOUT CLOSED verdict prerequisites are not satisfied");
      }
    }
  }
  return { kind: stage, terminal: terminalMatches[0]?.[1] ?? terminalMatches[0]?.[0] ?? "", fields, raw_sha256: sha256(text), ...(outputPlanClass ? { plan_class: outputPlanClass } : {}) };
}

export function validateOutputBinding(parsed: ParsedOutput, expected: { target: string; epic: string; lane: string; candidate?: string; plan?: string; plan_class?: PlanClass }): void {
  const compare = (field: string, value: string, required = false): void => {
    if (required && parsed.fields[field] === undefined) throw new Error(`${field} binding missing`);
    if (parsed.fields[field] !== undefined && parsed.fields[field] !== value) throw new Error(`${field} binding mismatch`);
  };
  const authorityFieldsRequired = parsed.kind !== "DELIVERY_RESPONSE";
  if (authorityFieldsRequired && parsed.fields.Target === undefined) throw new Error("Target binding missing");
  if (parsed.fields.Target !== undefined && canonicalTargetLabel(parsed.fields.Target) !== canonicalTargetLabel(expected.target)) throw new Error("Target binding mismatch");
  compare("Epic", expected.epic, authorityFieldsRequired);
  compare("Accountable Lane / class / profile", expected.lane);
  if (expected.candidate && parsed.kind === "STEP_REVIEW") compare("Candidate", expected.candidate, true);
  if (expected.candidate && parsed.kind === "DELIVERY_RESPONSE" && parsed.terminal === "FIX_PLAN_REQUIRED") compare("Candidate", expected.candidate, true);
  if (expected.candidate && parsed.kind === "CLOSEOUT") compare("Candidate identity", expected.candidate, true);
  if (expected.candidate && parsed.kind === "IMPLEMENT") assertImplementationCandidateBinding(parsed.fields, expected.candidate);
  if (expected.plan && parsed.kind === "PLAN_REVIEW") compare("Plan artifact", expected.plan, true);
  if (expected.plan && parsed.kind === "IMPLEMENT") compare("Plan/fix-plan identity", expected.plan, true);
  if (parsed.kind === "DELIVERY_RESPONSE" && parsed.terminal === "FIX_PLAN_REQUIRED") {
    if (parsed.plan_class !== "REVIEW_FIX_PLAN") throw new Error("FIX_PLAN_REQUIRED must establish REVIEW_FIX_PLAN lineage");
  } else if (expected.plan_class && parsed.plan_class !== undefined && parsed.plan_class !== expected.plan_class) {
    throw new Error("Plan class binding mismatch");
  }
}

function assertImplementationCandidateBinding(fields: Readonly<Record<string, string>>, expectedCandidate: string): void {
  const value = fields["Candidate identity/worktree limitations"];
  if (typeof value !== "string") throw new Error("Candidate identity/worktree limitations binding missing");
  assertOpaqueId(expectedCandidate, "Candidate identity");
  if (!value.startsWith(expectedCandidate) || (value.length > expectedCandidate.length && OPAQUE_ID_CHAR.test(value[expectedCandidate.length]!))) throw new Error("Candidate identity/worktree limitations binding mismatch");
}

function canonicalTargetLabel(value: string): string {
  return value.trim().replace(/\s+repository$/i, "").toLowerCase();
}

export function sameSources(left: readonly SourceBinding[], right: readonly SourceBinding[]): boolean {
  return canonicalize(left) === canonicalize(right);
}

export function parseStrictJson(text: string): unknown {
  let index = 0;
  const whitespace = (): void => { while ([" ", "\t", "\r", "\n"].includes(text[index] ?? "")) index += 1; };
  const stringValue = (): string => {
    const start = index;
    if (text[index] !== '"') throw new Error("Expected JSON string");
    index += 1;
    while (index < text.length) {
      const current = text[index];
      if (current === '"') {
        index += 1;
        return JSON.parse(text.slice(start, index)) as string;
      }
      if (current === "\\") index += 2;
      else index += 1;
    }
    throw new Error("Unterminated JSON string");
  };
  const value = (): unknown => {
    whitespace();
    const current = text[index];
    if (current === '"') return stringValue();
    if (current === "{") {
      index += 1;
      const result: Record<string, unknown> = {};
      const keys = new Set<string>();
      whitespace();
      if (text[index] === "}") { index += 1; return result; }
      while (true) {
        whitespace();
        const key = stringValue();
        if (keys.has(key)) throw new Error(`Duplicate JSON member: ${key}`);
        keys.add(key);
        whitespace();
        if (text[index] !== ":") throw new Error("Expected JSON member separator");
        index += 1;
        result[key] = value();
        whitespace();
        if (text[index] === "}") { index += 1; return result; }
        if (text[index] !== ",") throw new Error("Expected JSON object delimiter");
        index += 1;
      }
    }
    if (current === "[") {
      index += 1;
      const result: unknown[] = [];
      whitespace();
      if (text[index] === "]") { index += 1; return result; }
      while (true) {
        result.push(value());
        whitespace();
        if (text[index] === "]") { index += 1; return result; }
        if (text[index] !== ",") throw new Error("Expected JSON array delimiter");
        index += 1;
      }
    }
    const rest = text.slice(index);
    for (const [token, parsed] of [["true", true], ["false", false], ["null", null]] as const) {
      if (rest.startsWith(token)) { index += token.length; return parsed; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest)?.[0];
    if (number) {
      index += number.length;
      const parsedNumber = Number(number);
      if (!Number.isFinite(parsedNumber)) throw new Error("JSON number must be finite");
      return parsedNumber;
    }
    throw new Error("Invalid JSON value");
  };
  const parsed = value();
  whitespace();
  if (index !== text.length) throw new Error("Trailing JSON input");
  return parsed;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function requireExactKeys(record: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (canonicalize(actual) !== canonicalize(wanted)) throw new Error(`${label} has missing or unknown fields`);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a nonempty string`);
  return value;
}

function parseSourceBinding(value: unknown, index: number, label: string): SourceBinding {
  const source = requireRecord(value, `${label} ${index}`);
  requireExactKeys(source, ["path", "source_class", "logical_identity", "producer", "sha256", "order"], `${label} ${index}`);
  const order = source.order;
  if (!Number.isSafeInteger(order) || order !== index) throw new Error("source order must be contiguous and zero-based");
  const sourcePath = requireString(source, "path");
  assertSafeRelativePath(sourcePath, "source path");
  const sourceClass = requireString(source, "source_class");
  if (!["PLANNING_CONTEXT", "PLAN", "META_PLAN_REVIEW", "REVISED_PLAN", "IMPLEMENTATION_RESULT", "ACCEPTANCE_EVIDENCE", "FINAL_SYNTHESIS", "DELIVERY_RESPONSE", "PROPOSED_DELTA", "CLOSEOUT_AUTHORITY"].includes(sourceClass)) throw new Error("source_class is invalid");
  const digest = requireString(source, "sha256");
  assertSha256(digest, "source sha256");
  const logicalIdentity = requireString(source, "logical_identity");
  const producer = requireString(source, "producer");
  assertOpaqueId(logicalIdentity, "source logical_identity");
  assertOpaqueId(producer, "source producer");
  return { path: sourcePath, source_class: sourceClass as SourceClass, logical_identity: logicalIdentity, producer, sha256: digest, order };
}

export function parseStageSourceManifest(value: unknown): StageSourceManifest {
  const record = requireRecord(value, "stage source manifest");
  requireExactKeys(record, ["schema_version", "target_id", "epic", "candidate_identity", "entries"], "stage source manifest");
  if (record.schema_version !== "stage-source-manifest.v1") throw new Error("stage source manifest schema mismatch");
  if (!Array.isArray(record.entries) || record.entries.length === 0) throw new Error("stage source manifest entries must be a nonempty array");
  const entryKeys = new Set<string>();
  const entries = record.entries.map((value, entryIndex): StageSourceManifestEntry => {
    const entry = requireRecord(value, `stage source manifest entry ${entryIndex}`);
    requireExactKeys(entry, ["stage", "plan_class", "sources"], `stage source manifest entry ${entryIndex}`);
    const stage = requireString(entry, "stage");
    if (!(STAGES as readonly string[]).includes(stage)) throw new Error("stage source manifest stage is invalid");
    const planClass = requireString(entry, "plan_class");
    if (planClass !== "EPIC_PLAN" && planClass !== "REVIEW_FIX_PLAN") throw new Error("stage source manifest plan_class is invalid");
    const key = `${stage}\n${planClass}`;
    if (entryKeys.has(key)) throw new Error("stage source manifest has a duplicate stage and plan class entry");
    entryKeys.add(key);
    if (!Array.isArray(entry.sources)) throw new Error("stage source manifest sources must be an array");
    const sources = entry.sources.map((source, sourceIndex) => parseSourceBinding(source, sourceIndex, "manifest source"));
    const sourceKeys = new Set<string>();
    for (const source of sources) {
      const sourceKey = `${source.source_class}\n${source.path}\n${source.logical_identity}`;
      if (sourceKeys.has(sourceKey)) throw new Error("stage source manifest has a duplicate source binding");
      sourceKeys.add(sourceKey);
    }
    return { stage: stage as StageName, plan_class: planClass, sources };
  });
  const targetId = requireString(record, "target_id");
  const epic = requireString(record, "epic");
  const candidateIdentity = requireString(record, "candidate_identity");
  assertOpaqueId(targetId, "manifest target_id");
  assertOpaqueId(epic, "manifest epic");
  assertOpaqueId(candidateIdentity, "manifest candidate_identity");
  return { schema_version: "stage-source-manifest.v1", target_id: targetId, epic, candidate_identity: candidateIdentity, entries };
}

export function parseRunRequest(value: unknown): RunRequest {
  const record = requireRecord(value, "run request");
  requireExactKeys(record, ["schema_version", "target_id", "expected_worktree_identity"], "run request");
  if (record.schema_version !== "run-request.v1") throw new Error("run request schema mismatch");
  const targetId = requireString(record, "target_id");
  const worktree = requireString(record, "expected_worktree_identity");
  assertOpaqueId(targetId, "target_id");
  return { schema_version: "run-request.v1", target_id: targetId, expected_worktree_identity: worktree };
}

export function parseCloseoutAuthorityInstallRequest(value: unknown): CloseoutAuthorityInstallRequest {
  const record = requireRecord(value, "closeout authority install request");
  requireExactKeys(record, ["schema_version", "run_id", "delivery_operation_id", "closeout_authority"], "closeout authority install request");
  if (record.schema_version !== "closeout-authority-install.v1") throw new Error("Closeout authority install request schema mismatch");
  const runId = requireString(record, "run_id");
  const deliveryOperationId = requireString(record, "delivery_operation_id");
  assertFilesystemId(runId, "run_id");
  assertFilesystemId(deliveryOperationId, "delivery_operation_id");
  return { schema_version: "closeout-authority-install.v1", run_id: runId, delivery_operation_id: deliveryOperationId, closeout_authority: requireRecord(record.closeout_authority, "closeout_authority") };
}

export function parseStageRequest(value: unknown): StageRequest {
  const record = requireRecord(value, "stage request");
  const keys = [
    "schema_version", "request_id", "run_id", "issued_at", "issued_by", "run_authority_sha256", "requested_stage",
    "plan_class", "target_id", "worktree_identity", "state_revision", "state_sha256", "combined_selector",
    "combined_span_sha256", "expected_sources", "wave", "epic", "accountable_lane", "accountable_class",
    "accountable_profile", "sender_role", "recipient_role", "plan_identity", "candidate_identity", "review_cycle",
    "finding_ids", "review_risk", "project_review_context", "expected_contract_version", "allowed_side_effect_class",
    "configuration_identity", "active_route_generation",
  ] as const;
  requireExactKeys(record, keys, "stage request");
  if (record.schema_version !== "stage-request.v1") throw new Error("stage request schema mismatch");
  const stage = requireString(record, "requested_stage");
  if (!(STAGES as readonly string[]).includes(stage)) throw new Error("requested_stage is invalid");
  const planClass = requireString(record, "plan_class");
  if (planClass !== "EPIC_PLAN" && planClass !== "REVIEW_FIX_PLAN") throw new Error("plan_class is invalid");
  const sideEffect = requireString(record, "allowed_side_effect_class");
  if (sideEffect !== "ROUTER_PRIVATE_ONLY" && sideEffect !== "ADDRESSED_SESSION_COMMAND") throw new Error("allowed_side_effect_class is invalid");
  const sourceValues = record.expected_sources;
  if (!Array.isArray(sourceValues)) throw new Error("expected_sources must be an array");
  const expectedSources = sourceValues.map((entry, index) => parseSourceBinding(entry, index, "source"));
  const findingValues = record.finding_ids;
  if (!Array.isArray(findingValues) || findingValues.some((item) => typeof item !== "string")) throw new Error("finding_ids must be a string array");
  const request = {
    schema_version: "stage-request.v1" as const,
    request_id: requireString(record, "request_id"),
    run_id: requireString(record, "run_id"),
    issued_at: requireString(record, "issued_at"),
    issued_by: requireString(record, "issued_by"),
    run_authority_sha256: requireString(record, "run_authority_sha256"),
    requested_stage: stage as StageName,
    plan_class: planClass,
    target_id: requireString(record, "target_id"),
    worktree_identity: requireString(record, "worktree_identity"),
    state_revision: requireString(record, "state_revision"),
    state_sha256: requireString(record, "state_sha256"),
    combined_selector: requireString(record, "combined_selector"),
    combined_span_sha256: requireString(record, "combined_span_sha256"),
    expected_sources: expectedSources,
    wave: requireString(record, "wave"),
    epic: requireString(record, "epic"),
    accountable_lane: requireString(record, "accountable_lane"),
    accountable_class: requireString(record, "accountable_class"),
    accountable_profile: requireString(record, "accountable_profile"),
    sender_role: requireString(record, "sender_role"),
    recipient_role: requireString(record, "recipient_role"),
    plan_identity: requireString(record, "plan_identity"),
    candidate_identity: requireString(record, "candidate_identity"),
    review_cycle: requireString(record, "review_cycle"),
    finding_ids: canonicalFindingIds(findingValues as string[]),
    review_risk: requireString(record, "review_risk"),
    project_review_context: requireString(record, "project_review_context"),
    expected_contract_version: requireString(record, "expected_contract_version"),
    allowed_side_effect_class: sideEffect,
    configuration_identity: requireString(record, "configuration_identity"),
    active_route_generation: requireString(record, "active_route_generation"),
  } satisfies StageRequest;
  assertOpaqueId(request.request_id, "request_id");
  assertOpaqueId(request.run_id, "run_id");
  assertSha256(request.run_authority_sha256, "run_authority_sha256");
  assertSha256(request.state_sha256, "state_sha256");
  assertSha256(request.combined_span_sha256, "combined_span_sha256");
  if (!Number.isFinite(Date.parse(request.issued_at))) throw new Error("issued_at is invalid");
  if (!/^(?:0|[1-9]\d*)$/.test(request.review_cycle)) throw new Error("review_cycle must be a nonnegative decimal integer");
  return request;
}

export function stageRequestFromInvocation(invocation: StageInvocation): StageRequest {
  const {
    operation_id: _operationId,
    canon_phase: _canonPhase,
    command_name: _commandName,
    command_argument_sha256: _commandArgumentSha256,
    command_body_sha256: _commandBodySha256,
    semantic_key: _semanticKey,
    recipient_session_sha256: _recipientSessionSha256,
    router_protocol_identity: _routerProtocolIdentity,
    capability_receipt_sha256: _capabilityReceiptSha256,
    snapshot_correlation: _snapshotCorrelation,
    schema_version: _schemaVersion,
    ...request
  } = invocation;
  return { ...request, schema_version: "stage-request.v1" };
}
