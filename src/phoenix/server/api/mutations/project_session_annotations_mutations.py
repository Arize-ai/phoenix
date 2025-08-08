from typing import Optional

import strawberry
from sqlalchemy import delete, insert, select
from starlette.requests import Request
from strawberry import UNSET, Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.helpers.annotations import get_user_identifier
from phoenix.server.api.input_types.CreateProjectSessionAnnotationInput import (
    CreateProjectSessionAnnotationInput,
)
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.ProjectSessionAnnotation import (
    ProjectSessionAnnotation,
    to_gql_project_session_annotation,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import (
    ProjectSessionAnnotationDeleteEvent,
    ProjectSessionAnnotationInsertEvent,
)


@strawberry.type
class ProjectSessionAnnotationMutationPayload:
    project_session_annotations: list[ProjectSessionAnnotation]
    query: Query


@strawberry.type
class ProjectSessionAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_project_session_annotations(
        self, info: Info[Context, None], input: list[CreateProjectSessionAnnotationInput]
    ) -> ProjectSessionAnnotationMutationPayload:
        if not input:
            raise BadRequest("No session annotations provided.")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        processed_annotations_map: dict[int, models.ProjectSessionAnnotation] = {}

        project_session_ids = []
        for idx, annotation_input in enumerate(input):
            try:
                project_session_id = from_global_id_with_expected_type(
                    annotation_input.project_session_id, "ProjectSession"
                )
            except ValueError:
                raise BadRequest(
                    f"Invalid session ID for annotation at index {idx}: "
                    f"{annotation_input.project_session_id}"
                )
            project_session_ids.append(project_session_id)

        async with info.context.db() as session:
            for idx, (project_session_id, annotation_input) in enumerate(
                zip(project_session_ids, input)
            ):
                resolved_identifier = ""
                if isinstance(annotation_input.identifier, str):
                    resolved_identifier = annotation_input.identifier
                elif annotation_input.source == AnnotationSource.APP and user_id is not None:
                    resolved_identifier = get_user_identifier(user_id)
                values = {
                    "project_session_id": project_session_id,
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

                processed_annotation: Optional[models.ProjectSessionAnnotation] = None

                # Check if an annotation with this project_session_id, name, and identifier already
                # exists
                q = select(models.ProjectSessionAnnotation).where(
                    models.ProjectSessionAnnotation.project_session_id == project_session_id,
                    models.ProjectSessionAnnotation.name == annotation_input.name,
                    models.ProjectSessionAnnotation.identifier == resolved_identifier,
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
                    stmt = insert(models.ProjectSessionAnnotation).values(**values)
                    stmt = stmt.returning(models.ProjectSessionAnnotation)
                    result = await session.scalars(stmt)
                    processed_annotation = result.one()

                processed_annotations_map[idx] = processed_annotation

        inserted_annotation_ids = tuple(anno.id for anno in processed_annotations_map.values())
        if inserted_annotation_ids:
            info.context.event_queue.put(
                ProjectSessionAnnotationInsertEvent(inserted_annotation_ids)
            )

        returned_annotations = [
            to_gql_project_session_annotation(processed_annotations_map[i])
            for i in sorted(processed_annotations_map.keys())
        ]

        return ProjectSessionAnnotationMutationPayload(
            project_session_annotations=returned_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_project_session_annotations(
        self, info: Info[Context, None], input: list[PatchAnnotationInput]
    ) -> ProjectSessionAnnotationMutationPayload:
        if not input:
            raise BadRequest("No session annotations provided.")

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        patch_by_id = {}
        for patch in input:
            try:
                project_session_annotation_id = from_global_id_with_expected_type(
                    patch.annotation_id, "ProjectSessionAnnotation"
                )
            except ValueError:
                raise BadRequest(f"Invalid session annotation ID: {patch.annotation_id}")
            if project_session_annotation_id in patch_by_id:
                raise BadRequest(
                    f"Duplicate patch for session annotation ID: {project_session_annotation_id}"
                )
            patch_by_id[project_session_annotation_id] = patch

        async with info.context.db() as session:
            project_session_annotations_by_id = {}
            for project_session_annotation in await session.scalars(
                select(models.ProjectSessionAnnotation).where(
                    models.ProjectSessionAnnotation.id.in_(patch_by_id.keys())
                )
            ):
                if project_session_annotation.user_id != user_id:
                    raise Unauthorized(
                        "At least one session annotation is not associated with the current user."
                    )
                project_session_annotations_by_id[project_session_annotation.id] = (
                    project_session_annotation
                )

            missing_project_session_annotation_ids = set(patch_by_id.keys()) - set(
                project_session_annotations_by_id.keys()
            )
            if missing_project_session_annotation_ids:
                raise NotFound(
                    f"Could not find session annotations with IDs: "
                    f"{missing_project_session_annotation_ids}"
                )

            for project_session_annotation_id, patch in patch_by_id.items():
                project_session_annotation = project_session_annotations_by_id[
                    project_session_annotation_id
                ]
                if patch.name:
                    project_session_annotation.name = patch.name
                if patch.annotator_kind:
                    project_session_annotation.annotator_kind = patch.annotator_kind.value
                if patch.label is not UNSET:
                    project_session_annotation.label = patch.label
                if patch.score is not UNSET:
                    project_session_annotation.score = patch.score
                if patch.explanation is not UNSET:
                    project_session_annotation.explanation = patch.explanation
                if patch.metadata is not UNSET:
                    assert isinstance(patch.metadata, dict)
                    project_session_annotation.metadata_ = patch.metadata
                if patch.identifier is not UNSET:
                    project_session_annotation.identifier = patch.identifier or ""
                session.add(project_session_annotation)

        patched_annotations = [
            to_gql_project_session_annotation(project_session_annotation)
            for project_session_annotation in project_session_annotations_by_id.values()
        ]
        info.context.event_queue.put(ProjectSessionAnnotationInsertEvent(tuple(patch_by_id.keys())))
        return ProjectSessionAnnotationMutationPayload(
            project_session_annotations=patched_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_project_session_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> ProjectSessionAnnotationMutationPayload:
        if not input.annotation_ids:
            raise BadRequest("No session annotation IDs provided.")

        project_session_annotation_ids: dict[int, None] = {}  # use dict to preserve order
        for annotation_gid in input.annotation_ids:
            try:
                annotation_id = from_global_id_with_expected_type(
                    annotation_gid, "ProjectSessionAnnotation"
                )
            except ValueError:
                raise BadRequest(f"Invalid session annotation ID: {annotation_gid}")
            if annotation_id in project_session_annotation_ids:
                raise BadRequest(f"Duplicate session annotation ID: {annotation_id}")
            project_session_annotation_ids[annotation_id] = None

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        user_is_admin = False
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
            user_is_admin = user.is_admin

        async with info.context.db() as session:
            result = await session.scalars(
                delete(models.ProjectSessionAnnotation)
                .where(
                    models.ProjectSessionAnnotation.id.in_(project_session_annotation_ids.keys())
                )
                .returning(models.ProjectSessionAnnotation)
            )
            deleted_annotations_by_id = {annotation.id: annotation for annotation in result.all()}

            if not user_is_admin and any(
                annotation.user_id != user_id for annotation in deleted_annotations_by_id.values()
            ):
                await session.rollback()
                raise Unauthorized(
                    "At least one session annotation is not associated with the current "
                    "user and the current user is not an admin."
                )

            missing_project_session_annotation_ids = set(
                project_session_annotation_ids.keys()
            ) - set(deleted_annotations_by_id.keys())
            if missing_project_session_annotation_ids:
                raise NotFound(
                    f"Could not find session annotations with IDs: "
                    f"{missing_project_session_annotation_ids}"
                )

        deleted_gql_annotations = [
            to_gql_project_session_annotation(deleted_annotations_by_id[id])
            for id in project_session_annotation_ids
        ]
        info.context.event_queue.put(
            ProjectSessionAnnotationDeleteEvent(tuple(deleted_annotations_by_id.keys()))
        )
        return ProjectSessionAnnotationMutationPayload(
            project_session_annotations=deleted_gql_annotations, query=Query()
        )
