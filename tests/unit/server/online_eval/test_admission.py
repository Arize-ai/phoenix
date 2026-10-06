import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval import admission
from phoenix.server.online_eval import sweeper as sweeper_module
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.online_eval.queue_health import load_evaluation_queue
from phoenix.server.online_eval.sweeper import EvalSweeper
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span, _add_trace
from .test_producer import _now, _seed_cursor
from .test_producer import _seed_criteria as _seed_span_criteria
from .test_session_sweeper import _add_session_liveness, _add_trace_liveness, _seed_criteria


async def _queued_by_target(db: DbSessionFactory) -> list[int]:
    queue = await load_evaluation_queue(db)
    return [target.queued_count for target in queue.targets]


async def test_span_work_filling_the_queue_drops_the_trace_and_session_batches(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_OUTSTANDING", "2")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(2)]
    _, span_project_evaluator_id = await _seed_span_criteria(db, project.id)
    async with db() as session:
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=span.id, project_evaluator_id=span_project_evaluator_id
                )
                for span in spans
            ]
        )
    trace_project_id, _, _ = await _add_trace_liveness(db, age_seconds=600)
    await _seed_criteria(db, trace_project_id, evaluation_target="TRACE")
    session_project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    await _seed_criteria(db, session_project_id, evaluation_target="SESSION")
    sweepers = [
        EvalSweeper(db, evaluation_target="TRACE"),
        EvalSweeper(db, evaluation_target="SESSION"),
    ]

    for sweeper in sweepers:
        await sweeper._tick()

    queue = await load_evaluation_queue(db)
    assert [target.queued_count for target in queue.targets] == [2, 0, 0]
    assert [target.overflowed_count for target in queue.targets] == [0, 1, 1]
    assert queue.status == "OVERLOADED"


async def test_concurrent_admissions_never_overfill_the_queue(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The span producer and the trace sweeper each find a batch that fits the queue alone,
    and pause after reading the room until the other has read it too. Admission is
    serialized, so the second reads the room only after the first has filled it."""
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_OUTSTANDING", "2")
    # The sweeper gives up a lock wait after 500 ms, and here the producer holds the lock
    # for up to a second.
    monkeypatch.setattr(sweeper_module, "_LOCK_TIMEOUT_MILLISECONDS", 10_000)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(2)]
    await _seed_span_criteria(db, project.id)
    await _seed_cursor(
        db,
        produced_through_id=spans[0].id - 1,
        observed_high_water_id=spans[-1].id,
        observed_at=_now() - timedelta(seconds=120),
    )
    trace_project_id, _, last_span_ingested_at = await _add_trace_liveness(db, age_seconds=600)
    async with db() as session:
        trace_project = await session.get(models.Project, trace_project_id)
        assert trace_project is not None
        second_trace = await _add_trace(session, trace_project)
        await session.execute(
            update(models.Trace)
            .where(models.Trace.id == second_trace.id)
            .values(last_span_ingested_at=last_span_ingested_at)
        )
    await _seed_criteria(db, trace_project_id, evaluation_target="TRACE")

    lock_room = admission.lock_room
    rooms_read = 0
    both_read = asyncio.Event()

    async def lock_room_then_wait(session: AsyncSession, dialect: SupportedSQLDialect) -> int:
        nonlocal rooms_read
        room = await lock_room(session, dialect)
        rooms_read += 1
        if rooms_read == 2:
            both_read.set()
        try:
            await asyncio.wait_for(both_read.wait(), timeout=1)
        except asyncio.TimeoutError:
            pass
        return room

    monkeypatch.setattr(admission, "lock_room", lock_room_then_wait)
    await asyncio.gather(
        OnlineEvalProducer(db)._tick(),
        EvalSweeper(db, evaluation_target="TRACE")._tick(),
    )

    assert sorted(await _queued_by_target(db)) == [0, 0, 2]
