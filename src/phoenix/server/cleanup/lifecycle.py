"""Tombstone helpers for project, dataset, and evaluator lifecycle cleanup."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Optional, TypeAlias

from sqlalchemy import Row, and_, delete, exists, literal, select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from phoenix.config import DEFAULT_PROJECT_NAME, PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    get_eval_trace_ids_for_datasets,
    is_evaluator_project_condition,
    is_experiment_named_project_condition,
    is_lock_contention,
    is_lock_not_available,
)
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.cleanup.primitives import (
    CLEANUP_BATCH_ROWS,
    PrimitiveResult,
    PrimitiveStatus,
    drain_trace_scope_step,
    drain_traces_step,
    set_local_timeouts,
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

_MAX_YIELD_RETRIES_PER_CHUNK = 5
_YIELD_RETRY_DELAY_SECONDS = 0.05


@dataclass(frozen=True)
class TombstonedEvaluatorBindings:
    binding_ids: list[int]
    tombstoned_project_ids: list[int]


@dataclass(frozen=True)
class TraceClearBatchResult:
    status: Literal["PROGRESS", "COMPLETE", "PROJECT_DELETED"]
    num_affected_rows: int = 0


@dataclass(frozen=True)
class TombstonedProject:
    project: models.Project
    tombstoned_project_ids: list[int]


@dataclass(frozen=True)
class DeletedDataset:
    dataset: models.Dataset
    eval_trace_ids: list[str]
    tombstoned_project_ids: list[int]


ProjectLockMode: TypeAlias = Literal["no_key_update", "update"]


async def _lock_projects(
    session: AsyncSession,
    project_ids: Iterable[int],
    *,
    mode: ProjectLockMode,
    nowait: bool = False,
) -> None:
    """Lock project rows in ascending id order.

    ``no_key_update`` serializes deletes and binding writers on the row but does not block the
    ``FOR KEY SHARE`` that foreign-key inserts such as trace ingest take; ``update`` blocks those
    inserts too.
    """
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    ids = sorted(set(project_ids))
    if ids and dialect is SupportedSQLDialect.POSTGRESQL:
        await session.execute(
            select(models.Project.id)
            .where(models.Project.id.in_(ids))
            .order_by(models.Project.id.asc())
            .with_for_update(key_share=mode == "no_key_update", nowait=nowait)
        )


async def resolve_live_project_ids_by_name(
    session: AsyncSession,
    project_names: Iterable[Optional[str]],
) -> set[int]:
    """Resolve project names to the ids of their live projects. Tombstoned projects that still
    carry a name awaiting cleanup are ignored, since a name only identifies its live project.

    The read takes no locks: callers lock the returned ids in ascending order and re-verify
    eligibility afterwards.
    """
    names = sorted({project_name for project_name in project_names if project_name})
    if not names:
        return set()
    return {
        int(project_id)
        for project_id in await session.scalars(
            select(models.Project.id).where(
                models.Project.name.in_(names),
                models.Project.deleted_at.is_(None),
            )
        )
    }


async def _lock_additional_projects(
    session: AsyncSession,
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

    if lower_ids:
        try:
            async with session.begin_nested():
                await _lock_projects(session, lower_ids, mode="no_key_update", nowait=True)
        except DBAPIError as error:
            if is_lock_not_available(error):
                raise Conflict(
                    "Project evaluators were modified concurrently; retry the delete operation"
                ) from error
            raise
    if higher_ids:
        await _lock_projects(session, higher_ids, mode="no_key_update")
    locked_project_ids.update(missing_ids)


async def _tombstone_bindings(
    session: AsyncSession,
    *,
    model: type[models.ProjectEvaluator] | type[models.DatasetEvaluators],
    binding_ids: Iterable[int],
    trace_project_column: InstrumentedAttribute[int],
    owner_project_column: Optional[InstrumentedAttribute[int]],
    dataset_column: Optional[InstrumentedAttribute[Optional[int]]],
    tombstone_values: dict[str, Any],
    collect_unused_evaluator: bool,
    delete_associated_prompt: bool,
) -> TombstonedEvaluatorBindings:
    """Tombstone live bindings under canonical lock order, optionally run synchronous
    shared-definition GC; the tombstones are what the cleanup worker drains."""
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    requested_ids = sorted(set(binding_ids))
    if not requested_ids:
        return TombstonedEvaluatorBindings(binding_ids=[], tombstoned_project_ids=[])

    binding_columns = [
        model.id,
        model.evaluator_id,
        trace_project_column.label("trace_project_id"),
    ]
    if owner_project_column is not None:
        binding_columns.append(owner_project_column.label("owner_project_id"))
    if dataset_column is not None:
        binding_columns.append(dataset_column.label("dataset_id"))
    live_bindings_stmt = select(*binding_columns).where(model.deleted_at.is_(None))
    discovered = (
        await session.execute(live_bindings_stmt.where(model.id.in_(requested_ids)))
    ).all()
    if not discovered:
        return TombstonedEvaluatorBindings(binding_ids=[], tombstoned_project_ids=[])

    project_ids = {int(row.trace_project_id) for row in discovered}
    if owner_project_column is not None:
        project_ids.update(int(row.owner_project_id) for row in discovered)
    dataset_ids = (
        {int(row.dataset_id) for row in discovered if row.dataset_id is not None}
        if dataset_column is not None
        else set()
    )
    evaluator_ids = {int(row.evaluator_id) for row in discovered if row.evaluator_id is not None}

    if dataset_ids and dialect is SupportedSQLDialect.POSTGRESQL:
        await session.execute(
            select(models.Dataset.id)
            .where(models.Dataset.id.in_(sorted(dataset_ids)))
            .order_by(models.Dataset.id.asc())
            .with_for_update(key_share=True)
        )
    # Canonical lock order: Dataset -> Project -> Evaluator -> Binding.
    await _lock_projects(session, project_ids, mode="no_key_update")
    await lock_evaluators(session, evaluator_ids)

    locked_bindings_stmt = live_bindings_stmt.where(
        model.id.in_([int(row.id) for row in discovered])
    ).order_by(model.id.asc())
    if dialect is SupportedSQLDialect.POSTGRESQL:
        locked_bindings_stmt = locked_bindings_stmt.with_for_update()
    locked_rows = (await session.execute(locked_bindings_stmt)).all()
    if not locked_rows:
        return TombstonedEvaluatorBindings(binding_ids=[], tombstoned_project_ids=[])

    now = await current_database_time(session, dialect)
    marked_ids = [int(row.id) for row in locked_rows]
    trace_project_ids = [int(row.trace_project_id) for row in locked_rows]
    candidate_evaluator_ids = {
        int(row.evaluator_id) for row in locked_rows if row.evaluator_id is not None
    }

    await session.execute(
        update(model)
        .where(model.id.in_(marked_ids))
        .values(deleted_at=now, evaluator_id=None, updated_at=now, **tombstone_values)
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

    if collect_unused_evaluator and candidate_evaluator_ids:
        await garbage_collect_evaluators(
            session,
            evaluator_ids=candidate_evaluator_ids,
            delete_associated_prompt=delete_associated_prompt,
        )

    return TombstonedEvaluatorBindings(
        binding_ids=marked_ids,
        tombstoned_project_ids=tombstoned_project_ids,
    )


async def tombstone_project_evaluators(
    session: AsyncSession,
    *,
    binding_ids: Iterable[int],
    collect_unused_evaluator: bool,
    delete_associated_prompt: bool,
) -> TombstonedEvaluatorBindings:
    """Tombstone live project evaluator bindings under canonical lock order."""
    return await _tombstone_bindings(
        session,
        model=models.ProjectEvaluator,
        binding_ids=binding_ids,
        trace_project_column=models.ProjectEvaluator.trace_project_id,
        owner_project_column=models.ProjectEvaluator.project_id,
        dataset_column=None,
        tombstone_values={"enabled": False},
        collect_unused_evaluator=collect_unused_evaluator,
        delete_associated_prompt=delete_associated_prompt,
    )


async def tombstone_dataset_evaluators(
    session: AsyncSession,
    *,
    binding_ids: Iterable[int],
    collect_unused_evaluator: bool,
    delete_associated_prompt: bool,
) -> TombstonedEvaluatorBindings:
    """Tombstone live dataset evaluator bindings under canonical lock order."""
    return await _tombstone_bindings(
        session,
        model=models.DatasetEvaluators,
        binding_ids=binding_ids,
        trace_project_column=models.DatasetEvaluators.project_id,
        owner_project_column=None,
        dataset_column=models.DatasetEvaluators.dataset_id,
        tombstone_values={},
        collect_unused_evaluator=collect_unused_evaluator,
        delete_associated_prompt=delete_associated_prompt,
    )


_LiveBinding: TypeAlias = Row[int, int, Optional[int]]


async def _read_live_bindings_owned_by(
    session: AsyncSession, owner_project_ids: Iterable[int]
) -> Sequence[_LiveBinding]:
    owner_ids = sorted(set(owner_project_ids))
    if not owner_ids:
        return []
    result = await session.execute(
        select(
            models.ProjectEvaluator.id,
            models.ProjectEvaluator.trace_project_id,
            models.ProjectEvaluator.evaluator_id,
        ).where(
            models.ProjectEvaluator.project_id.in_(owner_ids),
            models.ProjectEvaluator.deleted_at.is_(None),
        )
    )
    return result.all()


async def _lock_trace_projects_of(
    session: AsyncSession, *, locked_project_ids: set[int], bindings: Sequence[_LiveBinding]
) -> None:
    if bindings:
        await _lock_additional_projects(
            session,
            locked_project_ids=locked_project_ids,
            target_project_ids=(int(row.trace_project_id) for row in bindings),
        )


async def lock_dataset_delete_targets(
    session: AsyncSession,
    *,
    dataset_id: int,
    candidate_project_names: Iterable[Optional[str]],
) -> tuple[list[int], set[int]]:
    """Acquire all ``Project`` and ``Evaluator`` locks needed for dataset deletion in canonical
    ``Dataset -> Project (id ASC) -> Evaluator (id ASC)`` order, returning live dataset binding IDs
    and the ids of the experiment projects that were locked.

    Experiment project names are resolved to live project ids before any project lock is taken.
    """
    exp_project_ids = await resolve_live_project_ids_by_name(session, candidate_project_names)
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

    experiment_bindings_seen_before_locking = await _read_live_bindings_owned_by(
        session, exp_project_ids
    )

    locked_project_ids = {
        *exp_project_ids,
        *(int(row.project_id) for row in live_dataset_bindings),
        *(int(row.trace_project_id) for row in experiment_bindings_seen_before_locking),
    }
    await _lock_projects(session, locked_project_ids, mode="no_key_update")

    experiment_bindings_under_project_lock = await _read_live_bindings_owned_by(
        session, exp_project_ids
    )
    await _lock_trace_projects_of(
        session,
        locked_project_ids=locked_project_ids,
        bindings=experiment_bindings_under_project_lock,
    )

    all_evaluator_ids = {
        int(row.evaluator_id) for row in live_dataset_bindings if row.evaluator_id is not None
    } | {
        int(row.evaluator_id)
        for row in experiment_bindings_under_project_lock
        if row.evaluator_id is not None
    }
    await lock_evaluators(session, all_evaluator_ids)

    return [int(row.id) for row in live_dataset_bindings], set(exp_project_ids)


async def tombstone_project(
    session: AsyncSession,
    *,
    project_id: int,
) -> TombstonedProject:
    """Tombstone a live non-evaluator project, and detach its live bindings; the
    tombstone is what the cleanup worker drains."""
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    bindings_seen_before_locking = await _read_live_bindings_owned_by(session, [project_id])
    locked_project_ids = {
        project_id,
        *(int(row.trace_project_id) for row in bindings_seen_before_locking),
    }
    await _lock_projects(session, locked_project_ids, mode="no_key_update")

    # A caller may have loaded the project before it was locked, so re-read its committed state.
    project = await session.get(models.Project, project_id, populate_existing=True)
    if project is None or project.deleted_at is not None:
        raise NotFound(f"Project with ID {project_id} not found")
    if project.name == DEFAULT_PROJECT_NAME:
        raise BadRequest(f"Cannot delete the {DEFAULT_PROJECT_NAME} project")

    if await _project_holds_evaluator_traces(session, project):
        raise Conflict("This project holds an evaluator's traces; delete the evaluator instead")
    await _lock_projects(session, [project_id], mode="update")

    # Binding writers lock this project row too, so this read is complete.
    live_bindings_under_project_lock = await _read_live_bindings_owned_by(session, [project_id])
    tombstoned_trace_project_ids: list[int] = []
    if live_bindings_under_project_lock:
        await _lock_trace_projects_of(
            session,
            locked_project_ids=locked_project_ids,
            bindings=live_bindings_under_project_lock,
        )
        binding_delete_result = await tombstone_project_evaluators(
            session,
            binding_ids=[int(row.id) for row in live_bindings_under_project_lock],
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )
        tombstoned_trace_project_ids = binding_delete_result.tombstoned_project_ids

    now = await current_database_time(session, dialect)
    project.deleted_at = now
    project.updated_at = now

    return TombstonedProject(
        project=project,
        tombstoned_project_ids=sorted({project_id, *tombstoned_trace_project_ids}),
    )


async def _project_holds_evaluator_traces(session: AsyncSession, project: models.Project) -> bool:
    return bool(
        await session.scalar(
            select(
                exists().where(models.Project.id == project.id, is_evaluator_project_condition())
            )
        )
    )


async def clear_project_traces_in_batches(
    db: DbSessionFactory,
    *,
    project_id: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> AsyncIterator[TraceClearBatchResult]:
    """Delete a project's traces with ``start_time`` in ``[start_time, end_time)`` and then its
    emptied sessions, one bounded batch per iteration.

    Every iteration runs in its own transaction and is committed before it is yielded, so a clear
    that stops early leaves earlier batches deleted and can simply be run again. The final result
    has status ``COMPLETE``, or ``PROJECT_DELETED`` when the project was tombstoned mid-clear (its
    delete cleanup owns the remainder).

    Raises:
        NotFound: The project does not exist or is already tombstoned when the clear starts.
        Conflict: Another operation kept the remaining traces locked for too many consecutive
            attempts.
    """
    if batch_limit <= 0:
        raise ValueError("batch_limit must be positive")
    dialect = SupportedSQLDialect(db.dialect.value)
    is_first_batch = True
    num_consecutive_yields = 0
    while True:
        step_result: Optional[PrimitiveResult]
        try:
            async with db() as session:
                if dialect is SupportedSQLDialect.POSTGRESQL:
                    await set_local_timeouts(session)
                project = await session.get(models.Project, project_id)
                if project is None or project.deleted_at is not None:
                    if is_first_batch:
                        raise NotFound(f"Project with ID {project_id} not found")
                    step_result = None
                else:
                    step_result = await drain_trace_scope_step(
                        session,
                        project_id=project_id,
                        start_time=start_time,
                        end_time=end_time,
                        batch_limit=batch_limit,
                        reset_session_evaluations=True,
                    )
        except DBAPIError as error:
            if not is_lock_contention(error):
                raise
            step_result = PrimitiveResult(PrimitiveStatus.YIELD, 0)
        is_first_batch = False

        if step_result is None:
            yield TraceClearBatchResult(status="PROJECT_DELETED")
            return
        if step_result.status is PrimitiveStatus.PROGRESS:
            num_consecutive_yields = 0
            if event_queue is not None:
                event_queue.put(SpanDeleteEvent((project_id,)))
            yield TraceClearBatchResult(
                status="PROGRESS", num_affected_rows=step_result.affected_rows
            )
            continue
        if step_result.status is PrimitiveStatus.EMPTY:
            yield TraceClearBatchResult(status="COMPLETE")
            return
        num_consecutive_yields += 1
        if num_consecutive_yields > _MAX_YIELD_RETRIES_PER_CHUNK:
            raise Conflict(
                "Some traces are in use by another operation; run the clear again to finish."
            )
        await asyncio.sleep(min(0.25, _YIELD_RETRY_DELAY_SECONDS * 2**num_consecutive_yields))


async def resolve_experiment_project_delete_candidates(
    session: AsyncSession,
    *,
    candidate_project_names: Iterable[Optional[str]],
) -> list[int]:
    """Return the ids of the live projects named in ``candidate_project_names`` that an experiment
    delete may take with it: not the playground project, not the default project, and not an
    evaluator trace project.

    Call this before the experiment rows are deleted. A project is only recognizable as an
    experiment project while an experiment still names it, so the names must be resolved first.
    The read takes no locks; ``lock_experiment_projects`` locks the ids before the experiment rows
    are deleted and ``tombstone_exclusive_experiment_projects`` re-verifies them.
    """
    names = sorted({project_name for project_name in candidate_project_names if project_name})
    if not names:
        return []
    return [
        int(project_id)
        for project_id in await session.scalars(
            select(models.Project.id)
            .where(
                models.Project.name.in_(names),
                models.Project.deleted_at.is_(None),
                models.Project.name != PLAYGROUND_PROJECT_NAME,
                models.Project.name != DEFAULT_PROJECT_NAME,
                ~is_evaluator_project_condition(),
            )
            .order_by(models.Project.id.asc())
        )
    ]


async def lock_experiment_projects(
    session: AsyncSession,
    *,
    candidate_project_ids: Iterable[int],
) -> None:
    """Lock the candidates from ``resolve_experiment_project_delete_candidates``, their bindings'
    trace projects and evaluators.

    Call this before deleting experiment rows so that experiment deletes take ``Project`` then
    ``Evaluator`` then ``Experiment`` locks, the order ``lock_dataset_delete_targets`` uses before
    its cascade reaches the experiments; the reverse order deadlocks against a concurrent dataset
    delete.
    """
    ids = set(candidate_project_ids)
    bindings_seen_before_locking = await _read_live_bindings_owned_by(session, ids)
    locked_project_ids = {
        *ids,
        *(int(row.trace_project_id) for row in bindings_seen_before_locking),
    }
    await _lock_projects(session, locked_project_ids, mode="no_key_update")
    bindings_under_project_lock = await _read_live_bindings_owned_by(session, ids)
    await _lock_trace_projects_of(
        session, locked_project_ids=locked_project_ids, bindings=bindings_under_project_lock
    )
    await lock_evaluators(
        session,
        {
            int(row.evaluator_id)
            for row in bindings_under_project_lock
            if row.evaluator_id is not None
        },
    )


async def tombstone_exclusive_experiment_projects(
    session: AsyncSession,
    *,
    candidate_project_ids: Iterable[int],
) -> list[int]:
    """Tombstone the candidates from
    ``resolve_experiment_project_delete_candidates`` that are still live and that no ``Experiment``
    names after the owning experiment/dataset rows were deleted in ``session``."""
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    ids = sorted(set(candidate_project_ids))
    if not ids:
        return []

    bindings_seen_before_locking = await _read_live_bindings_owned_by(session, ids)
    locked_project_ids = set(ids)
    await _lock_projects(session, locked_project_ids, mode="no_key_update")
    await _lock_trace_projects_of(
        session, locked_project_ids=locked_project_ids, bindings=bindings_seen_before_locking
    )

    eligible_ids = list(
        await session.scalars(
            select(models.Project.id)
            .where(
                models.Project.id.in_(ids),
                models.Project.deleted_at.is_(None),
                ~is_experiment_named_project_condition(),
                ~is_evaluator_project_condition(),
            )
            .order_by(models.Project.id.asc())
        )
    )
    if not eligible_ids:
        return []

    live_bindings_under_project_lock = await _read_live_bindings_owned_by(session, eligible_ids)
    tombstoned_trace_project_ids: list[int] = []
    if live_bindings_under_project_lock:
        await _lock_trace_projects_of(
            session,
            locked_project_ids=locked_project_ids,
            bindings=live_bindings_under_project_lock,
        )
        binding_delete_result = await tombstone_project_evaluators(
            session,
            binding_ids=[int(row.id) for row in live_bindings_under_project_lock],
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )
        tombstoned_trace_project_ids = binding_delete_result.tombstoned_project_ids

    now = await current_database_time(session, dialect)
    await session.execute(
        update(models.Project)
        .where(models.Project.id.in_(eligible_ids))
        .values(deleted_at=now, updated_at=now)
    )
    return sorted({*eligible_ids, *tombstoned_trace_project_ids})


async def delete_standalone_traces_by_trace_id(
    db: DbSessionFactory,
    trace_ids: Iterable[str],
    *,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> None:
    """Drain standalone traces matching ``trace_ids`` in bounded batches, skipping traces
    owned by ``EVALUATOR`` or tombstoned projects, and emit ``SpanDeleteEvent`` for each chunk's
    affected projects once the chunk commits."""
    if batch_limit <= 0:
        raise ValueError("batch_limit must be positive")
    unique_trace_ids = sorted({trace_id for trace_id in trace_ids if trace_id})
    if not unique_trace_ids:
        return

    dialect = SupportedSQLDialect(db.dialect.value)
    batch_limit = min(batch_limit, CLEANUP_BATCH_ROWS)

    for chunk_start in range(0, len(unique_trace_ids), batch_limit):
        chunk_trace_ids = unique_trace_ids[chunk_start : chunk_start + batch_limit]
        chunk_affected_project_ids: set[int] = set()
        async with db() as session:
            if dialect is SupportedSQLDialect.POSTGRESQL:
                await set_local_timeouts(session)
            eligible_rows = (
                await session.execute(
                    select(models.Trace.id, models.Trace.project_rowid)
                    .join(models.Project, models.Project.id == models.Trace.project_rowid)
                    .where(
                        models.Trace.trace_id.in_(chunk_trace_ids),
                        models.Project.deleted_at.is_(None),
                        ~is_evaluator_project_condition(),
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
                    ~is_evaluator_project_condition(),
                )
            )
            trace_condition = and_(
                # "+ 0" keeps SQLite from scanning the project's trace index to find these ids.
                models.Trace.project_rowid + 0 == project_rowid,
                models.Trace.id.in_(project_trace_rowids),
                live_non_evaluator_project,
            )
            num_yields = 0
            while True:
                try:
                    async with db() as session:
                        if dialect is SupportedSQLDialect.POSTGRESQL:
                            await set_local_timeouts(session)
                        step_result = await drain_traces_step(
                            session,
                            trace_cond=trace_condition,
                            batch_limit=batch_limit,
                            reset_session_evaluations=False,
                        )
                except DBAPIError as error:
                    if is_lock_contention(error):
                        num_yields += 1
                        if num_yields > _MAX_YIELD_RETRIES_PER_CHUNK:
                            break
                        await asyncio.sleep(_YIELD_RETRY_DELAY_SECONDS)
                        continue
                    raise

                if step_result.status is PrimitiveStatus.PROGRESS:
                    chunk_affected_project_ids.add(project_rowid)
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

        if chunk_affected_project_ids and event_queue is not None:
            event_queue.put(SpanDeleteEvent(tuple(sorted(chunk_affected_project_ids))))


async def delete_dataset_and_tombstone_projects(
    session: AsyncSession,
    *,
    dataset_id: int,
) -> DeletedDataset:
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
    candidate_project_names = set(
        await session.scalars(
            select(models.Experiment.project_name).where(
                models.Experiment.dataset_id == dataset_id,
                models.Experiment.project_name.is_not(None),
            )
        )
    )

    tombstoned_project_ids: set[int] = set()
    live_binding_ids, locked_experiment_project_ids = await lock_dataset_delete_targets(
        session,
        dataset_id=dataset_id,
        candidate_project_names=candidate_project_names,
    )
    if live_binding_ids:
        deleted_bindings = await tombstone_dataset_evaluators(
            session,
            binding_ids=live_binding_ids,
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )
        tombstoned_project_ids.update(deleted_bindings.tombstoned_project_ids)

    # Only experiments deleted here count: one a concurrent request deleted while keeping its
    # project must not get that project tombstoned, and projects locked above are the only
    # ones that may be tombstoned.
    deleted_experiment_rows = (
        await session.execute(
            delete(models.Experiment)
            .where(models.Experiment.dataset_id == dataset_id)
            .returning(models.Experiment.id, models.Experiment.project_name)
        )
    ).all()
    candidate_project_ids = locked_experiment_project_ids.intersection(
        await resolve_experiment_project_delete_candidates(
            session,
            candidate_project_names=[row.project_name for row in deleted_experiment_rows],
        )
    )
    deleted_dataset = await session.scalar(
        delete(models.Dataset).where(models.Dataset.id == dataset_id).returning(models.Dataset)
    )
    if deleted_dataset is None:
        raise NotFound(f"Dataset with ID {dataset_id} not found")

    if candidate_project_ids:
        deleted_projects = await tombstone_exclusive_experiment_projects(
            session,
            candidate_project_ids=candidate_project_ids,
        )
        tombstoned_project_ids.update(deleted_projects)

    return DeletedDataset(
        dataset=deleted_dataset,
        eval_trace_ids=eval_trace_ids,
        tombstoned_project_ids=sorted(tombstoned_project_ids),
    )


async def execute_dataset_delete(
    *,
    db: DbSessionFactory,
    dataset_id: int,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
) -> DeletedDataset:
    """Commit the canonical dataset-deletion transaction, emit tombstoning and dataset-delete
    events, and drain standalone SDK evaluation traces in bounded batches."""
    async with db() as session:
        deleted_dataset = await delete_dataset_and_tombstone_projects(
            session,
            dataset_id=dataset_id,
        )

    if event_queue is not None:
        if deleted_dataset.tombstoned_project_ids:
            sorted_project_ids = tuple(deleted_dataset.tombstoned_project_ids)
            event_queue.put(SpanDeleteEvent(sorted_project_ids))
            event_queue.put(ProjectDeleteEvent(sorted_project_ids))
        event_queue.put(DatasetDeleteEvent((deleted_dataset.dataset.id,)))
    if deleted_dataset.eval_trace_ids:
        await delete_standalone_traces_by_trace_id(
            db,
            deleted_dataset.eval_trace_ids,
            event_queue=event_queue,
        )
    return deleted_dataset
