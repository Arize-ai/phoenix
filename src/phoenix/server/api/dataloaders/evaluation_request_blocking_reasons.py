"""Why an outstanding evaluation request has not started, per (session, project evaluator)."""

from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

import sqlalchemy as sa
from sqlalchemy.orm import aliased, with_polymorphic
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS
from phoenix.db.helpers import exclude_criteria_targeting_evaluator_traces
from phoenix.server.api.dataloaders.evaluation_requests import (
    EvaluationRequestBlockingReason,
    Key,
)
from phoenix.server.online_eval.session_policy import session_criteria_is_schedulable
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
        # Imported here because criteria resolution reaches back into this package
        # through the evaluator registry, and a module-level import would close that loop.
        from phoenix.server.online_eval.criteria_resolution import resolve_criteria_bulk

        pairs = list(set(keys))
        criteria_ids = {criteria_id for _, criteria_id in pairs}
        project_session_rowids = {rowid for rowid, _ in pairs}
        async with self._db.read() as session:
            # The same two exclusions the scheduler's own criteria load applies, asked as
            # one question so this field cannot advertise a pair the scheduler skips.
            schedulable_criteria_ids = set(
                await session.scalars(
                    exclude_criteria_targeting_evaluator_traces(
                        sa.select(models.ProjectEvaluatorCriteria.id).where(
                            models.ProjectEvaluatorCriteria.id.in_(criteria_ids),
                            session_criteria_is_schedulable(models.ProjectEvaluatorCriteria),
                        )
                    )
                )
            )
            polymorphic_evaluator = with_polymorphic(
                models.Evaluator,
                [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
            )
            criteria_rows = (
                await session.execute(
                    sa.select(models.ProjectEvaluatorCriteria, polymorphic_evaluator)
                    .join(
                        polymorphic_evaluator,
                        models.ProjectEvaluatorCriteria.evaluator_id == polymorphic_evaluator.id,
                    )
                    .where(models.ProjectEvaluatorCriteria.id.in_(schedulable_criteria_ids))
                )
            ).all()
            resolved = await resolve_criteria_bulk(session, [tuple(row) for row in criteria_rows])
            delay_seconds = {
                criteria.id: criteria.evaluation_delay_seconds for criteria, _ in criteria_rows
            }
            resolvable_criteria_ids = {
                criteria.id
                for (criteria, _), resolution in zip(criteria_rows, resolved)
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
                (row.project_session_rowid, row.criteria_id)
                for row in await session.execute(_unfinished_stmt(pairs))
            }
        now = datetime.now(timezone.utc)
        return [
            _blocking_reason(
                key,
                schedulable_criteria_ids=schedulable_criteria_ids,
                resolvable_criteria_ids=resolvable_criteria_ids,
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
    schedulable_criteria_ids: set[int],
    resolvable_criteria_ids: set[int],
    delay_seconds: dict[int, int],
    quiet_since: dict[int, Optional[datetime]],
    evaluating: set[Key],
    now: datetime,
) -> Optional[EvaluationRequestBlockingReason]:
    """The first condition holding this pair back, most actionable first."""
    _, criteria_id = key
    if criteria_id not in schedulable_criteria_ids:
        return EvaluationRequestBlockingReason.EVALUATOR_NOT_SCHEDULABLE
    if criteria_id not in resolvable_criteria_ids:
        return EvaluationRequestBlockingReason.EVALUATOR_VERSION_UNRESOLVED
    if key in evaluating:
        return EvaluationRequestBlockingReason.EVALUATION_IN_PROGRESS
    last_span_ingested_at = quiet_since.get(key[0])
    if last_span_ingested_at is None:
        return EvaluationRequestBlockingReason.SESSION_ACTIVE
    due_at = last_span_ingested_at + timedelta(seconds=delay_seconds[criteria_id])
    if now < due_at:
        return EvaluationRequestBlockingReason.SESSION_ACTIVE
    return None


def _unfinished_stmt(pairs: list[Key]) -> sa.Select[Any]:
    """The pairs whose linked evaluation can still run, so a newer ask waits behind it."""
    work = aliased(models.EvalSessionWorkUnit)
    return (
        sa.select(
            models.EvaluationRequest.project_session_rowid,
            models.EvaluationRequest.criteria_id,
        )
        .select_from(models.EvaluationRequest)
        .join(work, models.EvaluationRequest.materialized_by_session_work_unit_id == work.id)
        .where(
            sa.tuple_(
                models.EvaluationRequest.project_session_rowid,
                models.EvaluationRequest.criteria_id,
            ).in_(pairs),
            sa.or_(
                work.status.in_(("PENDING", "RUNNING")),
                sa.and_(work.status == "ERROR", work.attempts < MAX_ATTEMPTS),
            ),
        )
    )
