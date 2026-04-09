# Coding-Vertical-Rollout-Plan-v01.md

## Purpose

This document defines the staged rollout for the future Software Delivery Loop vertical.

The rollout is intentionally narrower than the original local pack.
It is designed to fit the current Fractal Agent Lab wave spine without destabilizing it.

---

## Core sequencing rule

The coding vertical is allowed to grow only in this order:

1. design and policy
2. thin planning pilot
3. thin review/gate slice
4. later integrated delivery loop

Do not invert this order.

---

## Mainline prerequisite map

### Before `CV0`

Required:
- `W1-S2-FIX-E1` complete
- `W1-S2-FIX-A1` complete
- `W1-S2-FIX-A2` complete
- `W1-S2-FIX-META1` complete
- `L1-J` complete
- `L1-K` complete
- `L1-L` complete
- `L1-M` complete

Meaning:
- this requirement is now satisfied
- docs-only `CV0` may begin as optional side work while Wave 2 mainline remains primary

### Before `CV1`

Required:
- `CV0` accepted
- `H2-A` through `H2-H` complete

Meaning:
- the first thin H4 pilot waits for stable state/trace/persistence/replay/smoke foundations

### Before `CV2`

Required:
- `CV1` accepted
- coding artifacts are stable enough to compare and review honestly
- commit-gate semantics have at least one credible evidence cycle behind them

Meaning:
- H5 should not arrive before the system can support honest review evidence

---

## `CV0` — Design and policy canonization

**Type:** docs-only batch  
**Primary owners:** Meta Coordinator, then Track C for role/prompt shaping

### Goal

Make the coding vertical canonically real without opening implementation churn.

This batch should also explicitly preserve the current OpenCode-anchored execution reality instead of pretending the lab already owns a full native coding shell.

### Scope

#### `CV0-A` Positioning and boundary canonization
Owner:
- Meta Coordinator

Outputs:
- coding vertical overview doc
- explicit non-goals
- integration boundaries
- future session definitions in `ops/`
- current human-workflow mapping canonization

#### `CV0-B` H4 planning prompt/policy review
Owner:
- Track C

Outputs:
- H4 role sketch (primary)
- H4 prompt-policy notes (primary)
- H5 family alignment note only (no gate-policy rewrite)
- family naming recommendation aligned with repo style
- role behavior consistent with the current human-driven workflow pattern
- explicit note that the near-term execution model is OpenCode-anchored, with hybrid wrapper work only as a later option

#### `CV0-C` H5 review/gate policy review
Owner:
- Meta Coordinator -> Track E review later

Current status note:
- artifact contract finalization has already been completed in current sequencing (`CV0-A` closeout)
- any remaining `CV0-C` activity is review/consistency work, not a net-new contract redesign
- `CV0-C` is explicitly docs-only and does not imply executable `CV2` semantics

Outputs:
- review/gate policy review outcome package
- targeted policy wording and consistency alignment notes
- explicit `CV0-C` -> `CV0-D` handoff note (no `CV2` unlock implied)

#### `CV0-D` CV0 closeout + `CV1` prerequisite note
Owner:
- Meta Coordinator

Outputs:
- reconcile `CV0-B` and `CV0-C` review outcomes
- explicit `CV1` blocked/ready-by-prereq statement
- cross-doc consistency confirmation for coding-vertical policy surfaces

### Acceptance

`CV0` is complete if:

- the coding vertical has canonical docs
- the vertical does not contradict the current repo identity
- the unlock rules for `CV1` and `CV2` are explicit
- privacy and moat boundaries are explicit
- no production-code churn was required to complete the batch

### Recommended session order

1. Meta Coordinator session -> `CV0-A`
2. Track C design session -> `CV0-B`
3. Track E review session -> `CV0-C`
4. Meta Coordinator closeout session -> `CV0-D`, reconcile docs, declare `CV1` ready-by-prereq or still blocked, and keep mainline priority explicit

`CV0-B` reference artifact:

- `docs/private/Coding-Vertical-H4-Planning-Prompt-Review-v01.md`

`CV0-C` reference artifact:

- `docs/private/Coding-Vertical-H5-Review-Gate-Policy-Review-v01.md`

---

## `CV1` — Thin `H4` pilot

**Type:** narrow executable planning slice  
**Primary owners:** Track C, Track D support, Track E for baseline/eval

### Goal

Prove that repo-aware planning can become a first-class artifact workflow without overbuilding the coding vertical.

This is the first thin automation slice of the current `WAVE START` / `SEQ NEXT` style loop.

Success should not mean "the plan sounds nicer".
Success should mean:

- the plan is more grounded in repo reality
- false-ready outputs decrease
- touched surfaces are clearer
- test/docs obligations are more explicit
- the result is easier to review and audit afterward

### Scope

#### `CV1-A` `WAVE START` context refresh + repo intake
Owner:
- Track C

Outputs:
- normalized task brief
- `context_report.json`
- current frontier refresh
- repo-intake summary
- affected surfaces
- likely touched files
- unknowns and assumptions

Automation stance:

- partially automated companion step
- should refresh context and reduce stale assumptions
- should still allow manual OpenCode judgment when repo reality needs deeper checking

#### `CV1-B` `SEQ NEXT` planning artifact
Owner:
- Track C

Outputs:
- explicit `implementation_plan.md`
- explicit `acceptance_checks.json`
- embedded risk section inside the plan for the first executable slice

Automation stance:

- stronger automation than `CV1-A`
- should act as the main readiness + detailed-plan companion workflow

#### `CV1-B2` H4-adjacent plan review mode (`TERV REVIEW`)
Owner:
- Meta Coordinator or planning/review role using H4 surfaces

Outputs:
- plan critique / readiness critique / sequencing critique
- findings-first review of the plan itself
- required changes
- blockers
- build-mode readiness note

Boundary:
- this is not code review
- this is not implementation review
- this is H4-adjacent structured plan critique

#### `CV1-C` Minimal repo-tool wrapper surface
Owner:
- Track D

Outputs:
- only the smallest helper set needed for the H4 pilot
- repo snapshot helper
- changed-surface helper
- touched-files / touched-zones helper
- artifact-writing helper

Clarification:
- wrapper work here means thin standard helpers around repeated repo operations
- it does not mean replacing OpenCode as the main execution shell
- it must not become a broad repo tool garden or shell replacement

#### `CV1-D` Thin baseline/eval check
Owner:
- Track E

Outputs:
- simple baseline or rubric showing whether H4 artifacts are materially better than an unstructured one-shot plan
- reviewability / anti-false-ready / touched-surface usefulness checks where practical

#### Role boundary note

In near-term execution:

- OpenCode sessions remain the main implementation operators
- `CV1` is a planning companion layer, not a repo-writing replacement
- future `fal` commands may support the current personal Meta-style / track-style operating pattern where useful, but they remain explicit helper workflows rather than universal autonomous shells

### Acceptance

`CV1` is complete if:

- H4 can produce grounded planning artifacts from real repo context
- the plan names risks and unknowns explicitly
- the artifact set is more inspectable than a freeform planning answer
- the required tool surface remains small and honest
- the pilot still feels like the current Combined-driven planning loop, not a detached planner fantasy
- touched-surface mapping is materially clearer than ad hoc planning
- test/docs obligations are more explicit and easier to review
- false-ready planning behavior is reduced

### Anti-scope rule

`CV1` must not include:

- autonomous implementation
- commit authority
- complex handoff-heavy coding swarms
- broad repo-tool platformization

### Recommended session order

1. Track C session -> `CV1-A`, `CV1-B`
2. Track D session -> `CV1-C`
3. Track E session -> `CV1-D`
4. Meta Coordinator session -> `CV1-META1`, evaluate whether `CV2` should remain blocked

---

## `CV2` — Thin `H5` review/gate slice

**Type:** narrow executable review/governance slice  
**Primary owners:** Track E, Track C support, Track D for evidence/tool boundaries

### Goal

Prove that findings-first review and explicit commit gating can be artifactized honestly.

This is the first thin automation slice of the current `REVIEW` -> commit-decision loop.

Near-term interpretation:

- implementation itself remains primarily OpenCode-session work
- `CV2` should first prove review usefulness and evidence legibility before any stronger gate authority is considered

### Scope

#### `CV2-A` Findings-first review artifact
Owner:
- Track E

Outputs:
- structured review findings
- severity ordering
- residual risks
- testing gaps

#### `CV2-B` Evaluator artifact + embedded test evidence
Owner:
- Track E, with Track D support for evidence/tool boundary questions

Outputs:
- plan-adherence / evidence-sufficiency assessment
- embedded structured test-evidence section
- reasoned note when tests are not run

Boundary:
- do not require a separate `test_evidence.json` in the first executable slice unless evidence later shows it is worth the overhead

#### `CV2-C` Advisory commit-gate output (optional first slice)
Owner:
- Track E

Outputs:
- `pass` / `pass_with_warnings` / `hold`
- blockers
- warnings
- required actions

Boundary:
- advisory only
- no automatic commit authority
- acceptable to delay or keep minimal in the very first executable slice if review/evaluator usefulness still needs proving

#### `CV2-D` Policy feedback loop
Owner:
- Meta Coordinator

Outputs:
- note on whether new findings should update planning/gate policy
- note on whether evidence belongs in the private learning loop

### Acceptance

`CV2` is complete if:

- the review output is findings-first and severity-legible
- the evaluator output makes evidence sufficiency legible
- any gate output is explicit, evidence-backed, and clearly advisory
- the system can say `hold` honestly without pretending progress is green
- at least one cycle feeds back into private learning without overfitting a single run
- the slice preserves the current human expectation that review precedes commit and may refuse commit cleanly

### Anti-scope rule

`CV2` must not imply:

- automatic commit authority by default
- FAL becoming the primary implementer
- production-ready unattended coding
- full enterprise governance productization

### Recommended session order

1. Track E session -> `CV2-A`
2. Track E session -> `CV2-B`
3. optional Track E session -> `CV2-C`
4. Meta Coordinator session -> `CV2-D` and policy feedback

---

## `CV3` — Later orchestration expansion and harder delivery chaining

**Type:** later vertical expansion  
**Primary owners:** mixed by scope

### Goal

Extend the coding vertical beyond the first thin slices without turning it into an opaque delivery fantasy.

Practical focus:

- keep `CV1` and `CV2` useful and inspectable
- only then explore richer orchestration shapes where evidence says they help

### Possible later scope

- H4 -> H5 chaining
- coding-specific benchmarks
- selected orchestration expansion tied to the project-wide orchestration ladder:
  - `O1` manager-first remains the safe default
  - `O2` handoff can be added for narrow specialist transfer where it improves clarity
  - `O3` parallel fan-out / fan-in becomes the likely first real `CV3` expansion for critique-heavy planning/review
  - `O4` workflow graph remains the later hardening path, not the early default
- later workbench/report surfaces

Important current bias:

- no assumption that FAL should become the primary implementer
- OpenCode remains the main implementation shell unless strong future evidence argues otherwise

### Blockers before entry

- H4/H5 artifacts must already be trustworthy
- the private learning loop must contain real evidence, not only speculation
- the project must still remain legible as a layered engine/research-OS system
- richer orchestration should be justified by measured usefulness, not by agent-count aesthetics

---

## Execution summary

The intended order is:

1. close Wave 1
2. run `CV0`
3. finish enough of Wave 2 to support honest artifact/replay/smoke discipline
4. run `CV1`
5. only later run `CV2`
6. treat `CV3` as earned expansion, not a promise
