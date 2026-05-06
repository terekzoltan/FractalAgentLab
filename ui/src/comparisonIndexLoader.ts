import { COMPARISON_INDEX_SCHEMA_VERSION, type ComparisonIndex } from "./comparisonIndexModel";

export type ComparisonIndexLoadState =
  | { status: "loading" }
  | { status: "ready"; index: ComparisonIndex }
  | { status: "missing_index"; message: string }
  | { status: "invalid_index"; message: string };

export async function loadComparisonIndex(fetchImpl: typeof fetch = fetch): Promise<ComparisonIndexLoadState> {
  let response: Response;
  try {
    response = await fetchImpl("/generated/comparison-index.json", { cache: "no-store" });
  } catch (error) {
    return {
      status: "missing_index",
      message: error instanceof Error ? error.message : "Unable to fetch generated comparison index.",
    };
  }

  if (response.status === 404) {
    return { status: "missing_index", message: "Generated comparison index was not found." };
  }
  if (!response.ok) {
    return { status: "invalid_index", message: `Generated comparison index request failed with ${response.status}.` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      status: "invalid_index",
      message: error instanceof Error ? error.message : "Generated comparison index is not valid JSON.",
    };
  }

  if (!isComparisonIndex(payload)) {
    return { status: "invalid_index", message: "Generated comparison index does not match u5_e.comparison_index.v1." };
  }

  return { status: "ready", index: payload };
}

function isComparisonIndex(value: unknown): value is ComparisonIndex {
  if (!isRecord(value)) {
    return false;
  }
  if (value.schema_version !== COMPARISON_INDEX_SCHEMA_VERSION) {
    return false;
  }
  if (typeof value.generated_at !== "string" || typeof value.data_dir !== "string") {
    return false;
  }
  if (!isSummary(value.summary)) {
    return false;
  }
  if (!Array.isArray(value.run_candidates) || !Array.isArray(value.suggested_pairs) || !Array.isArray(value.known_evidence_pairs)) {
    return false;
  }
  if (!Array.isArray(value.unsupported_targets) || !Array.isArray(value.warnings)) {
    return false;
  }
  return value.run_candidates.every(isRunCandidate)
    && value.suggested_pairs.every(isSuggestedPair)
    && value.known_evidence_pairs.every(isKnownEvidencePair)
    && value.unsupported_targets.every(isUnsupportedTarget)
    && value.warnings.every((warning) => typeof warning === "string");
}

function isRunCandidate(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.run_id === "string" &&
    isNullableString(value.workflow_id) &&
    isNullableString(value.status) &&
    isNullableString(value.started_at) &&
    isNullableString(value.completed_at) &&
    typeof value.target_class === "string" &&
    typeof value.comparison_support === "string" &&
    isNullableString(value.comparison_role) &&
    typeof value.run_artifact_path === "string" &&
    typeof value.trace_artifact_path === "string" &&
    typeof value.artifact_dir_path === "string" &&
    isRecord(value.artifact_validation) &&
    typeof value.artifact_validation.passed === "boolean" &&
    isStringArray(value.artifact_validation.errors) &&
    isStringArray(value.artifact_validation.warnings) &&
    isRecord(value.preflight) &&
    typeof value.preflight.run_artifact_exists === "boolean" &&
    typeof value.preflight.trace_artifact_exists === "boolean" &&
    typeof value.preflight.artifact_validation_passed === "boolean" &&
    typeof value.preflight.trace_state === "string" &&
    isRecord(value.input) &&
    typeof value.input.available === "boolean" &&
    isNullableString(value.input.fingerprint) &&
    isStringArray(value.input.keys) &&
    isRecord(value.comparable_output) &&
    typeof value.comparable_output.present === "boolean" &&
    typeof value.comparable_output.complete === "boolean" &&
    isStringArray(value.comparable_output.missing_keys) &&
    Array.isArray(value.comparable_output.fields) &&
    value.comparable_output.fields.every(isComparableFieldDisplay) &&
    isRecord(value.h2_gates) &&
    isNullableBoolean(value.h2_gates.key_order_matches) &&
    isNullableBoolean(value.h2_gates.implementation_waves_valid) &&
    isNullableBoolean(value.h2_gates.recommended_starting_slice_present) &&
    isNullableBoolean(value.h2_gates.delegate_order_matches) &&
    isStringArray(value.h2_gates.delegate_targets) &&
    isRecord(value.provider_disclosure) &&
    isStringArray(value.provider_disclosure.provider_names) &&
    isStringArray(value.provider_disclosure.model_names) &&
    isNullableString(value.provider_disclosure.selected_provider) &&
    isNullableString(value.provider_disclosure.executed_provider) &&
    isNullableString(value.provider_disclosure.selected_model) &&
    isNullableString(value.provider_disclosure.executed_model) &&
    typeof value.provider_disclosure.fallback_state === "string" &&
    typeof value.provider_disclosure.provider_attempt_count === "number"
  );
}

function isSuggestedPair(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.pair_id === "string" &&
    typeof value.target_class === "string" &&
    typeof value.left_run_id === "string" &&
    typeof value.right_run_id === "string" &&
    isStructuralStatus(value.structural_preflight_status) &&
    isStringArray(value.status_reasons) &&
    isNullableBoolean(value.matched_input) &&
    isNullableString(value.source_reported_status) &&
    typeof value.display_only === "boolean"
  );
}

function isKnownEvidencePair(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.pair_id === "string" &&
    typeof value.target_class === "string" &&
    typeof value.left_run_id === "string" &&
    typeof value.right_run_id === "string" &&
    typeof value.source_reported_status === "string" &&
    typeof value.source_report_path === "string" &&
    typeof value.local_state === "string" &&
    isStructuralStatus(value.local_preflight_status) &&
    isStringArray(value.status_reasons) &&
    typeof value.display_only === "boolean"
  );
}

function isUnsupportedTarget(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.run_id === "string" &&
    isNullableString(value.workflow_id) &&
    typeof value.target_class === "string" &&
    typeof value.evidence_label === "string" &&
    isNullableString(value.future_state) &&
    typeof value.note === "string"
  );
}

function isSummary(value: unknown): boolean {
  return isRecord(value)
    && typeof value.run_candidate_count === "number"
    && typeof value.suggested_pair_count === "number"
    && typeof value.known_evidence_pair_count === "number"
    && typeof value.unsupported_target_count === "number"
    && typeof value.warnings_count === "number"
    && typeof value.max_suggested_pairs === "number";
}

function isComparableFieldDisplay(value: unknown): boolean {
  return isRecord(value)
    && typeof value.key === "string"
    && typeof value.present === "boolean"
    && typeof value.value_kind === "string"
    && isNullableString(value.preview)
    && isNullableString(value.fingerprint);
}

function isStructuralStatus(value: unknown): boolean {
  return value === "PASS" || value === "WARNING" || value === "FAIL" || value === "BLOCKED" || value === "INVALID";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === "boolean" || value === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
