from typing import Optional

import strawberry
from sqlalchemy import delete, insert, select
from starlette.requests import Request
from strawberry import UNSET, Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.input_types.CreateSpanAnnotationInput import CreateSpanAnnotationInput
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationSource import AnnotationSource
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
        if not input:
            raise BadRequest("No span annotations provided.")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        processed_annotations_map: dict[int, models.SpanAnnotation] = {}

        span_rowids = []
        for idx, annotation_input in enumerate(input):
            try:
                span_rowid = from_global_id_with_expected_type(annotation_input.span_id, "Span")
            except ValueError:
                raise BadRequest(
                    f"Invalid span ID for annotation at index {idx}: {annotation_input.span_id}"
                )
            span_rowids.append(span_rowid)

        async with info.context.db() as session:
            for idx, (span_rowid, annotation_input) in enumerate(zip(span_rowids, input)):
                resolved_identifier = annotation_input.identifier
                if annotation_input.source == AnnotationSource.APP:
                    # Ensure that the annotation has a per-user identifier if submitted via the UI
                    if user_id is not None:
                        username = await session.scalar(
                            select(models.User.username).where(models.User.id == user_id)
                        )
                        resolved_identifier = f"px-app:{username}"
                    else:
                        resolved_identifier = "px-app"
                values = {
                    "span_rowid": span_rowid,
                    "name": annotation_input.name,
                    "label": annotation_input.label,
                    "score": annotation_input.score,
                    "explanation": annotation_input.explanation,
                    "annotator_kind": annotation_input.annotator_kind.value,
                    "metadata_": annotation_input.metadata,
                    "identifier": resolved_identifier,
                    "source": annotation_input.source.value,
                    "user_id": user_id,
                }

                processed_annotation: Optional[models.SpanAnnotation] = None

                q = select(models.SpanAnnotation).where(
                    models.SpanAnnotation.span_rowid == span_rowid,
                    models.SpanAnnotation.name == annotation_input.name,
                )
                if resolved_identifier is None:
                    q = q.where(models.SpanAnnotation.identifier.is_(None))
                else:
                    q = q.where(models.SpanAnnotation.identifier == resolved_identifier)

                existing_annotation = await session.scalar(q)

                if existing_annotation:
                    existing_annotation.name = values["name"]
                    existing_annotation.label = values["label"]
                    existing_annotation.score = values["score"]
                    existing_annotation.explanation = values["explanation"]
                    existing_annotation.metadata_ = values["metadata_"]
                    existing_annotation.annotator_kind = values["annotator_kind"]
                    existing_annotation.source = values["source"]
                    existing_annotation.user_id = values["user_id"]
                    session.add(existing_annotation)
                    processed_annotation = existing_annotation

                if processed_annotation is None:
                    stmt = insert(models.SpanAnnotation).values(**values)
                    stmt = stmt.returning(models.SpanAnnotation)
                    result = await session.scalars(stmt)
                    processed_annotation = result.one()

                processed_annotations_map[idx] = processed_annotation

            inserted_annotation_ids = tuple(anno.id for anno in processed_annotations_map.values())
            if inserted_annotation_ids:
                info.context.event_queue.put(SpanAnnotationInsertEvent(inserted_annotation_ids))

            returned_annotations = [
                to_gql_span_annotation(processed_annotations_map[i])
                for i in sorted(processed_annotations_map.keys())
            ]
            await session.commit()
        return SpanAnnotationMutationPayload(
            span_annotations=returned_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_span_annotations(
        self, info: Info[Context, None], input: list[PatchAnnotationInput]
    ) -> SpanAnnotationMutationPayload:
        if not input:
            raise BadRequest("No span annotations provided.")

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
            missing_span_annotation_ids = set(patch_by_id.keys()) - set(
                span_annotations_by_id.keys()
            )
            if missing_span_annotation_ids:
                raise NotFound(
                    f"Could not find span annotations with IDs: {missing_span_annotation_ids}"
                )
            for span_annotation_id, patch in patch_by_id.items():
                span_annotation = span_annotations_by_id[span_annotation_id]
                if patch.name:
                    span_annotation.name = patch.name
                if patch.annotator_kind:
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

            patched_annotations = [
                to_gql_span_annotation(span_annotation)
                for span_annotation in span_annotations_by_id.values()
            ]

        info.context.event_queue.put(
            SpanAnnotationInsertEvent(tuple(span_annotations_by_id.keys()))
        )
        return SpanAnnotationMutationPayload(
            span_annotations=patched_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_span_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> SpanAnnotationMutationPayload:
        if not input.annotation_ids:
            raise BadRequest("No span annotation IDs provided.")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        user_is_admin = False
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
            user_is_admin = user.is_admin

        span_annotation_ids: dict[int, None] = {}  # use a dict to preserve ordering
        for annotation_gid in input.annotation_ids:
            try:
                span_annotation_id = from_global_id_with_expected_type(
                    annotation_gid, SpanAnnotation.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid span annotation ID: {annotation_gid}")
            if span_annotation_id in span_annotation_ids:
                raise BadRequest(f"Duplicate span annotation ID: {span_annotation_id}")
            span_annotation_ids[span_annotation_id] = None

        async with info.context.db() as session:
            stmt = (
                delete(models.SpanAnnotation)
                .where(models.SpanAnnotation.id.in_(span_annotation_ids.keys()))
                .returning(models.SpanAnnotation)
            )
            result = await session.scalars(stmt)
            deleted_annotations_by_id = {annotation.id: annotation for annotation in result.all()}

            if not user_is_admin and any(
                annotation.user_id != user_id for annotation in deleted_annotations_by_id.values()
            ):
                await session.rollback()
                raise Unauthorized(
                    "At least one span annotation is not associated with the current user."
                )

            missing_span_annotation_ids = set(span_annotation_ids.keys()) - set(
                deleted_annotations_by_id.keys()
            )
            if missing_span_annotation_ids:
                raise NotFound(
                    f"Could not find span annotations with IDs: {missing_span_annotation_ids}"
                )

        deleted_annotations_gql = [
            to_gql_span_annotation(deleted_annotations_by_id[id]) for id in span_annotation_ids
        ]
        info.context.event_queue.put(
            SpanAnnotationDeleteEvent(tuple(deleted_annotations_by_id.keys()))
        )
        return SpanAnnotationMutationPayload(
            span_annotations=deleted_annotations_gql, query=Query()
        )
