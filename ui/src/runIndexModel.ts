export const RUN_INDEX_SCHEMA_VERSION = "u5_b.run_index.v1";

export type TraceState = "ok" | "missing" | "invalid";

export type RowState =
  | "ok"
  | "missing_run_artifact"
  | "invalid_run_artifact"
  | "missing_trace_artifact"
  | "invalid_trace_artifact";

export type RunOrigin = "fal_native" | "opencode_backed" | "unknown";

export interface RunIndexSummary {
  total_runs: number;
  workflow_counts: Record<string, number>;
  status_counts: Record<string, number>;
  trace_state_counts: Record<string, number>;
  run_origin_counts: Record<string, number>;
  target_project_counts: Record<string, number>;
  final_decision_counts: Record<string, number>;
  warnings_count: number;
}

export interface RunIndexRow {
  run_id: string;
  workflow_id: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  run_artifact_path: string;
  trace_artifact_path: string;
  artifact_dir_path: string;
  has_run_artifact: boolean;
  has_trace_artifact: boolean;
  has_artifact_dir: boolean;
  sidecar_files: string[];
  trace_state: TraceState;
  trace_event_count: number | null;
  trace_schema_versions: string[];
  provider_names: string[];
  model_names: string[];
  fallback_state: "observed" | "not_observed" | "unknown";
  row_state: RowState;
  warnings: string[];
  run_origin: RunOrigin;
  target_project_id: string | null;
  target_project_name: string | null;
  sequence_ref: string | null;
  final_decision: string | null;
  overall_outcome: string | null;
  validation_state: string | null;
  clean_pass_eligible: boolean | null;
  packet_count: number | null;
  approval_count: number | null;
  selected_output_count: number | null;
  review_synthesis_present: boolean | null;
  privacy_retention_mode: string | null;
  public_export_state: string | null;
  required_followup_count: number | null;
}

export interface RunIndex {
  schema_version: typeof RUN_INDEX_SCHEMA_VERSION;
  generated_at: string;
  data_dir: string;
  summary: RunIndexSummary;
  runs: RunIndexRow[];
  warnings: string[];
}

export interface TraceTarget {
  runId: string;
  traceArtifactPath: string;
  traceState: TraceState;
}
