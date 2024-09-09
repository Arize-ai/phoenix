import strawberry
from sqlalchemy import delete, select
from sqlalchemy.orm import load_only
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.ClearProjectInput import ClearProjectInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.dml_event import ProjectDeleteEvent, SpanDeleteEvent


@strawberry.type
class ProjectMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_project(self, info: Info[Context, None], id: GlobalID) -> Query:
        project_id = from_global_id_with_expected_type(global_id=id, expected_type_name="Project")
        async with info.context.db() as session:
            project = await session.scalar(
                select(models.Project)
                .where(models.Project.id == project_id)
                .options(load_only(models.Project.name))
            )
            if project is None:
                raise ValueError(f"Unknown project: {id}")
            if project.name == DEFAULT_PROJECT_NAME:
                raise ValueError(f"Cannot delete the {DEFAULT_PROJECT_NAME} project")
            await session.delete(project)
        info.context.event_queue.put(ProjectDeleteEvent((project_id,)))
        return Query()

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def clear_project(self, info: Info[Context, None], input: ClearProjectInput) -> Query:
        project_id = from_global_id_with_expected_type(
            global_id=input.id, expected_type_name="Project"
        )
        delete_statement = delete(models.Trace).where(models.Trace.project_rowid == project_id)
        if input.end_time:
            delete_statement = delete_statement.where(models.Trace.start_time < input.end_time)
        async with info.context.db() as session:
            await session.execute(delete_statement)
        info.context.event_queue.put(SpanDeleteEvent((project_id,)))
        return Query()
