import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { evidenceFixtures, pages } from "./fixtures";
import { buildLaunchCommand } from "./launchCommandBuilder";
import { buildLaunchPacket } from "./packetComposer";
import { loadRunIndex, type RunIndexLoadState } from "./runIndexLoader";
import type { RunIndex, RunIndexRow, TraceTarget } from "./runIndexModel";
import { loadTraceDetail, type TraceDetailLoadState } from "./traceDetailLoader";
import type { TraceDetail, TraceDetailEvent } from "./traceDetailModel";
import { loadWorkflowCatalog, type WorkflowCatalogLoadState } from "./workflowCatalogLoader";
import type { WorkflowCatalogEntry } from "./workflowCatalogModel";
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

const defaultLaunchInputJson = JSON.stringify({ idea: "Describe the workflow input here." }, null, 2);
const defaultRuntimeConfigPath = "configs/runtime.example.yaml";
const defaultProvidersConfigPath = "configs/providers.example.yaml";
const defaultModelPolicyConfigPath = "configs/model_policy.example.yaml";
const providerOptions = ["", "mock", "openai", "openrouter", "local"];
const targetRoleOptions = ["Track A", "Track B", "Track C", "Track D", "Track E", "Meta Coordinator"];

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
        <p className="eyebrow">Wave 5 scope disclosure</p>
        <h2 id="disclosure-title">Derived browse surfaces, not launch automation</h2>
      </div>
      <p>
        This workbench exposes derived run browsing, strict-valid trace timelines, and
        operator-mediated command/packet preparation. It does not execute browser-side
        launches, control OpenCode, commit changes, score outputs, or replace canonical truth in
        <code> data/runs/&lt;run_id&gt;.json</code>, <code>data/traces/&lt;run_id&gt;.jsonl</code>,
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

function useGeneratedRunIndex() {
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

  return loadState;
}

function useGeneratedWorkflowCatalog() {
  const [loadState, setLoadState] = useState<WorkflowCatalogLoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    loadWorkflowCatalog().then((nextState) => {
      if (!cancelled) {
        setLoadState(nextState);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return loadState;
}

function RunsPage({ onTraceTarget }: { onTraceTarget: (target: TraceTarget) => void }) {
  const loadState = useGeneratedRunIndex();

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

function TracePage({ traceTarget }: { traceTarget: TraceTarget | null }) {
  const runIndexState = useGeneratedRunIndex();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(traceTarget?.runId ?? null);
  const [detailState, setDetailState] = useState<TraceDetailLoadState>({ status: "idle" });
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [laneFilter, setLaneFilter] = useState("all");
  const [stepFilter, setStepFilter] = useState("all");
  const [failureOnly, setFailureOnly] = useState(false);

  useEffect(() => {
    if (traceTarget !== null) {
      setSelectedRunId(traceTarget.runId);
    }
  }, [traceTarget]);

  useEffect(() => {
    if (runIndexState.status !== "ready") {
      return;
    }
    if (selectedRunId !== null) {
      return;
    }
    const preferredRun = runIndexState.index.runs.find((run) => run.trace_state === "ok") ?? runIndexState.index.runs[0] ?? null;
    if (preferredRun !== null) {
      setSelectedRunId(preferredRun.run_id);
    }
  }, [runIndexState, selectedRunId]);

  const selectedRun = runIndexState.status === "ready"
    ? runIndexState.index.runs.find((run) => run.run_id === selectedRunId) ?? null
    : null;

  useEffect(() => {
    setEventTypeFilter("all");
    setLaneFilter("all");
    setStepFilter("all");
    setFailureOnly(false);
  }, [selectedRun?.run_id]);

  useEffect(() => {
    let cancelled = false;

    if (selectedRun === null) {
      setDetailState({ status: "idle" });
      return () => {
        cancelled = true;
      };
    }
    if (selectedRun.trace_state === "missing") {
      setDetailState({ status: "missing_trace_detail", message: "Trace artifact is missing for this run." });
      return () => {
        cancelled = true;
      };
    }
    if (selectedRun.trace_state === "invalid") {
      setDetailState({ status: "invalid_trace_detail", message: "Strict-invalid traces must not render a timeline." });
      return () => {
        cancelled = true;
      };
    }

    setDetailState({ status: "loading" });
    loadTraceDetail(selectedRun.run_id).then((nextState) => {
      if (!cancelled) {
        setDetailState(nextState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedRun]);

  if (runIndexState.status === "loading") {
    return <RunIndexMessage title="Loading generated trace index" status="PARTIAL" />;
  }
  if (runIndexState.status === "missing_index") {
    return (
      <RunIndexMessage title="Generated run index is missing" status="MISSING">
        <p>{runIndexState.message}</p>
        <p>Build the local run index first with <code>npm run build:index</code>.</p>
      </RunIndexMessage>
    );
  }
  if (runIndexState.status === "invalid_index") {
    return (
      <RunIndexMessage title="Generated run index is invalid" status="FAIL">
        <p>{runIndexState.message}</p>
        <p>The Trace page cannot safely resolve run targets until the generated index is valid.</p>
      </RunIndexMessage>
    );
  }

  return (
    <TraceWorkspace
      index={runIndexState.index}
      selectedRun={selectedRun}
      selectedRunId={selectedRunId}
      setSelectedRunId={setSelectedRunId}
      detailState={detailState}
      eventTypeFilter={eventTypeFilter}
      laneFilter={laneFilter}
      stepFilter={stepFilter}
      failureOnly={failureOnly}
      setEventTypeFilter={setEventTypeFilter}
      setLaneFilter={setLaneFilter}
      setStepFilter={setStepFilter}
      setFailureOnly={setFailureOnly}
    />
  );
}

function LaunchPage() {
  const catalogState = useGeneratedWorkflowCatalog();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [inputJson, setInputJson] = useState(defaultLaunchInputJson);
  const [outputFormat, setOutputFormat] = useState<"text" | "json">("json");
  const [showTrace, setShowTrace] = useState(true);
  const [runtimeConfigPath, setRuntimeConfigPath] = useState(defaultRuntimeConfigPath);
  const [providersConfigPath, setProvidersConfigPath] = useState(defaultProvidersConfigPath);
  const [modelPolicyConfigPath, setModelPolicyConfigPath] = useState(defaultModelPolicyConfigPath);
  const [providerOverride, setProviderOverride] = useState("");
  const [targetRole, setTargetRole] = useState("Track A");
  const [sourceArtifactRefs, setSourceArtifactRefs] = useState("");

  useEffect(() => {
    if (catalogState.status !== "ready") {
      return;
    }
    const workflowIds = catalogState.catalog.workflows.map((workflow) => workflow.workflow_id);
    if (!workflowIds.includes(selectedWorkflowId)) {
      setSelectedWorkflowId(workflowIds[0] ?? "");
    }
  }, [catalogState, selectedWorkflowId]);

  if (catalogState.status === "loading") {
    return <RunIndexMessage title="Loading generated workflow catalog" status="PARTIAL" />;
  }
  if (catalogState.status === "missing_catalog") {
    return (
      <RunIndexMessage title="Generated workflow catalog is missing" status="MISSING">
        <p>{catalogState.message}</p>
        <p>
          Build the local derived catalog with <code>npm run build:workflows</code>. This catalog is
          generated from the CLI workflow registry and is not runtime launch authority.
        </p>
      </RunIndexMessage>
    );
  }
  if (catalogState.status === "invalid_catalog") {
    return (
      <RunIndexMessage title="Generated workflow catalog is invalid" status="FAIL">
        <p>{catalogState.message}</p>
        <p>Rebuild with <code>npm run build:workflows</code> before preparing commands or packets.</p>
      </RunIndexMessage>
    );
  }

  const workflows = catalogState.catalog.workflows;
  const selectedWorkflow = workflows.find((workflow) => workflow.workflow_id === selectedWorkflowId) ?? workflows[0] ?? null;
  const commandResult = buildLaunchCommand({
    workflowId: selectedWorkflow?.workflow_id ?? selectedWorkflowId,
    knownWorkflowIds: workflows.map((workflow) => workflow.workflow_id),
    inputJson,
    outputFormat,
    showTrace,
    runtimeConfigPath,
    providersConfigPath,
    modelPolicyConfigPath,
    providerOverride,
  });
  const sourceRefs = sourceArtifactRefs
    .split("\n")
    .map((ref) => ref.trim())
    .filter(Boolean);
  const packetText = commandResult.ready && selectedWorkflow !== null
    ? buildLaunchPacket({
      targetRole,
      workflowId: selectedWorkflow.workflow_id,
      inputJson: commandResult.normalizedInputJson,
      commandPreview: commandResult.command,
      runtimeConfigPath: runtimeConfigPath.trim(),
      providersConfigPath: providersConfigPath.trim(),
      modelPolicyConfigPath: modelPolicyConfigPath.trim(),
      providerOverride: providerOverride.trim(),
      sourceArtifactRefs: sourceRefs,
    })
    : null;

  return (
    <div className="launch-layout">
      <section className="panel panel-large" aria-labelledby="launch-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">U5-D first pass</p>
            <h2 id="launch-title">Operator command and packet composer</h2>
          </div>
          <StatusBadge status="PARTIAL" />
        </div>
        <p>
          This page prepares an OpenCode/bash terminal command and a structured operator handoff packet.
          It does not run local Python from the browser, launch OpenCode, control a session bus, or perform commits.
        </p>
      </section>

      <section className="panel launch-config" aria-labelledby="command-config-title">
        <p className="eyebrow">Command preview inputs</p>
        <h2 id="command-config-title">Registry-derived workflow</h2>
        <div className="form-grid">
          <label>
            Workflow
            <select value={selectedWorkflow?.workflow_id ?? ""} onChange={(event) => setSelectedWorkflowId(event.target.value)}>
              {workflows.map((workflow) => (
                <option key={workflow.workflow_id} value={workflow.workflow_id}>{workflow.workflow_id}</option>
              ))}
            </select>
          </label>
          <label>
            Output format
            <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as "text" | "json")}>
              <option value="json">json</option>
              <option value="text">text</option>
            </select>
          </label>
          <label>
            Provider override
            <select value={providerOverride} onChange={(event) => setProviderOverride(event.target.value)}>
              {providerOptions.map((provider) => (
                <option key={provider || "none"} value={provider}>{provider || "none"}</option>
              ))}
            </select>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={showTrace} onChange={(event) => setShowTrace(event.target.checked)} />
            Include <code>--show-trace</code>
          </label>
        </div>
        {selectedWorkflow !== null ? <WorkflowSummary workflow={selectedWorkflow} /> : null}
      </section>

      <section className="panel launch-config" aria-labelledby="json-config-title">
        <p className="eyebrow">Input and config paths</p>
        <h2 id="json-config-title">Visible execution envelope</h2>
        <label className="stacked-field">
          Input JSON object
          <textarea value={inputJson} onChange={(event) => setInputJson(event.target.value)} rows={9} />
        </label>
        <div className="form-grid">
          <label>
            Runtime config
            <input value={runtimeConfigPath} onChange={(event) => setRuntimeConfigPath(event.target.value)} />
          </label>
          <label>
            Providers config
            <input value={providersConfigPath} onChange={(event) => setProvidersConfigPath(event.target.value)} />
          </label>
          <label>
            Model policy config
            <input value={modelPolicyConfigPath} onChange={(event) => setModelPolicyConfigPath(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel panel-large" aria-labelledby="command-preview-title">
        <p className="eyebrow">OpenCode/bash terminal command</p>
        <h2 id="command-preview-title">Exact command preview</h2>
        {commandResult.ready ? (
          <pre className="preview-block"><code>{commandResult.command}</code></pre>
        ) : (
          <div className="warnings" role="alert">
            <strong>Command is not ready.</strong>
            <ul>
              {commandResult.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="panel panel-large" aria-labelledby="packet-preview-title">
        <p className="eyebrow">Structured operator packet</p>
        <h2 id="packet-preview-title">Packet skeleton</h2>
        <div className="form-grid">
          <label>
            Target role/Track
            <select value={targetRole} onChange={(event) => setTargetRole(event.target.value)}>
              {targetRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="stacked-field">
            Optional source run/artifact refs
            <textarea value={sourceArtifactRefs} onChange={(event) => setSourceArtifactRefs(event.target.value)} rows={4} />
          </label>
        </div>
        {packetText !== null ? (
          <pre className="preview-block"><code>{packetText}</code></pre>
        ) : (
          <p>Fix command readiness before the packet skeleton can cite the exact command.</p>
        )}
      </section>
    </div>
  );
}

function WorkflowSummary({ workflow }: { workflow: WorkflowCatalogEntry }) {
  const metadata = workflow.metadata;
  return (
    <div className="trace-target" aria-label="Selected workflow metadata">
      <p className="eyebrow">Selected workflow metadata</p>
      <dl className="detail-grid">
        <div>
          <dt>Name</dt>
          <dd>{workflow.name}</dd>
        </div>
        <div>
          <dt>Execution mode</dt>
          <dd>{workflow.execution_mode}</dd>
        </div>
        <div>
          <dt>Input schema</dt>
          <dd>{workflow.input_schema_ref ?? "none"}</dd>
        </div>
        <div>
          <dt>Schema contract</dt>
          <dd>{metadata.schema_contract ?? "none"}</dd>
        </div>
      </dl>
      <p>{workflow.step_count} registry-derived steps are visible for operator context, not editable launch semantics.</p>
    </div>
  );
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

function TraceWorkspace({
  index,
  selectedRun,
  selectedRunId,
  setSelectedRunId,
  detailState,
  eventTypeFilter,
  laneFilter,
  stepFilter,
  failureOnly,
  setEventTypeFilter,
  setLaneFilter,
  setStepFilter,
  setFailureOnly,
}: {
  index: RunIndex;
  selectedRun: RunIndexRow | null;
  selectedRunId: string | null;
  setSelectedRunId: (runId: string) => void;
  detailState: TraceDetailLoadState;
  eventTypeFilter: string;
  laneFilter: string;
  stepFilter: string;
  failureOnly: boolean;
  setEventTypeFilter: (value: string) => void;
  setLaneFilter: (value: string) => void;
  setStepFilter: (value: string) => void;
  setFailureOnly: (value: boolean) => void;
}) {
  const runs = index.runs;
  const detail = detailState.status === "ready" && detailState.detail.run_id === selectedRun?.run_id
    ? detailState.detail
    : null;
  const filteredEvents = detail === null
    ? []
    : detail.events.filter((event) => {
      const matchesEventType = eventTypeFilter === "all" || event.event_type === eventTypeFilter;
      const matchesLane = laneFilter === "all" || valueOrUnknown(event.lane) === laneFilter;
      const matchesStep = stepFilter === "all" || valueOrUnknown(event.step_id) === stepFilter;
      const matchesFailure = !failureOnly || event.is_failure;
      return matchesEventType && matchesLane && matchesStep && matchesFailure;
    });

  const eventTypes = detail === null ? [] : sortedKeys(countValues(detail.events.map((event) => event.event_type)));
  const lanes = detail === null ? [] : sortedKeys(countValues(detail.events.map((event) => valueOrUnknown(event.lane))));
  const steps = detail === null ? [] : sortedKeys(countValues(detail.events.map((event) => valueOrUnknown(event.step_id))));

  return (
    <div className="trace-layout">
      <section className="panel trace-sidebar" aria-labelledby="trace-sidebar-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">U5-C trace targets</p>
            <h2 id="trace-sidebar-title">Trace runs</h2>
          </div>
          <StatusBadge status="PARTIAL" />
        </div>
        <div className="run-list" role="list" aria-label="Trace run targets">
          {runs.map((run) => (
            <button
              key={run.run_id}
              type="button"
              className={run.run_id === selectedRunId ? "run-row run-row-active" : "run-row"}
              onClick={() => setSelectedRunId(run.run_id)}
            >
              <span><strong>{run.run_id}</strong></span>
              <span>workflow: {valueOrUnknown(run.workflow_id)}</span>
              <span>trace: {run.trace_state}</span>
              <span>row state: {run.row_state}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel-large trace-main" aria-labelledby="trace-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">U5-C trace timeline</p>
            <h2 id="trace-title">Trace viewer</h2>
          </div>
          <StatusBadge status={traceStatusFor(selectedRun, detailState)} />
        </div>
        {selectedRun === null ? <p>Select a run to inspect its trace timeline.</p> : null}
        {selectedRun !== null ? (
          <>
            <div className="artifact-paths" aria-label="Trace artifact references">
              <p><strong>Run</strong> <code>{selectedRun.run_id}</code></p>
              <p><strong>Workflow</strong> {valueOrUnknown(selectedRun.workflow_id)}</p>
              <p><strong>Status</strong> {valueOrUnknown(selectedRun.status)}</p>
              <p><strong>Trace artifact</strong> <code>{selectedRun.trace_artifact_path}</code></p>
              <p><strong>Run artifact</strong> <code>{selectedRun.run_artifact_path}</code></p>
            </div>
            {selectedRun.trace_state === "missing" ? (
              <TraceMessage title="Trace artifact missing" status="MISSING">
                <p>No canonical trace file exists for this run. U5-C does not render a fake timeline.</p>
              </TraceMessage>
            ) : null}
            {selectedRun.trace_state === "invalid" ? (
              <TraceMessage title="Trace artifact invalid" status="FAIL">
                <p>Strict-invalid traces must not render timeline events.</p>
                <WarningList warnings={selectedRun.warnings} />
              </TraceMessage>
            ) : null}
            {detailState.status === "loading" ? <TraceMessage title="Loading trace detail" status="PARTIAL" /> : null}
            {detailState.status === "missing_trace_detail" && selectedRun.trace_state === "ok" ? (
              <TraceMessage title="Generated trace detail missing" status="MISSING">
                <p>{detailState.message}</p>
                <p>Build local trace detail files with <code>npm run build:traces</code>.</p>
              </TraceMessage>
            ) : null}
            {detailState.status === "invalid_trace_detail" && selectedRun.trace_state === "ok" ? (
              <TraceMessage title="Generated trace detail invalid" status="FAIL">
                <p>{detailState.message}</p>
                <p>Timeline events are not rendered from invalid generated trace detail files.</p>
              </TraceMessage>
            ) : null}
            {detail !== null ? (
              <TraceTimeline
                detail={detail}
                filteredEvents={filteredEvents}
                eventTypeFilter={eventTypeFilter}
                laneFilter={laneFilter}
                stepFilter={stepFilter}
                failureOnly={failureOnly}
                eventTypes={eventTypes}
                lanes={lanes}
                steps={steps}
                setEventTypeFilter={setEventTypeFilter}
                setLaneFilter={setLaneFilter}
                setStepFilter={setStepFilter}
                setFailureOnly={setFailureOnly}
              />
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

function TraceTimeline({
  detail,
  filteredEvents,
  eventTypeFilter,
  laneFilter,
  stepFilter,
  failureOnly,
  eventTypes,
  lanes,
  steps,
  setEventTypeFilter,
  setLaneFilter,
  setStepFilter,
  setFailureOnly,
}: {
  detail: TraceDetail;
  filteredEvents: TraceDetailEvent[];
  eventTypeFilter: string;
  laneFilter: string;
  stepFilter: string;
  failureOnly: boolean;
  eventTypes: string[];
  lanes: string[];
  steps: string[];
  setEventTypeFilter: (value: string) => void;
  setLaneFilter: (value: string) => void;
  setStepFilter: (value: string) => void;
  setFailureOnly: (value: boolean) => void;
}) {
  return (
    <>
      <div className="metric-grid" aria-label="Trace summary">
        <Metric label="Total events" value={String(detail.summary.total_events)} />
        <Metric label="Displayed" value={String(filteredEvents.length)} />
        <Metric label="Warnings" value={String(detail.validation.warnings.length)} />
        <Metric label="Linked events" value={String(detail.summary.linked_events.with_parent_event_id)} />
      </div>
      {detail.validation.warnings.length > 0 ? <WarningList warnings={detail.validation.warnings} /> : null}
      <div className="filters" aria-label="Trace filters">
        <label>
          Event type
          <select value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)}>
            <option value="all">All event types</option>
            {eventTypes.map((eventType) => <option key={eventType} value={eventType}>{eventType}</option>)}
          </select>
        </label>
        <label>
          Lane
          <select value={laneFilter} onChange={(event) => setLaneFilter(event.target.value)}>
            <option value="all">All lanes</option>
            {lanes.map((lane) => <option key={lane} value={lane}>{lane}</option>)}
          </select>
        </label>
        <label>
          Step
          <select value={stepFilter} onChange={(event) => setStepFilter(event.target.value)}>
            <option value="all">All steps</option>
            {steps.map((step) => <option key={step} value={step}>{step}</option>)}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={failureOnly} onChange={(event) => setFailureOnly(event.target.checked)} />
          Failure events only
        </label>
      </div>
      <ol className="event-list" aria-label="Trace events">
        {filteredEvents.map((event) => (
          <li key={`${detail.run_id}-${event.sequence}`} className={event.is_failure ? "event-card event-card-failure" : "event-card"}>
            <div className="event-header">
              <strong>#{event.sequence} {event.event_type}</strong>
              <span>{valueOrUnknown(event.timestamp)}</span>
            </div>
            <p className="event-source">source: {valueOrUnknown(event.source)}</p>
            <div className="event-meta">
              <span>step: {valueOrUnknown(event.step_id)}</span>
              <span>lane: {valueOrUnknown(event.lane)}</span>
              <span>turn: {numberOrUnknown(event.turn_index)}</span>
              <span>handoff: {numberOrUnknown(event.handoff_index)}</span>
              <span>parent: {valueOrUnknown(event.parent_event_id)}</span>
              <span>corr: {valueOrUnknown(event.correlation_id)}</span>
            </div>
            <p>{event.payload_summary}</p>
            <details className="payload-details">
              <summary>Raw payload</summary>
              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ol>
    </>
  );
}

function TraceMessage({ title, status, children }: { title: string; status: WorkbenchStatus; children?: ReactNode }) {
  return (
    <section className="trace-message" aria-label={title}>
      <div className="section-heading">
        <h3>{title}</h3>
        <StatusBadge status={status} />
      </div>
      {children}
    </section>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <div className="warnings" aria-label="Trace warnings">
      <p className="eyebrow">Validation warnings</p>
      <ul>
        {warnings.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
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
        Open trace timeline
      </button>
      <p className="handoff-note">This action passes run id, trace path, and trace state into the Trace page.</p>
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

function numberOrUnknown(value: number | null) {
  return value === null ? "unknown" : String(value);
}

function countValues(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function traceStatusFor(selectedRun: RunIndexRow | null, detailState: TraceDetailLoadState): WorkbenchStatus {
  if (selectedRun === null) {
    return "PARTIAL";
  }
  if (selectedRun.trace_state === "missing") {
    return "MISSING";
  }
  if (selectedRun.trace_state === "invalid") {
    return "FAIL";
  }
  if (detailState.status === "ready") {
    return detailState.detail.validation.warnings.length > 0 ? "PARTIAL" : "PASS";
  }
  if (detailState.status === "loading") {
    return "PARTIAL";
  }
  if (detailState.status === "missing_trace_detail") {
    return "MISSING";
  }
  if (detailState.status === "invalid_trace_detail") {
    return "FAIL";
  }
  return "PARTIAL";
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
          <p className="eyebrow">Fractal Agent Lab / Wave 5 Workbench</p>
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
          {activePage.id === "trace" ? <TracePage traceTarget={traceTarget} /> : null}
          {activePage.id === "packets" ? <LaunchPage /> : null}
          {activePage.id !== "overview" && activePage.id !== "runs" && activePage.id !== "trace" && activePage.id !== "packets" ? (
            <PlaceholderPage page={activePage} traceTarget={traceTarget} />
          ) : null}
          {activePage.id === "overview" ? <FixtureTable /> : null}
        </div>
      </div>
    </main>
  );
}
