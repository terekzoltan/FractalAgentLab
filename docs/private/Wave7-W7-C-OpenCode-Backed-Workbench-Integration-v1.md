# Wave7 W7-C OpenCode-Backed Workbench Integration v1

## Status

Private draft planning note for `W7-C`.

This document defines how the existing Wave 5 workbench should evolve once OpenCode-backed loops are ingested into canonical FAL artifacts.

## Authority

- `README.md` and `ui/README.md` define the current Wave 5 workbench posture.
- `docs/architecture/Track-Boundaries.md` states that the workbench is browse-only, not a runtime controller.
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md` defines the canonical data that this workbench slice should consume.

## Purpose

The Wave 5 workbench is already useful as a browse surface for canonical FAL runs, traces, comparison facts, and memory/eval indexes.

`W7-C` makes that same workbench useful for real OpenCode-backed project loops.

This is a browse-layer extension, not a control-plane pivot.

## Current Workbench Rule That Must Stay True

The workbench remains:

- local/private
- generated-index-driven
- no browser-side execution
- no OpenCode session control
- no commit/push
- no hidden transport actions

Wave 7 should not weaken that rule.

## New Browse Target

The workbench should increasingly treat OpenCode-backed loops as first-class runs.

That means the UI should surface:

- target project identity
- sequence/epic identity
- packet/state story
- selected stage outputs
- review synthesis
- approval checkpoints
- unresolved gates or blockers
- project-local and global learning links

## Generated Index Direction

The existing generated-index model remains valid.

Recommended Wave 7 additions:

### Run index enrichment

Extend generated run rows with fields like:

```yaml
run_origin: fal_native | opencode_backed
target_project_id: string | null
sequence_ref: string | null
final_decision: string | null
overall_outcome: string | null
packet_count: int
approval_count: int
selected_output_count: int
```

### Trace detail enrichment

Allow trace pages to render OpenCode-backed loop event stories without pretending they were native FAL runtime step executions.

### Comparison index extension

Allow bounded comparison between:

- loops from the same target project
- loops across different target projects
- repeated step classes such as plan review or manual smoke closeout

Still no winner/score/ranking theater.

### Memory/eval index extension

Add visibility for:

- project-local OpenCode-loop memory entries
- global distilled lessons
- identity update sidecars tied to OpenCode-backed loops

## Recommended Workbench Surfaces

### Runs page

Should show:

- which runs are OpenCode-backed
- target project name/id
- sequence ref
- final verdict color
- missing required follow-up state

### Trace page

Should show:

- packet/state progression
- approval events
- selected output capture events
- final synthesis path

### Evidence page

Should show:

- packet ledger rows
- review findings summary
- unresolved gate summary
- cross-loop structural comparison facts

### Packets / Launch page

Should evolve carefully.

Allowed additions:

- view normalized packet ledger sidecars
- preview ingestable loop sources
- inspect command/packet provenance

Still forbidden:

- launch OpenCode
- send messages
- control sessions

### Memory / Eval page

Should show:

- project-local memory from OpenCode-backed loops
- global distilled learning rows
- identity update sidecars
- usefulness summaries tied to real project loops

## UI Language Rules

The UI must stay precise and non-theatrical.

Allowed language:

- source-reported
- observed
- captured
- selected output
- approval recorded
- follow-up required

Avoid language that implies:

- browser control
- hidden automation authority
- generalized quality scores
- provider superiority claims

## New Filters Worth Adding

Recommended filter groups:

- target project id
- run origin (`fal_native` vs `opencode_backed`)
- sequence ref
- final decision
- unresolved gate present
- approval count > 0
- manual smoke pending

## Suggested UI Components

Potential additive components:

- OpenCode-backed loop summary card
- packet ledger table
- approval timeline strip
- selected output drawer
- unresolved gate banner
- learning links panel

These should be additive and bounded, not a workbench rewrite.

## Explicit Non-Goals

`W7-C` does not implement:

- OpenCode controls
- terminal execution
- automatic reruns
- router controls
- prompt editing
- artifact editing
- learning-state editing from the browser

## Acceptance Criteria

`W7-C` is ready only if:

- OpenCode-backed runs are clearly visible in the existing workbench
- packet/approval/synthesis evidence is inspectable
- unresolved follow-ups are visible without reading raw artifacts manually
- browse behavior stays local/private and non-controlling
- the UI does not claim more certainty or automation than the evidence supports
