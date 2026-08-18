from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "annotate"

DESCRIPTION = (
    "Write one structured annotation to a Phoenix span, trace, or session. Target the entity "
    "with exactly one of spanId, spanNodeId, traceId, traceNodeId, sessionId, or sessionNodeId, "
    "and include a name plus at least one of label, score, or explanation."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "spanId": {
            "type": "string",
            "description": "16-character OpenTelemetry span ID.",
        },
        "spanNodeId": {
            "type": "string",
            "description": "Phoenix GraphQL span node ID.",
        },
        "traceId": {
            "type": "string",
            "description": "32-character OpenTelemetry trace ID.",
        },
        "traceNodeId": {
            "type": "string",
            "description": "Phoenix GraphQL trace node ID.",
        },
        "sessionId": {
            "type": "string",
            "description": "User-facing Phoenix session ID.",
        },
        "sessionNodeId": {
            "type": "string",
            "description": "Phoenix GraphQL ProjectSession node ID.",
        },
        "name": {
            "type": "string",
            "description": "Stable lowercase snake_case metric name, e.g. 'code_quality'.",
        },
        "annotatorKind": {
            "type": "string",
            "enum": ["LLM", "HUMAN", "CODE"],
            "description": "Annotation source. Defaults to 'LLM'.",
        },
        "label": {
            "type": ["string", "null"],
            "description": "Categorical result.",
        },
        "score": {
            "type": ["number", "null"],
            "description": "Numeric result.",
        },
        "explanation": {
            "type": ["string", "null"],
            "description": "Human-readable rationale.",
        },
        "identifier": {
            "type": ["string", "null"],
            "description": "Optional key for update/separate annotation behavior.",
        },
        "metadata": {
            "type": ["object", "null"],
            "description": "Optional machine-readable context.",
            "additionalProperties": True,
        },
    },
    "required": ["name"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class AnnotateCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
