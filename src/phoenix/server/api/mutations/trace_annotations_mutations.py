from typing import List, Sequence

import strawberry
from sqlalchemy import delete, insert, update
from strawberry import UNSET
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.CreateTraceAnnotationInput import CreateTraceAnnotationInput
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.mutations.auth import IsAuthenticated
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation, to_gql_trace_annotation
from phoenix.server.dml_event import TraceAnnotationDeleteEvent, TraceAnnotationInsertEvent


@strawberry.type
class TraceAnnotationMutationPayload:
    trace_annotations: List[TraceAnnotation]
    query: Query


@strawberry.type
class TraceAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def create_trace_annotations(
        self, info: Info[Context, None], input: List[CreateTraceAnnotationInput]
    ) -> TraceAnnotationMutationPayload:
        inserted_annotations: Sequence[models.TraceAnnotation] = []
        async with info.context.db() as session:
            values_list = [
                dict(
                    trace_rowid=from_global_id_with_expected_type(annotation.trace_id, "Trace"),
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
                insert(models.TraceAnnotation).values(values_list).returning(models.TraceAnnotation)
            )
            result = await session.scalars(stmt)
            inserted_annotations = result.all()
        if inserted_annotations:
            info.context.event_queue.put(
                TraceAnnotationInsertEvent(tuple(anno.id for anno in inserted_annotations))
            )
        return TraceAnnotationMutationPayload(
            trace_annotations=[
                to_gql_trace_annotation(annotation) for annotation in inserted_annotations
            ],
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def patch_trace_annotations(
        self, info: Info[Context, None], input: List[PatchAnnotationInput]
    ) -> TraceAnnotationMutationPayload:
        patched_annotations = []
        async with info.context.db() as session:
            for annotation in input:
                trace_annotation_id = from_global_id_with_expected_type(
                    annotation.annotation_id, "TraceAnnotation"
                )
                patch = {
                    column.key: patch_value
                    for column, patch_value, column_is_nullable in (
                        (models.TraceAnnotation.name, annotation.name, False),
                        (
                            models.TraceAnnotation.annotator_kind,
                            annotation.annotator_kind.value
                            if annotation.annotator_kind is not None
                            else None,
                            False,
                        ),
                        (models.TraceAnnotation.label, annotation.label, True),
                        (models.TraceAnnotation.score, annotation.score, True),
                        (models.TraceAnnotation.explanation, annotation.explanation, True),
                        (models.TraceAnnotation.metadata_, annotation.metadata, False),
                    )
                    if patch_value is not UNSET and (patch_value is not None or column_is_nullable)
                }
                trace_annotation = await session.scalar(
                    update(models.TraceAnnotation)
                    .where(models.TraceAnnotation.id == trace_annotation_id)
                    .values(**patch)
                    .returning(models.TraceAnnotation)
                )
                if trace_annotation:
                    patched_annotations.append(to_gql_trace_annotation(trace_annotation))
                    info.context.event_queue.put(TraceAnnotationInsertEvent((trace_annotation.id,)))
        return TraceAnnotationMutationPayload(trace_annotations=patched_annotations, query=Query())

    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def delete_trace_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> TraceAnnotationMutationPayload:
        trace_annotation_ids = [
            from_global_id_with_expected_type(global_id, "TraceAnnotation")
            for global_id in input.annotation_ids
        ]
        async with info.context.db() as session:
            stmt = (
                delete(models.TraceAnnotation)
                .where(models.TraceAnnotation.id.in_(trace_annotation_ids))
                .returning(models.TraceAnnotation)
            )
            result = await session.scalars(stmt)
            deleted_annotations = result.all()

            deleted_annotations_gql = [
                to_gql_trace_annotation(annotation) for annotation in deleted_annotations
            ]
        if deleted_annotations:
            info.context.event_queue.put(
                TraceAnnotationDeleteEvent(tuple(anno.id for anno in deleted_annotations))
            )
        return TraceAnnotationMutationPayload(
            trace_annotations=deleted_annotations_gql, query=Query()
        )
