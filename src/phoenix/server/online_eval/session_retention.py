"""Retention for fulfilled session requests and terminal session work history."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_, delete, exists, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.sql.elements import ColumnElement

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS, TERMINAL_EVAL_SESSION_WORK_STATUSES
from phoenix.server.online_eval.requests import is_unfulfilled


def _terminal_session_work(work: Any) -> ColumnElement[bool]:
    return or_(
        work.status.in_(TERMINAL_EVAL_SESSION_WORK_STATUSES),
        and_(work.status == "ERROR", work.attempts >= MAX_ATTEMPTS),
    )


async def reap_session_history(
    session: AsyncSession,
    *,
    retention_cutoff: datetime,
) -> None:
    """Delete aged history without removing the evidence that brakes new work. Sessions,
    work, and requests are locked in that order, matching the content-incomplete transition."""
    request = models.EvaluationRequest
    work = models.EvalSessionWorkUnit
    aged_fulfilled_request_exists = exists(
        select(1).where(
            request.project_session_rowid == models.ProjectSession.id,
            not_(is_unfulfilled(request)),
            request.updated_at < retention_cutoff,
        )
    )
    aged_terminal_work_exists = exists(
        select(1).where(
            work.project_session_rowid == models.ProjectSession.id,
            _terminal_session_work(work),
            work.updated_at < retention_cutoff,
        )
    )
    session_ids = tuple(
        await session.scalars(
            select(models.ProjectSession.id)
            .where(or_(aged_fulfilled_request_exists, aged_terminal_work_exists))
            .order_by(models.ProjectSession.id)
            .with_for_update()
        )
    )
    if not session_ids:
        return

    replacement = aliased(models.EvalSessionWorkUnit)
    newer_terminal_work_exists = exists(
        select(1).where(
            replacement.project_session_rowid == work.project_session_rowid,
            replacement.evaluator_id == work.evaluator_id,
            replacement.config_fingerprint == work.config_fingerprint,
            replacement.id > work.id,
            _terminal_session_work(replacement),
        )
    )
    retained_request_reference_exists = exists(
        select(1).where(
            request.materialized_by_session_work_unit_id == work.id,
            or_(
                is_unfulfilled(request),
                request.updated_at >= retention_cutoff,
            ),
        )
    )
    work_ids = tuple(
        await session.scalars(
            select(work.id)
            .where(
                work.project_session_rowid.in_(session_ids),
                _terminal_session_work(work),
                work.updated_at < retention_cutoff,
                newer_terminal_work_exists,
                not_(retained_request_reference_exists),
            )
            .order_by(work.id)
            .with_for_update()
        )
    )
    request_ids = tuple(
        await session.scalars(
            select(request.id)
            .where(
                request.project_session_rowid.in_(session_ids),
                not_(is_unfulfilled(request)),
                request.updated_at < retention_cutoff,
            )
            .order_by(request.id)
            .with_for_update()
        )
    )
    if request_ids:
        await session.execute(delete(request).where(request.id.in_(request_ids)))
    if work_ids:
        await session.execute(delete(work).where(work.id.in_(work_ids)))
