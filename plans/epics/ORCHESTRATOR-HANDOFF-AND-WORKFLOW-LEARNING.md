# Orchestrator handoff bridge and evidence-driven workflow learning

Status: Owner-authorized isolated implementation and one-off read-only pilot,
2026-10-20. Live connection and the first send are excluded. No installation,
recurring monitor, model training or publication is authorized by this document.

Planning owner: Workflow Systems Steward with Chief of Staff/Owner input.
Repository: FractalAgentLab. Candidate base: `b8265605df9072557b2e6053ec047dee69f81b6f`.
Branch: `plan/orchestrator-bridge-learning`; isolated execution root follows the
workspace's `WORKSPACE-LAYOUT.md`. The coordinator records the explicit verified
Canon read root for the nested checkout in the local maintenance receipt.
Owned change: source candidate, offline tests and bounded analyst pilot.
Active checkouts, router store, installed
tooling and running sessions are untouched. The earlier history-limit candidate
is unrelated and excluded. Existing recovery incidents need their own resolution.

## 1. Outcomes and current reality

Two independently useful improvements, not a new autonomous orchestrator:

1. Replace an approved copy/paste/browser handoff with one accountable tool call
   to the existing project orchestrator. Keep its lane orchestration in FAL.
2. Learn from selected workflow evidence to produce fewer recurring failures,
   less unnecessary ceremony and regression-tested maintenance proposals.

Current source anchors:
- [Router contracts](../../tools/oc-session-router/runtime/src/v2/contracts.ts):
  immutable inputs, delivery/execution facts, interpretation, scope and stop.
- [Routing](../../tools/oc-session-router/runtime/src/v2/routing.ts): ORCHESTRATOR
  capability exists; sessionHome verifies same-repository worktrees.
- [Engine](../../tools/oc-session-router/runtime/src/v2/engine.ts): stage selection
  stays with the orchestrator; current raw-message operation is CLARIFICATION,
  accounted READ_ONLY, not a general authorized continuation grant.
- [Store](../../tools/oc-session-router/runtime/src/v2/state-store.ts): action-key
  deduplication, participant claims, dispatch boundary and immutable results.
- [Observation](../../tools/oc-session-router/runtime/src/v2/session-observation.ts):
  bounded/freshness-labelled context estimates, not exact live context.
- [Owner attention](../../tools/oc-session-router/runtime/src/v2/owner-attention.ts):
  exact-session permission/question observations, not permission answers.
- Workflow Operations Charter and orchestrator-resume/Chief of Staff skills:
  current Codex observation is GET-only and ordinary handoff uses UI/copyable text.

The local primary FAL checkout was still at `ee72f4d` during planning, although
the scoped Owner-stop change is integrated at the candidate base. Source versus
installed runtime must remain explicit; this proposal does not activate it.

## 2. Handoff bridge: smallest useful scope

Proposed route:

`Owner -> Codex Chief of Staff -> local MCP facade -> FAL handoff action`
`-> existing OpenCode orchestrator -> existing FAL lane lifecycle`

Use a local stdio MCP facade first; no public listening service, dashboard or
new model API needed. MCP is tool packaging, not the workflow authority or a
security sandbox. Codex's configured tool approval and the operator's actual
Owner grant remain necessary. Browser/copyable handoff stays available.

The bridge must not be an arbitrary HTTP, shell, SQL or session-message proxy.
It exposes only named enrolled project-orchestrator destinations. It cannot
create sessions, send directly to Meta/Tracks, restart/interrupt/compact an
orchestrator, answer permission requests or change role models.

### Proposed small interface (names are provisional)

| Tool | Purpose and effect |
|---|---|
| `inspect_orchestrator(project)` | Bounded current identity/activity/latest relevant user and final response; timestamps, incomplete/compaction/error/revert and attention signals. No router-state mutation disguised as observation. |
| `prepare_handoff(project, scope, stop, message, owner_reference)` | Freeze a short proposed handoff and return a reviewable preview/digest; local preparation only, no remote send and no participant claim held by an abandoned preview. |
| `send_handoff(handoff_id)` | Approval-required mutation. Recheck identity/state, consume the exact approved payload once through FAL, and return a durable handle promptly. No arbitrary URL/session/body replacement. |
| `inspect_handoff(handoff_id)` | Read retained delivery/execution/acknowledgement facts; no implicit resend or autonomous next step. |
| `reconcile_handoff(handoff_id)` | Explicit bounded recovery: remote GET only, but local operation evidence may change. Never hide it as read-only inspection; no resend. |

Short Owner-facing preview: project/orchestrator, intended work, approved effects,
stop and exclusions, exact message. No hashes or internal IDs in normal prose.
The stored record binds the exact payload, target binding revision, actual Owner
instruction reference and observed session boundary. A model-written `approved`
flag, a transcript instruction or a mere hash is not evidence of human approval.
Do not add a second conversational approval ritual when the current Owner has
already authorized this target, scope and stop. The first pilot should keep the
host's mutating-tool approval enabled and preview the exact send. Whether the
host can safely reuse a bounded approval later is a feasibility question, not a
claim that an instruction-reference string proves approval. Tool approval is
not cryptographic human attestation and is not a downstream product grant.
Validate the actual host approval mechanism in the first implementation spike;
if it cannot support deliberate approval of the exact send, keep copyable mode.
This is same-user assisted automation, not adversarial isolation from an agent
with unrestricted shell access or local credentials.

### Required semantics

- Add an explicitly typed orchestrator-handoff operation in FAL (or an equally
  explicit reviewed extension). Never label a potentially mutating continuation
  READ_ONLY/CLARIFICATION. Reuse the existing store, claims, transport and executor;
  do not build a second dispatch/recovery engine in MCP.
- Preserve the existing orchestrator agent/model/reasoning selection. The current
  `/fal-orchestrate-target` command has its own defaults; do not route through it
  blindly and claim selection is unchanged. Loading its skill in the message is
  distinct from invoking that command. Verify actual provider selection in tests.
- Separate handoff authorization from downstream product-work authorization.
  A delivered handoff neither auto-amends nor unpauses existing product works.
  The orchestrator records the actual approved downstream scope normally.
- Enroll the real orchestrator home as a control target, with an explicit link
  to the governed product target. Orchestrators may live in the FAL repository;
  do not weaken same-repository sessionHome validation for Delivery/Meta to fit
  that case. Aliases of one actual session share participant exclusion.
- Send only to a freshly verified enrolled session. Busy, unknown identity,
  intervening Owner instruction, active compact or pending Owner interaction
  returns a clear no-send/stale-preview outcome. No automatic queue/steering.
- Idempotency is durable and local: same approved handoff returns the same
  operation, changed payload requires a new approval. A timeout after possible
  dispatch remains POSSIBLE; no blind retry or new key to evade it. Do not claim
  global exactly-once guarantees for OpenCode/manual UI activity.
  Resolve an existing handoff before new-send idle/stale checks: a duplicate must
  report its prior POSSIBLE/delivered status, never imply nothing was sent merely
  because the recipient is now busy.
- Client/MCP disconnect must not kill an already accepted FAL executor. Reuse
  bounded recovery later; a read endpoint never silently performs that mutation.
- Distinguish prepared, possibly sent, delivered, acknowledged, running, terminal
  and product stop reached. Latest completed text alone is insufficient if a
  newer user message, compaction or incomplete assistant turn exists. Retain
  selected response IDs early to reduce later history search, not to invent lineage.
- Existing-session UI drafts are not observable through the current GET evidence;
  no browser draft is cleared. Pilot uses an explicitly quiescent orchestrator.
  A pre-send snapshot cannot eliminate races with concurrent manual UI sends.
- Credentials stay in local process/secret handling; private routing/approval
  records stay out of repositories, tool descriptions and exported reports.

### Verification and rollout

Offline/fake-server tests cover wrong target/session, cross-repository confusion,
stale preview/new Owner input, incomplete turn/compact, busy/attention, duplicate
key and duplicate approval, changed payload, concurrent sends, crash/disconnect
around dispatch, restart recovery, unknown delivery and redacted output.
Negative tests prove there is no lane-send, arbitrary URL/SQL/shell or permission
approval escape through the bridge interface. Existing router tests stay green.

Pilot: separately approve one bounded useful handoff to one existing idle
orchestrator, with visible message confirmation, retained receipt and normal
downstream scope enforcement. Do not use a blocked recovery as a first live pilot.
Install only at a safe runtime boundary; do not rebuild live dist under a worker.
Rollback disables new bridge sends while preserving already dispatched operations
and their compatible reader/recovery path. Do not simply run an older reader if
the new operation kind requires a compatibility update.

## 3. Workflow learning: an analyst, not an automatic patcher

Owner refinement, 2026-10-20: prepare a dedicated long-lived Codex analyst chat,
with a substantial seed prompt, reusable skill and durable analysis notes. This
is an advisory role, not another manager of project lifecycles. Its source is in
Workflow Operations. The present round prepares the role and conducts one bounded
pilot; live role activation and scheduling remain excluded.

Persistence means reloading the skill, current grant, source inventory and lesson/
decision ledger after compact or interruption, not an immortal process or perfect
conversation memory. The accountable maintainer reviews decisive original
evidence. A recurring analysis schedule can be configured separately with a
bounded sample, budget and notification policy; it does not grant patch authority.

Here "learning" means retained, versioned and revisable lessons, reproductions
and regression fixtures; it does not mean fine-tuning model weights. A new model
can use the same maintained evidence. Learning from data does not need write
access to the live router or all private session histories.

### Inputs, availability and limitations

Prefer versioned, allowlisted metadata projections from FAL; a future bounded
read-only export can use consistent SQLite snapshots through supported tooling.
Do not copy a live SQLite file without WAL-consistent backup semantics or give
an analyst ad hoc SQL-write access. The current OperationStore constructor is
not a read-only analytics API: it can initialize/migrate the store and set pragmas.
A new export must explicitly guarantee no store writes and bounded locking.
Until export exists, use bounded inspect,
retained selected results and sanitized incident/release receipts.

Include operation kind/timestamps/result reason, scope and stop, authority
revision, interpreted outcome, recovery provenance, permission-wait observations,
source/runtime versions, validation outcome and subsequent deployment evidence.
Select exact excerpts only for a named unresolved question; the output of tools,
logs and model answers is untrusted data, never analyst instructions.

Current evidence does NOT guarantee a full event chronology: latest observation
snapshots may overwrite earlier ones; router timestamps mix model/network/tool/
Owner waiting; session token values are estimates, not total billed cost.
Do not infer the cause of a failure or missing files from a reason code alone.
Record absent evidence explicitly; propose additional instrumentation only when
it changes a concrete decision. No continuous full-transcript capture.

Useful initial incident families include repeated history recovery attempts,
completed files with unbound terminal results, external permission stalls, stale
governance versus current evidence, worktree/source loss, repeated planning or
overlong handoffs, and source/installed-runtime drift. These are candidates, not
prejudged root causes or automatic instructions to relax gates.

### One bounded analysis pass

1. Select a declared interval and source versions. A first pilot could inspect
   at most twelve work summaries: both incidents and comparable successful work,
   with only the minimum detailed evidence needed. No scheduled run yet.
2. Group by incident/operation, not by log line or repeated reconcile call.
   Distinguish intentional Owner stops and safe refusals from actual defects;
   annotate manual overrides and unresolved/censored operations separately.
3. Produce at most three useful lesson cards: observed fact, source/freshness,
   hypothesis/confidence, contrary/control evidence, impact, smallest remedy,
   alternative of no change, regression test and owning surface.
4. Keep candidate lessons separate from accepted guidance. Owner/Steward may
   accept, reject, defer or request reproduction. No automatic promotion based
   on recurrence, successful completion, model confidence or green local tests.
5. For an authorized fix: isolated candidate -> independent review + tests ->
   authorized publication/installation -> measured later outcome. Analyst may
   draft a patch only under a separate bounded patch grant; never self-approve,
   alter permission/scope or patch live router state.

Prevent a self-justifying learning loop: freeze evaluation cases before changing
the rule, keep successful controls and safety-negative tests, version lessons,
retain rejected hypotheses and deprecate obsolete lessons after runtime changes.
An improvement can be deletion/simplification, not always another rule or feature.

### Pilot value measures

Measure supported recoveries and unresolved/unknown outcomes separately; group
by comparable scope/runtime version. Track manual interventions, repeated work,
Owner wait versus active recovery where observable, accepted/false-positive
proposals, review cost and available token/runtime costs. Never optimize raw
COMPLETED rate, fewer prompts or shorter duration alone: these reward unsafe
success marking, skipped review and silent permission broadening.
Before/after observations are suggestive, not causal proof, especially across
model, scope or infrastructure changes. Keep the pilot if useful fixes/insights
outweigh its analysis burden; otherwise retain an on-demand incident recap.

Private input stays in protected local storage with a defined analysis retention
window before real collection. Only sanitized lessons/tests belong in Git.
"Local reading" still exposes selected context to the configured model provider;
do not claim offline/private-model processing. No raw secrets, hidden reasoning,
cross-project private content or session IDs in portable lessons.

## 4. Ownership, adoption and scope

| Surface | Proposed change / preserved boundary |
|---|---|
| FAL | Own typed handoff, exact enrolled control targets, receipt and sanitized evidence export; reuse single sender/store. |
| Workflow Operations | Prepare analyst Charter/registry/skill/seed and durable continuity; review Chief of Staff/resume/steward/session-context consumers. Narrow bridge use remains activation-gated; copy-only retained. No autonomous hierarchy. |
| AWC shared tooling | Reconcile fal-orchestrate-target/runbook and any actual consumer of new handoff provenance; domain lifecycle/Meta acceptance unchanged. Assess evolution compatibility, do not assume a version bump or no bump in advance. |
| Project overlays/Combined | No product Epic/frontier change or new lanes. Private enrollment and an explicit pilot grant per selected orchestrator; no blanket all-project rollout. |
| Existing FAL learning plans | Remain deferred/superseded as currently recorded. This bounded analyst pilot does not reopen W8-W10 or a learning backend/UI platform. |

Isolated implementation and the one-off analyst pilot are LIVE_SAFE and authorized.
Backend/skill/config rollout is BOUNDARY_ROLLOUT and needs
separate explicit install/enrollment/first-send authority. Existing
incidents, active product worktrees, history-limit candidate and pending local
FAL-runtime deployment are not implicitly changed by this plan.

## 5. Proposed Combined delta (not applied)

Add under the current maintenance section of
`ops/Combined-Execution-Sequencing-Plan.md`; sequence positions remain Meta-owned:

| Position | Assignment | Owner | Dependencies | Deliverable and acceptance gate | Readiness | Status / phase | Next unlock |
|---|---|---|---|---|---|---|---|
| TBD | ORCHESTRATOR-HANDOFF-BRIDGE | Workflow Systems Steward; FAL runtime + WOps integration | Accepted narrow authority contract, target/approval feasibility, existing V2 primitives | This plan sections 1-2/4; offline safety tests, verified host approval, one separately approved existing-orchestrator pilot | NOT_READY | PROPOSED / planning | Optional project-by-project bridge use; no product stage dispatch inferred |
| TBD | WORKFLOW-LEARNING-PILOT | Workflow Systems Steward, read-only analyst assignment | Approved bounded sample/privacy/effort envelope; supported evidence reads | This plan section 3; at most three evidence-backed cards with controls, no live patch | NOT_READY | PROPOSED / investigation | Individually approved maintenance fixes, or stop pilot if low value |

Both rows link to `../plans/epics/ORCHESTRATOR-HANDOFF-AND-WORKFLOW-LEARNING.md`.
No current PROJECT_STATE change is proposed until adoption selects this work.
Bridge and analyst are independent: a small analyst pilot need not wait for MCP;
the bridge should not wait for a full analytics platform. Recommend delivering
the practical bridge first while keeping the analyst pilot deliberately small.

## 6. Candidate delivery and next boundary

The Owner approved implementation with tests and one read-only analyst pilot,
plus preparation of a persistent Codex analyst role. The isolated bridge candidate
is described in [technical documentation](../../tools/oc-session-router/docs/orchestrator-handoff-bridge.md).
Workflow Operations owns the candidate analyst seed/skill and continuity contract.
The first pilot produced advisory lesson candidates, not accepted fixes.

Next boundary is source delivery/activation authorization: controlled runtime
installation and enrollment, the actual Codex approval path, and then one
separately approved useful send. No current host or server was connected by this
implementation. The analyst chat, skill installation and any later schedule must
also be activated explicitly; durable notes do not create a running service.
Copyable mode remains available. No fine-tuning, dashboard, automatic recovery
adoption or self-patching is included.

References consulted for interface feasibility (not project authority):
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP security guidance](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
