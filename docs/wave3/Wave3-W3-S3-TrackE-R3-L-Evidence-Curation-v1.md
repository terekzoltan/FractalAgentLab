# Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md

## Purpose

This document records Track E delivery for Wave 3 Sprint `W3-S3` Step 2 epic `R3-L`.

`R3-L` curates additive, portfolio-facing evidence from existing replay/validation/manual-rubric surfaces before Track A packages presentation output.

---

## Disclosure

- execution mode: `manual_policy_driven`
- visibility/audit state: git-visible coordination/code surfaces plus local `data/` artifacts were consulted; showcase-readiness conclusions below depend partly on non-git-visible local evidence

---

## Scope

In scope:

- bounded current-corpus evidence curation for H1/H2/H3
- explicit run-id manifest with schema-version and backing-mode labels
- Track A handoff-ready truth statements tied to replay/validation/manual-rubric surfaces

Out of scope:

- default fresh-run generation
- workflow hardening or template-law repair
- benchmark or winner scoring
- new canonical runtime truth surfaces

---

## Readiness Basis

`R3-L` Step 2 was open after `R3-I` + `R3-J` + `R3-K` completed.

Canonical sequencing references:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Track-E-Runbook.md`
- `ops/Track-Implementation-Runbook.md`

Dependency artifacts consumed for this curation pass:

- `docs/wave3/Wave3-W3-S3-R3-I-Project-Memory-v1.md`
- `docs/wave3/Wave3-W3-S3-TrackA-R3-J-Trace-Browser.md`
- `docs/wave3/Wave3-W3-S3-TrackE-R3-K-H1-H2-Comparison-v1.md`
- `docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-v1.md`

---

## Implemented Files

- `src/fractal_agent_lab/evals/r3_l_evidence_curation.py`
- `scripts/run_r3_l_evidence_curation.py`
- `tests/evals/test_r3_l_evidence_curation.py`
- `docs/wave3/Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Evidence Source Policy

- canonical run/trace truth remains `data/runs/<run_id>.json` + `data/traces/<run_id>.jsonl`
- artifact paths are sourced from replay/validation surfaces
- compare claims follow report truth literally (`comparison_ready` true/false)
- H3 remains single-run validated/manual-rubric evidence, not comparison evidence
- M2 remains `not demonstrated` unless selected runs show canonical project store resolved by `JSONProjectMemoryStore` plus `project_memory_update.json` sidecar

---

## Curated Manifest (Current Corpus)

### H1 (replay-backed historical set)

- `h1.single.v1` / `28624e30-7937-4137-b889-f4a696350d60` / schema `run_state.v0` / backing `replay_backed_historical`
- `h1.manager.v1` / `00c3d103-f7f6-43fc-84fb-d8006b9e333d` / schema `run_state.v0` / backing `replay_backed_historical`
- `h1.handoff.v1` / `1fe347e4-c32f-49cb-b7fe-e1bdde0b67c3` / schema `run_state.v0` / backing `replay_backed_historical`

H1 truth from curated set:

- replay smoke summary is structurally green (`smoke_passed: true`)
- this set is explicitly labeled historical replay-compatible evidence, not current-canon fresh-run evidence

### H2 (bounded corpus sweep)

Sweep set (`h2.manager.v1`):

- `54af53de-a104-4037-99a9-0ed16058155d`
- `acecfa7b-de0a-48f1-bd6e-6e8f3b1d8ead`
- `d89edd0a-4525-4ca0-8c3e-c87bfd43e70d`

H2 report truth on current corpus:

- `minimum_run_count_met: true`
- `comparison_ready: false`
- failed gate: `all_key_orders_match`

Explicit curation statement:

- H2 current corpus is not comparison-ready.

### H3 (single-run validated/manual-rubric evidence)

- primary drill-down run: `916b15fb-1f4f-4eaf-a0aa-2e2d6c0d0a2d`
- workflow: `h3.manager.v1`
- artifact validation: pass
- rubric reference: `docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-v1.md`

Explicit curation statement:

- H3 evidence is single-run validated/manual-rubric-backed and not comparison evidence.

---

## Project Memory Evidence Status (M2)

Current curated run set result:

- demonstrated: `false`
- no selected run currently shows both:
  - canonical project store resolved under `data/memory/projects/` by `JSONProjectMemoryStore` (encoded filename when needed)
  - updater sidecar: `data/artifacts/<run_id>/project_memory_update.json`

Explicit curation statement:

- M2 project-memory evidence is not demonstrated in the current curated run set.

---

## Track A Handoff Notes

- present H1 as replay-backed historical evidence (schema-version-labeled)
- present H2 exactly as non-ready on current corpus (`comparison_ready: false`)
- present H3 as single-run drill-down evidence
- avoid softened language around H2 non-ready state
- keep trace browser framing explanatory, not canonical evidence source

Recommended presentation commands:

- `PYTHONPATH=src python -m fractal_agent_lab.cli trace list --workflow-id h2.manager.v1 --format text --limit 5`
- `PYTHONPATH=src python -m fractal_agent_lab.cli trace show --run-id 916b15fb-1f4f-4eaf-a0aa-2e2d6c0d0a2d`

---

## Validation

Executed:

1. `PYTHONPATH=src python -m unittest tests.evals.test_r3_l_evidence_curation tests.evals.test_h2_run_comparison`
2. `PYTHONPATH=src python -m scripts.run_r3_l_evidence_curation --h1-single-run-id 28624e30-7937-4137-b889-f4a696350d60 --h1-manager-run-id 00c3d103-f7f6-43fc-84fb-d8006b9e333d --h1-handoff-run-id 1fe347e4-c32f-49cb-b7fe-e1bdde0b67c3 --h2-run-id 54af53de-a104-4037-99a9-0ed16058155d --h2-run-id acecfa7b-de0a-48f1-bd6e-6e8f3b1d8ead --h2-run-id d89edd0a-4525-4ca0-8c3e-c87bfd43e70d --h3-run-id 916b15fb-1f4f-4eaf-a0aa-2e2d6c0d0a2d --data-dir data`
3. `PYTHONPATH=src python -m fractal_agent_lab.cli trace show --run-id 916b15fb-1f4f-4eaf-a0aa-2e2d6c0d0a2d`

Observed:

- helper report generates explicit schema-version-labeled curated manifest rows
- H2 bounded sweep reports non-ready truth explicitly (`comparison_ready: false`)
- H3 trace drill-down remains handoff-ready for Track A packaging
- script exit `0` means the curated set is handoff-ready for Track A packaging; it does not mean H2 comparison-ready evidence exists

---

## Known Limits

- this step curates current truth and does not force corpus production
- no winner/default orchestration decision is made here
- project-memory evidence remains not demonstrated in selected current-corpus runs

---

## Downstream Handoff

- Track E `R3-L` Step 2 evidence curation is complete.
- Track A can now execute `W3-S3` Step 3 `R3-L` presentation packaging against this curated, explicitly bounded evidence set.
