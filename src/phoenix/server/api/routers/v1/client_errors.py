"""REST endpoint through which the browser app reports uncaught errors to the server log."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Response
from pydantic import Field, StringConstraints, model_validator
from starlette.status import HTTP_204_NO_CONTENT

from phoenix.config import get_env_disable_rate_limit
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import add_errors_to_responses
from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_ip_rate_limiter

logger = logging.getLogger("phoenix.client_errors")

router = APIRouter(tags=["client_errors"])

MESSAGE_MAX_LENGTH = 2_000
STACK_MAX_LENGTH = 16_000
URL_MAX_LENGTH = 2_000
USER_AGENT_MAX_LENGTH = 512
PLATFORM_VERSION_MAX_LENGTH = 64

ShortText = Annotated[str, StringConstraints(max_length=MESSAGE_MAX_LENGTH)]
StackText = Annotated[str, StringConstraints(max_length=STACK_MAX_LENGTH)]


class ClientError(V1RoutesBaseModel):
    message: Annotated[str, StringConstraints(min_length=1, max_length=MESSAGE_MAX_LENGTH)]
    stack: Optional[StackText] = None
    component_stack: Optional[StackText] = Field(
        default=None,
        description="The React component stack, when the error was caught by an error boundary.",
    )
    url: Optional[Annotated[str, StringConstraints(max_length=URL_MAX_LENGTH)]] = Field(
        default=None,
        description="The route the app was displaying when the error occurred.",
    )
    user_agent: Optional[Annotated[str, StringConstraints(max_length=USER_AGENT_MAX_LENGTH)]] = None
    platform_version: Optional[
        Annotated[str, StringConstraints(max_length=PLATFORM_VERSION_MAX_LENGTH)]
    ] = Field(default=None, description="The Phoenix version the app was built from.")

    @model_validator(mode="after")
    def reject_null_bytes(self) -> "ClientError":
        for field_name, value in self:
            if isinstance(value, str) and "\x00" in value:
                raise ValueError(f"{field_name} must not contain null bytes")
        return self


rate_limiter = ServerRateLimiter(
    per_second_rate_limit=1,
    enforcement_window_seconds=20,
    partition_seconds=60,
    active_partitions=2,
)

rate_limit_dependencies = (
    [] if get_env_disable_rate_limit() else [Depends(fastapi_ip_rate_limiter(rate_limiter))]
)


@router.post(
    "/client_errors",
    operation_id="reportClientError",
    summary="Report an uncaught error from the browser app",
    description=(
        "Writes the error to the server log so operators can see failures that would "
        "otherwise be visible only in the user's browser console."
    ),
    status_code=HTTP_204_NO_CONTENT,
    dependencies=rate_limit_dependencies,
    responses=add_errors_to_responses(
        [
            {"status_code": 422, "description": "The report is malformed or exceeds size limits"},
            {"status_code": 429, "description": "Too many reports from this client"},
        ]
    ),
)
async def report_client_error(error: ClientError) -> Response:
    logger.error(
        "Client error at %s: %s",
        error.url or "<unknown route>",
        error.message,
        extra={
            f"client_error.{field_name}": value
            for field_name, value in error.model_dump(exclude_none=True).items()
        },
    )
    return Response(status_code=HTTP_204_NO_CONTENT)
