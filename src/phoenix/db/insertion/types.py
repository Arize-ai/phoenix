from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from copy import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import (
    AsyncContextManager,
    Callable,
    Generic,
    Iterator,
    List,
    Optional,
    Protocol,
    Sequence,
    Tuple,
    Type,
    TypeVar,
)

from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.constants import DEFAULT_RETRY_ALLOWANCE, DEFAULT_RETRY_DELAY_SEC
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict

logger = logging.getLogger("__name__")


class Insertable(Protocol):
    @property
    def row(self) -> models.Base: ...


_AnyT = TypeVar("_AnyT")
_PrecursorT = TypeVar("_PrecursorT")
_InsertableT = TypeVar("_InsertableT", bound=Insertable)
_RowT = TypeVar("_RowT", bound=models.Base, covariant=True)


@dataclass(frozen=True)
class _Wrapper(Generic[_AnyT]):
    item: _AnyT

    def __iter__(self) -> Iterator[_AnyT]:
        yield self.item


@dataclass(frozen=True)
class Received(_Wrapper[_AnyT]):
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def postpone(self, retries_left: int = DEFAULT_RETRY_ALLOWANCE) -> Postponed[_AnyT]:
        return Postponed(item=self.item, received_at=self.received_at, retries_left=retries_left)


@dataclass(frozen=True)
class Postponed(Received[_AnyT]):
    retries_left: int = field(default=DEFAULT_RETRY_ALLOWANCE)


class QueueInserter(ABC, Generic[_PrecursorT, _InsertableT, _RowT]):
    table: Type[_RowT]
    unique_by: Sequence[str]

    def __init_subclass__(
        cls,
        table: Type[_RowT],
        unique_by: Sequence[str],
    ) -> None:
        cls.table = table
        cls.unique_by = unique_by

    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        retry_delay_sec: float = DEFAULT_RETRY_DELAY_SEC,
        retry_allowance: int = DEFAULT_RETRY_ALLOWANCE,
    ) -> None:
        self._queue: List[Received[_PrecursorT]] = []
        self._db = db
        self._retry_delay_sec = retry_delay_sec
        self._retry_allowance = retry_allowance

    @property
    def empty(self) -> bool:
        return not bool(self._queue)

    async def enqueue(self, *items: _PrecursorT) -> None:
        self._queue.extend([Received(_) for _ in items])

    @staticmethod
    @abstractmethod
    async def _partition(
        session: AsyncSession,
        retry_allowance: int,
        *parcels: Received[_PrecursorT],
    ) -> Tuple[
        List[Received[_InsertableT]],
        List[Postponed[_PrecursorT]],
        List[Received[_PrecursorT]],
    ]: ...

    async def insert(self) -> None:
        if not self._queue:
            return
        parcels = self._queue
        self._queue = []
        async with self._db() as session:
            to_insert, to_postpone, to_discard = await self._partition(
                session, self._retry_allowance, *parcels
            )
            if to_insert:
                to_postpone.extend(await self._insert(session, *to_insert))
        if to_postpone:
            loop = asyncio.get_running_loop()
            loop.call_later(self._retry_delay_sec, self._queue.extend, to_postpone)

    async def _insert(
        self,
        session: AsyncSession,
        *insertions: Received[_InsertableT],
    ) -> List[Postponed[_PrecursorT]]:
        records = [dict(as_kv(_.item.row)) for _ in insertions]
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        to_postpone = []
        try:
            async with session.begin_nested():
                await session.execute(
                    insert_on_conflict(
                        *records,
                        table=self.table,
                        unique_by=self.unique_by,
                        dialect=dialect,
                    )
                )
        except BaseException:
            logger.exception(
                f"Failed to bulk insert for {self.table.__name__}. "
                f"Will try to insert ({len(records)} records) individually instead."
            )
            for i, record in enumerate(records):
                try:
                    async with session.begin_nested():
                        await session.execute(
                            insert_on_conflict(
                                record,
                                table=self.table,
                                unique_by=self.unique_by,
                                dialect=dialect,
                            )
                        )
                except BaseException:
                    logger.exception(f"Failed to insert for {self.table.__name__}.")
                    if isinstance((p := insertions[i]), Postponed) and p.retries_left > 1:
                        to_postpone.append(p.postpone(p.retries_left - 1))
                    else:
                        to_postpone.append(p.postpone(self._retry_allowance))
        return to_postpone


class Precursors(ABC):
    @dataclass(frozen=True)
    class SpanAnnotation:
        span_id: str
        entity: models.SpanAnnotation

        def as_insertable(
            self,
            span_rowid: int,
            id_: Optional[int] = None,
        ) -> Insertables.SpanAnnotation:
            return Insertables.SpanAnnotation(
                span_id=self.span_id,
                entity=self.entity,
                span_rowid=span_rowid,
                id_=id_,
            )

    @dataclass(frozen=True)
    class TraceAnnotation:
        trace_id: str
        entity: models.TraceAnnotation

        def as_insertable(
            self,
            trace_rowid: int,
            id_: Optional[int] = None,
        ) -> Insertables.TraceAnnotation:
            return Insertables.TraceAnnotation(
                trace_id=self.trace_id,
                entity=self.entity,
                trace_rowid=trace_rowid,
                id_=id_,
            )

    @dataclass(frozen=True)
    class DocumentAnnotation:
        span_id: str
        document_position: int
        entity: models.DocumentAnnotation

        def as_insertable(
            self,
            span_rowid: int,
            id_: Optional[int] = None,
        ) -> Insertables.DocumentAnnotation:
            return Insertables.DocumentAnnotation(
                span_id=self.span_id,
                document_position=self.document_position,
                entity=self.entity,
                span_rowid=span_rowid,
                id_=id_,
            )


class Insertables(ABC):
    @dataclass(frozen=True)
    class SpanAnnotation(Precursors.SpanAnnotation):
        span_rowid: int
        id_: Optional[int]

        @property
        def row(self) -> models.SpanAnnotation:
            ans = copy(self.entity)
            ans.span_rowid = self.span_rowid
            if self.id_ is not None:
                ans.id = self.id_
            return ans

    @dataclass(frozen=True)
    class TraceAnnotation(Precursors.TraceAnnotation):
        trace_rowid: int
        id_: Optional[int]

        @property
        def row(self) -> models.TraceAnnotation:
            ans = copy(self.entity)
            ans.trace_rowid = self.trace_rowid
            if self.id_ is not None:
                ans.id = self.id_
            return ans

    @dataclass(frozen=True)
    class DocumentAnnotation(Precursors.DocumentAnnotation):
        span_rowid: int
        id_: Optional[int]

        @property
        def row(self) -> models.DocumentAnnotation:
            ans = copy(self.entity)
            ans.span_rowid = self.span_rowid
            if self.id_ is not None:
                ans.id = self.id_
            return ans
