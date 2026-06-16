from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from copy import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Generic, Optional, Protocol, TypeVar, cast

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.dml import Insert

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.constants import DEFAULT_RETRY_ALLOWANCE, DEFAULT_RETRY_DELAY_SEC
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)


def _ordered_ids_for_records(
    records: Sequence[Mapping[str, Any]],
    unique_by: Sequence[str],
    rows: Sequence[Sequence[Any]],
) -> tuple[int, ...]:
    id_by_key = {tuple(row)[1:]: tuple(row)[0] for row in rows}
    return tuple(id_by_key[tuple(record[key] for key in unique_by)] for record in records)


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
    table: type[_RowT]
    unique_by: Sequence[str]
    constraint_name: Optional[str] = None

    def __init_subclass__(
        cls,
        table: type[_RowT],
        unique_by: Sequence[str],
        constraint_name: Optional[str] = None,
    ) -> None:
        cls.table = table
        cls.unique_by = unique_by
        cls.constraint_name = constraint_name

    def __init__(
        self,
        db: DbSessionFactory,
        retry_delay_sec: float = DEFAULT_RETRY_DELAY_SEC,
        retry_allowance: int = DEFAULT_RETRY_ALLOWANCE,
    ) -> None:
        self._queue: list[Received[_PrecursorT]] = []
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
    ) -> tuple[
        list[Received[_InsertableT]],
        list[Postponed[_PrecursorT]],
        list[Received[_PrecursorT]],
    ]: ...

    async def insert(self) -> Optional[list[_DmlEventT]]:
        if not self._queue:
            return None
        parcels = self._queue.copy()
        # IMPORTANT: Use .clear() instead of reassignment, i.e. self._queue = [], to
        # avoid potential race conditions when appending postponed items to the queue.
        self._queue.clear()
        events: list[_DmlEventT] = []
        async with self._db() as session:
            to_insert, to_postpone, _ = await self._partition(session, *parcels)
            if to_insert:
                events, to_retry, _ = await self._insert(session, *to_insert)
                if to_retry:
                    to_postpone.extend(to_retry)
        if to_postpone:
            loop = asyncio.get_running_loop()
            loop.call_later(self._retry_delay_sec, self._add_postponed_to_queue, to_postpone)
        return events

    def _add_postponed_to_queue(self, items: list[Postponed[_PrecursorT]]) -> None:
        """Add postponed items back to the queue for retry."""
        self._queue.extend(items)

    def _insert_on_conflict(self, *records: Mapping[str, Any]) -> Insert:
        return insert_on_conflict(
            *records,
            table=self.table,
            unique_by=self.unique_by,
            constraint_name=self.constraint_name,
            dialect=self._db.dialect,
        )

    async def _insert_records_returning_ids(
        self,
        session: AsyncSession,
        *records: Mapping[str, Any],
    ) -> tuple[int, ...]:
        stmt = self._insert_on_conflict(*records)
        id_column = getattr(self.table, "id")
        if self._db.dialect is not SupportedSQLDialect.MYSQL:
            return tuple([_ async for _ in await session.stream_scalars(stmt.returning(id_column))])

        await session.execute(stmt)
        if not self.unique_by:
            raise ValueError("MySQL upserts require at least one unique key to fetch inserted IDs")

        if len(self.unique_by) == 1:
            key = self.unique_by[0]
            values = {record[key] for record in records}
            id_stmt = select(id_column, getattr(self.table, key)).where(
                getattr(self.table, key).in_(values)
            )
        else:
            columns = tuple(getattr(self.table, key) for key in self.unique_by)
            values = {tuple(record[key] for key in self.unique_by) for record in records}
            id_stmt = select(id_column, *columns).where(tuple_(*columns).in_(values))
        rows = tuple([_ async for _ in await session.stream(id_stmt)])
        return _ordered_ids_for_records(records, self.unique_by, rows)

    @abstractmethod
    async def _events(
        self,
        session: AsyncSession,
        *insertions: _InsertableT,
    ) -> list[_DmlEventT]: ...

    async def _insert(
        self,
        session: AsyncSession,
        *parcels: Received[_InsertableT],
    ) -> tuple[
        list[_DmlEventT],
        list[Postponed[_PrecursorT]],
        list[Received[_InsertableT]],
    ]:
        to_retry: list[Postponed[_PrecursorT]] = []
        failures: list[Received[_InsertableT]] = []
        events: list[_DmlEventT] = []
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
        updated_at: datetime
        span_id: str
        obj: models.SpanAnnotation

        def as_insertable(
            self,
            span_rowid: int,
        ) -> Insertables.SpanAnnotation:
            return Insertables.SpanAnnotation(
                updated_at=self.updated_at,
                span_id=self.span_id,
                obj=self.obj,
                span_rowid=span_rowid,
            )

    @dataclass(frozen=True)
    class TraceAnnotation:
        updated_at: datetime
        trace_id: str
        obj: models.TraceAnnotation

        def as_insertable(
            self,
            trace_rowid: int,
        ) -> Insertables.TraceAnnotation:
            return Insertables.TraceAnnotation(
                updated_at=self.updated_at,
                trace_id=self.trace_id,
                obj=self.obj,
                trace_rowid=trace_rowid,
            )

    @dataclass(frozen=True)
    class DocumentAnnotation:
        updated_at: datetime
        span_id: str
        document_position: int
        obj: models.DocumentAnnotation

        def as_insertable(
            self,
            span_rowid: int,
        ) -> Insertables.DocumentAnnotation:
            return Insertables.DocumentAnnotation(
                updated_at=self.updated_at,
                span_id=self.span_id,
                document_position=self.document_position,
                obj=self.obj,
                span_rowid=span_rowid,
            )

    @dataclass(frozen=True)
    class SessionAnnotation:
        updated_at: datetime
        session_id: str
        obj: models.ProjectSessionAnnotation

        def as_insertable(
            self,
            project_session_rowid: int,
        ) -> Insertables.SessionAnnotation:
            return Insertables.SessionAnnotation(
                updated_at=self.updated_at,
                session_id=self.session_id,
                obj=self.obj,
                project_session_rowid=project_session_rowid,
            )


AnnotationPrecursor = (
    Precursors.SpanAnnotation | Precursors.TraceAnnotation | Precursors.DocumentAnnotation
)


class Insertables(ABC):
    @dataclass(frozen=True)
    class SpanAnnotation(Precursors.SpanAnnotation):
        updated_at: datetime
        span_rowid: int

        @property
        def row(self) -> models.SpanAnnotation:
            obj = copy(self.obj)
            obj.span_rowid = self.span_rowid
            obj.updated_at = self.updated_at
            return obj

    @dataclass(frozen=True)
    class TraceAnnotation(Precursors.TraceAnnotation):
        updated_at: datetime
        trace_rowid: int

        @property
        def row(self) -> models.TraceAnnotation:
            obj = copy(self.obj)
            obj.trace_rowid = self.trace_rowid
            obj.updated_at = self.updated_at
            return obj

    @dataclass(frozen=True)
    class DocumentAnnotation(Precursors.DocumentAnnotation):
        updated_at: datetime
        span_rowid: int

        @property
        def row(self) -> models.DocumentAnnotation:
            obj = copy(self.obj)
            obj.span_rowid = self.span_rowid
            obj.updated_at = self.updated_at
            return obj

    @dataclass(frozen=True)
    class SessionAnnotation(Precursors.SessionAnnotation):
        updated_at: datetime
        project_session_rowid: int

        @property
        def row(self) -> models.ProjectSessionAnnotation:
            obj = copy(self.obj)
            obj.project_session_id = self.project_session_rowid
            obj.updated_at = self.updated_at
            return obj
