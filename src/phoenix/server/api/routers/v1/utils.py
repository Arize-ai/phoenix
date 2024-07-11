from dataclasses import dataclass
from typing import Any, Dict, Generic, List, Optional, TypedDict, Union

from typing_extensions import TypeAlias, TypeVar, assert_never

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


@dataclass
class ResponseWithData(Generic[DataType]):
    """
    A generic response type returned by V1 routes.
    """

    data: DataType


@dataclass
class PaginatedResponseWithData(Generic[DataType]):
    """
    A generic response type returned by paginated V1 routes.
    """

    data: List[DataType]
    next_cursor: Optional[str]


def responses_for_http_exceptions(
    status_codes: List[Union[StatusCode, StatusCodeWithDescription]],
) -> Responses:
    """
    The output of this function can be passed to the `responses` parameter of a
    fastapi route to include status codes raised in a fastapi.HTTPException in
    the generated OpenAPI schema.
    """
    responses: Responses = {}
    for status_code in status_codes:
        if isinstance(status_code, StatusCode):
            responses[status_code] = {"model": HTTPExceptionResponse}
        elif isinstance(status_code, dict):
            responses[status_code["status_code"]] = {
                "model": HTTPExceptionResponse,
                "description": status_code["description"],
            }
        else:
            assert_never(status_code)
    return responses


@dataclass
class HTTPExceptionResponse:
    """
    Represents the response returned when a fastapi.HTTPException is raised in a
    route.

    This type is intended solely for generating error response types in the
    OpenAPI schema via responses_for_http_exceptions.
    """

    detail: Any
