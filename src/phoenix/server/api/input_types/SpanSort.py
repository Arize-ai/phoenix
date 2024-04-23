from enum import Enum, auto
from functools import partial
from typing import Any, Iterable, Iterator, Optional, Protocol

import pandas as pd
import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import desc, nulls_last
from strawberry import UNSET
from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.core.project import WrappedSpan
from phoenix.db import models
from phoenix.server.api.types.SortDir import SortDir
from phoenix.trace.schemas import SpanID

LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT.split(".")
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION.split(".")
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL.split(".")


@strawberry.enum
class SpanColumn(Enum):
    startTime = auto()
    endTime = auto()
    latencyMs = auto()
    tokenCountTotal = auto()
    tokenCountPrompt = auto()
    tokenCountCompletion = auto()
    cumulativeTokenCountTotal = auto()
    cumulativeTokenCountPrompt = auto()
    cumulativeTokenCountCompletion = auto()


_SPAN_COLUMN_TO_ORM_EXPR_MAP = {
    SpanColumn.startTime: models.Span.start_time,
    SpanColumn.endTime: models.Span.end_time,
    SpanColumn.latencyMs: models.Span.latency_ms,
    SpanColumn.tokenCountTotal: models.Span.attributes[LLM_TOKEN_COUNT_TOTAL].as_float(),
    SpanColumn.tokenCountPrompt: models.Span.attributes[LLM_TOKEN_COUNT_PROMPT].as_float(),
    SpanColumn.tokenCountCompletion: models.Span.attributes[LLM_TOKEN_COUNT_COMPLETION].as_float(),
    SpanColumn.cumulativeTokenCountTotal: models.Span.cumulative_llm_token_count_prompt
    + models.Span.cumulative_llm_token_count_completion,
    SpanColumn.cumulativeTokenCountPrompt: models.Span.cumulative_llm_token_count_prompt,
    SpanColumn.cumulativeTokenCountCompletion: models.Span.cumulative_llm_token_count_completion,
}


@strawberry.enum
class EvalAttr(Enum):
    score = "score"
    label = "label"


@strawberry.input
class EvalResultKey:
    name: str
    attr: EvalAttr


class SupportsGetSpanEvaluation(Protocol):
    def get_span_evaluation(self, span_id: SpanID, name: str) -> Optional[pb.Evaluation]: ...


@strawberry.input(
    description="The sort key and direction for span connections. Must "
    "specify one and only one of either `col` or `evalResultKey`."
)
class SpanSort:
    col: Optional[SpanColumn] = UNSET
    eval_result_key: Optional[EvalResultKey] = UNSET
    dir: SortDir

    def to_orm_expr(self) -> Any:
        if self.col:
            expr = _SPAN_COLUMN_TO_ORM_EXPR_MAP[self.col]
            if self.dir == SortDir.desc:
                expr = desc(expr)
            return nulls_last(expr)
        NotImplementedError("not implemented")

    def __call__(
        self,
        spans: Iterable[WrappedSpan],
        evals: Optional[SupportsGetSpanEvaluation] = None,
    ) -> Iterator[WrappedSpan]:
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
            NotImplementedError("This should be unreachable. Use SQL instead.")
        yield from pd.Series(spans, dtype=object).sort_values(
            key=lambda series: series.apply(get_sort_key_value),
            ascending=self.dir.value == SortDir.asc.value,
        )


def _get_eval_result_value(
    span: WrappedSpan,
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
