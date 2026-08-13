# Review Model Routing Briefing

**Status:** `SUPERSEDED / NON-OPERATIONAL`
**Applies to:** historical external Swarm routing only
**Last verified:** 2026-07-13

External Swarm roster/profile selection is not a pre-dispatch requirement.
Current AWC native review lets Meta select generic reviewer profiles inside the
single `/step-review` command stage.

## Purpose

Meta must read this briefing before selecting reviewer agents, model tiers, reasoning effort, or external Swarm depth. More model work is not automatically better review. Select the cheapest configuration that preserves the required finding recall and independence.

## Model Roles

| Tier | Default use | Avoid as default |
|---|---|---|
| GPT-5.6 Luna | temporarily inactive; retained only for a later explicit owner-approved restoration after a successful transport probe | all active review dispatch while OpenCode issue #36140 persists |
| GPT-5.6 Terra | routine review, correctness, evidence, scope, domain semantics, architecture/contracts, security, and regression analysis | ordinary lanes that `review-terra-medium` can cover safely |
| GPT-5.6 Sol | Meta synthesis, disputed critical findings, highest-impact security/architecture escalation | ordinary parallel review lanes |

Luna remains a possible future cost tier, but repeated OpenCode `Model not found gpt-5.6-luna` retries proved that the current transport does not enforce the intended single Terra fallback. By owner decision on 2026-07-13, all active default review routes are Terra-primary until a later explicit change restores Luna.

Sources:

- <https://developers.openai.com/api/docs/models/gpt-5.6-luna>
- <https://developers.openai.com/api/docs/guides/latest-model>
- <https://openai.com/index/gpt-5-6/>
- <https://deploymentsafety.openai.com/gpt-5-6>

## Default Lane Routing

| Lane | Economy/default agent | Failure or uncertainty retry | Audit agent |
|---|---|---|---|
| correctness/business/regression | `review-terra-high` | `review-terra-xhigh` | `review-terra-xhigh` |
| tests/evidence | `review-terra-high` | `review-terra-xhigh` | `review-terra-xhigh` |
| scope/acceptance/ownership | `review-terra-high` | `review-terra-xhigh` | `review-terra-xhigh` |
| security/safety | `review-terra-xhigh` | `review-sol-medium` | `review-sol-high` |
| architecture/contracts | `review-terra-xhigh` | `review-sol-medium` | `review-sol-high` |
| regression/edge cases | `review-terra-high` | `review-terra-xhigh` | `review-terra-xhigh` |
| domain specialist | `review-terra-xhigh` | `review-sol-medium` | `review-terra-xhigh` |

All seven lanes are currently Terra-primary. Five to seven typed lanes require explicit owner approval through the question tool before dispatch.

## Luna Transport Suspension

OpenCode issue <https://github.com/anomalyco/opencode/issues/36140> documents ChatGPT OAuth 404 or retry/hang failures for Luna. The observed transport retried Luna seven or more times and left Meta unable to detect lane non-responsiveness, so active Luna dispatch is suspended.

1. Do not select `review-luna-medium`, `review-luna-high`, or Luna-backed default Swarm roles.
2. Keep Luna agent definitions available only to make a later rollback explicit and small.
3. Restore Luna only after an isolated local probe succeeds and the owner explicitly requests the routing change.
4. Do not reinterpret the current transport failure as an implementation review finding.

## Reasoning Effort

| Effort | Use |
|---|---|
| `medium` | structured scope/acceptance and low-risk evidence checks |
| `high` | normal Terra review |
| `xhigh` | difficult correctness, security, architecture, domain, or disputed finding validation |
| `max` | not active until the installed OpenCode version passes a capability probe |

Raise model tier before repeatedly increasing reasoning effort when the task exceeds the smaller model's capability. Do not run `xhigh` merely because it exists. Record the selected agent and reason in the resolved lane plan.

Routine review uses `review-terra-high`. `review-terra-medium` remains an optional cost-aware tier for bounded, low-risk evidence, scope, or acceptance checks. Use `review-terra-xhigh` for difficult correctness, security, architecture, or domain work.

Use `review-sol-medium` as the normal Sol escalation for disputed correctness, domain, architecture, or security findings. Reserve `review-sol-high` for critical security/architecture review and final arbitration where the added reasoning cost is justified.

## Reasoning Mode

OpenAI GPT-5.6 supports `standard` and `pro` reasoning modes in the Responses API. Pro performs more model work, increases latency and billed output/reasoning tokens, and is not a separate model slug.

Current OpenCode provider support for forwarding `reasoning.mode: pro` has not been locally verified. Therefore:

- `standard` is mandatory by default;
- `pro` is experimental and fail-closed;
- a pro request requires explicit owner approval;
- a successful isolated capability probe must exist for the exact provider/model/transport;
- absence or failure of the probe means use the corresponding standard-mode Sol or Terra agent;
- never silently claim pro mode from a model name containing `-pro`.

## External Swarm

External Swarm is separate from Meta's 0-7 typed lanes. Its architect may select reviewer, verification-only test, SME, critic, hallucination, council, and mechanical gates according to the routed depth.

Roster IDs and generated agent prefixes:

- economy: default swarm, unprefixed `reviewer`, `test_engineer`, `sme`, and `critic`;
- balanced: swarm ID `reviewbalanced`, agents such as `reviewbalanced_reviewer` and `reviewbalanced_test_engineer`;
- audit: swarm ID `reviewaudit`, agents such as `reviewaudit_reviewer`, `reviewaudit_critic`, and `reviewaudit_test_engineer`.

- `focused`: minimal independent confirmation.
- `standard`: bounded reviewer plus verification-only test coverage; additional roles only for a named risk.
- `full`: adaptive gate selection and potentially variable agent count; explicit owner approval required.
- `wide`: seven typed lanes plus standard bounded Swarm, not full Swarm.

The external Swarm must remain read-only with respect to source, tests, plans, config, staging, and commits. It may write review/evidence artifacts under `.swarm/` when the command explicitly permits that audit output. A native `test_engineer` prompt that would write tests must instead receive an explicit verification-only instruction or be replaced by a read-only test reviewer. Full Swarm does not authorize source edits.

External review must not enter or mutate the target's local `.swarm` plan lifecycle. Do not call plan-gated `skill`, `swarm_command`, QA-profile, or task-status tools merely to perform a read-only review; a stale unrelated `.swarm/plan.json` is context, not review authority.

## Decision Checklist

Before dispatch Meta records:

```text
Review model decision:
- profile: quick | focused | standard | high_risk | deep | wide | audit | custom
- typed lane count: 0..7
- owner approval required/present: yes/no
- lane -> agent assignments:
- Luna transport: suspended | explicitly restored after passing probe
- fallback plan:
- external Swarm depth: none/focused/standard/full
- reasoning mode: standard/pro
- pro capability evidence, if any:
- cost/quality reason:
```

Do not dispatch until this block is complete. If required approval or capability evidence is missing, fail closed or select a cheaper supported configuration.
