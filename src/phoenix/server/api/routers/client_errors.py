"""Endpoint through which clients report errors to the server log."""

import logging
import re
from typing import Annotated, Optional
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, StringConstraints, model_validator
from starlette.status import HTTP_204_NO_CONTENT

from phoenix.config import get_env_disable_rate_limit
from phoenix.server.bearer_auth import is_authenticated
from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_ip_rate_limiter
from phoenix.server.utils import get_root_path

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


def route_path(url: Optional[str], *, root_path: str) -> Optional[str]:
    """The app route the browser was on, without origin, query, fragment or root path."""
    if url is None:
        return None
    try:
        path = urlsplit(url).path
    except ValueError:
        return None
    if root_path and (path == root_path or path.startswith(f"{root_path}/")):
        path = path[len(root_path) :] or "/"
    return path


def strip_origins(text: Optional[str], *, root_path: str) -> Optional[str]:
    """Reduce every absolute URL in free text to a path without the root path.

    Browser stack frames and fetch failures name script and request URLs in full,
    and the root path segment identifies the deployment they came from.
    """
    if text is None:
        return None
    pattern = r"https?://[^\s/'\")]+"
    if root_path:
        pattern += f"(?:{re.escape(root_path)}(?=/|$))?"
    return re.sub(pattern, "", text)


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
    async def report_client_error(report: ErrorReport, request: Request) -> Response:
        root_path = get_root_path(request.scope)
        report = report.model_copy(
            update={
                "url": route_path(report.url, root_path=root_path),
                "message": strip_origins(report.message, root_path=root_path),
                "stack": strip_origins(report.stack, root_path=root_path),
            }
        )
        logger.error(
            "Client error at %s: %s",
            report.url or "<unknown url>",
            report.message,
            extra=report.log_extra(),
        )
        return Response(status_code=HTTP_204_NO_CONTENT)

    return router
