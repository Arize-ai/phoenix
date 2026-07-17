import logging
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.online_eval import session_sweeper
from phoenix.server.online_eval.derivation import ResolvedCriteria
from phoenix.server.online_eval.producer import resolve_criteria
from phoenix.server.online_eval.session_sweeper import (
    SESSION_SWEEP_LEASE_TTL_SECONDS,
    SessionEvalSweeper,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace
from .test_producer import _seed_criteria


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _add_session_activity(
    db: DbSessionFactory,
    *,
    age_seconds: float,
    project_id: int | None = None,
) -> tuple[int, int, int]:
    async with db() as session:
        if project_id is None:
            project = await _add_project(session)
        else:
            existing_project = await session.get(models.Project, project_id)
            assert existing_project is not None
            project = existing_project
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        span = await _add_span(session, trace)
        session.add(
            models.EvalSessionActivity(
                project_session_rowid=project_session.id,
                last_seen_span_rowid=span.id,
                observed_at=_now() - timedelta(seconds=age_seconds),
            )
        )
        await session.flush()
        return project.id, project_session.id, span.id


async def _set_delay(
    db: DbSessionFactory,
    criteria_id: int,
    delay_seconds: int | None,
) -> None:
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == criteria_id)
            .values(evaluation_delay_seconds=delay_seconds)
        )


async def test_materializes_generation_zero_and_prunes_resolved_activity(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_activity(db, age_seconds=600)
    evaluator_id, criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )

    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()

    async with db() as session:
        unit = (
            await session.scalars(
                select(models.EvalSessionWorkUnit).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        ).one()
        activity_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionActivity)
        )
        cursor = (
            await session.scalars(
                select(models.EvalWorkCursor).where(
                    models.EvalWorkCursor.evaluation_target == "SESSION",
                    models.EvalWorkCursor.consumer_group == "default",
                )
            )
        ).one()
    assert unit.evaluator_id == evaluator_id
    assert unit.criteria_id == criteria_id
    assert unit.generation == 0
    assert unit.status == "PENDING"
    assert activity_count == 0
    assert cursor.claimed_by == sweeper._sweeper_id


async def test_not_yet_due_activity_does_not_consume_scan_limit(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(session_sweeper, "_MAX_ACTIVITY_ROWS_PER_TICK", 2)
    long_delay_project_id, _, _ = await _add_session_activity(db, age_seconds=0)
    _, long_delay_criteria_id = await _seed_criteria(
        db,
        long_delay_project_id,
        evaluation_target="SESSION",
    )
    await _set_delay(db, long_delay_criteria_id, 600)
    for _ in range(2):
        await _add_session_activity(
            db,
            age_seconds=0,
            project_id=long_delay_project_id,
        )
    due_project_id, due_project_session_id, _ = await _add_session_activity(
        db,
        age_seconds=600,
    )
    await _seed_criteria(db, due_project_id, evaluation_target="SESSION")

    await SessionEvalSweeper(db)._tick()

    async with db() as session:
        project_session_ids = list(
            await session.scalars(select(models.EvalSessionWorkUnit.project_session_rowid))
        )
    assert project_session_ids == [due_project_session_id]


async def test_lost_lease_rolls_back_sweep(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    project_id, project_session_id, _ = await _add_session_activity(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvalSweeper(db)
    acquire_cursor = sweeper._acquire_cursor

    async def acquire_then_lose_lease() -> int | None:
        cursor_id = await acquire_cursor()
        assert cursor_id is not None
        async with db() as session:
            await session.execute(
                update(models.EvalWorkCursor)
                .where(models.EvalWorkCursor.id == cursor_id)
                .values(claimed_by="replacement-sweeper")
            )
        return cursor_id

    monkeypatch.setattr(sweeper, "_acquire_cursor", acquire_then_lose_lease)
    async with db() as session:
        activity_before = (
            await session.execute(
                select(
                    models.EvalSessionActivity.id,
                    models.EvalSessionActivity.last_seen_span_rowid,
                    models.EvalSessionActivity.observed_at,
                ).where(models.EvalSessionActivity.project_session_rowid == project_session_id)
            )
        ).one()

    with caplog.at_level(logging.WARNING, logger=session_sweeper.__name__):
        await sweeper._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
        activity_after = (
            await session.execute(
                select(
                    models.EvalSessionActivity.id,
                    models.EvalSessionActivity.last_seen_span_rowid,
                    models.EvalSessionActivity.observed_at,
                ).where(models.EvalSessionActivity.project_session_rowid == project_session_id)
            )
        ).one()
    assert work_count == 0
    assert activity_after == activity_before
    assert "Session evaluation sweeper lost its lease" in caplog.text


async def test_unresolvable_criteria_does_not_stall_project_sweep(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    project_id, project_session_id, _ = await _add_session_activity(db, age_seconds=600)
    _, resolvable_criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )
    _, unresolvable_criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )

    async def resolve_with_one_unresolvable(
        session: AsyncSession,
        criteria: models.ProjectEvaluatorCriteria,
        evaluator: models.Evaluator,
    ) -> ResolvedCriteria | None:
        if criteria.id == unresolvable_criteria_id:
            return None
        return await resolve_criteria(session, criteria, evaluator)

    monkeypatch.setattr(session_sweeper, "resolve_criteria", resolve_with_one_unresolvable)
    with caplog.at_level(logging.WARNING, logger=session_sweeper.__name__):
        await SessionEvalSweeper(db)._tick()

    async with db() as session:
        criteria_ids = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit.criteria_id).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        )
        activity_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionActivity)
        )
    assert criteria_ids == [resolvable_criteria_id]
    assert activity_count == 0
    messages = [
        record.message
        for record in caplog.records
        if f"Skipping criteria {unresolvable_criteria_id}:" in record.message
    ]
    assert len(messages) == 1


async def test_retains_activity_until_each_criteria_delay_elapses(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_activity(db, age_seconds=100)
    _, short_delay_criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )
    _, long_delay_criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )
    await _set_delay(db, short_delay_criteria_id, 10)
    await _set_delay(db, long_delay_criteria_id, 600)

    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()

    async with db() as session:
        units = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        )
        activity = await session.scalar(
            select(models.EvalSessionActivity).where(
                models.EvalSessionActivity.project_session_rowid == project_session_id
            )
        )
    assert [unit.criteria_id for unit in units] == [short_delay_criteria_id]
    assert activity is not None

    async with db() as session:
        await session.execute(
            update(models.EvalSessionActivity)
            .where(models.EvalSessionActivity.project_session_rowid == project_session_id)
            .values(observed_at=_now() - timedelta(seconds=700))
        )
    await sweeper._tick()

    async with db() as session:
        criteria_ids = set(
            await session.scalars(
                select(models.EvalSessionWorkUnit.criteria_id).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        )
        activity_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionActivity)
        )
    assert criteria_ids == {short_delay_criteria_id, long_delay_criteria_id}
    assert activity_count == 0


async def test_reopened_session_is_pruned_without_another_work_unit(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, span_id = await _add_session_activity(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()

    async with db() as session:
        session.add(
            models.EvalSessionActivity(
                project_session_rowid=project_session_id,
                last_seen_span_rowid=span_id,
                observed_at=_now() - timedelta(seconds=600),
            )
        )
    await sweeper._tick()

    async with db() as session:
        units = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        )
        activity_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionActivity)
        )
    assert len(units) == 1
    assert units[0].generation == 0
    assert activity_count == 0


async def test_trace_filtered_and_sampled_criteria_remain_unscheduled(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_activity(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="TRACE")
    await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        filter_condition="span_kind == 'LLM'",
    )
    await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        sampling_rate=0.5,
    )

    await SessionEvalSweeper(db)._tick()

    async with db() as session:
        session_work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert session_work_count == 0


async def test_live_session_lease_stands_down_and_stale_lease_is_reclaimed(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_activity(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    async with db() as session:
        session.add(
            models.EvalWorkCursor(
                evaluation_target="SESSION",
                consumer_group="default",
                produced_through_id=0,
                claimed_by="other-sweeper",
                claimed_at=_now(),
            )
        )

    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()
    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 0

    async with db() as session:
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.evaluation_target == "SESSION")
            .values(claimed_at=_now() - timedelta(seconds=SESSION_SWEEP_LEASE_TTL_SECONDS + 1))
        )
    await sweeper._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
        cursor = (
            await session.scalars(
                select(models.EvalWorkCursor).where(
                    models.EvalWorkCursor.evaluation_target == "SESSION"
                )
            )
        ).one()
    assert work_count == 1
    assert cursor.claimed_by == sweeper._sweeper_id
