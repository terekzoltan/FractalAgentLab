# External Project Packet Fields v01

## Status

Private Wave 6.5 packet-field draft accepted for readiness/adoption planning.

Execution mode: `opencode_assisted`

Visibility / audit state:

- derived from Wave 6 `w6.packet.v1` / `w6.evidence_ledger.v1` experience
- grounded in the W6.5 RingFall readiness target
- does not mutate existing W6 packet law
- requires Track B compatibility review before becoming an implementation contract
- accepted by Meta as planning-sidecar guidance only, not as runtime packet schema law

## Purpose

Wave 6 proved that FAL can capture and evaluate one project-local Meta/Track loop.

Wave 6.5 needs enough target-project metadata to use FAL across multiple projects without mixing context, evidence, approval policy, or privacy boundaries.

This document proposes sidecar fields for external-project usage.

## Design Rule

Do not overload the existing W6 packet envelope until Track B reviews compatibility.

External-project fields should initially be treated as sidecar metadata:

```yaml
packet_schema_version: w6.packet.v1
external_project_context:
  schema_version: external_project_context.v0
  ...
```

## Minimum External Project Context

```yaml
schema_version: external_project_context.v0
target_project_id: string
target_project_name: string
target_repo_path: string
target_repo_kind: git_repo | docs_folder_not_git | monorepo | unknown
target_worktree_state: clean | dirty | not_git | unknown
target_canonical_state_refs: array
target_local_fal_state_refs: array
sequence_ref: string
current_safe_slice: string
approval_policy_id: string
automation_mode: manual | opencode_session | router_assisted | fal_cli_assisted | semi_auto_future
privacy_classification: private_raw | private_coordination | sanitized_public_candidate | never_public
public_export_state: blocked | not_requested | candidate_needs_review | approved
evidence_root: string
owner_decision_required: boolean
```

## Field Intent

| Field | Intent |
|---|---|
| `target_project_id` | Stable short id, e.g. `ringfall`, `worldsim`. |
| `target_project_name` | Human-readable project name. |
| `target_repo_path` | Absolute local path used for the current loop. |
| `target_repo_kind` | Prevents treating a docs folder as implementation-ready git repo. |
| `target_worktree_state` | Records whether implementation safety checks can use git status. |
| `target_canonical_state_refs` | Target-side docs/files that define current truth. |
| `target_local_fal_state_refs` | Private `.fal/` or similar target-local FAL hints. |
| `sequence_ref` | Target-specific wave/step/epic reference. |
| `current_safe_slice` | The allowed slice, e.g. `docs_state_review`. |
| `approval_policy_id` | Which FAL approval policy applies. |
| `automation_mode` | How the session was launched or assisted. |
| `privacy_classification` | Prevents accidental public leakage. |
| `public_export_state` | Separates private evidence from public artifacts. |
| `evidence_root` | Where FAL stores loop evidence. |
| `owner_decision_required` | Whether the next transition requires user approval. |

## Target Repo Kind

```yaml
target_repo_kind:
  git_repo: "git repository with status/diff available"
  docs_folder_not_git: "docs/canon folder without git repo state"
  monorepo: "multi-component git repo"
  unknown: "not inspected or not classifiable"
```

FAL must not assume git safety gates when `target_repo_kind` is `docs_folder_not_git`.

## Automation Mode

```yaml
automation_mode:
  manual: "user/session copied context manually"
  opencode_session: "normal OpenCode session with FAL-aware runbook"
  router_assisted: "oc-session-router transported prompts/handoffs"
  fal_cli_assisted: "future global fal command provided status/gate/evidence help"
  semi_auto_future: "future policy-approved multi-step automation, not W6.5 scope"
```

W6.5 documents `fal_cli_assisted` and `semi_auto_future` as expected directions, not current implementation claims.

## Approval Policy Sidecar

Recommended shape:

```yaml
approval_policy:
  policy_id: external_project_default.v0
  read_only_inspection: auto
  fal_private_docs: auto_after_user_opens_wave
  target_local_private_notes: allowed_after_target_approval
  canonical_target_doc_changes: explicit_gate_required
  target_code_changes: explicit_gate_required
  commit_or_push: user_approval_required
  public_output: export_review_required
  deploy_or_live_service: blocked_until_explicit_readiness
```

Later project-specific policies may allow more aggressive automation, but only after evidence shows the workflow is safe.

## Evidence Root Proposal

Existing W6 evidence lives under:

```text
data/evidence/wave6/
```

For multi-project usage, prefer a target-project layout in a future compatibility pass:

```text
data/evidence/target-projects/<target_project_id>/loops/<loop_id>/
```

W6.5 may reference this as a proposed layout, but should not move existing W6 evidence.

## RingFall Example

```yaml
schema_version: external_project_context.v0
target_project_id: ringfall
target_project_name: RingFall
target_repo_path: C:\EGYETEM\FUNSTUFF\RingFall
target_repo_kind: docs_folder_not_git
target_worktree_state: not_git
target_canonical_state_refs:
  - Ringfall-Design-Canon-and-Decision-Log-v01.md
  - Ringfall-Meta-Coordinator-Handoff-Brief-v01.md
  - Ringfall-Combined-Execution-Sequencing-Plan-v03.md
  - Ringfall-Implementation-Wave-Plan-v01.md
  - Ringfall-First-Playable-Slice-v01.md
  - Ringfall-Architecture-and-Repo-Plan-v01.md
  - Ringfall-Risk-Register-and-Design-Guardrails-v01.md
target_local_fal_state_refs:
  - .fal/FAL-Target-Project-Local-Runbook-v01.md
sequence_ref: W6.5 RingFall readiness / docs-state review
current_safe_slice: docs_state_review
approval_policy_id: external_project_default.v0
automation_mode: opencode_session
privacy_classification: private_coordination
public_export_state: blocked
owner_decision_required: true
```

## Compatibility Questions For Track B

- Should external-project context remain a sidecar forever, or become part of a future packet schema?
- Should `target_project_id` be required for every post-W6 external loop?
- Should evidence layout move from wave-based to target-project-based paths?
- How should path-safe validation rules extend to `target_project_id` and target-local refs?
- Which fields belong in packet envelope versus evidence ledger versus runbook-only metadata?

## Non-Goals

This document does not define:

- a session bus
- automatic epic execution
- target project installation logic
- public export policy
- full `fal` CLI implementation
- migration of existing W6 evidence
