# Wave1-L1-O-Identity-Signal-Carrier-Convention.md

## Purpose

This document records Track C delivery for Wave 1 epic `L1-O`.

`L1-O` defines a design-only convention for carrying identity signals so future identity updates are explicit, traceable, and runtime-compatible.

---

## Scope

In scope:

- identity signal envelope convention
- allowed carrier locations
- provenance requirements
- normalization and extraction precedence
- Track B compatibility checklist

Out of scope:

- new runtime enums or canonical schema changes
- executable identity updater/store code
- eval pass/fail gating based on identity signals

---

## Allowed Carrier Locations (Wave 1 Design)

Primary carrier:

- step output `identity_signals` object

Secondary carrier:

- `RunState.context["identity"]` as per-run working area

Deferred carrier:

- dedicated identity delta artifact after run completion

---

## Canonical Signal Envelope Draft (`identity.signal.v0`)

```json
{
  "identity_signals": {
    "schema_version": "identity.signal.v0",
    "source": "step_output",
    "signals": {
      "coherence_score": 0.82,
      "needed_revision": false,
      "delegated": true,
      "self_correction_used": true,
      "confidence": 0.71
    },
    "provenance": {
      "workflow_id": "h1.manager.v1",
      "step_id": "planner",
      "agent_id": "h1_planner_agent",
      "prompt_version": "h1/planner/v1"
    }
  }
}
```

---

## Provenance Rules

Required provenance keys:

- `workflow_id`
- `step_id`
- `agent_id`

Recommended when available:

- `prompt_version` (aligned with `L1-M` prompt tagging)

Signal records without required provenance should be treated as non-canonical.

---

## Extraction Precedence (Draft)

1. explicit step `identity_signals`
2. normalized run-context identity signal list
3. fallback derived markers (error/retry/timeout) only when explicitly documented

No hidden or implicit inference should be treated as canonical identity signal.

---

## Invalid / Discouraged Patterns

- free-text "identity feeling" fields without schema
- signals with no provenance
- runtime behavior changes based on undefined signals
- automatic prompt rewrites from one signal

---

## Track B Review Checklist

- no required changes to `RunState` canonical shape
- no required changes to `TraceEventType` enum
- no forced runtime mode changes for signal carriage
- design remains additive and optional until Wave 2 implementation

---

## Alignment Notes

- Anchors: `docs/Emergent-Identity-Layer-v01.md`, `docs/wave1/Wave1-L1-M-H1-Prompt-Version-Tagging.md`
- Ownership: Track C signal semantics; Track B contract compatibility review.
- Track E can later consume these conventions for identity drift sanity checks.
