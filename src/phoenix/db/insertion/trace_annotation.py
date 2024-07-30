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
_TraceId: TypeAlias = str
_TraceRowId: TypeAlias = int
_AnnoRowId: TypeAlias = int

_Key: TypeAlias = Tuple[_Name, _TraceId]
_UniqueBy: TypeAlias = Tuple[_Name, _TraceRowId]
_Existing: TypeAlias = Tuple[
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
    ],
    table=models.TraceAnnotation,
    unique_by=("name", "trace_rowid"),
):
    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[Precursors.TraceAnnotation],
    ) -> Tuple[
        List[Received[Insertables.TraceAnnotation]],
        List[Postponed[Precursors.TraceAnnotation]],
        List[Received[Precursors.TraceAnnotation]],
    ]:
        to_insert: List[Received[Insertables.TraceAnnotation]] = []
        to_postpone: List[Postponed[Precursors.TraceAnnotation]] = []
        to_discard: List[Received[Precursors.TraceAnnotation]] = []

        stmt = self._select_existing(*map(_key, parcels))
        existing: List[Row[_Existing]] = [_ async for _ in await session.stream(stmt)]
        existing_traces: Mapping[str, _TraceAttr] = {
            e.trace_id: _TraceAttr(e.trace_rowid) for e in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            (e.name, e.trace_id): _AnnoAttr(e.trace_rowid, e.id, e.updated_at)
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
                to_postpone.append(p.postpone(self._retry_allowance))
            else:
                to_discard.append(p)

        assert len(to_insert) + len(to_postpone) + len(to_discard) == len(parcels)
        to_insert = dedup(sorted(to_insert, key=_time, reverse=True), _unique_by)[::-1]
        return to_insert, to_postpone, to_discard

    def _select_existing(self, *keys: _Key) -> Select[_Existing]:
        anno = self.table
        trace = (
            select(models.Trace.id, models.Trace.trace_id)
            .where(models.Trace.trace_id.in_({trace_id for _, trace_id in keys}))
            .cte()
        )
        onclause = and_(
            trace.c.id == anno.trace_rowid,
            anno.name.in_({name for name, _ in keys}),
            tuple_(anno.name, trace.c.trace_id).in_(keys),
        )
        return select(
            trace.c.id.label("trace_rowid"),
            trace.c.trace_id,
            anno.id,
            anno.name,
            anno.updated_at,
        ).outerjoin_from(trace, anno, onclause)


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
