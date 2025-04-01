from collections.abc import Sequence
from typing import Optional

import strawberry
from sqlalchemy import delete, insert, select
from starlette.requests import Request
from strawberry import UNSET
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.input_types.CreateTraceAnnotationInput import CreateTraceAnnotationInput
from phoenix.server.api.input_types.DeleteAnnotationsInput import DeleteAnnotationsInput
from phoenix.server.api.input_types.PatchAnnotationInput import PatchAnnotationInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation, to_gql_trace_annotation
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import TraceAnnotationDeleteEvent, TraceAnnotationInsertEvent


@strawberry.type
class TraceAnnotationMutationPayload:
    trace_annotations: list[TraceAnnotation]
    query: Query


@strawberry.type
class TraceAnnotationMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_trace_annotations(
        self, info: Info[Context, None], input: list[CreateTraceAnnotationInput]
    ) -> TraceAnnotationMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
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
                    identifier=annotation.identifier,
                    source=annotation.source.value,
                    user_id=user_id,
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

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_trace_annotations(
        self, info: Info[Context, None], input: list[PatchAnnotationInput]
    ) -> TraceAnnotationMutationPayload:
        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        patch_by_id = {}
        for patch in input:
            try:
                trace_annotation_id = from_global_id_with_expected_type(
                    patch.annotation_id, "TraceAnnotation"
                )
            except ValueError:
                raise BadRequest(f"Invalid trace annotation ID: {patch.annotation_id}")
            if trace_annotation_id in patch_by_id:
                raise BadRequest(f"Duplicate patch for trace annotation ID: {trace_annotation_id}")
            patch_by_id[trace_annotation_id] = patch

        async with info.context.db() as session:
            trace_annotations_by_id = {}
            for trace_annotation in await session.scalars(
                select(models.TraceAnnotation).where(
                    models.TraceAnnotation.id.in_(patch_by_id.keys())
                )
            ):
                if trace_annotation.user_id != user_id:
                    raise Unauthorized(
                        "At least one trace annotation is not associated with the current user."
                    )
                trace_annotations_by_id[trace_annotation.id] = trace_annotation

            missing_trace_annotation_ids = set(patch_by_id) - set(trace_annotations_by_id.keys())
            if missing_trace_annotation_ids:
                raise NotFound(
                    f"Could not find trace annotations with IDs: {missing_trace_annotation_ids}"
                )

            for trace_annotation_id, patch in patch_by_id.items():
                trace_annotation = trace_annotations_by_id[trace_annotation_id]
                if patch.name is not UNSET:
                    trace_annotation.name = patch.name
                if patch.annotator_kind is not UNSET:
                    trace_annotation.annotator_kind = patch.annotator_kind.value
                if patch.label is not UNSET:
                    trace_annotation.label = patch.label
                if patch.score is not UNSET:
                    trace_annotation.score = patch.score
                if patch.explanation is not UNSET:
                    trace_annotation.explanation = patch.explanation
                if patch.metadata is not UNSET:
                    assert isinstance(patch.metadata, dict)
                    trace_annotation.metadata_ = patch.metadata
                if patch.identifier is not UNSET:
                    trace_annotation.identifier = patch.identifier
                session.add(trace_annotation)
            await session.commit()

        patched_annotations = [
            to_gql_trace_annotation(trace_annotation)
            for trace_annotation in trace_annotations_by_id.values()
        ]
        for trace_annotation in trace_annotations_by_id.values():
            info.context.event_queue.put(TraceAnnotationInsertEvent((trace_annotation.id,)))
        return TraceAnnotationMutationPayload(
            trace_annotations=patched_annotations,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_trace_annotations(
        self, info: Info[Context, None], input: DeleteAnnotationsInput
    ) -> TraceAnnotationMutationPayload:
        trace_annotation_ids = []
        for annotation_gid in input.annotation_ids:
            try:
                annotation_id = from_global_id_with_expected_type(annotation_gid, "TraceAnnotation")
            except ValueError:
                raise BadRequest(f"Invalid trace annotation ID: {annotation_gid}")
            trace_annotation_ids.append(annotation_id)
        if not trace_annotation_ids:
            raise BadRequest("No trace annotation IDs provided.")
        trace_annotation_ids = list(set(trace_annotation_ids))

        assert isinstance(request := info.context.request, Request)
        user_id: Optional[int] = None
        user_is_admin = False
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)
            user_is_admin = user.is_admin

        async with info.context.db() as session:
            deleted_annotations_by_id = {
                annotation.id: annotation
                for annotation in await session.scalars(
                    delete(models.TraceAnnotation)
                    .where(models.TraceAnnotation.id.in_(trace_annotation_ids))
                    .returning(models.TraceAnnotation)
                )
            }

            if any(
                annotation.user_id != user_id and not user_is_admin
                for annotation in deleted_annotations_by_id.values()
            ):
                await session.rollback()
                raise Unauthorized(
                    "At least one trace annotation is not associated with the current user "
                    "and the current user is not an admin."
                )

            missing_trace_annotation_ids = set(trace_annotation_ids) - set(
                deleted_annotations_by_id.keys()
            )
            if missing_trace_annotation_ids:
                raise NotFound(
                    f"Could not find trace annotations with IDs: {missing_trace_annotation_ids}"
                )

        deleted_gql_annotations = [
            to_gql_trace_annotation(deleted_annotations_by_id[id]) for id in trace_annotation_ids
        ]
        info.context.event_queue.put(
            TraceAnnotationDeleteEvent(tuple(deleted_annotations_by_id.keys()))
        )
        return TraceAnnotationMutationPayload(
            trace_annotations=deleted_gql_annotations, query=Query()
        )
