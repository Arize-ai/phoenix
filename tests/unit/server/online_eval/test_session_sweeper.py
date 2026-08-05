import logging
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval import session_sweeper
from phoenix.server.online_eval.derivation import MAX_ATTEMPTS, ResolvedCriteria
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


def test_session_work_insert_batch_stays_below_asyncpg_parameter_limit() -> None:
    work_records = [
        {
            "project_session_rowid": index,
            "evaluator_id": index,
            "criteria_id": index,
            "config_fingerprint": f"fingerprint-{index}",
            "evaluated_through": _now(),
        }
        for index in range(session_sweeper._SESSION_WORK_INSERT_BATCH_SIZE)
    ]

    statement = session_sweeper._session_work_insert_statement(
        work_records,
        SupportedSQLDialect.POSTGRESQL,
    )
    compiled = statement.compile(dialect=asyncpg.dialect())  # type: ignore[no-untyped-call]

    assert len(compiled.params) == (
        session_sweeper._SESSION_WORK_INSERT_BATCH_SIZE
        * session_sweeper._SESSION_WORK_INSERT_PARAMETERS_PER_ROW
    )
    assert len(compiled.params) <= session_sweeper._MAX_SESSION_WORK_INSERT_PARAMETERS
    assert len(compiled.params) < 32_767


async def _add_session_liveness(
    db: DbSessionFactory,
    *,
    age_seconds: float,
    project_id: int | None = None,
    content_complete: bool = True,
) -> tuple[int, int, datetime]:
    last_span_seen_at = _now() - timedelta(seconds=age_seconds)
    async with db() as session:
        if project_id is None:
            project = await _add_project(session)
        else:
            existing_project = await session.get(models.Project, project_id)
            assert existing_project is not None
            project = existing_project
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session.id)
            .values(
                last_span_seen_at=last_span_seen_at,
                content_complete=content_complete,
            )
        )
        return project.id, project_session.id, last_span_seen_at


async def _set_delay(
    db: DbSessionFactory,
    criteria_id: int,
    delay_seconds: int,
) -> None:
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == criteria_id)
            .values(evaluation_delay_seconds=delay_seconds)
        )


async def test_materializes_due_complete_session_with_activity_snapshot(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, last_span_seen_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
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
        cursor = (
            await session.scalars(
                select(models.EvalWorkCursor).where(
                    models.EvalWorkCursor.evaluation_target == "SESSION",
                    models.EvalWorkCursor.consumer_group == "default",
                )
            )
        ).one()
        await session.execute(
            session_sweeper._session_work_insert_statement(
                [
                    {
                        "project_session_rowid": project_session_id,
                        "evaluator_id": evaluator_id,
                        "criteria_id": criteria_id,
                        "config_fingerprint": unit.config_fingerprint,
                        "evaluated_through": last_span_seen_at,
                    }
                ],
                db.dialect,
            )
        )
        live_work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert unit.evaluator_id == evaluator_id
    assert unit.criteria_id == criteria_id
    assert unit.evaluated_through == last_span_seen_at
    assert unit.status == "PENDING"
    assert cursor.claimed_by == sweeper._sweeper_id
    assert live_work_count == 1


async def test_retained_long_delay_pairs_do_not_block_later_due_pair(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(session_sweeper, "_MAX_ELIGIBLE_PAIRS_PER_TICK", 2)
    retained_project_id, retained_session_1, _ = await _add_session_liveness(
        db,
        age_seconds=100,
    )
    _, retained_session_2, _ = await _add_session_liveness(
        db,
        age_seconds=100,
        project_id=retained_project_id,
    )
    _, short_criteria_id = await _seed_criteria(
        db,
        retained_project_id,
        evaluation_target="SESSION",
    )
    _, long_criteria_id = await _seed_criteria(
        db,
        retained_project_id,
        evaluation_target="SESSION",
    )
    await _set_delay(db, short_criteria_id, 10)
    await _set_delay(db, long_criteria_id, 600)
    due_project_id, due_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=50,
    )
    due_criteria_id = (await _seed_criteria(db, due_project_id, evaluation_target="SESSION"))[1]
    await _set_delay(db, due_criteria_id, 10)

    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()
    await sweeper._tick()

    async with db() as session:
        materialized_session_ids = set(
            await session.scalars(select(models.EvalSessionWorkUnit.project_session_rowid))
        )
    assert materialized_session_ids == {
        retained_session_1,
        retained_session_2,
        due_session_id,
    }


async def test_disabled_and_unresolved_criteria_preserve_future_eligibility(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    disabled_project_id, disabled_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    _, disabled_criteria_id = await _seed_criteria(
        db,
        disabled_project_id,
        evaluation_target="SESSION",
    )
    unresolved_project_id, unresolved_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    _, unresolved_criteria_id = await _seed_criteria(
        db,
        unresolved_project_id,
        evaluation_target="SESSION",
    )
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == disabled_criteria_id)
            .values(enabled=False)
        )

    async def unresolved(
        session: AsyncSession,
        criteria: models.ProjectEvaluatorCriteria,
        evaluator: models.Evaluator,
    ) -> ResolvedCriteria | None:
        if criteria.id == unresolved_criteria_id:
            return None
        return await resolve_criteria(session, criteria, evaluator)

    monkeypatch.setattr(session_sweeper, "resolve_criteria", unresolved)
    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()
    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )
        await session.execute(
            update(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == disabled_criteria_id)
            .values(enabled=True)
        )

    monkeypatch.setattr(session_sweeper, "resolve_criteria", resolve_criteria)
    await sweeper._tick()
    async with db() as session:
        session_ids = set(
            await session.scalars(select(models.EvalSessionWorkUnit.project_session_rowid))
        )
    assert session_ids == {disabled_session_id, unresolved_session_id}


async def test_successful_work_closes_evaluate_once_key(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()
    async with db() as session:
        await session.execute(update(models.EvalSessionWorkUnit).values(status="DONE"))
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(last_span_seen_at=_now() - timedelta(seconds=400))
        )

    await sweeper._tick()
    async with db() as session:
        units = list(await session.scalars(select(models.EvalSessionWorkUnit)))
    assert len(units) == 1
    assert units[0].status == "DONE"


async def test_exhausted_error_and_expired_history_are_replaceable(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()

    async with db() as session:
        first_id = await session.scalar(select(models.EvalSessionWorkUnit.id))
        assert first_id is not None
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == first_id)
            .values(status="ERROR", attempts=MAX_ATTEMPTS)
        )
    await sweeper._tick()

    async with db() as session:
        units = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit)
                .where(models.EvalSessionWorkUnit.project_session_rowid == project_session_id)
                .order_by(models.EvalSessionWorkUnit.id)
            )
        )
        assert len(units) == 2
        assert units[0].status == "ERROR"
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == units[1].id)
            .values(status="EXPIRED")
        )
    await sweeper._tick()

    async with db() as session:
        statuses = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit.status).order_by(models.EvalSessionWorkUnit.id)
            )
        )
    assert statuses == ["ERROR", "EXPIRED", "PENDING"]


async def test_incomplete_session_is_never_scheduled(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        content_complete=False,
    )
    await _seed_criteria(db, project_id, evaluation_target="SESSION")

    await SessionEvalSweeper(db)._tick()

    async with db() as session:
        count = await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit))
    assert count == 0


async def test_outstanding_work_ceiling_defers_eligible_pair(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvalSweeper(db)
    monkeypatch.setattr(sweeper, "_max_outstanding", 0)

    await sweeper._tick()
    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )

    monkeypatch.setattr(sweeper, "_max_outstanding", 1)
    await sweeper._tick()
    async with db() as session:
        session_id = await session.scalar(select(models.EvalSessionWorkUnit.project_session_rowid))
    assert session_id == project_session_id


async def test_lost_lease_rolls_back_sweep(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
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
    with caplog.at_level(logging.WARNING, logger=session_sweeper.__name__):
        await sweeper._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 0
    assert "Session evaluation sweeper lost its lease" in caplog.text


async def test_live_session_lease_stands_down_and_stale_lease_is_reclaimed(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
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
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.evaluation_target == "SESSION")
            .values(claimed_at=_now() - timedelta(seconds=SESSION_SWEEP_LEASE_TTL_SECONDS + 1))
        )
    await sweeper._tick()

    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 1
        )


async def test_trace_filtered_and_sampled_criteria_remain_unscheduled(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
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
        count = await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit))
    assert count == 0


async def test_sweep_metrics_cover_eligibility_watermark_and_outcomes(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(session_sweeper, "get_env_enable_prometheus", lambda: True)
    metric_names = (
        "ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG",
        "ONLINE_EVAL_SESSION_RESULT_WATERMARK_LAG_SECONDS",
        "ONLINE_EVAL_SESSION_MATERIALIZED_WORK_UNITS",
        "ONLINE_EVAL_SESSION_SWEEP_ATTEMPTS",
        "ONLINE_EVAL_SESSION_SWEEP_DURATION_SECONDS",
        "ONLINE_EVAL_SESSION_SWEEP_FAILURES",
        "ONLINE_EVAL_SESSION_SWEEP_SUCCESSES",
    )
    metrics = {name: Mock() for name in metric_names}
    for name, metric in metrics.items():
        monkeypatch.setattr(session_sweeper, name, metric)

    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()

    metrics["ONLINE_EVAL_SESSION_ELIGIBLE_PAIR_BACKLOG"].set.assert_called_once_with(1)
    metrics["ONLINE_EVAL_SESSION_RESULT_WATERMARK_LAG_SECONDS"].set.assert_called_once_with(0.0)
    metrics["ONLINE_EVAL_SESSION_SWEEP_ATTEMPTS"].inc.assert_called_once_with()
    metrics["ONLINE_EVAL_SESSION_SWEEP_SUCCESSES"].inc.assert_called_once_with()
    metrics["ONLINE_EVAL_SESSION_SWEEP_FAILURES"].inc.assert_not_called()
    metrics["ONLINE_EVAL_SESSION_MATERIALIZED_WORK_UNITS"].inc.assert_called_once_with(1)

    async def fail_sweep(session: AsyncSession, database_now: datetime) -> int:
        raise RuntimeError("failed sweep")

    monkeypatch.setattr(sweeper, "_sweep", fail_sweep)
    with pytest.raises(RuntimeError, match="failed sweep"):
        await sweeper._tick()

    metrics["ONLINE_EVAL_SESSION_SWEEP_FAILURES"].inc.assert_called_once_with()
    assert metrics["ONLINE_EVAL_SESSION_SWEEP_DURATION_SECONDS"].observe.call_count == 2
