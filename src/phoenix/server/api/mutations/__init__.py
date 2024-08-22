import strawberry

from phoenix.server.api.mutations.api_key_mutations import ApiKeyMutationMixin
from phoenix.server.api.mutations.auth_mutations import AuthMutationMixin
from phoenix.server.api.mutations.dataset_mutations import DatasetMutationMixin
from phoenix.server.api.mutations.experiment_mutations import ExperimentMutationMixin
from phoenix.server.api.mutations.export_events_mutations import ExportEventsMutationMixin
from phoenix.server.api.mutations.project_mutations import ProjectMutationMixin
from phoenix.server.api.mutations.span_annotations_mutations import SpanAnnotationMutationMixin
from phoenix.server.api.mutations.trace_annotations_mutations import TraceAnnotationMutationMixin
from phoenix.server.api.mutations.user_mutations import UserMutationMixin


@strawberry.type
class Mutation(
    ApiKeyMutationMixin,
    AuthMutationMixin,
    DatasetMutationMixin,
    ExperimentMutationMixin,
    ExportEventsMutationMixin,
    ProjectMutationMixin,
    SpanAnnotationMutationMixin,
    TraceAnnotationMutationMixin,
    UserMutationMixin,
):
    pass
