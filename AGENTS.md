# FractalAgentLab Agent Entry Point

Agent Workflow Canon root: `../Agent-Workflow-Canon`
Adoption contract: `../Agent-Workflow-Canon/ADOPTION.md`

Read these authority surfaces in order before meaningful work:

1. `ops/PROJECT_OVERLAY.md` for FAL identity, ownership, safety, privacy, and explicit Canon exceptions.
2. `ops/PROJECT_STATE.md` for the exact active Wave, Epic, phase, blocker, and next action.
3. The active Epic row in `ops/Combined-Execution-Sequencing-Plan.md` plus its direct prerequisites.
4. The current pinned plan, review, synthesis, acknowledgement, or fix-plan artifact named by state.
5. One role profile from `ops/roles/` and at most one event runbook required for the immediate action.
6. `tools/oc-session-router/docs/workflow-orchestrator-runbook.md` only when router mechanics are involved.

`ops/AGENTS.md` remains a cold legacy/history source. Load only a section explicitly named by the overlay or current plan; it does not replace the compact overlay, state, or sole Combined.

The FAL Meta Coordinator does not write production code. Explicit FAL safety, privacy, public/private, target-authority, workflow-kernel, and remote-side-effect rules remain mandatory. A local Canon exception must be explicit in `ops/PROJECT_OVERLAY.md`; accidental drift is not an exception.
