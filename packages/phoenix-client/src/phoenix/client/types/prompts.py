from __future__ import annotations

from abc import ABC
from collections import abc
from dataclasses import dataclass
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Union,
)

from typing_extensions import Self, TypeAlias, assert_never

from phoenix.client.__generated__ import v1
from phoenix.client.helpers.sdk.anthropic.messages import (
    AnthropicMessageModelKwargs,
    create_prompt_version_from_anthropic,
)
from phoenix.client.helpers.sdk.anthropic.messages import (
    to_chat_messages_and_kwargs as to_messages_anthropic,
)
from phoenix.client.helpers.sdk.google_generativeai.generate_content import (
    GoogleModelKwargs,
    create_prompt_version_from_google,
)
from phoenix.client.helpers.sdk.google_generativeai.generate_content import (
    to_chat_messages_and_kwargs as to_messages_google,
)
from phoenix.client.helpers.sdk.openai.chat import (
    OpenAIChatCompletionModelKwargs,
    create_prompt_version_from_openai,
)
from phoenix.client.helpers.sdk.openai.chat import (
    to_chat_messages_and_kwargs as to_messages_openai,
)
from phoenix.client.utils.template_formatters import TemplateFormatter

if TYPE_CHECKING:
    from anthropic.types import MessageParam
    from anthropic.types.message_create_params import MessageCreateParamsBase
    from google.generativeai import protos
    from openai.types.chat import ChatCompletionMessageParam
    from openai.types.chat.completion_create_params import CompletionCreateParamsBase


class PromptVersion:
    """
    Represents a version of a prompt for different model providers.
    """

    def __init__(
        self,
        prompt: Sequence[v1.PromptMessage],
        /,
        *,
        model_name: str,
        description: Optional[str] = None,
        model_provider: Literal[
            "OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GOOGLE", "DEEPSEEK", "XAI", "AWS", "OLLAMA"
        ] = "OPENAI",
        template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
    ) -> None:
        """
        Initializes a PromptVersion for syncing and template application

        Args:
            prompt (Sequence[v1.PromptMessage]): A sequence of prompt messages.
            model_name (str): The name of the model to use for the prompt.
            description (Optional[str]): A description of the prompt. Defaults
            to None. model_provider (Literal["OPENAI", "AZURE_OPENAI",
            "ANTHROPIC", "GOOGLE",
                "DEEPSEEK", "XAI", "AWS", "OLLAMA"]): The provider of the model
                to use for the prompt. Defaults to "OPENAI".
            template_format (Literal["F_STRING", "MUSTACHE", "NONE"]): The
            format of the template
                to use for the prompt. Defaults to "MUSTACHE".
        """
        self._template = v1.PromptChatTemplate(messages=prompt, type="chat")
        self._template_type: Literal["CHAT"] = "CHAT"
        self._model_name = model_name
        self._model_provider: Literal[
            "OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GOOGLE", "DEEPSEEK", "XAI", "AWS", "OLLAMA"
        ] = model_provider
        self._template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = template_format
        self._description = description
        self._invocation_parameters: Union[
            v1.PromptOpenAIInvocationParameters,
            v1.PromptAzureOpenAIInvocationParameters,
            v1.PromptAnthropicInvocationParameters,
            v1.PromptGoogleInvocationParameters,
            v1.PromptDeepSeekInvocationParameters,
            v1.PromptXAIInvocationParameters,
            v1.PromptOllamaInvocationParameters,
            v1.PromptAwsInvocationParameters,
        ]
        if model_provider == "OPENAI":
            self._invocation_parameters = v1.PromptOpenAIInvocationParameters(
                type="openai",
                openai=v1.PromptOpenAIInvocationParametersContent(),
            )
        elif model_provider == "AZURE_OPENAI":
            self._invocation_parameters = v1.PromptAzureOpenAIInvocationParameters(
                type="azure_openai",
                azure_openai=v1.PromptAzureOpenAIInvocationParametersContent(),
            )
        elif model_provider == "ANTHROPIC":
            self._invocation_parameters = v1.PromptAnthropicInvocationParameters(
                type="anthropic",
                anthropic=v1.PromptAnthropicInvocationParametersContent(
                    max_tokens=1000,
                ),
            )
        elif model_provider == "GOOGLE":
            self._invocation_parameters = v1.PromptGoogleInvocationParameters(
                type="google",
                google=v1.PromptGoogleInvocationParametersContent(),
            )
        elif model_provider == "DEEPSEEK":
            self._invocation_parameters = v1.PromptDeepSeekInvocationParameters(
                type="deepseek",
                deepseek=v1.PromptDeepSeekInvocationParametersContent(),
            )
        elif model_provider == "XAI":
            self._invocation_parameters = v1.PromptXAIInvocationParameters(
                type="xai",
                xai=v1.PromptXAIInvocationParametersContent(),
            )
        elif model_provider == "OLLAMA":
            self._invocation_parameters = v1.PromptOllamaInvocationParameters(
                type="ollama",
                ollama=v1.PromptOllamaInvocationParametersContent(),
            )
        elif model_provider == "AWS":
            self._invocation_parameters = v1.PromptAwsInvocationParameters(
                type="aws",
                aws=v1.PromptAwsInvocationParametersContent(),
            )
        else:
            assert_never(model_provider)
        self._tools: Optional[v1.PromptTools] = None
        self._response_format: Optional[v1.PromptResponseFormatJSONSchema] = None
        self._id: Optional[str] = None

    def __dir__(self) -> list[str]:
        return [
            "id",
            "format",
            "from_openai",
            "from_anthropic",
        ]

    @property
    def id(self) -> Optional[str]:
        """
        Prompt Version ID if stored in the Phoenix backend
        """
        return self._id

    def format(
        self,
        *,
        variables: Mapping[str, str] = MappingProxyType({}),
        formatter: Optional[TemplateFormatter] = None,
        sdk: Optional[SDK] = None,
    ) -> _FormattedPrompt:
        """
        Formats the prompt for a specific SDK.

        Args:
            variables (Mapping[str, str]): A mapping of variable names to values to use in the
                prompt. Defaults to an empty mapping.
            formatter (Optional[TemplateFormatter]): A custom template formatter to use for the
                prompt. Defaults to None.
            sdk (Optional[SDK]): The SDK to format the prompt for. Defaults to None.

        Returns:
            The formatted prompt.
        """
        sdk = sdk or _to_sdk(self._model_provider)
        obj = self._dumps()
        if sdk == "openai":
            return OpenAIPrompt(
                *to_messages_openai(
                    obj,
                    variables=variables,
                    formatter=formatter,
                )
            )
        if sdk == "anthropic":
            return AnthropicPrompt(
                *to_messages_anthropic(
                    obj,
                    variables=variables,
                    formatter=formatter,
                )
            )
        if sdk == "google_generativeai":
            return GoogleGenerativeaiPrompt(
                *to_messages_google(
                    obj,
                    variables=variables,
                    formatter=formatter,
                )
            )
        if sdk == "boto3":
            raise NotImplementedError("Boto3 is not supported yet")
        assert_never(sdk)

    @classmethod
    def _loads(
        cls,
        obj: Union[v1.PromptVersionData, v1.PromptVersion],
    ) -> Self:
        assert obj["template"]["type"] == "chat"
        messages: Sequence[v1.PromptMessage] = obj["template"]["messages"]
        ans = cls(
            messages,
            model_name=obj["model_name"],
            description=obj.get("description"),
            model_provider=obj["model_provider"],
            template_format=obj["template_format"],
        )
        ans._invocation_parameters = obj["invocation_parameters"]
        if "tools" in obj:
            ans._tools = obj["tools"]
        if "response_format" in obj:
            ans._response_format = obj["response_format"]
        if "id" in obj:
            ans._id = obj["id"]  # type: ignore[typeddict-item]
        return ans

    def _dumps(
        self,
    ) -> v1.PromptVersionData:
        assert self._template["type"] == "chat"
        ans = v1.PromptVersionData(
            model_provider=self._model_provider,
            model_name=self._model_name,
            template=self._template,
            template_type=self._template_type,
            template_format=self._template_format,
            invocation_parameters=self._invocation_parameters,
        )
        if self._tools is not None:
            ans["tools"] = self._tools
        if self._response_format is not None:
            ans["response_format"] = self._response_format
        if self._description is not None:
            ans["description"] = self._description
        return ans

    @classmethod
    def from_openai(
        cls,
        obj: CompletionCreateParamsBase,
        /,
        *,
        template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
        description: Optional[str] = None,
        model_provider: Literal["OPENAI", "AZURE_OPENAI", "DEEPSEEK", "XAI", "OLLAMA"] = "OPENAI",
    ) -> Self:
        """
        Creates a prompt version from an OpenAI chat completion model.

        Args:
            obj (CompletionCreateParamsBase): The completion create parameters.
            template_format (Literal["F_STRING", "MUSTACHE", "NONE"]): The format of the template
                to use for the prompt. Defaults to "MUSTACHE".
            description (Optional[str]): A description of the prompt. Defaults to None.
            model_provider (Literal["OPENAI", "AZURE_OPENAI", "DEEPSEEK", "XAI", "OLLAMA"]):
                The provider of the model to use for the prompt. Defaults to "OPENAI".

        Returns:
            PromptVersion: The prompt version.
        """
        return cls._loads(
            create_prompt_version_from_openai(
                obj,
                description=description,
                template_format=template_format,
                model_provider=model_provider,
            )
        )

    @classmethod
    def from_aws(
        cls,
        obj: CompletionCreateParamsBase,
        /,
        *,
        template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
        description: Optional[str] = None,
        model_provider: Literal["AWS"] = "AWS",
    ) -> Self:
        raise NotImplementedError("AWS is not supported yet")

    @classmethod
    def from_anthropic(
        cls,
        obj: MessageCreateParamsBase,
        /,
        *,
        template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
        description: Optional[str] = None,
        model_provider: Literal["ANTHROPIC"] = "ANTHROPIC",
    ) -> Self:
        """
        Creates a prompt version from an Anthropic message model.

        Args:
            obj (MessageCreateParamsBase): The message create parameters.
            template_format (Literal["F_STRING", "MUSTACHE", "NONE"]): The format of the template
                to use for the prompt. Defaults to "MUSTACHE".
            description (Optional[str]): A description of the prompt. Defaults to None.
            model_provider (Literal["ANTHROPIC"]): The provider of the model to use for the prompt.
                Defaults to "ANTHROPIC".

        Returns:
            PromptVersion: The prompt version.
        """
        return cls._loads(
            create_prompt_version_from_anthropic(
                obj,
                description=description,
                template_format=template_format,
                model_provider=model_provider,
            )
        )

    @classmethod
    def from_google_generativeai(
        cls,
        obj: Any,
        /,
        *,
        template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
        description: Optional[str] = None,
        model_provider: Literal["GOOGLE"] = "GOOGLE",
    ) -> Self:
        return cls._loads(
            create_prompt_version_from_google(
                obj,
                description=description,
                template_format=template_format,
                model_provider=model_provider,
            )
        )


@dataclass(frozen=True)
class _FormattedPrompt(ABC, abc.Mapping[str, Any]):
    messages: Sequence[Any]
    kwargs: Mapping[str, Any]

    def __len__(self) -> int:
        return 1 + len(self.kwargs)

    def __iter__(self) -> abc.Iterator[str]:
        yield "messages"
        yield from self.kwargs

    def __getitem__(self, key: str) -> Any:
        if key == "messages":
            return self.messages
        return self.kwargs[key]


@dataclass(frozen=True)
class OpenAIPrompt(_FormattedPrompt):
    """
    Represents a formatted prompt for OpenAI chat completion models.

    Attributes:
        messages (Sequence[ChatCompletionMessageParam]): A sequence of chat completion message
            parameters.
        kwargs (OpenAIChatCompletionModelKwargs): Keyword arguments specific to OpenAI chat
            completion model invocation.
    """

    messages: Sequence[ChatCompletionMessageParam]
    kwargs: OpenAIChatCompletionModelKwargs


@dataclass(frozen=True)
class AnthropicPrompt(_FormattedPrompt):
    """
    Represents a formatted prompt for Anthropic message models.

    Attributes:
        messages (Sequence[MessageParam]): A sequence of message parameters.
        kwargs (AnthropicMessageModelKwargs): Keyword arguments specific to Anthropic message model
            invocation.
    """

    messages: Sequence[MessageParam]
    kwargs: AnthropicMessageModelKwargs


@dataclass(frozen=True)
class GoogleGenerativeaiPrompt(_FormattedPrompt):
    messages: Sequence[protos.Content]
    kwargs: GoogleModelKwargs


SDK: TypeAlias = Literal[
    "anthropic",  # https://pypi.org/project/anthropic/
    "google_generativeai",  # https://pypi.org/project/google-generativeai/
    "openai",  # https://pypi.org/project/openai/
    "boto3",  # https://boto3.amazonaws.com/v1/documentation/api/latest/index.html
]


def _to_sdk(
    model_provider: Literal[
        "OPENAI",
        "AZURE_OPENAI",
        "ANTHROPIC",
        "GOOGLE",
        "DEEPSEEK",
        "XAI",
        "OLLAMA",
        "AWS",
    ],
) -> SDK:
    if model_provider == "OPENAI":
        return "openai"
    if model_provider == "AZURE_OPENAI":
        return "openai"
    if model_provider == "ANTHROPIC":
        return "anthropic"
    if model_provider == "GOOGLE":
        return "google_generativeai"
    if model_provider == "DEEPSEEK":
        return "openai"
    if model_provider == "XAI":
        return "openai"
    if model_provider == "OLLAMA":
        return "openai"
    if model_provider == "AWS":
        return "boto3"
    assert_never(model_provider)
