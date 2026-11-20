"""Domain admission helpers for project, dataset, and evaluator lifecycle cleanup."""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional, Protocol

from sqlalchemy import and_, delete, exists, insert, literal, or_, select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import DEFAULT_PROJECT_NAME, PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, get_eval_trace_ids_for_datasets
from phoenix.db.insertion.helpers import get_sqlstate
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.cleanup.primitives import (
    CLEANUP_BATCH_ROWS,
    PrimitiveStatus,
    drain_traces_step,
)
from phoenix.server.dml_event import (
    DatasetDeleteEvent,
    DmlEvent,
    ProjectDeleteEvent,
    SpanDeleteEvent,
)
from phoenix.server.evaluators.services.management import (
    garbage_collect_evaluators,
    lock_evaluators,
)
from phoenix.server.online_eval.clock import current_database_time
from phoenix.server.types import CanPutItem, DbSessionFactory

_TRACE_DRAIN_STATEMENT_TIMEOUT_MS = 60_000
_TRACE_DRAIN_LOCK_TIMEOUT_MS = 5_000
_TRANSIENT_CONTENTION_SQLSTATES = frozenset({"55P03", "40P01"})
_MAX_YIELD_RETRIES_PER_CHUNK = 5
_YIELD_RETRY_DELAY_SECONDS = 0.05


class CanStopExperiment(Protocol):
    async def stop_experiment(self, experiment_id: int) -> Any: ...


@dataclass(frozen=True)
class LogicalEvaluatorDeleteResult:
    binding_ids: list[int]
    tombstoned_project_ids: list[int]


@dataclass(frozen=True)
class AdmittedProjectDelete:
    project: models.Project
    tombstoned_project_ids: list[int]


@dataclass(frozen=True)
class AdmittedDatasetDelete:
    dataset: models.Dataset
    experiment_ids: list[int]
    eval_trace_ids: list[str]
    tombstoned_project_ids: list[int]
    enqueued_cleanup: bool


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


async def _lock_additional_projects(
    session: AsyncSession,
    dialect: SupportedSQLDialect,
    *,
    locked_project_ids: set[int],
    target_project_ids: Iterable[int],
) -> None:
    """Lock newly discovered project IDs without violating ascending ``Project.id`` wait order."""
    missing_ids = sorted(set(target_project_ids) - locked_project_ids)
    if not missing_ids:
        return
    if locked_project_ids:
        max_locked_id = max(locked_project_ids)
        lower_ids = [project_id for project_id in missing_ids if project_id < max_locked_id]
        higher_ids = [project_id for project_id in missing_ids if project_id > max_locked_id]
    else:
        lower_ids = []
        higher_ids = missing_ids

    if lower_ids and dialect is SupportedSQLDialect.POSTGRESQL:
        try:
            async with session.begin_nested():
                await session.execute(
                    select(models.Project.id)
                    .where(models.Project.id.in_(lower_ids))
                    .order_by(models.Project.id.asc())
                    .with_for_update(key_share=True, nowait=True)
                )
        except DBAPIError as error:
            if get_sqlstate(error) == "55P03":
                raise Conflict(
                    "Project evaluators were modified concurrently; retry the delete operation"
                ) from error
            raise
    if higher_ids:
        await _lock_projects(session, dialect, higher_ids, key_share=True)
    locked_project_ids.update(missing_ids)


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
    collect_unused_prompt_or_decision: bool,
) -> LogicalEvaluatorDeleteResult:
    """Tombstone live project evaluator bindings under canonical lock order, optionally run
    synchronous shared-definition GC, and enqueue one ``ProjectEvaluatorCleanupTask`` per
    deleted binding."""
    requested_ids = sorted(set(binding_ids))
    if not requested_ids:
        return LogicalEvaluatorDeleteResult(binding_ids=[], tombstoned_project_ids=[])

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
        return LogicalEvaluatorDeleteResult(binding_ids=[], tombstoned_project_ids=[])

    discovered_ids = [int(row.id) for row in discovered]
    project_ids = {int(row.project_id) for row in discovered} | {
        int(row.trace_project_id) for row in discovered
    }
    evaluator_ids = {int(row.evaluator_id) for row in discovered if row.evaluator_id is not None}

    # Canonical lock order: Project (FOR NO KEY UPDATE) -> Evaluator -> Binding.
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
            models.ProjectEvaluator.id.in_(discovered_ids),
            models.ProjectEvaluator.deleted_at.is_(None),
        )
        .order_by(models.ProjectEvaluator.id.asc())
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        bindings_stmt = bindings_stmt.with_for_update()
    locked_rows = (await session.execute(bindings_stmt)).all()
    if not locked_rows:
        return LogicalEvaluatorDeleteResult(binding_ids=[], tombstoned_project_ids=[])

    locked_projects = {int(row.project_id) for row in locked_rows} | {
        int(row.trace_project_id) for row in locked_rows
    }
    locked_evaluators = {
        int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
    }
    if not (locked_projects <= project_ids and locked_evaluators <= evaluator_ids):
        # Owner and evaluator identities are immutable for a live binding. Acquiring a
        # newly discovered earlier lock here would violate the transaction's lock order.
        raise RuntimeError("Live evaluator binding ownership changed while acquiring locks")

    now = await current_database_time(session, dialect)
    marked_ids = [int(row.id) for row in locked_rows]
    trace_project_ids = [int(row.trace_project_id) for row in locked_rows]
    candidate_evaluator_ids = {
        int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
    }

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
    tombstoned_project_ids = sorted(
        set(
            await session.scalars(
                update(models.Project)
                .where(
                    models.Project.id.in_(trace_project_ids),
                    models.Project.deleted_at.is_(None),
                )
                .values(deleted_at=now, updated_at=now)
                .returning(models.Project.id)
            )
        )
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
            delete_unused_prompt_or_decision=collect_unused_prompt_or_decision,
        )

    return LogicalEvaluatorDeleteResult(
        binding_ids=marked_ids,
        tombstoned_project_ids=tombstoned_project_ids,
    )


async def logical_delete_dataset_evaluators(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    binding_ids: Iterable[int],
    collect_unused_evaluator: bool,
    collect_unused_prompt_or_decision: bool,
) -> LogicalEvaluatorDeleteResult:
    """Tombstone live dataset evaluator bindings under canonical lock order, optionally run
    synchronous shared-definition GC, and enqueue one ``DatasetEvaluatorCleanupTask`` per
    deleted binding."""
    requested_ids = sorted(set(binding_ids))
    if not requested_ids:
        return LogicalEvaluatorDeleteResult(binding_ids=[], tombstoned_project_ids=[])

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
        return LogicalEvaluatorDeleteResult(binding_ids=[], tombstoned_project_ids=[])

    discovered_ids = [int(row.id) for row in discovered]
    dataset_ids = {int(row.dataset_id) for row in discovered if row.dataset_id is not None}
    project_ids = {int(row.project_id) for row in discovered}
    evaluator_ids = {int(row.evaluator_id) for row in discovered if row.evaluator_id is not None}

    if dataset_ids and dialect is SupportedSQLDialect.POSTGRESQL:
        await session.execute(
            select(models.Dataset.id)
            .where(models.Dataset.id.in_(sorted(dataset_ids)))
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
            models.DatasetEvaluators.id.in_(discovered_ids),
            models.DatasetEvaluators.deleted_at.is_(None),
        )
        .order_by(models.DatasetEvaluators.id.asc())
    )
    if dialect is SupportedSQLDialect.POSTGRESQL:
        bindings_stmt = bindings_stmt.with_for_update()
    locked_rows = (await session.execute(bindings_stmt)).all()
    if not locked_rows:
        return LogicalEvaluatorDeleteResult(binding_ids=[], tombstoned_project_ids=[])

    locked_datasets = {int(row.dataset_id) for row in locked_rows if row.dataset_id is not None}
    locked_projects = {int(row.project_id) for row in locked_rows}
    locked_evaluators = {
        int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
    }
    if not (
        locked_datasets <= dataset_ids
        and locked_projects <= project_ids
        and locked_evaluators <= evaluator_ids
    ):
        # Owner and evaluator identities are immutable for a live binding. Acquiring a
        # newly discovered earlier lock here would violate the transaction's lock order.
        raise RuntimeError("Live evaluator binding ownership changed while acquiring locks")

    now = await current_database_time(session, dialect)
    marked_ids = [int(row.id) for row in locked_rows]
    trace_project_ids = [int(row.project_id) for row in locked_rows]
    candidate_evaluator_ids = {
        int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
    }

    await session.execute(
        update(models.DatasetEvaluators)
        .where(models.DatasetEvaluators.id.in_(marked_ids))
        .values(
            deleted_at=now,
            evaluator_id=None,
            updated_at=now,
        )
    )
    tombstoned_project_ids = sorted(
        set(
            await session.scalars(
                update(models.Project)
                .where(
                    models.Project.id.in_(trace_project_ids),
                    models.Project.deleted_at.is_(None),
                )
                .values(deleted_at=now, updated_at=now)
                .returning(models.Project.id)
            )
        )
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
            delete_unused_prompt_or_decision=collect_unused_prompt_or_decision,
        )

    return LogicalEvaluatorDeleteResult(
        binding_ids=marked_ids,
        tombstoned_project_ids=tombstoned_project_ids,
    )


async def lock_dataset_delete_targets(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    dataset_id: int,
    candidate_project_ids: Iterable[int],
) -> list[int]:
    """Acquire all ``Project`` and ``Evaluator`` locks needed for dataset deletion in canonical
    ``Dataset -> Project (id ASC) -> Evaluator (id ASC)`` order, returning live dataset binding IDs.
    """
    exp_project_ids = {project_id for project_id in candidate_project_ids if project_id is not None}
    live_dataset_bindings = (
        await session.execute(
            select(
                models.DatasetEvaluators.id,
                models.DatasetEvaluators.project_id,
                models.DatasetEvaluators.evaluator_id,
            ).where(
                models.DatasetEvaluators.dataset_id == dataset_id,
                models.DatasetEvaluators.deleted_at.is_(None),
            )
        )
    ).all()

    initial_exp_bindings = (
        (
            await session.execute(
                select(
                    models.ProjectEvaluator.trace_project_id,
                    models.ProjectEvaluator.evaluator_id,
                ).where(
                    models.ProjectEvaluator.project_id.in_(exp_project_ids),
                    models.ProjectEvaluator.deleted_at.is_(None),
                )
            )
        ).all()
        if exp_project_ids
        else []
    )

    locked_project_ids = {
        *exp_project_ids,
        *(int(row.project_id) for row in live_dataset_bindings),
        *(int(row.trace_project_id) for row in initial_exp_bindings),
    }
    await _lock_projects(session, dialect, locked_project_ids, key_share=True)

    current_exp_bindings = (
        (
            await session.execute(
                select(
                    models.ProjectEvaluator.trace_project_id,
                    models.ProjectEvaluator.evaluator_id,
                ).where(
                    models.ProjectEvaluator.project_id.in_(exp_project_ids),
                    models.ProjectEvaluator.deleted_at.is_(None),
                )
            )
        ).all()
        if exp_project_ids
        else []
    )
    if current_exp_bindings:
        await _lock_additional_projects(
            session,
            dialect,
            locked_project_ids=locked_project_ids,
            target_project_ids=(int(row.trace_project_id) for row in current_exp_bindings),
        )

    all_evaluator_ids = {
        int(row.evaluator_id) for row in live_dataset_bindings if row.evaluator_id is not None
    } | {int(row.evaluator_id) for row in current_exp_bindings if row.evaluator_id is not None}
    await lock_evaluators(session, all_evaluator_ids)

    return [int(row.id) for row in live_dataset_bindings]


async def admit_project_delete(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    project_id: int,
) -> AdmittedProjectDelete:
    """Tombstone a live non-evaluator project, detach its live bindings, and enqueue its
    ``ProjectDeleteCleanupTask`` (preserving any active clear task)."""
    initial_trace_project_ids = list(
        await session.scalars(
            select(models.ProjectEvaluator.trace_project_id).where(
                models.ProjectEvaluator.project_id == project_id,
                models.ProjectEvaluator.deleted_at.is_(None),
            )
        )
    )
    locked_project_ids = {
        project_id,
        *(int(trace_project_id) for trace_project_id in initial_trace_project_ids),
    }
    await _lock_projects(session, dialect, locked_project_ids, key_share=True)

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
    await _lock_projects(session, dialect, [project_id], key_share=False)

    current_live_bindings = (
        await session.execute(
            select(
                models.ProjectEvaluator.id,
                models.ProjectEvaluator.trace_project_id,
            ).where(
                models.ProjectEvaluator.project_id == project_id,
                models.ProjectEvaluator.deleted_at.is_(None),
            )
        )
    ).all()
    tombstoned_trace_project_ids: list[int] = []
    if current_live_bindings:
        await _lock_additional_projects(
            session,
            dialect,
            locked_project_ids=locked_project_ids,
            target_project_ids=(int(row.trace_project_id) for row in current_live_bindings),
        )
        binding_delete_result = await logical_delete_project_evaluators(
            session,
            dialect=dialect,
            binding_ids=[int(row.id) for row in current_live_bindings],
            collect_unused_evaluator=False,
            collect_unused_prompt_or_decision=False,
        )
        tombstoned_trace_project_ids = binding_delete_result.tombstoned_project_ids

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
    return AdmittedProjectDelete(
        project=project,
        tombstoned_project_ids=sorted({project_id, *tombstoned_trace_project_ids}),
    )


async def admit_or_reuse_project_clear(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    project_id: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> int:
    """Admit a watermark clear task under the project lock, reusing an equivalent active clear
    or rejecting a conflicting active clear range."""
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
            "Another trace clear is already in progress for this project",
            reason="clear_in_progress",
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
    ids = sorted({project_id for project_id in candidate_project_ids if project_id is not None})
    if not ids:
        return []

    initial_trace_project_ids = list(
        await session.scalars(
            select(models.ProjectEvaluator.trace_project_id).where(
                models.ProjectEvaluator.project_id.in_(ids),
                models.ProjectEvaluator.deleted_at.is_(None),
            )
        )
    )
    locked_project_ids = {*ids, *(int(pid) for pid in initial_trace_project_ids)}
    await _lock_projects(session, dialect, locked_project_ids, key_share=True)

    eligible_ids = list(
        await session.scalars(
            select(models.Project.id)
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
                ~exists().where(models.ProjectEvaluator.trace_project_id == models.Project.id),
                ~exists().where(models.DatasetEvaluators.project_id == models.Project.id),
            )
            .order_by(models.Project.id.asc())
        )
    )
    if not eligible_ids:
        return []

    current_live_bindings = (
        await session.execute(
            select(
                models.ProjectEvaluator.id,
                models.ProjectEvaluator.trace_project_id,
            ).where(
                models.ProjectEvaluator.project_id.in_(eligible_ids),
                models.ProjectEvaluator.deleted_at.is_(None),
            )
        )
    ).all()
    tombstoned_trace_project_ids: list[int] = []
    if current_live_bindings:
        await _lock_additional_projects(
            session,
            dialect,
            locked_project_ids=locked_project_ids,
            target_project_ids=(int(row.trace_project_id) for row in current_live_bindings),
        )
        binding_delete_result = await logical_delete_project_evaluators(
            session,
            dialect=dialect,
            binding_ids=[int(row.id) for row in current_live_bindings],
            collect_unused_evaluator=False,
            collect_unused_prompt_or_decision=False,
        )
        tombstoned_trace_project_ids = binding_delete_result.tombstoned_project_ids

    now = await current_database_time(session, dialect)
    await session.execute(
        update(models.Project)
        .where(models.Project.id.in_(eligible_ids))
        .values(deleted_at=now, updated_at=now)
    )
    existing_delete_project_ids = set(
        await session.scalars(
            select(models.ProjectDeleteCleanupTask.project_id).where(
                models.ProjectDeleteCleanupTask.project_id.in_(eligible_ids)
            )
        )
    )
    for project_id in eligible_ids:
        if project_id not in existing_delete_project_ids:
            task_id = await _insert_cleanup_task(session, kind="DELETE_PROJECT", now=now)
            await session.execute(
                insert(models.ProjectDeleteCleanupTask).values(
                    id=task_id,
                    kind="DELETE_PROJECT",
                    project_id=project_id,
                )
            )
    return sorted({*eligible_ids, *tombstoned_trace_project_ids})


async def promote_retained_experiment_projects_to_standard(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    candidate_project_ids: Iterable[int],
) -> None:
    """When an experiment is deleted without deleting its project, promote any unreferenced
    ``EXPERIMENT`` project in ``candidate_project_ids`` to ``STANDARD`` so it remains visible
    in standard project listings."""
    ids = sorted({project_id for project_id in candidate_project_ids if project_id is not None})
    if not ids:
        return

    await _lock_projects(session, dialect, ids, key_share=True)
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


async def delete_standalone_traces_by_trace_id(
    db: DbSessionFactory,
    trace_ids: Iterable[str],
    *,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> set[int]:
    """Drain standalone traces matching ``trace_ids`` in bounded batches, skipping traces
    owned by ``EVALUATOR`` or tombstoned projects, and emit ``SpanDeleteEvent`` for
    affected projects."""
    if batch_limit <= 0:
        raise ValueError("batch_limit must be positive")
    unique_trace_ids = sorted({trace_id for trace_id in trace_ids if trace_id})
    if not unique_trace_ids:
        return set()

    dialect = SupportedSQLDialect(db.dialect.value)
    chunk_size = min(batch_limit, CLEANUP_BATCH_ROWS)
    affected_project_ids: set[int] = set()

    for chunk_start in range(0, len(unique_trace_ids), chunk_size):
        chunk_trace_ids = unique_trace_ids[chunk_start : chunk_start + chunk_size]
        async with db() as session:
            if dialect is SupportedSQLDialect.POSTGRESQL:
                await session.execute(
                    text(f"SET LOCAL statement_timeout = {_TRACE_DRAIN_STATEMENT_TIMEOUT_MS}")
                )
                await session.execute(
                    text(f"SET LOCAL lock_timeout = {_TRACE_DRAIN_LOCK_TIMEOUT_MS}")
                )
            eligible_rows = (
                await session.execute(
                    select(models.Trace.id, models.Trace.project_rowid)
                    .join(models.Project, models.Project.id == models.Trace.project_rowid)
                    .where(
                        models.Trace.trace_id.in_(chunk_trace_ids),
                        models.Project.deleted_at.is_(None),
                        models.Project.kind != "EVALUATOR",
                    )
                )
            ).all()
        if not eligible_rows:
            continue

        trace_rowids_by_project: dict[int, list[int]] = {}
        for row in eligible_rows:
            trace_rowids_by_project.setdefault(int(row.project_rowid), []).append(int(row.id))

        for project_rowid, project_trace_rowids in sorted(trace_rowids_by_project.items()):
            project_trace_rowids.sort()
            live_non_evaluator_project = exists(
                select(literal(1)).where(
                    models.Project.id == project_rowid,
                    models.Project.deleted_at.is_(None),
                    models.Project.kind != "EVALUATOR",
                )
            )
            trace_condition = and_(
                models.Trace.project_rowid == project_rowid,
                models.Trace.id.in_(project_trace_rowids),
                live_non_evaluator_project,
            )
            num_yields = 0
            while True:
                try:
                    async with db() as session:
                        if dialect is SupportedSQLDialect.POSTGRESQL:
                            await session.execute(
                                text(
                                    f"SET LOCAL statement_timeout = "
                                    f"{_TRACE_DRAIN_STATEMENT_TIMEOUT_MS}"
                                )
                            )
                            await session.execute(
                                text(f"SET LOCAL lock_timeout = {_TRACE_DRAIN_LOCK_TIMEOUT_MS}")
                            )
                        step_result = await drain_traces_step(
                            session,
                            dialect=dialect,
                            trace_cond=trace_condition,
                            batch_limit=batch_limit,
                            reset_session_evaluations=False,
                        )
                except DBAPIError as error:
                    if get_sqlstate(error) in _TRANSIENT_CONTENTION_SQLSTATES:
                        num_yields += 1
                        if num_yields > _MAX_YIELD_RETRIES_PER_CHUNK:
                            break
                        await asyncio.sleep(_YIELD_RETRY_DELAY_SECONDS)
                        continue
                    raise

                if step_result.status is PrimitiveStatus.PROGRESS:
                    affected_project_ids.add(project_rowid)
                    num_yields = 0
                    await asyncio.sleep(0)
                    continue
                if step_result.status is PrimitiveStatus.YIELD:
                    num_yields += 1
                    if num_yields > _MAX_YIELD_RETRIES_PER_CHUNK:
                        break
                    await asyncio.sleep(_YIELD_RETRY_DELAY_SECONDS)
                    continue
                break

    if affected_project_ids and event_queue is not None:
        event_queue.put(SpanDeleteEvent(tuple(sorted(affected_project_ids))))
    return affected_project_ids


async def admit_dataset_delete(
    session: AsyncSession,
    *,
    dialect: SupportedSQLDialect,
    dataset_id: int,
) -> AdmittedDatasetDelete:
    """Delete ``dataset_id`` inside ``session`` under canonical
    ``Dataset -> Project (id ASC) -> Evaluator (id ASC) -> Binding`` lock order,
    tombstoning live dataset evaluator bindings and exclusive experiment projects."""
    locked_dataset = await session.get(models.Dataset, dataset_id, with_for_update=True)
    if locked_dataset is None:
        raise NotFound(f"Dataset with ID {dataset_id} not found")

    eval_trace_ids = [
        trace_id
        for trace_id in (await session.scalars(get_eval_trace_ids_for_datasets(dataset_id))).all()
        if trace_id
    ]
    experiment_rows = (
        await session.execute(
            select(models.Experiment.id, models.Experiment.project_id)
            .where(models.Experiment.dataset_id == dataset_id)
            .order_by(models.Experiment.id.asc())
        )
    ).all()
    experiment_ids = [int(row.id) for row in experiment_rows]
    candidate_project_ids = {
        int(row.project_id) for row in experiment_rows if row.project_id is not None
    }

    enqueued_cleanup = False
    tombstoned_project_ids: set[int] = set()
    live_binding_ids = await lock_dataset_delete_targets(
        session,
        dialect=dialect,
        dataset_id=dataset_id,
        candidate_project_ids=candidate_project_ids,
    )
    if live_binding_ids:
        deleted_bindings = await logical_delete_dataset_evaluators(
            session,
            dialect=dialect,
            binding_ids=live_binding_ids,
            collect_unused_evaluator=False,
            collect_unused_prompt_or_decision=False,
        )
        enqueued_cleanup = enqueued_cleanup or bool(deleted_bindings.binding_ids)
        tombstoned_project_ids.update(deleted_bindings.tombstoned_project_ids)

    deleted_dataset = await session.scalar(
        delete(models.Dataset).where(models.Dataset.id == dataset_id).returning(models.Dataset)
    )
    if deleted_dataset is None:
        raise NotFound(f"Dataset with ID {dataset_id} not found")

    if candidate_project_ids:
        deleted_projects = await admit_exclusive_experiment_projects_delete(
            session,
            dialect=dialect,
            candidate_project_ids=candidate_project_ids,
        )
        enqueued_cleanup = enqueued_cleanup or bool(deleted_projects)
        tombstoned_project_ids.update(deleted_projects)

    return AdmittedDatasetDelete(
        dataset=deleted_dataset,
        experiment_ids=experiment_ids,
        eval_trace_ids=eval_trace_ids,
        tombstoned_project_ids=sorted(tombstoned_project_ids),
        enqueued_cleanup=enqueued_cleanup,
    )


async def execute_dataset_delete(
    *,
    db: DbSessionFactory,
    dataset_id: int,
    experiment_runner: Optional[CanStopExperiment] = None,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
    wake_cleanup_worker: Callable[[], None] = lambda: None,
) -> AdmittedDatasetDelete:
    """Stop active dataset experiments, commit the canonical dataset-deletion transaction,
    emit tombstoning and dataset-delete events, wake the cleanup worker, and drain
    standalone SDK evaluation traces in bounded batches."""
    stopped_experiment_ids: set[int] = set()
    if experiment_runner is not None:
        async with db() as session:
            initial_experiment_ids = [
                int(experiment_id)
                for experiment_id in (
                    await session.scalars(
                        select(models.Experiment.id)
                        .where(models.Experiment.dataset_id == dataset_id)
                        .order_by(models.Experiment.id.asc())
                    )
                ).all()
            ]
        for experiment_id in initial_experiment_ids:
            await experiment_runner.stop_experiment(experiment_id)
            stopped_experiment_ids.add(experiment_id)

    dialect = SupportedSQLDialect(db.dialect.value)
    async with db() as session:
        admitted = await admit_dataset_delete(
            session,
            dialect=dialect,
            dataset_id=dataset_id,
        )

    if experiment_runner is not None:
        for experiment_id in admitted.experiment_ids:
            if experiment_id not in stopped_experiment_ids:
                await experiment_runner.stop_experiment(experiment_id)

    if admitted.tombstoned_project_ids and event_queue is not None:
        sorted_project_ids = tuple(admitted.tombstoned_project_ids)
        event_queue.put(SpanDeleteEvent(sorted_project_ids))
        event_queue.put(ProjectDeleteEvent(sorted_project_ids))
    if admitted.enqueued_cleanup:
        wake_cleanup_worker()
    if admitted.eval_trace_ids:
        await delete_standalone_traces_by_trace_id(
            db,
            admitted.eval_trace_ids,
            event_queue=event_queue,
        )
    if event_queue is not None:
        event_queue.put(DatasetDeleteEvent((admitted.dataset.id,)))
    return admitted
