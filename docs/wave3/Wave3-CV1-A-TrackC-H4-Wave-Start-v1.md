# Wave3-CV1-A-TrackC-H4-Wave-Start-v1

## Scope

This delivery closes `CV1-A` only.

Implemented scope:

- narrow `h4.wave_start.v1` repo-intake workflow
- explicit 3-role manager path (`repo_intake`, `architect_critic`, `synthesizer`)
- canonical `context_report.json` sidecar writing on the existing `fal run` path
- CLI-level proof that canonical run-path execution creates the H4 context report artifact

Out of scope (explicitly deferred):

- `CV1-B` planning artifacts (`implementation_plan.md`, `acceptance_checks.json`)
- adapter product specialization for H4 mock behavior
- packet bus / queue / inbox-outbox semantics
- helper-platform expansion (`CV1-C` scope)
- new CLI command surface or formatting expansion

## Implemented surfaces

Workflow and pack:

- `src/fractal_agent_lab/workflows/h4.py`
- `src/fractal_agent_lab/agents/h4/roles.py`
- `src/fractal_agent_lab/agents/h4/prompts.py`
- `src/fractal_agent_lab/agents/h4/pack.py`
- `src/fractal_agent_lab/agents/h4/__init__.py`

Registry and exports:

- `src/fractal_agent_lab/workflows/__init__.py`
- `src/fractal_agent_lab/agents/__init__.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`

Artifact path:

- `src/fractal_agent_lab/workflows/h4_artifacts.py`
- `src/fractal_agent_lab/cli/app.py` (single additive hook in existing run path)

## Artifact contract alignment

`context_report.json` is written to:

- `data/artifacts/<run_id>/context_report.json`

Envelope fields:

- `artifact_type`
- `artifact_version`
- `run_id`
- `workflow_id` (`h4`)
- `workflow_variant` (`h4.wave_start.v1`)
- `generated_at`

The output remains additive sidecar evidence and does not replace canonical run/trace truth.

Additive H4 caution fields carried in the finalized output and sidecar:

- `shared_zone_cautions`
- `sequencing_risks`
- `non_goals`

## Validation

New tests:

- `tests/workflows/test_h4_workflow_spec.py`
- `tests/agents/test_h4_pack.py`
- `tests/adapters/test_h4_manager_step_runner.py`
- `tests/cli/test_cv1_a_h4_wave_start_cli.py`

Validation emphasis:

- manager-control workflow shape is explicit
- role pack boundaries and prompt provenance are explicit
- CLI canonical path proof is explicit
- adapter product specialization remains out of scope in `CV1-A` (test-local scripting only)

## Notes

- `likely_touched_files` and `relevant_code_areas` stay hypothesis-labeled in this thin slice.
- `next_recommended_action` remains bounded wave-start guidance and does not silently become `SEQ NEXT` planning output.
- successful `h4.wave_start.v1` runs now warn explicitly if the required `context_report.json` contract is not materialized.
