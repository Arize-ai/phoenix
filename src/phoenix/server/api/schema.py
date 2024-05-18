import strawberry
from sqlalchemy import delete, select
from sqlalchemy.orm import load_only
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.db.insertion.span import ClearProjectSpansEvent
from phoenix.server.api.context import Context
from phoenix.server.api.mutations.dataset_mutations import DatasetMutation
from phoenix.server.api.query import Query
from phoenix.server.api.types.ExportEventsMutation import ExportEventsMutation
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.type
class ProjectMutation:
    @strawberry.mutation
    async def delete_project(self, info: Info[Context, None], id: GlobalID) -> Query:
        node_id = from_global_id_with_expected_type(global_id=id, expected_type_name="Project")
        async with info.context.db() as session:
            project = await session.scalar(
                select(models.Project)
                .where(models.Project.id == node_id)
                .options(load_only(models.Project.name))
            )
            if project is None:
                raise ValueError(f"Unknown project: {id}")
            if project.name == DEFAULT_PROJECT_NAME:
                raise ValueError(f"Cannot delete the {DEFAULT_PROJECT_NAME} project")
            await session.delete(project)
        return Query()

    @strawberry.mutation
    async def clear_project(self, info: Info[Context, None], id: GlobalID) -> Query:
        project_id = from_global_id_with_expected_type(global_id=id, expected_type_name="Project")
        delete_statement = delete(models.Trace).where(models.Trace.project_rowid == project_id)
        async with info.context.db() as session:
            await session.execute(delete_statement)
            if cache := info.context.cache_for_dataloaders:
                cache.invalidate(ClearProjectSpansEvent(project_rowid=project_id))
        return Query()


@strawberry.type
class Mutation(DatasetMutation, ProjectMutation, ExportEventsMutation):
    pass


# This is the schema for generating `schema.graphql`.
# See https://strawberry.rocks/docs/guides/schema-export
# It should be kept in sync with the server's runtime-initialized
# instance. To do so, search for the usage of `strawberry.Schema(...)`.
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
)
