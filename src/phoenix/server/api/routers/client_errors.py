"""Endpoint through which clients report errors to the server log."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, StringConstraints, model_validator
from starlette.status import HTTP_204_NO_CONTENT

from phoenix.config import get_env_disable_rate_limit
from phoenix.server.bearer_auth import is_authenticated
from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_ip_rate_limiter

logger = logging.getLogger("phoenix.client_errors")


class ErrorReport(BaseModel):
    message: Annotated[str, StringConstraints(min_length=1)]
    stack: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None
    attributes: dict[str, str] = {}

    @model_validator(mode="after")
    def reject_null_bytes(self) -> "ErrorReport":
        for field_name, value in self:
            if isinstance(value, str) and "\x00" in value:
                raise ValueError(f"{field_name} must not contain null bytes")
        for key, value in self.attributes.items():
            if "\x00" in key or "\x00" in value:
                raise ValueError("attributes must not contain null bytes")
        return self

    def log_extra(self) -> dict[str, str]:
        fields = self.model_dump(exclude_none=True, exclude={"attributes"})
        return {
            **{f"error.{field_name}": value for field_name, value in fields.items()},
            **{f"error.attributes.{key}": value for key, value in self.attributes.items()},
        }


rate_limiter = ServerRateLimiter(
    per_second_rate_limit=1,
    enforcement_window_seconds=20,
    partition_seconds=60,
    active_partitions=2,
)

rate_limit_dependencies = (
    [] if get_env_disable_rate_limit() else [Depends(fastapi_ip_rate_limiter(rate_limiter))]
)


def create_client_errors_router(authentication_enabled: bool) -> APIRouter:
    dependencies = list(rate_limit_dependencies)
    if authentication_enabled:
        dependencies.append(Depends(is_authenticated))
    router = APIRouter(include_in_schema=False, dependencies=dependencies)

    @router.post("/client_errors", status_code=HTTP_204_NO_CONTENT)
    async def report_client_error(report: ErrorReport) -> Response:
        logger.error(
            "Client error at %s: %s",
            report.url or "<unknown url>",
            report.message,
            extra=report.log_extra(),
        )
        return Response(status_code=HTTP_204_NO_CONTENT)

    return router
