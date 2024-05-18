import strawberry

from phoenix.server.api.mutations.dataset_mutations import DatasetMutation
from phoenix.server.api.mutations.project_mutations import ProjectMutation
from phoenix.server.api.query import Query
from phoenix.server.api.types.ExportEventsMutation import ExportEventsMutation


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
