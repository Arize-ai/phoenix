from asyncio import Event
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator, NamedTuple, Optional
from unittest.mock import patch

import pytest
import sqlalchemy as sa

from phoenix.config import (
    EPHEMERAL_EXPERIMENT_SUFFIX,
    EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS,
)
from phoenix.db import models
from phoenix.server.daemons.experiment_sweeper import ExperimentSweeper
from phoenix.server.types import DbSessionFactory


class Rendezvous(NamedTuple):
    release: Event  # test releases the daemon to loop again
    done: Event  # daemon signals it has finished a cycle


@pytest.fixture
async def rendezvous() -> AsyncIterator[Rendezvous]:
    """Rendezvous fixture for ExperimentSweeper.

    The sweeper runs work first, then sleeps. The patched sleep signals `done`
    (work is finished) before parking on `release` (waiting for the test to
    release the loop). This gives the test an exact signal that the daemon has
    parked and holds no open DB sessions, avoiding SQLite savepoint ordering
    conflicts.
    """
    rendezvous = Rendezvous(release=Event(), done=Event())

    async def wait_for_event(*_: Any, **__: Any) -> None:
        rendezvous.done.set()
        await rendezvous.release.wait()
        rendezvous.release.clear()

    with patch("phoenix.server.daemons.experiment_sweeper.sleep", wait_for_event):
        yield rendezvous


class TestExperimentSweeper:
    """Test cases for ExperimentSweeper daemon."""

    async def _insert_experiment(
        self,
        db: DbSessionFactory,
        name: str,
        created_at: datetime,
        project_name: Optional[str] = None,
    ) -> int:
        """Insert a dataset, dataset version, and experiment. Returns the experiment id."""
        async with db() as session:
            dataset = models.Dataset(name=f"dataset_for_{name}", metadata_={})
            session.add(dataset)
            await session.flush()

            version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
            session.add(version)
            await session.flush()

            experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name=name,
                repetitions=1,
                metadata_={},
                project_name=project_name,
                created_at=created_at,
            )
            session.add(experiment)
            await session.flush()
            return int(experiment.id)

    async def _experiment_exists(self, db: DbSessionFactory, experiment_id: int) -> bool:
        async with db() as session:
            result = await session.scalar(
                sa.select(models.Experiment).where(models.Experiment.id == experiment_id)
            )
            return result is not None

    async def _project_exists(self, db: DbSessionFactory, project_name: str) -> bool:
        async with db() as session:
            result = await session.scalar(
                sa.select(models.Project).where(models.Project.name == project_name)
            )
            return result is not None

    async def test_experiment_sweeper_lifecycle(
        self,
        db: DbSessionFactory,
        rendezvous: Rendezvous,
    ) -> None:
        """
        Test that ExperimentSweeper correctly handles experiment cleanup.

        This test verifies that the sweeper:
        1. Deletes expired ephemeral experiments (older than TTL, with EPHEMERAL suffix)
        2. Deletes the associated projects for those experiments
        3. Does NOT delete recent ephemeral experiments (within TTL)
        4. Does NOT delete old experiments without the EPHEMERAL suffix
        5. Is idempotent — a second triggered cycle with nothing left to delete completes cleanly

        Synchronization via Rendezvous:
        - `done` is set by the patched sleep immediately after work finishes, so the test
          knows exactly when a cycle has completed before opening any assertion DB sessions
        - `release` releases the daemon to loop again
        - Assertions only run while the daemon is parked on `release.wait()`, so there are no
          concurrent DB sessions to conflict with SQLite's LIFO savepoint ordering
        """
        old = datetime.now(timezone.utc) - timedelta(
            hours=EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS + 1
        )
        new = datetime.now(timezone.utc)

        # Case 1: expired ephemeral experiment with associated project → should be deleted
        expired_project_name = "expired_ephemeral_project"
        async with db() as session:
            session.add(models.Project(name=expired_project_name))
        expired_temp_id = await self._insert_experiment(
            db,
            name=f"eval run {EPHEMERAL_EXPERIMENT_SUFFIX}",
            created_at=old,
            project_name=expired_project_name,
        )

        # Case 2: recent ephemeral experiment → should NOT be deleted
        recent_temp_id = await self._insert_experiment(
            db,
            name=f"recent run {EPHEMERAL_EXPERIMENT_SUFFIX}",
            created_at=new,
        )

        # Case 3: old non-ephemeral experiment → should NOT be deleted
        old_permanent_id = await self._insert_experiment(
            db,
            name="permanent experiment",
            created_at=old,
        )

        sweeper = ExperimentSweeper(db=db)
        await sweeper.start()

        # Yield to let the sweeper run its first DELETE cycle. The patched sleep signals
        # `done` after work finishes, then blocks on `release` — so by the time we return
        # from `done.wait()` the sweeper is parked and holds no open DB sessions.
        await rendezvous.done.wait()
        rendezvous.done.clear()

        assert not await self._experiment_exists(db, expired_temp_id), (
            "Expired ephemeral experiment should have been deleted"
        )
        assert not await self._project_exists(db, expired_project_name), (
            "Project associated with expired ephemeral experiment should have been deleted"
        )
        assert await self._experiment_exists(db, recent_temp_id), (
            "Recent ephemeral experiment should not have been deleted"
        )
        assert await self._experiment_exists(db, old_permanent_id), (
            "Non-ephemeral experiment should not have been deleted"
        )

        # Trigger a second cycle to verify idempotency (nothing left to delete)
        rendezvous.release.set()
        await rendezvous.done.wait()
        rendezvous.done.clear()

        assert await self._experiment_exists(db, recent_temp_id), (
            "Recent ephemeral experiment should still be present after second cleanup cycle"
        )
        assert await self._experiment_exists(db, old_permanent_id), (
            "Non-ephemeral experiment should still be present after second cleanup cycle"
        )

        await sweeper.stop()
