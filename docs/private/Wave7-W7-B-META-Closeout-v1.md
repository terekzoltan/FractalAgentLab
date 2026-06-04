# Wave7 W7-B Meta Closeout v1

## Status

Meta closeout for `W7-B1` and `W7-B2`.

Closeout verdict: `accepted`

Execution mode: `opencode_assisted`

## Scope Reviewed

Accepted implementation scope:

- `src/fractal_agent_lab/ingest/__init__.py`
- `src/fractal_agent_lab/ingest/opencode_loop.py`
- `tests/ingest/test_opencode_loop.py`
- `src/fractal_agent_lab/adapters/opencode_router_sources.py`
- `tests/adapters/test_opencode_router_sources.py`
- `docs/private/Wave7-W7-B1-Canonical-Artifact-Writer-And-Validators.md`
- `docs/private/Wave7-W7-B2-TrackD-Router-Selected-Output-Reader-v1.md`

## Accepted Outcomes

### W7-B1 Track B

Track B canonical writer and validators are accepted after review-fix.

Accepted proof points:

- forbidden raw/reasoning fields are rejected fail-loud before persistence
- `step_results[*].raw` only allows `source_kind` and `provider`
- clean-pass eligibility requires at least one approved checkpoint
- packet ledger `warning` or `invalid` states block clean-pass eligibility
- terminal trace references the concrete emitted `artifacts/<run_id>/opencode_loop_summary.json` sidecar
- `privacy_audit_state.excerpt_max_chars=True` is rejected
- `selected_outputs.outputs[*].excerpt_max_chars=True` is rejected
- partial-write atomicity limitation is documented and routed to W7-C1

### W7-B2 Track D

Track D selected-output reader/adapter hardening is accepted.

Accepted proof points:

- JSON-first selected-output reader remains adapter-only
- markdown fallback remains warning-grade only
- no canonical artifact writes, router mutation, session control, browser execution, or commit automation are introduced
- non-int and bool `excerpt_max_chars` values raise `OpenCodeRouterSourceError`
- adapter output stays an audit/normalization surface, not a canonical artifact schema

## Verification Evidence

Meta reran the focused W7-B acceptance checks after the final bool-as-int fix:

```text
PYTHONPATH=src python -m unittest discover -s tests/ingest -p "test_opencode_loop.py"
PASS, 15 tests

PYTHONPATH=src python -m unittest tests.evals.test_artifact_acceptance tests.tracing.test_artifact_layout
PASS, 11 tests

python -m compileall src tests
PASS

git diff --check -- "src/fractal_agent_lab/ingest/opencode_loop.py" "tests/ingest/test_opencode_loop.py"
PASS, no output
```

Track D prior verification also passed:

```text
PYTHONPATH=src python -m unittest tests.adapters.test_opencode_router_sources
PASS, 9 tests

PYTHONPATH=src python -m unittest tests.adapters.test_provider_router
PASS, 36 tests
```

## Residual Risks Routed Forward

- W7-B1 writes multiple artifacts without a transaction/staging directory. This remains an accepted MVP limitation and is routed to W7-C1 validation/privacy sufficiency for partial artifact failure/cleanup policy review.
- W7-B3 may build only the thin CLI UX surface on top of the accepted writer/reader shape. It must not introduce OpenCode control, browser execution, router mutation, session delivery, automatic dispatch, commit automation, or broader artifact schema churn.
- W7-C1 remains sequential after W7-B3 and must validate malformed source data, path traversal, missing approvals, unsupported retention, false-green loop outcomes, and the W7-B1 partial-write limitation.

## Downstream Decision

`W7-B1` and `W7-B2` are accepted.

`W7-B3` Track A ingest CLI UX planning/implementation may start.

`W7-C1` remains blocked until `W7-B3` is accepted.
