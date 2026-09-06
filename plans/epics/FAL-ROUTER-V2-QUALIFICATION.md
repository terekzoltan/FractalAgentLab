# Router V2 isolated live qualification

Date: 2026-09-06. Result: LOCAL_PILOT_PASS. Not a production release/install.
Owner envelope covered local candidate commits, isolated model calls and one
useful full lifecycle through local closeout. No push or main integration.

## Tested sources and artifact

- Transport candidate: FAL3d40235 (base40877f9 plus nullable command metadata fix).
- Canon source: c3b1aaa1580b2b6a17f72d91fc966dac0aaede43, AWC5 candidate.
- WOps source: ae6e2b12c2ee7c05b1d52cfbd6e6a173b51faa20, local candidate.
- Installed OpenCode used in isolated environment:1.18.28.
- Pilot closeout commit: be764a38db4e333b3fa6ca5a949bc00d7ebd4287 on local
  awc5-v2-pilot. It is not merged into the ordinary project branch.
- Useful artifact at that commit: tools/oc-session-router/docs/v2-quickstart.md.
  Plan and documentation checks are committed under plans/pilot and evidence/pilot.

The dedicated environment used isolated config/data/cache/state and test sessions;
all16 candidate command templates matched the loaded versions. Actual private
bindings/credentials are not copied into this record. Existing project sessions,
global tooling and parked project frontiers were not changed.

## What ran

One read-only installed-command compatibility probe completed with its exact
argument/result correlation. A1ms local wait ended without interruption; the
retained request later completed. No resend occurred.

A separate Orchestrator then led independent Delivery and Meta sessions through
one work item. Codex observed, but did not manually drive individual stages.

| Stage | Responsible lane | Result | Send-to-completion seconds |
|---|---|---|---:|
| seq-next | Delivery | READY, delivered/completed |365|
| terv-review | Meta | GREEN, two incorporated nonblocking clarifications |177|
| terv-review-utan | Delivery | IMPLEMENT_READY |138|
| implement | Delivery | REVIEW_READY, actual documents/checks |683|
| step-review | Meta | GREEN/ALLOWED,14 acceptance checks, no findings |312|
| step-review-utan | Delivery | ACK_ONLY |38|
| closeout-commit | Meta | COMPLETE/ACCEPTED/CLOSED, scoped local commit |242|

All7 operations completed with one action key per stage. No replacement run,
lifecycle resend, permission reply, session interruption or runtime repair was
needed during the useful pilot. Its worktree was clean after closeout.
The11m23s implementation and44m39s enclosing orchestration request completed
without the former five-minute response loss. Durations include all execution;
they are not pure model-time or cost measurements. The pilot demonstrates reduced
manual intervention, not that this small seven-stage documentation task is cheap.

Documentation checks:13 public actions,6 JSON examples,5 relative links,
zero prohibited privacy matches,172 nonblank guide lines and10 launcher fixture
assertions. Documentation verification was offline; this enclosing record, not
the offline documentation receipt alone, establishes live lifecycle evidence.

## Corrections and limitations

Before the useful pilot, live API qualification exposed nullable optional command
metadata. A two-file adapter fix accepts null as absent, preserves malformed-value
rejection and passed18 targeted adapter tests. No model operation was resent.
Test-harness array/UTF8 decoding was also corrected before model dispatch.

After completion, a stale BUSY/no-terminal observation could still appear in the
operation summary. A view-only follow-up makes terminal facts supersede pending
diagnostics; actual session telemetry stays separate. Its regression and the full
130-case offline suite passed. No transport/lifecycle behavior was changed and no
second pilot was manufactured for that display correction.

Optional active-context/model-limit telemetry was unavailable. It did not block
the pilot; no real pressure was established, so live compact/restore was not forced.
Those paths retain offline coverage, not a claimed live compact test. Exact token
cost was not measured. Technical Owner interventions during the useful pilot:0.

## Remaining boundary

AWC5 remains candidate/unreleased. Production installation, target adoption and
legacy import, old-writer cutover, release metadata and any remote publication
require the separately approved rollout envelope. Keep existing project pauses.
This result is not permission to restart or interrupt sessions or resume products.
