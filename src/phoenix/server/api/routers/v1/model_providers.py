from datetime import datetime
from typing import Annotated, Literal, Optional, Union

from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.config import get_env_allowed_providers
from phoenix.db import models
from phoenix.db.models import GenerativeModelSDK
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider as GenerativeModelCustomProviderNodeType,
)

router = APIRouter(tags=["model_providers"])


class BuiltInModelProvider(V1RoutesBaseModel):
    kind: Literal["builtin"] = "builtin"
    provider_key: str = Field(
        ...,
        description="The stable key identifying the built-in provider family (e.g. 'OPENAI').",
    )
    name: str = Field(
        ...,
        description="The human-readable name of the provider family (e.g. 'OpenAI').",
    )


class CustomModelProvider(V1RoutesBaseModel):
    kind: Literal["custom"] = "custom"
    id: str = Field(..., description="The ID of the custom provider.")
    name: str = Field(..., description="The unique name of the custom provider.")
    description: Optional[str] = Field(
        default=None,
        description="An optional description of the custom provider.",
    )
    provider: str = Field(..., description="The provider label of the custom provider.")
    sdk: GenerativeModelSDK = Field(
        ...,
        description="The SDK used to communicate with the custom provider.",
    )
    created_at: datetime = Field(..., description="The time the custom provider was created.")
    updated_at: datetime = Field(..., description="The time the custom provider was last updated.")


ModelProviderEntry = Annotated[
    Union[BuiltInModelProvider, CustomModelProvider],
    Field(discriminator="kind"),
]


class GetModelProvidersResponseBody(PaginatedResponseBody[ModelProviderEntry]):
    pass


@router.get(
    "/model_providers",
    operation_id="getModelProviders",
    summary="List all model providers",  # noqa: E501
    description="Retrieve the built-in model provider families along with a paginated list of user-defined custom providers. Built-in families are a fixed set and are only returned on the first page, i.e. when no `cursor` is supplied; `cursor`, `next_cursor`, and `limit` apply exclusively to the custom-provider portion of the list. Encrypted custom-provider credentials are never returned.",  # noqa: E501
    response_description="A list of model providers with pagination information",  # noqa: E501
    responses=add_errors_to_responses(
        [
            422,
        ]
    ),
)
async def get_model_providers(
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
) -> GetModelProvidersResponseBody:
    """
    Retrieve the list of model providers.

    Two kinds of entry are returned, discriminated by the `kind` field:

    - `builtin`: the fixed set of provider families Phoenix ships with. These are
      read-only and are not backed by database rows, so they cannot be
      cursor-paginated. They are therefore emitted in full, and only on the first
      page, i.e. when no `cursor` query parameter is supplied.
    - `custom`: user-defined providers stored in the database. These are the only
      entries `cursor`, `next_cursor`, and `limit` apply to.

    The encrypted `config` column holding custom-provider credentials is never
    included in the response.

    Args:
        request (Request): The FastAPI request object.
        cursor (Optional[str]): Pagination cursor (custom provider ID).
        limit (int): Maximum number of custom providers to return per request.

    Returns:
        GetModelProvidersResponseBody: Response containing the model providers and
            pagination information.

    Raises:
        HTTPException: If the cursor format is invalid.
    """  # noqa: E501
    data: list[ModelProviderEntry] = []
    if not cursor:
        allowed_provider_names = get_env_allowed_providers()
        provider_keys = PLAYGROUND_CLIENT_REGISTRY.list_all_providers()
        if allowed_provider_names is not None:
            provider_keys = [
                provider_key
                for provider_key in provider_keys
                if provider_key.name in allowed_provider_names
            ]
        data.extend(
            BuiltInModelProvider(provider_key=provider_key.name, name=provider_key.value)
            for provider_key in provider_keys
        )

    stmt = select(models.GenerativeModelCustomProvider).order_by(
        models.GenerativeModelCustomProvider.id.desc()
    )
    async with request.app.state.db() as session:
        if cursor:
            try:
                cursor_id = GlobalID.from_id(cursor).node_id
                stmt = stmt.filter(models.GenerativeModelCustomProvider.id <= int(cursor_id))
            except ValueError:
                raise HTTPException(
                    detail=f"Invalid cursor format: {cursor}",
                    status_code=422,
                )

        stmt = stmt.limit(limit + 1)
        custom_providers = (await session.scalars(stmt)).all()

        next_cursor = None
        if len(custom_providers) == limit + 1:
            last_custom_provider = custom_providers[-1]
            next_cursor = str(
                GlobalID(
                    GenerativeModelCustomProviderNodeType.__name__,
                    str(last_custom_provider.id),
                )
            )
            custom_providers = custom_providers[:-1]

        data.extend(
            _to_custom_provider_response(custom_provider) for custom_provider in custom_providers
        )
    return GetModelProvidersResponseBody(next_cursor=next_cursor, data=data)


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
