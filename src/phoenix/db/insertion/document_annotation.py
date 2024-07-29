from datetime import datetime
from typing import Any, List, Mapping, NamedTuple, Tuple

from sqlalchemy import Select, and_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, dedup, num_docs_col
from phoenix.db.insertion.types import (
    Insertables,
    Postponed,
    Precursors,
    QueueInserter,
    Received,
)

_Name: TypeAlias = str
_SpanId: TypeAlias = str
_SpanRowId: TypeAlias = int
_DocumentPosition: TypeAlias = int

_Key: TypeAlias = Tuple[_Name, _SpanId, _DocumentPosition]
_UniqueBy: TypeAlias = Tuple[_Name, _SpanRowId, _DocumentPosition]


class DocumentAnnotationQueueInserter(
    QueueInserter[
        Precursors.DocumentAnnotation,
        Insertables.DocumentAnnotation,
        models.DocumentAnnotation,
    ],
    table=models.DocumentAnnotation,
    unique_by=("name", "span_rowid", "document_position"),
):
    @staticmethod
    async def _partition(
        session: AsyncSession,
        retry_allowance: int,
        *parcels: Received[Precursors.DocumentAnnotation],
    ) -> Tuple[
        List[Received[Insertables.DocumentAnnotation]],
        List[Postponed[Precursors.DocumentAnnotation]],
        List[Received[Precursors.DocumentAnnotation]],
    ]:
        to_insert: List[Received[Insertables.DocumentAnnotation]] = []
        to_postpone: List[Postponed[Precursors.DocumentAnnotation]] = []
        to_discard: List[Received[Precursors.DocumentAnnotation]] = []

        dialect = SupportedSQLDialect(session.bind.dialect.name)
        stmt = _select_existing(dialect, *map(_key, parcels))
        existing = [_ async for _ in await session.stream(stmt)]
        existing_spans: Mapping[str, _SpanAttr] = {
            span_id: _SpanAttr(span_rowid, num_docs)
            for span_rowid, span_id, num_docs, *_ in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            (name, span_id, document_position): _AnnoAttr(span_rowid, id_, updated_at)
            for span_rowid, span_id, _, id_, name, document_position, updated_at in existing
            if id_ is not None
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
                if p.item.document_position < span.num_docs:
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
                to_postpone.append(p.postpone(retry_allowance))
            else:
                to_discard.append(p)

        assert len(to_insert) + len(to_postpone) + len(to_discard) == len(parcels)
        to_insert = dedup(sorted(to_insert, key=_time, reverse=True), _unique_by)[::-1]
        return to_insert, to_postpone, to_discard


_AnnoRowId: TypeAlias = int
_NumDocs: TypeAlias = int


def _select_existing(
    dialect: SupportedSQLDialect,
    *identifiers: Tuple[_Name, _SpanId, _NumDocs],
) -> Select[Tuple[_SpanRowId, _SpanId, _NumDocs, _AnnoRowId, _Name, _DocumentPosition, datetime]]:
    existing = (
        select(
            models.Span.id,
            models.Span.span_id,
            num_docs_col(dialect),
        )
        .where(models.Span.span_id.in_({span_id for _, span_id, *_ in identifiers}))
        .cte()
    )
    table = models.DocumentAnnotation
    return select(
        existing.c.id,
        existing.c.span_id,
        existing.c.num_docs,
        table.id,
        table.name,
        table.document_position,
        table.updated_at,
    ).outerjoin_from(
        existing,
        table,
        and_(
            existing.c.id == table.span_rowid,
            table.name.in_({name for name, *_ in identifiers}),
            tuple_(table.name, existing.c.span_id, table.document_position).in_(
                (name, span_id, document_position)
                for name, span_id, document_position in identifiers
            ),
        ),
    )


class _SpanAttr(NamedTuple):
    span_rowid: _SpanRowId
    num_docs: _NumDocs


class _AnnoAttr(NamedTuple):
    span_rowid: _SpanRowId
    id_: _AnnoRowId
    updated_at: datetime


def _key(p: Received[Precursors.DocumentAnnotation]) -> _Key:
    return p.item.obj.name, p.item.span_id, p.item.document_position


def _unique_by(p: Received[Insertables.DocumentAnnotation]) -> _UniqueBy:
    return p.item.obj.name, p.item.span_rowid, p.item.document_position


def _time(p: Received[Any]) -> datetime:
    return p.received_at
