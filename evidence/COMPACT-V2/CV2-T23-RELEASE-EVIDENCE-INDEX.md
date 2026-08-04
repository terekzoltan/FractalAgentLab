# COMPACT-V2 CV2-T23 Release Evidence Index

## Bound Identities

- Plan: `COMPACT-V2-plan-v1.1-final`
- Plan SHA-256: `4d2e1d717e31495fc7176bebf55cc9b328bb9702f283c8c1eee3e610ee510de5`
- Canon candidate: `compact-v2-canon-ce399cc626d7833e`
- Applied runtime adapter manifest: `54c3b3773ed2043dbc6c2932188f6d80c3b6807b171c41b28046d32251fae912`
- Current post-apply adapter/docs-test successor: `compact-v2-adapter-40a911d0abebdfb8`
- Current adapter manifest: `40a911d0abebdfb8d53be928a73c83bfc2363829e057ee1b5857f425c9589332`
- Applied global candidate: `compact-v2-global-16c13cc15ea12137`
- Snapshot: `opencode-tooling-compact-v2-20260803T213256Z-16c13cc15ea1`
- Snapshot payload digest: `dc1ecffd215b03774c4cf08f66971936bb6153a531b1fc8235307cb931237c5e`

## Serial Deterministic Checks

All commands ran in separate PowerShell processes.

| Check | Result |
|---|---|
| `test-schema-profiles.ps1` | `PASS` |
| `test-compact-boundary.ps1` | `PASS` |
| `test-resolver.ps1` | `PASS` |
| `test-invoke-hydration.ps1` | `PASS` |
| `test-project-profiles.ps1` | `PASS` |
| `test-compatibility.ps1` | `PASS` |
| `validate-pack.ps1 -HydrationTestPath test-resolver.ps1` | `PASS / Release readiness READY` |
| `test-session-compact-flow.ps1` | `PASS` |
| `test-global-compact-candidate.ps1 -Mode Live` | `PASS` |
| `test-global-compact-candidate.ps1 -Mode Snapshot` | `PASS` |

The reviewed pre-apply Candidate check remains `PASS` evidence from T18. Candidate
mode intentionally requires the live tree to equal the pre-apply baseline and is
therefore not rerun after successful apply. Live and Snapshot modes execute the
same generation semantic assertions against the post-restart generations.

## Rollback And Preservation

- Isolated rollback rehearsal: `PASS`.
- Every replacement restored its exact before hash.
- The transaction-created policy was removed only from an exact after-hash state.
- An intentionally drifted replacement was preserved and rollback was blocked.
- Protected FAL source SHA-256: `58c99c1c34fbf38aadb3d6ec4d62143456676a302cc6e08465f3deed03ae46a3`.
- Protected FAL test SHA-256: `1f5d4e24410b34ab76c08363aed2603be2c4bca986516615b347feebf4fdebab`.
- Protected combined binary patch SHA-256: `c1178c1e364a7f03582a334e433459210f8f16e0584473b085626d6afeb0a12c`.
- Protected Canon parallelism file SHA-256: `88fd985c6cfaaabde65843880736f825915289cc3b181b5bfe372cdbc21d062f`.
- Earlier reviewed receipts retain the pre-existing plan-identity, review-topology,
  pair-sync, opaque-ID, and bare-receipt semantics.
- Tooling snapshot changes are classified exclusively as the authorized T22
  generated sync lineage; unrelated dirty ownership is not claimed.

## Privacy And Scope

- Secret scanner: zero findings in every scannable candidate/evidence file.
- Because the metadata scanner skipped Markdown, an explicit regex sweep covered
  candidate, router docs, and evidence for raw workstation roots, reviewer/session
  IDs, common secret forms, and non-placeholder password assignments: zero findings.
- Reviewer session IDs and workstation roots found in older evidence were sanitized
  to private provenance/root-class placeholders before closeout.
- The cheatsheet contains only `<PASSWORD_FROM_PRIVATE_RUNTIME>`, never a real credential.
- Git exposes exactly the 12 Owner-allowed router files; unrelated helper/backup and
  migration baseline/candidate trees remain ignored.
- `git diff --check`: no whitespace errors in FAL or Canon; only known line-ending warnings.
- SAST/quality helper still cannot write evidence because of the parent `.swarm`
  root collision. This is a tool-context limitation, not a PASS claim.

## Repository And Side-Effect Audit

- FAL HEAD remains baseline `f98218454e025edeef6a62578409f225c2d2e641`.
- Canon HEAD remains baseline `f5218825410f0db5a69e970565d0ed475b2b91ca`.
- No staged files, commit, push, PR, merge, deploy, publication, or public export.
- No target feature work, Wave 8 activation, or live compact pilot occurred.
- The live pilot remains separately Owner-gated and is not required release evidence.

## Acceptance Matrix

| Acceptance | Result | Primary evidence |
|---|---|---|
| `CV2-AC01` | `PASS` | final plan, state, Combined |
| `CV2-AC02` | `PASS` | compatibility/schema tests |
| `CV2-AC03` | `PASS` | compact-boundary/privacy tests |
| `CV2-AC04` | `PASS` | adapter policy matrix |
| `CV2-AC05` | `PASS` | unchanged telemetry contract and adapter test |
| `CV2-AC06` | `PASS` | pressure/safe-boundary matrix |
| `CV2-AC07` | `PASS` | participant order tests |
| `CV2-AC08` | `PASS` | cross-event idempotency/locks |
| `CV2-AC09` | `PASS` | timeout/uncertain tests |
| `CV2-AC10` | `PASS` | resolver/invoker tests |
| `CV2-AC11` | `PASS` | guarded auto-resume proof tests |
| `CV2-AC12` | `PASS` | failure-class tests |
| `CV2-AC13` | `PASS` | held route snapshot tests |
| `CV2-AC14` | `PASS` | global candidate pins/digest |
| `CV2-AC15` | `PASS` | approval/apply/restart receipts |
| `CV2-AC16` | `PASS` | T22 snapshot receipt |
| `CV2-AC17` | `PASS` | protected hashes/lineage receipts |
| `CV2-AC18` | `PASS` | side-effect audit |
| `CV2-AC19` | `PASS` | role/profile fixture matrix |
| `CV2-AC20` | `PASS` | secure route-input negatives |
| `CV2-AC21` | `PASS` | marker-attribution fixtures |
| `CV2-AC22` | `PASS` | Candidate historical plus Live/Snapshot PASS |
| `CV2-AC23` | `PASS` | 76-row consumer matrix/set equality |

T23 verdict: `PASS / READY_FOR_CV2_T24_CLOSEOUT`.

RELEASE_EVIDENCE_COMPLETE
