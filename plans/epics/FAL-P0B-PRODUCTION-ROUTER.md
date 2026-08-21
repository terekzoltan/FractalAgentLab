# FAL P0B Production Router Release

Status: `IMPLEMENTATION / OFFLINE VALIDATION`

Authority class: bounded production-router release Epic. This document is not
part of active `ops/` state and does not change the closed
`FAL-EXPLICIT-STAGE-ROUTER` lifecycle record.

## Outcome

Release the accepted response-first explicit-stage router through a protected,
owner-only control plane while retaining `DISABLED` as the default and rollback
mode. The release may prove an isolated synthetic OpenCode session, but it may
not send a lifecycle command to a real project.

## Frozen invariants

- Production modes are exactly `DISABLED`, `P0B_ISOLATED`, and
  `PRODUCTION_RESPONSE_FIRST`.
- `DISABLED` is the default, requires no credential, makes no HTTP request, and
  creates no operation.
- Mode, server, recipient, capability-receipt path, snapshot policy, and
  retention policy come only from the protected control registry.
- The OS KnownFolder is independently queried at the Node boundary. P0B registry
  and grant bind a separately owner-protected isolation root; synthetic target and
  server directories must be reparse-free descendants before probe or POST.
- A request, CLI argument, or environment variable cannot select a capability
  receipt or production mode.
- The router protocol identity is `fal-explicit-stage-router/v1`; active modes
  require AWC `4.1.1`, while AWC `3.1` remains legacy fixture/input
  compatibility only.
- The synchronous command response remains the primary completion candidate.
- Snapshot reads are real and read-only. They remain diagnostic unless the
  installed-server receipt plus persisted assistant ID, parent, session, and
  terminal hash prove exact one-to-one correlation.
- SSE support is probed and recorded, but `enabled` must remain `false` in this
  release.
- Lifecycle dispatch and the active `invoke-session-compact-lite.ps1` adapter
  independently derive and hold the same target-local private-session transport
  fence through their full send and settling lifecycles. The retained V2 flow
  remains reference-only.
- Non-dry Compact Lite resolves its exact target, literal loopback server
  instance, private session, timeout, and capability only through the attested
  fixed KnownFolder authority. Target-local session maps and caller endpoints
  are dry-run/temporary-fixture inputs and cannot authorize production.
- Timeout, 5xx, crash, ambiguity, or uncertain correlation never resends.
- Private bodies, credentials, endpoints, raw session IDs, and unrelated events
  never enter versioned artifacts or normal console results.
- Raw Compact authority crosses only an owner-only ephemeral handoff, never
  stdout; Lite deletes it after reading and crash remnants expire after 15 minutes.
- Quarantine expires after seven days; diagnostic metadata and validated
  private evidence use explicit 30-day and 180-day classes.

## Allowed surfaces

- `plans/epics/FAL-P0B-PRODUCTION-ROUTER.md`
- `.gitignore`
- `.gitattributes`
- `README.md`
- `tools/oc-session-router/README.md`
- `tools/oc-session-router/docs/{session-router-cheatsheet,workflow-orchestrator-reference,workflow-orchestrator-runbook}.md`
- `tools/oc-session-router/runtime/{src,test,schemas,package*,tsconfig.json,executable-attestation.json}`
- `tools/oc-session-router/scripts/{Invoke-OCRouter,Initialize-OCRouterControlPlane,Prepare-OCRouterStage,invoke-session-compact-lite,session-compact-lite-core,test-session-compact-lite,invoke-session-compact-flow,session-compact-flow-core,session-context-status,session-context-status-core,oc-router-common}.ps1`

## Forbidden surfaces and effects

- active `ops/` state, Combined, or external execution tracker;
- original FAL worktree, other repositories, global tooling/configuration, or
  live server mutation;
- real-project sends, target product mutation, compact, Git index mutation,
  commit, push, restart, or deployment.

## Acceptance ledger

| ID | Acceptance | Required evidence |
|---|---|---|
| P0B-AC01 | Default/rollback mode is `DISABLED` with zero probe, operation, or POST | kill-switch negative test |
| P0B-AC02 | Active modes require a closed v2 registry in the owner-only control root | schema, containment, ACL/bootstrap tests |
| P0B-AC03 | Capability receipt is registry-resolved only and binds target, worktree, origin, fingerprint, commands, protocol, version, and expiry | substitution/env/request negative tests |
| P0B-AC04 | Health, OpenAPI, and command-registry identities are live-revalidated before operation creation and immediately before POST | drift/race tests |
| P0B-AC05 | `P0B_ISOLATED` admits only `SYNTHETIC_TEST_ONLY` targets beneath the exact protected isolation root | containment/reparse/probe-negative tests |
| P0B-AC06 | Production response-first completes from one synchronous response and never polls after success | one-POST response test |
| P0B-AC07 | Installed snapshot reader performs bounded GET-only diagnosis; promotion requires exact parent correlation | diagnostic/exact/ambiguous tests |
| P0B-AC08 | SSE proof is recorded while `enabled` is always false | receipt schema and rejection test |
| P0B-AC09 | Active Compact Lite and lifecycle independently derive the same exact private-session fence; Compact transport authority is protected-registry only | actual Lite/lifecycle cross-process tests in both orders plus authority-substitution negatives |
| P0B-AC10 | Active modes require AWC `4.1.1`; legacy AWC `3.1` never authorizes production, and the router protocol remains independent | contract tests |
| P0B-AC11 | Crash, timeout, 5xx, and concurrent resolve do not resend or duplicate receipts | race/crash tests |
| P0B-AC12 | Secrets, endpoints, session IDs, response bodies, and cross-session sentinels do not enter durable diagnostics or console results; Compact uses an ephemeral protected handoff | privacy/handoff tests |
| P0B-AC13 | Fifteen-minute Compact handoffs, seven-day quarantine, 30-day diagnostics, and 180-day validated evidence produce sanitized purge receipts | retention tests |
| P0B-AC14 | Source, compiled output, launcher module manifests, and executable attestation agree | clean build and attestation verification |
| P0B-AC15 | Documentation states exact setup, kill switch, no-SSE/no-resend law, rollback, and no-real-send boundary | documentation assertions |

## Release levels

`OFFLINE_READY` requires all deterministic tests, schemas, build, privacy scan,
and attestation checks. `P0B_PROVEN` additionally requires an Owner-gated
synthetic installed-server receipt. `PRODUCTION_RESPONSE_FIRST` may be installed
only from that exact proof and remains a separate protected registry edit.

No release level in this Epic authorizes a real-project stage send.
