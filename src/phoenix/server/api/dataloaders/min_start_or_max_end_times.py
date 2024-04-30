from collections import defaultdict
from datetime import datetime
from typing import (
    AsyncContextManager,
    Callable,
    DefaultDict,
    List,
    Literal,
    Optional,
    Tuple,
)

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models

ProjectRowId: TypeAlias = int
StartOrEnd: TypeAlias = Literal["start", "end"]

Segment: TypeAlias = ProjectRowId
Param: TypeAlias = StartOrEnd

Key: TypeAlias = Tuple[ProjectRowId, StartOrEnd]
Result: TypeAlias = Optional[datetime]
ResultPosition: TypeAlias = int
DEFAULT_VALUE = None


class MinStartOrMaxEndTimeDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        results: List[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: DefaultDict[
            Segment,
            DefaultDict[Param, List[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, param = key
            arguments[segment][param].append(position)
        pid = models.Trace.project_rowid
        stmt = (
            select(
                pid,
                func.min(models.Trace.start_time).label("min_start"),
                func.max(models.Trace.end_time).label("max_end"),
            )
            .where(pid.in_(arguments.keys()))
            .group_by(pid)
        )
        async with self._db() as session:
            data = await session.stream(stmt)
            async for project_rowid, min_start, max_end in data:
                for start_or_end, positions in arguments[project_rowid].items():
                    if start_or_end == "start":
                        for position in positions:
                            results[position] = min_start
                    elif start_or_end == "end":
                        for position in positions:
                            results[position] = max_end
                    else:
                        assert_never(start_or_end)
        return results
