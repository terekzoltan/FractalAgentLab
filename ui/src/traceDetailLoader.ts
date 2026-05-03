import { TRACE_DETAIL_SCHEMA_VERSION, type TraceDetail } from "./traceDetailModel";

export type TraceDetailLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; detail: TraceDetail }
  | { status: "missing_trace_detail"; message: string }
  | { status: "invalid_trace_detail"; message: string };

export async function loadTraceDetail(runId: string, fetchImpl: typeof fetch = fetch): Promise<TraceDetailLoadState> {
  let response: Response;
  try {
    response = await fetchImpl(`/generated/traces/${encodeURIComponent(runId)}.json`, { cache: "no-store" });
  } catch (error) {
    return {
      status: "missing_trace_detail",
      message: error instanceof Error ? error.message : "Unable to fetch generated trace detail.",
    };
  }

  if (response.status === 404) {
    return { status: "missing_trace_detail", message: "Generated trace detail was not found." };
  }
  if (!response.ok) {
    return { status: "invalid_trace_detail", message: `Generated trace detail request failed with ${response.status}.` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      status: "invalid_trace_detail",
      message: error instanceof Error ? error.message : "Generated trace detail is not valid JSON.",
    };
  }

  if (!isTraceDetail(payload)) {
    return { status: "invalid_trace_detail", message: "Generated trace detail does not match u5_c.trace_detail.v1." };
  }

  if (payload.run_id !== runId) {
    return {
      status: "invalid_trace_detail",
      message: `Generated trace detail run_id mismatch for requested run ${runId}.`,
    };
  }

  return { status: "ready", detail: payload };
}

function isTraceDetail(value: unknown): value is TraceDetail {
  if (!isRecord(value)) {
    return false;
  }
  if (
    value.schema_version !== TRACE_DETAIL_SCHEMA_VERSION ||
    typeof value.generated_at !== "string" ||
    typeof value.run_id !== "string" ||
    typeof value.trace_artifact_path !== "string"
  ) {
    return false;
  }
  if (!isRecord(value.summary) || !isRecord(value.validation) || !Array.isArray(value.events)) {
    return false;
  }
  return isTraceDetailSummary(value.summary) && isTraceDetailValidation(value.validation) && value.events.every(isTraceDetailEvent);
}

function isTraceDetailSummary(value: Record<string, unknown>): boolean {
  return (
    typeof value.total_events === "number" &&
    isRecord(value.event_counts) &&
    isRecord(value.lane_counts) &&
    (typeof value.max_turn_index === "number" || value.max_turn_index === null) &&
    isRecord(value.linked_events) &&
    typeof value.linked_events.with_parent_event_id === "number" &&
    typeof value.linked_events.with_correlation_id === "number"
  );
}

function isTraceDetailValidation(value: Record<string, unknown>): boolean {
  return (
    (value.trace_state === "ok" || value.trace_state === "warning") &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string") &&
    (value.timestamp_order === "ok" || value.timestamp_order === "warning" || value.timestamp_order === "unknown") &&
    (value.linkage_state === "ok" || value.linkage_state === "warning" || value.linkage_state === "unknown")
  );
}

function isTraceDetailEvent(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.sequence === "number" &&
    isStringOrNull(value.event_id) &&
    isStringOrNull(value.timestamp) &&
    typeof value.event_type === "string" &&
    isStringOrNull(value.source) &&
    isStringOrNull(value.step_id) &&
    isStringOrNull(value.parent_event_id) &&
    isStringOrNull(value.correlation_id) &&
    isStringOrNull(value.lane) &&
    isNumberOrNull(value.turn_index) &&
    isNumberOrNull(value.handoff_index) &&
    isStringOrNull(value.from_step_id) &&
    isStringOrNull(value.to_step_id) &&
    typeof value.is_failure === "boolean" &&
    typeof value.payload_summary === "string" &&
    isRecord(value.payload)
  );
}

function isStringOrNull(value: unknown): boolean {
  return typeof value === "string" || value === null;
}

function isNumberOrNull(value: unknown): boolean {
  return typeof value === "number" || value === null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
