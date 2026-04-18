# Wave3-CV1-C-TrackD-H4-Helper-Surface-v1

## Scope

This delivery closes `CV1-C` as a thin Track D helper/compiler slice for H4.

Implemented scope:

- `wave_start` packet compiler from canonical H4 `context_report.json`
- packet rendering (`json` + `markdown`)
- non-canonical packet sidecar writing under `data/artifacts/<run_id>/packets/`
- additive CLI hook on the existing `fal run` path

Out of scope:

- queue/inbox/outbox support
- session bus or guarded dispatch
- shell replacement
- Track C planning artifact ownership (`implementation_plan.md`, `acceptance_checks.json`)
- new `h4.seq_next.v1` runnable default-mock proof

---

## Ownership and boundary notes

`CV1-C` remains Track D-owned helper/compiler work.

- helper logic is derived from canonical H4 artifact truth (`context_report.json`)
- helper logic does not introduce a new raw repo-truth authority layer
- transport packet sidecars are explicitly non-canonical and additive

Default-mock seam note:

- this `CV1-C` slice does not close future `h4.seq_next.v1` runnable default-mock proof
- if that proof later needs a tiny MockAdapter support seam, it should be opened explicitly as a narrow Track D follow-up scope

---

## Implemented surfaces

- `src/fractal_agent_lab/tools/h4_packet_compiler.py`
- `src/fractal_agent_lab/tools/__init__.py`
- `src/fractal_agent_lab/cli/app.py` as a shared boundary, but only for the additive wave_start packet hook; Track C-owned seq_next artifact writers remain separate

Validation/test surfaces:

- `tests/tools/test_h4_packet_compiler.py`
- `tests/cli/test_cv1_a_h4_wave_start_cli.py`

---

## Packet shape and provenance

Current packet type support in this step:

- `wave_start` only

Required packet fields include:

- `packet_type`
- `packet_version`
- `role`
- `source_ref`
- `frontier_ref`
- `execution_mode`
- `visibility_audit_state`
- `status`
- `generated_at`

The packet content is derived from canonical H4 context-report fields and remains a transport/helper surface, not artifact-law truth.

`completed_previous_steps` is intentionally omitted until a canonical source field exists for it.

---

## Validation

Targeted validation for this slice should include:

- helper compile/render/write tests
- H4 CLI canonical-sidecar regression to prove packet sidecar creation stays additive
- no-queue/no-bus scope integrity

See tests listed above.

---

## Next dependency

- `CV1-B` must complete for `CV1-D` to open
- `CV1-D` evaluates whether H4 artifacts (including this helper sidecar surface) are materially more useful than unstructured planning
