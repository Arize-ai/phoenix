from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanFilter


@dataclass
class TokenCost:
    prompt: Optional[float] = None
    completion: Optional[float] = None
    total: Optional[float] = None


ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]

Segment: TypeAlias = tuple[TimeInterval, FilterCondition]
Param: TypeAlias = ProjectRowId

Key: TypeAlias = tuple[ProjectRowId, Optional[TimeRange], FilterCondition]
Result: TypeAlias = TokenCost
ResultPosition: TypeAlias = int
DEFAULT_VALUE: Result = TokenCost()


def _cache_key_fn(key: Key) -> tuple[Segment, Param]:
    project_rowid, time_range, filter_condition = key
    interval = (
        (time_range.start, time_range.end) if isinstance(time_range, TimeRange) else (None, None)
    )
    return (interval, filter_condition), project_rowid


_Section: TypeAlias = ProjectRowId
_SubKey: TypeAlias = tuple[TimeInterval, FilterCondition]


class TokenCostCache(
    TwoTierCache[Key, Result, _Section, _SubKey],
):
    def __init__(self) -> None:
        super().__init__(
            # TTL=3600 (1-hour) because time intervals are always moving forward, but
            # interval endpoints are rounded down to the hour by the UI, so anything
            # older than an hour most likely won't be a cache-hit anyway.
            main_cache=TTLCache(maxsize=64, ttl=3600),
            sub_cache_factory=lambda: LFUCache(maxsize=2 * 2 * 3),
        )

    def _cache_key(self, key: Key) -> tuple[_Section, _SubKey]:
        (interval, filter_condition), project_rowid = _cache_key_fn(key)
        return project_rowid, (interval, filter_condition)


class TokenCostDataLoader(DataLoader[Key, Result]):
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
                async for project_rowid, prompt_cost, completion_cost, total_cost in data:
                    for position in params.get(project_rowid, []):
                        results[position].prompt = prompt_cost
                        results[position].completion = completion_cost
                        results[position].total = total_cost
        return results


def _get_stmt(
    segment: Segment,
    *params: Param,
) -> Select[Any]:
    (start_time, end_time), filter_condition = segment
    pid = models.Trace.project_rowid

    prompt_cost = coalesce(func.sum(models.SpanCost.prompt_token_cost), 0)
    completion_cost = coalesce(func.sum(models.SpanCost.completion_token_cost), 0)
    total_cost = coalesce(func.sum(models.SpanCost.total_token_cost), 0)

    stmt: Select[Any] = (
        select(
            pid,
            prompt_cost.label("prompt_cost"),
            completion_cost.label("completion_cost"),
            total_cost.label("total_cost"),
        )
        .join_from(models.Trace, models.Span)
        .join(models.SpanCost, models.Span.id == models.SpanCost.span_id, isouter=True)
        .group_by(pid)
    )

    if start_time:
        stmt = stmt.where(start_time <= models.Span.start_time)
    if end_time:
        stmt = stmt.where(models.Span.start_time < end_time)

    if filter_condition:
        sf = SpanFilter(filter_condition)
        stmt = sf(stmt)

    project_ids = [rowid for rowid in params]
    stmt = stmt.where(pid.in_(project_ids))

    return stmt
