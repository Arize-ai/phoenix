from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "batch_span_annotate"

DESCRIPTION = """\
Write structured annotations to one or more Phoenix spans. Each entry targets a span by `spanId` \
or `spanNodeId` and includes a `name` plus label, score, or explanation. Use this only when the \
user wants annotations saved, not for ordinary analysis or recommendations.
Send one `annotations` array; batch related annotations in one call instead of calling the tool \
repeatedly.
Target the most specific relevant span: LLM spans for model output, tool spans for tool behavior, \
retriever spans for retrieval quality, and root agent/chain spans only for end-to-end judgments.
Use IDs from the available context or prior tool results. Do not guess span IDs.
Include an `explanation` for any score, failed check, unclear label, or judgment the user may want \
to audit later.
NAMING: use lowercase snake_case names that are easy to read and filter, such as `code_quality`, \
`answer_relevance`, `tool_correctness`, or `retrieval_quality`. Treat `name` as the metric or \
rubric dimension, not the result — put outcomes in `label` or `score`; `name: "code_quality"`, \
`label: "pass"` is better than `name: "passed_code_quality"`. Keep names stable across runs; do \
not add suffixes like `_2`, `_new`, or `_v2` to avoid overwrites. Do not use `note` as an \
annotation name; span notes are separate from structured annotations.
VALUES: use short, consistent labels that are easy to filter, preferably lowercase values like \
`pass`, `fail`, `relevant`, `irrelevant`, `correct`, or `incorrect`. Use a numeric `score` only \
when the scale is clear, and put the rubric, scale, threshold, evaluator version, or confidence in \
`metadata` when useful.
UPDATES: annotations are keyed by `(name, span, identifier)`. Reuse the same `name` and \
`identifier` on a span to update that annotation. Use distinct identifiers, such as \
`reviewer:pxi`, `evaluator:v1`, or `run:2026-05-28`, when you need multiple annotations with the \
same name on the same span.
A good annotation name makes later filters readable, for example \
`annotations['code_quality'].label == 'fail'` or `annotations['answer_relevance'].score` below \
`0.8`.\
"""

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
class BatchSpanAnnotateCapability(AbstractToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
