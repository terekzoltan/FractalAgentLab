# COMPACT-V2 v1.0: Seamless Context Compact V2

## Planning Identity

- Target: FractalAgentLab control plane plus external Agent Workflow Canon and
  reviewed live-global OpenCode tooling.
- Epic: `COMPACT-V2`.
- Wave: `FAL-CANON-MIG` side lifecycle; this Epic does not activate Wave 8.
- Accountable Lane / class / profile: Compact V2 Workflow Maintainer /
  `SPECIALIST_DELIVERY` / `COMPACT-V2-MAINTAINER`.
- Bounded contributor: FAL Track D owns the tracked router adapter after the Canon
  contract handoff; it is not a second accountable Epic owner.
- Plan artifact identity: `COMPACT-V2-plan-v1.1-final`.
- Canonical plan path: `plans/epics/COMPACT-V2.md`.
- Workflow phase after the single Meta review: `PLAN_REVISION`.
- Single Meta review: `YELLOW`, recorded in
  `plans/epics/COMPACT-V2-plan-review-v1.md`; this final revision is not routed to
  a second plan review.

## Confirmed Facts

1. `FAL-MIG-P` Stage A is closed and the sole Combined position 20 explicitly
   authorizes this separate workflow-maintenance Epic.
2. The Owner-approved direction is `MATERIAL_CANON + GLOBAL_TOOLING +
   FAL_ROUTER_ADAPTER`; automatic compaction is not an accidental extension of the
   earlier migration.
3. Read-only `session-context-status/v1` telemetry already exists for one mapped,
   explicit, or all mapped sessions. It exposes `normal`, `warn`, `critical`,
   `over_limit`, and `unknown` pressure without exposing a concrete session ID and
   without compact/send/mutation authority.
4. Current Canon `2.0.0` has one fixed V1 capsule, a strict resolver/verifier,
   `READY | NOT_READY | BLOCKED`, and a V1 rule that `LEGACY_VALIDATED` never
   resolves `READY`.
5. The current FAL Canon profile is `LEGACY_VALIDATED`, still names the pre-Stage-A
   Combined selector and migration plan, and uses fixed
   `ops/COMPACT-BOUNDARY.json`. Its current fail-closed result is
   `NOT_READY / SUFFICIENCY_INCOMPLETE`.
6. Live `/after-compact`, `context-restore`, `/wave-start`, and
   `context-onboarding` pin the Canon contract, four hydration schemas, resolver,
   invoker, and pack digest. Any Canon identity change therefore has mandatory
   global consumer closure.
7. Live `/fal-orchestrate-target`, `fal-orchestrate-target`, and
   `closeout-commit` currently prohibit automatic compaction. Those statements
   cannot remain unchanged if `auto_safe` is released.
8. OpenCode server compaction uses `POST /session/:id/summarize` with explicit
   `providerID` and `modelID`. Sending text that looks like `/compact` is not a
   canonical server compaction transport.
9. Canon has pre-existing dirty changes, including plan-identity hardening in
   `runbooks/AFTER-COMPACT-RUNBOOK.md`, closeout changes, catalogs, and generated
   tooling snapshots. They are not COMPACT-V2 work and must not be reverted,
   overwritten, or claimed by this Epic.
10. FAL has protected unrelated dirty hunks whose current SHA-256 identities are:
    `src/fractal_agent_lab/integrations/router_fal_sync.py` =
    `58c99c1c34fbf38aadb3d6ec4d62143456676a302cc6e08465f3deed03ae46a3` and
    `tests/integrations/test_router_fal_sync.py` =
    `1f5d4e24410b34ab76c08363aed2603be2c4bca986516615b347feebf4fdebab`.

## Assumptions And Resolved Decisions

- Canon releases the additive contract as `2.1.0`; V1 request, result, fixed
  locator, and capsule branches remain readable and retain their existing behavior.
- The new durable capsule contract is
  `opencode-seamless-compact-boundary/v2` and the new policy contract is
  `opencode-compact-policy/v1`.
- V2 operational authority is the pair `confidence + action`. The legacy `status`
  field remains a conservative compatibility projection and is not deleted.
- `LEGACY_VALIDATED` may produce `SUFFICIENT + AUTO_RESUME` only after verified
  required reads, exact route input, and absence of hard conflict. It still cannot
  claim resolver `READY` through the legacy `status` field.
- A multi-participant V2 capsule requires a bare role hint unless exactly one
  participant is present. Every participant `profile_id` must name one declared
  project hydration profile, and the supplied `role_hint` must uniquely match that
  same profile under the Canon role-hint resolver. Conversation memory, anchored
  summary, or session-name similarity cannot select or repair a participant.
- The global default is `auto_safe`. A project override at
  `.fal/compact-policy.json` may only tighten behavior by lowering thresholds,
  excluding roles, requiring more gates, or changing mode to `ask`, `recommend`,
  or `disabled`. It cannot raise thresholds, add authority, or turn a non-auto
  global mode into auto.
- Policy evaluation is event driven at `before_dispatch`,
  `after_stage_output`, and `epic_closeout`. V1 has no timer, daemon, or background
  watchdog.
- No live server summarize pilot is authorized by this plan. Deterministic mocked
  transport tests are mandatory; any live pilot requires a separate explicit Owner
  approval bound to target, server, sessions, and rollback/stop conditions.

There is no unresolved design question that prevents implementation after this
reviewed revision. Runtime API drift, dirty-lineage conflict, or a missing exact
global approval is a later named stop condition rather than a reason to invent
behavior during implementation.

## Objective

Deliver a backward-readable, policy-controlled compact and hydration flow that:

1. evaluates aggregate-only session pressure before dispatch and after a canonical
   stage output;
2. compacts `warn` sessions at the first safe boundary, prevents a new long stage at
   unresolved `critical` or `over_limit` pressure, and leaves `unknown` pressure
   nonblocking for ordinary work;
3. compacts every actual Epic participant after accepted closeout, regardless of
   pressure, in Delivery, review/support, then Meta/Orchestrator order;
4. persists no concrete session ID, credential, endpoint, port, transcript, or
   workstation root in the target-owned V2 boundary;
5. performs server summarize idempotently, verifies the compaction marker before
   any retry, dispatches `/after-compact` with the exact role hint, and auto-resumes
   only from an exact route input;
6. treats missing route proof as `PROOF_REQUIRED`, material human choice as
   `CONFIRM`, and only safety/identity/authority/privacy/duplicate-send/uncertain
   compact conflicts as `BLOCKED`;
7. releases live global tooling only through one candidate-bound approval,
   backup-first apply, Owner restart, fresh registry verification, and generated
   Canon snapshot synchronization.

## Authority And Temporary Profile

`COMPACT-V2-MAINTAINER` is a plan-bound specialist-delivery profile:

| Field | Contract |
|---|---|
| Base capability | `MAINTENANCE` plus exact Track D adapter contribution |
| Accountable lane | Compact V2 Workflow Maintainer |
| Allowed writes | Exact Canon, FAL router, plan/evidence, and ignored candidate surfaces listed below |
| Global live writes | Forbidden until the exact candidate approval gate; then only the approved operation manifest |
| Forbidden writes | FAL product source/tests, protected router sync hunks, target repositories, public output, unrelated Canon dirty work, broad staging, commit/push/PR/merge/deploy |
| Required output | Reviewed Canon contract, reviewed tracked adapter, exact global candidate, release/rollback evidence, reconciled FAL state |
| Review law | Plan author and implementer cannot independently approve their own plan or final candidate |

Meta owns the one plan verdict and final synthesis. FAL Track D may implement only
the adapter tasks after the Canon handoff and returns them to the accountable
Maintainer for integration. `oc-toolsmith` may construct and apply the exact global
candidate only inside `/workflow-fix`; it gains no project or acceptance authority.

The plan-bound accountable profile and runtime hydration profile are distinct but
explicitly bound. `registry/projects/fractal-agent-lab.json` adds exactly one
declared role profile:

```json
{
  "profile_id": "fal.compact-v2-maintainer",
  "base_capability": "MAINTENANCE",
  "accountable_lane": "Compact V2 Workflow Maintainer",
  "allowed_phases": [
    "PLAN_REVISION",
    "IMPLEMENT",
    "STEP_REVIEW",
    "REVIEW_RESPONSE",
    "FIX_PLAN_REVIEW",
    "FIX_PLAN_REVISION",
    "FIX_IMPLEMENT",
    "CLOSEOUT"
  ],
  "next_actor": "Resolve from FAL project state",
  "next_command": "Resolve from FAL project state"
}
```

Its required read is the Canon Workflow Maintainer runbook. V2 participants for
this lane use `profile_id: fal.compact-v2-maintainer` and
`role_hint: Compact V2 Workflow Maintainer`. The Canon resolver first selects the
unique declared profile by exact case-insensitive comparison against profile ID,
base capability, accountable lane, or final profile-ID segment, then requires the
participant `profile_id` to be byte-identical to that selected profile ID and the
phase to be eligible. Zero, multiple, phase-ineligible, cross-profile, or
participant-only alias matches are `HARD_BLOCK`; a V2 manifest cannot define a new
role alias or capability.

## Scope And Exact Allowed Surfaces

### Canon semantic and machine contract

The implementation allowlist is:

```text
Agent-Workflow-Canon/ADOPTION.md
Agent-Workflow-Canon/CANONICAL-SYSTEM.md
Agent-Workflow-Canon/CHANGELOG.md
Agent-Workflow-Canon/MANIFEST.md
Agent-Workflow-Canon/VERSION.md
Agent-Workflow-Canon/audit/TRACEABILITY.md
Agent-Workflow-Canon/canon/CANONICAL-CONTRACT.json
Agent-Workflow-Canon/canon/CONTEXT-HYDRATION.md
Agent-Workflow-Canon/reference/COMMAND-CATALOG.md
Agent-Workflow-Canon/reference/COMMAND-OUTPUT-CONTRACTS.md
Agent-Workflow-Canon/reference/FAL-CONTROL-PLANE-ADAPTER.md
Agent-Workflow-Canon/reference/SESSION-CONTEXT-TELEMETRY.md
Agent-Workflow-Canon/reference/SKILL-CATALOG.md
Agent-Workflow-Canon/registry/COMPACT-BOUNDARY.schema.json
Agent-Workflow-Canon/registry/COMPACT-POLICY.schema.json
Agent-Workflow-Canon/registry/HYDRATION-REGISTRY.schema.json
Agent-Workflow-Canon/registry/HYDRATION-REQUEST.schema.json
Agent-Workflow-Canon/registry/HYDRATION-RESULT.schema.json
Agent-Workflow-Canon/registry/README.md
Agent-Workflow-Canon/registry/projects/fractal-agent-lab.json
Agent-Workflow-Canon/runbooks/AFTER-COMPACT-RUNBOOK.md
Agent-Workflow-Canon/runbooks/CLOSEOUT-RUNBOOK.md
Agent-Workflow-Canon/runbooks/ORCHESTRATOR-RUNBOOK.md
Agent-Workflow-Canon/scripts/invoke-hydration.ps1
Agent-Workflow-Canon/scripts/resolve-hydration.ps1
Agent-Workflow-Canon/scripts/validate-pack.ps1
Agent-Workflow-Canon/scripts/README.md
Agent-Workflow-Canon/tests/hydration/TestHelpers.ps1
Agent-Workflow-Canon/tests/hydration/fixtures/project/.fal/compact-boundaries/*.json
Agent-Workflow-Canon/tests/hydration/fixtures/project/ops/COMPACT-BOUNDARY.json
Agent-Workflow-Canon/tests/hydration/fixtures/registry/projects/fixture.json
Agent-Workflow-Canon/tests/hydration/test-compact-boundary.ps1
Agent-Workflow-Canon/tests/hydration/test-compatibility.ps1
Agent-Workflow-Canon/tests/hydration/test-invoke-hydration.ps1
Agent-Workflow-Canon/tests/hydration/test-project-profiles.ps1
Agent-Workflow-Canon/tests/hydration/test-resolver.ps1
Agent-Workflow-Canon/tests/hydration/test-schema-profiles.ps1
```

`canon/PARALLELISM-AND-COORDINATION.md` and every unrelated existing dirty file are
read-only baselines. The three dirty in-scope Canon files
`reference/COMMAND-OUTPUT-CONTRACTS.md`, `runbooks/AFTER-COMPACT-RUNBOOK.md`, and
`runbooks/CLOSEOUT-RUNBOOK.md` must be patched on top of their current bytes; their
pre-existing plan-identity/closeout semantics must remain present in post-change
evidence.

### FAL tracked router adapter and governance

```text
FractalAgentLab/plans/epics/COMPACT-V2.md
FractalAgentLab/plans/epics/COMPACT-V2-plan-review-v1.md
FractalAgentLab/evidence/COMPACT-V2/**
FractalAgentLab/ops/PROJECT_STATE.md
FractalAgentLab/ops/Combined-Execution-Sequencing-Plan.md
FractalAgentLab/tools/oc-session-router/README.md
FractalAgentLab/tools/oc-session-router/config/README.md
FractalAgentLab/tools/oc-session-router/config/compact-flow-event.schema.json
FractalAgentLab/tools/oc-session-router/config/compact-policy.schema.json
FractalAgentLab/tools/oc-session-router/docs/session-router-cheatsheet.md
FractalAgentLab/tools/oc-session-router/docs/workflow-orchestrator-reference.md
FractalAgentLab/tools/oc-session-router/docs/workflow-orchestrator-runbook.md
FractalAgentLab/tools/oc-session-router/scripts/invoke-session-compact-flow.ps1
FractalAgentLab/tools/oc-session-router/scripts/resolve-compact-policy.ps1
FractalAgentLab/tools/oc-session-router/scripts/session-compact-flow-core.ps1
FractalAgentLab/tools/oc-session-router/scripts/test-global-compact-candidate.ps1
FractalAgentLab/tools/oc-session-router/scripts/test-session-compact-flow.ps1
```

`oc-router-common.ps1`, the telemetry scripts/schema/test, current lifecycle
wrappers, and all FAL product source/tests are read-only dependencies. If
implementation proves a change to one of those surfaces is unavoidable, stop and
return to material plan revision instead of widening this allowlist ad hoc.

### Ignored runtime and candidate surfaces

```text
target/.fal/compact-boundaries/BOUNDARY_ID.json
target/.fal/compact-policy.json
target/.opencode-router/compact-events/EVENT_ID.json
target/.opencode-router/compact-participants/PROJECT_ID/EPIC_ID.json
target/.opencode-router/compact-runs/BOUNDARY_ID.json
FractalAgentLab/data/migration-candidates/compact-v2-global-v1/**
FractalAgentLab/data/migration-baselines/compact-v2-global-v1/**
```

The uppercase names above describe runtime substitutions and are not literal
versioned files. Target runtime manifests and ledgers remain ignored/private. Only
sanitized receipts and hashes may enter `evidence/COMPACT-V2/**`.

### Exact global candidate payload

```text
commands/after-compact.md
commands/wave-start.md
commands/fal-orchestrate-target.md
skills/context-restore/SKILL.md
skills/context-onboarding/SKILL.md
skills/fal-orchestrate-target/SKILL.md
skills/closeout-commit/SKILL.md
workflow-compact-policy.json
```

No live global file is changed while building or reviewing the candidate. The
post-apply generated Canon snapshot may update only the matching command/skill
payloads and `reference/tooling-snapshot/MANIFEST.json`. Existing unrelated snapshot
drift must be attributed separately before any commit or release claim.

Before candidate freeze, enumerate every active live-global command and every
active live-global skill from pure config/current filesystem discovery into
`evidence/COMPACT-V2/global-consumer-matrix.md`. Each entry receives exactly one
`IMPACTED`, `NOT_AFFECTED`, or `DEFERRED_BLOCKS_RELEASE` disposition, evidence for
its classification, expected candidate/snapshot path, and dirty-lineage owner. The
eight payloads above are the expected direct impacts; discovery may not silently
omit an active consumer. A newly discovered impact stops candidate freeze and
requires explicit dependency closure rather than a guessed `NOT_AFFECTED` row.

## Non-Goals And Forbidden Scope

- No Wave 8 activation or target-project feature implementation.
- No generic background watchdog, scheduler, daemon, plugin hook, or process
  restart automation.
- No raw transcript ingestion, session-ID publication, credential discovery,
  endpoint publication, or machine-root persistence in target governance.
- No provider billing/cumulative-cache value used as current pressure.
- No semantic summary or latest-output fallback used as route input.
- No compact during unresolved review, running/busy generation, missing pinned
  output, duplicate-send ambiguity, unknown delivery, or uncertain prior compact.
- No automatic global apply, restart, commit, push, PR, merge, deploy, publication,
  or live server pilot.
- No modification, staging, or normalization of the two protected FAL dirty paths.
- No manual edit of generated Canon tooling snapshots.
- No backward-compatibility shim beyond the concrete persisted V1 capsule/request/
  result/profile and current global consumer need documented here.

## Frozen Interfaces

### 1. Compact policy

`opencode-compact-policy/v1` has two schema branches: complete global policy and
partial project override. The complete global policy requires:

```json
{
  "schema_version": "1",
  "contract": "opencode-compact-policy/v1",
  "mode": "auto_safe",
  "checks": ["before_dispatch", "after_stage_output", "epic_closeout"],
  "warn_ratio": 0.75,
  "critical_ratio": 0.875,
  "compact_warn_at_first_safe_boundary": true,
  "block_long_stage_at_critical": true,
  "compact_epic_participants_after_closeout": true,
  "safe_boundary_required": true,
  "maximum_retry_count": 1,
  "project_override": "tighten_only"
}
```

Allowed modes are `auto_safe`, `ask`, `recommend`, and `disabled`. The resolver
emits the effective policy, base and override SHA-256 identities, a deterministic
effective-policy SHA-256, and rejected-loosening diagnostics. A malformed global
policy blocks compact evaluation but not unrelated target work. A malformed or
loosening project override disables automatic action for that event and returns a
policy blocker; it never falls back to the looser global policy silently.

### 2. Compact-flow event

`compact-flow-event/v1` is private ignored operational input. It requires one
`event_id`, event type, target project/Wave/Epic/state/phase/candidate/configuration/
Combined identities, exact sender and recipient logical labels where dispatch is
involved, safe-boundary proof, duplicate-send disposition, pinned stage artifact
and SHA-256 when a stage output exists, and creation time. Event types are:

```text
before_dispatch
after_stage_output
epic_closeout
```

`epic_closeout` additionally requires the exact accepted closeout receipt identity
and `routing_verdict: CLOSED`. Event files do not grant closeout or compact
authority; the flow revalidates project state and the pinned receipt.

### 3. V2 compact boundary

The V2 target-owned boundary requires the following top-level facts:

```text
schema_version = 2
contract = opencode-seamless-compact-boundary/v2
boundary_id
project_id
workflow_phase
expected_state_revision
expected_wave_id
expected_epic_id
expected_candidate_identity
expected_compact_boundary
expected_configuration_identity
expected_combined_row_identity
created_utc
expires_utc
participants
```

Optional top-level facts are expected worktree identity, one current host
attestation, triggered reference IDs, and a boundary-wide blocker summary composed
only of safe stable codes. TTL and clock-skew limits remain 24 hours and five
minutes.

Each participant requires:

```text
logical_session_ref
profile_id
role_hint
participation_class = DELIVERY | REVIEW_SUPPORT | META_ORCHESTRATOR
compact_order
resume_mode = AUTO_RESUME | HYDRATE_ONLY
expected_next_actor
expected_next_command
route_input
```

`profile_id` must resolve to exactly one profile in the selected pack-digest-bound
project profile. `role_hint` is valid only when the Canon role-hint matcher selects
that same profile uniquely for the declared workflow phase. The participant entry
does not extend the profile's aliases, capability, lane, or allowed phases. The
initial FAL positive fixture binds `fal.compact-v2-maintainer` to
`Compact V2 Workflow Maintainer`; negative fixtures cover unknown, ambiguous,
cross-profile, participant-only alias, and phase-ineligible hints.

`route_input` has exactly one mode:

- `PINNED_ARTIFACT`: safe project-relative path, lowercase SHA-256, and opaque
  logical artifact identity are required. Before any send, open the resolved file
  once with `FileMode.Open`, `FileAccess.Read`, and `FileShare.Read`; verify lexical
  and final-handle containment beneath the target root, ordinary non-reparse path,
  exactly one hard link, expected file identity, and SHA-256 from those held bytes.
  Build the command argument from that same snapshot and hold the handle through
  intent persistence and POST completion. A changed identity or hash is
  `MISMATCH / HARD_BLOCK`; no reopen or fallback is allowed.
- `EXACT_EMPTY`: allowed only when the held pure command registry supplies the
  participant's exact selected-command identity and the Canon machine contract
  declares that command in `empty_route_input_commands`. The initial allowlist is
  empty; adding a command later is a material Canon change. Boundary prose cannot
  declare an empty-input command.
- `NOT_APPLICABLE`: allowed only with `HYDRATE_ONLY` and next command `NONE`.

The participant may carry a current selected-command identity; its absence lowers
confidence but is not by itself a hard conflict. Raw session IDs are resolved only
from the private target-local session map and private participant/run ledgers.

The V2 profile locator is a contained flat directory plus strict JSON filename law.
Native restore selects exactly one unexpired manifest matching current project
authority and the participant role. A multi-participant manifest with no role hint
cannot guess; exactly one participant is the only argumentless exception. V1 fixed
`path + contract` locators remain valid for V1 profiles.

### 4. Hydration result and compatibility projection

V2 adds authoritative fields:

```text
confidence = VERIFIED | SUFFICIENT | PARTIAL | FAILED
action = AUTO_RESUME | PROOF_REQUIRED | CONFIRM | BLOCKED
diagnostics[].class = HARD_BLOCK | ROUTE_PROOF | OPTIONAL_WARNING
participant
route_input.status = EXACT | MISSING | MISMATCH | NOT_REQUIRED
```

The legacy `status` projection remains:

| V2 classification | Legacy status |
|---|---|
| `VERIFIED` with no blocker | `READY` |
| `SUFFICIENT`, including usable `LEGACY_VALIDATED` | `NOT_READY` |
| `PARTIAL` | `NOT_READY` |
| `FAILED` or any hard conflict | `BLOCKED` |

The invoker may verify registered reads for `VERIFIED` or `SUFFICIENT` even when
legacy `status` is `NOT_READY`. It returns verifier `PASS` when all required reads,
receipts, identity checks, privacy checks, and exact route input pass. Verification
never upgrades a hard conflict.

Deterministic classification:

- `HARD_BLOCK`: ambiguous project/profile/participant; unsafe, remote, escaped,
  reparse, or hard-link-ambiguous path; state/Combined/candidate/configuration
  contradiction; declared artifact hash mismatch; source drift; privacy violation;
  unresolved duplicate-send; compact-result uncertainty; or command identity
  contradiction.
- `ROUTE_PROOF`: missing required route artifact, missing route artifact identity,
  missing command discovery needed for send, missing participant proof, or another
  fact required only for the selected continuation.
- `OPTIONAL_WARNING`: `LEGACY_VALIDATED`, missing optional host attestation, old V1
  capsule on its compatible branch, optional reference unavailable, or unknown
  pressure with no requested compact.

`AUTO_RESUME` is legal only with `VERIFIED` or `SUFFICIENT`, verifier `PASS`, exact
route input, current command discovery, no hard blocker, no duplicate-send debt, and
`resume_mode: AUTO_RESUME`. Before send, the adapter also invokes existing
`Assert-OCRouterParentSessionCommandSafe`; a current command entry reporting
`subtask=true` for `/terv-review-utan` or `/step-review-utan` is a hard stop until a
fresh registry proves parent-session execution. `PROOF_REQUIRED` names the exact
absent route proof. `CONFIRM` is reserved for a real policy/Owner choice. `BLOCKED`
is reserved for the hard class.

### 5. Global after-compact output

The human report keeps `HYDRATION SUFFICIENCY` and adds these exact machine-readable
lines before its existing terminal:

```text
Hydration confidence: VERIFIED | SUFFICIENT | PARTIAL | FAILED
Hydration action: AUTO_RESUME | PROOF_REQUIRED | CONFIRM | BLOCKED
Route input: EXACT | MISSING | MISMATCH | NOT_REQUIRED
```

Only one concrete value appears on each line. Command-level readiness may be
`READY` for `SUFFICIENT + AUTO_RESUME`; the report must separately state that the
legacy resolver status remains `NOT_READY`. The restore command itself remains
read-only and never dispatches the resumed command. The router consumes its output
and owns the later send.

### 6. Router policy and execution entrypoints

`resolve-compact-policy.ps1` accepts explicit local paths for global policy and an
optional project override plus `-AsJson`. Defaults are resolved from host config
roots without workstation-specific paths. It performs strict JSON, duplicate-key,
containment, mode-order, threshold, and tighten-only checks.

`invoke-session-compact-flow.ps1` accepts:

```text
-EventPath
-TargetRoot
-CanonRoot
-RouterDir
-Server
-GlobalPolicyPath
-ProjectPolicyPath
-DryRun
```

Root/path/server/auth checks reuse existing router safety law. The script writes
private atomic intent/participant/run ledgers, resolves logical labels through the
target session map, invokes `session-context-status.ps1`, and emits one strict JSON
result. It never prints a raw session ID, password, endpoint, transcript, or route
artifact body.

At `before_dispatch` and `after_stage_output`, it records actual participants and
evaluates the relevant session. At `epic_closeout`, it freezes the unique ledger
participant set and orders `DELIVERY`, `REVIEW_SUPPORT`, then
`META_ORCHESTRATOR`; stable logical label is the tie-breaker. A participant is
compacted at most once per boundary.

The per-participant state machine is:

```text
PLANNED
INTENT_PERSISTED
SUMMARIZE_SENT
MARKER_VERIFIED
HYDRATE_SENT
HYDRATION_VERIFIED
RESUME_SENT
COMPLETE
```

Terminal exception states are `MANUAL_COMPACT`, `PROOF_REQUIRED`, `CONFIRM`,
`UNCERTAIN`, and `BLOCKED`. Every state transition is atomic and hash-bound to the
event, policy, boundary, logical participant, pre-send message baseline, and prior
ledger generation.

Summarize uses the telemetry-selected provider/model and
`POST /session/:id/summarize`. Before the call, the flow records the existing
aggregate marker set from `GET /api/session/:id/context`: count, timestamp, and a
stable marker/message identity when OpenCode supplies one, never summary content.
It also proves exactly one outstanding compact intent for the logical participant
and boundary. A successful summarize response may continue only when exactly one
new marker appears after the intent timestamp and no competing manual signal,
second intent, or second new marker exists. If the response supplies a stable
request/marker identity, it must match; a contradiction is `BLOCKED`.

A timeout, client interruption, or POST exception never proves non-delivery. Under
the currently verified OpenCode API, a timestamp-only post-timeout marker is not
uniquely attributable to the persisted intent, so the result is always
`UNCERTAIN`: no hydration, resume, or retry occurs even if one new marker appears.
Only an explicit server response that proves rejection before acceptance, together
with an unchanged marker set and no competing intent, may permit one retry. Zero
retries is the default. Multiple/competing markers, a manual compact without an
exact boundary record, or an unmatched response marker also become `UNCERTAIN`.

After marker verification, the flow records an assistant-message baseline, invokes
`/after-compact` through the command endpoint with the exact participant role hint,
and waits for a new strict hydration output. It dispatches the next command only for
`AUTO_RESUME` with exact route input and a successful parent-session command check.
`PINNED_ARTIFACT` arguments come from the still-held verified snapshot;
`EXACT_EMPTY` requires the attested command identity and Canon empty-input allowlist;
latest assistant output and compact summary are never route inputs.

### 7. Safe-boundary policy

A safe boundary requires all applicable facts:

- the current canonical stage output is complete, strict-classified, pinned, and
  hash verified;
- project state and the active Combined row identify the same frontier;
- the participant is `idle`, not generating or retrying;
- no review, fix-plan, approval, or Owner question is unresolved;
- the next actor, command, and route input are exact;
- transport intent and duplicate-send state are settled;
- no earlier compact for this participant/boundary is uncertain.

At `warn`, compact at the first event carrying this proof. At `critical`, do not
start a new long stage until compact succeeds or the policy returns a human route.
At `over_limit`, allow only bounded recovery. `unknown` does not block ordinary
work, but accepted closeout still compacts when provider/model and all safety proofs
exist. Missing provider/model for a required compact is `PROOF_REQUIRED`, not a
fabricated default.

## Feature -> User Story -> Task

### Feature CV2-F1: Backward-Readable Canon Contract

#### User Story CV2-US1.1

As an adopted project session, I can read a V1 or V2 boundary and receive a
truthful hydration classification without a legacy readiness flag hiding useful
verified context.

| Task | Action | Output |
|---|---|---|
| `CV2-T1` | Capture baseline hashes/diffs and freeze the V1 compatibility matrix | Baseline and compatibility evidence |
| `CV2-T2` | Add policy, V2 boundary, V2 request/result, profile-locator, participant, route-input, and failure-class schemas | Canon `2.1.0` machine contract |
| `CV2-T3` | Implement strict V1/V2 parsing, participant selection, classification, and pack digest | Updated resolver |
| `CV2-T4` | Implement verified reads for `VERIFIED` and `SUFFICIENT`, final action classification, and exact route-input receipts | Updated invoker |
| `CV2-T5` | Update the FAL profile to Stage A authority paths, V2 directory locator, and declared `fal.compact-v2-maintainer` hydration profile while retaining `LEGACY_VALIDATED` projection | Current FAL profile and exact role binding |
| `CV2-T6` | Add V1/V2 positive, unique role/profile, ambiguity, phase, path, privacy, and false-auto-resume tests plus release docs | Canon evidence handoff |

### Feature CV2-F2: Policy-Controlled FAL Router Adapter

#### User Story CV2-US2.1

As the workflow orchestrator, I can evaluate pressure and compact only at a proven
safe boundary with private idempotency and exact post-compact routing.

| Task | Action | Output |
|---|---|---|
| `CV2-T7` | Add strict policy/event schemas and pure policy/state-machine helpers | Adapter contracts |
| `CV2-T8` | Implement tighten-only policy resolution and deterministic policy identity | Policy resolver |
| `CV2-T9` | Implement event validation, participant recording, ordering, and V2 manifest creation | Participant/boundary flow |
| `CV2-T10` | Implement telemetry decision, single-outstanding summarize intent, uniquely attributable marker verification, timeout `UNCERTAIN`, and no-blind-retry behavior | Idempotent compact transport |
| `CV2-T11` | Implement role-hinted hydration, strict output parsing, lock-held single-link route input, selected-command/empty-input binding, parent-session command check, and stop dispositions | Secure post-compact continuation |
| `CV2-T12` | Add mocked transport/state/policy/privacy tests including timeout marker, competing marker/intent, route snapshot drift, and stale subtask command negatives | Adapter regression evidence |
| `CV2-T13` | Update router docs and sanitize the cheatsheet path, credential, and endpoint examples | Operator contract |

### Feature CV2-F3: Exact Global Tooling Candidate

#### User Story CV2-US3.1

As an OpenCode user, I can use the new Canon identities and `auto_safe` orchestration
without a stale global command, stale hash pin, or unreviewed live mutation.

| Task | Action | Output |
|---|---|---|
| `CV2-T14` | Enumerate every active global command/skill into the impact matrix, then compute final eight file pins and five-schema pack digest | Complete consumer identity packet |
| `CV2-T15` | Update after-compact and onboarding command/skill semantics and pins | Restore/onboarding candidate |
| `CV2-T16` | Update FAL orchestrator to emit/evaluate the three compact events and consume the router result | Event-driven orchestration candidate |
| `CV2-T17` | Update closeout skill so exact `CLOSED` receipt is a later orchestrator trigger while closeout itself remains non-compacting | Closeout boundary candidate |
| `CV2-T18` | Build, hash, and independently review a backup-first global manifest; run candidate-level V1/V2 behavior checks and define the same live/snapshot post-restart check | Frozen tested global candidate |

### Feature CV2-F4: Controlled Release And Reconciliation

#### User Story CV2-US4.1

As the Owner, I can approve one exact candidate, restart once, and verify that live,
candidate, Canon snapshot, and project state all agree or roll back safely.

| Task | Action | Output |
|---|---|---|
| `CV2-T19` | Run candidate-bound implementation review over Canon, adapter, global candidate, tests, privacy, and rollback | Final synthesis |
| `CV2-T20` | Apply only after exact Owner confirmation through `/workflow-fix`, using captured baseline bytes and journaled operations | Global apply journal |
| `CV2-T21` | Stop for Owner restart; then verify fresh command/skill discovery, policy identity, and Canon pins | Restart receipt |
| `CV2-T22` | Run the verified Toolbox snapshot sync and prove live/candidate/snapshot identity without absorbing unrelated dirty lineage | Snapshot receipt |
| `CV2-T23` | Re-run serial deterministic checks, privacy scan, rollback rehearsal, and protected-scope hashes | Release evidence index |
| `CV2-T24` | Reconcile FAL state/Combined and close only when every gate agrees; otherwise record one exact blocker | Compact V2 closeout |

## Ordered Implementation Plan

1. Capture a sanitized pre-implementation manifest for both repositories: HEAD,
   status paths, allowed-path current hashes, pre-existing dirty patch identities,
   protected FAL hashes, live global candidate baselines, and generated-snapshot
   lineage. Stop on unexplained drift.
2. Implement the Canon schemas and contract tokens first. Preserve V1 branches as
   explicit schema/parser tests rather than implicit permissiveness.
3. Update resolver and invoker as one coupled change. Make diagnostic class,
   confidence, action, participant, route-input, legacy projection, and pack digest
   deterministic and ordinally stable.
4. Update only the FAL profile to current Stage A authority, V2 locator, and the
   declared `fal.compact-v2-maintainer` binding. Prove the role hint selects that
   profile uniquely and keep all other project profiles V1 with unchanged behavior.
5. Update Canon semantic docs, adoption, traceability, changelog, manifest, and
   version. Patch on top of current dirty bytes and prove the pre-existing
   plan-identity/closeout additions survive.
6. Run each named Canon hydration test file separately and serially. Fix the first
   failing contract before continuing; do not run a batch directory or unrestricted
   test suite.
7. Freeze a Canon handoff containing contract/version/pack/resolver/invoker/profile
   identities and V1/V2 test receipts. FAL adapter work cannot consume an
   unreviewed or changing interface.
8. Implement the new FAL policy/event/core/entrypoint files without editing
   `oc-router-common.ps1` or telemetry code. Reuse those surfaces only through their
   current public functions/output.
9. Test policy tightening, all pressure states, safe/unsafe boundaries, declared
   role/profile binding, participant ordering/deduplication, manual compact,
   summarize success, uniquely attributable marker success, timeout with a new but
   unattributable marker, competing markers/intents, zero/one retry, hydration
   outcomes, lock-held route input, stale subtask command, duplicate send, atomic
   resume, privacy, and malformed responses with a mocked loopback transport.
10. Update the FAL hot/cold router docs and remove concrete workstation path,
    password, and endpoint examples from the cheatsheet.
11. Freeze and independently review the tracked Canon plus FAL adapter candidate.
    Do not begin global live mutation from source that is still under review.
12. Enumerate every active command and skill into the disposition matrix, compute
    the final Canon contract/schema/script pins and five-schema pack digest, then
    build the ignored global candidate from current live bytes. Preserve every
    unrelated current live change, and change only the exact listed payloads.
13. Run `test-global-compact-candidate.ps1` against the candidate to prove V1 cannot
    auto-resume, V2 `SUFFICIENT + AUTO_RESUME` requires verifier PASS plus exact
    input, parent-session safety is retained, and all direct consumer pins agree.
    Then construct the backup-first apply/rollback manifest and route that exact
    candidate through independent implementation review.
14. Ask once for candidate-bound Owner approval. A changed candidate, live baseline,
    operation set, or rollback identity invalidates that approval.
15. Apply exact bytes transactionally and journal every operation. On partial
    failure, stop and use only the reviewed rollback manifest; never regenerate
    content during apply or rollback.
16. Stop for Owner-managed OpenCode restart. After restart, run the global candidate
    contract test against live definitions and verify registry entries, hashes,
    policy identity, Canon pins/digest, and absence of stale cached metadata.
17. Run the verified snapshot synchronization, then run the same contract test
    against the generated snapshot. Separate pre-existing snapshot lineage from
    COMPACT-V2 deltas and stop before commit if ownership is unresolved.
18. Run all final checks serially, build the sanitized evidence index, recheck
    protected hashes and forbidden surfaces, and reconcile state/Combined. Do not
    perform a live compact pilot without its separate approval.

## Dependencies And Handoffs

| Handoff | Producer | Consumer | Required proof |
|---|---|---|---|
| Plan review | Accountable Maintainer | Meta | Completed YELLOW review at `plans/epics/COMPACT-V2-plan-review-v1.md`; all four corrections and the consumer-matrix improvement are applied here |
| Canon contract | Canon Maintainer | FAL Track D | Version, five schema hashes, resolver/invoker hashes, pack digest, V1/V2 serial tests |
| Adapter candidate | FAL Track D | Accountable Maintainer | Exact changed paths, mocked transport results, privacy/idempotency evidence |
| Global candidate | `oc-toolsmith` under `/workflow-fix` | Owner/Meta | Exact payload hashes, operation order, baseline, rollback, independent review |
| Restart | Owner | Accountable Maintainer | Fresh process/discovery receipt, not a claimed restart |
| Snapshot | Verified Toolbox sync | Canon closeout | Live/candidate/snapshot identity and unrelated-lineage disposition |

Parallel work is not authorized between Canon parser/schema implementation and the
adapter consumer. Documentation and test-fixture preparation may proceed in
parallel only when files do not overlap and no one consumes an unfrozen contract.

## Risks And Edge Cases

| Risk | Control | Stop condition |
|---|---|---|
| V2 weakens V1 fail-closed behavior | Explicit one-of branches and unchanged V1 fixtures | Any V1 negative becomes auto-resumable |
| `SUFFICIENT` becomes a hidden authority bypass | Exact route-input, verifier PASS, command discovery, and no-hard-conflict conjunction | Any auto-resume without all conjunction terms |
| Wrong role selects another participant | Pack-bound declared profile, exact same-profile role-hint match, phase eligibility, or sole participant only | Zero, multiple, cross-profile, alias-only, or phase-ineligible match |
| Target manifest leaks runtime identity | Schema forbids session ID, endpoint, port, root, transcript, credential | Privacy scan or unknown durable field fails |
| Unknown telemetry fabricates pressure/model | Preserve `unknown`; require real provider/model before summarize | Defaulted provider/model or fake ratio |
| Busy session is compacted | Safe-boundary state and message baseline gate | Session not idle or stage output incomplete |
| Summarize timeout or competing marker duplicates compact | One outstanding intent; successful-response marker correlation; every timeout-only or competing marker is `UNCERTAIN` | Hydrate, resume, or retry after unattributed marker |
| Route input drifts or escapes | One held contained non-reparse single-link snapshot through send; expected hash and identity | Reopen, fallback, path/hash/identity drift |
| Compact summary poisons routing | Held artifact or Canon-attested empty input only; strict post-baseline hydration classifier | Latest-output or summary selected |
| Closeout compacts nonparticipants | Private actual-participant ledger and deterministic classes/order | Session absent from accepted Epic ledger |
| Project override loosens global law | Partial schema plus monotonic merge | Raised threshold or authority expansion |
| Global restart is only claimed | Explicit Owner stop and fresh registry verification | Same-process or stale metadata used as proof |
| Dirty Canon work is absorbed/lost | Pre/post patch identity and separate attribution | Existing hunk missing or unowned snapshot delta |
| Protected FAL work changes | Exact SHA-256 pre/post gate | Either protected hash changes |
| Rollback destroys later work | Baseline/journal/current-hash conditional operations | Drifted live target or missing journal proof |

## Verification Plan

Every test is run one file at a time, serially. No unrestricted suite or directory
batch is permitted in this session.

### Canon checks

1. `test-schema-profiles.ps1`: V1/V2 schemas, strict unknown fields, new policy
   branches, profile locator branches, and declared maintenance profile shape.
2. `test-compact-boundary.ps1`: V1 fixed capsule, V2 directory capsule,
   multi-participant same-profile role selection, TTL, path and privacy negatives.
3. `test-resolver.ps1`: deterministic confidence/action/status projection and
   failure classes, including unknown/ambiguous/cross-profile/phase-ineligible
   participant role hints.
4. `test-invoke-hydration.ps1`: `SUFFICIENT` verified reads, exact route input,
   missing proof, mismatch, and no hard-conflict upgrade.
5. `test-project-profiles.ps1`: updated FAL legacy profile plus unchanged RingFall,
   WorldSim, and TriageCI V1 profiles.
6. `test-compatibility.ps1`: Canon `2.1.0`, pack digest with five schemas, V1
   backward read and global-consumer dependency declarations.
7. `validate-pack.ps1` without the all-tests switch: static manifest, token,
   schema, version, catalog, and traceability closure after the serial tests.

### FAL adapter checks

Run only `tools/oc-session-router/scripts/test-session-compact-flow.ps1`. Its cases
must cover policy merge, all events and pressure states, safe-boundary gates,
participant order/dedupe, one-boundary uniqueness, atomic state transitions,
manual compact, mocked summarize/marker/hydration/resume, successful single-marker
attribution, timeout with one new marker, competing marker/intent ambiguity,
zero/one retry, duplicate send, malformed JSON, locked route-input mismatch/path
escape/reparse/multi-link/source drift, stale parent-session `subtask=true`, and
output privacy. Existing telemetry test remains unchanged and is not rerun unless
telemetry code unexpectedly changes, which would first require plan revision.

### Global candidate and release checks

- Content-assertion sweep for every changed command/skill.
- Complete `IMPACTED | NOT_AFFECTED | DEFERRED_BLOCKS_RELEASE` row for every active
  live command and skill, with no inventory omission.
- Exact eight fixed pins: Canon contract, five schemas, resolver, invoker.
- Pack digest agreement across Canon resolver, invoker, `context-restore`, and
  `context-onboarding`.
- `test-global-compact-candidate.ps1 -Mode Candidate` proves old V1 reports never
  auto-resume and V2 sufficient reports require verifier PASS, exact route input,
  current command identity, and parent-session safety.
- The same test in `Live` mode after restart and `Snapshot` mode after verified sync
  proves semantic assertions and path/SHA-256 identity across all three generations.
- Candidate/live/snapshot path and SHA-256 equality after restart and verified sync.
- Fresh live command registry proves `/after-compact`, `/wave-start`,
  `/fal-orchestrate-target`, and `/closeout-commit` definitions are current.
- Isolated rollback rehearsal reproduces every pre-apply global byte and never
  removes or overwrites a drifted path.
- Secret/session/endpoint/root/transcript scan over durable candidate, docs, and
  evidence.
- `git diff --check`, exact allowed-path audit, protected-hash audit, and no commit/
  push receipt.

## Acceptance -> Verification -> Evidence

| ID | Acceptance | Verification | Durable evidence |
|---|---|---|---|
| `CV2-AC01` | One accountable lane and ordered Canon-to-adapter handoff | Plan/Combined ownership audit | Plan review |
| `CV2-AC02` | V1 capsules/requests/results/profiles remain readable and fail closed | V1 fixtures and compatibility tests | Canon test receipt |
| `CV2-AC03` | V2 boundary is multi-participant, role-selectable, and privacy-safe | Schema, participant, path, and scan negatives | Boundary test receipt |
| `CV2-AC04` | Policy defaults to `auto_safe` and project override only tightens | Policy matrix | Adapter test receipt |
| `CV2-AC05` | Telemetry remains evidence-only and aggregate-only | Unchanged telemetry contract plus adapter consumption test | Telemetry dependency receipt |
| `CV2-AC06` | `warn`, `critical`, `over_limit`, and `unknown` follow frozen policy | Pressure/safe-boundary matrix | Adapter test receipt |
| `CV2-AC07` | Accepted closeout compacts actual participants only in deterministic order | Participant ledger/order tests | Participant evidence |
| `CV2-AC08` | Each participant compacts at most once per boundary | Idempotency/state-machine tests | Run-ledger receipt |
| `CV2-AC09` | Timeout never causes blind retry, hydration, or resume | Timeout/new-marker/competing-marker/uncertain tests | Transport receipt |
| `CV2-AC10` | Hydration exposes deterministic confidence/action and conservative status | Resolver/invoker matrix | Canon result receipt |
| `CV2-AC11` | `SUFFICIENT + AUTO_RESUME` requires verifier PASS and exact route input | Legacy FAL positive plus missing/mismatch negatives | Hydration receipt |
| `CV2-AC12` | Hard blocks are limited to the frozen safety/conflict class | Failure-class exhaustive test | Classification report |
| `CV2-AC13` | Resume uses one held verified artifact snapshot or Canon-attested empty input, never latest output | Route send, snapshot drift, and summary-poison tests | Routing receipt |
| `CV2-AC14` | Direct global consumers use final eight pins and five-schema digest | Candidate assertion/pin checks | Global candidate manifest |
| `CV2-AC15` | Live global mutation has exact approval, backup, journal, rollback, restart | Transaction and fresh discovery | Apply/restart receipts |
| `CV2-AC16` | Canon snapshot matches verified live tooling without hidden dirty absorption | Sync identity plus lineage audit | Snapshot receipt |
| `CV2-AC17` | Existing Canon dirty semantics and protected FAL hunks are preserved | Pre/post patch and SHA-256 comparison | Preservation report |
| `CV2-AC18` | No live pilot, remote side effect, commit, push, or Wave 8 activation occurs implicitly | Side-effect and state audit | Closeout attestation |
| `CV2-AC19` | Every V2 participant role hint binds to the same unique declared phase-eligible project profile | Positive FAL maintainer fixture plus unknown/ambiguous/cross-profile/alias/phase negatives | Role-binding receipt |
| `CV2-AC20` | Route input is contained, non-reparse, single-link, lock-held, hash verified, selected-command bound, and parent-session safe | Snapshot/command/subtask negative matrix | Secure-input receipt |
| `CV2-AC21` | A marker advances flow only when uniquely attributable to one successful outstanding summarize intent; timeout or competing marker is `UNCERTAIN` | Success, timeout-new-marker, competing-marker, and competing-intent fixtures | Marker-attribution receipt |
| `CV2-AC22` | Candidate, restarted live tools, and generated snapshot preserve V1 non-auto and V2 guarded-auto semantics | Global candidate test in Candidate, Live, and Snapshot modes | Three-generation behavior receipt |
| `CV2-AC23` | Every active global command and skill has an evidence-backed impact disposition | Pure inventory set equality against consumer matrix | Global consumer matrix |

## Task Crosswalk

| Tasks | Acceptance IDs |
|---|---|
| `CV2-T1` through `CV2-T6` | `CV2-AC02`, `CV2-AC03`, `CV2-AC10`, `CV2-AC11`, `CV2-AC12`, `CV2-AC17`, `CV2-AC19` |
| `CV2-T7` through `CV2-T13` | `CV2-AC04` through `CV2-AC09`, `CV2-AC13`, `CV2-AC17`, `CV2-AC20`, `CV2-AC21` |
| `CV2-T14` through `CV2-T18` | `CV2-AC14`, `CV2-AC15`, `CV2-AC18`, `CV2-AC22`, `CV2-AC23` |
| `CV2-T19` through `CV2-T24` | `CV2-AC01` through `CV2-AC23` |

## Release Gates And Exact Blockers

1. The one independent Meta plan review is recorded and its four corrections plus
   one improvement are applied in this final plan. No second plan review is allowed;
   implementation consumes this exact final artifact identity and byte hash.
2. FAL adapter consumption is blocked until the Canon V2 interface and serial tests
   are frozen as one identity handoff.
3. Global candidate construction is blocked until the tracked Canon and adapter
   candidate is reviewed and unchanged.
4. Live global apply is blocked until one exact candidate-bound Owner confirmation.
5. Post-apply verification is blocked until the Owner restarts OpenCode; an agent
   must not restart it or claim the same process is fresh.
6. Snapshot/release closure is blocked by unclassified pre-existing Canon dirty
   lineage. Implementation may preserve and test on top of it, but cannot commit or
   claim those deltas as COMPACT-V2.
7. Live compact pilot remains blocked until a separate target/server/session-bound
   Owner approval. Mocked deterministic transport is the release evidence here.
8. Any change to a forbidden path, protected hash, V1 behavior, policy monotonicity,
   participant privacy, idempotency, or route-input proof stops the lifecycle and
   returns to review/fix planning.

## Review Revision Mapping

| Meta review item | Applied correction |
|---|---|
| Exact role-hint/profile binding | Added declared `fal.compact-v2-maintainer`, same-profile and phase-eligibility law, positive fixture, and unknown/ambiguous/cross-profile/alias/phase negative cases; promoted to `CV2-AC19` |
| Executable route-input security | Added one held contained non-reparse single-link artifact snapshot through POST, empty-input Canon allowlist initially empty, selected-command identity, parent-session command enforcement, and `CV2-AC20` |
| Marker attribution after timeout | Replaced marker-presence continuation with one-outstanding-intent correlation; every timeout-only or competing marker becomes `UNCERTAIN` with no hydrate/resume/retry; added `CV2-AC21` |
| Candidate-level global behavior tests | Added `test-global-compact-candidate.ps1` Candidate/Live/Snapshot modes proving V1 non-auto and V2 guarded-auto semantics; added `CV2-AC22` |
| Complete consumer matrix | Added pure active command/skill inventory with one disposition per entry and set-equality release gate; added `CV2-AC23` |

No review item was rejected or left unclear. None changes the Owner-approved
outcome, accountable lane, repository set, global apply authority, or major
sequencing; all are bounded corrections inside the reviewed scope.

## Rollback

- Canon and tracked FAL changes remain ordinary reviewed source patches; rollback
  reverts only COMPACT-V2-owned hunks while preserving pre-existing dirty bytes.
- The global transaction captures every existing target byte and hash before apply.
  Replacement rollback is allowed only when the journal proves the reviewed
  replacement landed and the current live hash still equals that applied hash.
- The new global policy file may be removed only when the journal proves this
  transaction created it and its current hash is unchanged.
- A partial transaction, failed restart verification, or snapshot mismatch leaves
  the Epic in `BLOCKED` or `CLOSEOUT`; it never fabricates release success.
- Private runtime boundary/ledger artifacts may be retained for diagnosis. Cleanup
  is not part of rollback and never precedes evidence capture.

## Done Criteria

The Epic is complete only when the plan and implementation candidates have
independent acceptance; Canon `2.1.0` has explicit V1/V2 compatibility; the FAL
adapter passes its mocked idempotency/privacy flow; the exact global candidate is
approved, applied, restarted, rediscovered, and snapshot-synchronized; every
acceptance item has sanitized evidence; protected and unrelated dirty work is
preserved; state/Combined are reconciled; and no unauthorized pilot, target work,
commit, push, publication, or Wave 8 activation occurred.

## REVISED EPIC IMPLEMENTATION PLAN

Target: FractalAgentLab control plane plus external Agent Workflow Canon and reviewed live-global OpenCode tooling

Epic: COMPACT-V2

Wave: FAL-CANON-MIG

Accountable Lane / class / profile: Compact V2 Workflow Maintainer / SPECIALIST_DELIVERY / COMPACT-V2-MAINTAINER

Prerequisites/current state: FAL-MIG-P Stage A is closed; the single YELLOW Meta review is pinned and all four corrections plus its consumer-matrix improvement are applied; implementation may start from this final revision while later Canon handoff, global approval, Owner restart, dirty-lineage, and no-live-pilot gates remain enforced.

Scope/non-goals: Backward-readable Canon V2 contract, declared maintenance hydration profile, narrow tracked FAL policy/compact adapter, exact tested global candidate, restart/snapshot/evidence closure; no Wave 8, target feature, background watchdog, unapproved live pilot, broad dirty absorption, commit, push, or publication.

Interfaces/ownership: Canon owns policy, V1/V2 boundary and hydration semantics, role/profile binding, confidence/action, exact route input, and marker-attribution law; FAL Track D implements the bounded adapter after the frozen Canon handoff; live global tooling is applied only by the approved maintenance transaction; target state and Combined remain authority.

Feature -> User Story -> Task: CV2-F1/CV2-US1.1/CV2-T1-T6 Canon contract and role binding; CV2-F2/CV2-US2.1/CV2-T7-T13 secure idempotent router adapter; CV2-F3/CV2-US3.1/CV2-T14-T18 complete consumer matrix and tested global candidate; CV2-F4/CV2-US4.1/CV2-T19-T24 controlled release and reconciliation.

Risks: V1 regression, false sufficient auto-resume, undeclared/cross-profile participant selection, route snapshot drift, unattributed or competing compact markers, privacy leakage, busy-session compact, duplicate summarize, summary-poisoned routing, stale parent-session metadata, policy loosening, stale restart, dirty-lineage absorption, and destructive rollback are fail-closed by the named gates.

Ordered implementation plan: Execute steps 1-18 above in Canon, adapter, global-candidate, apply/restart/snapshot, and closeout order with serial tests and no unauthorized side effects.

Acceptance -> verification -> evidence: CV2-AC01 through CV2-AC23 and the task crosswalk above.

Handoffs/exact blockers: Canon handoff precedes adapter consumption; tracked implementation review precedes global candidate apply; exact Owner approval and restart precede live/snapshot closure; unresolved dirty lineage blocks commit/release attribution; live pilot requires separate approval.

Plan artifact: COMPACT-V2-plan-v1.1-final

Next route: /implement
Readiness: READY

## DELIVERY PLAN REVISION

Target: FractalAgentLab control plane plus external Agent Workflow Canon and reviewed live-global OpenCode tooling

Epic: COMPACT-V2

Accountable Lane / class / profile: Compact V2 Workflow Maintainer / SPECIALIST_DELIVERY / COMPACT-V2-MAINTAINER

Applied review items: exact declared role-hint/profile binding with negatives; lock-held single-link route input plus selected-command and parent-session checks; timeout/competing-marker attribution to `UNCERTAIN`; Candidate/Live/Snapshot global behavior test; complete active command/skill impact matrix

Rejected/unclear items: none

Final plan artifact: COMPACT-V2-plan-v1.1-final

PLAN_REVISION_COMPLETE
IMPLEMENT_READY
