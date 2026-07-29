# FAL-MIG-P v2.0: Canon Reference, Hydration Adoption, and Repository Simplification

## EPIC IMPLEMENTATION PLAN

Target: FractalAgentLab repository governance and information architecture

Epic: `FAL-MIG-P`

Wave: `FAL-CANON-MIG`

Accountable Lane / class / profile: Meta Coordinator / `GOVERNANCE` /
`FAL-MIG-P-V2-META-AUTHOR`

Plan identity: `FAL-MIG-P-plan-v2.0-final`

Workflow phase: `PLAN_REVISION`

Single Meta review: `YELLOW`, recorded in
`plans/epics/FAL-MIG-P-plan-review-v2.md`

## Prerequisites And Current State

Confirmed:

1. Owner authorized the CANON-HYDRATION lifecycle and replacement of the rejected
   full-migration direction on 2026-07-26.
2. `CANON-HYDRATION-WORKFLOW-CHANGE-SPEC-v1.0` is accepted and ends
   `WORKFLOW_CHANGESET_READY`.
3. The registry/request/result interface is frozen under the Canon maintenance
   candidate before this plan is reviewed.
4. `FAL-MIG-P-plan-v1.2` is preserved byte-for-byte at
   `plans/epics/archive/FAL-MIG-P-plan-v1.2.md`, size `82351`, SHA-256
   `2d713cef31010e1268a7242465a4f0cebf9fa4e8e5fd3364744828d360a36ea2`.
5. Its disposition is `SUPERSEDED_BEFORE_IMPLEMENTATION`, recorded in
   `plans/epics/FAL-MIG-P-v1.2-SUPERSESSION.md`.
6. The sole active Combined path remains
   `ops/Combined-Execution-Sequencing-Plan.md`; no second Combined is allowed.
7. Dirty router work remains protected at
   `src/fractal_agent_lab/integrations/router_fal_sync.py` and
   `tests/integrations/test_router_fal_sync.py`.

Implementation dependency:

The Stage A candidate may not be implemented until the generic CANON-HYDRATION
resolver, constrained reader/verifier, FAL profile, conformance suite, and current
FAL rehearsal are frozen as a review-ready Canon candidate. This plan can be
reviewed before that dependency is complete; it cannot bypass it. Therefore the
post-revision FAL Epic readiness is `NOT_READY`, Epic status is `PLANNED`, and
workflow phase is `PLAN_REVISION`. The active cross-project route returns to
CANON-HYDRATION implementation, not FAL Stage A.

## Exact Post-Revision Pointer Capsule

`ops/PROJECT_STATE.md` must record these exact operational facts after this plan
revision:

```text
Wave: FAL-CANON-MIG
Epic: FAL-MIG-P
Plan revision: FAL-MIG-P-plan-v2.0-final
Epic readiness: NOT_READY
Epic status: PLANNED
Workflow phase: PLAN_REVISION
Blocker: CANON-HYDRATION review-ready resolver/profile/conformance/FAL-rehearsal handoff missing
Next actor: Canon Workflow Maintenance / MAINTENANCE
Next action: continue CANON-HYDRATION /implement at CH-3 after accepted FAL-BARRIER evidence
```

The sole Combined `FAL-CANON-MIG` position 10 row must carry the following semantic
values without changing unrelated rows:

```text
Epic: FAL-MIG-P Canon Reference, Hydration Adoption, and Repository Simplification
Prerequisite: reviewed v2.0 plan exists; Stage A waits for the frozen review-ready CANON-HYDRATION handoff
Deliverable/evidence: plans/epics/FAL-MIG-P.md plus supersession/review lineage; Stage A additive/shadow/no-delete candidate later
Readiness: NOT_READY
Status / phase: PLANNED / PLAN_REVISION
Next unlock: CANON-HYDRATION implementation may continue; FAL Stage A /implement only after the exact Canon handoff
```

No row or state text may retain the old `FAL-MIG-P-plan-v1.2 -> /implement` route.

## Objective

Adopt the external generic CANON-HYDRATION interface and simplify FAL's governance
information architecture without vendoring the Canon, centralizing current project
truth, changing router/product behavior, or deleting files. Stage A produces and
reviews additive and shadow candidates, proves cold restoration, then applies only
the explicitly accepted additive/pointer changes. Destructive cleanup remains a
separate later Epic.

## Scope

Allowed Stage A surfaces:

```text
AGENTS.md
.gitignore                       # exact allowlist candidate only
ops/PROJECT_OVERLAY.md
ops/PROJECT_STATE.md
ops/Combined-Execution-Sequencing-Plan.md
ops/Review-Findings-Registry.md  # pointer/index normalization only
ops/roles/**
ops/archive/INDEX.md
ops/migration/**
plans/epics/FAL-MIG-P.md
plans/epics/FAL-MIG-P-v1.2-SUPERSESSION.md
plans/epics/archive/**
evidence/FAL-MIG-P/**
docs/reference/**                # additive FAL-specific cold references only
data/migration-candidates/**     # ignored shadow bytes and manifests
data/migration-baselines/**      # ignored rollback bytes
```

The existing router hot runbook may be inspected as a compatibility consumer but
is not a behavior-change target. Existing governance files remain live authority
until an independently reviewed shadow candidate is accepted.

## Non-Goals And Forbidden Surfaces

- no Canon vendoring or independent Canon fork;
- no generic resolver implementation in FAL;
- no global OpenCode command, skill, configuration, or snapshot mutation;
- no product source or product-test modification;
- no router behavior or router-test modification;
- no adoption, normalization, revert, staging, or commit of protected dirty hunks;
- no WorldSim, RingFall, or TriageCI mutation;
- no automatic compact, bridge/API/session delivery, dispatch, or restart;
- no second Combined file;
- no broad unignore, force-add, broad staging, or private-data publication;
- no move, redirect retirement, or deletion in Stage A;
- no Wave 8 activation from plan or candidate existence;
- no commit, push, PR, merge, deploy, release, or publication in implementation.

## Interfaces And Ownership

| Interface | Semantic owner | FAL responsibility |
|---|---|---|
| Hydration registry/request/result/failure law | Agent Workflow Canon | Adopt compatible FAL profile and provide project-owned stable facts |
| Current Wave/Epic/phase/candidate/blocker/next action | FAL state, sole Combined, current plan | Remain authoritative and compact |
| FAL identity, safety, privacy, exceptions | Root bootloader and `ops/PROJECT_OVERLAY.md` | Preserve project-local authority |
| Generic resolver/reader/verifier | Canon Workflow Maintenance | Consume read-only; never fork into FAL |
| Router transport mechanics | FAL router runbook/runtime owner | Keep separate and unchanged in this Epic |
| Concrete sessions, ports, endpoints, raw evidence | Private runtime/operator | Never enter durable hot governance or Canon registry |
| Archive/provenance | FAL governance | Keep discoverable, non-hot, and non-authoritative |

Effective authority is the strict intersection of Owner direction, FAL root/overlay,
state/Combined, current plan, Canon compatibility, role profile, and command. A
hydration result is a transient read plan and cannot select a new frontier.

## Temporary Accountable Profile

| Field | Contract |
|---|---|
| Profile ID | `FAL-MIG-P-V2-META-AUTHOR` |
| Base capability | `META` |
| Lane class | `GOVERNANCE` |
| Allowed writes | Exact Stage A governance/shadow/evidence surfaces listed by this plan |
| Forbidden writes | Product, router, global tool, target-project, `.swarm`, Git staging/commit/push, destructive cleanup |
| Required output | One byte-frozen Stage A candidate plus manifests, cold-restore/privacy/rollback evidence, and exact route |
| Review law | Author cannot perform candidate-bound `/step-review` |

## Feature -> User Story -> Task

### Feature FAL-MIG-V2-F1: External Canon Reference And Project Authority

#### User Story FAL-MIG-V2-US1.1

As a FAL session, I can identify the external Canon compatibility contract while
FAL project files remain the only authority for the current frontier.

| Task | Action | Output |
|---|---|---|
| `FAL-MIG-V2-T1` | Freeze Canon candidate identity and accepted FAL profile interface | Compatibility receipt |
| `FAL-MIG-V2-T2` | Create compact root and overlay shadow candidates | Bootloader/overlay shadow |
| `FAL-MIG-V2-T3` | Record sole-Combined naming exception and no-vendoring rule | Explicit FAL exceptions |
| `FAL-MIG-V2-T4` | Prove target root and FAL control root never substitute for each other | Dual-root evidence |

### Feature FAL-MIG-V2-F2: Lossless Classification And Durability

#### User Story FAL-MIG-V2-US2.1

As the FAL Owner, I can reduce hot context without losing unique rules or exposing
private runtime material.

| Task | Action | Output |
|---|---|---|
| `FAL-MIG-V2-T5` | Inventory governance, role, runbook, roadmap, import, archive, runtime, generated, and temporary families | Complete classification ledger |
| `FAL-MIG-V2-T6` | Map every shortened or redirected semantic owner, replacement pointer, consumer, validation, and rollback | Preservation ledger |
| `FAL-MIG-V2-T7` | Define exact durable allowlist and private/local-only exclusions | `.gitignore` shadow candidate and visibility report |
| `FAL-MIG-V2-T8` | Create non-hot archive/provenance indexes without moving source files | Additive indexes |

### Feature FAL-MIG-V2-F3: Compact State, Combined, And Role Hydration

#### User Story FAL-MIG-V2-US3.1

As a fresh authorized role, I can recover the minimum sufficient FAL packet and one
exact next action without loading project history.

| Task | Action | Output |
|---|---|---|
| `FAL-MIG-V2-T9` | Build a compact state shadow with revision, Wave/Epic/phase/candidate/blocker/next action | State shadow candidate |
| `FAL-MIG-V2-T10` | Build the sole-Combined replacement only at ignored `data/migration-candidates/<candidate-id>/ops/Combined-Execution-Sequencing-Plan.md`, headed `NON_AUTHORITATIVE_SHADOW`; no hot pointer may name it. The only admitted switch is atomic replacement of the existing `ops/Combined-Execution-Sequencing-Plan.md` with the exact byte-frozen reviewed shadow after ACK | Non-authoritative Combined shadow and one-operation switch manifest |
| `FAL-MIG-V2-T11` | Define Meta, Delivery, Review/Gate, Evidence, Orchestrator, and Closeout hydration deltas | Role profile candidates |
| `FAL-MIG-V2-T12` | Define exact cold-reference triggers and stop-on-sufficiency behavior | Cold-reference map |

### Feature FAL-MIG-V2-F4: Shadow Proof And Additive Adoption

#### User Story FAL-MIG-V2-US4.1

As the FAL operator, I can prove and adopt one complete governance generation
without deletion, mixed authority, or unreviewed pointer mutation.

| Task | Action | Output | Independent verification |
|---|---|---|---|
| `FAL-MIG-V2-T13` | Capture exact old bytes, complete path set, path hashes, protected-hunk identities, and rollback manifest before candidate construction | Baseline/rollback bundle and sanitized receipt | Restore all baseline paths in isolation and reproduce every byte count/hash |
| `FAL-MIG-V2-T14` | Validate schemas, pointers, privacy coverage, context budget, one-Combined law, roles, and explicit negative readiness controls | Validation matrix | Prove `NOT_READY` or `BLOCKED` for missing/stale Canon identity, stale state/Combined identity, target/control-root mismatch, missing required private mapping, and protected-hunk drift; none may return `READY` |
| `FAL-MIG-V2-T15` | Freeze the complete shadow bytes, operation order, manifests, receipts, and candidate hash; route independent candidate-bound `/step-review` | Frozen candidate identity and review packet | Reviewer resolves the exact candidate hash and all required evidence without mutation |
| `FAL-MIG-V2-T16` | Admit apply only after `Closeout disposition: ALLOWED`, exact Delivery `ACK_ONLY`, unchanged candidate/baseline/protected hashes, and an exclusive maintenance boundary; apply the exact operation manifest | ACK-gated Stage A adopted generation | Journal proves every write used reviewed bytes; no unlisted operation, move, or delete occurred |
| `FAL-MIG-V2-T17` | Re-run live cold restore, privacy, one-Combined, byte/consumer equivalence, rollback readiness, and forbidden-surface checks; record Stage B debt | Stage A closeout candidate | Independent evidence confirms one complete live generation and unchanged forbidden surfaces |

## Ordered Implementation Plan

1. Rehydrate FAL and Canon identities; abort on stale plan, Canon candidate, state,
   Combined, or protected-hunk identity.
2. Freeze a complete read-only path/classification/consumer inventory.
3. Create ignored raw-byte baseline and rollback manifests for every existing Stage A
   authority path; verify restoration in isolation.
4. Create only additive shadow bootloader, overlay, role, archive, evidence, state,
   Combined, and allowlist candidates while old authority remains live.
5. Validate the shadow files against the accepted generic hydration interface.
6. Run role-by-role FAL cold-restore rehearsals including dual-root, stale pointer,
   missing private runtime mapping, context budget, and protected-router negatives.
   Missing or stale Canon identity, stale state/Combined identity, target/control-root
   mismatch, missing required private mapping, and protected-hunk drift must produce
   their declared `NOT_READY` or `BLOCKED` disposition and never `READY`.
7. Freeze exact candidate bytes, operation order, rollback identities, privacy
   coverage, and no-delete attestation.
8. Route the frozen candidate to independent `/step-review`, then route the exact
   synthesis through `/step-review-utan`.
9. Apply only exact accepted additive/pointer operations when closeout disposition
   and ACK permit them; never build content during apply.
10. Verify one active generation, exact live bytes, all consumers, cold restore,
    privacy, rollback readiness, and unchanged forbidden surfaces.
11. Keep every move/delete/redirect-retirement candidate in a named future Stage B
    Epic; do not execute it here.

## Risks And Controls

| Risk | Control | Stop condition |
|---|---|---|
| Canon candidate changes during FAL work | Pin compatibility/profile/resolver identities | Any identity drift |
| Registry becomes current FAL truth | Store only stable profile facts; compare against project authority | Registry/project conflict |
| Hot packet loses unique rules | Section-level preservation and role rehearsals | Unmapped unique content |
| Broad durability leaks private data | Exact allowlist plus per-path privacy coverage | Skipped/unreadable/unclassified path |
| Shadow becomes second authority | Ignored candidate root, explicit non-authority labels, no hot pointer | Any live pointer to shadow |
| Mixed old/new generation | Byte-frozen candidate, ordered writes, complete rollback | Partial or ambiguous generation |
| Router work is absorbed | Pre/post path and hunk hashes | Any protected path drift |
| False cold-restore green | Expected blockers remain blocked; seven-question sufficiency | Missing authority reported READY |

## Acceptance -> Verification -> Evidence

| ID | Acceptance | Verification | Evidence |
|---|---|---|---|
| `FAL2-AC01` | External Canon remains one reusable semantic owner | No-vendoring and reference scan | Canon reference report |
| `FAL2-AC02` | FAL state/Combined remain current authority | Conflict and precedence negatives | Authority report |
| `FAL2-AC03` | Exactly one active Combined at retained path | Entry-point/pointer scan | One-Combined report |
| `FAL2-AC04` | Every in-scope source has classification and owner | Ledger path-set comparison | Classification ledger |
| `FAL2-AC05` | Shortening loses no unique information | Semantic preservation review | Source-successor-consumer map |
| `FAL2-AC06` | Hot state is compact and decision-complete | Line/token budget plus seven questions | State hydration report |
| `FAL2-AC07` | All role packets resolve minimally and fail closed; missing/stale Canon, stale state/Combined, dual-root mismatch, missing private mapping, and protected-hunk drift never return `READY` | Role/profile cold-restore matrix with named expected `NOT_READY`/`BLOCKED` assertions | Resolver/verifier receipts |
| `FAL2-AC08` | FAL dual-root boundary is preserved | Target/control mismatch negatives | Dual-root report |
| `FAL2-AC09` | Private runtime stays private and non-authoritative | Secret/session/path/privacy scan | Complete privacy coverage manifest |
| `FAL2-AC10` | Protected router work is untouched | Before/after hashes and diff-hunk identity | Protected-scope report |
| `FAL2-AC11` | Stage A performs no move or deletion | Operation-manifest audit | `DELETE = none` attestation |
| `FAL2-AC12` | Rollback restores every existing path exactly | Isolated full-manifest restoration | Byte/hash equivalence report |
| `FAL2-AC13` | No target/global/remote/process side effect occurs | Cross-root/config/Git/process inspection | Scope attestation |
| `FAL2-AC14` | Frozen candidate has independent acceptance | Candidate hash plus review/ACK lineage | Review evidence |

## Task -> Acceptance -> Evidence Crosswalk

| Tasks | Acceptance IDs | Primary evidence |
|---|---|---|
| `T1-T4` | `AC01`, `AC02`, `AC08`, `AC13` | Canon compatibility and dual-root authority reports |
| `T5-T8` | `AC04`, `AC05`, `AC09`, `AC11` | Classification, preservation, privacy, and no-delete ledgers |
| `T9-T12` | `AC02`, `AC03`, `AC06`, `AC07` | State/Combined/role/cold-reference candidates and hydration receipts |
| `T13` | `AC10`, `AC12`, `AC13` | Baseline receipt, protected-hunk report, isolated restoration proof |
| `T14` | `AC03`, `AC06`, `AC07`, `AC08`, `AC09`, `AC10` | Validation matrix with explicit false-READY negatives |
| `T15` | `AC14` | Frozen candidate manifest and independent review packet |
| `T16` | `AC03`, `AC10`, `AC11`, `AC13`, `AC14` | ACK-gated transaction journal and exact operation audit |
| `T17` | `AC01-AC14` | Live equivalence, cold restore, privacy, rollback, and scope closeout reports |

## Handoffs And Exact Blockers

Dependency handoff from Canon Workflow Maintenance must provide:

```text
frozen CANON-HYDRATION candidate identity
registry/request/result schema identities
FAL project-profile identity
resolver and constrained-reader/verifier identities
Windows PowerShell conformance result
current FAL rehearsal disposition
known release-blocking external tooling debt
```

Exact implementation blocker after plan revision:

```text
CANON-HYDRATION resolver/profile/conformance candidate is not yet frozen as
review-ready, so FAL Stage A implementation cannot start.
```

This blocker does not prevent the final plan revision. The successor plan identity,
single review, supersession evidence, and corrected state/Combined route are the
required pre-code barrier consumed by CANON-HYDRATION. It blocks only FAL Stage A.

## Done Criteria

The Epic is complete only when Stage A has a candidate-bound independent review,
exact Delivery response, accepted additive/pointer application or explicit no-apply
disposition, complete live verification, fresh-role cold restore, privacy coverage,
rollback proof, state/Combined reconciliation, and no forbidden-surface change.
Stage B remains a separate future lifecycle.

## Review Revision Mapping

| Review correction | Applied disposition |
|---|---|
| Reconcile stale state/Combined route | Added the exact post-revision pointer capsule and `NOT_READY / PLANNED / PLAN_REVISION` semantics |
| Prevent a second Combined shadow | Added exact ignored path, `NON_AUTHORITATIVE_SHADOW` label, and one atomic replacement operation |
| Make false-READY negatives explicit | Added named `NOT_READY`/`BLOCKED` assertions to T14, ordered checks, and AC07 |
| Split proof boundaries | Expanded T13-T17 into independently verifiable baseline, validation, freeze/review, ACK-gated apply, and post-apply tasks |
| Add crosswalk | Added Task -> acceptance -> evidence mapping |

No review item was rejected or left unclear.

## REVISED EPIC IMPLEMENTATION PLAN

Target: FractalAgentLab repository governance and information architecture

Epic: `FAL-MIG-P`

Wave: `FAL-CANON-MIG`

Accountable Lane / class / profile: Meta Coordinator / `GOVERNANCE` /
`FAL-MIG-P-V2-META-AUTHOR`

Prerequisites/current state: Planning lifecycle complete; FAL Stage A blocked on the
frozen review-ready CANON-HYDRATION implementation handoff.

Scope/non-goals: Stage A additive/shadow/no-delete FAL governance only; no Canon,
resolver, product, router, global-tool, target, remote, or destructive mutation.

Interfaces/ownership: Canon owns reusable hydration semantics; FAL owns current
project authority and local information architecture; private runtime owns concrete
session/transport data.

Feature -> User Story -> Task: Explicit F1/US1.1/T1-T4, F2/US2.1/T5-T8,
F3/US3.1/T9-T12, and F4/US4.1/T13-T17 hierarchy above.

Risks: Registry staleness, knowledge loss, privacy exposure, second authority,
mixed generations, protected-hunk absorption, and false readiness are fail-closed by
the named gates.

Ordered implementation plan: Steps 1-11 above after the Canon handoff.

Acceptance -> verification -> evidence: `FAL2-AC01` through `FAL2-AC14` and the
task crosswalk above.

Handoffs/exact blockers: Frozen review-ready CANON-HYDRATION resolver, reader/
verifier, FAL profile, conformance, and rehearsal identities are required.

Plan artifact: `plans/epics/FAL-MIG-P.md`

Next route: Canon Workflow Maintenance continues CANON-HYDRATION `/implement` at CH-3

Readiness: BLOCKED

```text
DELIVERY PLAN REVISION
Target: FractalAgentLab repository governance and information architecture
Epic: FAL-MIG-P
Accountable Lane / class / profile: Meta Coordinator / GOVERNANCE / FAL-MIG-P-V2-META-AUTHOR
Applied review items: exact pointer capsule; non-authoritative Combined shadow and atomic switch; explicit false-READY negatives; independently verifiable T13-T17; task/evidence crosswalk
Rejected/unclear items: none
Final plan artifact: plans/epics/FAL-MIG-P.md
PLAN_REVISION_COMPLETE
IMPLEMENT_BLOCKED
```
