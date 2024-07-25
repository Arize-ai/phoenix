from typing import List, Sequence

import strawberry
from sqlalchemy import delete, insert, update
from strawberry import UNSET
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.CreateSpanAnnotationInput import CreateSpanAnnotationInput
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.mutations.auth import IsAuthenticated
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation, to_gql_span_annotation


@strawberry.type
class SpanAnnotationMutationPayload:
    span_annotations: List[SpanAnnotation]
    query: Query


@strawberry.type
class SpanAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def create_span_annotations(
        self, info: Info[Context, None], input: List[CreateSpanAnnotationInput]
    ) -> SpanAnnotationMutationPayload:
        inserted_annotations: Sequence[models.SpanAnnotation] = []
        async with info.context.db() as session:
            values_list = [
                dict(
                    span_rowid=from_global_id_with_expected_type(annotation.span_id, "Span"),
                    name=annotation.name,
                    label=annotation.label,
                    score=annotation.score,
                    explanation=annotation.explanation,
                    annotator_kind=annotation.annotator_kind.value,
                    metadata_=annotation.metadata,
                )
                for annotation in input
            ]
            stmt = (
                insert(models.SpanAnnotation).values(values_list).returning(models.SpanAnnotation)
            )
            result = await session.scalars(stmt)
            inserted_annotations = result.all()

        return SpanAnnotationMutationPayload(
            span_annotations=[
                to_gql_span_annotation(annotation) for annotation in inserted_annotations
            ],
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def patch_span_annotations(
        self, info: Info[Context, None], input: List[PatchAnnotationInput]
    ) -> SpanAnnotationMutationPayload:
        patched_annotations = []
        async with info.context.db() as session:
            for annotation in input:
                span_annotation_id = from_global_id_with_expected_type(
                    annotation.annotation_id, "SpanAnnotation"
                )
                patch = {
                    column.key: patch_value
                    for column, patch_value, column_is_nullable in (
                        (models.SpanAnnotation.name, annotation.name, False),
                        (
                            models.SpanAnnotation.annotator_kind,
                            annotation.annotator_kind.value
                            if annotation.annotator_kind is not None
                            else None,
                            False,
                        ),
                        (models.SpanAnnotation.label, annotation.label, True),
                        (models.SpanAnnotation.score, annotation.score, True),
                        (models.SpanAnnotation.explanation, annotation.explanation, True),
                        (models.SpanAnnotation.metadata_, annotation.metadata, False),
                    )
                    if patch_value is not UNSET and (patch_value is not None or column_is_nullable)
                }
                span_annotation = await session.scalar(
                    update(models.SpanAnnotation)
                    .where(models.SpanAnnotation.id == span_annotation_id)
                    .values(**patch)
                    .returning(models.SpanAnnotation)
                )
                if span_annotation is not None:
                    patched_annotations.append(to_gql_span_annotation(span_annotation))

        return SpanAnnotationMutationPayload(span_annotations=patched_annotations, query=Query())

    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def delete_span_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> SpanAnnotationMutationPayload:
        span_annotation_ids = [
            from_global_id_with_expected_type(global_id, "SpanAnnotation")
            for global_id in input.annotation_ids
        ]
        async with info.context.db() as session:
            stmt = (
                delete(models.SpanAnnotation)
                .where(models.SpanAnnotation.id.in_(span_annotation_ids))
                .returning(models.SpanAnnotation)
            )
            result = await session.scalars(stmt)
            deleted_annotations = result.all()

            deleted_annotations_gql = [
                to_gql_span_annotation(annotation) for annotation in deleted_annotations
            ]
        return SpanAnnotationMutationPayload(
            span_annotations=deleted_annotations_gql, query=Query()
        )
