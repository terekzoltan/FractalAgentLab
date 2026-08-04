# COMPACT-V2 Global Consumer Matrix

## Inventory Receipt

- Primary live root class: current user `.config/opencode` command and skill trees.
- Additional discovered root class: current user legacy `.opencode` command and
  skill trees surfaced by the active environment.
- Active/discovered definitions: `76` (`19` commands, `57` skills).
- Inventory digest: `4ab41fe234cfe74092b63d7d60b82f92717c2cc5714a1beed0634b97bee45dbe`.
- Digest rows: ordinally sorted
  `<scope>|<name>|<lowercase-live-file-sha256>`, joined by LF without trailing LF.
- Primary verified-snapshot inventory remains `17` commands and `21` skills; the
  additional `2` commands and `36` skills are explicit legacy/user-root discovery
  rows and are not silently treated as snapshot payloads.

`IMPACTED` means the exact existing live definition receives candidate bytes.
`NOT_AFFECTED` means bounded inspection found neither a stale fixed Canon pin nor
ownership of Compact V2 event, hydration-output, or closeout-trigger semantics.
Every primary impacted row has the same candidate and future snapshot relative
path. Legacy rows have no candidate/snapshot operation.

## Primary Commands

| Name | Disposition | Evidence | Candidate/snapshot path | Dirty-lineage owner |
|---|---|---|---|---|
| `after-compact` | `IMPACTED` | Owns V1/V2 hydration output and read-only resume classification. | `commands/after-compact.md` | current live-global user |
| `closeout-commit` | `NOT_AFFECTED` | Thin command delegates to impacted skill; no Canon pins or compact transport law. | `NONE` | current live-global user |
| `connectMany` | `NOT_AFFECTED` | Parallel packet transport only; no hydration pin or Compact V2 event authority. | `NONE` | current live-global user |
| `connectPair` | `NOT_AFFECTED` | Pair packet transport only; no hydration pin or Compact V2 event authority. | `NONE` | current live-global user |
| `fal-checkpoint-target` | `NOT_AFFECTED` | Checkpoint/mirror write boundary; explicitly does not infer compact events. | `NONE` | current live-global user |
| `fal-orchestrate-target` | `IMPACTED` | Owns orchestrator event entry and adapter routing contract. | `commands/fal-orchestrate-target.md` | current live-global user |
| `implement` | `NOT_AFFECTED` | Implementation receipt contract has no Canon pin or compact transport authority. | `NONE` | current live-global user |
| `oc-toolsmith` | `NOT_AFFECTED` | Deprecated compatibility entry already redirects maintenance to `/workflow-fix`. | `NONE` | current live-global user |
| `seq-next` | `NOT_AFFECTED` | Planning output contract only. | `NONE` | current live-global user |
| `step-review` | `NOT_AFFECTED` | Review contract only; Compact V2 runs at the orchestrator boundary. | `NONE` | current live-global user |
| `step-review-utan` | `NOT_AFFECTED` | Review-response contract only. | `NONE` | current live-global user |
| `swarm-review` | `NOT_AFFECTED` | External review transport only. | `NONE` | current live-global user |
| `swarm-review-setup` | `NOT_AFFECTED` | Review setup only. | `NONE` | current live-global user |
| `terv-review` | `NOT_AFFECTED` | Plan review contract only. | `NONE` | current live-global user |
| `terv-review-utan` | `NOT_AFFECTED` | Plan revision contract only. | `NONE` | current live-global user |
| `wave-start` | `IMPACTED` | Owns cold-start V1/V2 five-schema hydration gate entry. | `commands/wave-start.md` | current live-global user |
| `workflow-fix` | `NOT_AFFECTED` | Already names hydration coupling, global candidate, approval, restart, rollback, and snapshot gates. | `NONE` | current live-global user |

## Primary Skills

| Name | Disposition | Evidence | Candidate/snapshot path | Dirty-lineage owner |
|---|---|---|---|---|
| `closeout-commit` | `IMPACTED` | Inline no-auto statement becomes exact CLOSED-receipt later-trigger law. | `skills/closeout-commit/SKILL.md` | current live-global user |
| `context-onboarding` | `IMPACTED` | Contains stale Canon pins/digest and cold-start locator/version claims. | `skills/context-onboarding/SKILL.md` | current live-global user |
| `context-restore` | `IMPACTED` | Contains stale Canon pins/digest, V1-only capsule law, and readiness/output logic. | `skills/context-restore/SKILL.md` | current live-global user |
| `fal-orchestrate-target` | `IMPACTED` | Owns the three event emissions and adapter result routing. | `skills/fal-orchestrate-target/SKILL.md` | current live-global user |
| `fal-target-orchestration` | `NOT_AFFECTED` | Checkpoint/evidence skill records explicit compact state but does not own hidden event detection or transport. | `NONE` | current live-global user |
| `fix-planning` | `NOT_AFFECTED` | Bounded review-fix planning only. | `NONE` | current live-global user |
| `grill-me` | `NOT_AFFECTED` | Clarification method only. | `NONE` | current live-global user |
| `implementation-execution` | `NOT_AFFECTED` | Implementation method only; no hydration pins. | `NONE` | current live-global user |
| `improve-codebase-architecture` | `NOT_AFFECTED` | Architecture analysis method only. | `NONE` | current live-global user |
| `interface-first-delegation` | `NOT_AFFECTED` | Contract-design method only. | `NONE` | current live-global user |
| `module-prd` | `NOT_AFFECTED` | PRD method only. | `NONE` | current live-global user |
| `multi-sync` | `NOT_AFFECTED` | Multi-session packet synchronization only. | `NONE` | current live-global user |
| `oc-toolsmith` | `NOT_AFFECTED` | Mechanical candidate/apply safety already matches the release design. | `NONE` | current live-global user |
| `pair-sync` | `NOT_AFFECTED` | Pair synchronization only. | `NONE` | current live-global user |
| `plan-review` | `NOT_AFFECTED` | Plan review method only. | `NONE` | current live-global user |
| `sequence-planning` | `NOT_AFFECTED` | Sequence planning method only. | `NONE` | current live-global user |
| `step-review` | `NOT_AFFECTED` | Acceptance review method only. | `NONE` | current live-global user |
| `swarm-review` | `NOT_AFFECTED` | Read-only external review method only. | `NONE` | current live-global user |
| `tdd` | `NOT_AFFECTED` | Test-driven implementation method only. | `NONE` | current live-global user |
| `ubiquitous-language` | `NOT_AFFECTED` | Terminology method only. | `NONE` | current live-global user |
| `workflow-fix` | `NOT_AFFECTED` | Already owns the exact global-tooling state machine and hydration coupling gate. | `NONE` | current live-global user |

## Additional Discovered Commands

| Name | Disposition | Evidence | Candidate/snapshot path | Dirty-lineage owner |
|---|---|---|---|---|
| `mini-review` | `NOT_AFFECTED` | Legacy user-root review helper; no Canon pin or Compact V2 authority. | `NONE` | legacy user-root owner |
| `worldsim-deep-review` | `NOT_AFFECTED` | Target-specific review helper; no Canon pin or Compact V2 authority. | `NONE` | legacy user-root owner |

## Additional Discovered Skills

| Name | Disposition | Evidence | Candidate/snapshot path | Dirty-lineage owner |
|---|---|---|---|---|
| `brainstorm` | `NOT_AFFECTED` | Generic workflow skill; no Compact V2 authority. | `NONE` | legacy user-root owner |
| `ci-failure-batching` | `NOT_AFFECTED` | CI triage only. | `NONE` | legacy user-root owner |
| `clarify` | `NOT_AFFECTED` | Clarification only. | `NONE` | legacy user-root owner |
| `clarify-spec` | `NOT_AFFECTED` | Spec clarification only. | `NONE` | legacy user-root owner |
| `codebase-review-swarm` | `NOT_AFFECTED` | Read-only codebase review package. | `NONE` | legacy user-root owner |
| `commit-pr` | `NOT_AFFECTED` | PR lifecycle only; no Compact V2 policy ownership. | `NONE` | legacy user-root owner |
| `consult` | `NOT_AFFECTED` | Advisory method only. | `NONE` | legacy user-root owner |
| `council` | `NOT_AFFECTED` | Council research/review method only. | `NONE` | legacy user-root owner |
| `critic-gate` | `NOT_AFFECTED` | Plan critic gate only. | `NONE` | legacy user-root owner |
| `deep-dive` | `NOT_AFFECTED` | Read-only audit method only. | `NONE` | legacy user-root owner |
| `deep-research` | `NOT_AFFECTED` | External research method only. | `NONE` | legacy user-root owner |
| `design-docs` | `NOT_AFFECTED` | Design-document generation only. | `NONE` | legacy user-root owner |
| `discover` | `NOT_AFFECTED` | Repository discovery only. | `NONE` | legacy user-root owner |
| `engineering-conventions` | `NOT_AFFECTED` | Repository engineering law; no global hydration pins. | `NONE` | legacy user-root owner |
| `execute` | `NOT_AFFECTED` | Swarm task execution only. | `NONE` | legacy user-root owner |
| `gate-attribution` | `NOT_AFFECTED` | QA gate attribution only. | `NONE` | legacy user-root owner |
| `issue-ingest` | `NOT_AFFECTED` | Issue intake only. | `NONE` | legacy user-root owner |
| `loop` | `NOT_AFFECTED` | Compound engineering loop only. | `NONE` | legacy user-root owner |
| `merge-queue-readiness` | `NOT_AFFECTED` | Merge-queue CI only. | `NONE` | legacy user-root owner |
| `mini-review` | `NOT_AFFECTED` | Review method only. | `NONE` | legacy user-root owner |
| `phase-wrap` | `NOT_AFFECTED` | Swarm phase evidence only. | `NONE` | legacy user-root owner |
| `plan` | `NOT_AFFECTED` | Swarm planning only. | `NONE` | legacy user-root owner |
| `pre-phase-briefing` | `NOT_AFFECTED` | Swarm phase onboarding, not Canon global hydration. | `NONE` | legacy user-root owner |
| `resume` | `NOT_AFFECTED` | Swarm plan resume only; no Canon fixed pins. | `NONE` | legacy user-root owner |
| `running-tests` | `NOT_AFFECTED` | Test execution guidance only. | `NONE` | legacy user-root owner |
| `skill-edit-validation` | `NOT_AFFECTED` | Skill assertion validation only. | `NONE` | legacy user-root owner |
| `specify` | `NOT_AFFECTED` | Specification workflow only. | `NONE` | legacy user-root owner |
| `swarm` | `NOT_AFFECTED` | Swarm behavior model only. | `NONE` | legacy user-root owner |
| `swarm-ci-monitor` | `NOT_AFFECTED` | CI monitor only. | `NONE` | legacy user-root owner |
| `swarm-implement` | `NOT_AFFECTED` | Swarm implementation workflow only. | `NONE` | legacy user-root owner |
| `swarm-pr-feedback` | `NOT_AFFECTED` | PR feedback workflow only. | `NONE` | legacy user-root owner |
| `swarm-pr-review` | `NOT_AFFECTED` | PR review workflow only. | `NONE` | legacy user-root owner |
| `swarm-pr-subscribe` | `NOT_AFFECTED` | PR subscription workflow only. | `NONE` | legacy user-root owner |
| `worktree-retry-cleanup` | `NOT_AFFECTED` | Coder worktree cleanup only. | `NONE` | legacy user-root owner |
| `worldsim-deep-review` | `NOT_AFFECTED` | WorldSim-specific review only. | `NONE` | legacy user-root owner |
| `writing-tests` | `NOT_AFFECTED` | Test authoring guidance only. | `NONE` | legacy user-root owner |

## New Payload

| Name | Disposition | Evidence | Candidate/snapshot path | Dirty-lineage owner |
|---|---|---|---|---|
| `workflow-compact-policy.json` | `IMPACTED` (`CREATE`) | New reviewed global `auto_safe` policy; absent from baseline and never copied into the generated command/skill snapshot. | `workflow-compact-policy.json`; snapshot `NOT_APPLICABLE` | COMPACT-V2 transaction |

## Closure

- Existing impacted payloads: `7`.
- New payloads: `1`.
- Existing not-affected definitions: `69`.
- `DEFERRED_BLOCKS_RELEASE`: none in the active/discovered definition set.
- Generated snapshot remains stale and is a separate post-restart release blocker,
  not an omitted consumer row.

GLOBAL_CONSUMER_MATRIX_COMPLETE
