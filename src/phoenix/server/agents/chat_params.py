"""Request schemas for the ``/chat`` endpoints.

The chat routes accept a discriminated payload as flat query parameters.
``parse_chat_search_params`` is the FastAPI dependency that collects the
flat inputs and delegates to ``ChatSearchParamsModel`` for the
discriminator-based validation; downstream code consumes the resolved
``ChatSearchParams`` variant directly.
"""

from typing import Annotated, Literal

from fastapi import HTTPException, Query
from pydantic import BaseModel, Field, RootModel, ValidationError

from phoenix.db.types.model_provider import ModelProvider


class CustomProviderChatSearchParams(BaseModel):
    """Chat against a stored custom provider record."""

    provider_type: Literal["custom"]
    provider_id: str
    model_name: str


class BuiltInProviderChatSearchParams(BaseModel):
    """Chat against a Phoenix built-in provider.

    Credentials and connection details (base URL, Azure endpoint, AWS
    region) are resolved from the secret store first and the process
    environment second. ``openai_api_type`` is honoured by the OpenAI and
    Azure OpenAI branches; other providers ignore it.
    """

    provider_type: Literal["builtin"]
    provider: ModelProvider
    model_name: str
    openai_api_type: Literal["chat_completions", "responses"] = "responses"


ChatSearchParams = Annotated[
    CustomProviderChatSearchParams | BuiltInProviderChatSearchParams,
    Field(..., discriminator="provider_type"),
]


class ChatSearchParamsModel(RootModel[ChatSearchParams]):
    """Discriminator-aware wrapper used to validate the chat payload from
    a flat dict of query parameters."""

    root: ChatSearchParams


def parse_chat_search_params(
    provider_type: Annotated[Literal["custom", "builtin"], Query()],
    model_name: Annotated[str, Query()],
    provider_id: Annotated[str | None, Query()] = None,
    provider: Annotated[ModelProvider | None, Query()] = None,
    openai_api_type: Annotated[Literal["chat_completions", "responses"], Query()] = "responses",
) -> ChatSearchParams:
    try:
        return ChatSearchParamsModel.model_validate(
            {
                "provider_type": provider_type,
                "model_name": model_name,
                "provider_id": provider_id,
                "provider": provider,
                "openai_api_type": openai_api_type,
            }
        ).root
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
