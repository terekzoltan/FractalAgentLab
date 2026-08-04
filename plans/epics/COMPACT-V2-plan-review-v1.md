# COMPACT-V2 Meta Plan Review v1

META PLAN REVIEW
Target: FractalAgentLab control plane plus external Agent Workflow Canon and reviewed live-global OpenCode tooling
Epic: COMPACT-V2
Plan class: EPIC_PLAN
Plan artifact: COMPACT-V2-plan-v1.0-initial @ sha256:a4f1af59358fe82b8311ec7a848ebaf6faa04fa43b685da8868be80eca851bad
Accountable Lane / class / profile: Compact V2 Workflow Maintainer / SPECIALIST_DELIVERY / COMPACT-V2-MAINTAINER
Overall verdict: YELLOW
Blocking corrections: 1. Define and test an exact V2 participant role-hint-to-profile binding, including a declared maintenance profile for the Compact V2 lane; the current FAL registry has no such profile, while `context-restore` accepts bare hints only when they uniquely match a declared profile. 2. Make route-input security executable: require a locked, contained, non-reparse, single-link, hash-verified snapshot for `PINNED_ARTIFACT`; bind `EXACT_EMPTY` to an attested selected-command identity; and test parent-session command enforcement before resume. 3. Replace "new compaction marker continues" with an attribution rule: if a post-timeout marker cannot be uniquely correlated to the persisted intent, classify `UNCERTAIN` and prohibit hydrate/resume/retry; add competing-marker tests. 4. Add candidate-level global-consumer contract tests proving V1 remains non-auto-resumable, V2 `SUFFICIENT + AUTO_RESUME` works only with verifier PASS and exact route input, and post-restart registry/snapshot identities preserve those semantics.
Non-blocking improvements: 1. Add an impacted/not-affected consumer matrix for every active global command and skill to simplify final candidate review and dirty-lineage attribution.
Ownership/dependency decision: One accountable lane is valid; Track D remains a bounded adapter contributor after the frozen Canon handoff, and `oc-toolsmith` remains mechanical-only. Do not start adapter consumption until the role/profile correction and Canon contract handoff receipts are complete.
Acceptance/evidence decision: Existing acceptance coverage is strong for compatibility, policy, privacy, rollback, and release gates, but cannot yet prove role-safe routing, secure exact input, timeout attribution, or live-global consumer behavior; promote the four corrections into explicit acceptance rows with deterministic fixtures.
Exact Delivery Lane action: invoke /terv-review-utan with this review
