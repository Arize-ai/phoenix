import strawberry

from phoenix.server.api.mutations.dataset_mutations import DatasetMutation
from phoenix.server.api.mutations.project_mutations import ProjectMutation
from phoenix.server.api.types.ExportEventsMutation import ExportEventsMutation


@strawberry.type
class Mutation(DatasetMutation, ProjectMutation, ExportEventsMutation):
    pass
