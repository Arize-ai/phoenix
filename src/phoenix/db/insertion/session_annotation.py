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
from phoenix.server.dml_event import ProjectSessionAnnotationDmlEvent

# Type alias for consistency with other annotation patterns
SessionAnnotationDmlEvent = ProjectSessionAnnotationDmlEvent

_Name: TypeAlias = str
_SessionId: TypeAlias = str
_SessionRowId: TypeAlias = int
_AnnoRowId: TypeAlias = int
_Identifier: TypeAlias = str


class _Key(NamedTuple):
    annotation_name: _Name
    annotation_identifier: _Identifier
    session_id: _SessionId


_UniqueBy: TypeAlias = tuple[_Name, _SessionRowId, _Identifier]
_Existing: TypeAlias = tuple[
    _SessionRowId,
    _SessionId,
    Optional[_AnnoRowId],
    Optional[_Name],
    Optional[datetime],
]


class SessionAnnotationQueueInserter(
    QueueInserter[
        Precursors.SessionAnnotation,
        Insertables.SessionAnnotation,
        models.ProjectSessionAnnotation,
        SessionAnnotationDmlEvent,
    ],
    table=models.ProjectSessionAnnotation,
    unique_by=("name", "project_session_id", "identifier"),
):
    async def _events(
        self,
        session: AsyncSession,
        *insertions: Insertables.SessionAnnotation,
    ) -> list[SessionAnnotationDmlEvent]:
        records = [{**dict(as_kv(ins.row)), "updated_at": ins.row.updated_at} for ins in insertions]
        stmt = self._insert_on_conflict(*records).returning(self.table.id)
        ids = tuple([_ async for _ in await session.stream_scalars(stmt)])
        return [SessionAnnotationDmlEvent(ids)]

    async def _partition(
        self,
        session: AsyncSession,
        *parcels: Received[Precursors.SessionAnnotation],
    ) -> tuple[
        list[Received[Insertables.SessionAnnotation]],
        list[Postponed[Precursors.SessionAnnotation]],
        list[Received[Precursors.SessionAnnotation]],
    ]:
        to_insert: list[Received[Insertables.SessionAnnotation]] = []
        to_postpone: list[Postponed[Precursors.SessionAnnotation]] = []
        to_discard: list[Received[Precursors.SessionAnnotation]] = []

        stmt = self._select_existing(*map(_key, parcels))
        existing: list[Row[_Existing]] = [_ async for _ in await session.stream(stmt)]
        existing_sessions: Mapping[str, _SessionAttr] = {
            e.session_id: _SessionAttr(e.session_rowid) for e in existing
        }
        existing_annos: Mapping[_Key, _AnnoAttr] = {
            _Key(
                annotation_name=e.name,
                annotation_identifier=e.identifier,
                session_id=e.session_id,
            ): _AnnoAttr(e.session_rowid, e.id, e.updated_at)
            for e in existing
            if e.id is not None and e.name is not None and e.updated_at is not None
        }

        for p in parcels:
            if (anno := existing_annos.get(_key(p))) is not None:
                if p.item.updated_at <= anno.updated_at:
                    to_discard.append(p)
                else:
                    to_insert.append(
                        Received(
                            received_at=p.received_at,
                            item=p.item.as_insertable(
                                project_session_rowid=anno.session_rowid,
                            ),
                        )
                    )
            elif (existing_session := existing_sessions.get(p.item.session_id)) is not None:
                to_insert.append(
                    Received(
                        received_at=p.received_at,
                        item=p.item.as_insertable(
                            project_session_rowid=existing_session.session_rowid,
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
        session = (
            select(models.ProjectSession.id, models.ProjectSession.session_id)
            .where(models.ProjectSession.session_id.in_({k.session_id for k in keys}))
            .cte()
        )
        onclause = and_(
            session.c.id == anno.project_session_id,
            anno.name.in_({k.annotation_name for k in keys}),
            tuple_(anno.name, anno.identifier, session.c.session_id).in_(keys),
        )
        return select(
            session.c.id.label("session_rowid"),
            session.c.session_id,
            anno.id,
            anno.name,
            anno.identifier,
            anno.updated_at,
        ).outerjoin_from(session, anno, onclause)


class _SessionAttr(NamedTuple):
    session_rowid: _SessionRowId


class _AnnoAttr(NamedTuple):
    session_rowid: _SessionRowId
    id_: _AnnoRowId
    updated_at: datetime


def _key(p: Received[Precursors.SessionAnnotation]) -> _Key:
    return _Key(
        annotation_name=p.item.obj.name,
        annotation_identifier=p.item.obj.identifier,
        session_id=p.item.session_id,
    )


def _unique_by(p: Received[Insertables.SessionAnnotation]) -> _UniqueBy:
    return p.item.obj.name, p.item.project_session_rowid, p.item.obj.identifier


def _time(p: Received[Any]) -> datetime:
    return p.received_at
