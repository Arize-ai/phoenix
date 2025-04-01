from collections.abc import Sequence
from typing import Optional

import strawberry
from sqlalchemy import delete, insert, select
from starlette.requests import Request
from strawberry import UNSET, Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Unauthorized
from phoenix.server.api.input_types.CreateSpanAnnotationInput import CreateSpanAnnotationInput
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation, to_gql_span_annotation
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import SpanAnnotationDeleteEvent, SpanAnnotationInsertEvent


@strawberry.type
class SpanAnnotationMutationPayload:
    span_annotations: list[SpanAnnotation]
    query: Query


@strawberry.type
class SpanAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_span_annotations(
        self, info: Info[Context, None], input: list[CreateSpanAnnotationInput]
    ) -> SpanAnnotationMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
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
                    identifier=annotation.identifier,
                    source=annotation.source.value,
                    user_id=user_id,
                )
                for annotation in input
            ]
            stmt = (
                insert(models.SpanAnnotation).values(values_list).returning(models.SpanAnnotation)
            )
            result = await session.scalars(stmt)
            inserted_annotations = result.all()
        if inserted_annotations:
            info.context.event_queue.put(
                SpanAnnotationInsertEvent(tuple(anno.id for anno in inserted_annotations))
            )
        return SpanAnnotationMutationPayload(
            span_annotations=[
                to_gql_span_annotation(annotation) for annotation in inserted_annotations
            ],
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_span_annotations(
        self, info: Info[Context, None], input: list[PatchAnnotationInput]
    ) -> SpanAnnotationMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        patch_by_id = {}
        for patch in input:
            try:
                span_annotation_id = from_global_id_with_expected_type(
                    patch.annotation_id, SpanAnnotation.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid span annotation ID: {patch.annotation_id}")
            if span_annotation_id in patch_by_id:
                raise BadRequest(f"Duplicate patch for span annotation ID: {span_annotation_id}")
            patch_by_id[span_annotation_id] = patch

        async with info.context.db() as session:
            span_annotations_by_id = {}
            for span_annotation in await session.scalars(
                select(models.SpanAnnotation).where(
                    models.SpanAnnotation.id.in_(patch_by_id.keys())
                )
            ):
                if span_annotation.user_id != user_id:
                    raise Unauthorized(
                        "At least one span annotation is not associated with the current user."
                    )
                span_annotations_by_id[span_annotation.id] = span_annotation
            missing_span_annotation_ids = set(patch_by_id) - set(span_annotations_by_id.keys())
            if missing_span_annotation_ids:
                raise BadRequest(
                    f"Could not find span annotations with IDs: {missing_span_annotation_ids}"
                )
            for span_annotation_id, patch in patch_by_id.items():
                span_annotation = span_annotations_by_id[span_annotation_id]
                if patch.name is not UNSET:
                    span_annotation.name = patch.name
                if patch.annotator_kind is not UNSET:
                    span_annotation.annotator_kind = patch.annotator_kind.value
                if patch.label is not UNSET:
                    span_annotation.label = patch.label
                if patch.score is not UNSET:
                    span_annotation.score = patch.score
                if patch.explanation is not UNSET:
                    span_annotation.explanation = patch.explanation
                if patch.metadata is not UNSET:
                    assert isinstance(patch.metadata, dict)
                    span_annotation.metadata_ = patch.metadata
                if patch.identifier is not UNSET:
                    span_annotation.identifier = patch.identifier
                session.add(span_annotation)
            await session.commit()

        patched_annotations = [
            to_gql_span_annotation(span_annotation)
            for span_annotation in span_annotations_by_id.values()
        ]
        return SpanAnnotationMutationPayload(
            span_annotations=patched_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_span_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> SpanAnnotationMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        user_is_admin = False
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
            user_is_admin = user.is_admin

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

            for annotation in deleted_annotations:
                if annotation.user_id != user_id and not user_is_admin:
                    await session.rollback()
                    raise Unauthorized(
                        "At least one span annotation is not associated with the current user."
                    )

        deleted_annotations_gql = [
            to_gql_span_annotation(annotation) for annotation in deleted_annotations
        ]
        if deleted_annotations:
            info.context.event_queue.put(
                SpanAnnotationDeleteEvent(tuple(anno.id for anno in deleted_annotations))
            )
        return SpanAnnotationMutationPayload(
            span_annotations=deleted_annotations_gql, query=Query()
        )
