from collections.abc import Mapping
from datetime import datetime
from typing import NamedTuple, Optional

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import num_docs_col
from phoenix.db.insertion.helpers import as_kv
from phoenix.db.insertion.types import (
    Insertables,
    Postponed,
    Precursors,
    QueueInserter,
    Received,
)
from phoenix.server.dml_event import DocumentAnnotationDmlEvent

_Name: TypeAlias = str
_SpanId: TypeAlias = str
_SpanRowId: TypeAlias = int
_DocumentPosition: TypeAlias = int
_AnnoRowId: TypeAlias = int
_NumDocs: TypeAlias = int

_Key: TypeAlias = tuple[_Name, _SpanId, _DocumentPosition]
_UniqueBy: TypeAlias = tuple[_Name, _SpanRowId, _DocumentPosition]
_Existing: TypeAlias = tuple[
    _SpanRowId,
    _SpanId,
    _NumDocs,
    Optional[_AnnoRowId],
    Optional[_Name],
    Optional[_DocumentPosition],
    Optional[datetime],
]


class DocumentAnnotationQueueInserter(
    QueueInserter[
        Precursors.DocumentAnnotation,
        Insertables.DocumentAnnotation,
        models.DocumentAnnotation,
        DocumentAnnotationDmlEvent,
    ],
    table=models.DocumentAnnotation,
    unique_by=(),
):
    async def _events(
        self,
        session: AsyncSession,
        *insertions: Insertables.DocumentAnnotation,
    ) -> list[DocumentAnnotationDmlEvent]:
        records = [dict(as_kv(ins.row)) for ins in insertions]
        stmt = insert(self.table).values(records).returning(self.table.id)
        ids = tuple([_ async for _ in await session.stream_scalars(stmt)])
        return [DocumentAnnotationDmlEvent(ids)]

    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[Precursors.DocumentAnnotation],
    ) -> tuple[
        list[Received[Insertables.DocumentAnnotation]],
        list[Postponed[Precursors.DocumentAnnotation]],
        list[Received[Precursors.DocumentAnnotation]],
    ]:
        to_insert: list[Received[Insertables.DocumentAnnotation]] = []
        to_postpone: list[Postponed[Precursors.DocumentAnnotation]] = []
        to_discard: list[Received[Precursors.DocumentAnnotation]] = []

        span_ids = {p.item.span_id for p in parcels}
        stmt = select(models.Span.id, models.Span.span_id, num_docs_col(self._db.dialect)).where(
            models.Span.span_id.in_(span_ids)
        )
        result = await session.execute(stmt)
        spans = result.all()
        existing_spans: Mapping[str, _SpanAttr] = {
            row.span_id: _SpanAttr(row.id, row.num_docs) for row in spans
        }

        for p in parcels:
            if p.item.span_id in existing_spans:
                span = existing_spans[p.item.span_id]
                if 0 <= p.item.document_position < span.num_docs:
                    to_insert.append(
                        Received(
                            received_at=p.received_at,
                            item=p.item.as_insertable(
                                span_rowid=span.span_rowid,
                            ),
                        )
                    )
                else:
                    to_discard.append(p)
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


class _SpanAttr(NamedTuple):
    span_rowid: _SpanRowId
    num_docs: _NumDocs
