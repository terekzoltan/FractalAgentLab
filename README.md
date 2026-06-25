# Fractal Agent Lab

Fractal Agent Lab is a local evidence, review, measurement, and context-continuity layer for OpenCode-assisted software-delivery workflows.

OpenCode remains the interactive coding/session motor. FAL's job is to make the surrounding workflow inspectable: what was planned, what was reviewed, what changed, what evidence exists, what is still blocked, and what the next safe action is.

The current goal is not to build an autonomous coding agent or a dashboard-first command center. The goal is to make human-in-the-loop AI-assisted development safer, more measurable, and easier to resume across sessions.

---

## Current Direction

The project has moved from early agent-orchestration experiments into an OpenCode-backed workflow governance layer.

Current thesis:

> FAL is a local control-plane evidence layer around OpenCode sessions that makes agentic software-delivery workflows inspectable, reviewable, measurable, and recoverable after context loss.

Older orchestration experiments remain in the repo as useful research history and test material. They are not the current north star.

---

## What FAL Does Now

### 1. Turns workflow activity into structured evidence

FAL takes the messy output of a human/OpenCode workflow and records it as structured artifacts.

Instead of relying on chat history, the workflow can leave behind sidecars such as:

- `opencode_loop_summary.json`
- `packet_ledger.json`
- `selected_outputs.json`
- `review_synthesis.json`
- `approval_log.json`
- `workflow_metrics.json`
- `review_findings_ledger.json`
- `context_digest.json`

This makes the workflow reviewable later without pretending that raw chat is the source of truth.

### 2. Measures workflows across multiple axes

FAL avoids a fake single "quality score". A loop can instead be evaluated through separate evidence dimensions:

- reliability: clean-pass eligibility, validation state, false-green risk, blocker count
- review quality: review findings, required fixes, true-positive / false-positive / uncertain labels
- efficiency: packet count, approval count, fix-cycle count, operator decision count
- evidence health: required sidecar presence, stage coverage, artifact completeness
- context health: context digest presence, recovery label, loaded/deferred context refs
- learning value: learning candidates created, accepted, rejected, or left pending
- privacy/public safety: raw-output retention, public-export state, redaction boundary
- operator burden: how much manual steering was needed

The point is to see where a workflow is strong or weak instead of compressing everything into a misleading number.

### 3. Preserves review findings as first-class state

Review output should not disappear into a conversation.

FAL can track findings with severity, category, affected files, required fix, resolution status, and human label. This is the basis for finding precision, false-green analysis, missed-issue follow-up, and later workflow improvement.

### 4. Helps sessions recover after context loss

Long OpenCode sessions eventually compact or lose context. FAL treats recovery as a contract, not a ritual.

The key pieces are:

- `context_digest.json`: a sidecar that records what context was loaded, deferred, and how recovery went
- target-local `.fal/ACTIVE_CONTEXT.*`: a small hot-path card for the target repo's current state
- checkpoint summaries: bounded, machine-readable summaries of stable workflow points

This lets a new session reload the current truth first, then deeper documents only when needed.

### 5. Keeps learning controlled

FAL can turn repeated issues into learning candidates, but it does not automatically rewrite prompts, change routing, commit code, or publish anything.

The intended lifecycle is:

```text
proposed -> reviewed -> accepted/rejected -> implemented separately -> validated -> retired
```

### 6. Supports external target-project governance

FAL can sit around another project as a governance and evidence layer.

The target project still owns its own code, docs, and decisions. FAL records the loop, checks gates, preserves findings, and keeps the next safe action clear.

---

## Current Boundaries

FAL does not currently authorize or provide:

- autonomous software implementation
- OpenCode bridge/API/session delivery
- browser-side OpenCode control
- automatic routing, dispatch, commit, or push
- public release of raw evidence
- HUB/dashboard implementation
- target-project implementation approval by itself

HUB compatibility is parked as future docs/contract-first work. The only allowed future HUB posture currently under consideration is read-only evidence consumption and next-action preview, not control.

---

## Main Artifact Surfaces

Canonical runtime artifacts:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`

Additive workflow sidecars:

- `data/artifacts/<run_id>/workflow_metrics.json`
- `data/artifacts/<run_id>/review_findings_ledger.json`
- `data/artifacts/<run_id>/context_digest.json`

Coordination and policy surfaces:

- `ops/PROJECT_STATE.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`
- `docs/private/`
- `docs/public/`

Target-local restore surface, when FAL is used around another repo:

- `.fal/ACTIVE_CONTEXT.md`
- `.fal/ACTIVE_CONTEXT.json`

`data/` and target `.fal/` surfaces are local/private by default.

---

## How It Helps In Practice

A typical governed loop looks like this:

```text
human + OpenCode session
  -> plan / review / implementation / review-fix loop
  -> selected outputs and checkpoint summaries
  -> FAL evidence sidecars
  -> metrics + findings + context digest
  -> next safe action recorded for the next session
```

The value is not that FAL writes the code. The value is that it reduces workflow drift:

- the next session knows what is actually done
- review findings stay visible until resolved
- blocked work stays blocked instead of accidentally starting
- context can be restored from a small current-state card
- public/private boundaries stay explicit
- later methodology claims can be checked against evidence

---

## Repository Structure

```text
ops/        private coordination, sequencing, and project-operating state
docs/       architecture, public-safe docs, and private doctrine
src/        Python implementation
tests/      replay, eval, validation, and contract tests
configs/    runtime and provider configuration
examples/   small curated examples
data/       local runtime artifacts, ignored by git
ui/         local workbench experiments, not the current mainline
```

---

## Quickstart

The historical CLI workflow paths remain useful for smoke checks and development.

### Requirements

- Python 3.12+

### List workflows

Git Bash:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli list-workflows
```

PowerShell:

```powershell
$env:PYTHONPATH='src'; python -m fractal_agent_lab.cli list-workflows
```

### Run a small workflow smoke path

Git Bash:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli run h1.lite --input-json "{\"idea\":\"AI founder assistant\"}" --format json --show-trace
```

PowerShell:

```powershell
$env:PYTHONPATH='src'; python -m fractal_agent_lab.cli run h1.lite --input-json '{"idea":"AI founder assistant"}' --format json --show-trace
```

### Inspect stored traces

Git Bash:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli trace list --format text
PYTHONPATH=src python -m fractal_agent_lab.cli trace show --run-id <run_id>
```

PowerShell:

```powershell
$env:PYTHONPATH='src'; python -m fractal_agent_lab.cli trace list --format text
$env:PYTHONPATH='src'; python -m fractal_agent_lab.cli trace show --run-id <run_id>
```

### Run focused checks

Git Bash:

```bash
PYTHONPATH=src python -m unittest tests.evals.test_opencode_workflow_metrics tests.core.contracts.test_w7_5_context_digest tests.memory.test_learning_candidates
```

---

## Visibility Policy

This repo uses a private-canonical / public-curated model.

Private coordination, raw evidence, prompt/gate heuristics, failure corpora, and local artifacts stay private by default. Public output must be deliberately sanitized and reviewed before publication.

See:

- `docs/Repo-Visibility-and-Release-Policy-v01.md`
- `docs/public/README.md`

---

## Status

FAL is an active personal engineering project.

The current mature slice is the OpenCode-backed evidence and measurement layer. Future work may include public-safe methodology writeups, target-project validation, and eventually HUB compatibility contracts, but none of those imply autonomous control or public release by default.
