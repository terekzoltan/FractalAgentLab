# Wave6 W6-S3 Meta W6-H Target Readiness Brief

## Status

Meta Coordinator target readiness brief for `W6-H` Step 1.

Execution mode: `opencode_assisted`

Visibility / audit state:

- tracked Wave 6 planning and W6-G closeout docs were consulted
- local-only `ops/` coordination docs were consulted for current sequencing truth
- WorldSim repo location and top-level repo-visible docs were inspected read-only
- Track E read-only readiness planning packet was consulted as review/support input
- no raw `data/evidence/wave6/**` artifact was created or committed while drafting this brief
- no WorldSim file was modified while drafting this brief

Readiness verdict: `READY_WITH_GUARDRAILS` for one narrow private external loop under `W6-I`, only after Meta accepts this W6-H brief.

## Purpose

`W6-H` must decide whether an external target repo is safe and useful for one private Wave 6 evidence loop.

This step does not run the loop. It only decides whether the candidate repo, task shape, privacy boundaries, and first sequence item are suitable for one later `W6-I` external trial.

## Selected Candidate Repo

Selected candidate:

- target repo: `WorldSim`
- repo location: `C:\EGYETEM\FUNSTUFF\WorldSim`
- target type: external private repo
- readiness posture: `READY_WITH_GUARDRAILS`

Primary reasons:

- the repo is real, local, modular, and testable
- it already has a structured planning/review workflow surface
- it exposes a safe docs-only first-loop candidate that does not require live services, deploys, or secrets
- it has a built-in headless validation surface (`WorldSim.ScenarioRunner`) for later waves if a code-adjacent external loop is needed

## Repo Summary

Repo-visible structure confirms a modular .NET solution plus a Java refinery service:

- `WorldSim.App/` = MonoGame host and wiring
- `WorldSim.Runtime/` = simulation core
- `WorldSim.AI/` = planner logic
- `WorldSim.Graphics/` = rendering/HUD
- `WorldSim.Contracts/` = shared DTO contracts
- `WorldSim.RefineryAdapter/` = Java patch-to-runtime command bridge
- `WorldSim.RefineryClient/` = HTTP client + parser
- `WorldSim.ScenarioRunner/` = headless evidence/regression runner
- `refinery-service-java/` = Java Spring Boot live/LLM-capable subsystem

Observed test/build surface from `README.md`:

- `dotnet build WorldSim.sln`
- `dotnet test WorldSim.sln`
- `dotnet test WorldSim.ArchTests/WorldSim.ArchTests.csproj`
- `dotnet test WorldSim.Runtime.Tests/WorldSim.Runtime.Tests.csproj`
- `dotnet run --project WorldSim.ScenarioRunner`

## Active Workflow Need

Preferred current workflow need for the first external loop:

- docs-only audit-plan merge-readiness review/fix on the current WorldSim branch

Why this is the preferred first external loop:

- it matches the repo's currently active planning/review state as reported by Track E
- it keeps the first external loop narrow and reversible
- it avoids runtime, graphics, refinery, live-service, and secret-bearing surfaces
- it allows Wave 6 to test external private review/packet usefulness before attempting code-adjacent or service-adjacent targets

## Safe First Sequence Item

Selected first-loop candidate for `W6-I` if this brief is accepted:

- Candidate A: docs-only audit-plan merge-readiness review/fix on current branch

Target surface:

- `Docs/Plans/Master/Wave9-Runtime-Campaign-Hardening-Plan.md`
- `Docs/Plans/Master/Wave10-Campaign-Logistics-Hardening-Plan.md`
- `Docs/Plans/Master/Wave10.5-Refinery-TR3-Audit-Gates-Plan.md`
- `Docs/Plans/Master/Wave11-Ecology-Hardening-Plan.md`
- `Docs/Plans/Master/Wave12-Codebase-Architecture-Hardening-Plan.md`

Why this item is safe enough:

- docs-only
- no deploy path
- no paid/live run path
- no direct secret usage required
- reversible and bounded
- naturally fits a planning/review/fix loop that Wave 6 can capture without over-claiming implementation value
- the existing docs-dirty branch context can be treated explicitly as part of the target loop rather than pretending to be a clean-start baseline

Expected acceptance checks for the first loop:

- diff remains limited to intended docs scope
- no accidental opening of blocked waves/steps
- ownership/gate wording is internally consistent
- no refinery/live-service/API/deploy path is touched
- if verification is run, it stays markdown/manual/review-oriented rather than production-runtime-oriented
- starting branch/worktree state is recorded and treated as part of the loop context, not as a clean-start baseline
- no `.swarm/**` path is touched
- no `ops/PROJECT_STATE.md` path is touched
- no private/generated evidence path outside the selected docs-only review/fix loop is modified

Deferred alternative, not selected as first loop:

- Candidate B: narrow Track B runtime test/code slice

Reason deferred:

- code-adjacent and still headless/testable, but the current branch/worktree is not the cleanest first external-loop context for a first Wave 6 target
- better suited as a later external loop after the first external docs-only loop proves useful and safe

Explicitly excluded as first loop:

- Candidate C: refinery/TR3/live-director surface

Reason excluded:

- live-service/LLM/privacy risk too high for the first external private loop

## Privacy Boundaries

The first external loop must exclude these surfaces and topics:

- `refinery-service-java/`
- any live-service or endpoint bring-up workflow
- any `PLANNER_LLM_API_KEY` or similar secret-bearing configuration surface
- docs or files that require exposing raw local env, auth headers, or private endpoint details
- `.swarm/**`
- `ops/PROJECT_STATE.md`
- local session/telemetry state
- user-specific/private/generated evidence not already intended for the selected docs-only task
- deploy, paid/live runs, or release packaging

Observed sensitive indicators that justify the exclusion:

- `refinery-service-java/README.md`
- `refinery-service-java/src/main/resources/application.yml`
- `WorldSim.Runtime/Integration/README.md`
- docs referring to `REFINERY_BASE_URL=http://localhost:8091`
- docs or config referring to `PLANNER_LLM_API_KEY`

## Non-Goals

This W6-H brief does not authorize:

- `W6-I` execution before Meta acceptance
- bridge/API/session delivery implementation
- commit automation
- push automation
- public case-study or release claims
- raw Wave 6 evidence creation during W6-H planning
- any live refinery/API/service path
- any code-adjacent WorldSim task as the first external loop unless Meta explicitly resequences later

## Ownership Boundaries

Meta Coordinator owns:

- target selection
- this W6-H brief draft
- readiness verdict proposal
- final W6-H acceptance decision
- no-claim and privacy boundaries

Track E owns:

- readiness/evidence/privacy review input
- risk judgment on whether the selected candidate is safe enough
- feedback on whether the first-loop sequence item is too broad, too risky, or too privacy-sensitive

Track E does not own:

- final W6-H acceptance
- W6-I execution start
- target resequencing by itself

## Required W6-H Output Contract

This brief must explicitly name:

- repo location
- architecture summary
- active workflow need
- safe first sequence item
- expected evidence
- privacy boundaries
- non-goals
- readiness verdict

All required fields are satisfied in this draft.

## Expected Evidence For W6-I If W6-H Is Accepted

Expected later `W6-I` evidence should remain private and should include:

- one W6 packet/ledger loop for the selected external docs-only review/fix cycle
- recorded starting branch/worktree state for the target repo so the loop context is auditable
- review findings if any
- usefulness row
- explicit validation commands/checks run
- explicit missing/skipped checks
- final recommendation bounded to the selected external task class

Important evidence boundary:

- W6-H planning itself must not generate raw external-loop evidence
- W6-I evidence remains private by default
- W6-J is still the only route to any sanitized/public-safe material later

## Risks And Edge Cases

- WorldSim is not on a clean worktree according to Track E's readiness packet; the first loop must therefore stay docs-only and narrowly scoped
- `W6-I` must record the starting branch/worktree state and treat the existing docs-dirty branch context as part of the target loop, not as a clean-start baseline
- candidate repo includes privacy-sensitive/live-service surfaces that must be explicitly excluded
- a code-adjacent first loop would increase noise and risk before external private workflow value is proven
- if the selected docs-only task drifts into runtime, refinery, or release work, W6-I should stop or narrow
- external-target evidence must not be normalized into broad usefulness proof after a single docs-only loop

## Recommended Verdict

Recommended W6-H verdict:

- `READY_WITH_GUARDRAILS`

Reason:

- WorldSim is ready enough for one narrow private external loop
- the safest first loop is clearly identifiable and aligned with the repo's current active workflow need
- the repo is not ready for a broader or service-adjacent first external loop without more risk
- the selected first loop can validate whether Wave 6 review/packet evidence remains useful outside FractalAgentLab without overreaching into implementation or live-service complexity

## Acceptance Gate For W6-H

W6-H is acceptable only if:

- the candidate repo location is explicit
- the selected first loop is narrow, reversible, and private
- `W6-I` remains blocked before acceptance
- privacy-sensitive refinery/live-service areas are explicitly excluded
- no public-safe/release claim is made
- no bridge/API/session delivery implementation is opened
- the next handoff is Track E review, then Meta acceptance

## Next Gate

Track E should now review this W6-H draft for readiness/evidence/privacy sufficiency.

Meta should accept, narrow, or block W6-H only after Track E returns review feedback on this brief.
