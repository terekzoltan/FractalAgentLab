# Packet Schema v0

Status: `SUPERSEDED / NON-OPERATIONAL`

This is a historical input schema. `route-packet.ps1` and
`validate-packet.ps1` fail closed and cannot resolve or send lifecycle commands.
Current requests use closed `run-request.v1` and `stage-request.v1` contracts;
the engine independently derives authority, recipient, command, and sources.

Packets are JSON files routed between logical OpenCode session names. The router resolves logical names through `.opencode-router/sessions.json` at runtime.

## Required Fields

```json
{
  "stage": "plan_ready_for_meta_review",
  "target": "P6-D(A_part)",
  "from": "track-a",
  "to": "meta",
  "risk": "medium",
  "summary": "short summary",
  "body": "packet body"
}
```

Required:

- `stage`
- `from`
- `to`
- `risk`
- `summary`
- either `body` or `body_path`

`target` is required for command modes that build arguments as `<target> <origin Track>\n\n<body>`.

## Body Forms

Inline body:

```json
{
  "body": "inline packet body"
}
```

Path body:

```json
{
  "body_path": ".opencode-router/artifacts/body.md"
}
```

For versioned examples, prefer inline `body` so dry-run smoke tests cannot accidentally depend on runtime artifacts. If using `body_path`, copy the packet and artifact into `.opencode-router/outbox/` and `.opencode-router/artifacts/` before live routing.

## Optional Fields

```json
{
  "decision": "greenlit|changes_requested|blocked|pass|fix_required|hold|deep_review_needed",
  "previous_stage": "...",
  "iteration": 0,
  "review_cycle": 0,
  "created_by": "manual|seq-next-hook|router",
  "agent": "architect",
  "model": "openai/gpt-5.6-sol",
  "notes": "..."
}
```

`agent` and `model` are optional request-routing overrides. `route-packet.ps1 -Agent` and `-Model` take precedence over packet values. A model string must use `provider/model` syntax and is serialized to the OpenCode server as `{ "providerID": "...", "modelID": "..." }` for both command and message endpoints.

## Stage Semantics

```text
plan_ready_for_meta_review
  Initial Track plan after the human ran /seq-next in the Track session.

meta_plan_review_done
  Meta's /terv-review output going back to the Track via /terv-review-utan.

implementation_requested
  Explicit approved request to run /implement with empty arguments. Usually this remains manual.

implementation_done
  Track implementation brief going to Meta via /step-review.

step_review_done
  Meta final step-review output going back to the Track via /step-review-utan.
```

Review-fix plans are Track-local implementation inputs, not plan-review packets. They must carry `FIX_PLAN_READY_FOR_IMPLEMENT` and are consumed by the review-fix helper before `/implement`.

## Known Logical Targets

Typical logical names:

- `meta`
- `track-a`
- `track-b`
- `track-c`
- `track-d`
- `track-e`
- `track-metaops`
- `swarm-assistant`
- `smr-analyst`

These names are stable labels. Actual OpenCode session IDs remain private runtime data in `.opencode-router/sessions.json`.

## Validation Rules

`validate-packet.ps1` checks:

- required fields
- known stage
- known logical target names when sessions registry is available
- `target` exists for target-origin-body command modes
- `body_path` exists when resolved against current working directory or router root
- versioned examples do not contain likely hardcoded OpenCode session IDs
