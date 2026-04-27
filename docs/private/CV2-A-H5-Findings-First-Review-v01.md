# CV2-A-H5-Findings-First-Review-v01

## Findings

### Finding 1

```json
{
  "severity": "medium",
  "category": "contract_mismatch",
  "title": "Mock provider bypasses documented enabled-flag strictness",
  "file": "src/fractal_agent_lab/adapters/routing.py",
  "line_ref": "101-110, 268-284",
  "description": "The provider enabled-flag hardening added by commit 8f0a7f5 validates non-boolean enabled values inside _is_enabled(), but _assert_enabled() returns immediately for the mock provider before _is_enabled() is called. Current docs say providers.<provider>.enabled must be a real boolean when present, with explicit non-boolean values failing loudly. As written, providers.mock.enabled = \"false\" is not rejected when mock is selected.",
  "why_it_matters": "This weakens the stated fail-loud config contract and leaves one provider target with different malformed-config semantics than the documented Wave 4 post-closeout correction. The practical risk is lower than for real providers because mock is the safe default, but the mismatch can still hide config mistakes and confuse later H5 evidence/gate reasoning.",
  "suggested_fix": "Either validate malformed providers.mock.enabled before the mock fast path, or update the adapter contract and tests to explicitly exempt mock from enabled-flag strictness. Add a regression test for providers.mock.enabled with a non-boolean value in the selected mock path."
}
```

## Purpose

Track E `CV2-A` findings-first review artifact for the first thin H5 review/gate slice.

This artifact reviews the implementation candidate selected by Meta Coordinator:

- `8f0a7f5 Harden W4 provider enabled validation`

Wider Wave 4 provider-hardening commits are context only, not the primary reviewed candidate.

## Artifact Boundary

- Execution mode: `opencode_assisted`
- Visibility / audit state: git-visible source, tests, and docs were inspected; no live OpenAI evidence was used or claimed.
- Artifact type: private/manual thin-slice review artifact.
- This is not canonical H5 workflow output.
- This is not `data/artifacts/<run_id>/review_findings.json` because no real H5 run produced it.
- CV2-C is not decided here.
- No `commit_gate` status is made in CV2-A.

## Review Target

Primary target:

- `8f0a7f5 Harden W4 provider enabled validation`

Primary files reviewed:

- `src/fractal_agent_lab/adapters/routing.py`
- `tests/adapters/test_provider_router.py`
- `docs/Track-D-Adapter-Contract.md`

Context-only references:

- `P4-C` routing hardening v2
- `P4-D` OpenRouter-first retry/backoff
- `P4-E` local adapter MVP
- `P4-F` technical routing notes and Meta policy closeout

## Review Findings Shape

Non-canonical `review_findings`-shaped summary:

```json
{
  "status": "findings_present",
  "findings": [
    {
      "severity": "medium",
      "category": "contract_mismatch",
      "title": "Mock provider bypasses documented enabled-flag strictness",
      "file": "src/fractal_agent_lab/adapters/routing.py",
      "line_ref": "101-110, 268-284",
      "why_it_matters": "Documented enabled-flag fail-loud semantics are not uniformly applied to every provider target.",
      "suggested_fix": "Validate malformed providers.mock.enabled before the mock fast path, or explicitly document/test a mock exemption."
    }
  ],
  "residual_risks": [
    "The target commit strengthens real-provider/local enabled validation, but mock enabled-flag semantics remain ambiguous unless fixed or explicitly exempted.",
    "P4-B live provider parity remains blocked by missing OPENAI_API_KEY; this review does not alter that blocker."
  ],
  "testing_gaps": [
    "No explicit regression test covers non-boolean providers.mock.enabled on a selected mock path.",
    "OpenAI non-boolean enabled handling appears covered by generic implementation shape but is not explicitly represented in the malformed-value matrix. Treat this as contextual only; final evidence sufficiency belongs to CV2-B."
  ]
}
```

## Residual Risks

- The finding is not a provider-parity issue and does not imply live OpenAI evidence.
- The reviewed code path is provider-routing boundary logic, so future fixes belong to Track D unless Meta assigns otherwise.
- Since this is a manual/private artifact, it proves the review packet shape and finding discipline, not native H5 runtime execution.

## Testing Gaps

- `tests/adapters/test_provider_router.py` covers missing enabled keys and non-boolean enabled values for `openrouter` and `local` default-provider paths, plus `openrouter` agent-metadata selection.
- The target does not include an explicit `mock` malformed enabled test.
- The target does not explicitly include `openai` in the malformed-value matrix, although the implementation path is generic.
- Track E does not claim final test-evidence sufficiency in `CV2-A`; that belongs to `CV2-B`.

## CV2-B Handoff

Track D / Track E `CV2-B` should decide evidence sufficiency for the target commit.

Recommended evidence checks:

- Confirm whether the `mock` enabled-flag behavior is intended exemption or missing validation.
- If intended exemption, require docs/tests to say so explicitly.
- If not intended, add a regression test for non-boolean `providers.mock.enabled` and fix routing validation.
- Decide whether explicit OpenAI non-boolean enabled coverage is necessary or whether generic provider coverage is sufficient.

## Non-Goals

- No source-code changes.
- No test changes.
- No `ops/` status updates.
- No canonical H5 run artifact.
- No `commit_gate.json`.
- No commit readiness decision.
- No provider/model quality or parity claim.
