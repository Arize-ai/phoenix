from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.db import models
from phoenix.server.app import _db
from phoenix.server.online_eval.triggering.log import (
    AnnotationUpserted,
    EvaluationCompleted,
    acknowledge,
    append,
    drain_page,
    purge_acknowledged,
)
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session

_NOTICED_AT = datetime(2026, 8, 17, 12, 0, tzinfo=timezone.utc)


async def _seed_session(db: DbSessionFactory) -> tuple[int, int]:
    """A project and a session in it, returning both rowids."""
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        return project.id, project_session.id


def _annotation(
    annotation_id: int,
    *,
    updated_at: datetime = _NOTICED_AT,
    label: str = "incorrect",
) -> AnnotationUpserted:
    return AnnotationUpserted(
        annotation_target="span",
        annotation_id=annotation_id,
        target_rowid=annotation_id,
        change="created",
        updated_at=updated_at,
        name="human-review",
        label=label,
        annotator_kind="HUMAN",
        source="APP",
    )


async def test_signal_is_appended_then_drained_then_acknowledged(db: DbSessionFactory) -> None:
    project_id, project_session_rowid = await _seed_session(db)

    async with db() as session:
        assert await append(
            session,
            _annotation(1),
            project_id=project_id,
            evaluation_target="SESSION",
            target_rowid=project_session_rowid,
        )

    async with db() as session:
        (drained,) = await drain_page(session, limit=10)
    assert drained.kind == "annotation_upserted"
    assert drained.project_id == project_id
    assert drained.evaluation_target == "SESSION"
    assert drained.target_rowid == project_session_rowid
    assert drained.payload["name"] == "human-review"
    assert drained.payload["label"] == "incorrect"

    async with db() as session:
        assert await acknowledge(session, [drained.signal_id]) == 1

    async with db() as session:
        assert await drain_page(session, limit=10) == ()


async def test_retried_annotation_signal_collapses_while_a_later_write_is_distinct(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_rowid = await _seed_session(db)
    noticed = _annotation(1)
    rewritten = _annotation(1, label="correct")

    async with db() as session:
        assert await append(
            session,
            noticed,
            project_id=project_id,
            evaluation_target="SESSION",
            target_rowid=project_session_rowid,
        )
    async with db() as session:
        assert not await append(
            session,
            noticed,
            project_id=project_id,
            evaluation_target="SESSION",
            target_rowid=project_session_rowid,
        )
    async with db() as session:
        assert await append(
            session,
            rewritten,
            project_id=project_id,
            evaluation_target="SESSION",
            target_rowid=project_session_rowid,
        )

    async with db() as session:
        page = await drain_page(session, limit=10)
    assert [signal.dedup_key for signal in page] == [noticed.dedup_key, rewritten.dedup_key]
    # The retry did not overwrite what the first write recorded.
    assert page[0].payload["label"] == "incorrect"


async def test_retried_completion_collapses_to_one_signal(db: DbSessionFactory) -> None:
    project_id, project_session_rowid = await _seed_session(db)
    completed = EvaluationCompleted(
        work_unit_kind="session",
        work_unit_id=7,
        criteria_id=3,
        evaluator_name="hallucination",
        name="hallucination",
        label="factual",
        result_changed=True,
        previous_label="hallucinated",
    )

    for _ in range(2):
        async with db() as session:
            await append(
                session,
                completed,
                project_id=project_id,
                evaluation_target="SESSION",
                target_rowid=project_session_rowid,
            )

    async with db() as session:
        (drained,) = await drain_page(session, limit=10)
    assert drained.kind == "evaluation_completed"
    assert drained.payload["work_unit_id"] == 7
    assert drained.payload["result_changed"] is True


async def test_append_fails_the_transaction_when_the_row_cannot_be_written(
    db: DbSessionFactory,
) -> None:
    project_id, _ = await _seed_session(db)

    # The driver's own IntegrityError under SQLite, a wrapped one under PostgreSQL.
    with pytest.raises(Exception, match="(?i)foreign key"):
        async with db() as session:
            await append(
                session,
                _annotation(1),
                project_id=project_id,
                evaluation_target="SESSION",
                target_rowid=10**9,
            )

    async with db() as session:
        assert await drain_page(session, limit=10) == ()


async def test_acknowledge_stamps_only_the_given_signals_and_repeats_harmlessly(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_rowid = await _seed_session(db)
    async with db() as session:
        for annotation_id in (1, 2, 3):
            await append(
                session,
                _annotation(annotation_id),
                project_id=project_id,
                evaluation_target="SESSION",
                target_rowid=project_session_rowid,
            )

    async with db() as session:
        first, second, third = await drain_page(session, limit=10)
        assert await acknowledge(session, [first.signal_id, third.signal_id]) == 2

    async with db() as session:
        assert [signal.signal_id for signal in await drain_page(session, limit=10)] == [
            second.signal_id
        ]
        stamped = await session.scalar(
            select(models.EvaluatorSignal.acknowledged_at).where(
                models.EvaluatorSignal.id == first.signal_id
            )
        )

    async with db() as session:
        assert await acknowledge(session, [first.signal_id, third.signal_id]) == 0

    async with db() as session:
        assert stamped == await session.scalar(
            select(models.EvaluatorSignal.acknowledged_at).where(
                models.EvaluatorSignal.id == first.signal_id
            )
        )


async def test_purge_removes_acknowledged_signals_past_the_window_and_nothing_else(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_rowid = await _seed_session(db)
    async with db() as session:
        for annotation_id in (1, 2, 3):
            await append(
                session,
                _annotation(annotation_id),
                project_id=project_id,
                evaluation_target="SESSION",
                target_rowid=project_session_rowid,
            )

    now = datetime.now(timezone.utc)
    async with db() as session:
        stale, recent, undrained = await drain_page(session, limit=10)
        await acknowledge(session, [stale.signal_id, recent.signal_id])
        await session.execute(
            update(models.EvaluatorSignal)
            .where(models.EvaluatorSignal.id == stale.signal_id)
            .values(acknowledged_at=now - timedelta(hours=1))
        )

    async with db() as session:
        assert (
            await purge_acknowledged(session, acknowledged_before=now - timedelta(minutes=30)) == 1
        )

    async with db() as session:
        surviving = await session.scalars(
            select(models.EvaluatorSignal.id).order_by(models.EvaluatorSignal.id)
        )
        assert list(surviving) == [recent.signal_id, undrained.signal_id]


@pytest.mark.postgres_only
async def test_signal_committed_after_a_higher_id_signal_is_still_drained(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    project_id, project_session_rowid = await _seed_session(db)
    late, early = _annotation(1), _annotation(2)

    async with db() as slow:
        # `late` takes the lower id here, but its transaction stays open past the commit
        # of the signal that follows it.
        await append(
            slow,
            late,
            project_id=project_id,
            evaluation_target="SESSION",
            target_rowid=project_session_rowid,
        )
        async with db() as fast:
            await append(
                fast,
                early,
                project_id=project_id,
                evaluation_target="SESSION",
                target_rowid=project_session_rowid,
            )
        async with db() as reader:
            page = await drain_page(reader, limit=10)
        assert [signal.dedup_key for signal in page] == [early.dedup_key]

    async with db() as reader:
        page = await drain_page(reader, limit=10)
    assert [signal.dedup_key for signal in page] == [late.dedup_key, early.dedup_key]
