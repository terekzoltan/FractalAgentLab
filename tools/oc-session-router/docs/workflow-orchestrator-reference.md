# Workflow Orchestrator Cold Reference

Status: `COLD REFERENCE / EXPLICIT-STAGE RUNTIME OVERRIDES LEGACY SEND PATHS`

All serial, parallel, packet, latest-output routing, message, question,
review-fix, polling, and resume examples in this document are historical unless
they explicitly call `scripts/Invoke-OCRouter.ps1`. Historical run artifacts are
readable and non-resumable.

## Status and purpose

This is the selective cold reference for FAL's current AWC router adapter. The hot
entry point is `workflow-orchestrator-runbook.md`. Open only the section needed
for the current transport, resume, classifier, review-envelope, or recovery
decision.

Project files own project truth. Commands own stage prompts. Meta owns review
routing, finding synthesis, and acceptance decisions. The Accountable Delivery
Lane owns planning and implementation. FAL transports and pins artifacts and may
retain private evidence; it does not gain target authority.

The active step-review transport is native OpenCode Task fan-out inside the Meta
`/step-review` stage. The former external Swarm Assistant transport is retired.
Historical `.swarm`, prompt, `GO`, result, and session material is readable only
as cold provenance and is never replayed.

## Selective navigation

| Need | Read |
|---|---|
| Minimal operating law | hot runbook only |
| Native review selection or receipt | Native review adapter; Native receipt and final synthesis |
| Wrapper arguments or saved state | Serial and parallel wrapper contracts |
| Resume after interruption | Resume and legacy-frontier recovery |
| Output rejected by classifier | Stage-aware output selection |
| Delivery ambiguity or abnormal state | Durable transport; Questions and incidents |
| Compact or checkpoint interaction | Separation from compact, checkpoint, and closeout |
| Production modes, protected layout, or receipts | Production router runtime |

## Production router runtime

Release `0.2.0` uses the independent protocol identity
`fal-explicit-stage-router/v1`. AWC is a compatibility contract, not the router
protocol: active P0B and production receipts must include AWC `4.1.1`; `awc-3.1`
is accepted only by legacy fixture/input paths.

The sole v2 control registry is
`%LOCALAPPDATA%\FractalAgentLab\oc-router\control\control-registry.json`; retention
and capability grants live beside it under `control`, private state lives under
`runtime`, and sanitized operator/proof receipts live under `receipts`. Bootstrap
and verify are owner-only through `Initialize-OCRouterControlPlane.ps1`; neither
the request nor an environment variable can choose a capability receipt. The
launcher accepts the registry environment variable only as a process-scoped
pointer and rejects active v2 unless it equals the fixed path and owner ACL
verification succeeds.

The runtime independently queries the Windows KnownFolder through the pinned OS
broker; caller environment values are expectations only. The registry and grant
bind `p0b_isolation_root_sha256`. In P0B mode the exact target and server directory
must be a reparse-free descendant of that separately owner-protected root before
capability probing or POST.

`router-control-registry.v2` has exactly three modes. `DISABLED` is the default
and performs no capability probe or POST. `P0B_ISOLATED` is synthetic-only and
uses a short-lived pre-send `P0B_ONE_USE` grant with proof hash zero. Claim state
is durable before dispatch intent; consumption occurs while the shared participant
fence is held, after immediate drift revalidation and before POST. Any attempted
POST outcome consumes the grant. The post-send P0B proof is a separate sanitized
receipt, so proof is not circular authorization. `PRODUCTION_RESPONSE_FIRST`
requires a `PRODUCTION_INSTALL` receipt bound to a nonzero accepted P0B proof.
The proof is transport evidence, not an exact process or patch-version lease.
An ordinary restart of the same server reuses production authority after full
read-only stable-capability measurement; the new process identity is then pinned
only for the current dispatch. A strictly newer patch on the same OpenCode
`major.minor` line may reuse the proof after a fresh install receipt.
Exact-version binary drift, downgrade, minor/major change, prerelease or
nonstandard versions, router-attestation change, and stable live measurement
drift all remain fail-closed new-proof boundaries.

The installed capability probe binds health/version, OpenAPI, the complete
directory-scoped command definitions in canonical name order, binary/origin,
target and worktree hashes, and authorized session/command hashes. Process
identity is a per-dispatch race fence rather than durable production admission.
SSE support is probed and hashed but never enabled. `/command` response text is authoritative first;
inert lifecycle/reasoning parts are closed-schema checked and hash-audited, while
active tool or unknown part types fail closed. Completed historical `tool` and
`patch` parts from a mature participant session are identity-checked and reduced
to content hashes only; they are never interpreted as terminal output. GET
snapshot data is private diagnostic
evidence unless assistant message ID, parent, session, baseline, and terminal hash
correlate exactly. Snapshot failure never causes a resend.

The shared target-local fence is
`.opencode-router/.participant-transport.<sha256("fal-router-private-session-fence/v1\n" + exact-private-session-id)>.lock`.
The raw session ID is never emitted in normal output. Compact and lifecycle resolve
it from protected authority and use the same persistent file with `FileShare.None`; a
broker handle is rechecked immediately before POST and released on completion or
parent-process loss. Compact raw authority uses an owner-only ephemeral handoff,
is deleted after Lite reads it, and expires after 15 minutes after a crash. AC87
retains quarantine for 7 days, diagnostics for 30,
validated evidence for 180, never persists raw reasoning/SSE payloads, denies
public export, and emits purge counts and hashes only.

For operator preparation, `Prepare-OCRouterStage.ps1` accepts only explicit
target/state/source paths and a closed source list, verifies the current state
hash, and emits candidate `stage-sources` plus state-packet files without network
access. It does not adopt them or invoke a stage. `Invoke-OCRouter.ps1` remains the
separate explicit sender. The old `init-router-runtime.ps1` stays retired.

## Authority and safety invariants

- Resolve target root/worktree, Wave/Epic, candidate, Accountable Lane, stage,
  session map, and exact input artifact before every dispatch.
- A session label, model, subagent, transport, or topology never grants authority.
- Persist a candidate-bound pre-send intent before dispatch and its receipt after
  dispatch. Ambiguous delivery is never permission to resend.
- Progress output, latest-message memory, router state, compact summary, and FAL
  evidence are not target-stage authority.
- No wrapper performs commit, push, PR, merge, deploy, publication, restart,
  process kill, credential guessing, or speculative mutation.
- One lifecycle command is one stage. Do not combine transitions in a custom
  message.

## Active lifecycle

```text
Delivery /seq-next
-> Meta /terv-review
-> Delivery /terv-review-utan
-> Delivery /implement
-> Meta /step-review
-> Delivery /step-review-utan
-> fix-plan loop or ACK_ONLY
-> Meta /closeout-commit
```

Plan review is one direct Meta pass and never launches review fan-out. Step review
is the only independent acceptance-review stage. Every final color goes through
`/step-review-utan`; only exact `ACK_ONLY` is closeout-eligible.

## Native review adapter

### Responsibility boundary

The Orchestrator supplies an envelope; it does not select concrete reviewer
agents. The envelope binds:

- Target, Epic, Accountable Lane/class/profile, and frozen candidate;
- immutable implementation and acceptance/evidence pointers;
- `INITIAL` for the unchanged ordinary candidate review, with no repaired
  finding IDs; or `FIX_RECHECK` for a later reviewed repair-plan cycle;
- for `FIX_RECHECK`, the exact repaired finding IDs, immutable repair delta, and
  minimal regression boundary in both protected evidence and the verified
  command envelope;
- actual risk and optional review focus;
- budget policy and total assignment cap;
- requested domains when the Owner or project contract constrains them;
- exact Owner expansion/budget receipt when required;
- no-mutation and no-commit policy.

For `FIX_RECHECK`, recompute risk and use the smallest sufficient remaining
coverage. A prior wide review does not force the same width after a narrow fix,
and adjacent discoveries do not expand the current candidate authority.

Meta then performs both router and chair functions:

```text
pin envelope
-> consider core and triggered domains
-> select smallest sufficient domain bundles
-> choose verified generic reviewer profiles
-> native read-only Task assignments
-> inspect receipts
-> optional bounded challenge wave within the same cap
-> FINAL STEP REVIEW SYNTHESIS
```

Do not call a plugin lane launcher, pre-register generic reviewer names as plugin
roles, depend on a `swarm-assistant` session, send `GO`, or forward an external
review result.

### Budget and shape

| Shape | Total assignments | Typical policy |
|---|---:|---|
| `META_ONLY` | 0 | `conserve` |
| `FOCUSED` | 1-2 | `conserve` or `balanced` |
| `STANDARD` | 2-3 | `balanced` |
| `DEEP` | 4-5 | `quality_first` |
| `WIDE` | 6-7 | `exact` or explicit bounded policy |
| `EXPANDED_AUDIT` | 8-10 | `exact + expanded_audit`, exact Owner envelope |

Retries and replacements count toward the same total. More than ten is invalid;
split the candidate into bounded system slices. A larger review should combine
one or two strong anchors with narrower satellites, not uniformly downgrade every
reviewer. A challenge wave follows evidence from the first wave; it is not an
automatic extra pass.

The FAL wrapper still accepts `quick`, `focused`, `standard`, `high_risk`, `deep`,
`audit`, `wide`, and `custom` as compatibility shape aliases. They normalize into
budget/cap/domain hints only. `high_risk` does not mean four fixed reviewers and
does not imply external transport.

### Domains and profiles

Meta considers every core domain but dispatches only the smallest sufficient set.
Core domains are `intent-correctness`, `tests-evidence`, `scope-ownership`,
`security-safety`, `architecture-boundaries`, `regression-edge-cases`,
`domain-invariants`, and `maintainability-complexity`. Triggered domains come
from the Canon `NATIVE-REVIEW-ORCHESTRATION.md` catalog.

One assignment has one primary and at most two compatible secondary domains. New
dispatches use domain-plus-generic-profile packets. The live global registry owns
the actual 11-profile roster across Luna, Terra, and Sol; the Canon snapshot is a
read-only mirror. `review-sol-pro` and semantic reviewer identities are not valid
new dispatch targets.

Unavailable profiles never silently fall back. Meta records one named compatible
fallback and its residual risk, or returns `BLOCKED` when the safety floor cannot
be met. Nested reviewer subagents are forbidden by the reviewer profile.

Deterministic lint, format, build, typecheck, tests, coverage, schema checks,
scanners, and static analysis remain gates. A reviewer assesses the relevance and
quality of that evidence but does not replace it.

## Native receipt and final synthesis

Each native assignment result must bind:

```text
NATIVE REVIEW ASSIGNMENT RESULT
Assignment ID
Primary domain
Secondary domains
Review question / candidate
Execution profile (agent/model/effort)
Effective status
Findings
Evidence pointers
Limitations / false-positive risk
Fallback or deviation
Commit status: DEFERRED_TO_CLOSEOUT
```

Meta keeps these receipts inside the `/step-review` evidence set and accounts for
every surfaced finding in the final synthesis. The router's authoritative terminal
is the exact 16-line `FINAL STEP REVIEW SYNTHESIS` defined by the Canon output
contract. Its routing line is:

```text
Review routing: budget_policy=<policy>; shape=<shape>; assignments=<ids/profiles|NONE>; omitted_domains=<domains-and-reasons|NONE>; escalation=<NONE|recorded>; limitations=<text-or-none>
```

`META_ONLY` requires `assignments=NONE`. `EXPANDED_AUDIT` requires
`budget_policy=exact + expanded_audit`. Active output must not name Swarm or
`review-sol-pro`. Reviewer verdicts are advisory; only Meta emits the final
`GREEN|YELLOW|RED` synthesis.

## Serial step-review wrapper

`run-step-review-flow.ps1`:

1. resolves target, Delivery, Meta, candidate, and exact implementation pin;
2. recomputes the review envelope from the frozen candidate;
3. persists `review_transport=native`, budget policy, assignment cap, requested
   domains, compatibility shape alias, registry pin, and Owner receipt pin;
4. invokes one Meta `/step-review` command with `REQUIRED NATIVE REVIEW BINDINGS`;
5. waits for the strict final synthesis;
6. pins it and routes it once to Delivery `/step-review-utan`;
7. optionally writes a proposal-only FAL checkpoint artifact.

`UseSwarmReview`, `ForceFullReview`, and a non-`none` Swarm depth fail closed.
`SkipSwarmReview` is accepted only as a harmless historical compatibility input;
the active transport is native regardless.

## Parallel step-review wrapper

`run-parallel-step-review-flow.ps1` aggregates exact per-lane implementation pins
into one Meta request only when the lanes are independently identifiable and the
combined envelope is authorized. It does not require or resolve a Swarm session.

The wrapper persists per-lane candidate identity and one aggregate native review
envelope, waits for a strict parallel final-synthesis envelope, and fans out the
exact lane-specific bodies through `/step-review-utan`. Each lane keeps its own
disposition, findings, response, delivery receipt, and optional proposal-only FAL
checkpoint identity.

Parallelism does not merge authority. Shared dependencies must be explicit, and
one lane's acceptance cannot close another lane's finding. If a combined packet
would make domain, candidate, or ownership attribution ambiguous, use separate
serial reviews.

## Stage-aware output selection

Typed waits use message identity/recency plus a strict stage classifier. Text
length is not terminal proof. A newer unclassified message may be recorded for
diagnosis but is never persisted as stage authority or routed.

Current strict step-review terminal expectations:

- serial: one exact `FINAL STEP REVIEW SYNTHESIS`;
- parallel: one exact track-response envelope whose bodies are exact final
  syntheses and whose lane/candidate bindings match;
- Delivery response: exact `ACK_ONLY`, `FIX_PLAN_REQUIRED`, or `UNCLEAR` contract.

If a fresh AWC output is rejected, compare the exact live command contract and the
classifier. In particular, the current AWC uses `Review routing:`, not the retired
`Review profile/topology:` line. A canonical output/classifier mismatch freezes
routing and opens `/workflow-fix`; never hand-edit the output to bypass the gate.

## Runtime artifacts

New native step-review runs normally retain:

- exact implementation artifact pin or parallel manifest;
- Meta step-review request with native envelope;
- final synthesis and producer/candidate pin;
- `/step-review-utan` dispatch intent and Delivery response;
- artifact-delivery receipt;
- optional proposal-only FAL checkpoint package;
- state with review transport, budget, cap, requested domains, resolved alias,
  registry/approval pins, completed steps, and ambiguity status.

No new run creates `03-swarm-prompt.md`, `04-swarm-review.md`, a Swarm dispatch
intent, or a `sent_go_to_meta` transition. Those names may exist only in old run
directories and are not active resume points.

## Durable transport and duplicate prevention

- Hold one exclusive run lock.
- Pin the exact input bytes and candidate before send.
- Persist atomic pre-send intent, then the returned transport/message identity.
- Bound POST and wait durations.
- On timeout or interruption, reconcile transcript and intent read-only.
- Treat installed history as chronological: capture the latest pre-send message
  as baseline and inspect only later messages. Without a synchronous receipt,
  accept only one exact installed-template-plus-argument command root and one
  strict terminal assistant child after full current-authority validation.
- Resend only when absence is proven. Ambiguity remains pending/uncertain.
- On resume, revalidate target, candidate, hashes, registry/approval pins, stage,
  output class, and completed steps.
- A newer progress message does not invalidate an older strict post-baseline
  terminal, but it cannot become the selected artifact.

## Resume and legacy-frontier recovery

| Proven frontier | Safe action |
|---|---|
| Native assignment receipt exists but wrapper missed it | pin the receipt or let Meta re-establish it under the same total cap; never emulate a reviewer |
| Final synthesis missing | resume/wait on the same Meta command stage |
| Final synthesis exists; Delivery route-back absent | invoke `/step-review-utan` once with the exact synthesis |
| Delivery ambiguous | reconcile transcript and dispatch intent; do not resend |
| Old Swarm prompt, `GO`, partial result, or assistant session is frontier | never replay; start one fresh candidate-bound native `/step-review`, or `BLOCKED` if the candidate cannot be re-established |
| Saved run requests active Swarm transport | fail closed; retain it as historical evidence and start a new native run ID |
| Registry/profile availability cannot satisfy safety floor | one recorded compatible fallback or `BLOCKED` |

Resume never converts historical Swarm state into native assignment receipts.
The Owner's instruction that an existing RingFall Meta session remains in use does
not authorize replaying its old Swarm frontier; it may receive a fresh native
`/step-review` command against the same frozen candidate if session identity,
registry, and duplicate state are proven.

## Questions and incidents

Delivery, reviewer, evidence, and specialist roles return one structured blocker
to Meta/Orchestrator. Deduplicate related blockers and ask at most one consolidated
Owner question when project authority cannot decide.

On identity, auth, transport, duplicate-send, classifier, registry, or receipt
anomaly: freeze sends and mutation; perform bounded read-only diagnosis; allow at
most one proven-idempotent retry. Do not try arbitrary console variants, restart
or kill Owner-managed processes, guess credentials, rewrite state, or continue
merely to avoid stopping.

## Separation from compact, checkpoint, and closeout

Compact Lite is the sole active compact mechanism and always ends with
`workflow_command_sent: false`. Its non-dry authority comes only from the fixed
owner-protected registry/capability and measured server instance; caller server,
environment overrides, aliases, and target-local session maps cannot select a
production transport. Compact V2, Active Route, and `ROUTE_READY` are
retained reference semantics only. Review dispatch is a separate explicit
transaction that rereads target authority and duplicate state.
The Compact authority CLI projection is status/digest-only; target root, origin,
and private session are never written to stdout.

Transport wrappers do not write FAL directly. They may create proposal/receipt
artifacts; only a separate authorized `/fal-checkpoint-target` command may apply a
checkpoint. Target acceptance, target closeout, and FAL evidence closeout remain
separate.

After exact `ACK_ONLY`, `/closeout-commit` may apply only synthesis-enumerated
governance/closeout deltas and commit without push. Behavior-changing source,
tests, configuration, runbooks, commands, skills, and policy must already belong
to the frozen reviewed candidate.

## Configuration and tests

Target-local router settings may point to a private review-control registry, but
must not store credentials, raw session IDs in durable governance, customer data,
or workstation-specific roots in shared files. A registry can constrain domains
and envelope mappings; it cannot invent Canon authority or silently widen review.

Run the offline contract suite after changing review controls, classifiers,
serial/parallel step-review flow, resume behavior, or output contracts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/test-review-routing.ps1
```

The suite uses local fixtures/mocked transport and does not dispatch a live
OpenCode command. Live session pilots, restart, global apply, and remote effects
remain separately Owner-gated.

## Historical provenance

The pre-AWC-3 native migration reference remains recoverable from Git history for
incident archaeology. It is not copied into the hot documentation because doing
so would rehydrate retired `GO`/Swarm mechanics into ordinary sessions. When old
state must be interpreted, inspect only the exact historical section needed and
apply the recovery table above; never treat historical mechanics as current law.
