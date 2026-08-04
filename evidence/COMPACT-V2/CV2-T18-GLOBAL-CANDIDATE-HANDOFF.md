# COMPACT-V2 CV2-T18 Global Candidate Handoff

## Identity

- Candidate: `compact-v2-global-16c13cc15ea12137`
- Candidate manifest SHA-256: `16c13cc15ea121376f466c7538b75656224002c0a23407c63567ae3395485118`
- Baseline manifest SHA-256: `d7de219af33a8b93c18072e8d6ca9f5848065a4a756cb7c121d367d9efc909e7`
- Canon interface manifest: `ce399cc626d7833e7f2a3de3447975ab0d027bdd6dd94139a557dbf51f9db2ec`
- Canon five-schema pack digest: `69080ed3e17343637254de77cd6662c25ce6c7db95896904fd2355967f2f720b`
- Adapter manifest: `54c3b3773ed2043dbc6c2932188f6d80c3b6807b171c41b28046d32251fae912`
- Transaction manifest: `evidence/COMPACT-V2/global-transaction-manifest.json` @
  `65be5468dfcec303eb798fc891ea9781626fb6e01ac5e37fac5b3412b6368589`
- Consumer matrix: `evidence/COMPACT-V2/global-consumer-matrix.md`

The candidate digest is SHA-256 over ordinally sorted
`<relative-path>|<lowercase-file-sha256>` rows joined by LF without trailing LF.

## Payload Manifest

| Relative path | Operation | Before SHA-256 | Candidate SHA-256 |
|---|---|---|---|
| `commands/after-compact.md` | `REPLACE` | `84d6d1159d941c6db3dd9310c0cc8a14b40dfa5b66adbce9ebe266b4072aca61` | `e143fae7a5e34dde77933cb9662c3ed81771bb8917ccaad3e4c2c923bda5b82d` |
| `commands/fal-orchestrate-target.md` | `REPLACE` | `d8c7b74c80c3bc5384ccb9bf4e1d2ed71850278e94cc24e87688c628af9dda69` | `f6c057bd989420f6d752d303b4caf77c76e389f5f6ccb1af313cf87fa50cd3a5` |
| `commands/wave-start.md` | `REPLACE` | `e438be9175fe37fbc8592e41c1c94d06aec7ccf1d8905c0ef20ed04684ac82b8` | `4c1cab4c2a20daaa7ea92f27712e6663da9c060407cdc54f06949d750a26e881` |
| `skills/closeout-commit/SKILL.md` | `REPLACE` | `13f7f615c7674dbb05b6a230093cb9c6bddbff66d6b12deffb6433391efbb23e` | `982c537fef4529b36fcb77120346ad5fd3b4592eb7fecc7e7593370b0985e08f` |
| `skills/context-onboarding/SKILL.md` | `REPLACE` | `698c31dc6c1ca15ba5daeb729f97b19c5318e77d44c055bb977a4009ab2e1131` | `d9f36a4bce93eeab208a2848a4639197852b7330fb2b7a6d23d752057f3e2b40` |
| `skills/context-restore/SKILL.md` | `REPLACE` | `30d2bf80665c644a6dd15fee106375c59f419c255337174b18077f51143cfa69` | `9d7d6788d671bc5e86b868e68447e3f0a91f83e7a01fae8228adc171feb60adc` |
| `skills/fal-orchestrate-target/SKILL.md` | `REPLACE` | `c814c3951bb014dcf16bbc62a11cf9d694693fa134b1bc13e190ff3608334ade` | `4fdececad4a10624ec4f13245a21fc13f3fc3725795700b01e9982dc558772a3` |
| `workflow-compact-policy.json` | `CREATE` | `ABSENT` | `d7689a48632ec29eee563b29b50bb381fc2cb182744b1eeba5bb6b905fec290c` |

## Behavior

- `/after-compact` and `context-restore` preserve V1 status-gated behavior while
  exposing strict V2 confidence/action/route lines and guarded command readiness.
- `context-restore` and `context-onboarding` pin the final eight Canon interfaces
  and five-schema digest.
- `/fal-orchestrate-target` emits only strict private events at the three reviewed
  boundaries. The target-local adapter exclusively owns pressure, summarize,
  marker attribution, hydration, and guarded resume.
- `closeout-commit` never compacts inline. Its exact accepted `CLOSED` receipt is a
  later orchestrator `epic_closeout` trigger.
- The new global policy defaults to `auto_safe`; project overrides remain
  tighten-only.

## Verification

- `test-global-compact-candidate.ps1 -Mode Candidate`: `PASS`.
- Primary global inventory set: `17` commands and `21` skills, exact match.
- Additional discovered inventory: `2` commands and `36` skills, all explicitly
  classified `NOT_AFFECTED`.
- Canon eight-pin and pack-digest checks: `PASS`.
- Baseline/live equality before apply: `PASS` for all seven existing targets;
  policy baseline is exact `ABSENT`.
- Candidate JSON and PowerShell parser checks: `PASS`.
- Candidate literal safety sweep inspected all eight payloads and found no concrete
  user-root, loopback-port, or assigned-password literal. The metadata secret tool
  reported zero findings in its one scannable JSON payload and disclosed seven
  skipped Markdown files; it is not overstated as an eight-file secret scan.
- Isolated rollback rehearsal restored all seven baseline byte identities and
  removed the transaction-created policy only after its candidate hash matched:
  `PASS`.

## Rollout And Rollback

No live file changed. Apply requires exact candidate-bound Owner confirmation,
fresh baseline rehash, timestamped recovery archive, durable transaction journal,
same-directory atomic replacements, and exact create semantics for the policy.
Rollback restores archived bytes only when current live hashes equal the applied
candidate hashes; the policy is removed only when the journal proves this
transaction created it and its hash is unchanged. Drift blocks rollback.

After apply, stop at `APPLIED_AWAITING_RESTART`. Only an Owner-managed restart may
unlock `Live` verification. Generated snapshot synchronization follows fresh live
registry verification and must make seven command/skill payloads plus manifest
agree; the policy is global-only and not a snapshot payload.

## Nonclaims And Blockers

- This is a candidate handoff, not approval or live apply authority.
- No global file, generated snapshot, target project, service, session, commit, or
  remote surface changed.
- Router-tree tracked durability and its Owner-selected exact `.gitignore`
  allowlist passed focused review. The parent `.swarm` SAST/quality evidence-root
  blocker remains unresolved.
- Live compact pilot remains separately blocked.

## Independent Review

The initial independent review found one `CV2-AC22` test-architecture gap: Live
and Snapshot modes did not repeat Candidate semantic assertions. The test now uses
one generation-root semantic helper in all three modes, keeps transaction-only
checks in Candidate, and excludes the global-only policy from Snapshot. Focused
re-review in a private reviewer session returned `GREEN / ALLOWED`
with `CV2-AC14`, `CV2-AC18`, `CV2-AC22`, and `CV2-AC23` all `PASS`.

Evidence: `evidence/COMPACT-V2/CV2-T18-INDEPENDENT-STEP-REVIEW.md`.

The bound Canon, adapter successor, global candidate, visibility decision,
rollback receipt, and focused regression evidence passed `CV2-T19` synthesis in
private final-review session as `GREEN / ALLOWED`, with recommendation
`AWAIT_OWNER_APPLY_CONFIRMATION`.

GLOBAL_CANDIDATE_REVIEW_ACCEPTED
