from datetime import datetime
from typing import Any, FrozenSet, List, Mapping, NamedTuple, Tuple

from sqlalchemy import Select, and_, select, tuple_
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

_Key: TypeAlias = Tuple[str, str]
_UniqueBy: TypeAlias = Tuple[str, int]


class SpanAnnotationQueueInserter(
    QueueInserter[
        Precursors.SpanAnnotation,
        Insertables.SpanAnnotation,
        models.SpanAnnotation,
    ],
    table=models.SpanAnnotation,
    unique_by=("name", "span_rowid"),
):
    @staticmethod
    async def _partition(
        session: AsyncSession,
        retry_allowance: int,
        *parcels: Received[Precursors.SpanAnnotation],
    ) -> Tuple[
        List[Received[Insertables.SpanAnnotation]],
        List[Postponed[Precursors.SpanAnnotation]],
        List[Received[Precursors.SpanAnnotation]],
    ]:
        to_insert: List[Received[Insertables.SpanAnnotation]] = []
        to_postpone: List[Postponed[Precursors.SpanAnnotation]] = []
        to_discard: List[Received[Precursors.SpanAnnotation]] = []

        identifiers = frozenset({_key(_) for _ in parcels})
        stmt = existing_spans_and_span_annotations_stmt(identifiers)
        existing = [_ async for _ in await session.stream(stmt)]
        existing_spans: Mapping[str, _SpanAttr] = {
            span_id: _SpanAttr(span_rowid) for span_rowid, span_id, *_ in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            (name, span_id): _AnnoAttr(span_rowid, id_, updated_at)
            for span_rowid, span_id, id_, name, updated_at in existing
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
                to_postpone.append(p.postpone(retry_allowance))
            else:
                to_discard.append(p)

        assert len(to_insert) + len(to_postpone) + len(to_discard) == len(parcels)
        to_insert = dedup(sorted(to_insert, key=_time, reverse=True), _unique_by)[::-1]
        return to_insert, to_postpone, to_discard


def existing_spans_and_span_annotations_stmt(
    identifiers: FrozenSet[Tuple[str, str]],
) -> Select[Tuple[int, str, int, str, datetime]]:
    existing_spans = (
        select(models.Span.id, models.Span.span_id)
        .where(models.Span.span_id.in_({span_id for _, span_id in identifiers}))
        .cte()
    )
    table = models.SpanAnnotation
    return select(
        existing_spans.c.id,
        existing_spans.c.span_id,
        table.id,
        table.name,
        table.updated_at,
    ).outerjoin_from(
        existing_spans,
        table,
        and_(
            existing_spans.c.id == table.span_rowid,
            table.name.in_({name for name, _ in identifiers}),
            tuple_(table.name, existing_spans.c.span_id).in_(identifiers),
        ),
    )


class _SpanAttr(NamedTuple):
    span_rowid: int


class _AnnoAttr(NamedTuple):
    span_rowid: int
    id_: int
    updated_at: datetime


def _key(_: Received[Precursors.SpanAnnotation]) -> _Key:
    return _.item.entity.name, _.item.span_id


def _unique_by(_: Received[Insertables.SpanAnnotation]) -> _UniqueBy:
    return _.item.entity.name, _.item.span_rowid


def _time(_: Received[Any]) -> datetime:
    return _.received_at
