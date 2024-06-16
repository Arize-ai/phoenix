import strawberry

from phoenix.server.api.mutations.dataset_mutations import DatasetMutationMixin
from phoenix.server.api.mutations.experiment_mutations import ExperimentMutationMixin
from phoenix.server.api.mutations.export_events_mutations import ExportEventsMutationMixin
from phoenix.server.api.mutations.project_mutations import ProjectMutationMixin


@strawberry.type
class Mutation(
    ProjectMutationMixin, DatasetMutationMixin, ExperimentMutationMixin, ExportEventsMutationMixin
):
    pass
