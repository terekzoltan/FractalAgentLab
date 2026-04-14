# Track-E-Runbook.md

## Purpose

This runbook defines how Track E should operate as the eval / replay / QA / bench
track.

Use it together with:

- `ops/Track-Implementation-Runbook.md`
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`

---

## Track Mission

Track E owns measurement, replay, and structural usefulness validation.

Primary responsibilities:

- replay tools
- comparison surfaces
- smoke checks and manual rubrics
- acceptance gates
- additive evaluation evidence

Track E should not own:

- core provider implementation
- prompt authoring beyond eval/judge roles
- presentation UX beyond evidence output support

---

## What Track E Should Optimize For

Track E should prefer:

- validated stored-artifact truth
- structural honesty over attractive reports
- replay-backed evidence where possible
- additive compare/report surfaces instead of new canonical runtime truth
- explicit limits instead of benchmark theater

---

## Typical Readiness Conditions

Track E is usually `READY` when:

- the relevant workflow artifacts are stable enough to replay or inspect
- output law is real enough to write an honest smoke or compare surface

Track E is usually `READY with guardrails` when:

- the workflow is draft-usable but not yet fully frozen
- evidence is structural only and should not be overclaimed as quality ranking

Track E is usually `NOT READY` when:

- the workflow/output surface is still too unstable to compare honestly
- the request would require new workflow implementation rather than eval/replay work

---

## Standard Implementation Pattern

Track E should usually work in this order:

1. confirm the exact canonical artifacts and contracts being consumed
2. define the minimal comparison, replay, or rubric surface
3. add failure-path coverage so incomplete evidence cannot pass green
4. document known limits and non-goals explicitly
5. update coordination surfaces without implying unsupported benchmark claims

---

## Track-E Guardrails

- do not let additive reports become canonical runtime truth
- prefer replay-backed or validated-run evidence over ad hoc examples
- do not claim artifact paths from surfaces that do not emit them
- keep prompt provenance as evidence unless a gate explicitly owns it
- avoid winner-scoring or benchmark language unless the repo really has that surface
- preserve false-green resistance when compare completeness or template-law matters

---

## Expected Validation

Track E validation should usually include:

- replay/acceptance tests
- compare/projection tests
- negative-path tests for incomplete or structurally invalid outputs
- relevant workflow-family regressions when compare contracts depend on them
- script smoke when a script is part of the deliverable surface

If the report is structural-only, the wording should say so.

---

## Typical Deliverables

Track E delivery docs should usually state:

- what evidence surface was added or finalized
- what canonical artifacts it consumes
- what is measured structurally vs what is still not measured
- validation commands
- known limits
- downstream handoff expectations

Track E should optimize for truthful evidence, not persuasive overclaim.
