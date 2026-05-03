import { RUN_INDEX_SCHEMA_VERSION, type RunIndex } from "./runIndexModel";

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
  if (!isRecord(value.summary) || !Array.isArray(value.runs) || !Array.isArray(value.warnings)) {
    return false;
  }
  return value.runs.every(isRunIndexRow);
}

function isRunIndexRow(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.run_id === "string" &&
    typeof value.run_artifact_path === "string" &&
    typeof value.trace_artifact_path === "string" &&
    typeof value.artifact_dir_path === "string" &&
    typeof value.has_run_artifact === "boolean" &&
    typeof value.has_trace_artifact === "boolean" &&
    typeof value.has_artifact_dir === "boolean" &&
    Array.isArray(value.sidecar_files) &&
    typeof value.trace_state === "string" &&
    Array.isArray(value.trace_schema_versions) &&
    Array.isArray(value.provider_names) &&
    Array.isArray(value.model_names) &&
    typeof value.fallback_state === "string" &&
    typeof value.row_state === "string" &&
    Array.isArray(value.warnings)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
