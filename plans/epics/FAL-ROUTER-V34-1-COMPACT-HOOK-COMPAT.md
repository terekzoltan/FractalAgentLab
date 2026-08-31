# FAL Router v34.1 Compact hook compatibility closure

Status: `VALIDATED CANDIDATE / BOUNDARY_ROLLOUT AUTHORIZED`

Baseline: FAL router v34 (`6a55622`)

## Outcome

Two existing ordinary lifecycle operations may continue without weakening
transport authority when the auxiliary Compact Lite hook itself fails to
execute before dispatch.

## Exact scope

- For every non-`CLOSEOUT` stage, convert a thrown Compact Lite pre-dispatch
  hook execution failure into a privacy-safe
  `HOOK_EXECUTION_FAILED_NONBLOCKING` maintenance receipt.
- Preserve the existing wait/block behavior for a successfully measured
  critical-pressure or busy session.
- Preserve fail-closed technical hook behavior for `CLOSEOUT`.
- Preserve all recipient, command, source, capability, at-most-once, fence,
  pending/uncertain-send, and output-policy checks.
- Rebuild the intentionally Git-ignored compiled runtime in every consuming
  checkout after integration, then verify it against the tracked attestation.

## Non-goals

- No lifecycle dispatch, retry, auto-advance, target-state mutation, or new run.
- No Canon contract, global OpenCode command/skill, project policy, or router
  V2 architecture change.
- No relaxation of an actual Compact pressure decision or of `CLOSEOUT`.

## Validation and rollout

1. Focused Compact preflight positive/privacy/closeout-negative tests.
2. Full TypeScript build and Node router suite.
3. Compact Lite, Compact Flow, and session-context PowerShell suites.
4. Rebuilt compiled/source manifests and launcher attestation.
5. Exact diff and post-integration runtime-build verification.
6. Feature commit, main integration, protected no-send admission restoration,
   and read-only projection checks only under the Owner's accepted closure.
7. The Owner sends fresh prompts to the two project orchestrators; Codex does
   not send lifecycle commands.

## Validation result

- Focused Compact/CLI suite: `17/17 PASS`.
- Full Node router suite: `181 total / 180 PASS / 1 expected skip / 0 FAIL`.
- Session-context, Compact Flow, and Compact Lite PowerShell suites: `PASS`.
- Candidate launcher attestation and both existing run projections: `PASS`.
- `git diff --check`: `PASS`.
