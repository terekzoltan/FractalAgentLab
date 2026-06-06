export const TRACE_DETAIL_SCHEMA_VERSION = "u5_c.trace_detail.v1";

export interface TraceDetailSummary {
  total_events: number;
  event_counts: Record<string, number>;
  lane_counts: Record<string, number>;
  max_turn_index: number | null;
  linked_events: {
    with_parent_event_id: number;
    with_correlation_id: number;
  };
}

export interface TraceDetailValidation {
  trace_state: "ok" | "warning";
  warnings: string[];
  timestamp_order: "ok" | "warning" | "unknown";
  linkage_state: "ok" | "warning" | "unknown";
}

export interface TraceDetailEvent {
  event_id: string | null;
  sequence: number;
  timestamp: string | null;
  event_type: string;
  source: string | null;
  step_id: string | null;
  parent_event_id: string | null;
  correlation_id: string | null;
  lane: string | null;
  turn_index: number | null;
  handoff_index: number | null;
  from_step_id: string | null;
  to_step_id: string | null;
  is_failure: boolean;
  payload_summary: string;
  payload: Record<string, unknown>;
}

export interface OpenCodeLoopSummary {
  run_id: string | null;
  workflow_id: string | null;
  target_project_id: string | null;
  target_project_name: string | null;
  external_loop_id: string | null;
  sequence_ref: string | null;
  overall_outcome: string | null;
  terminal_stage: string | null;
  final_decision: string | null;
  validation_state: string | null;
  clean_pass_eligible: boolean | null;
  packet_count: number | null;
  approval_count: number | null;
  selected_output_count: number | null;
  review_synthesis_present: boolean | null;
  privacy_retention_mode: string | null;
  public_export_state: string | null;
}

export interface OpenCodePacketLedgerEntry {
  sequence: number | null;
  stage: string | null;
  producer: string | null;
  consumer: string | null;
  source_command: string | null;
  decision: string | null;
  summary: string | null;
  validation_state: string | null;
  packet_ref: string | null;
  selected_output_ref: string | null;
  approval_ref: string | null;
}

export interface OpenCodeSelectedOutput {
  output_id: string | null;
  stage: string | null;
  source_session: string | null;
  message_id: string | null;
  capture_mode: string | null;
  summary: string | null;
  excerpt: string | null;
  excerpt_truncated: boolean | null;
  privacy_classification: string | null;
}

export interface OpenCodeApprovalCheckpoint {
  checkpoint_id: string | null;
  action_kind: string | null;
  target_session: string | null;
  stage: string | null;
  approved: boolean | null;
  approved_at: string | null;
  approval_mode: string | null;
}

export interface OpenCodeReviewSynthesis {
  plan_verdict: string | null;
  plan_summary: string | null;
  step_final_verdict: string | null;
  step_final_summary: string | null;
  swarm_verdict: string | null;
}

export interface OpenCodeLoopDetail {
  summary: OpenCodeLoopSummary | null;
  packet_ledger_entries: OpenCodePacketLedgerEntry[];
  selected_outputs: OpenCodeSelectedOutput[];
  approval_checkpoints: OpenCodeApprovalCheckpoint[];
  review_synthesis: OpenCodeReviewSynthesis | null;
  sidecar_paths: Record<string, string>;
  warnings: string[];
}

export interface TraceDetail {
  schema_version: typeof TRACE_DETAIL_SCHEMA_VERSION;
  generated_at: string;
  run_id: string;
  workflow_id: string | null;
  status: string | null;
  run_artifact_path: string | null;
  trace_artifact_path: string;
  summary: TraceDetailSummary;
  validation: TraceDetailValidation;
  events: TraceDetailEvent[];
  opencode_loop: OpenCodeLoopDetail | null;
}
