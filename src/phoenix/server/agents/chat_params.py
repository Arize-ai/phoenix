"""Request schemas for the ``/chat`` endpoint.

Discriminated on ``provider_type``: ``"custom"`` selects a stored
``GenerativeModelCustomProvider`` record; ``"builtin"`` selects a Phoenix-
managed provider with credentials from the secret store or environment.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, RootModel

from phoenix.db.types.model_provider import ModelProvider


class CustomProviderChatSearchParams(BaseModel):
    """Chat against a stored custom provider record (``provider_id`` is its
    relay GlobalID). Model selection and credentials are resolved from the
    encrypted provider config."""

    provider_type: Literal["custom"]
    provider_id: str
    model_name: str


class BuiltInProviderChatSearchParams(BaseModel):
    """Chat against a Phoenix built-in provider.

    Credentials are resolved from the secret store first, then from the
    environment. ``base_url``, ``endpoint``, ``region``, and
    ``custom_headers`` override the defaults baked into ``model_factory``.
    ``openai_api_type`` is honoured by the OpenAI and Azure OpenAI
    branches; other providers ignore it.
    """

    provider_type: Literal["builtin"]
    provider: ModelProvider
    model_name: str
    base_url: str | None = None
    endpoint: str | None = None
    region: str | None = None
    custom_headers: dict[str, str] | None = None
    openai_api_type: Literal["chat_completions", "responses"] = "responses"


ChatSearchParams = Annotated[
    CustomProviderChatSearchParams | BuiltInProviderChatSearchParams,
    Field(..., discriminator="provider_type"),
]


class ChatSearchParamsModel(RootModel[ChatSearchParams]):
    """Wrapper that lets FastAPI parse the discriminated union from query
    params via ``Annotated[..., Query()]``."""

    root: ChatSearchParams
