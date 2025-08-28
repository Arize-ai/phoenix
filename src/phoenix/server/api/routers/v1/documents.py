from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import Field
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND

from phoenix.db import models
from phoenix.db.insertion.types import Precursors
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser

from .models import V1RoutesBaseModel
from .spans import SpanAnnotationResult
from .utils import RequestBody, ResponseBody, add_errors_to_responses

router = APIRouter(tags=["documents"])


class SpanDocumentAnnotationData(V1RoutesBaseModel):
    span_id: str = Field(description="OpenTelemetry Span ID (hex format w/o 0x prefix)")
    name: str = Field(description="The name of the document annotation. E.x. relevance")
    annotator_kind: Literal["LLM", "CODE", "HUMAN"] = Field(
        description="The kind of annotator. E.g. llm judge, a heuristic piece of code, or a human"
    )
    document_position: int = Field(
        description="A 0 based index of the document. E.x. the first document during retrieval is 0"
    )
    result: Optional[SpanAnnotationResult] = Field(
        default=None, description="The score and or label of the annotation"
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None, description="Metadata for custom values of the annotation"
    )
    identifier: str = Field(
        default="",
        description=(
            "An custom ID for the annotation. If provided, the annotation will be updated if it already exists."
        ),
    )

    # Precursor here means a value to add to a queue for processing async
    def as_precursor(self, *, user_id: Optional[int] = None) -> Precursors.DocumentAnnotation:
        return Precursors.DocumentAnnotation(
            datetime.now(timezone.utc),
            self.span_id,
            self.document_position,
            models.DocumentAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                score=self.result.score if self.result else None,
                label=self.result.label if self.result else None,
                explanation=self.result.explanation if self.result else None,
                metadata_=self.metadata or {},
                identifier=self.identifier,
                source="API",
                user_id=user_id,
            ),
        )


class AnnotateSpanDocumentsRequestBody(RequestBody[list[SpanDocumentAnnotationData]]):
    pass


class InsertedSpanDocumentAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted span document annotation")


class AnnotateSpanDocumentsResponseBody(ResponseBody[list[InsertedSpanDocumentAnnotation]]):
    pass


@router.post(
    "/span_document_annotations",
    dependencies=[Depends(is_not_locked)],
    operation_id="annotateSpanDocuments",
    responses=add_errors_to_responses(
        [
            {
                "status_code": HTTP_404_NOT_FOUND,
                "description": "Span not found",
            }
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

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    span_document_annotations = request_body.data

    precursors = [
        annotation.as_precursor(user_id=user_id) for annotation in span_document_annotations
    ]
    if not sync:
        await request.state.enqueue(*precursors)

    return AnnotateSpanDocumentsResponseBody(data=[])
