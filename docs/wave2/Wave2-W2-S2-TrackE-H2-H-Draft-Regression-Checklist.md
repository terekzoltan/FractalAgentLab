# Wave2-W2-S2-TrackE-H2-H-Draft-Regression-Checklist.md

## Purpose

This document delivers `H2-H` in `W2-S2 Step 3` as a **Track E draft regression checklist**.

It is intentionally a draft-only artifact:

- Track E drafts regression assertions from current replay/smoke/tag evidence.
- Track B later confirms schema-level enforceability in `W2-S3`.

This document does not add new runtime or schema requirements by itself.

---

## Scope and Ownership Boundary

In scope (`H2-H` draft, Track E):

- consolidate replay/smoke/tag assertions already visible from `H2-E` / `H2-F` / `H2-G`
- separate enforced facts from observed expectations
- provide Track B confirmation candidates for `W2-S3`

Out of scope:

- contract-law decisions (Track B scope)
- new runtime/eval enforcement logic
- rerun/determinism claims
- quality winner selection
- prompt-tag scoring
- canonical run/trace schema mutation proposals from this draft

---

## Evidence Inputs

Primary Wave 2 sources:

- `docs/wave2/Wave2-W2-S2-TrackE-H2-E.md`
- `docs/wave2/Wave2-W2-S2-TrackE-H2-F-H2-G.md`
- `src/fractal_agent_lab/evals/artifact_acceptance.py`
- `src/fractal_agent_lab/evals/artifact_replay.py`
- `src/fractal_agent_lab/evals/h1_artifact_set.py`
- `src/fractal_agent_lab/evals/h1_smoke_suite.py`
- `src/fractal_agent_lab/evals/h1_baseline_tags.py`

Policy and anti-delusion anchors:

- `docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md`
- `docs/wave1/Wave1-L1-L-H1-Decision-Log.md`
- `ops/Review-Findings-Registry.md` (`RF-2026-03-19-02`)

Compatibility watchpoint references (non-gating in this draft):

- `docs/wave2/Wave2-W2-S2-TrackC-H2-I-H2-J.md`
- `docs/wave2/Wave2-W2-S2-TrackC-H2-M.md`

---

## Bucket Definitions

1. **Already Enforced Now**
   - only assertions currently enforced in code/tests on Track E surfaces
2. **Observed Structural Expectations**
   - strong operational expectations from current outputs; not all are universally enforced as cross-surface contract law
3. **Track B Confirmation Candidates**
   - candidates for Track B enforceability review in `W2-S3`; not active obligations from this draft

Note:

- some items in bucket 2 are currently enforced as shared eval invariants in `H2-F`/`H2-G`
- this still does not make them core runtime/schema law by default

---

## 1) Already Enforced Now

These assertions are currently enforced in existing code/tests.

### A. Artifact acceptance and replay gating

- run/trace acceptance is a hard preflight gate (`artifact_acceptance`)
- replay readiness is blocked on failed preflight (`artifact_replay`)
- invalid artifact pairs fail loudly and produce replay blockers

Evidence:

- `src/fractal_agent_lab/evals/artifact_acceptance.py`
- `src/fractal_agent_lab/evals/artifact_replay.py`
- `tests/evals/test_artifact_acceptance.py`
- `tests/evals/test_artifact_replay.py`

### B. Stored-artifact smoke gate summary semantics

- `H2-F` smoke pass requires all of:
  - `all_required_variants_present`
  - `all_workflow_matches_expected`
  - `all_artifacts_valid`
  - `all_replay_ready`
  - `all_comparable_outputs_complete`
  - `handoff_linkage_preserved`
  - `all_variant_specific_checks_passed`

Evidence:

- `src/fractal_agent_lab/evals/h1_smoke_suite.py`
- `tests/evals/test_h1_smoke_suite.py`

### C. Baseline/provenance capture readiness semantics

- `H2-G` tag capture ready requires all of:
  - `all_required_variants_present`
  - `all_replay_ready`
  - `all_workflow_matches_expected`
  - `all_roles_assigned`

Evidence:

- `src/fractal_agent_lab/evals/h1_baseline_tags.py`
- `tests/evals/test_h1_baseline_tags.py`

---

## 2) Observed Structural Expectations

These are expected operating conditions from current replay/smoke/tag reality.
They are intentionally documented as expectations, not schema-law declarations.

### A. H1 trio and identity mapping

- replay-backed smoke/tag operations should use the H1 trio:
  - `h1.single.v1`
  - `h1.manager.v1`
  - `h1.handoff.v1`
- observed workflow id should match expected variant identity in replay-backed set loading

### B. Comparable output completeness discipline (false-green protection)

- complete comparable outputs remain required for green structural smoke
- envelope presence alone is not sufficient
- `RF-2026-03-19-02` remains a canonical anti-delusion anchor

Comparable keys currently used:

- `clarified_idea`
- `strongest_assumptions`
- `weak_points`
- `alternatives`
- `recommended_mvp_direction`
- `next_3_validation_steps`

### C. Variant-specific structural shape expectations (shared eval invariants)

- single variant: no manager/handoff reconstruction requirement
- manager variant: manager structure with positive turn count
- handoff variant: handoff structure with positive turn count and non-zero linkage signals

These are currently enforced by `H2-F` smoke logic as shared eval invariants.
They are not declared as core runtime/schema contract law in this draft.

### D. Baseline posture and prompt provenance expectations

- canonical comparison posture should remain:
  - `h1.single.v1` -> `baseline_anchor`
  - `h1.manager.v1` -> `default_multi_agent_reference`
  - `h1.handoff.v1` -> `reference_variant`
- prompt tags remain provenance-only context
- no winner-selection or scoring claims from prompt tags

---

## 3) Track B Confirmation Candidates (`W2-S3`)

These are candidate review points for Track B contract confirmation.
This draft does not enforce them as new contract law.

### A. Candidate: contract-level enforceability boundaries

- which replay/smoke assertions should stay eval-layer only
- which assertions deserve schema-level or contract-level enforceability

### B. Candidate: cross-surface consistency guardrails

- ensure future contract evolution does not weaken:
  - acceptance preflight strictness
  - replay fail-loud behavior
  - comparable-output completeness gates

### C. Candidate: sidecar and additive-surface boundaries

- preserve canonical run/trace truth separation from optional sidecars
- keep optional sidecar artifacts non-canonical unless explicitly re-approved by Track B/Meta

---

## Track C Compatibility Watchpoints (Non-Gating Here)

These are compatibility watchpoints for later review, not acceptance gates inside this draft.

- `H2-I`: session memory loading/snapshots are additive; sidecar is optional, non-canonical
- `H2-J`: manager-pack boundary cleanup should remain preserved during future review
- `H2-M`: identity foundation existence is a dependency context for later epics, not an `H2-H draft` pass/fail gate

---

## Explicit Non-Claims

`H2-H` draft does not claim:

- deterministic rerun equivalence
- same-input rerun/compare guarantees
- final quality winner across variants
- prompt-tag-based quality scoring
- need for canonical run/trace schema mutation to support this draft

---

## Downstream Handoff

- `W2-S2 Step 3` completion target: Track E draft checklist complete
- `W2-S3` next owner for `H2-H` confirmation scope: Track B
- Track B should treat this document as input evidence, not pre-authorized contract law
