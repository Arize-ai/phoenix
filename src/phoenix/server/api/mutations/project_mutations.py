from datetime import datetime, timezone
from typing import cast

import strawberry
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.input_types.ClearProjectInput import ClearProjectInput
from phoenix.server.api.input_types.CreateProjectInput import CreateProjectInput
from phoenix.server.api.input_types.PatchProjectInput import PatchProjectInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project, to_gql_project
from phoenix.server.cleanup.lifecycle import (
    clear_project_traces_in_batches,
    tombstone_project,
)
from phoenix.server.dml_event import ProjectDeleteEvent, ProjectInsertEvent, SpanDeleteEvent


@strawberry.type
class ProjectMutationPayload:
    project: Project
    query: Query


@strawberry.type
class ProjectMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def create_project(
        self,
        info: Info[Context, None],
        input: CreateProjectInput,
    ) -> ProjectMutationPayload:
        if not (name := input.name.strip()):
            raise BadRequest("Name cannot be empty")
        description = (input.description or "").strip() or None
        gradient_start_color = (input.gradient_start_color or "").strip() or None
        gradient_end_color = (input.gradient_end_color or "").strip() or None
        project = models.Project(
            name=name,
            description=description,
            gradient_start_color=gradient_start_color,
            gradient_end_color=gradient_end_color,
        )
        try:
            async with info.context.db() as session:
                session.add(project)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict(f"Project with name '{name}' already exists")
        info.context.event_queue.put(ProjectInsertEvent((project.id,)))
        return ProjectMutationPayload(project=to_gql_project(project), query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_project(self, info: Info[Context, None], id: GlobalID) -> Query:
        project_id = from_global_id_with_expected_type(global_id=id, expected_type_name="Project")
        try:
            async with info.context.db() as session:
                tombstoned_project = await tombstone_project(session, project_id=project_id)
        except NotFound as error:
            raise ValueError(f"Unknown project: {id}") from error
        except BadRequest as error:
            raise ValueError(str(error)) from error
        tombstoned_ids = tuple(tombstoned_project.tombstoned_project_ids)
        info.context.event_queue.put(SpanDeleteEvent(tombstoned_ids))
        info.context.event_queue.put(ProjectDeleteEvent(tombstoned_ids))
        return Query()

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def clear_project(self, info: Info[Context, None], input: ClearProjectInput) -> Query:
        project_id = from_global_id_with_expected_type(
            global_id=input.id, expected_type_name="Project"
        )
        end_time = (
            cast(datetime, normalize_datetime(input.end_time, timezone.utc))
            if input.end_time is not None and input.end_time is not UNSET
            else None
        )
        try:
            async for _ in clear_project_traces_in_batches(
                info.context.db,
                project_id=project_id,
                end_time=end_time,
                event_queue=info.context.event_queue,
            ):
                pass
        except NotFound as error:
            raise ValueError(f"Unknown project: {input.id}") from error
        return Query()

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def patch_project(
        self,
        info: Info[Context, None],
        input: PatchProjectInput,
    ) -> ProjectMutationPayload:
        project_id = from_global_id_with_expected_type(
            global_id=input.id, expected_type_name="Project"
        )
        async with info.context.db() as session:
            project = await session.scalar(
                select(models.Project).where(
                    models.Project.id == project_id,
                    models.Project.deleted_at.is_(None),
                )
            )
            if project is None:
                raise ValueError(f"Unknown project: {input.id}")
            if input.description is not UNSET:
                project.description = (input.description or "").strip() or None
            if input.gradient_start_color is not UNSET:
                project.gradient_start_color = (
                    input.gradient_start_color or ""
                ).strip() or project.gradient_start_color
            if input.gradient_end_color is not UNSET:
                project.gradient_end_color = (
                    input.gradient_end_color or ""
                ).strip() or project.gradient_end_color
        return ProjectMutationPayload(project=to_gql_project(project), query=Query())
