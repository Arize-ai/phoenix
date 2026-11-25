import asyncio
import logging
from datetime import datetime, timezone

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.server.api import utils as api_utils
from phoenix.server.api.utils import delete_projects, delete_traces, gather_cleanup_tasks
from phoenix.server.types import DbSessionFactory


async def test_delete_traces_empty_and_duplicates(db: DbSessionFactory) -> None:
    assert await delete_traces(db) == []

    now = datetime.now(timezone.utc)
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="dedup-trace-project").returning(models.Project.id)
        )
        assert project_id is not None
        target_id = await session.scalar(
            insert(models.Trace)
            .values(
                project_rowid=project_id,
                trace_id="trace-dup-target",
                start_time=now,
                end_time=now,
            )
            .returning(models.Trace.id)
        )
        assert target_id is not None

    deleted_ids = await delete_traces(db, "trace-dup-target", "trace-dup-target", "missing-trace")
    assert deleted_ids == [target_id]

    async with db() as session:
        remaining = list(await session.scalars(select(models.Trace.trace_id)))
    assert remaining == []


async def test_delete_traces_batches_large_input(db: DbSessionFactory) -> None:
    now = datetime.now(timezone.utc)
    trace_ids = [f"eval-trace-{idx:06d}" for idx in range(250_005)]
    target_trace_ids = [trace_ids[0], trace_ids[125_000], trace_ids[-1]]

    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="eval-trace-project").returning(models.Project.id)
        )
        assert project_id is not None
        expected_deleted_ids = set(
            await session.scalars(
                insert(models.Trace)
                .values(
                    [
                        {
                            "project_rowid": project_id,
                            "trace_id": trace_id,
                            "start_time": now,
                            "end_time": now,
                        }
                        for trace_id in target_trace_ids
                    ]
                )
                .returning(models.Trace.id)
            )
        )
        await session.execute(
            insert(models.Trace).values(
                project_rowid=project_id,
                trace_id="unrelated-trace",
                start_time=now,
                end_time=now,
            )
        )

    deleted_ids = await delete_traces(db, *trace_ids)
    assert set(deleted_ids) == expected_deleted_ids

    async with db() as session:
        remaining = list(await session.scalars(select(models.Trace.trace_id)))
    assert remaining == ["unrelated-trace"]


async def test_delete_projects_batches_input(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(api_utils, "_DELETE_BATCH_SIZE", 2, raising=False)
    project_names = [f"eval-project-{idx}" for idx in range(5)]

    async with db() as session:
        expected_deleted_ids = set(
            await session.scalars(
                insert(models.Project)
                .values([{"name": name} for name in project_names])
                .returning(models.Project.id)
            )
        )
        await session.execute(insert(models.Project).values(name="unrelated-project"))

    deleted_ids = await delete_projects(db, *project_names)
    assert set(deleted_ids) == expected_deleted_ids

    async with db() as session:
        remaining = list(await session.scalars(select(models.Project.name)))
    assert remaining == ["unrelated-project"]


async def test_gather_cleanup_tasks_logs_exceptions_and_reraises_cancellation(
    caplog: pytest.LogCaptureFixture,
) -> None:
    completed = False

    async def _succeed() -> None:
        nonlocal completed
        completed = True

    async def _fail() -> None:
        raise RuntimeError("cleanup boom")

    test_logger = logging.getLogger("phoenix.tests.gather_cleanup_tasks")
    with caplog.at_level(logging.ERROR, logger=test_logger.name):
        await gather_cleanup_tasks(
            ("projects", _succeed()),
            ("eval traces", _fail()),
            logger=test_logger,
            context="dataset 1",
        )

    assert completed
    assert len(caplog.records) == 1
    assert "Failed to clean up eval traces for dataset 1" in caplog.records[0].message
    assert caplog.records[0].exc_info is not None
    assert str(caplog.records[0].exc_info[1]) == "cleanup boom"

    caplog.clear()

    async def _cancel() -> None:
        raise asyncio.CancelledError

    with caplog.at_level(logging.ERROR, logger=test_logger.name):
        with pytest.raises(asyncio.CancelledError):
            await gather_cleanup_tasks(
                ("projects", _cancel()),
                ("eval traces", _fail()),
                logger=test_logger,
                context="dataset 2",
            )

    assert len(caplog.records) == 1
    assert "Failed to clean up eval traces for dataset 2" in caplog.records[0].message
