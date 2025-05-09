from collections.abc import Mapping
from datetime import datetime
from typing import Any, NamedTuple, Optional

from sqlalchemy import Row, Select, and_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import dedup
from phoenix.db.insertion.helpers import as_kv
from phoenix.db.insertion.types import (
    Insertables,
    Postponed,
    Precursors,
    QueueInserter,
    Received,
)
from phoenix.server.dml_event import TraceAnnotationDmlEvent

_Name: TypeAlias = str
_TraceId: TypeAlias = str
_TraceRowId: TypeAlias = int
_AnnoRowId: TypeAlias = int
_Identifier: TypeAlias = str


class _Key(NamedTuple):
    annotation_name: _Name
    annotation_identifier: _Identifier
    trace_id: _TraceId


_UniqueBy: TypeAlias = tuple[_Name, _TraceRowId, _Identifier]
_Existing: TypeAlias = tuple[
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
        TraceAnnotationDmlEvent,
    ],
    table=models.TraceAnnotation,
    unique_by=("name", "trace_rowid", "identifier"),
):
    async def _events(
        self,
        session: AsyncSession,
        *insertions: Insertables.TraceAnnotation,
    ) -> list[TraceAnnotationDmlEvent]:
        records = [dict(as_kv(ins.row)) for ins in insertions]
        stmt = self._insert_on_conflict(*records).returning(self.table.id)
        ids = tuple([_ async for _ in await session.stream_scalars(stmt)])
        return [TraceAnnotationDmlEvent(ids)]

    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[Precursors.TraceAnnotation],
    ) -> tuple[
        list[Received[Insertables.TraceAnnotation]],
        list[Postponed[Precursors.TraceAnnotation]],
        list[Received[Precursors.TraceAnnotation]],
    ]:
        to_insert: list[Received[Insertables.TraceAnnotation]] = []
        to_postpone: list[Postponed[Precursors.TraceAnnotation]] = []
        to_discard: list[Received[Precursors.TraceAnnotation]] = []

        stmt = self._select_existing(*map(_key, parcels))
        existing: list[Row[_Existing]] = [_ async for _ in await session.stream(stmt)]
        existing_traces: Mapping[str, _TraceAttr] = {
            e.trace_id: _TraceAttr(e.trace_rowid) for e in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            _Key(
                annotation_name=e.name,
                annotation_identifier=e.identifier,
                trace_id=e.trace_id,
            ): _AnnoAttr(e.trace_rowid, e.id, e.updated_at)
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
            .where(models.Trace.trace_id.in_({k.trace_id for k in keys}))
            .cte()
        )
        onclause = and_(
            trace.c.id == anno.trace_rowid,
            anno.name.in_({k.annotation_name for k in keys}),
            tuple_(anno.name, anno.identifier, trace.c.trace_id).in_(keys),
        )
        return select(
            trace.c.id.label("trace_rowid"),
            trace.c.trace_id,
            anno.id,
            anno.name,
            anno.identifier,
            anno.updated_at,
        ).outerjoin_from(trace, anno, onclause)


class _TraceAttr(NamedTuple):
    trace_rowid: _TraceRowId


class _AnnoAttr(NamedTuple):
    trace_rowid: _TraceRowId
    id_: _AnnoRowId
    updated_at: datetime


def _key(p: Received[Precursors.TraceAnnotation]) -> _Key:
    return _Key(
        annotation_name=p.item.obj.name,
        annotation_identifier=p.item.obj.identifier,
        trace_id=p.item.trace_id,
    )


def _unique_by(p: Received[Insertables.TraceAnnotation]) -> _UniqueBy:
    return p.item.obj.name, p.item.trace_rowid, p.item.identifier


def _time(p: Received[Any]) -> datetime:
    return p.received_at
