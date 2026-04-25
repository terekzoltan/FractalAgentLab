# H4-Assist-Optimization-Lab-Runbook-v01

## Purpose

This document defines a dedicated OpenCode workstream for improving H4 as a practical
planning companion.

The question is not:

> can H4 run?

That has already been demonstrated.

The real question is:

> does H4 improve the operator workflow enough to justify its extra cost and operational overhead?

This runbook is therefore explicitly ROI-focused.

---

## Why This Lab Exists

The project now has a thin executable H4 stack:

- `CV1-A` = `h4.wave_start.v1`
- `CV1-B` = `h4.seq_next.v1`
- `CV1-C` = thin `wave_start` packet/helper surface
- `CV1-D` = usefulness check
- `CV1-META1` = Meta closeout

Live OpenRouter hardening also reached one canonically complete and usefulness-`PASS`
evidence run for `h4.seq_next.v1`.

That proves H4 can work.

But it does **not** yet prove that H4 is worth using routinely in the real workflow.

This matters because the operator model-cost reality is asymmetric:

- direct OpenCode usage with large OpenAI/ChatGPT models is already largely covered by an existing subscription
- Fractal Agent Lab usage on OpenRouter is an additional, marginal out-of-pocket cost

Therefore H4 should not be judged only on “works vs does not work”.
It should be judged on:

- whether it saves meaningful operator time
- whether it improves planning clarity or reviewability enough to matter
- whether it reduces rework, ambiguity, or coordination friction
- whether it does that often enough to justify the extra token spend

---

## Strategic Stance

Treat H4 as a **planning companion**, not a replacement planner and not a prestige demo.

If H4 does not materially improve the existing OpenCode-centered workflow, it should remain optional and narrow.

This lab should therefore optimize toward:

- practical usefulness
- lower ambiguity
- lower follow-up burden
- lower review friction
- bounded cost

Not toward:

- “more AI layers”
- bigger orchestration for its own sake
- longer artifacts by default
- autonomous-planner theater

---

## Current Truth To Start From

### Proven positives

- H4 can emit canonical planning artifacts
- `h4.seq_next.v1` now has one live OpenRouter run with:
  - full manager chain
  - full canonical seq-next artifact set
  - `CV1-D` usefulness `PASS`

Relevant evidence run:

- `a887ffe1-617b-426b-a1bf-d7263d022673`

Relevant artifacts:

- `data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/implementation_plan.md`
- `data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/acceptance_checks.json`

Relevant hardening note:

- `docs/private/H4-SeqNext-Live-Hardening-Summary-v01.md`

### Important remaining caveat

The strongest demonstrated H4 plan so far is still heavily constrained by missing repo inputs.

That means current evidence proves:

- H4 can be honest
- H4 can be structured
- H4 can be reviewable

But does **not** automatically prove:

- H4 is already superior for all real planning tasks
- H4 should be inserted before every track planning step
- H4 is already cheaper in total workflow cost than direct large-model OpenCode planning

---

## Main Optimization Question

For each candidate use case, ask:

> is H4 making the workflow better enough to justify its extra token cost and operator complexity versus direct OpenCode planning?

If the answer is not clearly yes, narrow or stop its use.

---

## Decision Rule

H4 is worth using only if it improves at least one of these enough to matter:

1. planning clarity
2. risk visibility
3. tests/docs obligation visibility
4. anti-false-ready honesty
5. Meta review speed
6. handoff legibility between sessions or tracks
7. net operator time saved

And it must do that without causing too much of this:

1. duplicate planning work
2. generic/noisy artifact output
3. extra coordination overhead
4. token burn with little incremental value
5. confusing operator truth by being too abstract or too detached from repo state

---

## Optimization Goal

The goal of this lab is to move H4 from:

- “interesting, structured, sometimes useful”

to:

- “selectively worth using on real tasks because it materially improves planning output or reduces coordination cost”

---

## Evaluation Axes

Judge H4 on these axes against direct OpenCode freeform planning.

### 1. Artifact usefulness

Questions:

- Is the resulting plan easier to review?
- Does it surface blockers and non-goals more reliably?
- Are tests/docs obligations more explicit?
- Are risks usefully structured instead of just verbose?

### 2. Operator time impact

Questions:

- Did H4 save time overall?
- Or did it just add one extra planning step before the real planning happened?
- Did Meta review become faster because the artifact was better structured?

### 3. Token cost effectiveness

Questions:

- Is the improvement large enough to justify incremental OpenRouter spend?
- Would the same result have been easier with a direct large-model OpenCode prompt?
- Is H4 cheaper enough relative to the avoided rework or clarification loops?

### 4. Input sensitivity

Questions:

- How much repo context must be supplied before H4 becomes truly useful?
- Does it only become good when the operator already did most of the real intake work manually?
- If so, does it still save enough value downstream?

### 5. Workflow insertion value

Questions:

- Which task types benefit from H4?
- Which task types are better handled directly by the Track/OpenCode session?
- Is H4 best used before the Track writes a plan, or after a first human draft as a structuring pass?

---

## Recommended Task Classes To Test

Do not test only one task.
Use at least three real task shapes.

### Class A — Medium planning step with multiple constraints

Example:

- a Wave step like `P4-A`, `P4-B`, or `P4-C`

Goal:

- see if H4 adds value through structure, risks, and obligations

### Class B — Shared-boundary or higher-collision planning step

Example:

- a step that touches shared CLI/runtime/adapter/doc surfaces

Goal:

- see if H4 is especially useful when ownership and caution fields matter

### Class C — Simple step

Example:

- a narrow implementation step with obvious touched files

Goal:

- verify whether H4 is overkill here and should be avoided

This is important.
If H4 is bad for simple tasks, that is not failure.
That may simply define where it should not be used.

---

## 3-Cycle Feedback Loop

Run the lab in three cycles.

### Cycle 1 — Establish baseline usefulness reality

For one real task:

1. create a direct freeform OpenCode plan
2. create an H4 `seq_next` plan
3. compare:
   - clarity
   - risks
   - obligations
   - reviewability
   - operator time
   - token cost impression
4. record whether H4 was actually worth the extra step

Goal:

- establish honest baseline, not a marketing claim

### Cycle 2 — Improve insertion and input policy

Based on Cycle 1:

1. refine what minimal inputs H4 actually needs
2. refine when to call H4 and when not to
3. refine artifact reading/usage expectations
4. re-test on a second task type

Goal:

- improve the workflow around H4, not just the prompts

### Cycle 3 — Decide keep/narrow/stop policy

After at least three tasks:

1. identify where H4 is net-positive
2. identify where it is neutral or negative
3. decide:
   - recommend for certain task classes
   - optional for certain classes
   - avoid for certain classes

Goal:

- operational usage policy, not abstract optimism

---

## Concrete Metrics To Capture

Do not rely only on vibes.
For each task, capture a short row with these fields.

### Required fields

- `task_id`
- `task_type`
- `same_task_intent_asserted`
- `freeform_plan_path`
- `h4_run_id`
- `h4_artifacts_complete`
- `h4_usefulness_check_outcome`
- `meta_review_faster_yes_no`
- `track_plan_clearer_yes_no`
- `risks_more_explicit_yes_no`
- `tests_docs_more_explicit_yes_no`
- `operator_time_delta_estimate`
- `token_cost_justified_yes_no`
- `net_recommendation`

### Suggested value set for `net_recommendation`

- `recommended`
- `optional`
- `not_worth_it`

---

## Success Criteria

This lab is successful if it produces a usable policy such as:

- use H4 for medium/high-complexity planning with multiple constraints
- avoid H4 for trivial or obvious implementation steps
- require specific input bundle before calling H4
- treat H4 as a planning-structure pass, not as a replacement for Track reasoning

This lab is **not** successful if it only proves that H4 can produce long artifacts.

---

## Stop Criteria

Stop or narrow H4 usage if, after three meaningful cycles, one or more of these remain true:

- H4 rarely saves operator time
- H4 adds structure but not enough value to justify token spend
- freeform OpenCode planning is consistently just as good or better
- H4 only becomes useful after the operator already did nearly all the real intake work manually
- Meta review is not materially easier with the H4 artifact

If that happens, preserve H4 as a narrow niche tool or pause expansion.

---

## Recommended Practical Policy If Results Are Mixed

Even if H4 is not broadly worth it, a mixed result can still justify a narrow policy.

Example narrow policy:

- use H4 only when:
  - step complexity is medium or high
  - multiple ownership zones or test/doc obligations are likely
  - Meta review cost is expected to be significant

- do not use H4 when:
  - the step is trivial or obvious
  - the Track already has a clear plan in hand
  - the repo context is too thin and H4 would mostly restate missing inputs

---

## Session Role

Suggested dedicated OpenCode session name:

- `H4-Assist-Optimization-Lab`

This session should act like a skeptical optimizer, not a fan of the system.

It should try to answer:

- where is H4 genuinely useful?
- where is it wasteful?
- how should it be used, if at all?

---

## Suggested Session Prompt Core

```text
You are a dedicated OpenCode session named H4-Assist-Optimization-Lab.

Your purpose is not to prove that H4 is cool.
Your purpose is to determine whether H4 is actually worth using in the real operator workflow, given that:

- direct OpenCode planning can already use large models through an existing ChatGPT/OpenAI subscription
- Fractal Agent Lab usage on OpenRouter is incremental extra cost

So the real question is ROI:
- does H4 improve planning/reviewability/coordination enough to justify its extra token cost and extra workflow step?

Important framing:
- do not optimize for AI theater
- do not optimize for longer artifacts by default
- do not assume H4 should be used everywhere
- be willing to conclude that H4 is only worth using for certain task classes, or not worth using broadly

Current known context:
- CV1 H4 pilot exists and is closed
- live OpenRouter hardening reached at least one canonically complete seq_next run with CV1-D PASS
- strong evidence run: a887ffe1-617b-426b-a1bf-d7263d022673
- useful artifacts exist for that run:
  - data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/implementation_plan.md
  - data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/acceptance_checks.json
- current question is not “can it run?”
- current question is “where does it actually help enough to be worth it?”

Your job:
1. define a 3-cycle evaluation loop comparing freeform OpenCode planning vs H4 planning on real tasks
2. identify task classes where H4 is likely useful or not useful
3. define what minimum input bundle H4 needs to be worth using
4. define what metrics should be captured after each trial
5. produce a usage policy recommendation:
   - recommended
   - optional
   - not worth it
6. be skeptical and cost-aware, not promotional

Primary references:
- docs/private/H4-SeqNext-Live-Hardening-Summary-v01.md
- data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/implementation_plan.md
- data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/acceptance_checks.json
- docs/private/Coding-Vertical-Rollout-Plan-v01.md
- docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md
- docs/private/Coding-Vertical-Learning-Loop-v01.md

Definition of done:
- produce a practical H4 assist usage policy grounded in time/cost/usefulness tradeoffs
- identify where H4 should be used, where it should be optional, and where it should be skipped
```

---

## Final Note

The value of this lab is not proving that H4 can generate planning artifacts.

The value of this lab is deciding whether H4 deserves a real place in the operator workflow.
