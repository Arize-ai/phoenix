from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_spans_filter"

DESCRIPTION = (
    "Set the spans table filter. The filter is applied declaratively as a "
    "complete state: the freeform `condition` (Phoenix span filter DSL) "
    "describes the entire view, and the table is updated to exactly that "
    "state. There is no notion of leaving part of the filter unchanged — "
    "always send the whole condition. Pass an empty string to clear it."
    "\n\n"
    "ROOT SPANS ARE PART OF THE CONDITION: restrict to root spans -- spans "
    "with no parent -- with the predicate `parent_id is None`; omit it to "
    "search every span. This is usually the top-level span of each trace, "
    "but nothing enforces one root per trace: a fragmented or partially "
    "ingested trace can have several, so do not treat the row count as a "
    "trace count. Do NOT restrict to root spans when narrowing to a "
    "`span_kind` other than CHAIN or AGENT (i.e. LLM, TOOL, RETRIEVER, "
    "EMBEDDING, RERANKER, EVALUATOR, GUARDRAIL) — those kinds are almost "
    "always nested under a CHAIN/AGENT root, so combining them with a root "
    "predicate yields zero results even when matching spans exist. The same "
    "applies to anything that targets nested spans (specific tool names, "
    "status_code == 'ERROR' on inner calls, annotations attached to leaf "
    "spans). The spans table starts at `parent_id is None`, so dropping that "
    "predicate is how you widen the view to every span."
    "\n\n"
    "DSL FIELDS:\n"
    "  - Root spans: `parent_id is None` matches spans with no parent "
    "pointer, and is the table's default. `parent_span is None` is the "
    "wider form that also matches orphans -- spans whose parent was never "
    "ingested -- and is what to use when the user asks about orphans.\n"
    "  - String: `span_kind`, `name` (the span name, NOT span_name), "
    "`status_code`, `status_message`, `span_id`, `trace_id`, `parent_id`. "
    "Compare with `==`, `!=`, or membership via `in`.\n"
    "  - Numeric: `latency_ms`, "
    "`cumulative_token_count.{prompt,completion,total}`, "
    "`llm.token_count.{prompt,completion,total}`. Compare with `<`, "
    "`<=`, `>`, `>=`.\n"
    "  - Datetime: `start_time`, `end_time`.\n"
    "  - Attribute access: `attributes['key.path']`, `input.value`, "
    "`output.value`, `metadata['key']`.\n"
    "  - Annotations: `annotations['Name'].label`, "
    "`annotations['Name'].score`.\n"
    "  - Substring search: `'needle' in input.value` (works on any "
    "string field).\n"
    "  - Combine clauses with `and`, `or`, `not`."
    "\n\n"
    "VALUE CONVENTIONS:\n"
    "  - `span_kind` values are UPPERCASE string literals: 'LLM', "
    "'TOOL', 'CHAIN', 'AGENT', 'RETRIEVER', 'EMBEDDING', 'RERANKER', "
    "'EVALUATOR', 'GUARDRAIL', 'UNKNOWN'. Lowercase ('llm') will not "
    "match.\n"
    "  - `status_code` values are UPPERCASE: 'OK', 'ERROR', 'UNSET'.\n"
    "  - Always wrap string literals in single or double quotes."
    "\n\n"
    "EXAMPLES BY INTENT:\n"
    "  - 'Show me LLM spans' → `span_kind == 'LLM'`\n"
    "  - 'Tool calls' → `span_kind == 'TOOL'`\n"
    "  - 'Errored spans' → `status_code == 'ERROR'`\n"
    "  - 'Slow LLM calls' → `span_kind == 'LLM' and latency_ms >= 5000`\n"
    "  - 'Top-level traces only' → `parent_id is None`\n"
    "  - 'Slow traces' → `parent_id is None and latency_ms >= 5000`\n"
    "  - 'Include orphaned spans as roots' → `parent_span is None`\n"
    "  - 'Hallucinations' → "
    "`annotations['Hallucination'].label == 'hallucinated'`\n"
    "  - 'Spans mentioning agent in input' → `'agent' in input.value`\n"
    "  - 'Show everything' → `''`\n"
    "  - 'Reset to default view' → `parent_id is None`."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "condition": {
            "type": "string",
            "description": (
                "The span filter DSL expression to apply, including any root-span "
                "restriction (`parent_id is None`). Pass an empty string to clear "
                "the filter and show every span."
            ),
        },
    },
    "required": ["condition"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetSpansFilterCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        project = ctx.deps.contexts.project
        return project is not None and project.span_filter is not None
