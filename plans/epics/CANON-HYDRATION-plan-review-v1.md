# META PLAN REVIEW

Target: `C:\EGYETEM\FUNSTUFF\Agent-Workflow-Canon` with isolated global OpenCode candidate and FAL dependency evidence

Epic: `CANON-HYDRATION`

Plan artifact: `plans/epics/CANON-HYDRATION.md`, reviewed draft SHA-256 `121c0fcee36080156eef03c2650ae5687ef3dca1ca7637affc12cddb012796b5`

Accountable Lane / class / profile: Canon Workflow Maintenance / `MAINTENANCE` / workflow maintainer

Overall verdict: YELLOW

Blocking corrections: Make the transition plan's ordering enforceable by placing immutable FAL v1.2 preservation, formal supersession, and a separately reviewed `FAL-MIG-P v2.0` plan before the first Canon resolver/profile implementation edit; remove FAL state/Combined/archive mutation from this Canon Epic's allowed scope because it belongs to the separate FAL governance lifecycle; define supported PowerShell engines and require executable Windows junction/reparse negative coverage rather than permitting an unqualified skip; add the Canon-required explicit Feature -> User Story -> Task hierarchy.

Non-blocking improvements: Preserve per-test evidence for unavailable PowerShell 7 without weakening Windows PowerShell 5.1 acceptance; lead the compatibility matrix with expected-versus-observed readiness so a conformant expected blocker cannot be mistaken for project readiness.

Ownership/dependency decision: Canon Workflow Maintenance owns Canon repository and isolated global-tool candidate changes. `/oc-toolsmith` exclusively owns live global apply after exact Owner hash approval. FAL Meta governance owns v1.2 supersession, state/Combined reconciliation, and the v2.0 plan in a separate lifecycle. Product, router, target-project, destructive cleanup, commit, and remote side-effect scopes remain excluded.

Acceptance/evidence decision: The plan is implementable after the bounded corrections above. Acceptance requires deterministic request/result and invalidation contracts, fail-closed enrollment and identity handling, root/reparse containment, unique bounded reads, privacy controls, pack-validation integration, project-profile rehearsals, and hash-consistent global apply/restart/snapshot evidence. Green mechanical checks alone do not replace semantic verification.

Exact Delivery Lane action: invoke `/terv-review-utan` with this review.
