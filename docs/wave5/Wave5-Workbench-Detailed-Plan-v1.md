# Wave5-Workbench-Detailed-Plan-v1

## Status

Planning artifact for Wave 5.

Authority:

- `ops/Combined-Execution-Sequencing-Plan.md` remains canonical for active sequencing and status.
- This document expands Wave 5 into Track-facing planning detail.
- Track A, Track E, and Meta Coordinator may later produce narrower implementation packets for each epic.

Current intended Wave 5 identity:

```yaml
wave: 5
theme: Workbench
primary_ui_identity: evidence_observatory
primary_user: operator
primary_truth_source: canonical_artifacts
primary_track: Track A
supporting_track: Track E
meta_role: sequencing_review_gate_status
launch_policy: staged
opencode_role: external_operator_shell
fal_role: workflow_intelligence_and_evidence_layer
```

## Purpose

Wave 5 turns Fractal Agent Lab from a CLI-first evidence system into an operator-facing local workbench.

The UI should not pretend to be a full autonomous coding product. The purpose is to make the existing FAL value visible:

- which workflow ran
- which Track or role produced what
- which run artifacts exist
- which trace events prove execution shape
- which evidence is replay-ready, partial, blocked, or failed
- which provider/model/fallback truth was observed
- which review/gate decisions were justified by evidence
- which handoff packets or next actions are ready for OpenCode/operator use

Short version:

> FAL is the workflow-intelligence and proof layer above OpenCode/LLM-assisted development, not the coding agent itself.

## Product Stance

Wave 5 should build an evidence observatory first, not a generic SaaS dashboard.

The UI should feel like an engineering cockpit for multi-agent workflow evidence:

- trace-first
- run-aware
- status-honest
- artifact-backed
- operator-oriented
- visually distinct from generic admin dashboards
- capable of becoming a launcher later without claiming autonomy too early

The first version can be visually strong without being behaviorally over-scoped. A polished observatory is allowed. A fake all-in-one workbench is not.

## Non-Goals

Wave 5 must not claim or implement:

- autonomous coding-agent control
- autonomous commit authority
- hidden OpenCode session orchestration
- provider-quality parity beyond recorded evidence
- model-quality ranking
- cross-workflow parity not backed by artifacts
- public portfolio sync by default
- mutation of canonical run/trace schemas for UI convenience
- a backend service contract before it is explicitly designed
- automatic correction of broken artifacts

## Core Evidence Law

The UI must treat these as the canonical evidence sources:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

UI summaries, indexes, manifests, caches, and display models are derived surfaces only.

Rules:

- If canonical artifacts are missing, the UI must say missing.
- If trace validation is partial, the UI must say partial.
- If a run failed, the UI must show failed rather than hide it.
- If evidence is curated rather than complete, the UI must label it curated.
- If a provider fell back, the UI must show selected provider, executed provider, and fallback truth separately.
- If an eval says `BLOCKED`, the UI must not render it as neutral or successful.
- If a feature uses fixtures, examples, or design placeholders, the UI must label them as such.

## Visual Direction

Wave 5 should avoid interchangeable dashboard design.

Recommended visual identity:

- dark observatory / lab-console base
- strong information hierarchy around run status and evidence confidence
- timeline and artifact graph as first-class layout primitives
- status chips with explicit meaning: `PASS`, `FAIL`, `BLOCKED`, `PARTIAL`, `UNKNOWN`
- visible provenance trails for workflow, provider, model, trace, eval, and review/gate source
- split-pane inspection patterns rather than marketing-card grids
- compact dense mode for operator use
- optional narrative mode later for portfolio/demo walkthroughs

Anti-slop constraints:

- Do not make a generic landing-page hero the core of U5-A.
- Do not hide raw evidence links behind only friendly summaries.
- Do not use vague success colors without labels.
- Do not collapse `blocked`, `missing`, and `failed` into the same empty state.
- Do not over-polish fake data before real artifact browsing exists.
- Do not present provider comparison as a winner board.

## Default Technology Recommendation

This document does not permanently lock the UI stack, but it recommends a default for Track A planning.

Recommended default:

- Vite + React + TypeScript under `ui/`
- local-only development posture
- no hosted service assumption
- a small UI data boundary that can consume derived JSON/index data from canonical artifacts
- later optional Python bridge for local artifact reading and FAL workflow launching

Rationale:

- the repo has no existing UI package yet
- `ui/README.md` already reserves `ui/` for trace viewer and later workbench UI
- Track A already owns CLI/run output/trace viewer surfaces
- a Vite React shell is enough for an evidence observatory without pulling in a full framework prematurely
- a local Python bridge can be introduced only when the UI needs local file access or launch behavior

Stack decisions to confirm during `U5-A` Track A planning:

- exact package manager
- whether UI starts with fixture data or a generated local artifact index
- whether a Python `fal ui ...` bridge is needed in Wave 5 or deferred
- whether tests are unit-only at first or include browser/e2e smoke

## Data Source Phasing

Wave 5 should not pretend the browser can magically read arbitrary local files safely.

Data access should be staged.

### Phase 1 - Shell / Contract Fixtures

Used by `U5-A`.

Purpose:

- establish layout, navigation, page model, state vocabulary, and visual grammar
- use small fixture objects that mirror canonical artifact shape
- mark fixture data clearly as fixture/demo if visible

### Phase 2 - Derived Artifact Index

Used by `U5-B` and `U5-C`.

Purpose:

- consume a derived run/trace index generated from `data/runs` and `data/traces`
- preserve links back to canonical artifact paths
- surface row-level degrade states from broken/missing artifacts

The index is not evidence truth. It is a browse accelerator.

### Phase 3 - Eval / Evidence Manifests

Used by `U5-E` and `U5-F`.

Purpose:

- display Track E comparison/eval semantics
- show curated evidence packages without pretending the curated view is complete corpus truth
- separate structural readiness from quality claims

### Phase 4 - Local Launch Bridge

Used by `U5-D` if accepted.

Purpose:

- allow local FAL workflow runs from UI
- preserve exact command visibility
- write normal canonical run/trace/artifact outputs
- not launch OpenCode code-edit sessions

### Phase 5 - Packet Composer

Used by `U5-D` and later coding-vertical work.

Purpose:

- generate operator handoff packets, Track packets, or command bundles
- keep OpenCode as the human-operated shell
- make next actions copyable, reviewable, and auditable

### Phase 6 - Future Session Bus Placeholder

Deferred.

Purpose:

- document the possible future path toward stronger session coordination
- explicitly prevent Wave 5 from silently implementing it

## Launch Policy

Wave 5 launch behavior is staged and bounded.

Accepted launch directions:

- `FAL run launcher`: the UI may later run local FAL workflows, using the existing runtime and canonical artifact outputs.
- `Packet Composer`: the UI may generate OpenCode/operator handoff packets, commands, or Track-ready packets.
- `Future bus placeholder`: the UI may describe a future session-bus path, but must not implement it in Wave 5.

Rejected launch meaning for Wave 5:

- the UI does not become OpenCode
- the UI does not autonomously edit code
- the UI does not autonomously commit
- the UI does not silently spawn Track sessions
- the UI does not hide the exact command or packet sent to the operator

Recommended sequencing:

- `W5-S1`: read-only observatory foundations
- `W5-S2`: local FAL run launcher and packet composer, after browsing surfaces are honest
- future wave: session bus only after separate architecture review

## Wave 5 Sprint Breakdown

Combined defines two Wave 5 sprints:

- `W5-S1`: Minimal web shell
- `W5-S2`: Workbench primitives

This document expands them below.

## W5-S1 - Evidence Observatory Foundation

### Sprint Goal

Build the local UI foundation for browsing and understanding existing FAL run/trace evidence.

This sprint should make the system visible before making it controllable.

### Sprint Non-Goals

- no OpenCode automation
- no autonomous launch
- no commit/gate automation
- no provider-quality ranking
- no hidden backend service assumption
- no broad data mutation

### Sprint Acceptance Gate

`W5-S1` is complete only when:

- a local web shell exists
- run browsing has an honest data model
- trace inspection has a clear timeline surface
- missing/invalid/partial artifacts are visible, not hidden
- visual design supports operator inspection
- Track E confirms eval/evidence labels are not misleading
- Meta confirms no-claim boundaries remain intact

## U5-A - Web Shell / Local UI

Owner: Track A.

Supporting roles: Meta for planning/review, Track E for future evidence vocabulary consultation.

### Purpose

Create the UI foundation for the evidence observatory.

`U5-A` should establish the shell, navigation, visual grammar, and data-boundary shape without pretending full artifact browsing or launch behavior already exists.

### User Value

The operator should be able to open the local UI and understand:

- what FAL is
- what kind of evidence the workbench will expose
- where run browsing will live
- where trace timelines will live
- where eval/comparison views will later live
- what is real vs fixture vs not implemented yet

### In Scope

- `ui/` application scaffold
- local web shell layout
- navigation model
- visual system primitives
- status vocabulary primitives
- placeholder pages for later Wave 5 epics
- fixture-backed components only where needed for layout proof
- explicit fixture/disclosure labels
- basic responsive behavior for desktop and narrow screens
- initial test/build commands documented by Track A

### Out of Scope

- canonical artifact crawling
- real run detail page
- real trace timeline rendering
- workflow launch
- packet generation
- eval comparison implementation
- memory inspection
- backend API design
- public deployment

### Suggested Page Model

- Overview: local evidence observatory landing page, not marketing hero
- Runs: placeholder for `U5-B`
- Trace: placeholder for `U5-C`
- Evidence: placeholder for `U5-E`
- Packets / Launch: placeholder for `U5-D`, clearly marked not active yet
- Memory / Eval: placeholder for `U5-F`

### UX Requirements

- The shell must communicate that canonical truth lives in artifacts.
- Placeholder pages must not look like completed features.
- Navigation should make the Wave 5 roadmap visible.
- Status language must match repo vocabulary where practical.
- The UI should preserve dense operator readability.

### Visual Requirements

- establish a distinctive observatory look
- support dark-mode-first unless Track A finds a strong reason not to
- use timeline/evidence/provenance motifs rather than generic SaaS cards
- make unknown/missing/blocked states visually different
- keep mobile usable enough to inspect status, not necessarily perform deep trace analysis

### Data Requirements

- no canonical data read is required in `U5-A`
- any fixture data must be small and clearly labelled
- fixture shape should anticipate run/trace/evidence fields without becoming schema law

### Acceptance Checks

- app builds or otherwise has a documented local run path
- shell renders without relying on unavailable local data
- responsive smoke check passes for desktop and narrow width
- fixture labels are visible wherever fixture data appears
- no page claims full run/trace/evidence browsing before `U5-B`/`U5-C`
- no launch UI implies live execution before `U5-D`

### Handoff To U5-B/U5-C

Track A should document:

- data adapter seam chosen
- route/page structure
- status component vocabulary
- known UI debt
- what real artifact fields the shell expects later

## U5-B - Run Listing And Run Detail Page

Owner: Track A.

Supporting roles: Track E for evidence fields, Track B only if canonical artifact interpretation becomes ambiguous.

Prerequisite: `U5-A` complete.

### Purpose

Turn the shell into a real run browser over canonical FAL artifacts or a derived index from canonical artifacts.

### User Value

The operator should be able to answer:

- what runs exist locally
- which workflow each run used
- which runs succeeded, failed, blocked, or are unreadable
- which provider/model/fallback truth is recorded
- which artifacts exist for a run
- whether a run is trace-ready or artifact-incomplete

### In Scope

- run list page
- run detail page
- artifact existence indicators
- workflow/status/provider/model fields where present
- row-level degrade policy adapted from CLI `trace list`
- links or references to canonical artifact paths
- filters for workflow/status where practical
- limit/pagination strategy for local data scale

### Out of Scope

- trace event timeline detail, except links into `U5-C`
- eval scoring or comparison semantics
- editing or deleting run artifacts
- automatic artifact repair
- provider-quality ranking
- workflow launch

### Data Requirements

Allowed data source models:

- derived artifact index generated from canonical data
- local Python bridge that reads canonical artifact paths
- static fixture only for tests, not accepted as final `U5-B` evidence

Required run fields when available:

- run id
- workflow id / variant
- status
- created/updated timestamp if present
- provider selected/executed where present
- model selected/requested/response/executed where present
- fallback truth where present
- artifact presence summary
- trace presence and validation summary

### Error / Degrade Policy

- missing run artifact: visible row error or index warning
- missing trace artifact: run may appear, trace state is `missing`
- malformed run artifact: visible `invalid_run_artifact`
- malformed trace: visible `invalid_trace_artifact`
- unknown workflow: visible `unknown`, not guessed
- missing provider metadata: visible `unknown`, not inferred from config

### Acceptance Checks

- real local artifact corpus can be browsed or an explicit generated index can be browsed
- at least one valid run and one degraded/missing/invalid case are represented in tests or documented smoke evidence
- run detail links back to canonical artifact paths
- failed/blocked runs remain visible
- no provider/model quality claims are introduced

### Handoff To U5-C

Track A should document:

- selected run detail route contract
- trace-link route parameters
- trace state vocabulary
- which fields are guaranteed vs optional

## U5-C - Trace Timeline Page

Owner: Track A.

Supporting roles: Track B if trace contract ambiguity appears, Track E for replay/eval expectations.

Prerequisite: `U5-A` complete. May run in parallel with `U5-B` after shared data seam is clear.

### Purpose

Render trace events in a timeline that makes workflow behavior inspectable without raw JSON spelunking.

### User Value

The operator should be able to answer:

- what happened in this run
- which steps executed
- which agent/role emitted or consumed key events
- where manager/handoff decisions occurred
- where failures happened
- whether trace order/linkage is valid enough to trust

### In Scope

- trace timeline view for one run
- event list with filtering/grouping where practical
- lane/step/role visual grouping where data supports it
- failure event highlighting
- parent/correlation linkage display where present
- raw event drawer or expandable payload preview
- explicit validation/degrade banner

### Out of Scope

- full graph workflow visualization unless already trivial from trace data
- editing traces
- replay execution
- quality scoring
- cross-run comparison
- hiding malformed events to make the view look clean

### Data Requirements

Trace page should consume canonical trace-derived data from:

- `data/traces/<run_id>.jsonl`
- the same artifact/index bridge selected in `U5-B`

Fields to preserve when present:

- event id
- run id
- timestamp
- event type
- step id / lane
- parent event id
- correlation id
- payload summary
- failure details

### Error / Degrade Policy

- malformed event: show event-level warning if recoverable
- non-monotonic timestamp: show trace validation warning
- missing parent/correlation target: show linkage warning
- missing trace file: show hard missing state
- unknown event type: show unknown event type, do not drop silently

### Acceptance Checks

- valid trace can be inspected from UI
- failure trace or degraded trace is visibly different from valid trace
- raw payload access or payload summary exists for debugging
- strict single-run drill-down semantics from CLI are not weakened silently
- UI does not mutate trace truth

### Handoff To W5-S2

Track A should document:

- trace display model
- validation/degrade states
- event-type rendering assumptions
- what comparison/eval views can reuse

## W5-S2 - Workbench Primitives

### Sprint Goal

Add controlled workbench behaviors on top of the read-only observatory foundation.

This sprint may introduce launching and packet generation, but only in bounded forms that preserve operator control and canonical artifact truth.

### Sprint Non-Goals

- no OpenCode automation
- no autonomous commit/gate behavior
- no hidden session bus
- no all-purpose workflow manager
- no unreviewed backend/service architecture

### Sprint Acceptance Gate

`W5-S2` is complete only when:

- launch behavior is explicit and operator-visible
- comparison semantics are Track E-defined before UI guesses them
- memory/eval inspection is honest about evidence scope
- packet generation does not imply autonomous execution
- UI-created runs still produce normal canonical artifacts

## U5-D - Workflow Launch Form And Packet Composer

Owner: Track A.

Supporting roles: Track C for workflow input semantics, Track D for provider/model config visibility, Track E for launch evidence expectations, Meta for no-autonomy boundaries.

Prerequisite: `U5-A`, `U5-B`, and `U5-C` complete.

### Purpose

Introduce the first controlled write/action surface in the UI.

`U5-D` has two accepted lanes:

- local FAL workflow launcher
- packet composer for OpenCode/operator handoff

### User Value

The operator should be able to prepare or start a FAL workflow from a structured UI without losing command transparency.

The operator should also be able to generate a packet or command bundle for OpenCode/Track work without pretending the UI controls OpenCode directly.

### Lane 1 - Local FAL Workflow Launcher

Allowed behavior:

- choose a supported FAL workflow
- enter input payload
- choose safe runtime/provider/model-policy config references where available
- preview exact command or execution envelope
- execute local FAL workflow if the selected bridge supports it
- write normal canonical artifacts
- route the resulting run into `U5-B`/`U5-C`

Required boundaries:

- no hidden provider defaults
- no hidden fallback policy changes
- no background execution without visible status
- no OpenCode/code-edit session launch
- no commit action

### Lane 2 - Packet Composer

Allowed behavior:

- generate Track packet skeletons
- generate Meta/Track handoff summaries
- generate exact CLI commands
- generate copyable OpenCode prompt/input bundle
- reference canonical runs/traces/evidence selected from the UI

Required boundaries:

- packet output is advisory/operator-mediated
- packet output is not a completed Track decision
- packet output is not a gate unless a proper gate artifact exists
- generated packets must cite source run ids/artifact paths where applicable

### Future Bus Placeholder

The UI may include a disabled or docs-only conceptual placeholder for future session-bus orchestration.

It must say:

- not implemented in Wave 5
- requires separate architecture plan
- requires stronger authority, audit, and safety model
- cannot be inferred from `U5-D`

### In Scope

- workflow selection form for a small supported set
- input JSON/editor or structured input fields
- command preview
- launch result state if local launcher is implemented
- packet composer surface
- explicit OpenCode/operator boundary language
- provider/config visibility where relevant

### Out of Scope

- arbitrary shell execution
- arbitrary code editing
- queue/session bus
- commit automation
- cross-track autonomous dispatch
- long-running daemon unless separately approved

### Acceptance Checks

- exact command or packet is visible before execution/copy
- launched FAL run writes canonical artifacts or fails visibly
- failed launch is represented honestly
- packet composer includes source provenance fields
- OpenCode remains operator-mediated
- no autonomous code/commit language appears in UI

## U5-E - Compare Two Runs

Owner: Track E for comparison semantics, then Track A for UX implementation.

Prerequisite: `U5-D` complete, matching Combined sequencing.

Track E defines comparison semantics first. Track A implements comparison UX only after Track E's comparison spec is accepted.

### Purpose

Make run comparison visible without inventing winner scoring.

### User Value

The operator should be able to compare two runs and understand:

- whether they are comparable
- what workflow/input/provider/model differences exist
- which structural outputs match or diverge
- which evidence is complete, partial, blocked, or invalid
- whether the comparison is replay-backed, curated, or manual

### Track E Semantics Scope

Track E must define:

- allowed comparison targets
- required comparable keys
- readiness labels
- blocked/fail/pass semantics where applicable
- what counts as structural comparison vs quality comparison
- what must never be rendered as winner scoring

### Track A UX Scope

Track A may implement:

- run pair selector
- comparability preflight view
- side-by-side structural output comparison
- trace/evidence links for both runs
- provider/model/fallback truth table
- warnings for mismatched inputs or incompatible workflows

### Out of Scope

- model/provider leaderboard
- quality scoring without Track E rubric
- automatic prompt optimization
- hidden normalization that changes evidence meaning
- cross-workflow claims without explicit Track E support

### Acceptance Checks

- incompatible runs are clearly blocked or warning-labelled
- matched-input requirement is visible where relevant
- provider/model/fallback differences are disclosure fields, not score fields
- Track E signs off comparison wording before Track A closes UX
- UI links back to canonical artifact sources

## U5-F - Inspect Stored Project Memory And Eval Summary

Owner: Track A.

Supporting roles: Track C for memory semantics, Track E for eval summary semantics.

Prerequisite: `U5-D` complete. Can proceed in parallel with Track E `U5-E` spec after `U5-D`.

### Purpose

Expose project memory and eval summaries as inspectable evidence surfaces.

This is not a memory editor and not a quality dashboard yet.

### User Value

The operator should be able to answer:

- what project memory exists
- which runs contributed to memory when provenance exists
- what eval/smoke summaries exist
- which evidence is current vs historical
- which claims are not yet demonstrated

### In Scope

- project memory listing/read-only inspection
- provenance display where stored
- eval summary cards/tables from existing eval artifacts or derived manifests
- clear current/historical/curated labels
- links back to run/trace/eval source files

### Out of Scope

- memory editing
- memory merge policy changes
- identity drift policy changes
- new scoring rubric
- auto-prompt rewrite
- dashboard claims that every workflow is benchmarked

### Acceptance Checks

- read-only memory inspection works for available local data or shows missing state honestly
- eval summaries distinguish current, historical, curated, blocked, and not-demonstrated evidence
- Track C confirms memory wording does not overstate semantics
- Track E confirms eval wording does not overstate evidence
- UI preserves links/provenance to source artifacts

## Meta Coordinator Gates

Meta Coordinator should run a review gate after each sprint and before opening implementation for high-risk steps.

### Before U5-A

Meta should confirm:

- Wave 4 is accepted as complete enough to open Wave 5
- Track A owns the implementation surface
- Track E is consulted on evidence vocabulary but does not own UI shell
- no public release is implied
- UI stack default is a recommendation, not a locked architecture until Track A validates it

### After U5-A

Meta should review:

- fixture vs real-data disclosure
- visual direction against anti-slop constraints
- route/page model readiness for `U5-B`/`U5-C`
- no accidental launch/autonomy claim

### After U5-B/U5-C

Meta should review:

- canonical artifact truth handling
- degraded artifact visibility
- trace validation wording
- readiness for `U5-D` launch/packet surfaces

### Before U5-D

Meta should require:

- explicit launch authority model
- command preview or packet preview law
- no OpenCode automation claim
- safe failure behavior
- canonical artifact write/read path preservation

### After W5-S2

Meta should close Wave 5 only if:

- observatory surfaces are usable
- action surfaces are bounded
- comparison/memory/eval claims are evidence-backed
- UI does not hide core limitations
- remaining risks are documented

## Track Ownership Boundaries

### Track A

Owns:

- UI shell
- UI routing/navigation
- run listing/detail UX
- trace timeline UX
- launch form UX
- packet composer UX
- memory/eval display UX

Must not own:

- eval semantics
- provider routing semantics
- memory merge semantics
- runtime schema changes
- OpenCode automation authority

### Track E

Owns:

- comparison semantics
- eval readiness labels
- smoke/evidence vocabulary
- false-green prevention in comparison views

Must not own:

- UI implementation details unless explicitly assigned
- provider routing implementation
- memory policy

### Track C

Owns:

- workflow input semantics
- prompt/role semantics
- project memory meaning
- packet content semantics where tied to H4/H5 workflow family

### Track D

Owns:

- provider/model config semantics
- provider/fallback truth interpretation when UI displays provider surfaces
- future provider launch constraints

### Track B

Owns:

- runtime and trace contract authority
- canonical artifact/schema interpretation if UI exposes ambiguous runtime fields

### Meta Coordinator

Owns:

- sequencing
- gate decisions
- no-claim boundaries
- cross-track risk review
- status sync
- public/private release policy enforcement

## Verification Strategy

Track-specific implementation packets should define exact commands, but Wave 5 expects these categories.

### U5-A Verification

- UI build command passes
- UI unit/component tests pass if introduced
- responsive smoke documented
- fixture disclosure visible
- no broken route in shell navigation

### U5-B Verification

- valid run artifact renders
- failed run artifact renders
- missing trace state renders
- malformed artifact case is tested or documented
- canonical source path is visible

### U5-C Verification

- valid trace timeline renders
- failure event renders distinctly
- malformed/non-monotonic trace warning renders if supported
- parent/correlation fields remain visible where present
- raw payload or payload summary is accessible

### U5-D Verification

- command preview or execution envelope is visible
- local FAL launch success writes canonical artifacts
- local FAL launch failure is visible
- packet composer output includes provenance
- no OpenCode automation occurs

### U5-E Verification

- comparable runs show comparison
- incompatible runs block or warn explicitly
- matched-input mismatch is visible
- provider/model/fallback fields are disclosure, not score
- Track E signs off semantics

### U5-F Verification

- memory inspection is read-only
- missing memory state is honest
- eval summary labels distinguish current/historical/curated/blocked
- Track C/E wording checks pass

## Risk Register

| Risk | Severity | Mitigation |
|---|---:|---|
| UI becomes pretty but evidence-thin | High | Trace-first observatory identity, canonical artifact law, Meta review after U5-A |
| UI hides failed/blocked runs | High | Required degrade states and acceptance checks in U5-B/U5-C |
| Launch is mistaken for OpenCode automation | High | Staged launch policy, command preview, packet composer, explicit no OpenCode automation wording |
| Browser local-file access drives bad architecture | Medium | Stage data access via derived index or local bridge, no hidden backend assumption |
| Track A guesses eval semantics | Medium | Track E owns U5-E comparison semantics before UX implementation |
| Memory UI overstates M2 meaning | Medium | Track C wording review for U5-F |
| Provider display becomes leaderboard | Medium | Provider/model fields are disclosure only, no winner scoring |
| Too much stack churn | Medium | Default stack recommendation, Track A validates before implementation |
| Public demo overclaims private evidence | Medium | Repo visibility policy and no public release by default |

## Open Questions For Track Packets

These are intentionally left for later narrower planning.

- Which package manager should Track A use in `ui/`?
- Should `U5-B` use generated JSON indexes or a small local Python bridge first?
- What exact browser/e2e test tool is appropriate, if any?
- Which existing run ids should be used as smoke fixtures for development only?
- Should `U5-D` launch support only H1 first, or H1/H2/H3/H4 according to available input forms?
- What packet format should the Packet Composer generate first: Meta packet, Track packet, or OpenCode prompt bundle?
- Should portfolio narrative mode be part of Wave 5 or left for a later release/README pass?

## Recommended Immediate Next Step

Meta Coordinator should produce a narrow `U5-A` implementation packet for Track A.

That packet should include:

- selected default stack recommendation
- owned files
- non-owned files
- page model
- fixture policy
- visual direction
- acceptance checks
- validation commands
- handoff expectations to `U5-B` and `U5-C`

Track A should not begin `U5-B`, `U5-C`, or launch work until `U5-A` closes and its data seam is documented.

## Closeout Standard

Wave 5 can close only when the UI makes FAL more inspectable and operable without weakening the project's evidence discipline.

The final Wave 5 claim should be:

> FAL now has a local operator workbench for browsing and acting on workflow evidence.

It should not be:

> FAL is now an autonomous software delivery agent.
