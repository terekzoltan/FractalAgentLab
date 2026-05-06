import { RUN_INDEX_SCHEMA_VERSION, type RowState, type RunIndex, type TraceState } from "./runIndexModel";

export type RunIndexLoadState =
  | { status: "loading" }
  | { status: "ready"; index: RunIndex }
  | { status: "missing_index"; message: string }
  | { status: "invalid_index"; message: string };

export async function loadRunIndex(fetchImpl: typeof fetch = fetch): Promise<RunIndexLoadState> {
  let response: Response;
  try {
    response = await fetchImpl("/generated/run-index.json", { cache: "no-store" });
  } catch (error) {
    return {
      status: "missing_index",
      message: error instanceof Error ? error.message : "Unable to fetch generated run index.",
    };
  }

  if (response.status === 404) {
    return { status: "missing_index", message: "Generated run index was not found." };
  }
  if (!response.ok) {
    return { status: "invalid_index", message: `Generated run index request failed with ${response.status}.` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      status: "invalid_index",
      message: error instanceof Error ? error.message : "Generated run index is not valid JSON.",
    };
  }

  if (!isRunIndex(payload)) {
    return { status: "invalid_index", message: "Generated run index does not match u5_b.run_index.v1." };
  }

  return { status: "ready", index: payload };
}

function isRunIndex(value: unknown): value is RunIndex {
  if (!isRecord(value)) {
    return false;
  }
  if (value.schema_version !== RUN_INDEX_SCHEMA_VERSION) {
    return false;
  }
  if (typeof value.generated_at !== "string" || typeof value.data_dir !== "string") {
    return false;
  }
  if (!isRunIndexSummary(value.summary) || !Array.isArray(value.runs) || !isStringArray(value.warnings)) {
    return false;
  }
  return value.runs.every(isRunIndexRow);
}

function isRunIndexSummary(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonNegativeInteger(value.total_runs) &&
    isNumericRecord(value.workflow_counts) &&
    isNumericRecord(value.status_counts) &&
    isNumericRecord(value.trace_state_counts) &&
    isNonNegativeInteger(value.warnings_count)
  );
}

function isRunIndexRow(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.run_id === "string" &&
    isNullableString(value.workflow_id) &&
    isNullableString(value.status) &&
    isNullableString(value.started_at) &&
    isNullableString(value.completed_at) &&
    typeof value.run_artifact_path === "string" &&
    typeof value.trace_artifact_path === "string" &&
    typeof value.artifact_dir_path === "string" &&
    typeof value.has_run_artifact === "boolean" &&
    typeof value.has_trace_artifact === "boolean" &&
    typeof value.has_artifact_dir === "boolean" &&
    isStringArray(value.sidecar_files) &&
    isTraceState(value.trace_state) &&
    (isNonNegativeInteger(value.trace_event_count) || value.trace_event_count === null) &&
    isStringArray(value.trace_schema_versions) &&
    isStringArray(value.provider_names) &&
    isStringArray(value.model_names) &&
    isFallbackState(value.fallback_state) &&
    isRowState(value.row_state) &&
    isStringArray(value.warnings)
  );
}

function isNumericRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(isNonNegativeInteger);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isTraceState(value: unknown): value is TraceState {
  return value === "ok" || value === "missing" || value === "invalid";
}

function isFallbackState(value: unknown): boolean {
  return value === "observed" || value === "not_observed" || value === "unknown";
}

function isRowState(value: unknown): value is RowState {
  return (
    value === "ok" ||
    value === "missing_run_artifact" ||
    value === "invalid_run_artifact" ||
    value === "missing_trace_artifact" ||
    value === "invalid_trace_artifact"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
