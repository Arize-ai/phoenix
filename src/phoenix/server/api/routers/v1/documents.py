from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.server.api.routers.v1.annotations import SpanDocumentAnnotationData
from phoenix.server.api.types.DocumentAnnotation import DocumentAnnotation
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import DocumentAnnotationInsertEvent

from .models import V1RoutesBaseModel
from .utils import RequestBody, ResponseBody, add_errors_to_responses

# Since the document annotations are spans related, we place it under spans
router = APIRouter(tags=["spans"])


class AnnotateSpanDocumentsRequestBody(RequestBody[list[SpanDocumentAnnotationData]]):
    pass


class InsertedSpanDocumentAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted span document annotation")


class AnnotateSpanDocumentsResponseBody(ResponseBody[list[InsertedSpanDocumentAnnotation]]):
    pass


@router.post(
    "/document_annotations",
    dependencies=[Depends(is_not_locked)],
    operation_id="annotateSpanDocuments",
    responses=add_errors_to_responses(
        [
            {
                "status_code": 404,
                "description": "Span not found",
            },
            {
                "status_code": 422,
                "description": "Invalid request - non-empty identifier not supported",
            },
        ]
    ),
    response_description="Span document annotation inserted successfully",
    include_in_schema=True,
)
async def annotate_span_documents(
    request: Request,
    request_body: AnnotateSpanDocumentsRequestBody,
    sync: bool = Query(
        default=False, description="If set to true, the annotations are inserted synchronously."
    ),
) -> AnnotateSpanDocumentsResponseBody:
    if not request_body.data:
        return AnnotateSpanDocumentsResponseBody(data=[])

    # Validate that identifiers are empty or only whitespace
    for annotation in request_body.data:
        if annotation.identifier.strip():
            raise HTTPException(
                detail=f"Non-empty identifier '{annotation.identifier}' is not supported",
                status_code=422,  # Unprocessable Entity
            )

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    span_document_annotations = request_body.data

    precursors = [
        annotation.as_precursor(user_id=user_id) for annotation in span_document_annotations
    ]
    if not sync:
        await request.state.enqueue_annotations(*precursors)
        return AnnotateSpanDocumentsResponseBody(data=[])

    span_ids = {p.span_id for p in precursors}
    # Account for the fact that the spans could arrive after the annotation
    async with request.app.state.db() as session:
        existing_spans = {
            span_id: (id_, num_docs)
            async for span_id, id_, num_docs in await session.stream(
                select(models.Span.span_id, models.Span.id, models.Span.num_documents).filter(
                    models.Span.span_id.in_(span_ids)
                )
            )
        }

        missing_span_ids = span_ids - set(existing_spans.keys())
        # We prefer to fail the entire operation if there are missing spans in sync mode
        if missing_span_ids:
            raise HTTPException(
                detail=f"Spans with IDs {', '.join(missing_span_ids)} do not exist.",
                status_code=404,
            )

        # Validate that document positions are within bounds
        for annotation in span_document_annotations:
            _, num_docs = existing_spans[annotation.span_id]
            if annotation.document_position not in range(num_docs):
                raise HTTPException(
                    detail=f"Document position {annotation.document_position} is out of bounds for "
                    f"span {annotation.span_id} (max: {num_docs - 1})",
                    status_code=422,  # Unprocessable Entity
                )

        inserted_document_annotation_ids = []
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        for anno in precursors:
            span_rowid, _ = existing_spans[anno.span_id]
            values = dict(as_kv(anno.as_insertable(span_rowid).row))
            span_document_annotation_id = await session.scalar(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.DocumentAnnotation,
                    unique_by=("name", "span_rowid", "identifier", "document_position"),
                    constraint_name="uq_document_annotations_name_span_rowid_document_pos_identifier",
                ).returning(models.DocumentAnnotation.id)
            )
            inserted_document_annotation_ids.append(span_document_annotation_id)

    # We queue an event to let the application know that annotations have changed
    request.state.event_queue.put(
        DocumentAnnotationInsertEvent(tuple(inserted_document_annotation_ids))
    )
    return AnnotateSpanDocumentsResponseBody(
        data=[
            InsertedSpanDocumentAnnotation(id=str(GlobalID(DocumentAnnotation.__name__, str(id_))))
            for id_ in inserted_document_annotation_ids
        ]
    )
