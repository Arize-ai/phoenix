from typing import Optional

import strawberry
from sqlalchemy import delete, insert, select
from starlette.requests import Request
from strawberry import UNSET, Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.helpers.annotations import get_user_identifier
from phoenix.server.api.input_types.CreateDocumentAnnotationInput import (
    CreateDocumentAnnotationInput,
)
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.DocumentAnnotation import DocumentAnnotation
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import DocumentAnnotationDeleteEvent, DocumentAnnotationInsertEvent


@strawberry.type
class DocumentAnnotationMutationPayload:
    document_annotations: list[DocumentAnnotation]
    query: Query


@strawberry.type
class DocumentAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_document_annotations(
        self, info: Info[Context, None], input: list[CreateDocumentAnnotationInput]
    ) -> DocumentAnnotationMutationPayload:
        if not input:
            raise BadRequest("No document annotations provided.")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        processed_annotations_map: dict[int, models.DocumentAnnotation] = {}

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
                resolved_identifier = ""
                if isinstance(annotation_input.identifier, str):
                    resolved_identifier = annotation_input.identifier
                elif annotation_input.source == AnnotationSource.APP and user_id is not None:
                    resolved_identifier = get_user_identifier(user_id)
                values = {
                    "span_rowid": span_rowid,
                    "document_position": annotation_input.document_position,
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

                processed_annotation: Optional[models.DocumentAnnotation] = None

                # Check if an annotation with this span_rowid, name, document_position,
                # and identifier already exists
                q = select(models.DocumentAnnotation).where(
                    models.DocumentAnnotation.span_rowid == span_rowid,
                    models.DocumentAnnotation.name == annotation_input.name,
                    models.DocumentAnnotation.document_position
                    == annotation_input.document_position,
                    models.DocumentAnnotation.identifier == resolved_identifier,
                )
                existing_annotation = await session.scalar(q)

                if existing_annotation:
                    # Update existing annotation
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
                    stmt = insert(models.DocumentAnnotation).values(**values)
                    stmt = stmt.returning(models.DocumentAnnotation)
                    result = await session.scalars(stmt)
                    processed_annotation = result.one()

                processed_annotations_map[idx] = processed_annotation

            # Collect the objects that were inserted or updated
            processed_annotation_objects = list(processed_annotations_map.values())
            processed_annotation_ids = [anno.id for anno in processed_annotation_objects]

            # Commit the transaction to finalize the state in the DB
            await session.flush()

            # Re-fetch the annotations in a batch to get the final state including DB defaults
            final_annotations_result = await session.scalars(
                select(models.DocumentAnnotation).where(
                    models.DocumentAnnotation.id.in_(processed_annotation_ids)
                )
            )
            final_annotations_by_id = {anno.id: anno for anno in final_annotations_result.all()}

            # Order the final annotations according to the input order
            ordered_final_annotations = [
                final_annotations_by_id[id] for id in processed_annotation_ids
            ]

            # Put event on queue *after* successful commit
            if ordered_final_annotations:
                info.context.event_queue.put(
                    DocumentAnnotationInsertEvent(tuple(processed_annotation_ids))
                )

            # Convert the fully loaded annotations to GQL types
            returned_annotations = [
                DocumentAnnotation(id=anno.id, db_record=anno) for anno in ordered_final_annotations
            ]

            await session.commit()

        return DocumentAnnotationMutationPayload(
            document_annotations=returned_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_document_annotations(
        self, info: Info[Context, None], input: list[PatchAnnotationInput]
    ) -> DocumentAnnotationMutationPayload:
        if not input:
            raise BadRequest("No document annotations provided.")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        patch_by_id = {}
        for patch in input:
            try:
                document_annotation_id = from_global_id_with_expected_type(
                    patch.annotation_id, DocumentAnnotation.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid document annotation ID: {patch.annotation_id}")
            if document_annotation_id in patch_by_id:
                raise BadRequest(
                    f"Duplicate patch for document annotation ID: {document_annotation_id}"
                )
            patch_by_id[document_annotation_id] = patch

        async with info.context.db() as session:
            document_annotations_by_id = {}
            for document_annotation in await session.scalars(
                select(models.DocumentAnnotation).where(
                    models.DocumentAnnotation.id.in_(patch_by_id.keys())
                )
            ):
                if document_annotation.user_id != user_id:
                    raise Unauthorized(
                        "At least one document annotation is not associated with the current user."
                    )
                document_annotations_by_id[document_annotation.id] = document_annotation
            missing_document_annotation_ids = set(patch_by_id.keys()) - set(
                document_annotations_by_id.keys()
            )
            if missing_document_annotation_ids:
                raise NotFound(
                    f"Could not find document annotations with IDs: "
                    f"{missing_document_annotation_ids}"
                )
            for document_annotation_id, patch in patch_by_id.items():
                document_annotation = document_annotations_by_id[document_annotation_id]
                if patch.name:
                    document_annotation.name = patch.name
                if patch.annotator_kind:
                    document_annotation.annotator_kind = patch.annotator_kind.value
                if patch.label is not UNSET:
                    document_annotation.label = patch.label
                if patch.score is not UNSET:
                    document_annotation.score = patch.score
                if patch.explanation is not UNSET:
                    document_annotation.explanation = patch.explanation
                if patch.metadata is not UNSET:
                    assert isinstance(patch.metadata, dict)
                    document_annotation.metadata_ = patch.metadata
                if patch.identifier is not UNSET:
                    document_annotation.identifier = patch.identifier or ""
                if patch.source:
                    document_annotation.source = patch.source.value
                session.add(document_annotation)

            patched_annotations = [
                DocumentAnnotation(id=document_annotation.id, db_record=document_annotation)
                for document_annotation in document_annotations_by_id.values()
            ]

        info.context.event_queue.put(
            DocumentAnnotationInsertEvent(tuple(document_annotations_by_id.keys()))
        )
        return DocumentAnnotationMutationPayload(
            document_annotations=patched_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_document_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> DocumentAnnotationMutationPayload:
        if not input.annotation_ids:
            raise BadRequest("No document annotation IDs provided.")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        user_is_admin = False
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
            user_is_admin = user.is_admin

        document_annotation_ids: dict[int, None] = {}  # use a dict to preserve ordering
        for annotation_gid in input.annotation_ids:
            try:
                document_annotation_id = from_global_id_with_expected_type(
                    annotation_gid, DocumentAnnotation.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid document annotation ID: {annotation_gid}")
            if document_annotation_id in document_annotation_ids:
                raise BadRequest(f"Duplicate document annotation ID: {document_annotation_id}")
            document_annotation_ids[document_annotation_id] = None

        async with info.context.db() as session:
            stmt = (
                delete(models.DocumentAnnotation)
                .where(models.DocumentAnnotation.id.in_(document_annotation_ids.keys()))
                .returning(models.DocumentAnnotation)
            )
            result = await session.scalars(stmt)
            deleted_annotations_by_id = {annotation.id: annotation for annotation in result.all()}

            if not user_is_admin and any(
                annotation.user_id != user_id for annotation in deleted_annotations_by_id.values()
            ):
                await session.rollback()
                raise Unauthorized(
                    "At least one document annotation is not associated with the current user."
                )

            missing_document_annotation_ids = set(document_annotation_ids.keys()) - set(
                deleted_annotations_by_id.keys()
            )
            if missing_document_annotation_ids:
                raise NotFound(
                    f"Could not find document annotations with IDs: "
                    f"{missing_document_annotation_ids}"
                )

        deleted_annotations_gql = [
            DocumentAnnotation(
                id=deleted_annotations_by_id[id].id, db_record=deleted_annotations_by_id[id]
            )
            for id in document_annotation_ids
        ]
        info.context.event_queue.put(
            DocumentAnnotationDeleteEvent(tuple(deleted_annotations_by_id.keys()))
        )
        return DocumentAnnotationMutationPayload(
            document_annotations=deleted_annotations_gql, query=Query()
        )
