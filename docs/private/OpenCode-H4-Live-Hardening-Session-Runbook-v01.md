# OpenCode-H4-Live-Hardening-Session-Runbook-v01

## Purpose

This document is a handoff/runbook for a dedicated OpenCode session focused only on
hardening live `h4.seq_next.v1` behavior against real OpenRouter execution.

This is not a new Fractal Agent Lab workflow.
It is an operator-created OpenCode session/workstream prompt for a focused coding task.

---

## Important Clarification

When the earlier conversation said a side-agent/workstream was "started", that referred to a
temporary internal exploration subagent used for diagnosis.

It did **not** create a persistent new OpenCode chat/session.

If the project wants a real dedicated OpenCode workstream, create a separate OpenCode session
manually and use the prompt in this file as its starting context.

Suggested session name:

- `H4-Live-Hardening`

---

## Current Verified State

### What already exists in the repo

- `CV1-A` shipped `h4.wave_start.v1`
- `CV1-B` shipped `h4.seq_next.v1`
- `CV1-C` shipped a thin `wave_start` packet compiler
- `CV1-D` shipped the usefulness-check helper/script/tests
- `CV1-META1` closed the pilot and kept `CV2` blocked because usefulness evidence was not yet strong enough

### What was just proven live

The H4 seq-next workflow was run against real OpenRouter execution for:

- `Wave 4, Sprint W4-S1, P4-A planning for Track D`

Inputs/files used:

- baseline plan: `data/tmp/w4-s1-p4-a-baseline-plan.md`
- providers config: `data/tmp/providers.openrouter.yaml`

### First live OpenRouter run

Command:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli run h4.seq_next.v1 --input-json "{\"goal\":\"Wave 4, Sprint W4-S1, P4-A planning for Track D\",\"project_id\":\"FractalAgentLab\",\"session_id\":\"w4-s1-p4-a\"}" --format json --runtime-config configs/runtime.example.yaml --providers-config data/tmp/providers.openrouter.yaml --model-policy-config configs/model_policy.example.yaml --provider openrouter
```

Result:

- run id: `f11ca3c9-fee9-4749-89b5-c4153e22769f`
- status: `failed`
- failure: manager step emitted no valid control envelope

Root issue observed in the run artifact:

- synthesizer emitted `control.output` as a dotted top-level key rather than a nested `control` object

### Minimal hardening already applied in the current worktree

Track C-local prompt hardening was applied to:

- `src/fractal_agent_lab/agents/h4/prompts.py`
- `tests/agents/test_h4_pack.py`

What changed:

- `H4_SEQ_NEXT_PROMPT_VERSION` bumped to `h4.seq_next.prompt.v2`
- seq-next synthesizer role prompt version bumped to `h4/synthesizer/v3`
- prompt now explicitly requires a nested top-level `control` object
- prompt explicitly forbids dotted keys like `control.output`

### Second live OpenRouter run

Result after the prompt hardening:

- run id: `50b37e13-68e1-49d7-b182-8dd31aad6bc6`
- status: `succeeded`

Important observed outcome:

- the original control-envelope shape blocker is gone
- however, the live run still finalized too early

Observed orchestration drift:

- actual turns: `delegate repo_intake -> finalize`
- expected manager path: `delegate repo_intake -> delegate planner -> delegate architect_critic -> finalize`

### Current canonical artifact result from the successful live run

Created:

- `data/runs/50b37e13-68e1-49d7-b182-8dd31aad6bc6.json`
- `data/traces/50b37e13-68e1-49d7-b182-8dd31aad6bc6.jsonl`
- `data/artifacts/50b37e13-68e1-49d7-b182-8dd31aad6bc6/acceptance_checks.json`

Missing:

- `data/artifacts/50b37e13-68e1-49d7-b182-8dd31aad6bc6/implementation_plan.md`

Warning seen during run:

- `Warning: failed to write H4 implementation plan artifact: H4 seq_next risk_register must contain at least one well-formed risk row.`

Interpretation:

- live model output is now syntactically closer to valid manager control
- but still not semantically disciplined enough to produce the full canonical `seq_next` artifact set

### Current CV1-D result on real evidence

Command used:

```bash
PYTHONPATH=src python -m scripts.run_cv1_d_h4_usefulness_check --seq-next-run-id 50b37e13-68e1-49d7-b182-8dd31aad6bc6 --baseline-plan data/tmp/w4-s1-p4-a-baseline-plan.md --comparison-task-intent "Wave 4, Sprint W4-S1, P4-A planning for Track D" --data-dir data
```

Current outcome:

- `eval_outcome = FAIL`
- not `BLOCKED`

Why:

- real local evidence now exists
- but the H4 run is still not strong enough versus the bounded usefulness standard
- especially because `implementation_plan.md` failed to materialize and the output finalized too early

---

## Main Problem Statement

The current problem is no longer provider connectivity or basic H4 existence.

The current problem is:

- live `h4.seq_next.v1` manager discipline is still too weak under real OpenRouter execution

More specifically:

1. the manager may finalize too early instead of completing the full worker chain
2. the planner/finalized output may not preserve the structured `risk_register` row shape needed for canonical plan artifact writing
3. the result is a technically successful run that still fails the bounded usefulness check

---

## Hard Constraints For This Session

Keep the next step minimal.

Preferred scope:

- Track C-local H4 hardening first
- prompt / pack / narrowly justified live-enforcement only if necessary

Avoid by default:

- broad runtime semantic repair
- provider-framework redesign
- general OpenRouter parser expansion for this single issue
- CV2/H5 scope drift
- queue/bus/orchestration expansion
- changing the usefulness rubric to make the result look greener

Do not "solve" this by lowering the bar.

---

## Recommended Immediate Objective

Get one real OpenRouter `h4.seq_next.v1` run to satisfy both:

1. correct manager progression through the expected worker chain
2. full canonical artifact materialization:
   - `implementation_plan.md`
   - `acceptance_checks.json`

Then rerun `CV1-D` on that evidence.

---

## Likely Smallest Next Fix Target

The most likely next minimal hardening step is still on the H4/Track C side.

Specifically investigate:

1. whether the seq-next synthesizer prompt still permits premature finalize despite missing `planner` / `architect_critic`
2. whether the planner prompt needs stronger schema-shape instructions for `risk_register`
3. whether a very narrow manager-only schema reminder should be added before considering any runtime salvage

Best-first bias:

- prompt/pack hardening
- then rerun
- only then consider any narrower non-prompt enforcement

---

## Relevant Files To Inspect First

Primary:

- `src/fractal_agent_lab/agents/h4/prompts.py`
- `src/fractal_agent_lab/agents/h4/pack.py`
- `src/fractal_agent_lab/workflows/h4.py`
- `src/fractal_agent_lab/workflows/h4_artifacts.py`
- `src/fractal_agent_lab/runtime/executor.py`

Evidence and regression:

- `tests/agents/test_h4_pack.py`
- `tests/adapters/test_h4_manager_step_runner.py`
- `tests/cli/test_cv1_b_h4_seq_next_cli.py`
- `src/fractal_agent_lab/evals/cv1_d_h4_usefulness_check.py`

Concrete live evidence:

- `data/runs/f11ca3c9-fee9-4749-89b5-c4153e22769f.json`
- `data/runs/50b37e13-68e1-49d7-b182-8dd31aad6bc6.json`
- `data/traces/50b37e13-68e1-49d7-b182-8dd31aad6bc6.jsonl`
- `data/artifacts/50b37e13-68e1-49d7-b182-8dd31aad6bc6/acceptance_checks.json`

Operator input files for reuse:

- `data/tmp/w4-s1-p4-a-baseline-plan.md`
- `data/tmp/providers.openrouter.yaml`

---

## Repro Commands

### Targeted H4 regressions

```bash
PYTHONPATH=src python -m unittest tests.agents.test_h4_pack tests.workflows.test_h4_workflow_spec tests.adapters.test_h4_manager_step_runner tests.cli.test_cv1_b_h4_seq_next_cli tests.cli.test_cv1_a_h4_wave_start_cli
```

### Compile check

```bash
python -m compileall src tests
```

### Live OpenRouter rerun

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli run h4.seq_next.v1 --input-json "{\"goal\":\"Wave 4, Sprint W4-S1, P4-A planning for Track D\",\"project_id\":\"FractalAgentLab\",\"session_id\":\"w4-s1-p4-a\"}" --format json --runtime-config configs/runtime.example.yaml --providers-config data/tmp/providers.openrouter.yaml --model-policy-config configs/model_policy.example.yaml --provider openrouter
```

### Usefulness check rerun

```bash
PYTHONPATH=src python -m scripts.run_cv1_d_h4_usefulness_check --seq-next-run-id <RUN_ID> --baseline-plan data/tmp/w4-s1-p4-a-baseline-plan.md --comparison-task-intent "Wave 4, Sprint W4-S1, P4-A planning for Track D" --data-dir data
```

---

## Definition Of Done For This Session

The session should try to reach this:

1. a real OpenRouter `h4.seq_next.v1` run succeeds
2. it follows the intended worker chain honestly enough
3. both canonical seq-next artifacts materialize
4. `CV1-D` can be rerun on the new evidence
5. the result and remaining gaps are reported honestly

If this cannot be achieved with a minimal hardening step, stop and report the smallest remaining blocker.

---

## Copyable Prompt Core

Use the block below to seed a fresh OpenCode session.

```text
You are a dedicated OpenCode session named H4-Live-Hardening.

Your only purpose in this session is to harden live OpenRouter execution for h4.seq_next.v1 until it produces an honest, canonically complete seq-next planning artifact set or until you can identify the smallest remaining blocker.

Important framing:
- this is not a new FAL workflow
- this is not CV2/H5 work
- this is not provider-auth debugging unless auth truly fails
- this is not a broad runtime refactor
- prefer the smallest credible fix

Current verified state:
- CV1-A/B/C/D/META1 are implemented/closed as a thin H4 pilot stack
- a first real OpenRouter h4.seq_next.v1 run failed with invalid manager control envelope:
  run_id f11ca3c9-fee9-4749-89b5-c4153e22769f
- a minimal Track C-local prompt hardening was then applied in:
  - src/fractal_agent_lab/agents/h4/prompts.py
  - tests/agents/test_h4_pack.py
- after that, a second real OpenRouter h4.seq_next.v1 run succeeded:
  run_id 50b37e13-68e1-49d7-b182-8dd31aad6bc6
- but the run still finalized too early (delegate repo_intake -> finalize), did not produce implementation_plan.md, and CV1-D currently returns FAIL on that evidence

Current main problem:
- live manager discipline is still too weak
- planner/critic chain is not being completed reliably
- risk_register shape is not strong enough for implementation_plan.md materialization

Files to inspect first:
- src/fractal_agent_lab/agents/h4/prompts.py
- src/fractal_agent_lab/agents/h4/pack.py
- src/fractal_agent_lab/workflows/h4.py
- src/fractal_agent_lab/workflows/h4_artifacts.py
- src/fractal_agent_lab/runtime/executor.py
- tests/agents/test_h4_pack.py
- tests/adapters/test_h4_manager_step_runner.py
- tests/cli/test_cv1_b_h4_seq_next_cli.py
- src/fractal_agent_lab/evals/cv1_d_h4_usefulness_check.py
- data/runs/f11ca3c9-fee9-4749-89b5-c4153e22769f.json
- data/runs/50b37e13-68e1-49d7-b182-8dd31aad6bc6.json
- data/traces/50b37e13-68e1-49d7-b182-8dd31aad6bc6.jsonl
- data/artifacts/50b37e13-68e1-49d7-b182-8dd31aad6bc6/acceptance_checks.json
- data/tmp/w4-s1-p4-a-baseline-plan.md
- data/tmp/providers.openrouter.yaml

Constraints:
- prefer Track C-local prompt/pack hardening first
- avoid broad runtime semantic repair by default
- do not lower CV1-D standards to make the result greener
- do not widen into queue/bus/platform/CV2 work

Your immediate objective:
1. identify the smallest next hardening step
2. implement it
3. run targeted H4 regressions
4. rerun h4.seq_next.v1 with OpenRouter using the exact prior task intent
5. if seq-next succeeds and artifacts materialize, rerun CV1-D on the new run
6. stop and report honestly if the next blocker is smaller than another full redesign

Repro commands:
- PYTHONPATH=src python -m unittest tests.agents.test_h4_pack tests.workflows.test_h4_workflow_spec tests.adapters.test_h4_manager_step_runner tests.cli.test_cv1_b_h4_seq_next_cli tests.cli.test_cv1_a_h4_wave_start_cli
- python -m compileall src tests
- PYTHONPATH=src python -m fractal_agent_lab.cli run h4.seq_next.v1 --input-json "{\"goal\":\"Wave 4, Sprint W4-S1, P4-A planning for Track D\",\"project_id\":\"FractalAgentLab\",\"session_id\":\"w4-s1-p4-a\"}" --format json --runtime-config configs/runtime.example.yaml --providers-config data/tmp/providers.openrouter.yaml --model-policy-config configs/model_policy.example.yaml --provider openrouter
- PYTHONPATH=src python -m scripts.run_cv1_d_h4_usefulness_check --seq-next-run-id <RUN_ID> --baseline-plan data/tmp/w4-s1-p4-a-baseline-plan.md --comparison-task-intent "Wave 4, Sprint W4-S1, P4-A planning for Track D" --data-dir data

Definition of done for this session:
- a real OpenRouter h4.seq_next.v1 run produces the full canonical seq-next artifact set
- or you isolate the smallest remaining blocker with concrete file/line evidence and minimal next-step recommendation
```
