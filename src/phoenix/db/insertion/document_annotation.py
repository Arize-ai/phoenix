from collections.abc import Mapping
from datetime import datetime
from typing import Any, NamedTuple, Optional

from sqlalchemy import Row, Select, and_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import dedup, num_docs_col
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
_Identifier: TypeAlias = str


class _Key(NamedTuple):
    annotation_name: _Name
    annotation_identifier: _Identifier
    span_id: _SpanId
    document_position: _DocumentPosition


_UniqueBy: TypeAlias = tuple[_Name, _SpanRowId, _DocumentPosition, _Identifier]
_Existing: TypeAlias = tuple[
    _SpanRowId,
    _SpanId,
    _NumDocs,
    Optional[_AnnoRowId],
    Optional[_Name],
    Optional[_DocumentPosition],
    Optional[_Identifier],
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
    unique_by=("name", "span_rowid", "document_position", "identifier"),
    constraint_name="uq_document_annotations_name_span_rowid_document_pos_identifier",
):
    async def _events(
        self,
        session: AsyncSession,
        *insertions: Insertables.DocumentAnnotation,
    ) -> list[DocumentAnnotationDmlEvent]:
        records = [dict(as_kv(ins.row)) for ins in insertions]
        stmt = self._insert_on_conflict(*records).returning(self.table.id)
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

        stmt = self._select_existing(*map(_key, parcels))
        existing: list[Row[_Existing]] = [_ async for _ in await session.stream(stmt)]
        existing_spans: Mapping[str, _SpanAttr] = {
            e.span_id: _SpanAttr(e.span_rowid, e.num_docs) for e in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            _Key(
                annotation_name=e.name,
                annotation_identifier=e.identifier,
                span_id=e.span_id,
                document_position=e.document_position,
            ): _AnnoAttr(e.span_rowid, e.id, e.updated_at)
            for e in existing
            if e.id is not None and e.name is not None and e.updated_at is not None
        }

        for p in parcels:
            if (anno := existing_annos.get(_key(p))) is not None:
                if p.received_at <= anno.updated_at:
                    to_discard.append(p)
                else:
                    to_insert.append(
                        Received(
                            received_at=p.received_at,
                            item=p.item.as_insertable(
                                span_rowid=anno.span_rowid,
                                id_=anno.id_,
                            ),
                        )
                    )
            elif (span := existing_spans.get(p.item.span_id)) is not None:
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
        to_insert = dedup(sorted(to_insert, key=_time, reverse=True), _unique_by)[::-1]
        return to_insert, to_postpone, to_discard

    def _select_existing(self, *keys: _Key) -> Select[_Existing]:
        anno = self.table
        span = (
            select(models.Span.id, models.Span.span_id, num_docs_col(self._db.dialect))
            .where(models.Span.span_id.in_({k.span_id for k in keys}))
            .cte()
        )
        onclause = and_(
            span.c.id == anno.span_rowid,
            anno.name.in_({k.annotation_name for k in keys}),
            tuple_(anno.name, anno.identifier, span.c.span_id, anno.document_position).in_(keys),
        )
        return select(
            span.c.id.label("span_rowid"),
            span.c.span_id,
            span.c.num_docs,
            anno.id,
            anno.name,
            anno.document_position,
            anno.identifier,
            anno.updated_at,
        ).outerjoin_from(span, anno, onclause)


class _SpanAttr(NamedTuple):
    span_rowid: _SpanRowId
    num_docs: _NumDocs


class _AnnoAttr(NamedTuple):
    span_rowid: _SpanRowId
    id_: _AnnoRowId
    updated_at: datetime


def _key(p: Received[Precursors.DocumentAnnotation]) -> _Key:
    return _Key(
        annotation_name=p.item.obj.name,
        annotation_identifier=p.item.obj.identifier,
        span_id=p.item.span_id,
        document_position=p.item.document_position,
    )


def _unique_by(p: Received[Insertables.DocumentAnnotation]) -> _UniqueBy:
    return p.item.obj.name, p.item.span_rowid, p.item.document_position, p.item.identifier


def _time(p: Received[Any]) -> datetime:
    return p.received_at
