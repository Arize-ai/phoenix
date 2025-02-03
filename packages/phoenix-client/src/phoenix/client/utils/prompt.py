from __future__ import annotations

from types import MappingProxyType
from typing import Any, Literal, Mapping, Optional, cast

from typing_extensions import TypeAlias, assert_never

from phoenix.client.__generated__.v1 import PromptVersion
from phoenix.client.helpers.sdk.anthropic.messages import (
    to_chat_messages_and_kwargs as to_messages_anthropic,  # pyright: ignore[reportUnknownVariableType]
)
from phoenix.client.helpers.sdk.openai.chat import (
    to_chat_messages_and_kwargs as to_messages_openai,  # pyright: ignore[reportUnknownVariableType]
)
from phoenix.client.utils.template_formatters import TemplateFormatter

SDK: TypeAlias = Literal[
    "anthropic",  # https://pypi.org/project/anthropic/
    "azure_ai_inference",  # https://pypi.org/project/azure-ai-inference/
    "bedrock",  # https://pypi.org/project/boto3/
    "cohere",  # https://pypi.org/project/cohere/
    "google_generativeai",  # https://pypi.org/project/google-generativeai/
    "huggingface_hub",  # https://pypi.org/project/huggingface-hub/
    "mistralai",  # https://pypi.org/project/mistralai/
    "openai",  # https://pypi.org/project/openai/
    "vertexai",  # https://pypi.org/project/vertexai/
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
    sdk = sdk or _to_sdk(obj["model_provider"])
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
    if sdk == "google_generativeai":
        raise NotImplementedError
    if sdk == "bedrock":
        raise NotImplementedError
    if sdk == "azure_ai_inference":
        raise NotImplementedError
    if sdk == "huggingface_hub":
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
        return "google_generativeai"
    if model_provider == "BEDROCK":
        return "bedrock"
    if model_provider == "COHERE":
        return "cohere"
    if model_provider == "HUGGINGFACE":
        return "huggingface_hub"
    if model_provider == "MISTRALAI":
        return "mistralai"
    if model_provider == "VERTEXAI":
        return "vertexai"
    raise ValueError(f"Unknown model provider: {model_provider}")
