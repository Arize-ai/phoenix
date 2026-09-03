import asyncio
import logging
from datetime import datetime, timedelta, timezone
from importlib import import_module
from secrets import token_hex
from typing import Sequence, cast
from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy import Table, func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from phoenix.config import get_env_online_eval_max_session_outstanding
from phoenix.db import models
from phoenix.db.eval_work import live_eval_session_work_index_predicate
from phoenix.db.types.identifier import Identifier
from phoenix.server.app import _db
from phoenix.server.online_eval import sweeper as sweeper_module
from phoenix.server.online_eval.coordinator import (
    LEASE_ATTEMPTS_EXHAUSTED_ERROR,
    LEASE_TTL_SECONDS,
)
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    STALE_FINGERPRINT_ERROR,
    ResolvedProjectEvaluator,
    sample_key,
)
from phoenix.server.online_eval.project_evaluator_resolution import resolve_project_evaluators_bulk
from phoenix.server.online_eval.sweeper import (
    SESSION_SWEEP_LEASE_TTL_SECONDS,
    EvalSweeper,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace
from .test_producer import _seed_criteria as _seed_criteria_raw

_MAX_OUTSTANDING = get_env_online_eval_max_session_outstanding()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _seed_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    evaluation_target: models.EvaluationTarget,
    filter_condition: str = "",
    sampling_rate: float = 1.0,
) -> tuple[int, int]:
    evaluator_id, project_evaluator_id = await _seed_criteria_raw(
        db,
        project_id,
        evaluation_target=evaluation_target,
        filter_condition=filter_condition,
        sampling_rate=sampling_rate,
    )
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(created_at=_now() - timedelta(days=1))
        )
    return evaluator_id, project_evaluator_id


def test_live_key_predicate_is_single_sourced_from_max_attempts() -> None:
    """The sweeper's conflict target, the model's index, and the migration that creates
    it must stay textually identical and must track ``MAX_ATTEMPTS``: Postgres matches
    ``ON CONFLICT ... WHERE`` to a partial index by predicate equivalence.
    """
    migration = import_module(
        "phoenix.db.migrations.versions.a7f1c3e9d2b4_add_online_eval_coordination"
    )
    predicate = live_eval_session_work_index_predicate()
    live_key_table = cast(Table, models.EvalSessionWorkUnit.__table__)
    live_key_index = next(
        index
        for index in live_key_table.indexes
        if index.name == "uq_eval_session_work_units_live_key"
    )

    assert f"attempts < {MAX_ATTEMPTS}" in predicate
    assert "FILTERED_OUT" in predicate
    assert "SAMPLED_OUT" in predicate
    assert str(live_key_index.dialect_options["postgresql"]["where"]) == predicate
    assert str(live_key_index.dialect_options["sqlite"]["where"]) == predicate
    session_target = sweeper_module._SWEEP_TARGETS["SESSION"]
    assert str(session_target.live_work_index_predicate) == predicate
    assert (
        migration.live_eval_session_work_index_predicate is live_eval_session_work_index_predicate
    )


@pytest.mark.parametrize(
    "database_dialect,expected_clock",
    [("sqlite", "now()"), ("postgresql", "statement_timestamp()")],
)
async def test_database_now_uses_statement_time(
    database_dialect: str,
    expected_clock: str,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = _now()
    sweeper = EvalSweeper(
        DbSessionFactory(db=Mock(), dialect=database_dialect),
        evaluation_target="SESSION",
        max_outstanding=_MAX_OUTSTANDING,
    )

    await sweeper._database_now(session)

    statement = session.scalar.await_args.args[0]
    assert expected_clock in str(statement)


async def test_materialization_rechecks_eligibility_at_write_time(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, last_span_ingested_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)

    async with db() as session:
        criterion = (await sweeper._load_evaluators(session))[0]
        database_now = await sweeper._database_now(session)
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(last_span_ingested_at=database_now)
        )
        inserted_count, eligible_pair_count = await sweeper._load_eligible_pairs(
            session,
            database_now,
            [criterion],
            limit=1,
        )
        assert inserted_count == 0
        assert eligible_pair_count is None
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(last_span_ingested_at=last_span_ingested_at)
        )
        inserted_count, _ = await sweeper._load_eligible_pairs(
            session,
            database_now,
            [criterion],
            limit=1,
        )
        assert inserted_count == 1


async def _add_session_liveness(
    db: DbSessionFactory,
    *,
    age_seconds: float,
    project_id: int | None = None,
    content_complete: bool = True,
    session_id: str | None = None,
) -> tuple[int, int, datetime]:
    last_span_ingested_at = _now() - timedelta(seconds=age_seconds)
    async with db() as session:
        if project_id is None:
            project = await _add_project(session)
        else:
            existing_project = await session.get(models.Project, project_id)
            assert existing_project is not None
            project = existing_project
        project_session = await _add_project_session(session, project, session_id=session_id)
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session.id)
            .values(
                last_span_ingested_at=last_span_ingested_at,
                content_complete=content_complete,
            )
        )
        return project.id, project_session.id, last_span_ingested_at


async def _set_delay(
    db: DbSessionFactory,
    project_evaluator_id: int,
    delay_seconds: int,
) -> None:
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(evaluation_delay_seconds=delay_seconds)
        )


async def test_materializes_due_complete_session_with_activity_snapshot(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, last_span_ingested_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    evaluator_id, project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )

    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()

    async with db() as session:
        unit = (
            await session.scalars(
                select(models.EvalSessionWorkUnit).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        ).one()
        lease = (
            await session.scalars(
                select(models.EvalWorkLease).where(
                    models.EvalWorkLease.name == sweeper._lease_name,
                )
            )
        ).one()
        live_work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert unit.evaluator_id == evaluator_id
    assert unit.project_evaluator_id == project_evaluator_id
    assert unit.evaluated_through == last_span_ingested_at
    assert unit.status == "PENDING"
    assert lease.holder == sweeper._sweeper_id
    assert live_work_count == 1


async def test_materializes_with_501_schedulable_criteria(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    evaluator_id, _ = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    async with db() as session:
        session.add_all(
            models.ProjectEvaluator(
                trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
                project_id=project_id,
                evaluator_id=evaluator_id,
                name=Identifier(root=f"bulk-project_evaluator-{index}"),
                filter_condition="",
                sampling_rate=1.0,
                evaluation_target="SESSION",
                created_at=_now() - timedelta(days=1),
            )
            for index in range(500)
        )

    await EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 501


@pytest.mark.postgres_only
async def test_materialization_waits_for_publication_criteria_lock_before_session_locks(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    _, second_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        project_id=project_id,
    )
    _, first_criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    materialization_started = asyncio.Event()
    materialization_backend_pid: int | None = None

    async def materialize() -> tuple[int, int | None]:
        nonlocal materialization_backend_pid
        async with db() as session:
            materialization_backend_pid = await session.scalar(select(func.pg_backend_pid()))
            assert materialization_backend_pid is not None
            database_now = await sweeper._database_now(session)
            materialization_started.set()
            return await sweeper._sweep(session, database_now)

    async with db() as publication_session:
        publication_backend_pid = await publication_session.scalar(select(func.pg_backend_pid()))
        assert publication_backend_pid is not None
        assert (
            await publication_session.scalar(
                select(models.ProjectEvaluator.id)
                .where(models.ProjectEvaluator.id == first_criteria_id)
                .with_for_update()
            )
            == first_criteria_id
        )
        materialization = asyncio.create_task(materialize())
        await materialization_started.wait()

        async def wait_for_publication_to_block_materialization() -> Sequence[int]:
            assert materialization_backend_pid is not None
            while True:
                async with db() as observer:
                    blocking_pids = await observer.scalar(
                        select(func.pg_blocking_pids(materialization_backend_pid))
                    )
                if blocking_pids:
                    return cast(Sequence[int], blocking_pids)
                await asyncio.sleep(0)

        blocking_pids = await asyncio.wait_for(
            wait_for_publication_to_block_materialization(),
            timeout=5,
        )
        assert publication_backend_pid in blocking_pids
        assert (
            await publication_session.scalar(
                select(models.ProjectSession.id)
                .where(models.ProjectSession.id == second_session_id)
                .with_for_update(nowait=True)
            )
            == second_session_id
        )

    inserted_count, _ = await asyncio.wait_for(materialization, timeout=5)
    assert inserted_count == 4


@pytest.mark.postgres_only
async def test_materialization_waits_for_retention_session_lock(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)

    async def materialize() -> tuple[int, int | None]:
        async with db() as session:
            database_now = await sweeper._database_now(session)
            return await sweeper._sweep(session, database_now)

    async with db() as retention_session:
        await retention_session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(content_complete=False)
        )
        materialization = asyncio.create_task(materialize())
        await asyncio.sleep(0.05)
        assert not materialization.done()

    inserted_count, _ = await asyncio.wait_for(materialization, timeout=5)
    assert inserted_count == 0
    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 0


async def test_session_with_null_liveness_is_never_eligible(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
        project_id = project.id
        assert project_session.last_span_ingested_at is None
    await _seed_criteria(db, project_id, evaluation_target="SESSION")

    await EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 0


async def test_storage_pause_renews_lease_without_materializing(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, last_span_ingested_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    async with db() as session:
        session.add(
            models.EvalWorkLease(
                name=sweeper._lease_name,
                holder=sweeper._sweeper_id,
                heartbeat_at=_now() - timedelta(seconds=30),
            )
        )
    db.should_not_insert_or_update = True

    try:
        await sweeper._tick()
    finally:
        db.should_not_insert_or_update = False

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
        project_session = await session.get(models.ProjectSession, project_session_id)
        assert project_session is not None
        lease = (
            await session.scalars(
                select(models.EvalWorkLease).where(models.EvalWorkLease.name == sweeper._lease_name)
            )
        ).one()
    assert work_count == 0
    assert project_session.last_span_ingested_at == last_span_ingested_at
    assert lease.holder == sweeper._sweeper_id


async def test_terminalizes_exhausted_lapsed_session_lease(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    async with db() as session:
        unit_id = await session.scalar(
            select(models.EvalSessionWorkUnit.id).where(
                models.EvalSessionWorkUnit.project_session_rowid == project_session_id
            )
        )
        assert unit_id is not None
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_id)
            .values(
                status="RUNNING",
                claimed_at=_now() - timedelta(seconds=LEASE_TTL_SECONDS + 1),
                claimed_by="stopped-consumer",
                attempts=MAX_ATTEMPTS - 1,
            )
        )

    await sweeper._tick()

    async with db() as session:
        units = (
            await session.scalars(
                select(models.EvalSessionWorkUnit)
                .where(models.EvalSessionWorkUnit.project_session_rowid == project_session_id)
                .order_by(models.EvalSessionWorkUnit.id)
            )
        ).all()
    (terminal,) = units
    assert terminal.id == unit_id
    assert terminal.status == "ERROR"
    assert terminal.attempts == MAX_ATTEMPTS
    assert terminal.error == LEASE_ATTEMPTS_EXHAUSTED_ERROR


async def test_retained_long_delay_pairs_do_not_block_later_due_pair(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sweeper_module, "_MAX_ELIGIBLE_PAIRS_PER_TICK", 2)
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

    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
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
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == disabled_criteria_id)
            .values(enabled=False)
        )

    resolution_calls = 0

    async def unresolved(
        session: AsyncSession,
        project_evaluator_pairs: Sequence[tuple[models.ProjectEvaluator, models.Evaluator]],
    ) -> list[ResolvedProjectEvaluator | None]:
        nonlocal resolution_calls
        resolution_calls += 1
        resolved = await resolve_project_evaluators_bulk(session, project_evaluator_pairs)
        return [
            None if project_evaluator.id == unresolved_criteria_id else result
            for (project_evaluator, _), result in zip(
                project_evaluator_pairs, resolved, strict=True
            )
        ]

    monkeypatch.setattr(sweeper_module, "resolve_project_evaluators_bulk", unresolved)
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == disabled_criteria_id)
            .values(enabled=True)
        )

    assert resolution_calls == 1
    monkeypatch.setattr(
        sweeper_module, "resolve_project_evaluators_bulk", resolve_project_evaluators_bulk
    )
    await sweeper._tick()
    async with db() as session:
        session_ids = set(
            await session.scalars(select(models.EvalSessionWorkUnit.project_session_rowid))
        )
    assert session_ids == {disabled_session_id, unresolved_session_id}


async def test_closed_admission_gate_skips_evaluator_resolution(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    sweeper._max_outstanding = 0

    async def unexpected_resolution(*_: object) -> list[ResolvedProjectEvaluator | None]:
        pytest.fail("project_evaluator resolution must follow admission")

    monkeypatch.setattr(sweeper_module, "resolve_project_evaluators_bulk", unexpected_resolution)
    async with db() as session:
        database_now = await sweeper._database_now(session)
        assert await sweeper._sweep(session, database_now) == (0, None)


async def test_successful_work_closes_evaluate_once_key(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    await _set_delay(db, project_evaluator_id, 10)
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    async with db() as session:
        await session.execute(update(models.EvalSessionWorkUnit).values(status="DONE"))
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(last_span_ingested_at=_now() - timedelta(seconds=30))
        )

    await sweeper._tick()
    async with db() as session:
        units = list(await session.scalars(select(models.EvalSessionWorkUnit)))
    assert len(units) == 1
    assert units[0].status == "DONE"


async def _work_statuses(db: DbSessionFactory) -> list[str]:
    async with db() as session:
        return list(
            await session.scalars(
                select(models.EvalSessionWorkUnit.status).order_by(models.EvalSessionWorkUnit.id)
            )
        )


async def _advance_liveness(
    db: DbSessionFactory,
    project_session_id: int,
    to: datetime,
) -> None:
    async with db() as session:
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(last_span_ingested_at=to)
        )


async def test_terminal_history_re_materializes_only_after_new_ingest(
    db: DbSessionFactory,
) -> None:
    """Work that will never run again — exhausted ERROR, EXPIRED — carries the ingest
    scheduling snapshot in ``evaluated_through``. Replacing it without newer ingest
    just repeats the same scheduling attempt every tick.
    """
    project_id, project_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    await _set_delay(db, project_evaluator_id, 10)
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()

    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit).values(status="ERROR", attempts=MAX_ATTEMPTS)
        )
    await sweeper._tick()
    await sweeper._tick()
    assert await _work_statuses(db) == ["ERROR"]

    await _advance_liveness(db, project_session_id, _now() - timedelta(seconds=30))
    await sweeper._tick()
    await sweeper._tick()
    assert await _work_statuses(db) == ["ERROR", "PENDING"]

    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.status == "PENDING")
            .values(status="EXPIRED")
        )
    await sweeper._tick()
    assert await _work_statuses(db) == ["ERROR", "EXPIRED"]


async def test_stale_fingerprint_expiration_does_not_close_the_watermark(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=30)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    await _set_delay(db, project_evaluator_id, 10)
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit).values(
                status="EXPIRED",
                error=STALE_FINGERPRINT_ERROR,
            )
        )

    await sweeper._tick()

    assert await _work_statuses(db) == ["EXPIRED", "PENDING"]


async def test_incomplete_session_is_never_scheduled(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        content_complete=False,
    )
    await _seed_criteria(db, project_id, evaluation_target="SESSION")

    await EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)._tick()

    async with db() as session:
        count = await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit))
    assert count == 0


async def test_quiet_session_predating_criterion_creation_is_not_live(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria_raw(db, project_id, evaluation_target="SESSION")

    await EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)._tick()

    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )


async def test_reenabled_criterion_reaches_back_to_creation(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, activity_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    _, project_evaluator_id = await _seed_criteria_raw(
        db,
        project_id,
        evaluation_target="SESSION",
    )
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(created_at=activity_at - timedelta(seconds=1), enabled=False)
        )

    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(enabled=True)
        )

    await sweeper._tick()
    async with db() as session:
        scheduled_session_id = await session.scalar(
            select(models.EvalSessionWorkUnit.project_session_rowid)
        )
    assert scheduled_session_id == project_session_id


async def _rename_project_evaluator(
    db: DbSessionFactory,
    project_evaluator_id: int,
) -> None:
    """Edit the evaluator's configuration, which moves its config fingerprint."""
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(name=Identifier(root=f"renamed-project-evaluator-{token_hex(4)}"))
        )


async def test_edited_criterion_does_not_re_sweep_history_below_its_watermark(
    db: DbSessionFactory,
) -> None:
    """An edit moves the config fingerprint, which opens a fresh dedup key for every
    session the criterion has ever scored. The swept-through watermark is what keeps the
    edit forward-only, matching how span evaluators already behave.
    """
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()

    async with db() as session:
        original_fingerprint = await session.scalar(
            select(models.EvalSessionWorkUnit.config_fingerprint)
        )
        swept_through_at = await session.scalar(
            select(models.ProjectEvaluator.swept_through_at).where(
                models.ProjectEvaluator.id == project_evaluator_id
            )
        )
    assert original_fingerprint is not None
    assert swept_through_at is not None

    await _rename_project_evaluator(db, project_evaluator_id)
    await sweeper._tick()

    async with db() as session:
        fingerprints = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit.config_fingerprint).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        )
    assert fingerprints == [original_fingerprint]


async def test_session_ingested_above_the_watermark_is_swept_after_an_edit(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()

    async with db() as session:
        original_fingerprint = await session.scalar(
            select(models.EvalSessionWorkUnit.config_fingerprint)
        )
    assert original_fingerprint is not None

    await _rename_project_evaluator(db, project_evaluator_id)
    await _advance_liveness(db, project_session_id, _now() - timedelta(seconds=320))
    await sweeper._tick()

    async with db() as session:
        fingerprints = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit.config_fingerprint)
                .where(models.EvalSessionWorkUnit.project_session_rowid == project_session_id)
                .order_by(models.EvalSessionWorkUnit.id)
            )
        )
    assert len(fingerprints) == 2
    assert fingerprints[0] == original_fingerprint
    assert fingerprints[1] != original_fingerprint


async def test_session_without_liveness_becomes_live_after_new_activity(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, resumed_at = await _add_session_liveness(
        db,
        age_seconds=30,
    )
    _, project_evaluator_id = await _seed_criteria_raw(
        db,
        project_id,
        evaluation_target="SESSION",
    )
    await _set_delay(db, project_evaluator_id, 10)
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(created_at=resumed_at - timedelta(seconds=1))
        )
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(last_span_ingested_at=None)
        )

    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == project_session_id)
            .values(last_span_ingested_at=resumed_at)
        )

    await sweeper._tick()
    async with db() as session:
        scheduled_session_id = await session.scalar(
            select(models.EvalSessionWorkUnit.project_session_rowid)
        )
    assert scheduled_session_id == project_session_id


async def test_outstanding_work_ceiling_defers_eligible_pair(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
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
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    acquire_lease = sweeper._acquire_lease

    async def acquire_then_lose_lease(**kwargs: bool) -> int | None:
        lease_id = await acquire_lease(**kwargs)
        assert lease_id is not None
        async with db() as session:
            await session.execute(
                update(models.EvalWorkLease)
                .where(models.EvalWorkLease.id == lease_id)
                .values(holder="replacement-sweeper")
            )
        return lease_id

    monkeypatch.setattr(sweeper, "_acquire_lease", acquire_then_lose_lease)
    with caplog.at_level(logging.WARNING, logger=sweeper_module.__name__):
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
            models.EvalWorkLease(
                name=f"{sweeper_module._SESSION_SWEEP_LEASE_NAME}:default",
                holder="other-sweeper",
                heartbeat_at=_now(),
            )
        )

    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )
        await session.execute(
            update(models.EvalWorkLease)
            .where(models.EvalWorkLease.name == sweeper._lease_name)
            .values(heartbeat_at=_now() - timedelta(seconds=SESSION_SWEEP_LEASE_TTL_SECONDS + 1))
        )
    await sweeper._tick()

    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 1
        )


async def test_session_filter_decisions_are_persisted_before_sampling(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id, matching_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        session_id="matching-session",
    )
    _, declined_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        project_id=project_id,
        session_id="declined-session",
    )
    async with db() as session:
        project = await session.get(models.Project, project_id)
        project_session = await session.get(models.ProjectSession, matching_session_id)
        assert project is not None
        assert project_session is not None
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
    await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        filter_condition="num_traces >= 2",
        sampling_rate=0.5,
    )
    sampled_identities: list[str] = []

    def record_sample(identity: int | str) -> float:
        sampled_identities.append(str(identity))
        return 0.0

    monkeypatch.setattr(sweeper_module, "sample_key", record_sample)
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    sweeper._publish_metrics = True
    async with db() as session:
        project_evaluator = await sweeper._load_evaluators(session)
        database_now = await sweeper._database_now(session)
        materialized_count, eligible_pair_count = await sweeper._load_eligible_pairs(
            session,
            database_now,
            project_evaluator,
            limit=2,
        )

    async with db() as session:
        statuses = {
            row.project_session_rowid: row.status
            for row in (
                await session.execute(
                    select(
                        models.EvalSessionWorkUnit.project_session_rowid,
                        models.EvalSessionWorkUnit.status,
                    )
                )
            ).all()
        }
    assert materialized_count == 1
    assert eligible_pair_count == 1
    assert statuses == {
        matching_session_id: "PENDING",
        declined_session_id: "FILTERED_OUT",
    }
    assert sampled_identities == ["matching-session"]


async def test_filtered_and_unfiltered_criteria_schedule_independently(
    db: DbSessionFactory,
) -> None:
    """An unfiltered criterion and a filtered one compile into separate union arms whose
    bind parameters must stay distinct: sharing a name drops one criterion's identity
    from the statement and hands its arm's rows to the other criterion.
    """
    project_id, matching_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        session_id="matching-session",
    )
    _, excluded_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        project_id=project_id,
        session_id="excluded-session",
    )
    _, unfiltered_criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )
    _, filtered_criteria_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        filter_condition="session_id == 'matching-session'",
    )
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)

    async with db() as session:
        project_evaluator = await sweeper._load_evaluators(session)
        database_now = await sweeper._database_now(session)
        compiled = select(
            sweeper_module._eligible_pairs_relation(
                sweeper._target, project_evaluator, database_now, db.dialect
            )
        ).compile(dialect=session.get_bind().dialect)
    bound_scalars = {
        value for value in compiled.params.values() if not isinstance(value, (list, tuple))
    }
    assert {criterion.project_evaluator_id for criterion in project_evaluator} <= bound_scalars
    assert {criterion.fingerprint for criterion in project_evaluator} <= bound_scalars

    await sweeper._tick()

    async with db() as session:
        units = (await session.scalars(select(models.EvalSessionWorkUnit))).all()
    fingerprints = {
        criterion.project_evaluator_id: criterion.fingerprint for criterion in project_evaluator
    }
    assert {
        (unit.project_evaluator_id, unit.project_session_rowid): unit.status for unit in units
    } == {
        (unfiltered_criteria_id, matching_session_id): "PENDING",
        (unfiltered_criteria_id, excluded_session_id): "PENDING",
        (filtered_criteria_id, matching_session_id): "PENDING",
        (filtered_criteria_id, excluded_session_id): "FILTERED_OUT",
    }
    assert all(unit.config_fingerprint == fingerprints[unit.project_evaluator_id] for unit in units)


async def test_session_sampling_decisions_are_deterministic_and_idempotent(
    db: DbSessionFactory,
) -> None:
    sampled_in = next(identity for identity in map(str, range(100)) if sample_key(identity) < 0.5)
    sampled_out = next(identity for identity in map(str, range(100)) if sample_key(identity) >= 0.5)
    project_id, sampled_in_rowid, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        session_id=sampled_in,
    )
    _, sampled_out_rowid, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        project_id=project_id,
        session_id=sampled_out,
    )
    _, project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        sampling_rate=0.5,
    )
    await _set_delay(db, project_evaluator_id, 10)

    await EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)._tick()
    async with db() as session:
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == sampled_out_rowid)
            .values(last_span_ingested_at=_now() - timedelta(seconds=30))
        )
    await EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)._tick()

    async with db() as session:
        rows = (
            await session.execute(
                select(
                    models.EvalSessionWorkUnit.project_session_rowid,
                    models.EvalSessionWorkUnit.status,
                )
            )
        ).all()
    assert {row.project_session_rowid: row.status for row in rows} == {
        sampled_in_rowid: "PENDING",
        sampled_out_rowid: "SAMPLED_OUT",
    }
    assert len(rows) == 2


async def test_declined_oldest_page_does_not_starve_later_match(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sweeper_module, "_MAX_ELIGIBLE_PAIRS_PER_TICK", 1)
    project_id, declined_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=700,
        session_id="declined-session",
    )
    _, matching_session_id, _ = await _add_session_liveness(
        db,
        age_seconds=600,
        project_id=project_id,
        session_id="matching-session",
    )
    await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        filter_condition="session_id == 'matching-session'",
    )

    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()
    await sweeper._tick()

    async with db() as session:
        statuses = {
            row.project_session_rowid: row.status
            for row in (
                await session.execute(
                    select(
                        models.EvalSessionWorkUnit.project_session_rowid,
                        models.EvalSessionWorkUnit.status,
                    )
                )
            ).all()
        }
    assert statuses == {
        declined_session_id: "FILTERED_OUT",
        matching_session_id: "PENDING",
    }


async def test_trace_criteria_remain_unscheduled(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="TRACE")

    await EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)._tick()
    async with db() as session:
        count = await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit))
    assert count == 0


async def test_sweep_metrics_cover_eligibility_watermark_and_outcomes(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sweeper_module, "get_env_enable_prometheus", lambda: True)
    metric_names = (
        "ONLINE_EVAL_ELIGIBLE_PAIR_BACKLOG",
        "ONLINE_EVAL_RESULT_WATERMARK_LAG_SECONDS",
        "ONLINE_EVAL_MATERIALIZED_WORK_UNITS",
        "ONLINE_EVAL_SWEEP_ATTEMPTS",
        "ONLINE_EVAL_SWEEP_DURATION_SECONDS",
        "ONLINE_EVAL_SWEEP_FAILURES",
        "ONLINE_EVAL_SWEEP_SUCCESSES",
    )
    metrics = {name: Mock() for name in metric_names}
    for name, metric in metrics.items():
        metric.labels.return_value = metric
        monkeypatch.setattr(sweeper_module, name, metric)

    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(db, evaluation_target="SESSION", max_outstanding=_MAX_OUTSTANDING)
    await sweeper._tick()

    metrics["ONLINE_EVAL_ELIGIBLE_PAIR_BACKLOG"].set.assert_called_once_with(1)
    metrics["ONLINE_EVAL_RESULT_WATERMARK_LAG_SECONDS"].set.assert_called_once_with(0.0)
    metrics["ONLINE_EVAL_SWEEP_ATTEMPTS"].inc.assert_called_once_with()
    metrics["ONLINE_EVAL_SWEEP_SUCCESSES"].inc.assert_called_once_with()
    metrics["ONLINE_EVAL_SWEEP_FAILURES"].inc.assert_not_called()
    metrics["ONLINE_EVAL_MATERIALIZED_WORK_UNITS"].inc.assert_called_once_with(1)

    sweeper._max_outstanding = 0
    await sweeper._tick()
    metrics["ONLINE_EVAL_ELIGIBLE_PAIR_BACKLOG"].set.assert_called_once_with(1)
    assert metrics["ONLINE_EVAL_RESULT_WATERMARK_LAG_SECONDS"].set.call_count == 2

    async def fail_sweep(session: AsyncSession, database_now: datetime) -> int:
        raise RuntimeError("failed sweep")

    monkeypatch.setattr(sweeper, "_sweep", fail_sweep)
    with pytest.raises(RuntimeError, match="failed sweep"):
        await sweeper._tick()

    metrics["ONLINE_EVAL_SWEEP_FAILURES"].inc.assert_called_once_with()
    assert metrics["ONLINE_EVAL_SWEEP_DURATION_SECONDS"].observe.call_count == 3


async def test_stop_releases_the_lease_despite_a_second_cancellation(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = EvalSweeper(
        db,
        evaluation_target="SESSION",
        max_outstanding=_MAX_OUTSTANDING,
        tick_interval_seconds=60,
    )
    swept = asyncio.Event()
    released = asyncio.Event()
    tick = sweeper._tick
    release_lease = sweeper._release_lease

    async def _tick_and_signal() -> None:
        await tick()
        swept.set()

    async def _release_and_signal() -> None:
        await release_lease()
        released.set()

    monkeypatch.setattr(sweeper, "_tick", _tick_and_signal)
    monkeypatch.setattr(sweeper, "_release_lease", _release_and_signal)
    sweeper._running = True
    run = asyncio.create_task(sweeper._run())
    await swept.wait()
    assert sweeper._lease_held

    run.cancel()
    await asyncio.sleep(0)
    run.cancel()
    with pytest.raises(asyncio.CancelledError):
        await run
    assert released.is_set()

    async with db() as session:
        lease = (
            await session.scalars(
                select(models.EvalWorkLease).where(models.EvalWorkLease.name == sweeper._lease_name)
            )
        ).one()
    assert lease.holder is None
    assert lease.heartbeat_at is None
