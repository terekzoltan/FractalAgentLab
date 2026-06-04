# Wave7 W7-B Router Evidence Ingest CLI v1

## Status

Private draft implementation-planning note for `W7-B`.

This document defines the recommended thin CLI layer that should turn router/OpenCode loop evidence into canonical FAL run/trace/artifact truth.

## Authority

- `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md` defines the broader product direction.
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md` defines the target artifact contract.
- `docs/private/FAL-External-Project-Usage-Runbook-v01.md` defines the external-project use posture.

## Purpose

This is the missing seam between:

- real OpenCode/router execution
- FAL canonical artifacts and workbench surfaces

Without `W7-B`, the user or operator must manually translate router outputs into FAL artifacts.

With `W7-B`, FAL becomes usable as a seamless sidecar layer during real OpenCode work.

## Design Rule

The ingest CLI must be thin.

It should:

- read selected router/OpenCode evidence
- normalize it
- validate it
- write canonical FAL artifacts

It should not:

- replace the router
- replace OpenCode commands
- become a hidden controller
- launch browser-side flows
- infer more than the evidence actually supports

## Recommended User Experience

Target operator feeling:

```text
run OpenCode workflow normally
optionally let router help with approvals/chaining
let FAL ingest the useful evidence quietly in the background or with light operator checkpoints
```

The user should not need to rewrite session outputs into FAL terms manually.

## Command Family Direction

Near-term invocation may stay module-based:

```text
PYTHONPATH=src python -m fractal_agent_lab.cli ingest ...
```

Preferred long-term shape:

```text
fal ingest ...
```

## Recommended Command Shapes

### `fal ingest router-loop`

Purpose:

- ingest one whole router-assisted loop into canonical FAL artifacts

Suggested arguments:

```text
fal ingest router-loop \
  --target-project-id worldsim \
  --target-project-name WorldSim \
  --target-repo-path C:\EGYETEM\FUNSTUFF\WorldSim \
  --router-dir C:\EGYETEM\FUNSTUFF\WorldSim\.opencode-router \
  --sequence-ref Wave-10-Step-3A-P6-I \
  --track track-b \
  --loop-summary-path <path> \
  --write
```

Core inputs:

- router dir
- target project metadata
- sequence ref
- stage outputs / summary refs
- approval log refs if available

Core outputs:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

### `fal ingest selected-output`

Purpose:

- ingest one selected output into an existing loop before finalization

Use cases:

- phase 1 Meta step-review output arrived
- Swarm review arrived
- final synthesis arrived

### `fal ingest review-synthesis`

Purpose:

- append or update the review synthesis sidecar from a finalized selected output

### `fal ingest approval-log`

Purpose:

- record operator checkpoints if they were handled outside the canonical router packet set

### `fal ingest finalize-loop`

Purpose:

- compute final output summary
- write completion trace event
- trigger project/global learning candidate extraction

## Recommended Operation Modes

### Preview mode

Show:

- inferred run id
- source refs discovered
- outputs to be captured
- warnings
- retention decision

No writes.

### Write mode

Write canonical artifacts.

### Finalize mode

Used when the loop has reached a meaningful terminal point.

## Input Surfaces To Reuse

Recommended source inputs from the router/runtime side:

- `.opencode-router/processed/*.json`
- `.opencode-router/outbox/*.json` only when explicitly referenced
- `.opencode-router/artifacts/*.md`
- `.opencode-router/step-review-runs/<run_id>/state.json`
- `.opencode-router/step-review-runs/<run_id>/*.md`
- target-project `.opencode-router/sessions.json` only as lookup context, not canonical evidence

Recommended direct OpenCode-derived inputs:

- selected latest-output extracts
- review synthesis extracts
- operator-approved packet previews or send logs where available

## Minimal Required Behavior

The ingest CLI should be able to:

1. discover source files for a loop
2. infer stage ordering
3. create a canonical FAL run id
4. build `run_state.v1` compatible payload
5. build `trace_event.v1` compatible event list
6. write required sidecars
7. emit a clear ingest report with warnings

## Validation Rules

The ingest layer should fail loudly when:

- target project id is missing
- sequence ref is missing
- stage ordering is inconsistent
- final synthesis is claimed but no synthesis source exists
- selected output body path is missing for a required captured output
- retention mode would violate privacy policy

Warning-grade only when:

- some optional outputs are absent
- excerpts are missing but summaries exist
- approval checkpoint metadata is incomplete
- router provenance is partial but still traceable

## Idempotency Rule

The ingest CLI must be rerunnable safely.

Recommended behavior:

- same source set + same run id should update deterministically, not duplicate blindly
- repeated finalize should not append duplicate completion events
- if a sidecar already exists, either rewrite deterministically or refuse with clear mode flags

Recommended future flags:

```text
--preview
--write
--finalize
--force-rewrite
--append-optional-output
```

## Privacy Rule

The ingest layer must enforce the Wave 7 retention default, not rely on operator memory.

Default:

- store structured summary + bounded excerpt
- keep `body_path` private-only when explicitly allowed
- never store reasoning/thought parts

The ingest report should state:

- what was retained
- what was omitted
- why something was omitted

## Trace-Writing Rule

The ingest layer should write a trace that explains the loop story.

Minimum event sequence target:

1. `run_started`
2. `packet_recorded` for plan review route
3. `approval_granted` or `approval_declined` checkpoints
4. `selected_output_recorded` for key stage outputs
5. `review_synthesis_recorded` when final synthesis appears
6. `run_completed` or `run_failed`

The trace should help replay/audit tools answer:

- what happened
- in what order
- what was approved
- what verdict came back
- what remained unresolved

## Workbench Compatibility Requirements

`W7-B` should not invent artifact shapes the workbench cannot index later.

At minimum it should preserve machine-readable fields for:

- target project id
- sequence ref
- workflow id
- final outcome
- final decision
- warnings count
- packet count
- approval count
- selected output count

## Suggested Internal Module Direction

Potential module layout:

```text
src/fractal_agent_lab/ingest/
  opencode_loop.py
  router_sources.py
  selected_output.py
  approval_log.py
  run_builder.py
  trace_builder.py
  sidecars.py
  validation.py
```

Potential CLI ownership:

- `src/fractal_agent_lab/cli/app.py`

Potential tests:

```text
tests/ingest/
tests/cli/test_w8_b_ingest_cli.py
```

## Explicit Non-Goals

`W7-B` does not implement:

- session delivery
- session polling transport
- OpenCode credentials management
- browser execution
- commit automation
- suggestions logic
- global memory scoring semantics

## Acceptance Criteria

`W7-B` is ready only if:

- one router-assisted external-project loop can be ingested into canonical FAL artifacts
- rerun behavior is deterministic
- warnings and privacy decisions are visible
- the output is compatible with later workbench indexing
- the ingest CLI reduces manual evidence bookkeeping instead of increasing it
