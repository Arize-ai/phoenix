from secrets import token_hex

import sqlalchemy as sa

from phoenix.db import models
from phoenix.db.facilitator import _ensure_default_project_trace_retention_policy
from phoenix.db.types.trace_retention import (
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.types import DbSessionFactory


class TestEnsureDefaultProjectTraceRetentionPolicy:
    async def test_default_project_trace_retention_policy_insertion(
        self,
        db: DbSessionFactory,
    ) -> None:
        stmt = sa.select(models.ProjectTraceRetentionPolicy)
        async with db() as session:
            policies = list(await session.scalars(stmt))
        assert len(policies) == 0
        for _ in range(2):
            async with db() as session:
                await _ensure_default_project_trace_retention_policy(session)
            async with db() as session:
                policies = list(await session.scalars(stmt))
            assert len(policies) == 1
        policy = policies[0]
        assert policy.id == 0
        assert policy.name == "Default"
        assert policy.cron_expression.root == "0 0 * * 0"
        assert policy.rule.root == MaxDaysRule(max_days=0)
        assert not bool(policy.rule)  # rule is dormant by default

        # Should be able to insert new policies without error. This could be an issue for postgres
        # if the default policy is inserted at id=1 without incrementing the serial so the next
        # insert would have id=1 and fail.
        policy = models.ProjectTraceRetentionPolicy(
            name=token_hex(8),
            cron_expression=TraceRetentionCronExpression(root="0 0 * * 0"),
            rule=TraceRetentionRule(root=MaxDaysRule(max_days=0)),
        )
        async with db() as session:
            session.add(policy)
            await session.flush()
        assert policy.id == 1
