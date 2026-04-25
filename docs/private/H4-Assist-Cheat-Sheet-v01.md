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

## Best Current Use

Use H4 when the task is:

- medium or high complexity
- likely to touch multiple surfaces
- likely to need explicit tests/docs/risk/non-goal framing
- likely to go through Meta review anyway
- likely to benefit from a structured artifact instead of freeform prose

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

Bad examples:

- tiny one-file edits
- obvious bugfixes with a known target
- steps where the Track already has a clean plan and Meta only needs a fast review

---

## Input Rule

H4 becomes much more useful when it receives real context.

Prefer giving it:

- exact task/step identity
- relevant Combined section
- relevant AGENTS ownership/guardrail context
- likely touched files or zones
- recent review/commit context when relevant
- any known constraints/non-goals

If you give it only a vague goal, it will often produce a structurally correct but low-value plan.

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

After using H4, ask:

1. Did this save time overall?
2. Did this make Meta review easier?
3. Did this surface risks or obligations that a freeform plan missed?
4. Was the extra OpenRouter cost justified by the improvement?

If the answer is mostly no, do not force H4 into that task class.

---

## Quick Policy

### Recommended

- medium/high-complexity planning
- shared-boundary planning
- steps likely to benefit from explicit acceptance/test/doc/risk structure

### Optional

- medium tasks where the Track wants extra structure but could proceed without it

### Skip

- trivial steps
- obvious local steps
- cases where freeform OpenCode planning is already clean and sufficient

---

## Final Rule

For Track/OpenCode sessions:

- use H4 when it improves workflow quality enough to justify its extra cost
- skip H4 when it is only adding structure theater

If unsure, treat H4 as **optional**, not mandatory.
