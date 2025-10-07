from dataclasses import dataclass
from enum import Enum, auto
from typing import Any, Optional

import strawberry
from sqlalchemy import and_, desc, func, nulls_last, select
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.expression import Select
from strawberry import UNSET
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import truncate_name
from phoenix.server.api.types.pagination import CursorSortColumnDataType
from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ProjectSessionColumn(Enum):
    startTime = auto()
    endTime = auto()
    tokenCountTotal = auto()
    numTraces = auto()
    costTotal = auto()

    @property
    def column_name(self) -> str:
        return truncate_name(f"{self.name}_project_session_sort_column")

    def as_orm_expression(self, joined_table: Optional[Any] = None) -> Any:
        expr: Any
        if self is ProjectSessionColumn.startTime:
            expr = models.ProjectSession.start_time
        elif self is ProjectSessionColumn.endTime:
            expr = models.ProjectSession.end_time
        elif self is ProjectSessionColumn.tokenCountTotal:
            assert joined_table is not None
            expr = joined_table.c.key
        elif self is ProjectSessionColumn.numTraces:
            assert joined_table is not None
            expr = joined_table.c.key
        elif self is ProjectSessionColumn.costTotal:
            assert joined_table is not None
            expr = joined_table.c.key
        else:
            assert_never(self)
        return expr.label(self.column_name)

    @property
    def data_type(self) -> CursorSortColumnDataType:
        if self is ProjectSessionColumn.tokenCountTotal or self is ProjectSessionColumn.numTraces:
            return CursorSortColumnDataType.INT
        if self is ProjectSessionColumn.startTime or self is ProjectSessionColumn.endTime:
            return CursorSortColumnDataType.DATETIME
        if self is ProjectSessionColumn.costTotal:
            return CursorSortColumnDataType.FLOAT
        assert_never(self)

    def join_tables(self, stmt: Select[Any]) -> tuple[Select[Any], Any]:
        """
        If needed, joins tables required for the sort column.
        """
        if self is ProjectSessionColumn.tokenCountTotal:
            sort_subq = (
                select(
                    models.Trace.project_session_rowid.label("id"),
                    func.sum(models.Span.cumulative_llm_token_count_total).label("key"),
                )
                .join_from(models.Trace, models.Span)
                .where(models.Span.parent_id.is_(None))
                .group_by(models.Trace.project_session_rowid)
            ).subquery()
            stmt = stmt.join(sort_subq, models.ProjectSession.id == sort_subq.c.id)
            return stmt, sort_subq
        if self is ProjectSessionColumn.numTraces:
            sort_subq = (
                select(
                    models.Trace.project_session_rowid.label("id"),
                    func.count(models.Trace.id).label("key"),
                ).group_by(models.Trace.project_session_rowid)
            ).subquery()
            stmt = stmt.join(sort_subq, models.ProjectSession.id == sort_subq.c.id)
            return stmt, sort_subq
        if self is ProjectSessionColumn.costTotal:
            sort_subq = (
                select(
                    models.Trace.project_session_rowid.label("id"),
                    func.sum(models.SpanCost.total_cost).label("key"),
                )
                .join_from(
                    models.Trace,
                    models.SpanCost,
                    models.Trace.id == models.SpanCost.trace_rowid,
                )
                .group_by(models.Trace.project_session_rowid)
            ).subquery()
            stmt = stmt.join(sort_subq, models.ProjectSession.id == sort_subq.c.id)
            return stmt, sort_subq
        return stmt, None


@strawberry.enum
class ProjectSessionAnnoAttr(Enum):
    score = "score"
    label = "label"

    @property
    def column_name(self) -> str:
        return f"{self.value}_anno_sort_column"

    @property
    def orm_expression(self) -> Any:
        expr: InstrumentedAttribute[Any]
        if self is ProjectSessionAnnoAttr.score:
            expr = models.ProjectSessionAnnotation.score
        elif self is ProjectSessionAnnoAttr.label:
            expr = models.ProjectSessionAnnotation.label
        else:
            assert_never(self)
        return expr.label(self.column_name)

    @property
    def data_type(self) -> CursorSortColumnDataType:
        if self is ProjectSessionAnnoAttr.label:
            return CursorSortColumnDataType.STRING
        if self is ProjectSessionAnnoAttr.score:
            return CursorSortColumnDataType.FLOAT
        assert_never(self)


@strawberry.input
class ProjectSessionAnnoResultKey:
    name: str
    attr: ProjectSessionAnnoAttr


@dataclass(frozen=True)
class ProjectSessionSortConfig:
    stmt: Select[Any]
    orm_expression: Any
    dir: SortDir
    column_name: str
    column_data_type: CursorSortColumnDataType


@strawberry.input(description="The sort key and direction for ProjectSession connections.")
class ProjectSessionSort:
    col: Optional[ProjectSessionColumn] = UNSET
    anno_result_key: Optional[ProjectSessionAnnoResultKey] = UNSET
    dir: SortDir

    def update_orm_expr(self, stmt: Select[Any]) -> ProjectSessionSortConfig:
        if (col := self.col) and not self.anno_result_key:
            stmt, joined_table = col.join_tables(stmt)
            expr = col.as_orm_expression(joined_table)
            stmt = stmt.add_columns(expr)
            if self.dir == SortDir.desc:
                expr = desc(expr)
            return ProjectSessionSortConfig(
                stmt=stmt.order_by(nulls_last(expr)),
                orm_expression=col.as_orm_expression(joined_table),
                dir=self.dir,
                column_name=col.column_name,
                column_data_type=col.data_type,
            )
        if (anno_result_key := self.anno_result_key) and not col:
            anno_name = anno_result_key.name
            anno_attr = anno_result_key.attr
            expr = anno_result_key.attr.orm_expression
            stmt = stmt.add_columns(expr)
            if self.dir == SortDir.desc:
                expr = desc(expr)
            stmt = stmt.join(
                models.ProjectSessionAnnotation,
                onclause=and_(
                    models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
                    models.ProjectSessionAnnotation.name == anno_name,
                ),
            ).order_by(nulls_last(expr))
            return ProjectSessionSortConfig(
                stmt=stmt,
                orm_expression=anno_result_key.attr.orm_expression,
                dir=self.dir,
                column_name=anno_attr.column_name,
                column_data_type=anno_attr.data_type,
            )
        raise ValueError(
            "Exactly one of `col` or `annoResultKey` must be specified on `ProjectSessionSort`."
        )
