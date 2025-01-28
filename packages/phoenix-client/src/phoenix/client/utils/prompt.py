from types import MappingProxyType
from typing import Any, Literal, Mapping, Optional, cast

from typing_extensions import TypeAlias, assert_never

from phoenix.client.__generated__.v1 import PromptVersion
from phoenix.client.helpers.sdk.anthropic.messages import (
    to_chat_messages_and_kwargs as to_messages_anthropic,
)
from phoenix.client.helpers.sdk.openai.chat import to_chat_messages_and_kwargs as to_messages_openai
from phoenix.client.utils.template_formatters import TemplateFormatter

SDK: TypeAlias = Literal[
    "anthropic",
    "bedrock",
    "cohere",
    "google-generativeai",
    "huggingface-hub",
    "mistralai",
    "openai",
    "vertexai",
]


def to_chat_messages_and_kwargs(
    obj: PromptVersion,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
    sdk: Optional[SDK] = None,
    **kwargs: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Convert a PromptVersion to a list of messages and model invocation keyword arguments.

    Args:
        obj: The PromptVersion object to convert.
        variables: The variables to substitute in the PromptVersion.

    Returns:
        A tuple containing the list of messages and the model invocation keyword arguments.
    """
    sdk = sdk or _to_sdk(obj.model_provider)
    if sdk == "openai":
        return cast(
            tuple[list[dict[str, Any]], dict[str, Any]],
            to_messages_openai(
                obj,
                variables=variables,
                formatter=formatter,
                **kwargs,
            ),
        )
    if sdk == "anthropic":
        return cast(
            tuple[list[dict[str, Any]], dict[str, Any]],
            to_messages_anthropic(
                obj,
                variables=variables,
                formatter=formatter,
                **kwargs,
            ),
        )
    if sdk == "google-generativeai":
        raise NotImplementedError
    if sdk == "bedrock":
        raise NotImplementedError
    if sdk == "huggingface-hub":
        raise NotImplementedError
    if sdk == "mistralai":
        raise NotImplementedError
    if sdk == "vertexai":
        raise NotImplementedError
    if sdk == "cohere":
        raise NotImplementedError
    assert_never(sdk)


def _to_sdk(model_provider: str) -> SDK:
    if model_provider == "OPENAI":
        return "openai"
    if model_provider == "ANTHROPIC":
        return "anthropic"
    if model_provider == "GEMINI":
        return "google-generativeai"
    if model_provider == "BEDROCK":
        return "bedrock"
    if model_provider == "COHERE":
        return "cohere"
    if model_provider == "HUGGINGFACE":
        return "huggingface-hub"
    if model_provider == "MISTRALAI":
        return "mistralai"
    if model_provider == "VERTEXAI":
        return "vertexai"
    raise ValueError(f"Unknown model provider: {model_provider}")
