from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.online_eval.leases import DatabaseLease
from phoenix.server.types import DbSessionFactory

_LEASE_NAME = "test-lease"


def _lease(db: DbSessionFactory, holder_id: str = "holder-1") -> DatabaseLease:
    return DatabaseLease(
        db,
        entity=models.EvalWorkLease,
        key=(models.EvalWorkLease.name == _LEASE_NAME,),
        holder_column=models.EvalWorkLease.holder,
        heartbeat_column=models.EvalWorkLease.heartbeat_at,
        holder_id=holder_id,
        ttl_seconds=90.0,
    )


async def _insert_lease(session: AsyncSession) -> None:
    session.add(models.EvalWorkLease(name=_LEASE_NAME))


async def _read_lease(db: DbSessionFactory) -> models.EvalWorkLease:
    async with db() as session:
        return (
            await session.scalars(
                select(models.EvalWorkLease).where(models.EvalWorkLease.name == _LEASE_NAME)
            )
        ).one()


async def test_lease_is_acquired_renewed_fenced_and_released(db: DbSessionFactory) -> None:
    lease = _lease(db)
    before = datetime.now(timezone.utc) - timedelta(seconds=60)

    lease_id = await lease.acquire(models.EvalWorkLease.id, bootstrap=_insert_lease)

    assert lease_id is not None
    assert lease.held
    acquired = await _read_lease(db)
    assert acquired.holder == "holder-1"
    assert acquired.heartbeat_at is not None
    assert acquired.heartbeat_at > before

    async with db() as session:
        await session.execute(
            update(models.EvalWorkLease)
            .where(models.EvalWorkLease.id == lease_id)
            .values(heartbeat_at=before)
        )
    await lease.renew()
    renewed = await _read_lease(db)
    assert renewed.heartbeat_at is not None
    assert renewed.heartbeat_at > before

    # The fence rides in the caller's transaction, so its heartbeat and whatever that
    # transaction staged commit together.
    async with db() as session:
        await session.execute(
            update(models.EvalWorkLease)
            .where(models.EvalWorkLease.id == lease_id)
            .values(heartbeat_at=before)
        )
        await lease.fence(session)
    fenced = await _read_lease(db)
    assert fenced.heartbeat_at is not None
    assert fenced.heartbeat_at > before

    await lease.release()

    assert not lease.held
    released = await _read_lease(db)
    assert released.holder is None
    assert released.heartbeat_at is None
