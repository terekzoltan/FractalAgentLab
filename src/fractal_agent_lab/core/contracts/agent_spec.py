from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


AGENT_SPEC_SCHEMA_VERSION = "agent_spec.v0"


class AgentKind(StrEnum):
    LLM = "llm"
    TOOL = "tool"
    MOCK = "mock"


@dataclass(slots=True)
class AgentSpec:
    agent_id: str
    role: str
    kind: AgentKind = AgentKind.LLM
    instructions: str | None = None
    instruction_ref: str | None = None
    model_policy_ref: str | None = None
    tools_allowed: list[str] = field(default_factory=list)
    handoff_targets: list[str] = field(default_factory=list)
    output_schema_ref: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    schema_version: str = AGENT_SPEC_SCHEMA_VERSION
