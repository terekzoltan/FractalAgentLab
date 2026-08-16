# Router Control Configuration

This directory contains schemas/examples, not live target authority.

`session-context-status.schema.json` defines the read-only telemetry report shared
by router queries and the global self-query tool. Provider-observed
last-completion usage and derived active-context estimates remain separate; the
schema grants no compact, send, or mutation authority.

`compact-policy.schema.json` mirrors the Canon `opencode-compact-policy/v1`
global and tighten-only project branches. `compact-flow-event.schema.json` is a
retained Compact V2 reference; active Compact Lite uses typed invocation and no
event JSON. The retained schema
defines the private target-local event consumed by the separate adapter. Event
input contains logical participant labels and hashes, never raw session IDs,
credentials, endpoints, transcripts, or workstation roots.

Project `checks` cannot remove a global evaluation point. `required_gates` and
`satisfied_gates` remain Compact V2 reference fields only. Active Compact Lite
rejects a policy with nonempty `required_gates`; its hard gates are the closed,
adapter-computed transport set in the Canon contract. Nested retained event objects
remain closed schemas and receive the same recursive privacy validation as
top-level fields.

The portable global default is `auto_safe` with checks at `before_dispatch`,
`after_stage_output`, and `epic_closeout`, warning ratio `0.5`, critical ratio
`0.62`, safe-boundary enforcement, closeout participant compaction, and at most
one explicitly proven pre-acceptance retry. A target `.fal/compact-policy.json`
may only tighten these values or select `recommend`, `ask`, or `disabled`.

The router accepts the portable legacy shape aliases `quick`, `focused`,
`standard`, `high_risk`, `deep`, `audit`, `wide`, and `custom`. They normalize to
the current Canon native-review budget policy, assignment cap, and optional requested-domain set; they
do not name native agents or select an external transport. A target registry is
optional and may add project-declared review domains or named envelope mappings.
It must not change Canon authority, silently widen scope, pin unavailable models,
or make a project name select a domain by itself.

Store a live registry in the target's private router configuration and reference
it from target-local router settings or an explicit wrapper argument. When used,
the run pins its canonical path, schema version, and SHA-256 hash. Resume fails
closed if any value drifts. Do not put ports, passwords, session IDs, customer
data, or workstation-specific roots in a shared registry.

`review-control-registry.example.json` demonstrates a target-specific custom
profile only. It is not required for built-in profiles and is not a runtime
default.

Normal native review is capped at seven total assignments. `EXPANDED_AUDIT`
(eight to ten including retries and replacements), or a target registry profile
that explicitly requires Owner authority, needs a resolvable candidate-bound
approval receipt. Approval examples are formats only. Until the receipt schema is
revised, its historical `Swarm depth` field must be exactly `none`; it is a
compatibility slot, not transport authority. `Target`, `Epic`, `Candidate`, shape
alias, assignment count, cost envelope, and `Owner approval: APPROVED` must match
exactly. The wrapper pins and revalidates path, hash, version, and bindings on
resume. A boolean or free-text claim grants no authority.

Active review transport is always `native`. `UseSwarmReview`, `ForceFullReview`,
and non-`none` Swarm depth fail closed. The old plugin-role registry and
`swarm-assistant` session are not dependencies of the canonical review path.

Modify schemas through the reviewed workflow/tooling migration. Keep target
instances project-local so project-specific review capabilities can evolve
without hard-coding them into the global workflow kernel.
