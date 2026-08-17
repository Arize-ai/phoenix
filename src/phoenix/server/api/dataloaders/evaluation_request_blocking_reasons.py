"""Why an outstanding evaluation request has not started, per (session, project evaluator)."""

from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

import sqlalchemy as sa
from sqlalchemy.orm import aliased, with_polymorphic
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS
from phoenix.db.helpers import exclude_project_evaluators_in_trace_projects
from phoenix.server.api.dataloaders.evaluation_requests import (
    EvaluationRequestBlockingReason,
    Key,
)
from phoenix.server.online_eval.session_policy import session_project_evaluator_is_schedulable
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
        # Imported here because project evaluator resolution reaches back into this package
        # through the evaluator registry, and a module-level import would close that loop.
        from phoenix.server.online_eval.project_evaluator_resolution import (
            resolve_project_evaluators_bulk,
        )

        pairs = list(set(keys))
        project_evaluator_ids = {project_evaluator_id for _, project_evaluator_id in pairs}
        project_session_rowids = {rowid for rowid, _ in pairs}
        async with self._db.read() as session:
            # The same two exclusions the scheduler's own project-evaluator load applies, asked as
            # one question so this field cannot advertise a pair the scheduler skips.
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
            resolvable_project_evaluator_ids = {
                project_evaluator.id
                for (project_evaluator, _), resolution in zip(project_evaluator_rows, resolved)
                if resolution is not None
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
            evaluating = {
                (row.project_session_rowid, row.project_evaluator_id)
                for row in await session.execute(_unfinished_stmt(pairs))
            }
        now = datetime.now(timezone.utc)
        return [
            _blocking_reason(
                key,
                schedulable_project_evaluator_ids=schedulable_project_evaluator_ids,
                resolvable_project_evaluator_ids=resolvable_project_evaluator_ids,
                delay_seconds=delay_seconds,
                quiet_since=quiet_since,
                evaluating=evaluating,
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
    last_span_ingested_at = quiet_since.get(key[0])
    if last_span_ingested_at is None:
        return EvaluationRequestBlockingReason.SESSION_ACTIVE
    due_at = last_span_ingested_at + timedelta(seconds=delay_seconds[project_evaluator_id])
    if now < due_at:
        return EvaluationRequestBlockingReason.SESSION_ACTIVE
    return None


def _unfinished_stmt(pairs: list[Key]) -> sa.Select[Any]:
    """The pairs whose linked evaluation can still run, so a newer ask waits behind it."""
    work = aliased(models.EvalSessionWorkUnit)
    return (
        sa.select(
            models.EvaluationRequest.project_session_rowid,
            models.EvaluationRequest.project_evaluator_id,
        )
        .select_from(models.EvaluationRequest)
        .join(work, models.EvaluationRequest.materialized_by_session_work_unit_id == work.id)
        .where(
            sa.tuple_(
                models.EvaluationRequest.project_session_rowid,
                models.EvaluationRequest.project_evaluator_id,
            ).in_(pairs),
            sa.or_(
                work.status.in_(("PENDING", "RUNNING")),
                sa.and_(work.status == "ERROR", work.attempts < MAX_ATTEMPTS),
            ),
        )
    )

