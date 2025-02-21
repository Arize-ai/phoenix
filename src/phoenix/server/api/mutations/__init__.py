import strawberry

from phoenix.server.api.mutations.api_key_mutations import ApiKeyMutationMixin
from phoenix.server.api.mutations.chat_mutations import (
    ChatCompletionMutationMixin,
)
from phoenix.server.api.mutations.dataset_mutations import DatasetMutationMixin
from phoenix.server.api.mutations.experiment_mutations import ExperimentMutationMixin
from phoenix.server.api.mutations.export_events_mutations import ExportEventsMutationMixin
from phoenix.server.api.mutations.project_mutations import ProjectMutationMixin
from phoenix.server.api.mutations.prompt_label_mutations import PromptLabelMutationMixin
from phoenix.server.api.mutations.prompt_mutations import PromptMutationMixin
from phoenix.server.api.mutations.prompt_version_tag_mutations import PromptVersionTagMutationMixin
from phoenix.server.api.mutations.span_annotations_mutations import SpanAnnotationMutationMixin
from phoenix.server.api.mutations.trace_annotations_mutations import TraceAnnotationMutationMixin
from phoenix.server.api.mutations.user_mutations import UserMutationMixin


@strawberry.type
class Mutation(
    ApiKeyMutationMixin,
    DatasetMutationMixin,
    ExperimentMutationMixin,
    ExportEventsMutationMixin,
    ProjectMutationMixin,
    PromptMutationMixin,
    PromptVersionTagMutationMixin,
    PromptLabelMutationMixin,
    SpanAnnotationMutationMixin,
    TraceAnnotationMutationMixin,
    UserMutationMixin,
    ChatCompletionMutationMixin,
):
    pass
