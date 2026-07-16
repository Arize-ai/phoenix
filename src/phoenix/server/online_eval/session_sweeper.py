"""Materialize session evaluation work after session activity becomes old enough."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Optional

from sqlalchemy import delete, func, or_, select, type_coerce, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import with_polymorphic

from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.derivation import config_fingerprint
from phoenix.server.online_eval.producer import resolve_criteria
from phoenix.server.online_eval.session_policy import (
    effective_session_evaluation_delay_seconds,
)
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

SESSION_SWEEP_LEASE_TTL_SECONDS = 90.0
SESSION_SWEEP_INTERVAL_SECONDS = 10.0

_CONSUMER_GROUP = "default"
_GENERATION = 0
_MAX_ACTIVITY_ROWS_PER_TICK = 1000
_SESSION_WORK_UNIQUE_BY = (
    "project_session_rowid",
    "evaluator_id",
    "config_fingerprint",
    "generation",
)


@dataclass(frozen=True)
class _SessionCriteria:
    criteria_id: int
    project_id: int
    evaluator_id: int
    fingerprint: Optional[str]
    delay_seconds: int


class SessionEvalSweeper(DaemonTask):
    """Create pending generation-0 work for eligible project sessions."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        consumer_group: str = _CONSUMER_GROUP,
        tick_interval_seconds: float = SESSION_SWEEP_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        self._consumer_group = consumer_group
        self._tick_interval_seconds = tick_interval_seconds
        self._sweeper_id = f"session-sweeper-{token_hex(8)}"
        self._lease_held = False

    async def _run(self) -> None:
        try:
            while self._running:
                try:
                    await self._tick()
                except Exception:
                    logger.exception("Session evaluation sweep failed")
                await asyncio.sleep(self._tick_interval_seconds)
        finally:
            await self._release_lease()

    async def _tick(self) -> None:
        for _ in range(2):
            async with self._db() as session:
                database_now = await self._database_now(session)
                cursor_id = await session.scalar(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.evaluation_target == "SESSION",
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                        or_(
                            models.EvalWorkCursor.claimed_by.is_(None),
                            models.EvalWorkCursor.claimed_by == self._sweeper_id,
                            models.EvalWorkCursor.claimed_at
                            < database_now - timedelta(seconds=SESSION_SWEEP_LEASE_TTL_SECONDS),
                        ),
                    )
                    .values(claimed_by=self._sweeper_id, claimed_at=database_now)
                    .returning(models.EvalWorkCursor.id)
                )
                if cursor_id is None:
                    row_exists = await session.scalar(
                        select(models.EvalWorkCursor.id).where(
                            models.EvalWorkCursor.evaluation_target == "SESSION",
                            models.EvalWorkCursor.consumer_group == self._consumer_group,
                        )
                    )
                    if row_exists is not None:
                        self._lease_held = False
                        return
                    await session.execute(
                        insert_on_conflict(
                            {
                                "evaluation_target": "SESSION",
                                "consumer_group": self._consumer_group,
                                "produced_through_id": 0,
                            },
                            table=models.EvalWorkCursor,
                            dialect=self._db.dialect,
                            unique_by=("evaluation_target", "consumer_group"),
                            on_conflict=OnConflict.DO_NOTHING,
                        )
                    )
                    continue

                self._lease_held = True
                await self._sweep(session, database_now)
                renewed_at = await self._database_now(session)
                renewed = await session.scalar(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.id == cursor_id,
                        models.EvalWorkCursor.claimed_by == self._sweeper_id,
                    )
                    .values(claimed_at=renewed_at)
                    .returning(models.EvalWorkCursor.id)
                )
                if renewed is None:
                    await session.rollback()
                    self._lease_held = False
                    logger.warning("Session evaluation sweeper lost its lease")
                return

    async def _database_now(self, session: AsyncSession) -> datetime:
        database_now = await session.scalar(select(type_coerce(func.now(), models.UtcTimeStamp())))
        if database_now is None:
            raise RuntimeError("Database did not return its current time")
        return database_now

    async def _load_criteria(self, session: AsyncSession) -> list[_SessionCriteria]:
        polymorphic_evaluator = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        rows = (
            await session.execute(
                select(models.ProjectEvaluatorCriteria, polymorphic_evaluator)
                .join(
                    polymorphic_evaluator,
                    models.ProjectEvaluatorCriteria.evaluator_id == polymorphic_evaluator.id,
                )
                .where(
                    models.ProjectEvaluatorCriteria.enabled,
                    models.ProjectEvaluatorCriteria.evaluation_target == "SESSION",
                    models.ProjectEvaluatorCriteria.filter_condition == "",
                    models.ProjectEvaluatorCriteria.sampling_rate == 1.0,
                )
            )
        ).all()
        criteria_rows: list[_SessionCriteria] = []
        for criteria, evaluator in rows:
            resolved = await resolve_criteria(session, criteria, evaluator)
            criteria_rows.append(
                _SessionCriteria(
                    criteria_id=criteria.id,
                    project_id=criteria.project_id,
                    evaluator_id=criteria.evaluator_id,
                    fingerprint=None if resolved is None else config_fingerprint(resolved),
                    delay_seconds=effective_session_evaluation_delay_seconds(criteria),
                )
            )
        return criteria_rows

    async def _sweep(self, session: AsyncSession, database_now: datetime) -> None:
        criteria_by_project: defaultdict[int, list[_SessionCriteria]] = defaultdict(list)
        for criteria in await self._load_criteria(session):
            criteria_by_project[criteria.project_id].append(criteria)

        activity_rows = (
            await session.execute(
                select(models.EvalSessionActivity, models.ProjectSession.project_id)
                .join(
                    models.ProjectSession,
                    models.EvalSessionActivity.project_session_rowid == models.ProjectSession.id,
                )
                .order_by(models.EvalSessionActivity.id)
                .limit(_MAX_ACTIVITY_ROWS_PER_TICK)
            )
        ).all()
        if not activity_rows:
            return

        project_session_ids = [activity.project_session_rowid for activity, _ in activity_rows]
        existing_work_keys = {
            tuple(row)
            for row in await session.execute(
                select(
                    models.EvalSessionWorkUnit.project_session_rowid,
                    models.EvalSessionWorkUnit.evaluator_id,
                    models.EvalSessionWorkUnit.config_fingerprint,
                    models.EvalSessionWorkUnit.generation,
                ).where(
                    models.EvalSessionWorkUnit.project_session_rowid.in_(project_session_ids),
                    models.EvalSessionWorkUnit.generation == _GENERATION,
                )
            )
        }

        work_records: list[dict[str, object]] = []
        resolved_activity_ids: list[int] = []
        for activity, project_id in activity_rows:
            activity_resolved = True
            for criteria in criteria_by_project[project_id]:
                if criteria.fingerprint is None:
                    activity_resolved = False
                    continue
                key = (
                    activity.project_session_rowid,
                    criteria.evaluator_id,
                    criteria.fingerprint,
                    _GENERATION,
                )
                # Reopened sessions are not re-evaluated; the original annotation stands.
                if key in existing_work_keys:
                    continue
                if activity.observed_at > database_now - timedelta(seconds=criteria.delay_seconds):
                    activity_resolved = False
                    continue
                work_records.append(
                    {
                        "project_session_rowid": activity.project_session_rowid,
                        "evaluator_id": criteria.evaluator_id,
                        "criteria_id": criteria.criteria_id,
                        "config_fingerprint": criteria.fingerprint,
                        "generation": _GENERATION,
                    }
                )
                existing_work_keys.add(key)
            if activity_resolved:
                resolved_activity_ids.append(activity.id)

        if work_records:
            await session.execute(
                insert_on_conflict(
                    *work_records,
                    table=models.EvalSessionWorkUnit,
                    dialect=self._db.dialect,
                    unique_by=_SESSION_WORK_UNIQUE_BY,
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
        if resolved_activity_ids:
            await session.execute(
                delete(models.EvalSessionActivity).where(
                    models.EvalSessionActivity.id.in_(resolved_activity_ids)
                )
            )

    async def _release_lease(self) -> None:
        if not self._lease_held:
            return
        self._lease_held = False
        try:
            async with self._db() as session:
                await session.execute(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.evaluation_target == "SESSION",
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                        models.EvalWorkCursor.claimed_by == self._sweeper_id,
                    )
                    .values(claimed_by=None, claimed_at=None)
                )
        except Exception:
            logger.exception("Failed to release session evaluation sweep lease")
