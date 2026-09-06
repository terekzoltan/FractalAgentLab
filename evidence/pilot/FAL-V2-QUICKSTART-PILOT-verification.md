# FAL V2 quickstart pilot verification

Target: FractalAgentLab isolated pilot worktree
Epic: `FAL-V2-QUICKSTART-PILOT`
Plan: `FAL-V2-QUICKSTART-PILOT/INITIAL/v1`
Baseline HEAD: `a3292efbdfff1b990e03e6df662d5f33b198a9f1`
Evidence class: deterministic local/offline documentation verification

## Candidate artifacts

| Artifact | SHA-256 |
|---|---|
| `tools/oc-session-router/docs/v2-quickstart.md` | `1475b35bddf5168bd0afcb86d60ee98a23371569fb5658eea40bd361719da32e` |
| `plans/pilot/FAL-V2-QUICKSTART-PILOT-implementation-plan.md` | `2f14a9ce82bee3e6a1c81de1ac43b5b5e49354b22a9aa5359a051d407dd11809` |

The candidate is an uncommitted working-tree delta rooted at the baseline above.
Raw router operation, participant and session identities are retained privately
and are not copied into this receipt.

## Checks

| Check | Result |
|---|---|
| Supported runtime | PASS: `node --version` returned `v22.11.0` |
| Public facade help | PASS: interface `fal-router/v2`; 13 public actions including `help` |
| Existing disposable launcher fixture | PASS: 10 assertions, zero global changes |
| JSON examples | PASS: 6 blocks parsed |
| Relative Markdown links | PASS: 5 links resolved from the quickstart directory |
| Documented facade actions | PASS: 11 invoked actions belong to the public action set |
| Documented command flags | PASS: 11 PowerShell/facade flags belong to their declared interfaces |
| Predecessor examples | PASS: first operation omits it; later values are synthetic |
| Reconcile and recovery content | PASS: stored prepared/completed outcomes and bounded GET recovery are distinct |
| Required safety content | PASS: same-operation recovery, no blind retry, wait non-interruption and Owner-only interruption are explicit |
| Synthetic/private-key checks | PASS: 6 identity-bearing examples are synthetic; no endpoint/session/password JSON keys |
| Privacy/portability scan | PASS: 0 prohibited identity, endpoint, credential assignment, machine-root or private-operation matches |
| Compactness | PASS: 172 nonblank quickstart lines, limit 200 |
| Whitespace/diff check before receipt | PASS: `git diff --check` returned no findings |

The static checker read the quickstart, public facade and local help output. It
parsed JSON fences, resolved relative links, compared documented actions and flags
with the public interface, checked required recovery language and rejected
credential assignments, raw session/operation identity forms, endpoints, drive or
UNC roots, and workstation-specific markers. No request was submitted.

## Network and side effects

`real_server_calls=0`

- The help action was local and did not create router state.
- `scripts/test-v2-launcher.ps1` used its disposable local fixtures and reported
  `real_server_calls=0` and `global_changes=0`.
- No live `submit`, `compact`, `restore`, `observe-session`, `wait`, or `reconcile`
  action was invoked for verification.
- No credentials or private configuration were read, printed, changed or copied.
- No package or global installation, build, restart, interruption, commit, push,
  merge, deploy or publication occurred.

## Non-claims

These checks do not establish global installation, installed command bytes,
loaded behavior, live OpenCode transport compatibility, remote delivery,
exactly-once transport, AWC 5 release, Router V2 release, product acceptance,
project resumption, deployment or publication. Meta returned `ALLOWED` for the
exact candidate and Delivery returned `ACK_ONLY`; those lifecycle decisions do
not establish any non-claim above.

## Result

All planned local documentation checks passed. The accepted and acknowledged
candidate is eligible for the authorized scoped local closeout commit. This
receipt remains deterministic offline evidence, not live qualification.
