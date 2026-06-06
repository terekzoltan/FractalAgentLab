import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { loadComparisonIndex, type ComparisonIndexLoadState } from "./comparisonIndexLoader";
import type { ComparisonIndex, ComparisonRunCandidate, KnownEvidencePair, SuggestedComparisonPair } from "./comparisonIndexModel";
import { evidenceFixtures, pages } from "./fixtures";
import { buildLaunchCommand } from "./launchCommandBuilder";
import { loadMemoryEvalIndex, type MemoryEvalIndexLoadState } from "./memoryEvalIndexLoader";
import type { EvalSummaryRow, MemoryArtifactRow, MemoryEvalIndex, MemoryProjectRow } from "./memoryEvalIndexModel";
import { buildLaunchPacket } from "./packetComposer";
import { loadRunIndex, type RunIndexLoadState } from "./runIndexLoader";
import type { RunIndex, RunIndexRow, TraceTarget } from "./runIndexModel";
import { loadTraceDetail, type TraceDetailLoadState } from "./traceDetailLoader";
import type { OpenCodeLoopDetail, TraceDetail, TraceDetailEvent } from "./traceDetailModel";
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
        launches, control OpenCode, commit changes, produce eval ratings, or replace canonical truth in
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

function useGeneratedMemoryEvalIndex() {
  const [loadState, setLoadState] = useState<MemoryEvalIndexLoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    loadMemoryEvalIndex().then((nextState) => {
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

function useGeneratedComparisonIndex() {
  const [loadState, setLoadState] = useState<ComparisonIndexLoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    loadComparisonIndex().then((nextState) => {
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

function EvidencePage() {
  const indexState = useGeneratedComparisonIndex();

  if (indexState.status === "loading") {
    return <ComparisonIndexMessage title="Loading generated comparison index" status="PARTIAL" />;
  }
  if (indexState.status === "missing_index") {
    return (
      <ComparisonIndexMessage title="Generated comparison index is missing" status="MISSING">
        <p>{indexState.message}</p>
        <p>
          Build the local derived index with <code>npm run build:comparisons</code>. This index is a
          bounded display surface over Track E-defined comparison facts, not canonical eval truth.
        </p>
      </ComparisonIndexMessage>
    );
  }
  if (indexState.status === "invalid_index") {
    return (
      <ComparisonIndexMessage title="Generated comparison index is invalid" status="FAIL">
        <p>{indexState.message}</p>
        <p>Rebuild with <code>npm run build:comparisons</code> after checking local artifact warnings.</p>
      </ComparisonIndexMessage>
    );
  }

  return <ComparisonWorkspace index={indexState.index} />;
}

function ComparisonWorkspace({ index }: { index: ComparisonIndex }) {
  const firstPair = index.suggested_pairs[0] ?? null;
  const firstCandidate = index.run_candidates[0] ?? null;
  const [selectedPairId, setSelectedPairId] = useState(firstPair?.pair_id ?? "manual");
  const [leftRunId, setLeftRunId] = useState(firstPair?.left_run_id ?? firstCandidate?.run_id ?? "");
  const [rightRunId, setRightRunId] = useState(firstPair?.right_run_id ?? index.run_candidates[1]?.run_id ?? firstCandidate?.run_id ?? "");

  useEffect(() => {
    if (selectedPairId === "manual") {
      return;
    }
    const pair = index.suggested_pairs.find((candidatePair) => candidatePair.pair_id === selectedPairId);
    if (pair !== undefined) {
      setLeftRunId(pair.left_run_id);
      setRightRunId(pair.right_run_id);
    }
  }, [index.suggested_pairs, selectedPairId]);

  const left = index.run_candidates.find((candidate) => candidate.run_id === leftRunId) ?? null;
  const right = index.run_candidates.find((candidate) => candidate.run_id === rightRunId) ?? null;
  const selectedPair = index.suggested_pairs.find((pair) => (
    (pair.left_run_id === leftRunId && pair.right_run_id === rightRunId)
    || (pair.left_run_id === rightRunId && pair.right_run_id === leftRunId)
  )) ?? null;
  const hasLocalComparisonEvidence = index.run_candidates.length > 0 || index.suggested_pairs.length > 0;

  return (
    <div className="comparison-layout">
      <section className="panel panel-large" aria-labelledby="comparison-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">U5-E structural display</p>
            <h2 id="comparison-title">Run comparison evidence</h2>
          </div>
          <StatusBadge status="PARTIAL" />
        </div>
        <p>
          Derived index <code>{index.schema_version}</code> generated from <code>{index.data_dir}</code> at{" "}
          <code>{index.generated_at}</code>. U5-E shows Track E-defined structural preflight facts and
          source-reported evidence states only; it does not produce ratings, rankings, or provider/model quality claims.
        </p>
        <div className="metric-grid" aria-label="Comparison index summary">
          <Metric label="Run candidates" value={String(index.summary.run_candidate_count)} />
          <Metric label="Suggested pairs" value={String(index.summary.suggested_pair_count)} />
          <Metric label="Known evidence" value={String(index.summary.known_evidence_pair_count)} />
          <Metric label="Warnings" value={String(index.summary.warnings_count)} />
        </div>
        {!hasLocalComparisonEvidence ? (
          <div className="trace-message" aria-label="No local comparison evidence">
            <h3>Not demonstrated in the generated local index</h3>
            <p>No local run candidates or bounded suggested comparison pairs were found.</p>
          </div>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="pair-selection-title">
        <p className="eyebrow">Bounded pair selection</p>
        <h2 id="pair-selection-title">Select display pair</h2>
        <div className="form-grid">
          <label>
            Suggested pair
            <select value={selectedPairId} onChange={(event) => setSelectedPairId(event.target.value)}>
              <option value="manual">Manual run ids</option>
              {index.suggested_pairs.map((pair) => (
                <option key={pair.pair_id} value={pair.pair_id}>{pair.left_run_id} vs {pair.right_run_id}</option>
              ))}
            </select>
          </label>
          <label>
            Run A
            <select value={leftRunId} onChange={(event) => { setSelectedPairId("manual"); setLeftRunId(event.target.value); }}>
              {index.run_candidates.map((candidate) => (
                <option key={candidate.run_id} value={candidate.run_id}>{candidate.run_id}</option>
              ))}
            </select>
          </label>
          <label>
            Run B
            <select value={rightRunId} onChange={(event) => { setSelectedPairId("manual"); setRightRunId(event.target.value); }}>
              {index.run_candidates.map((candidate) => (
                <option key={candidate.run_id} value={candidate.run_id}>{candidate.run_id}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="handoff-note">
          Suggested pairs are deterministically capped by the generator. Manual selections outside the bounded list do not get a new Track A verdict.
        </p>
      </section>

      <ComparisonStatusPanel pair={selectedPair} left={left} right={right} />
      <RunCandidatePanel title="Run A facts" candidate={left} />
      <RunCandidatePanel title="Run B facts" candidate={right} />
      <ComparableFieldsTable left={left} right={right} />
      <ProviderDisclosurePanel left={left} right={right} />
      <KnownEvidencePairs pairs={index.known_evidence_pairs} />
      <UnsupportedTargets targets={index.unsupported_targets} />
      {index.warnings.length > 0 ? <ComparisonWarningList warnings={index.warnings} /> : null}
    </div>
  );
}

function ComparisonStatusPanel({ pair, left, right }: { pair: SuggestedComparisonPair | null; left: ComparisonRunCandidate | null; right: ComparisonRunCandidate | null }) {
  const status = pair?.structural_preflight_status ?? "BLOCKED";
  const reasons = pair?.status_reasons ?? [left === null || right === null ? "selected_run_missing" : "selected_pair_not_in_bounded_generated_suggestions"];
  return (
    <section className="panel" aria-labelledby="comparison-status-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Display-only structural preflight</p>
          <h2 id="comparison-status-title">Selected pair state</h2>
        </div>
        <StructuralStatusChip status={status} />
      </div>
      <p>
        Status labels normalize Track E-defined preflight facts for display. They are not ratings and are not output-quality judgments.
      </p>
      <dl className="detail-grid">
        <DetailTerm label="Run A" value={left?.run_id ?? "unknown"} />
        <DetailTerm label="Run B" value={right?.run_id ?? "unknown"} />
        <DetailTerm label="Target class" value={pair?.target_class ?? "not generated"} />
        <DetailTerm label="Matched input" value={pair?.matched_input === null || pair === null ? "unknown" : yesNo(pair.matched_input)} />
      </dl>
      {reasons.length > 0 ? <ReasonList reasons={reasons} /> : <p>No blocking structural preflight reasons were generated.</p>}
    </section>
  );
}

function RunCandidatePanel({ title, candidate }: { title: string; candidate: ComparisonRunCandidate | null }) {
  return (
    <section className="panel" aria-labelledby={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>
      <p className="eyebrow">Canonical/source links</p>
      <h2 id={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>{title}</h2>
      {candidate === null ? <p>No run selected.</p> : null}
      {candidate !== null ? (
        <>
          <dl className="detail-grid">
            <DetailTerm label="Run" value={candidate.run_id} />
            <DetailTerm label="Workflow" value={valueOrUnknown(candidate.workflow_id)} />
            <DetailTerm label="Support" value={candidate.comparison_support} />
            <DetailTerm label="Trace" value={candidate.preflight.trace_state} />
            <DetailTerm label="Input keys" value={joinOrUnknown(candidate.input.keys)} />
            <DetailTerm label="Comparable complete" value={yesNo(candidate.comparable_output.complete)} />
          </dl>
          <div className="artifact-paths">
            <p><strong>Run artifact</strong> <code>{candidate.run_artifact_path}</code></p>
            <p><strong>Trace artifact</strong> <code>{candidate.trace_artifact_path}</code></p>
            <p><strong>Sidecar directory</strong> <code>{candidate.artifact_dir_path}</code></p>
          </div>
          {candidate.target_class === "h2_structural" ? <H2GateFacts gates={candidate.h2_gates} /> : null}
          {candidate.comparable_output.missing_keys.length > 0 ? <ReasonList reasons={candidate.comparable_output.missing_keys.map((key) => `missing comparable key: ${key}`)} /> : null}
        </>
      ) : null}
    </section>
  );
}

function H2GateFacts({ gates }: { gates: ComparisonRunCandidate["h2_gates"] }) {
  return (
    <div className="trace-message" aria-label="H2 gate facts">
      <p className="eyebrow">H2 gate facts</p>
      <dl className="detail-grid">
        <DetailTerm label="Key order" value={booleanFact(gates.key_order_matches)} />
        <DetailTerm label="Implementation waves valid" value={booleanFact(gates.implementation_waves_valid)} />
        <DetailTerm label="Recommended starting slice present" value={booleanFact(gates.recommended_starting_slice_present)} />
        <DetailTerm label="Delegate order" value={booleanFact(gates.delegate_order_matches)} />
        <DetailTerm label="Delegate targets" value={joinOrUnknown(gates.delegate_targets)} />
      </dl>
    </div>
  );
}

function ComparableFieldsTable({ left, right }: { left: ComparisonRunCandidate | null; right: ComparisonRunCandidate | null }) {
  const fields = left?.comparable_output.fields.length ? left.comparable_output.fields : right?.comparable_output.fields ?? [];
  return (
    <section className="panel panel-large" aria-labelledby="comparable-fields-title">
      <p className="eyebrow">Comparable key display</p>
      <h2 id="comparable-fields-title">Structural field presence</h2>
      <p>Previews are bounded and fingerprinted for local inspection; this is not a quality review pane.</p>
      {fields.length === 0 ? <p>No accepted comparable key set applies to the selected runs.</p> : null}
      {fields.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Run A</th>
                <th>Run B</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.key}>
                  <td>{field.key}</td>
                  <td>{fieldSummary(left, field.key)}</td>
                  <td>{fieldSummary(right, field.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ProviderDisclosurePanel({ left, right }: { left: ComparisonRunCandidate | null; right: ComparisonRunCandidate | null }) {
  return (
    <section className="panel panel-large" aria-labelledby="provider-disclosure-title">
      <p className="eyebrow">Provider/model/fallback disclosure</p>
      <h2 id="provider-disclosure-title">Disclosure-only routing facts</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Providers</th>
              <th>Models</th>
              <th>Fallback</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {[left, right].map((candidate, index) => (
              <tr key={candidate?.run_id ?? `missing-${index}`}>
                <td>{candidate?.run_id ?? "unknown"}</td>
                <td>{joinOrUnknown(candidate?.provider_disclosure.provider_names ?? [])}</td>
                <td>{joinOrUnknown(candidate?.provider_disclosure.model_names ?? [])}</td>
                <td>{candidate?.provider_disclosure.fallback_state ?? "unknown"}</td>
                <td>{candidate?.provider_disclosure.provider_attempt_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="handoff-note">Provider/model differences are disclosure facts only. U5-E does not rank or rate providers or models.</p>
    </section>
  );
}

function KnownEvidencePairs({ pairs }: { pairs: KnownEvidencePair[] }) {
  return (
    <section className="panel" aria-labelledby="known-evidence-title">
      <p className="eyebrow">Source-reported evidence</p>
      <h2 id="known-evidence-title">Known evidence pairs</h2>
      {pairs.map((pair) => (
        <div className="trace-message" key={pair.pair_id}>
          <div className="section-heading">
            <h3>{pair.pair_id}</h3>
            <StructuralStatusChip status={pair.local_preflight_status} />
          </div>
          <p>Source-reported status: <strong>{pair.source_reported_status}</strong></p>
          <p>Local state: {pair.local_state}</p>
          <p><code>{pair.source_report_path}</code></p>
          <ReasonList reasons={pair.status_reasons} />
        </div>
      ))}
    </section>
  );
}

function UnsupportedTargets({ targets }: { targets: ComparisonIndex["unsupported_targets"] }) {
  return (
    <section className="panel" aria-labelledby="unsupported-targets-title">
      <p className="eyebrow">Unsupported / deferred</p>
      <h2 id="unsupported-targets-title">Non-comparison targets</h2>
      {targets.length === 0 ? <p>No unsupported or deferred run targets were present in the generated index.</p> : null}
      <div className="artifact-paths">
        {targets.map((target) => (
          <p key={`${target.run_id}-${target.target_class}`}>
            <strong>{target.run_id}</strong> ({valueOrUnknown(target.workflow_id)})<br />
            <span>{target.evidence_label}{target.future_state ? ` / ${target.future_state}` : ""}: {target.note}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function ComparisonWarningList({ warnings }: { warnings: string[] }) {
  return (
    <section className="panel panel-large warnings" aria-label="Comparison index warnings">
      <p className="eyebrow">Generated index warnings</p>
      <ul>
        {warnings.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
    </section>
  );
}

function ComparisonIndexMessage({ title, status, children }: { title: string; status: WorkbenchStatus; children?: ReactNode }) {
  return (
    <section className="panel panel-large placeholder" aria-labelledby="comparison-index-message-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">U5-E run comparison UX</p>
          <h2 id="comparison-index-message-title">{title}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      {children}
    </section>
  );
}

function StructuralStatusChip({ status }: { status: string }) {
  return <span className={`source-label structural-${status.toLowerCase()}`}>{status}</span>;
}

function ReasonList({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return null;
  }
  return (
    <div className="warnings" aria-label="Structural preflight reasons">
      <p className="eyebrow">Preflight reasons</p>
      <ul>
        {reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </div>
  );
}

function MemoryEvalPage() {
  const indexState = useGeneratedMemoryEvalIndex();

  if (indexState.status === "loading") {
    return <MemoryEvalMessage title="Loading generated memory/eval index" status="PARTIAL" />;
  }
  if (indexState.status === "missing_index") {
    return (
      <MemoryEvalMessage title="Generated memory/eval index is missing" status="MISSING">
        <p>{indexState.message}</p>
        <p>
          Build the local derived index with <code>npm run build:memory-eval</code>. This index is a
          gitignored inventory over available local evidence, not memory or eval authority.
        </p>
      </MemoryEvalMessage>
    );
  }
  if (indexState.status === "invalid_index") {
    return (
      <MemoryEvalMessage title="Generated memory/eval index is invalid" status="FAIL">
        <p>{indexState.message}</p>
        <p>Rebuild with <code>npm run build:memory-eval</code> after checking local artifact warnings.</p>
      </MemoryEvalMessage>
    );
  }

  return <MemoryEvalWorkspace index={indexState.index} />;
}

function MemoryEvalWorkspace({ index }: { index: MemoryEvalIndex }) {
  const hasAnyLocalEvidence =
    index.memory_projects.length > 0 || index.memory_artifacts.length > 0 || index.eval_summaries.length > 0;

  return (
    <div className="memory-layout">
      <section className="panel panel-large" aria-labelledby="memory-eval-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">U5-F read-only inventory</p>
            <h2 id="memory-eval-title">Memory / Eval inspection</h2>
          </div>
          <StatusBadge status="PARTIAL" />
        </div>
        <p>
          Derived index <code>{index.schema_version}</code> generated from <code>{index.data_dir}</code> at{" "}
          <code>{index.generated_at}</code>. U5-F displays available local evidence only; it does not edit
          memory, create eval ratings, compare run pairs, or open a Wave 6 evidence ledger.
        </p>
        <div className="metric-grid" aria-label="Memory and eval inventory summary">
          <Metric label="Project memory" value={index.summary.project_memory_store_state.replace(/_/g, " ")} />
          <Metric label="Projects" value={String(index.summary.memory_project_count)} />
          <Metric label="Memory sidecars" value={String(index.summary.memory_artifact_count)} />
          <Metric label="Eval summaries" value={String(index.summary.eval_summary_count)} />
        </div>
        {!hasAnyLocalEvidence ? (
          <div className="trace-message" aria-label="No local memory or eval evidence">
            <h3>Not demonstrated in the generated local index</h3>
            <p>No local project memory store, memory sidecars, or allowlisted eval summary reports were found.</p>
          </div>
        ) : null}
      </section>

      <MemoryProjectsTable projects={index.memory_projects} />
      <MemoryArtifactsTable artifacts={index.memory_artifacts} />
      <EvalSummariesTable summaries={index.eval_summaries} />
      <CuratedReferences references={index.curated_references} />
      {index.warnings.length > 0 ? <MemoryWarningList warnings={index.warnings} /> : null}
    </div>
  );
}

function MemoryProjectsTable({ projects }: { projects: MemoryProjectRow[] }) {
  return (
    <section className="panel" aria-labelledby="memory-projects-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Stored project memory</p>
          <h2 id="memory-projects-title">Project memory store</h2>
        </div>
        <span className="source-label">available local evidence</span>
      </div>
      {projects.length === 0 ? <p>No local project memory store found.</p> : null}
      {projects.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Stored counts</th>
                <th>Updated</th>
                <th>Source path</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.source_path}>
                  <td>{project.project_id}</td>
                  <td>
                    stable decisions: {project.stable_decision_count}<br />
                    workflow learnings: {project.workflow_learning_count}<br />
                    prompt observations: {project.prompt_observation_count}
                  </td>
                  <td>{valueOrUnknown(project.updated_at)}</td>
                  <td><code>{project.source_path}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function MemoryArtifactsTable({ artifacts }: { artifacts: MemoryArtifactRow[] }) {
  return (
    <section className="panel" aria-labelledby="memory-artifacts-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Candidate/update sidecars</p>
          <h2 id="memory-artifacts-title">Memory sidecars</h2>
        </div>
        <span className="source-label">read-only inventory</span>
      </div>
      {artifacts.length === 0 ? <p>No memory candidate or project memory update sidecars found.</p> : null}
      {artifacts.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Kind</th>
                <th>Workflow</th>
                <th>Scope ref</th>
                <th>Items</th>
                <th>Source path</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((artifact) => (
                <tr key={`${artifact.run_id}-${artifact.artifact_kind}-${artifact.source_path}`}>
                  <td>{artifact.run_id}</td>
                  <td>{artifact.artifact_kind.replace(/_/g, " ")}</td>
                  <td>{valueOrUnknown(artifact.workflow_id)}</td>
                  <td>{artifact.project_id ?? artifact.session_id ?? "unknown"}</td>
                  <td>{artifact.item_count}</td>
                  <td><code>{artifact.source_path}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function EvalSummariesTable({ summaries }: { summaries: EvalSummaryRow[] }) {
  return (
    <section className="panel panel-large" aria-labelledby="eval-summaries-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Eval summaries</p>
          <h2 id="eval-summaries-title">Source-reported eval artifacts</h2>
        </div>
        <span className="source-label">source-reported outcome</span>
      </div>
      {summaries.length === 0 ? <p>No allowlisted eval summary reports found in local sidecars.</p> : null}
      {summaries.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Report</th>
                <th>Source-reported outcome</th>
                <th>Summary fields</th>
                <th>Source path</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr key={summary.source_path}>
                  <td>
                    {summary.label}<br />
                    <code>{summary.report_version}</code>
                  </td>
                  <td>{summary.source_reported_outcome ?? "not reported"}</td>
                  <td>{formatSummaryFields(summary.source_reported_summary)}</td>
                  <td><code>{summary.source_path}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function CuratedReferences({ references }: { references: MemoryEvalIndex["curated_references"] }) {
  return (
    <section className="panel" aria-labelledby="curated-references-title">
      <p className="eyebrow">Historical curated reference</p>
      <h2 id="curated-references-title">Source references</h2>
      <div className="artifact-paths">
        {references.map((reference) => (
          <p key={reference.source_path}>
            <strong>{reference.label}</strong><br />
            <span>{reference.evidence_label}: {reference.note}</span><br />
            <code>{reference.source_path}</code>
          </p>
        ))}
      </div>
    </section>
  );
}

function MemoryWarningList({ warnings }: { warnings: string[] }) {
  return (
    <section className="panel panel-large warnings" aria-label="Memory and eval index warnings">
      <p className="eyebrow">Generated index warnings</p>
      <ul>
        {warnings.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
    </section>
  );
}

function MemoryEvalMessage({ title, status, children }: { title: string; status: WorkbenchStatus; children?: ReactNode }) {
  return (
    <section className="panel panel-large placeholder" aria-labelledby="memory-eval-message-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">U5-F memory/eval inspection</p>
          <h2 id="memory-eval-message-title">{title}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      {children}
    </section>
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
  const [originFilter, setOriginFilter] = useState("all");
  const [targetProjectFilter, setTargetProjectFilter] = useState("all");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(index.runs[0]?.run_id ?? null);

  const workflows = sortedKeys(index.summary.workflow_counts);
  const statuses = sortedKeys(index.summary.status_counts);
  const origins = sortedKeys(index.summary.run_origin_counts);
  const targetProjects = sortedKeys(index.summary.target_project_counts);
  const filteredRuns = index.runs.filter((run) => {
    const workflow = valueOrUnknown(run.workflow_id);
    const status = valueOrUnknown(run.status);
    const targetProject = valueOrUnknown(run.target_project_id);
    return (
      (workflowFilter === "all" || workflow === workflowFilter) &&
      (statusFilter === "all" || status === statusFilter) &&
      (originFilter === "all" || run.run_origin === originFilter) &&
      (targetProjectFilter === "all" || targetProject === targetProjectFilter)
    );
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
          <Metric label="OpenCode-backed" value={String(index.summary.run_origin_counts.opencode_backed ?? 0)} />
          <Metric label="Targets" value={String(targetProjects.filter((target) => target !== "unknown").length)} />
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
          <label>
            Origin
            <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)}>
              <option value="all">All origins</option>
              {origins.map((origin) => (
                <option key={origin} value={origin}>{origin}</option>
              ))}
            </select>
          </label>
          <label>
            Target project
            <select value={targetProjectFilter} onChange={(event) => setTargetProjectFilter(event.target.value)}>
              <option value="all">All target projects</option>
              {targetProjects.map((targetProject) => (
                <option key={targetProject} value={targetProject}>{targetProject}</option>
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
              <span>origin: {run.run_origin}</span>
              <span>target: {valueOrUnknown(run.target_project_id)} / sequence: {valueOrUnknown(run.sequence_ref)}</span>
              <span>decision: {valueOrUnknown(run.final_decision)} / outcome: {valueOrUnknown(run.overall_outcome)}</span>
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
            {detail?.opencode_loop ? <OpenCodeLoopPanel opencodeLoop={detail.opencode_loop} /> : null}
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

function OpenCodeLoopPanel({ opencodeLoop }: { opencodeLoop: OpenCodeLoopDetail }) {
  const summary = opencodeLoop.summary;
  return (
    <section className="opencode-loop-panel" aria-labelledby="opencode-loop-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">W7 source-reported loop evidence</p>
          <h3 id="opencode-loop-title">OpenCode-backed loop drill-down</h3>
        </div>
        <StatusBadge status={opencodeLoop.warnings.length > 0 ? "PARTIAL" : "PASS"} />
      </div>
      <p>
        This read-only panel displays structured W7 ingest sidecars. It does not control OpenCode,
        execute browser-side actions, perform commits, or infer OpenCode task success.
      </p>
      {opencodeLoop.warnings.length > 0 ? <WarningList warnings={opencodeLoop.warnings} /> : null}
      {summary !== null ? (
        <dl className="detail-grid">
          <DetailTerm label="Target project" value={valueOrUnknown(summary.target_project_id)} />
          <DetailTerm label="Sequence" value={valueOrUnknown(summary.sequence_ref)} />
          <DetailTerm label="Final decision" value={valueOrUnknown(summary.final_decision)} />
          <DetailTerm label="Outcome" value={valueOrUnknown(summary.overall_outcome)} />
          <DetailTerm label="Validation" value={valueOrUnknown(summary.validation_state)} />
          <DetailTerm label="Clean pass eligible" value={`${booleanFact(summary.clean_pass_eligible)} (source-reported ingest field)`} />
          <DetailTerm label="Packet count" value={numberOrUnknown(summary.packet_count)} />
          <DetailTerm label="Approval count" value={numberOrUnknown(summary.approval_count)} />
          <DetailTerm label="Selected outputs" value={numberOrUnknown(summary.selected_output_count)} />
          <DetailTerm label="Privacy retention" value={`${valueOrUnknown(summary.privacy_retention_mode)} (display metadata only)`} />
          <DetailTerm label="Public export state" value={`${valueOrUnknown(summary.public_export_state)} (not a release gate)`} />
        </dl>
      ) : (
        <p>W7 summary sidecar is unavailable or malformed. Packet, approval, and selected-output data is not fabricated.</p>
      )}
      <div className="opencode-loop-grid">
        <section className="trace-message" aria-label="Packet ledger">
          <h4>Packet / order ledger</h4>
          {opencodeLoop.packet_ledger_entries.length === 0 ? <p>No valid packet ledger entries are available.</p> : null}
          <ol className="compact-list">
            {opencodeLoop.packet_ledger_entries.map((entry, index) => (
              <li key={`${entry.sequence ?? index}-${entry.stage ?? "stage"}`}>
                <strong>#{entry.sequence ?? index + 1} {valueOrUnknown(entry.stage)}</strong>
                <span>{valueOrUnknown(entry.producer)} -&gt; {valueOrUnknown(entry.consumer)}</span>
                <span>decision: {valueOrUnknown(entry.decision)} / validation: {valueOrUnknown(entry.validation_state)}</span>
                <span>{valueOrUnknown(entry.summary)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="trace-message" aria-label="Selected outputs">
          <h4>Selected outputs</h4>
          <p>Bounded structured sidecar excerpts only; raw body/body_path content is never rendered here.</p>
          {opencodeLoop.selected_outputs.length === 0 ? <p>No valid selected outputs are available.</p> : null}
          <ol className="compact-list">
            {opencodeLoop.selected_outputs.map((output, index) => (
              <li key={output.output_id ?? String(index)}>
                <strong>{valueOrUnknown(output.output_id)} / {valueOrUnknown(output.stage)}</strong>
                <span>{valueOrUnknown(output.summary)}</span>
                <span>excerpt: {valueOrUnknown(output.excerpt)}</span>
                <span>privacy: {valueOrUnknown(output.privacy_classification)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="trace-message" aria-label="Approval checkpoints">
          <h4>Approval checkpoints</h4>
          {opencodeLoop.approval_checkpoints.length === 0 ? <p>No valid approval checkpoints are available.</p> : null}
          <ol className="compact-list">
            {opencodeLoop.approval_checkpoints.map((checkpoint, index) => (
              <li key={checkpoint.checkpoint_id ?? String(index)}>
                <strong>{valueOrUnknown(checkpoint.checkpoint_id)} / approved: {booleanFact(checkpoint.approved)}</strong>
                <span>stage: {valueOrUnknown(checkpoint.stage)}</span>
                <span>target: {valueOrUnknown(checkpoint.target_session)}</span>
                <span>mode: {valueOrUnknown(checkpoint.approval_mode)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="trace-message" aria-label="Review synthesis">
          <h4>Review synthesis</h4>
          {opencodeLoop.review_synthesis === null ? <p>No valid review synthesis sidecar is available.</p> : (
            <dl className="detail-grid detail-grid-compact">
              <DetailTerm label="Plan verdict" value={valueOrUnknown(opencodeLoop.review_synthesis.plan_verdict)} />
              <DetailTerm label="Plan summary" value={valueOrUnknown(opencodeLoop.review_synthesis.plan_summary)} />
              <DetailTerm label="Step verdict" value={valueOrUnknown(opencodeLoop.review_synthesis.step_final_verdict)} />
              <DetailTerm label="Step summary" value={valueOrUnknown(opencodeLoop.review_synthesis.step_final_summary)} />
            </dl>
          )}
        </section>
      </div>
      <div className="artifact-paths" aria-label="W7 sidecar paths">
        {Object.entries(opencodeLoop.sidecar_paths).map(([label, path]) => (
          <p key={label}><strong>{label}</strong> <code>{path}</code></p>
        ))}
      </div>
    </section>
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
        <DetailTerm label="Run origin" value={run.run_origin} />
        <DetailTerm label="Target project" value={valueOrUnknown(run.target_project_id)} />
        <DetailTerm label="Sequence" value={valueOrUnknown(run.sequence_ref)} />
        <DetailTerm label="Final decision" value={valueOrUnknown(run.final_decision)} />
        <DetailTerm label="Overall outcome" value={valueOrUnknown(run.overall_outcome)} />
        <DetailTerm label="Clean pass eligible" value={`${booleanFact(run.clean_pass_eligible)} (source-reported ingest field)`} />
        <DetailTerm label="Packets / approvals / selected" value={`${numberOrUnknown(run.packet_count)} / ${numberOrUnknown(run.approval_count)} / ${numberOrUnknown(run.selected_output_count)}`} />
        <DetailTerm label="Privacy metadata" value={`${valueOrUnknown(run.privacy_retention_mode)} / ${valueOrUnknown(run.public_export_state)} (display metadata only)`} />
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

function formatSummaryFields(values: Record<string, string | boolean | number | null>) {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return "not reported";
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
}

function fieldSummary(candidate: ComparisonRunCandidate | null, key: string) {
  const field = candidate?.comparable_output.fields.find((candidateField) => candidateField.key === key) ?? null;
  if (field === null || !field.present) {
    return "missing";
  }
  return `${field.value_kind}: ${field.preview ?? "present"} (${field.fingerprint ?? "no fingerprint"})`;
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function numberOrUnknown(value: number | null) {
  return value === null ? "unknown" : String(value);
}

function booleanFact(value: boolean | null) {
  if (value === null) {
    return "not applicable";
  }
  return value ? "yes" : "no";
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
          {activePage.id === "evidence" ? <EvidencePage /> : null}
          {activePage.id === "packets" ? <LaunchPage /> : null}
          {activePage.id === "memory" ? <MemoryEvalPage /> : null}
          {activePage.id !== "overview" && activePage.id !== "runs" && activePage.id !== "trace" && activePage.id !== "evidence" && activePage.id !== "packets" && activePage.id !== "memory" ? (
            <PlaceholderPage page={activePage} traceTarget={traceTarget} />
          ) : null}
          {activePage.id === "overview" ? <FixtureTable /> : null}
        </div>
      </div>
    </main>
  );
}
