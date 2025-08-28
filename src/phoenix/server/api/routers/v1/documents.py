from fastapi import APIRouter, Depends
from pydantic import Field
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND

from phoenix.server.authorization import is_not_locked

from .models import V1RoutesBaseModel
from .utils import ResponseBody, add_errors_to_responses

router = APIRouter(tags=["documents"])


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
async def annotate_span_documents(request: Request) -> AnnotateSpanDocumentsResponseBody:
    return AnnotateSpanDocumentsResponseBody(data=[])
