# Wave1-L1-L-H1-Decision-Log.md

## Purpose

This document records the Meta closeout decision for Wave 1 epic `L1-L`.

Track E owned evidence preparation.
Meta owns the final decision-log closeout and coordination implications.

---

## Decision

For the next mainline phase, `h1.manager.v1` becomes the **default next baseline multi-agent reference path**.

This is a coordination default, not an absolute quality winner claim.

The supporting stance is:

- `h1.single.v1` remains the explicit baseline anchor
- `h1.manager.v1` becomes the default next multi-agent reference path
- `h1.handoff.v1` remains the inspectable handoff/reference variant

---

## Evidence consumed

Primary evidence:

- `docs/wave1/Wave1-L1-I-H1-Smoke-Comparison.md`
- `docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md`
- `docs/wave1/Wave1-L1-L-H1-Evidence-Prep.md`

Supporting visibility/provenance surfaces:

- `docs/wave1/Wave1-L1-J-Trace-Viewer.md`
- `docs/wave1/Wave1-L1-M-H1-Prompt-Version-Tagging.md`

Meta validation check at closeout time:

- matched-input evidence prep script returns structurally ready output
- targeted W1-S3 tests pass for trace viewer, prompt tags, evidence prep, smoke comparison, and summary parity

---

## Why this decision was made

### Why not `h1.single.v1`

`h1.single.v1` is valuable because:

- it is the simplest path
- it remains the cleanest baseline anchor
- it is useful for anti-self-deception comparison

But it is not the preferred next multi-agent reference path because:

- it does not exercise orchestration behavior meaningfully
- it cannot carry the main learning burden for Wave 2+ multi-agent engine hardening

### Why `h1.manager.v1`

`h1.manager.v1` is selected because:

- structural smoke evidence is green
- artifact validation is green
- manual smoke rubric can pass cleanly
- manager turns and worker usage remain explicitly inspectable
- it is the most useful current bridge between simplicity and orchestrated behavior

### Why not `h1.handoff.v1` as the default

`h1.handoff.v1` is valuable because:

- it makes chain/hop behavior very visible
- handoff linkage is now inspectable end-to-end
- it is a strong learning/reference variant

But it is not the default next baseline because:

- it introduces more orchestration-specific complexity than is necessary for the next mainline default
- the current evidence supports it as a strong reference variant, not yet the preferred default hardening path

---

## Important limits

This decision does **not** claim:

- a universal quality winner
- cross-provider superiority
- benchmark-backed superiority
- that prompt-tag differences are quality scores

Prompt provenance remains provenance only.
Mock-backed smoke evidence remains structural evidence, not final product-proof quality ranking.

---

## Coordination implications

### Wave 1 closeout result

Wave 1 core closeout is accepted as complete.

Meaning:

- `L1-J` complete
- `L1-K` complete
- `L1-L` complete
- `L1-M` complete

Optional identity prep (`L1-N` / `L1-O`) remains optional and design-only.
It does not block the mainline frontier from moving forward.

### Mainline next frontier

The mainline frontier now moves to Wave 2 Sprint `W2-S1`:

- `H2-A`
- `H2-B`
- `H2-C`
- then `H2-D`

### Side-vertical implication

Because Wave 1 core closeout is now complete, docs-only `CV0` coding-vertical design work is now allowed as optional side work.

This does **not** replace the mainline Wave 2 frontier.

---

## Meta recommendation

Use this default posture going forward:

- baseline anchor: `h1.single.v1`
- default next multi-agent reference path: `h1.manager.v1`
- handoff learning/reference path: `h1.handoff.v1`

Re-evaluate later when at least one of these becomes true:

- non-mock provider evidence exists
- replay/benchmark evidence becomes stronger
- Wave 2/3 work materially changes orchestration tradeoffs

---

## Decision status

- `L1-L` = ✅ complete
- decision confidence = `medium`
- revisit trigger = stronger non-mock and/or benchmark evidence
