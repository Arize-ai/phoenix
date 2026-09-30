"""RFC 9457 problem details for the /v1 routers that opt in.

A router opts in with ``APIRouter(route_class=ProblemDetailsRoute)``. Its request validation
failures, domain errors, and HTTP errors are rendered as ``application/problem+json`` bodies
that carry a stable ``code``; 401 is left to the application's handler, which adds the
authentication challenge.
"""

from collections.abc import Callable, Coroutine
from http import HTTPStatus
from typing import Any, Literal, Optional

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import Field
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from phoenix.server.api.openapi.registry import register_openapi_schema
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import Responses

PROBLEM_JSON = "application/problem+json"

ProblemCode = Literal[
    "validation_error",
    "invalid_argument",
    "not_found",
    "already_exists",
    "conflict",
    "forbidden",
    "insufficient_storage",
    "error",
]
"""Stable machine-readable error codes. Clients should treat an unrecognized code by its
status."""

_CODE_BY_STATUS: dict[int, ProblemCode] = {
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "invalid_argument",
    507: "insufficient_storage",
}


@register_openapi_schema
class ProblemFieldError(V1RoutesBaseModel):
    field: str = Field(description="Dotted path of the offending input, e.g. body.name.")
    code: str = Field(description="Machine-readable reason, e.g. missing or string_pattern.")
    message: str


@register_openapi_schema
class ProblemDetail(V1RoutesBaseModel):
    type: str = Field(default="about:blank")
    title: str = Field(description="The HTTP status phrase.")
    status: int
    detail: str = Field(description="What went wrong and, where possible, how to fix it.")
    code: ProblemCode
    errors: Optional[list[ProblemFieldError]] = Field(
        default=None, description="Every invalid input, for validation errors."
    )
    existing_id: Optional[str] = Field(
        default=None,
        description="For already_exists: the GlobalID of the resource that holds the name.",
    )


class ProblemException(Exception):
    """An error rendered as problem details by ``ProblemDetailsRoute``."""

    def __init__(
        self,
        status: int,
        code: ProblemCode,
        detail: str,
        *,
        errors: Optional[list[ProblemFieldError]] = None,
        existing_id: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> None:
        super().__init__(detail)
        self.problem = ProblemDetail(
            title=HTTPStatus(status).phrase,
            status=status,
            detail=detail,
            code=code,
            errors=errors,
            existing_id=existing_id,
        )
        self.headers = headers


def problem_response(exc: ProblemException) -> Response:
    return JSONResponse(
        exc.problem.model_dump(exclude_none=True),
        status_code=exc.problem.status,
        media_type=PROBLEM_JSON,
        headers=exc.headers,
    )


def _validation_problem(exc: RequestValidationError) -> ProblemException:
    errors = [
        ProblemFieldError(
            field=".".join(str(part) for part in error.get("loc", ())),
            code=str(error.get("type", "invalid")),
            message=str(error.get("msg", "")),
        )
        for error in exc.errors()
    ]
    return ProblemException(
        422,
        "validation_error",
        "The request does not match the schema; see errors for each invalid input.",
        errors=errors,
    )


class ProblemDetailsRoute(APIRoute):
    """Render this route's errors as problem details."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def route_handler(request: Request) -> Response:
            try:
                return await handler(request)
            except RequestValidationError as exc:
                return problem_response(_validation_problem(exc))
            except ProblemException as exc:
                return problem_response(exc)
            except HTTPException as exc:
                if exc.status_code == 401:
                    raise
                return problem_response(
                    ProblemException(
                        exc.status_code,
                        _CODE_BY_STATUS.get(exc.status_code, "error"),
                        str(exc.detail),
                        headers=dict(exc.headers) if exc.headers else None,
                    )
                )

        return route_handler


def problem_responses(status_codes: list[int]) -> Responses:
    """Declare error responses whose bodies are problem details."""
    return {
        status: {
            "description": HTTPStatus(status).phrase,
            "content": {PROBLEM_JSON: {"schema": {"$ref": "#/components/schemas/ProblemDetail"}}},
        }
        for status in status_codes
    }
