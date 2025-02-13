from __future__ import annotations

from abc import ABC
from collections import abc
from dataclasses import dataclass
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
    AnthropicModelKwargs,
    create_prompt_version_from_anthropic,
)
from phoenix.client.helpers.sdk.anthropic.messages import (
    to_chat_messages_and_kwargs as to_messages_anthropic,
)
from phoenix.client.helpers.sdk.google_generativeai.generate_content import GoogleModelKwargs
from phoenix.client.helpers.sdk.google_generativeai.generate_content import (
    to_chat_messages_and_kwargs as to_messages_google,
)
from phoenix.client.helpers.sdk.openai.chat import (
    OpenAIModelKwargs,
    create_prompt_version_from_openai,
)
from phoenix.client.helpers.sdk.openai.chat import (
    to_chat_messages_and_kwargs as to_messages_openai,
)
from phoenix.client.utils.template_formatters import TemplateFormatter

if TYPE_CHECKING:
    from anthropic.types import MessageCreateParams, MessageParam
    from google.generativeai import protos
    from openai.types.chat import ChatCompletionMessageParam
    from openai.types.chat.completion_create_params import CompletionCreateParamsBase


@dataclass
class PromptVersion:
    template: v1.PromptChatTemplate
    model_name: str
    model_provider: Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GEMINI"]
    template_format: Literal["FSTRING", "MUSTACHE", "NONE"]
    invocation_parameters: Union[
        v1.PromptOpenAIInvocationParameters,
        v1.PromptAzureOpenAIInvocationParameters,
        v1.PromptAnthropicInvocationParameters,
        v1.PromptGeminiInvocationParameters,
    ]
    tools: Optional[v1.PromptTools] = None
    response_format: Optional[v1.PromptResponseFormatJSONSchema] = None
    description: Optional[str] = None
    id: Optional[str] = None

    def __init__(
        self,
        messages: Sequence[v1.PromptMessage],
        model_name: str,
        description: Optional[str] = None,
        model_provider: Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GEMINI"] = "OPENAI",
        template_format: Literal["FSTRING", "MUSTACHE", "NONE"] = "MUSTACHE",
        tools: Optional[v1.PromptTools] = None,
        response_format: Optional[v1.PromptResponseFormatJSONSchema] = None,
        invocation_parameters: Optional[
            Union[
                v1.PromptOpenAIInvocationParameters,
                v1.PromptAzureOpenAIInvocationParameters,
                v1.PromptAnthropicInvocationParameters,
                v1.PromptGeminiInvocationParameters,
            ]
        ] = None,
    ) -> None:
        template = v1.PromptChatTemplate(messages=messages, type="chat")
        self.model_name = model_name
        self.model_provider: Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GEMINI"] = (
            model_provider
        )
        self.template = template
        self.template_format: Literal["FSTRING", "MUSTACHE", "NONE"] = template_format
        self.template_type: Literal["CHAT"] = "CHAT"
        self.tools: Optional[v1.PromptTools] = tools
        self.response_format: Optional[v1.PromptResponseFormatJSONSchema] = response_format
        self.description = description
        if model_provider == "OPENAI":
            if invocation_parameters is None:
                invocation_parameters = v1.PromptOpenAIInvocationParameters(
                    type="openai",
                    openai=v1.PromptOpenAIInvocationParametersContent(),
                )
            assert invocation_parameters["type"] == "openai"
        elif model_provider == "AZURE_OPENAI":
            if invocation_parameters is None:
                invocation_parameters = v1.PromptAzureOpenAIInvocationParameters(
                    type="azure_openai",
                    azure_openai=v1.PromptAzureOpenAIInvocationParametersContent(),
                )
            assert invocation_parameters["type"] == "azure_openai"
        elif model_provider == "ANTHROPIC":
            if invocation_parameters is None:
                invocation_parameters = v1.PromptAnthropicInvocationParameters(
                    type="anthropic",
                    anthropic=v1.PromptAnthropicInvocationParametersContent(
                        max_tokens=1000,
                    ),
                )
            assert invocation_parameters["type"] == "anthropic"
        elif model_provider == "GEMINI":
            if invocation_parameters is None:
                invocation_parameters = v1.PromptGeminiInvocationParameters(
                    type="gemini",
                    gemini=v1.PromptGeminiInvocationParametersContent(),
                )
            assert invocation_parameters["type"] == "gemini"
        assert invocation_parameters is not None
        self.invocation_parameters = invocation_parameters
        self.id: Optional[str] = None

    def format(
        self,
        *,
        variables: Mapping[str, str],
        formatter: Optional[TemplateFormatter] = None,
        sdk: Optional[SDK] = None,
    ) -> FormattedPrompt:
        sdk = sdk or _to_sdk(self.model_provider)
        obj = self.dumps()
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
            return GooglePrompt(
                *to_messages_google(
                    obj,
                    variables=variables,
                    formatter=formatter,
                )
            )
        assert_never(sdk)

    @classmethod
    def loads(
        cls,
        obj: Union[v1.PromptVersionData, v1.PromptVersion],
    ) -> Self:
        assert obj["template"]["type"] == "chat"
        messages: Sequence[v1.PromptMessage] = obj["template"]["messages"]
        ans = cls(
            messages=messages,
            model_name=obj["model_name"],
            description=obj.get("description"),
            model_provider=obj["model_provider"],
            template_format=obj["template_format"],
            invocation_parameters=obj["invocation_parameters"],
        )
        if "tools" in obj:
            ans.tools = obj["tools"]
        if "response_format" in obj:
            ans.response_format = obj["response_format"]
        if "id" in obj:
            ans.id = obj["id"]  # type: ignore[typeddict-item]
        return ans

    def dumps(
        self,
    ) -> v1.PromptVersionData:
        ans = v1.PromptVersionData(
            model_provider=self.model_provider,
            model_name=self.model_name,
            template=self.template,
            template_type=self.template_type,
            template_format=self.template_format,
            invocation_parameters=self.invocation_parameters,
        )
        if self.tools is not None:
            ans["tools"] = self.tools
        if self.response_format is not None:
            ans["response_format"] = self.response_format
        if self.description is not None:
            ans["description"] = self.description
        return ans

    @classmethod
    def from_openai(
        cls,
        obj: CompletionCreateParamsBase,
        /,
        *,
        template_format: Literal["FSTRING", "MUSTACHE", "NONE"] = "MUSTACHE",
        description: Optional[str] = None,
    ) -> Self:
        return cls.loads(
            create_prompt_version_from_openai(
                obj,
                description=description,
                template_format=template_format,
            )
        )

    @classmethod
    def from_anthropic(
        cls,
        obj: MessageCreateParams,
        /,
        *,
        template_format: Literal["FSTRING", "MUSTACHE", "NONE"] = "MUSTACHE",
        description: Optional[str] = None,
    ) -> Self:
        return cls.loads(
            create_prompt_version_from_anthropic(
                obj,
                description=description,
                template_format=template_format,
            )
        )


@dataclass(frozen=True)
class FormattedPrompt(ABC, abc.Mapping[str, Any]):
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
class OpenAIPrompt(FormattedPrompt):
    messages: Sequence[ChatCompletionMessageParam]
    kwargs: OpenAIModelKwargs


@dataclass(frozen=True)
class AnthropicPrompt(FormattedPrompt):
    messages: Sequence[MessageParam]
    kwargs: AnthropicModelKwargs


@dataclass(frozen=True)
class GooglePrompt(FormattedPrompt):
    messages: Sequence[protos.Content]
    kwargs: GoogleModelKwargs


SDK: TypeAlias = Literal[
    "anthropic",  # https://pypi.org/project/anthropic/
    "google_generativeai",  # https://pypi.org/project/google-generativeai/
    "openai",  # https://pypi.org/project/openai/
]


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
    assert_never(model_provider)
