from __future__ import annotations

import json
import logging
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    Iterator,
    Literal,
    Mapping,
    Optional,
    Sequence,
    TypedDict,
    Union,
    overload,
)

from typing_extensions import Required, TypeAlias, assert_never

from phoenix.client.__generated__ import v1
from phoenix.client.utils.template_formatters import TemplateFormatter, to_formatter

if TYPE_CHECKING:
    from openai._client import OpenAI
    from openai.types.chat import (
        ChatCompletionAssistantMessageParam,
        ChatCompletionContentPartImageParam,
        ChatCompletionContentPartInputAudioParam,
        ChatCompletionContentPartParam,
        ChatCompletionContentPartRefusalParam,
        ChatCompletionContentPartTextParam,
        ChatCompletionDeveloperMessageParam,
        ChatCompletionMessageParam,
        ChatCompletionMessageToolCallParam,
        ChatCompletionNamedToolChoiceParam,
        ChatCompletionReasoningEffort,
        ChatCompletionRole,
        ChatCompletionSystemMessageParam,
        ChatCompletionToolChoiceOptionParam,
        ChatCompletionToolMessageParam,
        ChatCompletionToolParam,
        ChatCompletionToolUnionParam,
        ChatCompletionUserMessageParam,
    )
    from openai.types.chat.chat_completion_assistant_message_param import ContentArrayOfContentPart
    from openai.types.chat.chat_completion_content_part_param import File
    from openai.types.chat.chat_completion_named_tool_choice_param import Function
    from openai.types.chat.completion_create_params import (
        CompletionCreateParamsBase,
        ResponseFormat,
    )
    from openai.types.shared_params import FunctionDefinition, ResponseFormatJSONSchema
    from openai.types.shared_params.response_format_json_schema import JSONSchema

    def _(obj: v1.PromptVersion) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        OpenAI().chat.completions.create(messages=messages, **kwargs)

    def __(obj: CompletionCreateParamsBase) -> None:
        create_prompt_version_from_openai(obj)


class _ToolKwargs(TypedDict, total=False):
    parallel_tool_calls: bool
    tool_choice: ChatCompletionToolChoiceOptionParam
    tools: Sequence[ChatCompletionToolUnionParam]


class _InvocationParameters(TypedDict, total=False):
    frequency_penalty: float
    max_completion_tokens: int
    max_tokens: int
    presence_penalty: float
    reasoning_effort: ChatCompletionReasoningEffort
    seed: int
    stop: list[str]
    temperature: float
    top_logprobs: int
    top_p: float


class OpenAIChatCompletionModelKwargs(
    _InvocationParameters,
    _ToolKwargs,
    TypedDict,
    total=False,
):
    model: Required[str]
    response_format: ResponseFormat


_ContentPart: TypeAlias = Union[
    v1.TextContentPart,
    v1.ToolCallContentPart,
    v1.ToolResultContentPart,
]

__all__ = [
    "create_prompt_version_from_openai",
    "to_chat_messages_and_kwargs",
]

logger = logging.getLogger(__name__)


def create_prompt_version_from_openai(
    obj: CompletionCreateParamsBase,
    /,
    *,
    description: Optional[str] = None,
    template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
    model_provider: Literal["OPENAI", "AZURE_OPENAI", "DEEPSEEK", "XAI", "OLLAMA"] = "OPENAI",
) -> v1.PromptVersionData:
    messages: list[ChatCompletionMessageParam] = list(obj["messages"])
    template = v1.PromptChatTemplate(
        type="chat",
        messages=[_MessageConversion.from_openai(m) for m in messages],
    )
    invocation_parameters = _InvocationParametersConversion.from_openai(
        obj,
        model_provider=model_provider,
    )
    ans = v1.PromptVersionData(
        model_provider=model_provider,
        model_name=obj["model"],
        template=template,
        template_type="CHAT",
        template_format=template_format,
        invocation_parameters=invocation_parameters,
    )
    tool_kwargs: _ToolKwargs = {}
    if "tools" in obj:
        tool_kwargs["tools"] = list(obj["tools"])
    if "tool_choice" in obj:
        tool_kwargs["tool_choice"] = obj["tool_choice"]
    if "parallel_tool_calls" in obj:
        tool_kwargs["parallel_tool_calls"] = obj["parallel_tool_calls"]
    if (tools := _ToolKwargsConversion.from_openai(tool_kwargs)) is not None:
        ans["tools"] = tools
    if "response_format" in obj:
        ans["response_format"] = _ResponseFormatConversion.from_openai(obj["response_format"])
    if description:
        ans["description"] = description
    return ans


def to_chat_messages_and_kwargs(
    obj: v1.PromptVersionData,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
) -> tuple[list[ChatCompletionMessageParam], OpenAIChatCompletionModelKwargs]:
    return (
        list(_to_chat_completion_messages(obj, variables, formatter)),
        _to_model_kwargs(obj),
    )


def _to_model_kwargs(
    obj: v1.PromptVersionData,
) -> OpenAIChatCompletionModelKwargs:
    invocation_parameters: _InvocationParameters = (
        _InvocationParametersConversion.to_openai(obj["invocation_parameters"])
        if "invocation_parameters" in obj
        else {}
    )
    ans: OpenAIChatCompletionModelKwargs = {
        "model": obj["model_name"],
        **invocation_parameters,  # type: ignore[typeddict-item]
    }
    if "tools" in obj:
        tool_kwargs = _ToolKwargsConversion.to_openai(obj["tools"])
        if "tools" in tool_kwargs:
            ans["tools"] = tool_kwargs["tools"]
            if "tool_choice" in tool_kwargs:
                ans["tool_choice"] = tool_kwargs["tool_choice"]
    if "response_format" in obj:
        response_format = obj["response_format"]
        if response_format["type"] == "json_schema":
            ans["response_format"] = _ResponseFormatConversion.to_openai(response_format)
        elif TYPE_CHECKING:
            assert_never(response_format)
    return ans


class _InvocationParametersConversion:
    @staticmethod
    def to_openai(
        obj: Union[
            v1.PromptOpenAIInvocationParameters,
            v1.PromptAzureOpenAIInvocationParameters,
            v1.PromptAnthropicInvocationParameters,
            v1.PromptGoogleInvocationParameters,
            v1.PromptDeepSeekInvocationParameters,
            v1.PromptXAIInvocationParameters,
            v1.PromptOllamaInvocationParameters,
            v1.PromptAwsInvocationParameters,
        ],
    ) -> _InvocationParameters:
        ans: _InvocationParameters = {}
        if obj["type"] == "openai":
            openai_params: v1.PromptOpenAIInvocationParametersContent
            openai_params = obj["openai"]
            if "max_completion_tokens" in openai_params:
                ans["max_completion_tokens"] = openai_params["max_completion_tokens"]
            if "max_tokens" in openai_params:
                ans["max_tokens"] = openai_params["max_tokens"]
            if "temperature" in openai_params:
                ans["temperature"] = openai_params["temperature"]
            if "top_p" in openai_params:
                ans["top_p"] = openai_params["top_p"]
            if "presence_penalty" in openai_params:
                ans["presence_penalty"] = openai_params["presence_penalty"]
            if "frequency_penalty" in openai_params:
                ans["frequency_penalty"] = openai_params["frequency_penalty"]
            if "seed" in openai_params:
                ans["seed"] = openai_params["seed"]
            if "reasoning_effort" in openai_params:
                ans["reasoning_effort"] = openai_params["reasoning_effort"]
        elif obj["type"] == "azure_openai":
            azure_params: v1.PromptAzureOpenAIInvocationParametersContent
            azure_params = obj["azure_openai"]
            if "max_completion_tokens" in azure_params:
                ans["max_completion_tokens"] = azure_params["max_completion_tokens"]
            if "max_tokens" in azure_params:
                ans["max_tokens"] = azure_params["max_tokens"]
            if "temperature" in azure_params:
                ans["temperature"] = azure_params["temperature"]
            if "top_p" in azure_params:
                ans["top_p"] = azure_params["top_p"]
            if "presence_penalty" in azure_params:
                ans["presence_penalty"] = azure_params["presence_penalty"]
            if "frequency_penalty" in azure_params:
                ans["frequency_penalty"] = azure_params["frequency_penalty"]
            if "seed" in azure_params:
                ans["seed"] = azure_params["seed"]
            if "reasoning_effort" in azure_params:
                ans["reasoning_effort"] = azure_params["reasoning_effort"]
        elif obj["type"] == "deepseek":
            deepseek_params: v1.PromptDeepSeekInvocationParametersContent
            deepseek_params = obj["deepseek"]
            if "max_completion_tokens" in deepseek_params:
                ans["max_completion_tokens"] = deepseek_params["max_completion_tokens"]
            if "max_tokens" in deepseek_params:
                ans["max_tokens"] = deepseek_params["max_tokens"]
            if "temperature" in deepseek_params:
                ans["temperature"] = deepseek_params["temperature"]
            if "top_p" in deepseek_params:
                ans["top_p"] = deepseek_params["top_p"]
            if "presence_penalty" in deepseek_params:
                ans["presence_penalty"] = deepseek_params["presence_penalty"]
            if "frequency_penalty" in deepseek_params:
                ans["frequency_penalty"] = deepseek_params["frequency_penalty"]
            if "seed" in deepseek_params:
                ans["seed"] = deepseek_params["seed"]
            if "reasoning_effort" in deepseek_params:
                ans["reasoning_effort"] = deepseek_params["reasoning_effort"]
        elif obj["type"] == "xai":
            xai_params: v1.PromptXAIInvocationParametersContent
            xai_params = obj["xai"]
            if "max_completion_tokens" in xai_params:
                ans["max_completion_tokens"] = xai_params["max_completion_tokens"]
            if "max_tokens" in xai_params:
                ans["max_tokens"] = xai_params["max_tokens"]
            if "temperature" in xai_params:
                ans["temperature"] = xai_params["temperature"]
            if "top_p" in xai_params:
                ans["top_p"] = xai_params["top_p"]
            if "presence_penalty" in xai_params:
                ans["presence_penalty"] = xai_params["presence_penalty"]
            if "frequency_penalty" in xai_params:
                ans["frequency_penalty"] = xai_params["frequency_penalty"]
            if "seed" in xai_params:
                ans["seed"] = xai_params["seed"]
            if "reasoning_effort" in xai_params:
                ans["reasoning_effort"] = xai_params["reasoning_effort"]
        elif obj["type"] == "ollama":
            ollama_params: v1.PromptOllamaInvocationParametersContent
            ollama_params = obj["ollama"]
            if "max_completion_tokens" in ollama_params:
                ans["max_completion_tokens"] = ollama_params["max_completion_tokens"]
            if "max_tokens" in ollama_params:
                ans["max_tokens"] = ollama_params["max_tokens"]
            if "temperature" in ollama_params:
                ans["temperature"] = ollama_params["temperature"]
            if "top_p" in ollama_params:
                ans["top_p"] = ollama_params["top_p"]
            if "presence_penalty" in ollama_params:
                ans["presence_penalty"] = ollama_params["presence_penalty"]
            if "frequency_penalty" in ollama_params:
                ans["frequency_penalty"] = ollama_params["frequency_penalty"]
            if "seed" in ollama_params:
                ans["seed"] = ollama_params["seed"]
            if "reasoning_effort" in ollama_params:
                ans["reasoning_effort"] = ollama_params["reasoning_effort"]
        elif obj["type"] == "anthropic":
            anthropic_params: v1.PromptAnthropicInvocationParametersContent
            anthropic_params = obj["anthropic"]
            if "max_tokens" in anthropic_params:
                ans["max_completion_tokens"] = anthropic_params["max_tokens"]
            if "temperature" in anthropic_params:
                ans["temperature"] = anthropic_params["temperature"]
            if "top_p" in anthropic_params:
                ans["top_p"] = anthropic_params["top_p"]
            if "stop_sequences" in anthropic_params:
                ans["stop"] = list(anthropic_params["stop_sequences"])
        elif obj["type"] == "aws":
            aws_params: v1.PromptAwsInvocationParametersContent
            aws_params = obj["aws"]
            if "max_tokens" in aws_params:
                ans["max_tokens"] = aws_params["max_tokens"]
            if "temperature" in aws_params:
                ans["temperature"] = aws_params["temperature"]
            if "top_p" in aws_params:
                ans["top_p"] = aws_params["top_p"]
        elif obj["type"] == "google":
            google_params: v1.PromptGoogleInvocationParametersContent
            google_params = obj["google"]
            if "max_output_tokens" in google_params:
                ans["max_completion_tokens"] = google_params["max_output_tokens"]
            if "temperature" in google_params:
                ans["temperature"] = google_params["temperature"]
            if "top_p" in google_params:
                ans["top_p"] = google_params["top_p"]
            if "top_k" in google_params:
                ans["top_logprobs"] = google_params["top_k"]
            if "presence_penalty" in google_params:
                ans["presence_penalty"] = google_params["presence_penalty"]
            if "frequency_penalty" in google_params:
                ans["frequency_penalty"] = google_params["frequency_penalty"]
            if "stop_sequences" in google_params:
                ans["stop"] = list(google_params["stop_sequences"])
        elif TYPE_CHECKING:
            assert_never(obj["type"])
        return ans

    @overload
    @staticmethod
    def from_openai(
        obj: CompletionCreateParamsBase,
        /,
        *,
        model_provider: Literal["OPENAI"] = "OPENAI",
    ) -> v1.PromptOpenAIInvocationParameters: ...

    @overload
    @staticmethod
    def from_openai(
        obj: CompletionCreateParamsBase,
        /,
        *,
        model_provider: Literal["AZURE_OPENAI"],
    ) -> v1.PromptAzureOpenAIInvocationParameters: ...

    @overload
    @staticmethod
    def from_openai(
        obj: CompletionCreateParamsBase,
        /,
        *,
        model_provider: Literal["DEEPSEEK"],
    ) -> v1.PromptDeepSeekInvocationParameters: ...

    @overload
    @staticmethod
    def from_openai(
        obj: CompletionCreateParamsBase,
        /,
        *,
        model_provider: Literal["XAI"],
    ) -> v1.PromptXAIInvocationParameters: ...

    @overload
    @staticmethod
    def from_openai(
        obj: CompletionCreateParamsBase,
        /,
        *,
        model_provider: Literal["OLLAMA"],
    ) -> v1.PromptOllamaInvocationParameters: ...

    @staticmethod
    def from_openai(
        obj: CompletionCreateParamsBase,
        /,
        *,
        model_provider: Literal["OPENAI", "AZURE_OPENAI", "DEEPSEEK", "XAI", "OLLAMA"] = "OPENAI",
    ) -> Union[
        v1.PromptOpenAIInvocationParameters,
        v1.PromptAzureOpenAIInvocationParameters,
        v1.PromptDeepSeekInvocationParameters,
        v1.PromptXAIInvocationParameters,
        v1.PromptOllamaInvocationParameters,
    ]:
        content: Union[
            v1.PromptOpenAIInvocationParametersContent,
            v1.PromptAzureOpenAIInvocationParametersContent,
            v1.PromptDeepSeekInvocationParametersContent,
            v1.PromptXAIInvocationParametersContent,
            v1.PromptOllamaInvocationParametersContent,
        ]
        if model_provider == "OPENAI":
            content = v1.PromptOpenAIInvocationParametersContent()
        elif model_provider == "AZURE_OPENAI":
            content = v1.PromptAzureOpenAIInvocationParametersContent()
        elif model_provider == "DEEPSEEK":
            content = v1.PromptDeepSeekInvocationParametersContent()
        elif model_provider == "XAI":
            content = v1.PromptXAIInvocationParametersContent()
        elif model_provider == "OLLAMA":
            content = v1.PromptOllamaInvocationParametersContent()
        else:
            assert_never(model_provider)
        if "max_completion_tokens" in obj and obj["max_completion_tokens"] is not None:
            content["max_completion_tokens"] = obj["max_completion_tokens"]
        if "max_tokens" in obj and obj["max_tokens"] is not None:
            content["max_tokens"] = obj["max_tokens"]
        if "temperature" in obj and obj["temperature"] is not None:
            content["temperature"] = obj["temperature"]
        if "top_p" in obj and obj["top_p"] is not None:
            content["top_p"] = obj["top_p"]
        if "presence_penalty" in obj and obj["presence_penalty"] is not None:
            content["presence_penalty"] = obj["presence_penalty"]
        if "frequency_penalty" in obj and obj["frequency_penalty"] is not None:
            content["frequency_penalty"] = obj["frequency_penalty"]
        if "seed" in obj and obj["seed"] is not None:
            content["seed"] = obj["seed"]
        if "reasoning_effort" in obj:
            v = obj["reasoning_effort"]
            if v in ("none", "minimal", "low", "medium", "high", "xhigh"):
                content["reasoning_effort"] = v
        if model_provider == "OPENAI":
            return v1.PromptOpenAIInvocationParameters(
                type="openai",
                openai=content,
            )
        elif model_provider == "AZURE_OPENAI":
            return v1.PromptAzureOpenAIInvocationParameters(
                type="azure_openai",
                azure_openai=content,
            )
        elif model_provider == "DEEPSEEK":
            return v1.PromptDeepSeekInvocationParameters(
                type="deepseek",
                deepseek=content,
            )
        elif model_provider == "XAI":
            return v1.PromptXAIInvocationParameters(
                type="xai",
                xai=content,
            )
        elif model_provider == "OLLAMA":
            return v1.PromptOllamaInvocationParameters(
                type="ollama",
                ollama=content,
            )
        else:
            assert_never(model_provider)


def _to_chat_completion_messages(
    obj: v1.PromptVersionData,
    variables: Mapping[str, str],
    formatter: Optional[TemplateFormatter] = None,
    /,
) -> Iterator[ChatCompletionMessageParam]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    if template["type"] == "chat":
        for message in template["messages"]:
            yield from _MessageConversion.to_openai(message, variables, formatter)
    elif template["type"] == "string":
        raise NotImplementedError
    else:
        assert_never(template)


class _ToolKwargsConversion:
    @staticmethod
    def to_openai(
        obj: Optional[v1.PromptTools],
    ) -> _ToolKwargs:
        ans: _ToolKwargs = {}
        if not obj:
            return ans
        tools: list[ChatCompletionToolParam] = []
        for tool in obj["tools"]:
            if tool["type"] == "function":
                tools.append(_FunctionToolConversion.to_openai(tool))
        if not tools:
            return ans
        ans["tools"] = tools
        if "tool_choice" in obj:
            tool_choice: ChatCompletionToolChoiceOptionParam = _to_tool_choice(obj["tool_choice"])
            ans["tool_choice"] = tool_choice
        if "disable_parallel_tool_calls" in obj:
            v: bool = obj["disable_parallel_tool_calls"]
            ans["parallel_tool_calls"] = not v
        return ans

    @staticmethod
    def from_openai(
        obj: _ToolKwargs,
    ) -> Optional[v1.PromptTools]:
        if not obj or "tools" not in obj:
            return None
        tools: list[v1.PromptToolFunction] = []
        for tool in obj["tools"]:
            if tool["type"] == "function":
                tools.append(_FunctionToolConversion.from_openai(tool))
        if not tools:
            return None
        ans = v1.PromptTools(type="tools", tools=tools)
        if "tool_choice" in obj:
            tc: ChatCompletionToolChoiceOptionParam = obj["tool_choice"]
            ans["tool_choice"] = _from_tool_choice(tc)
        if "parallel_tool_calls" in obj:
            v: bool = obj["parallel_tool_calls"]
            ans["disable_parallel_tool_calls"] = not v
        return ans


def _to_tool_choice(
    obj: Union[
        v1.PromptToolChoiceNone,
        v1.PromptToolChoiceZeroOrMore,
        v1.PromptToolChoiceOneOrMore,
        v1.PromptToolChoiceSpecificFunctionTool,
    ],
) -> ChatCompletionToolChoiceOptionParam:
    if obj["type"] == "none":
        return "none"
    if obj["type"] == "zero_or_more":
        return "auto"
    if obj["type"] == "one_or_more":
        return "required"
    if obj["type"] == "specific_function":
        choice_tool: ChatCompletionNamedToolChoiceParam = {
            "type": "function",
            "function": {"name": obj["function_name"]},
        }
        return choice_tool
    assert_never(obj["type"])


def _from_tool_choice(
    obj: ChatCompletionToolChoiceOptionParam,
) -> Union[
    v1.PromptToolChoiceNone,
    v1.PromptToolChoiceZeroOrMore,
    v1.PromptToolChoiceOneOrMore,
    v1.PromptToolChoiceSpecificFunctionTool,
]:
    if obj == "none":
        return v1.PromptToolChoiceNone(type="none")
    if obj == "auto":
        return v1.PromptToolChoiceZeroOrMore(type="zero_or_more")
    if obj == "required":
        return v1.PromptToolChoiceOneOrMore(type="one_or_more")
    if obj["type"] == "function":
        function: Function = obj["function"]
        choice_function_tool = v1.PromptToolChoiceSpecificFunctionTool(
            type="specific_function",
            function_name=function["name"],
        )
        return choice_function_tool
    if obj["type"] == "allowed_tools":
        raise NotImplementedError
    if obj["type"] == "custom":
        raise NotImplementedError
    assert_never(obj["type"])


class _FunctionToolConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptToolFunction,
    ) -> ChatCompletionToolParam:
        definition = obj["function"]
        function: FunctionDefinition = {"name": definition["name"]}
        if "description" in definition and isinstance(definition["description"], str):
            function["description"] = definition["description"]
        if "parameters" in definition and isinstance(definition["parameters"], Mapping):
            function["parameters"] = dict(definition["parameters"])
        if "strict" in definition and isinstance(definition["strict"], bool):
            function["strict"] = definition["strict"]
        ans: ChatCompletionToolParam = {"type": "function", "function": function}
        return ans

    @staticmethod
    def from_openai(
        obj: ChatCompletionToolParam,
    ) -> v1.PromptToolFunction:
        definition: FunctionDefinition = obj["function"]
        name = definition["name"]
        function = v1.PromptToolFunctionDefinition(name=name)
        if "description" in definition and isinstance(definition["description"], str):
            function["description"] = definition["description"]
        if "parameters" in definition and isinstance(definition["parameters"], Mapping):
            function["parameters"] = dict(definition["parameters"])
        if "strict" in definition and isinstance(definition["strict"], bool):
            function["strict"] = definition["strict"]
        return v1.PromptToolFunction(type="function", function=function)


class _ResponseFormatConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptResponseFormatJSONSchema,
    ) -> ResponseFormat:
        definition: v1.PromptResponseFormatJSONSchemaDefinition = obj["json_schema"]
        json_schema: JSONSchema = {
            "name": definition["name"],
        }
        if "schema" in definition and isinstance(definition["schema"], Mapping):
            json_schema["schema"] = dict(definition["schema"])
        if "description" in definition and isinstance(definition["description"], str):
            json_schema["description"] = str(definition["description"])
        if "strict" in definition and isinstance(definition["strict"], bool):
            json_schema["strict"] = bool(definition["strict"])
        response_format_json_schema: ResponseFormatJSONSchema = {
            "type": "json_schema",
            "json_schema": json_schema,
        }
        return response_format_json_schema

    @staticmethod
    def from_openai(
        obj: ResponseFormat,
    ) -> v1.PromptResponseFormatJSONSchema:
        if obj["type"] == "json_schema":
            definition: JSONSchema = obj["json_schema"]
            json_schema = v1.PromptResponseFormatJSONSchemaDefinition(
                name=definition["name"],
            )
            if "schema" in definition and isinstance(definition["schema"], Mapping):
                json_schema["schema"] = dict(definition["schema"])
            if "description" in definition and isinstance(definition["description"], str):
                json_schema["description"] = str(definition["description"])
            if "strict" in definition and isinstance(definition["strict"], bool):
                json_schema["strict"] = bool(definition["strict"])
            response_format_json_schema = v1.PromptResponseFormatJSONSchema(
                type="json_schema",
                json_schema=json_schema,
            )
            return response_format_json_schema
        if obj["type"] == "text":
            raise NotImplementedError
        if obj["type"] == "json_object":
            raise NotImplementedError
        assert_never(obj)


class _MessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionMessageParam]:
        if obj["role"] == "user":
            yield from _UserMessageConversion.to_openai(obj, variables, formatter)
        elif obj["role"] == "system":
            yield from _SystemMessageConversion.to_openai(obj, variables, formatter)
        elif obj["role"] == "developer":
            yield from _DeveloperMessageConversion.to_openai(obj, variables, formatter)
        elif obj["role"] == "assistant" or obj["role"] == "model" or obj["role"] == "ai":
            yield from _AssistantMessageConversion.to_openai(obj, variables, formatter)
        elif obj["role"] == "tool":
            yield from _ToolMessageConversion.to_openai(obj, variables, formatter)
        elif TYPE_CHECKING:
            assert_never(obj["role"])
        else:
            content = list(_ContentPartsConversion.to_openai(obj["content"], variables, formatter))
            yield {"role": obj["role"], "content": content}

    @staticmethod
    def from_openai(
        obj: ChatCompletionMessageParam,
    ) -> v1.PromptMessage:
        if obj["role"] == "user":
            return _UserMessageConversion.from_openai(obj)
        if obj["role"] == "system":
            return _SystemMessageConversion.from_openai(obj)
        if obj["role"] == "developer":
            return _DeveloperMessageConversion.from_openai(obj)
        if obj["role"] == "assistant":
            return _AssistantMessageConversion.from_openai(obj)
        if obj["role"] == "tool":
            return _ToolMessageConversion.from_openai(obj)
        if obj["role"] == "function":
            raise NotImplementedError
        if TYPE_CHECKING:
            assert_never(obj["role"])
        content = list(_ContentPartsConversion.from_openai(obj["content"]))
        return v1.PromptMessage(role=obj["role"], content=content)


class _UserMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionUserMessageParam]:
        if isinstance(obj["content"], str):
            yield {
                "role": "user",
                "content": formatter.format(obj["content"], variables=variables),
            }
            return
        content = list(_ContentPartsConversion.to_openai(obj["content"], variables, formatter))
        yield _user_msg(content)

    @staticmethod
    def from_openai(
        obj: ChatCompletionUserMessageParam,
        /,
        *,
        role: Literal["user"] = "user",
    ) -> v1.PromptMessage:
        if isinstance(obj["content"], str):
            return v1.PromptMessage(role=role, content=obj["content"])
        content = list(_ContentPartsConversion.from_openai(obj["content"]))
        return v1.PromptMessage(role=role, content=content)


class _SystemMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionSystemMessageParam]:
        if isinstance(obj["content"], str):
            yield {
                "role": "system",
                "content": formatter.format(obj["content"], variables=variables),
            }
            return
        content = list(
            _ContentPartsConversion.to_openai(obj["content"], variables, formatter, text_only=True)
        )
        if len(content) == 1 and content[0]["type"] == "text":
            yield {
                "role": "system",
                "content": content[0]["text"],
            }
            return
        yield {
            "role": "system",
            "content": content,
        }

    @staticmethod
    def from_openai(
        obj: ChatCompletionSystemMessageParam,
        /,
        *,
        role: Literal["system"] = "system",
    ) -> v1.PromptMessage:
        if isinstance(obj["content"], str):
            return v1.PromptMessage(role=role, content=obj["content"])
        content = list(_ContentPartsConversion.from_openai(obj["content"]))
        return v1.PromptMessage(role=role, content=content)


class _DeveloperMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionDeveloperMessageParam]:
        if isinstance(obj["content"], str):
            yield {
                "role": "developer",
                "content": formatter.format(obj["content"], variables=variables),
            }
            return
        content = list(
            _ContentPartsConversion.to_openai(obj["content"], variables, formatter, text_only=True)
        )
        if len(content) == 1 and content[0]["type"] == "text":
            yield {
                "role": "developer",
                "content": content[0]["text"],
            }
            return
        yield {
            "role": "developer",
            "content": content,
        }

    @staticmethod
    def from_openai(
        obj: ChatCompletionDeveloperMessageParam,
        /,
        *,
        role: Literal["developer"] = "developer",
    ) -> v1.PromptMessage:
        if isinstance(obj["content"], str):
            return v1.PromptMessage(role=role, content=obj["content"])
        content = list(_ContentPartsConversion.from_openai(obj["content"]))
        return v1.PromptMessage(role=role, content=content)


class _AssistantMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionAssistantMessageParam]:
        content: list[ContentArrayOfContentPart] = []
        tool_calls: list[ChatCompletionMessageToolCallParam] = []
        if isinstance(obj["content"], str):
            yield {
                "role": "assistant",
                "content": formatter.format(obj["content"], variables=variables),
            }
            return
        for part in obj["content"]:
            if part["type"] == "tool_call":
                tool_calls.append(
                    _ToolCallContentPartConversion.to_openai(part, variables, formatter)
                )
            elif part["type"] == "text":
                content.append(_TextContentPartConversion.to_openai(part, variables, formatter))
            elif part["type"] == "tool_result":
                continue
            elif TYPE_CHECKING:
                assert_never(part)
        if content:
            ans = _assistant_msg(content)
            if tool_calls:
                ans["tool_calls"] = tool_calls
            yield ans
        elif tool_calls:
            yield {"role": "assistant", "tool_calls": tool_calls}

    @staticmethod
    def from_openai(
        obj: ChatCompletionAssistantMessageParam,
        /,
        *,
        role: Literal["assistant"] = "assistant",
    ) -> v1.PromptMessage:
        content: list[_ContentPart] = []
        if "content" in obj and obj["content"] is not None:
            content.extend(_ContentPartsConversion.from_openai(obj["content"]))
        if "tool_calls" in obj and (tool_calls := obj["tool_calls"]):
            for tool_call in tool_calls:
                if tool_call["type"] == "function":
                    content.append(_ToolCallContentPartConversion.from_openai(tool_call))
        if len(content) == 1 and content[0]["type"] == "text":
            return v1.PromptMessage(role=role, content=content[0]["text"])
        return v1.PromptMessage(role=role, content=content)


class _ToolMessageConversion:
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[ChatCompletionToolMessageParam]:
        current_tool_call_id: Optional[str] = None
        current_content: list[ChatCompletionContentPartTextParam] = []
        if isinstance(obj["content"], str):
            yield {
                "role": "tool",
                "tool_call_id": "",
                "content": formatter.format(obj["content"], variables=variables),
            }
            return
        for part in obj["content"]:
            if part["type"] == "tool_result":
                tool_call_id = part["tool_call_id"]
                if (
                    current_tool_call_id is not None
                    and current_tool_call_id != tool_call_id
                    and current_content
                ):
                    yield _tool_msg(tool_call_id=current_tool_call_id, content=current_content)
                    current_content = []
                current_tool_call_id = tool_call_id
                current_content.append(
                    {
                        "type": "text",
                        "text": _str_tool_result(part["tool_result"]),
                    }
                )
            elif part["type"] == "text":
                continue
            elif part["type"] == "tool_call":
                continue
            elif TYPE_CHECKING:
                assert_never(part)
        if current_tool_call_id is not None and current_content:
            yield _tool_msg(tool_call_id=current_tool_call_id, content=current_content)

    @staticmethod
    def from_openai(
        obj: ChatCompletionToolMessageParam,
        /,
        *,
        role: Literal["tool"] = "tool",
    ) -> v1.PromptMessage:
        if isinstance(obj["content"], str):
            return v1.PromptMessage(
                role="tool",
                content=[
                    v1.ToolResultContentPart(
                        type="tool_result",
                        tool_call_id=obj["tool_call_id"],
                        tool_result=obj["content"],
                    )
                ],
            )
        content: list[_ContentPart] = []
        for part in obj["content"]:
            if part["type"] == "text":
                content.append(
                    v1.ToolResultContentPart(
                        type="tool_result",
                        tool_call_id=obj["tool_call_id"],
                        tool_result=part["text"],
                    )
                )
            elif TYPE_CHECKING:
                assert_never(part)
        return v1.PromptMessage(role=role, content=content)


def _str_tool_result(
    obj: Any,
) -> str:
    if isinstance(obj, (dict, list)):
        return json.dumps(obj)
    return str(obj)


class _ToolCallContentPartConversion:
    @staticmethod
    def to_openai(
        obj: v1.ToolCallContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> ChatCompletionMessageToolCallParam:
        id_ = obj["tool_call_id"]
        tool_call = obj["tool_call"]
        name = tool_call["name"]
        arguments = tool_call["arguments"] if "arguments" in tool_call else "{}"
        return {
            "id": id_,
            "function": {
                "name": name,
                "arguments": arguments,
            },
            "type": "function",
        }

    @staticmethod
    def from_openai(
        obj: ChatCompletionMessageToolCallParam,
    ) -> v1.ToolCallContentPart:
        return v1.ToolCallContentPart(
            type="tool_call",
            tool_call_id=obj["id"],
            tool_call=v1.ToolCallFunction(
                type="function",
                name=obj["function"]["name"],
                arguments=obj["function"]["arguments"],
            ),
        )


class _ContentPartsConversion:
    @overload
    @staticmethod
    def to_openai(
        parts: Sequence[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: Literal[True] = True,
    ) -> Iterator[ChatCompletionContentPartTextParam]: ...

    @overload
    @staticmethod
    def to_openai(
        parts: Sequence[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: bool,
    ) -> Iterator[ChatCompletionContentPartParam]: ...

    @staticmethod
    def to_openai(
        parts: Sequence[_ContentPart],
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        *,
        text_only: bool = False,
    ) -> Iterator[Any]:
        for part in parts:
            if part["type"] == "text":
                yield _TextContentPartConversion.to_openai(part, variables, formatter)
            elif text_only:
                continue
            elif part["type"] == "tool_call":
                continue
            elif part["type"] == "tool_result":
                continue
            elif TYPE_CHECKING:
                assert_never(part)

    @staticmethod
    def from_openai(
        obj: Union[
            str,
            Iterable[
                Union[
                    ChatCompletionContentPartTextParam,
                    ChatCompletionContentPartImageParam,
                    ChatCompletionContentPartInputAudioParam,
                    ChatCompletionContentPartRefusalParam,
                    File,
                ]
            ],
            None,
        ],
    ) -> Iterator[_ContentPart]:
        if isinstance(obj, str):
            yield v1.TextContentPart(type="text", text=obj)
            return
        for part in obj or ():
            if part["type"] == "text":
                yield _TextContentPartConversion.from_openai(part)
            elif part["type"] == "image_url":
                continue
            elif part["type"] == "input_audio":
                continue
            elif part["type"] == "refusal":
                continue
            elif part["type"] == "file":
                continue
            elif TYPE_CHECKING:
                assert_never(part["type"])


class _TextContentPartConversion:
    @staticmethod
    def to_openai(
        obj: v1.TextContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> ChatCompletionContentPartTextParam:
        text = formatter.format(obj["text"], variables=variables)
        return {"type": "text", "text": text}

    @staticmethod
    def from_openai(
        obj: ChatCompletionContentPartTextParam,
    ) -> v1.TextContentPart:
        return v1.TextContentPart(type="text", text=obj["text"])


def _user_msg(
    content: Sequence[ChatCompletionContentPartParam],
) -> ChatCompletionUserMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {
            "role": "user",
            "content": content[0]["text"],
        }
    return {
        "role": "user",
        "content": content,
    }


def _assistant_msg(
    content: Sequence[ContentArrayOfContentPart],
) -> ChatCompletionAssistantMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {
            "role": "assistant",
            "content": content[0]["text"],
        }
    return {
        "role": "assistant",
        "content": content,
    }


def _tool_msg(
    tool_call_id: str,
    content: Sequence[ChatCompletionContentPartTextParam],
) -> ChatCompletionToolMessageParam:
    if len(content) == 1 and content[0]["type"] == "text":
        return {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": content[0]["text"],
        }
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": content,
    }


class _RoleConversion:  # pyright: ignore[reportUnusedClass]
    @staticmethod
    def to_openai(
        obj: v1.PromptMessage,
    ) -> ChatCompletionRole:
        role = obj["role"]
        if role == "user":
            return "user"
        if role == "assistant":
            return "assistant"
        if role == "model":
            return "assistant"
        if role == "ai":
            return "assistant"
        if role == "system":
            return "system"
        if role == "developer":
            return "developer"
        if role == "tool":
            return "tool"
        if TYPE_CHECKING:
            assert_never(role)
        return role

    @staticmethod
    def from_openai(
        obj: ChatCompletionMessageParam,
    ) -> Literal["user", "assistant", "tool", "system", "developer"]:
        if obj["role"] == "user":
            return "user"
        if obj["role"] == "system":
            return "system"
        if obj["role"] == "developer":
            return "developer"
        if obj["role"] == "assistant":
            return "assistant"
        if obj["role"] == "tool":
            return "tool"
        if obj["role"] == "function":
            return "tool"
        if TYPE_CHECKING:
            assert_never(obj["role"])
        return obj["role"]
