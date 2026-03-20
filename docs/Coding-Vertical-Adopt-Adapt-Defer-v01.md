# Coding-Vertical-Adopt-Adapt-Defer-v01.md

## Purpose

This document translates the local `fractalagentlab_coding_vertical_pack` into a repo-safe integration stance.

It answers one practical question:

What should Fractal Agent Lab adopt now, what should it adapt before adoption, and what should it defer until the current Wave 1 frontier is closed?

This is a coordination/design note.
It does not make the local pack canonical by itself.

---

## Source-of-truth reminder

Use this order of trust:

1. actual repository files
2. `ops/AGENTS.md`
3. `ops/Combined-Execution-Sequencing-Plan.md`
4. specialized docs
5. local/private pack material

Implication:

- the ignored local pack is a proposal surface
- this repo document is the first repo-integrated translation layer, but no longer the only one
- any later coding-vertical rollout must still align with the live frontier

### Repo-integrated follow-on docs

The current private canon for this topic now also includes:

- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `docs/private/Coding-Vertical-Artifact-Contract-v01.md`
- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `docs/private/Coding-Vertical-Learning-Loop-v01.md`

---

## Current verdict

The coding vertical idea is a strong fit for Fractal Agent Lab.

Why:

- it extends the existing inspectable/replayable/artifact-first direction instead of fighting it
- it gives the project a serious real-world workflow domain
- it matches the dual-repo privacy model well
- it naturally builds on recent hardening themes: runtime truth, structural completeness, findings-first review, and explicit gates

But:

- it is not the immediate execution frontier
- it should not displace current Wave 1 stabilization/closeout work
- it should be integrated as a later H4/H5 workflow family, not as a repo-wide reset

Short version:

> strong strategic fit, not immediate top-of-queue implementation

---

## Adopt Now

These parts are already compatible with repo direction and can safely guide future planning immediately.

### A1. Positioning

Adopt the framing of the future coding vertical as:

- better control over coding agents
- auditable multi-agent delivery loop
- repo-aware planning + review + commit gate
- workflow governance for software delivery

Why now:

- this fits the project identity in `README.md`, `ops/AGENTS.md`, and the current anti-black-box direction
- it avoids the weaker and noisier "ultimate coder" framing

### A2. Findings-first review discipline

Adopt the pack's review stance as a durable default for future coding workflows:

- findings first
- severity ordered
- file references when possible
- missing tests separated from residual risks
- short change summary only after findings

Why now:

- this already matches the review style that proved useful during Wave 1 reviews
- it aligns with `ops/Review-Findings-Registry.md` and recent stabilization practice

### A3. Commit gate as an explicit artifact

Adopt the idea that coding workflows should end with an explicit commit-readiness decision, not vague confidence language.

Recommended statuses:

- `pass`
- `pass_with_warnings`
- `hold`

Why now:

- this is consistent with the repo's increasing emphasis on anti-false-green behavior
- it gives later review automation a clean decision surface

### A4. Privacy/moat split

Adopt the rule that the best operational leverage stays private by default.

Private-by-default examples:

- strongest review/gate heuristics
- acceptance checklist libraries
- failure corpora
- trace-derived heuristics
- repo-specific planning templates
- tuned prompt packs
- benchmark gold sets
- meta playbooks

Why now:

- this directly fits the dual-repo policy
- it protects the highest-value layer without hiding the overall architecture

### A5. Learning-loop mindset

Adopt the idea that later coding-vertical quality should be improved from tracked evidence, especially:

- which reviews found real bugs
- which gates blocked correctly
- which prompt variants reduced false positives
- which planning templates worked best in different repo zones

Why now:

- this is a real moat candidate
- it is consistent with the repo's trace/eval philosophy

---

## Adapt Before Adoption

These parts are good, but should be changed to fit current repo reality.

### B1. Sequencing

Adapt the pack's rollout so it does not compete with the live Wave 1 frontier.

Current rule:

- finish `W1-S2-FIX-E1`
- finish `W1-S2-FIX-A1` and `W1-S2-FIX-A2`
- finish `W1-S2-FIX-META1`
- close `L1-J`, `L1-K`, `L1-L`, `L1-M`
- only then consider a coding-vertical design batch

Recommended insertion point:

- after normal Wave 1 closeout
- before broad new-wave expansion
- first as a design/docs batch only

### B2. Naming and family structure

Adapt the proposed tree so it matches the repo's current family-based style.

Prefer early shapes like:

- `src/fractal_agent_lab/agents/h4/`
- `src/fractal_agent_lab/agents/h5/`
- `src/fractal_agent_lab/workflows/h4.py`
- `src/fractal_agent_lab/workflows/h5.py`

Avoid starting with many micro-directories such as separate `h4_code_context`, `h4_code_plan`, `h5_code_impl`, `h5_code_review`, `h5_commit_gate` packages unless runtime reality later proves the split necessary.

Why:

- current H1 implementation is still compact and family-oriented
- the repo skeleton explicitly prefers realistic growth over fake scale

### B3. Artifact storage

Adapt the artifact contract so it extends current truth instead of replacing it.

Current canonical artifact surfaces:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`

Recommended coding-vertical approach:

- keep the current run/trace artifacts canonical
- add coding artifacts as sidecar outputs or referenced attachments
- avoid redefining `data/runs/` into per-run directories immediately

Possible later shape:

- `data/coding/<run_id>/...`
- or coding artifact references embedded inside the run artifact

### B4. Docs placement

Adapt the pack's `docs/private/` suggestion gradually.

Recommended rule:

- new coding-vertical docs may start under `docs/private/` when first created
- do not force a large repo-wide doc migration first
- if `docs/private/` is not introduced immediately, keep initial translation notes in `docs/` and move later when touched

### B5. Tooling surface

Adapt the tooling rollout to current repo size.

Good future direction:

- `src/fractal_agent_lab/tools/repo/`

But early implementation should stay narrow:

- add only the wrappers required by the first real coding workflow experiments
- do not build a broad tool garden before H4/H5 proves value

### B6. Eval layout

Adapt the eval plan to the repo's current compact structure.

Recommended early stance:

- start with one or two focused coding eval modules
- allow later migration into `src/fractal_agent_lab/evals/coding/` when the surface actually grows

### B7. Prompt pack handling

Adapt prompt-pack work so the first version is intentionally non-final.

Rule:

- seed prompts can be documented early
- stronger prompt packs should only be treated as real assets after repeated use, review evidence, and failure analysis

---

## Defer

These parts should wait until the repo has finished current Wave 1 responsibilities and the coding vertical has earned more surface area.

### C1. Full executable H4/H5 rollout

Defer full implementation waves until after Wave 1 closeout.

That includes:

- runnable H4 modules
- runnable H5 modules
- full chaining
- full coding-eval package

### C2. Large tree expansion

Defer the full proposed directory explosion until the first coding-vertical slice is real.

Reason:

- the repo is still relatively early
- the project explicitly avoids pretending it is bigger than it is

### C3. Heavy autonomous coding claims

Defer any positioning that implies:

- full autonomous PR generation
- background unattended coding as default
- "ultimate coder" branding
- black-box swarm magic

### C4. Team governance/product extraction

Defer product/startup-facing layers such as:

- team permissions/governance features
- enterprise control surface claims
- premium workflow product packaging

These may become real later, but should not drive the first integration wave.

### C5. Public release of strongest operating knowledge

Defer publication of:

- best prompt packs
- best gate policies
- failure corpora
- trace-derived heuristics
- benchmark gold sets
- strongest repo-specific templates

### C6. Advanced orchestration for coding by default

Defer making parallel swarm or handoff-heavy coding flows the default path.

Recommended order:

1. single-agent baseline
2. disciplined manager-style path
3. only later richer handoff or parallel variants

---

## Pack File Triage

This section maps the local pack files to repo-safe treatment.

### Adopt or mostly adopt

- `01-META-COORDINATOR-IMPLEMENTATION-BRIEF.md`
  - adopt the mission and positioning
  - adapt the timing and file paths

- `04-ARTIFACT-CONTRACT.md`
  - adopt the artifact-first mindset and artifact set
  - adapt storage layout to current run/trace truth

- `05-REVIEW-GATE-POLICY.md`
  - mostly adopt as the future coding review/gate north star

- `07-PRIVACY-MOAT-AND-RELEASE-POLICY.md`
  - adopt strongly

- `08-ROLLOUT-PLAN.md`
  - adopt the staged philosophy
  - adapt exact insertion into actual repo sequencing

### Adapt heavily

- `02-CODING-VERTICAL-SPEC.md`
  - good strategic base
  - adapt family naming, artifact storage, and rollout assumptions

- `03-OPS-AND-DOC-UPDATES.md`
  - useful checklist
  - adapt to current folder reality and sequencing

- `06-PROMPT-PACK-SEEDS.md`
  - keep as seed material only
  - do not treat as mature prompt IP yet

### Defer operationalization

- `09-TEMPLATES/`
  - good examples for later
  - defer canonical repo integration until H4/H5 design is approved

- `10-REPO-TREE-INSERT-SNIPPET.txt`
  - useful as scratch planning aid
  - do not apply literally yet

---

## Recommended insertion plan

### Phase 0 - Right now

Do not start coding-vertical implementation.

Do:

- keep the local pack private and ignored
- keep this assessment as the repo-integrated planning note
- preserve the current W1-S2 stabilization + Wave 1 closeout frontier

### Phase 1 - After current W1-S2 stabilization closeout

Required before any coding-vertical kickoff:

- `W1-S2-FIX-E1` complete
- `W1-S2-FIX-A1` complete
- `W1-S2-FIX-A2` complete
- `W1-S2-FIX-META1` complete
- `L1-J` complete
- `L1-K` complete
- `L1-L` complete
- `L1-M` complete

At that point, the correct next move is `CV0`, not full runtime work.

### Phase 2 - `CV0` docs-only design batch

Run a Meta-led design-only batch for the coding vertical.

Suggested scope:

- canonize H4/H5 positioning
- define initial doc set
- define minimal artifact contract extension
- define minimal review gate policy
- choose initial owners by track/session
- define the private learning-loop boundary

### Phase 3 - `CV1` thin `H4` pilot

Only after `CV0` is accepted and `H2-A` through `H2-H` are complete:

- implement a minimal H4 planning path first
- keep the tooling surface narrow
- add baseline/rubric evidence before richer orchestration

### Phase 4 - `CV2` thin `H5` review/gate slice

Only after `CV1` is accepted and the coding artifact surface is stable enough to judge honestly:

- add findings-first review artifacts
- add explicit commit-gate outputs
- keep commit authority conservative

---

## Suggested ownership for the first coding-vertical batch

### Meta Coordinator

Owns:

- sequencing decision
- doc canonicalization
- privacy boundary enforcement
- ops/runbook integration

### Track C

Owns:

- H4/H5 role definitions
- seed prompts
- workflow-family design at the agent layer

### Track D

Owns later:

- repo inspection wrappers
- test/format/commit tool boundaries

### Track E

Owns later:

- review-quality evals
- plan-adherence checks
- commit-readiness evaluation logic

### Track B

Owns only where needed:

- shared runtime and artifact contract extensions
- no premature coding-vertical-specific runtime churn without clear need

---

## Decision summary

If a new session asks "should we integrate the coding vertical now?", the correct answer is:

- `YES` as a serious future vertical
- `NO` as an immediate implementation priority
- `YES` as a post-Wave-1 design batch
- `NO` as a literal drop-in tree rewrite

That is the intended stance of this document.
