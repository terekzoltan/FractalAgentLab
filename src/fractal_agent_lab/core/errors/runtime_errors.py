from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import StrEnum
from typing import Any


class FailureCategory(StrEnum):
    CONTRACT = "contract"
    RUNTIME_BOUNDARY = "runtime_boundary"
    STEP_EXECUTION = "step_execution"
    TIMEOUT = "timeout"
    BUDGET = "budget"
    ORCHESTRATION_CONTROL = "orchestration_control"
    UNKNOWN = "unknown"


RUNTIME_ERROR_ENVELOPE_SCHEMA_VERSION = "runtime_error_envelope.v1"


@dataclass(slots=True)
class RuntimeErrorEnvelope:
    code: str
    message: str
    category: FailureCategory
    error_type: str
    details: dict[str, Any] = field(default_factory=dict)
    recoverable: bool = False
    schema_version: str = RUNTIME_ERROR_ENVELOPE_SCHEMA_VERSION

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class FractalRuntimeError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "runtime_error",
        category: FailureCategory = FailureCategory.UNKNOWN,
        recoverable: bool = False,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.category = category
        self.recoverable = recoverable
        self.details = details or {}


class RuntimeBoundaryError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            message,
            code="runtime_boundary_error",
            category=FailureCategory.RUNTIME_BOUNDARY,
            details=details,
        )


class StepExecutionError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            message,
            code="step_execution_error",
            category=FailureCategory.STEP_EXECUTION,
            details=details,
        )


class RunTimeoutError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            message,
            code="run_timeout_error",
            category=FailureCategory.TIMEOUT,
            details=details,
        )


class RunBudgetError(FractalRuntimeError):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            message,
            code="run_budget_error",
            category=FailureCategory.BUDGET,
            details=details,
        )


def error_envelope_from_exception(error: Exception) -> RuntimeErrorEnvelope:
    if isinstance(error, FractalRuntimeError):
        return RuntimeErrorEnvelope(
            code=error.code,
            message=str(error),
            category=error.category,
            error_type=type(error).__name__,
            details=error.details,
            recoverable=error.recoverable,
        )
    return RuntimeErrorEnvelope(
        code="unhandled_exception",
        message=str(error),
        category=FailureCategory.UNKNOWN,
        error_type=type(error).__name__,
        details={"error": str(error)},
        recoverable=False,
    )
