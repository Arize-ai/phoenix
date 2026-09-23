from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from enum import Enum, auto
from types import MappingProxyType
from typing import Any, NamedTuple, Optional

import strawberry
from sqlalchemy import and_, desc, func, nulls_last
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.expression import Select
from strawberry import UNSET
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import truncate_name
from phoenix.db.session_aggregates import (
    SESSION_ROWID,
    SessionAggregate,
    cost_summary_by_session,
    num_traces_by_session,
    token_counts_by_session,
)
from phoenix.server.api.types.pagination import CursorSortColumnDataType
from phoenix.server.api.types.SortDir import SortDir


class _SortAggregate(NamedTuple):
    """The per-session aggregate a sort column orders by, and the one value it reads."""

    builder_key: str
    builder: Callable[[], SessionAggregate]
    value_column: str


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
            expr = func.coalesce(joined_table.c.total, 0)
        elif self is ProjectSessionColumn.numTraces:
            assert joined_table is not None
            expr = joined_table.c.num_traces
        elif self is ProjectSessionColumn.costTotal:
            assert joined_table is not None
            expr = func.coalesce(joined_table.c.total_cost, 0)
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

    @property
    def aggregate(self) -> Optional[_SortAggregate]:
        """The aggregate this column sorts by, or ``None`` for the session's own timestamps."""
        return _SORT_AGGREGATES.get(self)

    def join_tables(
        self,
        stmt: Select[Any],
        project_rowids: Optional[Sequence[int]] = None,
        start_time: Optional[Any] = None,
        end_time: Optional[Any] = None,
    ) -> tuple[Select[Any], Any]:
        """
        If needed, joins tables required for the sort column.
        """
        if (aggregate := self.aggregate) is None:
            return stmt, None
        sort_subq = (
            aggregate.builder()
            .as_grouped_subquery(
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
                values=[aggregate.value_column],
            )
            .subquery()
        )
        onclause = models.ProjectSession.id == sort_subq.c[SESSION_ROWID]
        if self in (ProjectSessionColumn.tokenCountTotal, ProjectSessionColumn.costTotal):
            stmt = stmt.outerjoin(sort_subq, onclause)
        else:
            stmt = stmt.join(sort_subq, onclause)
        return stmt, sort_subq


_SORT_AGGREGATES: Mapping[ProjectSessionColumn, _SortAggregate] = MappingProxyType(
    {
        ProjectSessionColumn.tokenCountTotal: _SortAggregate(
            "token_counts", token_counts_by_session, "total"
        ),
        ProjectSessionColumn.numTraces: _SortAggregate(
            "num_traces", num_traces_by_session, "num_traces"
        ),
        ProjectSessionColumn.costTotal: _SortAggregate(
            "cost_summary", cost_summary_by_session, "total_cost"
        ),
    }
)


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
    # The aggregate subquery this sort joined, paired with the builder key naming its family, so a
    # filter over the same aggregate can read this column instead of computing it a second time.
    prejoined_aggregate: Optional[tuple[str, Any]] = None


@strawberry.input(description="The sort key and direction for ProjectSession connections.")
class ProjectSessionSort:
    col: Optional[ProjectSessionColumn] = UNSET
    anno_result_key: Optional[ProjectSessionAnnoResultKey] = UNSET
    dir: SortDir

    def update_orm_expr(
        self,
        stmt: Select[Any],
        project_rowids: Optional[Sequence[int]] = None,
        start_time: Optional[Any] = None,
        end_time: Optional[Any] = None,
    ) -> ProjectSessionSortConfig:
        if (col := self.col) and not self.anno_result_key:
            stmt, joined_table = col.join_tables(
                stmt,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            )
            expr = col.as_orm_expression(joined_table)
            stmt = stmt.add_columns(expr)
            if self.dir == SortDir.desc:
                expr = desc(expr)
            aggregate = col.aggregate
            return ProjectSessionSortConfig(
                stmt=stmt.order_by(nulls_last(expr)),
                orm_expression=col.as_orm_expression(joined_table),
                dir=self.dir,
                column_name=col.column_name,
                column_data_type=col.data_type,
                prejoined_aggregate=(
                    None if aggregate is None else (aggregate.builder_key, joined_table)
                ),
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
