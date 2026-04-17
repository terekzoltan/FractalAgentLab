# Input-Prompt Audit Wave3 v01

## Purpose

This document audits the current input, context, prompt, and provider-wrapper flow for the
Fractal Agent Lab workflow family after Wave 3 closeout.

It does not redesign prompts or schemas.
It records the current repo-visible truth so later work can improve the system from a stable
baseline instead of from assumptions.

## Disclosure

- execution mode: `manual_policy_driven`
- visibility/audit state: git-visible code/docs surfaces only
- no ignored/local-only `data/` artifacts were needed for the conclusions in this document

## Scope

In scope:

- H1 / H2 / H3 workflow input surfaces
- CLI input parsing and context injection
- step-runner request shape
- provider wrapper request shape
- prompt/provenance surfaces visible in code and current CLI/eval outputs
- current gaps between contract-ref wording and explicit runtime enforcement

Out of scope:

- prompt rewrite
- production-code changes
- schema redesign
- eval redesign
- `CV1` implementation

## Executive Summary

The current system keeps user-facing input relatively thin and pushes most complexity into
orchestration, context loading, and prompt layering.

The main current truths are:

1. Workflow input schemas are mostly referenced by name (`h1.input.v1`, `h2.input.v1`,
   `h3.input.v1`) rather than strongly enforced as explicit runtime input-law modules.
2. The actual model input is larger than the raw user payload because the step runner and
   provider adapter add workflow metadata, instructions, context, and policy references.
3. Session/project memory are application-level context enrichers keyed by explicit
   `session_id` / `project_id` fields in `input_payload`, not ambient OpenCode/session memory.
4. H1 currently has the strongest prompt-provenance visibility because prompt tags are injected
   into outputs and shown in CLI/eval surfaces; H2/H3 do not currently expose an equivalent
   output-level provenance surface.
5. Session memory currently has a stronger load foundation than lifecycle closeout, while
   project memory has both load and canonical post-run update behavior for successful
   `h2.manager.v1` / `h3.manager.v1` runs.

## Shared Input Flow

### 1. Raw operator input

The CLI accepts `--input-json` and requires it to decode to a JSON object.

References:

- `src/fractal_agent_lab/cli/app.py:284-292`

This means the minimum accepted external input law today is:

- valid JSON
- top-level object

There is no stronger generic runtime enforcement in the CLI for the workflow-specific
contents of that object.

### 2. Context loading before execution

Before workflow execution, the CLI loads two optional context layers:

- session context via `load_session_memory_context(...)`
- project context via `load_project_memory_context(...)`

References:

- `src/fractal_agent_lab/cli/app.py:189-191`
- `src/fractal_agent_lab/memory/session_context.py:12-32`
- `src/fractal_agent_lab/memory/project_context.py:9-29`

Both are keyed from the raw `input_payload`.

Current app-level keys:

- `session_id`
- `project_id`

These are not inferred from OpenCode chat/session state.
They must be present explicitly in `input_payload`.

### 3. Workflow execution request shape

The step runner converts workflow state into an `AdapterStepRequest`.

Current request fields include:

- `run_id`
- `workflow_id`
- `step_id`
- `agent_id`
- `role`
- `input_payload`
- `context`
- `step_description`
- `instructions`
- `instruction_ref`
- `model_policy_ref`
- `prompt_version`
- `agent_metadata`
- `model`

References:

- `src/fractal_agent_lab/adapters/base/contract.py:8-23`
- `src/fractal_agent_lab/adapters/step_runner.py:54-73`

This is the main reason the actual model input is richer than the raw user payload.

### 4. Provider wrapper layer

The OpenRouter adapter adds a second prompt layer:

- a provider-side system instruction that forces one valid JSON object
- a structured user payload containing both workflow metadata and the original
  `input_payload`/`context`

References:

- `src/fractal_agent_lab/adapters/openrouter/adapter.py:35-61`
- `src/fractal_agent_lab/adapters/openrouter/adapter.py:191-223`

This means the effective model input is:

1. workflow/agent instruction
2. provider JSON-only wrapper
3. structured user payload with metadata + context + raw input

## Memory / Context Audit

### Session memory

Session context is loaded from `input_payload.session_id`.

Behavior:

- if `session_id` is absent, no session context is loaded
- if present, the context always at least carries `session_id`
- if a canonical session-memory record exists, it is added as `context.session_memory`

References:

- `src/fractal_agent_lab/memory/session_context.py:17-31`
- `src/fractal_agent_lab/memory/json_store.py:20-58`

Current storage path:

- `data/memory/sessions/<encoded_session_id>.json`

Lifecycle note:

- current CLI flow writes a session snapshot artifact and memory-candidate artifact
- it does not currently expose an equally explicit canonical post-run session-memory updater in
  the same way project memory does

References:

- `src/fractal_agent_lab/cli/app.py:226-235`
- `src/fractal_agent_lab/memory/session_memory.py:61-112`

Current audit classification:

- session memory is a real load/context foundation
- its full canonical lifecycle is less explicit than project memory in the current CLI path

### Project memory

Project context is loaded from `input_payload.project_id`.

Behavior:

- if `project_id` is absent, no project context is loaded
- if present, the context always at least carries `project_id`
- if a canonical project-memory record exists, it is added as `context.project_memory`

References:

- `src/fractal_agent_lab/memory/project_context.py:14-28`
- `src/fractal_agent_lab/memory/json_store.py:71-109`

Current storage path:

- `data/memory/projects/<encoded_project_id>.json`

Lifecycle note:

- the CLI now runs `run_post_run_project_memory_update(...)`
- this is canonical post-run update behavior for successful `h2.manager.v1` and
  `h3.manager.v1` runs
- this is not a general “all workflows update project memory” rule

References:

- `src/fractal_agent_lab/cli/app.py:239-245`
- `src/fractal_agent_lab/memory/project_update.py:17-18`
- `src/fractal_agent_lab/memory/project_update.py:30-73`

Current audit classification:

- project memory is currently the stronger end-to-end memory lifecycle surface

## H1 Audit

### Workflow contract surface

All current H1 variants reference the same input schema ref:

- `h1.input.v1`

References:

- `src/fractal_agent_lab/workflows/h1.py:8`
- `src/fractal_agent_lab/workflows/h1_handoff.py:8`
- `src/fractal_agent_lab/workflows/h1_single.py:8`

Observed gap:

- the repo clearly uses the ref name
- but this audit did not find a concrete shared runtime input-schema module enforcing the shape
  behind `h1.input.v1`

Current audit classification:

- contract ref exists
- strong runtime input-law is not yet explicit from repo-visible implementation

### Current accepted practical input

The current H1 examples and tests consistently use a very small payload, typically centered on:

- `idea`
- optional `session_id`
- optional `project_id`

The raw payload is intentionally simple.
Complexity mostly appears later through role prompts, context, and orchestration.

### Prompt layering

H1 is the richest audited prompt family because it has:

- manager prompt family
- handoff prompt family
- single-agent prompt family

References:

- `src/fractal_agent_lab/agents/h1/prompts.py:27-85`
- `src/fractal_agent_lab/agents/h1/pack.py:22-139`
- `src/fractal_agent_lab/agents/h1/pack.py:234-273`

Current role responsibilities are sharply separated:

- intake -> normalize the idea into a brief
- planner -> validation framing
- critic -> weaknesses and alternatives
- synthesizer -> final decision package

The single-agent baseline collapses this into one prompt.

### Provenance visibility

H1 has explicit prompt provenance surfaces:

- pack prompt versions in agent metadata
- role prompt versions in agent metadata
- output-level `prompt_tags`
- CLI formatting support for those tags
- eval surfaces that consume or compare those tags

References:

- `src/fractal_agent_lab/agents/h1/pack.py:31-34`
- `src/fractal_agent_lab/cli/app.py:211-215`
- `src/fractal_agent_lab/cli/formatting.py:455-555`
- `src/fractal_agent_lab/evals/h1_smoke_comparison.py:226-249`
- `src/fractal_agent_lab/evals/h1_memory_materiality.py:441-451`

Current audit classification:

- H1 has the best current prompt provenance visibility in the repo

## H2 Audit

### Workflow contract surface

`h2.manager.v1` references `h2.input.v1`.

References:

- `src/fractal_agent_lab/workflows/h2.py:8,55`

As with H1, the ref is clear but this audit did not find a separate explicit runtime input-schema
implementation module behind `h2.input.v1`.

### Prompt layering

H2 roles currently expect the user intent to already be a broad project-goal style input.

Role outputs are:

- intake -> project brief
- planner -> decomposition / sequencing
- architect -> tracks/modules/phases/boundaries
- critic -> risk zones / merge risks / open questions
- synthesizer -> final decomposition package

References:

- `src/fractal_agent_lab/agents/h2/prompts.py:18-52`
- `src/fractal_agent_lab/agents/h2/pack.py:8-138`

### Provenance visibility

H2 agent specs carry prompt metadata in pack/role metadata, but the repo does not currently
surface H2 prompt provenance in the same output-visible way H1 does.

References:

- `src/fractal_agent_lab/agents/h2/pack.py:17-20`
- `src/fractal_agent_lab/agents/h2/pack.py:106-122`

Current audit classification:

- prompt provenance exists in agent metadata
- output-level provenance visibility is weaker than H1

## H3 Audit

### Workflow contract surface

`h3.manager.v1` references `h3.input.v1`.

References:

- `src/fractal_agent_lab/workflows/h3.py:8,55`

As with H1/H2, this audit did not find a separate explicit runtime input-schema implementation
module behind `h3.input.v1`.

### Prompt layering

H3 expects architecture-review style intent and normalizes it through:

- intake -> bounded review brief
- planner -> review sequence / focus areas
- systems -> architecture boundaries / interfaces / coupling pressures
- critic -> bottlenecks / merge risks / refactor pressure
- synthesizer -> final four-section architecture review

References:

- `src/fractal_agent_lab/agents/h3/prompts.py:18-49`
- `src/fractal_agent_lab/agents/h3/pack.py:8-137`

### Provenance visibility

H3 mirrors H2 in that prompt/version metadata lives in agent metadata, but not in an H1-style
output-level prompt-tag surface.

Current audit classification:

- metadata-level provenance exists
- output-level provenance is currently thinner than H1

## Current Drift / Gap Notes

### 1. Schema ref vs runtime enforcement gap

All three workflow families use named input-schema refs, but this audit did not find a strongly
enforced shared runtime input-schema layer behind those refs.

This is not necessarily a bug today.
It does mean the repo currently communicates input law more strongly at the workflow-contract/doc
level than at the generic runtime-validation level.

### 2. H1 has stronger prompt provenance than H2/H3

H1 prompt tags are injected into output payloads and exposed in CLI/eval surfaces.
H2/H3 currently rely more on internal metadata than on output-visible prompt provenance.

Current classification:

- acceptable current asymmetry
- good future improvement candidate if cross-workflow provenance parity becomes important

### 3. Session memory is conceptually clear but lifecycle-thinner than project memory

Session memory has a real load path and snapshot/candidate surfaces.
Project memory currently has a more explicit canonical load + update loop.

Current classification:

- acceptable current asymmetry
- important to describe honestly in future docs or demos

### 4. Complexity is mostly hidden in orchestration and wrapper layers

The raw operator input can be very small, but actual model input becomes much richer through:

- context injection
- role instructions
- metadata references
- provider wrapper structure

This means output quality analysis should not focus only on the raw user payload.

### 5. App-level session/project identity is explicit, not ambient

Current memory/context behavior depends on explicit `session_id` / `project_id` keys in
`input_payload`.
The repo does not currently derive these from ambient OpenCode chat/session state.

This should remain explicit in future explanations to avoid confusion.

## Recommended Next Improvements

These are audit recommendations, not implementation commitments.

1. Decide whether `h1.input.v1` / `h2.input.v1` / `h3.input.v1` should remain mainly contract refs
   or later gain explicit shared runtime-validation surfaces.
2. If cross-workflow prompt provenance becomes important, consider whether H2/H3 should get an
   H1-style output-visible provenance surface.
3. If session memory becomes a heavier user-facing feature, make its lifecycle wording as explicit
   as project memory wording.
4. Keep explaining memory/context as app-level explicit IDs rather than ambient shell/session
   memory.
5. When evaluating output quality, separate these layers clearly:
   - raw user payload
   - loaded context
   - role prompts
   - provider wrapper

## Non-Goals

This audit does not conclude that:

- prompts are currently wrong
- bigger raw input is automatically better
- schema refs are invalid
- H1/H2/H3 should all expose identical prompt provenance immediately
- memory should become ambient or invisible

The current purpose is clarity, not redesign.
