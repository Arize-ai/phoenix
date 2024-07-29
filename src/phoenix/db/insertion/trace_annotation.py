from datetime import datetime
from typing import Any, List, Mapping, NamedTuple, Tuple

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

_Name: TypeAlias = str
_TraceId: TypeAlias = str
_TraceRowId: TypeAlias = int

_Key: TypeAlias = Tuple[_Name, _TraceId]
_UniqueBy: TypeAlias = Tuple[_Name, _TraceRowId]


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
        *parcels: Received[Precursors.TraceAnnotation],
    ) -> Tuple[
        List[Received[Insertables.TraceAnnotation]],
        List[Postponed[Precursors.TraceAnnotation]],
        List[Received[Precursors.TraceAnnotation]],
    ]:
        to_insert: List[Received[Insertables.TraceAnnotation]] = []
        to_postpone: List[Postponed[Precursors.TraceAnnotation]] = []
        to_discard: List[Received[Precursors.TraceAnnotation]] = []

        stmt = _select_existing(*map(_key, parcels))
        existing = [_ async for _ in await session.stream(stmt)]
        existing_traces: Mapping[str, _TraceAttr] = {
            trace_id: _TraceAttr(trace_rowid) for trace_rowid, trace_id, *_ in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            (name, trace_id): _AnnoAttr(trace_rowid, id_, updated_at)
            for trace_rowid, trace_id, id_, name, updated_at in existing
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
                                trace_rowid=anno.trace_rowid,
                                id_=anno.id_,
                            ),
                        )
                    )
            elif (trace := existing_traces.get(p.item.trace_id)) is not None:
                to_insert.append(
                    Received(
                        received_at=p.received_at,
                        item=p.item.as_insertable(
                            trace_rowid=trace.trace_rowid,
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


_AnnoRowId: TypeAlias = int


def _select_existing(
    *identifiers: Tuple[_Name, _TraceId],
) -> Select[Tuple[_TraceRowId, _TraceId, _AnnoRowId, _Name, datetime]]:
    existing_traces = (
        select(models.Trace.id, models.Trace.trace_id)
        .where(models.Trace.trace_id.in_({trace_id for _, trace_id in identifiers}))
        .cte()
    )
    table = models.TraceAnnotation
    return select(
        existing_traces.c.id,
        existing_traces.c.trace_id,
        table.id,
        table.name,
        table.updated_at,
    ).outerjoin_from(
        existing_traces,
        table,
        and_(
            existing_traces.c.id == table.trace_rowid,
            table.name.in_({name for name, _ in identifiers}),
            tuple_(table.name, existing_traces.c.trace_id).in_(identifiers),
        ),
    )


class _TraceAttr(NamedTuple):
    trace_rowid: _TraceRowId


class _AnnoAttr(NamedTuple):
    trace_rowid: _TraceRowId
    id_: _AnnoRowId
    updated_at: datetime


def _key(p: Received[Precursors.TraceAnnotation]) -> _Key:
    return p.item.obj.name, p.item.trace_id


def _unique_by(p: Received[Insertables.TraceAnnotation]) -> _UniqueBy:
    return p.item.obj.name, p.item.trace_rowid


def _time(p: Received[Any]) -> datetime:
    return p.received_at
