# UI

Local Wave 5 workbench UI for Fractal Agent Lab.

## Current Scope

The UI started as the U5-A fixture-backed evidence observatory shell and now includes
the U5-B run browser surface.

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

It does not implement real trace timelines, workflow launch, packet generation,
backend/API design, public deployment, OpenCode automation, eval scoring, provider
ranking, artifact editing, or artifact repair.

## Commands

```bash
npm install
npm run build:index
npm run typecheck
npm run build
npm test -- --run
```

`npm run build:index` derives a local index from `../data` and writes:

```text
ui/public/generated/run-index.json
```

This generated file is local/private, served by Vite during development, and gitignored.
It is not canonical evidence truth and should not be committed.

## Evidence Boundary

Canonical evidence remains in:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

The generated U5-B index has schema version `u5_b.run_index.v1`. It is a browse
accelerator over canonical artifacts. Missing `data/runs` or `data/traces` directories
produce warning-grade empty/partial indexes. Malformed run or trace artifacts stay
visible as degraded rows where possible.

Provider/model/fallback values are disclosure-only fields read from emitted artifacts.
The UI does not infer them from config and does not rank provider/model quality.
