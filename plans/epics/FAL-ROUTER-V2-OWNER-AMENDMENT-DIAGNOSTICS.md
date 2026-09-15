# Router V2: Owner amendment and preparation diagnostics candidate

Date: 2026-09-15. Status: reviewable, offline-validated local candidate.
Publication envelope: local feature commits only. Integration, push, shared
installation, live store amendment and lifecycle dispatch remain coordinator-owned
next steps, outside this candidate execution. No product acceptance is implied.

## Candidate identity and scope

| Source | Baseline | Candidate |
|---|---|---|
| FAL | `5371ab5d79494356aa5e82434ef7113472302b15` | `5c952597ae27238853cc3c4c911182ba66721994` |
| AWC | `712dddbc8550b4850808ebd34195b07cf8724976` | `886a298e608f0bfeda4dee20a3ababbcea41a4f6` |

Branches: `codex/router-owner-amendment-diagnostics` and
`codex/router-owner-amendment-consumer`. The latter changes only the versioned
`tooling/opencode/skills/fal-orchestrate-target/SKILL.md` consumer. Both candidates
were built in isolated worktrees against the coordinator-designated Canon baseline.
The follow-up evidence commit adds this handoff without changing runtime bytes.

The two accepted fixes are a later bounded Owner grant on an existing work and
usable, sanitized preparation errors. No new approval service, router, lifecycle,
P0B exercise, live simulation or general workflow reform was added. Protected
Python router sync source/tests and unrelated project work were not changed.

## Proven behavior

`amend-work` appends an actual later Owner instruction, constraints, additional
effects and optional stopping point. It uses the existing local store pattern;
as with `open-work` and `record-pause`, a field does not authenticate or manufacture
Owner approval. The caller must possess the actual bounded instruction.

The original WorkContext, target, directory and scope stay immutable. Amendment
keys are idempotent; expected authorization revisions detect concurrent changes.
Pending operations in that work block a new amendment. A pause remains a pause.
Old actions, input digests, results, interpretations and claims are preserved;
replaying an old action key retrieves that operation under its original authority.
New preparations pin the effective revision inside the creation transaction and
carry the Owner constraints/current stop in lifecycle and restore packets.
Role and command restrictions still apply: a LOCAL_COMMIT grant does not permit
Delivery to run Meta closeout, or permit push/deployment.

The store stays schema 1 until a successful explicit amendment. That transaction
adds the history table, operation revision column and schema 2 marker atomically.
Older runtimes reject schema 2 on startup. A database INSERT guard also rejects an
already-open older writer creating a normal operation without the current grant
revision in an amended work. Unamended work and historical operations are retained.

Failed submit/restore/compact calls report a closed phase/category/code and
separate operation-created, operation-exists, dispatch and delivery facts. Native
messages, stacks, inputs, credentials and private absolute paths are not echoed.
Failed fact reads retain already-proven delivery or report UNKNOWN/null; a failure
after persistence is not automatically classified as no-operation/no-send.
Malformed source objects/selectors are rejected with explicit source-input codes.

The original WorldSim restore incident was not reproduced. The coordinator later
reported successful restore and response completion using the unchanged request
and runtime. This candidate is preventive diagnostics and permission support;
it neither proves the earlier root cause nor claims a live send-path repair.

## Validation and review

| Check | Result |
|---|---|
| Runtime `npm test`, including clean TypeScript build | 183/183 PASS, no skipped tests |
| `scripts/test-v2-launcher.ps1` | 11 groups PASS; zero real-server calls/global changes |
| AWC `scripts/validate-pack.ps1 -RunAllHydrationTests` | PASS; 16 commands, 21 skills, 18 agents; 11 hydration suites |
| AWC PowerShell 7 parity | Unavailable on this host; Windows PowerShell checks passed |
| Scoped source/diff review | No remaining material finding; whitespace checks passed |

Tests cover denied initial commit, explicit grant, stopping-point-only change,
immutable history/pause, invalid/extra fields, exact replay after later grants,
pending prepared/possible/delivered states, concurrent preparation versus amendment,
clients opened before migration, old SQL writer fencing, Meta-only closeout and
restore constraints. Diagnostic tests cover malformed sources/requests, failure
before/after transaction commit, existing POSSIBLE/DELIVERED operations, unavailable
store reads, bounded adapter errors and secret/path/stack exclusion.

The full runtime suite uses disposable local stores, synthetic adapters and
loopback fixture servers. These checks do not establish live installation or
loaded behavior. Independent review found the already-open old-writer race;
the INSERT guard and its negative test close that finding.

## Consumer closure

| Family | Disposition and evidence |
|---|---|
| Canon laws, roles and hot runbooks | NOT_AFFECTED: current Owner authority and retained lifecycle law are unchanged; no Canon version change |
| Shared commands/skills | IMPACTED: AWC fal-orchestrate-target source now routes later grants to the exact FAL reference; inventory unchanged |
| Hydration/cold start | FAL restore packet IMPACTED and tested; after-compact/context-restore/wave-start/context-onboarding methods and role pointers NOT_AFFECTED; 11 hydration suites passed |
| Outputs and routing | IMPACTED: CLI phase/fact output and per-operation authorization revision; sole transport, recipient binding, recovery identity unchanged |
| Machine contracts/catalogs | IMPACTED: explicit amendment request and first-use store schema 2; config schema/catalog/managed manifest unchanged |
| Validators/runtime tests | IMPACTED: focused source and CLI/store tests plus full suite; existing AWC validation passed without validator changes |
| Templates/target projects | NOT_AFFECTED: no template, target state/Combined, acceptance or live work mutation; existing pauses preserved |
| FAL/Workflow Operations | FAL facade/reference/runtime IMPACTED; WOps skills NOT_AFFECTED because session identity, observation, compact authority and transport ownership did not change |

## Coordinated activation and rollback

1. **LIVE_SAFE now:** review these commits, reproduce offline checks and prepare
   source integration/managed installation plans. WorldSim, RingFall and TriageCI
   continue under their own authority. No rollout hold is created by this task.
2. **BOUNDARY_ROLLOUT:** the parent coordinates integration and router/facade build
   activation at a stable client boundary. Never clean/rebuild an actively consumed
   runtime tree while retaining executors depend on it. Let existing work finish
   normally; preserve operation IDs and reconcile uncertain sends. Do not interrupt
   sessions or introduce a global pause for unrelated consumers.
3. Install the affected AWC skill through the existing managed tooling installer
   with drift checks and receipts. Verify source, installed bytes and loaded skill
   context separately. Reload only if required at the agreed boundary; no new P0B.
4. **First live amendment:** all clients of that shared store must use the compatible
   runtime, and the target work must have no pending operation. Keep a coherent
   supported/closed SQLite backup, never a lone active main-db copy. Read current
   authorization revision, record only the already-granted bounded Owner extension,
   then inspect the preserved history, pause and new revision. The amendment sends
   nothing. The orchestrator separately chooses the next authorized lifecycle step.
5. Before any amendment, ordinary schema 1 source rollback remains possible while
   preserving sends. After schema 2 activation, use compatible forward recovery;
   never downgrade schema, remove amendment history, clear claims or restore an old
   snapshot to erase later operations. Old runtime startup refusal is intentional.

No step above was executed against the shared installation or live work in this
task. The candidate is rollout-ready for parent review and boundary coordination;
it is not installed, activated, pushed or accepted as a product lifecycle result.
