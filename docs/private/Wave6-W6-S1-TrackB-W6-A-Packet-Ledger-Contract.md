# Wave6 W6-S1 TrackB W6-A Packet Ledger Contract

## Status

Track B delivery note for `W6-A` packet and ledger contract.

Execution mode: `opencode_assisted`

Visibility / audit state:

- git-visible code and tests were updated
- local-only `ops/` coordination docs were consulted
- `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md` was consulted as the Wave 6 detailed plan and is currently untracked local/private context

## Scope Delivered

Track B delivered the W6-A contract layer only:

- `w6.packet.v1` packet envelope contract
- packet validation defaults and invalid-packet behavior
- `w6.evidence_ledger.v1` ledger row/document contract
- safe packet-to-ledger-row conversion primitive
- private Wave 6 evidence path helpers
- targeted negative-path tests

## Contract Decisions

### Packet Contract

- Packet schema version is `w6.packet.v1`.
- Packet validation is result-object based via `validate_w6_packet(...)`.
- Invalid packets return errors and do not produce a clean `W6Packet`.
- `source_command` is a required non-empty string, with unknown command labels warning-grade rather than hard-fail.
- `loop_id`, `packet_id`, and non-null `parent_packet_id` are path-safe segment identifiers; traversal values, leading/trailing whitespace, Windows reserved device names, and packet name `ledger` are rejected before W6-C recorder work.
- `visibility_audit_state` is a required structured object, not free text.
- `privacy_classification` is required; `private_raw` is the safe default for constructed contract objects.
- `sanitized_public` is never implicit.
- The enum value `unknown` is accepted for Track labels but emits a validation warning.

### Ledger Contract

- Ledger schema version is `w6.evidence_ledger.v1`.
- The ledger document contract is an object with `ledger_schema_version`, `loop_id`, and `entries`.
- Ledger entries preserve packet identity, stage, decision, producer/consumer, originating track, sequence ref, artifact refs, validation status, and warnings.
- Finding counts, manual-intervention counts, copy-paste counts, and test/missing-test fields are typed contract surfaces only; Track B does not define Track E usefulness or evidence-sufficiency semantics.
- Invalid packet validation results cannot be converted into clean ledger entries.

### Evidence Paths

Wave 6 evidence paths are private/local evidence paths:

```text
data/evidence/wave6/loops/<loop_id>/ledger.json
data/evidence/wave6/loops/<loop_id>/packets/<packet_id>.json
```

These helpers intentionally do not target canonical run/trace artifact paths or `data/artifacts/<run_id>/` sidecars.

## Explicit Non-Goals

Not delivered under `W6-A`:

- evidence writer / recorder append workflow
- Track E evidence sufficiency or usefulness evaluation semantics
- full W6-B transition-history state machine
- OpenCode bridge/API/session delivery
- hidden background execution
- commit/push automation
- UI/dashboard work
- public sanitization extractor

## Downstream Handoff

### W6-B / Track B

`W6-B` can build transition-history validation on top of the packet stages and decision vocabulary. W6-A intentionally validates individual packet shape and stage-local decision legality only; it does not require prior packet history.

### W6-C / Track E

Track E can consume the packet/ledger/path contracts to implement the manual evidence recorder MVP. Track E owns evidence sufficiency, usefulness rows, finding-quality interpretation, gate-quality interpretation, and recorder behavior.

### Track C Checkpoint

Track C should review packet payload semantics for role, command, and handoff meaning before W6-C relies on payload content as workflow evidence.

## Validation

Targeted tests cover:

- valid minimal packet validation
- missing packet/loop identifiers
- unknown stage
- required/null decision rules by stage
- missing privacy classification
- structured `visibility_audit_state`
- warning-grade unknown source command
- warning-grade `unknown` Track labels
- W6-A not enforcing W6-B transition history
- invalid packet blocked from clean ledger conversion
- private evidence paths staying outside `data/artifacts/<run_id>/`
