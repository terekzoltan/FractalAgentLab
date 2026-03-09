from __future__ import annotations

from typing import Protocol

from fractal_agent_lab.core.models import RunState


class RunStateStore(Protocol):
    def save(self, run_state: RunState) -> None:
        ...

    def get(self, run_id: str) -> RunState | None:
        ...


class InMemoryRunStateStore:
    def __init__(self) -> None:
        self._runs: dict[str, RunState] = {}

    def save(self, run_state: RunState) -> None:
        self._runs[run_state.run_id] = run_state

    def get(self, run_id: str) -> RunState | None:
        return self._runs.get(run_id)


class NullRunStateStore:
    def save(self, run_state: RunState) -> None:
        _ = run_state

    def get(self, run_id: str) -> RunState | None:
        _ = run_id
        return None
