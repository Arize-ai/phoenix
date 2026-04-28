from typing import Annotated, Literal

from pydantic import BaseModel, Field, RootModel

from phoenix.db.types.model_provider import ModelProvider


class CustomProviderChatSearchParams(BaseModel):
    provider_type: Literal["custom"]
    provider_id: str
    model_name: str


class BuiltInProviderChatSearchParams(BaseModel):
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
    root: ChatSearchParams
