import asyncio

import pytest
from sqlalchemy import text

from phoenix.server.types import DbSessionFactory


def _orphaned_session_closes() -> list["asyncio.Task[object]"]:
    """SQLAlchemy runs a cancelled session's close under asyncio.shield as its own task;
    one that never finishes wedges the event loop's shutdown."""
    return [
        task
        for task in asyncio.all_tasks()
        if task is not asyncio.current_task()
        and not task.done()
        and "__aexit__" in repr(task.get_coro())
    ]


@pytest.mark.postgres_only
async def test_cancelling_a_task_mid_statement_leaves_no_orphaned_session_close(
    db: DbSessionFactory,
) -> None:
    started = asyncio.Event()

    async def work() -> None:
        async with db() as session:
            started.set()
            await session.execute(text("SELECT pg_sleep(30)"))

    task = asyncio.create_task(work())
    await asyncio.wait_for(started.wait(), timeout=5)
    await asyncio.sleep(0.2)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    for _ in range(50):
        if not _orphaned_session_closes():
            break
        await asyncio.sleep(0.1)
    assert _orphaned_session_closes() == []

    async with db() as session:
        assert (await session.execute(text("SELECT 1"))).scalar() == 1


@pytest.mark.postgres_only
async def test_a_session_that_completes_normally_keeps_its_connection(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        assert (await session.execute(text("SELECT 1"))).scalar() == 1
    async with db() as session:
        assert (await session.execute(text("SELECT 2"))).scalar() == 2
