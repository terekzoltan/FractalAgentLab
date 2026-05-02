import { useState } from "react";

import { evidenceFixtures, pages } from "./fixtures";
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

function PlaceholderPage({ page }: { page: WorkbenchPage }) {
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
    </section>
  );
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
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

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
          {activePage.id === "overview" ? <OverviewPage /> : <PlaceholderPage page={activePage} />}
          <FixtureTable />
        </div>
      </div>
    </main>
  );
}
