import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.clock import current_database_time
from phoenix.server.online_eval.leases import SCAN_LEASE_TTL_SECONDS, ScanLease
from phoenix.server.online_eval.span_producer import SpanEvaluationProducer
from phoenix.server.online_eval.sweeping_producer import (
    SessionEvaluationProducer,
    SweepingEvaluationProducer,
)
from phoenix.server.types import DbSessionFactory


@pytest.mark.parametrize(
    "dialect,expected_clock",
    [
        (SupportedSQLDialect.SQLITE, "strftime"),
        (SupportedSQLDialect.POSTGRESQL, "statement_timestamp()"),
    ],
)
async def test_current_database_time_uses_statement_time(
    dialect: SupportedSQLDialect,
    expected_clock: str,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = datetime.now(timezone.utc)

    await current_database_time(session, dialect)

    statement = session.scalar.await_args.args[0]
    assert expected_clock in str(statement)


async def test_lease_is_exclusive_while_held_and_taken_over_once_stale(
    db: DbSessionFactory,
) -> None:
    holder = ScanLease(db, name="span-producer", holder="replica-1")
    rival = ScanLease(db, name="span-producer", holder="replica-2")

    assert await holder.acquire()
    assert not await rival.acquire()
    assert await holder.renew()

    async with db() as session:
        now = await current_database_time(session, db.dialect)
        await session.execute(
            update(models.EvalWorkLease).values(
                heartbeat_at=now - timedelta(seconds=SCAN_LEASE_TTL_SECONDS + 1)
            )
        )
    assert await rival.acquire()
    assert not await holder.renew()

    await rival.release()
    assert await holder.acquire()


@pytest.mark.postgres_only
async def test_acquiring_a_lease_held_elsewhere_draws_no_new_id(db: DbSessionFactory) -> None:
    holder = ScanLease(db, name="span-producer", holder="replica-1")
    rival = ScanLease(db, name="span-producer", holder="replica-2")
    last_id = text("SELECT last_value FROM eval_work_leases_id_seq")

    assert await holder.acquire()
    async with db() as session:
        before = await session.scalar(last_id)
    assert not await rival.acquire()
    async with db() as session:
        assert await session.scalar(last_id) == before


@pytest.mark.parametrize("producer", ["span", "sweeping"])
async def test_stopping_a_producer_releases_its_lease(
    db: DbSessionFactory,
    producer: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    daemon: SpanEvaluationProducer | SweepingEvaluationProducer = (
        SpanEvaluationProducer(db) if producer == "span" else SessionEvaluationProducer(db)
    )
    acquired = asyncio.Event()

    async def _acquire_only() -> None:
        if await daemon._lease.acquire():
            acquired.set()

    monkeypatch.setattr(daemon, "_tick", _acquire_only)
    await daemon.start()
    await asyncio.wait_for(acquired.wait(), timeout=5)
    await daemon.stop()

    async with db() as session:
        lease = await session.scalar(
            select(models.EvalWorkLease).where(models.EvalWorkLease.name == daemon._lease.name)
        )
    assert lease is not None
    assert lease.holder is None
