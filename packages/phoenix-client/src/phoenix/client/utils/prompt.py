from __future__ import annotations

from types import MappingProxyType
from typing import Any, Literal, Mapping, Optional, cast

from typing_extensions import TypeAlias, assert_never

from phoenix.client.__generated__.v1 import PromptVersion
from phoenix.client.helpers.sdk.anthropic.messages import (
    to_chat_messages_and_kwargs as to_messages_anthropic,  # pyright: ignore[reportUnknownVariableType]
)
from phoenix.client.helpers.sdk.google_generativeai.generate_content import (
    to_chat_messages_and_kwargs as to_messages_google_generativeai,  # pyright: ignore[reportUnknownVariableType]
)
from phoenix.client.helpers.sdk.openai.chat import (
    to_chat_messages_and_kwargs as to_messages_openai,  # pyright: ignore[reportUnknownVariableType]
)
from phoenix.client.utils.template_formatters import TemplateFormatter

SDK: TypeAlias = Literal[
    "anthropic",  # https://pypi.org/project/anthropic/
    "google_generativeai",  # https://pypi.org/project/google-generativeai/
    "openai",  # https://pypi.org/project/openai/
]


def to_chat_messages_and_kwargs(
    obj: PromptVersion,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
    sdk: Optional[SDK] = None,
    **kwargs: Any,
) -> tuple[list[Any], dict[str, Any]]:
    """Convert a PromptVersion to a list of messages and model invocation keyword arguments.

    Args:
        obj: The PromptVersion object to convert.
        variables: The variables to substitute in the PromptVersion.

    Returns:
        A tuple containing the list of messages and the model invocation keyword arguments.
    """
    sdk = sdk or _to_sdk(obj["model_provider"])
    if sdk == "openai":
        return cast(
            tuple[list[Any], dict[str, Any]],
            to_messages_openai(
                obj,
                variables=variables,
                formatter=formatter,
                **kwargs,
            ),
        )
    if sdk == "anthropic":
        return cast(
            tuple[list[Any], dict[str, Any]],
            to_messages_anthropic(
                obj,
                variables=variables,
                formatter=formatter,
                **kwargs,
            ),
        )
    if sdk == "google_generativeai":
        return cast(
            tuple[list[Any], dict[str, Any]],
            to_messages_google_generativeai(
                obj,
                variables=variables,
                formatter=formatter,
                **kwargs,
            ),
        )
    assert_never(sdk)


def _to_sdk(
    model_provider: Literal[
        "OPENAI",
        "AZURE_OPENAI",
        "ANTHROPIC",
        "GEMINI",
    ],
) -> SDK:
    if model_provider == "OPENAI":
        return "openai"
    if model_provider == "AZURE_OPENAI":
        return "openai"
    if model_provider == "ANTHROPIC":
        return "anthropic"
    if model_provider == "GEMINI":
        return "google_generativeai"
    raise ValueError(f"Unknown model provider: {model_provider}")
