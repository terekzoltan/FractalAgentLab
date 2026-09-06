# Revised Epic Implementation Plan

Plan identity: `FAL-V2-QUICKSTART-PILOT/INITIAL/v1`
Target: FractalAgentLab isolated pilot worktree, branch `awc5-v2-pilot`
Baseline: `a3292efbdfff1b990e03e6df662d5f33b198a9f1`
Wave: Isolated FAL V2 Pilot
Accountable lane / class / profile: `delivery` / `TRACK` / `fal.track-d`
Readiness: `READY`
Next route: `/implement`

The exact INITIAL plan and its matching Meta review are retained by Router V2.
Raw operation identities remain private and are not duplicated in this artifact.
The review was consumed once through `/terv-review-utan`; it required no blocking
correction and this plan establishes `PLAN_REVISION_COMPLETE` and
`IMPLEMENT_READY`.

## Goal and current state

Deliver a concise operational Router V2 quickstart for the single authorized
isolated pilot. The current Combined row and project state select this Epic, the
reviewed baseline is current, and no authority or dependency blocker is recorded.
AWC 5 and Router V2 remain candidates rather than installed, loaded, released or
product-resumption facts.

Confirmed interface facts:

- `scripts/Invoke-OCRouter.ps1` is the public facade and requires `-Action`.
- `predecessor` is optional, including for the first operation. When supplied, it
  identifies a completed operation in the same work.
- `reconcile` resolves prepared or completed operations from stored state. For
  dispatched unresolved work it may perform bounded GET recovery.
- `wait` with zero is a stored-state snapshot. Ending any local wait never
  interrupts the retained remote request.
- Delivery, execution, output availability, interpretation and acceptance are
  separate facts.

The Combined title supplies the Wave label because the single active row has no
separate Wave column. Private configuration and participant bindings remain
orchestrator-owned and outside Git. No material question remains.

## Scope and ownership

Allowed changes:

- `tools/oc-session-router/docs/v2-quickstart.md`
- this plan under `plans/pilot/**`
- sanitized verification under `evidence/pilot/**`
- exact pilot pointers in `ops/PROJECT_STATE.md` and
  `ops/Combined-Execution-Sequencing-Plan.md` when a lifecycle transition makes
  the update truthful

Forbidden changes and effects include Router runtime/source/tests, configuration,
installer or README changes; package/global installation; server restart; live
qualification; session interruption; commit, push, merge, deploy or publication;
product-work resumption; broad audit, refactor or new framework; and any exposure
of credentials, endpoints, raw runtime identities, transcripts or
workstation-specific roots.

Delivery owns implementation, deterministic verification, evidence and finding
responses. Meta owns independent candidate review and closeout. Orchestrator owns
routing and lifecycle selection. Only the Owner may interrupt sessions or compact
an orchestrator. No parallel implementation lane or Delivery subagent is planned.

## Feature -> User Story -> Task

| Feature | User Story | Tasks |
|---|---|---|
| Safe startup | A newcomer can identify prerequisites, private configuration and the no-send boundary. | Add candidate/isolation notice; document built-runtime and Node prerequisites; show facade help; keep configuration and credentials private. |
| Addressed work | An operator can open work and submit a stage while understanding delivery risk. | Add synthetic work and first-operation requests; omit predecessor for the first operation; show a later same-work completed predecessor; explain sources, stable keys and conflicts. |
| Recovery | An operator can distinguish delivery, execution and acceptance and recover without resending. | Show inspect/read/wait/reconcile/interpret; distinguish stored resolution from bounded GET recovery; prohibit blind retry. |
| Continuity | An operator can compact and restore an idle lane without repeating lifecycle work. | Show compact/restore shapes; explain optional predecessor, no-send dispositions, pause and Owner-only interruption. |
| Qualification | Meta can verify the document locally and deterministically. | Check interface terms, JSON, links, privacy, portability, compactness and exact diff; record sanitized evidence. |

## Ordered implementation

1. Recheck baseline, worktree, authority, allowed paths and current Router sources.
2. Materialize this reviewed plan and draft the quickstart sections: boundaries,
   prerequisites, open work, submit/observe/reconcile, interpretation,
   compact/restore, troubleshooting and references.
3. Use only synthetic JSON. Show one first operation without `predecessor` and one
   later operation whose predecessor is completed in the same work. Keep sources
   and predecessor semantically distinct.
4. Classify local/no-send actions, GET observation/recovery and actions that may
   initiate delivery. Explain stored `reconcile` exits before its bounded GET path.
5. Cover missing build/store/credentials, pause/busy state, invalid predecessor,
   changed source/command, possible delivery, ambiguity, empty output and missing
   optional telemetry.
6. Link to existing authoritative references rather than copying their schemas.
7. Run local help and the existing disposable launcher fixture. Run static
   action/flag, JSON, relative-link, privacy, portability and compactness checks.
8. Run `git diff --check`, inspect only allowed paths, hash the quickstart and
   record sanitized results with `real_server_calls=0` and explicit non-claims.
9. Update only truthful pilot phase pointers, freeze the candidate, self-review
   the exact diff and route it to Meta `/step-review`.

## Risks and controls

- Prevent a dry-run misconception by labeling `submit`, `compact` and `restore`
  as operations that may initiate delivery.
- Prevent duplicate delivery by preserving the same operation when delivery is
  `POSSIBLE` and using inspection or reconciliation instead of a new key.
- Prevent invalid sequencing by documenting optional first-operation predecessor
  omission and the same-work/completed requirement when it is present.
- Prevent network overclaims by distinguishing stored `PREPARED`/completed results
  from bounded GET recovery for dispatched unresolved work.
- Prevent false acceptance by keeping execution, output, interpretation and
  product acceptance separate.
- Prevent privacy leakage with synthetic identities, repository-relative commands
  and deterministic scans.
- Prevent fake qualification by labeling all checks offline and recording zero
  real server calls.
- Prevent documentation drift by keeping the quickstart compact and linking to
  detailed references.

## Acceptance -> verification -> evidence

| Acceptance | Verification | Evidence |
|---|---|---|
| Commands and flags match the interface | Compare examples with facade/CLI sources and local help; run launcher fixture | Action/flag assertions and exit codes |
| First predecessor is optional | Require a first-operation JSON block without the field | JSON/content assertion |
| Later predecessor is valid | Require same-work and completed-operation guidance | Content assertion and source citation |
| Reconcile behavior is exact | Require stored prepared/completed outcomes and bounded GET for dispatched unresolved work | Content assertion and source citation |
| Links resolve | Resolve every relative Markdown link from the quickstart directory | Link count and result |
| Examples are valid and synthetic | Parse every JSON fence and inspect identity values | JSON count and result |
| Private data is absent | Scan for session IDs, endpoints, machine roots, credential assignments and transcript material | Zero-match privacy result |
| No-send and possible delivery differ | Require an action-effects table and delivery-state explanation | Content assertions |
| Recovery never resends or interrupts | Require same-operation recovery, blind-retry prohibition and wait non-interruption | Content assertions |
| Markdown is compact/readable | Check fences, line budget and `git diff --check`; perform direct self-review | Receipt and implementation brief |
| No live claim is fabricated | Run only local/offline checks | `real_server_calls=0` and non-claims |

## Handoff and state impact

There is no implementation blocker and no second plan review. After verification,
the frozen candidate routes to Meta `/step-review`. `/step-review-utan` and
`/closeout-commit` remain mandatory; closeout requires actual `ALLOWED` review and
Delivery `ACK_ONLY`. State and Combined may change only for the exact truthful
pilot transition. Other project frontiers remain parked.

`PLAN_REVISION_COMPLETE`

`IMPLEMENT_READY`
