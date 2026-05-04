# OpenCode-Orchestration-Layer-v01

## Status

Private strategic planning artifact for Wave 6.

Authority:

- `ops/Combined-Execution-Sequencing-Plan.md` remains canonical for active sequencing and status.
- This document explains the strategic correction behind Wave 6.
- `docs/private/Coordination-Layer-Packet-Bus-v02.md` defines the MVP packet/state schema direction.
- `docs/private/Coding-Vertical-Usefulness-Eval-v01.md` defines the usefulness evaluation direction.

Current decision:

- Wave 6 may be documented now as post-Wave-5 prep.
- Wave 6 implementation should not start until Wave 5 closes unless Meta explicitly re-sequences it.
- The first implementation slice should be evidence-ledger-first, not API-delivery-first.

## Core Thesis

Fractal Agent Lab should become the flight recorder, policy engine, audit layer, replay surface, and private learning loop for the OpenCode Meta/Track development workflow.

OpenCode is the execution hand:

- repo shell
- code editing surface
- command runner
- custom command host
- skills/tools runtime
- future server/API session substrate

Fractal Agent Lab is the workflow intelligence layer above it:

- sequencing policy
- packet/state contracts
- review/gate discipline
- evidence capture
- replay/audit surfaces
- usefulness evaluation
- private learning-loop distillation

This means the question changes from:

> how do we automate OpenCode?

to:

> how do we make OpenCode-driven development measurable, auditable, replayable, safer, and better over time?

## Why This Pivot Is Needed

OpenCode already supports or is moving toward many things that earlier Fractal Agent Lab plans imagined as custom surfaces:

- commands
- skills
- tools
- permissions
- multi-session workflows
- server/API automation

If Fractal Agent Lab remains mainly a command/skill/prompt workflow wrapper, it risks becoming redundant.

The durable value is not another command factory. The durable value is answering questions OpenCode does not answer well by itself:

- Which plans were actually useful?
- Which Meta reviews caught real bugs?
- Which findings were false positives?
- Which gates correctly blocked bad implementation?
- Which prompts or commands reduced manual work?
- Which Track sessions caused scope creep?
- Which workflow patterns actually saved time?
- Which repo zones need stricter planning/review?
- What changed between plan, implementation, review, fix, and commit-readiness?
- Can development loops be replayed and compared across runs?

## Existing Canon This Must Reuse

Wave 6 must not duplicate the existing coding-vertical canon.

Relevant existing docs:

- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coordination-Layer-Packet-Bus-v01.md`
- `docs/private/Coding-Vertical-Learning-Loop-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `docs/private/H4-Assist-Optimization-Lab-Runbook-v01.md`
- `docs/private/H4-Assist-Optimization-Evaluation-Log-v01.md`

Interpretation:

- `v01` packet-bus canon defined packet law and the future transport ladder.
- Wave 6 narrows that into an evidence-backed MVP for the real Meta/Track OpenCode loop.
- H4 usefulness work already proved that extra structure can be wasteful if it does not beat direct OpenCode usage.
- Wave 6 must therefore prove usefulness with evidence before generalizing.

## MVP Loop

The Wave 6 MVP loop is limited to the real OpenCode Meta/Track development cycle:

1. Track session runs `/seq-next` and creates a detailed implementation plan.
2. Track emits `plan_ready_for_meta_review`.
3. Meta Coordinator runs `/terv-review`.
4. Meta emits `meta_plan_review_done` with `greenlit`, `changes_requested`, or `blocked`.
5. Track runs `/terv-review-utan` and emits `plan_review_acknowledged`.
6. Track runs `/implement` only after explicit greenlight.
7. Track emits `implementation_done`.
8. Meta runs `/step-review` by default, or `/deep-review` only when needed.
9. Meta emits `step_review_done` with `pass`, `fix_required`, `hold`, or `deep_review_needed`.
10. Track emits `step_review_acknowledged` or `review_fix_done`.

Out of MVP scope:

- launch packets
- UI packets
- reminder packets
- compact packets
- general-purpose packet platform
- unattended chaining
- commit execution
- push execution

## First Slice

The first slice should be an evidence ledger, not an OpenCode automation bridge.

Minimum proof:

- one real Meta/Track loop is captured as structured evidence
- packet states are validated
- transitions are traceable
- plan/review/implementation/review-fix/pass evidence is linked
- manual intervention and copy-paste avoided counts are recorded
- private raw evidence stays private

This is intentionally smaller than a session bus.

If this slice does not produce useful audit/replay value, larger automation should stop or narrow.

## Privacy And Moat Rule

Raw workflow evidence stays private by default.

Private by default:

- exact prompts and command packets
- review/finding corpora
- false-positive notes
- gate-quality judgments
- target-repo failure examples
- operator workflow heuristics
- benchmark gold sets

Public or portfolio-facing output may include:

- architecture diagrams
- sanitized case studies
- high-level metrics
- selected non-sensitive examples
- broad process lessons

Public output must not include the strongest private operating heuristics unless explicitly reviewed for release.

## Target Repo Trial

Wave 6 must not validate only on Fractal Agent Lab.

Default external candidate:

- WorldSim

But WorldSim is not assumed ready.

Before locking it in, Meta must require a target brief:

- repo location
- current architecture summary
- active workflow need
- safe first sequence item
- expected evidence
- boundaries and non-goals

If WorldSim is unavailable or not ready at Wave 6 start, choose another suitable target repo instead of falling back to FAL-only validation.

## Stop Conditions

Stop or narrow Wave 6 automation if:

- direct OpenCode workflow is consistently enough for the tested task class
- the evidence ledger does not change review or gate decisions
- packet capture adds more friction than it removes
- findings quality does not improve
- false-positive review noise increases
- state-machine rules create workflow theater rather than safety
- public evidence would require leaking private learning assets

## Track Ownership

- Meta Coordinator: sequencing, gates, no-claim boundaries, target-repo readiness, final decisions.
- Track B: packet state machine, artifact contracts, event/ledger schema boundaries.
- Track C: prompt/role/handoff semantics for packet payload meaning.
- Track D: OpenCode bridge, router/validator MVP, session/API integration surface.
- Track E: usefulness eval, evidence sufficiency, review-quality/gate-quality scoring.
- Track A: later visibility/dashboard only after evidence exists.

## Current Verdict

GREEN for documentation and post-Wave-5 insertion.

YELLOW for implementation until:

- Wave 5 closes or Meta explicitly re-sequences the work
- the evidence-ledger packet contract is accepted
- OpenCode server/API assumptions are verified
- target-repo privacy and storage boundaries are explicit
