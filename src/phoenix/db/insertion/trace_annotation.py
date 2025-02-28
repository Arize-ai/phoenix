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
from phoenix.server.dml_event import TraceAnnotationDmlEvent

_Name: TypeAlias = str
_TraceId: TypeAlias = str
_TraceRowId: TypeAlias = int
_AnnoRowId: TypeAlias = int

_Key: TypeAlias = tuple[_Name, _TraceId]
_UniqueBy: TypeAlias = tuple[_Name, _TraceRowId]
_Existing: TypeAlias = tuple[
    _TraceRowId,
    _TraceId,
    Optional[_AnnoRowId],
    Optional[_Name],
    Optional[datetime],
]


class TraceAnnotationQueueInserter(
    QueueInserter[
        Precursors.TraceAnnotation,
        Insertables.TraceAnnotation,
        models.TraceAnnotation,
        TraceAnnotationDmlEvent,
    ],
    table=models.TraceAnnotation,
    unique_by=(),
):
    async def _events(
        self,
        session: AsyncSession,
        *insertions: Insertables.TraceAnnotation,
    ) -> list[TraceAnnotationDmlEvent]:
        records = [dict(as_kv(ins.row)) for ins in insertions]
        stmt = insert(self.table).values(records).returning(self.table.id)
        ids = tuple([_ async for _ in await session.stream_scalars(stmt)])
        return [TraceAnnotationDmlEvent(ids)]

    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[Precursors.TraceAnnotation],
    ) -> tuple[
        list[Received[Insertables.TraceAnnotation]],
        list[Postponed[Precursors.TraceAnnotation]],
        list[Received[Precursors.TraceAnnotation]],
    ]:
        to_insert: list[Received[Insertables.TraceAnnotation]] = []
        to_postpone: list[Postponed[Precursors.TraceAnnotation]] = []
        to_discard: list[Received[Precursors.TraceAnnotation]] = []

        stmt = select(models.Trace.id, models.Trace.trace_id).where(
            models.Trace.trace_id.in_({p.item.trace_id for p in parcels})
        )
        result = await session.execute(stmt)
        traces = result.all()
        existing_traces = {row.trace_id: row.id for row in traces}

        for p in parcels:
            if p.item.trace_id in existing_traces:
                to_insert.append(
                    Received(
                        received_at=p.received_at,
                        item=p.item.as_insertable(
                            trace_rowid=existing_traces[p.item.trace_id],
                        ),
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
