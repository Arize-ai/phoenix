import asyncio
import logging
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Literal, Optional, Sequence
from unittest.mock import Mock

import pytest
from sqlalchemy import delete, event, func, insert, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS
from phoenix.db.types.identifier import Identifier
from phoenix.server.app import _db
from phoenix.server.online_eval import sweeping_producer as sweeping_producer_module
from phoenix.server.online_eval.clock import current_database_time
from phoenix.server.online_eval.derivation import (
    sample_key,
)
from phoenix.server.online_eval.leases import SCAN_LEASE_TTL_SECONDS
from phoenix.server.online_eval.project_evaluator_state import start_at_database_time
from phoenix.server.online_eval.span_producer import SpanEvaluationProducer
from phoenix.server.online_eval.sweeping_producer import (
    SessionEvaluationProducer,
    SweepingEvaluationProducer,
    TraceEvaluationProducer,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace
from .test_span_producer import _seed_code_criteria
from .test_span_producer import _seed_criteria as _seed_criteria_raw


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


async def _add_session_liveness(
    db: DbSessionFactory,
    *,
    age_seconds: float,
    project_id: int | None = None,
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
            .values(last_span_ingested_at=last_span_ingested_at)
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


async def test_queues_due_session_with_activity_snapshot(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, last_span_ingested_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    _, project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
    )

    sweeper = SessionEvaluationProducer(db)
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
                    models.EvalWorkLease.name == sweeper._lease.name,
                )
            )
        ).one()
        live_work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert unit.project_evaluator_id == project_evaluator_id
    assert unit.decided_through == last_span_ingested_at
    assert unit.status == "PENDING"
    assert lease.holder == sweeper._lease.holder
    assert live_work_count == 1


async def test_queues_with_501_schedulable_criteria(
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

    await SessionEvaluationProducer(db)._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 501


@pytest.mark.parametrize("evaluation_target", ["TRACE", "SESSION"])
async def test_sweep_position_never_moves_back_past_an_enable(
    db: DbSessionFactory, evaluation_target: models.EvaluationTarget
) -> None:
    """An enable starts the sweep at now, ahead of the due time a sweep would write."""
    async with db() as session:
        project = await _add_project(session)
    _, project_evaluator_id = await _seed_criteria(
        db, project.id, evaluation_target=evaluation_target
    )
    await _set_delay(db, project_evaluator_id, 300)
    async with db() as session:
        await start_at_database_time(session, project_evaluator_id)

    async def swept_through_at() -> datetime | None:
        async with db() as session:
            return await session.scalar(
                select(models.ProjectEvaluatorState.swept_through_at).where(
                    models.ProjectEvaluatorState.project_evaluator_id == project_evaluator_id
                )
            )

    enabled_at = await swept_through_at()
    assert enabled_at is not None
    producer = (
        TraceEvaluationProducer(db)
        if evaluation_target == "TRACE"
        else SessionEvaluationProducer(db)
    )
    await producer._tick()
    assert await swept_through_at() == enabled_at


async def test_sweep_position_reaches_a_full_page_or_the_due_time(
    db: DbSessionFactory,
) -> None:
    """A full page advances its evaluators to the newest activity it reached; a short page
    advances every evaluator to its due horizon."""
    project_id, _, oldest_activity_at = await _add_session_liveness(db, age_seconds=700)
    await _add_session_liveness(db, age_seconds=600, project_id=project_id)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    await _set_delay(db, project_evaluator_id, 300)
    sweeper = SessionEvaluationProducer(db)

    async def sweep_page(limit: int) -> datetime:
        async with db() as session:
            project_evaluators = await sweeper._load_evaluators(session)
            database_now = await current_database_time(session, db.dialect)
            await sweeper._decide_due_evaluations(
                session,
                database_now,
                project_evaluators,
                limit=limit,
            )
        return database_now

    async def swept_through_at() -> datetime | None:
        async with db() as session:
            return await session.scalar(
                select(models.ProjectEvaluatorState.swept_through_at).where(
                    models.ProjectEvaluatorState.project_evaluator_id == project_evaluator_id
                )
            )

    await sweep_page(limit=1)
    assert await swept_through_at() == oldest_activity_at

    database_now = await sweep_page(limit=2)
    assert await swept_through_at() == database_now - timedelta(seconds=300)


def _run_one_tick(
    sweeper: SweepingEvaluationProducer, monkeypatch: pytest.MonkeyPatch
) -> asyncio.Task[None]:
    """Run the sweeper's loop, which logs a failed tick, for a single tick."""
    tick = sweeper._tick

    async def tick_once() -> bool:
        sweeper._running = False
        return await tick()

    monkeypatch.setattr(sweeper, "_tick", tick_once)
    sweeper._running = True
    return asyncio.create_task(sweeper._run())


@pytest.mark.postgres_only
@pytest.mark.parametrize("deleted_row", ["project_evaluator", "session"])
async def test_sweep_rolled_back_by_a_concurrent_delete_decides_the_survivors_on_the_next_tick(
    postgresql_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
    deleted_row: str,
) -> None:
    """A tick that gives way to a delete holding a row it needs writes nothing, its sweep
    positions included, so the next tick decides every evaluation that survived."""
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    project_id, deleted_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, surviving_session_id, _ = await _add_session_liveness(
        db, age_seconds=600, project_id=project_id
    )
    _, deleted_project_evaluator_id = await _seed_criteria(
        db, project_id, evaluation_target="SESSION"
    )
    _, surviving_project_evaluator_id = await _seed_criteria(
        db, project_id, evaluation_target="SESSION"
    )
    if deleted_row == "project_evaluator":
        deletion = delete(models.ProjectEvaluator).where(
            models.ProjectEvaluator.id == deleted_project_evaluator_id
        )
        project_evaluator_ids = {surviving_project_evaluator_id}
        session_ids = {deleted_session_id, surviving_session_id}
    else:
        deletion = delete(models.ProjectSession).where(
            models.ProjectSession.id == deleted_session_id
        )
        project_evaluator_ids = {deleted_project_evaluator_id, surviving_project_evaluator_id}
        session_ids = {surviving_session_id}
    sweeper = SessionEvaluationProducer(db, tick_interval_seconds=0)
    tick = sweeper._tick

    async def swept_through_at() -> set[datetime | None]:
        async with db() as session:
            return set(
                await session.scalars(
                    select(models.ProjectEvaluatorState.swept_through_at)
                    .select_from(models.ProjectEvaluator)
                    .outerjoin(
                        models.ProjectEvaluatorState,
                        models.ProjectEvaluatorState.project_evaluator_id
                        == models.ProjectEvaluator.id,
                    )
                    .where(models.ProjectEvaluator.id.in_(project_evaluator_ids))
                )
            )

    async with db() as deletion_session:
        await deletion_session.execute(deletion)
        await asyncio.wait_for(_run_one_tick(sweeper, monkeypatch), timeout=5)

    assert await _work_statuses(db) == []
    assert await swept_through_at() == {None}

    await tick()

    async with db() as session:
        decided = set(
            (
                await session.execute(
                    select(
                        models.EvalSessionWorkUnit.project_evaluator_id,
                        models.EvalSessionWorkUnit.project_session_rowid,
                    )
                )
            ).tuples()
        )
    assert decided == {
        (project_evaluator_id, session_id)
        for project_evaluator_id in project_evaluator_ids
        for session_id in session_ids
    }
    assert None not in await swept_through_at()


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

    await SessionEvaluationProducer(db)._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 0


async def test_storage_pause_renews_lease_without_sweeping(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, last_span_ingested_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvaluationProducer(db)
    async with db() as session:
        session.add(
            models.EvalWorkLease(
                name=sweeper._lease.name,
                holder=sweeper._lease.holder,
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
                select(models.EvalWorkLease).where(models.EvalWorkLease.name == sweeper._lease.name)
            )
        ).one()
    assert work_count == 0
    assert project_session.last_span_ingested_at == last_span_ingested_at
    assert lease.holder == sweeper._lease.holder


async def test_retained_long_delay_pairs_do_not_block_later_due_pair(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sweeping_producer_module, "_MAX_EVALUATIONS_PER_TICK", 2)
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

    sweeper = SessionEvaluationProducer(db)
    await sweeper._tick()
    await sweeper._tick()

    async with db() as session:
        queued_session_ids = set(
            await session.scalars(select(models.EvalSessionWorkUnit.project_session_rowid))
        )
    assert queued_session_ids == {
        retained_session_1,
        retained_session_2,
        due_session_id,
    }


_WORK_UNITS: dict[str, tuple[Any, Any]] = {
    "SPAN": (models.EvalWorkUnit, models.EvalWorkUnit.span_rowid),
    "TRACE": (models.EvalTraceWorkUnit, models.EvalTraceWorkUnit.trace_rowid),
    "SESSION": (models.EvalSessionWorkUnit, models.EvalSessionWorkUnit.project_session_rowid),
}


async def _add_quiet_targets(
    db: DbSessionFactory,
    project_id: int,
    evaluation_target: Literal["TRACE", "SESSION"],
    count: int,
    *,
    age_seconds: float,
) -> list[int]:
    """Add ``count`` traces or sessions, each holding one span last ingested ``age_seconds``
    ago, returning their row ids."""
    ingested_at = _now() - timedelta(seconds=age_seconds)
    async with db() as session:
        session_rowids: list[Optional[int]] = [None] * count
        if evaluation_target == "SESSION":
            session_rowids = list(
                await session.scalars(
                    insert(models.ProjectSession).returning(models.ProjectSession.id),
                    [
                        {
                            "session_id": token_hex(8),
                            "project_id": project_id,
                            "start_time": ingested_at,
                            "end_time": ingested_at,
                            "last_span_ingested_at": ingested_at,
                        }
                        for _ in range(count)
                    ],
                )
            )
        trace_rowids = list(
            await session.scalars(
                insert(models.Trace).returning(models.Trace.id),
                [
                    {
                        "trace_id": token_hex(16),
                        "project_rowid": project_id,
                        "project_session_rowid": session_rowid,
                        "start_time": ingested_at,
                        "end_time": ingested_at,
                        "last_span_ingested_at": ingested_at,
                    }
                    for session_rowid in session_rowids
                ],
            )
        )
        await session.execute(
            insert(models.Span),
            [
                {
                    "trace_rowid": trace_rowid,
                    "span_id": token_hex(8),
                    "name": "root",
                    "span_kind": "CHAIN",
                    "start_time": ingested_at,
                    "end_time": ingested_at,
                    "attributes": {},
                    "events": [],
                    "status_code": "OK",
                    "status_message": "",
                    "cumulative_error_count": 0,
                    "cumulative_llm_token_count_prompt": 0,
                    "cumulative_llm_token_count_completion": 0,
                }
                for trace_rowid in trace_rowids
            ],
        )
    if evaluation_target == "SESSION":
        return [session_rowid for session_rowid in session_rowids if session_rowid is not None]
    return trace_rowids


async def _queued_targets(
    db: DbSessionFactory, evaluation_target: str, project_evaluator_id: int
) -> set[int]:
    work_unit_model, target_column = _WORK_UNITS[evaluation_target]
    async with db() as session:
        return set(
            await session.scalars(
                select(target_column).where(
                    work_unit_model.project_evaluator_id == project_evaluator_id,
                    work_unit_model.status == "PENDING",
                )
            )
        )


@pytest.mark.parametrize("evaluation_target", ["TRACE", "SESSION"])
async def test_waiting_work_does_not_stop_the_sweeping_producers_queuing_newly_quiet_targets(
    db: DbSessionFactory,
    evaluation_target: Literal["TRACE", "SESSION"],
) -> None:
    """Overload shows as waiting work, never as a producer that fell behind."""
    async with db() as session:
        project = await _add_project(session)
    _, project_evaluator_id = await _seed_criteria(
        db, project.id, evaluation_target=evaluation_target
    )
    delay = timedelta(seconds=models.DEFAULT_EVALUATION_DELAY_SECONDS)
    producer = (
        TraceEvaluationProducer(db)
        if evaluation_target == "TRACE"
        else SessionEvaluationProducer(db)
    )
    backlog = await _add_quiet_targets(
        db,
        project.id,
        evaluation_target,
        sweeping_producer_module._MAX_EVALUATIONS_PER_TICK + 1,
        age_seconds=2 * delay.total_seconds(),
    )
    while await producer._tick():
        pass
    assert await _queued_targets(db, evaluation_target, project_evaluator_id) == set(backlog)

    arrivals: list[int] = []
    for _ in range(3):
        arrivals += await _add_quiet_targets(
            db, project.id, evaluation_target, 1, age_seconds=delay.total_seconds() + 1
        )
        async with db() as session:
            before = await current_database_time(session, db.dialect)
        await producer._tick()
        async with db() as session:
            after = await current_database_time(session, db.dialect)
            sweep_position = await session.scalar(
                select(models.ProjectEvaluatorState.swept_through_at).where(
                    models.ProjectEvaluatorState.project_evaluator_id == project_evaluator_id
                )
            )
        assert await _queued_targets(db, evaluation_target, project_evaluator_id) == set(
            backlog
        ) | set(arrivals)
        assert sweep_position is not None
        assert before - delay <= sweep_position <= after - delay


@pytest.mark.parametrize("evaluation_target", ["SPAN", "TRACE", "SESSION"])
async def test_a_lower_sampling_rate_queues_a_subset_of_what_a_higher_one_queues(
    db: DbSessionFactory,
    evaluation_target: models.EvaluationTarget,
) -> None:
    """Sampling nests: a target a lower rate queues, any higher rate on it queues too."""
    async with db() as session:
        project = await _add_project(session)
    _, lower_rate_id = await _seed_criteria(
        db, project.id, evaluation_target=evaluation_target, sampling_rate=0.3
    )
    _, higher_rate_id = await _seed_criteria(
        db, project.id, evaluation_target=evaluation_target, sampling_rate=0.7
    )
    if evaluation_target == "SPAN":
        span_producer = SpanEvaluationProducer(db, visibility_lag_seconds=0)
        await span_producer._tick()
        async with db() as session:
            trace = await _add_trace(session, project)
            for _ in range(50):
                await _add_span(session, trace)
        await span_producer._tick()
        await span_producer._tick()
    else:
        await _add_quiet_targets(db, project.id, evaluation_target, 50, age_seconds=600)
        await (
            TraceEvaluationProducer(db)
            if evaluation_target == "TRACE"
            else SessionEvaluationProducer(db)
        )._tick()

    lower = await _queued_targets(db, evaluation_target, lower_rate_id)
    higher = await _queued_targets(db, evaluation_target, higher_rate_id)
    assert lower and higher
    assert lower <= higher


async def test_full_sweeper_page_that_decides_nothing_waits_the_interval(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sweeping_producer_module, "_MAX_EVALUATIONS_PER_TICK", 1)
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _add_session_liveness(db, age_seconds=600, project_id=project_id)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvaluationProducer(db)

    async def every_filter_fails(*_: object) -> dict[tuple[int, int], bool]:
        return {}

    monkeypatch.setattr(sweeper, "_read_filter_verdicts", every_filter_fails)

    assert await sweeper._tick() is False
    assert await _work_statuses(db) == []


async def test_an_evaluator_with_no_resolvable_version_catches_up_once_it_resolves(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id, sandbox_config_id = await _seed_code_criteria(
        db, project_id, evaluation_target="SESSION"
    )

    async def set_sandbox_enabled(enabled: bool) -> None:
        async with db() as session:
            await session.execute(
                update(models.SandboxConfig)
                .where(models.SandboxConfig.id == sandbox_config_id)
                .values(enabled=enabled)
            )

    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(created_at=_now() - timedelta(days=1))
        )
    await set_sandbox_enabled(False)
    sweeper = SessionEvaluationProducer(db)
    await sweeper._tick()
    assert await _work_statuses(db) == []

    await set_sandbox_enabled(True)
    await sweeper._tick()
    async with db() as session:
        queued = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit.project_session_rowid).where(
                    models.EvalSessionWorkUnit.status == "PENDING"
                )
            )
        )
    assert queued == [project_session_id]


async def test_successful_work_closes_evaluate_once_key(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    await _set_delay(db, project_evaluator_id, 10)
    sweeper = SessionEvaluationProducer(db)
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


@pytest.mark.parametrize("evaluation_target", ["SESSION", "TRACE"])
@pytest.mark.parametrize("status", ["FAILED", "EXPIRED", "DROPPED", "CONTENT_LOST"])
async def test_work_ended_without_a_result_is_re_offered_in_place_after_new_ingest(
    db: DbSessionFactory,
    evaluation_target: models.EvaluationTarget,
    status: models.SweptTargetWorkStatus,
) -> None:
    """Work that ended without a result carries the activity it was scheduled for in
    ``decided_through``, so it is offered again only once its target has newer activity.
    """
    sweeper = (
        SessionEvaluationProducer(db)
        if evaluation_target == "SESSION"
        else TraceEvaluationProducer(db)
    )
    target_model = sweeper._target.target_model
    work_unit_model = sweeper._target.work_unit_model
    if evaluation_target == "SESSION":
        project_id, target_rowid, _ = await _add_session_liveness(db, age_seconds=600)
    else:
        project_id, target_rowid, _ = await _add_trace_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target=evaluation_target,
    )
    await _set_delay(db, project_evaluator_id, 10)
    await sweeper._tick()

    async with db() as session:
        unit_id = await session.scalar(select(work_unit_model.id))
        await session.execute(
            update(work_unit_model).values(
                status=status,
                attempts=MAX_ATTEMPTS,
                error="provider failed",
                claimed_by="consumer",
                claimed_at=_now(),
                cooldown_until=_now() + timedelta(minutes=5),
                created_at=_now() - timedelta(days=2),
            )
        )
    await sweeper._tick()
    async with db() as session:
        assert list(await session.scalars(select(work_unit_model.status))) == [status]

    new_ingest_at = _now() - timedelta(seconds=30)
    async with db() as session:
        await session.execute(
            update(target_model)
            .where(target_model.id == target_rowid)
            .values(last_span_ingested_at=new_ingest_at)
        )
    await sweeper._tick()
    async with db() as session:
        (unit,) = (await session.scalars(select(work_unit_model))).all()
    assert isinstance(unit, (models.EvalSessionWorkUnit, models.EvalTraceWorkUnit))
    assert unit.id == unit_id
    assert unit.status == "PENDING"
    assert unit.decided_through == new_ingest_at
    assert unit.attempts == 0
    assert unit.error is None
    assert unit.claimed_by is None
    assert unit.claimed_at is None
    assert unit.cooldown_until is None
    assert unit.created_at > new_ingest_at


@pytest.mark.parametrize("declined_status", ["FILTERED_OUT", "SAMPLED_OUT"])
async def test_re_offer_that_lands_declined_is_final(
    db: DbSessionFactory,
    declined_status: models.SweptTargetWorkStatus,
) -> None:
    project_id, project_session_id, first_ingest_at = await _add_session_liveness(
        db,
        age_seconds=600,
    )
    _, project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        filter_condition="num_traces >= 2" if declined_status == "FILTERED_OUT" else "",
        sampling_rate=0.0 if declined_status == "SAMPLED_OUT" else 1.0,
    )
    await _set_delay(db, project_evaluator_id, 10)
    async with db() as session:
        failed_unit = models.EvalSessionWorkUnit(
            project_session_rowid=project_session_id,
            project_evaluator_id=project_evaluator_id,
            decided_through=first_ingest_at,
            status="FAILED",
            attempts=MAX_ATTEMPTS,
        )
        session.add(failed_unit)
        await session.flush()
        unit_id = failed_unit.id
    sweeper = SessionEvaluationProducer(db)

    async def the_only_unit() -> models.EvalSessionWorkUnit:
        async with db() as session:
            (unit,) = (await session.scalars(select(models.EvalSessionWorkUnit))).all()
        assert unit.id == unit_id
        return unit

    re_offered_at = _now() - timedelta(seconds=60)
    await _advance_liveness(db, project_session_id, re_offered_at)
    await sweeper._tick()
    unit = await the_only_unit()
    assert unit.status == declined_status
    assert unit.decided_through == re_offered_at

    await _advance_liveness(db, project_session_id, _now() - timedelta(seconds=30))
    await sweeper._tick()
    unit = await the_only_unit()
    assert unit.status == declined_status
    assert unit.decided_through == re_offered_at


async def test_quiet_session_predating_criterion_creation_is_not_live(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=330)
    await _seed_criteria_raw(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvaluationProducer(db)

    await sweeper._tick()
    await sweeper._tick()

    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )


async def _rename_project_evaluator(
    db: DbSessionFactory,
    project_evaluator_id: int,
) -> None:
    """Edit the evaluator's configuration."""
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == project_evaluator_id)
            .values(name=Identifier(root=f"renamed-project-evaluator-{token_hex(4)}"))
        )


async def test_edited_criterion_does_not_re_sweep_history_below_its_sweep_position(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvaluationProducer(db)
    await sweeper._tick()

    async with db() as session:
        original_unit_id = await session.scalar(select(models.EvalSessionWorkUnit.id))
        swept_through_at = await session.scalar(
            select(models.ProjectEvaluatorState.swept_through_at).where(
                models.ProjectEvaluatorState.project_evaluator_id == project_evaluator_id
            )
        )
    assert original_unit_id is not None
    assert swept_through_at is not None

    await _rename_project_evaluator(db, project_evaluator_id)
    await sweeper._tick()

    async with db() as session:
        unit_ids = list(
            await session.scalars(
                select(models.EvalSessionWorkUnit.id).where(
                    models.EvalSessionWorkUnit.project_session_rowid == project_session_id
                )
            )
        )
    assert unit_ids == [original_unit_id]


async def test_evaluated_session_is_not_re_evaluated_after_an_edit(
    db: DbSessionFactory,
) -> None:
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvaluationProducer(db)
    await sweeper._tick()
    async with db() as session:
        await session.execute(update(models.EvalSessionWorkUnit).values(status="DONE"))

    await _rename_project_evaluator(db, project_evaluator_id)
    await _advance_liveness(db, project_session_id, _now() - timedelta(seconds=320))
    await sweeper._tick()

    assert await _work_statuses(db) == ["DONE"]


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

    sweeper = SessionEvaluationProducer(db)
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


async def test_sweep_is_kept_when_the_lease_is_lost_mid_tick(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvaluationProducer(db)
    run_sweep = sweeper._run_sweep

    async def lose_lease_then_sweep() -> None:
        async with db() as session:
            await session.execute(
                update(models.EvalWorkLease)
                .where(models.EvalWorkLease.name == sweeper._lease.name)
                .values(holder="replacement-sweeper")
            )
        await run_sweep()

    monkeypatch.setattr(sweeper, "_run_sweep", lose_lease_then_sweep)
    with caplog.at_level(logging.WARNING):
        await sweeper._tick()

    async with db() as session:
        work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert work_count == 1
    assert "Lost the online-eval session-producer lease" in caplog.text


async def test_live_session_lease_stands_down_and_stale_lease_is_reclaimed(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    async with db() as session:
        session.add(
            models.EvalWorkLease(
                name="session-producer",
                holder="other-sweeper",
                heartbeat_at=_now(),
            )
        )

    sweeper = SessionEvaluationProducer(db)
    await sweeper._tick()
    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 0
        )
        await session.execute(
            update(models.EvalWorkLease)
            .where(models.EvalWorkLease.name == sweeper._lease.name)
            .values(heartbeat_at=_now() - timedelta(seconds=SCAN_LEASE_TTL_SECONDS + 1))
        )
    await sweeper._tick()

    async with db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit)) == 1
        )


async def test_session_filter_is_evaluated_against_page_rowids_before_sampling(
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

    monkeypatch.setattr(sweeping_producer_module, "sample_key", record_sample)
    sweeper = SessionEvaluationProducer(db)
    sweeper._publish_metrics = True
    filter_statements: list[tuple[str, Sequence[object]]] = []

    def capture_filter_statement(
        connection: object,
        cursor: object,
        statement: str,
        parameters: Sequence[object],
        context: object,
        executemany: bool,
    ) -> None:
        if "project_sessions.id IN" in statement:
            filter_statements.append((statement, parameters))

    event.listen(Engine, "before_cursor_execute", capture_filter_statement)
    try:
        async with db() as session:
            project_evaluator = await sweeper._load_evaluators(session)
            database_now = await current_database_time(session, db.dialect)
            outcome = await sweeper._decide_due_evaluations(
                session,
                database_now,
                project_evaluator,
                limit=2,
            )
    finally:
        event.remove(Engine, "before_cursor_execute", capture_filter_statement)

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
    assert outcome.queued_count == 1
    assert outcome.eligible_count == 1
    assert statuses == {
        matching_session_id: "PENDING",
        declined_session_id: "FILTERED_OUT",
    }
    assert sampled_identities == ["matching-session"]
    assert len(filter_statements) == 1
    filter_statement, filter_parameters = filter_statements[0]
    assert "project_sessions.id IN (" in " ".join(filter_statement.split())
    assert {matching_session_id, declined_session_id} <= set(filter_parameters)


async def test_filtered_and_unfiltered_criteria_schedule_independently(
    db: DbSessionFactory,
) -> None:
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
    sweeper = SessionEvaluationProducer(db)

    async with db() as session:
        project_evaluator = await sweeper._load_evaluators(session)
        database_now = await current_database_time(session, db.dialect)
        compiled = select(
            sweeping_producer_module._due_evaluations_relation(
                sweeper._target, project_evaluator, database_now, db.dialect
            )
        ).compile(dialect=session.get_bind().dialect)
    bound_scalars = {
        value for value in compiled.params.values() if not isinstance(value, (list, tuple))
    }
    assert {criterion.project_evaluator_id for criterion in project_evaluator} <= bound_scalars

    await sweeper._tick()

    async with db() as session:
        units = (await session.scalars(select(models.EvalSessionWorkUnit))).all()
    assert {
        (unit.project_evaluator_id, unit.project_session_rowid): unit.status for unit in units
    } == {
        (unfiltered_criteria_id, matching_session_id): "PENDING",
        (unfiltered_criteria_id, excluded_session_id): "PENDING",
        (filtered_criteria_id, matching_session_id): "PENDING",
        (filtered_criteria_id, excluded_session_id): "FILTERED_OUT",
    }


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

    await SessionEvaluationProducer(db)._tick()
    async with db() as session:
        await session.execute(
            update(models.ProjectSession)
            .where(models.ProjectSession.id == sampled_out_rowid)
            .values(last_span_ingested_at=_now() - timedelta(seconds=30))
        )
    await SessionEvaluationProducer(db)._tick()

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
    monkeypatch.setattr(sweeping_producer_module, "_MAX_EVALUATIONS_PER_TICK", 1)
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

    sweeper = SessionEvaluationProducer(db)
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


async def test_trace_criteria_do_not_reach_the_session_sweeper(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="TRACE")

    await SessionEvaluationProducer(db)._tick()
    async with db() as session:
        count = await session.scalar(select(func.count()).select_from(models.EvalSessionWorkUnit))
    assert count == 0


async def _add_trace_liveness(
    db: DbSessionFactory,
    *,
    age_seconds: float,
) -> tuple[int, int, datetime]:
    last_span_ingested_at = _now() - timedelta(seconds=age_seconds)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        await _add_span(session, trace)
        await session.execute(
            update(models.Trace)
            .where(models.Trace.id == trace.id)
            .values(last_span_ingested_at=last_span_ingested_at)
        )
        return project.id, trace.id, last_span_ingested_at


async def test_sweep_records_its_position_without_touching_the_evaluator_row(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_trace_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="TRACE")
    async with db() as session:
        updated_at = await session.scalar(
            select(models.ProjectEvaluator.updated_at).where(
                models.ProjectEvaluator.id == project_evaluator_id
            )
        )

    await TraceEvaluationProducer(db)._tick()

    async with db() as session:
        state = await session.get(models.ProjectEvaluatorState, project_evaluator_id)
        assert state is not None and state.swept_through_at is not None
        assert (
            await session.scalar(
                select(models.ProjectEvaluator.updated_at).where(
                    models.ProjectEvaluator.id == project_evaluator_id
                )
            )
            == updated_at
        )


async def test_queues_due_trace_with_activity_snapshot(
    db: DbSessionFactory,
) -> None:
    project_id, trace_rowid, last_span_ingested_at = await _add_trace_liveness(
        db,
        age_seconds=600,
    )
    _, project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="TRACE",
    )

    sweeper = TraceEvaluationProducer(db)
    await sweeper._tick()

    async with db() as session:
        unit = (
            await session.scalars(
                select(models.EvalTraceWorkUnit).where(
                    models.EvalTraceWorkUnit.trace_rowid == trace_rowid
                )
            )
        ).one()
        lease = (
            await session.scalars(
                select(models.EvalWorkLease).where(
                    models.EvalWorkLease.name == sweeper._lease.name,
                )
            )
        ).one()
        session_work_count = await session.scalar(
            select(func.count()).select_from(models.EvalSessionWorkUnit)
        )
    assert unit.project_evaluator_id == project_evaluator_id
    assert unit.decided_through == last_span_ingested_at
    assert unit.status == "PENDING"
    assert lease.holder == sweeper._lease.holder
    assert session_work_count == 0


async def test_trace_filter_is_evaluated_against_page_rowids(
    db: DbSessionFactory,
) -> None:
    project_id, matching_trace_rowid, last_span_ingested_at = await _add_trace_liveness(
        db,
        age_seconds=600,
    )
    async with db() as session:
        project = await session.get(models.Project, project_id)
        matching_trace = await session.get(models.Trace, matching_trace_rowid)
        assert project is not None
        assert matching_trace is not None
        matching_trace.trace_id = "matching-trace"
        excluded_trace = await _add_trace(session, project)
        await _add_span(session, excluded_trace)
        await session.execute(
            update(models.Trace)
            .where(models.Trace.id == excluded_trace.id)
            .values(last_span_ingested_at=last_span_ingested_at)
        )
        excluded_trace_rowid = excluded_trace.id
    await _seed_criteria(
        db,
        project_id,
        evaluation_target="TRACE",
        filter_condition="trace_id == 'matching-trace'",
    )
    filter_statements: list[tuple[str, Sequence[object]]] = []

    def capture_filter_statement(
        connection: object,
        cursor: object,
        statement: str,
        parameters: Sequence[object],
        context: object,
        executemany: bool,
    ) -> None:
        if "traces.id IN" in statement:
            filter_statements.append((statement, parameters))

    event.listen(Engine, "before_cursor_execute", capture_filter_statement)
    try:
        await TraceEvaluationProducer(db)._tick()
    finally:
        event.remove(Engine, "before_cursor_execute", capture_filter_statement)

    async with db() as session:
        statuses = {
            row.trace_rowid: row.status
            for row in (
                await session.execute(
                    select(
                        models.EvalTraceWorkUnit.trace_rowid,
                        models.EvalTraceWorkUnit.status,
                    )
                )
            ).all()
        }
    assert statuses == {
        matching_trace_rowid: "PENDING",
        excluded_trace_rowid: "FILTERED_OUT",
    }
    assert len(filter_statements) == 1
    filter_statement, filter_parameters = filter_statements[0]
    assert "traces.id IN (" in " ".join(filter_statement.split())
    assert {matching_trace_rowid, excluded_trace_rowid} <= set(filter_parameters)


async def test_trace_evaluator_with_an_uncompilable_filter_does_not_stop_the_tick(
    db: DbSessionFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A TRACE filter written in the span language is skipped, not raised for the tick."""
    project_id, _, _ = await _add_trace_liveness(db, age_seconds=600)
    _, uncompilable_project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="TRACE",
        filter_condition="span_kind == 'LLM'",
    )
    _, compilable_project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="TRACE",
        filter_condition="latency_ms >= 0",
    )

    sweeper = TraceEvaluationProducer(db)
    with caplog.at_level(logging.WARNING, logger=sweeping_producer_module.__name__):
        await sweeper._tick()

    async with db() as session:
        statuses = {
            row.project_evaluator_id: row.status
            for row in (
                await session.execute(
                    select(
                        models.EvalTraceWorkUnit.project_evaluator_id,
                        models.EvalTraceWorkUnit.status,
                    )
                )
            ).all()
        }
    assert statuses == {compilable_project_evaluator_id: "PENDING"}
    assert (
        f"Skipping project_evaluator {uncompilable_project_evaluator_id}: "
        "filter condition does not compile for TRACE evaluation: invalid name `span_kind`"
    ) in caplog.text


async def test_filter_that_fails_when_run_skips_only_its_own_evaluator(
    db: DbSessionFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _add_session_liveness(db, age_seconds=600, project_id=project_id)
    other_project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    _, broken_project_evaluator_id = await _seed_criteria(
        db,
        project_id,
        evaluation_target="SESSION",
        # Compiles, but the literal is out of range for the column it is compared with.
        filter_condition="token_count_total > 99999999999999999999",
    )
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    _, other_project_evaluator_id = await _seed_criteria(
        db, other_project_id, evaluation_target="SESSION"
    )
    sweeper = SessionEvaluationProducer(db)

    with caplog.at_level(logging.WARNING, logger=sweeping_producer_module.__name__):
        await sweeper._tick()

    async with db() as session:
        work_counts = {
            project_evaluator_id: count
            for project_evaluator_id, count in await session.execute(
                select(models.EvalSessionWorkUnit.project_evaluator_id, func.count())
                .where(models.EvalSessionWorkUnit.status == "PENDING")
                .group_by(models.EvalSessionWorkUnit.project_evaluator_id)
            )
        }
    assert work_counts == {project_evaluator_id: 2, other_project_evaluator_id: 1}
    (record,) = [
        record
        for record in caplog.records
        if f"project_evaluator {broken_project_evaluator_id} " in record.getMessage()
    ]
    assert "filter condition failed when run" in record.getMessage()


async def test_sweep_metrics_cover_eligibility_decided_through_and_outcomes(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sweeping_producer_module, "get_env_enable_prometheus", lambda: True)
    metric_names = (
        "ONLINE_EVAL_SWEEP_ELIGIBLE_EVALUATIONS",
        "ONLINE_EVAL_DECIDED_THROUGH_LAG_SECONDS",
        "ONLINE_EVAL_ADDED_WORK_UNITS",
        "ONLINE_EVAL_SWEEP_ATTEMPTS",
        "ONLINE_EVAL_SWEEP_DURATION_SECONDS",
        "ONLINE_EVAL_SWEEP_FAILURES",
        "ONLINE_EVAL_SWEEP_SUCCESSES",
    )
    metrics = {name: Mock() for name in metric_names}
    for name, metric in metrics.items():
        metric.labels.return_value = metric
        monkeypatch.setattr(sweeping_producer_module, name, metric)

    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, project_id, evaluation_target="SESSION")
    sweeper = SessionEvaluationProducer(db)
    await sweeper._tick()

    metrics["ONLINE_EVAL_SWEEP_ELIGIBLE_EVALUATIONS"].set.assert_called_once_with(1)
    metrics["ONLINE_EVAL_DECIDED_THROUGH_LAG_SECONDS"].set.assert_called_once_with(0.0)
    metrics["ONLINE_EVAL_SWEEP_ATTEMPTS"].inc.assert_called_once_with()
    metrics["ONLINE_EVAL_SWEEP_SUCCESSES"].inc.assert_called_once_with()
    metrics["ONLINE_EVAL_SWEEP_FAILURES"].inc.assert_not_called()
    metrics["ONLINE_EVAL_ADDED_WORK_UNITS"].inc.assert_called_once_with(1)

    await sweeper._tick()
    metrics["ONLINE_EVAL_SWEEP_ELIGIBLE_EVALUATIONS"].set.assert_called_with(0)
    assert metrics["ONLINE_EVAL_DECIDED_THROUGH_LAG_SECONDS"].set.call_count == 2

    async def fail_sweep(session: AsyncSession, database_now: datetime) -> int:
        raise RuntimeError("failed sweep")

    monkeypatch.setattr(sweeper, "_sweep", fail_sweep)
    with pytest.raises(RuntimeError, match="failed sweep"):
        await sweeper._tick()

    metrics["ONLINE_EVAL_SWEEP_FAILURES"].inc.assert_called_once_with()
    assert metrics["ONLINE_EVAL_SWEEP_DURATION_SECONDS"].observe.call_count == 3
