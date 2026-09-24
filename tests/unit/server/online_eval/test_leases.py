from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.leases import (
    MATERIALIZER_LEASE_TTL_SECONDS,
    MaterializerLease,
    current_database_time,
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
    holder = MaterializerLease(db, name="span-producer", holder="replica-1")
    rival = MaterializerLease(db, name="span-producer", holder="replica-2")

    assert await holder.acquire()
    assert not await rival.acquire()
    assert await holder.renew()

    async with db() as session:
        await session.execute(
            update(models.EvalWorkLease).values(
                heartbeat_at=datetime.now(timezone.utc)
                - timedelta(seconds=MATERIALIZER_LEASE_TTL_SECONDS + 1)
            )
        )
    assert await rival.acquire()
    assert not await holder.renew()

    await rival.release()
    assert await holder.acquire()
