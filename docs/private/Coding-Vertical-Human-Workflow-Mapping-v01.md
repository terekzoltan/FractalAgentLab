# Coding-Vertical-Human-Workflow-Mapping-v01.md

## Purpose

This document makes one core point explicit:

> the Software Delivery Loop exists to formalize and gradually automate the current human-driven workflow already used in this project

The coding vertical is therefore not an abstract coding-bot idea.
It is a structured evolution of the current Meta + track workflow.

---

## Current human workflow

The current operating pattern already has a recognizable shape.

Typical commands or intents include:

- `WAVE START`
- `SEQ NEXT`
- `IMPLEMENT`
- `REVIEW`
- `REVIEW JAVIT`
- `TERV REVIEW`
- `TERV REVIEW UTAN`
- `FORK MERGE`
- `COMPACT`
- `REMINDER`
- explicit commit decision or commit refusal

The workflow is not prompt-only.
It already depends on:

- current repository reality
- current wave/sprint/track status
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- specialized stabilization or design docs
- recent review findings and acceptance history

---

## Current sources of truth in practice

When the current human workflow is operating correctly, it follows this order:

1. actual repository state
2. `ops/Combined-Execution-Sequencing-Plan.md`
3. `ops/AGENTS.md`
4. specialized docs and stabilization plans
5. recent review/evidence context
6. the immediate user prompt

This matters because the future coding vertical must preserve this behavior.
It must not replace it with freeform prompt-following.

---

## Prompt-to-system mapping

### `WAVE START`

Current meaning:
- refresh project context after many repo changes
- recover the live frontier
- detect what is actually next

Future system mapping:
- Meta `full-sweep`
- later `H4` context refresh / repo intake artifact

### `SEQ NEXT`

Current meaning:
- verify whether a requested task is truly unblocked
- map the task against the current wave/sprint/track state
- produce a detailed implementation plan from repo truth

Future system mapping:
- `H4` sequencing-aware planning artifact
- explicit `READY` / `NOT READY` / blocked-prereq reporting when relevant

### `IMPLEMENT`

Current meaning:
- execute against an accepted plan
- respect track/session ownership and live repo constraints
- document what changed and why

Future system mapping:
- later constrained implementation path
- plan-following with explicit deviation reporting

### `REVIEW`

Current meaning:
- inspect implementation deeply
- prioritize bugs, regressions, risks, and missing tests
- refuse commit when findings are serious

Future system mapping:
- `H5` findings-first review artifact
- explicit residual-risk and testing-gap surface

### commit decision

Current meaning:
- commit only if the state is actually safe enough
- otherwise hold and explain why

Future system mapping:
- `H5` explicit commit-gate artifact
- `pass` / `pass_with_warnings` / `hold`

---

## Required workflow disclosures

The current human workflow should already act as if future H4/H5 truthfulness rules exist.

That means substantial planning, review, and gate outputs should declare:

### 1. Execution mode

Use one of:

- `manual_policy_driven`
- `opencode_assisted`
- `actual_fal_workflow_run`

Purpose:

- prevent automation theater
- make it obvious whether the result came from policy-guided human/tool work or an actual Fractal workflow invocation

### 2. Visibility / audit state

State explicitly:

- whether the conclusion relied only on git-visible files
- whether ignored/local-only docs or `data/` artifacts were consulted
- whether any decision depends on evidence that will not appear in normal git review flow

Purpose:

- prevent audit blind spots
- keep review and gate decisions honest when important evidence exists outside normal git visibility

---

## Minimal turn packets

The recurring human loop should emit a minimal structured packet even before H4/H5 are executable.

### `WAVE START`

Minimum packet:

- current frontier
- completed previous step(s)
- blockers / holds
- next recommended action

### `SEQ NEXT`

Minimum packet:

- `READY` / `NOT READY` / `READY with guardrails`
- prerequisites checked
- touched surfaces
- expected tests/docs
- key risks or non-goals

### `IMPLEMENT`

Minimum packet:

- accepted scope
- touched files
- deviations from plan
- validations run
- open risks

### `REVIEW`

Minimum packet:

- findings first
- residual risks
- testing gaps
- gate decision
- brief explanation of what landed and what the changed pieces do
- practical operator testing note for real/sim usage when meaningful
- extra risk/readiness summary only if it adds signal; do not force summary theater

### commit decision

Minimum packet:

- `pass` / `pass_with_warnings` / `hold`
- reason
- staged scope summary
- anything intentionally excluded

These packets reduce repeated cognitive overhead and make the current workflow easier to formalize later.

Near-term target:

- make these packets cheap enough that the operator usually only needs light approval or Enter
- keep packet transport cheaper without hiding the real source-of-truth checks

---

## Practical shorthand variants

The current human loop also uses short operator shorthands that should be treated as structured variants, not freeform chat noise.

Recommended canonical base packet ids:

- `wave_start`
- `seq_next`
- `implement`
- `review`
- `review_fix`
- `plan_review`
- `plan_review_after`
- `fork_merge`
- `compact`
- `commit_decision`
- `reminder`

Recommended modifiers/options:

- `deep`
- `step`
- `parallel`
- `forked`
- `question_me`
- `commit_if_clean`
- `no_edit_except_commit`
- `track_message_required`

Interpretation rule:

- the semantic packet family should be canonical
- operator prose may stay richer and more personal on top of that family

### `REVIEW` deep variant

Typical intent:

- do a deep review
- use subagents if helpful
- explain what was implemented and how it works
- mention useful real/sim test paths for the operator
- commit only if no major findings remain
- otherwise hold and explain

This means the packet should additionally include:

- implementation surface summary
- practical test/use instructions when meaningful
- explicit `commit` / `hold` outcome
- explicit note that no code changes should be made during the review except the eventual commit

Example mapping:

- notebook shorthand `MINI/STEP REVIEW` -> `review` + `step`
- notebook shorthand `QUESTION ME` -> interaction-policy flag, not a separate base packet type

### `REVIEW JAVIT`

Typical intent:

- only fix the review findings from the previous round
- rerun validation
- rerun a lighter review/gate check
- then commit if clean

Required packet additions:

- narrowed fix scope
- list of findings being fixed
- validation rerun summary
- post-fix residual risk note

### `TERV REVIEW`

Typical intent:

- do a structured implementation-plan review
- treat it as Meta-style plan critique, not implementation review
- check readiness, sequencing, scope honesty, touched surfaces, test/docs obligations, and guardrails

Required packet additions:

- findings first
- verdict (`READY` / `NOT READY` / `READY with guardrails`)
- open questions or assumptions
- Meta guidance
- track-facing summary or handoff message

### `TERV REVIEW UTAN`

Typical intent:

- hand the reviewed plan back to the owning track for correction or confirmation before build mode

Required packet additions:

- reviewed plan outcome
- required changes
- blockers
- build-mode readiness note

### `IMPLEMENT`

Typical intent:

- execute against an accepted plan in the repo

Required packet additions:

- accepted scope reference
- touched files
- deviations from plan
- validations run
- open risks

Near-term boundary:

- actual repo implementation remains primarily OpenCode-session work
- Fractal Agent Lab may later support artifact/review/eval structure around this loop, but it does not replace the main implementation shell early

### `REMINDER`

Typical intent:

- refresh role discipline
- reload the relevant coordination docs
- continue in the correct track/meta role

Required packet additions:

- role being assumed
- docs/surfaces refreshed
- any role-specific constraints that now matter

### `FORK MERGE`

Typical intent:

- produce a concise merge-back brief from a forked coordination thread

Required packet additions:

- what context was forked from
- what happened in the fork since the split point
- what the original coordinator/context should absorb
- any status, findings, or sequencing implications

### `COMPACT`

Typical intent:

- restore enough context after compaction to continue safely in-role

Required packet additions:

- current role
- current frontier
- critical files reread
- open risks / pending decisions

These shorthand variants are useful because they already reflect the real operator workflow and can later be mapped directly into H4/H5-style structured runs.

Important distinction:

- packet compiler != session bus != autopilot
- packet compiler formalizes structure and rendering
- session bus is a later transport/dispatch layer
- autopilot would be a much later, evidence-gated behavior and should not be assumed early

---

## Continuous optimization rule

The project should treat workflow optimization as live work, not only future design work.

Meaning:

- if a recurring coordination or review pattern is clearly improvable, call it out
- if a durable pattern emerges, write it into policy
- if the human loop itself becomes more truthful, lower-friction, or easier to audit, that counts as real project progress

This matters because the project is partly building a workflow engine by improving the real workflow in flight.

---

## Control surface rule

The current workflow uses the coordination layer as an active control surface.

That means:

- `ops/Combined-Execution-Sequencing-Plan.md` is not just a roadmap
- it is the live status, readiness, ordering, and blocked-state surface
- the future coding vertical must read and preserve that surface
- H4/H5 should automate work through that control surface, not around it

---

## Current execution-shell reality

The current workflow is productive partly because it runs inside a tool-enabled shell environment.

Right now, that shell is OpenCode.

OpenCode currently provides the practical execution surface for:

- repository access
- file reads and edits
- search
- git operations
- test execution
- multi-session practical usage

Fractal Agent Lab should therefore treat the current coding-vertical direction as **OpenCode-anchored** in the near term.

Meaning:

- the lab provides workflow logic, artifacts, sequencing, review/gate policy, and learning-loop discipline
- OpenCode remains the main execution substrate that actually touches the repo

OpenCode integration note:

- stable OpenCode custom commands are a good shell-level interface for these packet types
- the shell command layer and the Fractal packet law should align, but they are not the same responsibility

This is valid.
The coding vertical does not need to replace the shell immediately in order to be useful.

---

## OpenCode-anchored vs hybrid

### OpenCode-anchored model

This is the preferred current model.

Meaning:

- OpenCode remains the main execution environment
- Fractal Agent Lab improves how work is planned, reviewed, gated, and recorded
- the main value is workflow intelligence, not shell replacement

Helpful shorthand:

- OpenCode = the hands
- Fractal Agent Lab = the method

### Hybrid model

This is a possible later direction, not the current default.

Meaning:

- OpenCode still remains in use
- Fractal Agent Lab gradually adds small standardized wrappers around repeated repo operations

In this context, a wrapper means a thin helper layer around an existing operation.

Example:

- instead of every workflow using raw repo/test/git calls in a different way
- a small standard helper can run the operation in one expected format and return a more consistent result

The hybrid model is therefore called hybrid because:

- OpenCode still provides the shell and tool substrate
- Fractal Agent Lab starts adding its own standardized work surface on top of it

Current stance:

- OpenCode-anchored = preferred now
- hybrid = valid later if repeated repo operations are worth standardizing

---

## Operational invocation model

The intended future model is explicit:

- the user works from an OpenCode session attached to the target repo
- the OpenCode session acts as the operator/control surface
- the session invokes Fractal Agent Lab workflows through explicit entrypoints
- Fractal Agent Lab performs the underlying workflow run, agent/model coordination, trace emission, and artifact generation
- the OpenCode session then reads those outputs back and presents them in a useful form

Example shape:

```text
User intent in OpenCode:
- "H4 this feature"

Practical invocation shape:
- `fal run h4.plan --repo . --goal "implement this feature"`

Result:
- Fractal Agent Lab runs the H4 workflow
- planning artifacts are written
- run/trace outputs are available for replay and audit
- OpenCode summarizes the result and continues the delivery loop
```

Important distinction:

- OpenCode session agents are not the same thing as Fractal Agent Lab workflow agents
- OpenCode session agents operate the repo/session/tool surface
- Fractal Agent Lab workflow agents are the internal H4/H5 roles that perform the structured workflow itself

Additional distinction:

- lightweight operator transport packets are not automatically the same thing as canonical H4/H5 workflow artifacts
- transport packets may live in local inbox/outbox style workflow state
- actual H4/H5 workflow artifacts stay governed by the coding-vertical artifact contract

This distinction matters because the near-term proto workflow may still rely on OpenCode directly performing some planning/review work from policy docs, while the intended later model is explicit workflow invocation through Fractal Agent Lab.

### Role-aware invocation note

The future coding vertical should remain compatible with the real operating pattern:

- one Meta Coordinator loop
- multiple track-specific implementation loops

That means future `fal` invocations may reasonably support role stances such as the current personal/operator workflow when that helps:

- Meta-style planning/review support
- track-style planning/review support

Illustrative shapes only:

- `fal run h4.wave_start --role track-c --repo . --goal "..."`
- `fal run h4.seq_next --role track-c --repo . --goal "..."`
- `fal run h4.plan_review --role meta --repo . --input artifacts/...`
- `fal run h5.review --role track-e --repo . --input artifacts/...`

These are personal-workflow-compatible examples of the intended shape, not current executable promises and not universal architectural requirements.

---

## Human-in-the-loop boundaries

The coding vertical should preserve explicit human control at important points, especially early on.

Human control remains primary for:

- scope correction when the request is underspecified or drifts
- sequencing overrides or cross-track reprioritization
- final commit authorization unless a future workflow explicitly says otherwise
- privacy and release decisions
- deciding when a design-only batch should remain blocked instead of becoming implementation work

---

## Automation ladder

The intended evolution is gradual.

### Stage A — Manual Meta + manual track prompting

Current reality.
The human and Meta Coordinator actively inspect the repo, check sequencing, plan next actions, review work, and decide on commit safety.

### Stage B — Assisted planning

`H4` begins to automate:

- repo intake
- context refresh
- sequencing-aware planning
- risk and acceptance-check artifact creation

Preferred near-term interpretation:

- `WAVE START` = partially automated context refresh and frontier grounding
- `SEQ NEXT` = stronger automated readiness + planning companion
- later `TERV REVIEW` = H4-adjacent structured plan critique mode

Near-term UX bias:

- aim for enter-only packet dispatch before any stronger session-to-session automation

### Stage C — Assisted review and gating

`H5` begins to automate:

- findings-first review output
- evaluator-style evidence/readiness assessment
- later advisory commit-gate output when evidence is good enough

Important boundary:

- implementation itself still remains primarily OpenCode-session work
- early H5 supports review/evaluator/gate structure around that work rather than replacing the implementer

### Stage D — Later constrained delivery chaining

Only after earlier stages prove trustworthy:

- limited implementation chaining
- richer orchestration
- stronger eval and policy feedback loops
- guarded session-bus style transport and dispatch

---

## Non-goals

Early coding-vertical work should not try to:

- bypass `ops/Combined-Execution-Sequencing-Plan.md`
- replace the Meta Coordinator with a freeform coding bot
- turn the workflow into unattended repo takeover
- collapse planning, implementation, review, and gate into one opaque agent action
- ignore track/session ownership because a prompt sounded urgent

---

## Design implication

The first successful coding-vertical slices should feel like:

- the current workflow, but more inspectable
- the current workflow, but less repetitive
- the current workflow, but more artifactized
- the current workflow, but safer to audit and replay

They should not feel like a separate system with unrelated behavior.

They should also not feel like a workbench-first rewrite while the main pain is still manual coordination transport.

---

## Related docs

- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
