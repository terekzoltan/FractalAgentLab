# Repo-Visibility-and-Release-Policy-v01.md

## Purpose

This document defines the official repository visibility and release policy for the Fractal Agent Lab project.

It exists to make one decision explicit:

> Fractal Agent Lab officially supports a dual-repo model.

That model separates:

1. the canonical private lab repo
2. the curated public portfolio repo

This is a practical control policy, not a branding exercise.

---

## 1. Official policy decision

### Decision

Fractal Agent Lab officially uses a **dual-repo model**.

### The two repos

#### 1. Private Lab Repo
- primary development workspace
- canonical source of truth
- contains full coordination, design, research, implementation, and internal evidence

#### 2. Public Portfolio Repo
- curated external-facing mirror
- portfolio and showcase surface
- contains only selected, review-approved material

### Default rule

The private repo is primary.
The public repo is derivative.

Nothing becomes public automatically because it exists in the private repo.

---

## 2. Repo role definition

## Private Lab Repo

### Role
- canonical development environment
- full project memory for architecture and implementation decisions
- coordination surface for all tracks and Meta workflows
- research and experimentation workspace

### Canonical source of truth
The private repo is the canonical source of truth for:
- code
- planning state
- coordination rules
- architecture and design reasoning
- internal validation evidence
- current project status

### What belongs here by default
- all implementation code
- all ops coordination docs
- all internal design docs
- all research notes
- all track/session notes
- all raw evaluation evidence
- all raw traces and local artifacts

---

## Public Portfolio Repo

### Role
- recruiter-friendly portfolio surface
- clean architecture and engineering showcase
- selected documentation and examples for public reading
- optionally small demo-safe code and curated outputs

### What it is not
- not the planning control surface
- not the canonical implementation authority
- not the place for raw research exhaust
- not the place for internal coordination history

### Public repo success criteria
- understandable without private context
- visually and structurally clean
- technically honest
- contains only material safe and useful to publish

---

## 3. Visibility classes

Use these four visibility classes consistently.

### `private only`
- stays in the private repo or local machine only
- never mirrored to the public repo

### `public allowed`
- may live in the public repo directly
- no sanitization required beyond normal review

### `public mirror candidate`
- canonical version stays in the private repo
- selected copy may be mirrored to public after review

### `conditional / sanitized export only`
- may become public only after explicit cleanup, reduction, anonymization, or summarization

---

## 3A. Operational gatekeep taxonomy

Use the visibility classes above together with this practical operating taxonomy.

### `local-only`
- exists only on the local machine
- usually gitignored
- not a canonical source of truth
- good for scratch packs, raw dumps, and high-noise working material

### `private-canonical`
- versioned in the private repo
- canonical for internal truth
- may contain sensitive design, policy, or workflow knowledge
- should be the default home for durable private project intelligence

### `public-sanitizable`
- canonical version still begins in the private repo
- may later be exported in cleaned or reduced form
- should usually flow through `docs/public/` or another explicit staging surface before public release

### `never-public`
- should not be mirrored to the public repo
- may live as `private-canonical`, `local-only`, or both
- covers the strongest moat, operating heuristics, and sensitive failure evidence

### Recommended mapping

| Operational class | Typical visibility class | Default storage |
|---|---|---|
| `local-only` | `private only` | ignored local paths such as `data/` or local scratch folders |
| `private-canonical` | `private only` | versioned private repo paths such as `ops/` and `docs/private/` |
| `public-sanitizable` | `conditional / sanitized export only` or `public mirror candidate` | versioned private repo first, then explicit public export |
| `never-public` | usually `private only` | private repo and/or ignored raw evidence stores |

### Quick decision tree

1. Is this only scratch, noisy raw evidence, or a temporary local working surface?
   - classify as `local-only`
2. Is this durable internal truth that the private repo should remember and version?
   - classify as `private-canonical`
3. Could a cleaned, reduced, or abstracted version eventually be useful publicly?
   - classify as `public-sanitizable`
4. Would public release meaningfully leak moat, heuristics, failure evidence, or sensitive operating knowledge?
   - classify as `never-public`

---

## 3B. Sensitive moat classes

Treat these as `never-public` by default unless there is an unusually strong, explicit reason to abstract them first:

- tuned prompt packs and prompt-pack refinements
- failure corpora
- benchmark gold sets
- trace-derived heuristics
- repo-specific planning templates
- strongest review/gate heuristics
- Meta Coordinator playbook refinements

These may still exist in two layers:

- raw evidence in `local-only` stores
- distilled doctrine in `private-canonical` docs

---

## 4. Artifact classification matrix

| Artifact type | Default class | Private repo handling | Public repo handling | Notes |
|---|---|---|---|---|
| ops coordination files | private only | versioned in private repo | never mirror | includes `ops/AGENTS.md`, sequencing plans, runbooks |
| architecture / design docs | public mirror candidate | versioned in private repo | mirror only selected polished docs | split into public-safe and internal docs |
| experimental notes | private only | versioned or stored private only | never mirror by default | raw exploration is not portfolio material |
| session logs | private only | local/private archive only by default | never mirror | too noisy and too revealing |
| evaluation evidence | conditional / sanitized export only | keep raw evidence private | publish only summarized evidence if useful | raw judge outputs and failure details stay private |
| benchmark results | conditional / sanitized export only | keep full benchmark data private | export only curated summary tables/charts | avoid noisy or misleading raw dumps |
| example input/output | public mirror candidate | keep canonical curated examples private first | mirror sanitized examples | examples should be small, legible, stable |
| config templates | public allowed | versioned in private repo | may be copied directly | only example templates, no secrets |
| provider/model policy | conditional / sanitized export only | keep full policy private | export only generalized/safe version | internal routing heuristics may stay private |
| runtime traces | conditional / sanitized export only | keep raw traces private by default | publish only tiny redacted traces | trace shape may be public, raw histories usually not |
| local data / sqlite / jsonl artifacts | private only | local only, mostly gitignored | never mirror | operational artifacts, not portfolio docs |
| prompt packs / tuned prompt variants | private only | keep strongest versions private | export only high-level prompt philosophy if needed | strongest wording is moat |
| failure corpus | private only | raw failures stay local or private | never mirror raw corpus | may later inform sanitized lessons only |
| benchmark gold sets | private only | keep full set private | export only summarized benchmark description if useful | benchmark edge cases are moat |
| private learning heuristics | private only | version distilled policy privately | never mirror raw heuristics | especially important for coding vertical |

---

## 5. Official default by category

### Always private by default
- `ops/`
- `docs/private/`
- raw session notes
- raw experimental notes
- raw eval evidence
- raw benchmark captures
- raw runtime traces
- local `data/` artifacts
- any real provider config or secret-bearing material
- strongest prompt packs, failure corpora, and moat heuristics

### Usually private first, selectively mirror later
- architecture docs
- design docs
- workflow explainers
- curated validation reports
- example outputs

### Usually public-safe
- `README.md`
- public-facing architecture summaries
- sanitized examples
- minimal demo-safe code
- config example templates

---

## 6. Private repo directory strategy

This is the recommended private repo structure policy for the current phase.

```text
repo/
  ops/                 # private coordination only
  docs/
    public/            # public-safe docs prepared in canonical private repo first
    private/           # internal design, planning, eval, and research docs
  src/
  tests/
  examples/            # curated examples; only some may later mirror publicly
  configs/             # example templates tracked; real secrets never tracked
  data/                # local runtime artifacts, ignored
  scripts/             # internal helpers, some may later be public
  ui/
```

### Private repo directory rules

#### `ops/`
- always private
- fully versioned in the private repo
- never mirrored to the public repo

#### `docs/public/`
- public-safe docs drafted and versioned in the canonical private repo first
- these are the main mirror candidates
- use for architecture overviews, workflow explainers, polished design docs
- this is a staging surface, not an automatic export queue

#### `docs/private/`
- internal design docs
- planning notes
- internal eval notes
- research reasoning
- sensitive or unfinished architecture docs
- default home of `private-canonical` gatekept doctrine

#### `examples/`
- keep only curated, small, intentional examples
- if an example is too raw, too large, or too revealing, it belongs in `data/` or `docs/private/`, not here

#### `data/`
- local operational artifacts only
- not a documentation layer
- not a public export source by default

Recommended internal-only subareas:
- `data/private_learning/`
- `data/failure_corpus/`
- `data/benchmark_gold_private/`

These are good homes for `local-only` raw moat evidence.

### Migration note for the current repo

No forced large-scale move is required immediately.
The important rule is to start treating future docs as either:
- `docs/public/...`
- `docs/private/...`

Existing files can be moved gradually when touched.

---

## 7. Recommended public repo structure

The public repo should stay smaller and cleaner than the private repo.

```text
public-repo/
  README.md
  docs/
    architecture/
    workflows/
    design/
  examples/
    inputs/
    outputs/
    traces/
  src/                 # only if demo-safe code is intentionally published
  showcase/            # optional screenshots, diagrams, demo assets
```

### Public repo content goals

#### `README.md`
- what the project is
- why it is interesting
- what is implemented already
- clean run/demo pointers

#### `docs/architecture/`
- engine overview
- runtime architecture
- trace/eval design summary

#### `docs/workflows/`
- H1/H2/H3 public-safe workflow summaries
- orchestration rationale at a high level

#### `docs/design/`
- selected deeper technical notes worth showcasing
- only polished and public-safe documents

#### `examples/`
- small, legible sample inputs and outputs
- tiny sanitized traces
- no raw research dumps

#### `src/`
- optional
- only if you intentionally want a code-facing public showcase
- should not be a half-private mirror of the lab repo

---

## 8. .gitignore policy change

### Current decision

The current strategy of ignoring all `ops/*.md` and all `docs/**/*.md` is **not recommended anymore** under the dual-repo model.

### Why

Once the lab repo is private, those files should usually be versioned there.
Ignoring them weakens:
- auditability
- coordination history
- design traceability
- repo state fidelity

### Official recommendation

#### Private repo
- do **not** globally ignore `ops/*.md`
- do **not** globally ignore `docs/**/*.md`
- do keep local operational artifacts ignored (`data/`, SQLite, JSONL dumps, etc.)

#### Public repo
- only include selected docs intentionally copied there

### Practical rule

Visibility should be controlled by **which repo receives the artifact**, not by suppressing core markdown from version control in the private repo.

### Conclusion

The best default is:
- version private coordination/docs in the private repo
- create a separate public-doc layer for mirror candidates
- keep runtime/local artifact noise ignored

---

## 9. Release and sync policy

### Official default

Use **curated manual export** from private repo to public repo.

This is the recommended default for the current project phase.

### Why this is the best default now
- single-developer workflow
- low overhead
- maximum control
- avoids accidental leakage
- keeps the public repo intentionally designed

### Recommended export flow

1. Create or update material in the private repo first.
2. Classify it operationally as:
   - `local-only`
   - `private-canonical`
   - `public-sanitizable`
   - `never-public`
3. If it is not eligible for public release, stop there.
4. If it may become public-facing, run a Meta `visibility-release-review`.
5. Decide whether the review result is:
   - `public allowed`
   - `public-sanitizable`
   - `rejected/private-only`
6. If public-facing, polish and sanitize it in the private repo.
7. Copy the approved version manually into the public repo.
8. Review the public repo as a standalone portfolio surface.

Recommended review template:
- `docs/private/Public-Export-Review-Template-v01.md`

### Later optional tooling

Later, if repetition becomes annoying, add a small explicit export helper such as:
- `scripts/export_public_artifacts.py`

But this script should only copy from clearly approved source areas such as:
- `docs/public/`
- selected `examples/`
- selected `configs/*.example.yaml`

### Not recommended now
- automatic whole-folder mirroring
- git subtree split as the default
- submodules for public/private sync
- publishing directly from `ops/` or `docs/private/`

### Recommended GitHub baseline without `CODEOWNERS`

For the current solo/private phase, the minimum GitHub enforcement stance is:

- keep the lab repo private
- keep the public repo separate and curated
- protect `main` with PR/review discipline if you want stronger friction
- do not enable automatic public mirroring
- treat public sync as a manual Meta-level action

---

## 10. Minimum policy decisions for the current phase

These are the minimum decisions needed right now.

1. The private lab repo is canonical.
2. The public repo is curated and derivative.
3. `ops/` stays private-only.
4. Private repo markdown docs should be versioned, not globally gitignored.
5. Introduce a conceptual split between `docs/public/` and `docs/private/` going forward.
6. Raw traces, eval evidence, benchmark dumps, and local data stay private by default.
7. Only sanitized examples and polished docs are candidates for public mirroring.
8. Public sync is manual and curated by default.
9. Public repo sync is a Meta-level release action, not an automatic coding-track obligation.
10. Use the operational taxonomy `local-only` / `private-canonical` / `public-sanitizable` / `never-public` for day-to-day classification.
11. Treat moat-heavy assets as `never-public` by default.

---

## 11. Where this policy should be recorded

### 1. New canonical document
Create and maintain:
- `docs/Repo-Visibility-and-Release-Policy-v01.md`

This document should hold the full policy.

### 2. `ops/AGENTS.md`
Add a short permanent rule set:
- dual-repo model is official
- private repo is canonical
- public repo is curated mirror only
- coordination docs remain private
- reference this policy doc

### 3. `ops/Meta-Coordinator-Runbook.md`
Add Meta responsibilities:
- visibility/release review
- export approval discipline
- public sync is explicit, not automatic
- reference this policy doc

### 4. `ops/Combined-Execution-Sequencing-Plan.md`
Only add a small operational note:
- public repo sync is not implied by epic completion
- if a public release is desired, it must be declared as explicit Meta/release work

Do not overload the sequencing plan with the full visibility policy.

### 5. `docs/Repo-Skeleton-v01.md`
Add structural guidance:
- `docs/public/`
- `docs/private/`
- note that `ops/` is private-only in the lab repo

---

## 12. Meta vs track ownership of this policy

### Primary classification

This is **Meta-Coordinator-only policy** in ownership terms.

Why:
- it defines repo governance
- it controls visibility and release boundaries
- it is not a product/runtime feature

### Required downstream handoffs

Even though Meta owns the policy, some parts must be handed off explicitly.

#### Track E must receive
- rules for raw eval evidence vs public-safe validation summaries
- rules for benchmark result publishing
- rules for runtime trace sanitization before any public export

#### Track D must receive
- rules for public-safe config templates
- rule that real provider configs, secrets, and detailed routing heuristics stay private unless sanitized

#### Track A should receive later
- rules for public showcase assets, screenshots, trace viewer examples, and portfolio packaging

#### Track C should receive as needed
- rules for prompt/design doc publicization and how much workflow reasoning becomes public-facing documentation

### Current minimum handoff set

For the current phase, only these handoffs are mandatory:
- Meta -> Track E
- Meta -> Track D

Track A handoff becomes more important when the public showcase repo starts getting real UX/demo material.

---

## 13. Recommended Default

1. Officially adopt the dual-repo model now.
2. Treat the private lab repo as the only canonical source of truth.
3. Treat the public repo as a curated showcase, never as the control plane.
4. Keep `ops/` private-only and versioned in the private repo.
5. Stop globally gitignoring private markdown docs in the private repo.
6. Start a forward-looking split between `docs/public/` and `docs/private/`.
7. Keep raw eval evidence, benchmark dumps, traces, and local artifacts private by default.
8. Allow public export only for polished docs, sanitized examples, and safe config templates.
9. Use manual curated export as the default sync mechanism.
10. Make public sync a Meta-reviewed release action, not an automatic side effect of implementation.
11. Use `docs/private/` for durable private doctrine and `data/` for raw local-only evidence.
12. Treat tuned prompt packs, failure corpora, benchmark gold sets, and private heuristics as `never-public` by default.

---

## Final statement

The correct mental model for Fractal Agent Lab is:

> one private canonical lab repo,
> plus one curated public portfolio repo.

That gives the project the right mix of:
- control
- auditability
- secrecy where useful
- and strong portfolio presentation where valuable

without forcing the internal lab to perform as a public artifact all the time.
