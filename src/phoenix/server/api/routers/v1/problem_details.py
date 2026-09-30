"""RFC 9457 problem details for the /v1 routers that opt in.

A router opts in with ``APIRouter(route_class=ProblemDetailsRoute)``. Its request validation
failures, domain errors, and HTTP errors are rendered as ``application/problem+json`` bodies
that carry a stable ``code``; 401 is left to the application's handler, which adds the
authentication challenge.
"""

from collections.abc import Callable, Coroutine
from http import HTTPStatus
from typing import Any, Literal, Optional, Union

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
"""Stable machine-readable error codes, kept as a `Literal` so the server itself can only ever
construct a known value. The wire model publishes `code` as a plain string instead of this
enum, since a future code is additive and a client should fall back to `status` for one it
doesn't recognize."""

_TITLE_BY_CODE: dict[ProblemCode, str] = {
    "validation_error": "Validation error",
    "invalid_argument": "Invalid argument",
    "not_found": "Not found",
    "already_exists": "Already exists",
    "conflict": "Conflict",
    "forbidden": "Forbidden",
    "insufficient_storage": "Insufficient storage",
    "error": "Error",
}

_CODE_BY_STATUS: dict[int, ProblemCode] = {
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "invalid_argument",
    507: "insufficient_storage",
}


@register_openapi_schema
class ProblemFieldError(V1RoutesBaseModel):
    field: str = Field(
        description=(
            "Normalized dotted path of the offending input: body, query, or path, followed by "
            "the field's own path (array indices are numeric segments). Discriminated-union tags "
            "and validator wrapper names are stripped, e.g. body.name rather than body.code.name."
        )
    )
    code: str = Field(
        description=(
            "One of missing, unknown_field, wrong_type, pattern, too_short, too_long, "
            "out_of_range, invalid_choice, or invalid."
        )
    )
    message: str


class BindingCounts(V1RoutesBaseModel):
    project: int
    dataset: int


@register_openapi_schema
class ProblemDetail(V1RoutesBaseModel):
    type: str = Field(description="urn:phoenix:problem:<code>, e.g. urn:phoenix:problem:conflict.")
    title: str = Field(description="A fixed title for `code`, e.g. 'Already exists'.")
    status: int
    detail: str = Field(description="What went wrong and, where possible, how to fix it.")
    code: str = Field(
        description=(
            "Stable machine-readable code: validation_error, invalid_argument, not_found, "
            "already_exists, conflict, forbidden, insufficient_storage, or error. A future "
            "code is additive; treat one you don't recognize by `status`."
        )
    )
    reason: Optional[str] = Field(
        default=None,
        description=(
            "A finer condition under `code`, e.g. still_bound or version_mismatch. New reasons "
            "may appear; treat one you don't recognize by `code`."
        ),
    )
    errors: Optional[list[ProblemFieldError]] = Field(
        default=None, description="Every invalid input, for validation_error."
    )
    existing_id: Optional[str] = Field(
        default=None,
        description="For already_exists: the GlobalID of the resource that holds the name.",
    )
    current_version_id: Optional[str] = Field(
        default=None,
        description=(
            "For version_mismatch: the GlobalID of the version actually current, or null when "
            "the evaluator has none yet. Re-read the evaluator and reconcile before retrying; "
            "don't replace the expected version blindly."
        ),
    )
    binding_counts: Optional[BindingCounts] = Field(
        default=None,
        description=(
            "For still_bound: how many project and dataset bindings still refuse the delete."
        ),
    )
    dataset_evaluator_ids: Optional[list[str]] = Field(
        default=None,
        description=(
            "For incompatible_override: GlobalIDs of the dataset bindings whose output "
            "overrides no longer fit the evaluator's prompt."
        ),
    )


class ProblemException(Exception):
    """An error rendered as problem details by ``ProblemDetailsRoute``."""

    def __init__(
        self,
        status: int,
        code: ProblemCode,
        detail: str,
        *,
        reason: Optional[str] = None,
        errors: Optional[list[ProblemFieldError]] = None,
        existing_id: Optional[str] = None,
        current_version_id: Optional[str] = None,
        binding_counts: Optional[BindingCounts] = None,
        dataset_evaluator_ids: Optional[list[str]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> None:
        super().__init__(detail)
        self.problem = ProblemDetail(
            type=f"urn:phoenix:problem:{code}",
            title=_TITLE_BY_CODE[code],
            status=status,
            detail=detail,
            code=code,
            reason=reason,
            errors=errors,
            existing_id=existing_id,
            current_version_id=current_version_id,
            binding_counts=binding_counts,
            dataset_evaluator_ids=dataset_evaluator_ids,
        )
        self.headers = headers


def problem_response(exc: ProblemException) -> Response:
    return JSONResponse(
        exc.problem.model_dump(exclude_none=True),
        status_code=exc.problem.status,
        media_type=PROBLEM_JSON,
        headers=exc.headers,
    )


_UNION_TAGS = frozenset({"llm", "code", "version", "latest"})
"""Discriminator tag values used by the opted-in routers' `Field(discriminator="type")` unions.
A tagged union's error `loc` repeats the tag as a path segment (e.g. `body.code.name`) even
though it names no real field, so `_normalize_field_path` drops it."""

_CODE_BY_ERROR_TYPE: dict[str, str] = {
    "missing": "missing",
    "extra_forbidden": "unknown_field",
    "string_pattern_mismatch": "pattern",
    "string_too_short": "too_short",
    "too_short": "too_short",
    "string_too_long": "too_long",
    "too_long": "too_long",
    "greater_than": "out_of_range",
    "greater_than_equal": "out_of_range",
    "less_than": "out_of_range",
    "less_than_equal": "out_of_range",
    "literal_error": "invalid_choice",
    "union_tag_invalid": "invalid_choice",
    "union_tag_not_found": "invalid_choice",
    "enum": "invalid_choice",
}
_WRONG_TYPE_SUFFIXES = ("_type", "_parsing")


def _field_error_code(error_type: str) -> str:
    """Map a Pydantic error `type` to our own small vocabulary, per `ProblemFieldError.code`."""
    if error_type in _CODE_BY_ERROR_TYPE:
        return _CODE_BY_ERROR_TYPE[error_type]
    if error_type.endswith(_WRONG_TYPE_SUFFIXES) or error_type == "json_invalid":
        return "wrong_type"
    return "invalid"


def _normalize_field_path(loc: tuple[Union[str, int], ...]) -> str:
    """`("body", "code", "name")` becomes `body.name`: the location prefix (body, query, or
    path) stays, but a discriminated union's tag value along the way names no real field."""
    if not loc:
        return ""
    location, *rest = loc
    segments = [str(location)]
    segments.extend(
        str(part) for part in rest if not (isinstance(part, str) and part in _UNION_TAGS)
    )
    return ".".join(segments)


def _validation_problem(exc: RequestValidationError) -> ProblemException:
    errors = [
        ProblemFieldError(
            field=_normalize_field_path(tuple(error.get("loc", ()))),
            code=_field_error_code(str(error.get("type", ""))),
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
