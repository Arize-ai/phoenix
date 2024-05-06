from dataclasses import dataclass
from enum import Enum, auto
from typing import Any, Optional, Protocol

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, desc, nulls_last
from sqlalchemy.sql.expression import Select
from strawberry import UNSET
from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.db import models
from phoenix.server.api.types.pagination import SortableFieldType
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

    @property
    def orm_expression(self) -> Any:
        if self is SpanColumn.startTime:
            return models.Span.start_time
        if self is SpanColumn.endTime:
            return models.Span.end_time
        if self is SpanColumn.latencyMs:
            return models.Span.latency_ms
        if self is SpanColumn.tokenCountTotal:
            return models.Span.attributes[LLM_TOKEN_COUNT_TOTAL].as_float()
        if self is SpanColumn.tokenCountPrompt:
            return models.Span.attributes[LLM_TOKEN_COUNT_PROMPT].as_float()
        if self is SpanColumn.tokenCountCompletion:
            return models.Span.attributes[LLM_TOKEN_COUNT_COMPLETION].as_float()
        if self is SpanColumn.cumulativeTokenCountTotal:
            return (
                models.Span.cumulative_llm_token_count_prompt
                + models.Span.cumulative_llm_token_count_completion
            )
        if self is SpanColumn.cumulativeTokenCountPrompt:
            return models.Span.cumulative_llm_token_count_prompt
        if self is SpanColumn.cumulativeTokenCountCompletion:
            return models.Span.cumulative_llm_token_count_completion
        assert_never(self)

    @property
    def data_type(self) -> SortableFieldType:
        if (
            self is SpanColumn.cumulativeTokenCountTotal
            or self is SpanColumn.cumulativeTokenCountPrompt
            or self is SpanColumn.cumulativeTokenCountCompletion
        ):
            return SortableFieldType.INT
        if (
            self is SpanColumn.latencyMs
            or self is SpanColumn.tokenCountTotal
            or self is SpanColumn.tokenCountPrompt
            or self is SpanColumn.tokenCountCompletion
        ):
            return SortableFieldType.FLOAT
        if self is SpanColumn.startTime or self is SpanColumn.endTime:
            return SortableFieldType.DATETIME
        assert_never(self)


@strawberry.enum
class EvalAttr(Enum):
    score = "score"
    label = "label"


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


@dataclass(frozen=True)
class SpanSortResult:
    stmt: Select[Any]
    eval_alias: Optional[str] = None


@strawberry.input(
    description="The sort key and direction for span connections. Must "
    "specify one and only one of either `col` or `evalResultKey`."
)
class SpanSort:
    col: Optional[SpanColumn] = UNSET
    eval_result_key: Optional[EvalResultKey] = UNSET
    dir: SortDir

    def update_orm_expr(self, stmt: Select[Any]) -> SpanSortResult:
        if self.col and not self.eval_result_key:
            expr = self.col.orm_expression
            if self.dir == SortDir.desc:
                expr = desc(expr)
            return SpanSortResult(stmt=stmt.order_by(nulls_last(expr)))
        if self.eval_result_key and not self.col:
            eval_name = self.eval_result_key.name
            expr = _EVAL_ATTR_TO_ORM_EXPR_MAP[self.eval_result_key.attr]
            if self.dir == SortDir.desc:
                expr = desc(expr)
            return SpanSortResult(
                stmt=stmt.join(
                    models.SpanAnnotation,
                    onclause=and_(
                        models.SpanAnnotation.span_rowid == models.Span.id,
                        models.SpanAnnotation.name == eval_name,
                    ),
                ).order_by(expr)
            )
        raise ValueError("Exactly one of `col` or `evalResultKey` must be specified on `SpanSort`.")
