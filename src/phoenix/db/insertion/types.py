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
from sqlalchemy.sql.dml import Insert

from phoenix.db import models
from phoenix.db.insertion.constants import DEFAULT_RETRY_ALLOWANCE, DEFAULT_RETRY_DELAY_SEC
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger("__name__")


class Insertable(Protocol):
    @property
    def row(self) -> models.Base: ...


_AnyT = TypeVar("_AnyT")
_PrecursorT = TypeVar("_PrecursorT")
_InsertableT = TypeVar("_InsertableT", bound=Insertable)
_RowT = TypeVar("_RowT", bound=models.Base)
_DmlEventT = TypeVar("_DmlEventT", bound=DmlEvent)


@dataclass(frozen=True)
class Received(Generic[_AnyT]):
    item: _AnyT
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def postpone(self, retries_left: int = DEFAULT_RETRY_ALLOWANCE) -> Postponed[_AnyT]:
        return Postponed(item=self.item, received_at=self.received_at, retries_left=retries_left)


@dataclass(frozen=True)
class Postponed(Received[_AnyT]):
    retries_left: int = field(default=DEFAULT_RETRY_ALLOWANCE)


class QueueInserter(ABC, Generic[_PrecursorT, _InsertableT, _RowT, _DmlEventT]):
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

    async def insert(self) -> Optional[List[_DmlEventT]]:
        if not self._queue:
            return None
        self._queue, parcels = [], self._queue
        events: List[_DmlEventT] = []
        async with self._db() as session:
            to_insert, to_postpone, _ = await self._partition(session, *parcels)
            if to_insert:
                events, to_retry, _ = await self._insert(session, *to_insert)
                if to_retry:
                    to_postpone.extend(to_retry)
        if to_postpone:
            loop = asyncio.get_running_loop()
            loop.call_later(self._retry_delay_sec, self._queue.extend, to_postpone)
        return events

    def _insert_on_conflict(self, *records: Mapping[str, Any]) -> Insert:
        return insert_on_conflict(
            *records,
            table=self.table,
            unique_by=self.unique_by,
            dialect=self._db.dialect,
        )

    @abstractmethod
    async def _events(
        self,
        session: AsyncSession,
        *insertions: _InsertableT,
    ) -> List[_DmlEventT]: ...

    async def _insert(
        self,
        session: AsyncSession,
        *parcels: Received[_InsertableT],
    ) -> Tuple[
        List[_DmlEventT],
        List[Postponed[_PrecursorT]],
        List[Received[_InsertableT]],
    ]:
        to_retry: List[Postponed[_PrecursorT]] = []
        failures: List[Received[_InsertableT]] = []
        events: List[_DmlEventT] = []
        try:
            async with session.begin_nested():
                events.extend(await self._events(session, *(p.item for p in parcels)))
        except BaseException:
            logger.exception(
                f"Failed to bulk insert for {self.table.__name__}. "
                f"Will try to insert ({len(parcels)} records) individually instead."
            )
            for p in parcels:
                try:
                    async with session.begin_nested():
                        events.extend(await self._events(session, p.item))
                except BaseException:
                    logger.exception(f"Failed to insert for {self.table.__name__}.")
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
        return events, to_retry, failures


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
