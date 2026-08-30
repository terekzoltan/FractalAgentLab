# FAL Router STANDARD / STRICT simplification

Status: `IMPLEMENTED OFFLINE CANDIDATE / ROLLOUT GATED`

Baseline: FAL router v33 (`c88dde9`)

Change class: `BOUNDARY_ROLLOUT`

Scope: launcher/runtime behavior, tests, and operator documentation. This plan
does not itself authorize push, main integration, protected admission mutation,
P0B POST, lifecycle send, or project mode adoption.

## Outcome

Normal project lifecycle may use one of two immutable semantic policies while
retaining one shared transport-safety kernel:

- `STANDARD` accepts only a finite set of harmless, deterministic output
  normalizations and can retain a well-bound result as `EVIDENCE_GAP` without a
  successor.
- `STRICT` requires the exact canonical contract. Missing mode remains STRICT.

The policy never selects a server, recipient, command, capability, source, or
send authority. It adds no retry, auto-advance, autonomous orchestration, fuzzy
parser, model repair, or second sender.

## Invariants

Both modes fail closed before POST for target/worktree/server/recipient/command
identity, protected registry or authentication authority, semantic-action and
at-most-once claims, caller/source substitution, pending or uncertain prior
sends, credential/private-output leakage, unsafe paths, and destructive scope.

`CLOSEOUT`, protected control-plane work, and P0B always execute with effective
STRICT policy. A caller may tighten a run to STRICT but cannot request or inject
STANDARD. Mode cannot change inside an immutable run.

There is no automatic risk classifier. Chat wording, ambient state, or model
judgment cannot select the policy. A release, migration, destructive, or
explicitly high-consequence ordinary lifecycle run MUST bind `Router mode:
STRICT` in target/accountable state before the immutable run is created. If the
accountable authority cannot classify the consequence safely, it selects
STRICT.

## Implemented policy decisions

The StageEngine consumes one policy decision:

- `ACCEPTED_EXACT`;
- `ACCEPTED_NORMALIZED`;
- `ACCEPTED_NO_SUCCESSOR`;
- `BLOCKED_AUTHORITY`;
- `BLOCKED_AMBIGUOUS`.

`ACCEPTED_NORMALIZED` persists only the canonical terminal and digest-only,
append-only `router-warning-receipt.v1` evidence. `ACCEPTED_NO_SUCCESSOR`
persists the bound terminal as `EVIDENCE_GAP`, projects no next stage, and does
not release retry authority.

## Initial finite allowlist

Implemented STANDARD-only rules:

1. one uniquely bounded canonical envelope surrounded only by an exact reviewed,
   semantically inert wrapper line from the initial four-line allowlist; arbitrary
   outside prose remains ambiguous even without field syntax;
2. deterministic `NONE` defaults for the documented non-authority fields in
   PLAN_REVIEW, PLAN_REVISION, IMPLEMENT, and STEP_REVIEW;
3. required semantic-fact omission becomes terminal `EVIDENCE_GAP` rather than
   losing accepted transport evidence;
4. v33 Compact/telemetry warnings remain nonblocking.

Header/terminal-marker aliases are `NONE`. A complete v25-v32 history and
persisted-artifact audit found no authority-safe observed alias; no spelling is
invented. The former split IMPLEMENT fields were a corrected authority-bearing
schema error, not a compatibility alias. An alias may be added only with exact
production evidence and positive, ambiguous, and malicious fixtures.

Exact projection reconstruction from one persisted, hash-bound predecessor
artifact already exists in the shared router kernel. It remains mode-agnostic
and emits no warning because it does not synthesize or normalize a semantic
fact.

## File map

- `runtime/src/contracts.ts`: immutable policy types and warning contracts.
- `runtime/src/cli.ts`: target-state mode binding and bounded projection.
- `runtime/src/control-plane.ts`: downgrade prevention and forced STRICT gates.
- `runtime/src/policy-validator.ts`: finite semantic policy evaluator.
- `runtime/src/stage-engine.ts`: common transport kernel, sync/recovery policy,
  canonical artifacts, evidence gaps, and successor gating.
- `runtime/src/state-store.ts`: append-only warning receipts and immutable
  terminal state.
- `runtime/src/transport.ts` and `snapshot-reader.ts`: unchanged mode-agnostic
  transport/correlation authority.
- `scripts/Invoke-OCRouter.ps1`: one attested launcher including the policy
  module; there is no alternate STANDARD launcher.

## Compatibility and rollout

- Pre-v34 immutable runs omit the new authority field byte-for-byte and resolve
  as STRICT.
- Existing RingFall and WorldSim runs remain STRICT until a separate stable
  boundary adoption.
- First live adoption must be separately authorized and project-specific.
- The first live STANDARD canary is limited to one named read-only lifecycle
  stage: SEQ_NEXT, PLAN_REVIEW, or STEP_REVIEW. Its authorization does not cover
  a successor delivery dispatch.
- PLAN_REVISION, IMPLEMENT, and REVIEW_RESPONSE may use STANDARD only after the
  first canary evidence is reviewed successfully and a later authorization
  opens those delivery stages.
- The first release keeps CLOSEOUT/commit STRICT.
- P0B remains STRICT throughout the rollout.
- Global OpenCode command/skill text and the AWC tooling snapshot require their
  own transactional TOOLING_UPDATE before a live STANDARD canary.

## Validation ledger

The offline candidate must close these gates before rollout approval:

- full TypeScript build and Node test suite;
- STANDARD/STRICT safety and normalization matrix;
- sync, timeout, late-response, fresh-engine recovery, and no-resend checks;
- direct compiled/source policy-module attestation tamper negatives;
- PowerShell Compact Lite, session-context, compact-flow, and global-candidate
  suites;
- `git diff --check` and exact branch diff review.

Offline validation on 2026-08-30:

- TypeScript build: `PASS`.
- Node suite: `179` tests, `178 PASS`, `0 FAIL`, `1` expected evidence skip.
- session-context PowerShell suite: `PASS`.
- compact-flow PowerShell suite: `PASS` with an ordinary, temporary `.git`-free
  Canon test copy matching the isolated worktree's expected sibling layout.
- Compact Lite PowerShell suite: `PASS`.
- attestation: v34 source/compiled manifests and launcher pin agree; direct
  compiled and source policy-module tamper tests pass.
- final independent review: `APPROVE`; the finite wrapper allowlist and
  authority/verdict ambiguity negatives passed a focused `71/71` review suite.
- `git diff --check`: `PASS` (Git reports only the repository's expected future
  LF-to-CRLF checkout warnings).

One external gate remains deliberately outside this change: the historical
global Compact V2 candidate receipt is stale against the current AWC/global
command and skill inventory. Its drift is expected to be reconciled by the
separately authorized global TOOLING_UPDATE/snapshot gate, not by rewriting
historical transaction evidence in this candidate.

The feature candidate can be committed locally, but live rollout remains gated
until the Owner separately authorizes integration/tooling work.

## Rollout gate

The offline implementation approval ends here. Push, fast-forward integration,
global tooling/snapshot update, synthetic P0B proof, protected no-send admission,
and any project state label or lifecycle canary require one separately named
Owner approval.
