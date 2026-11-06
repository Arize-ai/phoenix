from enum import Enum

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON


@strawberry.enum
class OpenAIApiType(Enum):
    """
    Which OpenAI API surface a request targets — Chat Completions
    (chat.completions.create) or Responses (responses.create).

    The two APIs have structurally different `tools` payloads. Chat Completions
    only accepts function tools (`{ type: "function", function: {...} }`).
    Responses also accepts built-in tools whose `type` is something else (e.g.
    `web_search`, `file_search`, `computer_use_preview`). Phoenix uses this
    enum to route a prompt to the right SDK call and to fetch the right set
    of supported invocation parameters.
    """

    CHAT_COMPLETIONS = strawberry.enum_value(
        "chat_completions",
        description=(
            "OpenAI Chat Completions API. Only function tools are supported; "
            "built-in tools (web_search etc.) are not."
        ),
    )
    RESPONSES = strawberry.enum_value(
        "responses",
        description=(
            "OpenAI Responses API. Accepts both function tools and built-in "
            "tools (web_search, file_search, computer_use_preview, ...) as "
            "vendor passthrough."
        ),
    )


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
