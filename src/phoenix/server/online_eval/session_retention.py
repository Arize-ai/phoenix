"""Retention for fulfilled session requests and terminal session work history."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_, delete, exists, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.sql.elements import ColumnElement

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS, SESSION_DECLINED_STATUSES
from phoenix.server.online_eval.requests import is_unfulfilled
from phoenix.server.online_eval.session_policy import (
    session_work_answers_request,
    session_work_records_background_decision,
)


def _terminal_session_work(work: Any) -> ColumnElement[bool]:
    return or_(
        work.status.in_(("DONE", "EXPIRED", *SESSION_DECLINED_STATUSES)),
        and_(work.status == "ERROR", work.attempts >= MAX_ATTEMPTS),
    )


async def reap_session_history(
    session: AsyncSession,
    *,
    retention_cutoff: datetime,
) -> None:
    """Delete aged history without removing the evidence that brakes new work.

    Fulfilled requests are deleted before the work they reference. This keeps provenance
    intact for every retained request instead of relying on the foreign key's ``SET NULL``
    behavior. An unfulfilled request is never eligible for retention.

    One terminal row can serve two different scheduling decisions: background scheduling
    reads terminal decisions, while a trigger request reads only completed outcomes. A row
    covering the session's current content is therefore retained until a newer row can
    replace it for every decision it serves.
    """
    await session.execute(
        delete(models.EvaluationRequest).where(
            not_(is_unfulfilled(models.EvaluationRequest)),
            models.EvaluationRequest.updated_at < retention_cutoff,
        )
    )

    work = models.EvalSessionWorkUnit
    replacement = aliased(models.EvalSessionWorkUnit)
    current_content = (
        select(models.ProjectSession.last_span_ingested_at)
        .where(models.ProjectSession.id == work.project_session_rowid)
        .correlate(work)
        .scalar_subquery()
    )
    same_pair_with_newer_current_content = (
        replacement.project_session_rowid == work.project_session_rowid,
        replacement.evaluator_id == work.evaluator_id,
        replacement.config_fingerprint == work.config_fingerprint,
        replacement.id > work.id,
        replacement.evaluated_through >= current_content,
    )
    newer_background_decision_exists = exists(
        select(1).where(
            *same_pair_with_newer_current_content,
            session_work_records_background_decision(replacement),
        )
    )
    newer_request_answer_exists = exists(
        select(1).where(
            *same_pair_with_newer_current_content,
            session_work_answers_request(replacement),
        )
    )
    still_referenced = exists(
        select(1).where(models.EvaluationRequest.materialized_by_session_work_unit_id == work.id)
    )

    await session.execute(
        delete(work).where(
            _terminal_session_work(work),
            work.updated_at < retention_cutoff,
            not_(still_referenced),
            or_(
                current_content.is_(None),
                work.evaluated_through < current_content,
                and_(
                    or_(
                        not_(session_work_records_background_decision(work)),
                        newer_background_decision_exists,
                    ),
                    or_(
                        not_(session_work_answers_request(work)),
                        newer_request_answer_exists,
                    ),
                ),
            ),
        )
    )

