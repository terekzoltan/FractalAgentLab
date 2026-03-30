# Fractal Agent Lab — Átfogó technikai terv v0.1

## Rövid cél
Személyes multi-agent labor + engine + research OS hibrid, amely:
- tanulási és portfólióprojekt,
- később a B terv (startup ötletcsiszoló / cognitive augmentation engine) alapmotorja lehet,
- nem egyetlen frameworkre épül, hanem saját `Core Agent Model` köré szerveződik.

## Választott stratégia
- **A1 + A2 + A3 hibrid**
- **Runtime:** saját core + több adapter
- **Orchestration:** hibrid
- **UI:** CLI + trace viewer → minimál web UI → agent workbench
- **Provider policy:** OpenRouter-first, lokális nyitással később
- **Memory:** fokozatos: run → session → project → heuristics

## Fő architektúra
```text
Interface layer
→ Workflow layer
→ Orchestration layer
→ Core Agent Model
→ Runtime adapters
→ State & memory
→ Trace & eval
```

## Fő komponensek
### Core Agent Model
```text
AgentSpec
- id
- role
- goal
- instructions_template
- tools
- handoff_options
- model_policy
- memory_policy
- output_schema
- retry_policy
- eval_policy
```

### Runtime adapterek
- `OpenAICompatibleAdapter`
- `OpenRouterAdapter`
- `MockAdapter`
- (később) `LocalModelAdapter`

### Orchestration módok
- Manager
- Peer handoff
- Graph / workflow
- Parallel fan-out / fan-in

## Induló agentkészlet
- Intake / Triage
- Planner
- Systems Thinker
- Critic / Falsifier
- Strategist / Product
- Synthesizer
- Evaluator

## Hero workflowk
1. Startup ötletcsiszolás
2. Projektbontás / project decomposition
3. Architektúra review

## Memory rétegek
- Run state
- Session memory
- Project memory
- Heuristic memory
- (Később) simulation memory

## Trace / eval minimum
- run_id
- workflow_id
- agent step log
- handoff chain
- becsült token / latency
- quality score
- baseline single-agent összevetés

## Javasolt stack
- Python
- Typer
- FastAPI
- SQLite
- Pydantic
- JSONL trace log
- pytest + golden cases
- YAML/TOML config

## Repo-struktúra

Megjegyzés: a kanonikus repo layoutot mostantól a `docs/Repo-Skeleton-v01.md` definiálja.
Az alábbi blokk csak korai magas szintű rétegvázlat, nem az elsődleges strukturális source of truth.

```text
repo/
  ops/
  docs/
  src/
    fractal_agent_lab/
  tests/
  data/
  examples/
  scripts/
  configs/
  ui/
```

## Roadmap
### Phase 0
- repo skeleton
- core model
- run state
- trace event modellek
- CLI alapfutás

### Phase 1
- első hero workflow
- simple trace export
- single-agent baseline
- 10 kézi teszteset

### Phase 2
- Systems + Strategist
- project decomposition workflow
- SQLite session state
- Evaluator agent

### Phase 3
- architecture review workflow
- replay
- trace viewer
- prompt/workflow verziózás

### Phase 4
- project memory
- OpenRouter policy layer
- graph runner
- minimál web UI

## Legfontosabb elv
Az első valódi cél nem az, hogy „kész a platform”, hanem az, hogy ugyanarra a startup ötletre a rendszer érezhetően jobb, strukturáltabb és kritikusabb kimenetet adjon, mint egy sima single-agent prompt.
