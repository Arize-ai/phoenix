from typing import Optional

import strawberry
from sqlalchemy import delete, insert, select
from sqlalchemy.dialects import postgresql, sqlite
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

        processed_annotations: dict[int, models.SpanAnnotation] = {}

        async with info.context.db() as session:
            dialect_name = session.bind.dialect.name  # type: ignore

            for idx, annotation_input in enumerate(input):
                try:
                    span_rowid = from_global_id_with_expected_type(annotation_input.span_id, "Span")
                except ValueError:
                    raise BadRequest(
                        f"Invalid span ID for annotation at index {idx}: {annotation_input.span_id}"
                    )

                values = {
                    "span_rowid": span_rowid,
                    "name": annotation_input.name,
                    "label": annotation_input.label,
                    "score": annotation_input.score,
                    "explanation": annotation_input.explanation,
                    "annotator_kind": annotation_input.annotator_kind.value,
                    "metadata_": annotation_input.metadata,
                    "identifier": annotation_input.identifier,
                    "source": annotation_input.source.value,
                    "user_id": user_id,
                }

                stmt = insert(models.SpanAnnotation).values(**values)

                if values.get("identifier") is not None:
                    update_fields = {
                        "name": stmt.excluded.name,
                        "label": stmt.excluded.label,
                        "score": stmt.excluded.score,
                        "explanation": stmt.excluded.explanation,
                        "metadata_": stmt.excluded.metadata_,
                        "annotator_kind": stmt.excluded.annotator_kind,
                        "source": stmt.excluded.source,
                        "user_id": stmt.excluded.user_id,
                    }
                    if dialect_name == "postgresql":
                        pg_stmt = postgresql.insert(models.SpanAnnotation).values(**values)
                        stmt = pg_stmt.on_conflict_do_update(
                            constraint="uq_span_annotation_identifier_per_span", set_=update_fields
                        ).returning(models.SpanAnnotation)
                    elif dialect_name == "sqlite":
                        sqlite_stmt = sqlite.insert(models.SpanAnnotation).values(**values)
                        stmt = sqlite_stmt.on_conflict_do_update(
                            index_elements=["span_rowid", "identifier"],
                            index_where=models.SpanAnnotation.identifier.isnot(None),
                            set_=update_fields,
                        ).returning(models.SpanAnnotation)
                    else:
                        pass
                else:
                    stmt = stmt.returning(models.SpanAnnotation)

                result = await session.scalars(stmt)
                processed_annotation = result.one()
                processed_annotations[idx] = processed_annotation

        inserted_annotation_ids = tuple(anno.id for anno in processed_annotations.values())
        if inserted_annotation_ids:
            info.context.event_queue.put(SpanAnnotationInsertEvent(inserted_annotation_ids))

        returned_annotations = [
            to_gql_span_annotation(processed_annotations[i])
            for i in sorted(processed_annotations.keys())
        ]

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
            await session.commit()

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
