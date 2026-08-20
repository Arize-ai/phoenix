"""Store rule-matchable occurrences durably in `evaluator_events`.

An event is announced by whoever noticed the fact and consumed by acknowledgment: the
drain reads unacknowledged rows and stamps the ones it turned into requests, in the same
transaction. There is deliberately no position cursor here — row ids are handed out when a
transaction starts, not when it commits, so an event committed after a higher-id one would
be behind any cursor that had already advanced past it. Acknowledgment has no such hole.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from secrets import token_hex
from typing import Any, ClassVar, Literal, Optional

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.eval_work import undrained_evaluator_event_predicate
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict


@dataclass(frozen=True)
class AnnotationUpserted:
    """An annotation as it stood when it was written, with its change kind."""

    kind: ClassVar[models.EvaluatorEventKind] = "annotation_upserted"

    annotation_target: models.AnnotationTarget
    annotation_id: int
    target_rowid: int
    change: models.AnnotationChange
    updated_at: datetime
    name: str
    label: Optional[str] = None
    score: Optional[float] = None
    annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None
    source: Optional[Literal["API", "APP"]] = None
    user_id: Optional[int] = None
    identifier: Optional[str] = None
    # Names the write this announces, so a retry of that write repeats the dedup key and
    # collapses while a later write of the same annotation is a distinct occurrence. A
    # caller whose write is already identified — a work unit publishing its verdict —
    # passes that identity in; anyone else takes a fresh token.
    write_token: str = field(default_factory=lambda: token_hex(16), repr=False, compare=False)

    @property
    def occurrence_key(self) -> str:
        return f"{self.annotation_target}:{self.annotation_id}:{self.write_token}"

    def payload(self) -> dict[str, Any]:
        return {
            "annotation_target": self.annotation_target,
            "annotation_id": self.annotation_id,
            # The annotated entity's rowid; DrainedEvent.target_rowid is the routed
            # evaluation target's rowid and can therefore name the containing session.
            "target_rowid": self.target_rowid,
            "change": self.change,
            "updated_at": self.updated_at.isoformat(),
            "name": self.name,
            "label": self.label,
            "score": self.score,
            "annotator_kind": self.annotator_kind,
            "source": self.source,
            "user_id": self.user_id,
            "identifier": self.identifier,
        }


Event: TypeAlias = AnnotationUpserted


# Which column holds the routed entity's rowid, per evaluation target. The table CHECKs
# that exactly the declared target's column is filled, so writes and reads both resolve
# the key through here rather than each naming a column.
_TARGET_KEY_COLUMNS: dict[models.EvaluationTarget, str] = {
    "SPAN": "span_rowid",
    "TRACE": "trace_rowid",
    "SESSION": "project_session_rowid",
}


@dataclass(frozen=True)
class DrainedEvent:
    """One unacknowledged occurrence, as the drain reads it.

    `evaluation_target` and `target_rowid` say which entity the occurrence demands be
    evaluated; what the occurrence happened to is in the payload.
    """

    event_id: int
    kind: models.EvaluatorEventKind
    occurrence_key: str
    project_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    payload: dict[str, Any]
    created_at: datetime


async def append(
    session: AsyncSession,
    event: Event,
    *,
    project_id: int,
    evaluation_target: models.EvaluationTarget,
    target_rowid: int,
) -> bool:
    """Log one occurrence of `event` against a project and the entity it demands.

    Pass the session of the transaction the fact belongs to: the event then commits or
    rolls back with the fact, which is what keeps an announced change from outliving the
    change that announced it. Only a repeat of the same occurrence is tolerated; anything
    else the row violates — an unknown kind or target, a project or entity that is gone —
    raises and leaves the caller's transaction to fail.

    Returns:
        True when this call wrote the row, False when the occurrence was already logged.
    """
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    stmt = insert_on_conflict(
        {
            "kind": event.kind,
            "occurrence_key": event.occurrence_key,
            "project_id": project_id,
            "evaluation_target": evaluation_target,
            _TARGET_KEY_COLUMNS[evaluation_target]: target_rowid,
            "payload": event.payload(),
        },
        table=models.EvaluatorEvent,
        dialect=dialect,
        unique_by=("kind", "occurrence_key"),
        on_conflict=OnConflict.DO_NOTHING,
    ).returning(models.EvaluatorEvent.id)
    return (await session.execute(stmt)).first() is not None


async def drain_page(session: AsyncSession, *, limit: int) -> tuple[DrainedEvent, ...]:
    """Read up to `limit` unacknowledged occurrences in id order.

    The predicate is spelled by `undrained_evaluator_event_predicate` so that it matches
    the partial index the table carries; PostgreSQL only uses that index for a query whose
    WHERE clause implies its predicate.
    """
    stmt = (
        select(
            models.EvaluatorEvent.id,
            models.EvaluatorEvent.kind,
            models.EvaluatorEvent.occurrence_key,
            models.EvaluatorEvent.project_id,
            models.EvaluatorEvent.evaluation_target,
            models.EvaluatorEvent.span_rowid,
            models.EvaluatorEvent.trace_rowid,
            models.EvaluatorEvent.project_session_rowid,
            models.EvaluatorEvent.payload,
            models.EvaluatorEvent.created_at,
        )
        .where(text(undrained_evaluator_event_predicate()))
        .order_by(models.EvaluatorEvent.id)
        .limit(limit)
    )
    return tuple(
        DrainedEvent(
            event_id=row.id,
            kind=row.kind,
            occurrence_key=row.occurrence_key,
            project_id=row.project_id,
            evaluation_target=row.evaluation_target,
            target_rowid=getattr(row, _TARGET_KEY_COLUMNS[row.evaluation_target]),
            payload=row.payload,
            created_at=row.created_at,
        )
        for row in await session.execute(stmt)
    )


async def acknowledge(session: AsyncSession, event_ids: Iterable[int]) -> int:
    """Record that these occurrences have been consumed, and never any others.

    Call this in the transaction that persists everything the page produced, so a page
    whose requests roll back is drained again rather than lost. Acknowledging a row twice
    leaves its first stamp in place.

    Returns:
        How many of the given occurrences this call acknowledged.
    """
    ids = sorted(set(event_ids))
    if not ids:
        return 0
    result = await session.execute(
        update(models.EvaluatorEvent)
        .where(
            models.EvaluatorEvent.id.in_(ids),
            models.EvaluatorEvent.acknowledged_at.is_(None),
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
        delete(models.EvaluatorEvent).where(
            models.EvaluatorEvent.acknowledged_at.is_not(None),
            models.EvaluatorEvent.acknowledged_at < acknowledged_before,
        )
    )
    return int(result.rowcount)  # type: ignore[attr-defined]
