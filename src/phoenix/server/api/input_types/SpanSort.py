from dataclasses import dataclass
from enum import Enum, auto
from typing import Any, Optional, Protocol

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, desc, nulls_last
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.expression import Select
from strawberry import UNSET
from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.db import models
from phoenix.server.api.types.pagination import CursorSortColumnDataType
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
    def column_name(self) -> str:
        for attribute_name in ("name", "key"):
            if attribute_value := getattr(self.orm_expression, attribute_name, None):
                return str(attribute_value)
        raise ValueError(f"Could not determine column name for {self}")

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
    def data_type(self) -> CursorSortColumnDataType:
        if (
            self is SpanColumn.cumulativeTokenCountTotal
            or self is SpanColumn.cumulativeTokenCountPrompt
            or self is SpanColumn.cumulativeTokenCountCompletion
        ):
            return CursorSortColumnDataType.INT
        if (
            self is SpanColumn.latencyMs
            or self is SpanColumn.tokenCountTotal
            or self is SpanColumn.tokenCountPrompt
            or self is SpanColumn.tokenCountCompletion
        ):
            return CursorSortColumnDataType.FLOAT
        if self is SpanColumn.startTime or self is SpanColumn.endTime:
            return CursorSortColumnDataType.DATETIME
        assert_never(self)


@strawberry.enum
class EvalAttr(Enum):
    score = "score"
    label = "label"

    @property
    def column_name(self) -> str:
        return f"span_annotations_{self.value}"

    @property
    def orm_expression(self) -> Any:
        expr: InstrumentedAttribute[Any]
        if self is EvalAttr.score:
            expr = models.SpanAnnotation.score
        elif self is EvalAttr.label:
            expr = models.SpanAnnotation.label
        else:
            assert_never(self)
        return expr.label(self.column_name)

    @property
    def data_type(self) -> CursorSortColumnDataType:
        if self is EvalAttr.label:
            return CursorSortColumnDataType.STRING
        if self is EvalAttr.score:
            return CursorSortColumnDataType.FLOAT
        assert_never(self)


@strawberry.input
class EvalResultKey:
    name: str
    attr: EvalAttr


class SupportsGetSpanEvaluation(Protocol):
    def get_span_evaluation(self, span_id: SpanID, name: str) -> Optional[pb.Evaluation]: ...


@dataclass(frozen=True)
class SpanSortConfig:
    stmt: Select[Any]
    column_name: str
    orm_expression: Any
    data_type: CursorSortColumnDataType


@strawberry.input(
    description="The sort key and direction for span connections. Must "
    "specify one and only one of either `col` or `evalResultKey`."
)
class SpanSort:
    col: Optional[SpanColumn] = UNSET
    eval_result_key: Optional[EvalResultKey] = UNSET
    dir: SortDir

    def update_orm_expr(self, stmt: Select[Any]) -> SpanSortConfig:
        if (col := self.col) and not self.eval_result_key:
            expr = col.orm_expression
            if self.dir == SortDir.desc:
                expr = desc(expr)
            return SpanSortConfig(
                stmt=stmt.order_by(nulls_last(expr)),
                column_name=col.column_name,
                orm_expression=col.orm_expression,
                data_type=col.data_type,
            )
        if (eval_result_key := self.eval_result_key) and not col:
            eval_name = eval_result_key.name
            eval_attr = eval_result_key.attr
            expr = eval_result_key.attr.orm_expression
            stmt = stmt.add_columns(expr)
            if self.dir == SortDir.desc:
                expr = desc(expr)
            stmt = stmt.join(
                models.SpanAnnotation,
                onclause=and_(
                    models.SpanAnnotation.span_rowid == models.Span.id,
                    models.SpanAnnotation.name == eval_name,
                ),
            ).order_by(expr)
            return SpanSortConfig(
                stmt=stmt,
                column_name=eval_attr.column_name,
                orm_expression=eval_result_key.attr.orm_expression,
                data_type=eval_attr.data_type,
            )
        raise ValueError("Exactly one of `col` or `evalResultKey` must be specified on `SpanSort`.")
