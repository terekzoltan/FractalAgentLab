# Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md

## Purpose

This document records Track E delivery for Wave 1 epic `L1-K`.

`L1-K` defines a repeatable manual smoke rubric for H1 so Wave 1 can avoid false confidence before `L1-L` decision logging.

This rubric is a manual operator artifact, not a benchmark or judge-scoring system.

---

## Scope

In scope:

- manual smoke checks for `h1.single.v1`, `h1.manager.v1`, `h1.handoff.v1`
- matched-input comparison discipline across variants
- structural completeness checks for comparable H1 output fields
- artifact/trace sanity checks using existing Track E and Track A surfaces

Out of scope:

- orchestration winner selection (`L1-L`)
- automated smoke suite expansion
- benchmark growth
- LLM judge scoring

---

## Readiness Basis

`L1-K` is ready because:

- `L1-I` comparison harness is complete
- `W1-S2-FIX-E1` completeness gating is complete (`all_comparable_outputs_complete`)
- `W1-S2-FIX-A1/A2` restored H1 variant summary parity and trace linkage export
- W1-S2 stabilization is formally closed (`W1-S2-FIX-META1`)

Key references:

- `docs/Wave1-L1-I-H1-Smoke-Comparison.md`
- `docs/Wave1-L1-E-H1-Run-Summary.md`
- `docs/Wave1-W1-S2-Stabilization-Plan.md`

---

## Compared Variants

- `h1.single.v1`
- `h1.manager.v1`
- `h1.handoff.v1`

---

## Canonical Comparable Fields

All three variants are evaluated against the same H1 comparable fields:

- `clarified_idea`
- `strongest_assumptions`
- `weak_points`
- `alternatives`
- `recommended_mvp_direction`
- `next_3_validation_steps`

Manual gate rule:

- envelope presence alone is insufficient
- a comparable output is acceptable only when field completeness is satisfied

---

## Matched-Input Rule

For one rubric pass, all variants must use:

- the same input payload
- the same provider setting
- the same runtime/model-policy config set

---

## Execution Procedure

1. List workflows:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli list-workflows
```

2. Run each H1 variant with matched input and trace output:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli run h1.single.v1 --input-json '{"idea":"AI founder assistant for startup idea refinement"}' --format json --show-trace
PYTHONPATH=src python -m fractal_agent_lab.cli run h1.manager.v1 --input-json '{"idea":"AI founder assistant for startup idea refinement"}' --format json --show-trace
PYTHONPATH=src python -m fractal_agent_lab.cli run h1.handoff.v1 --input-json '{"idea":"AI founder assistant for startup idea refinement"}' --format json --show-trace
```

3. Run canonical structural comparison gate:

```bash
PYTHONPATH=src python scripts/run_l1_i_h1_smoke_comparison.py --provider mock
```

---

## Manual Smoke Rubric v1

### A. Preflight

- [ ] All three H1 variants are listable from CLI.
- [ ] Shared input payload is explicitly recorded.
- [ ] Provider/config used for all variants is explicitly recorded.

### B. Per-Variant Run Sanity

- [ ] Each variant reaches terminal status.
- [ ] Each variant has a non-empty run id.
- [ ] Each variant produces run + trace artifacts.
- [ ] Each variant returns non-empty output payload.

### C. Comparable Output Completeness

- [ ] `all_comparable_outputs_complete = true` in comparison summary.
- [ ] Every variant has `comparable_output.complete = true`.
- [ ] Every variant has `missing_keys = []`.

### D. Artifact and Trace Sanity

- [ ] `all_artifacts_valid = true` in comparison summary.
- [ ] Trace sequence/order is valid per artifact acceptance checks.
- [ ] Terminal trace events match run status.

### E. Variant-Specific Structural Checks

- [ ] Single variant (`h1.single.v1`) shows linear-lane execution and no manager-only orchestration requirement.
- [ ] Manager variant (`h1.manager.v1`) shows manager orchestration with `turn_count > 0`.
- [ ] Handoff variant (`h1.handoff.v1`) shows handoff orchestration path and non-zero `handoff_decided` count.
- [ ] Handoff linkage is preserved in JSON trace output (`parent_event_id`, `correlation_id`).

### F. Human Usefulness Gate (Manual)

- [ ] Output is understandable enough to inform next founder decisions on a real idea.
- [ ] If structural checks pass but actionability is weak, result is `PARTIAL`, not `PASS`.

### G. Documentation and Ownership

- [ ] Result is recorded as `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`.
- [ ] Any failure includes owning track for follow-up (`A`, `B`, `C`, `D`, `E`, or `Meta`).

---

## Outcome Labels

- `PASS`: all structural checks pass and output is manually usable.
- `PARTIAL`: structural run succeeds but one or more rubric checks remain weak.
- `FAIL`: one or more required structural checks fail.
- `BLOCKED`: execution cannot proceed due to upstream dependency/environment blockers.

---

## Evidence Template

Record at least:

- date/time
- input payload
- provider/config
- run ids for all three variants
- artifact paths for all three variants
- comparison script summary block
- rubric outcome label
- follow-up owner and next action (if not `PASS`)

---

## Known Limits

- Mock outputs are useful for structural smoke only, not final quality ranking.
- This rubric does not decide orchestration winner; that belongs to `L1-L`.
- This rubric does not replace replay/benchmark layers in later waves.

---

## Downstream Handoff

- `L1-L` uses this rubric plus `L1-I` evidence to prepare the baseline comparison record and recommendation notes.
