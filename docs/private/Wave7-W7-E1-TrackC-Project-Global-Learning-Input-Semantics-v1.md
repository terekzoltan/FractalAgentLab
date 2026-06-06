# Wave7 W7-E1 TrackC Project Global Learning Input Semantics v1

## Status

Track C implementation review packet for `W7-E1`.

Execution mode: `opencode_assisted`.

Scope verdict: `standalone_learning_input_helper_only`.

Review lane: real implementation review, not no-op.

W7-E2 status: blocked until W7-E1 acceptance is explicitly confirmed.

## Touched Files

W7-E1 Track C review scope is limited to:

- `src/fractal_agent_lab/memory/opencode_learning.py`
- `src/fractal_agent_lab/memory/__init__.py`
- `tests/memory/test_w7_opencode_learning.py`
- `docs/private/Wave7-W7-E1-TrackC-Project-Global-Learning-Input-Semantics-v1.md`

Staging boundary:

- do not stage or commit in this review lane
- do not use broad staging such as `git add .`
- if W7-E1 is later accepted for commit prep, never stage `src/fractal_agent_lab/memory/__init__.py` without `src/fractal_agent_lab/memory/opencode_learning.py`
- do not mix W7-E1 with W7-D Track A files, UI files, ingest files, adapter files, CLI files, router files, `data/**`, or unrelated Wave6/W6.5 docs

## Implemented Boundary

`W7-E1` adds a standalone learning-input helper for accepted OpenCode-backed loop artifacts.

It does not integrate with `fal ingest router-loop`, the router adapter, the UI/workbench, or advisory suggestion behavior.

Approved first slice:

- standalone helper taking `run_id` plus `data_dir`
- dry-run by default
- explicit write mode for project/global memory stores
- private `opencode_learning_update.json` sidecar only in write mode
- project-local learning candidates from accepted W7 artifacts
- minimal de-identified global learning entries using a fixed topic allowlist

## Input Boundary

The helper consumes only canonical W7 artifacts that already pass acceptance validation:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/opencode_loop_summary.json`
- `data/artifacts/<run_id>/packet_ledger.json`
- `data/artifacts/<run_id>/selected_outputs.json`
- `data/artifacts/<run_id>/review_synthesis.json`
- `data/artifacts/<run_id>/approval_log.json`
- `data/artifacts/<run_id>/ingest_report.json`

Artifact directory presence alone is not accepted evidence.

The accepted workflow id is:

```text
opencode.meta_track.loop.v1
```

## Sidecar Trust Boundary

`RF-2026-06-06-01` is fixed locally in W7-E1 by reader-side fail-closed sidecar validation before learning extraction or write mode can proceed.

This is not a W7-B/C schema change and does not modify the ingest writer.

Every sidecar consumed by `_load_sidecars()` is covered by one shared metadata validation path:

- `opencode_loop_summary` -> `w7.opencode_loop_summary.v1`
- `packet_ledger` -> `w7.packet_ledger.v1`
- `selected_outputs` -> `w7.selected_outputs.v1`
- `review_synthesis` -> `w7.review_synthesis.v1`
- `approval_log` -> `w7.approval_log.v1`
- `ingest_report` -> `w7.ingest_report.v1`

Each consumed sidecar must have the expected `schema_version` and `run_id == requested run_id`. There are no documented exceptions in the current W7-B/C sidecar contract.

Invalid sidecars fail closed with deterministic skipped reasons such as:

- `invalid_sidecar:packet_ledger:schema_version`
- `invalid_sidecar:packet_ledger:run_id`

Invalid sidecars produce no project memory write, no global memory directory, and no `opencode_learning_update.json`.

## Project ID Rule

Accepted project id sources:

- `run.input_payload.target_project_id`
- `run.context.target_project_context.target_project_id`

Forbidden fallback:

- session id
- repo path
- repo display name alone

## Project-Local Learning

Project-local memory may retain repo-specific learning.

Supported first-slice subtypes:

- `review_gate_rule`
- `repo_specific_caution`
- `manual_smoke_requirement`
- `transport_pattern`
- `fix_loop_lesson`
- `validation_expectation`

The first implementation extracts only short distilled values from accepted final-output fields. It does not copy raw selected output excerpts into memory.

## Global Learning

Global learning is separate from project-local memory and remains private/local under:

```text
data/memory/global/<topic>.json
```

Allowed first-slice topics:

- `opencode_review_patterns`
- `router_transport_lessons`
- `manual_smoke_gate_patterns`
- `meta_triage_patterns`
- `review_fix_patterns`

Global lessons must be de-identified.

One run can only create low-confidence global learning.

Global learning entries are deduped by topic plus normalized lesson text. A repeated write for the same de-identified run reference is skipped. A repeated lesson from a new run extends `source_run_ids`, merges new source paths, increments `times_observed`, and keeps the first-slice confidence semantics.

## De-Identification Rules

Global learning must skip or reject lessons containing:

- target repo path
- target project name
- Windows path fragments
- raw selected excerpt text
- source-session or message-specific private details

Project-local memory may contain repo-specific facts, but global learning must not.

Source run ids written to global learning use a hashed reference format:

```text
run_sha256_<12_hex_chars>
```

The original run id is retained only in project-local memory and the private `opencode_learning_update.json` sidecar.

## Dry-Run And Write Behavior

Default behavior is dry-run:

- validate/load accepted artifacts
- extract project/global candidates
- return skipped reasons and candidate summaries
- write no memory stores
- write no sidecar

Explicit write mode:

- merges project-local memory entries
- merges global de-identified learning entries
- writes `data/artifacts/<run_id>/opencode_learning_update.json`

The sidecar is local/private evidence of Track C extraction only. It is not a Track E validation verdict.

The sidecar records:

- `artifact_type: opencode_learning_update`
- `artifact_version`
- project and global schema versions
- `run_id`, `workflow_id`, and `project_id`
- write mode and created/updated/skipped counts
- skipped reasons
- de-identification summary
- project and global candidates
- `track_e_validation_claim: false`

## Non-Goals Preserved

`W7-E1` does not implement:

- automatic `fal ingest router-loop` integration
- CLI changes
- router/session mutation
- OpenCode bridge/API/session delivery
- UI/workbench changes
- ingest schema changes
- advisory suggestions
- identity-driven routing
- public export

It also does not implement W7-G advisory suggestions or treat learning entries as routing authority.

## Verification Evidence

Fresh W7-E1 verification run on 2026-06-06 after `RF-2026-06-06-01` local fix:

- `$env:PYTHONPATH='src'; python -m unittest tests.memory.test_w7_opencode_learning` -> PASS, 11 tests
- `$env:PYTHONPATH='src'; python -m unittest tests.memory.test_project_update tests.memory.test_project_memory` -> PASS, 15 tests
- `$env:PYTHONPATH='src'; python -m unittest discover -s tests/ingest -p "test_opencode_loop.py"` -> PASS, 24 tests
- `$env:PYTHONPATH='src'; python -m unittest tests.evals.test_artifact_acceptance tests.tracing.test_artifact_layout` -> PASS, 11 tests
- `python -m compileall src tests` -> PASS
- `git diff --check -- src/fractal_agent_lab/memory/opencode_learning.py src/fractal_agent_lab/memory/__init__.py tests/memory/test_w7_opencode_learning.py docs/private/Wave7-W7-E1-TrackC-Project-Global-Learning-Input-Semantics-v1.md` -> PASS with LF-to-CRLF warning for `src/fractal_agent_lab/memory/__init__.py` only

New adversarial coverage:

- wrong sidecar `schema_version` rejects learning with no project/global memory writes and no learning sidecar
- mismatched sidecar `run_id` rejects learning with no project/global memory writes and no learning sidecar
- skipped reasons include the sidecar name plus `schema_version` or `run_id`

## W7-E2 Handoff

Track E `W7-E2` should validate:

- de-identification behavior
- non-public defaults
- memory candidate quality
- no identity-driven routing authority
- sidecar wording does not imply Track E validation
