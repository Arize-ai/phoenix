from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

from evals.pxi.online_evals.models import EvaluatorSpec
from evals.pxi.online_evals.topology import PXI_TURN_ROOT_NAME, classify_tool_spans


def _tool_name(span: v1.Span) -> str:
    attributes = span.get("attributes", {})
    value: Any = attributes.get("tool.name")
    return value if isinstance(value, str) and value else span["name"]


async def evaluate_tool_count_per_turn(root: v1.Span, spans: Sequence[v1.Span]) -> Score:
    breakdown = classify_tool_spans(root, spans)
    names = [_tool_name(span) for span in breakdown.all_tools]
    top_level_names = [_tool_name(span) for span in breakdown.top_level]
    nested_names = [_tool_name(span) for span in breakdown.nested]
    count = len(breakdown.all_tools)
    nested_count = len(breakdown.nested)
    explanation = f"{count} tool call{'s' if count != 1 else ''} in this turn"
    if nested_count:
        explanation += f" ({len(breakdown.top_level)} top-level, {nested_count} nested)"
    return Score(
        name="tool_count_per_turn",
        score=float(count),
        explanation=explanation,
        metadata={
            "tool_names": names,
            "top_level_tool_names": top_level_names,
            "nested_tool_names": nested_names,
            "nested_tool_count": nested_count,
            "subagent_call_count": top_level_names.count("call_subagent"),
        },
        kind="code",
    )


TOOL_COUNT_PER_TURN = EvaluatorSpec(
    name="tool_count_per_turn",
    root_span_name=PXI_TURN_ROOT_NAME,
    evaluate=evaluate_tool_count_per_turn,
    annotator_kind="CODE",
    sample_rate=1.0,
    identifier="pxi-online-evals:tool-count-per-turn:v2",
)
