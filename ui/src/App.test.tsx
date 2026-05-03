import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import { RUN_INDEX_SCHEMA_VERSION, type RunIndex } from "./runIndexModel";
import { TRACE_DETAIL_SCHEMA_VERSION, type TraceDetail } from "./traceDetailModel";

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

  it("states launch and OpenCode automation are inactive", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /packets \/ launch/i }));

    expect(screen.getByText(/not active/i)).toBeInTheDocument();
    expect(screen.getByText(/no workflow launch/i)).toBeInTheDocument();
    expect(screen.getByText(/opencode automation/i)).toBeInTheDocument();
    expect(screen.queryByText(/provider leaderboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provider ranking/i)).not.toBeInTheDocument();
  });

  it("keeps evidence and memory pages bounded to later Wave 5 work", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));
    expect(screen.getByText(/track e must define comparison semantics/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /memory \/ eval/i }));
    expect(screen.getByText(/no memory inspection or editing is implemented here/i)).toBeInTheDocument();
  });
});
