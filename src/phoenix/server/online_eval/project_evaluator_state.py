"""Reads and writes of ``project_evaluator_state``: where each project evaluator starts and
how far it has swept. A missing row means no span start, and a sweep from the evaluator's
creation."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Sequence

from sqlalchemy import Insert, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.clock import current_database_time

_State = models.ProjectEvaluatorState


async def current_span_start_rowid(session: AsyncSession) -> int:
    """The span start for a span evaluator that starts now: the span cursor, or the newest
    span before the span producer has run."""
    produced_through_id = await session.scalar(
        select(models.EvalSpanCursor.produced_through_id).where(
            models.EvalSpanCursor.id == models.SPAN_CURSOR_ID
        )
    )
    if produced_through_id is not None:
        return produced_through_id
    return await session.scalar(select(func.max(models.Span.id))) or 0


async def load_states(
    session: AsyncSession,
    project_evaluator_ids: Sequence[int],
) -> dict[int, models.ProjectEvaluatorState]:
    """The recorded state of each project evaluator that has one."""
    if not project_evaluator_ids:
        return {}
    states = await session.scalars(
        select(_State).where(_State.project_evaluator_id.in_(project_evaluator_ids))
    )
    return {state.project_evaluator_id: state for state in states}


async def start_at_span_cursor(session: AsyncSession, project_evaluator_id: int) -> None:
    """Start a span evaluator at the span cursor, so it evaluates only spans that arrive
    from now on."""
    span_start_rowid = await current_span_start_rowid(session)
    await session.execute(
        _upsert(
            _dialect(session),
            [{"project_evaluator_id": project_evaluator_id, "span_start_rowid": span_start_rowid}],
            column="span_start_rowid",
        )
    )


async def start_at_database_time(session: AsyncSession, project_evaluator_id: int) -> None:
    """Start a trace or session evaluator's sweep now, by the database clock."""
    dialect = _dialect(session)
    swept_through_at = await current_database_time(session, dialect)
    await session.execute(
        _upsert(
            dialect,
            [{"project_evaluator_id": project_evaluator_id, "swept_through_at": swept_through_at}],
            column="swept_through_at",
        )
    )


async def advance_sweep_positions(
    session: AsyncSession,
    sweep_positions: Mapping[int, datetime],
) -> None:
    """Move each evaluator's sweep position forward to the given time; a position never
    moves back. Raises ``IntegrityError`` when an evaluator no longer exists."""
    if not sweep_positions:
        return
    await session.execute(
        _upsert(
            _dialect(session),
            [
                {"project_evaluator_id": project_evaluator_id, "swept_through_at": swept_through_at}
                for project_evaluator_id, swept_through_at in sorted(sweep_positions.items())
            ],
            column="swept_through_at",
            forward_only=True,
        )
    )


async def lower_span_starts(session: AsyncSession, span_start_rowid: int) -> None:
    """Lower every span start above ``span_start_rowid`` to it."""
    await session.execute(
        update(_State)
        .where(_State.span_start_rowid > span_start_rowid)
        .values(span_start_rowid=span_start_rowid)
    )


def _upsert(
    dialect: SupportedSQLDialect,
    records: Sequence[Mapping[str, Any]],
    *,
    column: str,
    forward_only: bool = False,
) -> Insert:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        statement = insert_postgresql(_State).values(records)
        excluded = getattr(statement.excluded, column)
        return statement.on_conflict_do_update(
            index_elements=[_State.project_evaluator_id],
            set_={column: excluded},
            where=_moves_forward(column, excluded) if forward_only else None,
        )
    if dialect is SupportedSQLDialect.SQLITE:
        sqlite_statement = insert_sqlite(_State).values(records)
        sqlite_excluded = getattr(sqlite_statement.excluded, column)
        return sqlite_statement.on_conflict_do_update(
            index_elements=[_State.project_evaluator_id],
            set_={column: sqlite_excluded},
            where=_moves_forward(column, sqlite_excluded) if forward_only else None,
        )
    assert_never(dialect)


def _moves_forward(column: str, excluded: Any) -> Any:
    current = getattr(_State, column)
    return or_(current.is_(None), current < excluded)


def _dialect(session: AsyncSession) -> SupportedSQLDialect:
    return SupportedSQLDialect(session.get_bind().dialect.name)
