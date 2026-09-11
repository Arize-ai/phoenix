from typing import Any, Optional, cast

import strawberry
from sqlalchemy import insert, select
from strawberry import UNSET, Info

from phoenix.db import models
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.helpers.annotations import (
    NOTE_NAME,
    get_note_identifier,
    get_user_identifier,
    resolve_span_rowids,
)
from phoenix.server.api.input_types.CreateSpanAnnotationInput import CreateSpanAnnotationInput
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.NoteInputs import CreateSpanNoteInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation
from phoenix.server.dml_event import SpanAnnotationDeleteEvent, SpanAnnotationInsertEvent

CREATE_SPAN_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the createSpanNotes mutation instead."
)
DELETE_SPAN_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the deleteSpanNotes mutation instead."
)


@strawberry.type
class SpanAnnotationMutationPayload:
    span_annotations: list[SpanAnnotation]
    query: Query


@strawberry.type
class SpanAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_span_annotations(
        self, info: Info[Context, None], input: list[CreateSpanAnnotationInput]
    ) -> SpanAnnotationMutationPayload:
        if not input:
            raise BadRequest("No span annotations provided.")

        if any(annotation_input.name == NOTE_NAME for annotation_input in input):
            raise BadRequest(CREATE_SPAN_NOTES_ERROR)

        user_id = info.context.user_id

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
            existing_span_rowids = set(
                await session.scalars(
                    select(models.Span.id).where(models.Span.id.in_(set(span_rowids)))
                )
            )
            missing_span_ids = [
                str(annotation_input.span_id)
                for span_rowid, annotation_input in zip(span_rowids, input)
                if span_rowid not in existing_span_rowids
            ]
            if missing_span_ids:
                raise NotFound(f"Could not find spans with IDs: {missing_span_ids}")

            for idx, (span_rowid, annotation_input) in enumerate(zip(span_rowids, input)):
                resolved_identifier = ""
                if isinstance(annotation_input.identifier, str):
                    resolved_identifier = annotation_input.identifier
                elif annotation_input.source == AnnotationSource.APP and user_id is not None:
                    resolved_identifier = get_user_identifier(user_id)
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
                    models.SpanAnnotation.identifier == resolved_identifier,
                )
                existing_annotation = await session.scalar(q)

                if existing_annotation:
                    existing_annotation.name = annotation_input.name
                    existing_annotation.label = annotation_input.label
                    existing_annotation.score = annotation_input.score
                    existing_annotation.explanation = annotation_input.explanation
                    existing_annotation.metadata_ = cast(dict[str, Any], annotation_input.metadata)
                    existing_annotation.annotator_kind = annotation_input.annotator_kind.value
                    existing_annotation.source = annotation_input.source.value
                    existing_annotation.user_id = user_id
                    session.add(existing_annotation)
                    processed_annotation = existing_annotation

                if processed_annotation is None:
                    stmt = insert(models.SpanAnnotation).values(**values)
                    stmt = stmt.returning(models.SpanAnnotation)
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
                select(models.SpanAnnotation).where(
                    models.SpanAnnotation.id.in_(processed_annotation_ids)
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
                    SpanAnnotationInsertEvent(tuple(processed_annotation_ids))
                )

            # Convert the fully loaded annotations to GQL types
            returned_annotations = [
                SpanAnnotation(id=anno.id, db_record=anno) for anno in ordered_final_annotations
            ]

            await session.commit()

        return SpanAnnotationMutationPayload(
            span_annotations=returned_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_span_notes(
        self, info: Info[Context, None], input: list[CreateSpanNoteInput]
    ) -> SpanAnnotationMutationPayload:
        if not input:
            raise BadRequest("No span notes provided.")

        user_id = info.context.user_id

        refs = [note_input.span.reference for note_input in input]

        async with info.context.db() as session:
            span_rowids = await resolve_span_rowids(session, refs)
            records: list[dict[str, Any]] = [
                {
                    "span_rowid": span_rowid,
                    "name": NOTE_NAME,
                    "label": None,
                    "score": None,
                    "explanation": note_input.note,
                    "annotator_kind": note_input.annotator_kind.value,
                    "metadata_": {},
                    "identifier": (
                        note_input.identifier
                        if isinstance(note_input.identifier, str)
                        else get_note_identifier("px-span-note")
                    ),
                    "source": note_input.source.value,
                    "user_id": user_id,
                }
                for span_rowid, note_input in zip(span_rowids, input)
            ]
            annotations = await session.scalars(
                insert_on_conflict(
                    *records,
                    dialect=info.context.db.dialect,
                    table=models.SpanAnnotation,
                    unique_by=("name", "span_rowid", "identifier"),
                ).returning(models.SpanAnnotation)
            )
            annotations_by_key = {
                (annotation.span_rowid, annotation.identifier): annotation
                for annotation in annotations
            }
            ordered_annotations = [
                annotations_by_key[(record["span_rowid"], record["identifier"])]
                for record in records
            ]

        event_ids = tuple(dict.fromkeys(annotation.id for annotation in ordered_annotations))
        info.context.event_queue.put(SpanAnnotationInsertEvent(event_ids))
        returned_annotations = [
            SpanAnnotation(id=annotation.id, db_record=annotation)
            for annotation in ordered_annotations
        ]
        return SpanAnnotationMutationPayload(
            span_annotations=returned_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_span_annotations(
        self, info: Info[Context, None], input: list[PatchAnnotationInput]
    ) -> SpanAnnotationMutationPayload:
        if not input:
            raise BadRequest("No span annotations provided.")
        if any(patch.name == NOTE_NAME for patch in input):
            raise BadRequest(CREATE_SPAN_NOTES_ERROR)

        user_id = info.context.user_id

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
                if span_annotation.name == NOTE_NAME:
                    raise BadRequest(CREATE_SPAN_NOTES_ERROR)
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
                    span_annotation.identifier = patch.identifier or ""
                if patch.source:
                    span_annotation.source = patch.source.value
                session.add(span_annotation)

            patched_annotations = [
                SpanAnnotation(id=span_annotation.id, db_record=span_annotation)
                for span_annotation in span_annotations_by_id.values()
            ]

        info.context.event_queue.put(
            SpanAnnotationInsertEvent(tuple(span_annotations_by_id.keys()))
        )
        return SpanAnnotationMutationPayload(
            span_annotations=patched_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_span_notes(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> SpanAnnotationMutationPayload:
        if not input.annotation_ids:
            raise BadRequest("No span note IDs provided.")

        annotation_ids: dict[int, None] = {}
        for annotation_gid in input.annotation_ids:
            try:
                annotation_id = from_global_id_with_expected_type(
                    annotation_gid, SpanAnnotation.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid span annotation ID: {annotation_gid}")
            if annotation_id in annotation_ids:
                raise BadRequest(f"Duplicate span annotation ID: {annotation_id}")
            annotation_ids[annotation_id] = None

        user_id = info.context.user_id
        user_is_admin = user_id is not None and info.context.user.is_admin

        async with info.context.db() as session:
            annotations_by_id = {
                annotation.id: annotation
                for annotation in await session.scalars(
                    select(models.SpanAnnotation).where(
                        models.SpanAnnotation.id.in_(annotation_ids)
                    )
                )
            }
            missing_annotation_ids = set(annotation_ids) - set(annotations_by_id)
            if missing_annotation_ids:
                raise NotFound(
                    f"Could not find span annotations with IDs: {missing_annotation_ids}"
                )
            if any(annotation.name != NOTE_NAME for annotation in annotations_by_id.values()):
                raise BadRequest(
                    "At least one span annotation is not a note. "
                    "Use the deleteSpanAnnotations mutation instead."
                )
            if not user_is_admin and any(
                annotation.user_id != user_id for annotation in annotations_by_id.values()
            ):
                raise Unauthorized(
                    "At least one span annotation is not associated with the current user."
                )
            for annotation in annotations_by_id.values():
                await session.delete(annotation)

        deleted_annotations = [
            SpanAnnotation(
                id=annotations_by_id[annotation_id].id,
                db_record=annotations_by_id[annotation_id],
            )
            for annotation_id in annotation_ids
        ]
        info.context.event_queue.put(SpanAnnotationDeleteEvent(tuple(annotation_ids)))
        return SpanAnnotationMutationPayload(
            span_annotations=deleted_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_span_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> SpanAnnotationMutationPayload:
        if not input.annotation_ids:
            raise BadRequest("No span annotation IDs provided.")

        user_id = info.context.user_id
        user_is_admin = user_id is not None and info.context.user.is_admin

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
            deleted_annotations_by_id = {
                annotation.id: annotation
                for annotation in await session.scalars(
                    select(models.SpanAnnotation).where(
                        models.SpanAnnotation.id.in_(span_annotation_ids)
                    )
                )
            }

            missing_span_annotation_ids = set(span_annotation_ids) - set(deleted_annotations_by_id)
            if missing_span_annotation_ids:
                raise NotFound(
                    f"Could not find span annotations with IDs: {missing_span_annotation_ids}"
                )

            if any(
                annotation.name == NOTE_NAME for annotation in deleted_annotations_by_id.values()
            ):
                raise BadRequest(DELETE_SPAN_NOTES_ERROR)

            if not user_is_admin and any(
                annotation.user_id != user_id for annotation in deleted_annotations_by_id.values()
            ):
                raise Unauthorized(
                    "At least one span annotation is not associated with the current user."
                )

            for annotation in deleted_annotations_by_id.values():
                await session.delete(annotation)

        deleted_annotations_gql = [
            SpanAnnotation(
                id=deleted_annotations_by_id[id].id, db_record=deleted_annotations_by_id[id]
            )
            for id in span_annotation_ids
        ]
        info.context.event_queue.put(
            SpanAnnotationDeleteEvent(tuple(deleted_annotations_by_id.keys()))
        )
        return SpanAnnotationMutationPayload(
            span_annotations=deleted_annotations_gql, query=Query()
        )
