from __future__ import annotations

from typing import Any

from phoenix.server.agents.tools.registry import ContextualTool

APPLY_SPAN_FILTER_CONDITION_NAME = "apply_span_filter_condition"

APPLY_SPAN_FILTER_CONDITION_DESCRIPTION = (
    "Apply a Phoenix span filter to the project span list. Examples: "
    "`span_kind == 'LLM'`, `status_code == 'ERROR' and latency_ms >= 5000`, "
    "`'agent' in input.value`, `annotations['Hallucination'].label == 'hallucinated'`. "
    "Pass an empty string to clear the filter."
)

APPLY_SPAN_FILTER_CONDITION_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "condition": {
            "type": "string",
            "description": (
                "The span filter DSL expression to apply. Pass an empty string to clear the filter."
            ),
        },
    },
    "required": ["condition"],
    "additionalProperties": False,
}


def build_apply_span_filter_condition_tool() -> ContextualTool:
    return ContextualTool(
        name=APPLY_SPAN_FILTER_CONDITION_NAME,
        description=APPLY_SPAN_FILTER_CONDITION_DESCRIPTION,
        parameters_json_schema=APPLY_SPAN_FILTER_CONDITION_PARAMETERS,
        required_contexts=frozenset({"span_filter"}),
        executes_on="client",
        build_callable=None,
    )
