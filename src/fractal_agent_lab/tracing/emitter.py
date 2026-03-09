from __future__ import annotations

from typing import Protocol

from fractal_agent_lab.core.events import TraceEvent


class TraceEmitter(Protocol):
    def emit(self, event: TraceEvent) -> None:
        ...


class InMemoryTraceEmitter:
    def __init__(self) -> None:
        self.events: list[TraceEvent] = []

    def emit(self, event: TraceEvent) -> None:
        self.events.append(event)


class NullTraceEmitter:
    def emit(self, event: TraceEvent) -> None:
        _ = event
