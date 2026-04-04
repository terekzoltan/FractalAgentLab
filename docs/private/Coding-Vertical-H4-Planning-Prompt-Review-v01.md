# Coding-Vertical-H4-Planning-Prompt-Review-v01.md

## Purpose

This document records the Track C `CV0-B` review outcome for `H4` planning prompt/policy behavior.

It is a decision package and alignment note.
It is not a replacement source of truth for existing coding-vertical policy docs.

---

## Scope of this review

In scope:

- `H4` planning prompt/policy review
- role must/must-not refinement for planning behavior
- prompt provenance/versioning guidance for future `H4` packs
- cross-doc consistency checks across existing private coding-vertical docs

Out of scope:

- `H5` gate-policy rewrite
- coding artifact contract redesign
- runtime/CLI/schema changes
- wrapper/tool surface definition (`CV1-C` scope)
- executable `CV1` implementation claims

---

## Scope normalization decision

For active `CV0-B` execution, the canonical interpretation is:

- `CV0-B` = Track C `H4` planning prompt/policy review

This review intentionally does not treat `CV0-B` as a broad `H4/H5` redesign.
`H5` remains a separate review/governance surface owned by later steps and existing policy docs.

---

## Source-of-truth clarification

`H4` planning remains repo-first, but readiness/order/frontier decisions are Combined-authoritative.

Operational interpretation:

1. actual repository state
2. `ops/Combined-Execution-Sequencing-Plan.md` for readiness/order/frontier
3. `ops/AGENTS.md` for ownership and guardrails
4. relevant specialized docs
5. recent review/evidence context
6. immediate user prompt wording

If prompt assumptions conflict with Combined readiness/order, the plan must name the conflict explicitly.

---

## H4 planning behavior decisions

### Planning honesty

Every good `H4` plan should explicitly surface:

- blocked prerequisites when present
- unknowns and assumptions
- verification path (tests/smoke/validation)
- shared-zone caution when likely touched
- intentional out-of-scope boundaries

### Prompt provenance and versioning

Future `H4` prompt packs should keep explicit provenance/versioning similar in discipline to `H1`:

- explicit pack-level prompt version
- explicit role-level prompt versions
- provenance tags treated as context/provenance, not scoring signals

### Role boundaries (`H4`)

- `repo_intake`: repo/doc intake, changed-surface map, likely touched files, assumptions, unknowns
- `planner`: ordered execution plan, dependencies, test intent, docs obligations
- `architect_critic`: shared-zone risk and contract-drift warning surface
- `synthesizer`: final normalization without hiding uncertainty

---

## Artifact-contract alignment rule

`CV0-B` consumes the canonical artifact contract.
It does not redefine artifact law.

Important boundary:

- existing additive sidecar implementations are useful as path/layout/envelope pattern references
- they are not direct policy templates for coding-vertical failure semantics or canonicality

Specifically, orphan-tolerant non-canonical sidecar behavior in current runtime-adjacent flows is not, by itself, a coding-vertical validity rule.
Coding-vertical artifact validity remains governed by `docs/private/Coding-Vertical-Artifact-Contract-v01.md`.

---

## OpenCode-anchored execution model

This review reaffirms:

- OpenCode remains the control surface
- Fractal Agent Lab remains the workflow engine

`H4` policy should improve planning governance on top of that model, not replace it.

---

## Cross-doc alignment updates required by this review

This decision package is implemented by targeted refinements in:

- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md` (scope wording only)

No runtime code or schema changes are required.

---

## Downstream implication

After this `CV0-B` review closeout, the next design step remains `CV0-C` (`H5` review/gate policy review) under docs-only boundaries.

`CV1` remains blocked until its named prerequisites are complete.
