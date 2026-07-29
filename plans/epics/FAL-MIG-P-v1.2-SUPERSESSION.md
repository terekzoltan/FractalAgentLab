# FAL-MIG-P v1.2 Supersession Evidence

## Control

| Field | Value |
|---|---|
| Evidence ID | `FAL-MIG-P-v1.2-SUPERSESSION-v1` |
| Superseded plan | `FAL-MIG-P-plan-v1.2` |
| Original active path | `plans/epics/FAL-MIG-P.md` |
| Immutable archive | `plans/epics/archive/FAL-MIG-P-plan-v1.2.md` |
| Byte size | `82351` |
| SHA-256 | `2d713cef31010e1268a7242465a4f0cebf9fa4e8e5fd3364744828d360a36ea2` |
| Disposition | `SUPERSEDED_BEFORE_IMPLEMENTATION` |
| Successor | `FAL-MIG-P-plan-v2.0` at `plans/epics/FAL-MIG-P.md` |
| Owner direction | 2026-07-26: execute the accepted CANON-HYDRATION lifecycle and dependent FAL replan |

## Preservation Proof

The archived file was moved without editing. Its byte size and SHA-256 were checked
both before and after the move and remained identical. The archive is historical
evidence only and cannot authorize implementation, migration application, Wave 8
activation, file deletion, or live authority cutover.

## Review Lineage

The preserved plan contains its canonical review lineage in section
`18.1 Canonical /terv-review disposition`, including all six applied corrections and
the explicit statement that no review item remained unresolved. No separate
candidate-bound `/terv-review` artifact for v1.2 exists in the current workspace.
This evidence records that limitation rather than fabricating a missing artifact.

The old review cannot approve the replacement architecture. The successor must use
a new `/seq-next`, one new independent `/terv-review`, and one
`/terv-review-utan` revision.

## Authority Effect

The following old route is retired:

```text
FAL-MIG-P-plan-v1.2 -> planning-only /implement
```

State and sole-Combined pointers may name the successor only after its new plan
review/revision is complete. Until then, no FAL migration or cleanup implementation
is authorized. The protected router source/test diff and all unrelated work remain
outside this supersession.

```text
SUPERSEDED_BEFORE_IMPLEMENTATION
```
