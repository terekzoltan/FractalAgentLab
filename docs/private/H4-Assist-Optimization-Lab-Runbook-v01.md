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

That proves H4 can work as a canonical, honesty-preserving artifact path.

It does **not** yet prove that H4 is worth using routinely in the real workflow.

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
- H4 can preserve uncertainty instead of pretending implementation readiness

But does **not** automatically prove:

- H4 is already superior for all real planning tasks
- H4 should be inserted before every track planning step
- H4 is already cheaper in total workflow cost than direct large-model OpenCode planning
- H4 saves operator time on well-scoped implementation tasks
- H4 beats a strong direct OpenCode plan when that plan already has concrete repo context

Practical interpretation of the current strongest evidence:

- the live `CV1-D PASS` proves bounded structural usefulness
- it does not prove net operator ROI
- the artifact is strong at blocking honesty and risk/obligation visibility
- the artifact is weak as a concrete implementation plan when the input bundle is thin
- therefore H4 should be selectively gated, not treated as a default planning pre-step

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

Artifact completeness, manager honesty, and `CV1-D PASS` are necessary but not sufficient for adoption.
They prove that the artifact can be inspected and compared.
They do not prove that the extra workflow step was worth paying for.

---

## Pre-Call ROI Gate

Default posture:

- skip H4 unless the task clears the gate below

Before calling H4, answer these questions:

1. Is the task non-trivial enough that planning/review mistakes would be costly?
2. Is the minimum input bundle already available?
3. Is there a plausible review, handoff, risk, tests/docs, or sequencing benefit that exceeds the extra OpenRouter cost and extra operator step?

If all three are yes, H4 may be recommended.

If only the first is yes, H4 is optional at most.

If the minimum input bundle is missing, classify the task as `input_blocked_for_h4` and usually skip H4.

If the Track already has a concrete, repo-grounded plan and Meta only needs a quick sanity check, skip H4 unless a structured artifact is specifically needed for handoff or audit.

---

## Usage Policy

### Recommended

Use H4 when all are true:

- task complexity is medium/high
- ownership, sequencing, shared-zone, or tests/docs risk is real
- Meta review or session handoff cost is expected to be meaningful
- the minimum input bundle is present
- a structured artifact is likely to avoid rework or clarification loops

Typical examples:

- cross-boundary planning touching runtime, adapters, configs, ops, tracing, or workflow contracts
- Wave/sprint planning where readiness and non-goals are genuinely uncertain
- plan preparation for a handoff between Track sessions
- tasks where false-ready implementation would be expensive

### Optional

Use H4 optionally when:

- the task is medium complexity but direct OpenCode planning is probably enough
- the main benefit is cleaner handoff/review formatting rather than new insight
- there is already a human/freeform draft and H4 is used as a second-pass structure/risk check
- the operator wants a comparison artifact for evaluation purposes

### Skip

Skip H4 when:

- the task is trivial or obvious
- the touched files and validation path are already clear
- the Track already has a concrete plan and only needs a quick review
- the likely H4 output would mostly restate unknowns
- direct OpenCode planning is cheaper and equally actionable

### Input-Blocked

Classify as `input_blocked_for_h4` when H4 lacks the hard minimum input bundle.

In this state, do not count an H4 output as a normal planning win.
An honest missing-input artifact can be useful for governance, but it is usually not cost-justified as the primary planning move.

---

## Minimum Input Bundle

Hard minimum before H4 is likely worth the extra cost:

- exact task identity and intended deliverable
- current repo-visible scope, such as relevant files/directories, branch/diff, changed files, or known affected surfaces
- `ops/Combined-Execution-Sequencing-Plan.md` frontier/readiness context
- `ops/AGENTS.md` ownership/guardrail context

Strong bundle when available:

- relevant local design, track, or delivery docs
- recent review/commit context
- known constraints, non-goals, and blocked prerequisites
- expected validation commands or test families

If only a vague goal is available, direct OpenCode intake should usually happen before H4.
Otherwise H4 will likely produce an honest but low-ROI missing-context artifact.

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

### 6. Actionability versus honesty

Questions:

- Did H4 produce concrete next implementation steps?
- Or did it mostly produce correct missing-input blockers?
- If it mostly produced blockers, was that blocker visibility worth the run cost?
- Would direct OpenCode intake have closed the missing inputs faster?

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

### Class D — Existing strong freeform plan

Example:

- a task where the Track already has a concrete plan with touched surfaces, validation, guardrails, and docs

Goal:

- test whether H4 adds enough risk/review value to justify running after a strong baseline

Expected policy outcome:

- usually optional or skip unless H4 finds materially better risks, blockers, or tests/docs obligations

### Class E — Thin-input request

Example:

- a vague wave/track goal without repo scope, Combined context, AGENTS context, or recent changes

Goal:

- verify that the policy correctly classifies this as `input_blocked_for_h4`

Expected policy outcome:

- usually skip H4 and gather inputs first

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
- `input_bundle_complete`
- `input_blocked_for_h4`
- `h4_artifacts_complete`
- `h4_usefulness_check_outcome`
- `meta_review_faster_yes_no`
- `track_plan_clearer_yes_no`
- `risks_more_explicit_yes_no`
- `tests_docs_more_explicit_yes_no`
- `new_actionable_risks_count`
- `new_tests_docs_obligations_count`
- `review_questions_avoided_count`
- `operator_time_delta_estimate`
- `token_cost_usd`
- `token_cost_justified_yes_no`
- `net_recommendation`

### Suggested value set for `net_recommendation`

- `recommended`
- `optional`
- `not_worth_it`
- `input_blocked_for_h4`

---

## Success Criteria

This lab is successful if it produces a usable policy such as:

- use H4 for medium/high-complexity planning with multiple constraints only when the input bundle and expected review/handoff value justify it
- avoid H4 for trivial or obvious implementation steps
- require a specific input bundle before calling H4
- classify thin-input runs as `input_blocked_for_h4` instead of normal wins
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
  - the minimum input bundle is present
  - direct OpenCode planning is likely to miss or under-document meaningful risk

- do not use H4 when:
  - the step is trivial or obvious
  - the Track already has a clear plan in hand
  - the repo context is too thin and H4 would mostly restate missing inputs
  - the expected benefit is only nicer formatting

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
1. apply a skip-first, ROI-gated stance before recommending H4
2. define a 3-cycle evaluation loop comparing freeform OpenCode planning vs H4 planning on real tasks
3. identify task classes where H4 is likely useful or not useful
4. define what minimum input bundle H4 needs to be worth using
5. classify thin-input cases as input_blocked_for_h4 rather than normal wins
6. define what metrics should be captured after each trial
7. produce a usage policy recommendation:
   - recommended
   - optional
   - not worth it
   - input_blocked_for_h4
8. be skeptical and cost-aware, not promotional

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
