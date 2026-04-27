# CV2-B-TrackE-Evidence-Sufficiency-Review-v01

## Structured Summary

```yaml
evidence_sufficiency: sufficient_after_track_d_fix
cv2_c_allowed: true
clean_pass_blocked_by_rf_2026_04_27_01: false
resolved_finding: RF-2026-04-27-01
fix_commit: 6fb49cf Fix mock provider enabled validation
```

This is not a CV2-C gate decision.
`sufficient_after_track_d_fix` is not a `pass` gate status.

## Purpose

Track E evidence-sufficiency review for `CV2-B`.

This review consumes Track D's CV2-B evidence handoff for the locked implementation candidate:

- `8f0a7f5 Harden W4 provider enabled validation`

It decides whether the evidence packet is sufficient to allow `CV2-C` to start. It does not decide commit readiness.

## Scope

In scope:

- review Track D's private CV2-B test-evidence handoff
- carry forward and reconcile `RF-2026-04-27-01`
- record a Track E sufficiency conclusion
- preserve no-claim boundaries for provider parity and live provider evidence

Out of scope:

- Track D routing code fixes
- Track D test edits
- `ops/` status updates
- canonical `test_evidence.json`
- `commit_gate.json`
- `pass` / `pass_with_warnings` / `hold` gate decision

## Evidence Sources Reviewed

- `docs/private/CV2-A-H5-Findings-First-Review-v01.md`
- `docs/private/CV2-B-TrackD-Test-Evidence-Handoff-v01.md`
- `ops/Review-Findings-Registry.md` entry `RF-2026-04-27-01`
- Track D fix commit `6fb49cf Fix mock provider enabled validation`
- `ops/Combined-Execution-Sequencing-Plan.md` CV2 sequencing section
- `docs/private/Coding-Vertical-Artifact-Contract-v01.md` H5 thin-slice artifact rules

Track D reported these evidence commands as passing in its handoff:

- `PYTHONPATH=src python -m unittest tests.adapters.test_provider_router`
- `PYTHONPATH=src python -m unittest tests.adapters.test_provider_router tests.adapters.test_h1_single_step_runner`
- `PYTHONPATH=src python -m unittest tests.adapters.test_openai_adapter tests.adapters.test_openrouter_adapter tests.adapters.test_local_adapter`
- `PYTHONPATH=src python -m unittest tests.evals.test_p4_b_h1_cross_provider_smoke`
- `PYTHONPATH=src python -m unittest discover`

These are treated as Track D evidence-capture outputs. Track E does not convert them into a gate decision here.

## Track E Reproducer Evidence-Check

Before Track D's follow-up fix, Track E reran the narrow read-only reproducer for the medium finding:

```bash
PYTHONPATH=src python -c "from fractal_agent_lab.adapters.routing import ProviderRouter; r=ProviderRouter(providers_config={'default_provider':'mock','providers':{'mock':{'enabled':'false'}}}, model_policy_config={}); s=r.resolve(workflow_id='h1.single.v1', agent_spec=None); print(s.provider, s.selection_source)"
```

Observed output:

```text
mock default_provider
```

Interpretation:

- at that time, `providers.mock.enabled = "false"` did not fail loudly on the selected mock path.
- this confirmed the original `RF-2026-04-27-01` caveat before the Track D follow-up fix.
- This command is an evidence-check only, not a full validation suite.

After Track D fix commit `6fb49cf`, the same behavior is reported fixed by Track D's review/verification evidence:

- explicit non-boolean `providers.mock.enabled` fails loudly with provider/config details
- missing `providers.mock` remains accepted for the safe default mock route
- missing `providers.mock.enabled` remains accepted for the safe default mock route
- boolean `providers.mock.enabled: false` remains valid and does not disable the safe default mock route

## Sufficiency Assessment

Track E conclusion: `sufficient_after_track_d_fix`.

Meaning:

- Track D's CV2-B handoff is sufficiently scoped to the locked candidate `8f0a7f5`.
- The handoff includes targeted and broad regression evidence for the provider-enabled validation candidate.
- Track D follow-up commit `6fb49cf` resolves the medium mock-enabled strictness finding discovered by CV2-A.
- The handoff preserves no-claim boundaries for provider parity, live OpenAI evidence, live local evidence, OpenAI retry/backoff, and autonomous commit authority.
- `CV2-C` may start after this sufficiency review.
- `RF-2026-04-27-01` no longer blocks a clean gate outcome by itself, but `CV2-C` must still make its own advisory gate decision from the full evidence set.

This sufficiency finding is intentionally narrower than commit readiness.

## Resolved Finding Carried Forward

`RF-2026-04-27-01` is carried forward as fixed by Track D commit `6fb49cf`.

Summary:

- `providers.mock.enabled` could bypass the documented boolean-only enabled-flag strictness because `_assert_enabled()` returned before `_is_enabled()` validated the selected mock provider.

Severity:

- Medium

Ownership:

- Track D

Resolution recorded:

- fixed by validating malformed `providers.mock.enabled` while preserving the safe default mock route

CV2-C implication:

- this finding no longer blocks a clean pass by itself, but CV2-C should cite `6fb49cf` and its verification if treating the path as clean.

## Testing Gaps

- The original Track D evidence handoff did not include the later `6fb49cf` fix because it was produced before the follow-up correction.
- Track D's original evidence handoff did not explicitly test `openai` in the malformed enabled matrix, although the implementation path appears generic for non-mock providers.
- CV2-C should rely on the post-fix Track D verification when evaluating clean readiness.

## Residual Risks

- Treating `sufficient_after_track_d_fix` as a gate status would collapse CV2-B into CV2-C; this artifact explicitly does not do that.
- CV2-C still needs to verify or cite the Track D fix evidence before treating the path as clean.
- The original issue was not a real-provider safety blocker, but it was a contract/test/docs mismatch affecting fail-loud policy consistency.
- `P4-B` live provider parity remains blocked/deferred until `OPENAI_API_KEY` exists; this review does not change that.

## CV2-C Handoff

`CV2-C` is allowed to start after this artifact.

Required carry-forward constraints:

- `RF-2026-04-27-01` is fixed by `6fb49cf`, so CV2-C may consider a clean advisory outcome if all other evidence supports it.
- CV2-C should cite the Track D fix and verification evidence when closing this finding.
- CV2-C must still preserve no-claim boundaries for P4-B, provider parity, live OpenAI, and live local evidence.

## Non-Goals

- No source-code changes.
- No test changes.
- No `ops/` status updates.
- No canonical H5 run artifact.
- No canonical `test_evidence.json`.
- No `commit_gate.json`.
- No commit-readiness decision.
- No provider/model quality or provider-parity claim.
