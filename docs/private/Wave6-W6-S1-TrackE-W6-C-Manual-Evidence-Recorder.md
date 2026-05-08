# Wave6 W6-S1 TrackE W6-C Manual Evidence Recorder

## Status

Track E delivery note for `W6-C` manual evidence recorder MVP.

Execution mode: `opencode_assisted`

Visibility / audit state:

- git-visible code, tests, and docs were updated
- local-only `ops/` coordination docs were consulted for Wave 6 sequencing
- `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md` was consulted as untracked private planning context

## Scope Delivered

Track E delivered a manual/semi-manual recorder for Wave 6 loop evidence:

- operator-provided JSON input contract: `w6.manual_evidence_input.v1`
- validated W6 packet recording through the accepted W6-A packet contract
- private loop evidence output under `data/evidence/wave6/loops/<loop_id>/`
- packet JSON files under `packets/`
- `ledger.json`
- `review_findings.json`
- per-loop `usefulness_row.json`
- human-readable `summary.md`
- script stdout JSON summary for Meta review

## Input Boundary

The script input is an operator-provided JSON file, not an OpenCode API/session feed.

Required input schema version:

```text
w6.manual_evidence_input.v1
```

The recorder validates the full recorder input and every packet before writing any files.

## Output Boundary

W6-C writes private/local evidence only:

```text
data/evidence/wave6/loops/<loop_id>/packets/<packet_id>.json
data/evidence/wave6/loops/<loop_id>/ledger.json
data/evidence/wave6/loops/<loop_id>/review_findings.json
data/evidence/wave6/loops/<loop_id>/usefulness_row.json
data/evidence/wave6/loops/<loop_id>/summary.md
```

The recorder does not write to canonical run/trace paths or `data/artifacts/<run_id>/` sidecars.

## False-Green Boundaries

- Invalid packets are rejected before file writes.
- Mixed `loop_id` values are rejected before file writes.
- Duplicate `packet_id` values are rejected before file writes.
- Warning-grade packets remain warning-grade ledger evidence.
- Missing/skipped tests are explicitly recorded.
- `hold`, `blocked`, and `deep_review_needed` are not treated as clean pass evidence.
- Operator-provided `final_status: pass` is not enough for `clean_pass`.
- `clean_pass` requires a locally computed W6-B transition validation pass when the W6-B validator is available.
- Operator-provided `transition_validation` is preserved as evidence only and cannot make a loop clean by itself.
- `sanitized_public` is not a default and is rejected for W6-C recorder packets.
- One `usefulness_row.json` is a seed row only, not a broad usefulness claim.

## Partial-Write Prevention

The recorder validates all input first, writes into a staging directory only after validation passes, then moves the staged loop directory into the final private evidence path.

Invalid input must not create packet files, ledger files, review finding files, usefulness rows, or summaries.

## Review Finding Semantics

Allowed finding severity values:

- `low`
- `medium`
- `high`
- `critical`

Allowed finding status values:

- `accepted`
- `rejected`
- `fixed`
- `deferred`

The recorder preserves finding counts and statuses. It does not invent a review-quality score.

## Usefulness Seed Row

W6-C writes one per-loop `usefulness_row.json` with the single-loop claim boundary:

```text
single_loop_seed_row_only_not_broad_usefulness_claim
```

Aggregate `usefulness_rows.jsonl` remains deferred to W6-D/W6-F.

## Transition Validation Boundary

Before W6-B, transition validation may be absent or recorded as unavailable.

After W6-B exists, W6-C consumes the public W6-B transition validator and records the computed result as evidence. W6-C does not own transition-law design or enforcement.

If W6-B transition validation is unavailable, failed, warning-grade, not closed, or not commit-ready, W6-C may still record the loop but must set `clean_pass` to false.

## Track C Checkpoint

Track C payload-semantics review is not a blocker for starting W6-C implementation.

Before W6-D relies on packet payload content as semantic evidence, Track C should confirm role, command, and handoff meaning boundaries.

## Explicit Non-Goals

Not delivered under W6-C:

- W6-B transition-law ownership
- OpenCode API/session delivery
- hidden automation
- commit or push automation
- UI/dashboard work
- public case-study generation
- aggregate usefulness evaluation
- broad benchmark or coding-agent performance claims

## Validation

Targeted validation commands:

```bash
python -m unittest tests.core.contracts.test_w6_packet_contract
python -m unittest tests.core.contracts.test_w6_ledger_contract
python -m unittest tests.tracing.test_evidence_layout
python -m unittest tests.evals.test_w6_manual_evidence_recorder
python -m unittest tests.scripts.test_w6_c_manual_evidence_recorder
git diff --check
```

## Downstream Handoff

W6-D may use W6-C to capture one real FAL Meta/Track loop only after W6-B and W6-C are accepted.

W6-D should treat the generated `usefulness_row.json` as private seed evidence, not as a final usefulness evaluation.
