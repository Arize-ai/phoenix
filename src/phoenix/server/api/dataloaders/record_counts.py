from collections import defaultdict
from datetime import datetime
from typing import (
    Any,
    AsyncContextManager,
    Callable,
    DefaultDict,
    List,
    Literal,
    Optional,
    Tuple,
)

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.trace.dsl import SpanFilter

Kind: TypeAlias = Literal["span", "trace"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = Tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
SpanCount: TypeAlias = int

Segment: TypeAlias = Tuple[Kind, TimeInterval, FilterCondition]
Param: TypeAlias = ProjectRowId

Key: TypeAlias = Tuple[Kind, ProjectRowId, Optional[TimeRange], FilterCondition]
Result: TypeAlias = SpanCount
ResultPosition: TypeAlias = int
DEFAULT_VALUE = 0


class RecordCountDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn, cache_key_fn=self._cache_key_fn)
        self._db = db

    @staticmethod
    def _cache_key_fn(key: Key) -> Tuple[Segment, Param]:
        kind, project_rowid, time_range, filter_condition = key
        interval = (
            (time_range.start, time_range.end)
            if isinstance(time_range, TimeRange)
            else (None, None)
        )
        return (kind, interval, filter_condition), project_rowid

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        results: List[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: DefaultDict[
            Segment,
            DefaultDict[Param, List[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, param = self._cache_key_fn(key)
            arguments[segment][param].append(position)
        async with self._db() as session:
            for segment, params in arguments.items():
                stmt = _get_stmt(segment, *params.keys())
                data = await session.stream(stmt)
                async for project_rowid, span_count in data:
                    for position in params[project_rowid]:
                        results[position] = span_count
        return results


def _get_stmt(
    segment: Segment,
    *project_rowids: Param,
) -> Select[Any]:
    kind, (start_time, end_time), filter_condition = segment
    pid = models.Trace.project_rowid
    if kind == "span":
        counter = func.count(models.Span.id).label("span_count")
    elif kind == "trace":
        counter = func.count(models.Trace.id).label("trace_count")
    else:
        assert_never(kind)
    stmt = select(pid, counter).group_by(pid)
    if kind == "span":
        stmt = stmt.join(models.Span)
        if start_time:
            stmt = stmt.where(models.Span.start_time >= start_time)
        if end_time:
            stmt = stmt.where(models.Span.end_time < end_time)
        if filter_condition:
            span_filter = SpanFilter(condition=filter_condition)
            stmt = span_filter(stmt)
    elif kind == "trace":
        if start_time:
            stmt = stmt.where(models.Trace.start_time >= start_time)
        if end_time:
            stmt = stmt.where(models.Trace.end_time < end_time)
    else:
        assert_never(kind)
    stmt = stmt.where(pid.in_(project_rowids))
    return stmt
