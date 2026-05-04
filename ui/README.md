# UI

Local Wave 5 workbench UI for Fractal Agent Lab.

## Current Scope

The UI started as the U5-A fixture-backed evidence observatory shell and now includes
the U5-B run browser surface, the U5-C trace timeline surface, the U5-D first-pass
operator command/packet preparation surface, and the U5-F read-only memory/eval
inventory surface.

U5-A established:

- local web app scaffold
- shell layout and navigation
- visual/status vocabulary
- placeholder pages for later Wave 5 epics
- fixture disclosure and no-claim boundaries

U5-B adds:

- generated run index loading from `/generated/run-index.json`
- run list and run detail browsing
- artifact existence indicators
- row-level missing/invalid artifact visibility
- workflow/status filters
- U5-C trace-target handoff without timeline rendering

U5-C adds:

- generated strict-valid trace detail loading from `/generated/traces/<run_id>.json`
- single-run trace timeline rendering in canonical sequence order
- validation/degrade states for missing, invalid, and warning-grade traces
- event filtering by type, lane, step, and failure-only mode
- collapsed raw payload preview for local/private debugging

U5-D adds:

- generated workflow catalog loading from `/generated/workflows.json`
- OpenCode/bash terminal command preview for `fal run`
- raw JSON object input validation
- visible config/provider preview controls
- structured operator-mediated packet skeletons
- explicit no-bridge/no-OpenCode-control/no-commit boundaries

U5-F adds:

- generated memory/eval index loading from `/generated/memory-eval-index.json`
- read-only project memory inventory
- read-only memory candidate/update sidecar inventory
- source-reported eval summary display for allowlisted report shapes
- historical curated evidence references as links only, not parsed live metrics
- explicit no-edit/no-rating/no-run-comparison/no-Wave-6-ledger boundaries

It does not implement browser-triggered local execution, a local Python bridge,
backend/API design, public deployment, OpenCode automation, provider ranking,
artifact editing, commit actions, artifact repair, memory editing, run-pair
comparison UX, or Wave 6 evidence-ledger behavior.

## Commands

```bash
npm install
npm run build:workflows
npm run build:memory-eval
npm run build:index
npm run build:traces
npm run typecheck
npm run build
npm test -- --run
```

`npm run build:workflows` derives a local workflow catalog from the CLI workflow
registry and writes:

```text
ui/public/generated/workflows.json
```

The generated catalog has schema version `u5_d.workflow_catalog.v1`. It includes only
allowlisted display metadata and does not dump arbitrary workflow metadata into the UI.

`npm run build:memory-eval` derives a local memory/eval inventory from `../data` and writes:

```text
ui/public/generated/memory-eval-index.json
```

The generated memory/eval index has schema version `u5_f.memory_eval_index.v1`. It scans
allowlisted memory sidecars and allowlisted eval report shapes only. Missing local memory
or eval data is rendered as `not demonstrated` / `no local project memory store found`,
not as failure. JSON sidecars without `report_version` are treated as non-report sidecars
and ignored; unsupported `report_version` values are warnings.

`npm run build:index` derives a local index from `../data` and writes:

```text
ui/public/generated/run-index.json
```

`npm run build:traces` derives per-run strict-valid trace detail files from `../data`
and writes:

```text
ui/public/generated/traces/<run_id>.json
```

These generated files are local/private, served by Vite during development, and
gitignored. They are not canonical evidence truth and should not be committed.

## Evidence Boundary

Canonical evidence remains in:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

The generated U5-B index has schema version `u5_b.run_index.v1`. It is a browse
accelerator over canonical artifacts. Missing `data/runs` or `data/traces` directories
produce warning-grade empty/partial indexes. Malformed run or trace artifacts stay
visible as degraded rows where possible.

The generated U5-C trace detail files use schema version `u5_c.trace_detail.v1`.
Strict-invalid traces do not produce renderable timeline detail files. The UI shows the
invalid state from the run index and warnings instead of rendering a fake timeline.
Each `build:traces` run cleans previously generated `ui/public/generated/traces/*.json`
files before writing the fresh strict-valid set, so stale trace details are not kept.

Trace events are displayed in canonical `sequence` order. Timestamp problems only create
warnings and do not reorder the event list.

Provider/model/fallback values are disclosure-only fields read from emitted artifacts.
The UI does not infer them from config and does not rank provider/model quality.

The U5-D command preview targets an OpenCode/bash terminal command using the established
`PYTHONPATH=src python -m fractal_agent_lab.cli run ...` shape. The packet composer is
advisory/operator-mediated only: it does not launch OpenCode, control sessions, perform
commits, or act as a review/gate artifact.

The U5-F memory/eval page is read-only. It displays stored project memory, memory
candidate/update sidecars, source-reported eval summaries, and historical curated
references where available. It does not edit memory, rewrite memory, define memory
meaning, define eval readiness, rank model/provider outputs, implement U5-E run-pair
comparison, or open Wave 6 evidence-ledger scope.
