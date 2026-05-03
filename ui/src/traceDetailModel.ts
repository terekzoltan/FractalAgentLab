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
}
