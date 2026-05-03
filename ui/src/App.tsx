import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { evidenceFixtures, pages } from "./fixtures";
import { loadRunIndex, type RunIndexLoadState } from "./runIndexLoader";
import type { RunIndex, RunIndexRow, TraceTarget } from "./runIndexModel";
import type { WorkbenchPage, WorkbenchPageId, WorkbenchStatus } from "./workbenchModel";

const statusDescriptions: Record<WorkbenchStatus, string> = {
  PASS: "accepted evidence",
  FAIL: "failed evidence",
  BLOCKED: "blocked or inactive",
  PARTIAL: "partial shell state",
  UNKNOWN: "unknown from available data",
  MISSING: "missing artifact or field",
  FIXTURE: "fixture/demo data",
  "NOT IMPLEMENTED": "future Wave 5 surface",
};

function StatusBadge({ status }: { status: WorkbenchStatus }) {
  return (
    <span className={`status status-${status.toLowerCase().split(" ").join("-")}`}>
      <strong>{status}</strong>
      <span>{statusDescriptions[status]}</span>
    </span>
  );
}

function DisclosureBanner() {
  return (
    <section className="disclosure" aria-labelledby="disclosure-title">
      <div>
        <p className="eyebrow">U5-A scope disclosure</p>
        <h2 id="disclosure-title">Fixture-backed shell, not artifact browsing</h2>
      </div>
      <p>
        This workbench shell does not crawl local artifacts, render real trace timelines,
        launch workflows, generate packets, or automate OpenCode. Canonical truth remains
        in <code>data/runs/&lt;run_id&gt;.json</code>, <code>data/traces/&lt;run_id&gt;.jsonl</code>,
        and <code>data/artifacts/&lt;run_id&gt;/...</code>.
      </p>
    </section>
  );
}

function OverviewPage() {
  return (
    <div className="page-grid">
      <section className="panel panel-large">
        <p className="eyebrow">Evidence observatory</p>
        <h2>FAL makes workflow evidence inspectable before it becomes controllable.</h2>
        <p>
          Wave 5 starts with a local operator shell for seeing what kinds of run, trace,
          evidence, and handoff surfaces the system will expose. This is not a generic
          dashboard and not an autonomous coding agent.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">Canonical evidence law</p>
        <ul className="path-list" aria-label="Canonical artifact paths">
          <li><code>data/runs/&lt;run_id&gt;.json</code></li>
          <li><code>data/traces/&lt;run_id&gt;.jsonl</code></li>
          <li><code>data/artifacts/&lt;run_id&gt;/...</code></li>
        </ul>
      </section>
      <section className="panel">
        <p className="eyebrow">Status vocabulary</p>
        <div className="status-cloud" aria-label="Workbench status vocabulary">
          {Object.keys(statusDescriptions).map((status) => (
            <StatusBadge key={status} status={status as WorkbenchStatus} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PlaceholderPage({ page, traceTarget }: { page: WorkbenchPage; traceTarget: TraceTarget | null }) {
  const messages: Record<WorkbenchPageId, string> = {
    overview: "This shell is active as U5-A.",
    runs: "No real run list or run detail page is implemented here. U5-B will define the artifact-backed browse model.",
    trace: "No real trace timeline is implemented here. U5-C will preserve strict trace truth and linkage visibility.",
    evidence: "No comparison or eval dashboard is implemented here. Track E must define comparison semantics before UX implementation.",
    packets: "Not active. No workflow launch, packet generation, OpenCode automation, autonomous code editing, or commit action exists in U5-A.",
    memory: "No memory inspection or editing is implemented here. U5-F later exposes read-only memory/eval summaries with Track C/E wording checks.",
  };

  return (
    <section className="panel panel-large placeholder" aria-labelledby={`${page.id}-title`}>
      <p className="eyebrow">Wave 5 placeholder</p>
      <h2 id={`${page.id}-title`}>{page.label}</h2>
      <StatusBadge status={page.status} />
      <p>{messages[page.id]}</p>
      {page.id === "trace" && traceTarget !== null ? (
        <div className="trace-target" aria-label="U5-C trace target">
          <p className="eyebrow">U5-C handoff target</p>
          <p>
            Selected run <code>{traceTarget.runId}</code> has trace state <strong>{traceTarget.traceState}</strong>.
            Timeline rendering is intentionally deferred to U5-C.
          </p>
          <p><code>{traceTarget.traceArtifactPath}</code></p>
        </div>
      ) : null}
    </section>
  );
}

function RunsPage({ onTraceTarget }: { onTraceTarget: (target: TraceTarget) => void }) {
  const [loadState, setLoadState] = useState<RunIndexLoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    loadRunIndex().then((nextState) => {
      if (!cancelled) {
        setLoadState(nextState);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadState.status === "loading") {
    return <RunIndexMessage title="Loading generated run index" status="PARTIAL" />;
  }
  if (loadState.status === "missing_index") {
    return (
      <RunIndexMessage title="Generated run index is missing" status="MISSING">
        <p>{loadState.message}</p>
        <p>
          Build the local derived index with <code>npm run build:index</code>. This index is a gitignored
          browse accelerator, not canonical evidence truth.
        </p>
      </RunIndexMessage>
    );
  }
  if (loadState.status === "invalid_index") {
    return (
      <RunIndexMessage title="Generated run index is invalid" status="FAIL">
        <p>{loadState.message}</p>
        <p>Rebuild with <code>npm run build:index</code> after checking local artifact warnings.</p>
      </RunIndexMessage>
    );
  }

  return <RunBrowser index={loadState.index} onTraceTarget={onTraceTarget} />;
}

function RunIndexMessage({
  title,
  status,
  children,
}: {
  title: string;
  status: WorkbenchStatus;
  children?: ReactNode;
}) {
  return (
    <section className="panel panel-large placeholder" aria-labelledby="run-index-message-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">U5-B run browser</p>
          <h2 id="run-index-message-title">{title}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      {children}
    </section>
  );
}

function RunBrowser({ index, onTraceTarget }: { index: RunIndex; onTraceTarget: (target: TraceTarget) => void }) {
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(index.runs[0]?.run_id ?? null);

  const workflows = sortedKeys(index.summary.workflow_counts);
  const statuses = sortedKeys(index.summary.status_counts);
  const filteredRuns = index.runs.filter((run) => {
    const workflow = valueOrUnknown(run.workflow_id);
    const status = valueOrUnknown(run.status);
    return (workflowFilter === "all" || workflow === workflowFilter) && (statusFilter === "all" || status === statusFilter);
  });
  const selectedRun = filteredRuns.find((run) => run.run_id === selectedRunId) ?? filteredRuns[0] ?? null;

  return (
    <div className="runs-layout">
      <section className="panel panel-large" aria-labelledby="runs-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">U5-B generated index</p>
            <h2 id="runs-title">Run browser</h2>
          </div>
          <StatusBadge status={index.summary.warnings_count > 0 ? "PARTIAL" : "PASS"} />
        </div>
        <p>
          Derived index <code>{index.schema_version}</code> generated from <code>{index.data_dir}</code> at{" "}
          <code>{index.generated_at}</code>. Canonical artifacts remain the source of truth.
        </p>
        <div className="metric-grid" aria-label="Run index summary">
          <Metric label="Total runs" value={String(index.summary.total_runs)} />
          <Metric label="Displayed" value={String(filteredRuns.length)} />
          <Metric label="Warnings" value={String(index.summary.warnings_count)} />
          <Metric label="Trace ok" value={String(index.summary.trace_state_counts.ok ?? 0)} />
        </div>
        <div className="filters" aria-label="Run filters">
          <label>
            Workflow
            <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)}>
              <option value="all">All workflows</option>
              {workflows.map((workflow) => (
                <option key={workflow} value={workflow}>{workflow}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel run-list-panel" aria-labelledby="run-list-title">
        <h2 id="run-list-title">Runs</h2>
        {filteredRuns.length === 0 ? <p>No runs match the active filters.</p> : null}
        <div className="run-list" role="list" aria-label="Run rows">
          {filteredRuns.map((run) => (
            <button
              key={run.run_id}
              type="button"
              className={run.run_id === selectedRun?.run_id ? "run-row run-row-active" : "run-row"}
              onClick={() => setSelectedRunId(run.run_id)}
            >
              <span><strong>{run.run_id}</strong></span>
              <span>workflow: {valueOrUnknown(run.workflow_id)}</span>
              <span>status: {valueOrUnknown(run.status)}</span>
              <span>trace: {run.trace_state}</span>
              <span>artifacts: run {yesNo(run.has_run_artifact)} / trace {yesNo(run.has_trace_artifact)}</span>
            </button>
          ))}
        </div>
      </section>

      <RunDetail run={selectedRun} onTraceTarget={onTraceTarget} />
    </div>
  );
}

function RunDetail({ run, onTraceTarget }: { run: RunIndexRow | null; onTraceTarget: (target: TraceTarget) => void }) {
  if (run === null) {
    return (
      <section className="panel run-detail-panel" aria-labelledby="run-detail-title">
        <h2 id="run-detail-title">Run detail</h2>
        <p>No run selected.</p>
      </section>
    );
  }

  return (
    <section className="panel run-detail-panel" aria-labelledby="run-detail-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Run detail</p>
          <h2 id="run-detail-title">{run.run_id}</h2>
        </div>
        <StatusBadge status={run.row_state === "ok" ? "PASS" : "PARTIAL"} />
      </div>
      <dl className="detail-grid">
        <DetailTerm label="Workflow" value={valueOrUnknown(run.workflow_id)} />
        <DetailTerm label="Status" value={valueOrUnknown(run.status)} />
        <DetailTerm label="Started" value={valueOrUnknown(run.started_at)} />
        <DetailTerm label="Completed" value={valueOrUnknown(run.completed_at)} />
        <DetailTerm label="Row state" value={run.row_state} />
        <DetailTerm label="Trace state" value={run.trace_state} />
        <DetailTerm label="Trace events" value={run.trace_event_count === null ? "unknown" : String(run.trace_event_count)} />
        <DetailTerm label="Trace schemas" value={joinOrUnknown(run.trace_schema_versions)} />
        <DetailTerm label="Providers" value={joinOrUnknown(run.provider_names)} />
        <DetailTerm label="Models" value={joinOrUnknown(run.model_names)} />
        <DetailTerm label="Fallback" value={run.fallback_state} />
      </dl>
      <div className="artifact-paths" aria-label="Canonical artifact paths">
        <p><strong>Run artifact</strong> <code>{run.run_artifact_path}</code></p>
        <p><strong>Trace artifact</strong> <code>{run.trace_artifact_path}</code></p>
        <p><strong>Sidecar directory</strong> <code>{run.artifact_dir_path}</code></p>
      </div>
      <div>
        <p className="eyebrow">Sidecar files</p>
        <p>{joinOrUnknown(run.sidecar_files)}</p>
      </div>
      {run.warnings.length > 0 ? (
        <div className="warnings" aria-label="Run warnings">
          <p className="eyebrow">Row warnings</p>
          <ul>
            {run.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        className="trace-link"
        onClick={() => onTraceTarget({ runId: run.run_id, traceArtifactPath: run.trace_artifact_path, traceState: run.trace_state })}
      >
        Send trace target to U5-C placeholder
      </button>
      <p className="handoff-note">This handoff passes run id, trace path, and trace state only. Timeline rendering is U5-C scope.</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function sortedKeys(record: Record<string, number>) {
  return Object.keys(record).sort((left, right) => left.localeCompare(right));
}

function valueOrUnknown(value: string | null) {
  return value ?? "unknown";
}

function joinOrUnknown(values: string[]) {
  return values.length > 0 ? values.join(", ") : "unknown";
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function FixtureTable() {
  return (
    <section className="panel fixture-panel" aria-labelledby="fixture-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo fixtures</p>
          <h2 id="fixture-title">Future evidence rows</h2>
        </div>
        <StatusBadge status="FIXTURE" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Workflow</th>
              <th>Status</th>
              <th>Artifact path</th>
              <th>Disclosure</th>
            </tr>
          </thead>
          <tbody>
            {evidenceFixtures.map((fixture) => (
              <tr key={fixture.label}>
                <td>{fixture.label}</td>
                <td>{fixture.workflow}</td>
                <td><StatusBadge status={fixture.status} /></td>
                <td><code>{fixture.artifactPath}</code></td>
                <td>{fixture.disclosure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function App() {
  const [activePageId, setActivePageId] = useState<WorkbenchPageId>("overview");
  const [traceTarget, setTraceTarget] = useState<TraceTarget | null>(null);
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

  function handleTraceTarget(target: TraceTarget) {
    setTraceTarget(target);
    setActivePageId("trace");
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Fractal Agent Lab / Wave 5 U5-A</p>
          <h1>Local evidence observatory shell</h1>
          <p className="hero-copy">
            Workflow-intelligence and proof layer above operator-driven development,
            with canonical artifacts staying as the evidence source.
          </p>
        </div>
        <StatusBadge status="PARTIAL" />
      </header>

      <DisclosureBanner />

      <div className="workspace">
        <nav className="nav-panel" aria-label="Workbench pages">
          {pages.map((page) => (
            <button
              key={page.id}
              aria-label={page.label}
              className={page.id === activePageId ? "nav-item nav-item-active" : "nav-item"}
              type="button"
              onClick={() => setActivePageId(page.id)}
            >
              <span>{page.label}</span>
              <small>{page.summary}</small>
            </button>
          ))}
        </nav>

        <div className="content-stack">
          {activePage.id === "overview" ? <OverviewPage /> : null}
          {activePage.id === "runs" ? <RunsPage onTraceTarget={handleTraceTarget} /> : null}
          {activePage.id !== "overview" && activePage.id !== "runs" ? (
            <PlaceholderPage page={activePage} traceTarget={traceTarget} />
          ) : null}
          {activePage.id === "overview" ? <FixtureTable /> : null}
        </div>
      </div>
    </main>
  );
}
