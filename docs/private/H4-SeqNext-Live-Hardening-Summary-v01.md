# H4-SeqNext-Live-Hardening-Summary-v01

## Scope

This note summarizes the minimal hardening applied to live `h4.seq_next.v1` execution during the OpenRouter evidence loop for:

- `Wave 4, Sprint W4-S1, P4-A planning for Track D`

This was a narrow Track C-local hardening pass.
It did not relax artifact law, did not weaken `CV1-D`, and did not widen into broad provider or runtime redesign.

## Changes Applied

### 1. Prompt hardening for manager envelope and worker discipline

Updated:

- `src/fractal_agent_lab/agents/h4/prompts.py`
- `tests/agents/test_h4_pack.py`

What changed:

- strengthened seq-next planner output shape requirements
- required `risk_register` to remain a structured object list
- required planner companion fields to remain plain string lists
- strengthened synthesizer wording so worker completion truth comes only from `context.step_results`
- made the worker check order explicit: `repo_intake -> planner -> architect_critic`
- explicitly forbade early finalize while `architect_critic` is still missing

Result:

- live output shape became canonical enough to materialize both seq-next artifacts
- live manager behavior progressed from `repo_intake -> planner -> finalize` to the intended full chain

### 2. Minimal strict runtime finalize guard

Updated:

- `src/fractal_agent_lab/runtime/executor.py`
- `tests/runtime/test_workflow_executor_manager.py`

What changed:

- under `strict_manager_control`, manager `finalize` is now rejected unless all worker steps completed
- failure details include the missing worker step ids

Result:

- premature finalize is now surfaced as an honest runtime failure instead of a misleading success
- this isolated the remaining live blocker cleanly when the model still skipped `architect_critic`

## Live Evidence Progression

### Earlier live failure

- run: `f11ca3c9-fee9-4749-89b5-c4153e22769f`
- outcome: failed
- cause: manager emitted dotted top-level `control.output` instead of nested `control`

### First post-hardening live success

- run: `50b37e13-68e1-49d7-b182-8dd31aad6bc6`
- outcome: succeeded
- improvement: control-envelope syntax blocker cleared
- remaining issue: manager finalized too early after `repo_intake`
- remaining issue: `implementation_plan.md` missing because `risk_register` shape was still invalid

### Canonical artifact success before runtime guard

- run: `886d3085-0935-4dab-80a6-6f10d4b9d93b`
- outcome: succeeded
- artifacts present:
  - `implementation_plan.md`
  - `acceptance_checks.json`
- `CV1-D` outcome: `PASS`
- remaining honesty gap: manager still skipped `architect_critic`

### Honest failure after runtime guard

- run: `8feca004-a046-4da8-bf77-6b5e5bc63726`
- outcome: failed
- cause: `Manager attempted finalize before all worker steps completed.`
- isolated missing worker: `architect_critic`

### Final live success after extra synthesizer hardening

- run: `a887ffe1-617b-426b-a1bf-d7263d022673`
- outcome: succeeded
- full manager chain:
  - `delegate repo_intake`
  - `delegate planner`
  - `delegate architect_critic`
  - `finalize`
- artifacts present:
  - `data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/implementation_plan.md`
  - `data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/acceptance_checks.json`
- `CV1-D` outcome: `PASS`

## Regression Coverage

Validated during the hardening session:

- `PYTHONPATH=src python -m unittest tests.agents.test_h4_pack tests.workflows.test_h4_workflow_spec tests.adapters.test_h4_manager_step_runner tests.cli.test_cv1_b_h4_seq_next_cli tests.cli.test_cv1_a_h4_wave_start_cli`
- `PYTHONPATH=src python -m unittest tests.runtime.test_workflow_executor_manager`
- `python -m compileall src tests`

All targeted regressions passed after the changes.

## Final State

The live `h4.seq_next.v1` path now has one real OpenRouter evidence run that is both:

- canonically complete for seq-next artifacts
- manager-honest about the full required worker chain

The bounded `CV1-D` usefulness check passes on that evidence without lowering the standard.
