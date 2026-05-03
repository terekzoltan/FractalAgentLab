import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import { RUN_INDEX_SCHEMA_VERSION, type RunIndex } from "./runIndexModel";

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

    expect(screen.getByText(/fixture-backed shell, not artifact browsing/i)).toBeInTheDocument();
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
    expect(screen.getByText(/no real trace timeline is implemented here/i)).toBeInTheDocument();
    expect(screen.getByText(/u5-c will preserve strict trace truth/i)).toBeInTheDocument();
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

  it("passes a trace target to the U5-C placeholder without rendering a timeline", async () => {
    const user = userEvent.setup();
    mockFetchWith(sampleIndex());
    render(<App />);

    await user.click(screen.getByRole("button", { name: /runs/i }));
    await screen.findByRole("heading", { name: /run browser/i });
    await user.click(screen.getByRole("button", { name: /send trace target to u5-c placeholder/i }));

    expect(screen.getByText(/u5-c handoff target/i)).toBeInTheDocument();
    expect(screen.getByText(/timeline rendering is intentionally deferred to u5-c/i)).toBeInTheDocument();
    expect(screen.queryByText(/event list/i)).not.toBeInTheDocument();
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
