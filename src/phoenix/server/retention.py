from __future__ import annotations

from asyncio import create_task, gather, sleep
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.models import Project, ProjectTraceRetentionPolicy
from phoenix.server.dml_event import SpanDeleteEvent
from phoenix.server.dml_event_handler import DmlEventHandler
from phoenix.server.types import DaemonTask, DbSessionFactory
from phoenix.utilities import hour_of_week


class TraceDataSweeper(DaemonTask):
    def __init__(self, db: DbSessionFactory, dml_event_handler: DmlEventHandler):
        super().__init__()
        self._db = db
        self._dml_event_handler = dml_event_handler

    async def _run(self) -> None:
        """Check hourly and apply policies."""
        while self._running:
            await self._sleep_until_next_hour()
            if not (policies := await self._get_policies()):
                continue
            current_hour = self._current_hour()
            if tasks := [
                create_task(self._apply(policy))
                for policy in policies
                if self._should_apply(policy, current_hour)
            ]:
                await gather(*tasks, return_exceptions=True)

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
        project_rowids = (
            (
                sa.select(Project.id)
                .where(Project.trace_retention_policy_id.is_(None))
                .scalar_subquery()
            )
            if policy.id == DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
            else [p.id for p in policy.projects]
        )
        async with self._db() as session:
            result = await policy.rule.delete_traces(session, project_rowids)
        self._dml_event_handler.put(SpanDeleteEvent(tuple(result)))

    async def _sleep_until_next_hour(self) -> None:
        next_hour = self._now().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        await sleep((next_hour - self._now()).total_seconds())
