# H4-Assist-Cheat-Sheet-v01

## Purpose

Short operator guide for **Track sessions** and other **OpenCode sessions** on when H4 is worth using as an assist layer.

This is not a product claim.
This is a usage policy cheat sheet.

---

## What H4 Is

H4 is a **planning companion**.

Use it to improve:

- plan structure
- risk visibility
- tests/docs obligation visibility
- anti-false-ready honesty
- handoff/review legibility

Do **not** treat it as:

- the main implementer
- a replacement for direct OpenCode reasoning
- mandatory for every task

---

## Default Posture

Default to **skip** unless H4 is likely to repay its extra cost.

H4 is useful when it reduces planning/review/handoff risk.
It is wasteful when it only adds a paid formatting step before normal OpenCode planning.

The current strongest live evidence proves canonical, honest, reviewable artifact generation.
It does not prove that H4 saves time or should be run before every planning task.

---

## Best Current Use

Use H4 when the task is:

- medium or high complexity
- likely to touch multiple surfaces
- likely to need explicit tests/docs/risk/non-goal framing
- likely to go through Meta review anyway
- likely to benefit from a structured artifact instead of freeform prose
- backed by enough repo/context input for H4 to say something actionable

Good examples:

- Wave/sprint planning steps
- cross-boundary or shared-surface steps
- steps with real sequencing/ownership/validation complexity

---

## Avoid H4 When

Do **not** use H4 by default when the task is:

- trivial
- already obvious to the Track
- a tiny local implementation step
- so clear that a direct freeform plan is enough
- likely to spend more tokens than it saves in follow-up work
- missing the context needed for a useful plan

Bad examples:

- tiny one-file edits
- obvious bugfixes with a known target
- steps where the Track already has a clean plan and Meta only needs a fast review
- vague wave/track goals with no repo scope, no Combined context, and no AGENTS context

---

## Input Rule

H4 should usually not be called unless it receives real context.

Hard minimum:

- exact task/step identity
- intended deliverable
- current repo-visible scope, such as likely files, directories, changed surfaces, branch/diff, or changed-file context
- relevant `ops/Combined-Execution-Sequencing-Plan.md` frontier/readiness context
- relevant `ops/AGENTS.md` ownership/guardrail context

Strong additions:

- relevant design, track, or delivery docs
- recent review/commit context when relevant
- any known constraints/non-goals
- expected validation commands or test families

If the hard minimum is missing, classify the task as `input_blocked_for_h4` and usually skip H4.

If you give H4 only a vague goal, it will often produce a structurally correct but low-value missing-input plan.

---

## Output Expectation

Expect H4 to be useful when it gives you:

- clearer risks than a freeform plan
- clearer blockers/non-goals
- clearer tests/docs obligations
- cleaner planning artifact for Meta review

Be skeptical if it mostly gives you:

- generic planning prose
- repeated obvious caveats
- no stronger file/surface clarity than the freeform plan
- extra structure without extra decision value
- correct blockers that direct OpenCode intake could have resolved faster

---

## Recommended Operating Modes

### 1. Track session uses H4 before implementation planning

Use when:

- the task is non-trivial
- the Track wants a structured artifact before coding

### 2. Meta uses H4 as a comparison/control artifact

Use when:

- a plan needs to be compared against a freeform baseline
- usefulness/clarity/reviewability is being evaluated

### 3. Session-to-session handoff support

Use when:

- a structured plan artifact makes fork/merge or compact recovery easier

---

## Decision Rule

Before using H4, ask:

1. Is the task non-trivial enough that planning/review mistakes would be costly?
2. Is the minimum input bundle present?
3. Is H4 likely to improve risk, tests/docs, sequencing, handoff, or Meta review enough to justify the extra OpenRouter cost?

If any answer is no, do not make H4 the default move.

After using H4, ask:

1. Did this save time overall?
2. Did this make Meta review easier?
3. Did this surface risks or obligations that a freeform plan missed?
4. Was the extra OpenRouter cost justified by the improvement?

If the answer is mostly no, do not force H4 into that task class.

---

## Quick Policy

### Recommended

- medium/high-complexity planning with a complete input bundle
- shared-boundary planning where ownership, sequencing, or validation mistakes would be expensive
- steps likely to benefit from explicit acceptance/test/doc/risk structure and Meta review reuse
- handoff-heavy work where a canonical artifact is likely to reduce clarification loops

### Optional

- medium tasks where the Track wants extra structure but could proceed without it
- second-pass structure/risk review of an existing human/freeform plan
- comparison/control artifacts for evaluation

### Skip

- trivial steps
- obvious local steps
- cases where freeform OpenCode planning is already clean and sufficient
- tasks missing the minimum input bundle
- cases where H4 would mostly restate unknowns instead of resolving planning risk

### Input-Blocked

Use `input_blocked_for_h4` when required context is missing.

This is not an H4 failure.
It means direct repo intake should happen first, or H4 should be skipped for that task.

---

## Final Rule

For Track/OpenCode sessions:

- use H4 when it improves workflow quality enough to justify its extra cost
- skip H4 when it is only adding structure theater
- treat artifact completeness and `CV1-D PASS` as necessary but not sufficient for real ROI

If unsure, treat H4 as **optional**, not mandatory.
