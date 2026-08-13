# Workflow Semantics

Status: `SUPERSEDED / NON-OPERATIONAL`

This document describes historical packet, serial, parallel, and fix-cycle
behavior. Current lifecycle authority is the explicit single-stage runtime and
the hot workflow-orchestrator runbook. Nothing here authorizes transport.

The router invokes OpenCode commands through the command endpoint for known workflow stages. Slash commands are not sent as plain chat messages.

## OpenCode Endpoints

Message listing endpoint:

```text
GET /session/{sessionID}/message?limit=<N>
```

This is the read-only basis for latest-output routing. Message detail can use `GET /session/{sessionID}/message/{messageID}` if needed later.

Plain message endpoint:

```text
POST /session/{sessionID}/message
```

Body:

```json
{
  "parts": [
    {
      "type": "text",
      "text": "..."
    }
  ]
}
```

Command endpoint:

```text
POST /session/{sessionID}/command
```

Body:

```json
{
  "command": "terv-review",
  "arguments": "..."
}
```

Command names are sent without a leading slash.

Future event stream option:

```text
GET /event
```

Event streaming is intentionally deferred. The first latest-output MVP uses manual trigger -> message listing -> preview -> approval -> route.

## Stage Mapping

This table is not the chronological workflow order. It maps packet stages to the OpenCode command the router should invoke.

```text
plan_ready_for_meta_review       -> command: terv-review
meta_plan_review_done            -> command: terv-review-utan
implementation_requested         -> command: implement
implementation_done              -> command: step-review
step_review_done                 -> command: step-review-utan
```

`plan_ready_for_meta_review` is the only plan-review stage. `/terv-review` runs exactly once for the `/seq-next` plan. Later step-review fix plans proceed directly to `/implement` after the Track emits `FIX_PLAN_READY_FOR_IMPLEMENT`.

The helper script `run-review-fix-cycle.ps1` provides canonical evidence labels for repeated step-review fix loops:

- cycle 1: `<base-target>-review-findings-fix-plan`
- cycle 2+: `<base-target>-re-review-findings-fix-plan`

## Chronological Workflow

1. Track session, manual: `/seq-next <target> <Track X>` creates the plan.
2. Router sends Track plan to Meta: `plan_ready_for_meta_review` -> `/terv-review <target> <Track X>` plus plan body.
3. Router sends Meta plan review to Track: `meta_plan_review_done` -> `/terv-review-utan` plus Meta review body only.
4. Track revises the plan without issuing a second color verdict and emits `PLAN_REVISION_COMPLETE` plus `IMPLEMENT_READY`, or `IMPLEMENT_BLOCKED` when an owner/blocker decision is required.
5. Track session runs `/implement` with no arguments after `IMPLEMENT_READY`. This is usually manual; `implementation_requested` exists only for an explicit approved packet.
6. Router sends implementation brief to Meta: `implementation_done` -> `/step-review <target> <Track X>` plus implementation brief.
7. Router sends Meta step-review to Track: `step_review_done` -> `/step-review-utan` plus Meta review body only.
8. If fixes are required, Track creates a bounded fix plan with `FIX_PLAN_READY_FOR_IMPLEMENT`; the review-fix helper runs `/implement` directly, then repeats `/step-review`.
9. If no fixes are required, Meta closeout, commit, and recommended next step remain manual build-mode actions outside this router.

## Parallel Combined Meta Review

For steps where multiple Tracks may proceed in parallel after a shared prerequisite, the router may still use the same underlying Meta commands:

- combined `/terv-review`
- combined `/step-review`

The difference is in the request body, not the command name.

Parallel wrapper scripts send one combined request that contains multiple canonical `Target / Track / Plan` or `Target / Track / Brief` sections, plus a strict response contract.

Meta is asked to return one isolated block per Track lane using marker-delimited sections:

```text
=== TRACK RESPONSE START ===
TRACK: track-a
TARGET: P7-D
COMMAND: terv-review-utan
<body only for Track A>
=== TRACK RESPONSE END ===
```

and similarly for `step-review-utan` in final combined synthesis.

The router then fans those extracted block bodies back out to the correct Track sessions.

Combined `/step-review` also asks Meta phase 1 to expose one marker-delimited Swarm prompt:

```text
=== SWARM PROMPT START ===
/swarm-review
...
=== SWARM PROMPT END ===
```

This keeps the Meta command surface stable while making the combined flow parseable.

## Argument Modes

Target-origin-body:

```text
<target> <origin Track>

<packet body>
```

Body-only:

```text
<packet body only>
```

Empty:

```text

```

Required mapping:

```text
plan_ready_for_meta_review       -> terv-review       -> target-origin-body
implementation_done              -> step-review       -> target-origin-body
meta_plan_review_done            -> terv-review-utan  -> body-only
step_review_done                 -> step-review-utan  -> body-only
implementation_requested         -> implement         -> empty
```

## Role Labels

```text
track-a -> Track A
track-b -> Track B
track-c -> Track C
track-d -> Track D
track-e -> Track E
track-metaops -> Track MetaOps
meta    -> Meta Coordinator
```

For target-origin-body commands, the role in the argument prefix is derived from packet `from`, not packet `to`.

Example:

```json
{
  "stage": "plan_ready_for_meta_review",
  "target": "P6-D(A_part)",
  "from": "track-a",
  "to": "meta"
}
```

Command invocation:

```text
command = terv-review
arguments = P6-D(A_part) Track A

<packet body>
```

## Approval Gate

Default behavior is human-in-the-loop:

- Validate packet.
- Resolve target session from `.opencode-router/sessions.json`.
- Show preview.
- Ask `[y/N]` before live send.
- Move successful live packets to `.opencode-router/processed/`.
- Move invalid packets to `.opencode-router/rejected/` when they came from runtime outbox.

`-PreviewOnly` and `-DryRun` validate and preview without API calls or file moves.
