# Project State Continuity Protocol v01

## Statusz

Privát workflow-governance protokoll a Fractal Agent Lab projekthez.

Ez a dokumentum `docs/private/` alatt verziózott, mert az `ops/` local-only és ignored. Az élő bootloader fájl továbbra is:

```text
ops/PROJECT_STATE.md
```

## Cél

Csökkenteni kell a párhuzamos projektek közti kontextusváltási költséget egy rövid, kötelező projektállapot-fájllal, amit minden Meta Coordinator és Track session először olvas, majd érdemi munka után frissít.

A state file nem napló. Bootloader.

## Kötelező élő fájl

Egy közös projekt-szintű fájl van:

```text
ops/PROJECT_STATE.md
```

Ne hozz létre külön Track state fájlokat, kivéve ha a repo később explicit módon módosítja ezt a protokollt.

## Nyelvi szabály

Az `ops/PROJECT_STATE.md` mindig magyar nyelvű legyen.

Kivétel csak fájlnév, commit hash, parancs, mezőnév, enum érték vagy idézett angol artifact-szöveg esetén megengedett.

## Kötelező wave / sprint / step / epic mező

Az `ops/PROJECT_STATE.md` mindig tartalmazza, hogy pontosan hol tartunk:

```text
wave / sprint / step / epic
```

Ez legyen elég konkrét ahhoz, hogy egy hidegen induló Meta vagy Track agent tudja, melyik sequencing sort kell folytatnia.

## Session start szabály

Minden Meta Coordinator vagy Track session elején:

1. Először olvasd el az `ops/PROJECT_STATE.md` fájlt.
2. Azonosítsd belőle a jelenlegi workflow fázist.
3. Folytasd a rögzített következő akciótól.
4. Ne tervezz újra nulláról, kivéve ha a state fájl stale, hiányzik, hiányos, vagy repo-evidence alapján ellentmondásos.

Ha a state fájl ütközik a tényleges repo evidence-szel, a repo evidence az erősebb; a mismatch-et a következő handoffban vagy state-frissítésben rögzíteni kell.

## Session end szabály

Minden érdemi tervezési, implementációs, review, fix vagy handoff lépés végén:

1. Frissítsd az `ops/PROJECT_STATE.md` fájlt.
2. Tartsd kompaktan.
3. Csak operatívan hasznos kontextust írj bele.
4. Ne alakítsd hosszú naplóvá.
5. Írd le világosan, mit tegyen a következő szerep/session.

Ha egy lépés nem okoz érdemi state változást, a state fájlban explicit szerepeljen:

```text
Nincs state változás ebből a lépésből.
```

## Kötelező gate szabály

Sem Meta Coordinator, sem Track agent nem jelölhet stepet késznek, ha az `ops/PROJECT_STATE.md` nincs frissítve, vagy nem rögzíti explicit módon, hogy nem volt state változás.

A Meta Coordinator nem green-lightolhat következő stepet, amíg nem ellenőrzi, hogy az `ops/PROJECT_STATE.md` elég friss, és a helyes következő szerepre/akcióra mutat.

## Kötelező template

```markdown
# Jelenlegi állapot

# Jelenlegi wave / sprint / step / epic

# Jelenlegi workflow fázis

Egy ezek közül: Meta tervezés, Track tervezés, Meta tervreview, Track implementáció, Meta step review, Track fix / follow-up, Felhasználói döntésre vár, Blokkolva

# Utolsó aktor / szerep

# Utolsó döntés

# Utolsó befejezett akció

# Következő akció

# Következő elvárt szerep

# Most ne gondolkodj ezen

# Nyitott kérdések / blokkolók

# Evidence pointerek
```

## Méretcél

Az `ops/PROJECT_STATE.md` ideálisan 40-100 sor legyen. Ha több történeti részlet kell, linkelj más artifactre a state file bővítése helyett.

## Szekvenciális workflow szabály

Ez a repo szekvenciális Meta/Track workflow-t használ:

```text
Meta Coordinator -> Track terv -> Meta tervreview -> Track implementáció -> Meta step review -> Track follow-up
```

A state file mindig tegye világossá, hol vagyunk ebben a sorrendben, és melyik szerep lép következőnek.

## Review checklist kiegészítés

Minden implementációs tervreview, step review, closeout és handoff ellenőrizze:

- Az `ops/PROJECT_STATE.md` olvasva lett-e az acting session előtt?
- A state file a jelenlegi workflow fázisra, wave/sprint/step/epicre és következő szerepre/akcióra mutat-e?
- Frissítve lett-e a step után, vagy explicit szerepel-e benne, hogy nem volt state változás?
- Elég kompakt-e egy hidegen induló következő session számára?

## Hatókör

Ez vonatkozik:

- Meta Coordinator workflow-ra
- Track workflow-ra
- planning handoffokra
- implementation handoffokra
- review handoffokra
- fix/follow-up handoffokra
- step completion packetekre
- Swarm review handoffokra, ahol releváns
- minden jövőbeli agentre, aki hidegen lép be a repóba
