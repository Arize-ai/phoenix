"""List the sandbox configurations code evaluators can run in."""

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.routers.v1.evaluator_common import (
    decode_global_id,
    encode_global_id,
    evaluator_api_errors,
    evaluator_error_responses,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import ProblemDetailsRoute
from phoenix.server.api.routers.v1.utils import PaginatedResponseBody

router = APIRouter(tags=["sandbox_configs"], route_class=ProblemDetailsRoute)


class SandboxConfig(V1RoutesBaseModel):
    id: str = Field(description="GlobalID to pass as a code evaluator's sandbox_config_id.")
    name: Identifier
    description: Optional[str]
    language: models.LanguageName
    backend_type: str
    is_usable: bool = Field(
        description=(
            "Whether code evaluators can be created or deployed in it now: the configuration "
            "and its provider are both enabled."
        )
    )


class SandboxConfigsResponseBody(PaginatedResponseBody[SandboxConfig]):
    pass


@router.get(
    "/sandbox_configs",
    operation_id="getSandboxConfigs",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([422]),
)
async def get_sandbox_configs(
    request: Request,
    language: Optional[models.LanguageName] = Query(
        default=None, description="Return configurations for this language only."
    ),
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> SandboxConfigsResponseBody:
    """List sandbox configurations, newest first. Provider credentials are not returned."""
    with evaluator_api_errors():
        stmt = (
            select(models.SandboxConfig, models.SandboxProvider.enabled)
            .outerjoin(
                models.SandboxProvider,
                models.SandboxProvider.backend_type == models.SandboxConfig.backend_type,
            )
            .order_by(models.SandboxConfig.id.desc())
        )
        if language is not None:
            stmt = stmt.where(models.SandboxConfig.language == language)
        if cursor is not None:
            stmt = stmt.where(models.SandboxConfig.id <= decode_global_id(cursor, "SandboxConfig"))
        async with request.app.state.db.read() as session:
            rows = (await session.execute(stmt.limit(limit + 1))).all()
        next_cursor = (
            encode_global_id("SandboxConfig", rows[-1][0].id) if len(rows) > limit else None
        )
        return SandboxConfigsResponseBody(
            data=[
                SandboxConfig(
                    id=encode_global_id("SandboxConfig", config.id),
                    name=config.name,
                    description=config.description,
                    language=config.language,
                    backend_type=config.backend_type,
                    is_usable=bool(config.enabled and provider_enabled),
                )
                for config, provider_enabled in rows[:limit]
            ],
            next_cursor=next_cursor,
        )
