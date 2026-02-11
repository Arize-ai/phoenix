from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@strawberry.enum
class OpenAIApiType(Enum):
    """Chat Completions (chat.completions.create) or Responses API (responses.create)."""

    CHAT_COMPLETIONS = "chat_completions"
    RESPONSES = "responses"


@strawberry.input
class GenerativeModelBuiltinProviderInput:
    provider_key: GenerativeProviderKey
    name: str
    """ The name of the model. Or the Deployment Name for Azure OpenAI models. """
    base_url: Optional[str] = UNSET
    """ The base URL to use for the model. """
    endpoint: Optional[str] = UNSET
    """ The endpoint to use for the model. Only required for Azure OpenAI models. """
    region: Optional[str] = UNSET
    """ The region to use for the model. """
    custom_headers: Optional[JSON] = UNSET
    """ Custom headers to use for the model. """
    openai_api_type: Optional[OpenAIApiType] = UNSET
    """ For OpenAI/Azure: chat_completions or responses. Required for OpenAI/Azure. """


@strawberry.input
class GenerativeModelCustomProviderInput:
    provider_id: GlobalID
    model_name: str
    extra_headers: Optional[JSON] = UNSET


@strawberry.input(one_of=True)
class GenerativeModelInput:
    builtin: Optional[GenerativeModelBuiltinProviderInput] = UNSET
    custom: Optional[GenerativeModelCustomProviderInput] = UNSET

    def __post_init__(self) -> None:
        if sum(map(bool, [self.custom, self.builtin])) != 1:
            raise ValueError("Exactly one of custom or builtin must be provided")
