from __future__ import annotations

from typing import Annotated, Optional, Union

import strawberry
from strawberry import UNSET, Private
from strawberry.relay import Connection, Node, NodeID
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types.trace_retention import MaxCountRule, MaxDaysOrCountRule, MaxDaysRule
from phoenix.server.api.context import Context
from phoenix.server.api.types.CronExpression import CronExpression
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list
from phoenix.server.api.types.Project import Project


@strawberry.type
class TraceRetentionRuleMaxDays:
    max_days: float


@strawberry.type
class TraceRetentionRuleMaxCount:
    max_count: int


@strawberry.type
class TraceRetentionRuleMaxDaysOrCount(TraceRetentionRuleMaxDays, TraceRetentionRuleMaxCount): ...


TraceRetentionRule: TypeAlias = Annotated[
    Union[TraceRetentionRuleMaxDays, TraceRetentionRuleMaxCount, TraceRetentionRuleMaxDaysOrCount],
    strawberry.union("TraceRetentionRule"),
]


@strawberry.type
class ProjectTraceRetentionPolicy(Node):
    id: NodeID[int]
    db_policy: Private[Optional[models.ProjectTraceRetentionPolicy]] = None

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_policy:
            value = self.db_policy.name
        else:
            value = await info.context.data_loaders.project_trace_retention_policy_fields.load(
                (self.id, models.ProjectTraceRetentionPolicy.name),
            )
        return value

    @strawberry.field
    async def cron_expression(
        self,
        info: Info[Context, None],
    ) -> CronExpression:
        if self.db_policy:
            value = self.db_policy.cron_expression
        else:
            value = await info.context.data_loaders.project_trace_retention_policy_fields.load(
                (self.id, models.ProjectTraceRetentionPolicy.cron_expression),
            )
        return CronExpression(value.root)

    @strawberry.field
    async def rule(
        self,
        info: Info[Context, None],
    ) -> TraceRetentionRule:
        if self.db_policy:
            value = self.db_policy.rule
        else:
            value = await info.context.data_loaders.project_trace_retention_policy_fields.load(
                (self.id, models.ProjectTraceRetentionPolicy.rule),
            )
        if isinstance(value.root, MaxDaysRule):
            return TraceRetentionRuleMaxDays(max_days=value.root.max_days)
        if isinstance(value.root, MaxCountRule):
            return TraceRetentionRuleMaxCount(max_count=value.root.max_count)
        if isinstance(value.root, MaxDaysOrCountRule):
            return TraceRetentionRuleMaxDaysOrCount(
                max_days=value.root.max_days, max_count=value.root.max_count
            )
        assert_never(value.root)

    @strawberry.field
    async def projects(
        self,
        info: Info[Context, None],
        first: Optional[int] = 100,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Project]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        project_rowids = await info.context.data_loaders.projects_by_trace_retention_policy_id.load(
            self.id
        )
        data = [Project(project_rowid=project_rowid) for project_rowid in project_rowids]
        return connection_from_list(data=data, args=args)
