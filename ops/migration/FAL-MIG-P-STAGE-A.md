# FAL-MIG-P Stage A Adoption Record

Candidate: `fal-mig-p-stage-a-v1`
Mode: additive, shadow-first, no-delete
Canon source: external `../Agent-Workflow-Canon`

## Adopted Information Architecture

- Root `AGENTS.md` becomes a short locator and boot order.
- `ops/PROJECT_OVERLAY.md` owns hot FAL identity, authority, safety, privacy, ownership, and explicit exceptions.
- `ops/PROJECT_STATE.md` owns one compact current frontier and exact next action.
- The retained `ops/Combined-Execution-Sequencing-Plan.md` remains the sole sequencing authority.
- `ops/roles/*.md` owns bounded role deltas.
- `ops/AGENTS.md` remains an unchanged cold legacy/history source.
- `ops/archive/INDEX.md` and this record make provenance discoverable without moving source files.

## Classification And Preservation

| Source family | Classification | Semantic owner after Stage A | Preservation |
|---|---|---|---|
| Root bootloader | normalized | root `AGENTS.md` | Canon locator, mandatory order, and hard FAL rule pointer retained |
| FAL identity/safety/privacy | retained and normalized | `ops/PROJECT_OVERLAY.md` | hard rules copied compactly; long-form rationale remains in unchanged `ops/AGENTS.md` |
| Current frontier | normalized | `ops/PROJECT_STATE.md` | exact Wave/Epic/phase/status/blockers/next action retained |
| Sequencing | retained | sole Combined | no second live Combined; reviewed shadow labelled non-authoritative |
| Role mechanics | relocated as additive deltas | `ops/roles/*.md` plus Canon runbooks | existing Track runbooks remain unchanged cold detail |
| Findings | retained | `ops/Review-Findings-Registry.md` | pointer-only; content unchanged |
| Historical plans | archived/retained | `plans/epics/archive/**` | v1.2 bytes and supersession identity preserved |
| Imported planning packages | quarantined | none yet | no copy, move, deletion, or authority promotion |
| Router/product source | excluded/protected | existing owners | pre/post hashes must match |
| Runtime/generated/private evidence | local-only | runtime operator | ignored and forbidden from durable hot governance |

## Privacy And Dual Root

Durable Stage A files contain no concrete session ID, port, endpoint, credential, transcript, raw evidence, or absolute target/runtime mapping. FAL control-root evidence never substitutes for a target root. Router state and compact summaries remain evidence only.

## Rollback

The ignored baseline bundle stores exact pre-apply bytes and hashes for every existing write target plus protected router source/test files. `rollback-manifest.json` restores each replaced target from its exact baseline only when the journal proves the replacement landed. It removes each newly added target only when the journal proves this transaction created it and its current hash still equals the reviewed applied hash; pre-existing or drifted paths are never removed. Empty transaction-created directories may then be removed in the listed order. There is no forward delete or move operation.

## Deferred Stage B

Stage B owns any shortening of `ops/AGENTS.md`, Combined restructuring, archive moves, redirect retirement, imported-package disposition, or deletion. Nothing in Stage A authorizes Wave 8.
