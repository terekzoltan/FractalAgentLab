# COMPACT-V2 CV2-T20 Global Apply Receipt

## Approval Binding

- Owner decision: `Authorize exact apply`
- Candidate: `compact-v2-global-16c13cc15ea12137`
- Candidate manifest: `16c13cc15ea121376f466c7538b75656224002c0a23407c63567ae3395485118`
- Transaction manifest: `65be5468dfcec303eb798fc891ea9781626fb6e01ac5e37fac5b3412b6368589`
- Adapter manifest: `54c3b3773ed2043dbc6c2932188f6d80c3b6807b171c41b28046d32251fae912`

## Transaction Result

- State: `APPLIED_AWAITING_RESTART`
- Applied UTC: `2026-08-03T21:32:56.2647330Z`
- Recovery root:
  `<USER_PROFILE>/.config/opencode-recovery/compact-v2-global-20260803T213255Z`
- Journal:
  `<RECOVERY_ROOT>/transaction-journal.json`
- Seven `REPLACE` operations: all journaled `APPLIED` and verified at exact
  candidate hashes.
- One `CREATE` operation: `workflow-compact-policy.json` journaled `APPLIED` and
  verified at its exact candidate hash.
- Remaining `.compact-v2-*.tmp` files under the live root: none after exact orphan
  classification and cleanup.

## Interrupted Attempts

Two runtime-compatibility failures occurred before any live target mutation. A
complete eight-target classification proved `ALL_BEFORE` after both failures.
Their receipts are preserved at:

- `<USER_PROFILE>/.config/opencode-recovery/compact-v2-global-20260803T213011Z`
- `<USER_PROFILE>/.config/opencode-recovery/compact-v2-global-20260803T213055Z`

The first is classified `ABORTED_PRE_MUTATION / JOURNAL_CREATE_RUNTIME_COMPATIBILITY`.
The second durable journal is classified
`ABORTED_PRE_MUTATION / ATOMIC_REPLACE_RUNTIME_COMPATIBILITY`, with all operations
still `PENDING` and live classification `ALL_BEFORE`.

## Mandatory Stop

The active OpenCode process has not been restarted and cannot prove fresh registry
loading. `Live` verification, generated snapshot synchronization, Canon release,
and any live compact pilot remain blocked. The Owner must quit and restart the
affected OpenCode instance, then resume from this receipt.

GLOBAL_APPLY_AWAITING_OWNER_RESTART

## Post-Restart Verification

- Owner restart confirmation: received.
- `test-global-compact-candidate.ps1 -Mode Live`: `PASS`.
- Fresh disk/live candidate identities match all eight applied after-hashes.
- A later Owner-requested placeholder-only cheatsheet restoration is recorded
  separately in `CV2-POST-APPLY-CHEATSHEET-DELTA.md`; it does not rewrite this
  transaction's historical adapter binding.

GLOBAL_APPLY_LIVE_VERIFIED

## Snapshot Continuation

The verified live registry was captured with the official Toolbox pull and
atomically published into the Canon tooling snapshot. `Snapshot` mode and Canon
pack validation pass; see `CV2-T22-SNAPSHOT-RECEIPT.md`.

GLOBAL_APPLY_SNAPSHOT_VERIFIED
