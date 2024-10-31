from collections import defaultdict
from typing import Optional

import numpy as np
from aioitertools.itertools import groupby
from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SessionId: TypeAlias = int
Probability: TypeAlias = float
QuantileValue: TypeAlias = float

Key: TypeAlias = tuple[SessionId, Probability]
Result: TypeAlias = Optional[QuantileValue]
ResultPosition: TypeAlias = int

DEFAULT_VALUE: Result = None


class SessionTraceLatencyMsQuantileDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        results: list[Result] = [DEFAULT_VALUE] * len(keys)
        argument_position_map: defaultdict[
            SessionId, defaultdict[Probability, list[ResultPosition]]
        ] = defaultdict(lambda: defaultdict(list))
        session_rowids = {session_id for session_id, _ in keys}
        for position, (session_id, probability) in enumerate(keys):
            argument_position_map[session_id][probability].append(position)
        stmt = (
            select(
                models.Trace.project_session_rowid,
                models.Trace.latency_ms,
            )
            .where(models.Trace.project_session_rowid.in_(session_rowids))
            .order_by(models.Trace.project_session_rowid)
        )
        async with self._db() as session:
            data = await session.stream(stmt)
            async for project_session_rowid, group in groupby(
                data, lambda row: row.project_session_rowid
            ):
                session_latencies = [row.latency_ms for row in group]
                for probability, positions in argument_position_map[project_session_rowid].items():
                    quantile_value = np.quantile(session_latencies, probability)
                    for position in positions:
                        results[position] = quantile_value
        return results
