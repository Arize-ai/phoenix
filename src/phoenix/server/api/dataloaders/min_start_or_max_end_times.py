from collections import defaultdict
from datetime import datetime
from typing import (
    DefaultDict,
    List,
    Literal,
    Optional,
    Tuple,
)

from cachetools import LFUCache
from sqlalchemy import func, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.types import DbSessionFactory

Kind: TypeAlias = Literal["start", "end"]
ProjectRowId: TypeAlias = int

Segment: TypeAlias = ProjectRowId
Param: TypeAlias = Kind

Key: TypeAlias = Tuple[ProjectRowId, Kind]
Result: TypeAlias = Optional[datetime]
ResultPosition: TypeAlias = int
DEFAULT_VALUE: Result = None

_Section = ProjectRowId
_SubKey = Kind


class MinStartOrMaxEndTimeCache(
    TwoTierCache[Key, Result, _Section, _SubKey],
):
    def __init__(self) -> None:
        super().__init__(
            main_cache=LFUCache(maxsize=64),
            sub_cache_factory=lambda: LFUCache(maxsize=2),
        )

    def _cache_key(self, key: Key) -> Tuple[_Section, _SubKey]:
        return key


class MinStartOrMaxEndTimeDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(
            load_fn=self._load_fn,
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
                for kind, positions in arguments[project_rowid].items():
                    if kind == "start":
                        for position in positions:
                            results[position] = min_start
                    elif kind == "end":
                        for position in positions:
                            results[position] = max_end
                    else:
                        assert_never(kind)
        return results
