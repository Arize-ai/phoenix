from typing import Optional, cast

import strawberry
from sqlalchemy import delete, select, tuple_
from starlette.requests import Request
from strawberry import UNSET, Info

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
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

        if not isinstance(request := info.context.request, Request):
            raise BadRequest("Invalid request context.")
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        # Parse input and build records
        records: list[dict[str, object]] = []
        span_rowids: set[int] = set()
        for idx, annotation_input in enumerate(input):
            try:
                span_rowid = from_global_id_with_expected_type(annotation_input.span_id, "Span")
            except ValueError:
                raise BadRequest(
                    f"Invalid span ID for annotation at index {idx}: {annotation_input.span_id}"
                )
            span_rowids.add(span_rowid)

            resolved_identifier = ""
            if isinstance(annotation_input.identifier, str):
                resolved_identifier = annotation_input.identifier
            elif annotation_input.source == AnnotationSource.APP and user_id is not None:
                resolved_identifier = get_user_identifier(user_id)

            records.append(
                {
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
            )

        async with info.context.db() as session:
            # Fetch spans and validate document positions
            num_docs_by_span: dict[int, int] = {
                rowid: num_docs
                async for rowid, num_docs in await session.stream(
                    select(models.Span.id, models.Span.num_documents).where(
                        models.Span.id.in_(span_rowids)
                    )
                )
            }

            missing = span_rowids - set(num_docs_by_span.keys())
            if missing:
                raise NotFound(f"Spans with row IDs {missing} do not exist.")

            for idx, record in enumerate(records):
                span_rowid = cast(int, record["span_rowid"])
                doc_pos = cast(int, record["document_position"])
                num_docs = num_docs_by_span[span_rowid]
                if doc_pos not in range(num_docs):
                    raise BadRequest(
                        f"Document position {doc_pos} is out of bounds "
                        f"for span at index {idx} (num_documents: {num_docs})"
                    )

            # Check for existing annotations owned by other users
            unique_keys = [
                (r["name"], r["span_rowid"], r["document_position"], r["identifier"])
                for r in records
            ]
            existing_user_ids = (
                await session.scalars(
                    select(models.DocumentAnnotation.user_id)
                    .where(
                        tuple_(
                            models.DocumentAnnotation.name,
                            models.DocumentAnnotation.span_rowid,
                            models.DocumentAnnotation.document_position,
                            models.DocumentAnnotation.identifier,
                        ).in_(unique_keys)
                    )
                    .distinct()
                )
            ).all()
            for existing_user_id in existing_user_ids:
                if existing_user_id != user_id:
                    raise Unauthorized(
                        "Cannot overwrite document annotation owned by another user."
                    )

            dialect = SupportedSQLDialect(session.bind.dialect.name)
            stmt = insert_on_conflict(
                *records,
                dialect=dialect,
                table=models.DocumentAnnotation,
                unique_by=("name", "span_rowid", "document_position", "identifier"),
                on_conflict=OnConflict.DO_UPDATE,
                constraint_name="uq_document_annotations_name_span_rowid_document_pos_identifier",
            ).returning(models.DocumentAnnotation)

            result = await session.scalars(stmt)
            annotations = result.all()

        # Publish event after successful commit (context manager auto-commits)
        annotation_ids = tuple(anno.id for anno in annotations)
        if annotation_ids:
            info.context.event_queue.put(DocumentAnnotationInsertEvent(annotation_ids))

        return DocumentAnnotationMutationPayload(
            document_annotations=[
                DocumentAnnotation(id=anno.id, db_record=anno) for anno in annotations
            ],
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_document_annotations(
        self, info: Info[Context, None], input: list[PatchAnnotationInput]
    ) -> DocumentAnnotationMutationPayload:
        if not input:
            raise BadRequest("No document annotations provided.")

        if not isinstance(request := info.context.request, Request):
            raise BadRequest("Invalid request context.")
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        patch_by_id: dict[int, PatchAnnotationInput] = {}
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
            document_annotations_by_id: dict[int, models.DocumentAnnotation] = {}
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

            missing_ids = set(patch_by_id.keys()) - set(document_annotations_by_id.keys())
            if missing_ids:
                raise NotFound(f"Could not find document annotations with IDs: {missing_ids}")

            for document_annotation_id, patch in patch_by_id.items():
                document_annotation = document_annotations_by_id[document_annotation_id]
                if patch.name and (name := patch.name.strip()):
                    document_annotation.name = name
                if patch.annotator_kind:
                    document_annotation.annotator_kind = patch.annotator_kind.value
                if patch.label is not UNSET:
                    document_annotation.label = patch.label.strip() if patch.label else patch.label
                if patch.score is not UNSET:
                    document_annotation.score = patch.score
                if patch.explanation is not UNSET:
                    document_annotation.explanation = (
                        patch.explanation.strip() if patch.explanation else patch.explanation
                    )
                if patch.metadata is not UNSET:
                    if not isinstance(patch.metadata, dict):
                        raise BadRequest("metadata must be a dict")
                    document_annotation.metadata_ = patch.metadata
                if patch.identifier is not UNSET:
                    document_annotation.identifier = (patch.identifier or "").strip()
                if patch.source:
                    document_annotation.source = patch.source.value

            patched_annotations = [
                DocumentAnnotation(id=anno.id, db_record=anno)
                for anno in document_annotations_by_id.values()
            ]

        # Publish event after successful commit (context manager auto-commits)
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

        if not isinstance(request := info.context.request, Request):
            raise BadRequest("Invalid request context.")
        user_id: Optional[int] = None
        user_is_admin = False
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
            user_is_admin = user.is_admin

        # Parse and deduplicate IDs while preserving order
        annotation_ids: list[int] = []
        seen_ids: set[int] = set()
        for annotation_gid in input.annotation_ids:
            try:
                annotation_id = from_global_id_with_expected_type(
                    annotation_gid, DocumentAnnotation.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid document annotation ID: {annotation_gid}")
            if annotation_id in seen_ids:
                raise BadRequest(f"Duplicate document annotation ID: {annotation_id}")
            seen_ids.add(annotation_id)
            annotation_ids.append(annotation_id)

        async with info.context.db() as session:
            # Fetch annotations first to check authorization
            annotations_by_id: dict[int, models.DocumentAnnotation] = {
                anno.id: anno
                for anno in await session.scalars(
                    select(models.DocumentAnnotation).where(
                        models.DocumentAnnotation.id.in_(annotation_ids)
                    )
                )
            }

            # Check for missing annotations
            missing_ids = set(annotation_ids) - set(annotations_by_id.keys())
            if missing_ids:
                raise NotFound(f"Could not find document annotations with IDs: {missing_ids}")

            # Check authorization before deleting
            if not user_is_admin:
                unauthorized_ids = [
                    aid for aid, anno in annotations_by_id.items() if anno.user_id != user_id
                ]
                if unauthorized_ids:
                    raise Unauthorized(
                        "At least one document annotation is not associated with the current user."
                    )

            # Now delete
            await session.execute(
                delete(models.DocumentAnnotation).where(
                    models.DocumentAnnotation.id.in_(annotation_ids)
                )
            )

        # Publish event after successful commit (context manager auto-commits)
        info.context.event_queue.put(DocumentAnnotationDeleteEvent(tuple(annotation_ids)))

        # Return annotations in original order
        return DocumentAnnotationMutationPayload(
            document_annotations=[
                DocumentAnnotation(id=annotations_by_id[aid].id, db_record=annotations_by_id[aid])
                for aid in annotation_ids
            ],
            query=Query(),
        )
