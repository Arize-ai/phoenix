from datetime import datetime
from typing import Any, Callable

import strawberry
from sqlalchemy import Select, delete, select
from sqlalchemy.orm import InstrumentedAttribute
from strawberry import Info

from phoenix.db import models
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.input_types.DeleteProjectAnnotationsInput import (
    AnnotationTimeRangeField,
    DeleteProjectAnnotationsInput,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.dml_event import (
    DmlEvent,
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


async def _delete_project_annotations_by_name(
    info: Info[Context, None],
    input: DeleteProjectAnnotationsInput,
    *,
    model: Any,
    build_id_select: Callable[[int], Select[Any]],
    source_start_time_column: InstrumentedAttribute[datetime],
    event_cls: Callable[[tuple[int, ...]], DmlEvent],
) -> DeleteProjectAnnotationsByNamePayload:
    """Bulk-delete every annotation matching ``input`` for a single level.

    ``model`` is the annotation ORM class and ``build_id_select`` returns its
    level-specific ``select`` of annotation ids scoped to the given project. The
    shared logic validates the input, applies the optional time range, deletes the
    matching rows in a single round trip, and emits the level-specific DML event
    for the deleted ids.
    """
    if not input.annotation_name:
        raise BadRequest("An annotation name is required.")
    try:
        project_rowid = from_global_id_with_expected_type(input.project_id, "Project")
    except ValueError:
        raise BadRequest(f"Invalid project ID: {input.project_id}")

    id_select = _apply_time_range(
        build_id_select(project_rowid),
        input,
        created_at_column=model.created_at,
        source_start_time_column=source_start_time_column,
    )
    stmt = delete(model).where(model.id.in_(id_select)).returning(model.id)
    async with info.context.db() as session:
        project_exists = await session.scalar(
            select(models.Project.id).where(models.Project.id == project_rowid)
        )
        if project_exists is None:
            raise NotFound(f"Could not find project with ID: {input.project_id}")
        deleted_ids = tuple(await session.scalars(stmt))

    if deleted_ids:
        info.context.event_queue.put(event_cls(deleted_ids))
    return DeleteProjectAnnotationsByNamePayload(
        deleted_annotation_count=len(deleted_ids), query=Query()
    )


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
        return await _delete_project_annotations_by_name(
            info,
            input,
            model=models.SpanAnnotation,
            build_id_select=lambda project_rowid: (
                select(models.SpanAnnotation.id)
                .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
                .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                .where(models.Trace.project_rowid == project_rowid)
                .where(models.SpanAnnotation.name == input.annotation_name)
            ),
            source_start_time_column=models.Span.start_time,
            event_cls=SpanAnnotationDeleteEvent,
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
        return await _delete_project_annotations_by_name(
            info,
            input,
            model=models.TraceAnnotation,
            build_id_select=lambda project_rowid: (
                select(models.TraceAnnotation.id)
                .join(models.Trace, models.TraceAnnotation.trace_rowid == models.Trace.id)
                .where(models.Trace.project_rowid == project_rowid)
                .where(models.TraceAnnotation.name == input.annotation_name)
            ),
            source_start_time_column=models.Trace.start_time,
            event_cls=TraceAnnotationDeleteEvent,
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
        return await _delete_project_annotations_by_name(
            info,
            input,
            model=models.ProjectSessionAnnotation,
            build_id_select=lambda project_rowid: (
                select(models.ProjectSessionAnnotation.id)
                .join(
                    models.ProjectSession,
                    models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
                )
                .where(models.ProjectSession.project_id == project_rowid)
                .where(models.ProjectSessionAnnotation.name == input.annotation_name)
            ),
            source_start_time_column=models.ProjectSession.start_time,
            event_cls=ProjectSessionAnnotationDeleteEvent,
        )
