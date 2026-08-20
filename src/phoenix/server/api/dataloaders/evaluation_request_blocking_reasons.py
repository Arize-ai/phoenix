"""Why an outstanding evaluation request has not started, per (session, project evaluator).
Every gate is asked through the same expression the sweeper gates on."""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Iterable, Optional

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, with_polymorphic
from strawberry.dataloader import DataLoader

from phoenix.config import get_env_online_eval_max_session_outstanding
from phoenix.db import models
from phoenix.db.helpers import exclude_project_evaluators_in_trace_projects
from phoenix.server.api.dataloaders.evaluation_requests import (
    EvaluationRequestBlockingReason,
    Key,
)
from phoenix.server.online_eval.leases import database_now
from phoenix.server.online_eval.session_policy import (
    admitted_session_work_count_statement,
    session_matches_project_evaluator_filter,
    session_project_evaluator_is_schedulable,
    session_work_may_still_produce_a_result,
)
from phoenix.server.types import DbSessionFactory


class EvaluationRequestBlockingReasonsDataLoader(
    DataLoader[Key, Optional[EvaluationRequestBlockingReason]]
):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(
        self, keys: Iterable[Key]
    ) -> list[Optional[EvaluationRequestBlockingReason]]:
        # Imported here: the evaluator registry reaches back into this package.
        from phoenix.server.online_eval.derivation import config_fingerprint
        from phoenix.server.online_eval.project_evaluator_resolution import (
            resolve_project_evaluators_bulk,
        )

        pairs = list(set(keys))
        project_evaluator_ids = {project_evaluator_id for _, project_evaluator_id in pairs}
        project_session_rowids = {rowid for rowid, _ in pairs}
        async with self._db.read() as session:
            # The same two exclusions the scheduler's own project_evaluators load applies.
            schedulable_project_evaluator_ids = set(
                await session.scalars(
                    exclude_project_evaluators_in_trace_projects(
                        sa.select(models.ProjectEvaluator.id).where(
                            models.ProjectEvaluator.id.in_(project_evaluator_ids),
                            session_project_evaluator_is_schedulable(models.ProjectEvaluator),
                        )
                    )
                )
            )
            polymorphic_evaluator = with_polymorphic(
                models.Evaluator,
                [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
            )
            project_evaluator_rows = (
                await session.execute(
                    sa.select(models.ProjectEvaluator, polymorphic_evaluator)
                    .join(
                        polymorphic_evaluator,
                        models.ProjectEvaluator.evaluator_id == polymorphic_evaluator.id,
                    )
                    .where(models.ProjectEvaluator.id.in_(schedulable_project_evaluator_ids))
                )
            ).all()
            resolved = await resolve_project_evaluators_bulk(
                session, [tuple(row) for row in project_evaluator_rows]
            )
            delay_seconds = {
                project_evaluator.id: project_evaluator.evaluation_delay_seconds
                for project_evaluator, _ in project_evaluator_rows
            }
            work_identity = {
                project_evaluator.id: (
                    project_evaluator.evaluator_id,
                    config_fingerprint(resolution),
                )
                for (project_evaluator, _), resolution in zip(project_evaluator_rows, resolved)
                if resolution is not None
            }
            filters = {
                project_evaluator.id: (
                    project_evaluator.filter_condition,
                    project_evaluator.project_id,
                )
                for (project_evaluator, _), resolution in zip(project_evaluator_rows, resolved)
                if resolution is not None and project_evaluator.filter_condition
            }
            quiet_since = {
                row.id: row.last_span_ingested_at
                for row in await session.execute(
                    sa.select(
                        models.ProjectSession.id,
                        models.ProjectSession.last_span_ingested_at,
                    ).where(models.ProjectSession.id.in_(project_session_rowids))
                )
            }
            evaluating = await _evaluating_pairs(session, pairs, work_identity)
            filtered_out = await _filtered_out_pairs(session, pairs, filters)
            # The sweeper reads the database clock, not a replica's own.
            now = await database_now(session, self._db.dialect)
            max_outstanding = get_env_online_eval_max_session_outstanding()
            capacity_reached = (
                await session.scalar(admitted_session_work_count_statement(max_outstanding)) or 0
            ) >= max_outstanding
        return [
            _blocking_reason(
                key,
                schedulable_project_evaluator_ids=schedulable_project_evaluator_ids,
                resolvable_project_evaluator_ids=set(work_identity),
                delay_seconds=delay_seconds,
                quiet_since=quiet_since,
                evaluating=evaluating,
                filtered_out=filtered_out,
                capacity_reached=capacity_reached,
                now=now,
            )
            for key in keys
        ]


def _blocking_reason(
    key: Key,
    *,
    schedulable_project_evaluator_ids: set[int],
    resolvable_project_evaluator_ids: set[int],
    delay_seconds: dict[int, int],
    quiet_since: dict[int, Optional[datetime]],
    evaluating: set[Key],
    filtered_out: set[Key],
    capacity_reached: bool,
    now: datetime,
) -> Optional[EvaluationRequestBlockingReason]:
    """The first condition holding this pair back, most actionable first."""
    _, project_evaluator_id = key
    if project_evaluator_id not in schedulable_project_evaluator_ids:
        return EvaluationRequestBlockingReason.EVALUATOR_NOT_SCHEDULABLE
    if project_evaluator_id not in resolvable_project_evaluator_ids:
        return EvaluationRequestBlockingReason.EVALUATOR_VERSION_UNRESOLVED
    if key in evaluating:
        return EvaluationRequestBlockingReason.EVALUATION_IN_PROGRESS
    if key in filtered_out:
        return EvaluationRequestBlockingReason.SESSION_FILTER_NOT_MATCHED
    last_span_ingested_at = quiet_since.get(key[0])
    if last_span_ingested_at is None:
        return EvaluationRequestBlockingReason.SESSION_ACTIVE
    due_at = last_span_ingested_at + timedelta(seconds=delay_seconds[project_evaluator_id])
    if now < due_at:
        return EvaluationRequestBlockingReason.SESSION_ACTIVE
    if capacity_reached:
        return EvaluationRequestBlockingReason.EVALUATION_CAPACITY_REACHED
    return None


async def _evaluating_pairs(
    session: AsyncSession,
    pairs: list[Key],
    work_identity: dict[int, tuple[int, str]],
) -> set[Key]:
    """The pairs whose evaluation can still run, so a newer ask waits behind it. Keyed on
    (session, evaluator, fingerprint), the identity the sweep excludes on."""
    identities = {
        (rowid, *work_identity[project_evaluator_id]): (rowid, project_evaluator_id)
        for rowid, project_evaluator_id in pairs
        if project_evaluator_id in work_identity
    }
    if not identities:
        return set()
    work = aliased(models.EvalSessionWorkUnit)
    rows = await session.execute(
        sa.select(
            work.project_session_rowid,
            work.evaluator_id,
            work.config_fingerprint,
        )
        .where(
            sa.tuple_(
                work.project_session_rowid,
                work.evaluator_id,
                work.config_fingerprint,
            ).in_(list(identities)),
            session_work_may_still_produce_a_result(work),
        )
        .distinct()
    )
    return {
        identities[(row.project_session_rowid, row.evaluator_id, row.config_fingerprint)]
        for row in rows
    }


async def _filtered_out_pairs(
    session: AsyncSession,
    pairs: list[Key],
    filters: dict[int, tuple[str, int]],
) -> set[Key]:
    """The pairs whose session the project_evaluators's own filter excludes."""
    if not filters:
        return set()
    requested: dict[int, set[int]] = defaultdict(set)
    for rowid, project_evaluator_id in pairs:
        if project_evaluator_id in filters:
            requested[project_evaluator_id].add(rowid)
    filtered_out: set[Key] = set()
    for project_evaluator_id, rowids in requested.items():
        filter_condition, project_id = filters[project_evaluator_id]
        matching = set(
            await session.scalars(
                sa.select(models.ProjectSession.id).where(
                    models.ProjectSession.id.in_(rowids),
                    session_matches_project_evaluator_filter(filter_condition, project_id),
                )
            )
        )
        filtered_out.update((rowid, project_evaluator_id) for rowid in rowids - matching)
    return filtered_out

