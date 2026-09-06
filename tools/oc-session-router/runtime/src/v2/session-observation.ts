import path from "node:path";
import { digest } from "./contracts.js";
import { AdapterError, type AdapterReply, type MessageTokens, type OpenCodeAdapter, type OpenCodeMessage, type OpenCodeModelInfo } from "./opencode-adapter.js";

export type ObservationReader = Pick<OpenCodeAdapter, "getSession" | "getStatus" | "getHistory"> & Partial<Pick<OpenCodeAdapter, "getModelInfo">>;
export interface ModelIdentity { providerID: string; modelID: string }
export interface SessionObservationOptions {
  pageLimit?: number;
  pageBudget?: number;
  /** Explicit configured model identity, used only when the observed call lacks it. */
  model?: ModelIdentity;
  /** Must match the model whose last-call usage is being reported. */
  modelOverride?: ModelIdentity & { contextLimit: number; inputLimit?: number; outputLimit?: number };
  warnRatio?: number;
  criticalRatio?: number;
}
export interface PressureObservation {
  bestAvailableTokens: number | null;
  totalSource: "provider_reported_total" | "computed_opencode_overflow_formula" | "unavailable";
  bestAvailableSource: "provider_observed_last_completion" | "unavailable";
  usageRatio: number | null;
  usagePercent: number | null;
  warnRatio: number;
  criticalRatio: number;
  warnTokens: number | null;
  criticalTokens: number | null;
  state: "unknown" | "normal" | "warn" | "critical" | "over_limit";
  recommendation: "inspect_telemetry_do_not_guess" | "none" | "monitor_and_prepare_boundary" | "recommend_at_next_safe_boundary" | "urgent_recovery_required_no_automatic_compact";
}
export interface SessionObservation {
  schemaVersion: "session-observation/v2";
  observedAt: string;
  identity: { verified: boolean; sessionSha256: string; directorySha256: string };
  activity: "BUSY" | "IDLE" | "UNKNOWN";
  latestCompletedCall: null | {
    messageReference: string;
    completedAt: string;
    ageMs: number | null;
    providerID?: string;
    modelID?: string;
    tokens?: MessageTokens;
    fromCompactionSummary: boolean;
    freshness: "NO_NEWER_MESSAGES_OBSERVED" | "NEWER_ACTIVITY_OBSERVED" | "COMPACTION_AFTER_CALL" | "UNKNOWN";
  };
  lastCompaction: null | { messageReference: string; createdAt: string | null; source: "NATIVE_COMPACTION_PART"; completed: boolean };
  history: { coverage: "COMPLETE" | "BOUNDED" | "UNAVAILABLE"; pagesRead: number; messagesRead: number; nextCursor?: string };
  model: OpenCodeModelInfo & { limitSource: "opencode_provider_catalog" | "matching_configured_override" | "unavailable" } | null;
  activeContext: { status: "unavailable"; estimatedTokens: null; reason: "NORMALIZED_HISTORY_IS_NOT_ACTIVE_CONTEXT" };
  pressure: PressureObservation;
  budget: { tokens: number | null; basis: "input_limit" | "context_minus_output_estimate" | "context_only_estimate" | "unavailable" };
  /** Describes this GET action only. It never denies a separate compact action. */
  capabilityScope: "OBSERVATION_ACTION_ONLY_NOT_MAINTENANCE_ELIGIBILITY";
  capabilities: { readOnly: true; maySend: false; mayCompact: false; mayMutate: false };
  limitations: string[];
}

export function inputBudget(model?: OpenCodeModelInfo | null): SessionObservation["budget"] {
  if (positive(model?.inputLimit)) return { tokens: positive(model.contextLimit) ? Math.min(model.inputLimit, model.contextLimit) : model.inputLimit, basis: "input_limit" };
  if (positive(model?.contextLimit)) {
    if (positive(model.outputLimit)) return model.outputLimit < model.contextLimit
      ? { tokens: model.contextLimit - model.outputLimit, basis: "context_minus_output_estimate" }
      : { tokens: null, basis: "unavailable" };
    return { tokens: model.contextLimit, basis: "context_only_estimate" };
  }
  return { tokens: null, basis: "unavailable" };
}

/** Concise decision support, never permission or an automatic sender. */
export function continuitySummary(snapshot: SessionObservation | null | undefined, now = Date.now()) {
  const age = snapshot ? now - Date.parse(snapshot.observedAt) : NaN;
  const freshness = snapshot?.latestCompletedCall?.freshness ?? "UNKNOWN";
  let recommendation = "OBSERVE_BEFORE_WORK";
  if (snapshot?.schemaVersion === "session-observation/v2" && snapshot.budget && Number.isFinite(age) && age >= 0 && age <= 120_000 && snapshot.identity?.verified) {
    if (snapshot.activity === "BUSY") recommendation = "WAIT_FOR_IDLE_NO_INTERRUPTION";
    else if (snapshot.activity !== "IDLE") recommendation = "OBSERVE_ACTIVITY_BEFORE_MAINTENANCE";
    else if (freshness === "COMPACTION_AFTER_CALL" && snapshot.lastCompaction?.completed) recommendation = "CHECK_RESTORE_NOT_ANOTHER_COMPACT";
    else if (freshness !== "NO_NEWER_MESSAGES_OBSERVED") recommendation = "REFRESH_TELEMETRY";
    else if (snapshot.pressure?.state === "unknown") recommendation = "INSPECT_TELEMETRY_NOT_A_COMPACT_BAN";
    else if (["critical", "over_limit"].includes(snapshot.pressure?.state)) recommendation = "COMPACT_THEN_RESTORE_BEFORE_WORK";
    else recommendation = "CONTINUE_AND_MONITOR";
  }
  return {
    observedAt: snapshot?.observedAt ?? null, ageMs: Number.isFinite(age) && age >= 0 ? age : null,
    activity: snapshot?.activity ?? "UNKNOWN", freshness,
    lastCallTokens: snapshot?.pressure?.bestAvailableTokens ?? null,
    budgetTokens: snapshot?.budget?.tokens ?? null, budgetBasis: snapshot?.budget?.basis ?? "unavailable",
    usageRatio: snapshot?.pressure?.usageRatio ?? null, compactThresholdRatio: snapshot?.pressure?.criticalRatio ?? null,
    recommendation, authority: "ADVISORY_RECHECK_WORK_EFFECTS_IDLE_AND_CLAIM",
  };
}

function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function positive(value: unknown): value is number { return count(value) && value > 0; }
function validModel(value: ModelIdentity | undefined): value is ModelIdentity { return !!value && !!value.providerID?.trim() && !!value.modelID?.trim(); }
function matching(left: ModelIdentity, right: ModelIdentity): boolean { return left.providerID === right.providerID && left.modelID === right.modelID; }
function roundEven(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  const scaled = value * multiplier;
  const floor = Math.floor(scaled);
  return (scaled - floor === 0.5 ? floor + (floor % 2) : Math.round(scaled)) / multiplier;
}
function validateRatios(options: { warnRatio?: number; criticalRatio?: number }): { warnRatio: number; criticalRatio: number } {
  const criticalRatio = options.criticalRatio ?? 0.60, warnRatio = options.warnRatio ?? Math.min(0.5, criticalRatio * 5 / 6);
  if (!Number.isFinite(warnRatio) || !Number.isFinite(criticalRatio) || warnRatio < 0.01 || criticalRatio < 0.02 || criticalRatio > 0.99 || criticalRatio <= warnRatio) throw new AdapterError("INVALID_INPUT");
  return { warnRatio, criticalRatio };
}

/** Active V2 calculation. Parity source: session-context-status-core.ps1 functions
 * Get-OCRouterAssistantObservation / New-OCRouterSessionContextReport. The legacy
 * PowerShell mapping/controller retirement belongs to the launcher cutover.
 * This is observation, never a compact authorization or lifecycle policy gate. */
export function calculatePressure(tokens?: MessageTokens, contextLimit?: number, options: { warnRatio?: number; criticalRatio?: number } = {}): PressureObservation {
  const { warnRatio, criticalRatio } = validateRatios(options);
  let total: number | null = null;
  let totalSource: PressureObservation["totalSource"] = "unavailable";
  if (positive(tokens?.total)) { total = tokens.total; totalSource = "provider_reported_total"; }
  else if ([tokens?.input, tokens?.output, tokens?.cache?.read, tokens?.cache?.write].some(count)) {
    total = [tokens?.input, tokens?.output, tokens?.cache?.read, tokens?.cache?.write].reduce<number>((sum, item) => sum + (count(item) ? item : 0), 0);
    // Preserve OpenCode's fallback accounting; providers differ on reasoning
    // inclusion. Prefer their reported total rather than guessing an extra sum.
    if (Number.isSafeInteger(total)) totalSource = "computed_opencode_overflow_formula";
    else total = null;
  }
  const limit = positive(contextLimit) ? contextLimit : null;
  const ratio = limit !== null && total !== null ? roundEven(total / limit, 6) : null;
  const result: PressureObservation = {
    bestAvailableTokens: total, totalSource,
    bestAvailableSource: total === null ? "unavailable" : "provider_observed_last_completion",
    usageRatio: ratio, usagePercent: ratio === null ? null : roundEven(ratio * 100, 2),
    warnRatio, criticalRatio, warnTokens: limit === null ? null : Math.floor(limit * warnRatio), criticalTokens: limit === null ? null : Math.floor(limit * criticalRatio),
    state: "unknown", recommendation: "inspect_telemetry_do_not_guess",
  };
  if (ratio === null) return result;
  if (ratio >= 1) { result.state = "over_limit"; result.recommendation = "urgent_recovery_required_no_automatic_compact"; }
  else if (ratio >= criticalRatio) { result.state = "critical"; result.recommendation = "recommend_at_next_safe_boundary"; }
  else if (ratio >= warnRatio) { result.state = "warn"; result.recommendation = "monitor_and_prepare_boundary"; }
  else { result.state = "normal"; result.recommendation = "none"; }
  return result;
}
function iso(value: number | undefined): string | null { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 8.64e15 ? new Date(value).toISOString() : null; }
async function read<T>(call: () => Promise<AdapterReply<T>>): Promise<T | undefined> {
  try { const reply = await call(); return reply.status >= 200 && reply.status < 300 && !reply.problem ? reply.value : undefined; } catch { return undefined; }
}
function normalizedTokens(raw: MessageTokens | undefined): MessageTokens | undefined {
  if (!raw) return undefined;
  const tokens: MessageTokens = {};
  for (const key of ["input", "output", "reasoning", "total"] as const) if (count(raw[key])) tokens[key] = raw[key];
  if (count(raw.cache?.read) || count(raw.cache?.write)) {
    tokens.cache = {};
    if (count(raw.cache?.read)) tokens.cache.read = raw.cache.read;
    if (count(raw.cache?.write)) tokens.cache.write = raw.cache.write;
  }
  return Object.keys(tokens).length ? tokens : undefined;
}
function selectedModel(latest: OpenCodeMessage | undefined, configured: ModelIdentity | undefined): ModelIdentity | undefined {
  if (latest?.providerID && latest.modelID) return { providerID: latest.providerID, modelID: latest.modelID };
  if (configured && (!latest?.providerID || latest.providerID === configured.providerID) && (!latest?.modelID || latest.modelID === configured.modelID)) return configured;
  return undefined;
}

/** Bounded GET-only snapshot; optional telemetry gaps never become lifecycle blockers. */
export async function observeSession(adapter: ObservationReader, expected: { session: string; directory: string }, options: SessionObservationOptions = {}): Promise<SessionObservation> {
  const pageLimit = options.pageLimit ?? 40, pageBudget = options.pageBudget ?? 2;
  if (!expected.session.startsWith("ses") || !path.isAbsolute(expected.directory) || !Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > 1000 || !Number.isSafeInteger(pageBudget) || pageBudget < 1 || pageBudget > 100
    || (options.model !== undefined && !validModel(options.model)) || (options.modelOverride !== undefined && (!validModel(options.modelOverride) || !positive(options.modelOverride.contextLimit)))) throw new AdapterError("INVALID_INPUT");
  validateRatios(options);
  const snapshot: SessionObservation = {
    schemaVersion: "session-observation/v2", observedAt: new Date().toISOString(),
    identity: { verified: false, sessionSha256: digest(expected.session), directorySha256: digest(path.resolve(expected.directory)) },
    activity: "UNKNOWN", latestCompletedCall: null, lastCompaction: null,
    history: { coverage: "UNAVAILABLE", pagesRead: 0, messagesRead: 0 }, model: null,
    activeContext: { status: "unavailable", estimatedTokens: null, reason: "NORMALIZED_HISTORY_IS_NOT_ACTIVE_CONTEXT" },
    pressure: calculatePressure(undefined, undefined, options), capabilities: { readOnly: true, maySend: false, mayCompact: false, mayMutate: false },
    budget: inputBudget(), capabilityScope: "OBSERVATION_ACTION_ONLY_NOT_MAINTENANCE_ELIGIBILITY",
    limitations: ["LAST_COMPLETED_CALL_IS_NOT_EXACT_LIVE_CONTEXT", "NORMALIZED_HISTORY_EXCLUDES_PROVIDER_SYSTEM_AND_TOOL_OVERHEAD", "PRESSURE_NEVER_AUTHORIZES_COMPACTION"],
  };
  const limitation = (value: string) => { if (!snapshot.limitations.includes(value)) snapshot.limitations.push(value); };
  const session = await read(() => adapter.getSession());
  if (!session) { limitation("SESSION_IDENTITY_UNAVAILABLE"); return snapshot; }
  const normalize = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  if (session.id !== expected.session || !path.isAbsolute(session.directory) || normalize(session.directory) !== normalize(expected.directory)) { limitation("SESSION_IDENTITY_CONFLICT"); return snapshot; }
  snapshot.identity.verified = true;
  const messages = new Map<string, OpenCodeMessage>();
  let cursor: string | undefined;
  const cursors = new Set<string>();
  for (let pageIndex = 0; pageIndex < pageBudget; pageIndex += 1) {
    const page = await read(() => adapter.getHistory({ limit: pageLimit, ...(cursor === undefined ? {} : { before: cursor }) }));
    if (!page) { limitation("HISTORY_READ_UNAVAILABLE"); break; }
    snapshot.history.pagesRead += 1;
    if (page.messages.some(message => message.session !== expected.session)) {
      messages.clear(); snapshot.history.coverage = "UNAVAILABLE"; limitation("HISTORY_IDENTITY_CONFLICT"); break;
    }
    for (const message of page.messages) {
      const prior = messages.get(message.id);
      if (prior && digest(prior) !== digest(message)) limitation("HISTORY_CHANGED_DURING_READ");
      if (!prior || (message.timeCompleted ?? 0) >= (prior.timeCompleted ?? 0)) messages.set(message.id, message);
    }
    snapshot.history.coverage = page.nextCursor === undefined ? "COMPLETE" : "BOUNDED";
    cursor = page.nextCursor;
    if (cursor === undefined) break;
    if (cursors.has(cursor)) { limitation("HISTORY_CURSOR_CYCLE"); break; }
    cursors.add(cursor);
  }
  snapshot.history.messagesRead = messages.size;
  if (cursor !== undefined) snapshot.history.nextCursor = cursor;
  if (snapshot.history.coverage === "BOUNDED") limitation("HISTORY_COVERAGE_BOUNDED");
  const activity = await read(() => adapter.getStatus());
  if (activity) snapshot.activity = activity;
  else limitation("ACTIVITY_UNAVAILABLE");
  const all = [...messages.values()];
  // An aborted zero-token placeholder is not a completed provider call. Keep
  // successful tool-call steps, but never replace a successful token-less call
  // with an older token-rich one merely to get a reassuring number.
  const completions = all.filter(message => message.role === "assistant" && message.error !== true && !!message.finish && message.finish !== "unknown" && iso(message.timeCompleted) !== null)
    .sort((left, right) => (left.timeCompleted! - right.timeCompleted!) || ((left.timeCreated ?? 0) - (right.timeCreated ?? 0)) || left.id.localeCompare(right.id));
  const latest = completions.at(-1);
  if (all.some(message => message.role === "assistant" && iso(message.timeCompleted) !== null &&
    (!latest || message.timeCompleted! > latest.timeCompleted!) && (message.error === true || !message.finish || message.finish === "unknown"))) limitation("NEWER_FAILED_OR_UNFINISHED_ASSISTANT_NOT_PROVIDER_USAGE");
  const markers = all.filter(message => message.hasCompactionPart).sort((left, right) => ((left.timeCreated ?? 0) - (right.timeCreated ?? 0)) || left.id.localeCompare(right.id));
  const marker = markers.at(-1);
  if (marker) {
    const completed = all.some(message => message.role === "assistant" && message.parentId === marker.id && message.summary === true && iso(message.timeCompleted) !== null && message.error !== true && !!message.finish && !["tool-calls", "unknown"].includes(message.finish));
    snapshot.lastCompaction = { messageReference: `opencode-message-sha256:${digest([expected.session, marker.id])}`, createdAt: iso(marker.timeCreated), source: "NATIVE_COMPACTION_PART", completed };
    limitation("COMPACTION_MARKER_DOES_NOT_DISTINGUISH_MANUAL_FROM_AUTOMATIC");
  }
  const tokens = normalizedTokens(latest?.tokens);
  if (latest) {
    const now = Date.now();
    let freshness: NonNullable<SessionObservation["latestCompletedCall"]>["freshness"] = "NO_NEWER_MESSAGES_OBSERVED";
    if (all.some(message => (message.timeCreated ?? 0) > latest.timeCompleted!) || snapshot.activity === "BUSY") freshness = "NEWER_ACTIVITY_OBSERVED";
    if (marker && (marker.timeCreated ?? 0) > latest.timeCompleted!) freshness = snapshot.lastCompaction?.completed ? "COMPACTION_AFTER_CALL" : "UNKNOWN";
    // Summarize's input usage measures the context it is replacing, even though
    // the summary assistant completes after the user compaction marker.
    if (latest.summary === true) {
      freshness = marker && snapshot.lastCompaction?.completed ? "COMPACTION_AFTER_CALL" : "UNKNOWN";
      limitation("SUMMARY_CALL_COUNTS_PRE_COMPACTION_CONTEXT");
    }
    if (snapshot.activity === "UNKNOWN" || latest.timeCompleted! > now) freshness = "UNKNOWN";
    snapshot.latestCompletedCall = {
      messageReference: `opencode-message-sha256:${digest([expected.session, latest.id])}`, completedAt: iso(latest.timeCompleted)!,
      ageMs: latest.timeCompleted! <= now ? now - latest.timeCompleted! : null,
      ...(latest.providerID === undefined ? {} : { providerID: latest.providerID }), ...(latest.modelID === undefined ? {} : { modelID: latest.modelID }),
      ...(tokens === undefined ? {} : { tokens }), fromCompactionSummary: latest.summary === true, freshness,
    };
    if (freshness !== "NO_NEWER_MESSAGES_OBSERVED") limitation("LAST_CALL_PRESSURE_MAY_BE_STALE");
  } else limitation("COMPLETED_ASSISTANT_CALL_UNAVAILABLE");
  if (calculatePressure(tokens).bestAvailableTokens === null) limitation("LAST_CALL_TOKENS_UNAVAILABLE");
  const model = selectedModel(latest, options.model);
  if (!model) limitation("MODEL_IDENTITY_UNAVAILABLE");
  else {
    snapshot.model = { ...model, limitSource: "unavailable" };
    const override = options.modelOverride;
    if (override && matching(model, override)) {
      snapshot.model = { ...model, contextLimit: override.contextLimit, limitSource: "matching_configured_override", ...(positive(override.inputLimit) ? { inputLimit: override.inputLimit } : {}), ...(positive(override.outputLimit) ? { outputLimit: override.outputLimit } : {}) };
    } else {
      if (override) limitation("MODEL_LIMIT_OVERRIDE_MISMATCH");
      let selected: OpenCodeModelInfo | null | undefined;
      if (!adapter.getModelInfo) limitation("MODEL_CATALOG_READER_UNAVAILABLE");
      else {
        try {
          const reply = await adapter.getModelInfo(model.providerID, model.modelID);
          if (reply.status < 200 || reply.status >= 300) limitation("MODEL_CATALOG_HTTP_ERROR");
          else if (reply.problem) limitation(`MODEL_CATALOG_${reply.problem}`);
          else { selected = reply.value; if (!selected) limitation("MODEL_CATALOG_MODEL_ABSENT"); }
        } catch (error) { limitation(`MODEL_CATALOG_${error instanceof AdapterError ? error.code : "READ_FAILED"}`); }
      }
      if (selected && matching(model, selected)) {
        snapshot.model = { ...model, limitSource: "opencode_provider_catalog", ...(positive(selected.contextLimit) ? { contextLimit: selected.contextLimit } : {}), ...(positive(selected.inputLimit) ? { inputLimit: selected.inputLimit } : {}), ...(positive(selected.outputLimit) ? { outputLimit: selected.outputLimit } : {}) };
      } else if (selected) limitation("MODEL_CATALOG_IDENTITY_CONFLICT");
    }
  }
  if (!snapshot.model?.contextLimit) limitation("CONTEXT_LIMIT_UNAVAILABLE");
  snapshot.budget = inputBudget(snapshot.model);
  snapshot.pressure = calculatePressure(tokens, snapshot.budget.tokens ?? undefined, options);
  // Legacy arithmetic helper retains its historical labels for parity. V2's
  // actionable advice must not contradict safe idle maintenance at high pressure.
  if (snapshot.pressure.state === "over_limit") snapshot.pressure.recommendation = "recommend_at_next_safe_boundary";
  if (snapshot.pressure.bestAvailableTokens === 0) {
    // A zero-filled provider placeholder is not evidence of an empty context.
    snapshot.pressure = calculatePressure(undefined, snapshot.budget.tokens ?? undefined, options);
    limitation("ZERO_USAGE_IS_NOT_ACTIVE_CONTEXT_EVIDENCE");
  }
  snapshot.observedAt = new Date().toISOString();
  return snapshot;
}
