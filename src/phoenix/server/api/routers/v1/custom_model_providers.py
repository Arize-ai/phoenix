from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.models import GenerativeModelSDK
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider as GenerativeModelCustomProviderNodeType,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type

router = APIRouter(tags=["model_providers"])


class CustomModelProvider(V1RoutesBaseModel):
    id: str = Field(..., description="The ID of the custom provider.")
    name: str = Field(..., description="The unique name of the custom provider.")
    description: Optional[str] = Field(
        default=None,
        description="An optional description of the custom provider.",
    )
    provider: str = Field(
        ...,
        description=(
            "The free-form provider label recorded on the custom provider. Unlike the "
            "`provider` of a built-in family, this is not drawn from a fixed set."
        ),
    )
    sdk: GenerativeModelSDK = Field(
        ...,
        description="The SDK used to communicate with the custom provider.",
    )
    created_at: datetime = Field(..., description="The time the custom provider was created.")
    updated_at: datetime = Field(..., description="The time the custom provider was last updated.")


class GetCustomModelProvidersResponseBody(PaginatedResponseBody[CustomModelProvider]):
    pass


@router.get(
    "/custom_model_providers",
    operation_id="getCustomModelProviders",
    summary="List custom model providers",
    description="Retrieve a paginated list of user-defined custom model providers. Encrypted provider credentials are never returned. Built-in provider families are listed separately by `GET /v1/model_providers`.",  # noqa: E501
    response_description="A list of custom model providers with pagination information",
    responses=add_errors_to_responses(
        [
            422,
        ]
    ),
)
async def get_custom_model_providers(
    request: Request,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (custom provider ID)",
    ),
    limit: int = Query(
        default=100,
        description="The max number of custom providers to return at a time.",
        gt=0,
    ),
) -> GetCustomModelProvidersResponseBody:
    """
    Retrieve a page of user-defined custom model providers.

    The encrypted `config` column holding provider credentials is never returned.

    Raises:
        HTTPException: If the cursor format is invalid.
    """
    stmt = select(models.GenerativeModelCustomProvider).order_by(
        models.GenerativeModelCustomProvider.id.desc()
    )
    if cursor:
        try:
            cursor_id = from_global_id_with_expected_type(
                GlobalID.from_id(cursor),
                GenerativeModelCustomProviderNodeType.__name__,
            )
        except ValueError:
            raise HTTPException(
                detail=f"Invalid cursor format: {cursor}",
                status_code=422,
            )
        stmt = stmt.filter(models.GenerativeModelCustomProvider.id <= cursor_id)

    stmt = stmt.limit(limit + 1)  # overfetch by 1 to check whether there are more results
    async with request.app.state.db() as session:
        custom_providers = (await session.scalars(stmt)).all()

    next_cursor = None
    if len(custom_providers) == limit + 1:
        next_cursor = str(
            GlobalID(
                GenerativeModelCustomProviderNodeType.__name__,
                str(custom_providers[-1].id),
            )
        )
        custom_providers = custom_providers[:-1]

    return GetCustomModelProvidersResponseBody(
        next_cursor=next_cursor,
        data=[
            _to_custom_provider_response(custom_provider) for custom_provider in custom_providers
        ],
    )


def _to_custom_provider_response(
    custom_provider: models.GenerativeModelCustomProvider,
) -> CustomModelProvider:
    return CustomModelProvider(
        id=str(GlobalID(GenerativeModelCustomProviderNodeType.__name__, str(custom_provider.id))),
        name=custom_provider.name,
        description=custom_provider.description,
        provider=custom_provider.provider,
        sdk=custom_provider.sdk,
        created_at=custom_provider.created_at,
        updated_at=custom_provider.updated_at,
    )
