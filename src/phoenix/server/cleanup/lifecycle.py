"""Domain admission helpers for project, dataset, and evaluator lifecycle cleanup."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy import and_, exists, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import DEFAULT_PROJECT_NAME, PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.evaluators.services.management import (
    garbage_collect_evaluators,
    lock_evaluators,
)
from phoenix.server.online_eval.clock import current_database_time


async def _lock_projects(
    session: AsyncSession,
    dialect: SupportedSQLDialect,
    project_ids: Iterable[int],
    *,
    key_share: bool = False,
) -> None:
    ids = sorted(set(project_ids))
    if ids and dialect is SupportedSQLDialect.POSTGRESQL:
        await session.execute(
            select(models.Project.id)
            .where(models.Project.id.in_(ids))
            .order_by(models.Project.id.asc())
            .with_for_update(key_share=key_share)
        )


async def _insert_cleanup_task(
    session: AsyncSession,
    *,
    kind: models.CleanupTaskKind,
    now: datetime,
) -> int:
    task_id = await session.scalar(
        insert(models.CleanupTask)
        .values(
            kind=kind,
            claimed_at=None,
            claimed_by=None,
            available_at=now,
            created_at=now,
        )
        .returning(models.CleanupTask.id)
    )
    assert isinstance(task_id, int)
    return task_id


async def logical_delete_project_evaluators(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    binding_ids: Iterable[int],
    collect_unused_evaluator: bool,
    collect_unused_source: bool,
) -> list[int]:
    """Tombstone live project evaluator bindings under canonical lock order, optionally run
    synchronous shared-definition GC, and enqueue one ``ProjectEvaluatorCleanupTask`` per
    deleted binding."""
    requested_ids = sorted(set(binding_ids))
    if not requested_ids:
        return []

    while True:
        discovered = (
            await session.execute(
                select(
                    models.ProjectEvaluator.id,
                    models.ProjectEvaluator.project_id,
                    models.ProjectEvaluator.trace_project_id,
                    models.ProjectEvaluator.evaluator_id,
                ).where(
                    models.ProjectEvaluator.id.in_(requested_ids),
                    models.ProjectEvaluator.deleted_at.is_(None),
                )
            )
        ).all()
        if not discovered:
            return []

        project_ids = {row.project_id for row in discovered} | {
            row.trace_project_id for row in discovered
        }
        evaluator_ids = {row.evaluator_id for row in discovered if row.evaluator_id is not None}

        # Canonical lock order (§4.2): Project (FOR NO KEY UPDATE) -> Evaluator -> Binding.
        await _lock_projects(session, dialect, project_ids, key_share=True)
        await lock_evaluators(session, evaluator_ids)

        bindings_stmt = (
            select(
                models.ProjectEvaluator.id,
                models.ProjectEvaluator.project_id,
                models.ProjectEvaluator.trace_project_id,
                models.ProjectEvaluator.evaluator_id,
            )
            .where(
                models.ProjectEvaluator.id.in_(requested_ids),
                models.ProjectEvaluator.deleted_at.is_(None),
            )
            .order_by(models.ProjectEvaluator.id.asc())
        )
        if dialect is SupportedSQLDialect.POSTGRESQL:
            bindings_stmt = bindings_stmt.with_for_update()
        locked_rows = (await session.execute(bindings_stmt)).all()
        if not locked_rows:
            return []

        locked_projects = {row.project_id for row in locked_rows} | {
            row.trace_project_id for row in locked_rows
        }
        locked_evaluators = {
            row.evaluator_id for row in locked_rows if row.evaluator_id is not None
        }
        if not (locked_projects <= project_ids and locked_evaluators <= evaluator_ids):
            # Discovery changed before locking; expand and retry on a fresh transaction.
            requested_ids = [row.id for row in locked_rows]
            project_ids |= locked_projects
            evaluator_ids |= locked_evaluators
            await _lock_projects(session, dialect, project_ids, key_share=True)
            await lock_evaluators(session, evaluator_ids)

        break

    now = await current_database_time(session, dialect)
    marked_ids = [int(row.id) for row in locked_rows]
    trace_project_ids = [int(row.trace_project_id) for row in locked_rows]
    candidate_evaluator_ids = {
        int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
    }

    prompt_ids: set[int] = set()
    decision_ids: set[int] = set()
    if collect_unused_evaluator and candidate_evaluator_ids:
        prompt_ids = set(
            await session.scalars(
                select(models.LLMEvaluator.prompt_id).where(
                    models.LLMEvaluator.id.in_(candidate_evaluator_ids)
                )
            )
        )
        decision_ids = set(
            await session.scalars(
                select(models.DecisionEvaluator.decision_id).where(
                    models.DecisionEvaluator.id.in_(candidate_evaluator_ids)
                )
            )
        )

    await session.execute(
        update(models.ProjectEvaluator)
        .where(models.ProjectEvaluator.id.in_(marked_ids))
        .values(
            deleted_at=now,
            enabled=False,
            evaluator_id=None,
            updated_at=now,
        )
    )
    await session.execute(
        update(models.Project)
        .where(
            models.Project.id.in_(trace_project_ids),
            models.Project.deleted_at.is_(None),
        )
        .values(deleted_at=now, updated_at=now)
    )

    for binding_id in marked_ids:
        task_id = await _insert_cleanup_task(
            session,
            kind="DELETE_PROJECT_EVALUATOR",
            now=now,
        )
        await session.execute(
            insert(models.ProjectEvaluatorCleanupTask).values(
                id=task_id,
                kind="DELETE_PROJECT_EVALUATOR",
                project_evaluator_id=binding_id,
            )
        )

    if collect_unused_evaluator and candidate_evaluator_ids:
        await garbage_collect_evaluators(
            session,
            dialect=dialect,
            evaluator_ids=candidate_evaluator_ids,
            prompt_ids=prompt_ids,
            decision_ids=decision_ids,
            delete_unused_source=collect_unused_source,
        )

    return marked_ids


async def logical_delete_dataset_evaluators(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    binding_ids: Iterable[int],
    collect_unused_evaluator: bool,
    collect_unused_source: bool,
) -> list[int]:
    """Tombstone live dataset evaluator bindings under canonical lock order, optionally run
    synchronous shared-definition GC, and enqueue one ``DatasetEvaluatorCleanupTask`` per
    deleted binding."""
    requested_ids = sorted(set(binding_ids))
    if not requested_ids:
        return []

    while True:
        discovered = (
            await session.execute(
                select(
                    models.DatasetEvaluators.id,
                    models.DatasetEvaluators.dataset_id,
                    models.DatasetEvaluators.project_id,
                    models.DatasetEvaluators.evaluator_id,
                ).where(
                    models.DatasetEvaluators.id.in_(requested_ids),
                    models.DatasetEvaluators.deleted_at.is_(None),
                )
            )
        ).all()
        if not discovered:
            return []

        dataset_ids = sorted(
            {int(row.dataset_id) for row in discovered if row.dataset_id is not None}
        )
        project_ids = {int(row.project_id) for row in discovered}
        evaluator_ids = {
            int(row.evaluator_id) for row in discovered if row.evaluator_id is not None
        }

        if dataset_ids and dialect is SupportedSQLDialect.POSTGRESQL:
            await session.execute(
                select(models.Dataset.id)
                .where(models.Dataset.id.in_(dataset_ids))
                .order_by(models.Dataset.id.asc())
                .with_for_update(key_share=True)
            )
        await _lock_projects(session, dialect, project_ids, key_share=True)
        await lock_evaluators(session, evaluator_ids)

        bindings_stmt = (
            select(
                models.DatasetEvaluators.id,
                models.DatasetEvaluators.dataset_id,
                models.DatasetEvaluators.project_id,
                models.DatasetEvaluators.evaluator_id,
            )
            .where(
                models.DatasetEvaluators.id.in_(requested_ids),
                models.DatasetEvaluators.deleted_at.is_(None),
            )
            .order_by(models.DatasetEvaluators.id.asc())
        )
        if dialect is SupportedSQLDialect.POSTGRESQL:
            bindings_stmt = bindings_stmt.with_for_update()
        locked_rows = (await session.execute(bindings_stmt)).all()
        if not locked_rows:
            return []

        locked_projects = {int(row.project_id) for row in locked_rows}
        locked_evaluators = {
            int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
        }
        if not (locked_projects <= project_ids and locked_evaluators <= evaluator_ids):
            project_ids |= locked_projects
            evaluator_ids |= locked_evaluators
            await _lock_projects(session, dialect, project_ids, key_share=True)
            await lock_evaluators(session, evaluator_ids)
        break

    now = await current_database_time(session, dialect)
    marked_ids = [int(row.id) for row in locked_rows]
    trace_project_ids = [int(row.project_id) for row in locked_rows]
    candidate_evaluator_ids = {
        int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
    }

    prompt_ids: set[int] = set()
    decision_ids: set[int] = set()
    if collect_unused_evaluator and candidate_evaluator_ids:
        prompt_ids = set(
            await session.scalars(
                select(models.LLMEvaluator.prompt_id).where(
                    models.LLMEvaluator.id.in_(candidate_evaluator_ids)
                )
            )
        )
        decision_ids = set(
            await session.scalars(
                select(models.DecisionEvaluator.decision_id).where(
                    models.DecisionEvaluator.id.in_(candidate_evaluator_ids)
                )
            )
        )

    await session.execute(
        update(models.DatasetEvaluators)
        .where(models.DatasetEvaluators.id.in_(marked_ids))
        .values(
            deleted_at=now,
            evaluator_id=None,
            updated_at=now,
        )
    )
    await session.execute(
        update(models.Project)
        .where(
            models.Project.id.in_(trace_project_ids),
            models.Project.deleted_at.is_(None),
        )
        .values(deleted_at=now, updated_at=now)
    )

    for binding_id in marked_ids:
        task_id = await _insert_cleanup_task(
            session,
            kind="DELETE_DATASET_EVALUATOR",
            now=now,
        )
        await session.execute(
            insert(models.DatasetEvaluatorCleanupTask).values(
                id=task_id,
                kind="DELETE_DATASET_EVALUATOR",
                dataset_evaluator_id=binding_id,
            )
        )

    if collect_unused_evaluator and candidate_evaluator_ids:
        await garbage_collect_evaluators(
            session,
            dialect=dialect,
            evaluator_ids=candidate_evaluator_ids,
            prompt_ids=prompt_ids,
            decision_ids=decision_ids,
            delete_unused_source=collect_unused_source,
        )

    return marked_ids


async def admit_project_delete(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    project_id: int,
) -> models.Project:
    """Tombstone a live non-evaluator project, detach its live bindings, and enqueue its
    ``ProjectDeleteCleanupTask`` (preserving any active clear task per §3.5)."""
    trace_project_ids = list(
        await session.scalars(
            select(models.ProjectEvaluator.trace_project_id).where(
                models.ProjectEvaluator.project_id == project_id,
                models.ProjectEvaluator.deleted_at.is_(None),
            )
        )
    )
    await _lock_projects(session, dialect, [project_id, *trace_project_ids])

    project = await session.get(models.Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound(f"Project with ID {project_id} not found")
    if project.name == DEFAULT_PROJECT_NAME:
        raise BadRequest(f"Cannot delete the {DEFAULT_PROJECT_NAME} project")

    holds_evaluator_traces = project.kind == "EVALUATOR" or (
        await session.scalar(
            select(
                or_(
                    exists().where(models.ProjectEvaluator.trace_project_id == project_id),
                    exists().where(models.DatasetEvaluators.project_id == project_id),
                )
            )
        )
    )
    if holds_evaluator_traces:
        raise Conflict("This project holds an evaluator's traces; delete the evaluator instead")

    current_live_bindings = list(
        await session.scalars(
            select(models.ProjectEvaluator.id).where(
                models.ProjectEvaluator.project_id == project_id,
                models.ProjectEvaluator.deleted_at.is_(None),
            )
        )
    )
    if current_live_bindings:
        await logical_delete_project_evaluators(
            session,
            dialect=dialect,
            binding_ids=current_live_bindings,
            collect_unused_evaluator=False,
            collect_unused_source=False,
        )

    now = await current_database_time(session, dialect)
    project.deleted_at = now
    project.updated_at = now

    existing_delete_task = await session.scalar(
        select(models.ProjectDeleteCleanupTask.id).where(
            models.ProjectDeleteCleanupTask.project_id == project_id
        )
    )
    if existing_delete_task is None:
        task_id = await _insert_cleanup_task(session, kind="DELETE_PROJECT", now=now)
        await session.execute(
            insert(models.ProjectDeleteCleanupTask).values(
                id=task_id,
                kind="DELETE_PROJECT",
                project_id=project_id,
            )
        )
    return project


async def admit_or_reuse_project_clear(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    project_id: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> int:
    """Admit a watermark clear task under the project lock, reusing an equivalent active clear
    or rejecting a conflicting active clear range (§3.4)."""
    await _lock_projects(session, dialect, [project_id])
    project = await session.get(models.Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound(f"Project with ID {project_id} not found")

    holds_evaluator_traces = project.kind == "EVALUATOR" or (
        await session.scalar(
            select(
                or_(
                    exists().where(models.ProjectEvaluator.trace_project_id == project_id),
                    exists().where(models.DatasetEvaluators.project_id == project_id),
                )
            )
        )
    )
    if holds_evaluator_traces:
        raise Conflict("This project holds an evaluator's traces; delete the evaluator instead")

    existing = (
        await session.execute(
            select(
                models.ProjectClearCleanupTask.id,
                models.ProjectClearCleanupTask.start_time,
                models.ProjectClearCleanupTask.end_time,
            ).where(models.ProjectClearCleanupTask.project_id == project_id)
        )
    ).one_or_none()
    if existing is not None:
        if existing.start_time == start_time and existing.end_time == end_time:
            return int(existing.id)
        raise Conflict(
            f"Another clear is in progress for project {project_id} (operation {existing.id})",
            reason="clear_in_progress",
            active_task_id=int(existing.id),
        )

    now = await current_database_time(session, dialect)
    max_trace_rowid = await models.capture_trace_max_rowid(session)
    task_id = await _insert_cleanup_task(session, kind="CLEAR_PROJECT_TRACES", now=now)
    await session.execute(
        insert(models.ProjectClearCleanupTask).values(
            id=task_id,
            kind="CLEAR_PROJECT_TRACES",
            project_id=project_id,
            max_trace_rowid=max_trace_rowid,
            start_time=start_time,
            end_time=end_time,
        )
    )
    return task_id


async def admit_exclusive_experiment_projects_delete(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    candidate_project_ids: Iterable[int],
) -> list[int]:
    """Tombstone and enqueue ``ProjectDeleteCleanupTask`` for ``EXPERIMENT`` projects in
    ``candidate_project_ids`` that have zero remaining ``Experiment`` references after the
    owning experiment/dataset rows were deleted in ``session``."""
    ids = sorted({pid for pid in candidate_project_ids if pid is not None})
    if not ids:
        return []

    await _lock_projects(session, dialect, ids)
    eligible_ids = list(
        await session.scalars(
            select(models.Project.id).where(
                models.Project.id.in_(ids),
                models.Project.deleted_at.is_(None),
                models.Project.kind == "EXPERIMENT",
                models.Project.name != PLAYGROUND_PROJECT_NAME,
                models.Project.name != DEFAULT_PROJECT_NAME,
                ~exists().where(models.Experiment.project_id == models.Project.id),
                ~exists().where(
                    and_(
                        models.Experiment.project_id.is_(None),
                        models.Experiment.project_name == models.Project.name,
                    )
                ),
            )
        )
    )
    deleted_ids: list[int] = []
    for project_id in eligible_ids:
        await admit_project_delete(session, dialect=dialect, project_id=project_id)
        deleted_ids.append(project_id)
    return deleted_ids


async def promote_retained_experiment_projects_to_standard(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    candidate_project_ids: Iterable[int],
) -> None:
    """When an experiment is deleted without deleting its project, promote any unreferenced
    ``EXPERIMENT`` project in ``candidate_project_ids`` to ``STANDARD`` so it remains visible
    in standard project listings."""
    ids = sorted({pid for pid in candidate_project_ids if pid is not None})
    if not ids:
        return

    await _lock_projects(session, dialect, ids)
    now = await current_database_time(session, dialect)
    await session.execute(
        update(models.Project)
        .where(
            models.Project.id.in_(ids),
            models.Project.deleted_at.is_(None),
            models.Project.kind == "EXPERIMENT",
            models.Project.name != PLAYGROUND_PROJECT_NAME,
            models.Project.name != DEFAULT_PROJECT_NAME,
            ~exists().where(models.Experiment.project_id == models.Project.id),
            ~exists().where(
                and_(
                    models.Experiment.project_id.is_(None),
                    models.Experiment.project_name == models.Project.name,
                )
            ),
        )
        .values(kind="STANDARD", updated_at=now)
    )
