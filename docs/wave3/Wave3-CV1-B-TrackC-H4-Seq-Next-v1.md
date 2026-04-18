# Wave3-CV1-B-TrackC-H4-Seq-Next-v1

## Scope

This delivery closes `CV1-B` only.

Implemented scope:

- separate `h4.seq_next.v1` workflow (distinct from `h4.wave_start.v1`)
- explicit 4-role manager path (`repo_intake`, `planner`, `architect_critic`, `synthesizer`)
- canonical run-path writing for required `CV1-B` artifacts:
  - `implementation_plan.md`
  - `acceptance_checks.json`
- embedded risk register section inside `implementation_plan.md`
- preserved caution/risk/non-goal surfaces in finalized seq-next output and artifact shaping

Clarification on `context_report.json`:

- `context_report.json` already exists canonically from `CV1-A`
- `CV1-B` requires `implementation_plan.md` and `acceptance_checks.json`
- seq-next `context_report` reuse is optional/recommended additive reuse, not a requirement rewrite

Out of scope (explicitly deferred):

- separate `risk_register.json` artifact for this thin slice
- packet bus / queue / inbox-outbox semantics
- helper-platform expansion (`CV1-C` scope)
- H5 spillover
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
- `src/fractal_agent_lab/cli/app.py` (additive hook in existing run path)

## Artifact contract alignment

`implementation_plan.md` is written to:

- `data/artifacts/<run_id>/implementation_plan.md`

`acceptance_checks.json` is written to:

- `data/artifacts/<run_id>/acceptance_checks.json`

JSON envelope fields for `acceptance_checks.json`:

- `artifact_type`
- `artifact_version`
- `run_id`
- `workflow_id` (`h4`)
- `workflow_variant` (`h4.seq_next.v1`)
- `generated_at`

`implementation_plan.md` includes YAML frontmatter with matching envelope fields.

The output remains additive sidecar evidence and does not replace canonical run/trace truth.

## Shared-boundary checkpoint

`CV1-B` intentionally does not silently absorb `adapters/mock` product-surface changes.

Default-mock `h4.seq_next.v1` runnable proof remains an explicit shared-boundary checkpoint.
If that seam becomes the only blocker, it should be handled as a narrow exception request, not silent scope widening.

## Validation

Updated/new tests:

- `tests/workflows/test_h4_workflow_spec.py`
- `tests/agents/test_h4_pack.py`
- `tests/adapters/test_h4_manager_step_runner.py`
- `tests/cli/test_cv1_b_h4_seq_next_cli.py`

Validation emphasis:

- explicit manager-control seq-next workflow shape
- planner role and pack provenance discipline
- required plan artifacts on canonical run path
- explicit warning behavior for missing required artifact fields
- preserved caution/risk/non-goal fields in finalized output and plan shaping
