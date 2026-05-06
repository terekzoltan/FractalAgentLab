import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import { COMPARISON_INDEX_SCHEMA_VERSION, type ComparisonIndex } from "./comparisonIndexModel";
import { MEMORY_EVAL_INDEX_SCHEMA_VERSION, type MemoryEvalIndex } from "./memoryEvalIndexModel";
import { RUN_INDEX_SCHEMA_VERSION, type RunIndex } from "./runIndexModel";
import { TRACE_DETAIL_SCHEMA_VERSION, type TraceDetail } from "./traceDetailModel";
import { WORKFLOW_CATALOG_SCHEMA_VERSION, type WorkflowCatalog } from "./workflowCatalogModel";

function mockFetchWith(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    })),
  );
}

function mockFetchByPath(routes: Record<string, { status?: number; payload: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      const route = routes[url];
      if (!route) {
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        };
      }
      const status = route.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => route.payload,
      };
    }),
  );
}

function sampleIndex(): RunIndex {
  return {
    schema_version: RUN_INDEX_SCHEMA_VERSION,
    generated_at: "2026-05-02T12:00:00+00:00",
    data_dir: "../data",
    summary: {
      total_runs: 3,
      workflow_counts: { "h1.single.v1": 1, "h3.manager.v1": 1, unknown: 1 },
      status_counts: { failed: 1, succeeded: 1, unknown: 1 },
      trace_state_counts: { invalid: 1, missing: 1, ok: 1 },
      warnings_count: 1,
    },
    runs: [
      {
        run_id: "run-valid",
        workflow_id: "h1.single.v1",
        status: "succeeded",
        started_at: "2026-05-02T10:00:01+00:00",
        completed_at: "2026-05-02T10:00:02+00:00",
        run_artifact_path: "data/runs/run-valid.json",
        trace_artifact_path: "data/traces/run-valid.jsonl",
        artifact_dir_path: "data/artifacts/run-valid",
        has_run_artifact: true,
        has_trace_artifact: true,
        has_artifact_dir: true,
        sidecar_files: ["summary.json"],
        trace_state: "ok",
        trace_event_count: 2,
        trace_schema_versions: ["trace_event.v1"],
        provider_names: ["openrouter"],
        model_names: ["test-model"],
        fallback_state: "not_observed",
        row_state: "ok",
        warnings: [],
      },
      {
        run_id: "run-missing-trace",
        workflow_id: "h3.manager.v1",
        status: "failed",
        started_at: null,
        completed_at: null,
        run_artifact_path: "data/runs/run-missing-trace.json",
        trace_artifact_path: "data/traces/run-missing-trace.jsonl",
        artifact_dir_path: "data/artifacts/run-missing-trace",
        has_run_artifact: true,
        has_trace_artifact: false,
        has_artifact_dir: false,
        sidecar_files: [],
        trace_state: "missing",
        trace_event_count: null,
        trace_schema_versions: [],
        provider_names: [],
        model_names: [],
        fallback_state: "unknown",
        row_state: "missing_trace_artifact",
        warnings: [],
      },
      {
        run_id: "trace-only",
        workflow_id: null,
        status: null,
        started_at: null,
        completed_at: null,
        run_artifact_path: "data/runs/trace-only.json",
        trace_artifact_path: "data/traces/trace-only.jsonl",
        artifact_dir_path: "data/artifacts/trace-only",
        has_run_artifact: false,
        has_trace_artifact: true,
        has_artifact_dir: false,
        sidecar_files: [],
        trace_state: "invalid",
        trace_event_count: null,
        trace_schema_versions: [],
        provider_names: [],
        model_names: [],
        fallback_state: "unknown",
        row_state: "missing_run_artifact",
        warnings: ["trace-only: Trace artifact sequence is not strictly increasing"],
      },
    ],
    warnings: ["trace-only: Trace artifact sequence is not strictly increasing"],
  };
}

function sampleTraceDetail(): TraceDetail {
  return {
    schema_version: TRACE_DETAIL_SCHEMA_VERSION,
    generated_at: "2026-05-03T12:00:00+00:00",
    run_id: "run-valid",
    workflow_id: "h1.single.v1",
    status: "succeeded",
    run_artifact_path: "data/runs/run-valid.json",
    trace_artifact_path: "data/traces/run-valid.jsonl",
    summary: {
      total_events: 3,
      event_counts: { run_started: 1, step_failed: 1, run_completed: 1 },
      lane_counts: { manager: 2 },
      max_turn_index: 2,
      linked_events: { with_parent_event_id: 1, with_correlation_id: 1 },
    },
    validation: {
      trace_state: "warning",
      warnings: ["Timestamp order warning at event #2: canonical sequence is preserved."],
      timestamp_order: "warning",
      linkage_state: "ok",
    },
    events: [
      {
        event_id: "e1",
        sequence: 1,
        timestamp: "2026-05-03T10:00:00+00:00",
        event_type: "run_started",
        source: "runtime.executor",
        step_id: null,
        parent_event_id: null,
        correlation_id: null,
        lane: "manager",
        turn_index: 0,
        handoff_index: null,
        from_step_id: null,
        to_step_id: null,
        is_failure: false,
        payload_summary: "lane=manager, turn_index=0",
        payload: { lane: "manager", turn_index: 0 },
      },
      {
        event_id: "e2",
        sequence: 2,
        timestamp: "2026-05-03T09:59:59+00:00",
        event_type: "step_failed",
        source: "runtime.executor",
        step_id: "critic",
        parent_event_id: "e1",
        correlation_id: "corr-1",
        lane: "manager",
        turn_index: 1,
        handoff_index: null,
        from_step_id: null,
        to_step_id: null,
        is_failure: true,
        payload_summary: "reason=network-timeout",
        payload: { reason: "network-timeout" },
      },
      {
        event_id: "e3",
        sequence: 3,
        timestamp: "2026-05-03T10:00:01+00:00",
        event_type: "run_completed",
        source: "runtime.executor",
        step_id: null,
        parent_event_id: null,
        correlation_id: null,
        lane: null,
        turn_index: 2,
        handoff_index: null,
        from_step_id: null,
        to_step_id: null,
        is_failure: false,
        payload_summary: "no payload fields",
        payload: {},
      },
    ],
  };
}

function sampleWorkflowCatalog(): WorkflowCatalog {
  return {
    schema_version: WORKFLOW_CATALOG_SCHEMA_VERSION,
    generated_at: "2026-05-04T12:00:00+00:00",
    workflows: [
      {
        workflow_id: "h1.single.v1",
        name: "H1 Single Agent Baseline",
        version: "1.0.0",
        execution_mode: "linear",
        input_schema_ref: "h1.input.v1",
        output_schema_ref: "h1.single.output.v1",
        step_count: 1,
        steps: [{ step_id: "single", agent_id: "h1_single_agent", description: "Single-agent baseline." }],
        metadata: { hero_workflow: "H1", variant: "single", schema_contract: "h1.single.workflow.v1" },
      },
      {
        workflow_id: "h4.seq_next.v1",
        name: "H4 Seq Next Planning Manager Baseline",
        version: "1.0.0",
        execution_mode: "manager",
        input_schema_ref: "h4.seq_next.input.v1",
        output_schema_ref: "h4.seq_next.output.v1",
        step_count: 4,
        steps: [{ step_id: "synthesizer", agent_id: "h4_synthesizer_agent", description: "Manager and finalizer." }],
        metadata: { hero_workflow: "H4", variant: "seq_next", schema_contract: "h4.seq_next.workflow.v1" },
      },
    ],
    warnings: [],
  };
}

function sampleMemoryEvalIndex(overrides: Partial<MemoryEvalIndex> = {}): MemoryEvalIndex {
  const index: MemoryEvalIndex = {
    schema_version: MEMORY_EVAL_INDEX_SCHEMA_VERSION,
    generated_at: "2026-05-04T12:00:00+00:00",
    data_dir: "../data",
    summary: {
      project_memory_store_state: "available",
      memory_project_count: 1,
      memory_artifact_count: 2,
      eval_summary_count: 1,
      warnings_count: 0,
    },
    memory_projects: [
      {
        project_id: "fal",
        source_path: "data/memory/projects/fal.json",
        schema_version: "project_memory.v1",
        updated_at: "2026-05-04T12:00:00+00:00",
        stable_decision_count: 1,
        workflow_learning_count: 2,
        prompt_observation_count: 0,
      },
    ],
    memory_artifacts: [
      {
        run_id: "run-h1",
        source_path: "data/artifacts/run-h1/memory_candidates.json",
        artifact_kind: "memory_candidates",
        artifact_version: "1.0",
        schema_version: "memory.candidate.v1",
        workflow_id: "h1.manager.v1",
        session_id: "session-1",
        project_id: null,
        generated_at: "2026-05-04T12:00:00+00:00",
        item_count: 3,
      },
      {
        run_id: "run-h2",
        source_path: "data/artifacts/run-h2/project_memory_update.json",
        artifact_kind: "project_memory_update",
        artifact_version: "1.0",
        schema_version: "project_memory.v1",
        workflow_id: "h2.manager.v1",
        session_id: null,
        project_id: "fal",
        generated_at: "2026-05-04T12:00:00+00:00",
        item_count: 1,
      },
    ],
    eval_summaries: [
      {
        label: "cv1 d h4 usefulness check v1",
        source_path: "data/artifacts/run-eval/h4_usefulness.json",
        report_version: "cv1_d.h4_usefulness_check.v1",
        generated_at: "2026-05-04T12:00:00+00:00",
        source_reported_outcome: "eval_outcome: PASS",
        source_reported_summary: {
          track_e_evidence_ready: true,
          eval_outcome: "PASS",
        },
        known_limits: ["Source report only."],
      },
    ],
    curated_references: [
      {
        label: "R3-L historical curated evidence reference",
        source_path: "docs/wave3/Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md",
        evidence_label: "historical_curated_reference",
        note: "Linked source reference only; U5-F does not parse it into live metrics.",
      },
    ],
    warnings: [],
  };
  return { ...index, ...overrides };
}

function sampleComparisonIndex(overrides: Partial<ComparisonIndex> = {}): ComparisonIndex {
  const runA = sampleComparisonRun("h1-single", "h1.single.v1", "baseline_anchor");
  const runB = sampleComparisonRun("h1-manager", "h1.manager.v1", "default_multi_agent_reference");
  const index: ComparisonIndex = {
    schema_version: COMPARISON_INDEX_SCHEMA_VERSION,
    generated_at: "2026-05-05T12:00:00+00:00",
    data_dir: "../data",
    summary: {
      run_candidate_count: 2,
      suggested_pair_count: 1,
      known_evidence_pair_count: 1,
      unsupported_target_count: 1,
      warnings_count: 0,
      max_suggested_pairs: 25,
    },
    run_candidates: [runA, runB],
    suggested_pairs: [
      {
        pair_id: "h1_structural_variant:h1-single:h1-manager",
        target_class: "h1_structural_variant",
        left_run_id: "h1-single",
        right_run_id: "h1-manager",
        selection_reason: "bounded_recent_valid_runs_first",
        structural_preflight_status: "PASS",
        status_reasons: [],
        matched_input: true,
        source_reported_status: null,
        display_only: true,
      },
    ],
    known_evidence_pairs: [
      {
        pair_id: "p4_b.accepted_h1_provider_path_smoke",
        target_class: "h1_provider_path_smoke",
        left_run_id: "4771b058-97b6-4164-b060-40b381acd2b4",
        right_run_id: "308ac05a-7f2e-4985-99dc-11d547557a98",
        source_reported_status: "PASS",
        source_report_path: "docs/wave4/Wave4-W4-S1-TrackE-P4-B-Live-Evidence-Closeout-v1.md",
        local_state: "not_demonstrated",
        local_preflight_status: "BLOCKED",
        status_reasons: ["missing_local_run_ids"],
        display_only: true,
      },
    ],
    unsupported_targets: [
      {
        run_id: "h4-run",
        workflow_id: "h4.seq_next.v1",
        target_class: "h4_deferred",
        evidence_label: "not_demonstrated",
        future_state: "deferred",
        note: "Comparison support is deferred until a later Track E contract defines keys, labels, and gates.",
      },
    ],
    warnings: [],
  };
  return { ...index, ...overrides };
}

function sampleH2ComparisonIndex(): ComparisonIndex {
  const runA = sampleComparisonRun("h2-a", "h2.manager.v1", null, {
    target_class: "h2_structural",
    h2_gates: {
      key_order_matches: true,
      implementation_waves_valid: true,
      recommended_starting_slice_present: true,
      delegate_order_matches: true,
      delegate_targets: ["intake", "planner", "architect", "critic"],
    },
    input: { available: true, fingerprint: "h2-input", keys: ["goal"] },
  });
  const runB = sampleComparisonRun("h2-b", "h2.manager.v1", null, {
    target_class: "h2_structural",
    h2_gates: {
      key_order_matches: true,
      implementation_waves_valid: true,
      recommended_starting_slice_present: true,
      delegate_order_matches: true,
      delegate_targets: ["intake", "planner", "architect", "critic"],
    },
    input: { available: true, fingerprint: "h2-input", keys: ["goal"] },
  });
  return {
    schema_version: COMPARISON_INDEX_SCHEMA_VERSION,
    generated_at: "2026-05-05T12:00:00+00:00",
    data_dir: "../data",
    summary: {
      run_candidate_count: 2,
      suggested_pair_count: 1,
      known_evidence_pair_count: 0,
      unsupported_target_count: 0,
      warnings_count: 0,
      max_suggested_pairs: 25,
    },
    run_candidates: [runA, runB],
    suggested_pairs: [
      {
        pair_id: "h2_structural:h2-a:h2-b",
        target_class: "h2_structural",
        left_run_id: "h2-a",
        right_run_id: "h2-b",
        selection_reason: "bounded_recent_valid_runs_first",
        structural_preflight_status: "WARNING",
        status_reasons: ["h2_intended_comparable_corpus_unknown"],
        matched_input: true,
        source_reported_status: null,
        display_only: true,
      },
    ],
    known_evidence_pairs: [],
    unsupported_targets: [],
    warnings: [],
  };
}

function sampleManualOnlyComparisonIndex(): ComparisonIndex {
  const runA = sampleComparisonRun("h1-a", "h1.single.v1", "baseline_anchor", { input: { available: true, fingerprint: "manual-input-a", keys: ["idea"] } });
  const runB = sampleComparisonRun("h1-b", "h1.manager.v1", "default_multi_agent_reference", { input: { available: true, fingerprint: "manual-input-b", keys: ["idea"] } });
  const runC = sampleComparisonRun("h1-c", "h1.handoff.v1", "reference_variant", { input: { available: true, fingerprint: "manual-input-c", keys: ["idea"] } });
  return {
    schema_version: COMPARISON_INDEX_SCHEMA_VERSION,
    generated_at: "2026-05-05T12:00:00+00:00",
    data_dir: "../data",
    summary: {
      run_candidate_count: 3,
      suggested_pair_count: 1,
      known_evidence_pair_count: 0,
      unsupported_target_count: 0,
      warnings_count: 0,
      max_suggested_pairs: 25,
    },
    run_candidates: [runA, runB, runC],
    suggested_pairs: [
      {
        pair_id: "h1_structural_variant:h1-a:h1-b",
        target_class: "h1_structural_variant",
        left_run_id: "h1-a",
        right_run_id: "h1-b",
        selection_reason: "bounded_recent_valid_runs_first",
        structural_preflight_status: "PASS",
        status_reasons: [],
        matched_input: false,
        source_reported_status: null,
        display_only: true,
      },
    ],
    known_evidence_pairs: [],
    unsupported_targets: [],
    warnings: [],
  };
}

function sampleComparisonRun(runId: string, workflowId: string, role: string | null, overrides: Record<string, unknown> = {}) {
  const run = {
    run_id: runId,
    workflow_id: workflowId,
    status: "succeeded",
    started_at: "2026-05-05T10:00:01+00:00",
    completed_at: "2026-05-05T10:00:02+00:00",
    target_class: "h1_structural_variant",
    comparison_support: "supported",
    comparison_role: role,
    run_artifact_path: `data/runs/${runId}.json`,
    trace_artifact_path: `data/traces/${runId}.jsonl`,
    artifact_dir_path: `data/artifacts/${runId}`,
    artifact_validation: { passed: true, errors: [], warnings: [] },
    preflight: {
      run_artifact_exists: true,
      trace_artifact_exists: true,
      artifact_validation_passed: true,
      trace_state: "available",
    },
    input: { available: true, fingerprint: "input-fingerprint", keys: ["idea"] },
    comparable_output: {
      present: true,
      complete: true,
      missing_keys: [],
      fields: [
        { key: "clarified_idea", present: true, value_kind: "string", preview: "Bounded display", fingerprint: "field-a" },
        { key: "recommended_mvp_direction", present: true, value_kind: "string", preview: "Show structural facts", fingerprint: "field-b" },
      ],
    },
    h2_gates: {
      key_order_matches: null,
      implementation_waves_valid: null,
      recommended_starting_slice_present: null,
      delegate_order_matches: null,
      delegate_targets: [],
    },
    provider_disclosure: {
      provider_names: ["openrouter"],
      model_names: ["test-model"],
      selected_provider: "openrouter",
      executed_provider: "openrouter",
      selected_model: "test-model",
      executed_model: "test-model",
      fallback_state: "not_observed",
      provider_attempt_count: 1,
    },
  };
  return { ...run, ...overrides };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("U5-A workbench shell", () => {
  it("renders the evidence observatory shell and navigation labels", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /local evidence observatory shell/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /runs/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /packets \/ launch/i })).toBeInTheDocument();
  });

  it("shows fixture disclosure wherever demo evidence appears", () => {
    render(<App />);

    expect(screen.getByText(/derived browse surfaces, not launch automation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/synthetic u5-a fixture/i)).toHaveLength(3);
    expect(screen.getAllByText(/fixture\/demo data/i).length).toBeGreaterThan(0);
  });

  it("shows missing index guidance instead of fixture fallback for Runs", async () => {
    const user = userEvent.setup();
    mockFetchWith({}, 404);
    render(<App />);

    await user.click(screen.getByRole("button", { name: /runs/i }));
    expect(await screen.findByText(/generated run index is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/npm run build:index/i)).toBeInTheDocument();
    expect(screen.queryByText(/future evidence rows/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /trace/i }));
    expect(await screen.findByText(/generated run index is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/npm run build:index/i)).toBeInTheDocument();
  });

  it("rejects same-version run index when nested rendered fields are malformed", async () => {
    const user = userEvent.setup();
    const malformed = {
      ...sampleIndex(),
      summary: {
        ...sampleIndex().summary,
        trace_state_counts: { ok: "1" },
      },
      runs: [
        {
          ...sampleIndex().runs[0],
          trace_event_count: "2",
        },
      ],
    };
    mockFetchWith(malformed);
    render(<App />);

    await user.click(screen.getByRole("button", { name: /runs/i }));
    expect(await screen.findByText(/generated run index is invalid/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /run browser/i })).not.toBeInTheDocument();
  });

  it("renders generated run rows, filters, and run detail paths", async () => {
    const user = userEvent.setup();
    mockFetchWith(sampleIndex());
    render(<App />);

    await user.click(screen.getByRole("button", { name: /runs/i }));

    expect(await screen.findByRole("heading", { name: /run browser/i })).toBeInTheDocument();
    expect(screen.getAllByText(/run-valid/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/trace-only/i).length).toBeGreaterThan(0);
    expect(screen.getByText("data/runs/run-valid.json")).toBeInTheDocument();
    expect(screen.getByText(/openrouter/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/workflow/i), "h3.manager.v1");
    expect(screen.getAllByText(/run-missing-trace/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/run-valid/i)).not.toBeInTheDocument();
  });

  it("renders a valid trace timeline from the U5-B handoff target", async () => {
    const user = userEvent.setup();
    mockFetchByPath({
      "/generated/run-index.json": { payload: sampleIndex() },
      "/generated/traces/run-valid.json": { payload: sampleTraceDetail() },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /runs/i }));
    await screen.findByRole("heading", { name: /run browser/i });
    await user.click(screen.getByRole("button", { name: /open trace timeline/i }));

    expect(await screen.findByRole("heading", { name: /trace viewer/i })).toBeInTheDocument();
    expect(screen.getByText(/timestamp order warning/i)).toBeInTheDocument();
    expect(screen.getByText(/#2 step_failed/i)).toBeInTheDocument();
    expect(screen.getByText(/reason=network-timeout/i)).toBeInTheDocument();
    expect(screen.getAllByText(/raw payload/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/run comparison/i)).not.toBeInTheDocument();
  });

  it("shows invalid generated detail when run_id mismatches the requested target", async () => {
    const user = userEvent.setup();
    mockFetchByPath({
      "/generated/run-index.json": { payload: sampleIndex() },
      "/generated/traces/run-valid.json": {
        payload: { ...sampleTraceDetail(), run_id: "wrong-run" },
      },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /trace/i }));

    expect(await screen.findByText(/generated trace detail invalid/i)).toBeInTheDocument();
    expect(screen.getByText(/run_id mismatch/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trace events/i)).not.toBeInTheDocument();
  });

  it("shows invalid generated detail for malformed warnings and rendered event fields", async () => {
    const user = userEvent.setup();
    const malformed = {
      ...sampleTraceDetail(),
      validation: {
        ...sampleTraceDetail().validation,
        warnings: [123],
      },
      events: [
        {
          ...sampleTraceDetail().events[0],
          timestamp: 123,
        },
      ],
    };
    mockFetchByPath({
      "/generated/run-index.json": { payload: sampleIndex() },
      "/generated/traces/run-valid.json": { payload: malformed },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /trace/i }));

    expect(await screen.findByText(/generated trace detail invalid/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trace events/i)).not.toBeInTheDocument();
  });

  it("shows missing trace state without rendering a timeline", async () => {
    const user = userEvent.setup();
    mockFetchByPath({
      "/generated/run-index.json": { payload: sampleIndex() },
      "/generated/traces/run-valid.json": { payload: sampleTraceDetail() },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /trace/i }));
    await screen.findByRole("heading", { name: /trace viewer/i });
    await user.click(screen.getByRole("button", { name: /run-missing-trace/i }));

    expect(screen.getByText(/trace artifact missing/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trace events/i)).not.toBeInTheDocument();
  });

  it("shows invalid generated detail state without rendering a timeline", async () => {
    const user = userEvent.setup();
    mockFetchByPath({
      "/generated/run-index.json": { payload: sampleIndex() },
      "/generated/traces/run-valid.json": { payload: {} },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /trace/i }));

    expect(await screen.findByText(/generated trace detail invalid/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trace events/i)).not.toBeInTheDocument();
  });

  it("applies failure-only, event type, lane, and step filters", async () => {
    const user = userEvent.setup();
    mockFetchByPath({
      "/generated/run-index.json": { payload: sampleIndex() },
      "/generated/traces/run-valid.json": { payload: sampleTraceDetail() },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /trace/i }));
    await screen.findByRole("heading", { name: /trace viewer/i });
    await screen.findByText(/#1 run_started/i);

    await user.click(screen.getByLabelText(/failure events only/i));
    expect(screen.getByText(/#2 step_failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/#1 run_started/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/failure events only/i));
    await user.selectOptions(screen.getByLabelText(/event type/i), "run_completed");
    expect(screen.getByText(/#3 run_completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/#2 step_failed/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/event type/i), "all");
    await user.selectOptions(screen.getByLabelText(/lane/i), "unknown");
    expect(screen.getByText(/#3 run_completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/#1 run_started/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/lane/i), "all");
    await user.selectOptions(screen.getByLabelText(/step/i), "critic");
    expect(screen.getByText(/#2 step_failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/#3 run_completed/i)).not.toBeInTheDocument();
  });

  it("shows missing workflow catalog guidance without fixture fallback", async () => {
    const user = userEvent.setup();
    mockFetchByPath({});
    render(<App />);

    await user.click(screen.getByRole("button", { name: /packets \/ launch/i }));

    expect(await screen.findByText(/generated workflow catalog is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/npm run build:workflows/i)).toBeInTheDocument();
    expect(screen.queryByText(/future evidence rows/i)).not.toBeInTheDocument();
  });

  it("shows invalid workflow catalog without fixture fallback", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/workflows.json": { payload: {} } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /packets \/ launch/i }));

    expect(await screen.findByText(/generated workflow catalog is invalid/i)).toBeInTheDocument();
    expect(screen.queryByText(/operator command and packet composer/i)).not.toBeInTheDocument();
  });

  it("prepares command preview and structured packet from a valid workflow catalog", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/workflows.json": { payload: sampleWorkflowCatalog() } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /packets \/ launch/i }));
    expect(await screen.findByRole("heading", { name: /operator command and packet composer/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /^workflow$/i }), "h4.seq_next.v1");
    await user.selectOptions(screen.getByLabelText(/provider override/i), "mock");
    fireEvent.change(screen.getByLabelText(/input json object/i), { target: { value: '{"goal":"Plan U5-D"}' } });

    expect(screen.getAllByText(/PYTHONPATH=src python -m fractal_agent_lab.cli run 'h4.seq_next.v1'/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/--providers-config 'configs\/providers.example.yaml'/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/--provider 'mock'/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Target role\/Track: Track A/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow id: h4.seq_next.v1/i)).toBeInTheDocument();
    expect(screen.getByText(/This packet is not a gate/i)).toBeInTheDocument();
    expect(screen.getByText(/does not launch OpenCode/i)).toBeInTheDocument();
    expect(screen.getByText(/does not perform commits/i)).toBeInTheDocument();
    expect(screen.queryByText(/provider leaderboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provider ranking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run OpenCode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto commit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/autonomous dispatch enabled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/session bus active/i)).not.toBeInTheDocument();
  });

  it.each(["not-json", "[]", "\"text\"", "123", "null"])("blocks non-object or invalid input JSON: %s", async (payload) => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/workflows.json": { payload: sampleWorkflowCatalog() } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /packets \/ launch/i }));
    await screen.findByRole("heading", { name: /operator command and packet composer/i });
    fireEvent.change(screen.getByLabelText(/input json object/i), { target: { value: payload } });

    expect(screen.getByText(/command is not ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/PYTHONPATH=src python -m fractal_agent_lab.cli run/i)).not.toBeInTheDocument();
  });

  it("shows missing comparison index guidance without fixture fallback", async () => {
    const user = userEvent.setup();
    mockFetchByPath({});
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));
    expect(await screen.findByText(/generated comparison index is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/npm run build:comparisons/i)).toBeInTheDocument();
    expect(screen.queryByText(/future evidence rows/i)).not.toBeInTheDocument();
  });

  it("rejects wrong comparison index schema version", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/comparison-index.json": { payload: { ...sampleComparisonIndex(), schema_version: "wrong.schema" } } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));
    expect(await screen.findByText(/generated comparison index is invalid/i)).toBeInTheDocument();
    expect(screen.getByText(/does not match u5_e.comparison_index.v1/i)).toBeInTheDocument();
    expect(screen.queryByText(/run comparison evidence/i)).not.toBeInTheDocument();
  });

  it("rejects same-version comparison index when nested rendered fields are malformed", async () => {
    const user = userEvent.setup();
    const malformed = sampleComparisonIndex();
    malformed.run_candidates[0] = {
      ...malformed.run_candidates[0],
      comparable_output: {
        ...malformed.run_candidates[0].comparable_output,
        fields: [{ key: "clarified_idea", present: true, value_kind: "string", preview: "ok", fingerprint: 42 } as never],
      },
    };
    mockFetchByPath({ "/generated/comparison-index.json": { payload: malformed } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));
    expect(await screen.findByText(/generated comparison index is invalid/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /run comparison evidence/i })).not.toBeInTheDocument();
  });

  it("renders empty comparison index as not demonstrated instead of failure", async () => {
    const user = userEvent.setup();
    mockFetchByPath({
      "/generated/comparison-index.json": {
        payload: sampleComparisonIndex({
          summary: {
            run_candidate_count: 0,
            suggested_pair_count: 0,
            known_evidence_pair_count: 1,
            unsupported_target_count: 0,
            warnings_count: 0,
            max_suggested_pairs: 25,
          },
          run_candidates: [],
          suggested_pairs: [],
          unsupported_targets: [],
        }),
      },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));
    expect(await screen.findByRole("heading", { name: /run comparison evidence/i })).toBeInTheDocument();
    expect(screen.getByText(/not demonstrated in the generated local index/i)).toBeInTheDocument();
    expect(screen.queryByText(/FAIL/i)).not.toBeInTheDocument();
  });

  it("renders structural comparison facts without ranking or quality wording", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/comparison-index.json": { payload: sampleComparisonIndex() } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));

    expect(await screen.findByRole("heading", { name: /run comparison evidence/i })).toBeInTheDocument();
    expect(screen.getByText(/display-only structural preflight/i)).toBeInTheDocument();
    expect(screen.getAllByText(/h1-single/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/h1-manager/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/clarified_idea/i)).toBeInTheDocument();
    expect(screen.getAllByText(/source-reported status/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not_demonstrated.*deferred/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/winner/i)).toHaveLength(0);
    expect(screen.queryAllByText(/leaderboard/i)).toHaveLength(0);
    expect(screen.queryAllByText(/score/i)).toHaveLength(0);
    expect(screen.queryAllByText(/better provider/i)).toHaveLength(0);
    expect(screen.queryAllByText(/better model/i)).toHaveLength(0);
    expect(screen.queryAllByText(/quality ranking/i)).toHaveLength(0);
  });

  it("shows H2 warning and gate facts in the Evidence UI", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/comparison-index.json": { payload: sampleH2ComparisonIndex() } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));

    expect(await screen.findByRole("heading", { name: /selected pair state/i })).toBeInTheDocument();
    expect(screen.getAllByText(/WARNING/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/h2_intended_comparable_corpus_unknown/i)).toBeInTheDocument();
    expect(screen.getAllByText(/H2 gate facts/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Key order/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Implementation waves valid/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recommended starting slice present/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Delegate order/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/intake, planner, architect, critic/i).length).toBeGreaterThan(0);
  });

  it("keeps manual non-suggested pair selection blocked and not PASS", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/comparison-index.json": { payload: sampleManualOnlyComparisonIndex() } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));
    await screen.findByRole("heading", { name: /run comparison evidence/i });

    const runASelect = screen.getByRole("combobox", { name: /^Run A$/i });
    const runBSelect = screen.getByRole("combobox", { name: /^Run B$/i });
    await user.selectOptions(runASelect, "h1-a");
    await user.selectOptions(runBSelect, "h1-c");

    expect(screen.getByText(/selected_pair_not_in_bounded_generated_suggestions/i)).toBeInTheDocument();
    const statusPanel = screen.getByRole("heading", { name: /selected pair state/i }).closest("section");
    expect(statusPanel).not.toBeNull();
    expect(within(statusPanel as HTMLElement).queryByText(/^PASS$/)).not.toBeInTheDocument();
    expect(within(statusPanel as HTMLElement).getByText(/BLOCKED/i)).toBeInTheDocument();
  });

  it("shows missing memory/eval index guidance without fixture fallback", async () => {
    const user = userEvent.setup();
    mockFetchByPath({});
    render(<App />);

    await user.click(screen.getByRole("button", { name: /memory \/ eval/i }));
    expect(await screen.findByText(/generated memory\/eval index is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/npm run build:memory-eval/i)).toBeInTheDocument();
    expect(screen.queryByText(/future evidence rows/i)).not.toBeInTheDocument();
  });

  it("shows invalid memory/eval index without fixture fallback", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/memory-eval-index.json": { payload: {} } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /memory \/ eval/i }));
    expect(await screen.findByText(/generated memory\/eval index is invalid/i)).toBeInTheDocument();
    expect(screen.queryByText(/memory \/ eval inspection/i)).not.toBeInTheDocument();
  });

  it("renders empty memory/eval index as not demonstrated instead of failure", async () => {
    const user = userEvent.setup();
    mockFetchByPath({
      "/generated/memory-eval-index.json": {
        payload: sampleMemoryEvalIndex({
          summary: {
            project_memory_store_state: "no_local_project_memory_store_found",
            memory_project_count: 0,
            memory_artifact_count: 0,
            eval_summary_count: 0,
            warnings_count: 0,
          },
          memory_projects: [],
          memory_artifacts: [],
          eval_summaries: [],
        }),
      },
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /memory \/ eval/i }));
    expect(await screen.findByRole("heading", { name: /memory \/ eval inspection/i })).toBeInTheDocument();
    expect(screen.getByText(/not demonstrated in the generated local index/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no local project memory store found/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PARTIAL/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/FAIL/i)).not.toBeInTheDocument();
  });

  it("renders memory/eval inventory as read-only source-reported evidence", async () => {
    const user = userEvent.setup();
    mockFetchByPath({ "/generated/memory-eval-index.json": { payload: sampleMemoryEvalIndex() } });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /memory \/ eval/i }));

    expect(await screen.findByRole("heading", { name: /memory \/ eval inspection/i })).toBeInTheDocument();
    expect(screen.getByText("data/memory/projects/fal.json")).toBeInTheDocument();
    expect(screen.getByText("data/artifacts/run-h1/memory_candidates.json")).toBeInTheDocument();
    expect(screen.getByText("data/artifacts/run-h2/project_memory_update.json")).toBeInTheDocument();
    expect(screen.getByText("data/artifacts/run-eval/h4_usefulness.json")).toBeInTheDocument();
    expect(screen.getAllByText(/source-reported outcome/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/eval_outcome: PASS/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/historical_curated_reference/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /merge/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/leaderboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/winner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/benchmark dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });
});
