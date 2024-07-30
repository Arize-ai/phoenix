from datetime import datetime
from typing import Any, List, Mapping, NamedTuple, Optional, Tuple

from sqlalchemy import Row, Select, and_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import dedup
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
_AnnoRowId: TypeAlias = int

_Key: TypeAlias = Tuple[_Name, _SpanId]
_UniqueBy: TypeAlias = Tuple[_Name, _SpanRowId]
_Existing: TypeAlias = Tuple[
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
    ],
    table=models.SpanAnnotation,
    unique_by=("name", "span_rowid"),
):
    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[Precursors.SpanAnnotation],
    ) -> Tuple[
        List[Received[Insertables.SpanAnnotation]],
        List[Postponed[Precursors.SpanAnnotation]],
        List[Received[Precursors.SpanAnnotation]],
    ]:
        to_insert: List[Received[Insertables.SpanAnnotation]] = []
        to_postpone: List[Postponed[Precursors.SpanAnnotation]] = []
        to_discard: List[Received[Precursors.SpanAnnotation]] = []

        stmt = self._select_existing(*map(_key, parcels))
        existing: List[Row[_Existing]] = [_ async for _ in await session.stream(stmt)]
        existing_spans: Mapping[str, _SpanAttr] = {
            e.span_id: _SpanAttr(e.span_rowid) for e in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            (e.name, e.span_id): _AnnoAttr(e.span_rowid, e.id, e.updated_at)
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
                to_insert.append(
                    Received(
                        received_at=p.received_at,
                        item=p.item.as_insertable(
                            span_rowid=span.span_rowid,
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
        to_insert = dedup(sorted(to_insert, key=_time, reverse=True), _unique_by)[::-1]
        return to_insert, to_postpone, to_discard

    def _select_existing(self, *keys: _Key) -> Select[_Existing]:
        anno = self.table
        span = (
            select(models.Span.id, models.Span.span_id)
            .where(models.Span.span_id.in_({span_id for _, span_id in keys}))
            .cte()
        )
        onclause = and_(
            span.c.id == anno.span_rowid,
            anno.name.in_({name for name, _ in keys}),
            tuple_(anno.name, span.c.span_id).in_(keys),
        )
        return select(
            span.c.id.label("span_rowid"),
            span.c.span_id,
            anno.id,
            anno.name,
            anno.updated_at,
        ).outerjoin_from(span, anno, onclause)


class _SpanAttr(NamedTuple):
    span_rowid: _SpanRowId


class _AnnoAttr(NamedTuple):
    span_rowid: _SpanRowId
    id_: _AnnoRowId
    updated_at: datetime


def _key(p: Received[Precursors.SpanAnnotation]) -> _Key:
    return p.item.obj.name, p.item.span_id


def _unique_by(p: Received[Insertables.SpanAnnotation]) -> _UniqueBy:
    return p.item.obj.name, p.item.span_rowid


def _time(p: Received[Any]) -> datetime:
    return p.received_at
