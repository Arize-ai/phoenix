from enum import Enum
from functools import partial
from typing import Any, Iterable, Iterator, Optional, Protocol

import pandas as pd
import strawberry
from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.core.traces import (
    END_TIME,
    START_TIME,
    ComputedAttributes,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.trace import semantic_conventions
from phoenix.trace.schemas import Span, SpanID


@strawberry.enum
class SpanColumn(Enum):
    startTime = START_TIME
    endTime = END_TIME
    latencyMs = ComputedAttributes.LATENCY_MS.value
    tokenCountTotal = semantic_conventions.LLM_TOKEN_COUNT_TOTAL
    tokenCountPrompt = semantic_conventions.LLM_TOKEN_COUNT_PROMPT
    tokenCountCompletion = semantic_conventions.LLM_TOKEN_COUNT_COMPLETION
    cumulativeTokenCountTotal = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_TOTAL.value
    cumulativeTokenCountPrompt = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_PROMPT.value
    cumulativeTokenCountCompletion = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION.value


@strawberry.enum
class EvalAttr(Enum):
    score = "score"
    label = "label"


class SupportsGetSpanEvaluation(Protocol):
    def get_span_evaluation(self, span_id: SpanID, name: str) -> Optional[pb.Evaluation]:
        ...


@strawberry.input
class EvalResultKey:
    name: str
    attr: EvalAttr

    def __call__(
        self,
        span: Span,
        evals: Optional[SupportsGetSpanEvaluation] = None,
    ) -> Any:
        """
        Returns the evaluation result for the given span
        """
        if evals is None:
            return None
        span_id = span.context.span_id
        evaluation = evals.get_span_evaluation(span_id, self.name)
        if evaluation is None:
            return None
        result = evaluation.result
        if self.attr is EvalAttr.score:
            return result.score.value if result.HasField("score") else None
        if self.attr is EvalAttr.label:
            return result.label.value if result.HasField("label") else None
        assert_never(self.attr)


@strawberry.input
class SpanSort:
    """
    The sort column and direction for span connections. Must specify one and
    only one of either `col` or `eval_result_key`.
    """

    col: Optional[SpanColumn] = None
    eval_result_key: Optional[EvalResultKey] = None
    dir: SortDir

    def __call__(
        self,
        spans: Iterable[Span],
        evals: Optional[SupportsGetSpanEvaluation] = None,
    ) -> Iterator[Span]:
        """
        Sorts the spans by the given key (column or eval) and direction
        """
        if self.eval_result_key is not None:
            _key = partial(self.eval_result_key, evals=evals)
        else:
            _key = partial(_get_column, span_column=self.col or SpanColumn.startTime)
        yield from pd.Series(spans, dtype=object).sort_values(
            key=lambda series: series.apply(_key),
            ascending=self.dir.value == SortDir.asc.value,
        )


def _get_column(span: Span, span_column: SpanColumn) -> Any:
    if span_column is SpanColumn.startTime:
        return span.start_time
    if span_column is SpanColumn.endTime:
        return span.end_time
    return span.attributes.get(span_column.value)
