"""Removal of deleted dataset and project evaluator bindings and everything they own.

Deleting a binding only sets its ``deleted_at``. Purging then removes, in short transactions,
everything the binding owns: its online-eval work units, the traces in its trace project, the
binding row, the trace project itself, and the evaluator definition with its prompt or decision
when the delete asked for them and nothing else uses them. Every step can be repeated, so a
purge interrupted by a crash or restart resumes where it stopped.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import delete_projects_and_evaluator_trace_projects
from phoenix.server.evaluators.services.management import (
    garbage_collect_evaluators,
    lock_evaluators,
)
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)

PURGE_BATCH_ROWS = 1_000

_WORK_UNIT_MODELS = (
    models.EvalWorkUnit,
    models.EvalSessionWorkUnit,
    models.EvalTraceWorkUnit,
)

Heartbeat = Callable[[], Awaitable[None]]
"""Called between batches; raise ``StopPurge`` from it to stop purging."""


class StopPurge(Exception):
    """Raised by a heartbeat to stop a purge; the remaining bindings are left for a later run."""


async def _no_heartbeat() -> None:
    return None


async def purge_project_evaluator(
    db: DbSessionFactory,
    project_evaluator_id: int,
    *,
    heartbeat: Heartbeat = _no_heartbeat,
) -> None:
    """Remove a deleted project evaluator and everything it owns; a binding that is missing or
    not deleted is left alone."""
    async with db() as session:
        binding = (
            await session.execute(
                sa.select(
                    models.ProjectEvaluator.trace_project_id,
                    models.ProjectEvaluator.evaluator_id,
                    models.ProjectEvaluator.delete_unused_evaluator,
                    models.ProjectEvaluator.delete_associated_prompt_or_decision,
                ).where(
                    models.ProjectEvaluator.id == project_evaluator_id,
                    models.ProjectEvaluator.deleted_at.is_not(None),
                )
            )
        ).one_or_none()
    if binding is None:
        return
    (
        trace_project_id,
        evaluator_id,
        delete_unused_evaluator,
        delete_associated_prompt_or_decision,
    ) = binding
    await _purge_attached_project_evaluators(
        db,
        trace_project_id,
        delete_unused_evaluator=delete_unused_evaluator,
        delete_associated_prompt_or_decision=delete_associated_prompt_or_decision,
        heartbeat=heartbeat,
    )
    for work_unit_model in _WORK_UNIT_MODELS:
        await _delete_in_batches(
            db,
            work_unit_model,
            work_unit_model.project_evaluator_id == project_evaluator_id,
            heartbeat,
        )
    await _delete_in_batches(
        db, models.Trace, models.Trace.project_rowid == trace_project_id, heartbeat
    )
    async with db() as session:
        await lock_evaluators(session, [evaluator_id])
        deleted = await session.scalar(
            sa.delete(models.ProjectEvaluator)
            .where(
                models.ProjectEvaluator.id == project_evaluator_id,
                models.ProjectEvaluator.deleted_at.is_not(None),
            )
            .returning(models.ProjectEvaluator.id)
        )
        if deleted is None:
            return
        await session.execute(
            sa.delete(models.Project).where(models.Project.id == trace_project_id)
        )
        if delete_unused_evaluator:
            await _collect_evaluator(session, evaluator_id, delete_associated_prompt_or_decision)


async def purge_dataset_evaluator(
    db: DbSessionFactory,
    dataset_evaluator_id: int,
    *,
    heartbeat: Heartbeat = _no_heartbeat,
) -> None:
    """Remove a deleted dataset evaluator and everything it owns; a binding that is missing or
    not deleted is left alone."""
    async with db() as session:
        binding = (
            await session.execute(
                sa.select(
                    models.DatasetEvaluators.project_id,
                    models.DatasetEvaluators.evaluator_id,
                    models.DatasetEvaluators.delete_unused_evaluator,
                    models.DatasetEvaluators.delete_associated_prompt_or_decision,
                ).where(
                    models.DatasetEvaluators.id == dataset_evaluator_id,
                    models.DatasetEvaluators.deleted_at.is_not(None),
                )
            )
        ).one_or_none()
    if binding is None:
        return
    (
        trace_project_id,
        evaluator_id,
        delete_unused_evaluator,
        delete_associated_prompt_or_decision,
    ) = binding
    await _purge_attached_project_evaluators(
        db,
        trace_project_id,
        delete_unused_evaluator=delete_unused_evaluator,
        delete_associated_prompt_or_decision=delete_associated_prompt_or_decision,
        heartbeat=heartbeat,
    )
    await _delete_in_batches(
        db, models.Trace, models.Trace.project_rowid == trace_project_id, heartbeat
    )
    async with db() as session:
        await lock_evaluators(session, [evaluator_id])
        deleted = await session.scalar(
            sa.delete(models.DatasetEvaluators)
            .where(
                models.DatasetEvaluators.id == dataset_evaluator_id,
                models.DatasetEvaluators.deleted_at.is_not(None),
            )
            .returning(models.DatasetEvaluators.id)
        )
        if deleted is None:
            return
        await delete_projects_and_evaluator_trace_projects(session, [trace_project_id])
        if delete_unused_evaluator:
            await _collect_evaluator(session, evaluator_id, delete_associated_prompt_or_decision)


async def _purge_attached_project_evaluators(
    db: DbSessionFactory,
    trace_project_id: int,
    *,
    delete_unused_evaluator: bool,
    delete_associated_prompt_or_decision: bool,
    heartbeat: Heartbeat,
) -> None:
    """Delete and purge the project evaluators attached to a trace project, which would
    otherwise cascade away with it and leave their own trace projects behind."""
    async with db() as session:
        await session.execute(
            sa.update(models.ProjectEvaluator)
            .where(
                models.ProjectEvaluator.project_id == trace_project_id,
                models.ProjectEvaluator.deleted_at.is_(None),
            )
            .values(
                deleted_at=datetime.now(timezone.utc),
                delete_unused_evaluator=delete_unused_evaluator,
                delete_associated_prompt_or_decision=delete_associated_prompt_or_decision,
            )
        )
        attached_ids = list(
            await session.scalars(
                sa.select(models.ProjectEvaluator.id).where(
                    models.ProjectEvaluator.project_id == trace_project_id
                )
            )
        )
    for project_evaluator_id in attached_ids:
        await purge_project_evaluator(db, project_evaluator_id, heartbeat=heartbeat)


async def purge_deleted_bindings(
    db: DbSessionFactory, *, heartbeat: Heartbeat = _no_heartbeat
) -> None:
    """Purge every deleted binding, project evaluators first, oldest deletes first. A binding
    that fails to purge is logged and retried on a later run."""
    for model, purge in (
        (models.ProjectEvaluator, purge_project_evaluator),
        (models.DatasetEvaluators, purge_dataset_evaluator),
    ):
        async with db() as session:
            binding_ids = list(
                await session.scalars(
                    sa.select(model.id)
                    .where(model.deleted_at.is_not(None))
                    .order_by(model.deleted_at, model.id)
                )
            )
        for binding_id in binding_ids:
            try:
                await purge(db, binding_id, heartbeat=heartbeat)
            except StopPurge:
                raise
            except Exception:
                logger.exception(f"Failed to purge deleted {model.__tablename__} row {binding_id}")


async def purge_deleted_bindings_of_evaluator(db: DbSessionFactory, evaluator_id: int) -> None:
    """Purge the deleted bindings of one evaluator definition now, so the definition can be
    deleted without cascading to bindings that still own trace projects."""
    async with db() as session:
        project_evaluator_ids = list(
            await session.scalars(
                sa.select(models.ProjectEvaluator.id).where(
                    models.ProjectEvaluator.evaluator_id == evaluator_id,
                    models.ProjectEvaluator.deleted_at.is_not(None),
                )
            )
        )
        dataset_evaluator_ids = list(
            await session.scalars(
                sa.select(models.DatasetEvaluators.id).where(
                    models.DatasetEvaluators.evaluator_id == evaluator_id,
                    models.DatasetEvaluators.deleted_at.is_not(None),
                )
            )
        )
    for project_evaluator_id in project_evaluator_ids:
        await purge_project_evaluator(db, project_evaluator_id)
    for dataset_evaluator_id in dataset_evaluator_ids:
        await purge_dataset_evaluator(db, dataset_evaluator_id)


async def _delete_in_batches(
    db: DbSessionFactory,
    model: Any,
    condition: sa.ColumnElement[bool],
    heartbeat: Heartbeat,
) -> None:
    """Delete matching rows ``PURGE_BATCH_ROWS`` at a time, each batch in its own transaction,
    so a large purge never holds the write lock for long."""
    batch = sa.select(model.id).where(condition).limit(PURGE_BATCH_ROWS).scalar_subquery()
    while True:
        async with db() as session:
            result = await session.execute(sa.delete(model).where(model.id.in_(batch)))
        await heartbeat()
        if result.rowcount < PURGE_BATCH_ROWS:  # type: ignore[attr-defined]
            return


async def _collect_evaluator(
    session: AsyncSession, evaluator_id: int, delete_associated_prompt_or_decision: bool
) -> None:
    prompt_id = await session.scalar(
        sa.select(models.LLMEvaluator.prompt_id).where(models.LLMEvaluator.id == evaluator_id)
    )
    decision_id = await session.scalar(
        sa.select(models.DecisionEvaluator.decision_id).where(
            models.DecisionEvaluator.id == evaluator_id
        )
    )
    await garbage_collect_evaluators(
        session,
        evaluator_ids={evaluator_id},
        prompt_ids={prompt_id} if prompt_id is not None else set(),
        decision_ids={decision_id} if decision_id is not None else set(),
        delete_associated_prompt_or_decision=delete_associated_prompt_or_decision,
    )
