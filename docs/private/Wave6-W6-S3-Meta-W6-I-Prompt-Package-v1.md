# Wave6 W6-S3 Meta W6-I Prompt Package v1

## Status

Meta Coordinator prompt package for `W6-I` external target repo trial.

Execution mode: `opencode_assisted`

Visibility / audit state:

- based on accepted W6-H target readiness and closeout artifacts
- based on owner-approved W6-I operating decisions from Meta discussion
- this package prepares the WorldSim docs-only loop owner prompt, handoff template, Meta review checklist, and Track E evidence/privacy review prompt
- no WorldSim worktree was created by this document
- no WorldSim file was modified by this document
- no raw `data/evidence/wave6/**` artifact was created by this document

## Accepted W6-I Operating Decisions

```yaml
w6i_target_repo: WorldSim
w6i_target_repo_path: C:\EGYETEM\FUNSTUFF\WorldSim
isolated_worktree_required: true
isolated_worktree_path: C:\EGYETEM\FUNSTUFF\WorldSim-W6I-DocsTrial
isolated_worktree_branch: w6i-docs-trial-candidate-a
worldsim_docs_only_loop_owner_session_required: true
minimal_docs_fix_allowed: true
minimal_docs_fix_scope: target_docs_only
worldsim_canonical_sources:
  - ops/PROJECT_STATE.md
  - Docs/Plans/Master/Combined-Execution-Sequencing-Plan.md
worldsim_commit_automatic: false
fal_meta_role: scope_and_evidence_owner_not_worldsim_meta_replacement
```

## Purpose

`W6-I` tests whether Fractal Agent Lab's Wave 6 packet/evidence/review workflow is useful on a real external repo that has its own workflow system.

WorldSim is the target repo, not a subordinate repo. FAL Meta does not replace WorldSim Meta. The first loop stays docs-only so that active WorldSim runtime development is not mixed with FAL evidence-trial work.

## Target Docs Scope

Only these WorldSim files are in target scope:

```text
Docs/Plans/Master/Wave9-Runtime-Campaign-Hardening-Plan.md
Docs/Plans/Master/Wave10-Campaign-Logistics-Hardening-Plan.md
Docs/Plans/Master/Wave10.5-Refinery-TR3-Audit-Gates-Plan.md
Docs/Plans/Master/Wave11-Ecology-Hardening-Plan.md
Docs/Plans/Master/Wave12-Codebase-Architecture-Hardening-Plan.md
```

Forbidden WorldSim surfaces:

- runtime/source/test code outside the five target docs
- `refinery-service-java/`
- `.swarm/**`
- `ops/PROJECT_STATE.md`
- generated or private evidence paths outside the target docs loop
- live endpoints, secrets, deploy, paid/live runs
- public-safe/release claims

## Worktree Setup Packet

The worktree setup should be done before launching the WorldSim docs-only session.

Preflight from the existing WorldSim repo:

```bash
git status --short --branch --untracked-files=all
git log --oneline -5
git rev-parse --show-toplevel
```

Expected action:

```bash
git worktree add "../WorldSim-W6I-DocsTrial" -b w6i-docs-trial-candidate-a HEAD
```

If the worktree path or branch already exists, stop and resolve explicitly. Do not overwrite an existing worktree.

Preflight inside the isolated worktree:

```bash
git status --short --branch --untracked-files=all
git log --oneline -5
```

The WorldSim session must record both the original WorldSim working tree state and the isolated worktree state in its handoff.

## Prompt 1 - WorldSim Docs-Only Loop Owner Session

Copy this prompt into the separate WorldSim OpenCode session running inside:

```text
C:\EGYETEM\FUNSTUFF\WorldSim-W6I-DocsTrial
```

Prompt:

```text
You are the selected WorldSim docs-only loop owner for a FractalAgentLab Wave 6 external target trial (`W6-I`).

Operating mode:
- You are working in the WorldSim repo, preferably the isolated worktree `C:\EGYETEM\FUNSTUFF\WorldSim-W6I-DocsTrial`.
- You are not the FractalAgentLab Meta Coordinator.
- You are not replacing WorldSim Meta.
- You must preserve WorldSim's own workflow canon.
- You may review and minimally fix only the approved docs-only target scope.

Goal:
Run a docs-only merge-readiness review/fix loop for the accepted W6-I Candidate A scope. The purpose is to determine whether the selected WorldSim planning docs are safe to treat as planning-canon-ready without accidentally opening blocked execution scope.

Canonical WorldSim sources to read first:
- `ops/PROJECT_STATE.md`
- `Docs/Plans/Master/Combined-Execution-Sequencing-Plan.md`

Target docs to review:
- `Docs/Plans/Master/Wave9-Runtime-Campaign-Hardening-Plan.md`
- `Docs/Plans/Master/Wave10-Campaign-Logistics-Hardening-Plan.md`
- `Docs/Plans/Master/Wave10.5-Refinery-TR3-Audit-Gates-Plan.md`
- `Docs/Plans/Master/Wave11-Ecology-Hardening-Plan.md`
- `Docs/Plans/Master/Wave12-Codebase-Architecture-Hardening-Plan.md`

Hard forbidden scope:
- do not edit runtime/source/test code
- do not edit `refinery-service-java/`
- do not edit `.swarm/**`
- do not edit `ops/PROJECT_STATE.md`
- do not touch live endpoint, secret-bearing, deploy, paid/live run, or generated/private evidence paths
- do not claim public-safe/release readiness
- do not commit or push

Allowed edits:
- minimal docs-only fixes inside the five target docs only
- only fix merge-readiness issues such as false launch authority, contradictory prereqs, ambiguous Track ownership, unclear blocked-vs-ready wording, or scope leaks

Merge-readiness means:
- docs do not grant accidental execution authority for blocked WorldSim waves/steps
- prereqs and ownership align with WorldSim canonical state
- planning scaffolds are clearly not launch authority
- refinery/live/secret/deploy work remains gated and not first-loop action
- future WorldSim Meta/Track sessions should not get a false-green signal from these docs

Required steps:
1. Record starting state with `git status --short --branch --untracked-files=all` and `git log --oneline -5`.
2. Read the two canonical WorldSim sources listed above.
3. Read the five target docs.
4. Produce findings-first review notes, ordered by severity.
5. If needed, apply minimal target-docs-only fixes.
6. Run `git diff --name-only` and `git diff --check`.
7. Return the handoff using the template below.

Expected final verdict values:
- `MERGE_READY`
- `MERGE_READY_WITH_WARNINGS`
- `FIXED_DOCS_ONLY`
- `BLOCKED`

If any required fix would touch forbidden scope, stop and return `BLOCKED`.
```

## Prompt 2 - WorldSim Handoff Template

The WorldSim docs-only session must return this structure:

```text
# WorldSim W6-I Docs-Only Loop Handoff

## Execution Mode
- opencode_assisted / manual_review / other:

## Workspace State
- original repo path:
- isolated worktree path:
- original repo branch/status summary:
- isolated worktree branch/status summary:
- HEAD commit:
- dirty files at start:

## Canonical Sources Read
- `ops/PROJECT_STATE.md`: yes/no, notes
- `Docs/Plans/Master/Combined-Execution-Sequencing-Plan.md`: yes/no, notes

## Target Docs Reviewed
- list exact files reviewed

## Findings
Findings first, severity ordered:
- HIGH:
- MEDIUM:
- LOW:

If no findings, state: `No merge-readiness findings found.`

## Fixes Made
- files changed:
- summary of each docs-only fix:
- if no fixes: `No files modified.`

## Validation
- `git diff --name-only` output summary:
- `git diff --check` result:
- other checks run:
- skipped checks and reason:

## Scope Confirmation
- only target docs changed: yes/no
- no runtime/source/test files changed: yes/no
- no `refinery-service-java/` touched: yes/no
- no `.swarm/**` touched: yes/no
- no `ops/PROJECT_STATE.md` touched: yes/no
- no live/secret/deploy/public-release surface touched: yes/no

## Merge-Readiness Verdict
One of:
- `MERGE_READY`
- `MERGE_READY_WITH_WARNINGS`
- `FIXED_DOCS_ONLY`
- `BLOCKED`

## Residual Risks
- list residual risks or `None beyond docs-only scope.`

## Recommendation To FAL Meta
- accept W6-I loop evidence / request Meta review / request Track E review / stop / narrow
```

## Prompt 3 - FAL Meta Review Checklist

Use after the WorldSim session returns.

```text
FAL Meta W6-I Review Checklist

Inputs:
- WorldSim W6-I docs-only handoff
- `docs/private/Wave6-W6-S3-Meta-W6-H-Target-Readiness-Brief.md`
- `docs/private/Wave6-W6-S3-Meta-W6-H-Step-Review-Closeout.md`

Review questions:
1. Did the loop use the accepted WorldSim Candidate A docs-only scope?
2. Was starting branch/worktree state recorded?
3. Did the WorldSim session read its canonical state sources?
4. Did any diff stay inside the five target docs?
5. Were `refinery-service-java/`, `.swarm/**`, `ops/PROJECT_STATE.md`, runtime/source/test files, live endpoints, secrets, deploy, and public-release surfaces avoided?
6. Were merge-readiness findings concrete and severity ordered?
7. If fixes were made, were they minimal and docs-only?
8. Was validation run or explicitly skipped with reason?
9. Is the evidence sufficient for one W6-I external docs-only usefulness row?
10. Is the usefulness claim bounded to this external docs-only task class?

Meta verdict values:
- `W6I_ACCEPTED`
- `W6I_ACCEPTED_WITH_WARNINGS`
- `W6I_NEEDS_TRACK_E_REVIEW`
- `W6I_BLOCKED`
- `W6I_INSUFFICIENT_DATA`
```

## Prompt 4 - Track E Evidence And Privacy Review

Use after FAL Meta receives the WorldSim handoff and before final W6-I acceptance if Track E review is requested.

```text
Track E W6-I evidence/privacy review task.

Review the W6-I WorldSim docs-only loop evidence for sufficiency and privacy boundaries.

Inputs:
- WorldSim W6-I docs-only handoff
- FAL Meta W6-I review notes
- accepted W6-H readiness brief and closeout

Questions:
1. Is the evidence enough to count as one external target docs-only loop or only a blocker?
2. Did the loop preserve private/raw evidence boundaries?
3. Did any target-repo private/generated evidence, `.swarm/**`, or `ops/PROJECT_STATE.md` surface leak into the loop?
4. Did any runtime/refinery/live/secret/deploy scope leak occur?
5. Is the usefulness conclusion honestly bounded to this task class?
6. Are there false-green risks in the merge-readiness verdict?
7. Should W6-I be accepted, accepted with warnings, blocked, or marked insufficient data?

Return:
- findings first
- evidence sufficiency verdict
- privacy verdict
- usefulness caveat
- recommendation to Meta
```

## FAL Evidence Capture Outline

W6-I final evidence should capture:

- target repo: `WorldSim`
- target repo path: `C:\EGYETEM\FUNSTUFF\WorldSim`
- isolated worktree path used
- task type: `external_docs_only_merge_readiness_review_fix`
- complexity class: likely `governance_context_continuity` or `shared_boundary`
- mode: likely `manual_opencode` or `fal_evidence_backed`
- final status: `pass`, `pass_with_warnings`, `hold`, or `blocked`
- review findings and accepted/fixed/deferred status
- changed files, if any
- checks run and skipped checks
- manual copy-paste / handoff friction notes
- usefulness recommendation bounded to this single external docs-only loop

## Stop Conditions

Stop or narrow W6-I if:

- worktree setup would overwrite existing WorldSim work
- target docs depend on unreadable or missing WorldSim canonical state
- needed fix touches forbidden scope
- runtime/refinery/live/secret/deploy work becomes necessary
- privacy-sensitive state would need to be exposed
- the loop cannot produce auditable handoff evidence
- the docs-only loop is no longer representative of a useful external target trial

## Next Action

Create the isolated WorldSim worktree, then run Prompt 1 in a separate WorldSim session.

Do not start W6-I edits in the main WorldSim working tree.
