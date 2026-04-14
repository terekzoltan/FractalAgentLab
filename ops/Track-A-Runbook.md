# Track-A-Runbook.md

## Purpose

This runbook defines how Track A should operate as the UX / CLI / trace-viewer track.

Use it together with:

- `ops/Track-Implementation-Runbook.md`
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`

---

## Track Mission

Track A owns visibility surfaces.

Primary responsibilities:

- CLI entrypoints
- command UX
- run-output formatting
- trace browsing and drill-down surfaces
- later workbench-facing presentation layers

Track A should not own:

- runtime execution semantics
- provider contracts
- memory merge logic
- eval scoring semantics

---

## What Track A Should Consume

Track A should consume stable, versioned truth from other tracks.

Default inputs:

- canonical run artifacts
- canonical trace artifacts
- shared artifact-layout helpers
- workflow registry truth
- replay/eval evidence when presentation depends on it

Track A should prefer reading existing truth over reconstructing or inferring it.

Track A truth-source rule:

- registry truth is stronger than module/root export presence for runnable workflow surfaces
- if a workflow is importable but not registry-exposed, Track A should not present it as a runnable public surface

---

## Surface Types

Track A should distinguish surface types explicitly because they do not share the same
truthfulness or error-policy requirements.

### Summary Surfaces

- compact
- honest
- should avoid over-interpreting unstable workflow semantics

### Drill-Down Surfaces

- authoritative single-run inspection surfaces
- should be strict and fail-loud when the requested artifact truth is missing or malformed

### Browser Surfaces

- multi-run or multi-workflow browsing surfaces
- may degrade row-by-row with warnings when partial artifact truth is still useful
- should not guess workflow/status meaning that is not actually present

### Export Surfaces

- schema-faithful
- non-guessing
- explicit about whether fields are emitted, reconstructed, or inferred

This distinction is important enough to treat as policy, not just implementation style.

---

## Typical Readiness Conditions

Track A is usually `READY` when:

- the required run/trace contracts exist
- the artifact layout is stable enough to consume
- the workflow/output surface is real enough to present honestly

Track A is usually `READY with guardrails` when:

- the UI/CLI surface can start, but must not infer unstable semantics
- the workflow family exists, but presentation must stay generic

Track A is usually `NOT READY` when:

- runtime or trace shape is still moving materially
- the requested view would require Track A to invent missing contract truth

---

## Standard Implementation Pattern

Track A should usually work in this order:

1. confirm the current viewer/CLI truth already present in the repo
2. add the smallest new entrypoint or browsing surface needed
3. keep old drill-down paths working unless the epic explicitly replaces them
4. add text and JSON output support when the surface is meant for both humans and tooling
5. add failure-path coverage for missing, malformed, or partial artifacts
6. update delivery docs and coordination surfaces

If workflow-specific law is still deferred, prefer a generic browse/read surface over a
premature polished workflow-aware formatter.

---

## Track-A Guardrails

- do not invent new canonical artifact locations
- treat `data/runs/<run_id>.json` and `data/traces/<run_id>.jsonl` as canonical unless a shared contract changes explicitly
- additive sidecars may be shown as presence metadata, not silently treated as trace truth
- avoid H1/H2/H3 family-specific formatting assumptions in supposedly generic browse surfaces
- do not rebuild replay logic inside the viewer if Track E already owns it
- do not claim artifact paths from surfaces that do not actually emit them
- drill-down truth surfaces should fail loud; browse surfaces may degrade with explicit warnings
- when documenting a field/path/status, be clear whether it is emitted, reconstructed, or inferred

---

## Expected Validation

Track A validation should usually include:

- CLI unit/regression tests for new commands or arguments
- text output checks
- JSON output checks
- missing-artifact or malformed-artifact failure checks
- regression checks for existing drill-down commands

For browse surfaces, validation should prove partial-row tolerance where that behavior is
claimed.

For drill-down surfaces, validation should prove fail-loud behavior where truth matters.

If the surface depends on shared artifact layout, include the artifact-layout tests too.

---

## Typical Deliverables

Track A delivery docs should usually state:

- new command surface
- filters or browse contract
- artifact dependencies
- preserved boundaries
- validation commands
- known limits

Track A should prefer honest browse/read surfaces over aspirational demo UX.
