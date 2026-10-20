import strawberry
from strawberry.types import Info

from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.helpers.evaluator_preview import stream_evaluator_preview
from phoenix.server.api.input_types.EvaluatorDefinitionInput import EvaluatorPreviewInput
from phoenix.server.api.types.EvaluatorPreviewSubjectResult import EvaluatorPreviewSubjectResult


@strawberry.type
class EvaluatorPreviewPayload:
    results: list[EvaluatorPreviewSubjectResult] = strawberry.field(
        description="One result per subject, in the order the subjects were sent."
    )


@strawberry.type
class EvaluatorPreviewMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "The evaluatorPreview subscription for callers that cannot read a stream, "
            "such as scripts: it runs the same preview and returns once every subject "
            "has reported."
        ),
    )  # type: ignore
    async def preview_evaluator(
        self, info: Info[Context, None], input: EvaluatorPreviewInput
    ) -> EvaluatorPreviewPayload:
        by_id = {
            result.id: result async for result in stream_evaluator_preview(info.context, input)
        }
        return EvaluatorPreviewPayload(results=[by_id[subject.id] for subject in input.subjects])
