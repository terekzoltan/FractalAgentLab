# WORKFLOW CHANGE SPEC

## 1. Control

| Field | Value |
|---|---|
| Specification ID | `CANON-HYDRATION-WORKFLOW-CHANGE-SPEC-v1.0` |
| Accountable Lane | Canon Workflow Maintenance / `MAINTENANCE` |
| Owner authorization | 2026-07-26: start the canonical lifecycle and adopt, repair, replace, or remove the unfinished Canon hydration candidate |
| Design input | `plans/epics/CANON-HYDRATION-FAL-MIG-P-v2-Transition-Plan.md` |
| Target Canon baseline | Agent Workflow Canon `1.2.2`, machine schema `1.2.1` |
| Change class | Backward-compatible capability addition with fail-closed adoption gates |
| Global apply authority | Not included; `/oc-toolsmith` hash-bound approval remains mandatory |
| Destructive project cleanup | Not included |

## 2. Accepted Intent

Create one project-neutral, deterministic, read-only hydration contract that can
select and verify the minimum sufficient context packet for FractalAgentLab,
WorldSim, RingFall, TriageCI, and later declaratively enrolled projects.

The contract shall serve both compact recovery and cold onboarding without making
the Canon registry a second source of current project state. Project files remain
authoritative for the active Wave, Epic, workflow phase, candidate, blockers,
evidence, and next action.

The live `/after-compact` and `context-restore` pair shall become resolver-first.
The `/wave-start` and `context-onboarding` pair shall use the same project, role,
phase, source-reference, invalidation, and failure semantics for cold starts.

## 3. Non-Goals

- no automatic compaction;
- no command dispatch during hydration;
- no mutation of project, router, runtime, session, or FAL evidence state;
- no central storage of current project execution truth;
- no concrete OpenCode session IDs, credentials, ports, private endpoints, or raw
  transcripts in the Canon registry or normal hydration output;
- no project-name conditionals in resolver behavior;
- no FAL product source, test, or router behavior change;
- no physical cleanup of WorldSim, RingFall, or TriageCI;
- no FAL file deletion or Stage B cleanup;
- no live global command or skill mutation outside `/oc-toolsmith`;
- no automatic process restart, commit, push, PR, merge, deployment, or publication.

## 4. Current Behavior And Failure Evidence

The existing manual hydration law is sound but prompt-disciplined. The live global
command and skill load root instructions, project state, an active Combined row, one
role runbook, and a current plan or pinned artifact, then apply a sufficiency test.
They do not have a shared machine-readable resolver request, result, source-reference,
invalidation, compatibility, or failure contract.

The unfinished Canon candidate is adoptable input, not an accepted implementation.
The following failures were independently reproduced or inspected:

| ID | Severity | Evidence | Required disposition |
|---|---|---|---|
| `CH-B01` | Critical | `scripts/resolve-hydration.ps1` fails on Windows PowerShell while constructing its result object | Replace generic collection serialization with PS 5.1/7-compatible deterministic output and test both engines when available |
| `CH-B02` | Critical | lexical containment does not reject a reparse point, junction, or symlink in the root-to-leaf chain | Canonicalize and validate root plus every traversed component; block ambiguous or escaping paths |
| `CH-B03` | High | `enrollment_status` is parsed but not enforced | Non-active enrollment must never return `READY` |
| `CH-B04` | High | request omits expected state, Wave, Epic, candidate, compact boundary, configuration, and prior invalidation identities | Freeze and implement the full expected-identity request contract |
| `CH-B05` | High | heading checks load and hash whole files without unique bounded spans | Parse exact unique sections, return line/byte bounds, hash the selected span, and reject duplicates |
| `CH-B06` | High | budget is reported but not enforced | Return `BUDGET_EXCEEDED` before `READY` when required packet exceeds the accepted limit |
| `CH-B07` | High | `PRIVATE_RUNTIME_FORBIDDEN` entries are not rejected | Schema validation and runtime enforcement must reject them from normal reads/output |
| `CH-B08` | High | invalidation omits registry/profile, worktree, state, Combined row, candidate, compact boundary, and resolver identities | Canonical serialization must include every identity that can invalidate the packet |
| `CH-B09` | High | FAL candidate points to a nonexistent successor plan; WorldSim/RingFall durability is incomplete | Correct current profiles and preserve explicit blocked enrollment where project authority is not durable |
| `CH-B10` | High | pack validation does not execute hydration registry/resolver conformance | Add schema, deterministic, privacy, negative, and project-profile checks to `validate-pack.ps1` |

## 5. Target Invariants

1. The resolver is project-neutral and contains no behavior branch keyed by a
   project ID, alias, repository name, or workstation path.
2. Registry entries contain stable discovery and profile facts only. Current
   execution truth is read from the resolved target root.
3. Explicit project/root/profile/phase values take precedence. Automatic signals
   may confirm an explicit identity but never silently replace it.
4. Ambiguous project, root, role, phase, authority, section, candidate, or compact
   identity returns `BLOCKED`.
5. A known role that is not eligible for the current phase returns `NOT_READY`.
6. Non-active enrollment returns `BLOCKED` with its declared enrollment reason.
7. A resolution result is a transient read plan, not project authority.
8. Required reads are exact, bounded, sensitivity-classified, and hash-bound.
9. Every exact section selector resolves to one and only one span.
10. Resolver, constrained reader, and verifier perform no writes and dispatch no
    commands.
11. Every read is constrained to a registered Canon or target root. Traversal,
    unregistered roots, reparse ambiguity, and resolved out-of-root paths block.
12. Resolve/read identity drift blocks verification and requires re-resolution.
13. The same canonical request and source identities produce the same ordered
    resolution and invalidation key.
14. Normal output never contains credentials, concrete runtime session mappings,
    raw transcripts, or sources marked `PRIVATE_RUNTIME_FORBIDDEN`.
15. Hydration must answer the seven Canon sufficiency questions before returning
    final `READY`.
16. A conformant expected blocker counts as a successful rehearsal but never as a
    ready project session.
17. The live command, skill, Canon runbook, machine contract, schemas, resolver,
    validator, and tooling snapshot may not claim release alignment until their
    verified identities agree.

## 6. Public Interface

### 6.1 Request

`resolveHydration(request) -> HydrationResult`

Required request fields:

```text
schema_version
project_id
target_root
profile_id
workflow_phase
expected_state_revision
expected_wave_id
expected_epic_id
expected_candidate_identity
expected_compact_boundary
expected_configuration_identity
```

Optional request fields:

```text
expected_worktree_identity
expected_combined_row_identity
expected_pinned_artifact_identity
pinned_artifact
triggered_reference_ids
maximum_files
maximum_bytes
maximum_approx_tokens
prior_invalidation_key
private_runtime_mapping_present
```

An absent expected identity may be represented only by the explicit sentinel
`UNDECLARED`. The result must then be no stronger than `NOT_READY` when that identity
is required for the requested phase.

### 6.2 Result

```text
schema_version
status: READY | NOT_READY | BLOCKED
failure_codes[]
resolution_basis[]
canon_identity
registry_identity
project_identity
profile
required_reads[]
cold_references[]
triggered_references[]
invalidation_key
budget
blockers[]
next_actor
next_command
nonclaims[]
```

`READY` from the resolver means only that a deterministic packet may be read.
Final hydration readiness requires a constrained-reader receipt plus verifier pass.

### 6.3 Source Reference

Each source reference contains:

```text
source: CANON | PROJECT
path
section_id
start_line
end_line
start_byte
end_byte
authority_class
sha256
reason
sensitivity
required
invalidate_when[]
```

Supported selector v1 forms:

```text
FULL_FILE
HEADING:<exact markdown heading text>
```

Heading selectors are case-sensitive and must resolve exactly once. The selected
span starts at the heading and ends immediately before the next heading of equal or
higher level, or at EOF.

### 6.4 Reader And Verifier

The constrained reader accepts only a resolver-produced source reference and its
registered roots. It returns the selected UTF-8 span and a receipt containing the
pre-read and post-read identities. It refuses runtime-forbidden sensitivity,
unregistered paths, reparse ambiguity, selector drift, and hash drift.

The verifier accepts the resolver result and all required read receipts. It returns
`PASS`, `FAIL`, or `BLOCKED`, lists missing or changed reads, evaluates the seven
sufficiency fields, and never upgrades resolver status.

## 7. Failure Contract

The machine taxonomy shall include at least:

```text
PROJECT_UNREGISTERED
PROJECT_AMBIGUOUS
PROJECT_NOT_ENROLLED
ROOT_MISSING
ROOT_MISMATCH
ROOT_REPARSE_AMBIGUOUS
PATH_OUTSIDE_REGISTERED_ROOT
REGISTRY_SCHEMA_INVALID
PROFILE_UNKNOWN
PROFILE_AMBIGUOUS
ROLE_NOT_CURRENTLY_ELIGIBLE
PHASE_UNKNOWN
STATE_POINTER_MISSING
STATE_IDENTITY_MISMATCH
COMBINED_ROW_MISSING
COMBINED_ROW_AMBIGUOUS
COMBINED_IDENTITY_MISMATCH
PINNED_ARTIFACT_MISSING
PINNED_ARTIFACT_MISMATCH
CANDIDATE_IDENTITY_MISMATCH
WORKTREE_IDENTITY_MISMATCH
CONFIGURATION_IDENTITY_MISMATCH
COMPACT_BOUNDARY_STALE
SECTION_ID_MISSING
SECTION_ID_DUPLICATED
SOURCE_IDENTITY_CHANGED
CANON_RELEASE_INCONSISTENT
CANON_COMPATIBILITY_MISMATCH
PRIVATE_RUNTIME_SOURCE_FORBIDDEN
PRIVATE_RUNTIME_MAPPING_MISSING
BUDGET_EXCEEDED
SUFFICIENCY_INCOMPLETE
```

Failure ordering is deterministic. Duplicate codes are removed while blocker
messages preserve source order.

## 8. Authority And Capability Matrix

| Surface | Semantic owner | Mutation owner | Runtime role |
|---|---|---|---|
| Hydration law and failure semantics | Canon | Canon Workflow Maintenance | Read-only reference |
| Registry schema and profile format | Canon | Canon Workflow Maintenance | Read-only catalog |
| Current project state | Target project | Project Meta/Owner | Authority |
| Current Combined and active plan | Target project | Accountable project lane/Meta | Authority |
| Concrete session mapping | Private runtime | Operator | Input signal only |
| Resolver/reader/verifier | Canon | Canon Workflow Maintenance | Read-only planner/reader/verifier |
| `/after-compact` | Live global OpenCode | `/oc-toolsmith` transaction | Thin entry command |
| `context-restore` | Live global OpenCode | `/oc-toolsmith` transaction | Reusable restore method |
| `/wave-start` | Live global OpenCode | `/oc-toolsmith` transaction | Thin onboarding command |
| `context-onboarding` | Live global OpenCode | `/oc-toolsmith` transaction | Reusable cold-start method |
| FAL router/checkpoint | FAL | Separate FAL/router lifecycle | Compatibility consumer only |

## 9. Exact Surface Changes

### 9.1 Canon Repository

Create or revise:

- `registry/HYDRATION-REGISTRY.schema.json`;
- `registry/HYDRATION-REQUEST.schema.json`;
- `registry/HYDRATION-RESULT.schema.json`;
- `registry/README.md`;
- `registry/projects/fractal-agent-lab.json`;
- `registry/projects/worldsim.json`;
- `registry/projects/ringfall.json`;
- `registry/projects/triageci.json`;
- `scripts/resolve-hydration.ps1`;
- `scripts/invoke-hydration.ps1`;
- `tests/hydration/**`;
- `canon/CONTEXT-HYDRATION.md`;
- `canon/CANONICAL-CONTRACT.json`;
- `runbooks/AFTER-COMPACT-RUNBOOK.md`;
- `scripts/validate-pack.ps1`;
- `MANIFEST.md`;
- `ADOPTION.md`;
- `README.md`;
- `VERSION.md` and `CHANGELOG.md` when release identity is finalized.

The existing unfinished files may be retained, rewritten, or removed based on the
accepted implementation diff. No tracked Canon baseline file may be reverted.

### 9.2 Global OpenCode Candidate

The `/oc-toolsmith` candidate shall replace exactly:

- `~/.config/opencode/commands/after-compact.md`;
- `~/.config/opencode/skills/context-restore/SKILL.md`;
- `~/.config/opencode/commands/wave-start.md`;
- `~/.config/opencode/skills/context-onboarding/SKILL.md`.

Commands remain thin. Skills own resolver invocation, constrained reads,
verification, fallback classification, and output assembly. No machine-specific
absolute root or credential enters a definition.

### 9.3 FAL Compatibility

The FAL router hot runbook is `NOT_AFFECTED` for transport behavior: hydration
continues to resolve target authority first and uses FAL only for the minimum
checkpoint/transport pointer. It is `IMPACTED` for compatibility evidence because
the generic result must preserve control-root versus target-root separation.

FAL source and router tests are excluded. The dirty
`src/fractal_agent_lab/integrations/router_fal_sync.py` and
`tests/integrations/test_router_fal_sync.py` remain protected concurrent work.

## 10. Compatibility And Deprecation

- Free-form `/after-compact` and `/wave-start` arguments remain accepted.
- Headered explicit project, target, role/profile, phase, and pinned-artifact fields
  become the preferred contract.
- When the resolver is unavailable or the project is not actively enrolled, the
  command may run the existing bounded manual method only under an explicit
  `LEGACY_VALIDATED` profile. It must report that basis and cannot claim machine
  verification.
- `BLOCKED_MISSING_AUTHORITY` and `DISCOVERY_ONLY` profiles never use legacy fallback
  to claim `READY`.
- Existing terminal route/readiness values remain compatible.
- The new output adds Canon, registry, source, invalidation, budget, and verification
  identity without removing existing human-readable fields.

## 11. Change-Impact Closure

| Changed owner | Consumer | Status | Reason and evidence requirement |
|---|---|---|---|
| Hydration protocol | `canon/CONTEXT-HYDRATION.md` | `IMPACTED` | Owns request/result/reader/verifier and sufficiency semantics |
| Hydration protocol | `runbooks/AFTER-COMPACT-RUNBOOK.md` | `IMPACTED` | Event procedure becomes resolver-first |
| Hydration protocol | `/after-compact` | `IMPACTED` | Thin entry gains explicit resolver fields and machine-verification reporting |
| Hydration protocol | `context-restore` | `IMPACTED` | Reusable method invokes resolver, reader, verifier |
| Hydration protocol | `/wave-start` | `IMPACTED` | Cold-start identity selection must use the same resolver contract |
| Hydration protocol | `context-onboarding` | `IMPACTED` | Cold-start packet construction shares resolver semantics |
| Hydration protocol | Canon machine contract | `IMPACTED` | Adds machine enums/schema identity and release compatibility fields |
| Hydration protocol | Canon validator | `IMPACTED` | Must validate schemas, profiles, tests, and coupled surfaces |
| Registry | Project overlays/templates | `IMPACTED` | Adoption docs/templates must declare compatibility and registry ownership |
| Registry | FAL router runbook | `NOT_AFFECTED` behavior; compatibility proof required | Existing target-first/control-plane separation already conforms |
| Registry | FAL checkpoint adapter | `NOT_AFFECTED` behavior | Mirror remains non-authoritative and is not read unless triggered |
| Registry | Product source/tests | `NOT_AFFECTED` | Hydration is governance/tooling only |
| Global tool candidate | Toolbox/Canon snapshots | `DEFERRED_BLOCKS_RELEASE` | Refresh only after hash-bound live apply and restart verification |
| FAL information architecture | `FAL-MIG-P v2.0` | `DEFERRED_BLOCKS_RELEASE` for FAL adoption only | Separate project lifecycle consumes the frozen interface |

## 12. Validation And Acceptance

### 12.1 Deterministic Contract Tests

- valid request produces deterministic ordered JSON and invalidation key;
- equivalent aliases resolve to the same canonical project ID;
- same identity produces the same source plan;
- source, registry, profile, state, candidate, phase, compact, or configuration
  changes alter the invalidation key;
- exact heading selection returns correct unique line/byte span and span hash;
- duplicate/missing headings block;
- resolver and reader output is identical on Windows PowerShell 5.1 and PowerShell
  7 when both are installed, excluding declared engine metadata.

### 12.2 Safety And Privacy Negatives

- rooted path, `..`, junction, symlink/reparse, and out-of-root escape block;
- unregistered root and marker mismatch block;
- blocked enrollment cannot return `READY`;
- runtime-forbidden source and credential-shaped registry field are rejected;
- concrete session mapping absence returns the declared phase-appropriate blocker;
- no hydration operation changes file bytes, timestamps by write, Git state, or
  runtime/session state.

### 12.3 Project Rehearsals

- FAL: proves target/control root separation and protects dirty router work;
- WorldSim: returns expected fail-closed disposition until project-owned durable
  state/Combined authority is available;
- RingFall: detects absent durable state and stale `.fal/ACTIVE_CONTEXT` without
  treating the mirror as authority;
- TriageCI: loads the security/redaction delta and blocks forbidden output;
- each rehearsal records resolver status, verifier result, budget, source identities,
  expected-versus-observed disposition, and residual debt.

### 12.4 Pack And Tool Validation

- `scripts/validate-pack.ps1` passes and invokes hydration conformance;
- JSON schemas parse and every project profile validates;
- Markdown fences, links, UTF-8, LF, and absolute-path guards pass;
- global candidate frontmatter, command-skill pairing, terminals, paths, privacy,
  and no-mutation rules pass;
- exact candidate/live/snapshot hashes agree after approved apply and restart.

## 13. Rollout

1. Preserve the current Canon and global-tool baselines and hashes.
2. Freeze this semantic contract and an accepted implementation plan.
3. Implement the Canon schemas, resolver, reader/verifier pipeline, profiles, tests,
   validation, runbook, and machine-contract changes in shadow mode.
4. Keep project profiles fail-closed where durable authority is missing.
5. Build a separate global-tool candidate and exact change-set manifest.
6. Run `/oc-toolsmith` safety review and present the execution-bundle hash.
7. Obtain Owner approval bound to that exact unchanged hash.
8. Re-hash live targets, archive exact originals, journal, and atomically apply.
9. End at `APPLIED_AWAITING_RESTART`; the agent does not restart OpenCode.
10. After Owner restart, verify live discovery and refresh snapshots through the
    verified sync path.
11. Run four-project rehearsals and publish the compatibility matrix.
12. Only then finalize the Canon release identity.

## 14. Rollback

Canon repository changes remain revertible by their candidate diff until closeout.
Global rollback restores the exact archived command and skill bytes through the
hash-bound `/oc-toolsmith` transaction. Partial apply is classified from the durable
journal and before/after inventories; no operation counter or blind replay is used.

If resolver verification fails after apply, `/after-compact` must not silently use a
mixed old/new contract. Restore the complete previous four-file global definition
set or remain blocked with the staged recovery bundle.

## 15. Self-Update And FAL State Impact

This specification changes hydration semantics, so `/workflow-fix` self-impact is
`IMPACTED`: future workflow changes must classify registry/resolver/project-profile
effects in their change-impact closure. `/oc-toolsmith` mechanics are
`NOT_AFFECTED`; its existing hash-bound transaction is consumed unchanged.

The current FAL state and Combined pointers are stale relative to the Owner's new
direction. They shall be changed only by the separate v1.2 supersession and
`FAL-MIG-P v2.0` lifecycle. This specification does not itself activate Wave 8 or
authorize FAL cleanup.

## 16. Residual Risk

- Project authority durability may remain insufficient for a ready cold restore;
  the correct result is a verified blocker, not fabricated readiness.
- PowerShell reparse behavior differs across environments; fixtures must prove the
  supported Windows engines and document unavailable link-creation privileges.
- Heading text is a transitional selector. A later minor contract may introduce
  explicit stable IDs without changing source-reference semantics.
- Global live verification requires an Owner restart and cannot be completed by the
  current running session alone.
- The unrelated `.swarm` spec drift remains outside this lifecycle and prohibits
  destructive Swarm plan/status operations.

Design readiness: READY

WORKFLOW_CHANGESET_READY
