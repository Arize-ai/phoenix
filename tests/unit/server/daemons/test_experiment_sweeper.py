from asyncio import Event
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator, NamedTuple, Optional
from unittest.mock import patch

import pytest
import sqlalchemy as sa

from phoenix.config import EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.server.cleanup.coordinator import CleanupCoordinator
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
        is_ephemeral: bool = False,
        updated_at: datetime | None = None,
    ) -> int:
        """Insert a dataset, dataset version, and experiment. Returns the experiment id.

        The sweeper deletes ephemeral rows by ``updated_at`` (last activity), not ``created_at``.
        Pass ``updated_at`` when the test needs a specific age for TTL (e.g. expired ephemerals).
        """
        async with db() as session:
            dataset = models.Dataset(name=f"dataset_for_{name}", metadata_={})
            session.add(dataset)
            await session.flush()

            version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
            session.add(version)
            await session.flush()

            experiment_kwargs: dict[str, Any] = dict(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name=name,
                is_ephemeral=is_ephemeral,
                repetitions=1,
                metadata_={},
                project_name=project_name,
                created_at=created_at,
            )
            if updated_at is not None:
                experiment_kwargs["updated_at"] = updated_at
            experiment = models.Experiment(**experiment_kwargs)
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
        1. Deletes expired ephemeral experiments (older than TTL)
        2. Deletes the associated projects only when no other experiments reference them
        3. Does NOT delete recent ephemeral experiments (within TTL)
        4. Does NOT delete old non-ephemeral experiments
        5. Keeps a project when an expired ephemeral and a remaining experiment share it
        6. Is idempotent — a second triggered cycle with nothing left to delete completes cleanly

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

        # Case 1: expired ephemeral experiment with its own project → experiment and project deleted
        expired_project_name = "expired_ephemeral_project"
        async with db() as session:
            session.add(models.Project(name=expired_project_name, kind="EXPERIMENT"))
        expired_temp_id = await self._insert_experiment(
            db,
            name="eval run",
            created_at=old,
            project_name=expired_project_name,
            is_ephemeral=True,
            updated_at=old,
        )

        # Case 2: recent ephemeral experiment → should NOT be deleted
        recent_temp_id = await self._insert_experiment(
            db,
            name="recent run",
            created_at=new,
            is_ephemeral=True,
        )

        # Case 3: old non-ephemeral experiment → should NOT be deleted
        old_permanent_id = await self._insert_experiment(
            db,
            name="permanent experiment",
            created_at=old,
        )

        # Case 4: expired ephemeral + non-ephemeral share a project → ephemeral deleted, project kept
        shared_project_name = "shared_project"
        async with db() as session:
            session.add(models.Project(name=shared_project_name, kind="EXPERIMENT"))
        await self._insert_experiment(
            db,
            name="expired ephemeral",
            created_at=old,
            project_name=shared_project_name,
            is_ephemeral=True,
            updated_at=old,
        )
        await self._insert_experiment(
            db,
            name="permanent with shared project",
            created_at=old,
            project_name=shared_project_name,
            is_ephemeral=False,
        )

        sweeper = ExperimentSweeper(db=db)
        await sweeper.start()

        # Yield to let the sweeper run its first DELETE cycle. The patched sleep signals
        # `done` after work finishes, then blocks on `release` — so by the time we return
        # from `done.wait()` the sweeper is parked and holds no open DB sessions.
        await rendezvous.done.wait()
        rendezvous.done.clear()

        coordinator = CleanupCoordinator(db)
        while (await coordinator.step_or_next_delay())[0]:
            pass

        assert not await self._experiment_exists(db, expired_temp_id), (
            "Expired ephemeral experiment should have been deleted"
        )
        assert not await self._project_exists(db, expired_project_name), (
            "Project associated only with expired ephemeral experiment should have been deleted"
        )
        assert await self._project_exists(db, shared_project_name), (
            "Project shared with a remaining non-ephemeral experiment must not be deleted"
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
        assert await self._project_exists(db, shared_project_name), (
            "Shared project should still be present after second cleanup cycle"
        )

        await sweeper.stop()

    async def test_sweeper_deletes_sdk_eval_traces_and_preserves_evaluator_and_live_traces(
        self,
        db: DbSessionFactory,
        rendezvous: Rendezvous,
    ) -> None:
        from secrets import token_hex

        from phoenix.server.dml_event import DmlEvent, ExperimentDeleteEvent, SpanDeleteEvent

        expired_time = datetime.now(timezone.utc) - timedelta(
            hours=EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS + 1
        )
        recent_time = datetime.now(timezone.utc)

        async with db() as session:
            sdk_evaluators_project = models.Project(name="evaluators", kind="STANDARD")
            evaluator_sink_project = models.Project(
                name=f"sweeper-eval-sink-{token_hex(4)}", kind="EVALUATOR"
            )
            dataset = models.Dataset(name=f"sweeper-ds-{token_hex(4)}", metadata_={})
            session.add_all([sdk_evaluators_project, evaluator_sink_project, dataset])
            await session.flush()

            dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
            dataset_example = models.DatasetExample(dataset_id=dataset.id)
            expired_sdk_trace = models.Trace(
                project_rowid=sdk_evaluators_project.id,
                trace_id=f"sweeper-expired-sdk-{token_hex(8)}",
                start_time=expired_time,
                end_time=expired_time,
            )
            recent_sdk_trace = models.Trace(
                project_rowid=sdk_evaluators_project.id,
                trace_id=f"sweeper-recent-sdk-{token_hex(8)}",
                start_time=recent_time,
                end_time=recent_time,
            )
            sink_trace = models.Trace(
                project_rowid=evaluator_sink_project.id,
                trace_id=f"sweeper-sink-{token_hex(8)}",
                start_time=expired_time,
                end_time=expired_time,
            )
            session.add_all(
                [
                    dataset_version,
                    dataset_example,
                    expired_sdk_trace,
                    recent_sdk_trace,
                    sink_trace,
                ]
            )
            await session.flush()

            expired_experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=dataset_version.id,
                name="expired-ephemeral",
                is_ephemeral=True,
                repetitions=1,
                metadata_={},
                created_at=expired_time,
                updated_at=expired_time,
            )
            recent_experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=dataset_version.id,
                name="recent-ephemeral",
                is_ephemeral=True,
                repetitions=1,
                metadata_={},
                created_at=recent_time,
                updated_at=recent_time,
            )
            session.add_all([expired_experiment, recent_experiment])
            await session.flush()

            expired_run = models.ExperimentRun(
                experiment_id=expired_experiment.id,
                dataset_example_id=dataset_example.id,
                repetition_number=1,
                output={"output": "expired"},
                start_time=expired_time,
                end_time=expired_time,
            )
            recent_run = models.ExperimentRun(
                experiment_id=recent_experiment.id,
                dataset_example_id=dataset_example.id,
                repetition_number=1,
                output={"output": "recent"},
                start_time=recent_time,
                end_time=recent_time,
            )
            session.add_all([expired_run, recent_run])
            await session.flush()
            session.add_all(
                [
                    models.ExperimentRunAnnotation(
                        experiment_run_id=expired_run.id,
                        name="sdk-eval",
                        annotator_kind="CODE",
                        score=1.0,
                        trace_id=expired_sdk_trace.trace_id,
                        metadata_={},
                        start_time=expired_time,
                        end_time=expired_time,
                    ),
                    models.ExperimentRunAnnotation(
                        experiment_run_id=expired_run.id,
                        name="server-eval",
                        annotator_kind="LLM",
                        score=1.0,
                        trace_id=sink_trace.trace_id,
                        metadata_={},
                        start_time=expired_time,
                        end_time=expired_time,
                    ),
                    models.ExperimentRunAnnotation(
                        experiment_run_id=recent_run.id,
                        name="sdk-eval",
                        annotator_kind="CODE",
                        score=1.0,
                        trace_id=recent_sdk_trace.trace_id,
                        metadata_={},
                        start_time=recent_time,
                        end_time=recent_time,
                    ),
                ]
            )
            await session.flush()
            expired_experiment_id = expired_experiment.id
            sdk_evaluators_project_id = sdk_evaluators_project.id
            expired_sdk_trace_rowid = expired_sdk_trace.id
            recent_sdk_trace_rowid = recent_sdk_trace.id
            sink_trace_rowid = sink_trace.id

        recorded_events: list[DmlEvent] = []

        class _RecordingQueue:
            def put(self, item: DmlEvent) -> None:
                recorded_events.append(item)

        sweeper = ExperimentSweeper(db=db, event_queue=_RecordingQueue())
        await sweeper.start()
        await rendezvous.done.wait()
        rendezvous.done.clear()
        await sweeper.stop()

        async with db() as session:
            assert await session.get(models.Trace, expired_sdk_trace_rowid) is None
            assert await session.get(models.Trace, recent_sdk_trace_rowid) is not None
            assert await session.get(models.Trace, sink_trace_rowid) is not None

        assert ExperimentDeleteEvent((expired_experiment_id,)) in recorded_events
        assert SpanDeleteEvent((sdk_evaluators_project_id,)) in recorded_events
