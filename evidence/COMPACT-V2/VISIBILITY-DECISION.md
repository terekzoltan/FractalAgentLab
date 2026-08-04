# COMPACT-V2 Visibility Decision

## Owner Decision

The Project Owner selected `Exact allowlist` after being shown that the frozen plan
requires a tracked adapter and durable sanitized evidence while the root
`.gitignore` excluded both complete trees.

## Applied Scope

The root `.gitignore` now admits only:

- `evidence/COMPACT-V2/**` sanitized lifecycle evidence;
- the 12 exact router files named by the frozen implementation allowlist,
  including the later `test-global-compact-candidate.ps1` task output.

The allowlist does not admit arbitrary router files. It re-ignores each router
subdirectory before unignoring exact paths. Verification proves an unrelated
router helper and a router documentation backup remain ignored.

The migration baseline and candidate trees remain ignored through
`data/.gitignore`. Runtime state, raw evidence, generated snapshots, credentials,
session mappings, endpoints, and transcripts remain outside tracked scope.

## Verification

- Git status exposes exactly 12 router files.
- Git status exposes 10 current sanitized COMPACT-V2 evidence files.
- Existing `ops/**` governance exceptions and `evidence/FAL-MIG-P/**` migration
  receipts predate this decision and are unchanged; they are not COMPACT-V2 scope.
- `tools/oc-session-router/scripts/send-message.ps1`: still ignored.
- router runbook backup: still ignored.
- `data/migration-candidates/compact-v2-global-v1/**`: still ignored.
- `data/migration-baselines/compact-v2-global-v1/**`: still ignored.
- No staging, commit, push, live global mutation, restart, snapshot sync, or compact
  occurred.

Independent focused re-review: `GREEN / ALLOWED`; evidence:
`evidence/COMPACT-V2/VISIBILITY-INDEPENDENT-REVIEW.md`.

VISIBILITY_DECISION_REVIEW_ACCEPTED
