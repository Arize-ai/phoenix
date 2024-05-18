import strawberry

from phoenix.server.api.mutations.dataset_mutations import DatasetMutation
from phoenix.server.api.mutations.export_events_mutations import ExportEventsMutation
from phoenix.server.api.mutations.project_mutations import ProjectMutation


@strawberry.type
class Mutation(DatasetMutation, ProjectMutation, ExportEventsMutation):
    pass
