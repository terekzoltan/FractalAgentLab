# COMPACT-V2 CV2-T22 Snapshot Receipt

## Source Verification

- Applied global candidate: `compact-v2-global-16c13cc15ea12137`
- Owner approval hash:
  `16c13cc15ea121376f466c7538b75656224002c0a23407c63567ae3395485118`
- Restart confirmation: received
- Post-restart `Live` contract test: `PASS`
- Official Toolbox pull validation: `PASS`
- Active inventory: 17 commands, 21 skills, 38 files
- Operational inventory SHA-256:
  `963bdc555027a6a93b2fc3df5f880fb510d60d48cb89d955d781703f921aa8a0`

The original apply used the COMPACT-V2 durable journal rather than the older
Toolbox change-set format. No incompatible historical transaction was reused.
The verified live evidence and official Toolbox pull are bound transparently in:

`<WORKSPACE_ROOT>/OpenCodeToolbox/archive/compact-v2-20260803T213256Z-16c13cc15ea1/outcome.json`

## Publication

- Publisher: official Toolbox `sync-canon-tooling-snapshot.ps1`
- Dry run: `MATCH`
- Atomic apply: `CANON_SNAPSHOT_SYNCED`
- Snapshot ID:
  `opencode-tooling-compact-v2-20260803T213256Z-16c13cc15ea1`
- Snapshot manifest SHA-256:
  `ed14ed42d61a83a73ea70b9fc361478f8da47c9621c25ea123caf53163c4ce7f`
- Payload manifest SHA-256:
  `dc1ecffd215b03774c4cf08f66971936bb6153a531b1fc8235307cb931237c5e`
- Canon version: `2.1.0`
- Snapshot status: `LIVE_VERIFIED`
- Contract alignment: `MATCH`
- Remaining sync locks or staging directories: none

## Gates

- `test-global-compact-candidate.ps1 -Mode Snapshot`: `PASS`
- `validate-pack.ps1 -HydrationTestPath test-resolver.ps1`: `PASS`
- Hydration resolver test: `PASS`
- Pack contract: `2.0.0`
- Pack Canon: `2.1.0`
- Release readiness: `READY`

No live compact pilot, commit, push, PR, merge, deploy, or public action occurred.

SNAPSHOT_SYNC_VERIFIED
