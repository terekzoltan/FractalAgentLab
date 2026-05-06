# Wave5 W5-S2 TrackA U5-E Comparison UX

## Status

Track A implementation delivery note for `U5-E` UX implementation first pass.

Execution mode: `opencode_assisted`.

Visibility / audit state: git-visible UI code, generator script, tests, docs, and local
ignored comparison index output under `ui/public/generated/comparison-index.json`.

## Scope

Implemented a bounded local run-comparison display for the Wave 5 workbench Evidence page.

In scope:

- generated comparison display index derived from local `data/` artifacts
- `Evidence` page as a `PARTIAL` structural display surface
- run candidates and capped suggested pairs for accepted H1/H2 comparison target classes
- Track E-defined comparable key presence, missing-key, and preflight fact display
- provider/model/fallback disclosure-only display
- source-reported known P4-B evidence pair display without recomputing provider-path PASS
- H3/H4/H5 unsupported/deferred/not-demonstrated boundary display

Out of scope and intentionally not implemented:

- new Track E comparison/eval semantics
- provider-path smoke recomputation
- quality scoring
- winner selection
- provider/model ranking or leaderboards
- provider/model quality parity claims
- cross-workflow comparison support beyond Track E-defined classes
- browser-side raw artifact reads, backend bridge, or local execution
- Wave 6 evidence ledger or OpenCode orchestration behavior

## Generated Comparison Index Boundary

Generator command from `ui/`:

```bash
npm run build:comparisons
```

Default output:

```text
ui/public/generated/comparison-index.json
```

The generated comparison index is a local/private derived UI surface and is gitignored
through `/ui/public/generated/`.

Schema version:

```text
u5_e.comparison_index.v1
```

The generator consumes accepted Track E comparison contracts and helper outputs for display
only. It does not define a new Track A readiness policy.

## Pair Selection Policy

Suggested pairs are bounded and deterministic:

- never generate unbounded all-vs-all pairs
- group by accepted target class
- prefer accepted known evidence pairs for source-reported display
- otherwise use recent valid runs first
- cap generated suggested pairs through `--max-suggested-pairs`

Manual UI selections outside the bounded generated suggestions do not receive a new Track A
verdict. They are shown as blocked/outside generated suggestions rather than normalized into
a green comparison view.

## Track E Semantics Consumption

Track A consumes these accepted Track E sources without changing semantics:

- `src/fractal_agent_lab/evals/h1_eval_contracts.py`
- `src/fractal_agent_lab/evals/h1_eval_projections.py`
- `src/fractal_agent_lab/evals/h2_eval_contracts.py`
- `src/fractal_agent_lab/evals/h2_eval_projections.py`
- `docs/wave5/Wave5-W5-S2-TrackE-U5-E-Comparison-Semantics-v1.md`

UI labels such as `PASS`, `FAIL`, `BLOCKED`, and `INVALID` are structural preflight display
normalizations over Track E-defined facts. They are not output-quality scores.

For H2 in this first pass, Track E confirmed that unknown intended comparable corpus state
must render as `WARNING` with reason `h2_intended_comparable_corpus_unknown`. Missing or
invalid artifact failures still outrank that warning.

## Known Evidence Pair Handling

The accepted P4-B provider-path smoke pair is shown as source-reported evidence only.

If the accepted run ids are unavailable locally, U5-E renders that known pair as local
`not_demonstrated` / `BLOCKED`. If local fallback-backed truth is observed, U5-E keeps the
source-reported status separate and marks local preflight accordingly; it does not recompute
or replace Track E's provider-path smoke semantics.

## Unsupported / Deferred Targets

H3, H4, and H5 remain intentionally minimal in this first pass:

- H3: single-run/manual-rubric-backed reference only
- H4/H5: `not_demonstrated` plus `deferred`
- no comparison-ready rows for H3/H4/H5

## Verification

Planned and executed verification commands:

```bash
PYTHONPATH=src python -m unittest tests.scripts.test_u5_e_comparison_index
PYTHONPATH=src python -m unittest tests.scripts.test_u5_b_run_index
PYTHONPATH=src python -m unittest tests.scripts.test_u5_f_memory_eval_index
cd ui && npm run build:comparisons
cd ui && npx vitest --environment jsdom --run src/App.test.tsx
cd ui && npm run typecheck
cd ui && npm run build
git diff --check
git status --short --ignored ui/public/generated
```

## Known Limits

- This is a display index, not canonical evidence truth.
- Empty local data renders as not demonstrated, not failure.
- Suggested pairs are intentionally capped and may not include every possible local pair.
- Comparable field previews are bounded and fingerprinted; canonical artifacts remain the source for full content.
- Full U5-E closeout still requires Track E semantics review and Meta no-claim review.
