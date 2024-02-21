from enum import Enum
from functools import partial
from typing import Any, Iterable, Iterator, Optional, Protocol

import pandas as pd
import strawberry
from openinference.semconv.trace import SpanAttributes
from strawberry import UNSET
from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.core.traces import (
    END_TIME,
    START_TIME,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.trace.schemas import ComputedAttributes, Span, SpanID


@strawberry.enum
class SpanColumn(Enum):
    startTime = START_TIME
    endTime = END_TIME
    latencyMs = ComputedAttributes.LATENCY_MS.value
    tokenCountTotal = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
    tokenCountPrompt = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
    tokenCountCompletion = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
    cumulativeTokenCountTotal = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_TOTAL.value
    cumulativeTokenCountPrompt = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_PROMPT.value
    cumulativeTokenCountCompletion = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION.value


@strawberry.enum
class EvalAttr(Enum):
    score = "score"
    label = "label"


@strawberry.input
class EvalResultKey:
    name: str
    attr: EvalAttr


class SupportsGetSpanEvaluation(Protocol):
    def get_span_evaluation(self, span_id: SpanID, name: str) -> Optional[pb.Evaluation]:
        ...


@strawberry.input(
    description="The sort key and direction for span connections. Must "
    "specify one and only one of either `col` or `evalResultKey`."
)
class SpanSort:
    col: Optional[SpanColumn] = UNSET
    eval_result_key: Optional[EvalResultKey] = UNSET
    dir: SortDir

    def __call__(
        self,
        spans: Iterable[Span],
        evals: Optional[SupportsGetSpanEvaluation] = None,
    ) -> Iterator[Span]:
        """
        Sorts the spans by the given key (column or eval) and direction
        """
        if self.eval_result_key:
            get_sort_key_value = partial(
                _get_eval_result_value,
                eval_name=self.eval_result_key.name,
                eval_attr=self.eval_result_key.attr,
                evals=evals,
            )
        else:
            get_sort_key_value = partial(
                _get_column_value,
                span_column=self.col or SpanColumn.startTime,
            )
        yield from pd.Series(spans, dtype=object).sort_values(
            key=lambda series: series.apply(get_sort_key_value),
            ascending=self.dir.value == SortDir.asc.value,
        )


def _get_column_value(span: Span, span_column: SpanColumn) -> Any:
    if span_column is SpanColumn.startTime:
        return span.start_time
    if span_column is SpanColumn.endTime:
        return span.end_time
    return span.attributes.get(span_column.value)


def _get_eval_result_value(
    span: Span,
    eval_name: str,
    eval_attr: EvalAttr,
    evals: Optional[SupportsGetSpanEvaluation] = None,
) -> Any:
    """
    Returns the evaluation result for the given span
    """
    if evals is None:
        return None
    span_id = span.context.span_id
    evaluation = evals.get_span_evaluation(span_id, eval_name)
    if evaluation is None:
        return None
    result = evaluation.result
    if eval_attr is EvalAttr.score:
        return result.score.value if result.HasField("score") else None
    if eval_attr is EvalAttr.label:
        return result.label.value if result.HasField("label") else None
    assert_never(eval_attr)
