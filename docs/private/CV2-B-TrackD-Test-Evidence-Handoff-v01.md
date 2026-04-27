# CV2-B Track D Test Evidence Handoff v01

## Scope

This is the Track D evidence-capture handoff for `CV2-B`.

It records fresh verification evidence for the implementation candidate selected by Meta Coordinator review.

This is a private Markdown handoff artifact only. It is not a canonical `test_evidence.json` artifact because this slice does not have an H5 run id.

## Candidate Lock

- Target commit: `8f0a7f5 Harden W4 provider enabled validation`
- Current activation commit at execution time: `f69df1e Activate CV2 H5 review gate slice`
- Track: Track D
- Sequence item: `CV2-B`
- Track D role in this slice: capture actual test evidence and hand it off to Track E for sufficiency review
- Track D evidence-readiness label: `track_d_evidence_ready`

Track D does not make a `pass`, `pass_with_warnings`, or `hold` gate decision in this artifact.

## Preflight Evidence

| Command | Result | Output excerpt | Coverage rationale |
|---|---|---|---|
| `git status --short` | PASS | no output | Confirms the worktree was clean before evidence capture. |
| `git log --oneline -10` | PASS | `f69df1e Activate CV2 H5 review gate slice`; `8f0a7f5 Harden W4 provider enabled validation`; recent Wave 4 provider commits visible | Confirms the current branch context and candidate ancestry. |
| `git show --stat --oneline 8f0a7f5` | PASS | 3 files changed, 88 insertions(+), 6 deletions(-) | Confirms the candidate scope size. |
| `git show --name-only --oneline 8f0a7f5` | PASS | `docs/Track-D-Adapter-Contract.md`; `src/fractal_agent_lab/adapters/routing.py`; `tests/adapters/test_provider_router.py` | Confirms the candidate touched only Track D routing/test/contract surfaces. |

## Candidate Scope Summary

The candidate hardens provider enabled-flag validation at the routing boundary:

- missing provider entry remains disabled
- missing `enabled` key remains disabled
- explicit bool `enabled` values remain valid
- explicit non-bool `enabled` values now fail loudly with provider/config details

Affected files in the candidate:

- `src/fractal_agent_lab/adapters/routing.py`
- `tests/adapters/test_provider_router.py`
- `docs/Track-D-Adapter-Contract.md`

## Plan-Adherence Assessment

| Requirement | Status | Evidence |
|---|---|---|
| Target locked to `8f0a7f5` | PASS | Candidate lock section above. |
| No new provider implementation work in CV2-B | PASS | This artifact records evidence only. |
| No source changes during CV2-B except this private artifact | PASS | Final diff expected to contain only this file. |
| No config changes | PASS | Candidate and CV2-B artifact do not touch `configs/`. |
| No test code changes during CV2-B | PASS | Candidate already contains tests; CV2-B does not modify tests. |
| No `ops/` changes during CV2-B | PASS | CV2 activation is already committed in `f69df1e`; CV2-B does not edit `ops/`. |
| No `data/artifacts` changes | PASS | CV2-B does not modify run/artifact data. |
| Track D evidence readiness separated from Track E gate authority | PASS | This artifact uses `track_d_evidence_ready`, not gate statuses. |
| No provider-parity claim | PASS | P4-B remains blocked/deferred pending live OpenAI evidence. |
| No live OpenAI or live local claim | PASS | Verification here is offline/unit/eval-surface evidence only. |
| No fallback widening or OpenAI retry claim | PASS | Candidate only hardens enabled-flag parsing. |

## Required Test Evidence

| Command | Result | Test count | Output excerpt | Coverage rationale |
|---|---:|---:|---|---|
| `PYTHONPATH=src python -m unittest tests.adapters.test_provider_router` | PASS | 32 | `Ran 32 tests in 0.003s` / `OK` | Direct router policy coverage, including malformed `enabled` values, missing `enabled`, provider selection, fallback compatibility, and real-provider model requirements. |
| `PYTHONPATH=src python -m unittest tests.adapters.test_provider_router tests.adapters.test_h1_single_step_runner` | PASS | 41 | `Ran 41 tests in 0.014s` / `OK` | Adds step-runner integration adjacency so routing changes remain compatible with H1 single-step adapter execution surfaces. |
| `PYTHONPATH=src python -m unittest tests.adapters.test_openai_adapter tests.adapters.test_openrouter_adapter tests.adapters.test_local_adapter` | PASS | 49 | `Ran 49 tests in 0.010s` / `OK` | Confirms real adapter boundary tests still pass for OpenAI-compatible, OpenRouter, and local adapter surfaces after routing hardening. |
| `PYTHONPATH=src python -m unittest tests.evals.test_p4_b_h1_cross_provider_smoke` | PASS | 12 | `Ran 12 tests in 0.210s` / `OK` | Confirms the P4-B smoke comparison surface remains structurally healthy while live provider-parity evidence remains blocked. |

## Optional Broad Regression Evidence

| Command | Result | Test count | Output excerpt | Coverage rationale |
|---|---:|---:|---|---|
| `PYTHONPATH=src python -m unittest discover` | PASS | 314 | `Ran 314 tests in 2.648s` / `OK` | Optional broad regression pass across the unittest suite. Output also emitted expected CLI smoke run summaries for temporary H1 single runs. |

## No-Claim Boundaries

This handoff does not claim:

- `P4-B` completion
- provider parity
- provider quality ranking
- live OpenAI evidence
- live local server compatibility
- OpenAI retry/backoff support
- fallback widening beyond `openrouter -> mock`
- autonomous commit authority
- Track E sufficiency or gate decision

## Residual Risks / Blockers

- `P4-B` live OpenRouter + OpenAI `PASS` evidence remains blocked/deferred until an `OPENAI_API_KEY` exists.
- Local adapter evidence remains fake/injected-transport only; no live local server compatibility proof exists.
- `Retry-After` parsing remains deferred.
- This artifact is evidence for Track E review, not a gate outcome.

## Track E Handoff

Track D considers the required CV2-B test evidence captured for the locked candidate commit and labels the handoff `track_d_evidence_ready`.

Track E should independently review evidence sufficiency before any `CV2-C` advisory gate output.
