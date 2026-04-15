# Wave3-W3-S3-TrackA-R3-L-Presentation-Packaging.md

## Purpose

This document records Track A delivery for Wave 3 Sprint `W3-S3` Step 3 epic `R3-L`.

Track A packages the presentation layer for the already curated `R3-L` evidence set,
without introducing new canonical evidence surfaces.

---

## Disclosure

- execution mode: `manual_policy_driven`
- visibility/audit state: git-visible coordination/code/docs surfaces were reviewed; conclusions also rely on the existing Track E handoff doc, which itself explicitly depends partly on local `data/` artifacts

---

## Scope

In scope:

- docs-first presentation packaging for the `R3-L` curated set
- README refresh for current Wave 3 presentation posture with bounded wording
- explicit viewer-integration framing for `trace list` and `trace show`

Out of scope:

- new compare logic
- new canonical evidence truth surfaces
- new Track A presentation command
- workflow/runtime/memory semantics changes

---

## Readiness Basis

Track A Step 3 opened after:

- `R3-I` complete (Track C)
- `R3-J` complete (Track A)
- `R3-K` complete (Track E)
- `R3-L` Step 2 evidence curation complete (Track E)

Canonical references:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`
- `ops/Track-Implementation-Runbook.md`
- `ops/Track-A-Runbook.md`
- `docs/wave3/Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md`

---

## Implemented Files

- `docs/wave3/Wave3-W3-S3-TrackA-R3-L-Presentation-Packaging.md`
- `README.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

No Track A CLI code changes were required for this step.

---

## Presentation Truth Statements (Track E handoff-aligned)

- H1 = replay-backed historical evidence
- H2 = current corpus `comparison_ready: false`
- H3 = single-run validated/manual-rubric-backed evidence
- M2 = not demonstrated on the curated run set

These statements are preserved as-is from Track E curation truth and are not softened by
presentation language.

---

## Viewer Integration Posture

- `trace list` and `trace show` are explanatory navigation surfaces for packaging
- canonical evidence truth remains replay/validation/manual-rubric/curation outputs
- `trace list` must not be presented as canonical comparison evidence
- `trace show` remains strict fail-loud drill-down; `trace list` remains row-level-degrade browse

---

## Operator Walkthrough (local/private context)

The exact run-id walkthrough below is operator-local and depends on local `data/` artifacts.
It is not a portable guarantee for every clone.

H2 browse framing command:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli trace list --workflow-id h2.manager.v1 --format text --limit 5
```

H3 drill-down command:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli trace show --run-id 916b15fb-1f4f-4eaf-a0aa-2e2d6c0d0a2d
```

Curated run-id references from Track E handoff:

- H1: `28624e30-7937-4137-b889-f4a696350d60`, `00c3d103-f7f6-43fc-84fb-d8006b9e333d`, `1fe347e4-c32f-49cb-b7fe-e1bdde0b67c3`
- H2: `54af53de-a104-4037-99a9-0ed16058155d`, `acecfa7b-de0a-48f1-bd6e-6e8f3b1d8ead`, `d89edd0a-4525-4ca0-8c3e-c87bfd43e70d`
- H3: `916b15fb-1f4f-4eaf-a0aa-2e2d6c0d0a2d`

---

## Validation

Validation for this step is documentation/coordination alignment:

1. verified Track E `R3-L` curation truth statements are carried verbatim
2. verified README packaging wording stays bounded and non-portability-aware
3. verified coordination docs mark Step 3 Track A packaging closeout

---

## Known Limits

- this step does not create new evidence, only packages existing curated evidence
- exact operator walkthrough depends on local `data/` presence
- README intentionally avoids exact run-id claims to prevent pseudo-canonical interpretation

---

## Closeout

- `W3-S3` Step 3 Track A `R3-L` presentation packaging is complete in docs-first mode.
- No new CLI presentation command was introduced.
