# Wave5 W5-S2 TrackA U5-D Workflow Launch

## Status

Track A implementation delivery note for `U5-D` first pass.

Execution mode: `opencode_assisted`.

Visibility / audit state: git-visible UI code, generator script, tests, docs, and local
ignored workflow catalog output under `ui/public/generated/workflows.json`.

## Scope

Implemented the first bounded write/action preparation surface in the Wave 5 workbench.

In scope:

- generated workflow catalog derived from the CLI workflow registry
- `Packets / Launch` page as a `PARTIAL` surface
- OpenCode/bash terminal command preview for `fal run` via `PYTHONPATH=src python -m fractal_agent_lab.cli run ...`
- raw JSON object input editor
- visible runtime/providers/model-policy config paths
- optional provider override preview
- structured operator-mediated packet skeleton
- explicit no-autonomy/no-bridge/no-commit boundary wording

Out of scope and intentionally not implemented:

- actual browser-triggered local execution
- local Python bridge
- backend/API service
- daemon or long-running process
- OpenCode session control
- session bus or queue
- commit/push automation
- structured per-workflow input semantics

## Generated Workflow Catalog Boundary

Generator command from `ui/`:

```bash
npm run build:workflows
```

Default output:

```text
ui/public/generated/workflows.json
```

The generated workflow catalog is a local/private derived UI surface and is gitignored
through `/ui/public/generated/`.

Canonical workflow truth remains the Python CLI workflow registry:

```text
src/fractal_agent_lab/cli/workflow_registry.py
```

The catalog is registry-derived and does not hand-maintain a React-only workflow list.

Schema version:

```text
u5_d.workflow_catalog.v1
```

Workflow catalog entries include only allowlisted metadata:

- `hero_workflow`
- `variant`
- `schema_contract`

The generator does not dump arbitrary `WorkflowSpec.metadata` into the UI catalog.

## Command Preview Boundary

The command preview target is an OpenCode/bash terminal command.

The UI validates that input JSON parses as a top-level object before the command is
considered ready. Arrays, strings, numbers, booleans, and `null` are rejected.

The preview includes visible config paths and provider override state. Track A does not
change provider routing semantics; it only renders the selected preview envelope.

## Packet Composer Boundary

The packet composer creates a structured skeleton with:

- target role/Track
- workflow id
- input JSON
- exact command preview
- runtime config path
- providers config path
- model policy config path
- provider override if selected
- optional source run/artifact references
- explicit boundary text

The packet is advisory and operator-mediated. It is not a gate, not a completed Track

## Known Limits

- `Packets / Launch` is `PARTIAL` because actual local execution is deferred.
- Browser-triggered execution requires a separate bridge design and Meta approval.
- Structured per-workflow forms are deferred because workflow input semantics belong to
  Track C review if the UI goes beyond raw JSON object input.
- PowerShell/Windows command preview is deferred; the first pass targets the established
  OpenCode/bash command pattern.

## Validation Commands

Track A local implementation verification command checklist:

```bash
PYTHONPATH=src python -m unittest tests.scripts.test_u5_d_workflow_catalog
cd ui && npm run build:workflows
cd ui && npm run build:index -- --data-dir ../data
cd ui && npm run build:traces -- --data-dir ../data
cd ui && npx vitest --environment jsdom --run src/App.test.tsx
cd ui && npm run typecheck
cd ui && npm run build
PYTHONPATH=src python -m fractal_agent_lab.cli list-workflows
cd ui && npm audit --audit-level=moderate
git diff --check
```
