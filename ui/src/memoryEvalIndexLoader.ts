import { MEMORY_EVAL_INDEX_SCHEMA_VERSION, type MemoryEvalIndex } from "./memoryEvalIndexModel";

export type MemoryEvalIndexLoadState =
  | { status: "loading" }
  | { status: "ready"; index: MemoryEvalIndex }
  | { status: "missing_index"; message: string }
  | { status: "invalid_index"; message: string };

export async function loadMemoryEvalIndex(fetchImpl: typeof fetch = fetch): Promise<MemoryEvalIndexLoadState> {
  let response: Response;
  try {
    response = await fetchImpl("/generated/memory-eval-index.json", { cache: "no-store" });
  } catch (error) {
    return {
      status: "missing_index",
      message: error instanceof Error ? error.message : "Unable to fetch generated memory/eval index.",
    };
  }

  if (response.status === 404) {
    return { status: "missing_index", message: "Generated memory/eval index was not found." };
  }
  if (!response.ok) {
    return { status: "invalid_index", message: `Generated memory/eval index request failed with ${response.status}.` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      status: "invalid_index",
      message: error instanceof Error ? error.message : "Generated memory/eval index is not valid JSON.",
    };
  }

  if (!isMemoryEvalIndex(payload)) {
    return { status: "invalid_index", message: "Generated memory/eval index does not match u5_f.memory_eval_index.v1." };
  }

  return { status: "ready", index: payload };
}

function isMemoryEvalIndex(value: unknown): value is MemoryEvalIndex {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schema_version === MEMORY_EVAL_INDEX_SCHEMA_VERSION &&
    typeof value.generated_at === "string" &&
    typeof value.data_dir === "string" &&
    isSummary(value.summary) &&
    Array.isArray(value.memory_projects) &&
    value.memory_projects.every(isMemoryProjectRow) &&
    Array.isArray(value.memory_artifacts) &&
    value.memory_artifacts.every(isMemoryArtifactRow) &&
    Array.isArray(value.eval_summaries) &&
    value.eval_summaries.every(isEvalSummaryRow) &&
    Array.isArray(value.curated_references) &&
    value.curated_references.every(isCuratedReferenceRow) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

function isSummary(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    ["available", "not_demonstrated", "no_local_project_memory_store_found"].includes(String(value.project_memory_store_state)) &&
    typeof value.memory_project_count === "number" &&
    typeof value.memory_artifact_count === "number" &&
    typeof value.eval_summary_count === "number" &&
    typeof value.warnings_count === "number"
  );
}

function isMemoryProjectRow(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.project_id === "string" &&
    typeof value.source_path === "string" &&
    typeof value.schema_version === "string" &&
    (typeof value.updated_at === "string" || value.updated_at === null) &&
    typeof value.stable_decision_count === "number" &&
    typeof value.workflow_learning_count === "number" &&
    typeof value.prompt_observation_count === "number"
  );
}

function isMemoryArtifactRow(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.run_id === "string" &&
    typeof value.source_path === "string" &&
    ["memory_candidates", "project_memory_update"].includes(String(value.artifact_kind)) &&
    (typeof value.artifact_version === "string" || value.artifact_version === null) &&
    (typeof value.schema_version === "string" || value.schema_version === null) &&
    (typeof value.workflow_id === "string" || value.workflow_id === null) &&
    (typeof value.session_id === "string" || value.session_id === null) &&
    (typeof value.project_id === "string" || value.project_id === null) &&
    (typeof value.generated_at === "string" || value.generated_at === null) &&
    typeof value.item_count === "number"
  );
}

function isEvalSummaryRow(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.label === "string" &&
    typeof value.source_path === "string" &&
    typeof value.report_version === "string" &&
    (typeof value.generated_at === "string" || value.generated_at === null) &&
    (typeof value.source_reported_outcome === "string" || value.source_reported_outcome === null) &&
    isSafeSummary(value.source_reported_summary) &&
    Array.isArray(value.known_limits) &&
    value.known_limits.every((item) => typeof item === "string")
  );
}

function isCuratedReferenceRow(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.label === "string" &&
    typeof value.source_path === "string" &&
    typeof value.evidence_label === "string" &&
    typeof value.note === "string"
  );
}

function isSafeSummary(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(
    (summaryValue) =>
      typeof summaryValue === "string" ||
      typeof summaryValue === "boolean" ||
      typeof summaryValue === "number" ||
      summaryValue === null,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
