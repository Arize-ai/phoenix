from collections import defaultdict
from datetime import datetime
from typing import (
    Any,
    DefaultDict,
    List,
    Literal,
    Optional,
    Tuple,
)

from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, func, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory
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
DEFAULT_VALUE: Result = 0


def _cache_key_fn(key: Key) -> Tuple[Segment, Param]:
    kind, project_rowid, time_range, filter_condition = key
    interval = (
        (time_range.start, time_range.end) if isinstance(time_range, TimeRange) else (None, None)
    )
    return (kind, interval, filter_condition), project_rowid


_Section: TypeAlias = ProjectRowId
_SubKey: TypeAlias = Tuple[TimeInterval, FilterCondition, Kind]


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

    def _cache_key(self, key: Key) -> Tuple[_Section, _SubKey]:
        (kind, interval, filter_condition), project_rowid = _cache_key_fn(key)
        return project_rowid, (interval, filter_condition, kind)


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

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        results: List[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: DefaultDict[
            Segment,
            DefaultDict[Param, List[ResultPosition]],
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
    kind, (start_time, end_time), filter_condition = segment
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
    else:
        assert_never(kind)
    stmt = stmt.add_columns(func.count().label("count"))
    stmt = stmt.where(pid.in_(project_rowids))
    stmt = stmt.group_by(pid)
    if start_time:
        stmt = stmt.where(start_time <= time_column)
    if end_time:
        stmt = stmt.where(time_column < end_time)
    return stmt
