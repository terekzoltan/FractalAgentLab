# FAL-MIG-P: Canon Adoption and Repository Simplification Migration Plan

## Document Control

| Field | Value |
|---|---|
| Project | FractalAgentLab (FAL) |
| Assignment | `FAL-MIG-P` |
| Wave | `FAL-CANON-MIG` transitional governance Wave |
| Accountable Lane | Meta Coordinator |
| Lane class | `GOVERNANCE` |
| Accountable profile | `plans/epics/FAL-MIG-P.md#temporary-governance-author-role-profile` |
| Status | Planning artifact; migration application is not authorized |
| Owner direction | Approved in principle on 2026-07-24 |
| Review state | Canonical `/terv-review` completed; all required corrections applied in plan revision |
| Execution mode | `opencode_assisted`, planning/documentation only |
| Canon baseline | Agent Workflow Canon `1.2.1` |
| Active Combined path | `ops/Combined-Execution-Sequencing-Plan.md` |
| Combined count law | Exactly one active Combined file; no second Combined path may be created |
| Application boundary | Later reviewed lifecycle work only, after `FAL-MIG-P` closeout and W8-A reconciliation |

### Active Planning Capsule

| Field | Current value |
|---|---|
| Plan revision | `FAL-MIG-P-plan-v1.2` |
| Combined locator | `ops/Combined-Execution-Sequencing-Plan.md` / `9A. Living forward roadmap` / `FAL-CANON-MIG` position 10 `FAL-MIG-P` |
| Epic readiness | `READY` |
| Epic status | `PLANNED` |
| Workflow phase | `IMPLEMENT_READY` after `/terv-review-utan` revision |
| Author logical label | `FAL-MIG-P-META-AUTHOR` |
| Independent reviewer logical label | `FAL-MIG-P-INDEPENDENT-META-REVIEWER` |
| Candidate path | `plans/epics/FAL-MIG-P.md` |
| Candidate hash | Computed and pinned externally by the Orchestrator at `/terv-review` dispatch; a document cannot safely self-embed its own whole-file hash |
| Required inputs | The two FAL Wave 8-10 planning inputs, Canon `ADOPTION.md`, Canon migration backlog, current state, and the sole Combined row |
| Current blocker | Migration application remains blocked until the plan-only Epic lifecycle authorizes `/implement` |
| Exact next action | Accountable governance author invokes `/implement` for the accepted planning-only scope |

### Temporary Governance Author Role Profile

This section is the explicit role-profile pointer for the current `GOVERNANCE`
Accountable Lane until the durable role file is created by a later reviewed migration
slice.

| Field | Contract |
|---|---|
| Logical label | `FAL-MIG-P-META-AUTHOR` |
| Base capability | `META` |
| Accountable scope | Revise and close the `FAL-MIG-P` planning artifact, its state pointer, sole Combined row, and candidate-bound planning evidence |
| Allowed writes | `plans/epics/FAL-MIG-P.md`, the exact `FAL-MIG-P` fields in `ops/PROJECT_STATE.md`, and the exact P0 row/gate text in the sole Combined |
| Required reads | Root/project rules, state, sole Combined row, current candidate, accepted `/terv-review` artifact, Canon adoption rules, and named Wave 8-10 inputs |
| Required output | One decision-complete revised plan, exact lifecycle pointers, mechanical evidence, and `/implement` readiness disposition |
| Prohibited actions | Migration application, live authority cutover, production/test/router/global-tool/target mutation, staging, commit, push, Wave 8 activation, and self-review |
| Independence law | The author may consume the independent review but may not act as the independent reviewer or weaken an unresolved blocking correction |

The pre-adoption reviewer envelope was Owner-authorized for this plan review only.
`FAL-MIG-P-INDEPENDENT-META-REVIEWER` uses base capability `META`, is not an
Accountable Lane, has no authorship contribution, may read the named plan and its
bounded evidence, may emit one candidate-bound `GREEN | YELLOW | RED` plan verdict,
and may not edit files, implement, stage, commit, push, change sequencing, or review
its own prior work. Its output must be pinned as the `/terv-review` artifact and
routed to `FAL-MIG-P-META-AUTHOR` through `/terv-review-utan`. Its one-plan-review
authority is now consumed. This temporary envelope expires when the durable FAL
governance role profiles are accepted.

The five advisory review lanes summarized later are transcript evidence only. They
are not the canonical `/terv-review`, and their runtime session IDs are deliberately
excluded from durable policy.

## 1. Decision

FAL will adopt Agent Workflow Canon `1.2.1` through a lossless, staged, and
reversible information-architecture migration. The migration will reduce hot
workflow context, establish one semantic owner per rule, make the minimum sanitized
governance packet durable, preserve raw/private runtime material outside normal
version control, and keep FAL product authority separate from FAL's optional
control/evidence-plane role for target projects.

`FAL-CANON-MIG` is an explicit transitional governance Wave, not a pre-Wave
pseudo-container and not part of Wave 8. It contains exactly one Epic,
`FAL-MIG-P`. Its Wave Gate closes only when this planning Epic completes its full
Canon lifecycle. Closure authorizes W8-A to reconcile and sequence separately
reviewed migration-application slices; it does not apply migration, return
`OPEN_W8`, or activate Wave 8.

The migration SHALL retain exactly one active Combined authority at the existing
path:

```text
ops/Combined-Execution-Sequencing-Plan.md
```

The Canon template filename `ops/Combined-Execution-Plan.md` will be recorded as a
FAL naming exception. It SHALL NOT be instantiated while the existing FAL path is
active. Historical sequencing content may be preserved only in a clearly
non-authoritative, non-hot archive object whose name and metadata cannot be confused
with the active Combined.

The Canon pack SHALL remain project-neutral and external to FAL. FAL SHALL NOT
blindly vendor or independently mutate the pack. The Owner selected a separate
private Git repository as the durable Canon source on 2026-07-24. Because the
currently observed Canon root is not yet a Git repository, its deterministic
complete-file content manifest is an interim provenance identity only. Before FAL
migration application, the Canon must be provisioned into the approved private
repository, validated without semantic drift, and pinned by both immutable commit
SHA and complete-file manifest digest.

The first migration application SHALL be additive-first and SHALL delete nothing.
Physical deletion, aggressive deduplication, or redirect retirement requires a
later independently reviewed cleanup Epic after cold-resume, rollback, and consumer
evidence prove the operation safe.

## 2. Authority And Scope

### 2.1 Normative authority order after adoption

1. Platform/system safety and the current explicit Project Owner instruction.
2. Root `AGENTS.md` and `ops/PROJECT_OVERLAY.md`.
3. The sole active `ops/Combined-Execution-Sequencing-Plan.md` and compact
   `ops/PROJECT_STATE.md`.
4. The accepted current Epic plan and candidate-bound evidence.
5. The content-pinned adopted Agent Workflow Canon.
6. Role runbooks and live global command/skill mechanics.
7. Historical plans, summaries, mirrors, imported packages, logs, and audit material.

Direct evidence may prove that a status claim is stale, but it does not silently
change project authority. Any contradiction must be reconciled in the owning FAL or
target-project authority surface.

### 2.2 Current planning scope

This artifact defines:

- the exact target information architecture;
- the single-Combined rule and naming exception;
- the source-to-target and semantic-preservation contract;
- the keep/migrate/archive/redirect ledger;
- the durable/private boundary;
- the Canon identity and restoration contract;
- the compatibility and cutover states;
- the rollback procedure;
- the fresh-clone and role-hydration acceptance contract;
- future ownership and sequencing across W8-A, W8-B, W8-F, W8-I, and related gates.

### 2.3 Explicit non-goals

- No migration application from this document's existence.
- No second active Combined file.
- No production-code or test change.
- No modification, normalization, revert, staging, or commit of the existing dirty
  router/FAL sync source and test files.
- No router/runtime behavior change.
- No global OpenCode command, skill, configuration, or registry change.
- No server restart.
- No new worktree or repository-root strategy.
- No target-project mutation.
- No target-domain validation or acceptance by FAL.
- No automatic commit, push, PR, merge, deploy, release, publication, or public
  mirror operation.
- No root Python/core CI activation.
- No HUB implementation.
- No BSc thesis execution coupling.
- No blind copy of `Agent-Workflow-Canon`, `extracted/`, imported packs, or raw
  archives.
- No force-add or broad unignore of private directories.
- No archive extraction or execution during governance migration.
- No deletion in the first migration application.
- No Wave 8 activation or `OPEN_W8` result from `FAL-MIG-P` alone.

## 3. Confirmed Baseline

### 3.1 FAL repository identity

| Fact | Observed value |
|---|---|
| FAL repository root | `<FAL_ROOT>`; resolved from the current workspace at runtime |
| Current branch | `main` tracking `origin/main` |
| Current Git HEAD | `837001e54ba27c8d8946580e948162df021e92c0` |
| HEAD date | 2026-06-30 |
| HEAD subject | `Close W7.8 coverage policy` |
| Remote | `https://github.com/terekzoltan/FractalAgentLab.git` |
| Remote visibility | Not verified locally; `gh` is unavailable |

Repository visibility proof is a mandatory pre-application gate. The accepted
dual-repository policy says this is the private canonical lab repository, but policy
text alone is not sufficient proof that the configured remote is private.

### 3.2 Current tracked and ignored authority

Current Git inspection found only these tracked `ops/` files:

```text
ops/Combined-Execution-Sequencing-Plan.md
ops/PROJECT_STATE.md
```

The following authority classes are currently ignored or untracked:

```text
AGENTS.md
ops/AGENTS.md and most ops runbooks
docs/private/**
tools/oc-session-router/**
Agent Workflow Canon sibling pack
```

Current ignore rules cover:

```text
/ops/
/docs/private/
/.opencode/
/.swarm/
/.opencode-router/
/.opencode-toolbox/
/tools/oc-session-router/
/docs/architecture/
```

This conflicts with the accepted private-repository policy that durable sanitized
governance and private-canonical doctrine should be versioned. The migration must
resolve the contradiction through an exact per-file allowlist, not a broad unignore.

### 3.3 Plan-revision governance-input hashes

| Artifact | SHA-256 |
|---|---|
| `ops/Combined-Execution-Sequencing-Plan.md` | `7ddb33d56e0f60eaea793e42833d2aaae462a75ee764ec330a2d90b91bad85d9` |
| `ops/PROJECT_STATE.md` | `f66372e222c9bc5df4c8bb709d1a9c0d3f7894c9813f8e5579396f04a007d3fc` |
| `docs/private/FAL-Wave8-Wave10-Canon-Aligned-Roadmap-v1.md` | `db9420875480b4e0cc16e40cf58a6826cde70bc0b06cf82eff8b348357c7c3b5` |
| `docs/private/FAL-Canon-Lifecycle-Integration-Architecture-v1.md` | `7b921adc2df25f620937fd3f793a5262e459a2dab8ed5f368c39c0b1236db225` |
| Root `AGENTS.md` | `0306da56600d1b693167994c76eb99baeb77056901dfc3b86988abaa2e1783ab` |
| `.gitignore` | `41a5e7ee61d039ecdf09cc2b53dca7a9f8dd5536f3e660a3a8048221be237a99` |
| Router hot runbook | `f0cc496cccdf75e2ac0973bfb93361039e05f49da740a0c13c215daffbe52d57` |

These are point-in-time inspection hashes after the `/terv-review-utan` lifecycle
pointer revision. They are not acceptance, commit, or rollback identities. Stage 0
must refresh them after the planning-only lifecycle closes and before any application
candidate is admitted; no hash in this section may silently become an application
baseline.

### 3.4 Protected dirty W8-E inputs

| Artifact | SHA-256 | Migration rule |
|---|---|---|
| `src/fractal_agent_lab/integrations/router_fal_sync.py` | `58c99c1c34fbf38aadb3d6ec4d62143456676a302cc6e08465f3deed03ae46a3` | Read-only; no reformat, revert, stage, commit, or baseline use |
| `tests/integrations/test_router_fal_sync.py` | `1f5d4e24410b34ab76c08363aed2603be2c4bca986516615b347feebf4fdebab` | Read-only; no reformat, revert, stage, commit, or baseline use |

Current combined source/test diff digest:

```text
base_commit: 837001e54ba27c8d8946580e948162df021e92c0
unified_diff_sha256: c1178c1e364a7f03582a334e433459210f8f16e0584473b085626d6afeb0a12c
prospective_owner: W8-E / Track D
enforcing_gate: W8-E after W8-C and W8-D
```

Observed source hunks remove `review_fix_done` handling near the current functions
`_default_next_action`, `_default_scope_summary`, `_build_review_synthesis`, and
`_packet_stage_if_relevant`; the paired test hunk removes the
`test_sync_checkpoint_preserves_review_fix_done_stage` case. The future application
must freeze exact diff header/index identities and line-range-independent hunk IDs
again at Stage 0. A changed protected hash, diff digest, or hunk set invalidates the
migration packet and forces a new read-only collision review.

Current dirty-scope ownership/disposition at this plan revision is explicit:

| Path/scope | Current attribution | Required pre-application disposition |
|---|---|---|
| Exact `FAL-MIG-P` edits in Combined and state | `FAL-MIG-P-META-AUTHOR` planning lifecycle | Close separately through this Epic or consciously adopt with the same author/evidence identity in the Stage 0 hunk ledger |
| Dirty router sync source/test hunks | Pre-existing W8-E / Track D candidate work | Preserve byte/hunk identity; do not adopt, normalize, stage, or commit in migration |
| Untracked root `AGENTS.md` | Pre-existing FAL governance bootloader | Capture full baseline bytes and explicit Meta-governance ownership before any reviewed replacement; untracked status does not make it migration-created |
| `plans/epics/FAL-MIG-P.md` | `FAL-MIG-P-META-AUTHOR` planning candidate | Close through this Epic; later application consumes only its accepted immutable identity |
| Other untracked imports, extracted packages, templates, and `package-lock.json` | Pre-existing/unrelated worktree material | Keep outside the application mutation set unless a later reviewed ledger row names owner, provenance, and disposition |

### 3.5 Current global tool facts

The live global OpenCode configuration currently exposes exactly:

```text
18 active commands
22 active skills
```

This matches the Canon `1.2.1` target inventory. The live global configuration is
the implementation source of truth. FAL contexts, snapshots, backups, catalogs, and
imported command prose are inspection/provenance only.

## 4. Canon Identity And Restoration Contract

### 4.1 Observed Canon facts

| Field | Value |
|---|---|
| Observed root | `../Agent-Workflow-Canon` relative to FAL |
| Version | `1.2.1` |
| Version date | `2026-07-21` |
| Git repository | No |
| Valid Git commit | Unavailable; must remain `null` |
| Pack validator | `scripts/validate-pack.ps1` |
| Validator result | `PACK VALIDATION PASSED` |
| Markdown files reported | 68 |
| All files included in content manifest | 71 |

Component hashes:

| Canon artifact | SHA-256 |
|---|---|
| `VERSION.md` | `2ec773a8a44d6de0dd821235d68a23499c59d0771d648cadd5d7b07f4facb93a` |
| `MANIFEST.md` | `6e546f8ee265a8f3eef1b7216c59eba20f856358b5f0d67d5f78ed62b0e56d55` |

`MANIFEST.md` is a navigation/load-policy document, not a complete integrity
manifest. Its hash must not be presented as proof of all Canon contents.

### 4.2 Deterministic tracked-tree manifest

The durable adopted manifest SHALL be derived from the pinned Git commit's tracked
tree, never from an ambient worktree walk. This excludes `.git/**`, untracked files,
ignored files, editor state, and checkout-specific metadata. The adopted algorithm
is:

1. Resolve the exact immutable Canon commit named by the Owner-approved private
   remote.
2. Enumerate regular tracked blobs from that commit using the equivalent of
   `git ls-tree -r --full-tree -z <commit>`; do not enumerate the checkout
   filesystem.
3. Reject symlink (`120000`), submodule/gitlink (`160000`), or unsupported tree
   modes unless a separate reviewed Canon-source decision explicitly admits them.
4. Read each blob's raw bytes from the pinned commit, compute SHA-256, and record its
   byte size without applying checkout filters or line-ending conversion.
5. Use the Git-root-relative path with `/` separators.
6. Sort rows by the relative path using ordinal byte ordering.
7. Emit UTF-8 without BOM and LF line endings using:

```text
<lowercase-sha256><two spaces><byte-size><two spaces><relative/path>
```

8. Append one final LF.
9. Compute SHA-256 over the complete manifest bytes.

The current non-Git sibling source was independently recomputed with the same row
format over its 71-file filesystem snapshot. This is interim provenance evidence,
not the durable adoption pin:

```text
file_count: 71
manifest_bytes: 7499
manifest_sha256: 5b7a78af87d76d6446ba284583ea0de47f607bcca2354a498296c7729544dbef
```

After private-repository provisioning, the tracked-tree manifest must be recomputed
from the proposed pinned commit. A semantically unchanged first commit is expected
to reproduce the 71 rows and the interim digest above; any difference requires a
path-by-path provenance explanation and explicit review. The lock records only the
commit-derived result. It must be recomputed again immediately before migration
application, and the pin must never update silently.

### 4.3 Durable Canon lock

Future path:

```text
ops/canon/AGENT-WORKFLOW-CANON.lock.json
```

Required fields:

```json
{
  "schema_version": "fal.canon_pin.v1",
  "canon_version": "1.2.1",
  "source_kind": "private_git_repository",
  "portable_locator": "<OWNER_APPROVED_PRIVATE_CANON_REMOTE>",
  "workspace_discovery_hint": "../Agent-Workflow-Canon",
  "git_commit": "<IMMUTABLE_COMMIT_AFTER_CANON_REPOSITORY_PROVISIONING>",
  "provenance_decision": "CANON-SOURCE-DECISION-001",
  "file_count": "<PINNED_COMMIT_TRACKED_BLOB_COUNT>",
  "manifest_algorithm": "git-tracked-blob-sha256-size-relative-path-v1",
  "manifest_sha256": "<PINNED_COMMIT_TRACKED_TREE_MANIFEST_SHA256>",
  "version_file_sha256": "2ec773a8a44d6de0dd821235d68a23499c59d0771d648cadd5d7b07f4facb93a",
  "pack_manifest_file_sha256": "6e546f8ee265a8f3eef1b7216c59eba20f856358b5f0d67d5f78ed62b0e56d55",
  "validator": "scripts/validate-pack.ps1",
  "validator_result": "PASS",
  "missing_pack_behavior": "BLOCKED_CANON_RESTORE_REQUIRED",
  "mismatch_behavior": "BLOCKED_CANON_PIN_MISMATCH"
}
```

`CANON-SOURCE-DECISION-001` records the Owner choice: provision Agent Workflow Canon
as a separate private Git repository. The exact remote and first immutable commit do
not exist yet and must be supplied through a separately authorized repository
provisioning action. FAL migration application remains blocked until the private
remote, immutable commit, clean-tree proof, complete-file manifest, acquisition
date, provisioner, restoration owner, and tested clone procedure are all recorded.

The external pack is documentation input, not executable trust. Migration must not
execute imported scripts merely because they are included in the content pin. Only
the separately reviewed validation procedure may run.

## 5. Target Information Architecture

```text
FractalAgentLab/
├── AGENTS.md
├── .editorconfig
├── .gitignore
├── ops/
│   ├── AGENTS.md                         # compatibility pointer only
│   ├── PROJECT_OVERLAY.md                # FAL-specific authority
│   ├── PROJECT_STATE.md                  # compact current pointer
│   ├── Combined-Execution-Sequencing-Plan.md  # sole active Combined
│   ├── Review-Findings-Registry.md
│   ├── canon/
│   │   └── AGENT-WORKFLOW-CANON.lock.json
│   ├── migration/
│   │   └── FAL-MIG-CUTOVER.json
│   └── archive/
│       ├── INDEX.md
│       ├── governance/
│       ├── legacy-sequencing/
│       ├── runbooks/
│       ├── tool-context/
│       └── imports/
├── plans/
│   └── epics/
│       └── FAL-MIG-P.md
├── tracks/
│   ├── Track-A.md
│   ├── Track-B.md
│   ├── Track-C.md
│   ├── Track-D.md
│   └── Track-E.md
├── roles/
│   ├── FAL-META-GOVERNANCE-AUTHOR.md
│   ├── FAL-META-GOVERNANCE-REVIEWER.md
│   ├── FAL-ORCHESTRATOR.md
│   └── FAL-REVIEW-GATE.md
├── evidence/
│   └── FAL-MIG-P/
│       └── INDEX.md
├── handoffs/
├── decisions/
├── incidents/
├── locks/
├── docs/
│   ├── public/
│   └── private/
├── data/
├── src/
├── tests/
├── tools/
└── ui/
```

The existing Combined filename is intentionally retained. The overlay must declare:

```text
Exception ID: FAL-CANON-NAME-001
Canon rule/path: ops/Combined-Execution-Plan.md
FAL replacement: ops/Combined-Execution-Sequencing-Plan.md
Reason: stable existing consumer path and no-second-Combined safety
Scope: FAL only
Approver: Project Owner
Review trigger: Canon major upgrade or evidence-backed consumer migration
Reversal: only through a separately reviewed pointer-cutover Epic
```

The shared `Global-Combined-Rules-Template.md` currently permits historical bundled
Epic/session rows. The overlay must explicitly state that for new FAL work, Canon
one-Epic/one-lifecycle law supersedes that legacy shared default. Historical closed
rows are evidence and are not retroactively rewritten solely for formatting.

## 6. Source-To-Target And Disposition Ledger

Every migration application must preserve a machine/checkable ledger with these
columns:

```text
source path and stable section
source hash
disposition
semantic owner
exact replacement pointer
unique information retained or moved
known consumers
validation
rollback
enforcing gate
```

Allowed initial dispositions:

```text
KEEP_AS_AUTHORITY
COMPRESS_TO_HOT
MOVE_TO_OVERLAY
MOVE_TO_ROLE_PROFILE
MOVE_TO_TRACK_OVERLAY
MOVE_TO_REFERENCE
ARCHIVE_WITH_PROVENANCE
REDIRECT_TO_SUCCESSOR
RETAIN_UNCHANGED
QUARANTINE_UNTIL_CLASSIFIED
```

Initial deletion disposition:

```text
DELETE = none
```

### 6.1 Authority and governance surfaces

| Current source | Target/owner | Initial disposition | Required preservation |
|---|---|---|---|
| Root `AGENTS.md` | Same path | `COMPRESS_TO_HOT` | Canon pin, overlay, state, sole Combined, role and router pointers |
| `ops/AGENTS.md` | `ops/PROJECT_OVERLAY.md` | `MOVE_TO_OVERLAY` plus old-path redirect | FAL identity, product/control-plane split, Tracks, safety, privacy, exceptions, automation boundary |
| `docs/templates/Global-Combined-Rules-Template.md` | Same path, transitional cross-project source | `RETAIN_UNCHANGED` | RingFall and TriageCI consumers; do not remove in FAL-only migration |
| `ops/PROJECT_STATE.md` | Same path | `COMPRESS_TO_HOT` | Hungarian language, one FAL frontier, exact next action, separate readiness/status/phase, revision, candidate/workspace identity |
| `ops/Combined-Execution-Sequencing-Plan.md` | Same path; sole active Combined | `KEEP_AS_AUTHORITY` plus in-place schema cleanup | Stable IDs, current/future Wave/Epic rows, concise closed-Wave index, no second Combined |
| Historical bulk inside current Combined | Non-hot `.snapshot` plus archive index | `ARCHIVE_WITH_PROVENANCE` | Raw bytes/hash, stable section/ID locator, successor pointer; archive object must not use an active-looking Combined filename |
| `ops/Review-Findings-Registry.md` | Same path | `KEEP_AS_AUTHORITY` | Stable finding IDs, active rows, candidate evidence, owner, disposition, enforcing gate, closure proof |
| `ops/Meta-Hardening-Package-v01.md` | Overlay invariants and findings/gates | `MOVE_TO_OVERLAY` plus source archive | H1-H6 rules, evidence basis, provisional status and non-goals |
| `docs/Repo-Visibility-and-Release-Policy-v01.md` | Same path | `KEEP_AS_AUTHORITY` | Dual-repo policy, private-canonical/public-sanitizable/never-public classes |
| `docs/Repo-Skeleton-v01.md` | Same path | `MOVE_TO_REFERENCE` | Product directory ownership and architectural layout; not lifecycle authority |
| `ops/Reliability-Layer-Continuity-Plan-v01.md` | W8-D/W8-I references | `MOVE_TO_REFERENCE` | Continuity concepts; obsolete command routes remain historical only |
| `ops/Workflow-Incident-Backlog.md` | `incidents/INDEX.md` and sanitized incident records | `ARCHIVE_WITH_PROVENANCE` | Incident identity, source, impact, recovery, prevention; live ports/session details stay cold |
| `ops/kontext.md` | Canon/live tool pointers | `ARCHIVE_WITH_PROVENANCE` | It contains obsolete fix commands and review-commit semantics and cannot remain hot |
| `ops/templates/` | Same empty/local directory unless a later template owner is declared | `RETAIN_UNCHANGED` | Do not populate or treat as Canon template authority |
| Root `.editorconfig` | Merge reviewed encoding rules from Canon `.editorconfig` | New bounded governance/config artifact | UTF-8 and line-ending contract only; no blind full-file copy |

### 6.2 Runbooks and role surfaces

| Current source | Target/owner | Initial disposition | Required preservation |
|---|---|---|---|
| `ops/Meta-Coordinator-Runbook.md` | Canon Meta runbook plus FAL Meta profiles | `MOVE_TO_ROLE_PROFILE` | FAL-specific no-production-code rule, automation boundary, visibility ownership, escalation |
| `ops/Track-Implementation-Runbook.md` | Canon Track runbook | `REDIRECT_TO_SUCCESSOR` | Only FAL-specific deltas survive in Track overlays |
| `ops/Track-A-Runbook.md` | `tracks/Track-A.md` | `MOVE_TO_TRACK_OVERLAY` | CLI/UI/read-surface truth and generated-data boundaries |
| `ops/Track-B-Runbook.md` | `tracks/Track-B.md` | `MOVE_TO_TRACK_OVERLAY` | Runtime/state/schema ownership and false-green controls |
| `ops/Track-C-Runbook.md` | `tracks/Track-C.md` | `MOVE_TO_TRACK_OVERLAY` | Prompt/memory/identity semantics and prohibited ownership |
| `ops/Track-D-Runbook.md` | `tracks/Track-D.md` | `MOVE_TO_TRACK_OVERLAY` | Provider/tool/adapter and router integration boundary |
| `ops/Track-E-Runbook.md` | `tracks/Track-E.md` | `MOVE_TO_TRACK_OVERLAY` | Evidence/eval/replay/privacy and proof-class rules |
| `ops/Swarm-Reviewer-Runbook.md` | Canon reviewer runbook plus `roles/FAL-REVIEW-GATE.md` | `MOVE_TO_ROLE_PROFILE` | Read-only candidate boundary, advisory status, evidence-only write surface |
| Router operating authority | `roles/FAL-ORCHESTRATOR.md` plus router hot runbook | `MOVE_TO_ROLE_PROFILE` | Exact transport, duplicate-send, target-first identity, no restart authority |
| `tools/oc-session-router/docs/workflow-orchestrator-runbook.md` | Same path | `KEEP_AS_AUTHORITY` | Mechanical router law only; currently compact and Canon-aligned |
| `tools/oc-session-router/docs/workflow-orchestrator-reference.md` | Same path | `MOVE_TO_REFERENCE` | Cold mechanics and compatibility detail |
| Other router docs | Same paths plus index | `RETAIN_UNCHANGED` initially | W8-F classifies each as hot/reference/archive; W8-E owns behavior changes |
| Router scripts/config behavior | Existing paths | `RETAIN_UNCHANGED` | Excluded from FAL-MIG-P mutation; W8-E only |

### 6.3 Tool-context and historical apply material

| Current source | Target/owner | Initial disposition | Required preservation |
|---|---|---|---|
| `ops/OPENCODE_COMMANDS_CONTEXT.md` | Live registry discovery and Canon command catalog | `ARCHIVE_WITH_PROVENANCE` | Historical inventory only; no copied command body remains hot |
| `ops/OPENCODE_SKILLS_CONTEXT.md` | Live registry discovery and Canon skill catalog | `ARCHIVE_WITH_PROVENANCE` | Historical inventory only |
| `ops/OC/**` | `ops/archive/tool-context/oc-server-bridge/` | `ARCHIVE_WITH_PROVENANCE` | W8-E historical input; no execution or active authority |
| `ops/temp/*.ps1` | Private provenance ledger or continued local-only storage | `QUARANTINE_UNTIL_CLASSIFIED` | Never execute in migration; scan secrets, paths, backups, and supersession before tracking |
| `.opencode-toolbox/**` | External/generated mirror | `RETAIN_UNCHANGED` | Private/ignored; never authority |
| Global commands/skills | Global OpenCode config | `RETAIN_UNCHANGED` | Changes only via `/workflow-fix` plus `/oc-toolsmith` |

### 6.4 Roadmaps, private doctrine, and imported packages

| Current source | Target/owner | Initial disposition | Required preservation |
|---|---|---|---|
| `docs/private/FAL-Wave8-Wave10-Canon-Aligned-Roadmap-v1.md` | Same path, explicit durable allowlist | `KEEP_AS_AUTHORITY` | Detailed roadmap; Combined remains sequence authority |
| `docs/private/FAL-Canon-Lifecycle-Integration-Architecture-v1.md` | Same path, explicit durable allowlist | `KEEP_AS_AUTHORITY` | H4/H5/W6/W7 integration and ownership boundaries |
| `plans/epics/FAL-MIG-P.md` | Same path | `KEEP_AS_AUTHORITY` after acceptance | Current migration plan and execution capsule |
| `FAL_Wave8_Wave10_Planning_Package_README.md` | Separate import provenance record | `ARCHIVE_WITH_PROVENANCE` | Source date, hash, old claims, non-active status |
| `extracted/FractalAgentLab/**` | Separate immutable import manifest | `QUARANTINE_UNTIL_CLASSIFIED` then `ARCHIVE_WITH_PROVENANCE` | Do not merge with root package record; extracted W8-E ownership conflicts with live roadmap and remains non-active |
| `FAL_Meta_Coordinator_Software_Factory_Brief.md` | Private import/reference archive | `ARCHIVE_WITH_PROVENANCE` | Advisory origin and no-implementation status |
| `fractalagentlab_coding_vertical_pack/**` | Separate import manifest and successor map | `ARCHIVE_WITH_PROVENANCE` | Preserve unique prompt/policy material and canonicalized descendants |
| Closed `docs/wave0/**` through `docs/wave5/**` | Existing paths plus closed-Wave index | `RETAIN_UNCHANGED` | Historical evidence; no bulk move in first application |
| `docs/private/Wave6*` and `Wave7*` families | Existing paths plus history index | `RETAIN_UNCHANGED` | Cold after adoption; exact pointers remain available |
| Extracted W8/W9 per-Epic plans | Import archive only | `ARCHIVE_WITH_PROVENANCE` | Never activate or copy into `plans/epics/` automatically |
| `docs/private/OnlabRefinery-anyag.zip` | Existing local/private path | `QUARANTINE_UNTIL_CLASSIFIED` | Do not extract, execute, unignore, or track during migration |
| BSc thesis brief | Existing private path | `RETAIN_UNCHANGED` | Separate sibling research direction, outside FAL Waves |

### 6.5 Runtime, generated, and dirty surfaces

| Current source | Initial disposition | Enforcing owner/gate |
|---|---|---|
| `data/**` raw runs/traces/artifacts | `RETAIN_UNCHANGED`, ignored | W8-I |
| `.opencode-router/**` live transport/session state | `RETAIN_UNCHANGED`, ignored | W8-E/W8-I |
| `.swarm/**` review-only lifecycle/evidence | `RETAIN_UNCHANGED`, ignored and unrelated | Separate Swarm lifecycle |
| `.opencode/**` local OpenCode state | `RETAIN_UNCHANGED`, ignored | No FAL migration mutation |
| `src/.../router_fal_sync.py` | `RETAIN_UNCHANGED`, protected dirty input | W8-E |
| `tests/.../test_router_fal_sync.py` | `RETAIN_UNCHANGED`, protected dirty input | W8-E |
| `ui/public/generated/**` | `RETAIN_UNCHANGED`, ignored | Existing W7.8 boundary |
| `docs/architecture/**` generated diagnostics | `RETAIN_UNCHANGED`, ignored | Existing automation boundary |

### 6.6 Exact First-Application Mutation Manifest

The policy tables above classify the full repository. The first application scope
is narrower and must be materialized as a machine-checkable ledger at:

```text
evidence/FAL-MIG-P/source-ledger.csv
```

Every row must contain the columns defined at the start of section 6. Existing-file
hashes are frozen at application Stage 0; `[NEW]` identifies additive files.

| Path or path family | First-application action | Known hot consumers | Validation | Rollback | Future owner/gate |
|---|---|---|---|---|---|
| `AGENTS.md` | Update bootloader pointers and cutover guard | All FAL sessions | Root hydration and one-Combined scan | Baseline restoration bundle | W8-B |
| `.gitignore` | Replace broad authority ignores with exact reviewed allowlist | Git/status/closeout | Newly-visible path and privacy scan | Baseline restoration bundle | W8-I |
| `.editorconfig` | Add reviewed UTF-8/line-ending rules | Editors/generators | Strict UTF-8 and EOL checks | Remove additive file | W8-H/W8-I |
| `ops/AGENTS.md` | Replace with compatibility pointer after preservation | Legacy FAL session prompts | Pointer and archive-resolution scan | Restore baseline bytes | W8-B |
| `ops/PROJECT_STATE.md` | Apply compact Canon state candidate at cutover | All FAL sessions | State schema/budget/cold resume | Restore baseline bytes | W8-B |
| `ops/Combined-Execution-Sequencing-Plan.md` | Apply in-place sole-Combined candidate at cutover | Root/state/Tracks/Meta/router docs | Schema, stable-ID, one-path scan | Restore baseline bytes | W8-A/W8-B |
| `ops/Review-Findings-Registry.md` | Normalize active rows and archive policy | Meta/review/closeout | Finding/gate cross-check | Restore baseline bytes | W8-F |
| `ops/Meta-Coordinator-Runbook.md` | Redirect stable generic behavior; preserve FAL deltas | Meta sessions | Semantic-preservation map | Restore baseline bytes | W8-B |
| `ops/Track-Implementation-Runbook.md` | Redirect to Canon Track runbook | Delivery Tracks | Role hydration | Restore baseline bytes | W8-B |
| `ops/Track-A-Runbook.md` through `ops/Track-E-Runbook.md` | Redirect to new Track overlays | Delivery Tracks | Per-Track hydration | Restore baseline bytes | W8-B |
| `ops/Swarm-Reviewer-Runbook.md` | Redirect to Canon reviewer plus FAL profile | Review/Gate sessions | Read-only authority test | Restore baseline bytes | W8-B |
| `ops/PROJECT_OVERLAY.md` | `[NEW]` | Root/roles/state | Overlay completeness/conflict scan | Remove additive file | W8-B |
| `ops/canon/AGENT-WORKFLOW-CANON.lock.json` | `[NEW]` | Root/overlay/validation | Remote/commit/manifest validation | Remove additive file | W8-B |
| `ops/migration/FAL-MIG-CUTOVER.json` | `[NEW]` durable cutover sentinel | Old/new root bootloaders, Orchestrator, recovery actor | State/schema/pre-hydration and interruption tests | Set `ROLLBACK_REQUIRED`, restore baseline, then retain final `ROLLED_BACK` evidence | W8-A/W8-D |
| `tracks/Track-A.md` through `tracks/Track-E.md` | `[NEW]` | Delivery Tracks | Profile/template checks | Remove additive files | W8-B |
| `roles/FAL-META-GOVERNANCE-AUTHOR.md` | `[NEW]` | Governance author | Capability intersection review | Remove additive file | W8-B |
| `roles/FAL-META-GOVERNANCE-REVIEWER.md` | `[NEW]` | Independent Meta reviewer | Independence/read-only review test | Remove additive file | W8-B |
| `roles/FAL-ORCHESTRATOR.md` | `[NEW]` | Router/Orchestrator | Target-first/no-restart checks | Remove additive file | W8-B |
| `roles/FAL-REVIEW-GATE.md` | `[NEW]` | Review/Swarm sessions | Candidate read-only/evidence-only checks | Remove additive file | W8-B |
| `evidence/FAL-MIG-P/INDEX.md` | `[NEW]` | Meta/closeout | Claim-to-proof completeness | Remove additive file | W8-I |
| `ops/archive/INDEX.md` and approved sanitized metadata | `[NEW]` | Search/audit only | No hot authority pointers | Remove additive files | W8-F |
| `evidence/FAL-MIG-P/source-ledger.csv` | `[NEW]` | Migration reviewers/closeout | Row completeness and path match | Remove additive file | W8-F/W8-I |
| `evidence/FAL-MIG-P/privacy-scan-coverage.json` | `[NEW]` | Privacy reviewer/closeout | Every candidate/staged path scanned or manually dispositioned; no skip | Remove additive file | W8-I |
| `docs/private/FAL-Wave8-Wave10-Canon-Aligned-Roadmap-v1.md` | Make durable through exact allowlist; content unchanged unless separately reviewed | Combined/Meta/W8 planning | Privacy, pointer, exact staging, hash check | Restore ignore policy; content baseline unchanged | W8-B/W8-I |
| `docs/private/FAL-Canon-Lifecycle-Integration-Architecture-v1.md` | Make durable through exact allowlist; content unchanged unless separately reviewed | Overlay/W8-B/W8-E/W8-I | Privacy, pointer, exact staging, hash check | Restore ignore policy; content baseline unchanged | W8-B/W8-I |
| `tools/oc-session-router/docs/workflow-orchestrator-runbook.md` | Make reviewed hot mechanical runbook durable through exact allowlist | Root/Orchestrator/Meta | Secret/path scan, Canon conflict review, exact staging | Restore ignore policy; content baseline unchanged | W8-B/W8-I |
| `tools/oc-session-router/docs/workflow-orchestrator-reference.md` | Make reviewed cold mechanical reference durable through exact allowlist | Router runbook on named trigger | Secret/path scan, cold-pointer review, exact staging | Restore ignore policy; content baseline unchanged | W8-B/W8-I |

Imported packages, raw archives, `ops/temp/**`, router scripts/runtime, product code,
tests, global tools, and target repositories are outside the first-application
mutation manifest.

## 7. Durable And Private Boundary

### 7.1 Durable sanitized truth

After repository-visibility proof and per-file privacy review, the following are
intended to be versioned in the private canonical repository:

```text
AGENTS.md
.editorconfig
.gitignore
ops/PROJECT_OVERLAY.md
ops/PROJECT_STATE.md
ops/Combined-Execution-Sequencing-Plan.md
ops/Review-Findings-Registry.md
ops/canon/AGENT-WORKFLOW-CANON.lock.json
plans/epics/*.md
tracks/*.md
roles/*.md
evidence/<Epic-ID>/INDEX.md
handoffs/**
decisions/**
sanitized incidents/**
locks/**
the two explicitly reviewed FAL Wave 8-10 roadmap/architecture inputs
the exact reviewed router hot runbook/reference files required for restoration
sanitized archive indexes and specifically approved archive objects
```

### 7.2 Private/transient truth

The following remain ignored and unavailable to ordinary fresh-clone hydration:

```text
.opencode-router/**
.swarm/**
.opencode/**
.opencode-toolbox/**
.opencode-tooling-snapshot/**
data/runs/**
data/traces/**
data/artifacts/**
raw logs and transcripts
live session IDs, ports, passwords, tokens, cookies, endpoints
ops/temp/** until individually sanitized
raw imported archives and zip files
unreviewed extracted packages
router backups and live runtime registries
ui/public/generated/**
docs/architecture/**
```

### 7.3 Conditional private doctrine

Every other `docs/private/**` file must receive one classification before tracking:

```text
private-canonical
public-sanitizable
never-public
local-only
historical-provenance
```

No migration task may remove the broad ignore and thereby expose all private docs.

### 7.4 Staging and tracking law

- Prohibit `git add .`, `git add -A`, broad directory staging, and `git add -f`.
- Stage exact reviewed paths only during `/closeout-commit`.
- Run candidate-only and staged-diff secret, absolute-path, session-ID, and raw
  transcript scans.
- A private repository does not make secrets or raw target data acceptable to track.
- Any newly visible ignored file outside the approved allowlist blocks closeout.
- Privacy scanning must emit `evidence/FAL-MIG-P/privacy-scan-coverage.json` with one
  row for every candidate and staged path: path, content type, scanner/check,
  `SCANNED | MANUALLY_DISPOSITIONED | SKIPPED | UNREADABLE`, result, reviewer, and
  limitations. `SKIPPED` or `UNREADABLE` for any candidate/staged path fails closed
  as `BLOCKED_PRIVACY_SCAN_INCOMPLETE`; a nominal scanner success with zero covered
  candidate files is invalid evidence.

## 8. Archive And Import Quarantine Contract

No imported package or archive may be extracted, executed, or made authoritative
during migration planning or initial cutover.

Each import receives a separate ledger containing:

```text
import ID
source path
acquisition/source date
byte size
SHA-256
archive/container type
visibility classification
semantic owner
superseding source
known consumers
retention reason
allowed operations
```

Reject or quarantine imports containing:

- absolute paths;
- `..` traversal;
- symlinks/reparse points;
- alternate data streams;
- Windows device names;
- unexpected executable content;
- secret or credential material;
- oversized or decompression-bomb behavior;
- duplicate active-authority filenames without explicit non-authoritative labels.

Historical imports may preserve stale or conflicting rules as evidence, but archive
headers and indexes must state that they cannot influence routine hydration,
readiness, acceptance, or routing.

## 9. Migration State Machine

The migration must never expose a mixed authority generation as active.

```text
PLANNED
-> PREPARED
-> VALIDATED_SHADOW
-> REVIEWED_SHADOW
-> CUTOVER_INTENT_RECORDED
-> CUTOVER_IN_PROGRESS
-> ACTIVE
-> CLOSED
```

Failure/recovery states:

```text
PREPARED -> BLOCKED
VALIDATED_SHADOW -> BLOCKED
VALIDATED_SHADOW -> REVIEWED_SHADOW
REVIEWED_SHADOW -> VALIDATED_SHADOW
REVIEWED_SHADOW -> BLOCKED
REVIEWED_SHADOW -> CUTOVER_INTENT_RECORDED
CUTOVER_INTENT_RECORDED -> ROLLED_BACK
CUTOVER_IN_PROGRESS -> CUTOVER_INTERRUPTED
CUTOVER_IN_PROGRESS -> ACTIVE
CUTOVER_INTERRUPTED -> ROLLBACK_REQUIRED
CUTOVER_INTERRUPTED -> ACTIVE
ACTIVE -> ROLLBACK_REQUIRED
ROLLBACK_REQUIRED -> ROLLED_BACK
```

State meanings:

| State | Meaning |
|---|---|
| `PLANNED` | This reviewed plan exists; no application authority |
| `PREPARED` | Baseline, hashes, source map, Canon pin, and additive files exist; old authority remains active |
| `VALIDATED_SHADOW` | New packet passes checks and cold-resume rehearsals without owning authority |
| `REVIEWED_SHADOW` | The byte-frozen shadow generation has independent `/step-review` acceptance and exact `/step-review-utan` `ACK_ONLY`; old authority remains active |
| `CUTOVER_INTENT_RECORDED` | Exact pointer delta and rollback packet are frozen; no cutover write has occurred |
| `CUTOVER_IN_PROGRESS` | Sentinel is active and at least one live authority write may have occurred; all ordinary hydration/routing/mutation is blocked |
| `CUTOVER_INTERRUPTED` | Cutover completion is uncertain or incomplete; only the named recovery actor may validate forward completion or restore the baseline |
| `ACTIVE` | Root/overlay/state/Combined pointers identify exactly one complete new generation |
| `CLOSED` | Independent review, Delivery response, governance reconciliation, and commit/no-commit complete |
| `BLOCKED` | A gate failed before cutover; old authority remains active |
| `ROLLBACK_REQUIRED` | Post-cutover invariant failed; mutation freezes |
| `ROLLED_BACK` | Old generation is restored and directly verified |

An interruption must be injected or simulated after each future cutover write. A
pre-cutover failure stops at `BLOCKED`; an interrupted live cutover stops at
`CUTOVER_INTERRUPTED` or `ROLLBACK_REQUIRED`. Every restart must resolve to one
complete generation or the exact recovery state and must never guess between old
and new pointers.

The durable sentinel path is:

```text
ops/migration/FAL-MIG-CUTOVER.json
```

Required sentinel fields:

```json
{
  "schema_version": "fal.migration_cutover.v1",
  "migration_id": "<id>",
  "state": "CUTOVER_INTENT_RECORDED | CUTOVER_IN_PROGRESS | CUTOVER_INTERRUPTED | ROLLBACK_REQUIRED | ACTIVE | ROLLED_BACK",
  "old_generation_id": "<manifest digest>",
  "new_generation_id": "<manifest digest>",
  "baseline_bundle_ref": "<private bundle plus sanitized receipt>",
  "ordered_live_writes": [],
  "last_completed_write": "<path or none>",
  "next_expected_write": "<path or none>",
  "writer_profile": "<authorized Meta governance application profile>",
  "recovery_profile": "<independent named recovery profile>",
  "updated_at": "<timestamp>"
}
```

Only the W8-A-sequenced Meta governance application profile may advance the
sentinel. A separately named recovery profile may transition an uncertain operation
to `CUTOVER_INTERRUPTED` or `ROLLBACK_REQUIRED`. Before the first live migration,
both the old and proposed root bootloaders must contain the same mandatory
pre-hydration rule: if the sentinel is `CUTOVER_IN_PROGRESS`,
`CUTOVER_INTERRUPTED`, or `ROLLBACK_REQUIRED`, ordinary sessions perform no routing
or mutation and return the exact recovery route. Installing that guard is a
separately reviewed preparatory governance change and does not activate the new
authority generation.

## 10. Ordered Application Plan

The following order describes later application. It is not authorized by this
planning artifact.

Application entry order is fixed:

```text
FAL-MIG-P accepted and CLOSED
-> W8-A authority/baseline/provenance reconciliation
-> W8-A explicitly sequences separately reviewed migration slices
-> only then Stage 0 of an authorized application slice may begin
```

W8-A precedes every live migration write. No stage below may be interpreted as an
alternate path around W8-A.

### Stage 0: Baseline And Safe Boundary

1. Re-read root instructions, overlay/current equivalent, state, sole Combined,
   current plan, findings, visibility policy, router runbook, and Canon pin sources.
2. Capture FAL HEAD, branch, status, staged state, ignored state, EOL state, and
   current per-file hashes.
3. Capture a hunk-level ledger for every pre-existing modified or staged path that
   intersects the application mutation manifest. Each hunk requires prior owner,
   proposed application owner, disposition (`close_separately | preserve | adopt`),
   attribution evidence, and enforcing gate. The dirty router-sync source/test hunks
   remain W8-E/Track-D-owned and must be preserved untouched; current planning edits
   to Combined/state must be closed separately or consciously adopted with explicit
   FAL-MIG-P author attribution before application.
4. Generate separate manifests for root imports, extracted imports, coding-vertical
   pack, ops temp scripts, and any archive container.
5. Verify remote private visibility through an Owner-verifiable mechanism.
6. Recompute the Canon tracked-tree manifest from the proposed pinned commit, compare
   it with the 71-file interim provenance snapshot, explain every difference, and
   run Canon validation against the exact pinned checkout.
7. Stop if any planned input or protected scope differs from the reviewed identity.
8. Create a privacy-reviewed raw-byte restoration bundle under the ignored private
   root `data/migration-baselines/FAL-MIG-P/<baseline-id>/` before changing any
   existing authority file.
9. Include every existing file named in the exact first-application mutation
   manifest, plus a manifest containing relative path, byte size, SHA-256, baseline
   HEAD, capture time, capture role, access owner, and retention/release gate.
10. Persist only a sanitized baseline receipt and manifest digest under the durable
    evidence/archive index; do not track private raw baseline bytes.
11. Restore the bundle into an isolated temporary copy and prove every baseline hash
    before admitting the bundle as rollback evidence.

### Stage 1: Additive Canonical Surfaces

Create only additive files while old authority remains active:

```text
ops/PROJECT_OVERLAY.md
ops/canon/AGENT-WORKFLOW-CANON.lock.json
ops/migration/FAL-MIG-CUTOVER.json
tracks/Track-A.md through Track-E.md
roles/FAL-META-GOVERNANCE-AUTHOR.md
roles/FAL-META-GOVERNANCE-REVIEWER.md
roles/FAL-ORCHESTRATOR.md
roles/FAL-REVIEW-GATE.md
evidence/FAL-MIG-P/INDEX.md
ops/archive/INDEX.md
```

The existing Combined and state remain authoritative during this stage.

### Stage 2: Semantic Preservation

1. Build a section-level map for every source to be shortened or redirected.
2. Move only stable FAL-specific rules to the overlay, Track overlays, or role
   profiles.
3. Point generic lifecycle behavior to the pinned Canon rather than copying it.
4. Preserve unique history in a hash-bound archive object or unchanged source.
5. Record unresolved equivalence as migration debt and retain the source.
6. Do not create a second Combined.

### Stage 3: Sole Combined Shadow Candidate

1. Keep the live `ops/Combined-Execution-Sequencing-Plan.md` unchanged and sole
   active during shadow validation.
2. Build the proposed replacement bytes under the ignored, non-authoritative
   `data/migration-candidates/<candidate-id>/ops/Combined-Execution-Sequencing-Plan.md`.
3. Label the shadow root as migration candidate data; no hot pointer may resolve to
   it.
4. Preserve the live pre-cutover raw bytes in the Stage 0 restoration bundle and
   record its hash in the sanitized baseline receipt.
5. Keep stable Wave and Epic IDs.
6. Retain concise closed-Wave summaries and indexed history.
7. Keep current/future Waves and one row per Epic.
8. Separate readiness, Epic status, and workflow phase into distinct fields.
9. Add lane-class/profile, plan, evidence, and next-unlock pointers.
10. Preserve the `FAL-MIG-P` and Wave 8-10 rows without activating them.
11. Run a reference scan proving no entry point names another active Combined.

### Stage 4: Compact State And Findings Shadow Candidates

1. Keep live state/findings unchanged and build proposed replacement bytes under the
   ignored migration-candidate root.
2. Convert the state candidate to the Canon compact schema.
3. Keep it under 120 lines and approximately 1,500 tokens.
4. Keep exactly one FAL frontier and one next action.
5. Separate readiness, status, and workflow phase.
6. Add state revision, adopted Canon pin, Combined locator, lane/profile, workspace,
   candidate, and evidence fields.
7. Keep target active-context/checkpoints as explicitly non-authoritative mirror
   records outside FAL project state.
8. Normalize the findings candidate without changing stable IDs or accepted
   dispositions.
9. Require every deferred finding to appear in a named enforcing gate.

### Stage 5: Granular Durability Candidate

1. Replace broad ignore rules only with exact reviewed allowlist patterns.
2. Keep runtime, session, raw evidence, imports, backups, and unreviewed private docs
   ignored.
3. Confirm only approved sanitized paths become newly visible.
4. Run pre-staging privacy and machine-path scans.
5. Do not stage or commit.

### Stage 6: Shadow Hydration And Recovery

Run fresh-session rehearsals for:

```text
Meta governance author
independent Meta governance reviewer
representative Delivery Track
Review/Gate Operator
Router/Orchestrator
Closeout
```

Each role must recover:

```text
authority
scope
Wave/Epic
lane/profile
workflow phase
pinned input/candidate
acceptance/evidence
blockers/findings
required output
one exact next action
```

Measure files loaded, retrieval count, words/characters, approximate tokens, and
recovery time. A routine packet should target approximately 3,000 tokens before
phase payload; any packet above approximately 4,000 tokens requires a written safety
justification.

### Stage 7: Byte-Frozen Shadow Review And ACK

1. Run structural, semantic, pointer, UTF-8, privacy, status, tracked-tree manifest,
   rollback, interruption, and cold-resume checks against the complete shadow
   generation while the old authority remains live.
2. Freeze the exact candidate bytes, generation manifest, implementation brief,
   baseline receipt, dirty-hunk disposition ledger, and expected live-write order.
3. Route `/step-review` to an independent governance-review profile/session against
   that byte-frozen shadow candidate.
4. Route the exact final synthesis through `/step-review-utan`.
5. If fixes are required, return to `VALIDATED_SHADOW`, apply only bounded fixes
   through `/implement`, freeze a new candidate identity, and repeat independent
   `/step-review` for that new candidate.
6. Enter `REVIEWED_SHADOW` only after the exact candidate receives `ACK_ONLY`.
7. Never self-review a Meta-authored governance candidate.
8. No live authority pointer or existing authority byte may change in this stage.

### Stage 8: Reviewed Cutover Intent And Pointer Switch

1. Admit only the exact `REVIEWED_SHADOW` generation; any byte, manifest, baseline,
   dirty-hunk, or write-order drift invalidates the ACK and returns to Stage 6/7.
2. Freeze a `CUTOVER_INTENT_RECORDED` packet containing the reviewed old/new hashes,
   ACK evidence, ordered writes, and rollback steps.
3. Acquire the approved exclusive migration/maintenance window and record a
   `CUTOVER_IN_PROGRESS` fail-closed sentinel before any live authority write.
4. Apply the reviewed shadow Combined, state, findings, root, overlay, runbook, and
   other mutation-manifest bytes to their existing live paths; do not build or
   reinterpret content during cutover.
5. Replace `ops/AGENTS.md` with a compact compatibility pointer only after its
   semantic-preservation map is complete.
6. Keep the existing Combined path; no redirect and no new Combined file are needed.
7. Update only the exact reviewed FAL-internal consumers; do not edit sibling target
   repositories.
8. After each live write, simulate or handle interruption by requiring the sentinel
   to transition to `CUTOVER_INTERRUPTED` and block ordinary work until either the
   complete reviewed generation validates or `ROLLBACK_REQUIRED` restores the
   complete old generation.
9. Keep ordinary hydration/routing/mutation fail-closed until every live path's raw
   bytes match the reviewed generation manifest.
10. Transition to `ACTIVE` only after all generation IDs, paths, hashes, privacy
    checks, and bootloader sentinel tests agree; never clear or bypass an uncertain
    sentinel.

### Stage 9: Post-Cutover Equivalence And Migration-Slice Closeout

1. Prove the live generation is byte-equivalent to the independently reviewed
   shadow generation and repeat deterministic pointer, privacy, hydration, and
   rollback-readiness checks.
2. On any mismatch, enter `ROLLBACK_REQUIRED`; do not repair or reinterpret live
   content in place under the accepted ACK.
3. Reconcile state, sole Combined, findings, evidence, archive index, Canon pin, and
   cutover sentinel evidence.
4. Stage exact paths only through `/closeout-commit` after the already candidate-bound
   exact `ACK_ONLY` and successful live equivalence proof.
5. Create a local commit or explicit no-commit result. Never push.
6. Route the exact next W8 Epic named by the already completed W8-A sequencing
   decision.
7. Do not broaden or reinterpret W8-A's `OPEN_W8`/`HOLD` authority during migration
   closeout.

### Stage 10: Deferred Destructive Cleanup

Deletion and redirect retirement remain outside the initial application. A later
Epic must prove:

- the source has no active consumer;
- its unique information is preserved;
- cold-resume and targeted search do not depend on it;
- the rollback window has expired by Owner decision;
- privacy and retention law permit deletion;
- the exact deletion scope completed independent review.

## 11. Feature -> User Story -> Task Decomposition

### Feature FAL-MIG-P-F01: Identity, Authority, And Provenance Freeze

**Outcome:** Every migration input has an exact identity, authority class, consumer
map, and rollback reference before any mutation.

#### User Story FAL-MIG-P-US01

As the FAL Owner and Meta Coordinator, the system SHALL distinguish FAL project
truth, target-project truth, Canon lifecycle truth, live tool mechanics, and
historical evidence so that cleanup cannot promote the wrong source into authority.

| Task ID | Action | Output | Verification | Owner |
|---|---|---|---|---|
| FAL-MIG-P-T01 | Pin FAL HEAD, worktree/status, ignored state, and authority-file hashes | Baseline identity record | Repeated read-only inspection agrees | Meta author |
| FAL-MIG-P-T02 | Generate the complete Canon size/hash manifest and aggregate digest | Canon pin candidate | File count, digest, validator PASS | Meta author; independent reviewer verifies |
| FAL-MIG-P-T03 | Inventory all governance, runbook, context, import, archive, runtime, and generated source families | Complete source ledger | Every in-scope family has one disposition | Meta author |
| FAL-MIG-P-T04 | Identify internal and sibling consumers of legacy authority paths | Consumer map | No changed pointer lacks a consumer decision | Meta author |
| FAL-MIG-P-T05 | Freeze dirty W8-E paths and hunks | Protected-scope ledger | Hashes/hunks unchanged | Meta author; W8-E owner later |

### Feature FAL-MIG-P-F02: Canonical FAL Information Architecture

**Outcome:** FAL has one compact bootloader, one overlay, one state, one active
Combined, explicit Track/role profiles, and durable Epic/evidence pointers.

#### User Story FAL-MIG-P-US02

As a fresh FAL session, the system SHALL recover the exact role, authority,
frontier, phase, blocker, and next action without loading complete project history.

| Task ID | Action | Output | Verification | Owner |
|---|---|---|---|---|
| FAL-MIG-P-T06 | Specify the compact root bootloader and FAL overlay contract for later W8-B ownership | Planning requirement | Authority order and hot sections unambiguous | FAL-MIG-P Meta author |
| FAL-MIG-P-T07 | Specify the sole-Combined in-place conversion and naming-exception contract for later W8-A/W8-B ownership | Planning requirement | One active path; no second Combined; stable IDs | FAL-MIG-P Meta author |
| FAL-MIG-P-T08 | Specify compact state fields and FAL-product/target-mirror separation for later W8-B ownership | Planning requirement | Under-budget schema with one exact next action | FAL-MIG-P Meta author |
| FAL-MIG-P-T09 | Specify Track overlays and independent governance/review profile requirements | Planning requirement | Bounded authority and hydration complete | FAL-MIG-P Meta author |
| FAL-MIG-P-T10 | Specify Epic, findings, evidence, handoff, decision, incident, and lock surfaces | Planning requirement | Candidate and claim-to-proof identity resolve | FAL-MIG-P Meta author |

### Feature FAL-MIG-P-F03: Hybrid Durability And Lossless Cleanup

**Outcome:** Durable sanitized truth is reproducible while raw runtime/private
material remains ignored and non-authoritative.

#### User Story FAL-MIG-P-US03

As the Owner of the private canonical lab repository, the system SHALL version the
minimum governance packet without exposing raw runtime, target-private, secret, or
session data.

| Task ID | Action | Output | Verification | Owner |
|---|---|---|---|---|
| FAL-MIG-P-T11 | Specify the required private-visibility receipt and fail-closed gate | Planning requirement | Receipt source, owner, and failure route are exact | FAL-MIG-P Meta author |
| FAL-MIG-P-T12 | Specify the granular `.gitignore` allowlist contract for later W8-I ownership | Planning requirement | Only named sanitized paths may become visible | FAL-MIG-P Meta author |
| FAL-MIG-P-T13 | Classify private docs, imports, archives, runtime, and generated roots at planning level | Durability/retention map | Every family has owner/storage/publication rule | FAL-MIG-P Meta author |
| FAL-MIG-P-T14 | Specify semantic-preservation and legacy-ID ledger requirements | Preservation contract | No unique content or stable ID may disappear | FAL-MIG-P Meta author |
| FAL-MIG-P-T15 | Specify non-hot archive/import index and quarantine requirements | Archive contract | Retired sources stay discoverable and non-authoritative | FAL-MIG-P Meta author |

### Feature FAL-MIG-P-F04: Safe Cutover, Verification, And Recovery

**Outcome:** The new governance packet can be activated and rolled back without
changing product behavior or losing operational continuity.

#### User Story FAL-MIG-P-US04

As a FAL operator, the system SHALL prove the new authority packet through pointer
validation, semantic checks, interrupted-cutover recovery, and independent
cold-resume rehearsals before old hot paths cease to own semantics.

| Task ID | Action | Output | Verification | Owner |
|---|---|---|---|---|
| FAL-MIG-P-T16 | Specify additive preparation and old-authority preservation | Application contract | `PREPARED` cannot change live authority | FAL-MIG-P Meta author |
| FAL-MIG-P-T17 | Specify role-specific shadow cold-resume rehearsals | Verification contract | Every role must pass sufficiency test | FAL-MIG-P Meta author |
| FAL-MIG-P-T18 | Specify cutover intent and baseline restoration bundle | Recovery contract | Exact old/new hashes, bytes, owner, retention | FAL-MIG-P Meta author |
| FAL-MIG-P-T19 | Specify reviewed-shadow gate, pointer switch, sentinel, and interruption boundaries | Cutover contract | Exact candidate receives independent ACK before any live authority write; old, complete reviewed new, or fail-closed; never mixed | FAL-MIG-P Meta author |
| FAL-MIG-P-T20 | Specify complete pre-cutover independent review and post-cutover byte-equivalence requirements | Review contract | All mandatory claims require candidate-bound evidence before cutover and exact live-byte proof after cutover | FAL-MIG-P Meta author |
| FAL-MIG-P-T21 | Specify migration-slice closeout and W8 handoff law | Closeout contract | W8-A must precede application and own sequencing | FAL-MIG-P Meta author |

## 12. Compatibility And Cutover Law

### 12.1 One Combined invariant

The following checks must all pass:

- Root `AGENTS.md` names exactly
  `ops/Combined-Execution-Sequencing-Plan.md`.
- `ops/PROJECT_OVERLAY.md` names the same path and records
  `FAL-CANON-NAME-001`.
- `ops/PROJECT_STATE.md` names the same path and exact Epic locator.
- Every active Track/role profile points to the same path.
- No `ops/Combined-Execution-Plan.md` exists.
- No archive Markdown file presents itself as an active Combined.
- Imported/extracted copies are explicitly non-authoritative and excluded from
  routine hydration.
- A reference scan fails when any hot entry point names a second active Combined.

### 12.2 Legacy behavior

Legacy filenames, Sprint labels, Step headings, bundled closed rows, and historical
status terms may remain inside source citations or archived history. They cannot be
used for new FAL work, readiness, current sequencing, or lifecycle routing.

### 12.3 FAL product and target mirror separation

`ops/PROJECT_STATE.md` contains the FAL project's own frontier only. External target
state belongs to each target repository. FAL checkpoint and active-context records
are labeled mirror/evidence/projection and stored separately. They cannot override
target Combined, target state, target acceptance, or target closeout.

## 13. Rollback Plan

### 13.1 Before pointer cutover

Rollback consists only of removing migration-created additive candidate files.
Current authority remains active and no existing source is shortened.

### 13.2 After cutover intent but before pointer switch

Mark the migration `BLOCKED`, discard cutover intent after recording the failure,
and retain the old active generation unchanged.

### 13.3 After pointer switch but before commit

1. Freeze all further mutation.
2. Load the reviewed first-application mutation manifest and baseline bundle; fail
   closed if either identity differs from the cutover sentinel.
3. Restore the raw baseline bytes for **every pre-existing path** in the mutation
   manifest, including root/overlay predecessors, `ops/AGENTS.md`, every affected
   runbook, findings surface, sole Combined, state, `.gitignore`, roadmap/architecture
   inputs, router documentation, and any other existing consumer or index named by
   that manifest. The named examples are not an allowlist or a substitute for
   complete manifest-set restoration.
4. Remove only files whose mutation-manifest disposition proves they were created
   additively by this migration generation.
5. Compare the restored path set exactly with the pre-existing-path set in the
   baseline manifest; missing, extra, unreadable, skipped, or hash-mismatched paths
   keep the state at `ROLLBACK_REQUIRED`.
6. Recompute and match every baseline byte size and SHA-256, then recompute protected
   W8-E hashes and the hunk ledger.
7. Run old-generation bootloader, hydration, pointer, privacy, and one-Combined
   validation in an isolated restore rehearsal and then in the restored workspace.
8. Record `ROLLED_BACK` only when the complete set and every baseline hash match,
   with exact cause, actor, restored manifest digest, and evidence.

### 13.4 After local commit but before push

Use a new reviewed rollback lifecycle and a normal non-interactive revert. Do not
rewrite history or amend the migration commit. Verify authority, privacy, and
hydration again. Push remains separately unauthorized.

### 13.5 Privacy failure

If a candidate or staged diff exposes a secret, live ID, private endpoint, raw
target data, raw transcript, or prohibited archive:

1. Stop before commit.
2. Remove it from the migration candidate only.
3. Preserve the original in its ignored private source.
4. Re-run candidate and staged-diff scans.
5. Record an incident when policy requires.
6. Do not push or improvise history rewriting.

### 13.6 Canon mismatch

If any Canon file, byte size, manifest row, aggregate digest, version, or validator
result differs:

1. Stop adoption.
2. Classify the difference as corruption, local drift, or candidate upgrade.
3. Re-run validation and compare the Canon changelog.
4. Start a reviewed Canon-upgrade decision if semantic content changed.
5. Never silently regenerate and accept a new lock.

## 14. Fresh-Clone And Cold-Resume Acceptance

A fresh clone/workspace passes only when:

1. Root `AGENTS.md` exists and is durable.
2. `ops/PROJECT_OVERLAY.md` resolves FAL identity, authority, privacy, and
   exceptions.
3. `ops/PROJECT_STATE.md` resolves one FAL frontier and one exact next action.
4. Exactly one active Combined exists at the retained path.
5. Every active Epic has one Accountable Lane, lane class/profile, and lifecycle.
6. Active plan, findings, evidence, and direct handoff pointers resolve.
7. Track and role profiles resolve without loading full history.
8. Raw runtime/session data is not required for ordinary governance restore.
9. The Canon pack matches the lock, or startup returns
   `BLOCKED_CANON_RESTORE_REQUIRED` or `BLOCKED_CANON_PIN_MISMATCH`.
10. Missing private runtime state returns `BLOCKED_PRIVATE_RESTORE_REQUIRED` with
    one precise restoration instruction.
11. No fallback uses `extracted/`, an archive, FAL mirror, compact summary, or
    guessed latest output as authority.
12. Router absence or ambiguity stops routing and names the exact restoration or
    Owner action.
13. No live session ID, port, password, token, or endpoint is required to identify
    the FAL frontier.
14. Meta author, independent Meta reviewer, Delivery Track, Review/Gate,
    Router/Orchestrator, and Closeout packets pass the hydration sufficiency test.
15. A rollback rehearsal restores the complete pre-existing mutation-manifest path
    set and reproduces every per-path byte size and SHA-256.

## 15. Acceptance -> Verification -> Evidence Matrix

| ID | Acceptance requirement | Admissible verification | Required evidence | Failure route |
|---|---|---|---|---|
| AC-01 | One normative FAL authority order | Static semantic review | Authority map | Block W8-A |
| AC-02 | Exactly one active Combined at the retained path | Hot-pointer/reference scan | One-Combined report | Block cutover |
| AC-03 | Explicit Combined naming exception | Overlay review | `FAL-CANON-NAME-001` | Block adoption |
| AC-04 | Exact Canon snapshot identity | Recompute tracked-blob size/hash manifest from the pinned Git commit and run validator on that checkout | Commit-bound Canon lock plus validation output | `BLOCKED_CANON_PIN_MISMATCH` |
| AC-05 | Every legacy source has one disposition | Source-ledger completeness check | Source-to-target ledger | Block shortening/redirect |
| AC-06 | Every changed source has semantic preservation | Owner/pointer/consumer/rollback validation | Preservation map | Retain source and record debt |
| AC-07 | State is compact and current | Line/token proxy plus schema check | State report | Block activation |
| AC-08 | Active Combined uses Wave/Epic only | Schema/token scan | Combined report | Block activation |
| AC-09 | Every active Epic has one lane/lifecycle and explicit profile pointer for non-TRACK classes | Combined/plan/profile cross-check | Lifecycle/profile report | Block readiness |
| AC-10 | Governance author and reviewer are independent | Session/profile provenance review | Plan/step-review evidence | Repeat independent review |
| AC-11 | Findings and evidence retain identity and enforcement | Registry/index cross-check | Findings/evidence report | Block closeout |
| AC-12 | Live tools remain external and unmodified | 18/22 inventory plus config-status proof | Tool inventory | Route `/workflow-fix` |
| AC-13 | Durable/private split is exact | Newly-visible-path and ignore scan | Durability report | Block staging |
| AC-13A | Privacy scan covers every candidate/staged path | Coverage-manifest path-set comparison | `privacy-scan-coverage.json` with no skipped/unreadable path | `BLOCKED_PRIVACY_SCAN_INCOMPLETE` |
| AC-14 | Repository private visibility is proven | Owner-verifiable remote inspection | Visibility evidence | Block tracking private docs |
| AC-15 | Imports remain quarantined/non-authoritative | Archive manifest and safety scan | Import ledger | Quarantine |
| AC-16 | Router mechanical authority remains separate | Runbook/overlay/Canon conflict review | Router authority report | W8-E/W8-B correction |
| AC-17 | Target truth remains target-owned | Dual-root authority rehearsal | Target/FAL separation report | Block cross-target use |
| AC-18 | Fresh workspace restores governance fail-closed | Clean workspace rehearsal | Restoration report | `BLOCKED_PRIVATE_RESTORE_REQUIRED` |
| AC-19 | All role packets satisfy context contract | Six role rehearsals and measurements | Hydration report | Revise hot packet |
| AC-20 | Migration interruption never creates mixed authority | Injected/simulated interruption after each reviewed cutover write | Recovery report | Roll back |
| AC-20A | Old and new bootloaders honor the durable cutover sentinel | Fresh-actor pre-hydration test in every cutover state | Sentinel/recovery evidence | `CUTOVER_INTERRUPTED` or rollback |
| AC-20B | Independent candidate-bound review precedes every live authority write | Verify byte-frozen shadow digest, `/step-review` evidence, `/step-review-utan` `ACK_ONLY`, and first live-write timestamp/order | `REVIEWED_SHADOW` admission receipt plus cutover sentinel | Block cutover and invalidate drifted ACK |
| AC-21 | Initial application deletes nothing | Changed-path and filesystem operation audit | `DELETE = none` attestation | Reject candidate |
| AC-22 | Protected W8-E paths are unchanged | Hash and hunk-ledger comparison | Protected-scope report | Stop and replan |
| AC-23 | No target/global/restart/remote side effect occurred | Cross-root/config/process/Git inspection | Scope attestation | Incident and rollback |
| AC-24 | Rollback restores every pre-existing mutation-manifest path to exact baseline bytes | Full manifest-set dry-run rollback rehearsal with per-path size/hash equality | Complete restoration-set and hash-equivalence report | Block cutover or remain `ROLLBACK_REQUIRED` |

## 16. Required Verification Procedures

The future application must include:

```text
Canon scripts/validate-pack.ps1
commit-derived Canon tracked-blob size/hash manifest recomputation
FAL baseline manifest and protected-hunk recomputation
all intersecting dirty/staged hunk ownership, disposition, and attribution review
git status and exact changed-path review
git diff --check
UTF-8 strict decoding and mojibake scan
Markdown fence and relative-link validation
machine-specific absolute-path scan
secret, token, session-ID, endpoint, and raw-transcript scan
candidate-only privacy scan
staged-diff privacy scan
privacy-scan coverage manifest and fail-on-skip path-set comparison
legacy lifecycle token scan
one-plan-review/direct-fix/closeout-only-commit semantic scan
active command count = 18
active skill count = 22
exactly one active Combined path scan
one active PROJECT_STATE scan
one Accountable Lane per active Epic scan
import/archive traversal, reparse-point, device-name, ADS, and size scan
role-by-role cold-resume rehearsal
fresh-clone or fresh-workspace restoration rehearsal
cutover interruption rehearsal
pre-cutover REVIEWED_SHADOW/ACK ordering proof
complete mutation-manifest rollback rehearsal
post-cutover reviewed-generation byte-equivalence proof
zero-change proof for target repositories and global OpenCode configuration
```

No product test suite is required merely for governance-document relocation. Any
new validation script requires its own targeted tests and appropriate Track or
Workflow Maintainer ownership; Meta may not silently implement production/tooling
code under a governance documentation assignment.

## 17. Risk Register

| Risk | Severity | Control | Enforcing gate |
|---|---|---|---|
| Remote private visibility is unverified | HIGH | Verify before any private-canonical tracking | Stage 0 / Owner |
| Owner-selected private Canon Git repository is not provisioned yet | HIGH | Provision private remote, then pin immutable commit plus complete content manifest and test clone | Canon pin gate |
| Current roadmap/state are newer than HEAD | HIGH | Baseline hashes and raw-byte snapshot before shortening | Stage 0 |
| Existing Combined has many consumers | HIGH | Retain exact path; explicit naming exception; one-path scan | W8-B/cutover |
| `ops/AGENTS.md` contains unique FAL rules/history | HIGH | Section-level preservation and source archive | W8-B/W8-F |
| Legacy contexts contain retired workflow routes | HIGH | Archive and remove from hot hydration | W8-F |
| Broad unignore leaks sensitive/private material | CRITICAL | Exact allowlist; no force-add/broad staging; scans | W8-I |
| Imported archives restore stale authority or unsafe paths | HIGH | Separate manifests and quarantine; no extraction | W8-F/W8-I |
| Router runtime and router policy are conflated | HIGH | Mechanical runbook stays owner; project policy in overlay; behavior W8-E only | W8-B/W8-E |
| Dirty router sync work is normalized or committed | CRITICAL | Protected hash/hunk ledger and zero-touch gate | Every stage/W8-E |
| Meta author reviews own governance work | HIGH | Separate author/reviewer profiles and sessions | Plan/step review |
| Fresh clone lacks external Canon pack | HIGH | Exact restore instruction or fail closed | Hydration gate |
| Concise packet loses unique rules | HIGH | Preservation map and role rehearsals | Cold-resume review |
| Archive becomes a second authority | HIGH | Non-hot naming, archive headers/index, no active pointers | W8-F/cutover |
| Mixed old/new generation after interruption | CRITICAL | Migration state machine and interruption rehearsal | Cutover gate |
| Live authority changes before independent candidate acceptance | CRITICAL | Byte-frozen `REVIEWED_SHADOW` plus exact `ACK_ONLY` before cutover intent or first live write | Stage 7/AC-20B |
| Pre-existing dirty hunks are silently absorbed or misattributed | HIGH | Intersecting-hunk ledger with prior/proposed owner, disposition, attribution, and enforcing gate | Stage 0/W8-A |
| Compatibility pointers never retire | MEDIUM | Later telemetry-backed sunset Epic | Post-W8 debt |
| FAL migration edits target repositories | CRITICAL | FAL-only scope and zero-change proof | Scope gate |

## 18. Review Synthesis

Five independent read-only lanes reviewed the proposed plan direction:

| Lane | Focus | Result before correction |
|---|---|---|
| Architecture | Canon authority, ownership, lifecycle | `REJECT` because the durable Epic plan/profile/exception contract did not yet exist |
| Scope/repository | Current files, ignores, imports, consumers | `CONCERNS` about durability, legacy contexts, separate import provenance, and dirty scope |
| Correctness/recovery | Cutover, rollback, fresh clone | `REJECT` pending reproducible manifests, generation states, one-Combined exception, and rollback proof |
| Security/privacy | Tracking, archives, router/private data | `CONCERNS` about broad unignore, archive quarantine, Canon integrity, and staged-diff scanning |
| Critic | Decision completeness and minimality | `REJECTED` because `plans/epics/FAL-MIG-P.md` and its ledgers did not yet exist |

Common findings incorporated here:

- exactly one Combined remains at the existing path;
- the retained name is an explicit FAL Canon exception;
- a Meta governance author cannot review its own candidate;
- the complete Canon manifest includes file hashes, byte sizes, and aggregate digest;
- the Owner selected a separate private Canon Git repository, and application stays
  blocked until it is provisioned and pinned;
- migration generation states prevent mixed old/new authority;
- imports and extracted packages have separate quarantine/provenance records;
- the dirty router sync diff has point-in-time file/diff hashes and requires a
  refreshed hunk ledger before application;
- repository visibility proof precedes tracking private-canonical material;
- no broad unignore, force-add, or broad staging is permitted;
- state must separate FAL product frontier from target mirror/checkpoint state;
- initial deletion is explicitly none;
- fresh-clone and rollback must reproduce authority hashes.

One reviewer raised TriageCI FailurePacket/policy-schema concerns. Those are not
accepted into FAL-MIG-P scope because FAL migration cannot change or validate
TriageCI domain contracts. The general obligation is retained: FAL must never
upgrade target-domain verdicts, and any later TriageCI trial must use target-owned
semantic validation under the TriageCI workflow.

These advisory reviews did not replace the canonical independent `/terv-review` or
candidate-bound `/step-review` lifecycle.

### 18.1 Canonical `/terv-review` disposition

The independent Meta plan review identified six required corrections. Plan revision
`v1.2` applies all six:

1. Independent review and exact `ACK_ONLY` now freeze `REVIEWED_SHADOW` before any
   live authority write.
2. The interim Canon digest is corrected to
   `5b7a78af87d76d6446ba284583ea0de47f607bcca2354a498296c7729544dbef`,
   and the durable lock algorithm now derives only from the pinned commit's tracked
   blobs.
3. Rollback now restores every pre-existing path in the mutation manifest, not a
   named subset.
4. The current `GOVERNANCE` author has an explicit temporary role-profile pointer
   in this plan and the sole Combined row.
5. `FAL-CANON-MIG` is an explicit one-Epic transitional governance Wave with its own
   Gate and no implicit Wave 8 activation.
6. Application Stage 0 now requires refreshed baseline identities and disposition/
   attribution for every intersecting pre-existing dirty or staged hunk.

No review item was rejected or left unclear. This revision routes directly to the
planning-only `/implement` step and must not receive a second `/terv-review`.

## 19. Ownership And Future Gate Mapping

| Migration concern | Future owner/gate |
|---|---|
| W8 activation, baseline reconciliation, current dirty scope, FAL-CI/spec drift | W8-A / Meta governance |
| Canon adoption, overlay, authority, role/Track profiles, sole Combined schema | W8-B / Meta governance |
| Lifecycle tokens, status/phase/readiness compatibility | W8-C / Track B |
| Recovery state and rollback truth | W8-D / Track B |
| Router adapter and dirty sync source/test disposition | W8-E / Track D |
| Keep/adapt/retire/archive audit and burden reduction | W8-F / Track E |
| Python/environment command law and any validation tooling | W8-H / Track B or Workflow Maintainer as profiled |
| Durable/private split, evidence retention, fresh-workspace restore | W8-I / Track B with independent evidence/privacy review |
| Integrated adoption proof | W8-J / Meta governance |

W8-A may refine sequencing after this plan is accepted, but it must not collapse
independent ownership into one broad cleanup candidate.

## 20. Safe-Boundary Verdict

The corrected planning artifact is ready for its planning-only `/implement` step.
Migration application may not proceed yet.

Current exact blockers:

```text
the current governance baseline is partly dirty, ignored, and untracked;
remote private visibility is unverified;
the Owner-selected private Canon Git repository, remote, and immutable first commit
are not provisioned yet;
the Canon adoption lock and project role profiles do not yet exist;
and W8-A has not reconciled or sequenced migration application.
```

Required proof before application:

```text
accepted and closed FAL-MIG-P lifecycle
+ durable plan/evidence candidate identity
+ verified private repository visibility
+ current FAL baseline manifest
+ exact Canon content lock and restoration instruction
+ protected dirty-hunk ledger
+ W8-A sequencing/authority decision
+ separate reviewed application scope
```

Current safe-boundary terminal:

```text
FAL_MIG_PLAN_IMPLEMENT_READY_APPLICATION_BLOCKED_ON_SAFE_BOUNDARY
```

## 21. Canonical Route

The one canonical `/terv-review` has completed and this revision is its
`/terv-review-utan` response. The remaining `FAL-MIG-P` lifecycle is:

```text
governance author /implement only to materialize the accepted FAL-MIG-P planning artifact
-> independent /step-review of the planning candidate
-> /step-review-utan
-> /closeout-commit with explicit plan/evidence paths or no-commit
-> W8-A /seq-next
```

`/implement` in the `FAL-MIG-P` lifecycle does not authorize repository migration.
It may only update this plan, its evidence index, and the exact current planning
state/Combined pointers authorized by the reviewed plan.

## 22. Current Planning Completion Statement

This plan-revision pass:

- applied every blocking correction from the independent `/terv-review` and updates
  only the plan plus its exact operational state/Combined lifecycle pointers;
- did not apply migration changes;
- did not create a second Combined;
- modifies only the exact active Combined P0 row/transition-Wave framing required by
  the accepted review; unrelated Combined content remains untouched;
- did not change overlay, runbooks, source, tests, router, global tools, target
  repositories, Git staging, commits, remotes, or publication state;
- preserved the current dirty router sync work untouched;
- leaves Wave 8 `PLANNED / NOT_STARTED / NOT_READY`.

Next route: `/implement`

Readiness: `READY` for planning-only implementation; migration application remains
blocked on the named safe boundary.
