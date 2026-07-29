# CANON-HYDRATION Implementation Plan

## 1. Plan Control

| Field | Value |
|---|---|
| Plan ID | `CANON-HYDRATION-IMPLEMENTATION-PLAN-v1.1-final` |
| Epic | `CANON-HYDRATION` |
| Accountable Lane | Canon Workflow Maintenance / `MAINTENANCE` |
| Accepted semantic input | `plans/epics/CANON-HYDRATION-WORKFLOW-CHANGE-SPEC.md` |
| Architecture input | `plans/epics/CANON-HYDRATION-FAL-MIG-P-v2-Transition-Plan.md` |
| Status | `FINAL_REVISED` |
| Workflow phase | `PLAN_REVISION` |
| Single Meta review | `YELLOW`, recorded in `plans/epics/CANON-HYDRATION-plan-review-v1.md` |
| Candidate basis | Canon `1.2.2` plus adoptable untracked hydration candidate |
| Global apply | Separate hash-bound `/oc-toolsmith` transaction only |
| Commit/push | Not authorized |

## 2. Objective

Deliver a project-neutral, deterministic, read-only hydration resolver, constrained
reader/verifier pipeline, declarative profiles, Canon conformance suite, and four
reviewed global OpenCode candidate definitions. Preserve project-local execution
authority and fail closed when durable project truth is absent or contradictory.

## 3. Preconditions

- Owner confirmed the unfinished Canon hydration candidate may be adopted, changed,
  removed, or retained.
- `CANON-HYDRATION-WORKFLOW-CHANGE-SPEC-v1.0` is design-ready.
- Canon tracked baseline is `1.2.2`; untracked `registry/`, resolver, and hydration
  tests are not accepted evidence.
- FAL dirty router source/test paths are protected and outside scope.
- Global live apply remains blocked until an exact `/oc-toolsmith` execution-bundle
  hash receives Owner approval.
- FAL v1.2 supersession and a reviewed v2.0 plan are separate project-governance
  work. They are a hard barrier before `CH-3` starts Canon implementation, in the
  order required by the transition architecture.

## 4. Allowed Surfaces

### Canon repository

```text
AGENTS.md                         # only if final impact closure needs a pointer
README.md
ADOPTION.md
MANIFEST.md
VERSION.md
CHANGELOG.md
canon/CANONICAL-CONTRACT.json
canon/CONTEXT-HYDRATION.md
canon/EVOLUTION-AND-VERSIONING.md # only if new impact vocabulary is required
runbooks/AFTER-COMPACT-RUNBOOK.md
runbooks/WORKFLOW-MAINTAINER-RUNBOOK.md # compatibility text only if required
registry/**
scripts/resolve-hydration.ps1
scripts/invoke-hydration.ps1
scripts/validate-pack.ps1
tests/hydration/**
```

### FAL dependency-only governance surfaces

```text
plans/epics/CANON-HYDRATION-WORKFLOW-CHANGE-SPEC.md
plans/epics/CANON-HYDRATION.md
plans/epics/CANON-HYDRATION-plan-review-v1.md
```

The separate FAL supersession and `FAL-MIG-P v2.0` lifecycle owns
`plans/epics/FAL-MIG-P.md`, its immutable v1.2 archive/evidence, FAL state, and the
sole active Combined. This Canon Epic may read those artifacts and gate on their
accepted identities, but it may not mutate them.

### Isolated global-tool candidate package

```text
commands/after-compact.md
skills/context-restore/SKILL.md
commands/wave-start.md
skills/context-onboarding/SKILL.md
change-set-manifest.json
semantic-migration-ledger.md
validation-receipt.json
execution-bundle.json
```

The isolated package path and recovery archive path are selected by `/oc-toolsmith`.
They must not be inside active OpenCode discovery.

## 5. Forbidden Surfaces

- `src/fractal_agent_lab/**`;
- `tests/**`, except Canon `tests/hydration/**` in the Canon repository;
- `tools/oc-session-router/**` behavior or source;
- WorldSim, RingFall, or TriageCI project files;
- `.swarm/**`;
- live global OpenCode definitions before hash-bound approval;
- Canon `reference/tooling-snapshot/**` before verified post-restart sync;
- credentials, concrete session IDs, ports, raw transcripts, and private endpoints;
- Git staging, commit, push, PR, merge, deployment, or publication;
- FAL file deletion, move retirement, or Stage B cleanup.

## 5A. Feature -> User Story -> Task Hierarchy

### Feature CH-F1: Deterministic Hydration Kernel

#### User Story CH-US1.1: Resolve one authoritative project packet safely

- Task CH-T1.1.1: freeze Canon, unfinished candidate, project-profile, and live
  global-tool baseline identities;
- Task CH-T1.1.2: freeze registry, request, result, source-reference, failure, and
  invalidation schemas;
- Task CH-T1.1.3: implement project-neutral resolution with enrollment,
  compatibility, identity, section, budget, and privacy enforcement;
- Task CH-T1.1.4: implement constrained read and post-read verification without
  mutation or command dispatch.

#### User Story CH-US1.2: Prove fail-closed behavior

- Task CH-T1.2.1: add deterministic positive fixtures;
- Task CH-T1.2.2: add path traversal and junction/reparse negative fixtures;
- Task CH-T1.2.3: add stale state/candidate/compact/configuration negatives;
- Task CH-T1.2.4: add enrollment, role/phase, schema, section, budget, runtime, and
  privacy negatives;
- Task CH-T1.2.5: make Canon pack validation execute hydration conformance.

### Feature CH-F2: Declarative Multi-Project Compatibility

#### User Story CH-US2.1: Represent project differences as data

- Task CH-T2.1.1: correct the FAL profile and dual-root constraints;
- Task CH-T2.1.2: preserve WorldSim and RingFall expected blockers until durable
  project authority exists;
- Task CH-T2.1.3: encode TriageCI security/redaction and non-Git identity behavior;
- Task CH-T2.1.4: prove no project-name behavior branch exists.

#### User Story CH-US2.2: Verify current-project dispositions

- Task CH-T2.2.1: run FAL current-frontier rehearsal;
- Task CH-T2.2.2: run WorldSim expected-block rehearsal;
- Task CH-T2.2.3: run RingFall expected-block and stale-mirror rehearsal;
- Task CH-T2.2.4: run TriageCI security/redaction rehearsal;
- Task CH-T2.2.5: publish the compatibility matrix and residual project debt.

### Feature CH-F3: Canon And Live OpenCode Co-Evolution

#### User Story CH-US3.1: Keep Canon consumers conformant

- Task CH-T3.1.1: update hydration law, after-compact runbook, machine contract,
  manifest, adoption guidance, changelog, and release state;
- Task CH-T3.1.2: close every mandatory consumer edge with evidence;
- Task CH-T3.1.3: keep release blocked while external tooling verification is open.

#### User Story CH-US3.2: Apply global tool changes transactionally

- Task CH-T3.2.1: build the isolated four-file command/skill candidate;
- Task CH-T3.2.2: produce semantic ledger, exact operations, validation receipt,
  rollback plan, and execution-bundle hash;
- Task CH-T3.2.3: obtain Owner approval bound to the unchanged hash;
- Task CH-T3.2.4: archive, journal, and atomically apply exact targets;
- Task CH-T3.2.5: stop for Owner restart, then verify live discovery and refresh
  snapshots through the verified sync path.

## 6. Work Breakdown

### CH-1: Freeze Baselines And Collision Ledger

Actions:

1. Record Canon tracked HEAD, version/schema, dirty/untracked inventory, and per-file
   hashes for every candidate surface.
2. Record the four live global definition hashes and fresh inventory.
3. Classify each unfinished candidate file as retain, rewrite, replace, or remove.
4. Record protected FAL dirty paths and unrelated worktree changes.

Acceptance:

- no unexplained path enters the candidate;
- every existing candidate file has an explicit disposition;
- baselines are sufficient for drift detection and rollback.

### CH-2: Freeze Machine Interfaces

Actions:

1. Add registry, request, and result JSON schemas.
2. Add exact enums, failure taxonomy, enrollment, sensitivity, selector, and
   compatibility fields to the machine contract.
3. Define deterministic canonical serialization and invalidation inputs.
4. Define resolver, reader, verifier, and legacy fallback non-claims.

Acceptance:

- schemas reject unknown fields and runtime-forbidden registry payloads;
- interface matches the accepted workflow-change specification;
- no project-specific branch is required.

### CH-3: Implement Resolver And Constrained Read/Verify Pipeline

Actions:

1. Repair or replace `resolve-hydration.ps1` for Windows PowerShell 5.1 and
   PowerShell 7 compatibility.
2. Enforce active enrollment, schema validity, explicit identity expectations,
   role/phase legality, Canon compatibility, unique bounded sections, and budgets.
3. Enforce canonical root containment and reject reparse/junction/symlink ambiguity.
4. Produce deterministic ordered results and invalidation keys.
5. Add `invoke-hydration.ps1` to perform constrained reads, pre/post identity
   verification, sufficiency verification, and read-only manifest output.

Acceptance:

- valid fixtures resolve and verify;
- every named negative control returns the exact failure class;
- no test observes a write or command dispatch;
- output contains no forbidden runtime data.

Supported-engine policy:

- Windows PowerShell 5.1 is mandatory on the current Windows environment;
- PowerShell 7 parity is mandatory when `pwsh` is installed and otherwise records
  `UNAVAILABLE` without weakening Windows PowerShell acceptance;
- a junction/reparse escape negative must execute on Windows. If ordinary symlink
  creation lacks privilege, the test shall use an isolated temporary junction or a
  checked fixture that still exercises resolved-component rejection; skipping all
  reparse coverage blocks release.

### CH-4: Correct Declarative Project Profiles

Actions:

1. Correct FAL current paths and represent the supersession boundary without
   pointing to nonexistent authority.
2. Keep WorldSim and RingFall fail-closed until durable authority exists.
3. Correct TriageCI security/redaction deltas and non-Git worktree expectations.
4. Keep all differences in data, not resolver code.

Acceptance:

- all profiles validate;
- each profile's expected current disposition is explicit;
- blocked enrollment never returns ready;
- FAL dual-root and protected-router non-authority are covered.

### CH-5: Expand Conformance And Pack Validation

Actions:

1. Add fixture tests for request/result schema, deterministic serialization,
   duplicate/missing sections, budget, identity changes, compatibility, privacy,
   runtime mapping, traversal, and supported reparse behavior.
2. Add project-profile tests for FAL, WorldSim, RingFall, and TriageCI.
3. Invoke hydration tests and registry validation from `validate-pack.ps1`.
4. Run each test file/script individually and record results.

Acceptance:

- no false `READY` survives;
- expected project blockers are reported as conformance passes with readiness still
  blocked;
- pack validation fails when hydration conformance fails.

### CH-6: Co-Evolve Canon Documentation And Release Metadata

Actions:

1. Update hydration law and after-compact runbook.
2. Update README, manifest, adoption guidance, machine contract, and changelog.
3. Record every mandatory consumer as `IMPACTED`, `NOT_AFFECTED`, or
   `DEFERRED_BLOCKS_RELEASE` with evidence.
4. Keep Canon release open while global-tool apply/restart/snapshot verification is
   pending.

Acceptance:

- no semantic owner has an unclassified consumer;
- version/schema changes are internally consistent;
- current changelog no longer claims hydration is unaffected.

### CH-7: Build And Safety-Review Global Tool Candidate

Actions:

1. Read and hash fresh live definitions.
2. Build an isolated four-file candidate without changing live discovery.
3. Preserve all unique source rules in the semantic migration ledger.
4. Validate frontmatter, command-skill links, terminal/routes, portability, privacy,
   no-mutation behavior, and Canon interface compatibility.
5. Create exact operations, before/after hashes, rollback archive plan, durable
   journal design, and execution-bundle hash.

Acceptance:

- `/oc-toolsmith` reports `TOOL_CHANGESET_READY`;
- no live global file changed;
- execution bundle is exact, complete, and approval-bindable.

### CH-8: Apply, Restart, Verify, And Refresh Snapshot

Precondition:

- Owner supplies the exact unchanged execution-bundle approval hash.

Actions:

1. Re-hash live definitions and abort on drift.
2. Create and verify exact recovery copies.
3. Journal and atomically replace only the four approved definitions.
4. Stop at `APPLIED_AWAITING_RESTART`.
5. Owner restarts OpenCode.
6. Verify fresh discovery, run bounded command/skill smoke, and refresh operational
   and Canon snapshots only through the verified sync path.

Acceptance:

- candidate, live, and snapshot hashes agree;
- rollback path is executable and hash-verified;
- restart-time discovery proves the new definitions are active.

### CH-9: Four-Project Rehearsal And Compatibility Matrix

Actions:

1. Run FAL cold restore with explicit control and target roots.
2. Run WorldSim, RingFall, and TriageCI current-profile rehearsals.
3. Record expected/observed readiness, sources, invalidation, budget, privacy,
   blockers, and residual project debt.
4. Re-run after-compact and wave-start candidate behavior against the same profiles.

Acceptance:

- every rehearsal outcome matches the declared enrollment and project authority;
- no expected blocker becomes readiness;
- all four projects have an actionable compatibility disposition.

## 7. Sequencing And Barriers

```text
CH-1
-> CH-2
-> FAL-BARRIER: immutable v1.2 preservation, formal supersession, and separately reviewed FAL-MIG-P v2.0 plan
-> CH-3 and CH-4
-> CH-5
-> CH-6
-> CH-7
-> Owner hash approval
-> CH-8 apply
-> Owner restart
-> CH-8 live verification
-> CH-9
-> independent /step-review
```

`FAL-BARRIER` is mandatory before the first resolver or profile implementation
edit. Its accepted evidence must include the exact preserved v1.2 SHA-256, review
lineage, `SUPERSEDED_BEFORE_IMPLEMENTATION` disposition, corrected state/Combined
pointers, and a new v2.0 plan that completed its own `/seq-next -> /terv-review ->
/terv-review-utan` lifecycle. The Canon lane consumes those identities but does not
perform the FAL mutations. FAL Stage A implementation waits for that v2.0 lifecycle
and remains outside this Epic.

## 8. Verification Commands

Commands are selected only after tool availability inspection. Expected checks:

```powershell
powershell.exe -NoProfile -File .\tests\hydration\test-resolver.ps1
powershell.exe -NoProfile -File .\scripts\validate-pack.ps1
pwsh -NoProfile -File ./tests/hydration/test-resolver.ps1   # when installed
pwsh -NoProfile -File ./scripts/validate-pack.ps1           # when installed
```

No full FAL test suite, unrelated test directory, network test, or destructive
command is authorized.

## 9. Rollback

- Before global apply, discard only candidate files created by this Epic; tracked
  Canon baseline and unrelated work remain untouched.
- Canon changes remain one candidate diff until closeout.
- Global apply uses exact recovery bytes, a transaction journal, before/after
  inventories, and atomic replacement.
- On partial apply, classify actual state from hashes and restore the complete
  previous four-file set unless the approved deterministic continuation is proven.
- Never blind-retry or silently mix old and new hydration contracts.

## 10. Risks And Stops

| Stop | Route |
|---|---|
| Canon baseline changes unexpectedly | Freeze and reconcile with Canon maintenance owner |
| Global live hash differs from baseline | Rebuild candidate; old approval becomes invalid |
| Required project authority is missing | Keep profile blocked; route project-local durability Epic |
| Reparse safety cannot be proven | Block release; do not weaken containment |
| Resolver changes current project state | Reject candidate |
| Global apply approval hash is missing | Stop at `TOOL_CHANGESET_READY` |
| Restart not performed | Remain `APPLIED_AWAITING_RESTART` |
| Candidate/live/snapshot hash mismatch | Block release and use journaled rollback |
| FAL dirty router work is touched | Reject diff and restore only this Epic's candidate changes |
| `.swarm` operation is required | Stop; unrelated spec drift remains unresolved |

## 11. Plan Review Questions

The independent reviewer must verify:

1. whether request/result fields are sufficient to prevent stale readiness;
2. whether root/reparse containment is implementable on supported PowerShell;
3. whether fallback and enrollment semantics preserve fail-closed behavior;
4. whether all coupled Canon/global/FAL consumers are classified;
5. whether verification covers deterministic, negative, privacy, and four-project
   behavior;
6. whether live apply remains exclusively hash-bound to `/oc-toolsmith`;
7. whether any forbidden product/router/destructive scope leaked into the plan.

## 12. Review Revision Mapping

| Review correction | Applied disposition |
|---|---|
| Make FAL supersession/v2.0 a pre-code dependency | Added the hard `FAL-BARRIER` before `CH-3` and exact required evidence |
| Remove direct FAL mutation authority from the Canon Epic | Replaced the FAL allowed-surface list with dependency-only read/evidence scope |
| Define PowerShell and link-test support precisely | Added mandatory Windows PowerShell 5.1 and Windows reparse coverage, with conditional PowerShell 7 parity |
| Provide complete lane-local decomposition | Added explicit Feature -> User Story -> Task hierarchy |

No review item was rejected or left unclear.

## 13. Final Terminal

```text
PLAN_REVISION_COMPLETE
IMPLEMENT_READY
```
