from collections import defaultdict
from datetime import datetime
from typing import Any, Literal, Optional

from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, distinct, func, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.session_filters import get_filtered_session_rowids_subquery
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanFilter

Kind: TypeAlias = Literal["span", "trace"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
SessionFilterCondition: TypeAlias = Optional[str]
SpanCount: TypeAlias = int

Segment: TypeAlias = tuple[Kind, TimeInterval, FilterCondition, SessionFilterCondition]
Param: TypeAlias = ProjectRowId

Key: TypeAlias = tuple[
    Kind, ProjectRowId, Optional[TimeRange], FilterCondition, SessionFilterCondition
]
Result: TypeAlias = SpanCount
ResultPosition: TypeAlias = int
DEFAULT_VALUE: Result = 0


def _cache_key_fn(key: Key) -> tuple[Segment, Param]:
    kind, project_rowid, time_range, filter_condition, session_filter_condition = key
    interval = (
        (time_range.start, time_range.end) if isinstance(time_range, TimeRange) else (None, None)
    )
    return (
        kind,
        interval,
        filter_condition,
        session_filter_condition,
    ), project_rowid


_Section: TypeAlias = ProjectRowId
_SubKey: TypeAlias = tuple[TimeInterval, FilterCondition, SessionFilterCondition, Kind]


class RecordCountCache(
    TwoTierCache[Key, Result, _Section, _SubKey],
):
    def __init__(self) -> None:
        super().__init__(
            # TTL=3600 (1-hour) because time intervals are always moving forward, but
            # interval endpoints are rounded down to the hour by the UI, so anything
            # older than an hour most likely won't be a cache-hit anyway.
            main_cache=TTLCache(maxsize=64, ttl=3600),
            sub_cache_factory=lambda: LFUCache(maxsize=2 * 2 * 2),
        )

    def _cache_key(self, key: Key) -> tuple[_Section, _SubKey]:
        (kind, interval, filter_condition, session_filter_condition), project_rowid = _cache_key_fn(
            key
        )
        return project_rowid, (interval, filter_condition, session_filter_condition, kind)


class RecordCountDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(
            load_fn=self._load_fn,
            cache_key_fn=_cache_key_fn,
            cache_map=cache_map,
        )
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        results: list[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: defaultdict[
            Segment,
            defaultdict[Param, list[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, param = _cache_key_fn(key)
            arguments[segment][param].append(position)
        async with self._db() as session:
            for segment, params in arguments.items():
                stmt = _get_stmt(segment, *params.keys())
                data = await session.stream(stmt)
                async for project_rowid, count in data:
                    for position in params[project_rowid]:
                        results[position] = count
        return results


def _get_stmt(
    segment: Segment,
    *project_rowids: Param,
) -> Select[Any]:
    kind, (start_time, end_time), filter_condition, session_filter_condition = segment
    pid = models.Trace.project_rowid
    stmt = select(pid)
    if kind == "span":
        time_column = models.Span.start_time
        stmt = stmt.join(models.Span)
        if filter_condition:
            sf = SpanFilter(filter_condition)
            stmt = sf(stmt)
        stmt = stmt.add_columns(func.count().label("count"))
    elif kind == "trace":
        time_column = models.Trace.start_time
        if filter_condition:
            stmt = stmt.join(models.Span, models.Trace.id == models.Span.trace_rowid)
            stmt = stmt.add_columns(func.count(distinct(models.Trace.id)).label("count"))
            sf = SpanFilter(filter_condition)
            stmt = sf(stmt)
        else:
            stmt = stmt.add_columns(func.count().label("count"))
    else:
        assert_never(kind)
    stmt = stmt.where(pid.in_(project_rowids))

    if session_filter_condition:
        filtered_session_rowids = get_filtered_session_rowids_subquery(
            session_filter_condition=session_filter_condition,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
        )
        stmt = stmt.where(models.Trace.project_session_rowid.in_(filtered_session_rowids))
    stmt = stmt.group_by(pid)
    if start_time:
        stmt = stmt.where(start_time <= time_column)
    if end_time:
        stmt = stmt.where(time_column < end_time)
    return stmt
