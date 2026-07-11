from __future__ import annotations

import logging
from asyncio import create_task, gather, sleep
from datetime import datetime, timedelta, timezone
from time import time

import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.models import Project, ProjectSession, ProjectTraceRetentionPolicy, Trace
from phoenix.server.dml_event import SpanDeleteEvent
from phoenix.server.dml_event_handler import DmlEventHandler
from phoenix.server.prometheus import (
    RETENTION_POLICY_EXECUTIONS,
    RETENTION_SWEEPER_LAST_RUN,
)
from phoenix.server.types import DaemonTask, DbSessionFactory
from phoenix.utilities import hour_of_week

logger = logging.getLogger(__name__)

_ORPHAN_SESSION_DELETE_BATCH_SIZE = 1000
_ORPHAN_SESSION_GRACE_PERIOD = timedelta(hours=1)


class TraceDataSweeper(DaemonTask):
    def __init__(self, db: DbSessionFactory, dml_event_handler: DmlEventHandler):
        super().__init__()
        self._db = db
        self._dml_event_handler = dml_event_handler

    async def _run(self) -> None:
        """Check hourly, apply policies, then clean up orphaned sessions."""
        while self._running:
            await self._sleep_until_next_hour()
            RETENTION_SWEEPER_LAST_RUN.set(time())
            try:
                if policies := await self._get_policies():
                    current_hour = self._current_hour()
                    if tasks := [
                        create_task(self._apply(policy))
                        for policy in policies
                        if self._should_apply(policy, current_hour)
                    ]:
                        await gather(*tasks, return_exceptions=True)
            except Exception:
                logger.exception("Unexpected error in retention sweeper main loop")
            try:
                await self._delete_orphan_sessions()
            except Exception:
                logger.exception("Failed to delete orphaned project sessions")

    async def _get_policies(self) -> list[ProjectTraceRetentionPolicy]:
        stmt = sa.select(ProjectTraceRetentionPolicy).options(
            selectinload(ProjectTraceRetentionPolicy.projects).load_only(Project.id)
        )
        async with self._db() as session:
            result = await session.scalars(stmt)
        # filter out no-op policies, e.g. max_days == 0
        return [policy for policy in result if bool(policy.rule)]

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    def _current_hour(self) -> int:
        return hour_of_week(self._now())

    def _should_apply(self, policy: ProjectTraceRetentionPolicy, current_hour: int) -> bool:
        if current_hour != policy.cron_expression.get_hour_of_prev_run():
            return False
        if policy.id != DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID and not policy.projects:
            return False
        return True

    async def _apply(self, policy: ProjectTraceRetentionPolicy) -> None:
        try:
            project_rowids = (
                (sa.select(Project.id).where(Project.trace_retention_policy_id.is_(None)))
                if policy.id == DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
                else [p.id for p in policy.projects]
            )
            async with self._db() as session:
                result = await policy.rule.delete_traces(session, project_rowids)
            self._dml_event_handler.put(SpanDeleteEvent(tuple(result)))
            RETENTION_POLICY_EXECUTIONS.labels(status="success").inc()
        except Exception:
            logger.exception(f"Failed to apply retention policy '{policy.name}' (id={policy.id})")
            RETENTION_POLICY_EXECUTIONS.labels(status="error").inc()

    async def _delete_orphan_sessions(self) -> None:
        """Delete session rows whose traces are all gone and whose last activity is old.

        Trace deletion (retention rules, bulk deletes) does not cascade upward to
        ``project_sessions``, so sessions whose traces have all been deleted
        linger as ghosts in the sessions UI. Only sessions quiet for the grace
        period are deleted: ``end_time`` advances with each new trace, so an
        active session never qualifies, and the grace period keeps the sweep
        clear of in-flight ingestion (a session row is created just before its
        first trace commits). Deleting a session cascades to its session
        annotations, consistent with trace deletion cascading to span/trace
        annotations. Deletes run in batches to bound transaction time.

        Two guards close a race with a session resuming mid-sweep (ingestion
        get-or-creates session rows without locking, and the traces FK cascades
        on session delete, so an unguarded delete could cascade away a
        just-committed trace):

        - ``end_time < cutoff`` is repeated as a direct qual on the DELETE.
          Under READ COMMITTED, if the DELETE blocks on a concurrent ingestion
          transaction that advanced the row's ``end_time``, the recheck against
          the new row version excludes it (the subquery's snapshot would not).
        - On PostgreSQL, candidates are locked with FOR UPDATE SKIP LOCKED, so
          any session row currently locked by in-flight ingestion (its UPDATE,
          or a trace INSERT's KEY SHARE on the parent) is skipped this sweep
          and reconsidered next hour. SQLite serializes writers, so the race
          cannot occur there.

        A narrower race remains if the sweeper commits after ingestion selects
        an old orphaned session but before ingestion flushes its trace. In that
        case the single span insert fails inside the bulk inserter's per-span
        savepoint, is logged and metered, and the batch continues. We accept
        that tradeoff here because it is the same pre-existing race carried by
        explicit session/project deletes; a retry in the ingestion path would
        address all such deletes together.
        """
        cutoff = self._now() - _ORPHAN_SESSION_GRACE_PERIOD
        total_deleted = 0
        while self._running:
            candidate_ids = (
                sa.select(ProjectSession.id)
                .where(ProjectSession.end_time < cutoff)
                .where(
                    ~sa.select(sa.literal(1))
                    .where(Trace.project_session_rowid == ProjectSession.id)
                    .exists()
                )
                .limit(_ORPHAN_SESSION_DELETE_BATCH_SIZE)
            )
            if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
                candidate_ids = candidate_ids.with_for_update(skip_locked=True)
            stmt = (
                sa.delete(ProjectSession)
                .where(ProjectSession.id.in_(candidate_ids))
                .where(ProjectSession.end_time < cutoff)
                .returning(ProjectSession.id)
            )
            async with self._db() as session:
                deleted = len((await session.scalars(stmt)).all())
            total_deleted += deleted
            if deleted < _ORPHAN_SESSION_DELETE_BATCH_SIZE:
                break
        if total_deleted:
            logger.info(
                f"Deleted {total_deleted} orphaned project session(s) with no remaining "
                f"traces and no activity since {cutoff.isoformat()}"
            )

    async def _sleep_until_next_hour(self) -> None:
        next_hour = self._now().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        await sleep((next_hour - self._now()).total_seconds())
