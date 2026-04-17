# Coordination-Layer-Packet-Bus-v01.md

## Purpose

This document defines the near-term coordination-layer direction for the Software Delivery
Loop.

It sharpens one core point:

> the next useful gain is not a big workbench or default autonomous coding
>
> the next useful gain is packetized coordination with much cheaper operator transport

The target is to preserve the current Meta + track workflow while reducing repeated
copy/paste, role-restoration, and session-handoff overhead.

---

## Core framing

The coordination layer should be understood through three aligned surfaces:

- `ops/Combined-Execution-Sequencing-Plan.md` = live control surface
- OpenCode = hands, shell, and command surface
- Fractal Agent Lab = method, packet law, workflow semantics, provenance, and review/gate discipline

This means the coding vertical should automate through the current operating model, not around it.

---

## Near-term UX north star

The near-term target is an `enter-only` operator flow.

Meaning:

- if Combined is already good enough, each session should usually already know the next valid move
- the operator should normally approve, tweak lightly, or press Enter
- explicit human control remains at meaningful gates

This is not the same as default unattended automation.

Required preserved behaviors:

- manual override
- opportunistic replanning
- ad hoc extra instruction
- explicit review/gate decisions

---

## Terminology

### Coordination Layer

The umbrella concept.

It includes:

- packet law
- packet compilation
- role-aware rendering
- transport semantics
- provenance fields
- queue / inbox / outbox conventions
- stop conditions and approval boundaries

### Packet Bus

The later transport/dispatch sublayer inside the coordination layer.

It includes:

- packet delivery between sessions
- optional queue consumption
- later guarded dispatch semantics

It should not be treated as the whole coding vertical.

### `opencode_bridge`

A concrete implementation label for a bridge that talks to OpenCode session/server surfaces.

Examples of possible later bridge responsibilities:

- session create or fork
- message delivery
- command invocation
- event collection

This is a technical bridge surface, not the primary conceptual framing.

---

## Operator transport packets vs actual workflow artifacts

These must remain separate.

### Operator transport packets

Purpose:

- move intent, context, and next-action guidance cheaply between OpenCode sessions
- reduce operator copy/paste overhead
- preserve role and frontier context during compact/fork/merge loops

Examples:

- `wave_start`
- `seq_next`
- `plan_review`
- `review`
- `review_fix`
- `fork_merge`
- `compact`
- `commit_decision`

Boundary:

- these are workflow-support transport objects
- they are not canonical repo truth by default
- they do not automatically require canonical `run_id` binding
- they may live in local inbox/outbox or sidecar workflow state without becoming canonical artifacts

### Actual `H4/H5` workflow artifacts

Purpose:

- record the outputs of real Fractal Agent Lab workflow runs
- remain inspectable, replayable, and evidence-backed

Examples:

- `context_report.json`
- `implementation_plan.md`
- `acceptance_checks.json`
- `review_findings.json`
- `commit_gate.json`

Boundary:

- these follow the coding-vertical artifact contract
- these correlate to canonical run/trace truth when claimed as real workflow artifacts
- they are not the same thing as lightweight transport packets

---

## Packet compiler

The first practical implementation target is a packet compiler.

Responsibilities:

- normalize shorthand operator intent into structured packet payloads
- preserve source-of-truth order and role stance
- attach disclosure and provenance fields consistently
- render the same packet into multiple useful targets

Recommended render targets:

- operator-facing markdown
- machine-friendly JSON
- command/slash-command-friendly invocation payloads

The packet compiler should formalize durable workflow structure.
It should not become a prompt pack disguised as a platform.

---

## Canonical packet family

Recommended base packet types:

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

Recommended modifiers or packet options:

- `deep`
- `step`
- `parallel`
- `forked`
- `question_me`
- `commit_if_clean`
- `no_edit_except_commit`
- `track_message_required`

The base family should remain stable and machine-legible.
Operator prose can remain richer and more personal on top of that stable family.

---

## Minimum provenance fields

Every emitted packet should carry enough provenance to survive compaction, forks, and review loops.

Minimum fields:

- `packet_type`
- `packet_version`
- `role`
- `source_ref`
- `frontier_ref`
- `execution_mode`
- `visibility_audit_state`
- `status`
- `generated_at`

When relevant, also include:

- `track`
- `step_ref`
- `parent_packet_ref`
- `requested_by`
- `non_canonical_inputs_used`

---

## Queue model

Near-term queue surfaces may exist as local workflow state.

Illustrative examples:

- meta inbox/outbox
- track-a inbox/outbox
- track-b inbox/outbox
- track-c inbox/outbox
- track-d inbox/outbox
- track-e inbox/outbox

Interpretation:

- these are operator-side workflow aids
- they are not a rival canonical truth system
- Combined remains the authoritative readiness/order/frontier surface

---

## Manual override, packet emission, guarded dispatch

These are three different modes.

### Manual override

Use when:

- the request is ambiguous
- sequencing or ownership is unclear
- repo reality contradicts the expected next move
- human judgment should stay dominant

### Packet emission

Use when:

- the workflow pattern is stable enough to structure
- the next action is already clear from Combined and repo state
- the main need is cheaper transport and better provenance

### Guarded dispatch

Use later when:

- packet quality is already trustworthy
- stop conditions are explicit
- approval boundaries are explicit
- evidence shows that automatic delivery reduces friction without hiding risk

Guarded dispatch must still stop at explicit review/gate boundaries when those boundaries matter.

---

## Evolution ladder

### Stage 0 — Current manual reality

- notebook shorthand
- manual copy/paste
- manual role restoration
- manual fork/merge handoff

### Stage 1 — Enter-only operator flow

- shorthand intents become packet templates or commands
- each session gets a prepared next packet
- operator approves, tweaks lightly, or sends
- Combined remains the main planning/control surface

### Stage 2 — Assisted dispatch

- packets can be written directly into role-specific inbox/outbox surfaces
- role-aware helpers can suggest the next likely command or packet
- compact and fork/merge loops become cheaper

### Stage 3 — Guarded session bus

- a bridge can create/fork sessions, deliver packets, and collect outputs
- dispatch becomes event-aware and role-aware
- explicit approval and stop boundaries remain conservative

### Stage 4 — Supervised chaining

- Meta -> track handoff
- track -> Meta return
- review -> fix -> re-review loops
- still bounded by explicit stop conditions and conservative authority

### Stage 5 — Later optional higher autonomy

- only after evidence supports it
- never as a branding shortcut
- never as default unattended repo takeover

---

## Non-goals

Near-term coordination-layer work should not imply:

- a separate IDE-first product
- transcript-first tooling as the primary architecture
- default autonomous coding swarms
- automatic commit authority
- replacing Combined with a dashboard
- treating prompt packs as canonical truth

---

## Relationship to current coding-vertical docs

This note refines the current coding-vertical direction.
It does not replace the core H4/H5 family docs.

Main companions:

- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `ops/Meta-Coordinator-Runbook.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
