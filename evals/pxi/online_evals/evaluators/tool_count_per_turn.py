from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

from evals.pxi.online_evals.models import EvaluatorSpec
from evals.pxi.online_evals.topology import PXI_TURN_ROOT_NAME, top_level_tool_spans


def _tool_name(span: v1.Span) -> str:
    attributes = span.get("attributes", {})
    value: Any = attributes.get("tool.name")
    return value if isinstance(value, str) and value else span["name"]


async def evaluate_tool_count_per_turn(root: v1.Span, spans: Sequence[v1.Span]) -> Score:
    tools = top_level_tool_spans(root, spans)
    names = [_tool_name(span) for span in tools]
    count = len(tools)
    return Score(
        name="tool_count_per_turn",
        score=float(count),
        explanation=f"{count} top-level PXI tool call{'s' if count != 1 else ''} in this turn",
        metadata={"tool_names": names},
        kind="code",
    )


TOOL_COUNT_PER_TURN = EvaluatorSpec(
    name="tool_count_per_turn",
    root_span_name=PXI_TURN_ROOT_NAME,
    evaluate=evaluate_tool_count_per_turn,
    sample_rate=1.0,
    identifier="pxi-online-evals:tool-count-per-turn:v1",
)
