import asyncio
from collections import Counter
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from types import SimpleNamespace
from typing import Any, Optional

import pytest
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS
from phoenix.db.types.identifier import Identifier
from phoenix.server.app import _db
from phoenix.server.online_eval import coordinator as coordinator_module
from phoenix.server.online_eval.coordinator import (
    CLAIM_LEASE_TTL_SECONDS,
    LEASE_ATTEMPTS_EXHAUSTED_ERROR,
    TRANSIENT_RETRY_MAX_AGE_SECONDS,
    EvalWorkCoordinator,
    PublicationClaimLostError,
    PublicationEvaluatorDisabledError,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace


async def _seed_work_units(
    db: DbSessionFactory,
    n: int,
    *,
    project_session: bool = False,
) -> list[int]:
    """Create a span and ``n`` PENDING work units on it, one per project evaluator,
    returning the work unit ids in id order."""
    async with db() as session:
        project = await _add_project(session)
        parent_session = await _add_project_session(session, project) if project_session else None
        trace = await _add_trace(session, project, parent_session)
        span = await _add_span(session, trace)
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        project_evaluators = [
            models.ProjectEvaluator(
                trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
                project_id=project.id,
                evaluator_id=evaluator.id,
                name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
                filter_condition="",
                sampling_rate=1.0,
                evaluation_target="SPAN",
            )
            for _ in range(n)
        ]
        session.add_all(project_evaluators)
        await session.flush()
        units = [
            models.EvalWorkUnit(
                span_rowid=span.id,
                project_evaluator_id=project_evaluator.id,
            )
            for project_evaluator in project_evaluators
        ]
        session.add_all(units)
        await session.flush()
        return sorted(unit.id for unit in units)


async def _get_unit(db: DbSessionFactory, unit_id: int) -> models.EvalWorkUnit:
    async with db() as session:
        unit = await session.get(models.EvalWorkUnit, unit_id)
        assert unit is not None
        return unit


async def _seed_session_work_units(db: DbSessionFactory, n: int) -> tuple[int, list[int]]:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        project_evaluators = [
            models.ProjectEvaluator(
                trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
                project_id=project.id,
                evaluator_id=evaluator.id,
                name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
                filter_condition="",
                sampling_rate=1.0,
                evaluation_target="SESSION",
            )
            for _ in range(n)
        ]
        session.add_all(project_evaluators)
        await session.flush()
        decided_through = datetime.now(timezone.utc)
        project_session.last_span_ingested_at = decided_through
        units = [
            models.EvalSessionWorkUnit(
                project_session_rowid=project_session.id,
                project_evaluator_id=project_evaluator.id,
                decided_through=decided_through,
            )
            for project_evaluator in project_evaluators
        ]
        session.add_all(units)
        await session.flush()
        return project_session.id, sorted(unit.id for unit in units)


async def _seed_trace_work_units(
    db: DbSessionFactory,
    n: int,
    *,
    project_session: bool = False,
) -> tuple[int, Optional[int], list[int]]:
    """Seed ``n`` PENDING trace work units, returning (trace_rowid,
    project_session_rowid, work unit ids)."""
    async with db() as session:
        project = await _add_project(session)
        parent_session = await _add_project_session(session, project) if project_session else None
        trace = await _add_trace(session, project, parent_session)
        await _add_span(session, trace)
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        project_evaluators = [
            models.ProjectEvaluator(
                trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
                project_id=project.id,
                evaluator_id=evaluator.id,
                name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
                filter_condition="",
                sampling_rate=1.0,
                evaluation_target="TRACE",
            )
            for _ in range(n)
        ]
        session.add_all(project_evaluators)
        await session.flush()
        units = [
            models.EvalTraceWorkUnit(
                trace_rowid=trace.id,
                project_evaluator_id=project_evaluator.id,
                decided_through=datetime.now(timezone.utc),
            )
            for project_evaluator in project_evaluators
        ]
        session.add_all(units)
        await session.flush()
        return (
            trace.id,
            None if parent_session is None else parent_session.id,
            sorted(unit.id for unit in units),
        )


async def _seed_one_unit(
    db: DbSessionFactory,
    evaluation_target: models.EvaluationTarget,
    *,
    project_session: bool = False,
) -> int:
    if evaluation_target == "SPAN":
        (unit_id,) = await _seed_work_units(db, 1, project_session=project_session)
    elif evaluation_target == "SESSION":
        _, (unit_id,) = await _seed_session_work_units(db, 1)
    else:
        _, _, (unit_id,) = await _seed_trace_work_units(db, 1, project_session=project_session)
    return unit_id


_TARGET_MODELS = {
    "SPAN": (models.Span, models.EvalWorkUnit, models.SpanAnnotation, "span_rowid"),
    "SESSION": (
        models.ProjectSession,
        models.EvalSessionWorkUnit,
        models.ProjectSessionAnnotation,
        "project_session_id",
    ),
    "TRACE": (models.Trace, models.EvalTraceWorkUnit, models.TraceAnnotation, "trace_rowid"),
}


async def _write_nothing(session: AsyncSession) -> None:
    return None


async def test_claim_and_publish_happy_path(db: DbSessionFactory) -> None:
    unit_ids = await _seed_work_units(db, 2)
    coordinator = EvalWorkCoordinator(db)

    claimed = await coordinator.claim(claimed_by="consumer-1", limit=10)
    assert [unit.work_unit_id for unit in claimed] == unit_ids
    for claimed_unit in claimed:
        assert claimed_unit.project_evaluator_id > 0
        assert claimed_unit.attempts == 0
        assert claimed_unit.claimed_by == "consumer-1"
        row = await _get_unit(db, claimed_unit.work_unit_id)
        assert row.status == "RUNNING"
        assert row.claimed_by == "consumer-1"

    assert await coordinator.claim(claimed_by="consumer-2", limit=10) == []
    assert await coordinator.heartbeat(work_unit_id=unit_ids[0], claimed_by="consumer-1")

    for unit_id in unit_ids:
        await coordinator.publish(
            work_unit_id=unit_id, claimed_by="consumer-1", write=_write_nothing
        )
        assert (await _get_unit(db, unit_id)).status == "DONE"
    finished = await _get_unit(db, unit_ids[0])
    for claimed_by in ("consumer-1", "consumer-2"):
        late: dict[str, Any] = {"work_unit_id": unit_ids[0], "claimed_by": claimed_by}
        await coordinator.heartbeat(**late)
        await coordinator.fail(**late, error="late")
        await coordinator.expire(**late, error="late")
        await coordinator.release(**late)
    row = await _get_unit(db, unit_ids[0])
    assert (row.status, row.claimed_by, row.attempts, row.error, row.updated_at) == (
        "DONE",
        "consumer-1",
        0,
        None,
        finished.updated_at,
    )
    with pytest.raises(PublicationClaimLostError):
        await coordinator.publish(
            work_unit_id=unit_ids[0], claimed_by="consumer-1", write=_write_nothing
        )


async def test_a_publication_that_fails_partway_writes_nothing(db: DbSessionFactory) -> None:
    """Publishing is all or nothing: a write that fails after inserting an annotation
    leaves no annotation, and the unit stays running under its claim."""
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)
    (claimed,) = await coordinator.claim(claimed_by="consumer", limit=1)

    class _WriteFailed(Exception):
        pass

    async def annotate_then_fail(session: AsyncSession) -> None:
        session.add(
            models.SpanAnnotation(
                span_rowid=claimed.target_rowid,
                name="quality",
                label="good",
                score=1.0,
                explanation=None,
                metadata_={},
                annotator_kind="CODE",
                source="API",
            )
        )
        await session.flush()
        raise _WriteFailed

    with pytest.raises(_WriteFailed):
        await coordinator.publish(
            work_unit_id=unit_id, claimed_by="consumer", write=annotate_then_fail
        )

    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.SpanAnnotation)) == 0
    unit = await _get_unit(db, unit_id)
    assert (unit.status, unit.claimed_by) == ("RUNNING", "consumer")


async def test_heartbeat_keeps_lapsed_unit_unavailable_to_competing_consumer(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    owner = EvalWorkCoordinator(db)
    competitor = EvalWorkCoordinator(db)

    await owner.claim(claimed_by="consumer-1", limit=1)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(claimed_at=lapsed)
        )

    assert await owner.heartbeat(work_unit_id=unit_id, claimed_by="consumer-1")
    assert await competitor.claim(claimed_by="consumer-2", limit=1) == []


async def test_work_leases_and_retry_age_ignore_application_clock_skew(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _SkewedDateTime(datetime):
        @classmethod
        def now(cls, tz: object = None) -> "_SkewedDateTime":
            return cls(2100, 1, 1, tzinfo=timezone.utc)

    monkeypatch.setattr(coordinator_module, "datetime", _SkewedDateTime)
    (unit_id,) = await _seed_work_units(db, 1)
    owner = EvalWorkCoordinator(db)
    competitor = EvalWorkCoordinator(db)

    (claim,) = await owner.claim(claimed_by="owner", limit=1)
    row = await _get_unit(db, unit_id)
    assert row.claimed_at is not None
    assert row.claimed_at.year < 2100

    assert await owner.heartbeat(work_unit_id=unit_id, claimed_by="owner")
    assert await competitor.claim(claimed_by="competitor", limit=1) == []
    assert await owner.fail(
        work_unit_id=unit_id,
        claimed_by="owner",
        error="transient",
        count_attempt=False,
    )
    failed = await _get_unit(db, unit_id)
    assert failed.status == "ERROR"
    assert failed.attempts == 0


async def test_fail_sets_cooldown_and_unit_is_reclaimable_after_it(db: DbSessionFactory) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)

    await coordinator.claim(claimed_by="consumer-1", limit=1)
    future = datetime.now(timezone.utc) + timedelta(seconds=60)
    assert await coordinator.fail(
        work_unit_id=unit_id, claimed_by="consumer-1", error="boom", cooldown_until=future
    )
    row = await _get_unit(db, unit_id)
    assert row.status == "ERROR"
    assert row.error == "boom"
    assert row.attempts == 1
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []

    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(cooldown_until=past)
        )
    reclaimed = await coordinator.claim(claimed_by="consumer-2", limit=1)
    assert [unit.work_unit_id for unit in reclaimed] == [unit_id]
    assert reclaimed[0].attempts == 1


async def test_failed_unit_with_exhausted_attempts_is_not_claimable(db: DbSessionFactory) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db, max_attempts=1)

    await coordinator.claim(claimed_by="consumer-1", limit=1)
    assert await coordinator.fail(work_unit_id=unit_id, claimed_by="consumer-1", error="boom")
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []


async def test_aged_transient_failure_is_parked_as_exhausted_error(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)
    await coordinator.claim(claimed_by="consumer-1", limit=1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(
                created_at=datetime.now(timezone.utc)
                - timedelta(seconds=TRANSIENT_RETRY_MAX_AGE_SECONDS + 1)
            )
        )

    assert await coordinator.fail(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error="provider unavailable",
        cooldown_until=datetime.now(timezone.utc) - timedelta(seconds=1),
        count_attempt=False,
    )

    row = await _get_unit(db, unit_id)
    assert row.status == "FAILED"
    assert row.attempts == MAX_ATTEMPTS
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []


async def test_fresh_transient_failure_remains_retryable_after_cooldown(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)
    await coordinator.claim(claimed_by="consumer-1", limit=1)
    cooldown_until = datetime.now(timezone.utc) + timedelta(seconds=60)

    assert await coordinator.fail(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error="provider unavailable",
        cooldown_until=cooldown_until,
        count_attempt=False,
    )
    row = await _get_unit(db, unit_id)
    assert row.attempts == 0
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []

    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(cooldown_until=datetime.now(timezone.utc) - timedelta(seconds=1))
        )
    claimed = await coordinator.claim(claimed_by="consumer-2", limit=1)
    assert [unit.work_unit_id for unit in claimed] == [unit_id]
    assert claimed[0].attempts == 0


async def test_expire_is_terminal(db: DbSessionFactory) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)

    await coordinator.claim(claimed_by="consumer-1", limit=1)
    assert await coordinator.expire(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error="EVALUATOR_VERSION_MISSING",
    )
    row = await _get_unit(db, unit_id)
    assert row.status == "EXPIRED"
    assert row.error == "EVALUATOR_VERSION_MISSING"
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []
    assert not await coordinator.expire(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error="EVALUATOR_VERSION_MISSING",
    )


async def test_release_returns_owned_unit_to_pending_without_counting_attempt(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)
    (claimed,) = await coordinator.claim(claimed_by="consumer-1", limit=1)

    assert await coordinator.release(
        work_unit_id=claimed.work_unit_id,
        claimed_by="consumer-1",
    )
    assert not await coordinator.release(
        work_unit_id=claimed.work_unit_id,
        claimed_by="consumer-2",
    )

    row = await _get_unit(db, unit_id)
    assert row.status == "PENDING"
    assert row.attempts == 0
    assert row.claimed_by is None
    assert row.claimed_at is None


async def test_transitions_return_false_after_lapsed_lease_is_reclaimed(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)

    await coordinator.claim(claimed_by="consumer-1", limit=1)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(claimed_at=lapsed)
        )

    reclaimed = await coordinator.claim(claimed_by="consumer-2", limit=1)
    assert [unit.work_unit_id for unit in reclaimed] == [unit_id]
    assert reclaimed[0].attempts == 1

    assert not await coordinator.heartbeat(work_unit_id=unit_id, claimed_by="consumer-1")
    assert not await coordinator.fail(work_unit_id=unit_id, claimed_by="consumer-1", error="late")
    assert not await coordinator.expire(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error="EVALUATOR_VERSION_MISSING",
    )

    row = await _get_unit(db, unit_id)
    assert row.status == "RUNNING"
    assert row.claimed_by == "consumer-2"
    assert row.attempts == 1
    assert await coordinator.heartbeat(work_unit_id=unit_id, claimed_by="consumer-2")


async def test_lapsed_lease_with_exhausted_attempts_is_not_claimable(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db, max_attempts=1)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_id)
            .values(
                status="RUNNING",
                claimed_at=lapsed,
                claimed_by="consumer-1",
                attempts=1,
            )
        )

    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []
    row = await _get_unit(db, unit_id)
    assert row.status == "FAILED"
    assert row.claimed_by == "consumer-1"
    assert row.attempts == 1
    assert row.error == LEASE_ATTEMPTS_EXHAUSTED_ERROR


async def test_claim_fails_lapsed_running_work_with_no_attempts_left(
    db: DbSessionFactory,
) -> None:
    lapsed_id, fresh_id = await _seed_work_units(db, 2)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1)
    async with db() as session:
        for unit_id, claimed_at in ((lapsed_id, lapsed), (fresh_id, datetime.now(timezone.utc))):
            await session.execute(
                update(models.EvalWorkUnit)
                .where(models.EvalWorkUnit.id == unit_id)
                .values(
                    status="RUNNING",
                    claimed_at=claimed_at,
                    claimed_by="stopped-consumer",
                    attempts=MAX_ATTEMPTS - 1,
                )
            )

    assert await EvalWorkCoordinator(db).claim(claimed_by="consumer", limit=2) == []

    recovered = await _get_unit(db, lapsed_id)
    assert recovered.status == "FAILED"
    assert recovered.attempts == MAX_ATTEMPTS
    assert recovered.error == LEASE_ATTEMPTS_EXHAUSTED_ERROR
    assert (await _get_unit(db, fresh_id)).status == "RUNNING"


async def test_lapsed_unit_is_claimed_exactly_max_attempts_times(db: DbSessionFactory) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)
    execution_count = 0

    for execution_count in range(1, MAX_ATTEMPTS + 1):
        claimed = await coordinator.claim(claimed_by=f"consumer-{execution_count}", limit=1)
        assert [unit.work_unit_id for unit in claimed] == [unit_id]
        async with db() as session:
            await session.execute(
                update(models.EvalWorkUnit)
                .where(models.EvalWorkUnit.id == unit_id)
                .values(
                    claimed_at=datetime.now(timezone.utc)
                    - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1)
                )
            )

    assert execution_count == 3
    assert await coordinator.claim(claimed_by="consumer-4", limit=1) == []


async def test_completed_work_is_counted_by_outcome_once_committed(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    increments: Counter[tuple[str, str]] = Counter()
    lags: dict[tuple[str, str], list[float]] = {}

    def counter_labels(*, evaluation_target: str, outcome: str) -> SimpleNamespace:
        key = (evaluation_target, outcome)
        return SimpleNamespace(inc=lambda count=1: increments.update({key: count}))

    def lag_labels(*, evaluation_target: str, outcome: str) -> SimpleNamespace:
        key = (evaluation_target, outcome)
        return SimpleNamespace(observe=lambda seconds: lags.setdefault(key, []).append(seconds))

    monkeypatch.setattr(coordinator_module, "get_env_enable_prometheus", lambda: True)
    monkeypatch.setattr(
        coordinator_module,
        "ONLINE_EVAL_COMPLETED_WORK_UNITS",
        SimpleNamespace(labels=counter_labels),
    )
    monkeypatch.setattr(
        coordinator_module,
        "ONLINE_EVAL_QUEUE_TO_RESULT_SECONDS",
        SimpleNamespace(labels=lag_labels),
    )
    unit_ids = await _seed_work_units(db, 5)
    queued_seconds_ago = 600
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit).values(
                created_at=datetime.now(timezone.utc) - timedelta(seconds=queued_seconds_ago)
            )
        )
    coordinator = EvalWorkCoordinator(db, max_attempts=1)
    await coordinator.claim(claimed_by="dead-consumer", limit=1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.claimed_by == "dead-consumer")
            .values(
                claimed_at=datetime.now(timezone.utc)
                - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1)
            )
        )
    claimed = await coordinator.claim(claimed_by="consumer", limit=4)
    published, failed, expired, cleared = (unit.work_unit_id for unit in claimed)

    await coordinator.publish(work_unit_id=published, claimed_by="consumer", write=_write_nothing)
    await coordinator.fail(work_unit_id=failed, claimed_by="consumer", error="boom")
    await coordinator.expire(work_unit_id=expired, claimed_by="consumer", error="deadline")
    # Cleared at hydration, after its evaluator was turned off.
    await coordinator.clear(
        work_unit_id=cleared,
        claimed_by="consumer",
        error="PROJECT_EVALUATOR_DISABLED",
    )
    _, (content_lost,) = await _seed_session_work_units(db, 1)
    session_coordinator = EvalWorkCoordinator(db, evaluation_target="SESSION")
    await session_coordinator.claim(claimed_by="consumer", limit=1)
    await session_coordinator.expire(
        work_unit_id=content_lost,
        claimed_by="consumer",
        error="NO_ROOT_TURNS",
        status="CONTENT_LOST",
    )

    # The lapsed claim, out of attempts, fails when the next claim recovers it.
    assert (await _get_unit(db, unit_ids[0])).status == "FAILED"
    assert increments == {
        ("SPAN", "evaluated"): 1,
        ("SPAN", "failed"): 2,
        ("SPAN", "expired"): 1,
        ("SPAN", "evaluator_disabled"): 1,
        ("SESSION", "content_lost"): 1,
    }
    # Cleared and content-lost work had no result, so it has no lag.
    assert {key: len(seconds) for key, seconds in lags.items()} == {
        ("SPAN", "evaluated"): 1,
        ("SPAN", "failed"): 2,
        ("SPAN", "expired"): 1,
    }
    assert all(
        queued_seconds_ago - 5 <= lag <= queued_seconds_ago + 60
        for outcome_lags in lags.values()
        for lag in outcome_lags
    )


async def test_session_claim_lifecycle(db: DbSessionFactory) -> None:
    project_session_id, unit_ids = await _seed_session_work_units(db, 5)
    coordinator = EvalWorkCoordinator(db, evaluation_target="SESSION")

    (claimed,) = await coordinator.claim(claimed_by="session-consumer", limit=1)
    assert claimed.evaluation_target == "SESSION"
    assert claimed.target_rowid == project_session_id
    assert await coordinator.heartbeat(
        work_unit_id=claimed.work_unit_id,
        claimed_by="session-consumer",
    )
    await coordinator.publish(
        work_unit_id=claimed.work_unit_id,
        claimed_by="session-consumer",
        write=_write_nothing,
    )

    now = datetime.now(timezone.utc)
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_ids[1])
            .values(
                status="RUNNING",
                claimed_at=now - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1),
                claimed_by="dead-consumer",
                attempts=MAX_ATTEMPTS - 1,
            )
        )
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_ids[3])
            .values(
                status="ERROR",
                attempts=MAX_ATTEMPTS - 1,
                cooldown_until=now + timedelta(seconds=60),
                created_at=now - timedelta(seconds=120),
            )
        )
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_ids[4])
            .values(status="FAILED", attempts=MAX_ATTEMPTS)
        )

    (next_claimed,) = await coordinator.claim(claimed_by="session-consumer", limit=1)
    assert next_claimed.work_unit_id == unit_ids[2]
    async with db() as session:
        exhausted_lease = await session.get(models.EvalSessionWorkUnit, unit_ids[1])
        assert exhausted_lease is not None
        assert exhausted_lease.status == "FAILED"
        assert exhausted_lease.attempts == MAX_ATTEMPTS
        assert exhausted_lease.error == LEASE_ATTEMPTS_EXHAUSTED_ERROR

    async with db() as session:
        statuses = (
            await session.scalars(
                select(models.EvalSessionWorkUnit.status)
                .where(models.EvalSessionWorkUnit.id.in_(unit_ids))
                .order_by(models.EvalSessionWorkUnit.id)
            )
        ).all()
    assert statuses == ["DONE", "FAILED", "RUNNING", "ERROR", "FAILED"]


async def test_session_claim_excludes_declined_decisions(db: DbSessionFactory) -> None:
    _, unit_ids = await _seed_session_work_units(db, 3)
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_ids[0])
            .values(status="FILTERED_OUT")
        )
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_ids[1])
            .values(status="SAMPLED_OUT")
        )

    claimed = await EvalWorkCoordinator(db, evaluation_target="SESSION").claim(
        claimed_by="session-consumer",
        limit=3,
    )

    assert [unit.work_unit_id for unit in claimed] == [unit_ids[2]]


@pytest.mark.postgres_only
async def test_claim_skips_rows_locked_by_a_concurrent_transaction(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    unit_ids = await _seed_work_units(db, 2)
    coordinator = EvalWorkCoordinator(db)

    async with db() as session:
        locked = await session.scalar(
            select(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_ids[0])
            .with_for_update()
        )
        assert locked is not None
        claimed = await coordinator.claim(claimed_by="consumer-1", limit=10)
        assert [unit.work_unit_id for unit in claimed] == [unit_ids[1]]

    claimed = await coordinator.claim(claimed_by="consumer-1", limit=10)
    assert [unit.work_unit_id for unit in claimed] == [unit_ids[0]]


@pytest.mark.postgres_only
async def test_session_publish_holds_work_lock_against_reclaim(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    _, (unit_id,) = await _seed_session_work_units(db, 1)
    owner = EvalWorkCoordinator(db, evaluation_target="SESSION")
    competitor = EvalWorkCoordinator(db, evaluation_target="SESSION")
    (claim,) = await owner.claim(claimed_by="owner", limit=1)
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_id)
            .values(claimed_at=datetime.now(timezone.utc) - timedelta(seconds=120))
        )
    entered = asyncio.Event()
    release = asyncio.Event()

    async def _write(session: AsyncSession) -> None:
        entered.set()
        await release.wait()

    publication = asyncio.create_task(
        owner.publish(
            work_unit_id=unit_id,
            claimed_by=claim.claimed_by,
            write=_write,
        )
    )
    await entered.wait()
    assert await competitor.claim(claimed_by="competitor", limit=1) == []
    release.set()
    await publication
    assert await competitor.claim(claimed_by="competitor", limit=1) == []
    async with db() as session:
        unit = await session.get(models.EvalSessionWorkUnit, unit_id)
        assert unit is not None
        assert unit.status == "DONE"


async def test_publish_refuses_a_disabled_project_evaluator(db: DbSessionFactory) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)
    (claim,) = await coordinator.claim(claimed_by="owner", limit=1)
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == claim.project_evaluator_id)
            .values(enabled=False)
        )
    wrote = asyncio.Event()

    async def _write(session: AsyncSession) -> None:
        wrote.set()

    with pytest.raises(PublicationEvaluatorDisabledError):
        await coordinator.publish(
            work_unit_id=unit_id,
            claimed_by=claim.claimed_by,
            write=_write,
        )
    assert not wrote.is_set()


async def test_publish_refuses_a_deleted_project_evaluator(db: DbSessionFactory) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = EvalWorkCoordinator(db)
    (claim,) = await coordinator.claim(claimed_by="owner", limit=1)
    async with db() as session:
        await session.execute(
            update(models.ProjectEvaluator)
            .where(models.ProjectEvaluator.id == claim.project_evaluator_id)
            .values(deleted_at=datetime.now(timezone.utc))
        )
    wrote = asyncio.Event()

    async def _write(session: AsyncSession) -> None:
        wrote.set()

    with pytest.raises(PublicationEvaluatorDisabledError):
        await coordinator.publish(
            work_unit_id=unit_id,
            claimed_by=claim.claimed_by,
            write=_write,
        )
    assert not wrote.is_set()


async def test_trace_claim_lifecycle(db: DbSessionFactory) -> None:
    trace_rowid, _, unit_ids = await _seed_trace_work_units(db, 2)
    coordinator = EvalWorkCoordinator(db, evaluation_target="TRACE")

    (claimed,) = await coordinator.claim(claimed_by="trace-consumer", limit=1)

    assert claimed.work_unit_id == unit_ids[0]
    assert claimed.evaluation_target == "TRACE"
    assert claimed.target_rowid == trace_rowid
    assert await coordinator.heartbeat(
        work_unit_id=claimed.work_unit_id,
        claimed_by="trace-consumer",
    )
    await coordinator.publish(
        work_unit_id=claimed.work_unit_id,
        claimed_by="trace-consumer",
        write=_write_nothing,
    )

    async with db() as session:
        statuses = (
            await session.scalars(
                select(models.EvalTraceWorkUnit.status)
                .where(models.EvalTraceWorkUnit.id.in_(unit_ids))
                .order_by(models.EvalTraceWorkUnit.id)
            )
        ).all()
    assert statuses == ["DONE", "PENDING"]


@pytest.mark.postgres_only
@pytest.mark.parametrize("evaluation_target", ["SPAN", "SESSION", "TRACE"])
async def test_publish_refuses_a_target_deleted_under_the_fence(
    postgresql_engine: AsyncEngine,
    evaluation_target: models.EvaluationTarget,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    unit_id = await _seed_one_unit(db, evaluation_target)
    target_model, _, _, _ = _TARGET_MODELS[evaluation_target]
    coordinator = EvalWorkCoordinator(db, evaluation_target=evaluation_target)
    (claim,) = await coordinator.claim(claimed_by="owner", limit=1)
    wrote = asyncio.Event()

    async def _write(session: AsyncSession) -> None:
        wrote.set()

    async with db() as deleting_session:
        await deleting_session.execute(
            delete(target_model).where(target_model.id == claim.target_rowid)
        )
        publication = asyncio.create_task(
            coordinator.publish(
                work_unit_id=unit_id,
                claimed_by=claim.claimed_by,
                write=_write,
            )
        )
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(asyncio.shield(publication), timeout=0.1)

    with pytest.raises(PublicationClaimLostError, match="no longer owned and running"):
        await publication
    assert not wrote.is_set()


@pytest.mark.postgres_only
@pytest.mark.parametrize("evaluation_target", ["SPAN", "SESSION", "TRACE"])
async def test_target_delete_waits_for_publication(
    postgresql_engine: AsyncEngine,
    evaluation_target: models.EvaluationTarget,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    unit_id = await _seed_one_unit(db, evaluation_target)
    target_model, work_unit_model, annotation_model, target_column = _TARGET_MODELS[
        evaluation_target
    ]
    coordinator = EvalWorkCoordinator(db, evaluation_target=evaluation_target)
    (claim,) = await coordinator.claim(claimed_by="owner", limit=1)
    fenced = asyncio.Event()
    release = asyncio.Event()
    annotation_ids: list[int] = []

    async def _write(session: AsyncSession) -> None:
        fenced.set()
        await release.wait()
        annotation = annotation_model(
            **{target_column: claim.target_rowid},
            name="quality",
            label=None,
            score=1.0,
            explanation=None,
            metadata_={},
            annotator_kind="LLM",
            identifier="online:race",
            source="API",
            user_id=None,
        )
        session.add(annotation)
        await session.flush()
        annotation_ids.append(annotation.id)

    async def _delete_target() -> None:
        async with db() as session:
            await session.execute(delete(target_model).where(target_model.id == claim.target_rowid))

    publication = asyncio.create_task(
        coordinator.publish(
            work_unit_id=unit_id,
            claimed_by=claim.claimed_by,
            write=_write,
        )
    )
    await fenced.wait()
    deletion = asyncio.create_task(_delete_target())
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(asyncio.shield(deletion), timeout=0.1)
    release.set()
    await publication
    await deletion

    (annotation_id,) = annotation_ids
    async with db() as session:
        assert await session.get(annotation_model, annotation_id) is None
        assert await session.get(work_unit_model, unit_id) is None


@pytest.mark.postgres_only
@pytest.mark.parametrize("evaluation_target", ["SPAN", "SESSION", "TRACE"])
async def test_publish_does_not_wait_on_ingest_or_sweeper_row_locks(
    postgresql_engine: AsyncEngine,
    evaluation_target: models.EvaluationTarget,
) -> None:
    """The sweepers lock evaluator rows; span ingest updates session and trace rows."""
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    unit_id = await _seed_one_unit(db, evaluation_target, project_session=True)
    coordinator = EvalWorkCoordinator(db, evaluation_target=evaluation_target)
    (claim,) = await coordinator.claim(claimed_by="owner", limit=1)
    wrote = asyncio.Event()

    async def _write(session: AsyncSession) -> None:
        wrote.set()

    async with db() as holding_session:
        await holding_session.execute(select(models.ProjectEvaluator.id).with_for_update())
        for model in (models.ProjectSession, models.Trace):
            await holding_session.execute(select(model.id).with_for_update(key_share=True))
        await asyncio.wait_for(
            coordinator.publish(
                work_unit_id=unit_id,
                claimed_by=claim.claimed_by,
                write=_write,
            ),
            timeout=5,
        )

    assert wrote.is_set()
