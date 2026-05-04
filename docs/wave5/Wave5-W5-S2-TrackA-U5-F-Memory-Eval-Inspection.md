# Wave5 W5-S2 TrackA U5-F Memory Eval Inspection

## Status

Track A implementation delivery note for `U5-F` first pass.

Execution mode: `opencode_assisted`.

Visibility / audit state: git-visible UI code, generator script, tests, docs, and local
ignored memory/eval index output under `ui/public/generated/memory-eval-index.json`.

## Scope

Implemented the first read-only memory/eval inventory surface in the Wave 5 workbench.

In scope:

- generated memory/eval index derived from local `data/` artifacts
- `Memory / Eval` page as a `PARTIAL` surface
- read-only project memory store inventory
- read-only memory candidate and project-memory update sidecar inventory
- allowlisted source-reported eval summary display
- historical curated evidence reference links
- explicit no-edit/no-rating/no-run-comparison/no-Wave-6-ledger boundary wording

Out of scope and intentionally not implemented:

- memory editing
- memory rewrite or merge policy changes
- project memory meaning changes
- identity drift inspection or `identity_update.json` display
- eval readiness or rating semantics
- provider/model ranking claims
- run-pair comparison or `U5-E` UX
- benchmark dashboard behavior
- Wave 6 evidence ledger or OpenCode orchestration behavior

## Generated Memory/Eval Index Boundary

Generator command from `ui/`:

```bash
npm run build:memory-eval
```

Default output:

```text
ui/public/generated/memory-eval-index.json
```

The generated memory/eval index is a local/private derived UI surface and is gitignored
through `/ui/public/generated/`.

Canonical project-memory store truth remains in:

```text
data/memory/projects/*.json
```

The following local source artifacts are read-only inventory/provenance inputs for U5-F
display only, not canonical memory merge truth:

```text
data/artifacts/<run_id>/memory_candidates.json
data/artifacts/<run_id>/project_memory_update.json
data/artifacts/<run_id>/<allowlisted_eval_report>.json
```

Schema version:

```text
u5_f.memory_eval_index.v1
```

The generator scans strict allowlists:

- project memory JSON files under `data/memory/projects/`
- `memory_candidates.json`
- `project_memory_update.json`
- known eval report shapes with allowlisted `report_version` values

It does not treat every JSON sidecar as an eval summary. JSON sidecars without a string
`report_version` are intentionally treated as non-report sidecars and ignored without
warnings. JSON sidecars with a non-allowlisted `report_version` are skipped with warnings.
Malformed local files create warnings and do not create fake rows.

Track E confirmed this report-version behavior as no-claim-safe before U5-F closeout.

## Memory Display Boundary

The UI displays stored project memory and memory sidecars as inventory only.

Allowed wording:

- stored project memory
- candidate sidecar
- project memory update sidecar
- available local evidence
- not demonstrated
- no local project memory store found

Avoided wording:

- complete memory
- truth
- learned everything
- identity quality
- memory editor

## Eval Display Boundary

The UI displays only source-reported eval summary fields from allowlisted report shapes.

Allowed wording:

- source-reported outcome
- eval summary
- historical curated reference
- not demonstrated

Avoided wording:

- benchmark dashboard
- model quality
- winner
- score
- leaderboard

The R3-L curated evidence document is linked as a historical source reference only. U5-F
does not parse it into live metrics.

## Wording Check Status

- Track C memory wording check: satisfied after canonical-memory wording was narrowed.
- Track E eval wording and report-version semantics check: satisfied by `docs/wave5/Wave5-W5-S2-TrackE-U5-F-Eval-Wording-Check-v1.md`.
- Meta no-claim boundary review: satisfied for U5-F closeout.

## Known Limits

- `Memory / Eval` is `PARTIAL` because it is an inventory/display surface only.
- Missing local memory/eval data is represented as `not demonstrated`, not as failure.
- Identity update artifacts are intentionally excluded from this first slice.
- U5-E comparison semantics and UX remain separate.
- Wave 6 evidence-ledger behavior remains out of scope.

## Validation Commands

Implementation closeout validation:

```bash
PYTHONPATH=src python -m unittest tests.scripts.test_u5_f_memory_eval_index
cd ui && npm run build:memory-eval
cd ui && npm run build:index -- --data-dir ../data
cd ui && npm run build:traces -- --data-dir ../data
cd ui && npx vitest --environment jsdom --run src/App.test.tsx
cd ui && npm run typecheck
cd ui && npm run build
cd ui && npm audit --audit-level=moderate
git diff --check
git status --short --ignored ui/public/generated
```
