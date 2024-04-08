from collections import defaultdict
from typing import AsyncContextManager, Callable, DefaultDict, List, Optional, Tuple

from ddsketch import ddsketch
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.api.input_types.TimeRange import TimeRange


class LatencyMsQuantile(DataLoader[Tuple[str, Optional[TimeRange], float], Optional[float]]):
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(
        self,
        keys: List[Tuple[str, Optional[TimeRange], float]],
    ) -> List[Optional[float]]:
        # We use ddsketch here because sqlite doesn't have percentile functions
        # unless we compile it with the percentile.c extension, like how it's
        # done in the Python package https://github.com/nalgeon/sqlean.py
        results: List[Optional[float]] = [None] * len(keys)
        arguments: DefaultDict[Tuple[str, Optional[TimeRange]], List[Tuple[int, float]]] = (
            defaultdict(list)
        )
        for i, key in enumerate(keys):
            name, time_range, probability = key
            arguments[(name, time_range)].append((i, probability))
        for (name, time_range), probabilities in arguments.items():
            stmt = (
                select(models.Trace.latency_ms)
                .join(models.Project)
                .where(models.Project.name == name)
            )
            if time_range:
                stmt = stmt.where(
                    and_(
                        time_range.start <= models.Trace.start_time,
                        models.Trace.start_time < time_range.end,
                    )
                )
            sketch = ddsketch.DDSketch()
            async with self._db() as session:
                async for val in await session.stream_scalars(stmt):
                    sketch.add(val)
            for i, p in probabilities:
                results[i] = sketch.get_quantile_value(p)
        return results
