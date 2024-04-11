from collections import defaultdict
from datetime import datetime
from typing import (
    Any,
    AsyncContextManager,
    Callable,
    DefaultDict,
    List,
    Optional,
    Tuple,
)

from ddsketch.ddsketch import DDSketch
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.input_types.TimeRange import TimeRange

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
            for segment, probabilities in arguments.items():
                stmt = (
                    select(models.Trace.latency_ms)
                    .join(models.Project)
                    .where(_get_filter_condition(segment))
                )
                sketch = sketches[segment]
                async for val in await session.stream_scalars(stmt):
                    sketch.add(val)
                for i, p in probabilities:
                    results[i] = sketch.get_quantile_value(p)
        return results


def _get_filter_condition(segment: Segment) -> OrmExpression:
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
