# Wave2-W2-S3-TrackB-H2-H-H2-N-Confirmation.md

## Purpose

This document records Track B review outcomes for Wave 2 Sprint `W2-S3` Step 1:

- `H2-H` contract confirmation scope (handoff from Track E draft)
- `H2-N` boundary review scope (handoff from Track C implementation)

---

## Scope

In scope:

- classify `H2-H` assertions into shared boundary invariants vs eval-local policy
- confirm `H2-N` updater boundaries against Track B-owned runtime/state/trace contracts
- close doc/code consistency gaps found during review intake

Out of scope:

- deterministic rerun guarantees
- winner-selection or quality ranking policy
- runtime schema redesign
- identity drift scoring semantics (`H2-O`)

---

## H2-H Confirmation Outcome

### Confirmed shared boundary invariants

- canonical run/trace truth remains:
  - `data/runs/<run_id>.json`
  - `data/traces/<run_id>.jsonl`
- replay remains artifact-backed read/reconstruct only
- invalid run/trace pair remains preflight blocker
- expected variant identity checks remain enforced when run IDs are mapped to expected workflow IDs
- handoff linkage preservation (`parent_event_id`, `correlation_id`) remains boundary-level requirement for linkage-aware consumers

### Confirmed eval-local policy (not core runtime/schema law)

- H1 trio composition as current eval family
- baseline posture labels (`baseline_anchor`, `default_multi_agent_reference`, `reference_variant`)
- prompt-tag semantics
- aggregate eval booleans (`smoke_passed`, `tag_capture_ready`)
- comparable output completeness policy as current eval interpretation (`present` + non-`None` per comparable key)

### Doc/code consistency fixes applied

- `H2-H` draft now includes `all_workflow_matches_expected` under H2-G enforced readiness semantics
- `H2-H` draft now labels variant-structure checks as shared eval invariants (enforced in smoke), while keeping them outside core runtime/schema law

---

## H2-N Boundary Review Outcome

### Confirmed boundaries preserved

- no `RunState` / `TraceEvent` / `WorkflowSpec` / `AgentSpec` schema mutation required for H2-N
- no executor branching or orchestration-mode behavior change required for H2-N
- updater remains CLI post-run service behavior (config-gated, non-fatal)
- identity update output remains non-canonical sidecar (`data/artifacts/<run_id>/identity_update.json`)
- identity profile persistence remains Track C-owned store surface (`data/identity/...`)

### Explicit boundary decision: orphan-tolerant updater behavior

Current accepted behavior in W2-S3:

- identity updater may still run when canonical artifact write fails in CLI post-run phase
- this is treated as best-effort non-canonical sidecar/store behavior, not canonical run success evidence

Reason:

- updater output is additive and non-canonical
- canonical run/trace truth remains owned by Track B artifact surfaces

### Explicit boundary decision: provenance simplification

Current accepted behavior in W2-S3:

- explicit identity-signal extraction uses surrounding `step_result` wrapper context (`agent_id`, `step_id`, workflow/run context)
- envelope-level `provenance` object is not currently required/enforced in runtime code

This is accepted as an implementation simplification for current scope.
Future tightening may reintroduce strict envelope provenance enforcement if needed.

### Explicit boundary decision: implicit dependency surfaces

Current accepted supported dependency surfaces for updater fallback logic:

- `step_results[*].agent_id`, `step_results[*].step_id`
- `output_payload.manager_orchestration` shape used for manager delegation fallback
- `output_payload.handoff_orchestration` shape used for handoff delegation fallback
- `TraceEventType.STEP_COMPLETED.payload.attempts` used for retry-derived fallback

These are treated as supported cross-track integration surfaces for current Wave 2 scope,
without promoting them to new core schema law.

---

## Test Hardening Added

- negative-path CLI test now codifies orphan-tolerant updater behavior when canonical artifact write fails
- identity updater tests now codify wrapper-shape dependency behavior and delegation-fallback dependency on manager orchestration shape

---

## Downstream Handoff

- Track E can proceed with `H2-L` and `H2-O` on top of confirmed `H2-H`/`H2-N` review boundaries.
- Any future fix batch touching these decisions should include:
  - negative-path coverage for canonical write failure + updater behavior
  - integration coverage for wrapper/orchestration shape dependencies
  - doc/code alignment checks across Track C/E/B surfaces
