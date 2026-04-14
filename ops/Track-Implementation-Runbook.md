# Track-Implementation-Runbook.md

## Purpose

This document defines the default operating workflow for implementation tracks in the
Fractal Agent Lab project.

It is the shared runbook for Track A, Track B, Track C, Track D, and Track E.

Track-specific runbooks should narrow or specialize this workflow, not replace it.

This document is intentionally reusable outside this repo for projects that use a
similar structure:

- one coordinating/meta layer
- multiple implementation tracks with clear ownership
- one canonical sequencing surface
- one canonical ownership/guardrail surface

---

## Source Of Truth Hierarchy

Implementation tracks should use this order of trust:

1. actual repository file contents
2. `ops/Combined-Execution-Sequencing-Plan.md` for active frontier and step ordering
3. `ops/AGENTS.md` for ownership, non-goals, and guardrails
4. the track-specific runbook
5. track delivery docs and precedent docs
6. chat summaries or assumptions

If a higher-priority source conflicts with a lower-priority one, stop and align to the
higher-priority source.

---

## Core Rule

A track should not begin implementation work just because a task sounds adjacent to its
mission.

It should begin only when all three are true:

- the sequencing surface says the epic is open
- the track owns the work or has an explicit co-owned slice
- the required upstream contracts are stable enough for implementation

If not, the track should report one of:

- `NOT READY`
- `READY with guardrails`
- `BLOCKED`

Quick session checklist:

- What is the current frontier?
- Does this track own the requested slice?
- Which code/docs/tests are actually in scope?
- What is the readiness verdict?
- Has the epic moved to `🔄` before implementation starts?
- What validation proves the change directly?
- What doc/status closeout is required afterward?

---

## Standard Session Loop

### 1. Session Open

At the start of a track session:

- read the relevant sprint/step in `ops/Combined-Execution-Sequencing-Plan.md`
- confirm ownership and non-goals in `ops/AGENTS.md`
- inspect the current repo state for the actual code/doc surfaces in scope
- identify the smallest honest implementation slice
- call out any shared boundary that may require another track review later

Frontier freshness rule:

- do one explicit frontier re-check before producing a detailed implementation plan
- do one more explicit frontier re-check immediately before editing or claiming `READY`
- if `Combined` and status-summary wording drift, treat `Combined` as canonical frontier truth and log the drift instead of guessing

### 2. Readiness Decision

Before writing code, explicitly decide:

- `READY`
- `READY with guardrails`
- `NOT READY`
- `BLOCKED`

If `READY with guardrails`, the guardrails should be concrete and testable.

### 3. Kickoff

When implementation actually starts:

- move the epic from `⬜ -> 🔄` in the coordination surfaces when appropriate
- keep the status wording narrow to the track's actual scope
- do not imply another track's completion

### 4. Implementation

During implementation:

- prefer the smallest correct change
- preserve declared ownership boundaries
- do not silently widen scope because adjacent work would be convenient
- consume canonical artifacts and contracts instead of inventing local truth
- treat sidecars, reports, and helper outputs as additive unless they are explicitly canonical

Shared-workspace rule:

- a dirty worktree is normal in a multi-track workflow
- assume other tracks may be editing in parallel
- reread shared files carefully before editing them
- do not clean up, rewrite, or "normalize" unrelated changes owned by other tracks

### 5. Validation

Validation should usually follow this order:

1. targeted unit or module tests for the changed surface
2. relevant regression suites for adjacent shared surfaces
3. any required CLI/script smoke command for the new workflow surface
4. broader suite or compile step when the change touches shared contracts

Green should mean structural honesty, not merely envelope presence.

### 6. Delivery And Closeout

When the epic is complete:

- publish or update the delivery doc
- update sequencing and status docs honestly
- record known limits and explicit non-goals
- prepare a short handoff summary for downstream tracks or Meta review

---

## Standard Guardrails

All tracks should preserve these default boundaries unless an epic explicitly changes
them:

- canonical run/trace truth stays where the repo says it lives
- additive artifacts must not silently become canonical truth
- output naming or template-law should not freeze early by accident
- replay/eval green must not hide false-green structure gaps
- prompt/version metadata may be evidence, but is not automatically a gate
- one track must not mark another track's work done without explicit confirmation
- if a field, path, or status is surfaced, be explicit about which surface actually emits it
- prefer emitted truth first, reconstructed truth second, and inferred truth last

---

## Coordination Freshness Drift

In practice, one of the most common workflow failures is not a code bug but a stale
coordination summary.

Typical drift patterns:

- `Combined` frontier moved but track status text lagged behind
- delivery doc remained historically correct but no longer described current canon
- code/tests/docs were all individually plausible but no longer said the same thing

Default response:

- trust repo state first
- trust `Combined` for frontier/ordering
- trust `AGENTS` for ownership/guardrails
- treat stale summaries as drift to log and repair, not as truth to follow

---

## Historical Artifacts Vs Current Canon

Track delivery docs are often historical records, not permanent sources of current canon.

Default rule:

- new epic or freeze step should publish a new delivery artifact when meaning changes materially
- older delivery docs remain historical references unless a newer doc explicitly supersedes them
- avoid silently changing the meaning of an older artifact through unrelated edits

When in doubt, say explicitly whether a document is:

- current canon
- historical record
- provisional prep artifact

---

## Review-Ready Handoff Shape

When handing work to Meta review, a track should provide:

- readiness basis
- what changed since last checkpoint
- exact scope and explicit out-of-scope list
- concrete file-touch plan or changed-file list
- validation commands actually run
- known limits or assumptions
- any suspicious shared-boundary areas
- execution mode used for the work (`manual_policy_driven`, `opencode_assisted`, or equivalent)
- visibility/audit state note (git-visible only vs local-only/data-assisted)
- explicit note if any non-canonical artifact influenced the conclusion

This keeps later track reviews and future workflow automation honest.

---

## Standard Completion Questions

Before claiming `✅`, a track should be able to answer yes to these:

- Does the implementation match the approved scope?
- Are the ownership boundaries still intact?
- Were the changed surfaces validated directly?
- Were relevant regressions re-checked?
- Do docs and code say the same thing?
- Are known limits explicit instead of implicit?
- Is there any unresolved high-severity contradiction left?

If not, the track should prefer `🔄` or a partial handoff, not premature closeout.

---

## Session Opening Packet

For a compact but honest session opening, a track should usually load:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`
- the track-specific runbook
- the most recent directly relevant delivery doc(s)
- the code/test surfaces the epic will actually touch

This is a convenience packet, not a replacement for repo inspection.

Common high-reread-before-edit hotspots in this repo include:

- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- shared CLI surfaces such as `src/fractal_agent_lab/cli/app.py`, `formatting.py`, and `trace_reader.py`

Treat equivalent shared-control files the same way in other repos.

---

## Emerging Packet Shapes

This workflow is increasingly packet-oriented and can later be automated more directly.

Useful default packet types:

- readiness packet
- implementation-plan packet
- closeout packet
- Meta review packet

The current runbooks describe the content of these packets even when they are still
written as normal prose.

---

## Relationship To Track Runbooks

The track-specific runbooks should answer:

- what this track owns in practice
- what this track must not absorb from other tracks
- which upstream contracts it usually depends on
- what a healthy implementation loop looks like for that track
- what review and validation are expected before closeout

Use this file as the shared default and the per-track files as overlays.
