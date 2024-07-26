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


class TraceAnnotationQueueInserter(
    QueueInserter[
        Precursors.TraceAnnotation,
        Insertables.TraceAnnotation,
        models.TraceAnnotation,
    ],
    table=models.TraceAnnotation,
    unique_by=("name", "trace_rowid"),
):
    @staticmethod
    async def _partition(
        session: AsyncSession,
        retry_allowance: int,
        *parcels: Union[
            Received[Precursors.TraceAnnotation],
            Received[Insertables.TraceAnnotation],
        ],
    ) -> Tuple[
        List[Received[Insertables.TraceAnnotation]],
        List[
            Union[
                Postponed[Precursors.TraceAnnotation],
                Postponed[Insertables.TraceAnnotation],
            ]
        ],
        List[
            Union[
                Received[Precursors.TraceAnnotation],
                Received[Insertables.TraceAnnotation],
            ]
        ],
    ]:
        to_insert: List[Received[Insertables.TraceAnnotation]] = []
        to_postpone: List[
            Union[
                Postponed[Precursors.TraceAnnotation],
                Postponed[Insertables.TraceAnnotation],
            ]
        ] = []
        to_discard: List[
            Union[
                Received[Precursors.TraceAnnotation],
                Received[Insertables.TraceAnnotation],
            ]
        ] = []

        name_and_trace_id = {
            (item.entity.name, item.trace_id)
            for item, *_ in parcels
            if isinstance(item, Precursors.TraceAnnotation)
        }
        name_and_trace_rowid = {
            (item.entity.name, item.trace_rowid)
            for item, *_ in parcels
            if isinstance(item, Insertables.TraceAnnotation)
        }

        stmt = existing_traces_and_trace_annotations_stmt(name_and_trace_id, name_and_trace_rowid)
        existing_traces_and_annotations = [_ async for _ in await session.stream(stmt)]
        existing_traces = {
            trace_id: _TraceAttr(trace_rowid)
            for trace_rowid, trace_id, *_ in existing_traces_and_annotations
        }
        existing_annotations_by_name_and_trace_id = {
            (name, trace_id): _AnnoAttr(trace_rowid, id_, updated_at)
            for trace_rowid, trace_id, id_, name, updated_at in existing_traces_and_annotations
            if id_ is not None
        }
        existing_annotations_by_name_and_trace_rowid = {
            (name, trace_rowid): _AnnoAttr(trace_rowid, id_, updated_at)
            for trace_rowid, trace_id, id_, name, updated_at in existing_traces_and_annotations
            if id_ is not None
        }

        for p in parcels:
            if (
                isinstance(p.item, models.TraceAnnotation)
                and (
                    existing_annotations_by_name_and_trace_rowid.get(
                        (p.item.name, p.item.trace_rowid)
                    )
                )
                is not None
            ):
                to_insert.append(cast(Received[Insertables.TraceAnnotation], p))
            elif (
                isinstance(p.item, Precursors.TraceAnnotation)
                and (
                    existing_anno := existing_annotations_by_name_and_trace_id.get(
                        (p.item.entity.name, p.item.trace_id)
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
                                trace_rowid=existing_anno.trace_rowid,
                                id_=existing_anno.id_,
                            ),
                        )
                    )
            elif (
                isinstance(p.item, Precursors.TraceAnnotation)
                and (existing_trace := existing_traces.get(p.item.trace_id)) is not None
            ):
                to_insert.append(
                    Received(
                        received_at=p.received_at,
                        item=p.item.as_insertable(
                            trace_rowid=existing_trace.trace_rowid,
                        ),
                    )
                )
            elif isinstance(p.item, (Precursors.TraceAnnotation, models.TraceAnnotation)):
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
                lambda p: (p.item.entity.name, p.item.trace_rowid),
            )[::-1]

        return to_insert, to_postpone, to_discard


def existing_traces_and_trace_annotations_stmt(
    name_and_trace_id: Iterable[Tuple[str, str]] = (),
    name_and_trace_rowid: Iterable[Tuple[str, int]] = (),
) -> Select[Tuple[int, str, int, str, datetime]]:
    name_and_trace_id = list(name_and_trace_id)
    name_and_trace_rowid = list(name_and_trace_rowid)
    existing = (
        select(models.Trace.id, models.Trace.trace_id)
        .where(
            or_(
                models.Trace.trace_id.in_({trace_id for _, trace_id in name_and_trace_id}),
                models.Trace.id.in_({trace_rowid for _, trace_rowid in name_and_trace_rowid}),
            )
        )
        .cte()
    )
    table = models.TraceAnnotation
    return select(
        existing.c.id,
        existing.c.trace_id,
        table.id,
        table.name,
        table.updated_at,
    ).outerjoin_from(
        existing,
        table,
        and_(
            existing.c.id == table.trace_rowid,
            table.name.in_({name for name, _ in chain(name_and_trace_id, name_and_trace_rowid)}),
            or_(
                tuple_(table.name, existing.c.trace_id).in_(
                    (name, trace_id) for name, trace_id in name_and_trace_id
                ),
                tuple_(table.name, existing.c.id).in_(
                    (name, trace_rowid) for name, trace_rowid in name_and_trace_rowid
                ),
            ),
        ),
    )


class _TraceAttr(NamedTuple):
    trace_rowid: int


class _AnnoAttr(NamedTuple):
    trace_rowid: int
    id_: int
    updated_at: datetime
