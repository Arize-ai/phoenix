from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from copy import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import (
    Any,
    Generic,
    List,
    Mapping,
    Optional,
    Protocol,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    cast,
)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.dml import ReturningInsert

from phoenix.db import models
from phoenix.db.insertion.constants import DEFAULT_RETRY_ALLOWANCE, DEFAULT_RETRY_DELAY_SEC
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger("__name__")


class Insertable(Protocol):
    @property
    def row(self) -> models.Base: ...


_AnyT = TypeVar("_AnyT")
_PrecursorT = TypeVar("_PrecursorT")
_InsertableT = TypeVar("_InsertableT", bound=Insertable)
_RowT = TypeVar("_RowT", bound=models.Base)


@dataclass(frozen=True)
class Received(Generic[_AnyT]):
    item: _AnyT
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
        db: DbSessionFactory,
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
        self._queue.extend([Received(item) for item in items])

    @abstractmethod
    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[_PrecursorT],
    ) -> Tuple[
        List[Received[_InsertableT]],
        List[Postponed[_PrecursorT]],
        List[Received[_PrecursorT]],
    ]: ...

    async def insert(self) -> Tuple[Type[_RowT], List[int]]:
        if not self._queue:
            return self.table, []
        parcels = self._queue
        self._queue = []
        inserted_ids: List[int] = []
        async with self._db() as session:
            to_insert, to_postpone, _ = await self._partition(session, *parcels)
            if to_insert:
                inserted_ids, to_retry, _ = await self._insert(session, *to_insert)
                to_postpone.extend(to_retry)
        if to_postpone:
            loop = asyncio.get_running_loop()
            loop.call_later(self._retry_delay_sec, self._queue.extend, to_postpone)
        return self.table, inserted_ids

    def _stmt(self, *records: Mapping[str, Any]) -> ReturningInsert[Tuple[int]]:
        pk = next(c for c in self.table.__table__.c if c.primary_key)
        return insert_on_conflict(
            *records,
            table=self.table,
            unique_by=self.unique_by,
            dialect=self._db.dialect,
        ).returning(pk)

    async def _insert(
        self,
        session: AsyncSession,
        *insertions: Received[_InsertableT],
    ) -> Tuple[List[int], List[Postponed[_PrecursorT]], List[Received[_InsertableT]]]:
        records = [dict(as_kv(ins.item.row)) for ins in insertions]
        inserted_ids: List[int] = []
        to_retry: List[Postponed[_PrecursorT]] = []
        failures: List[Received[_InsertableT]] = []
        stmt = self._stmt(*records)
        try:
            async with session.begin_nested():
                ids = [id_ async for id_ in await session.stream_scalars(stmt)]
                inserted_ids.extend(ids)
        except BaseException:
            logger.exception(
                f"Failed to bulk insert for {self.table.__name__}. "
                f"Will try to insert ({len(records)} records) individually instead."
            )
            for i, record in enumerate(records):
                stmt = self._stmt(record)
                try:
                    async with session.begin_nested():
                        ids = [id_ async for id_ in await session.stream_scalars(stmt)]
                        inserted_ids.extend(ids)
                except BaseException:
                    logger.exception(f"Failed to insert for {self.table.__name__}.")
                    p = insertions[i]
                    if isinstance(p, Postponed) and p.retries_left == 1:
                        failures.append(p)
                    else:
                        to_retry.append(
                            Postponed(
                                item=cast(_PrecursorT, p.item),
                                received_at=p.received_at,
                                retries_left=(p.retries_left - 1)
                                if isinstance(p, Postponed)
                                else self._retry_allowance,
                            )
                        )
        return inserted_ids, to_retry, failures


class Precursors(ABC):
    @dataclass(frozen=True)
    class SpanAnnotation:
        span_id: str
        obj: models.SpanAnnotation

        def as_insertable(
            self,
            span_rowid: int,
            id_: Optional[int] = None,
        ) -> Insertables.SpanAnnotation:
            return Insertables.SpanAnnotation(
                span_id=self.span_id,
                obj=self.obj,
                span_rowid=span_rowid,
                id_=id_,
            )

    @dataclass(frozen=True)
    class TraceAnnotation:
        trace_id: str
        obj: models.TraceAnnotation

        def as_insertable(
            self,
            trace_rowid: int,
            id_: Optional[int] = None,
        ) -> Insertables.TraceAnnotation:
            return Insertables.TraceAnnotation(
                trace_id=self.trace_id,
                obj=self.obj,
                trace_rowid=trace_rowid,
                id_=id_,
            )

    @dataclass(frozen=True)
    class DocumentAnnotation:
        span_id: str
        document_position: int
        obj: models.DocumentAnnotation

        def as_insertable(
            self,
            span_rowid: int,
            id_: Optional[int] = None,
        ) -> Insertables.DocumentAnnotation:
            return Insertables.DocumentAnnotation(
                span_id=self.span_id,
                document_position=self.document_position,
                obj=self.obj,
                span_rowid=span_rowid,
                id_=id_,
            )


class Insertables(ABC):
    @dataclass(frozen=True)
    class SpanAnnotation(Precursors.SpanAnnotation):
        span_rowid: int
        id_: Optional[int] = None

        @property
        def row(self) -> models.SpanAnnotation:
            obj = copy(self.obj)
            obj.span_rowid = self.span_rowid
            if self.id_ is not None:
                obj.id = self.id_
            return obj

    @dataclass(frozen=True)
    class TraceAnnotation(Precursors.TraceAnnotation):
        trace_rowid: int
        id_: Optional[int] = None

        @property
        def row(self) -> models.TraceAnnotation:
            obj = copy(self.obj)
            obj.trace_rowid = self.trace_rowid
            if self.id_ is not None:
                obj.id = self.id_
            return obj

    @dataclass(frozen=True)
    class DocumentAnnotation(Precursors.DocumentAnnotation):
        span_rowid: int
        id_: Optional[int] = None

        @property
        def row(self) -> models.DocumentAnnotation:
            obj = copy(self.obj)
            obj.span_rowid = self.span_rowid
            if self.id_ is not None:
                obj.id = self.id_
            return obj
