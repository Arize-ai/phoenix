from typing import Any, cast

import strawberry
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import Info
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound, Unauthorized
from phoenix.server.api.helpers.annotations import (
    NOTE_NAME,
    get_note_identifier,
    get_user_identifier,
    resolve_project_session_rowids,
)
from phoenix.server.api.input_types.CreateProjectSessionAnnotationInput import (
    CreateProjectSessionAnnotationInput,
)
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.NoteInputs import CreateProjectSessionNoteInput
from phoenix.server.api.input_types.UpdateAnnotationInput import UpdateAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.ProjectSessionAnnotation import ProjectSessionAnnotation
from phoenix.server.dml_event import (
    ProjectSessionAnnotationDeleteEvent,
    ProjectSessionAnnotationInsertEvent,
)

CREATE_PROJECT_SESSION_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the createProjectSessionNotes mutation instead."
)
DELETE_PROJECT_SESSION_NOTES_ERROR = (
    "The name 'note' is reserved for notes. Use the deleteProjectSessionNotes mutation instead."
)


@strawberry.type
class ProjectSessionAnnotationMutationPayload:
    project_session_annotation: ProjectSessionAnnotation
    query: Query


@strawberry.type
class ProjectSessionAnnotationsMutationPayload:
    project_session_annotations: list[ProjectSessionAnnotation]
    query: Query


@strawberry.type
class ProjectSessionAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_project_session_annotations(
        self, info: Info[Context, None], input: CreateProjectSessionAnnotationInput
    ) -> ProjectSessionAnnotationMutationPayload:
        if input.name == NOTE_NAME:
            raise BadRequest(CREATE_PROJECT_SESSION_NOTES_ERROR)

        user_id = info.context.user_id

        try:
            project_session_id = from_global_id_with_expected_type(
                input.project_session_id, "ProjectSession"
            )
        except ValueError:
            raise BadRequest(f"Invalid session ID: {input.project_session_id}")

        identifier = ""
        if isinstance(input.identifier, str):
            identifier = input.identifier  # Already trimmed in __post_init__
        elif input.source == AnnotationSource.APP and user_id is not None:
            identifier = get_user_identifier(user_id)

        try:
            async with info.context.db() as session:
                anno = models.ProjectSessionAnnotation(
                    project_session_id=project_session_id,
                    name=input.name,
                    label=input.label,
                    score=input.score,
                    explanation=input.explanation,
                    annotator_kind=input.annotator_kind.value,
                    metadata_=input.metadata,
                    identifier=identifier,
                    source=input.source.value,
                    user_id=user_id,
                )
                session.add(anno)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            raise Conflict(f"Error creating annotation: {e}")

        info.context.event_queue.put(ProjectSessionAnnotationInsertEvent((anno.id,)))

        return ProjectSessionAnnotationMutationPayload(
            project_session_annotation=ProjectSessionAnnotation(id=anno.id, db_record=anno),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_project_session_notes(
        self, info: Info[Context, None], input: list[CreateProjectSessionNoteInput]
    ) -> ProjectSessionAnnotationsMutationPayload:
        if not input:
            raise BadRequest("No project session notes provided.")

        user_id = info.context.user_id

        async with info.context.db() as session:
            project_session_rowids = await resolve_project_session_rowids(
                session, [note_input.session.reference for note_input in input]
            )
            records: list[dict[str, Any]] = [
                {
                    "project_session_id": project_session_rowid,
                    "name": NOTE_NAME,
                    "label": None,
                    "score": None,
                    "explanation": note_input.note,
                    "annotator_kind": note_input.annotator_kind.value,
                    "metadata_": {},
                    "identifier": (
                        note_input.identifier
                        if isinstance(note_input.identifier, str)
                        else get_note_identifier("px-session-note")
                    ),
                    "source": note_input.source.value,
                    "user_id": user_id,
                }
                for project_session_rowid, note_input in zip(project_session_rowids, input)
            ]
            annotations = await session.scalars(
                insert_on_conflict(
                    *records,
                    dialect=info.context.db.dialect,
                    table=models.ProjectSessionAnnotation,
                    unique_by=("name", "project_session_id", "identifier"),
                ).returning(models.ProjectSessionAnnotation)
            )
            annotations_by_key = {
                (annotation.project_session_id, annotation.identifier): annotation
                for annotation in annotations
            }
            ordered_annotations = [
                annotations_by_key[(record["project_session_id"], record["identifier"])]
                for record in records
            ]

        event_ids = tuple(dict.fromkeys(annotation.id for annotation in ordered_annotations))
        info.context.event_queue.put(ProjectSessionAnnotationInsertEvent(event_ids))
        returned_annotations = [
            ProjectSessionAnnotation(id=annotation.id, db_record=annotation)
            for annotation in ordered_annotations
        ]
        return ProjectSessionAnnotationsMutationPayload(
            project_session_annotations=returned_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_project_session_annotations(
        self, info: Info[Context, None], input: UpdateAnnotationInput
    ) -> ProjectSessionAnnotationMutationPayload:
        if input.name == NOTE_NAME:
            raise BadRequest(CREATE_PROJECT_SESSION_NOTES_ERROR)

        user_id = info.context.user_id

        try:
            id_ = from_global_id_with_expected_type(input.id, "ProjectSessionAnnotation")
        except ValueError:
            raise BadRequest(f"Invalid session annotation ID: {input.id}")

        async with info.context.db() as session:
            if not (anno := await session.get(models.ProjectSessionAnnotation, id_)):
                raise NotFound(f"Could not find session annotation with ID: {input.id}")
            if anno.name == NOTE_NAME:
                raise BadRequest(CREATE_PROJECT_SESSION_NOTES_ERROR)
            if anno.user_id != user_id:
                raise Unauthorized("Session annotation is not associated with the current user.")

            # Update the annotation fields
            anno.name = input.name
            anno.label = input.label
            anno.score = input.score
            anno.explanation = input.explanation
            anno.annotator_kind = input.annotator_kind.value
            anno.metadata_ = cast(dict[str, Any], input.metadata)
            anno.source = input.source.value

            session.add(anno)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                raise Conflict(f"Error updating annotation: {e}")

        info.context.event_queue.put(ProjectSessionAnnotationInsertEvent((anno.id,)))
        return ProjectSessionAnnotationMutationPayload(
            project_session_annotation=ProjectSessionAnnotation(id=anno.id, db_record=anno),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_project_session_notes(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> ProjectSessionAnnotationsMutationPayload:
        if not input.annotation_ids:
            raise BadRequest("No project session note IDs provided.")

        annotation_ids: dict[int, None] = {}
        for annotation_gid in input.annotation_ids:
            try:
                annotation_id = from_global_id_with_expected_type(
                    annotation_gid, ProjectSessionAnnotation.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid session annotation ID: {annotation_gid}")
            if annotation_id in annotation_ids:
                raise BadRequest(f"Duplicate session annotation ID: {annotation_id}")
            annotation_ids[annotation_id] = None

        user_id = info.context.user_id
        user_is_admin = user_id is not None and info.context.user.is_admin

        async with info.context.db() as session:
            annotations_by_id = {
                annotation.id: annotation
                for annotation in await session.scalars(
                    select(models.ProjectSessionAnnotation).where(
                        models.ProjectSessionAnnotation.id.in_(annotation_ids)
                    )
                )
            }
            missing_annotation_ids = set(annotation_ids) - set(annotations_by_id)
            if missing_annotation_ids:
                raise NotFound(
                    f"Could not find session annotations with IDs: {missing_annotation_ids}"
                )
            if any(annotation.name != NOTE_NAME for annotation in annotations_by_id.values()):
                raise BadRequest(
                    "At least one session annotation is not a note. "
                    "Use the deleteProjectSessionAnnotation mutation instead."
                )
            if not user_is_admin and any(
                annotation.user_id != user_id for annotation in annotations_by_id.values()
            ):
                raise Unauthorized(
                    "At least one session annotation is not associated with the current user "
                    "and the current user is not an admin."
                )
            for annotation in annotations_by_id.values():
                await session.delete(annotation)

        deleted_annotations = [
            ProjectSessionAnnotation(
                id=annotations_by_id[annotation_id].id,
                db_record=annotations_by_id[annotation_id],
            )
            for annotation_id in annotation_ids
        ]
        info.context.event_queue.put(ProjectSessionAnnotationDeleteEvent(tuple(annotation_ids)))
        return ProjectSessionAnnotationsMutationPayload(
            project_session_annotations=deleted_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_project_session_annotation(
        self, info: Info[Context, None], id: GlobalID
    ) -> ProjectSessionAnnotationMutationPayload:
        try:
            id_ = from_global_id_with_expected_type(id, "ProjectSessionAnnotation")
        except ValueError:
            raise BadRequest(f"Invalid session annotation ID: {id}")

        user_id = info.context.user_id
        user_is_admin = user_id is not None and info.context.user.is_admin

        async with info.context.db() as session:
            if not (anno := await session.get(models.ProjectSessionAnnotation, id_)):
                raise NotFound(f"Could not find session annotation with ID: {id}")

            if anno.name == NOTE_NAME:
                raise BadRequest(DELETE_PROJECT_SESSION_NOTES_ERROR)

            if not user_is_admin and anno.user_id != user_id:
                raise Unauthorized(
                    "Session annotation is not associated with the current user and "
                    "the current user is not an admin."
                )

            await session.delete(anno)

        deleted_gql_annotation = ProjectSessionAnnotation(id=anno.id, db_record=anno)
        info.context.event_queue.put(ProjectSessionAnnotationDeleteEvent((id_,)))
        return ProjectSessionAnnotationMutationPayload(
            project_session_annotation=deleted_gql_annotation, query=Query()
        )
