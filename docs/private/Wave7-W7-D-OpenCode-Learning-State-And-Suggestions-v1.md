# Wave7 W7-D OpenCode Learning State And Suggestions v1

## Status

Private draft planning note for `W7-D` and the later `W7-E` suggestion layer.

## Authority

- `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md` defines the broader direction.
- `src/fractal_agent_lab/memory/*` and `src/fractal_agent_lab/identity/*` define the current concrete memory and identity foundations.
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md` defines the canonical inputs this layer should consume.

## Purpose

The main value of FAL over time is not just capture.

It is improving future work through:

- project-local memory
- cross-project/global distilled learning
- observational identity
- later advisory suggestions

This document defines the first recommended shape of that layer for real OpenCode-backed loops.

## Design Rule

Learning must be distilled, bounded, and inspectable.

Do not learn by hoarding full transcripts.

Prefer:

- stable facts
- repeated findings
- repeated gate failures
- repeated review patterns
- reusable validation checklists

## Project-Local Memory Direction

The existing store shape remains the primary project-local memory target:

- `data/memory/projects/<project_id>.json`

Wave 7 should add OpenCode-loop-oriented entry subtypes such as:

- `review_gate_rule`
- `repo_specific_caution`
- `manual_smoke_requirement`
- `transport_pattern`
- `fix_loop_lesson`
- `validation_expectation`

### Good project-local memory examples

- `WorldSim P6-I is not GREEN until both gates-ON and gates-OFF manual smoke are recorded.`
- `Do not stage Docs/Architecture when running WorldSim Track B implementation loops.`
- `Track B plan-review outputs for this repo are useful only after Meta guardrails are applied.`

### Bad project-local memory examples

- full raw review bodies
- every router packet body copied verbatim forever
- long prompt payloads with little reuse value

## Global Distilled Learning Direction

Wave 7 should introduce a distinct cross-project store for de-identified, reusable workflow lessons.

Recommended path family:

- `data/memory/global/<topic>.json`

Candidate topics:

- `opencode_review_patterns`
- `router_transport_lessons`
- `manual_smoke_gate_patterns`
- `meta_triage_patterns`
- `review_fix_patterns`

### Good global learning examples

- `Manual interactive smoke often remains the last unresolved acceptance gate even when code-level review is green.`
- `Selected outputs plus packet/state transitions provide much better replay value than raw message hoarding.`
- `Native OpenCode planning commands can outperform parallel FAL-native planning for operator usefulness and cost.`

### Rule

- project-local memory may keep repo names and repo-specific facts
- global learning should be distilled and safe to reuse elsewhere without carrying target-specific private context unnecessarily

## Identity Direction

Identity should remain observational and bounded.

Good identity signals from OpenCode-backed loops:

- review strictness tendency
- false-positive tendency
- follow-through / completion tendency
- delegation tendency
- caution tendency

Signals should be derived from explicit loop evidence such as:

- repeated `fix_required` vs `pass`
- later downgrade of findings
- manual gate misses
- repeated need for Meta guardrail correction
- consistent review depth patterns

Not a Wave 7 goal:

- identity-driven autonomous routing authority
- personality simulation
- hidden heuristic scoring with no evidence trail

## Suggested Memory Candidate Extraction Inputs

From OpenCode-backed loop artifacts, candidate extraction should look at:

- final synthesis verdict
- repeated blockers
- repeated required follow-ups
- plan-vs-implementation-vs-review deltas
- accepted scope summaries
- manual smoke requirements
- explicit non-goals that proved valuable

## Suggestions Layer Direction

Suggestions should come only after the evidence layer is trustworthy.

The first suggestion layer should be advisory.

Recommended suggestion families:

- likely next action
- missing gate reminder
- repeated failure caution
- validation checklist reminder
- reusable review-fix pattern
- probable follow-up artifact recommendation

### Good advisory suggestion examples

- `Before claiming GREEN, check whether this repo’s manual smoke gate is still open.`
- `This looks like a repo where Meta guardrails usually tighten Track plans usefully.`
- `Selected packet/state evidence is present, but approval log is missing; consider recording checkpoints before closeout.`

### Bad suggestion examples

- `Automatically run /implement now.`
- `Skip Meta review because prior runs were usually green.`
- `Commit now; likely safe.`

## Workbench Exposure

The workbench should expose learning in a read-only, source-reported way.

Recommended surfaces:

- project-local memory rows tied to loop ids
- global distilled lessons with source counts
- identity delta summaries per agent/role/session type
- suggestions panel clearly marked as advisory and evidence-backed

## Privacy Rules

Memory and suggestion surfaces must inherit the structured-extracts-only default.

Do not:

- copy chain-of-thought into memory
- retain long raw prompt corpora as "learning"
- surface private target specifics into global lessons unless explicitly distilled and safe

## Acceptance Criteria

`W7-D` is ready only if:

- project-local memory gains useful OpenCode-loop entry types
- a separate global learning layer exists conceptually and structurally
- identity remains observational and bounded
- suggestions are advisory, not controlling
- learning can be inspected back to captured loop evidence

## Explicit Non-Goals

`W7-D` and later `W7-E` do not authorize:

- autonomous routing based on identity
- hidden ranking systems
- automatic workflow triggering from suggestions
- replacing explicit human approval for sensitive actions
