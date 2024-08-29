from abc import ABC, abstractmethod
from asyncio import Task, create_task, sleep
from collections import defaultdict
from datetime import datetime, timezone
from typing import (
    Any,
    AsyncContextManager,
    Callable,
    DefaultDict,
    Generic,
    Iterator,
    List,
    Optional,
    Protocol,
    Type,
    TypeVar,
)

from cachetools import LRUCache
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect


class CanSetLastUpdatedAt(Protocol):
    def set(self, table: Type[models.Base], id_: int) -> None: ...


class CanGetLastUpdatedAt(Protocol):
    def get(self, table: Type[models.Base], id_: Optional[int] = None) -> Optional[datetime]: ...


class DbSessionFactory:
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        dialect: str,
    ):
        self._db = db
        self.dialect = SupportedSQLDialect(dialect)

    def __call__(self) -> AsyncContextManager[AsyncSession]:
        return self._db()


_AnyT = TypeVar("_AnyT")
_ItemT_contra = TypeVar("_ItemT_contra", contravariant=True)


class CanPutItem(Protocol[_ItemT_contra]):
    def put(self, item: _ItemT_contra) -> None: ...


class _Batch(CanPutItem[_AnyT], Protocol[_AnyT]):
    @property
    def empty(self) -> bool: ...
    def clear(self) -> None: ...
    def __iter__(self) -> Iterator[_AnyT]: ...


class _HasBatch(Generic[_ItemT_contra], ABC):
    _batch_factory: Callable[[], _Batch[_ItemT_contra]]

    def __init__(self) -> None:
        self._batch = self._batch_factory()

    def put(self, item: _ItemT_contra) -> None:
        self._batch.put(item)


class DaemonTask(ABC):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._running = False
        self._tasks: List[Task[None]] = []

    async def start(self) -> None:
        self._running = True
        if not self._tasks:
            self._tasks.append(create_task(self._run()))

    async def stop(self) -> None:
        self._running = False
        for task in reversed(self._tasks):
            if not task.done():
                task.cancel()
        self._tasks.clear()

    @abstractmethod
    async def _run(self) -> None: ...


class BatchedCaller(DaemonTask, _HasBatch[_AnyT], Generic[_AnyT], ABC):
    def __init__(self, *, sleep_seconds: float = 0.1, **kwargs: Any) -> None:
        assert sleep_seconds > 0
        super().__init__(**kwargs)
        self._seconds = sleep_seconds

    @abstractmethod
    async def __call__(self) -> None: ...

    async def _run(self) -> None:
        while self._running:
            self._tasks.append(create_task(sleep(self._seconds)))
            await self._tasks[-1]
            self._tasks.pop()
            if self._batch.empty:
                continue
            self._tasks.append(create_task(self()))
            await self._tasks[-1]
            self._tasks.pop()
            self._batch.clear()


class LastUpdatedAt:
    def __init__(self) -> None:
        self._cache: DefaultDict[
            Type[models.Base],
            LRUCache[int, datetime],
        ] = defaultdict(lambda: LRUCache(maxsize=100))

    def get(self, table: Type[models.Base], id_: Optional[int] = None) -> Optional[datetime]:
        if not (cache := self._cache.get(table)):
            return None
        if id_ is None:
            return max(filter(bool, cache.values()), default=None)
        return cache.get(id_)

    def set(self, table: Type[models.Base], id_: int) -> None:
        self._cache[table][id_] = datetime.now(timezone.utc)
