export const COMPARISON_INDEX_SCHEMA_VERSION = "u5_e.comparison_index.v1";

export type StructuralPreflightStatus = "PASS" | "WARNING" | "FAIL" | "BLOCKED" | "INVALID";

export interface ComparisonIndexSummary {
  run_candidate_count: number;
  suggested_pair_count: number;
  known_evidence_pair_count: number;
  unsupported_target_count: number;
  warnings_count: number;
  max_suggested_pairs: number;
}

export interface ComparableFieldDisplay {
  key: string;
  present: boolean;
  value_kind: string;
  preview: string | null;
  fingerprint: string | null;
}

export interface ComparisonRunCandidate {
  run_id: string;
  workflow_id: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  target_class: string;
  comparison_support: string;
  comparison_role: string | null;
  run_artifact_path: string;
  trace_artifact_path: string;
  artifact_dir_path: string;
  artifact_validation: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
  preflight: {
    run_artifact_exists: boolean;
    trace_artifact_exists: boolean;
    artifact_validation_passed: boolean;
    trace_state: string;
  };
  input: {
    available: boolean;
    fingerprint: string | null;
    keys: string[];
  };
  comparable_output: {
    present: boolean;
    complete: boolean;
    missing_keys: string[];
    fields: ComparableFieldDisplay[];
  };
  h2_gates: {
    key_order_matches: boolean | null;
    implementation_waves_valid: boolean | null;
    recommended_starting_slice_present: boolean | null;
    delegate_order_matches: boolean | null;
    delegate_targets: string[];
  };
  provider_disclosure: {
    provider_names: string[];
    model_names: string[];
    selected_provider: string | null;
    executed_provider: string | null;
    selected_model: string | null;
    executed_model: string | null;
    fallback_state: "observed" | "not_observed" | "unknown" | string;
    provider_attempt_count: number;
  };
}

export interface SuggestedComparisonPair {
  pair_id: string;
  target_class: string;
  left_run_id: string;
  right_run_id: string;
  selection_reason: string;
  structural_preflight_status: StructuralPreflightStatus;
  status_reasons: string[];
  matched_input: boolean | null;
  source_reported_status: string | null;
  display_only: boolean;
}

export interface KnownEvidencePair {
  pair_id: string;
  target_class: string;
  left_run_id: string;
  right_run_id: string;
  source_reported_status: string;
  source_report_path: string;
  local_state: "available" | "not_demonstrated" | string;
  local_preflight_status: StructuralPreflightStatus;
  status_reasons: string[];
  display_only: boolean;
}

export interface UnsupportedTargetRow {
  run_id: string;
  workflow_id: string | null;
  target_class: string;
  evidence_label: string;
  future_state: string | null;
  note: string;
}

export interface ComparisonIndex {
  schema_version: typeof COMPARISON_INDEX_SCHEMA_VERSION;
  generated_at: string;
  data_dir: string;
  summary: ComparisonIndexSummary;
  run_candidates: ComparisonRunCandidate[];
  suggested_pairs: SuggestedComparisonPair[];
  known_evidence_pairs: KnownEvidencePair[];
  unsupported_targets: UnsupportedTargetRow[];
  warnings: string[];
}
