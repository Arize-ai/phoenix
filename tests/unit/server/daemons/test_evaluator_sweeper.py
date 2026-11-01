from datetime import datetime, timezone
from secrets import token_hex

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.daemons.evaluator_sweeper import (
    EvaluatorSweeper,
    cleanup_evaluator_project,
    cleanup_evaluator_projects,
)
from phoenix.server.types import DbSessionFactory


class TestEvaluatorSweeper:
    """Test suite for EvaluatorSweeper daemon and cleanup utilities."""

    async def test_cleanup_evaluator_project_chunked(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Verify chunked deletion of traces, sessions, and project."""
        project_name = f"dataset-evaluator-{token_hex(4)}"
        async with db() as session:
            project = models.Project(name=project_name)
            session.add(project)
            await session.flush()
            project_id = project.id

            # Add traces
            now = datetime.now(timezone.utc)
            for i in range(5):
                trace = models.Trace(
                    trace_id=f"trace-{token_hex(4)}",
                    project_rowid=project_id,
                    start_time=now,
                    end_time=now,
                )
                session.add(trace)

            # Add sessions
            for i in range(3):
                sess = models.ProjectSession(
                    project_id=project_id,
                    session_id=f"session-{token_hex(4)}",
                    start_time=now,
                    end_time=now,
                )
                session.add(sess)

            await session.flush()

        # Execute cleanup with batch_size=2 to test chunking
        await cleanup_evaluator_project(db, project_id, batch_size=2)

        async with db() as session:
            # Check traces deleted
            traces = (
                await session.scalars(
                    select(models.Trace).where(models.Trace.project_rowid == project_id)
                )
            ).all()
            assert len(traces) == 0

            # Check sessions deleted
            sessions = (
                await session.scalars(
                    select(models.ProjectSession).where(
                        models.ProjectSession.project_id == project_id
                    )
                )
            ).all()
            assert len(sessions) == 0

            # Check project deleted
            proj = await session.get(models.Project, project_id)
            assert proj is None

    async def test_cleanup_evaluator_projects_multiple(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Verify batch cleanup of multiple evaluator projects."""
        project_ids = []
        async with db() as session:
            for _ in range(2):
                project = models.Project(name=f"dataset-evaluator-{token_hex(4)}")
                session.add(project)
                await session.flush()
                project_ids.append(project.id)

        await cleanup_evaluator_projects(db, project_ids, batch_size=2)

        async with db() as session:
            for pid in project_ids:
                assert await session.get(models.Project, pid) is None

    async def test_evaluator_sweeper_enqueue_and_drain(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Verify EvaluatorSweeper enqueue and drain mechanics."""
        async with db() as session:
            project = models.Project(name=f"dataset-evaluator-{token_hex(4)}")
            session.add(project)
            await session.flush()
            project_id = project.id

        sweeper = EvaluatorSweeper(db)
        sweeper.enqueue_project_cleanup(project_id)
        await sweeper.drain()

        async with db() as session:
            assert await session.get(models.Project, project_id) is None

    async def test_evaluator_sweeper_lifecycle(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Verify EvaluatorSweeper active worker cleans up enqueued projects."""
        async with db() as session:
            project = models.Project(name=f"dataset-evaluator-{token_hex(4)}")
            session.add(project)
            await session.flush()
            project_id = project.id

        sweeper = EvaluatorSweeper(db)
        async with sweeper:
            sweeper.enqueue_project_cleanup(project_id)
            await sweeper.drain()

        async with db() as session:
            assert await session.get(models.Project, project_id) is None

    async def test_sweep_orphaned_evaluator_projects(
        self,
        db: DbSessionFactory,
        synced_builtin_evaluators: None,
    ) -> None:
        """Verify sweeping of unreferenced dataset-evaluator-* projects."""
        async with db() as session:
            builtin_evaluator_id = await session.scalar(select(models.BuiltinEvaluator.id).limit(1))
            assert builtin_evaluator_id is not None

            dataset = models.Dataset(name=f"dataset-{token_hex(4)}", metadata_={})
            session.add(dataset)
            await session.flush()

            # 1. Orphaned evaluator project
            orphan_project = models.Project(name=f"dataset-evaluator-{token_hex(4)}")
            # 2. Referenced evaluator project
            referenced_project = models.Project(name=f"dataset-evaluator-{token_hex(4)}")
            # 3. Regular unreferenced project
            regular_project = models.Project(name=f"regular-project-{token_hex(4)}")

            session.add_all([orphan_project, referenced_project, regular_project])
            await session.flush()

            orphan_id = orphan_project.id
            referenced_id = referenced_project.id
            regular_id = regular_project.id

            # Link referenced project to a DatasetEvaluators row
            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=builtin_evaluator_id,
                name=IdentifierModel.model_validate(f"eval-{token_hex(4)}"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project_id=referenced_id,
            )
            session.add(dataset_evaluator)
            await session.flush()

        sweeper = EvaluatorSweeper(db)
        await sweeper._sweep_orphaned_evaluator_projects()

        async with db() as session:
            # Orphan evaluator project should be cleaned up
            assert await session.get(models.Project, orphan_id) is None
            # Referenced evaluator project should be kept
            assert await session.get(models.Project, referenced_id) is not None
            # Regular project should NOT be swept
            assert await session.get(models.Project, regular_id) is not None
