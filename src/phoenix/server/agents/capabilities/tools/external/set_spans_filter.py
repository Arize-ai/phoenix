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
    "complete state: every call must specify BOTH the freeform filter "
    "`condition` (Phoenix span filter DSL) AND the `rootSpansOnly` toggle, "
    "and the table is updated to exactly that state. There is no notion of "
    "leaving a field unchanged — always pass both. Pass `condition` as an "
    "empty string to clear the filter."
    "\n\n"
    "PAIRING `condition` WITH `rootSpansOnly`: the filter condition only "
    "matches within the currently selected root/all scope. When narrowing "
    "to a `span_kind` other than CHAIN or AGENT (i.e. LLM, TOOL, "
    "RETRIEVER, EMBEDDING, RERANKER, EVALUATOR, GUARDRAIL), pair it with "
    "`rootSpansOnly: false` — those kinds are almost always nested under a "
    "CHAIN/AGENT root, so `rootSpansOnly: true` yields zero results even "
    "when matching spans exist. Same applies when filtering by anything "
    "that targets nested spans (specific tool names, status_code == "
    "'ERROR' on inner calls, annotations attached to leaf spans). "
    "Trace annotations apply to every span in the annotated trace. Use "
    "`rootSpansOnly: true` to show one row per matching trace, or "
    "`rootSpansOnly: false` to inspect all spans belonging to those traces. The "
    "`rootSpansOnly` field only takes visible effect when the spans table "
    "toggle is mounted (Spans tab); on other tabs only `condition` "
    "applies, but you must still send `rootSpansOnly`."
    "\n\n"
    "DSL FIELDS:\n"
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
    "  - Span annotations: `annotations['Name'].label`, "
    "`annotations['Name'].score`, `annotations['Name'].explanation`, or bare "
    "`annotations['Name']` to test existence.\n"
    "  - Trace annotations: `trace_annotations['Name'].label`, "
    "`trace_annotations['Name'].score`, `trace_annotations['Name'].explanation`, "
    "or bare `trace_annotations['Name']`. A matching trace annotation selects "
    "spans belonging to that trace.\n"
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
    "EXAMPLES BY INTENT (every call sets both fields):\n"
    "  - 'Show me LLM spans' → condition `span_kind == 'LLM'`, "
    "rootSpansOnly: false\n"
    "  - 'Tool calls' → condition `span_kind == 'TOOL'`, "
    "rootSpansOnly: false\n"
    "  - 'Errored spans' → condition `status_code == 'ERROR'`, "
    "rootSpansOnly: false\n"
    "  - 'Slow LLM calls' → condition `span_kind == 'LLM' and "
    "latency_ms >= 5000`, rootSpansOnly: false\n"
    "  - 'Top-level traces only' → condition `''`, rootSpansOnly: true\n"
    "  - 'Hallucinations' → condition "
    "`annotations['Hallucination'].label == 'hallucinated'`, "
    "rootSpansOnly: false\n"
    "  - 'Traces rated as poor quality' → condition "
    "`trace_annotations['quality'].label == 'poor'`, rootSpansOnly: true\n"
    "  - 'Spans mentioning agent in input' → condition `'agent' in "
    "input.value`, rootSpansOnly: false\n"
    "  - 'Reset to default view' → condition `''`, rootSpansOnly: true."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "condition": {
            "type": "string",
            "description": (
                "The span filter DSL expression to apply. Pass an empty string to clear the filter."
            ),
        },
        "rootSpansOnly": {
            "type": "boolean",
            "description": (
                "Whether the spans table should restrict to root spans "
                "(true) or include every span (false)."
            ),
        },
    },
    "required": ["condition", "rootSpansOnly"],
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
