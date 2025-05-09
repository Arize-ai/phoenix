from __future__ import annotations

from typing import Optional

import sqlalchemy as sa
import strawberry
from strawberry import UNSET, Info
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.types.trace_retention import (
    MaxCountRule,
    MaxDaysOrCountRule,
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.CronExpression import CronExpression
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectTraceRetentionPolicy import (
    ProjectTraceRetentionPolicy,
)


@strawberry.input
class ProjectTraceRetentionRuleMaxDaysInput:
    max_days: float


@strawberry.input
class ProjectTraceRetentionRuleMaxCountInput:
    max_count: int


@strawberry.input
class ProjectTraceRetentionRuleMaxDaysOrCountInput(
    ProjectTraceRetentionRuleMaxDaysInput,
    ProjectTraceRetentionRuleMaxCountInput,
): ...


@strawberry.input(one_of=True)
class ProjectTraceRetentionRuleInput:
    max_days: Optional[ProjectTraceRetentionRuleMaxDaysInput] = UNSET
    max_count: Optional[ProjectTraceRetentionRuleMaxCountInput] = UNSET
    max_days_or_count: Optional[ProjectTraceRetentionRuleMaxDaysOrCountInput] = UNSET

    def __post_init__(self) -> None:
        if (
            sum(
                (
                    isinstance(self.max_days, ProjectTraceRetentionRuleMaxDaysInput),
                    isinstance(self.max_count, ProjectTraceRetentionRuleMaxCountInput),
                    isinstance(
                        self.max_days_or_count, ProjectTraceRetentionRuleMaxDaysOrCountInput
                    ),
                )
            )
            != 1
        ):
            raise BadRequest("Exactly one rule must be provided")


@strawberry.input
class CreateProjectTraceRetentionPolicyInput:
    name: str
    cron_expression: CronExpression
    rule: ProjectTraceRetentionRuleInput
    add_projects: Optional[list[GlobalID]] = UNSET

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise BadRequest("Name cannot be empty")
        if not self.cron_expression.strip():
            raise BadRequest("Cron expression cannot be empty")


@strawberry.input
class PatchProjectTraceRetentionPolicyInput:
    id: GlobalID
    name: Optional[str] = UNSET
    cron_expression: Optional[CronExpression] = UNSET
    rule: Optional[ProjectTraceRetentionRuleInput] = UNSET
    add_projects: Optional[list[GlobalID]] = UNSET
    remove_projects: Optional[list[GlobalID]] = UNSET

    def __post_init__(self) -> None:
        if isinstance(self.name, str) and not self.name.strip():
            raise BadRequest("Name cannot be empty")
        if isinstance(self.cron_expression, str) and not self.cron_expression.strip():
            raise BadRequest("Cron expression cannot be empty")
        if isinstance(self.add_projects, list) and isinstance(self.remove_projects, list):
            if set(self.add_projects) & set(self.remove_projects):
                raise BadRequest("A project cannot be in both add and remove lists")


@strawberry.input
class DeleteProjectTraceRetentionPolicyInput:
    id: GlobalID


@strawberry.type
class ProjectTraceRetentionPolicyMutationPayload:
    query: Query = strawberry.field(default_factory=Query)
    node: ProjectTraceRetentionPolicy


@strawberry.type
class ProjectTraceRetentionPolicyMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdminIfAuthEnabled, IsLocked])  # type: ignore
    async def create_project_trace_retention_policy(
        self,
        info: Info[Context, None],
        input: CreateProjectTraceRetentionPolicyInput,
    ) -> ProjectTraceRetentionPolicyMutationPayload:
        policy = models.ProjectTraceRetentionPolicy(
            name=input.name,
            cron_expression=TraceRetentionCronExpression.model_validate(input.cron_expression),
            rule=_gql_to_db_rule(input.rule),
        )
        add_project_ids = (
            []
            if not isinstance(input.add_projects, list)
            else [
                from_global_id_with_expected_type(project_id, Project.__name__)
                for project_id in input.add_projects
            ]
        )
        async with info.context.db() as session:
            session.add(policy)
            await session.flush()
            if add_project_ids:
                stmt = (
                    sa.update(models.Project)
                    .where(models.Project.id.in_(set(add_project_ids)))
                    .values(trace_retention_policy_id=policy.id)
                )
                await session.execute(stmt)
        return ProjectTraceRetentionPolicyMutationPayload(
            node=ProjectTraceRetentionPolicy(id=policy.id, db_policy=policy),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdminIfAuthEnabled, IsLocked])  # type: ignore
    async def patch_project_trace_retention_policy(
        self,
        info: Info[Context, None],
        input: PatchProjectTraceRetentionPolicyInput,
    ) -> ProjectTraceRetentionPolicyMutationPayload:
        id_ = from_global_id_with_expected_type(input.id, ProjectTraceRetentionPolicy.__name__)
        add_project_ids = (
            []
            if not isinstance(input.add_projects, list)
            else [
                from_global_id_with_expected_type(project_id, Project.__name__)
                for project_id in input.add_projects
            ]
        )
        remove_project_ids = (
            []
            if not isinstance(input.remove_projects, list)
            else [
                from_global_id_with_expected_type(project_id, Project.__name__)
                for project_id in input.remove_projects
            ]
        )
        async with info.context.db() as session:
            policy = await session.get(models.ProjectTraceRetentionPolicy, id_)
            if not policy:
                raise NotFound(f"ProjectTraceRetentionPolicy with ID={input.id} not found")
            if isinstance(input.name, str) and input.name != policy.name:
                if id_ == DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID:
                    raise BadRequest(
                        "Cannot change the name of the default project trace retention policy"
                    )
                policy.name = input.name
            if isinstance(input.cron_expression, str):
                policy.cron_expression = TraceRetentionCronExpression(root=input.cron_expression)
            if isinstance(input.rule, ProjectTraceRetentionRuleInput):
                policy.rule = _gql_to_db_rule(input.rule)
            if policy is session.dirty:
                await session.flush()
            if add_project_ids:
                stmt = (
                    sa.update(models.Project)
                    .where(models.Project.id.in_(set(add_project_ids)))
                    .values(trace_retention_policy_id=policy.id)
                )
                await session.execute(stmt)
            if remove_project_ids:
                stmt = (
                    sa.update(models.Project)
                    .where(models.Project.trace_retention_policy_id == policy.id)
                    .where(models.Project.id.in_(set(remove_project_ids)))
                    .values(trace_retention_policy_id=None)
                )
                await session.execute(stmt)
        return ProjectTraceRetentionPolicyMutationPayload(
            node=ProjectTraceRetentionPolicy(id=policy.id, db_policy=policy),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdminIfAuthEnabled])  # type: ignore
    async def delete_project_trace_retention_policy(
        self,
        info: Info[Context, None],
        input: DeleteProjectTraceRetentionPolicyInput,
    ) -> ProjectTraceRetentionPolicyMutationPayload:
        id_ = from_global_id_with_expected_type(input.id, ProjectTraceRetentionPolicy.__name__)
        if id_ == DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID:
            raise BadRequest("Cannot delete the default project trace retention policy.")
        stmt = (
            sa.delete(models.ProjectTraceRetentionPolicy)
            .where(models.ProjectTraceRetentionPolicy.id == id_)
            .returning(models.ProjectTraceRetentionPolicy)
        )
        async with info.context.db() as session:
            policy = await session.scalar(stmt)
        if not policy:
            raise NotFound(f"ProjectTraceRetentionPolicy with ID={input.id} not found")
        return ProjectTraceRetentionPolicyMutationPayload(
            node=ProjectTraceRetentionPolicy(id=policy.id, db_policy=policy),
        )


def _gql_to_db_rule(
    rule: ProjectTraceRetentionRuleInput,
) -> TraceRetentionRule:
    if isinstance(rule.max_days, ProjectTraceRetentionRuleMaxDaysInput):
        return TraceRetentionRule(root=MaxDaysRule(max_days=rule.max_days.max_days))
    elif isinstance(rule.max_count, ProjectTraceRetentionRuleMaxCountInput):
        return TraceRetentionRule(root=MaxCountRule(max_count=rule.max_count.max_count))
    elif isinstance(rule.max_days_or_count, ProjectTraceRetentionRuleMaxDaysOrCountInput):
        return TraceRetentionRule(
            root=MaxDaysOrCountRule(
                max_days=rule.max_days_or_count.max_days,
                max_count=rule.max_days_or_count.max_count,
            )
        )
    else:
        raise ValueError("Invalid rule input")
