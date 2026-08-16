from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "batch_span_annotate"

DESCRIPTION = (
    "Write structured annotations to one or more Phoenix spans. Each entry targets a span "
    "by `spanId` or `spanNodeId` and includes a `name` plus label, score, or explanation."
)

_ANNOTATION_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "spanId": {
            "type": "string",
            "description": "OpenTelemetry span ID.",
        },
        "spanNodeId": {
            "type": "string",
            "description": "Phoenix GraphQL span node ID.",
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
    "oneOf": [{"required": ["spanId"]}, {"required": ["spanNodeId"]}],
    "anyOf": [
        {"required": ["label"], "properties": {"label": {"type": "string"}}},
        {"required": ["score"], "properties": {"score": {"type": "number"}}},
        {
            "required": ["explanation"],
            "properties": {"explanation": {"type": "string"}},
        },
    ],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "annotations": {
            "type": "array",
            "minItems": 1,
            "description": "Span annotations to apply.",
            "items": _ANNOTATION_PARAMETERS,
        },
    },
    "required": ["annotations"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class BatchSpanAnnotateCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
