import gzip
import zlib
from collections import defaultdict
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Path, Query
from google.protobuf.message import DecodeError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from pydantic import BeforeValidator, Field
from sqlalchemy import delete, insert, or_, select
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import State
from starlette.requests import Request
from starlette.responses import Response
from strawberry.relay import GlobalID

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, token_counts_by_trace
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.server.api.helpers.annotations import get_note_identifier
from phoenix.server.api.routers.v1.annotations import TraceAnnotationData
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.ProjectSession import ProjectSession as ProjectSessionNodeType
from phoenix.server.api.types.Span import Span as SpanNodeType
from phoenix.server.api.types.Trace import Trace as TraceNodeType
from phoenix.server.authorization import (
    is_not_locked,
    prevent_access_in_read_only_mode,
    restrict_access_by_viewers,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import SpanDeleteEvent, TraceAnnotationInsertEvent
from phoenix.server.prometheus import SPAN_QUEUE_REJECTIONS
from phoenix.trace.otel import decode_otlp_span
from phoenix.utilities.project import get_project_name

from .models import V1RoutesBaseModel
from .utils import (
    PaginatedResponseBody,
    RequestBody,
    ResponseBody,
    add_errors_to_responses,
    get_project_by_identifier,
)

router = APIRouter(tags=["traces"])

_PROJECT_SESSION_NODE_TYPE_NAME = ProjectSessionNodeType.__name__


class TraceSpanData(V1RoutesBaseModel):
    id: str
    span_id: str
    parent_id: Optional[str]
    name: str
    span_kind: str
    status_code: str
    start_time: datetime
    end_time: datetime


class TraceData(V1RoutesBaseModel):
    id: str
    trace_id: str
    project_id: str
    start_time: datetime
    end_time: datetime
    token_count_prompt: int = Field(
        default=0,
        description="Cumulative prompt token count across all spans in the trace.",
    )
    token_count_completion: int = Field(
        default=0,
        description="Cumulative completion token count across all spans in the trace.",
    )
    token_count_total: int = Field(
        default=0,
        description=(
            "Cumulative total token count across all spans in the trace (prompt + completion)."
        ),
    )
    spans: Optional[list[TraceSpanData]] = None


class GetTracesResponseBody(PaginatedResponseBody[TraceData]):
    pass


def _to_trace_data(
    trace: models.Trace,
    project_id: int,
    token_counts: Optional[tuple[int, int]] = None,
    spans: Optional[list[TraceSpanData]] = None,
) -> TraceData:
    prompt = token_counts[0] if token_counts is not None else 0
    completion = token_counts[1] if token_counts is not None else 0
    return TraceData(
        id=str(GlobalID(TraceNodeType.__name__, str(trace.id))),
        trace_id=trace.trace_id,
        project_id=str(GlobalID(ProjectNodeType.__name__, str(project_id))),
        start_time=trace.start_time,
        end_time=trace.end_time,
        token_count_prompt=prompt,
        token_count_completion=completion,
        token_count_total=prompt + completion,
        spans=spans,
    )


@router.get(
    "/projects/{project_identifier}/traces",
    operation_id="listProjectTraces",
    summary="List traces for a project",
    responses=add_errors_to_responses([404, 422]),
)
async def list_project_traces(
    request: Request,
    project_identifier: str = Path(
        description="The project identifier: either project ID or project name.",
    ),
    start_time: Optional[datetime] = Query(
        default=None, description="Inclusive lower bound on trace start time (ISO 8601)"
    ),
    end_time: Optional[datetime] = Query(
        default=None, description="Exclusive upper bound on trace start time (ISO 8601)"
    ),
    sort: Literal["start_time", "latency_ms"] = Query(
        default="start_time", description="Sort field"
    ),
    order: Literal["asc", "desc"] = Query(default="desc", description="Sort direction"),
    limit: int = Query(
        default=100, gt=0, le=1000, description="Maximum number of traces to return"
    ),
    cursor: Optional[str] = Query(default=None, description="Pagination cursor (Trace GlobalID)"),
    include_spans: bool = Query(
        default=False,
        description=(
            "If true, include full span details for each trace. "
            "This significantly increases response size and query latency, "
            "especially with large page sizes. Prefer fetching spans lazily "
            "for individual traces when possible."
        ),
    ),
    session_identifier: Optional[list[str]] = Query(
        default=None,
        description=(
            "List of session identifiers to filter traces by. Each value can be "
            "either a session_id string or a session GlobalID. Only traces belonging "
            "to the specified sessions will be returned."
        ),
    ),
    error: Optional[bool] = Query(
        default=None,
        description=(
            "Filter by trace error status. If true, only return traces that contain "
            "at least one span with `status_code == ERROR`. If false, only return "
            "traces with no errored spans. If omitted, traces are not filtered by "
            "error status. Matches the error indicator shown in the UI."
        ),
    ),
    min_latency_ms: Optional[float] = Query(
        default=None,
        ge=0,
        description="Inclusive lower bound on trace latency in milliseconds.",
    ),
    max_latency_ms: Optional[float] = Query(
        default=None,
        ge=0,
        description="Inclusive upper bound on trace latency in milliseconds.",
    ),
) -> GetTracesResponseBody:
    async with request.app.state.db.read() as session:
        project = await get_project_by_identifier(session, project_identifier)
        project_rowid = project.id

        # Build query with sort order
        stmt = select(models.Trace).filter(models.Trace.project_rowid == project_rowid)

        sort_col = models.Trace.latency_ms if sort == "latency_ms" else models.Trace.start_time
        if order == "asc":
            stmt = stmt.order_by(sort_col.asc(), models.Trace.id.asc())
        else:
            stmt = stmt.order_by(sort_col.desc(), models.Trace.id.desc())

        if session_identifier:
            session_rowids_from_global_ids = []
            session_id_strings = []
            for sid in session_identifier:
                try:
                    row_id = from_global_id_with_expected_type(
                        GlobalID.from_id(sid), _PROJECT_SESSION_NODE_TYPE_NAME
                    )
                    session_rowids_from_global_ids.append(row_id)
                except Exception:
                    session_id_strings.append(sid)

            conditions = []
            if session_rowids_from_global_ids:
                conditions.append(
                    models.Trace.project_session_rowid.in_(session_rowids_from_global_ids)
                )
            if session_id_strings:
                session_subq = (
                    select(models.ProjectSession.id)
                    .where(models.ProjectSession.session_id.in_(session_id_strings))
                    .where(models.ProjectSession.project_id == project_rowid)
                )
                conditions.append(models.Trace.project_session_rowid.in_(session_subq))

            if conditions:
                stmt = stmt.where(or_(*conditions))
            else:
                return GetTracesResponseBody(next_cursor=None, data=[])

        if start_time:
            stmt = stmt.where(
                models.Trace.start_time >= normalize_datetime(start_time, timezone.utc)
            )
        if end_time:
            stmt = stmt.where(models.Trace.start_time < normalize_datetime(end_time, timezone.utc))

        if error is not None:
            # A trace "has an error" if any of its spans has status_code == ERROR,
            # matching the error indicator shown in the UI (see Trace.error_count).
            errored_traces = select(models.Span.trace_rowid).where(
                models.Span.status_code == "ERROR"
            )
            if error:
                stmt = stmt.where(models.Trace.id.in_(errored_traces))
            else:
                stmt = stmt.where(models.Trace.id.notin_(errored_traces))

        if min_latency_ms is not None:
            stmt = stmt.where(models.Trace.latency_ms >= min_latency_ms)
        if max_latency_ms is not None:
            stmt = stmt.where(models.Trace.latency_ms <= max_latency_ms)

        if cursor:
            try:
                cursor_rowid = int(GlobalID.from_id(cursor).node_id)
                if order == "desc":
                    stmt = stmt.where(models.Trace.id <= cursor_rowid)
                else:
                    stmt = stmt.where(models.Trace.id >= cursor_rowid)
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail=f"Invalid cursor format: {cursor}")

        stmt = stmt.limit(limit + 1)
        traces = (await session.scalars(stmt)).all()

        if not traces:
            return GetTracesResponseBody(next_cursor=None, data=[])

        next_cursor: Optional[str] = None
        if len(traces) == limit + 1:
            last_trace = traces[-1]
            next_cursor = str(GlobalID(TraceNodeType.__name__, str(last_trace.id)))
            traces = traces[:-1]

        trace_rowids = [t.id for t in traces]

        # Batch-fetch leaf-LLM token counts (one query per page, not per row)
        tokens_by_trace: dict[int, tuple[int, int]] = {}
        for row in (await session.execute(token_counts_by_trace(trace_rowids))).all():
            tokens_by_trace[row.id_] = (row.prompt, row.completion)

        # Optionally batch-fetch full span details (column projection to avoid
        # loading heavy attributes/events JSON blobs that aren't in the response)
        spans_by_trace: Optional[dict[int, list[TraceSpanData]]] = None
        if include_spans:
            spans_by_trace = defaultdict(list)
            spans_stmt = (
                select(
                    models.Span.id,
                    models.Span.trace_rowid,
                    models.Span.span_id,
                    models.Span.parent_id,
                    models.Span.name,
                    models.Span.span_kind,
                    models.Span.status_code,
                    models.Span.start_time,
                    models.Span.end_time,
                )
                .filter(models.Span.trace_rowid.in_(trace_rowids))
                .order_by(models.Span.start_time.asc())
            )
            for row in (await session.execute(spans_stmt)).all():
                spans_by_trace[row.trace_rowid].append(
                    TraceSpanData(
                        id=str(GlobalID(SpanNodeType.__name__, str(row.id))),
                        span_id=row.span_id,
                        parent_id=row.parent_id,
                        name=row.name,
                        span_kind=row.span_kind,
                        status_code=row.status_code,
                        start_time=row.start_time,
                        end_time=row.end_time,
                    )
                )

        data = [
            _to_trace_data(
                t,
                project_rowid,
                token_counts=tokens_by_trace.get(t.id),
                spans=spans_by_trace.get(t.id, []) if spans_by_trace is not None else None,
            )
            for t in traces
        ]
    return GetTracesResponseBody(next_cursor=next_cursor, data=data)


def is_not_at_capacity(request: Request) -> None:
    if request.app.state.span_queue_is_full():
        SPAN_QUEUE_REJECTIONS.inc()
        raise HTTPException(
            detail="Server is at capacity and cannot process more requests",
            status_code=503,
        )


@router.post(
    "/traces",
    dependencies=[Depends(is_not_locked), Depends(is_not_at_capacity)],
    operation_id="addTraces",
    summary="Send traces",
    responses=add_errors_to_responses(
        [
            {
                "status_code": 415,
                "description": (
                    "Unsupported content type (only `application/x-protobuf` is supported)"
                ),
            },
            {"status_code": 422, "description": "Invalid request body"},
            {
                "status_code": 503,
                "description": "Server is at capacity and cannot process more requests",
            },
        ]
    ),
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-protobuf": {"schema": {"type": "string", "format": "binary"}}
            },
        }
    },
    include_in_schema=False,
)
async def post_traces(
    request: Request,
    background_tasks: BackgroundTasks,
    content_type: Optional[str] = Header(default=None),
    content_encoding: Optional[str] = Header(default=None),
    x_project_name: Optional[str] = Header(default=None),
) -> Response:
    if content_type != "application/x-protobuf":
        raise HTTPException(
            detail=f"Unsupported content type: {content_type}",
            status_code=415,
        )
    if content_encoding and content_encoding not in ("gzip", "deflate"):
        raise HTTPException(
            detail=f"Unsupported content encoding: {content_encoding}",
            status_code=415,
        )
    body = await request.body()
    if content_encoding == "gzip":
        body = await run_in_threadpool(gzip.decompress, body)
    elif content_encoding == "deflate":
        body = await run_in_threadpool(zlib.decompress, body)
    req = ExportTraceServiceRequest()
    try:
        await run_in_threadpool(req.ParseFromString, body)
    except DecodeError:
        raise HTTPException(
            detail="Request body is invalid ExportTraceServiceRequest",
            status_code=422,
        )
    background_tasks.add_task(_add_spans, req, request.state, x_project_name)

    # "The server MUST use the same Content-Type in the response as it received in the request"
    response_message = ExportTraceServiceResponse()
    response_bytes = response_message.SerializeToString()
    return Response(
        content=response_bytes,
        media_type="application/x-protobuf",
        status_code=200,
    )


class AnnotateTracesRequestBody(RequestBody[list[TraceAnnotationData]]):
    data: list[TraceAnnotationData] = Field(description="The trace annotations to be upserted")


class InsertedTraceAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted trace annotation")


class AnnotateTracesResponseBody(ResponseBody[list[InsertedTraceAnnotation]]):
    pass


@router.post(
    "/trace_annotations",
    dependencies=[Depends(is_not_locked)],
    operation_id="annotateTraces",
    summary="Create trace annotations",
    responses=add_errors_to_responses([{"status_code": 404, "description": "Trace not found"}]),
)
async def annotate_traces(
    request: Request,
    request_body: AnnotateTracesRequestBody,
    sync: bool = Query(default=False, description="If true, fulfill request synchronously."),
) -> AnnotateTracesResponseBody:
    if not request_body.data:
        return AnnotateTracesResponseBody(data=[])
    if any(data.name == "note" for data in request_body.data):
        raise HTTPException(
            status_code=400,
            detail=(
                "The name 'note' is reserved for trace and span notes. "
                "Use POST /v1/trace_notes instead."
            ),
        )

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    precursors = [d.as_precursor(user_id=user_id) for d in request_body.data]
    if not sync:
        await request.state.enqueue_annotations(*precursors)
        return AnnotateTracesResponseBody(data=[])

    trace_ids = {p.trace_id for p in precursors}
    async with request.app.state.db() as session:
        existing_traces = {
            trace_id: id_
            async for trace_id, id_ in await session.stream(
                select(models.Trace.trace_id, models.Trace.id).filter(
                    models.Trace.trace_id.in_(trace_ids)
                )
            )
        }

        missing_trace_ids = trace_ids - set(existing_traces.keys())
        if missing_trace_ids:
            raise HTTPException(
                detail=f"Traces with IDs {', '.join(missing_trace_ids)} do not exist.",
                status_code=404,
            )
        inserted_ids = []
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        for p in precursors:
            values = dict(as_kv(p.as_insertable(existing_traces[p.trace_id]).row))
            trace_annotation_id = await session.scalar(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.TraceAnnotation,
                    unique_by=("name", "trace_rowid", "identifier"),
                ).returning(models.TraceAnnotation.id)
            )
            inserted_ids.append(trace_annotation_id)
    request.state.event_queue.put(TraceAnnotationInsertEvent(tuple(inserted_ids)))
    return AnnotateTracesResponseBody(
        data=[
            InsertedTraceAnnotation(id=str(GlobalID("TraceAnnotation", str(id_))))
            for id_ in inserted_ids
        ]
    )


class TraceNoteData(V1RoutesBaseModel):
    trace_id: Annotated[
        str, BeforeValidator(lambda value: value.strip() if isinstance(value, str) else value)
    ] = Field(
        min_length=1,
        description="OpenTelemetry Trace ID (hex format w/o 0x prefix)",
    )
    note: Annotated[
        str, BeforeValidator(lambda value: value.strip() if isinstance(value, str) else value)
    ] = Field(
        min_length=1,
        description="The note text to add to the trace",
    )
    identifier: str = Field(
        default="",
        description=(
            "Optional caller-supplied identifier. When non-empty, the note is upserted "
            "on (trace_id, name='note', identifier) — repeated calls with the same "
            "identifier overwrite the existing note. When omitted or empty, the server "
            "stamps a unique 'px-trace-note:<uuid>' identifier so each call appends a "
            "new note."
        ),
    )


class CreateTraceNoteRequestBody(RequestBody[TraceNoteData]):
    data: TraceNoteData


class CreateTraceNoteResponseBody(ResponseBody[InsertedTraceAnnotation]):
    pass


@router.post(
    "/trace_notes",
    dependencies=[
        Depends(prevent_access_in_read_only_mode),
        Depends(restrict_access_by_viewers),
        Depends(is_not_locked),
    ],
    operation_id="createTraceNote",
    summary="Create a trace note",
    description=(
        "Add a note annotation to a trace. By default each call appends a new note "
        "with an auto-generated UUIDv4 identifier, so multiple notes accumulate on "
        "the same trace. Callers may supply a non-empty `identifier` to upsert on "
        "(trace_id, name='note', identifier) — repeated calls with the same "
        "identifier overwrite the existing note, matching the semantics of "
        "structured annotations."
    ),
    responses=add_errors_to_responses([{"status_code": 404, "description": "Trace not found"}]),
    response_description="Trace note created successfully",
    status_code=200,
)
async def create_trace_note(
    request: Request,
    request_body: CreateTraceNoteRequestBody,
) -> CreateTraceNoteResponseBody:
    note_data = request_body.data

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    async with request.app.state.db() as session:
        trace_rowid = await session.scalar(
            select(models.Trace.id).where(models.Trace.trace_id == note_data.trace_id)
        )

        if trace_rowid is None:
            raise HTTPException(
                status_code=404,
                detail=f"Trace with ID {note_data.trace_id} not found",
            )

        note_identifier = note_data.identifier or get_note_identifier("px-trace-note")
        values = {
            "trace_rowid": trace_rowid,
            "name": "note",
            "label": None,
            "score": None,
            "explanation": note_data.note,
            "annotator_kind": "HUMAN",
            "metadata_": dict(),
            "identifier": note_identifier,
            "source": "API",
            "user_id": user_id,
        }

        if note_data.identifier:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            result = await session.execute(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.TraceAnnotation,
                    unique_by=("name", "trace_rowid", "identifier"),
                ).returning(models.TraceAnnotation.id)
            )
        else:
            result = await session.execute(
                insert(models.TraceAnnotation).values(**values).returning(models.TraceAnnotation.id)
            )
        annotation_id = result.scalar_one()

    request.state.event_queue.put(TraceAnnotationInsertEvent((annotation_id,)))
    return CreateTraceNoteResponseBody(
        data=InsertedTraceAnnotation(id=str(GlobalID("TraceAnnotation", str(annotation_id))))
    )


async def _add_spans(
    req: ExportTraceServiceRequest,
    state: State,
    project_name_header: Optional[str] = None,
) -> None:
    """Ingest spans from an OTLP ExportTraceServiceRequest.

    The project name is resolved in the following order of precedence:
    1. The ``x-project-name`` HTTP header (if provided).
    2. The ``openinference.project.name`` OTLP resource attribute on each
       ``ResourceSpans`` message.
    3. The server default project (``DEFAULT_PROJECT_NAME``).
    """
    for resource_spans in req.resource_spans:
        project_name = (
            project_name_header
            if project_name_header is not None
            else get_project_name(resource_spans.resource.attributes)
        )
        for scope_span in resource_spans.scope_spans:
            for otlp_span in scope_span.spans:
                span = await run_in_threadpool(decode_otlp_span, otlp_span)
                await state.enqueue_span(span, project_name)


@router.delete(
    "/traces/{trace_identifier}",
    operation_id="deleteTrace",
    summary="Delete a trace by identifier",
    description=(
        "Delete an entire trace by its identifier. The identifier can be either:\n"
        "1. A Relay node ID (base64-encoded)\n"
        "2. An OpenTelemetry trace_id (hex string)\n\n"
        "This will permanently remove all spans in the trace and their associated data."
    ),
    responses=add_errors_to_responses([404]),
    status_code=204,  # No Content for successful deletion
)
async def delete_trace(
    request: Request,
    trace_identifier: str = Path(
        description="The trace identifier: either a relay GlobalID or OpenTelemetry trace_id"
    ),
) -> None:
    """
    Delete a trace by identifier (relay GlobalID or OpenTelemetry trace_id).

    This endpoint will:
    1. Delete the trace by identifier (relay GlobalID or OpenTelemetry trace_id)
    2. Get project_id from the deletion for cache invalidation
    3. Trigger cache invalidation events
    4. Return 204 No Content on success

    Note: This deletes the entire trace, including all spans, which maintains data consistency
    and avoids orphaned spans or inconsistent cached cumulative fields.
    """
    async with request.app.state.db() as session:
        # Try to parse as GlobalID first, then fall back to trace_id
        try:
            trace_rowid = from_global_id_with_expected_type(
                GlobalID.from_id(trace_identifier),
                "Trace",
            )
            # Delete by database rowid
            delete_stmt = (
                delete(models.Trace)
                .where(models.Trace.id == trace_rowid)
                .returning(models.Trace.project_rowid)
            )
            error_detail = f"Trace with relay ID '{trace_identifier}' not found"
        except Exception:
            # Delete by OpenTelemetry trace_id
            delete_stmt = (
                delete(models.Trace)
                .where(models.Trace.trace_id == trace_identifier)
                .returning(models.Trace.project_rowid)
            )
            error_detail = f"Trace with trace_id '{trace_identifier}' not found"

        project_id = await session.scalar(delete_stmt)

        if project_id is None:
            raise HTTPException(
                status_code=404,
                detail=error_detail,
            )

    # Trigger cache invalidation event
    request.state.event_queue.put(SpanDeleteEvent((project_id,)))

    # Return 204 No Content (successful deletion with no response body)
    return None
