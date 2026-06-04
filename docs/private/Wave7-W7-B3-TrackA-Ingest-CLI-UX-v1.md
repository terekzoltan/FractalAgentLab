# Wave7 W7-B3 TrackA Ingest CLI UX v1

## Status

Track A delivery note for `W7-B3`.

Execution mode: `opencode_assisted`

Scope verdict: `track_a_thin_ingest_cli_ux_only`

## Delivered Scope

Track A adds the first W7 ingest command surface:

```text
fal ingest router-loop --payload-path <payload.json> --mode preview|write
PYTHONPATH=src python -m fractal_agent_lab.cli ingest router-loop --payload-path <payload.json>
```

The command is a thin CLI wrapper over the accepted W7-B1 writer:

- `preview` validates the normalized payload through a temporary writer path.
- `write` delegates to `write_w7_opencode_loop_artifacts(...)` and writes canonical artifacts.
- output is available as text or stable minimal JSON.

## Command Contract

Command shape:

```text
ingest router-loop
```

Arguments:

- `--payload-path`: required normalized W7 loop payload JSON.
- `--data-dir`: target data directory for write mode; default `data`.
- `--mode`: `preview` or `write`; default `preview`.
- `--format`: `text` or `json`; default `text`.

Stable MVP JSON keys:

- `mode`
- `run_id`
- `validation_state`
- `clean_pass_eligible`
- `warnings`
- `data_dir`
- `privacy_retention_mode`
- `paths`

`paths` is populated in write mode and empty in preview mode.

## Preview Behavior

Preview mode is validation-only for the target data directory.

It uses a temporary writer path to exercise the accepted writer validation, then removes that temporary directory when the command exits.

Preview output states:

- preview is temporary validation only
- no target `data_dir` writes were performed
- target overwrite risk is proven only by write mode
- FAL ingest success is not OpenCode task success

Preview mode does not compute canonical artifact layout itself.

## Write Behavior

Write mode delegates directly to:

```python
write_w7_opencode_loop_artifacts(payload, data_dir=args.data_dir)
```

Write output states:

- canonical paths written
- `clean_pass_eligible` is writer-derived
- warnings returned by the writer
- FAL ingest success is not OpenCode task success

Writer validation errors map to CLI exit code `2`.

## Explicit Non-Goals

This slice does not implement:

- `ingest selected-output`
- router discovery
- selected-output aggregation
- `.opencode-router/**` reads or mutation
- OpenCode/session control
- browser execution
- automatic dispatch
- commit automation
- schema transformation
- CLI-owned clean-pass derivation
- Track B writer/schema changes
- Track D adapter/source-reader changes

If W7-B3 usage exposes a writer or adapter bug, Track A must stop and request Meta routing rather than fixing it inside this scope.

## Downstream Handoff

W7-C1 can consume this as the accepted CLI UX reference for canonical W7 loop ingestion.

Important downstream constraints:

- preview evidence proves payload validation only, not target overwrite readiness
- write evidence proves canonical artifacts were emitted through the W7-B1 writer
- successful FAL ingest remains separate from OpenCode task success, review approval, public export, usefulness, and commit readiness
- W7-B1 partial-write atomicity remains a known MVP limitation routed to W7-C1

## Verification

Required verification for this slice:

```text
PYTHONPATH=src python -m unittest tests.cli.test_w7_b3_ingest_cli
PYTHONPATH=src python -m unittest discover -s tests/ingest -p "test_opencode_loop.py"
PYTHONPATH=src python -m unittest tests.adapters.test_opencode_router_sources
PYTHONPATH=src python -m unittest tests.evals.test_artifact_acceptance tests.tracing.test_artifact_layout
PYTHONPATH=src python -m unittest discover -s tests/cli
python -m compileall src tests
git diff --check -- src/fractal_agent_lab/cli/app.py tests/cli/test_w7_b3_ingest_cli.py docs/private/Wave7-W7-B3-TrackA-Ingest-CLI-UX-v1.md
```
