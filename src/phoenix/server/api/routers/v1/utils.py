from typing import Any, Dict, Generic, List, Optional, TypedDict, Union

from typing_extensions import TypeAlias, TypeVar, assert_never

from .pydantic_compat import V1RoutesBaseModel

StatusCode: TypeAlias = int
DataType = TypeVar("DataType")
Responses: TypeAlias = Dict[
    Union[int, str], Dict[str, Any]
]  # input type for the `responses` parameter of a fastapi route


class StatusCodeWithDescription(TypedDict):
    """
    A duck type for a status code with a description detailing under what
    conditions the status code is raised.
    """

    status_code: StatusCode
    description: str


class RequestBody(V1RoutesBaseModel, Generic[DataType]):
    # A generic request type accepted by V1 routes.
    #
    # Don't use """ for this docstring or it will be included as a description
    # in the generated OpenAPI schema.
    data: DataType


class ResponseBody(V1RoutesBaseModel, Generic[DataType]):
    # A generic response type returned by V1 routes.
    #
    # Don't use """ for this docstring or it will be included as a description
    # in the generated OpenAPI schema.

    data: DataType


class PaginatedResponseBody(V1RoutesBaseModel, Generic[DataType]):
    # A generic paginated response type returned by V1 routes.
    #
    # Don't use """ for this docstring or it will be included as a description
    # in the generated OpenAPI schema.

    data: List[DataType]
    next_cursor: Optional[str]


def add_errors_to_responses(
    errors: List[Union[StatusCode, StatusCodeWithDescription]],
    /,
    *,
    responses: Optional[Responses] = None,
) -> Responses:
    """
    Creates or updates a patch for an OpenAPI schema's `responses` section to
    include status codes in the generated OpenAPI schema.
    """
    output_responses: Responses = responses or {}
    for error in errors:
        status_code: int
        description: Optional[str] = None
        if isinstance(error, StatusCode):
            status_code = error
        elif isinstance(error, dict):
            status_code = error["status_code"]
            description = error["description"]
        else:
            assert_never(error)
        if status_code not in output_responses:
            output_responses[status_code] = {
                "content": {"text/plain": {"schema": {"type": "string"}}}
            }
        if description:
            output_responses[status_code]["description"] = description
    return output_responses


def add_text_csv_content_to_responses(
    status_code: StatusCode, /, *, responses: Optional[Responses] = None
) -> Responses:
    """
    Creates or updates a patch for an OpenAPI schema's `responses` section to
    ensure that the response for the given status code is marked as text/csv in
    the generated OpenAPI schema.
    """
    output_responses: Responses = responses or {}
    if status_code not in output_responses:
        output_responses[status_code] = {}
    output_responses[status_code]["content"] = {
        "text/csv": {"schema": {"type": "string", "contentMediaType": "text/csv"}}
    }
    return output_responses
