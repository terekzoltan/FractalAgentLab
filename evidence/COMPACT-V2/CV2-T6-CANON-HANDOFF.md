# COMPACT-V2 CV2-T6 Canon Handoff

## Identity

- Epic plan: `COMPACT-V2-plan-v1.1-final`
- Plan SHA-256: `4d2e1d717e31495fc7176bebf55cc9b328bb9702f283c8c1eee3e610ee510de5`
- Canon baseline HEAD: `f5218825410f0db5a69e970565d0ed475b2b91ca`
- Candidate class: dirty-worktree, no-commit Canon interface candidate
- Candidate identity: `compact-v2-canon-ce399cc626d7833e`
- Interface manifest SHA-256: `ce399cc626d7833e7f2a3de3447975ab0d027bdd6dd94139a557dbf51f9db2ec`
- Canon pack digest: `69080ed3e17343637254de77cd6662c25ce6c7db95896904fd2355967f2f720b`
- Canon version: `2.1.0` candidate; machine contract schema remains `2.0.0`

The interface-manifest digest is SHA-256 over ordinally sorted
`<relative-path>|<lowercase-sha256>` rows joined with LF and no trailing LF. The
pack digest uses the same row/ordering/encoding law over the machine contract,
`VERSION.md`, five hydration schemas, and all flat project profiles. The resolver
independently reproduced the pack digest above.

## Interface Pins

| Relative path | SHA-256 |
|---|---|
| `canon/CANONICAL-CONTRACT.json` | `d445c4d589808ca36535a84ab20c6d32f5471d77c1658ae21cf2bca91cad78a5` |
| `VERSION.md` | `c6f13f5f6b16c0d3fb485695dc57407f9024de63a62523993d85fba451572748` |
| `registry/COMPACT-BOUNDARY.schema.json` | `3b1ddf0fe22a93e40a6799e601f5e202a7a34b7e010be10e4babd27d9d543703` |
| `registry/COMPACT-POLICY.schema.json` | `3237fb6d2212e33e9c5a7dd6d0cc02734502201435a9e2ae4ccc24f54fb59a97` |
| `registry/HYDRATION-REGISTRY.schema.json` | `9876d3ca0590465d7ac95bf2a4ff33649723e49fbe745f6209f98bb3bf591bf9` |
| `registry/HYDRATION-REQUEST.schema.json` | `023582092aa4ce71bfca78f917efbc87d233368571a8e0e4f1d3cb1fa896a885` |
| `registry/HYDRATION-RESULT.schema.json` | `9621db63b27b9a44295752259c8d45b2e5c5532bae32809b60995274c0727566` |
| `scripts/resolve-hydration.ps1` | `8a3bdc7d6201bc4504bd5ccba9662350f7c64ea780c692e0fc8cb7e6b590ef69` |
| `scripts/invoke-hydration.ps1` | `ee0b7c16dfb0522d38b403113ebf2902c646c4fa2501e77c98be00313baa904f` |
| `registry/projects/fractal-agent-lab.json` | `38ebf640ee703824eff4c173ea7c26a9467d99c81f6a93062e6b1ceded9d6ba7` |

## Delivered Canon Scope

- Five-schema V1/V2 pack: compact policy, compact boundary, registry locator,
  request, and result contracts.
- V2 directory lookup, strict filename/path handling, ordered participant shape,
  same-profile role-hint binding, phase eligibility, and dynamic boundary receipt.
- Deterministic `VERIFIED | SUFFICIENT | PARTIAL | FAILED` confidence,
  `AUTO_RESUME | PROOF_REQUIRED | CONFIRM | BLOCKED` action, diagnostic classes,
  exact route-input status, and conservative V1 status projection.
- Non-persisted runtime command-identity proof is required for `AUTO_RESUME`;
  missing proof is `PROOF_REQUIRED` and malformed or mismatched proof is `BLOCKED`.
- UUID-shaped concrete runtime session identities are rejected wherever a V2
  logical participant reference is accepted or emitted.
- Verified V2 reads for `VERIFIED` and `SUFFICIENT`, including the usable
  `LEGACY_VALIDATED` projection with legacy `status: NOT_READY`.
- FAL Stage A authority paths, V2 locator, and declared
  `fal.compact-v2-maintainer` maintenance profile.
- Canon adoption, lifecycle, telemetry, FAL adapter contract, catalogs, runbooks,
  version, changelog, traceability, manifest, registry, and validator closure.
- Candidate validation separately reports release readiness. The exact older
  `LIVE_VERIFIED` Canon 2.0.0 tooling snapshot is allowed only for candidate
  validation and remains a blocking release dependency.

## Acceptance Mapping

| Acceptance | Result | Evidence |
|---|---|---|
| `CV2-AC02` V1 remains readable and fail closed | PASS | V1 branches plus resolver, invoker, compact-boundary, compatibility tests |
| `CV2-AC03` V2 boundary is role-selectable and privacy-safe | PASS | strict schema, multi-participant fixture, ambiguity/path/privacy and UUID-shaped session-reference negatives |
| `CV2-AC10` confidence/action and conservative status are deterministic | PASS | resolver/invoker assertions and machine-contract order checks |
| `CV2-AC11` guarded sufficient auto-resume | PASS | `LEGACY_VALIDATED -> SUFFICIENT + NOT_READY + AUTO_RESUME`, verifier PASS, exact route, and separate runtime command-proof missing/mismatch negatives |
| `CV2-AC12` hard-block class remains bounded | PASS for Canon scope | diagnostic-class matrix and negative cases; transport uncertainty remains adapter scope |
| `CV2-AC17` unrelated dirty work is preserved | PASS | exact baseline hashes and retained semantic markers below |
| `CV2-AC19` participant role binds to one declared eligible profile | PASS | positive maintainer fixture plus unknown, ambiguous, cross-profile, alias-only, and phase-ineligible negatives |

## Independent Review Fix Closure

The independent focused review of predecessor candidate
`compact-v2-canon-c67979ca439f423d` returned `YELLOW / FIX_REQUIRED`. Both accepted
findings are resolved in this replacement candidate:

- `CV2-R01` is resolved by a dedicated `logicalSessionRef` schema/runtime rule
  that rejects UUID-shaped concrete session identities, plus a negative boundary
  regression.
- `CV2-R02` is resolved by the non-persisted
  `-VerifiedSelectedCommandIdentity` resolver/invoker argument. Absence produces
  `COMMAND_DISCOVERY_UNAVAILABLE + PROOF_REQUIRED`; malformed or unequal proof
  produces `COMMAND_IDENTITY_MISMATCH + BLOCKED`; only exact equality permits the
  existing guarded `AUTO_RESUME` path.

## Verification Receipts

Each test ran in a separate PowerShell process, strictly serially:

| Test file | Direct result | Immutable single-file pack gate |
|---|---|---|
| `tests/hydration/test-schema-profiles.ps1` | PASS | PASS |
| `tests/hydration/test-compact-boundary.ps1` | PASS | PASS |
| `tests/hydration/test-resolver.ps1` | PASS | PASS |
| `tests/hydration/test-invoke-hydration.ps1` | PASS | PASS |
| `tests/hydration/test-project-profiles.ps1` | PASS | PASS |
| `tests/hydration/test-compatibility.ps1` | PASS | PASS |

Every pack-gate run reported:

```text
PACK VALIDATION PASSED
Contract: 2.0.0 / canon 2.1.0
Release readiness: BLOCKED
- Pinned tooling snapshot remains at Canon 2.0.0; verified sync to Canon 2.1.0 is required before release.
```

Additional final checks:

- all changed Canon JSON parsed successfully;
- PowerShell parser accepted resolver, invoker, and validator;
- `git diff --check` passed;
- After-Compact and primary runbooks stayed inside machine word budgets;
- candidate secret scan returned zero findings;
- SAST and placeholder helper tools could not persist evidence because the host
  detected a parent `.swarm` root collision; this is a tool-context limitation,
  not a passed security claim. PowerShell parsing, deterministic tests, manual
  side-effect inspection, and secret scanning remain the available evidence.

## Preservation Receipts

- `canon/PARALLELISM-AND-COORDINATION.md` remains
  `88fd985c6cfaaabde65843880736f825915289cc3b181b5bfe372cdbc21d062f`.
- Every pre-existing `reference/tooling-snapshot/**` path listed in `BASELINE.md`
  remains byte-identical to its baseline SHA-256. No generated snapshot file was
  edited by COMPACT-V2.
- Pre-existing plan-identity, review-topology, pair-sync, After-Compact opaque-ID,
  and Closeout bare-receipt semantics remain present in their dirty in-scope files.
- Protected FAL source remains
  `58c99c1c34fbf38aadb3d6ec4d62143456676a302cc6e08465f3deed03ae46a3`.
- Protected FAL test remains
  `1f5d4e24410b34ab76c08363aed2603be2c4bca986516615b347feebf4fdebab`.
- Their combined binary patch remains
  `c1178c1e364a7f03582a334e433459210f8f16e0584473b085626d6afeb0a12c`.

## Handoff Boundary And Nonclaims

- This is a review-ready Canon handoff, not independent acceptance and not a
  released Canon version.
- FAL Track D remains blocked from consuming this interface until the
  Owner-authorized independent `/step-review` accepts this exact unchanged
  candidate identity and pins.
- No FAL adapter file, live global OpenCode file, generated tooling snapshot,
  target project, public artifact, commit, push, PR, merge, deploy, or publication
  was changed.
- No live compact/summarize pilot ran.
- Global command/skill candidate construction, Owner approval, apply, restart,
  live verification, and snapshot synchronization remain later plan gates.
- FAL state and Combined are not advanced by this Delivery handoff; Meta owns that
  reconciliation after review.

## Exact Route

Independent `/step-review` over candidate `compact-v2-canon-ce399cc626d7833e`, the Canon
diff, this handoff, and `BASELINE.md`. Track D unlock requires an accepted review of
the same interface manifest and pack digest.

CANON_HANDOFF_REVIEW_READY
