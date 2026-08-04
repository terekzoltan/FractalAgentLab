# Router Control Configuration

This directory contains schemas/examples, not live target authority.

`session-context-status.schema.json` defines the read-only telemetry report shared
by router queries and the global self-query tool. Provider-observed
last-completion usage and derived active-context estimates remain separate; the
schema grants no compact, send, or mutation authority.

`compact-policy.schema.json` mirrors the Canon `opencode-compact-policy/v1`
global and tighten-only project branches. `compact-flow-event.schema.json`
defines the private target-local event consumed by the separate adapter. Event
input contains logical participant labels and hashes, never raw session IDs,
credentials, endpoints, transcripts, or workstation roots.

Project `checks` cannot remove a global evaluation point. Project
`required_gates` are unioned with global gates, and every event must declare its
currently satisfied stable gate IDs in `satisfied_gates`; a missing required gate
returns `PROOF_REQUIRED` before compact action. Nested event objects are closed
schemas and receive the same recursive privacy validation as top-level fields.

The portable global default is `auto_safe` with checks at `before_dispatch`,
`after_stage_output`, and `epic_closeout`, warning ratio `0.75`, critical ratio
`0.875`, safe-boundary enforcement, closeout participant compaction, and at most
one explicitly proven pre-acceptance retry. A target `.fal/compact-policy.json`
may only tighten these values or select `recommend`, `ask`, or `disabled`.

The router has portable built-in profiles: `quick`, `focused`, `standard`,
`high_risk`, `deep`, `audit`, `wide`, and `custom`. A target registry is optional
and may add project-declared lane IDs or named custom profiles. It must not change
Canon authority, silently widen mutation/review scope, or make a project name
select a lane by itself.

Store a live registry in the target's private router configuration and reference
it from target-local router settings or an explicit wrapper argument. When used,
the run pins its canonical path, schema version, and SHA-256 hash. Resume fails
closed if any value drifts. Do not put ports, passwords, session IDs, customer
data, or workstation-specific roots in a shared registry.

`review-control-registry.example.json` demonstrates a target-specific custom
profile only. It is not required for built-in profiles and is not a runtime
default.

Five-to-seven internal lanes and full/adaptive Swarm require an Owner-approval
receipt. The two approval files are format examples, never approvals. A valid
receipt must be a resolvable pinned artifact with the exact ordered fields shown
in the examples. `Target`, `Epic`, and `Candidate` are separate mandatory
bindings. `Review profile`, `Swarm depth`, `Lanes`, and the non-empty
Owner-declared `Cost envelope` must exactly match the dispatch, followed by
`Owner approval: APPROVED`. The cost envelope is an opaque, immutable budget
description; the wrapper compares it exactly and does not infer extra authority
from it. The wrapper pins and revalidates receipt path, SHA-256 hash, schema
version, and every binding on resume. A boolean flag or free-text claim grants no
authority.

Modify schemas through the reviewed workflow/tooling migration. Keep target
instances project-local so project-specific review capabilities can evolve
without hard-coding them into the global workflow kernel.
