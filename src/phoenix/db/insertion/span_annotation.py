from collections.abc import Mapping
from datetime import datetime
from typing import Optional

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.insertion.helpers import as_kv
from phoenix.db.insertion.types import (
    Insertables,
    Postponed,
    Precursors,
    QueueInserter,
    Received,
)
from phoenix.server.dml_event import SpanAnnotationDmlEvent

_Name: TypeAlias = str
_SpanId: TypeAlias = str
_SpanRowId: TypeAlias = int
_AnnoRowId: TypeAlias = int

_Key: TypeAlias = tuple[_Name, _SpanId]
_UniqueBy: TypeAlias = tuple[_Name, _SpanRowId]
_Existing: TypeAlias = tuple[
    _SpanRowId,
    _SpanId,
    Optional[_AnnoRowId],
    Optional[_Name],
    Optional[datetime],
]


class SpanAnnotationQueueInserter(
    QueueInserter[
        Precursors.SpanAnnotation,
        Insertables.SpanAnnotation,
        models.SpanAnnotation,
        SpanAnnotationDmlEvent,
    ],
    table=models.SpanAnnotation,
    unique_by=(),
):
    async def _events(
        self,
        session: AsyncSession,
        *insertions: Insertables.SpanAnnotation,
    ) -> list[SpanAnnotationDmlEvent]:
        records = [dict(as_kv(ins.row)) for ins in insertions]
        stmt = insert(self.table).values(records).returning(self.table.id)
        ids = tuple([_ async for _ in await session.stream_scalars(stmt)])
        return [SpanAnnotationDmlEvent(ids)]

    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[Precursors.SpanAnnotation],
    ) -> tuple[
        list[Received[Insertables.SpanAnnotation]],
        list[Postponed[Precursors.SpanAnnotation]],
        list[Received[Precursors.SpanAnnotation]],
    ]:
        to_insert: list[Received[Insertables.SpanAnnotation]] = []
        to_postpone: list[Postponed[Precursors.SpanAnnotation]] = []
        to_discard: list[Received[Precursors.SpanAnnotation]] = []

        span_ids = {p.item.span_id for p in parcels}
        stmt = select(models.Span.id, models.Span.span_id).where(models.Span.span_id.in_(span_ids))
        result = await session.execute(stmt)
        spans = result.all()
        existing_spans: Mapping[str, int] = {row.span_id: row.id for row in spans}

        for p in parcels:
            if p.item.span_id in existing_spans:
                to_insert.append(
                    Received(
                        received_at=p.received_at,
                        item=p.item.as_insertable(span_rowid=existing_spans[p.item.span_id]),
                    )
                )
            elif isinstance(p, Postponed):
                if p.retries_left > 1:
                    to_postpone.append(p.postpone(p.retries_left - 1))
                else:
                    to_discard.append(p)
            elif isinstance(p, Received):
                to_postpone.append(p.postpone(self._retry_allowance))
            else:
                to_discard.append(p)

        assert len(to_insert) + len(to_postpone) + len(to_discard) == len(parcels)
        return to_insert, to_postpone, to_discard
