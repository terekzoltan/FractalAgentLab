# COMPACT-V2 CV2-T13 Adapter Handoff

## Identity

- Epic: `COMPACT-V2`
- Plan: `COMPACT-V2-plan-v1.1-final`
- Canon dependency: `compact-v2-canon-ce399cc626d7833e`
- Canon interface manifest: `ce399cc626d7833e7f2a3de3447975ab0d027bdd6dd94139a557dbf51f9db2ec`
- Canon pack digest: `69080ed3e17343637254de77cd6662c25ce6c7db95896904fd2355967f2f720b`
- Adapter candidate: `compact-v2-adapter-54c3b3773ed2043d`
- Adapter manifest SHA-256: `54c3b3773ed2043dbc6c2932188f6d80c3b6807b171c41b28046d32251fae912`

The adapter manifest is SHA-256 over ordinally sorted
`<relative-path>|<lowercase-file-sha256>` rows joined by LF without a trailing LF.

## Candidate Manifest

| Relative path | SHA-256 |
|---|---|
| `tools/oc-session-router/README.md` | `8f759c5cee7e88ccb30a2e6407aa6c74d7905ab9f149d5e1500026ca0bd9d60f` |
| `tools/oc-session-router/config/README.md` | `b440260a82d4fa69f331a799ec79fdf61b17741d4ff3634d053006b0322f93ac` |
| `tools/oc-session-router/config/compact-flow-event.schema.json` | `2c8aeae2d6ccba1e0411d0ddbe3deba855f913d029fcbccd670263ee15afd545` |
| `tools/oc-session-router/config/compact-policy.schema.json` | `d133c502b15248eaa8fa376565ef754e77293d0d2e01844364256796cf3334cc` |
| `tools/oc-session-router/docs/session-router-cheatsheet.md` | `c68ca61db0791cd91af1ea1855318b06aa3188f5cb0b641f01abcf797fe86666` |
| `tools/oc-session-router/docs/workflow-orchestrator-reference.md` | `a00b968be0fe7d6ef758c3e9797fae214d5c16d26c0d87f9262d46082fd92b9e` |
| `tools/oc-session-router/docs/workflow-orchestrator-runbook.md` | `bc9131fca7720fe843c78426ff685629397cbdc05bc833aba6408a9ab1f0d750` |
| `tools/oc-session-router/scripts/invoke-session-compact-flow.ps1` | `0af4f580dc99d60633860ec940688b7de8be053ebdc571b2b7818fa1db151c0e` |
| `tools/oc-session-router/scripts/resolve-compact-policy.ps1` | `545a1859b358a2a2ceb64c1ec10acae336bbbb78135b074db38aa447ef9e1d3d` |
| `tools/oc-session-router/scripts/session-compact-flow-core.ps1` | `739cbd67d2b757b4a6f5c77dcdbd443404de31be1cf41ee351d6013435fe95bd` |
| `tools/oc-session-router/scripts/test-session-compact-flow.ps1` | `bddeeeb08077b21311d7731e94785a2e99aec76c44ae9bd5737de460fa81f2f2` |

## Delivered Behavior

- Strict global and tighten-only project policy parsing with recursive duplicate-key
  rejection, deterministic effective-policy identity, mandatory preservation of
  global event checks, and enforced unioned `required_gates` through each event's
  closed `satisfied_gates` set.
- Fluidity-first pressure decisions: ordinary `normal` and `unknown` continue;
  safe `warn`/`critical` may compact; unsafe boundaries and `over_limit` stop at a
  bounded proof/recovery route.
- Strict `compact-flow-event/v1` validation with logical participants, exact nested
  route/host/stage/closeout objects, recursive privacy-safe values, and no UUID-
  shaped or concrete runtime session labels.
- Deterministic participant ledger ordering: `DELIVERY`, `REVIEW_SUPPORT`, then
  `META_ORCHESTRATOR`, with exact deduplication and conflict rejection.
- Hash-chained atomic run state with persisted summarize and resume intent
  identities, one compact per participant/boundary across event IDs, and durable
  cross-event blocking after `UNCERTAIN` or any outstanding lifecycle intent.
- One exclusive boundary lock spans participant merge, boundary write, run-ledger
  recovery, summarize, hydration, and resume. A nested Epic participant lock makes
  participant-ledger read/merge/write atomic across different boundaries.
- Canonical `POST /session/:id/summarize` using telemetry-selected provider/model.
- Marker attribution that permits continuation only for one post-intent marker;
  timeout, interruption, competing marker/intent, or ambiguous hydration/resume is
  `UNCERTAIN` with no blind resend.
- One retry is possible only after explicit pre-acceptance rejection, unchanged
  markers, one outstanding intent, and policy allowance.
- Canon preflight and post-marker hydration revalidate target state, Combined,
  candidate, role/profile, route input, command identity, and exact action.
- Resume opens the contained non-reparse route once with `FileShare.Read`, verifies
  final path and hard-link count from that Win32 file handle, hashes its held bytes,
  persists the resume intent while the same handle is open, and retains it through
  command POST completion. Traversal, ADS, replacement, hash drift, multi-link, and
  stale parent-session command metadata fail closed.
- Manual compact records a terminal boundary and skips router summarize.
- Operator docs now describe reviewed `auto_safe` behavior; the cheatsheet no
  longer contains a concrete workstation path, password, or port.

## Verification

- `tools/oc-session-router/scripts/test-session-compact-flow.ps1`: `PASS`.
- The single test covers policy tightening/loosening, check-removal rejection,
  required-gate enforcement, all pressure states, safe and unsafe boundaries,
  nested-schema/privacy rejection, participant order/deduplication, manual compact,
  summarize success, timeout, competing markers/intents, persisted cross-event
  `UNCERTAIN`/outstanding-intent recovery, one-boundary uniqueness, response
  contradiction, zero/one retry, hydration and resume uncertainty, intent-before-
  POST ordering, stale `subtask=true`, path escape, ADS, reparse point, final-handle
  path, replacement denial, multiple hard links, route hash drift, exclusive lock,
  recursive duplicate JSON, atomic writes, privacy, and a mocked entrypoint dry run.
- All four changed PowerShell files parse successfully.
- Both new JSON schemas parse successfully.
- `git diff --check`: successful with pre-existing line-ending warnings only.
- The file-scoped precheck secret scan found zero candidate findings. A broad router
  scan reports pre-existing backup examples and generic `$Password` parameters in
  unrelated helpers; no secret value was returned or introduced by this candidate.
- The aggregate precheck is not claimed as PASS: no supported JS linter was found,
  and SAST/quality helpers could not persist evidence because the host detected a
  parent `.swarm` root collision. These are explicit tool limitations, not passed
  security or quality claims.

## Prior RED Review Closure

The predecessor `compact-v2-adapter-9e86f226279cba71` received independent `RED`
review in a private reviewer session. This replacement
candidate addresses every accepted finding before re-review:

- `CV2-AC04`: global checks can no longer be removed and unioned required gates are
  enforced against strict event evidence.
- Privacy/schema finding: nested route, host, stage, closeout, and participant
  objects are exact, and privacy validation is recursive.
- `CV2-AC07`: participant-ledger merge/write and V2 boundary creation occur under
  the boundary lifecycle lock with a separate Epic ledger lock.
- `CV2-AC08` / `CV2-AC09`: later event IDs cannot resend after `UNCERTAIN`, any
  outstanding intent, or a completed compact for the same participant/boundary.
- `CV2-AC20`: final path and link count are handle-derived, replacement is denied,
  and the same held route snapshot spans resume-intent persistence through POST.

This section records claimed closure only. Acceptance still requires independent
re-review of the exact manifest above.

## Final Synthesis Fix Closure

The first `CV2-T19` synthesis found that malformed global policy propagated an
exception and could block unrelated workflow work. This successor candidate now
returns a strict `valid=false` policy result, performs no Canon/session/ledger/
boundary work, and emits `CONTINUE / GLOBAL_POLICY_INVALID_NO_COMPACT`. Malformed
policy can no longer authorize compact or stop unrelated routing. The targeted
regression also supplies invalid Canon, router, and server inputs to prove the
policy stop occurs first. Both permitted serial tests pass after the fix.

## Preservation

- `tools/oc-session-router/scripts/oc-router-common.ps1` remains
  `21de05fd60fb7c4ab7bd7e86c424684b88325d66916f04e2c06304dbb10dbf42`.
- `session-context-status.ps1` remains
  `813a6110b806e8fd5efe7b9e80db997c292667af099354ff0e6b4b59816f5354`.
- `session-context-status-core.ps1` remains
  `f95615ff3a9df1747d820c2955ef5264c83f988cf4531b23bb3a8e16bc6f4ce4`.
- `test-session-context-status.ps1` remains
  `f147acdb39f62a8f549faf890ee78a8a15575d6ecd921e16bebac56bfc972890`.
- Protected FAL source remains
  `58c99c1c34fbf38aadb3d6ec4d62143456676a302cc6e08465f3deed03ae46a3`.
- Protected FAL test remains
  `1f5d4e24410b34ab76c08363aed2603be2c4bca986516615b347feebf4fdebab`.
- No live summarize, hydration command, resume command, global tooling mutation,
  restart, generated snapshot edit, commit, push, or public side effect occurred.

## Visibility Resolution

The initial review correctly recorded that FAL `.gitignore` ignored the complete
router tree. The Project Owner later selected the exact-allowlist resolution. Root
`.gitignore` now admits only the 12 plan-named router files, while unrelated router
helpers, backups, runtime data, and migration candidate/baseline trees remain
ignored. No force-add was used. Decision and verification evidence:
`evidence/COMPACT-V2/VISIBILITY-DECISION.md`.

## Review Boundary

Review `CV2-T7` through `CV2-T13` only against `CV2-AC04` through `CV2-AC09`,
`CV2-AC13`, `CV2-AC17`, `CV2-AC20`, and `CV2-AC21`. Global command/skill candidate,
live apply, restart, snapshot sync, live compact pilot, commit, and push remain out
of scope.

ADAPTER_HANDOFF_REVIEW_READY
