from datetime import datetime
from typing import Any

import strawberry
from sqlalchemy import Select, delete, select
from sqlalchemy.orm import InstrumentedAttribute
from strawberry import Info

from phoenix.db import models
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.DeleteProjectAnnotationsInput import (
    AnnotationTimeRangeField,
    DeleteProjectAnnotationsInput,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.dml_event import (
    ProjectSessionAnnotationDeleteEvent,
    SpanAnnotationDeleteEvent,
    TraceAnnotationDeleteEvent,
)


@strawberry.type
class DeleteProjectAnnotationsByNamePayload:
    """The result of bulk-deleting annotations by name within a project."""

    deleted_annotation_count: int
    query: Query


def _apply_time_range(
    stmt: Select[Any],
    input: DeleteProjectAnnotationsInput,
    *,
    created_at_column: InstrumentedAttribute[datetime],
    source_start_time_column: InstrumentedAttribute[datetime],
) -> Select[Any]:
    """Restrict ``stmt`` to the annotations falling within ``input.time_range``.

    The range is applied against either the annotation's own ``created_at`` or the
    start time of the span/trace/session it is attached to, depending on
    ``input.time_range_field``. The end of the range is right-exclusive.
    """
    time_range = input.time_range
    if not time_range:
        return stmt
    if not time_range.is_valid():
        raise BadRequest("Invalid time range: start must be before end.")
    column = (
        created_at_column
        if input.time_range_field is AnnotationTimeRangeField.ANNOTATION_CREATED_AT
        else source_start_time_column
    )
    if time_range.start is not None:
        stmt = stmt.where(column >= time_range.start)
    if time_range.end is not None:
        stmt = stmt.where(column < time_range.end)
    return stmt


@strawberry.type
class ProjectAnnotationMutationMixin:
    @strawberry.mutation(  # type: ignore
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled],
        description=(
            "Delete every span annotation with the given name in a project, optionally "
            "restricted to a time range. Admin only when auth is enabled."
        ),
    )
    async def delete_project_span_annotations(
        self, info: Info[Context, None], input: DeleteProjectAnnotationsInput
    ) -> DeleteProjectAnnotationsByNamePayload:
        if not input.annotation_name:
            raise BadRequest("An annotation name is required.")
        try:
            project_rowid = from_global_id_with_expected_type(input.project_id, "Project")
        except ValueError:
            raise BadRequest(f"Invalid project ID: {input.project_id}")

        stmt = (
            select(models.SpanAnnotation.id)
            .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == project_rowid)
            .where(models.SpanAnnotation.name == input.annotation_name)
        )
        stmt = _apply_time_range(
            stmt,
            input,
            created_at_column=models.SpanAnnotation.created_at,
            source_start_time_column=models.Span.start_time,
        )

        async with info.context.db() as session:
            annotation_ids = list(await session.scalars(stmt))
            if annotation_ids:
                await session.execute(
                    delete(models.SpanAnnotation).where(
                        models.SpanAnnotation.id.in_(annotation_ids)
                    )
                )

        if annotation_ids:
            info.context.event_queue.put(SpanAnnotationDeleteEvent(tuple(annotation_ids)))
        return DeleteProjectAnnotationsByNamePayload(
            deleted_annotation_count=len(annotation_ids), query=Query()
        )

    @strawberry.mutation(  # type: ignore
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled],
        description=(
            "Delete every trace annotation with the given name in a project, optionally "
            "restricted to a time range. Admin only when auth is enabled."
        ),
    )
    async def delete_project_trace_annotations(
        self, info: Info[Context, None], input: DeleteProjectAnnotationsInput
    ) -> DeleteProjectAnnotationsByNamePayload:
        if not input.annotation_name:
            raise BadRequest("An annotation name is required.")
        try:
            project_rowid = from_global_id_with_expected_type(input.project_id, "Project")
        except ValueError:
            raise BadRequest(f"Invalid project ID: {input.project_id}")

        stmt = (
            select(models.TraceAnnotation.id)
            .join(models.Trace, models.TraceAnnotation.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == project_rowid)
            .where(models.TraceAnnotation.name == input.annotation_name)
        )
        stmt = _apply_time_range(
            stmt,
            input,
            created_at_column=models.TraceAnnotation.created_at,
            source_start_time_column=models.Trace.start_time,
        )

        async with info.context.db() as session:
            annotation_ids = list(await session.scalars(stmt))
            if annotation_ids:
                await session.execute(
                    delete(models.TraceAnnotation).where(
                        models.TraceAnnotation.id.in_(annotation_ids)
                    )
                )

        if annotation_ids:
            info.context.event_queue.put(TraceAnnotationDeleteEvent(tuple(annotation_ids)))
        return DeleteProjectAnnotationsByNamePayload(
            deleted_annotation_count=len(annotation_ids), query=Query()
        )

    @strawberry.mutation(  # type: ignore
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled],
        description=(
            "Delete every session annotation with the given name in a project, optionally "
            "restricted to a time range. Admin only when auth is enabled."
        ),
    )
    async def delete_project_session_annotations(
        self, info: Info[Context, None], input: DeleteProjectAnnotationsInput
    ) -> DeleteProjectAnnotationsByNamePayload:
        if not input.annotation_name:
            raise BadRequest("An annotation name is required.")
        try:
            project_rowid = from_global_id_with_expected_type(input.project_id, "Project")
        except ValueError:
            raise BadRequest(f"Invalid project ID: {input.project_id}")

        stmt = (
            select(models.ProjectSessionAnnotation.id)
            .join(
                models.ProjectSession,
                models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
            )
            .where(models.ProjectSession.project_id == project_rowid)
            .where(models.ProjectSessionAnnotation.name == input.annotation_name)
        )
        stmt = _apply_time_range(
            stmt,
            input,
            created_at_column=models.ProjectSessionAnnotation.created_at,
            source_start_time_column=models.ProjectSession.start_time,
        )

        async with info.context.db() as session:
            annotation_ids = list(await session.scalars(stmt))
            if annotation_ids:
                await session.execute(
                    delete(models.ProjectSessionAnnotation).where(
                        models.ProjectSessionAnnotation.id.in_(annotation_ids)
                    )
                )

        if annotation_ids:
            info.context.event_queue.put(ProjectSessionAnnotationDeleteEvent(tuple(annotation_ids)))
        return DeleteProjectAnnotationsByNamePayload(
            deleted_annotation_count=len(annotation_ids), query=Query()
        )
