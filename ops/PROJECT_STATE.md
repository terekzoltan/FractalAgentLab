# Jelenlegi allapot

State revision: `fal-w8-a-awc411-plan-review-explicit-stage-offline-v1-20260821`
Configuration identity: `fal-governance-generation-v1`
Wave: `W8`
Wave activation: `NOT_OPEN`
Epic: `W8-A`
Workflow phase: `PLAN_REVIEW`
Epic readiness: `READY`
Epic status: `ACTIVE`
Hydration enrollment: `LEGACY_VALIDATED`
Hydration resolver status: `NOT_READY`
Hydration failure class: `NONE`
Compact contract: `opencode-compact-lite/v1`
Candidate identity: `UNDECLARED`
Review mode: `NOT_APPLICABLE`
Review cycle: `0`
Stage source manifest: `docs/private/W8-A-stage-source-manifest.v1.json`
Stage source manifest SHA-256: `10f07bdd3729f7b003a930d12b30458a95adc0a4f8b73e31ce63e72b502af547`
Compact boundary: `NOT_APPLICABLE / COMPACT_LITE_ACTIVE`
Combined row identity: `W8/W8-A/position-30`
Combined selector: `HEADING:3. Current Frontier: W8-A Pre-Open Reconciliation`
Pinned artifact: `docs/private/W8-A-AWC-4_1_1-Epic-Plan-v1.md`
Pinned artifact SHA-256: `ea7968fe091f336a45f35ee108386cb7dfc540682a3f427b8288a765c3a76faa`
Pinned artifact logical identity: `w8-a-awc411-governance-plan-v1`
Next actor: `Independent non-authoring FAL Meta session / fal.meta`
Next command: `/terv-review`

## Aktualis dontesi helyzet

Az Owner 2026-08-20-an elrendelte az AWC `4.1.1` mely feltérképezését es a
Wave 8-10 tervezes frissiteset. A W8-A governance Epic aktiv, de maga a Wave 8
meg nincs megnyitva. A befagyasztott v3 candidate az AWC 4.1 exact release
identityt, Compact Lite aktiv recovery lawt, `INITIAL`/`FIX_RECHECK` review
bindingot, a FAL `0ab8b8d` consumer deltajat es a W8-W10 ujraszekvenalast
tartalmazza.

Az `r1` fuggetlen review W8A-001-W8A-004 findingokat nyitott. Az Owner explicit
engedelyezte a bounded `w8-governance-delivery-v1-owner-20260820` profilt. A
repair recheck megallapitotta, hogy az accountable lane csere material replan,
ezert a korabbi `r2` fix candidate nem folytathato. Az uj Canon-konform
`w8-a-awc411-governance-plan-v1` `/seq-next` terv ugyanazt a bounded governance
eredmenyt W8 Governance Delivery ownership alatt, uj main lifecycle-kent rogzitette.
Az `r1` es `r2` artifactok torteneti review evidence, nem current candidate-ek.

## Exact AWC 4.1.1 baseline candidate

- Canon commit: `428a4623b749c37e4a42bdecd839a0b9e92652e2`
- Canon tree: `6fbdb5a11ff8f03ea061303d61468ab2260625f1`
- Canon version / machine contract: `4.1.1 / 2.0.0`
- Machine-contract SHA-256: `799b7c78c76e383fac6dd87c9d29f521ddc5f4ef5f5db3dd8177a67c3a717b62`
- Pack digest: `d02cc165c3d0d88a05196008123f68ada3fd0ad6c4c824fed78dac2192bdb087`
- Tooling snapshot: `opencode-tooling-20260820-164955193-a627d5adfc2c`
- Tooling transaction: `20260820-164955193-a627d5adfc2c`
- Tooling payload manifest: `01176727ca2d4c4c17abd934e7a76f2f3c15903ecacd97c47ec27421083496bb`
- FAL profile revision / synchronization: `2026-08-10.1 / compact-lite-fal-profile-v1`
- FAL explicit-stage base: `781fc0d`
- FAL AWC 4.1 repair-recheck consumer: `0ab8b8d906471baf8f743acbf7247c5826782b29`

Az external Canon worktree-ben jelenleg unrelated dirty RingFall profile/test
modositas van. Mivel a profile pack-digest input, a committed release identity es
a mutable filesystem identity nem vonhato ossze. FAL ezt a scope-ot nem
modositja, nem reverteli es nem attribualja. Fresh accepted Canon/live-registry
revalidation kell `OPEN_W8` elott.

## Lezart prerequisite baseline

- `FAL-MIG-P` Stage A: `CLOSED / COMPLETE`.
- `COMPACT-V2`: `CLOSED / RETAINED_REFERENCE` az AWC 4.0 utan.
- `ACTIVE-ROUTE-COMPACT`: `COMPLETE / RETAINED_REFERENCE`.
- `FAL-NATIVE-REVIEW-ADAPTER`: `CLOSED / AWC_4_1_CONSUMER_ALIGNED`.
- `FAL-EXPLICIT-STAGE-ROUTER`: `CLOSED / COMPLETE_OFFLINE / COMMITTED`.
- A `P0B` production-router release kulon Owner-authorizalt maintenance scope-ban
  fut; W8-A live dispatch es valos target pilot tovabbra is zart.

## Vedett es blokkolt scope

- `src/fractal_agent_lab/integrations/router_fal_sync.py` es
  `tests/integrations/test_router_fal_sync.py` unrelated/protected hunks W8-E-ig
  no-touch.
- Az Agent Workflow Canon dirty worktree FAL altal nem modosithato.
- Compact V2, V2 capsule, hydration resolver/invoker es Active Route retained
  reference; aktiv Compact Lite dependencykent nem hasznalhato.
- Nincs target feature implementation, live compact pilot, lifecycle dispatch,
  global apply, restart, commit, push, PR, merge, deploy, publication vagy public
  export authority.
- W8-B es W8-F csak explicit Owner `OPEN_W8` utan nyithato.
- Az Owner-authorizalt P0B target-adoption durability commit exact-path modon
  kovetheti a W8-A stage plant, stage manifestet, role-t es a szukseges hot
  governance pointereket. Ez nem W8-A closeout, nem `OPEN_W8`, es nem ad altalanos
  staging/commit authorityt a tobbi ignored/private tervezesi csomagra.

## Elso evidence

- `docs/private/FAL-Wave8-Wave10-Planning-Package-v3.md`
- `docs/private/W8-A-AWC-4_1_1-Epic-Plan-v1.md`
- `ops/roles/W8-GOVERNANCE-DELIVERY.md`
- `docs/private/FAL-AWC-4_1-Impact-Map-v1.md`
- `docs/private/FAL-Canon-Lifecycle-Integration-Architecture-v3.md`
- `docs/private/FAL-Wave8-Wave10-Canon-Aligned-Roadmap-v3.md`
- `docs/private/W8-A-AWC-4_1-Roadmap-Reconciliation-v2.md`
- `docs/private/W8-A-INITIAL-REVIEW-SYNTHESIS-v1.md` (historical review input)
- `docs/private/W8-A-AWC-4_1-Planning-Candidate-Manifest-v2.txt` (historical failed repair candidate)

## Kovetkezo akcio

Egy kulon, nem authoring FAL Meta session kozvetlenul lefuttatja a `/terv-review`
lepeset az exact `w8-a-awc411-governance-plan-v1` artifacton. Nincs delegalt vagy
masodik plan review. A verdictet W8 Governance Delivery kapja vissza
`/terv-review-utan` reviziora; implementacio csak `PLAN_REVISION_COMPLETE` es
`IMPLEMENT_READY` utan folytathato.
