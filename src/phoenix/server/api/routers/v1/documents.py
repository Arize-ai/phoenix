from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import Field
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND

from phoenix.server.authorization import is_not_locked

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
    request: Request, request_body: AnnotateSpanDocumentsRequestBody
) -> AnnotateSpanDocumentsResponseBody:
    if not request_body.data:
        return AnnotateSpanDocumentsResponseBody(data=[])

    return AnnotateSpanDocumentsResponseBody(data=[])
