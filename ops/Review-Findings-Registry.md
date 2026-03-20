# Review-Findings-Registry.md

## Purpose

This document records significant review findings discovered during implementation reviews.

It exists for three reasons:

1. to avoid losing review findings in chat history
2. to track whether a finding was later fixed or merely acknowledged
3. to detect repeated failure patterns that should feed back into planning, contract design, or acceptance gates

This is a coordination artifact, not a production-code artifact.

---

## How to use this document

When a meaningful review finding appears, record:

- where it was found
- how severe it was
- which track(s) own the fix
- whether it reveals a broader planning/contract weakness
- what prevention change should be considered

Use this registry during:

- `dod-check`
- `conflict-scan`
- `risk-update`
- `plans-review`
- sprint stabilization planning

---

## Root-cause classes

Use one or more of these labels when possible:

- `contract_gap`
- `runtime_truth_drift`
- `false_green_test_or_smoke`
- `surface_inconsistency`
- `mock_too_permissive`
- `missing_invariant`
- `missing_negative_test`
- `sequencing_gap`
- `docs_status_drift`

---

## Review findings ledger

| ID | Date | Scope | Severity | Finding | Root-cause class | Primary owner(s) | Status | Prevention candidate |
|---|---|---|---|---|---|---|---|---|
| RF-2026-03-18-01 | 2026-03-18 | W1-S1 review | Medium | `h1.single.v1` reported manager execution while actually using the linear executor path | `runtime_truth_drift`, `contract_gap` | Track B | fixed | strengthen execution-mode truth checks in runtime tests for all runnable workflows |
| RF-2026-03-18-02 | 2026-03-18 | W1-S1 review | Medium | manager parser accepted only the first discovered control envelope instead of the first valid one | `contract_gap`, `missing_negative_test` | Track B | fixed | require negative parser-edge tests whenever control-envelope parsing expands |
| RF-2026-03-18-03 | 2026-03-18 | W1-S1 review | Medium | mock manager workers were permissive enough to hide orchestration-order bugs | `mock_too_permissive`, `false_green_test_or_smoke` | Track D | fixed | require mock-path honesty checks for every orchestration variant |
| RF-2026-03-18-04 | 2026-03-18 | W1-S1 review | Medium | default model-tier policy drifted away from the agreed baseline | `docs_status_drift`, `surface_inconsistency` | Track D + Meta | fixed | tie canonical model defaults to one config source and add drift checks |
| RF-2026-03-18-05 | 2026-03-18 | W1-S1 follow-up review | High | `h1.lite` and `wave0.demo` still declared `manager` while executing linearly | `runtime_truth_drift`, `missing_invariant` | Track B | fixed | add workflow-wide execution-mode truth tests, not just for the newly added workflow |
| RF-2026-03-19-01 | 2026-03-19 | W1-S2 review | High | unsupported `parallel` / `graph` modes silently degraded to `linear` | `runtime_truth_drift`, `contract_gap` | Track B | fixed | unsupported modes should fail explicitly and be covered by negative tests |
| RF-2026-03-19-02 | 2026-03-19 | W1-S2 review | Medium | smoke comparison could report green while comparable output keys were missing | `false_green_test_or_smoke`, `missing_negative_test` | Track E | fixed | treat complete normalized output as an acceptance invariant, not envelope presence |
| RF-2026-03-19-03 | 2026-03-19 | W1-S2 review | Medium | duplicate `step_id` values were accepted and could silently clobber earlier step results | `missing_invariant`, `contract_gap` | Track B | fixed | validate structural workflow invariants in `WorkflowSpec` before runtime execution |
| RF-2026-03-19-04 | 2026-03-19 | W1-S2 review | Medium | CLI summary treated manager runs as first-class but under-represented handoff and single variants | `surface_inconsistency` | Track A | fixed | when eval makes variants comparable, CLI summary should adopt a shared variant-aware output surface |
| RF-2026-03-19-05 | 2026-03-19 | W1-S2 review | Low | JSON trace output omitted `parent_event_id` and `correlation_id`, weakening handoff-chain reconstruction | `surface_inconsistency` | Track A | fixed | trace export views should include the full versioned trace contract unless explicitly redacted |

---

## Emerging patterns

Current repeated patterns worth watching:

### Pattern P1 — Runtime truth vs declared truth drift
Observed in:

- RF-2026-03-18-01
- RF-2026-03-18-05
- RF-2026-03-19-01

Meaning:
- declared mode/contract and actual executor behavior can drift apart unless explicitly tested

Planning implication:
- every new orchestration mode should ship with at least one explicit "declared truth == runtime truth" test cluster

### Pattern P2 — False-green risk from permissive mocks or permissive acceptance
Observed in:

- RF-2026-03-18-03
- RF-2026-03-19-02

Meaning:
- the system can look healthier than it is when mocks or smoke criteria are too forgiving

Planning implication:
- every wave introducing a new orchestration path should include at least one negative smoke/assertion requirement

### Pattern P3 — Surface inconsistency across runtime / eval / CLI
Observed in:

- RF-2026-03-18-04
- RF-2026-03-19-04
- RF-2026-03-19-05

Meaning:
- one layer becomes more correct/rich while another layer still presents an older mental model

Planning implication:
- when a new comparable workflow variant lands, acceptance should include at least one cross-surface consistency check

---

## Current meta recommendation

For future planning updates, bias toward these preventive rules:

1. new orchestration features require explicit negative-path tests
2. new workflow modes require declared-vs-runtime truth checks
3. smoke/eval gates should validate structural completeness, not just envelope presence
4. CLI/export surfaces should be reviewed whenever eval/runtime semantics expand

These are not permanent enterprise rules yet, but they are already strong candidates for future plan hardening.
