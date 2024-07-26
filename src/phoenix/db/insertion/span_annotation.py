from datetime import datetime
from itertools import chain
from typing import Iterable, List, NamedTuple, Tuple, Union, cast

from sqlalchemy import Select, and_, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import dedup
from phoenix.db.insertion.types import (
    Insertables,
    Postponed,
    Precursors,
    QueueInserter,
    Received,
)


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
        *parcels: Union[
            Received[Precursors.SpanAnnotation],
            Received[Insertables.SpanAnnotation],
        ],
    ) -> Tuple[
        List[Received[Insertables.SpanAnnotation]],
        List[
            Union[
                Postponed[Precursors.SpanAnnotation],
                Postponed[Insertables.SpanAnnotation],
            ]
        ],
        List[
            Union[
                Received[Precursors.SpanAnnotation],
                Received[Insertables.SpanAnnotation],
            ]
        ],
    ]:
        to_insert: List[Received[Insertables.SpanAnnotation]] = []
        to_postpone: List[
            Union[
                Postponed[Precursors.SpanAnnotation],
                Postponed[Insertables.SpanAnnotation],
            ]
        ] = []
        to_discard: List[
            Union[
                Received[Precursors.SpanAnnotation],
                Received[Insertables.SpanAnnotation],
            ]
        ] = []

        name_and_span_ids = {
            (item.entity.name, item.span_id)
            for item, *_ in parcels
            if isinstance(item, Precursors.SpanAnnotation)
        }
        name_and_span_rowids = {
            (item.entity.name, item.span_rowid)
            for item, *_ in parcels
            if isinstance(item, Insertables.SpanAnnotation)
        }

        stmt = existing_spans_and_span_annotations_stmt(name_and_span_ids, name_and_span_rowids)
        existing_spans_and_annotations = [_ async for _ in await session.stream(stmt)]
        existing_spans = {
            span_id: _SpanAttr(span_rowid)
            for span_rowid, span_id, *_ in existing_spans_and_annotations
        }
        existing_annotations_by_name_and_span_id = {
            (name, span_id): _AnnoAttr(span_rowid, id_, updated_at)
            for span_rowid, span_id, id_, name, updated_at in existing_spans_and_annotations
            if id_ is not None
        }
        existing_annotations_by_name_and_span_rowid = {
            (name, span_rowid): _AnnoAttr(span_rowid, id_, updated_at)
            for span_rowid, span_id, id_, name, updated_at in existing_spans_and_annotations
            if id_ is not None
        }

        for p in parcels:
            if (
                isinstance(p.item, models.SpanAnnotation)
                and (
                    existing_annotations_by_name_and_span_rowid.get(
                        (p.item.name, p.item.span_rowid)
                    )
                )
                is not None
            ):
                to_insert.append(cast(Received[Insertables.SpanAnnotation], p))
            elif (
                isinstance(p.item, Precursors.SpanAnnotation)
                and (
                    existing_anno := existing_annotations_by_name_and_span_id.get(
                        (p.item.entity.name, p.item.span_id)
                    )
                )
                is not None
            ):
                if p.received_at <= existing_anno.updated_at:
                    to_discard.append(p)
                else:
                    to_insert.append(
                        Received(
                            received_at=p.received_at,
                            item=p.item.as_insertable(
                                span_rowid=existing_anno.span_rowid,
                                id_=existing_anno.id_,
                            ),
                        )
                    )
            elif (
                isinstance(p.item, Precursors.SpanAnnotation)
                and (existing_span := existing_spans.get(p.item.span_id)) is not None
            ):
                to_insert.append(
                    Received(
                        received_at=p.received_at,
                        item=p.item.as_insertable(
                            span_rowid=existing_span.span_rowid,
                        ),
                    )
                )
            elif isinstance(p.item, (Precursors.SpanAnnotation, models.SpanAnnotation)):
                if isinstance(p, Postponed):
                    if p.retries_left > 1:
                        to_postpone.append(p.postpone(p.retries_left - 1))
                    else:
                        to_discard.append(p)
                elif isinstance(p, Received):
                    to_postpone.append(p.postpone(retry_allowance))
                else:
                    to_discard.append(p)
            else:
                to_discard.append(p)

        assert len(to_insert) + len(to_postpone) + len(to_discard) == len(parcels)

        if to_insert:
            to_insert = dedup(
                sorted(to_insert, key=lambda p: p.received_at, reverse=True),
                lambda p: (p.item.entity.name, p.item.span_rowid),
            )[::-1]

        return to_insert, to_postpone, to_discard


def existing_spans_and_span_annotations_stmt(
    name_and_span_id: Iterable[Tuple[str, str]] = (),
    name_and_span_rowid: Iterable[Tuple[str, int]] = (),
) -> Select[Tuple[int, str, int, str, datetime]]:
    name_and_span_id = list(name_and_span_id)
    name_and_span_rowid = list(name_and_span_rowid)
    existing = (
        select(models.Span.id, models.Span.span_id)
        .where(
            or_(
                models.Span.span_id.in_({span_id for _, span_id in name_and_span_id}),
                models.Span.id.in_({span_rowid for _, span_rowid in name_and_span_rowid}),
            )
        )
        .cte()
    )
    table = models.SpanAnnotation
    return select(
        existing.c.id,
        existing.c.span_id,
        table.id,
        table.name,
        table.updated_at,
    ).outerjoin_from(
        existing,
        table,
        and_(
            existing.c.id == table.span_rowid,
            table.name.in_({name for name, _ in chain(name_and_span_id, name_and_span_rowid)}),
            or_(
                tuple_(table.name, existing.c.span_id).in_(
                    (name, span_id) for name, span_id in name_and_span_id
                ),
                tuple_(table.name, existing.c.id).in_(
                    (name, span_rowid) for name, span_rowid in name_and_span_rowid
                ),
            ),
        ),
    )


class _SpanAttr(NamedTuple):
    span_rowid: int


class _AnnoAttr(NamedTuple):
    span_rowid: int
    id_: int
    updated_at: datetime
