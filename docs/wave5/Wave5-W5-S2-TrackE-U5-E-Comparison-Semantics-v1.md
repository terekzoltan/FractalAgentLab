# Wave5-W5-S2-TrackE-U5-E-Comparison-Semantics-v1

## Status / Execution Mode / Visibility State

```yaml
wave: 5
sprint: W5-S2
epic: U5-E
track_scope: Track E comparison semantics / metrics
status: accepted_for_track_e_semantics_scope
execution_mode: docs_only
visibility_state: git_visible_docs_and_existing_eval_surfaces_reviewed
full_u5_e_status: incomplete_until_track_a_ux_implementation_is_accepted_in_step_3
```

This document completes only the Track E comparison-semantics part of `U5-E` after `U5-D`.
It does not close full `U5-E`: Track A still owns the Step 3 UX implementation after this spec is accepted.

## Scope And Non-Goals

In scope:

- define allowed comparison target classes
- define comparability preflight rules
- define required comparable keys for currently supported workflow families
- define structural/evidence-readiness labels
- define `PASS` / `WARNING` / `FAIL` / `BLOCKED` / `INVALID` semantics where applicable
- separate structural comparison from quality comparison
- define provider/model/fallback disclosure rules
- give Track A enough handoff wording to implement UX without inventing semantics

Non-goals:

- no UI implementation
- no runtime, trace, provider, memory, or workflow contract changes
- no provider/model leaderboard
- no provider-quality or model-quality parity claim
- no model-quality scoring
- no output-quality score
- no winner scoring
- no hidden normalization that changes evidence meaning
- no cross-workflow comparison claim unless explicitly supported by a Track E contract
- no public/demo claim beyond actual evidence

## Existing Evidence Reviewed

Reviewed sources:

- `ops/Combined-Execution-Sequencing-Plan.md` W5-S2 / U5-E sequencing
- `docs/wave5/Wave5-Workbench-Detailed-Plan-v1.md` U5-E and Track ownership sections
- `src/fractal_agent_lab/evals/h1_smoke_comparison.py`
- `src/fractal_agent_lab/evals/h2_run_comparison.py`
- `src/fractal_agent_lab/evals/h1_eval_contracts.py`
- `src/fractal_agent_lab/evals/h2_eval_contracts.py`
- `src/fractal_agent_lab/evals/h1_eval_projections.py`
- `src/fractal_agent_lab/evals/h2_eval_projections.py`
- `src/fractal_agent_lab/evals/r3_l_evidence_curation.py`
- `src/fractal_agent_lab/evals/p4_b_h1_cross_provider_smoke.py`
- `docs/wave3/Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md`
- `docs/wave4/Wave4-W4-S1-TrackE-P4-B-H1-Cross-Provider-Smoke-Comparison-v1.md`
- `docs/wave4/Wave4-W4-S1-TrackE-P4-B-Live-Evidence-Closeout-v1.md`

Evidence-source rule:

- canonical run/trace truth remains `data/runs/<run_id>.json` and `data/traces/<run_id>.jsonl`
- Track E reports and curation docs are derived/eval evidence surfaces
- UI indexes, fixtures, display models, and summaries are not canonical evidence truth

## Allowed Comparison Target Classes

### H1 Structural Variant Comparison

Allowed when both runs belong to the H1 supported variant set from `src/fractal_agent_lab/evals/h1_eval_contracts.py`:

- `h1.single.v1`
- `h1.manager.v1`
- `h1.handoff.v1`

Purpose:

- structural comparison of comparable H1 output fields
- orchestration/evidence disclosure where available
- no winner scoring and no output-quality score

### H1 Provider-Path Smoke Comparison

Allowed for bounded `h1.single.v1` provider-path smoke evidence when the comparison follows the P4-B rules.

Currently accepted live P4-B evidence:

- OpenRouter run id: `4771b058-97b6-4164-b060-40b381acd2b4`
- OpenAI run id: `308ac05a-7f2e-4985-99dc-11d547557a98`
- `comparison_outcome: PASS`
- `cross_provider_smoke_passed: true`

Meaning:

- provider-path smoke evidence only
- no provider-quality parity
- no model-quality parity
- no model/provider ranking
- no broader H2/H3/H4 real-provider parity claim

### H2 Structural Run Comparison

Allowed only for `h2.manager.v1` runs using H2 comparison readiness gates from `src/fractal_agent_lab/evals/h2_run_comparison.py` and keys from `src/fractal_agent_lab/evals/h2_eval_contracts.py`.

The R3-L curated corpus currently records H2 as not comparison-ready because `comparison_ready: false` and failed gate `all_key_orders_match` were observed.
Track A must show that truth directly if surfacing that curated set.

### Curated Evidence Display

Allowed when Track E has already produced a curation surface such as R3-L.

Curated display must show:

- selected run ids
- workflow family
- artifact validation state
- evidence backing label
- current/historical/curated status
- whether the curated view is complete corpus truth or only selected evidence

Curated evidence must not be rendered as full-corpus truth unless the source artifact explicitly says so.

### H3 Single-Run Evidence

H3 is currently single-run validated/manual-rubric-backed evidence, not comparison evidence.

Allowed UI meaning:

- show the run and rubric-backed evidence label
- show links to canonical run/trace artifacts and manual rubric reference

Blocked UI meaning:

- do not present H3 as comparison-ready
- do not compare H3 against H1/H2
- do not infer quality ranking

### H4 / H5 Evidence State

For U5-E v1:

- `not_demonstrated` means no accepted Track E comparison surface currently exists for H4/H5 run comparison
- `deferred` means future H4/H5 comparison is possible only after a later Track E comparison contract defines supported targets, keys, labels, and gates

Track A must use both concepts where relevant: H4/H5 comparison support is `not_demonstrated` now and `deferred` for future support.

### Cross-Workflow Comparison

Cross-workflow comparison is blocked/unsupported unless a Track E contract explicitly supports that pair.

Examples blocked by default:

- H1 vs H2
- H2 vs H3
- H3 vs H4
- H4 vs H5
- manager workflow vs unrelated workflow family

The UI may still display differences as metadata disclosure, but must not call that a valid comparison.

## Comparability Preflight Rules

Before Track A renders a comparison as structurally comparable, it must be able to show these preflight facts or the reason they are unavailable:

- run artifact exists for each run
- trace artifact exists for each run
- artifact validation result is known
- workflow id is known for each run
- workflow ids match an allowed comparison target class
- run status is known for each run
- required comparable output keys are present for the target class
- matched input is confirmed where the target class requires matched input
- provider/model/fallback truth is disclosed where provider differences are shown
- evidence backing is known: replay-backed, curated, manual, partial, blocked, invalid, historical, current corpus, or not demonstrated

Matched input requirements:

- H1 variant comparison should show whether input payloads match. If the UX cannot confirm matched input, label the comparison `WARNING` or `BLOCKED` depending on the claim being made.
- P4-B-style provider-path smoke comparison requires exact input-payload match for `PASS`.
- H2 structural comparison should show whether selected runs are intended as a comparable corpus. If not known, label as `WARNING` and do not imply a clean structural comparison.

## Required Comparable Keys By Workflow Family

### H1 Comparable Keys

Source: `src/fractal_agent_lab/evals/h1_eval_contracts.py` (`H1_COMPARABLE_OUTPUT_KEYS`).

Required keys:

- `clarified_idea`
- `strongest_assumptions`
- `weak_points`
- `alternatives`
- `recommended_mvp_direction`
- `next_3_validation_steps`

H1 comparable key extraction source:

- `src/fractal_agent_lab/evals/h1_eval_projections.py`

### H2 Comparable Keys

Source: `src/fractal_agent_lab/evals/h2_eval_contracts.py` (`H2_COMPARABLE_OUTPUT_KEYS`).

Required keys:

- `project_summary`
- `tracks`
- `modules`
- `phases`
- `dependency_order`
- `implementation_waves`
- `recommended_starting_slice`
- `risk_zones`
- `open_questions`

Additional H2 gates from existing comparison code:

- output key order matches `H2_COMPARABLE_OUTPUT_KEYS`
- `implementation_waves` has valid item shape
- `recommended_starting_slice` is present and non-empty
- manager delegate order matches `intake`, `planner`, `architect`, `critic`

H2 comparable key extraction source:

- `src/fractal_agent_lab/evals/h2_eval_projections.py`

### H3 / H4 / H5 Comparable Keys

No accepted U5-E comparison key set exists for H3, H4, or H5 in this spec.

- H3: single-run/manual-rubric-backed evidence only
- H4: `not_demonstrated` now, `deferred` for future comparison support
- H5: `not_demonstrated` now, `deferred` for future comparison support

Track A must not invent comparable keys for these families.

## Readiness Labels And Meanings

All labels in this section are structural/evidence-readiness labels. They are not output-quality scores.

| Label | Meaning | Track A rendering rule |
|---|---|---|
| `replay_backed` | Canonical run/trace artifacts can be replayed or inspected through accepted replay/validation surfaces. | May render as evidence backing, not as quality. |
| `curated` | Track E selected and labeled a bounded evidence set. | Must show curated/selected scope; do not imply full corpus truth. |
| `manual` | Umbrella label for non-automated evidence or operator/manual review evidence. | Must show the manual source or note. |
| `manual_rubric_backed` | Stronger subtype of `manual`; a named accepted rubric supports the evidence. | May render as stronger manual backing, not as automated comparison. |
| `partial` | Some evidence exists but one or more required preflight facts or fields are missing. | Must show missing pieces. |
| `blocked` | Comparison cannot honestly be made because a prerequisite is absent or unavailable. | Must not render as neutral or pass. |
| `invalid` | Artifact shape, validation, or source truth is malformed or contradictory. | Must show as error/degraded evidence. |
| `not_demonstrated` | No accepted evidence surface currently demonstrates this comparison class. | Must not imply support exists. |
| `deferred` | Future comparison support is possible after later Track E definition. | Use as roadmap/future label only. |
| `historical` | Evidence is valid but comes from an older/historical run/schema context. | Must show historical status. |
| `current_corpus` | Evidence summarizes the currently selected/known corpus. | Must show corpus scope. |
| `provider_path_smoke` | Provider route/path execution was structurally checked for a bounded workflow. | Must not render as provider-quality parity. |

## Structural / Evidence Readiness Vs Quality Comparison

Structural comparison may show:

- workflow id match or mismatch
- run status
- artifact validation result
- replay readiness
- required key presence and missing keys
- field-level structural differences
- key-order validity where required by existing Track E gates
- manager/delegate order checks where required by existing Track E gates
- matched-input truth
- provider/model/fallback disclosure
- evidence backing label

Quality comparison is not allowed in U5-E v1.

Prohibited quality implications:

- one run is better
- one provider is better
- one model is better
- one orchestration is a winner
- higher/lower quality score
- leaderboard or ranking

If future quality comparison is desired, Track E must first define a separate rubric, acceptance gate, evidence requirements, and no-claim boundaries.

## Provider / Model / Fallback Disclosure Rules

Provider/model/fallback fields are disclosure-only.

When available, Track A should display:

- selected provider
- executed provider
- selection source
- fallback policy
- fallback used
- provider attempts
- selected model
- requested model
- response model
- executed model
- model-policy config path if an evidence surface records it

Rules:

- Provider/model differences are not scores.
- Different model IDs are allowed in provider-path smoke evidence if disclosed.
- Fallback-backed success must be visible and must not be collapsed into no-fallback success.
- P4-B provider-path `PASS` requires no fallback on either provider leg.
- Provider routing semantics remain Track D-owned; Track E defines only display/evidence wording here.

## Blocked / Warning / Pass / Fail / Invalid Semantics

All verdicts in this section are structural/evidence-readiness states, not output-quality scores.

`PASS` means:

- the target class is allowed
- required artifacts and preflight fields exist
- required comparable keys are complete
- matched input is satisfied where required
- provider/model/fallback disclosure is complete where relevant
- all existing Track E gates for that target class pass

`WARNING` means:

- a limited comparison or display is possible, but the UI must show limitations
- examples: historical evidence, curated evidence, partial preflight confidence, input match unknown for non-provider-path structural display

`FAIL` means:

- canonical evidence exists and can be inspected, but the structural claim is false
- examples: comparable keys missing, wrong workflow, fallback used where no-fallback was required, comparable key sets mismatch

`BLOCKED` means:

- comparison cannot honestly be made
- examples: missing run id, missing run/trace artifact, replay not ready, incompatible workflow families, exact input mismatch where exact input is required, missing provider credentials for a live provider-path evidence attempt

`INVALID` means:

- artifact truth is materially malformed or contradictory
- examples: malformed run artifact, trace/run mismatch, missing required schema fields in a supposedly valid evidence source

`NOT_DEMONSTRATED` means:

- no accepted Track E evidence surface currently supports that comparison class
- examples: H4/H5 comparison in this U5-E v1 spec

## Track A Handoff Contract / Checklist

Track A may render these labels only with the meanings defined above:

- `replay_backed`
- `curated`
- `manual`
- `manual_rubric_backed`
- `partial`
- `blocked`
- `invalid`
- `not_demonstrated`
- `deferred`
- `historical`
- `current_corpus`
- `provider_path_smoke`
- `PASS`
- `WARNING`
- `FAIL`
- `BLOCKED`
- `INVALID`

Track A must not invent additional comparison readiness labels in U5-E UX without Track E review.

Required canonical/source links where available:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- relevant `data/artifacts/<run_id>/...` sidecars if present
- relevant Track E report or curation doc path
- relevant run id for each compared leg

Required UX disclosures:

- workflow id for each run
- run status for each run
- artifact validation status
- replay readiness where known
- matched-input status where relevant
- provider/model/fallback truth where relevant
- evidence backing labels
- unsupported/not-demonstrated/deferred states where no comparison support exists

Prohibited wording:

- `winner`
- `better model`
- `better provider`
- `provider leaderboard`
- `model leaderboard`
- `quality score`
- `provider ranking`
- `model ranking`
- `parity` unless the exact accepted evidence surface explicitly authorizes that claim

Track A must show incompatible runs as `BLOCKED` or clearly warning-labelled. It must not normalize incompatible evidence into a green comparison view.

## Verification / Evidence Reviewed

Verification performed for this docs-only Track E step:

- reviewed Wave 5 U5-E sequencing and ownership in `ops/Combined-Execution-Sequencing-Plan.md`
- reviewed U5-E scope and Track ownership in `docs/wave5/Wave5-Workbench-Detailed-Plan-v1.md`
- reviewed H1 comparable keys and roles in `src/fractal_agent_lab/evals/h1_eval_contracts.py`
- reviewed H2 comparable keys and delegate order in `src/fractal_agent_lab/evals/h2_eval_contracts.py`
- reviewed R3-L curated evidence policy and current corpus truth
- reviewed P4-B provider-path smoke semantics and live closeout

Planned artifact hygiene command:

- `git diff --check`

No unit tests are required for this docs-only specification because no executable code, schema, runtime, provider, memory, or UI implementation is changed.

No machine-readable appendix is introduced in this version. If Track A later requests a display model, that should be handled in the Track A UX implementation context or a follow-up Track E review packet.

## Known Limits

- This spec defines comparison semantics; it does not implement UI behavior.
- H2 current curated corpus remains explicitly not comparison-ready where prior evidence says so.
- H3 is evidence-displayable but not comparison-ready.
- H4/H5 comparison remains `not_demonstrated` now and `deferred` until future Track E support.
- Provider-path smoke evidence does not imply provider or model quality parity.
- Curated evidence remains selected-scope evidence unless a source explicitly says it represents a complete corpus.
- Future quality scoring requires a separate Track E rubric and acceptance gate.
