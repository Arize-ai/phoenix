from collections import defaultdict
from datetime import datetime
from itertools import groupby
from operator import itemgetter
from typing import (
    Any,
    AsyncContextManager,
    Callable,
    DefaultDict,
    Dict,
    Iterable,
    Iterator,
    List,
    Optional,
    Tuple,
)

from ddsketch.ddsketch import DDSketch
from phoenix.db import models
from phoenix.server.api.input_types.TimeRange import TimeRange
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
TimeInterval: TypeAlias = Tuple[Optional[datetime], Optional[datetime]]
Segment: TypeAlias = Tuple[ProjectName, TimeInterval]
Probability: TypeAlias = float
Key: TypeAlias = Tuple[ProjectName, Optional[TimeRange], Probability]
ResultPosition: TypeAlias = int
QuantileValue: TypeAlias = float
OrmExpression: TypeAlias = Any


class LatencyMsQuantileDataLoader(DataLoader[Key, Optional[QuantileValue]]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn, cache_key_fn=self._cache_key_fn)
        self._db = db

    @staticmethod
    def _cache_key_fn(key: Key) -> Tuple[Segment, Probability]:
        if isinstance(key[1], TimeRange):
            return (key[0], (key[1].start, key[1].end)), key[2]
        return (key[0], (None, None)), key[2]

    async def _load_fn(self, keys: List[Key]) -> List[Optional[QuantileValue]]:
        # We use ddsketch here because sqlite doesn't have percentile functions
        # unless we compile it with the percentile.c extension, like how it's
        # done in the Python package https://github.com/nalgeon/sqlean.py
        results: List[Optional[QuantileValue]] = [None] * len(keys)
        arguments: DefaultDict[
            Segment,
            List[Tuple[ResultPosition, Probability]],
        ] = defaultdict(list)
        sketches: DefaultDict[Segment, DDSketch] = defaultdict(DDSketch)
        for i, key in enumerate(keys):
            segment, probability = self._cache_key_fn(key)
            arguments[segment].append((i, probability))
        async with self._db() as session:
            for time_range_by_name, filter_condition in _get_filter_conditons(arguments.keys()):
                stmt = (
                    select(models.Project.name, models.Trace.latency_ms)
                    .join(models.Project)
                    .where(filter_condition)
                    .order_by(models.Project.name)
                )
                prev_project_name = None
                async for project_name, val in await session.stream(stmt):
                    if project_name != prev_project_name:
                        segment = (project_name, time_range_by_name[project_name])
                        sketch = sketches[segment]
                        prev_project_name = project_name
                    sketch.add(val)
        for segment, probabilities in arguments.items():
            sketch = sketches[segment]
            for i, p in probabilities:
                results[i] = sketch.get_quantile_value(p)
        return results


def _get_filter_conditons(
    keys: Iterable[Segment],
) -> Iterator[Tuple[Dict[ProjectName, TimeInterval], OrmExpression]]:
    """
    The purpose of this function is to group together filters that can be
    combined. For example, suppose we the following 5 filters:
        1. a & (1 <= t < 3)
        2. a & (2 <= t < 4)
        3. b & (1 <= t < 4)
        4. c & (2 <= t < 5)
        5. c & (1 <= t < 6)
    We can reduce them to 2 filters as follows:
        1. a & (1 <= t < 3) | b & (1 <= t < 4) | c & (2 <= t < 5)
        2. a & (2 <= t < 4) | c & (1 <= t < 6)
    """
    segments: DefaultDict[int, List[Segment]] = defaultdict(list)
    expressions: DefaultDict[int, List[OrmExpression]] = defaultdict(list)
    for _, group in groupby(sorted(keys, key=itemgetter(0)), key=itemgetter(0)):
        for i, segment in enumerate(group):
            expressions[i].append(_get_expr(segment))
            segments[i].append(segment)
    for i, conditions in expressions.items():
        yield dict(segments[i]), or_(*conditions)


def _get_expr(segment: Segment) -> OrmExpression:
    name, (start_time, stop_time) = segment
    if start_time and stop_time:
        return and_(
            models.Project.name == name,
            start_time <= models.Trace.start_time,
            models.Trace.start_time < stop_time,
        )
    if start_time:
        return and_(
            models.Project.name == name,
            start_time <= models.Trace.start_time,
        )
    if stop_time:
        return and_(
            models.Project.name == name,
            models.Trace.start_time < stop_time,
        )
    return models.Project.name == name
