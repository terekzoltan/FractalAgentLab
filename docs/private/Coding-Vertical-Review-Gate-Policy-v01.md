# Coding-Vertical-Review-Gate-Policy-v01.md

## Purpose

This document defines the intended review and commit-gate policy for future `H5` work.

The goal is not to maximize blockage.
The goal is to make coding decisions legible, honest, and reproducible.

---

## Findings-first rule

The review output must present:

1. findings first
2. ordered by severity
3. file references when possible
4. testing gaps and residual risks explicitly separated
5. only then a short change summary

If no findings exist, the review must say so explicitly and still note residual risks or testing gaps.

---

## Current workflow compatibility

This policy is intentionally derived from the current manual review pattern used in the repo.

It should preserve these expectations:

- review happens before commit recommendation
- findings are the primary output, not the change summary
- serious issues can and should block commit
- commit safety is an explicit decision surface, not implied confidence

Reference:
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`

Control-surface clarification:

- repository reality is the factual base
- `ops/Combined-Execution-Sequencing-Plan.md` is authoritative for readiness/order/frontier
- `ops/AGENTS.md` is authoritative for ownership/guardrails

Execution model clarification:

- near-term coding-vertical operation remains OpenCode-anchored
- this policy governs review/gate semantics; it does not imply native autonomous execution

---

## CV0-C design-only boundary

This policy is reviewed in `CV0-C` as a docs-only consistency step.

Meaning:

- no runtime/eval/schema/tooling changes are implied by this review
- no net-new artifact-contract redesign is implied by this review
- no commit-authority expansion is implied by this review

`CV2` remains the first thin executable review/gate slice after its own prerequisites.

---

## Severity model

### `critical`

Examples:
- correctness-breaking bug
- security issue
- data corruption risk
- major architectural violation
- known regression on core path

Effect:
- automatic `hold`

### `high`

Examples:
- likely bug
- unhandled failure mode
- contract mismatch
- major missing test on important path

Effect:
- usually `hold`

### `medium`

Examples:
- edge-case risk
- moderate test gap
- unclear implementation detail
- maintainability issue that materially affects future change safety

Effect:
- may allow `pass_with_warnings`

### `low`

Examples:
- polish issue
- small docs gap
- minor naming or clarity problem

Effect:
- usually non-blocking

---

## Commit-gate statuses

### `pass`

Use only if:
- no critical/high blockers remain
- required tests passed or are explicitly not applicable
- plan deviations are explained
- artifact evidence is structurally complete enough to trust (not envelope-presence only)

### `pass_with_warnings`

Use if:
- there are no blockers
- medium/low issues remain worth tracking
- residual risks exist but are acceptable and explicit

### `hold`

Use if any of the following is true:
- critical finding exists
- unresolved high-severity issue exists
- required tests are missing or failing
- plan adherence is badly broken without explanation
- coding artifacts are materially incomplete or contradictory
- shared-zone changes lack enough rationale
- evidence appears green only by envelope presence while required fields are materially incomplete

---

## Commit authority rule

Default rule for the coding vertical:

- review/gate may recommend commit readiness
- review/gate does not imply autonomous commit authority by default

Actual commits still require:

- explicit user request or explicit allowed workflow semantics
- alignment with repo commit safety rules
- honest gate status

This remains intentionally conservative until the vertical has real evidence behind it.

---

## Plan-adherence rule

The evaluator should compare implementation reality against the accepted plan.

Acceptable:
- minor deviations with explanation
- better solution with explicit rationale
- extra tests/docs beyond the original plan

Not acceptable:
- large hidden scope changes
- untracked architecture changes
- touching shared zones without note
- vague "seemed fine" reasoning without evidence

---

## False-green prevention rule

Review/gate outcomes should preserve the anti-false-green discipline already hardened in the mainline.

Minimum expectation:

- green-like gate language should require structurally complete evidence
- artifact envelope existence alone is not sufficient
- missing required review/test/evidence fields should surface explicitly

Reference anchors:

- `ops/Review-Findings-Registry.md` (`RF-2026-03-19-02`)
- `ops/Meta-Hardening-Package-v01.md` (H4/H6)

---

## Cross-surface consistency rule

When review/gate semantics expand, run one explicit consistency pass across:

- review/gate policy wording
- artifact-contract wording
- sequencing/readiness wording

This is a lightweight consistency check, not a heavy governance process.

---

## Shared-zone caution

Extra caution is required for:

- `core/contracts`
- `core/models`
- `runtime/`
- `tracing/`
- `configs/`
- `ops/`

These zones may require:

- stronger rationale
- stronger testing expectations
- stronger gate conservatism

---

## Artifact-contract consumption rule

This policy consumes the canonical coding-vertical artifact contract.
It does not redefine canonicality here.

Reference:

- `docs/private/Coding-Vertical-Artifact-Contract-v01.md`

Boundary reminder:

- optional/non-canonical sidecar behavior elsewhere in the repo is not by itself H5 validity law
- canonical run/trace correlation and artifact-envelope requirements come from the artifact-contract document

---

## Test evidence rule

If code changed, test evidence should normally exist.
If tests were not run, the reason must be explicit.

Invalid reasons:
- probably okay
- small change
- review looked fine

Potentially valid reasons:
- no executable test path exists yet
- environment limitation is clearly stated
- the change is truly docs-only or otherwise non-executable

---

## Learning-loop hook

Every substantive `H5` review should be eligible to feed the private learning loop if it teaches something durable about:

- review effectiveness
- gate correctness
- recurring failure patterns
- prompt/gate/policy weaknesses

Do this cautiously.
Do not overfit one isolated cycle.

Reference:
- `docs/private/Coding-Vertical-Learning-Loop-v01.md`

---

## Prompt provenance boundary

If prompt/version/provenance tags are included in review/gate artifacts, treat them as provenance context.
Do not treat prompt provenance as quality scoring or gate authority by itself.
