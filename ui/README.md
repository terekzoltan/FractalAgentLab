# UI

Local Wave 5 workbench UI for Fractal Agent Lab.

## U5-A Scope

This first UI slice is a fixture-backed evidence observatory shell. It establishes:

- local web app scaffold
- shell layout and navigation
- visual/status vocabulary
- placeholder pages for later Wave 5 epics
- fixture disclosure and no-claim boundaries

It does not implement canonical artifact crawling, real run detail, real trace timelines,
workflow launch, packet generation, backend/API design, public deployment, or OpenCode
automation.

## Commands

```bash
npm install
npm run typecheck
npm run build
npm test -- --run
```

## Evidence Boundary

Canonical evidence remains in:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

Any visible U5-A data is synthetic fixture/demo data and is not read from local runtime
artifacts. Real run and trace browsing belong to U5-B and U5-C.
