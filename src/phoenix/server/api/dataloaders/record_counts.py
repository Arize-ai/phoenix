from collections import defaultdict
from datetime import datetime
from typing import Any, Literal, Optional

from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, distinct, func, literal, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.session_filters import apply_session_io_filter
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanFilter

Kind: TypeAlias = Literal["span", "trace"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
SessionFilterCondition: TypeAlias = Optional[str]
SpanCount: TypeAlias = int

Segment: TypeAlias = tuple[
    Kind, TimeInterval, FilterCondition, SessionFilterCondition, Optional[ProjectRowId]
]
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
    # Include project_rowid in segment when session_filter is present to prevent
    # cross-project batching
    segment_project_id = project_rowid if session_filter_condition else None
    return (
        kind,
        interval,
        filter_condition,
        session_filter_condition,
        segment_project_id,
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
        (kind, interval, filter_condition, session_filter, _), project_rowid = _cache_key_fn(key)
        return project_rowid, (interval, filter_condition, session_filter, kind)


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
    kind, (start_time, end_time), filter_condition, session_filter, segment_project_id = segment
    pid = models.Trace.project_rowid
    stmt = select(pid)
    if kind == "span":
        time_column = models.Span.start_time
        stmt = stmt.join(models.Span)
        if filter_condition:
            sf = SpanFilter(filter_condition)
            stmt = sf(stmt)
    elif kind == "trace":
        time_column = models.Trace.start_time
        if filter_condition:
            # For trace count with span filter: count distinct traces
            # containing spans matching filter
            sf = SpanFilter(filter_condition)
            stmt = sf(stmt.join(models.Span))
            # Use distinct count of trace IDs to avoid counting multiple spans per trace
            stmt = stmt.add_columns(func.count(distinct(models.Trace.id)).label("count"))
        else:
            stmt = stmt.add_columns(func.count().label("count"))
    else:
        assert_never(kind)

    # For span counts, add the count column (if not already added above)
    if kind == "span":
        stmt = stmt.add_columns(func.count().label("count"))
    stmt = stmt.where(pid.in_(project_rowids))
    if session_filter:
        if not project_rowids:
            return select(pid, literal(0).label("count")).where(literal(False))
        # When session_filter is present, segment_project_id contains the correct project ID
        project_id_for_session = (
            segment_project_id if segment_project_id is not None else next(iter(project_rowids))
        )
        stmt = apply_session_io_filter(
            stmt, session_filter, project_id_for_session, start_time, end_time
        )
    stmt = stmt.group_by(pid)
    if start_time:
        stmt = stmt.where(start_time <= time_column)
    if end_time:
        stmt = stmt.where(time_column < end_time)
    return stmt
