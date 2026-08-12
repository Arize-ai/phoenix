import asyncio
from datetime import datetime, timedelta, timezone
from secrets import token_hex

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.app import _db
from phoenix.server.online_eval import db_coordinator as db_coordinator_module
from phoenix.server.online_eval.coordinator import LEASE_TTL_SECONDS
from phoenix.server.online_eval.db_coordinator import (
    TRANSIENT_RETRY_MAX_AGE_SECONDS,
    DbEvalWorkCoordinator,
)
from phoenix.server.online_eval.derivation import MAX_ATTEMPTS, STALE_FINGERPRINT_ERROR
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace


async def _seed_work_units(db: DbSessionFactory, n: int) -> list[int]:
    """Create a span, evaluator, and criteria, plus ``n`` PENDING work units
    (distinct fingerprints), returning the work unit ids in id order."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
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
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(criteria)
        await session.flush()
        units = [
            models.EvalWorkUnit(
                span_rowid=span.id,
                evaluator_id=evaluator.id,
                criteria_id=criteria.id,
                config_fingerprint=f"fp-{i}-{token_hex(8)}",
            )
            for i in range(n)
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
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SESSION",
        )
        session.add(criteria)
        await session.flush()
        evaluated_through = datetime.now(timezone.utc)
        project_session.last_span_ingested_at = evaluated_through
        units = [
            models.EvalSessionWorkUnit(
                project_session_rowid=project_session.id,
                evaluator_id=evaluator.id,
                criteria_id=criteria.id,
                config_fingerprint=f"session-fp-{i}-{token_hex(8)}",
                evaluated_through=evaluated_through,
            )
            for i in range(n)
        ]
        session.add_all(units)
        await session.flush()
        return project_session.id, sorted(unit.id for unit in units)


async def test_claim_and_complete_happy_path(db: DbSessionFactory) -> None:
    unit_ids = await _seed_work_units(db, 2)
    coordinator = DbEvalWorkCoordinator(db)
    before = datetime.now(timezone.utc)

    claimed = await coordinator.claim(claimed_by="consumer-1", limit=10)
    assert [unit.work_unit_id for unit in claimed] == unit_ids
    for claimed_unit in claimed:
        assert claimed_unit.criteria_id > 0
        assert claimed_unit.identifier == "online:" + claimed_unit.config_fingerprint[:16]
        assert claimed_unit.attempts == 0
        assert claimed_unit.claimed_by == "consumer-1"
        assert claimed_unit.lease_expires_at >= before + timedelta(
            seconds=LEASE_TTL_SECONDS,
            milliseconds=-1,
        )
        row = await _get_unit(db, claimed_unit.work_unit_id)
        assert row.status == "RUNNING"
        assert row.claimed_by == "consumer-1"

    assert await coordinator.claim(claimed_by="consumer-2", limit=10) == []
    assert await coordinator.heartbeat(work_unit_id=unit_ids[0], claimed_by="consumer-1")

    for unit_id in unit_ids:
        assert await coordinator.complete(work_unit_id=unit_id, claimed_by="consumer-1")
        assert (await _get_unit(db, unit_id)).status == "DONE"
    assert await coordinator.complete(work_unit_id=unit_ids[0], claimed_by="consumer-1")


async def test_heartbeat_keeps_lapsed_unit_unavailable_to_competing_consumer(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    owner = DbEvalWorkCoordinator(db)
    competitor = DbEvalWorkCoordinator(db)

    await owner.claim(claimed_by="consumer-1", limit=1)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=LEASE_TTL_SECONDS + 1)
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

    monkeypatch.setattr(db_coordinator_module, "datetime", _SkewedDateTime)
    (unit_id,) = await _seed_work_units(db, 1)
    owner = DbEvalWorkCoordinator(db)
    competitor = DbEvalWorkCoordinator(db)

    (claim,) = await owner.claim(claimed_by="owner", limit=1)
    row = await _get_unit(db, unit_id)
    assert row.claimed_at is not None
    assert row.claimed_at.year < 2100
    assert claim.lease_expires_at == row.claimed_at + timedelta(seconds=LEASE_TTL_SECONDS)

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
    coordinator = DbEvalWorkCoordinator(db)

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
    coordinator = DbEvalWorkCoordinator(db, max_attempts=1)

    await coordinator.claim(claimed_by="consumer-1", limit=1)
    assert await coordinator.fail(work_unit_id=unit_id, claimed_by="consumer-1", error="boom")
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []


async def test_aged_transient_failure_is_parked_as_exhausted_error(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = DbEvalWorkCoordinator(db)
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
    assert row.status == "ERROR"
    assert row.attempts == MAX_ATTEMPTS
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []
    lag = await coordinator.lag()
    assert lag.retryable_error_count == 0
    assert lag.exhausted_error_count == 1


async def test_fresh_transient_failure_remains_retryable_after_cooldown(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = DbEvalWorkCoordinator(db)
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
    coordinator = DbEvalWorkCoordinator(db)

    await coordinator.claim(claimed_by="consumer-1", limit=1)
    assert await coordinator.expire(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error=STALE_FINGERPRINT_ERROR,
    )
    row = await _get_unit(db, unit_id)
    assert row.status == "EXPIRED"
    assert row.error == STALE_FINGERPRINT_ERROR
    assert await coordinator.claim(claimed_by="consumer-2", limit=1) == []
    assert not await coordinator.expire(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error=STALE_FINGERPRINT_ERROR,
    )


async def test_release_returns_owned_unit_to_pending_without_counting_attempt(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = DbEvalWorkCoordinator(db)
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
    coordinator = DbEvalWorkCoordinator(db)

    await coordinator.claim(claimed_by="consumer-1", limit=1)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=LEASE_TTL_SECONDS + 1)
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
    assert not await coordinator.complete(work_unit_id=unit_id, claimed_by="consumer-1")
    assert not await coordinator.fail(work_unit_id=unit_id, claimed_by="consumer-1", error="late")
    assert not await coordinator.expire(
        work_unit_id=unit_id,
        claimed_by="consumer-1",
        error=STALE_FINGERPRINT_ERROR,
    )

    row = await _get_unit(db, unit_id)
    assert row.status == "RUNNING"
    assert row.claimed_by == "consumer-2"
    assert row.attempts == 1
    assert await coordinator.complete(work_unit_id=unit_id, claimed_by="consumer-2")


async def test_lapsed_lease_with_exhausted_attempts_is_not_claimable(
    db: DbSessionFactory,
) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = DbEvalWorkCoordinator(db, max_attempts=1)
    lapsed = datetime.now(timezone.utc) - timedelta(seconds=LEASE_TTL_SECONDS + 1)
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
    assert row.status == "RUNNING"
    assert row.claimed_by == "consumer-1"
    assert row.attempts == 1


async def test_lapsed_unit_is_claimed_exactly_max_attempts_times(db: DbSessionFactory) -> None:
    (unit_id,) = await _seed_work_units(db, 1)
    coordinator = DbEvalWorkCoordinator(db)
    execution_count = 0

    for execution_count in range(1, MAX_ATTEMPTS + 1):
        claimed = await coordinator.claim(claimed_by=f"consumer-{execution_count}", limit=1)
        assert [unit.work_unit_id for unit in claimed] == [unit_id]
        async with db() as session:
            await session.execute(
                update(models.EvalWorkUnit)
                .where(models.EvalWorkUnit.id == unit_id)
                .values(
                    claimed_at=datetime.now(timezone.utc) - timedelta(seconds=LEASE_TTL_SECONDS + 1)
                )
            )

    assert execution_count == 3
    assert await coordinator.claim(claimed_by="consumer-4", limit=1) == []


async def test_lag_reports_counts_and_oldest_actionable_age(
    db: DbSessionFactory,
) -> None:
    coordinator = DbEvalWorkCoordinator(db)

    empty = await coordinator.lag()
    assert empty.pending_count == 0
    assert empty.running_count == 0
    assert empty.retryable_error_count == 0
    assert empty.exhausted_error_count == 0
    assert empty.expired_count == 0
    assert empty.oldest_actionable_age_seconds is None

    unit_ids = await _seed_work_units(db, 7)
    now = datetime.now(timezone.utc)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_ids[0])
            .values(status="RUNNING", claimed_at=datetime.now(timezone.utc), claimed_by="c")
        )
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_ids[1])
            .values(status="DONE")
        )
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_ids[2])
            .values(
                status="ERROR",
                attempts=MAX_ATTEMPTS - 1,
                created_at=now - timedelta(seconds=120),
            )
        )
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_ids[3])
            .values(
                status="ERROR",
                attempts=MAX_ATTEMPTS,
                created_at=now - timedelta(seconds=3600),
            )
        )
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == unit_ids[6])
            .values(status="EXPIRED", error="pending TTL exceeded")
        )

    lag = await coordinator.lag()
    assert lag.pending_count == 2
    assert lag.running_count == 1
    assert lag.retryable_error_count == 1
    assert lag.exhausted_error_count == 1
    assert lag.expired_count == 1
    assert lag.oldest_actionable_age_seconds is not None
    assert 100.0 <= lag.oldest_actionable_age_seconds < 300.0


async def test_session_claim_lifecycle_and_lag(db: DbSessionFactory) -> None:
    with pytest.raises(ValueError, match="supports SPAN and SESSION"):
        DbEvalWorkCoordinator(db, evaluation_target="TRACE")

    project_session_id, unit_ids = await _seed_session_work_units(db, 5)
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")

    (claimed,) = await coordinator.claim(claimed_by="session-consumer", limit=1)
    assert claimed.evaluation_target == "SESSION"
    assert claimed.target_rowid == project_session_id
    assert claimed.identifier == "online:" + claimed.config_fingerprint[:16]
    assert await coordinator.heartbeat(
        work_unit_id=claimed.work_unit_id,
        claimed_by="session-consumer",
    )
    assert await coordinator.complete(
        work_unit_id=claimed.work_unit_id,
        claimed_by="session-consumer",
    )

    now = datetime.now(timezone.utc)
    async with db() as session:
        await session.execute(
            update(models.EvalSessionWorkUnit)
            .where(models.EvalSessionWorkUnit.id == unit_ids[1])
            .values(
                status="RUNNING",
                claimed_at=now - timedelta(seconds=LEASE_TTL_SECONDS + 1),
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
            .values(status="ERROR", attempts=MAX_ATTEMPTS)
        )

    (next_claimed,) = await coordinator.claim(claimed_by="session-consumer", limit=1)
    assert next_claimed.work_unit_id == unit_ids[2]
    async with db() as session:
        exhausted_lease = await session.get(models.EvalSessionWorkUnit, unit_ids[1])
        assert exhausted_lease is not None
        assert exhausted_lease.status == "RUNNING"
        assert exhausted_lease.attempts == MAX_ATTEMPTS - 1
        assert exhausted_lease.error is None

    lag = await coordinator.lag()
    assert lag.pending_count == 0
    assert lag.running_count == 2
    assert lag.retryable_error_count == 1
    assert lag.exhausted_error_count == 1
    assert lag.oldest_actionable_age_seconds is not None
    assert 100.0 <= lag.oldest_actionable_age_seconds < 300.0


@pytest.mark.parametrize("terminal_kind", ["exhausted_error", "expired"])
async def test_session_no_result_terminal_history_allows_replacement(
    db: DbSessionFactory,
    terminal_kind: str,
) -> None:
    project_session_id, (unit_id,) = await _seed_session_work_units(db, 1)
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
    async with db() as session:
        original = await session.get(models.EvalSessionWorkUnit, unit_id)
        assert original is not None
        scheduled_at = original.evaluated_through
    if terminal_kind == "exhausted_error":
        async with db() as session:
            await session.execute(
                update(models.EvalSessionWorkUnit)
                .where(models.EvalSessionWorkUnit.id == unit_id)
                .values(attempts=MAX_ATTEMPTS - 1)
            )
    (claimed,) = await coordinator.claim(claimed_by="session-consumer", limit=1)

    if terminal_kind == "exhausted_error":
        assert await coordinator.fail(
            work_unit_id=unit_id,
            claimed_by=claimed.claimed_by,
            error="no writable result",
        )
    else:
        assert await coordinator.expire(
            work_unit_id=unit_id,
            claimed_by=claimed.claimed_by,
            error=STALE_FINGERPRINT_ERROR,
        )

    async with db() as session:
        terminal = await session.get(models.EvalSessionWorkUnit, unit_id)
        assert terminal is not None
        assert terminal.status == ("ERROR" if terminal_kind == "exhausted_error" else "EXPIRED")
        assert terminal.evaluated_through == scheduled_at
        replacement = models.EvalSessionWorkUnit(
            project_session_rowid=terminal.project_session_rowid,
            evaluator_id=terminal.evaluator_id,
            criteria_id=terminal.criteria_id,
            config_fingerprint=terminal.config_fingerprint,
            evaluated_through=terminal.evaluated_through,
        )
        session.add(replacement)
        await session.flush()
        replacement_id = replacement.id
        annotations = (
            await session.scalars(
                select(models.ProjectSessionAnnotation).where(
                    models.ProjectSessionAnnotation.project_session_id == project_session_id
                )
            )
        ).all()

    assert replacement_id != unit_id
    assert annotations == []


@pytest.mark.postgres_only
async def test_claim_skips_rows_locked_by_a_concurrent_transaction(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    unit_ids = await _seed_work_units(db, 2)
    coordinator = DbEvalWorkCoordinator(db)

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
    owner = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
    competitor = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
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
    (reclaimed,) = await competitor.claim(claimed_by="competitor", limit=1)
    assert reclaimed.work_unit_id == unit_id


@pytest.mark.postgres_only
async def test_session_publish_holds_criteria_lock_against_disable(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    _, (unit_id,) = await _seed_session_work_units(db, 1)
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
    (claim,) = await coordinator.claim(claimed_by="owner", limit=1)
    entered = asyncio.Event()
    release = asyncio.Event()

    async def _write(session: AsyncSession) -> None:
        entered.set()
        await release.wait()

    async def _disable() -> None:
        async with db() as session:
            await session.execute(
                update(models.ProjectEvaluatorCriteria)
                .where(models.ProjectEvaluatorCriteria.id == claim.criteria_id)
                .values(enabled=False)
            )

    publication = asyncio.create_task(
        coordinator.publish(
            work_unit_id=unit_id,
            claimed_by=claim.claimed_by,
            write=_write,
        )
    )
    await entered.wait()
    disable = asyncio.create_task(_disable())
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(asyncio.shield(disable), timeout=0.1)
    release.set()
    await publication
    await disable
    async with db() as session:
        enabled = await session.scalar(
            select(models.ProjectEvaluatorCriteria.enabled).where(
                models.ProjectEvaluatorCriteria.id == claim.criteria_id
            )
        )
    assert enabled is False
