# CANON-HYDRATION and FAL-MIG-P v2 Transition Plan

## 1. Document Control

| Field | Value |
|---|---|
| Document type | Owner-decided architecture and transition plan |
| Projects | Agent Workflow Canon, FractalAgentLab, WorldSim, RingFall, TriageCI |
| Primary future Epic | `CANON-HYDRATION` |
| Dependent future Epic | Replanned `FAL-MIG-P v2.0` |
| Status | `PLANNING_ONLY` |
| Design readiness | `READY` |
| Implementation authority | Not granted by this document |
| Migration authority | Not granted by this document |
| Destructive cleanup authority | Not granted by this document |
| Current FAL plan affected | `plans/epics/FAL-MIG-P.md`, revision `FAL-MIG-P-plan-v1.2` |
| Current FAL plan disposition | Must later become `SUPERSEDED_BEFORE_IMPLEMENTATION` through an authorized lifecycle |
| Prepared from | Owner grill-me decisions and read-only architecture review |
| Date | 2026-07-26 |

This document records the complete accepted design direction. It is not an
implementation candidate, does not itself supersede the current FAL lifecycle
pointers, and does not authorize edits to the Agent Workflow Canon, global OpenCode
commands or skills, project authority files, source code, tests, router behavior,
Git state, remote repositories, or active sessions.

## 2. Executive Decision

The full Agent Workflow Canon SHALL NOT be migrated or copied into
FractalAgentLab. The Canon SHALL remain the common workflow kernel and SHALL gain a
central, machine-readable, multi-project hydration catalog plus a read-only
hydration resolver.

One generic `/after-compact` command, backed by `context-restore`, SHALL restore the
minimum sufficient context for the resolved project, logical session profile,
role, Accountable Lane, and lifecycle phase. It SHALL load deterministic hot
context, retain exact knowledge of intentionally cold context, and follow cold
references only when a named trigger makes them decision-relevant.

Each project's current execution truth SHALL remain project-local:

- current Wave and Epic;
- current workflow phase;
- current candidate or pinned artifact;
- project domain truth and safety constraints;
- exact blockers and next action;
- project-specific acceptance and evidence authority.

The Canon SHALL own the reusable hydration protocol, registry schema, base role and
phase packet law, compatibility contract, failure taxonomy, and resolver semantics.
The project SHALL own its current execution state and project-specific truth.

FractalAgentLab repository cleanup SHALL be a separate project-governance Epic. It
SHALL adopt the generic hydration interface and clean FAL information architecture
without implementing the resolver or mutating global OpenCode tooling.

## 3. Why The Direction Changes

The existing `FAL-MIG-P-plan-v1.2` correctly identified real problems:

- duplicated workflow doctrine;
- oversized hot authority files;
- ignored or untracked governance truth;
- weak fresh-clone durability;
- ambiguous archive, import, and runtime boundaries;
- missing compact role-specific hydration packets;
- unsafe broad cleanup risk;
- protected concurrent router work.

Its proposed full migration and cutover model is now considered unnecessarily
heavy for the desired operating model. The reusable Canon already exists as a
separate common source. The higher-value architecture is to improve selective
hydration and then clean each project locally.

The selected replacement direction is:

```text
central Agent Workflow Canon
+ central project and hydration catalog
+ one generic /after-compact
+ project/role/session/phase-specific minimum packet
+ exact cold references and triggers
+ project-local current execution authority
+ project-by-project information-architecture cleanup
```

This is a material change to scope, ownership, dependencies, architecture, and
acceptance. The current `IMPLEMENT_READY` state of `FAL-MIG-P-plan-v1.2` therefore
cannot be reused.

## 4. Meaning Of Project Root

Within hydration contracts, `root AGENTS.md` means the `AGENTS.md` at the root of
the current target project repository or worktree. It does not mean the Canon root.

Examples:

```text
<FAL_ROOT>/AGENTS.md
<WORLDSIM_ROOT>/AGENTS.md
<RINGFALL_ROOT>/AGENTS.md
<TRIAGECI_ROOT>/AGENTS.md
```

The root file is a compact project bootloader. It identifies the project, points to
the project overlay and live operational authorities, records the adopted Canon
compatibility contract, and exposes non-negotiable local constraints. It must not
duplicate the complete lifecycle or project history.

## 5. Confirmed Existing Foundation

The current system already contains three complementary after-compact layers:

| Layer | Current surface | Responsibility |
|---|---|---|
| Global command | `~/.config/opencode/commands/after-compact.md` | Entry point, arguments, terminal contract |
| Global skill | `~/.config/opencode/skills/context-restore/SKILL.md` | Reusable restoration method |
| Canon event runbook | `Agent-Workflow-Canon/runbooks/AFTER-COMPACT-RUNBOOK.md` | Project-neutral semantic restore law |

The existing design already requires:

1. target identification;
2. root bootloader and hot project overlay;
3. compact project state;
4. the exact active Epic and direct prerequisite rows;
5. one primary role runbook;
6. the current plan section or pinned phase artifact;
7. bounded uncertainty-driven retrieval;
8. a final hydration sufficiency test;
9. one exact next actor and command;
10. read-only behavior during restoration.

The current weakness is not the absence of the idea. The weakness is that selection
still relies primarily on prompt discipline and project-local prose. There is no
complete machine-readable project/profile registry and no deterministic resolver
contract shared by all four projects.

## 6. Canon Information Architecture Strengths

The existing Agent Workflow Canon is already well structured:

| Area | Responsibility | Normal load policy |
|---|---|---|
| `canon/` | Stable authority, lifecycle, role, state, evidence, context, and coordination laws | Relevant page only |
| `runbooks/` | Role and event procedures | One primary role runbook, at most one active event procedure |
| `reference/` | External command, skill, state-machine, and adapter references | On demand |
| `templates/` | Project and lifecycle artifact templates | Adoption or artifact creation only |
| `project-overlays/` | Distilled project examples | Overlay design only |
| `migration-prompts/` | Existing-project adoption and cleanup prompts | Migration only; cold afterward |
| `audit/` | Provenance, conflicts, traceability, and backlog | Never routine hydration |
| `scripts/` | Read-only pack validation | Canon maintenance only |
| `MANIFEST.md` | Rule locator and load policy | Navigation when needed |

The Canon's strongest invariant is:

> Load the minimum sufficient, current, authoritative packet that preserves the
> maximum decision-relevant context for exactly one safe next action.

Minimum sufficient context is not minimum possible text. Omitting authority,
scope, candidate identity, acceptance, blockers, or next action is under-hydration.
Loading unrelated history, full registries, all role runbooks, or broad project
documentation is over-hydration.

## 7. Target Architecture

```text
Agent Workflow Canon
├── canonical lifecycle and authority kernel
├── machine-readable multi-project registry
├── base role and lifecycle-phase packet definitions
├── project-specific logical role/session profiles
├── cold-reference trigger map
├── compatibility and invalidation contract
└── read-only hydration resolver

Global OpenCode
├── /after-compact
├── context-restore
├── /wave-start
└── context-onboarding

Project repository or declared governance store
├── root AGENTS.md
├── PROJECT_OVERLAY
├── PROJECT_STATE
├── Combined
├── active Epic plan
├── role/Track profiles
└── finding/evidence pointers

Private runtime
├── concrete OpenCode session IDs
├── ports and credentials
├── router transport state
├── raw transcripts
└── raw/generated evidence
```

## 8. Authority Model

| Surface | Authority |
|---|---|
| Shared lifecycle, roles, authority, and hydration law | Agent Workflow Canon |
| Registry schema and resolver contract | Agent Workflow Canon |
| Stable project catalog and hydration profile projection | Canon registry, from project-owner-approved data |
| Current Wave, Epic, phase, candidate, blocker, and next action | Project state, Combined, and current plan |
| Project domain truth and explicit safety exceptions | Project root instructions and project overlay |
| Concrete runtime session IDs, ports, auth, and transport state | Project/router private runtime registry |
| Installed command and skill behavior | Live global OpenCode configuration |
| Compact summary | Orientation cache only |
| FAL checkpoint and active-context mirror | Supporting mirror/evidence only |

The Canon registry is the common resolver catalog, but it cannot silently override
current project authority. Project-specific registry data must identify its owning
project surface and synchronization identity. A registry/project mismatch blocks
restoration and routes reconciliation to the owning project Meta or Owner.

## 9. Project Registry Scope

The first release SHALL support the following projects through one generic schema:

- FractalAgentLab;
- WorldSim;
- RingFall;
- TriageCI.

The resolver implementation MUST NOT branch on project names. Differences SHALL be
represented as declarative data.

Each project registry entry SHALL define at least:

- stable project ID and aliases;
- root discovery and verification markers;
- declared governance-store type;
- root bootloader path;
- project overlay path;
- project state path;
- Combined path and naming exception, if any;
- findings and evidence index pointers;
- role and logical session profiles;
- active-plan locator law;
- Canon version/schema compatibility;
- FAL control-plane mode;
- privacy and redaction classes;
- stable section IDs or approved legacy bounded locators;
- profile owner and synchronization identity;
- failure and escalation owner.

## 10. Governance Store Types

Every project's minimum governance packet SHALL be versioned and restorable, but
the physical store may differ by project:

```text
PUBLIC_SAFE_MAIN_REPO
PRIVATE_MAIN_REPO
PRIVATE_COMPANION_GOVERNANCE_REPO
```

The minimum durable packet SHOULD contain:

- root bootloader;
- project overlay;
- compact project state;
- active Combined;
- role and Track profiles;
- active Epic plans;
- sanitized finding/evidence indexes;
- hydration pointers and compatibility metadata.

The following remain private runtime data unless separately authorized:

- session IDs;
- credentials;
- ports and private endpoints;
- router transport state;
- raw transcripts;
- raw customer or private evidence;
- generated runs and temporary logs.

## 11. Logical Session Model

The Canon SHALL store stable logical profiles, not concrete runtime sessions.

Examples:

```text
fal.meta
fal.orchestrator
fal.track-a
worldsim.meta
worldsim.balance-qa
worldsim.combat-coordinator
ringfall.meta
ringfall.smr-analyst
triageci.failure-classifier
triageci.rca-agent
triageci.pr-auditor
```

Concrete session IDs and transport data remain in the private runtime registry.
Runtime mapping resolves:

```text
logical profile -> current OpenCode session
```

Profile topology or model choice cannot increase authority. Effective authority is
the strict intersection of base role, project profile, Accountable Lane, current
plan, command, and Owner envelope.

## 12. Explicit-First Resolution

Resolution precedence SHALL be:

1. explicit project, target, role, and session arguments;
2. pinned compact-boundary record;
3. private logical-session registry;
4. registered target-root identity;
5. root bootloader and project descriptor;
6. Git/repository/worktree evidence;
7. working directory as corroboration only.

The process working directory, a familiar session label, or the FAL control root is
never sufficient target authority.

Any disagreement between explicit identity and resolved identity SHALL block.

## 13. Context Selection Model

The selected packet SHALL have four layers:

```text
deterministic universal packet
+ deterministic project delta
+ deterministic role and lifecycle-phase delta
+ bounded uncertainty-triggered references
```

The universal packet contains only the project frontier bootloader:

1. root instructions and exact hot project overlay sections;
2. compact project state;
3. exact active Epic row, Wave gate, and direct prerequisites/handoffs;
4. one primary role runbook;
5. current plan section or pinned phase artifact.

Project, role, and phase deltas add only context required for that assignment.

Before any additional retrieval, the session MUST name:

```text
unresolved_question
exact_pointer
trigger
decision_enabled
authority_class
revision_or_candidate_binding
invalidation_condition
```

Broad exploratory loading is not a valid uncertainty-resolution method.

## 14. Sufficiency Contract

Hydration is sufficient only when all seven questions are unambiguous:

1. Which Role and Accountable Lane own the action?
2. Which exact Wave, Epic, and workflow phase are active?
3. What exact input or pinned artifact is current?
4. Which repository, worktree, candidate, and configuration identity applies?
5. Which acceptance, evidence, dependency, and handoff facts matter now?
6. Which blocker, finding, or stop condition can prevent the action?
7. What exact output, next actor, and command are required?

When all seven are answered, retrieval MUST stop. Additional reading requires a new
named material uncertainty.

## 15. Hydration Resolver Interface

The resolver SHALL be a pure, read-only planning boundary:

```text
resolveHydration(request) -> HydrationResult
```

### 15.1 Request

```json
{
  "schema_version": "1",
  "project_id": "worldsim",
  "target_locator": "logical-or-explicit-root",
  "role_profile": "worldsim.balance-qa",
  "session_class": "EVIDENCE",
  "expected_wave": "optional",
  "expected_epic": "optional",
  "expected_phase": "optional",
  "compact_boundary": "optional",
  "expected_state_identity": "optional",
  "expected_candidate": "optional",
  "expected_canon_compatibility": "optional"
}
```

### 15.2 Result

```json
{
  "status": "READY",
  "resolution_basis": [],
  "canon_identity": {
    "version": "resolved",
    "schema_version": "resolved",
    "pack_digest": "resolved"
  },
  "project_identity": {
    "project_id": "worldsim",
    "root_identity": "resolved",
    "worktree_identity": "resolved",
    "state_identity": "resolved",
    "combined_row_identity": "resolved",
    "candidate_identity": "resolved",
    "pinned_artifact_identity": "resolved"
  },
  "required_reads": [],
  "cold_references": [],
  "triggered_references": [],
  "invalidation_key": "digest",
  "budget": {
    "files": 0,
    "sections": 0,
    "bytes": 0,
    "approx_tokens": 0
  },
  "blockers": [],
  "next_actor": "resolved",
  "next_command": "resolved",
  "nonclaims": []
}
```

### 15.3 Source Reference

Every required or cold source reference SHALL record:

- logical path;
- project-relative resolved path;
- stable section ID;
- bounded span;
- authority class;
- content hash;
- load reason;
- role/phase trigger;
- sensitivity/redaction class;
- invalidation condition.

Stable section IDs are preferred over Markdown headings. Explicit validated legacy
profiles may temporarily use bounded heading/hash locators until project cleanup.

### 15.4 Resolver Non-Responsibilities

The resolver SHALL NOT:

- mutate project or Canon state;
- select a new frontier;
- repair contradictions;
- route or send commands;
- create a compact-boundary record;
- expose credentials or concrete runtime session IDs;
- read arbitrary unregistered filesystem paths;
- traverse outside a registered root;
- follow ambiguous symlinks, reparse points, or traversal paths;
- replace project authority with Canon, FAL, or compact memory.

A separate constrained reader performs the declared reads. A verifier confirms that
the read bytes and identities still match the resolver result.

## 16. Invalidation Contract

Every result SHALL be keyed by a canonical invalidation digest that includes:

- Canon version, schema version, and pack digest;
- project ID and registered profile identity;
- target root and repository/worktree identity;
- state revision or state content hash;
- exact Combined row identity;
- role and logical session profile;
- workflow phase;
- current plan or pinned artifact hash;
- candidate and configuration identity;
- compact boundary and saved stage identity when present;
- relevant handoff or finding identity.

Any change invalidates the prior hydration result. Restore then starts from current
state and the changed pointer, not from prior memory.

## 17. Failure Taxonomy

The first resolver contract SHALL include at least:

```text
PROJECT_UNREGISTERED
PROJECT_AMBIGUOUS
ROOT_MISMATCH
TARGET_MISMATCH
WORKTREE_MISMATCH
ROLE_UNKNOWN
ROLE_AMBIGUOUS
ROLE_NOT_CURRENTLY_ELIGIBLE
PHASE_MISMATCH
STATE_POINTER_MISSING
STATE_IDENTITY_CHANGED
COMBINED_ROW_MISSING
COMBINED_ROW_CONFLICT
PINNED_ARTIFACT_MISSING
PINNED_ARTIFACT_MISMATCH
CANDIDATE_MISMATCH
COMPACT_BOUNDARY_STALE
PRIVATE_RUNTIME_MAPPING_MISSING
SECTION_ID_MISSING
SECTION_ID_DUPLICATED
SOURCE_HASH_CHANGED
CANON_RELEASE_INCONSISTENT
CANON_COMPATIBILITY_MISMATCH
BUDGET_EXCEEDED
IDENTITY_INVALIDATED_DURING_READ
BLOCKED_IDENTITY_CONFLICT
```

Behavior rules:

| Condition | Result |
|---|---|
| Known role but not the current authorized actor | `NOT_READY` |
| Unknown or contradictory role | `BLOCKED` |
| Missing runtime mapping required for the action | `BLOCKED` |
| Changed state, candidate, config, or artifact | `BLOCKED` |
| Registry and project authority conflict | `BLOCKED_IDENTITY_CONFLICT` |
| Optional cold reference not triggered | Omit from reads |
| Required reference missing | `BLOCKED` |
| Context budget exceeded without new decision value | `NOT_READY` and redesign debt |

Best-effort authority fallback is prohibited.

## 18. Canon Version And Compatibility

The accepted release model is:

```text
VALIDATED_COMPATIBLE_CURRENT
```

Rules:

- the Canon pack must have a consistent release identity;
- the Canon validator must pass before resolver use;
- every result records Canon version, schema version, and pack digest;
- each project profile records compatible schema/version policy or a strict pin;
- compatible updates may be consumed according to project policy;
- incompatible schema or major changes require explicit adoption;
- an inconsistent or partially updated Canon returns
  `CANON_RELEASE_INCONSISTENT`;
- the ambient sibling checkout is a discovery location, not proof of release
  consistency by itself.

Current Canon work appears to be changing concurrently. The implementation phase
must wait for the current maintenance owner to finish, then refresh the complete
baseline and verify that README, version, machine contract, validator, snapshot, and
changelog agree.

## 19. After-Compact Output Contract

The command SHALL perform the selected reads but SHALL NOT copy the full source text
back to the user. It SHALL return a compact, auditable manifest:

```text
HYDRATION SUFFICIENCY

Resolved project / target
Resolved role / session profile / Accountable Lane
Current Wave / Epic / phase
Canon version / schema / digest
Project state / Combined row / candidate identities
Sources actually loaded and reason
Cold sources intentionally not loaded
Trigger for every cold source
Relevant blockers and deferred findings
Contradictions
Hydration budget
State reconciliation needed
Exact next actor / command

Route class: RESUME_CURRENT_COMMAND | BLOCKED
Readiness: READY | NOT_READY | BLOCKED
```

The manifest is transient command output and is not project authority. The durable
correlation source is the pre-compact boundary record or other pinned stage artifact
owned by the active workflow.

## 20. CANON-HYDRATION Epic

### 20.1 Goal

Create one generic, deterministic, machine-verifiable, multi-project context
hydration system for the Agent Workflow Canon and the live `/after-compact` and
`context-restore` surfaces.

### 20.2 Accountable Ownership

The Accountable Lane belongs to Canon/global workflow maintenance. It does not
belong to FAL Meta solely because FAL hosts router or evidence surfaces.

### 20.3 Non-Goals

- no physical project repository cleanup;
- no centralization of current project execution state;
- no concrete session IDs or credentials in Canon;
- no automatic `/compact`;
- no deep OpenCode plugin context mutation in the first version;
- no FAL source, test, or router behavior change;
- no target product implementation;
- no project feature acceptance;
- no automatic push, PR, merge, deployment, or publication.

### 20.4 Planned Work

1. Wait for and inspect completion of concurrent Canon maintenance.
2. Freeze a consistent Canon baseline and collision report.
3. Define registry, profile, request, result, source-reference, and failure schemas.
4. Define stable section identity and bounded-read rules.
5. Define project catalog ownership and synchronization rules.
6. Define role/profile and role-phase legality.
7. Define Canon compatibility and invalidation serialization.
8. Implement a pure read-only resolver and validator.
9. Create declarative FAL, WorldSim, RingFall, and TriageCI profiles.
10. Integrate the contract into `/after-compact` and `context-restore`.
11. Assess and close compatibility impact on `/wave-start` and
    `context-onboarding`.
12. Add conformance fixtures and negative controls.
13. Run Canon pack validation.
14. Apply live global tool changes through the separate authorized maintenance
    mechanism.
15. Restart OpenCode where required by configuration-time loading.
16. Run cold-session proofs for all four projects.
17. Publish a compatibility matrix and explicit residual debt.

### 20.5 Acceptance Criteria

- one generic resolver supports all four projects;
- no project-name behavior branches exist;
- all project differences are declarative profile data;
- explicit-first auto-resolution behaves deterministically;
- FAL dual-root operation resolves the target correctly;
- required reads use bounded paths, section IDs, and hashes;
- cold references carry exact triggers;
- the same identity produces the same packet plan;
- state, candidate, config, profile, or Canon changes invalidate the result;
- resolver, reader, and verifier remain read-only;
- no credential, runtime session ID, or raw transcript enters normal output;
- command, skill, runbook, machine contract, and resolver remain conformant;
- all four current-frontier cold-session rehearsals pass;
- negative fixtures never return false `READY`;
- context budgets are measured;
- intentionally omitted context remains precisely retrievable;
- restart-time live command and skill discovery passes.

## 21. Verification Matrix

The selected strategy is:

```text
generic base-role and valid-phase contract matrix
+ every project-specific profile delta
+ one current-frontier cold restore per project
+ targeted negative controls
```

Minimum negative controls:

| Scope | Test |
|---|---|
| Common | Unknown project |
| Common | Ambiguous explicit and automatic project identity |
| Common | Root or worktree mismatch |
| Common | Role/phase mismatch |
| Common | Stale compact boundary |
| Common | Changed candidate or pinned artifact |
| Common | Missing Combined row or state pointer |
| Common | Canon version/schema incompatibility |
| Common | Missing or duplicated section ID |
| Common | Identity changes between resolve and read |
| Common | Context budget exceeded by irrelevant history |
| FAL | FAL control root with a non-FAL target |
| FAL | Protected router dirty scope remains non-authoritative |
| WorldSim | Specialist profile pointer missing |
| RingFall | Stale `.fal/ACTIVE_CONTEXT` against fresher target state |
| TriageCI | Required security/redaction delta omitted |
| Runtime | Logical profile exists but concrete session mapping is missing |
| Privacy | Credential or raw transcript attempts to enter output |

## 22. FAL-MIG-P v1.2 Disposition

The current `plans/epics/FAL-MIG-P.md` SHALL remain untouched until an authorized
supersession lifecycle begins.

That lifecycle SHALL:

1. freeze the exact current v1.2 bytes and SHA-256 identity;
2. preserve the existing plan and review lineage as immutable historical evidence;
3. mark the v1.2 plan `SUPERSEDED_BEFORE_IMPLEMENTATION`;
4. remove its `IMPLEMENT_READY` authority from active state and Combined pointers;
5. create a new `FAL-MIG-P-plan-v2.0` at the active path;
6. route v2.0 through a new `/seq-next` and one new `/terv-review` lifecycle.

The old review cannot approve the new architecture. The old plan remains evidence
of the rejected full-migration alternative and its safety analysis.

## 23. FAL-MIG-P v2.0 Goal

The replacement Epic SHALL be framed as:

```text
FAL Canon Reference, Hydration Adoption, and Repository Simplification
```

Its purpose is to:

- adopt the accepted generic CANON-HYDRATION interface;
- reduce the FAL hot authority packet;
- create a compact root bootloader and project overlay;
- keep project state compact and operational;
- reduce the active Combined to current/future Wave and Epic authority;
- define FAL role profiles and exact cold-reference triggers;
- keep router mechanics separate from lifecycle semantics;
- classify historical, imported, generated, temporary, and private material;
- establish a durable minimum governance packet;
- define precise ignore and allowlist behavior;
- create archive and provenance indexes;
- prove FAL cold restoration;
- prepare, but not execute, a later destructive cleanup gate.

## 24. FAL-MIG-P v2.0 Non-Goals

- no Canon vendoring into FAL;
- no implementation of the generic resolver;
- no global command or skill mutation;
- no cleanup of WorldSim, RingFall, or TriageCI;
- no product source or test change;
- no router behavior change;
- no adoption of existing dirty router-sync hunks;
- no deletion during the first cleanup lifecycle;
- no broad force-add or unignore;
- no Wave 8 activation from plan existence;
- no automatic commit, push, PR, merge, deployment, or publication.

## 25. FAL Target Information Architecture

The target shape is provisional until the new `/seq-next` plan freezes exact paths:

```text
FractalAgentLab/
├── AGENTS.md
├── ops/
│   ├── PROJECT_OVERLAY.md
│   ├── PROJECT_STATE.md
│   ├── Combined-Execution-Sequencing-Plan.md
│   ├── Review-Findings-Registry.md
│   ├── roles/
│   ├── archive/
│   │   └── INDEX.md
│   └── migration/
├── plans/
│   └── epics/
├── evidence/
├── docs/
│   ├── private/
│   ├── reference/
│   └── archive/
└── tools/
    └── oc-session-router/
        └── docs/
```

The existing active Combined path remains a FAL naming exception unless a later
Owner decision explicitly changes it:

```text
ops/Combined-Execution-Sequencing-Plan.md
```

No second active Combined may be created.

## 26. FAL Classification Taxonomy

Every in-scope FAL file SHALL receive exactly one primary classification:

```text
ACTIVE_AUTHORITY
ACTIVE_ROLE_PROFILE
ACTIVE_EPIC_PLAN
ACTIVE_ROUTER_MECHANICS
DURABLE_SANITIZED_EVIDENCE
PRIVATE_DOCTRINE
COLD_REFERENCE
HISTORICAL_PROVENANCE
IMPORTED_QUARANTINE
GENERATED_RUNTIME
TEMPORARY_APPLY_MATERIAL
BACKUP
SUPERSEDED
DELETE_CANDIDATE
PROTECTED_CONCURRENT_WORK
```

`DELETE_CANDIDATE` is a review status, not deletion authority.

For every shortened, redirected, moved, archived, or proposed-deletion surface,
the semantic-preservation ledger SHALL record:

```text
old surface
-> canonical semantic owner
-> exact replacement pointer
-> unique information retained or moved
-> consumers
-> validation
-> rollback
```

## 27. Two-Stage FAL Cleanup

### 27.1 Stage A: Additive And Shadow Cleanup

The first lifecycle SHALL:

1. inventory governance, runbook, role, roadmap, import, archive, runtime, and
   generated surfaces;
2. assign classifications and owners;
3. create the compact bootloader, project overlay, role profiles, and indexes as
   shadow candidates;
4. create a simplified Combined shadow candidate;
5. create a compact state shadow candidate;
6. define granular durability and ignore candidates;
7. preserve old files and exact bytes;
8. run consumer and pointer scans;
9. run FAL hydration and cold-restore proofs;
10. freeze and independently review the candidate;
11. perform only accepted additive/pointer changes;
12. delete nothing.

### 27.2 Stage B: Separately Reviewed Destructive Cleanup

Any move, redirect retirement, or deletion requires a later lifecycle with:

- accepted Stage A evidence;
- complete consumer proof;
- cold-restore proof;
- exact rollback bundle;
- privacy and retention disposition;
- frozen candidate;
- independent review;
- explicit path list;
- accepted closeout.

## 28. Protected Concurrent Work

The FAL cleanup SHALL preserve unrelated and concurrent work.

Known protected source and test paths include:

```text
src/fractal_agent_lab/integrations/router_fal_sync.py
tests/integrations/test_router_fal_sync.py
```

They remain prospective W8-E / Track D work and cannot be reformatted, reverted,
adopted, staged, committed, or used as cleanup baseline by FAL-MIG-P.

The current documentation delta at:

```text
tools/oc-session-router/docs/session-router-cheatsheet.md
```

is also pre-existing work. It may be classified and indexed but cannot be silently
overwritten or attributed to the cleanup Epic.

## 29. Cross-Project Cleanup Boundary

CANON-HYDRATION SHALL support all four projects in its first accepted release.
Physical repository cleanup remains project-local:

```text
CANON-HYDRATION accepted
-> FAL cleanup under FAL governance
-> WorldSim cleanup under WorldSim governance
-> RingFall cleanup under RingFall governance
-> TriageCI cleanup under TriageCI governance
```

Project cleanup Epics may later run independently when their current lifecycle,
scope, owner, and file-collision gates permit. No project may be changed merely
because its profile exists in the central registry.

## 30. Required Execution Order

1. The current separate Canon maintenance work completes.
2. A fresh read-only Canon baseline, release-consistency check, and collision scan
   are produced.
3. A `CANON-HYDRATION` workflow-change specification is accepted.
4. Registry, resolver, output, compatibility, and version interfaces are frozen.
5. The existing FAL-MIG-P v1.2 bytes and review lineage are preserved.
6. FAL lifecycle pointers formally supersede v1.2 and reopen planning.
7. `FAL-MIG-P-plan-v2.0` is produced through a new `/seq-next` against the frozen
   hydration interface.
8. CANON-HYDRATION implementation and conformance are completed through their own
   maintenance lifecycle.
9. FAL-MIG-P Stage A additive/shadow cleanup is implemented and reviewed.
10. FAL cold-restore, privacy, durability, and rollback evidence is accepted.
11. A separate destructive cleanup Epic may be proposed.
12. Other projects may start their own cleanup Epics independently.

The FAL v2 planning step does not need to wait for complete resolver implementation.
It does require an accepted resolver interface contract.

## 31. Coupled Surface Assessment

The CANON-HYDRATION design must assess all of these consumers:

| Consumer | Expected impact |
|---|---|
| Canon context hydration law | `IMPACTED` |
| Canon after-compact runbook | `IMPACTED` |
| Canon machine contract | `IMPACTED` |
| Canon manifest and validator | `IMPACTED` |
| Global `/after-compact` | `IMPACTED` |
| Global `context-restore` | `IMPACTED` |
| Global `/wave-start` | Must be assessed |
| Global `context-onboarding` | Must be assessed |
| Project root bootloader template | `IMPACTED` |
| Project overlay template | `IMPACTED` |
| Role profile template | `IMPACTED` |
| Project state template | Must be assessed |
| FAL router runbook | Compatibility assessment only unless behavior changes |
| FAL checkpoint/active-context adapter | Compatibility assessment only |
| Toolbox snapshot | Refresh only after verified live apply |

Any affected surface left unresolved becomes `DEFERRED_BLOCKS_RELEASE` for the
CANON-HYDRATION release.

## 32. Safety And Privacy Invariants

- restoration is read-only;
- no command send occurs during restore;
- no automatic process restart occurs;
- no credential guessing occurs;
- no speculative repair occurs;
- no arbitrary console exploration occurs;
- no session ID, credential, private endpoint, or raw transcript enters durable
  normal output;
- FAL control-plane identity never replaces target identity;
- target and control roots remain distinct;
- project authority remains ahead of compact memory and FAL mirrors;
- path traversal, unregistered roots, ambiguous symlinks, and reparse ambiguity
  block;
- every lower role reports a structured blocker to its accountable parent;
- only Meta or Orchestrator may consolidate an Owner question;
- no cleanup mutates unrelated or concurrent work.

## 33. Context Quality Metrics

Metrics inform maintenance but do not replace semantic sufficiency.

The resolver SHOULD report:

- number of loaded files;
- number of bounded sections;
- UTF-8 byte count;
- approximate token count;
- number of cold references retained;
- number of triggered references followed;
- retrieval count;
- invalidation identity;
- time to resolve and verify;
- readiness result;
- any reason for exceeding the normal budget.

The existing Canon targets remain useful defaults:

```text
normal hot governance packet target: approximately 3000 tokens
redesign review threshold: approximately 4000 tokens
PROJECT_STATE target: no more than 120 lines
normal primary role runbooks: 1
normal active event procedures: at most 1
```

A smaller packet that fails sufficiency is a regression. A larger packet with no new
decision-relevant content is also a regression.

## 34. Rollout And Rollback

### 34.1 CANON-HYDRATION Rollout

1. schema and resolver contract in shadow mode;
2. fixture validation against current project structures;
3. advisory manifest comparison against current manual restore;
4. command/skill candidate review;
5. authorized live apply;
6. OpenCode restart;
7. four-project cold-session verification;
8. release and compatibility record.

### 34.2 CANON-HYDRATION Rollback

Rollback SHALL restore the previously verified command, skill, Canon contract, and
snapshot identities. A resolver failure must not leave `/after-compact` silently
using an unverified hybrid of old and new contracts.

### 34.3 FAL Cleanup Rollback

Stage A is additive-first and preserves previous authority bytes. Pointer switches
must have an exact restoration map. Stage B destructive cleanup requires a separate
complete rollback bundle.

## 35. Residual Risks

| Risk | Mitigation |
|---|---|
| Central registry becomes stale project truth | Project-owned profile identity, conflict detection, fail closed |
| Resolver becomes a second state authority | Pure planning interface, no mutation or frontier selection |
| Prompt and resolver drift | Shared machine contract and conformance fixtures |
| Canon changes during project work | Version/schema compatibility and invalidation digest |
| Excessive static packet | Role/phase deltas and measured budgets |
| Under-hydration | Seven-question sufficiency contract and negative fixtures |
| Project-specific code branches accumulate | Declarative extension schema and no-name-branch acceptance test |
| Runtime secrets leak through manifest | Logical profiles, redaction classes, private runtime separation |
| Cleanup deletes unique knowledge | Semantic-preservation map and two-stage cleanup |
| Concurrent work is absorbed | Hunk/path ownership ledger and explicit protected-work classification |
| Global tooling breaks on apply | Separate authorized maintenance lifecycle, validation, restart, rollback |

## 36. Explicitly Deferred Implementation Decisions

The following are implementation-owned decisions after the interface contract is
accepted:

- resolver implementation language;
- exact registry directory and file partitioning;
- JSON Schema filenames;
- stable section ID syntax;
- fixture directory layout;
- canonical invalidation serialization;
- exact command argument names;
- optional convenience aliases;
- implementation-specific caching strategy;
- cross-platform launcher mechanics.

These decisions must preserve the public interface, read-only behavior, portability,
determinism, and no-project-name-branch invariant.

## 37. Current State And Immediate Route

The old route is no longer valid:

```text
FAL-MIG-P v1.2 -> /implement
```

The required future route is:

```text
current Canon maintenance completes
-> baseline and collision refresh
-> CANON-HYDRATION contract-first workflow design
-> resolver interface freeze
-> FAL-MIG-P v1.2 supersession lifecycle
-> new FAL-MIG-P v2.0 /seq-next
```

This document does not execute any of those steps. It is the decision-complete
planning input for them.

## 38. Planning Terminal

```text
ARCHITECTURE_DIRECTION_ACCEPTED
CANON_HYDRATION_CONTRACT_PLANNING_READY
FAL_MIG_P_V1_IMPLEMENT_NOT_AUTHORIZED
FAL_MIG_P_V2_REPLAN_REQUIRED
NO_IMPLEMENTATION_PERFORMED
```
