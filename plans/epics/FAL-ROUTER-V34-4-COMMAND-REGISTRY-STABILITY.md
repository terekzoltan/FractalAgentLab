# FAL Router v34.4 command-registry stability

Status: `LOCAL IMPLEMENTATION VERIFIED / BOUNDARY_ROLLOUT GATED`

Baseline: FAL router v34.3 (`069f983`)

## Outcome

An ordinary OpenCode restart no longer invalidates production admission merely
because the `/command` endpoint regenerates non-executable presentation or
provenance metadata. Real command execution drift remains fail-closed and gets
an exact privacy-safe diagnostic.

## Exact scope

- Hash stable execution semantics only: command `name`, `template`, and effective
  `agent`, `model`, and `subtask` values.
- Normalize absent and `null` optional execution fields as the same default.
- Exclude `description`, `hints`, and `source` from authority identity while
  validating their known types.
- Reject every unknown command-registry field until reviewed.
- Report stable command semantic/roster mismatch as
  `LIVE_CAPABILITY / COMMAND_REGISTRY_DRIFT` with no automatic retry.
- Keep binary, version, health, OpenAPI, target, session, command roster,
  source, privacy, duplicate-send, fence, lease, and snapshot guards unchanged.

## Incident evidence

RingFall v34.3 failed before operation creation and before lifecycle send. A
privacy-safe field comparison proved that server version, binary, target,
health, OpenAPI, supported command names, and SSE matched; only server instance
and full command-registry identity differed after restart. No OpenCode command
or configuration file changed after the installed receipt was issued.

## Verification requirements

1. Restart-only description/hint/source changes preserve registry identity.
2. Template, agent, model, subtask, roster, and unknown-field changes remain
   fail-closed.
3. The exact drift diagnostic is non-retryable and emits no private material.
4. Full router runtime and applicable PowerShell suites pass.
5. Rollout refreshes protected admissions under the new attested runtime before
   any project lifecycle command is retried.

## Rollout boundary

`BOUNDARY_ROLLOUT`: RingFall remains paused at its existing exact IMPLEMENT
projection. Commit, push, integration, attestation replacement, isolated P0B,
protected no-send admission refresh, and lifecycle dispatch remain separately
authorized closure actions.

## Verification receipt

- TypeScript build: PASS.
- Router runtime suite: 188 PASS, 0 FAIL, 1 intentional baseline skip.
- Focused v34.4 transport/control-plane/diagnostic tests: 53 PASS.
- Applicable PowerShell suites: 7 PASS, including 203 review-routing assertions.
- The unchanged active-route writer suite passes in the main worktree. Its
  isolated-worktree checkout uses CRLF for a legacy backtick fixture that the
  main worktree stores as LF; this checkout-only fixture parsing difference is
  outside the v34.4 command-registry patch and is not a runtime regression.
- Diff whitespace validation: PASS.
