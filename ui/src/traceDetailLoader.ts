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

  const normalizedPayload = normalizeTraceDetail(payload);
  if (!isTraceDetail(normalizedPayload)) {
    return { status: "invalid_trace_detail", message: "Generated trace detail does not match u5_c.trace_detail.v1." };
  }

  if (normalizedPayload.run_id !== runId) {
    return {
      status: "invalid_trace_detail",
      message: `Generated trace detail run_id mismatch for requested run ${runId}.`,
    };
  }

  return { status: "ready", detail: normalizedPayload };
}

function normalizeTraceDetail(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return {
    ...value,
    opencode_loop: value.opencode_loop === undefined ? null : value.opencode_loop,
  };
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
  return (
    isTraceDetailSummary(value.summary) &&
    isTraceDetailValidation(value.validation) &&
    value.events.every(isTraceDetailEvent) &&
    isOpenCodeLoopDetailOrNull(value.opencode_loop)
  );
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

function isOpenCodeLoopDetailOrNull(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return (
    isOpenCodeSummaryOrNull(value.summary) &&
    Array.isArray(value.packet_ledger_entries) &&
    value.packet_ledger_entries.every(isPacketLedgerEntry) &&
    Array.isArray(value.selected_outputs) &&
    value.selected_outputs.every(isSelectedOutput) &&
    Array.isArray(value.approval_checkpoints) &&
    value.approval_checkpoints.every(isApprovalCheckpoint) &&
    isReviewSynthesisOrNull(value.review_synthesis) &&
    isStringRecord(value.sidecar_paths) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

function isOpenCodeSummaryOrNull(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return (
    isStringOrNull(value.run_id) &&
    isStringOrNull(value.workflow_id) &&
    isStringOrNull(value.target_project_id) &&
    isStringOrNull(value.target_project_name) &&
    isStringOrNull(value.external_loop_id) &&
    isStringOrNull(value.sequence_ref) &&
    isStringOrNull(value.overall_outcome) &&
    isStringOrNull(value.terminal_stage) &&
    isStringOrNull(value.final_decision) &&
    isStringOrNull(value.validation_state) &&
    isBooleanOrNull(value.clean_pass_eligible) &&
    isNumberOrNull(value.packet_count) &&
    isNumberOrNull(value.approval_count) &&
    isNumberOrNull(value.selected_output_count) &&
    isBooleanOrNull(value.review_synthesis_present) &&
    isStringOrNull(value.privacy_retention_mode) &&
    isStringOrNull(value.public_export_state)
  );
}

function isPacketLedgerEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNumberOrNull(value.sequence) &&
    isStringOrNull(value.stage) &&
    isStringOrNull(value.producer) &&
    isStringOrNull(value.consumer) &&
    isStringOrNull(value.source_command) &&
    isStringOrNull(value.decision) &&
    isStringOrNull(value.summary) &&
    isStringOrNull(value.validation_state) &&
    isStringOrNull(value.packet_ref) &&
    isStringOrNull(value.selected_output_ref) &&
    isStringOrNull(value.approval_ref)
  );
}

function isSelectedOutput(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isStringOrNull(value.output_id) &&
    isStringOrNull(value.stage) &&
    isStringOrNull(value.source_session) &&
    isStringOrNull(value.message_id) &&
    isStringOrNull(value.capture_mode) &&
    isStringOrNull(value.summary) &&
    isStringOrNull(value.excerpt) &&
    isBooleanOrNull(value.excerpt_truncated) &&
    isStringOrNull(value.privacy_classification)
  );
}

function isApprovalCheckpoint(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isStringOrNull(value.checkpoint_id) &&
    isStringOrNull(value.action_kind) &&
    isStringOrNull(value.target_session) &&
    isStringOrNull(value.stage) &&
    isBooleanOrNull(value.approved) &&
    isStringOrNull(value.approved_at) &&
    isStringOrNull(value.approval_mode)
  );
}

function isReviewSynthesisOrNull(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return (
    isStringOrNull(value.plan_verdict) &&
    isStringOrNull(value.plan_summary) &&
    isStringOrNull(value.step_final_verdict) &&
    isStringOrNull(value.step_final_summary) &&
    isStringOrNull(value.swarm_verdict)
  );
}

function isStringRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isStringOrNull(value: unknown): boolean {
  return typeof value === "string" || value === null;
}

function isNumberOrNull(value: unknown): boolean {
  return typeof value === "number" || value === null;
}

function isBooleanOrNull(value: unknown): boolean {
  return typeof value === "boolean" || value === null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
