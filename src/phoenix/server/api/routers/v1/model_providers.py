from typing import Literal, Optional

from fastapi import APIRouter, Query
from pydantic import Field
from starlette.requests import Request

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.chat_clients import initialize_chat_clients
from phoenix.server.api.helpers.client_registry import CLIENT_REGISTRY

# The registry is populated as an import side effect of the chat clients
# module; import it explicitly so this router does not depend on the GraphQL
# modules having been imported first.
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody

initialize_chat_clients()

router = APIRouter(tags=["model_providers"])


class BuiltInModelProvider(V1RoutesBaseModel):
    provider: ModelProvider = Field(
        ...,
        description=(
            "The provider family identifier, accepted wherever a built-in model provider of the "
            "listed model type is specified (e.g. 'OPENAI'): prompts and chat completions for "
            "CHAT, decisions for DECISION."
        ),
    )
    name: str = Field(
        ...,
        description="The human-readable name of the provider family (e.g. 'OpenAI').",
    )


class GetModelProvidersResponseBody(ResponseBody[list[BuiltInModelProvider]]):
    pass


@router.get(
    "/model_providers",
    operation_id="getModelProviders",
    summary="List built-in model provider families",
    description="Retrieve the built-in model provider families available to this deployment. Built-in families are a fixed enum rather than stored records, so this list is not paginated; it is narrowed by the PHOENIX_ALLOWED_PROVIDERS environment variable when that is set. By default, or with `model_type=CHAT`, only providers that offer chat models are listed, because that list feeds chat-only surfaces such as prompts and `POST /v1/chat/completions`. With `model_type=DECISION`, the providers that offer decision models are listed instead, for `/v1/decisions`. User-defined providers are listed separately by `GET /v1/custom_model_providers`.",  # noqa: E501
    response_description="A list of built-in model provider families",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def get_model_providers(
    request: Request,
    model_type: Optional[Literal["CHAT", "DECISION"]] = Query(
        default=None,
        description="The kind of model the listed providers offer. Defaults to CHAT.",
    ),
) -> GetModelProvidersResponseBody:
    """
    Retrieve the built-in model provider families available to this deployment.

    Built-in families are a fixed enum, not database rows, so there is nothing to
    paginate. `PHOENIX_ALLOWED_PROVIDERS` narrows the set when it is configured;
    the allow-list is snapshotted at app creation, matching the GraphQL API.
    """
    allowed_provider_names = request.app.state.allowed_provider_names
    provider_keys = CLIENT_REGISTRY.list_allowed_providers(
        allowed_provider_names, model_type="decision" if model_type == "DECISION" else "chat"
    )
    return GetModelProvidersResponseBody(
        data=[
            BuiltInModelProvider(
                provider=provider_key.to_model_provider(),
                name=provider_key.value,
            )
            for provider_key in provider_keys
        ]
    )
