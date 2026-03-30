# Wave1-L1-N-Identity-Profile-Schema-Draft.md

## Purpose

This document records Track C delivery for Wave 1 epic `L1-N`.

`L1-N` defines a design-only draft schema for identity profiles so Wave 2 implementation can stay measurable, bounded, and contract-safe.

---

## Scope

In scope:

- identity profile schema draft (`IdentityProfile`)
- snapshot and update terminology
- invariants and versioning rules
- explicit non-goals for Wave 1

Out of scope:

- runtime/schema code changes
- automatic prompt mutation
- reputation graph and team/system aggregation implementation

---

## Canonical Profile Draft (`identity.profile.v0`)

`IdentityProfile` fields:

- `agent_id: str`
- `profile_version: int`
- `vector_version: str`
- `baseline_ref: str | None`
- `caution: float`
- `initiative: float`
- `delegation: float`
- `coherence: float`
- `reflectiveness: float`
- `update_count: int`
- `last_updated_at: str | None`
- `last_run_id: str | None`
- `metadata: dict[str, Any]`

---

## Invariants

- Behavioral dimensions (`caution`, `initiative`, `delegation`, `coherence`, `reflectiveness`) must be clamped to `[0.0, 1.0]`.
- `update_count` is monotonic.
- `last_run_id` is optional but, when present, points to a concrete run artifact.
- Identity changes are gradual; no large swings from one run.

---

## Versioning Rules

- `profile_version` is for profile-shape compatibility.
- `vector_version` is for signal/update rule compatibility.
- Any semantic change to update mapping requires a `vector_version` bump.
- Any structural field change requires a `profile_version` bump.

---

## Early References (Design-Level)

Early references may live in metadata surfaces without canonical schema churn:

- `identity_profile_ref`
- `identity_policy_ref`

These remain design references in Wave 1 and do not change Track B-owned runtime contracts.

---

## Deferred to Wave 2+

- executable `IdentityStore` and updater pipeline
- explicit drift monitor implementation
- reputation edges
- team/system identity aggregation
- identity-driven routing decisions

---

## Alignment Notes

- Anchors: `docs/Emergent-Identity-Layer-v01.md`
- Ownership: Track C semantics; Track B remains owner of canonical runtime schemas.
- Track E can consume this draft later for drift sanity checks.
