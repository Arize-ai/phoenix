from datetime import datetime
from itertools import chain
from typing import Iterable, List, NamedTuple, Tuple, Union

from sqlalchemy import Select, and_, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, dedup, num_docs_col
from phoenix.db.insertion.types import (
    Insertables,
    Postponed,
    Precursors,
    QueueInserter,
    Received,
)


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
        *parcels: Union[
            Received[Precursors.DocumentAnnotation],
            Received[Insertables.DocumentAnnotation],
        ],
    ) -> Tuple[
        List[Received[Insertables.DocumentAnnotation]],
        List[
            Union[
                Postponed[Precursors.DocumentAnnotation],
                Postponed[Insertables.DocumentAnnotation],
            ]
        ],
        List[
            Union[
                Received[Precursors.DocumentAnnotation],
                Received[Insertables.DocumentAnnotation],
            ]
        ],
    ]:
        to_insert: List[Received[Insertables.DocumentAnnotation]] = []
        to_postpone: List[
            Union[
                Postponed[Precursors.DocumentAnnotation],
                Postponed[Insertables.DocumentAnnotation],
            ]
        ] = []
        to_discard: List[
            Union[
                Received[Precursors.DocumentAnnotation],
                Received[Insertables.DocumentAnnotation],
            ]
        ] = []

        name_and_span_id_and_document_position = {
            (item.entity.name, item.span_id, item.document_position)
            for item, *_ in parcels
            if isinstance(item, Precursors.DocumentAnnotation)
        }
        name_and_span_rowid_and_document_position = {
            (item.entity.name, item.span_rowid, item.document_position)
            for item, *_ in parcels
            if isinstance(item, Insertables.DocumentAnnotation)
        }

        stmt = existing_spans_and_document_annotations_stmt(
            SupportedSQLDialect(session.bind.dialect.name),
            name_and_span_id_and_document_position,
            name_and_span_rowid_and_document_position,
        )
        existing_spans_and_document_annotations = [_ async for _ in await session.stream(stmt)]
        existing_spans = {
            span_id: _SpanAttr(span_rowid, num_docs)
            for span_rowid, span_id, num_docs, *_ in existing_spans_and_document_annotations
        }
        existing_annotations_by_name_and_span_id = {
            (name, span_id, document_position): _AnnoAttr(span_rowid, id_, updated_at)
            for span_rowid, span_id, _, id_, name, document_position, updated_at in existing_spans_and_document_annotations  # noqa: E501
            if id_ is not None
        }
        existing_annotations_by_name_and_span_rowid = {
            (name, span_rowid, document_position): _AnnoAttr(span_rowid, id_, updated_at)
            for span_rowid, span_id, _, id_, name, document_position, updated_at in existing_spans_and_document_annotations  # noqa: E501
            if id_ is not None
        }

        for p in parcels:
            if (
                isinstance(p.item, Insertables.DocumentAnnotation)
                and (
                    existing_annotations_by_name_and_span_rowid.get(
                        (p.item.entity.name, p.item.span_rowid, p.item.document_position)
                    )
                )
                is not None
            ):
                to_insert.append(p)
            elif (
                isinstance(p.item, Precursors.DocumentAnnotation)
                and (
                    existing_anno := existing_annotations_by_name_and_span_id.get(
                        (p.item.entity.name, p.item.span_id, p.item.document_position)
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
                isinstance(p.item, Precursors.DocumentAnnotation)
                and (existing_span := existing_spans.get(p.item.span_id)) is not None
            ):
                if p.item.document_position < existing_span.num_docs:
                    to_insert.append(
                        Received(
                            received_at=p.received_at,
                            item=p.item.as_insertable(
                                span_rowid=existing_span.span_rowid,
                            ),
                        )
                    )
                else:
                    to_discard.append(p)
            elif isinstance(
                p.item, (Precursors.DocumentAnnotation, Insertables.DocumentAnnotation)
            ):
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


def existing_spans_and_document_annotations_stmt(
    dialect: SupportedSQLDialect,
    name_and_span_id_and_document_position: Iterable[Tuple[str, str, int]] = (),
    name_and_span_rowid_and_document_position: Iterable[Tuple[str, int, int]] = (),
) -> Select[Tuple[int, str, int, str, int, datetime]]:
    name_and_span_id_and_document_position = list(name_and_span_id_and_document_position)
    name_and_span_rowid_and_document_position = list(name_and_span_rowid_and_document_position)
    existing = (
        select(
            models.Span.id,
            models.Span.span_id,
            num_docs_col(dialect),
        )
        .where(
            or_(
                models.Span.span_id.in_(
                    {span_id for _, span_id, *_ in name_and_span_id_and_document_position}
                ),
                models.Span.id.in_(
                    {span_rowid for _, span_rowid, *_ in name_and_span_rowid_and_document_position}
                ),
            )
        )
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
            table.name.in_(
                {
                    name
                    for name, *_ in chain(
                        name_and_span_id_and_document_position,
                        name_and_span_rowid_and_document_position,
                    )
                }
            ),
            or_(
                tuple_(table.name, existing.c.span_id, table.document_position).in_(
                    (name, span_id, document_position)
                    for name, span_id, document_position in name_and_span_id_and_document_position
                ),
                tuple_(table.name, existing.c.id, table.document_position).in_(
                    (name, span_rowid, document_position)
                    for name, span_rowid, document_position in name_and_span_rowid_and_document_position  # noqa: E501
                ),
            ),
        ),
    )


class _SpanAttr(NamedTuple):
    span_rowid: int
    num_docs: int


class _AnnoAttr(NamedTuple):
    span_rowid: int
    id_: int
    updated_at: datetime
