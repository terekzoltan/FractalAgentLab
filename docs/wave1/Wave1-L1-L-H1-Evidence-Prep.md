# Wave1-L1-L-H1-Evidence-Prep.md

## Purpose

This document records Track E delivery for Wave 1 epic `L1-L` evidence preparation.

Track E owns the evidence package and recommendation draft. Meta owns final decision-log closeout.

---

## Scope

In scope:

- matched-input structural comparison evidence for `h1.single.v1`, `h1.manager.v1`, `h1.handoff.v1`
- inclusion of manual rubric reference (`L1-K`)
- prompt provenance capture as evidence context
- tradeoff notes and recommendation draft for Meta handoff

Out of scope:

- final winner decision (Meta closeout)
- benchmark/judge scoring
- replay/benchmark layer expansion

---

## Implemented Files

- `src/fractal_agent_lab/evals/h1_smoke_comparison.py`
- `src/fractal_agent_lab/evals/h1_evidence_prep.py`
- `src/fractal_agent_lab/evals/__init__.py`
- `scripts/run_l1_l_h1_evidence_prep.py`
- `tests/evals/test_h1_evidence_prep.py`

Status surfaces updated:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Evidence Sources

Primary canonical evidence:

- Track E comparison artifact/report from `L1-I`
- Track E manual smoke rubric result from `L1-K`

Secondary explanatory evidence surface:

- Track A trace viewer (`trace show`) for human chain reconstruction and context inspection

Trace-view fields emphasized for `L1-L` interpretation:

- `event_type`
- `step_id`
- `lane`
- `turn_index`
- `handoff_index`
- `from_step_id`
- `to_step_id`
- `parent_event_id`
- `correlation_id`

---

## Prompt Provenance Policy (L1-M aligned)

`prompt_tags` is used as provenance evidence only.

It is intentionally not a quality-scoring gate.

Per variant, evidence now captures:

- `variant`
- `pack_prompt_version`
- `executed_step_prompt_versions`

Reference points:

- JSON summary `prompt_tags`
- run artifact `output_payload.prompt_tags`

---

## Evidence-Prep Output Shape

`prepare_h1_evidence_prep(...)` returns:

- comparison summary (`all_succeeded`, `all_artifacts_valid`, `all_comparable_outputs_complete`)
- per-variant evidence block (status, artifacts, trace stats, orchestration, prompt tags)
- cross-variant prompt provenance summary
- trace-viewer guidance block
- tradeoff notes
- recommendation draft
- known limits

Script entrypoint:

```bash
PYTHONPATH=src python scripts/run_l1_l_h1_evidence_prep.py --provider mock --rubric-outcome PASS
```

---

## Validation

Executed checks:

- `PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py"`
- `PYTHONPATH=src python scripts/run_l1_l_h1_evidence_prep.py --provider mock --rubric-outcome PASS`
- `PYTHONPATH=src python -m compileall src tests scripts`

Observed:

- evidence prep output is generated for all three H1 variants
- structural readiness gate remains tied to comparison completeness
- prompt provenance appears in evidence outputs without becoming pass/fail gate logic

---

## Recommendation Draft Handling

Track E emits a provisional recommendation draft with explicit limits.

Meta uses this in the `L1-L` decision-log closeout.

No final orchestration winner is claimed in this Track E evidence-prep artifact.

---

## Downstream Handoff

- Meta consumes this evidence package to finalize `L1-L` decision log and coordination implications.
