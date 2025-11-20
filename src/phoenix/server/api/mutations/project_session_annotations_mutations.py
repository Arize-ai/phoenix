from typing import Optional

import strawberry
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from strawberry import Info
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound, Unauthorized
from phoenix.server.api.helpers.annotations import get_user_identifier
from phoenix.server.api.input_types.CreateProjectSessionAnnotationInput import (
    CreateProjectSessionAnnotationInput,
)
from phoenix.server.api.input_types.UpdateAnnotationInput import UpdateAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.ProjectSessionAnnotation import ProjectSessionAnnotation
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import (
    ProjectSessionAnnotationDeleteEvent,
    ProjectSessionAnnotationInsertEvent,
)


@strawberry.type
class ProjectSessionAnnotationMutationPayload:
    project_session_annotation: ProjectSessionAnnotation
    query: Query


@strawberry.type
class ProjectSessionAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_project_session_annotations(
        self, info: Info[Context, None], input: CreateProjectSessionAnnotationInput
    ) -> ProjectSessionAnnotationMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

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
    async def update_project_session_annotations(
        self, info: Info[Context, None], input: UpdateAnnotationInput
    ) -> ProjectSessionAnnotationMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        try:
            id_ = from_global_id_with_expected_type(input.id, "ProjectSessionAnnotation")
        except ValueError:
            raise BadRequest(f"Invalid session annotation ID: {input.id}")

        async with info.context.db() as session:
            if not (anno := await session.get(models.ProjectSessionAnnotation, id_)):
                raise NotFound(f"Could not find session annotation with ID: {input.id}")
            if anno.user_id != user_id:
                raise Unauthorized("Session annotation is not associated with the current user.")

            # Update the annotation fields
            anno.name = input.name
            anno.label = input.label
            anno.score = input.score
            anno.explanation = input.explanation
            anno.annotator_kind = input.annotator_kind.value
            anno.metadata_ = input.metadata
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

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_project_session_annotation(
        self, info: Info[Context, None], id: GlobalID
    ) -> ProjectSessionAnnotationMutationPayload:
        try:
            id_ = from_global_id_with_expected_type(id, "ProjectSessionAnnotation")
        except ValueError:
            raise BadRequest(f"Invalid session annotation ID: {id}")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        user_is_admin = False
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
            user_is_admin = user.is_admin

        async with info.context.db() as session:
            if not (anno := await session.get(models.ProjectSessionAnnotation, id_)):
                raise NotFound(f"Could not find session annotation with ID: {id}")

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
