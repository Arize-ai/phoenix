from enum import Enum

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON


@strawberry.enum
class OpenAIApiType(Enum):
    """Chat Completions (chat.completions.create) or Responses API (responses.create)."""

    CHAT_COMPLETIONS = "chat_completions"
    RESPONSES = "responses"


@strawberry.input
class BuiltinClientOptionsInput:
    """Options for built-in provider client (env/secrets still used for the rest)."""

    base_url: str | None = UNSET
    endpoint: str | None = UNSET  # Azure
    region: str | None = UNSET  # AWS
    custom_headers: JSON | None = UNSET
    openai_api_type: OpenAIApiType | None = UNSET


@strawberry.input
class CustomClientOptionsInput:
    """Options for custom provider client."""

    extra_headers: JSON | None = UNSET


@strawberry.input(one_of=True)
class ModelClientOptionsInput:
    """Optional client options. Applied based on prompt_version (builtin vs custom)."""

    builtin: BuiltinClientOptionsInput | None = UNSET
    custom: CustomClientOptionsInput | None = UNSET
