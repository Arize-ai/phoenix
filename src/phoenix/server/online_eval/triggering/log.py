"""Reads and writes for `evaluator_signals`, the durable log of things rules can match on.

A signal is announced by whoever noticed the fact and consumed by acknowledgment: the
drain reads unacknowledged rows and stamps the ones it turned into requests, in the same
transaction. There is deliberately no position cursor here — row ids are handed out when a
transaction starts, not when it commits, so a signal committed after a higher-id one would
be behind any cursor that had already advanced past it. Acknowledgment has no such hole.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, ClassVar, Literal, Optional, Union

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.eval_work import undrained_evaluator_signal_predicate
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict


@dataclass(frozen=True)
class AnnotationUpserted:
    """An annotation as it stood when it was noticed, with the edge that noticed it.

    `updated_at` carries the occurrence identity: a rescan of the same edit repeats it and
    collapses, while a later edit to the same annotation is a distinct occurrence.
    """

    kind: ClassVar[models.EvaluatorSignalKind] = "annotation_upserted"

    annotation_kind: models.AnnotationKind
    annotation_id: int
    target_rowid: int
    edge: models.AnnotationEdge
    updated_at: datetime
    name: str
    label: Optional[str] = None
    score: Optional[float] = None
    annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None
    source: Optional[Literal["API", "APP"]] = None
    user_id: Optional[int] = None
    identifier: Optional[str] = None

    @property
    def dedup_key(self) -> str:
        return f"{self.annotation_kind}:{self.annotation_id}:{self.updated_at.isoformat()}"

    def payload(self) -> dict[str, Any]:
        return {
            "annotation_kind": self.annotation_kind,
            "annotation_id": self.annotation_id,
            "target_rowid": self.target_rowid,
            "edge": self.edge,
            "updated_at": self.updated_at.isoformat(),
            "name": self.name,
            "label": self.label,
            "score": self.score,
            "annotator_kind": self.annotator_kind,
            "source": self.source,
            "user_id": self.user_id,
            "identifier": self.identifier,
        }


@dataclass(frozen=True)
class EvaluationCompleted:
    """The verdict a work unit published, announced as the unit reaches DONE.

    The work unit is the occurrence identity: a unit reaches DONE once, so a retry of that
    transition repeats the key and collapses.
    """

    kind: ClassVar[models.EvaluatorSignalKind] = "evaluation_completed"

    work_unit_kind: Literal["span", "session"]
    work_unit_id: int
    project_evaluator_id: int
    evaluator_name: str
    name: str
    label: Optional[str] = None
    score: Optional[float] = None
    result_changed: bool = False
    previous_label: Optional[str] = None

    @property
    def dedup_key(self) -> str:
        return f"{self.work_unit_kind}:{self.work_unit_id}"

    def payload(self) -> dict[str, Any]:
        return {
            "work_unit_kind": self.work_unit_kind,
            "work_unit_id": self.work_unit_id,
            "project_evaluator_id": self.project_evaluator_id,
            "evaluator_name": self.evaluator_name,
            "name": self.name,
            "label": self.label,
            "score": self.score,
            "result_changed": self.result_changed,
            "previous_label": self.previous_label,
        }


Signal: TypeAlias = Union[AnnotationUpserted, EvaluationCompleted]


@dataclass(frozen=True)
class DrainedSignal:
    """One unacknowledged occurrence, as the drain reads it."""

    signal_id: int
    kind: models.EvaluatorSignalKind
    dedup_key: str
    project_id: int
    project_session_rowid: int
    payload: dict[str, Any]
    created_at: datetime


async def append(
    session: AsyncSession,
    signal: Signal,
    *,
    project_id: int,
    project_session_rowid: int,
) -> bool:
    """Log one occurrence of `signal` against a project and the session it resolved to.

    Pass the session of the transaction the fact belongs to: the signal then commits or
    rolls back with the fact, which is what keeps an announced edge from outliving the
    change that announced it. Only a repeat of the same occurrence is tolerated; anything
    else the row violates — an unknown kind, a project or session that is gone — raises and
    leaves the caller's transaction to fail.

    Returns:
        True when this call wrote the row, False when the occurrence was already logged.
    """
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    stmt = insert_on_conflict(
        {
            "kind": signal.kind,
            "dedup_key": signal.dedup_key,
            "project_id": project_id,
            "project_session_rowid": project_session_rowid,
            "payload": signal.payload(),
        },
        table=models.EvaluatorSignal,
        dialect=dialect,
        unique_by=("kind", "dedup_key"),
        on_conflict=OnConflict.DO_NOTHING,
    ).returning(models.EvaluatorSignal.id)
    return (await session.execute(stmt)).first() is not None


async def drain_page(session: AsyncSession, *, limit: int) -> tuple[DrainedSignal, ...]:
    """Read up to `limit` unacknowledged occurrences in id order.

    The predicate is spelled by `undrained_evaluator_signal_predicate` so that it matches
    the partial index the table carries; PostgreSQL only uses that index for a query whose
    WHERE clause implies its predicate.
    """
    stmt = (
        select(
            models.EvaluatorSignal.id,
            models.EvaluatorSignal.kind,
            models.EvaluatorSignal.dedup_key,
            models.EvaluatorSignal.project_id,
            models.EvaluatorSignal.project_session_rowid,
            models.EvaluatorSignal.payload,
            models.EvaluatorSignal.created_at,
        )
        .where(text(undrained_evaluator_signal_predicate()))
        .order_by(models.EvaluatorSignal.id)
        .limit(limit)
    )
    return tuple(
        DrainedSignal(
            signal_id=row.id,
            kind=row.kind,
            dedup_key=row.dedup_key,
            project_id=row.project_id,
            project_session_rowid=row.project_session_rowid,
            payload=row.payload,
            created_at=row.created_at,
        )
        for row in await session.execute(stmt)
    )


async def acknowledge(session: AsyncSession, signal_ids: Iterable[int]) -> int:
    """Record that these occurrences have been consumed, and never any others.

    Call this in the transaction that persists everything the page produced, so a page
    whose requests roll back is drained again rather than lost. Acknowledging a row twice
    leaves its first stamp in place.

    Returns:
        How many of the given occurrences this call acknowledged.
    """
    ids = sorted(set(signal_ids))
    if not ids:
        return 0
    result = await session.execute(
        update(models.EvaluatorSignal)
        .where(
            models.EvaluatorSignal.id.in_(ids),
            models.EvaluatorSignal.acknowledged_at.is_(None),
        )
        .values(acknowledged_at=func.now())
    )
    return int(result.rowcount)  # type: ignore[attr-defined]


async def purge_acknowledged(session: AsyncSession, *, acknowledged_before: datetime) -> int:
    """Delete occurrences acknowledged before `acknowledged_before`, leaving the rest.

    The window is the caller's to choose, and should be read from the database clock rather
    than a replica's. Unacknowledged rows are never deleted at any age.

    Returns:
        How many occurrences were deleted.
    """
    result = await session.execute(
        delete(models.EvaluatorSignal).where(
            models.EvaluatorSignal.acknowledged_at.is_not(None),
            models.EvaluatorSignal.acknowledged_at < acknowledged_before,
        )
    )
    return int(result.rowcount)  # type: ignore[attr-defined]

