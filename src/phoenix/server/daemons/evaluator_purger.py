"""Background removal of deleted dataset and project evaluator bindings.

Deleting a binding only sets its ``deleted_at``. The purger then removes, in short
transactions, everything the binding owns: its online-eval work units, the traces in its
trace project, the binding row, the trace project itself, and the evaluator definition and
prompt when the delete asked for them and nothing else uses them. Every step can be repeated,
so a purge interrupted by a crash or restart resumes where it stopped.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from contextlib import suppress
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, Awaitable, Callable, Optional

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import delete_projects_and_evaluator_trace_projects
from phoenix.server.evaluators.services.management import (
    garbage_collect_evaluators,
    lock_evaluators,
)
from phoenix.server.online_eval.leases import SCAN_LEASE_TTL_SECONDS, ScanLease
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

PURGE_BATCH_ROWS = 1_000
_SLEEP_SECONDS = 5 * 60
_JITTER_SECONDS = 30
_RENEW_INTERVAL_SECONDS = SCAN_LEASE_TTL_SECONDS / 3

_WORK_UNIT_MODELS = (
    models.EvalWorkUnit,
    models.EvalSessionWorkUnit,
    models.EvalTraceWorkUnit,
)

Heartbeat = Callable[[], Awaitable[None]]


class _LeaseLost(Exception):
    pass


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
                    models.ProjectEvaluator.delete_associated_prompt,
                ).where(
                    models.ProjectEvaluator.id == project_evaluator_id,
                    models.ProjectEvaluator.deleted_at.is_not(None),
                )
            )
        ).one_or_none()
    if binding is None:
        return
    trace_project_id, evaluator_id, delete_unused_evaluator, delete_associated_prompt = binding
    await _purge_attached_project_evaluators(
        db,
        trace_project_id,
        delete_unused_evaluator=delete_unused_evaluator,
        delete_associated_prompt=delete_associated_prompt,
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
            await _collect_evaluator(session, evaluator_id, delete_associated_prompt)


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
                    models.DatasetEvaluators.delete_associated_prompt,
                ).where(
                    models.DatasetEvaluators.id == dataset_evaluator_id,
                    models.DatasetEvaluators.deleted_at.is_not(None),
                )
            )
        ).one_or_none()
    if binding is None:
        return
    trace_project_id, evaluator_id, delete_unused_evaluator, delete_associated_prompt = binding
    await _purge_attached_project_evaluators(
        db,
        trace_project_id,
        delete_unused_evaluator=delete_unused_evaluator,
        delete_associated_prompt=delete_associated_prompt,
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
            await _collect_evaluator(session, evaluator_id, delete_associated_prompt)


async def _purge_attached_project_evaluators(
    db: DbSessionFactory,
    trace_project_id: int,
    *,
    delete_unused_evaluator: bool,
    delete_associated_prompt: bool,
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
                delete_associated_prompt=delete_associated_prompt,
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
            except _LeaseLost:
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
    session: AsyncSession, evaluator_id: int, delete_associated_prompt: bool
) -> None:
    kind = await session.scalar(
        sa.select(models.Evaluator.kind).where(models.Evaluator.id == evaluator_id)
    )
    if kind is None or kind == "BUILTIN":
        return
    prompt_id = await session.scalar(
        sa.select(models.LLMEvaluator.prompt_id).where(models.LLMEvaluator.id == evaluator_id)
    )
    await garbage_collect_evaluators(
        session,
        evaluator_ids={evaluator_id},
        prompt_ids={prompt_id} if prompt_id is not None else set(),
        delete_associated_prompt=delete_associated_prompt,
    )


class EvaluatorPurger(DaemonTask):
    """Purges deleted evaluator bindings when woken by a delete, and on a slow timer to catch
    any a restart or another replica left behind. A scan lease keeps one replica at a time
    purging."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db
        self._woken = asyncio.Event()
        self._lease = ScanLease(
            db, name="evaluator-purger", holder=f"evaluator-purger-{token_hex(8)}"
        )
        self._renewed_at = 0.0

    def wake(self) -> None:
        """Start a purge soon, without waiting for the timer."""
        self._woken.set()

    async def _run(self) -> None:
        while self._running:
            self._woken.clear()
            try:
                await self.purge_deleted_bindings()
            except Exception:
                logger.exception("Failed to purge deleted evaluators")
            await self._sleep()

    async def _sleep(self) -> None:
        with suppress(asyncio.TimeoutError):
            await asyncio.wait_for(
                self._woken.wait(),
                _SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS),
            )

    async def purge_deleted_bindings(self) -> None:
        """Purge every deleted binding if this replica gets the lease."""
        if self._db.should_not_insert_or_update:
            return
        if not await self._lease.acquire():
            return
        self._renewed_at = time.monotonic()
        try:
            await purge_deleted_bindings(self._db, heartbeat=self._heartbeat)
        except _LeaseLost:
            pass
        finally:
            await self._lease.release()

    async def _heartbeat(self) -> None:
        if time.monotonic() - self._renewed_at < _RENEW_INTERVAL_SECONDS:
            return
        if not await self._lease.renew():
            raise _LeaseLost
        self._renewed_at = time.monotonic()


def wake_evaluator_purger(state: Any) -> None:
    """Wake the app's evaluator purger, if it runs one."""
    purger: Optional[EvaluatorPurger] = getattr(state, "evaluator_purger", None)
    if purger is not None:
        purger.wake()
