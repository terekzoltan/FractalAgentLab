import {
  parseOutputShape,
  sha256,
  validateOutputBinding,
  type ParsedOutput,
  type PlanClass,
  type RouterPolicyDisposition,
  type RouterPolicyMode,
  type RouterWarningRule,
  type StageName,
} from "./contracts.js";

export interface OutputBindingExpectation {
  target: string;
  epic: string;
  lane: string;
  candidate?: string;
  plan?: string;
  plan_class?: PlanClass;
}

export interface OutputPolicyInput {
  mode: RouterPolicyMode;
  stage: StageName;
  raw: string;
  expected: OutputBindingExpectation;
}

export interface OutputPolicyDecision {
  disposition: RouterPolicyDisposition;
  router_policy_mode: RouterPolicyMode;
  warning_rules: RouterWarningRule[];
  normalized_fields: string[];
  input_sha256: string;
  normalized_output_sha256: string;
  normalized_output?: string;
  parsed_output?: ParsedOutput;
  reason: string;
}

interface StageBoundary {
  starts: readonly RegExp[];
  end: RegExp;
  terminal: RegExp;
}

const STAGE_BOUNDARIES: Readonly<Record<StageName, StageBoundary>> = {
  SEQ_NEXT: {
    starts: [/^EPIC IMPLEMENTATION PLAN$/],
    end: /^Readiness: (?:READY|NOT_READY|BLOCKED)$/,
    terminal: /^Readiness: (READY|NOT_READY|BLOCKED)$/,
  },
  PLAN_REVIEW: {
    starts: [/^META PLAN REVIEW$/],
    end: /^Exact Delivery Lane action: .+$/,
    terminal: /^Overall verdict: (GREEN|YELLOW|RED)$/,
  },
  PLAN_REVISION: {
    starts: [/^REVISED EPIC IMPLEMENTATION PLAN$/, /^REVISED REVIEW-FIX PLAN$/],
    end: /^(?:IMPLEMENT_READY|IMPLEMENT_BLOCKED)$/,
    terminal: /^(IMPLEMENT_READY|IMPLEMENT_BLOCKED)$/,
  },
  IMPLEMENT: {
    starts: [/^IMPLEMENTATION RESULT$/],
    end: /^(?:REVIEW_READY|IMPLEMENT_BLOCKED)$/,
    terminal: /^(REVIEW_READY|IMPLEMENT_BLOCKED)$/,
  },
  STEP_REVIEW: {
    starts: [/^FINAL STEP REVIEW SYNTHESIS$/],
    end: /^Exact Delivery Lane action: .+$/,
    terminal: /^Closeout disposition: (ALLOWED|FIX_REQUIRED|BLOCKED)$/,
  },
  DELIVERY_RESPONSE: {
    starts: [/^ACK_ONLY$/, /^FIX_PLAN_REQUIRED$/, /^UNCLEAR$/],
    end: /^(?:ACK_ONLY|FIX_PLAN_READY_FOR_IMPLEMENT)$/,
    terminal: /^(ACK_ONLY|FIX_PLAN_REQUIRED|UNCLEAR)$/,
  },
  CLOSEOUT: {
    starts: [/^CLOSEOUT \+ COMMIT RESULT$/],
    end: /^Push: NOT_PERFORMED$/,
    terminal: /^Push: (NOT_PERFORMED)$/,
  },
};

const DEFAULT_FIELDS: Readonly<Partial<Record<StageName, readonly { field: string; anchor: RegExp }[]>>> = {
  PLAN_REVIEW: [
    { field: "Non-blocking improvements", anchor: /^Ownership\/dependency decision:/ },
  ],
  PLAN_REVISION: [
    { field: "Rejected/unclear items", anchor: /^Final plan artifact:/ },
  ],
  IMPLEMENT: [
    { field: "Explicit non-changes", anchor: /^Acceptance mapping:/ },
    { field: "Unresolved risks/findings", anchor: /^Exact route:/ },
  ],
  STEP_REVIEW: [
    { field: "Rejected/downgraded findings", anchor: /^Verification result:/ },
  ],
};

const HARMLESS_WRAPPER_LINES = new Set([
  "Here is the requested canonical output:",
  "End of canonical output.",
  "Progress note: review completed.",
  "Explanation: retained outside the canonical artifact.",
]);

export function evaluateOutputPolicy(input: OutputPolicyInput): OutputPolicyDecision {
  const canonicalInput = canonicalText(input.raw);
  const base = {
    router_policy_mode: input.mode,
    input_sha256: sha256(input.raw),
  } as const;

  const exact = parseAndBind(input.stage, canonicalInput, input.expected);
  if (exact.kind === "accepted") {
    return {
      ...base,
      disposition: "ACCEPTED_EXACT",
      warning_rules: [],
      normalized_fields: [],
      normalized_output_sha256: sha256(canonicalInput),
      normalized_output: canonicalInput,
      parsed_output: exact.parsed,
      reason: "exact canonical output",
    };
  }
  if (exact.kind === "authority") {
    return blocked(base, input.mode, "BLOCKED_AUTHORITY", canonicalInput, exact.reason);
  }

  const candidateSearch = boundedCandidate(input.stage, canonicalInput);
  if (candidateSearch.kind === "ambiguous") {
    return blocked(base, input.mode, "BLOCKED_AMBIGUOUS", canonicalInput, "multiple canonical output envelopes");
  }

  const candidate = candidateSearch.kind === "one" ? candidateSearch.output : undefined;
  const isWrapped = candidate !== undefined && candidate !== canonicalInput;
  if (input.mode === "STRICT" && isWrapped) {
    return blocked(base, input.mode, "BLOCKED_AMBIGUOUS", canonicalInput, "STRICT forbids wrapped output");
  }

  const bounded = candidate ?? (isSingleIncompleteEnvelope(input.stage, canonicalInput) ? canonicalInput : undefined);
  if (bounded === undefined) {
    return blocked(base, input.mode, "BLOCKED_AMBIGUOUS", canonicalInput, exact.reason);
  }

  const warningRules: RouterWarningRule[] = [];
  if (isWrapped) warningRules.push("UNIQUE_CANONICAL_ENVELOPE");
  let semanticOutput = bounded;
  let semanticReason = exact.reason;
  let normalizedFields: string[] = [];

  if (input.mode === "STANDARD") {
    const wrappedExact = parseAndBind(input.stage, bounded, input.expected);
    if (wrappedExact.kind === "accepted") {
      return acceptedNormalized(base, input.mode, bounded, wrappedExact.parsed, warningRules, [], "one uniquely bounded canonical output envelope");
    }
    if (wrappedExact.kind === "authority") {
      return blocked(base, input.mode, "BLOCKED_AUTHORITY", bounded, wrappedExact.reason);
    }
    semanticReason = wrappedExact.reason;

    const defaulted = applyDeterministicDefaults(input.stage, bounded);
    if (defaulted.fields.length > 0) {
      semanticOutput = defaulted.output;
      normalizedFields = defaulted.fields;
      warningRules.push("DETERMINISTIC_OPTIONAL_DEFAULT");
      const normalized = parseAndBind(input.stage, defaulted.output, input.expected);
      if (normalized.kind === "accepted") {
        return acceptedNormalized(base, input.mode, defaulted.output, normalized.parsed, warningRules, defaulted.fields, "finite deterministic non-authority defaults");
      }
      if (normalized.kind === "authority") {
        return blocked(base, input.mode, "BLOCKED_AUTHORITY", defaulted.output, normalized.reason);
      }
      semanticReason = normalized.reason;
    }
  }

  const incomplete = minimallyParseAndBind(input.stage, semanticOutput, input.expected);
  if (incomplete.kind === "authority") {
    return blocked(base, input.mode, "BLOCKED_AUTHORITY", semanticOutput, incomplete.reason);
  }
  if (incomplete.kind === "accepted" && isRequiredSemanticFactOmission(semanticReason, input.stage, semanticOutput)) {
    if (input.mode === "STRICT") {
      return blocked(base, input.mode, "BLOCKED_AMBIGUOUS", semanticOutput, semanticReason);
    }
    return {
      ...base,
      disposition: "ACCEPTED_NO_SUCCESSOR",
      warning_rules: [...new Set([...warningRules, "REQUIRED_SEMANTIC_FACT_MISSING" as const])],
      normalized_fields: normalizedFields,
      normalized_output_sha256: sha256(semanticOutput),
      normalized_output: semanticOutput,
      reason: semanticReason,
    };
  }

  return blocked(base, input.mode, "BLOCKED_AMBIGUOUS", semanticOutput, semanticReason);
}

type ParseAttempt =
  | { kind: "accepted"; parsed: ParsedOutput }
  | { kind: "authority"; reason: string }
  | { kind: "shape"; reason: string };

function parseAndBind(stage: StageName, output: string, expected: OutputBindingExpectation): ParseAttempt {
  let parsed: ParsedOutput;
  try {
    parsed = parseOutputShape(stage, output);
  } catch (error) {
    return { kind: "shape", reason: errorMessage(error) };
  }
  try {
    validateOutputBinding(parsed, expected);
  } catch (error) {
    return { kind: "authority", reason: errorMessage(error) };
  }
  return { kind: "accepted", parsed };
}

function minimallyParseAndBind(stage: StageName, output: string, expected: OutputBindingExpectation): ParseAttempt {
  const lines = output.split("\n");
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const match = /^([^:\n]+):\s*(.*)$/.exec(line);
    if (!match?.[1] || match[2] === undefined) continue;
    const field = match[1].trim();
    const value = match[2].trim();
    if (Object.hasOwn(fields, field) && fields[field] !== value) return { kind: "shape", reason: `Duplicate output field: ${field}` };
    fields[field] = value;
  }
  if (!fields.Target || !fields.Epic || !fields["Accountable Lane / class / profile"]) {
    return { kind: "authority", reason: "required authority binding missing" };
  }
  const terminals = lines.filter((line) => STAGE_BOUNDARIES[stage].terminal.test(line));
  if (terminals.length !== 1) return { kind: "shape", reason: `Output has no unique ${stage} terminal` };
  const parsed: ParsedOutput = {
    kind: stage,
    terminal: terminalValue(stage, terminals[0]!),
    fields,
    raw_sha256: sha256(output),
    ...planClassFromOutput(stage, output, fields),
  };
  try {
    validateOutputBinding(parsed, expected);
  } catch (error) {
    return { kind: "authority", reason: errorMessage(error) };
  }
  return { kind: "accepted", parsed };
}

type CandidateSearch = { kind: "none" } | { kind: "one"; output: string } | { kind: "ambiguous" };

function boundedCandidate(stage: StageName, output: string): CandidateSearch {
  const lines = output.split("\n");
  const boundary = STAGE_BOUNDARIES[stage];
  const starts = lines.flatMap((line, index) => boundary.starts.some((pattern) => pattern.test(line)) ? [index] : []);
  const ends = lines.flatMap((line, index) => boundary.end.test(line) ? [index] : []);
  if (starts.length > 1 || ends.length > 1) return { kind: "ambiguous" };
  const start = starts[0];
  const end = ends[0];
  if (start === undefined || end === undefined || end < start) return { kind: "none" };
  const outside = [...lines.slice(0, start), ...lines.slice(end + 1)];
  if (outside.some((line) => !isHarmlessWrapperLine(line, boundary))) return { kind: "ambiguous" };
  const candidate = lines.slice(start, end + 1).join("\n");
  return isStructurallyBounded(stage, candidate) ? { kind: "one", output: candidate } : { kind: "none" };
}

function isHarmlessWrapperLine(line: string, boundary: StageBoundary): boolean {
  const value = line.trim();
  if (!value) return true;
  // Only exact, reviewed, semantically inert wrapper lines may be discarded.
  // Arbitrary prose can contradict the canonical envelope without using a
  // field-shaped `name: value` form, so it must remain fail-closed.
  if (boundary.starts.some((pattern) => pattern.test(value)) || boundary.end.test(value) || boundary.terminal.test(value)) return false;
  return HARMLESS_WRAPPER_LINES.has(value);
}

function isStructurallyBounded(stage: StageName, output: string): boolean {
  const lines = output.split("\n");
  const boundary = STAGE_BOUNDARIES[stage];
  if (!boundary.starts.some((pattern) => pattern.test(lines[0] ?? ""))) return false;
  if (!boundary.end.test(lines.at(-1) ?? "")) return false;
  return lines.filter((line) => boundary.terminal.test(line)).length === 1;
}

function isSingleIncompleteEnvelope(stage: StageName, output: string): boolean {
  const lines = output.split("\n");
  const boundary = STAGE_BOUNDARIES[stage];
  const starts = lines.filter((line) => boundary.starts.some((pattern) => pattern.test(line)));
  const terminals = lines.filter((line) => boundary.terminal.test(line));
  return starts.length === 1 && boundary.starts.some((pattern) => pattern.test(lines[0] ?? "")) && terminals.length === 1;
}

function applyDeterministicDefaults(stage: StageName, output: string): { output: string; fields: string[] } {
  const lines = output.split("\n");
  const fields: string[] = [];
  for (const rule of DEFAULT_FIELDS[stage] ?? []) {
    if (lines.some((line) => line.startsWith(`${rule.field}:`))) continue;
    const anchor = lines.findIndex((line) => rule.anchor.test(line));
    if (anchor < 0) continue;
    lines.splice(anchor, 0, `${rule.field}: NONE`);
    fields.push(rule.field);
  }
  return { output: lines.join("\n"), fields };
}

function acceptedNormalized(
  base: { router_policy_mode: RouterPolicyMode; input_sha256: string },
  mode: RouterPolicyMode,
  output: string,
  parsed: ParsedOutput,
  rules: RouterWarningRule[],
  fields: string[],
  reason: string,
): OutputPolicyDecision {
  return {
    ...base,
    disposition: "ACCEPTED_NORMALIZED",
    router_policy_mode: mode,
    warning_rules: [...new Set(rules)],
    normalized_fields: fields,
    normalized_output_sha256: sha256(output),
    normalized_output: output,
    parsed_output: parsed,
    reason,
  };
}

function blocked(
  base: { router_policy_mode: RouterPolicyMode; input_sha256: string },
  mode: RouterPolicyMode,
  disposition: "BLOCKED_AUTHORITY" | "BLOCKED_AMBIGUOUS",
  output: string,
  reason: string,
): OutputPolicyDecision {
  return {
    ...base,
    disposition,
    router_policy_mode: mode,
    warning_rules: [],
    normalized_fields: [],
    normalized_output_sha256: sha256(output),
    reason,
  };
}

function isRequiredSemanticFactOmission(reason: string, stage: StageName, output: string): boolean {
  if (/missing required field|Plan class is invalid|missing FIX_PLAN_READY_FOR_IMPLEMENT|missing final FIX_PLAN_READY_FOR_IMPLEMENT/.test(reason)) return true;
  if (stage === "DELIVERY_RESPONSE" && /^FIX_PLAN_REQUIRED$/m.test(output) && !/FIX_PLAN_READY_FOR_IMPLEMENT$/.test(output)) return true;
  return false;
}

function planClassFromOutput(stage: StageName, output: string, fields: Readonly<Record<string, string>>): { plan_class?: PlanClass } {
  if (stage === "SEQ_NEXT") return { plan_class: "EPIC_PLAN" };
  if (stage === "PLAN_REVIEW" && (fields["Plan class"] === "EPIC_PLAN" || fields["Plan class"] === "REVIEW_FIX_PLAN")) return { plan_class: fields["Plan class"] };
  if (stage === "PLAN_REVISION" && output.startsWith("REVISED EPIC IMPLEMENTATION PLAN\n")) return { plan_class: "EPIC_PLAN" };
  if (stage === "PLAN_REVISION" && output.startsWith("REVISED REVIEW-FIX PLAN\n")) return { plan_class: "REVIEW_FIX_PLAN" };
  if (stage === "DELIVERY_RESPONSE" && output.startsWith("FIX_PLAN_REQUIRED\n")) return { plan_class: "REVIEW_FIX_PLAN" };
  return {};
}

function terminalValue(stage: StageName, line: string): string {
  return STAGE_BOUNDARIES[stage].terminal.exec(line)?.[1] ?? line;
}

function canonicalText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
