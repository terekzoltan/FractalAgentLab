# Jelenlegi állapot

State revision: fal-canon-mig-plan-revision-20260728
Workflow phase: PLAN_REVISION

Wave 6 lezárva `narrow_continue` döntéssel; Wave 6.5 RingFall readiness/adoption closeout elfogadva. W7.5 measurement/context-continuity hardening csomag lezárt. W7.6 target-orchestrator seamless integration lezárva `CLOSE_W7_6_WITH_DESIGN_DEBT` Meta döntéssel. A wave elfogadott kisebb slice-jai használhatók: P1 `/fal-checkpoint-target` + `fal-target-orchestration` applied, P4 read-only RingFall Wave 1 backfill accepted reconcile debt mellett, P5 hook integration plan accepted, P6/P7 router/helper hardening accepted, P8 full `/fal-orchestrate-target` readiness decision `HOLD_FULL_COMMAND_WITH_NARROW_NEXT`, P9 audit design accepted. W7.7 Productized Target Orchestration UX docs-first wave lezárva `CLOSE_W7_7_PLAN_ONLY_WITH_APPLY_DECISION_READY` döntéssel; az owner lefuttatta a global `/fal-orchestrate-target` command/skill apply-kat, és a post-apply verification igazolta a `FAL-RELIABILITY-LAYER:v3`, `FAL hygiene rule`, `/fal-checkpoint-target` és `fal-target-orchestration` markereket.

A W7.8-A CI scope boundary elfogadva `GREEN_WITH_CONSTRAINTS` státusszal. W7.8 infrastruktúra/mechanikus CI readiness wave, nem product-mode wave. Első engedélyezett CI felület: tracked UI mechanikai ellenőrzés `ui/package-lock.json` alapján (`npm ci`, `npm run typecheck`, `npm test`, `npm run build`) és a generated-data boundary tisztázása. CI-be nem kerülhet `ops/**`, `docs/private/**`, `data/**` runtime evidence, `ui/public/generated/**` ignored generated data kötelező inputként, `.opencode-router/**`, `.swarm/**`, global OpenCode config, `tools/oc-session-router/**`, target private artifact, secret-dependent provider job, CD/deploy, public upload vagy coverage hard gate. Root Python/core CI implementáció nincs engedélyezve W7.8-A-ból, csak későbbi W7.8-D reassessment után.

Public case study, public mirror artifact, `docs/public/**` output, HUB implementation, automatikus `/compact`, implicit compact-event detection, OpenCode bridge/API/session delivery, runtime/router/full `/fal-orchestrate-target` implementation és FAL Wave 8 execution továbbra is blokkolt. RingFall, WorldSim és TriageCI a saját aktuális Combined/state és Meta gate-jei alatt folytathatja a meglévő workflow szerinti fejlesztést; ez nem FAL Wave 9 trial, és nem fagyasztja a target roadmapeket.

# Jelenlegi wave / sprint / step / epic

- Wave: `FAL-CANON-MIG` — explicit átmeneti Canon-adoption governance Wave
- Sprint: FAL-MIG-P v2.0 — Canon-hivatkozás, hydration-adoption és repository-simplification planning
- Step: `FAL-MIG-P PLAN_REVISION_COMPLETE / IMPLEMENT_BLOCKED` — a v1.2 terv byte-pontosan archiválva és `SUPERSEDED_BEFORE_IMPLEMENTATION`; az új v2.0 terv egyszeri független Meta review-ja és `/terv-review-utan` revíziója kész, Stage A a fagyasztott CANON-HYDRATION handoffra vár
- Epic: FAL Canon Reference, Hydration Adoption, and Repository Simplification; artifact: `plans/epics/FAL-MIG-P.md`, revision `FAL-MIG-P-plan-v2.0-final`, SHA-256 `c8d4eca307a32f951bb3804a47e1a7fce9522e361637a37930df1cf77b9201bc`; Combined referencia: `ops/Combined-Execution-Sequencing-Plan.md` `9A. Living forward roadmap` / `FAL-MIG-P`.

# Jelenlegi workflow fázis

W7.8-A/F lezárva; a root Python/core CI és coverage hard gate továbbra sincs elfogadva. A CANON-HYDRATION `NATIVE_COMPACT_WITH_ROLE_HINT`, Canon-first restore és fail-closed `PROJECT_LOCAL_LEGACY_VALIDATED` javítása alkalmazva és isolated fresh registryvel verifikálva. A végső pins-only transaction `20260728-203315317-f29a7ea479e2` állapota `VERIFIED`; candidate/live/operational snapshot inventory `15c097b479d0d88932307bec216994a5842988ab021639036ea119b5cd91a57c`, a Canon tooling snapshot `MATCH`. A Canon source commit `4864d04` pusholva az `Agent-Workflow-Canon` `origin/main` ágára. A 2026-07-23-i living Wave 8-10 roadmap továbbra is planning-only; Wave 8, migration application, fájlmozgatás/törlés és unrelated router/product mutation nincs automatikusan engedélyezve.

# Utolsó aktor / szerep

Meta Coordinator

# Utolsó döntés

Owner elfogadta a központi, külső Agent Workflow Canon + generikus CANON-HYDRATION + projekt-lokális authority modellt. A FAL nem vendorolja a teljes Canont; a repository-simplification külön v2.0 FAL governance Epic, Stage A additív/shadow/no-delete, Stage B külön destruktív lifecycle. Wave 8 nem aktiválódik ettől. A korábbi Wave 8-10 roadmap többi biztonsági és public/private korlátja változatlan.

# Utolsó befejezett akció

A WorldSim-local `.opencode` workaround fájlok eltávolítva. A futó WorldSim server a restartig tovább használhatja a memóriában cache-elt local definíciót, de a lemezen a globális fallback maradt. Semleges rootból indított, saját PID-del kezelt isolated OpenCode server igazolta a fresh globális registryt; minden ideiglenes server leállt. A private fallback, valid-capsule precedence, exact required project authority, capability-matched single role runbook és WorldSim Meta `NOT_READY` route regressziói PASS.

Automatizációs tudnivaló változatlan: `fractalagentlab-architecture-intelligence-refresh` 72 óránként fut ebben a workspace-ben, csak `docs/architecture/**` diagnosztikai/architektúra artefaktumokat frissíthet, implementation kódhoz nem nyúlhat, és `ops/PROJECT_STATE.md`-t csak blocking/major architektúra-probléma esetén módosíthatja.

# Következő akció

Meta reconciles the verified CANON-HYDRATION handoff against `FAL-MIG-P-plan-v2.0-final` and decides whether Stage A may leave `NOT_READY`; this does not open Wave 8. A future WorldSim server restart is operational cleanup only, not a Canon transaction blocker.

# Következő elvárt szerep

FAL Meta Coordinator / `GOVERNANCE` handoff reconciliation.

# Most ne gondolkodj ezen

- Ne induljon el RingFall Wave 2 implementation/execution külön Wave 2 planning brief és Meta gate előtt.
- Ne induljon C#/.NET core, Python brain, Unity, provider/model runtime vagy scenario/simulation implementation puszta FAL workflow-hardening ürüggyel.
- Ne nyisd meg a HUB implementációt vagy Wave 8 executiont.
- Ne kezeld az új roadmap vagy architecture dokumentum létezését `OPEN_W8` döntésként.
- Ne másold át vakon az `Agent-Workflow-Canon` vagy az `extracted/` teljes tartalmát a FAL-ba; előbb source-to-target és provenance map kell.
- Ne mozgass, ne törölj és ne archiválj FAL fájlt a migration terv elfogadása előtt.
- Ne indíts OpenCode bridge/API/session deliveryt, routing/dispatch automationt vagy commit/push automationt.
- Ne indíts automatikus `/compact`-ot; W7.6 csak compact-readiness és hydration authority állapotot rögzíthet.
- Ne feltételezz implicit compact-event detectiont; W7.6 csak explicit boundary artifactból vagy operator/workflow jelzésből dolgozhat.
- Ne építs mélyebb `/fal-orchestrate-target` runtime/router/full wrapper implementációt külön implementation-readiness review és explicit Meta/user approval nélkül.
- Ne hozz létre public release-t, public mirror artifactot vagy `docs/public/**` outputot.
- Ne tekintsd a P9 audit design elfogadását recovery proofnak; a hiányzó explicit `recovery_verdict` drill továbbra is külön validation debt.
- Ne add hozzá root Python/core CI-t W7.8-D reassessment és külön acceptance nélkül.
- Ne vezess be coverage hard gate-et W7.8-F vagy későbbi Track E acceptance nélkül.

# Nyitott kérdések / blokkolók

- P8 full command readiness döntés: hold; full `/fal-orchestrate-target` implementation csak külön PRD/review és explicit Meta/user approval után nyílhat.
- Az explicit cold-start `recovery_verdict: restored | partially_restored | failed` drill még hiányzik; ez validation debt marad P9b vagy későbbi targeted validation felé.
- A P7 helper-nonzero path smoke-proven, de tartós checked-in PowerShell wrapper regression coverage még hiányzik; route: W7.8-D vagy következő router failure-path módosítás előtt targeted regression.
- Dirty tracked core diff van `src/fractal_agent_lab/integrations/router_fal_sync.py` és `tests/integrations/test_router_fal_sync.py` alatt; W7.8-B/C nem módosíthatja és nem építhet rá root/router CI-t.
- W7.8-C accepted; a clean-worktree proof snapshot-valid `6e4e6a5` mellett, de jövőbeli UI módosítások újra bevezethetnek generated-data couplingot, ezért későbbi UI CI változtatásnál újraellenőrzés kell.
- Root Python/core CI surface W7.8-D után sincs elfogadva, mert nincs canonical manifest vagy root test command; jövőbeli Python CI csak külön command-law/manifest/dependency policy és Meta-reviewed follow-up után nyílhat.
- `RF-2026-06-29-01` fixed/accepted; W7.8-B remote GitHub Actions first-run observation opcionális támogató evidence, nem blocking.
- RingFall Wave 2 implementation továbbra is blokkolt külön Wave 2 planning brief és Meta gate előtt.
- Public-safe konkrét methodology/public package még nincs draftolva vagy külön review-zva.
- FAL-MIG-P v2.0 Stage A `PLANNED / PLAN_REVISION / NOT_READY`; unlock: frozen review-ready CANON-HYDRATION resolver/profile/conformance/FAL-rehearsal handoff.
- CANON-HYDRATION global apply, fresh registry verification, operational/Canon snapshot sync, pack gates, commit és push lezárva; a WorldSim futó serverének későbbi restartja csak cache reload, nem blocker.
- Wave 8 `PLANNED / NOT_STARTED / NOT_READY`; a FAL-MIG-P v2.0 Stage A elfogadása után is külön W8-A authority reconciliation és explicit `OPEN_W8` szükséges.
- Wave 9 és Wave 10 csak a named prior Wave Gate-ek után nyílhat; jelenlegi target munka nem trial evidence.
- A `.swarm` review-only plan stored/current spec hash driftje továbbra is külön lifecycle blocker minden destructive Swarm plan/status művelet előtt.
- Az OpenCode message/command model body shape lokálisan és SDK/server docs alapján verified; a mostani explicit model-routing helper slice alkalmazva. Ettől függetlenül a szélesebb unattended bridge/session delivery és automatikus dispatch továbbra is blokkolt.

# Evidence pointerek

- `ops/PROJECT_STATE.md`
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `docs/private/Wave7_6-W7_6_P4-Meta-Backfill-Closeout-v1.md`
- `docs/private/Wave7_6-W7_6_P5-Existing-Workflow-Hook-Integration-Plan-v1.md`
- `docs/private/Wave7_6-W7_6_P6-Meta-Step-Review-Closeout-v1.md`
- `docs/private/Wave7_6-W7_6_P8-Full-Orchestrator-Readiness-Decision-v1.md`
- `docs/private/Wave7_6-W7_6_P9-Wave-Level-Usefulness-Audit-Design-v1.md`
- `docs/private/Wave7_6-W7_6-Closeout-Decision-v1.md`
- `docs/private/Wave7_7-W7_7_H-Wave-Closeout-Readiness-Decision-v1.md`
- `docs/private/Wave7_7-Fal-Orchestrate-Target-FAL-Hygiene-Apply-Decision-v1.md`
- `docs/private/Wave7_8-W7_8_A-CI-Scope-Boundary-v1.md`
- `docs/private/Wave7_8-W7_8_E-CI-As-Evidence-Policy-v1.md`
- `docs/private/Wave7_8-W7_8_F-Coverage-Policy-Later-v1.md`
- `docs/private/FAL_Continuous_Improvement_Backlog-v1.md`
- `docs/private/FAL-Wave8-Wave10-Canon-Aligned-Roadmap-v1.md`
- `docs/private/FAL-Canon-Lifecycle-Integration-Architecture-v1.md`
- `plans/epics/FAL-MIG-P.md`
- `plans/epics/FAL-MIG-P-plan-review-v2.md`
- `plans/epics/FAL-MIG-P-v1.2-SUPERSESSION.md`
- `plans/epics/archive/FAL-MIG-P-plan-v1.2.md`
- `plans/epics/FAL-MIG-P-BARRIER-EVIDENCE.md`
- `plans/epics/CANON-HYDRATION-WORKFLOW-CHANGE-SPEC.md`
- `plans/epics/CANON-HYDRATION.md`
- `../Agent-Workflow-Canon/ADOPTION.md`
- `../Agent-Workflow-Canon/audit/MIGRATION-BACKLOG.md`
- `tools/oc-session-router/config/model-profiles.json`
- `tools/oc-session-router/docs/step-review-swarm-flow.md`
- `ops/Review-Findings-Registry.md`
