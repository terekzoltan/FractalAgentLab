# Wave5-W5-S2-TrackE-U5-E-H2-Comparison-Semantics-Clarification-v1

## Status

```yaml
wave: 5
sprint: W5-S2
epic: U5-E
track_scope: Track E semantics clarification
status: green
execution_mode: docs_only
```

This artifact records a Track E semantics clarification for H2 comparison handling during U5-E closeout.

## Purpose

Clarify how Track A should handle H2 local run pairs when local structural gates pass, but the UI/generator does not know whether the selected runs belong to an intended comparable corpus.

## Decision

Track E confirmation: `GREEN`.

Required semantics:

- H2 local pairs with unknown intended comparable corpus must be labeled `WARNING`.
- Exact reason label: `h2_intended_comparable_corpus_unknown`.
- Track A may still display H2 structural gate facts.
- Track A must not render a clean H2 comparison `PASS` for arbitrary local H2 pairs when intended comparable corpus membership is unknown.

## Exact Track A Wording

Recommended visible outcome:

- label: `WARNING`
- reason: `h2_intended_comparable_corpus_unknown`

Recommended explanation text:

> H2 local structural checks passed, but this pair is not known to be part of an accepted Track E comparable corpus.

Track A may cite this Track E confirmation in the U5-E delivery doc.

## No-PASS Condition

Arbitrary local H2 pairs cannot be `PASS` without accepted Track E corpus evidence, even if local structural gates pass.

This means:

- local structural pass is useful evidence
- local structural pass is not enough for clean H2 comparison readiness
- stronger H2 comparison wording requires accepted Track E curation/comparison backing

## What Track A May Still Show

Track A may still show these H2 facts for arbitrary local pairs:

- comparable key completeness
- key-order match or mismatch
- implementation-wave validity
- recommended starting slice presence
- manager delegate-order check
- artifact validation state
- replay readiness state

These may be displayed as structural facts, but they must not be collapsed into clean comparison `PASS` when corpus intent is unknown.

## Future Corpus Marker Note

An accepted Track E comparable-corpus marker may later be formalized, but that field name is not a current requirement in this clarification.

Any candidate field name discussed now is only future guidance, not a current contract.

## Ownership Boundary

- Track E owns this semantics clarification.
- Track A owns generator/UI/tests implementation.
- Meta owns closeout review and false-green/no-claim regression check.

Track E does not implement Track A UI/generator/test changes in this clarification step.

## Verification Expectations

Track A should prove in its own tests/UX review that:

- unknown-corpus H2 local pairs produce `WARNING`
- reason `h2_intended_comparable_corpus_unknown` is visible in UI, not only JSON
- H2 local structural gate facts remain visible
- no clean H2 `PASS` appears for arbitrary local pairs without accepted Track E corpus evidence

## Known Limits

- This clarification does not define the future corpus-marker field name.
- This clarification does not change the existing U5-E accepted semantics artifact.
- This clarification does not implement or close Track A's U5-E UX work.
