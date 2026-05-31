# FAL External Project Usage Runbook v01

## Status

Private Wave 6.5 usage runbook accepted for readiness/adoption planning.

Execution mode: `opencode_assisted`

Visibility / audit state:

- current `ops/PROJECT_STATE.md` and `ops/Combined-Execution-Sequencing-Plan.md` define the active W6.5 frontier
- this document is for using Fractal Agent Lab on external target projects
- this document does not authorize target implementation, public release, commit/push automation, OpenCode bridge/API/session delivery, or HUB implementation
- first target used to ground the model: RingFall at `C:\EGYETEM\FUNSTUFF\RingFall`
- Meta accepted this W6.5 package as `accepted_with_notes` after Track E `APPROVE_WITH_FIXES` and applied wording fixes

## Purpose

This runbook defines the transition from **FAL-build mode** to **FAL-use mode**.

FAL-build mode means Fractal Agent Lab is the project being built.

FAL-use mode means Fractal Agent Lab is the control/evidence layer used to help build another project.

The practical user goal is:

```text
Keep the existing OpenCode workflow mostly unchanged,
but make FAL available as a seamless project-control, review, evidence, and gate layer.
```

## Mental Model

```text
FractalAgentLab/
  control plane
  private plans
  target readiness briefs
  evidence ledgers
  validators / recorders
  future global `fal` command

TargetProject/
  actual project code/docs
  target-local private FAL notes if needed
  no FAL runtime dependency by default

OpenCode sessions
  do planning, implementation, review, and fixes
  may call FAL in the future through a global `fal` command

oc-session-router
  optional session transport / automation layer
  not the source of truth for approval, scope, or evidence
```

OpenCode remains the execution hand.

FAL is the policy, evidence, readiness, and gate layer.

## User-Specific Defaults

These defaults come from the W6.5 owner clarification round.

```yaml
external_project_use_goal: seamless_personal_productivity_layer
first_target_project: ringfall
first_target_state: idea_prototype_docs_canon_heavy
first_safe_slice: docs_state_review
target_access: read_only_allowed_for_readiness
target_local_private_runbook_allowed: true
preferred_future_invocation: global_fal_command
opencode_skill_required: false
router_wrapper_required: false
oc_session_router_role: optional_user_owned_automation_transport
full_epic_automation_scope_in_w6_5: not_a_goal
approval_model: policy_based
approval_posture_now: guarded_planning_and_docs_only
approval_posture_later: may_be_more_aggressive_after_evidence
```

## Directory Relationship

FAL should remain outside target repos.

Recommended layout:

```text
C:\EGYETEM\FUNSTUFF\
  FractalAgentLab\
    docs\private\FAL-External-Project-Usage-Runbook-v01.md
    docs\private\External-Project-Packet-Fields-v01.md
    docs\private\<Target>-Target-Readiness-Brief-v01.md
    data\evidence\...

  RingFall\
    .fal\
      FAL-Target-Project-Local-Runbook-v01.md
    <project docs/code>
```

Target-local `.fal/` is private coordination state. It should be gitignored when the target becomes a git repo.

## Target-Local Private Runbook

Target projects may contain a local private FAL runbook when helpful:

```text
.fal/FAL-Target-Project-Local-Runbook-v01.md
```

Rules:

- this file is not canonical product design
- this file is not public output
- this file should be gitignored
- this file tells OpenCode sessions how to treat FAL for this target
- this file may point back to the FAL control repo
- this file must not contain secrets

## Future Global CLI Shape

The preferred long-term use mode is a global command callable from any target repo:

```text
fal <command>
```

Candidate commands for later design:

```text
fal target status
fal target brief
fal target next
fal handoff emit
fal review gate
fal evidence record
fal policy check
```

W6.5 does not implement this command. W6.5 records the contract expectation so a later thin prototype can be built without guessing.

## Basic External Project Workflow

### 1. Open FAL Meta Context

The FAL Meta Coordinator identifies:

- target project id
- target path
- target canonical state sources
- current safe slice
- non-goals
- approval policy
- evidence requirements

### 2. Write Or Update Target Readiness Brief

For each target project, FAL should create a private brief:

```text
docs/private/<Target>-Target-Readiness-Brief-v01.md
```

The brief decides whether the target is ready for:

- readiness planning only
- docs/state review
- low-risk target-local docs fix
- implementation planning
- implementation execution

### 3. Optional Target-Local Runbook

If useful, create a target-local private runbook under `.fal/`.

The target-local runbook helps cold OpenCode sessions understand how to use FAL without the user repeating the same instructions.

### 4. Run OpenCode Sessions Normally

OpenCode sessions continue to do the practical work:

- planning
- implementation
- review
- review-fix
- evidence handoff

The session should follow the target readiness brief and output structured handoff evidence.

### 5. Use oc-session-router As Transport When Useful

The router may start or chain sessions, but FAL owns:

- accepted scope
- gate policy
- evidence requirements
- readiness decision
- final status

Full epic automation remains an external/user-owned capability for now. FAL must know it is an option, but W6.5 does not design or implement that automation.

### 6. Record Evidence

FAL records loop evidence when the slice is important enough to evaluate.

Evidence should answer:

- what was planned
- what was approved
- what changed
- what tests/checks ran
- what warnings remained
- whether review caught real issues
- whether FAL added enough value to justify the structure

## Approval Policy Defaults

Policy-based approval is allowed, but the current W6.5 default is still guarded.

| Action | Current default | Later possible posture |
|---|---|---|
| Read target docs/state | auto allowed | auto allowed |
| Create FAL private docs | auto allowed after owner opens W6.5 | auto allowed |
| Create target-local `.fal/` private note | allowed when owner approves target-local FAL state | auto allowed by target policy |
| Modify canonical target docs | explicit brief/gate required | policy-based low-risk auto possible later |
| Modify target code | explicit brief + approval required | policy-based only after evidence |
| Commit/push | user approval required | user approval remains default |
| Public output | separate export review required | separate export review remains required |
| Deploy/live/service work | blocked until explicit target readiness | policy-specific later |

## When FAL Is Worth Using

Use FAL when:

- the project has multiple sessions or tracks
- the work spans more than one day
- scope creep would be expensive
- warnings and review findings matter
- private/public boundaries matter
- evidence should influence future process decisions
- multiple projects are active in parallel

Do not force FAL on tiny one-off edits unless the edit touches a high-risk boundary.

## Current W6.5 Limit

W6.5 may define and test the usage model through RingFall readiness planning.

W6.5 must not claim:

- full external-project delivery readiness
- full epic automation
- bridge/API/session delivery readiness
- public case-study readiness
- HUB implementation readiness

## First Target: RingFall

RingFall is a good first W6.5 target because:

- it is large enough to need control/evidence discipline
- it is currently docs/canon-heavy, so readiness work is safe
- it explicitly says FAL is future leverage, not a prerequisite
- it already has strong artifact/replay/eval design language

RingFall is not yet implementation-ready through FAL because the observed target folder is not a git repo and no monorepo skeleton exists yet.

The correct first RingFall sequence is:

1. repo skeleton readiness
2. Combined/wave-plan consistency review
3. risk gate mapping into FAL policy
