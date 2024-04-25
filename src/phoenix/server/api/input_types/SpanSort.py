from enum import Enum, auto
from typing import Any, Optional, Protocol

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, desc, nulls_last
from sqlalchemy.sql.expression import Select
from strawberry import UNSET

import phoenix.trace.v1 as pb
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


@strawberry.enum
class EvalAttr(Enum):
    score = "score"
    label = "label"


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

_EVAL_ATTR_TO_ORM_EXPR_MAP = {
    EvalAttr.score: models.SpanAnnotation.score,
    EvalAttr.label: models.SpanAnnotation.label,
}


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

    def update_orm_expr(self, stmt: Select[Any]) -> Select[Any]:
        if self.col and not self.eval_result_key:
            expr = _SPAN_COLUMN_TO_ORM_EXPR_MAP[self.col]
            if self.dir == SortDir.desc:
                expr = desc(expr)
            return stmt.order_by(nulls_last(expr))
        if self.eval_result_key and not self.col:
            eval_name = self.eval_result_key.name
            expr = _EVAL_ATTR_TO_ORM_EXPR_MAP[self.eval_result_key.attr]
            if self.dir == SortDir.desc:
                expr = desc(expr)
            return stmt.join(
                models.SpanAnnotation,
                onclause=and_(
                    models.SpanAnnotation.span_rowid == models.Span.id,
                    models.SpanAnnotation.name == eval_name,
                ),
            ).order_by(expr)
        raise ValueError("Exactly one of `col` or `evalResultKey` must be specified on `SpanSort`.")
