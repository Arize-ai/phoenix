from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from phoenix.client.__generated__ import v1

from evals.pxi.offline_evals.models import EvaluationResult, EvaluatorSpec
from evals.pxi.offline_evals.topology import PXI_TURN_ROOT_NAME, top_level_tool_spans


def _tool_name(span: v1.Span) -> str:
    attributes = span.get("attributes", {})
    value: Any = attributes.get("tool.name")
    return value if isinstance(value, str) and value else span["name"]


def evaluate_tool_count_per_turn(root: v1.Span, spans: Sequence[v1.Span]) -> EvaluationResult:
    tools = top_level_tool_spans(root, spans)
    names = [_tool_name(span) for span in tools]
    count = len(tools)
    return EvaluationResult(
        score=float(count),
        explanation=f"{count} top-level PXI tool call{'s' if count != 1 else ''} in this turn",
        metadata={"tool_names": names},
    )


TOOL_COUNT_PER_TURN = EvaluatorSpec(
    name="tool_count_per_turn",
    input_scope="trace",
    root_span_name=PXI_TURN_ROOT_NAME,
    evaluate=evaluate_tool_count_per_turn,
    annotation_target="span",
    sample_rate=1.0,
    identifier="pxi-offline-evals:tool-count-per-turn:v1",
)
