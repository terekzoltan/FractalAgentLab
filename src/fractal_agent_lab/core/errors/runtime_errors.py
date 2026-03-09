from __future__ import annotations

from typing import Any


class FractalRuntimeError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "runtime_error",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}


class RuntimeBoundaryError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message, code="runtime_boundary_error", details=details)


class StepExecutionError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message, code="step_execution_error", details=details)


class RunTimeoutError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message, code="run_timeout_error", details=details)


class RunBudgetError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message, code="run_budget_error", details=details)
