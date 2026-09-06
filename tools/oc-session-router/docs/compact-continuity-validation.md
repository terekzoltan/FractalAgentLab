# V2 compact continuity repair — candidate evidence

2026-09-06. Compatible maintenance candidate, not installed/loaded qualification.
Owner approved the bounded design and 60% input-budget threshold, then explicitly
requested live verification of token selection. No real session mutation occurred.

## Changes and verification

- GET /provider alone accepts up to 16 MiB; other 4 MiB caps remain unchanged.
  Synthetic 6 MiB catalog succeeds; oversized catalog and oversized non-catalog
  responses fail boundedly. Lookup failure reasons remain sanitized and visible.
- Matched input limit determines pressure, with labelled reserve/context estimates
  only when needed. Default compact threshold is 0.60; no DB/config migration.
- Observation side-effect capabilities are explicitly not compact eligibility.
  Concise continuity advice appears in normal operation outputs with age/freshness;
  stale/pre-result/old-format observations request a refresh instead of false green.
- Successful completed provider steps are selected; aborted/error placeholders do
  not overwrite them. A successful call missing tokens does not cause fallback to
  an older token-rich call. Zero-only usage is unconfirmed, not empty context.
- Native summary usage remains pre-compaction evidence; completed compact leads
  to checking restore, not duplicate compact. Busy lanes are never interrupted.

Clean TypeScript build and all 139 V2 tests PASS. Public CLI loopback-fixture test
executes observe -> compact -> wait -> restore -> original action in one work,
retains original plan/predecessor, and checks exactly one summarize, one restore,
one implementation send despite repeated calls. No alternate sender or daemon.
Other tests cover pause, participant exclusion, uncertain recovery, stale summary,
source binding, missing/invalid telemetry and exact threshold boundaries.

AWC source inventory (16 commands / 21 skills / 18 agents), pack validation and
all 11 hydration test groups PASS under Windows PowerShell 5.1. PowerShell 7 parity
is unavailable on this host. Git diff whitespace checks PASS.

## Live GET-only measurement comparison

Candidate observation core with the same configured model/override options was
compared against independently read raw OpenCode metadata. Exact directory-scoped
participants were rediscovered, the latest successful provider call and its token
fields were compared by hashed identity and completion time, and before/after
metadata plus activity were stable. OpenCode version: 1.18.29.

| Participant | Raw reported total | Candidate total | Interpretation |
|---|---:|---:|---|
| RingFall Track D | 137431 | 137431 | Ordinary completed call; includes 136448 cache-read tokens, not just 977 uncached input |
| WorldSim SMR Analyst | 94370 | 94370 | Completed native compaction summary; explicitly stale pre-compaction usage |

All available input/output/reasoning/cache fields and matched catalog limits
agreed. The selected model catalog reported context=400000,input=272000,
output=128000, so the configured default trigger is 163200.

The live test exposed a later SMR MessageAbortedError placeholder with zero usage.
Before repair it incorrectly appeared as low pressure. The candidate excludes that
failed provider attempt, keeps newer-activity diagnostics and recognizes the prior
completed summary. The previous ordinary successful call reported 254802 tokens;
it is historical, not the current active context. No agent initiated that existing
compaction or interruption during this investigation.

This proves correct API metadata extraction/selection and provenance, NOT exact
current active context, successful semantic restoration, product acceptance or a
real-model compact canary. No production store writes, POSTs or lifecycle sends.

## Change-impact closure

| Family | Result and evidence |
|---|---|
| Canon lifecycle/role/authority | NOT_AFFECTED: same stages, work effects, Owner pause and sender; only maintenance advice repaired |
| OpenCode command/skill | IMPACTED: fal-orchestrate-target pair explicitly owns the routine and disambiguates read-only capabilities |
| FAL runtime/config/runbooks | IMPACTED: bounded catalog reader, budget/selection/presentation, optional scalar; existing compact/restore actions preserved |
| Validators/tests | IMPACTED: observation/adapter/CLI regressions and full V2 suite above |
| Hydration/after-compact/context-restore | NOT_AFFECTED after paired inspection: same target/profile, minimal files, no authority or auto-resume from restore; all hydration groups pass |
| Cold-start/onboarding/wave-start | NOT_AFFECTED: no root/profile/artifact resolution changes |
| WOps Steward/Chief of Staff/session-context skills | NOT_AFFECTED after inspection: no fixed thresholds or mayCompact dependencies; already require fresh GET evidence and orchestrator-owned idle maintenance |
| Project state/templates/adoption | NOT_AFFECTED: no project paths, scope, versions, next stages or pauses changed |
| Installer/references | Existing single installer; plan for two managed files, no competing writer or historical 4.x snapshot refresh |

Publication/install remain a separate explicit Owner authorization. Candidate
work is isolated; real workflows may continue. No new P0B or full-Epic pilot is
required. Loaded command verification follows an Owner reload if needed, without
agent restart or session interruption.
