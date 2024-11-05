import importlib.util
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable, Iterator
from typing import (
    TYPE_CHECKING,
    Any,
    Mapping,
    Optional,
    Union,
)

from openinference.instrumentation import safe_json_dumps
from openinference.semconv.trace import SpanAttributes
from strawberry import UNSET
from strawberry.scalars import JSON as JSONScalarType
from typing_extensions import TypeAlias, assert_never

from phoenix.server.api.helpers.playground_registry import (
    PROVIDER_DEFAULT,
    register_llm_client,
)
from phoenix.server.api.input_types.GenerativeModelInput import GenerativeModelInput
from phoenix.server.api.input_types.InvocationParameters import (
    BoundedFloatInvocationParameter,
    CanonicalParameterName,
    IntInvocationParameter,
    InvocationParameter,
    InvocationParameterInput,
    JSONInvocationParameter,
    StringListInvocationParameter,
    extract_parameter,
    validate_invocation_parameters,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    FunctionCallChunk,
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

if TYPE_CHECKING:
    from anthropic.types import MessageParam
    from openai.types import CompletionUsage
    from openai.types.chat import (
        ChatCompletionMessageParam,
        ChatCompletionMessageToolCallParam,
    )

DependencyName: TypeAlias = str
SetSpanAttributesFn: TypeAlias = Callable[[Mapping[str, Any]], None]
ChatCompletionChunk: TypeAlias = Union[TextChunk, ToolCallChunk]


class PlaygroundStreamingClient(ABC):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        self._attributes: dict[str, Any] = dict()

    @classmethod
    @abstractmethod
    def dependencies(cls) -> list[DependencyName]:
        # A list of dependency names this client needs to run
        ...

    @classmethod
    @abstractmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]: ...

    @abstractmethod
    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        # a yield statement is needed to satisfy the type-checker
        # https://mypy.readthedocs.io/en/stable/more_types.html#asynchronous-iterators
        yield TextChunk(content="")

    @classmethod
    def construct_invocation_parameters(
        cls, invocation_parameters: list[InvocationParameterInput]
    ) -> dict[str, Any]:
        supported_params = cls.supported_invocation_parameters()
        params = {param.invocation_name: param for param in supported_params}

        formatted_invocation_parameters = dict()

        for param_input in invocation_parameters:
            invocation_name = param_input.invocation_name
            if invocation_name not in params:
                raise ValueError(f"Unsupported invocation parameter: {invocation_name}")

            param_def = params[invocation_name]
            value = extract_parameter(param_def, param_input)
            if value is not UNSET:
                formatted_invocation_parameters[invocation_name] = value
        validate_invocation_parameters(supported_params, formatted_invocation_parameters)
        return formatted_invocation_parameters

    @classmethod
    def dependencies_are_installed(cls) -> bool:
        try:
            for dependency in cls.dependencies():
                if importlib.util.find_spec(dependency) is None:
                    return False
            return True
        except ValueError:
            # happens in some cases if the spec is None
            return False

    @property
    def attributes(self) -> dict[str, Any]:
        return self._attributes


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
        "gpt-4o",
        "gpt-4o-2024-08-06",
        "gpt-4o-2024-05-13",
        "chatgpt-4o-latest",
        "gpt-4o-mini",
        "gpt-4o-mini-2024-07-18",
        "gpt-4-turbo",
        "gpt-4-turbo-2024-04-09",
        "gpt-4-turbo-preview",
        "gpt-4-0125-preview",
        "gpt-4-1106-preview",
        "gpt-4",
        "gpt-4-0613",
        "gpt-3.5-turbo-0125",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-1106",
        "gpt-3.5-turbo-instruct",
    ],
)
class OpenAIStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        from openai import AsyncOpenAI

        super().__init__(model=model, api_key=api_key)
        self.client = AsyncOpenAI(api_key=api_key)
        self.model_name = model.name

    @classmethod
    def dependencies(cls) -> list[DependencyName]:
        return ["openai"]

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=0.0,
                min_value=0.0,
                max_value=2.0,
            ),
            IntInvocationParameter(
                invocation_name="max_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Tokens",
                default_value=UNSET,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="frequency_penalty",
                label="Frequency Penalty",
                default_value=UNSET,
                min_value=-2.0,
                max_value=2.0,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="presence_penalty",
                label="Presence Penalty",
                default_value=UNSET,
                min_value=-2.0,
                max_value=2.0,
            ),
            StringListInvocationParameter(
                invocation_name="stop",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
                default_value=UNSET,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                default_value=UNSET,
                min_value=0.0,
                max_value=1.0,
            ),
            IntInvocationParameter(
                invocation_name="seed",
                canonical_name=CanonicalParameterName.RANDOM_SEED,
                label="Seed",
                default_value=UNSET,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
                default_value=UNSET,
                hidden=True,
            ),
            JSONInvocationParameter(
                invocation_name="response_format",
                label="Response Format",
                canonical_name=CanonicalParameterName.RESPONSE_FORMAT,
                default_value=UNSET,
            ),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        from openai import NOT_GIVEN
        from openai.types.chat import ChatCompletionStreamOptionsParam

        # Convert standard messages to OpenAI messages
        openai_messages = [self.to_openai_chat_completion_param(*message) for message in messages]
        tool_call_ids: dict[int, str] = {}
        token_usage: Optional["CompletionUsage"] = None
        async for chunk in await self.client.chat.completions.create(
            messages=openai_messages,
            model=self.model_name,
            stream=True,
            stream_options=ChatCompletionStreamOptionsParam(include_usage=True),
            tools=tools or NOT_GIVEN,
            **invocation_parameters,
        ):
            if (usage := chunk.usage) is not None:
                token_usage = usage
                continue
            choice = chunk.choices[0]
            delta = choice.delta
            if choice.finish_reason is None:
                if isinstance(chunk_content := delta.content, str):
                    text_chunk = TextChunk(content=chunk_content)
                    yield text_chunk
                if (tool_calls := delta.tool_calls) is not None:
                    for tool_call_index, tool_call in enumerate(tool_calls):
                        tool_call_id = (
                            tool_call.id
                            if tool_call.id is not None
                            else tool_call_ids[tool_call_index]
                        )
                        tool_call_ids[tool_call_index] = tool_call_id
                        if (function := tool_call.function) is not None:
                            tool_call_chunk = ToolCallChunk(
                                id=tool_call_id,
                                function=FunctionCallChunk(
                                    name=function.name or "",
                                    arguments=function.arguments or "",
                                ),
                            )
                            yield tool_call_chunk
        if token_usage is not None:
            self._attributes.update(dict(self._llm_token_counts(token_usage)))

    def to_openai_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[list[JSONScalarType]] = None,
    ) -> "ChatCompletionMessageParam":
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionSystemMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                {
                    "content": content,
                    "role": "user",
                }
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return ChatCompletionSystemMessageParam(
                {
                    "content": content,
                    "role": "system",
                }
            )
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                    }
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                        "tool_calls": [
                            self.to_openai_tool_call_param(tool_call) for tool_call in tool_calls
                        ],
                    }
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
        return ChatCompletionToolMessageParam(
            {"content": content, "role": "tool", "tool_call_id": tool_call_id}
        )
        assert_never(role)

    def to_openai_tool_call_param(
        self,
        tool_call: JSONScalarType,
    ) -> "ChatCompletionMessageToolCallParam":
        from openai.types.chat import ChatCompletionMessageToolCallParam

        return ChatCompletionMessageToolCallParam(
            id=tool_call.get("id", ""),
            function={
                "name": tool_call.get("function", {}).get("name", ""),
                "arguments": safe_json_dumps(tool_call.get("function", {}).get("arguments", "")),
            },
            type="function",
        )

    @staticmethod
    def _llm_token_counts(usage: "CompletionUsage") -> Iterator[tuple[str, Any]]:
        yield LLM_TOKEN_COUNT_PROMPT, usage.prompt_tokens
        yield LLM_TOKEN_COUNT_COMPLETION, usage.completion_tokens
        yield LLM_TOKEN_COUNT_TOTAL, usage.total_tokens


@register_llm_client(
    provider_key=GenerativeProviderKey.OPENAI,
    model_names=[
        "o1-preview",
        "o1-preview-2024-09-12",
        "o1-mini",
        "o1-mini-2024-09-12",
    ],
)
class OpenAIO1StreamingClient(OpenAIStreamingClient):
    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            IntInvocationParameter(
                invocation_name="max_completion_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Completion Tokens",
                default_value=UNSET,
            ),
            IntInvocationParameter(
                invocation_name="seed",
                canonical_name=CanonicalParameterName.RANDOM_SEED,
                label="Seed",
                default_value=UNSET,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
                default_value=UNSET,
                hidden=True,
            ),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        from openai import NOT_GIVEN

        # Convert standard messages to OpenAI messages
        unfiltered_openai_messages = [
            self.to_openai_o1_chat_completion_param(*message) for message in messages
        ]

        # filter out unsupported messages
        openai_messages: list[ChatCompletionMessageParam] = [
            message for message in unfiltered_openai_messages if message is not None
        ]

        tool_call_ids: dict[int, str] = {}

        response = await self.client.chat.completions.create(
            messages=openai_messages,
            model=self.model_name,
            tools=tools or NOT_GIVEN,
            **invocation_parameters,
        )

        choice = response.choices[0]
        message = choice.message
        content = message.content

        text_chunk = TextChunk(content=content)
        yield text_chunk

        if (tool_calls := message.tool_calls) is not None:
            for tool_call_index, tool_call in enumerate(tool_calls):
                tool_call_id = (
                    tool_call.id
                    if tool_call.id is not None
                    else tool_call_ids.get(tool_call_index, f"tool_call_{tool_call_index}")
                )
                tool_call_ids[tool_call_index] = tool_call_id
                if (function := tool_call.function) is not None:
                    tool_call_chunk = ToolCallChunk(
                        id=tool_call_id,
                        function=FunctionCallChunk(
                            name=function.name or "",
                            arguments=function.arguments or "",
                        ),
                    )
                    yield tool_call_chunk

        if (usage := response.usage) is not None:
            self._attributes.update(dict(self._llm_token_counts(usage)))

    def to_openai_o1_chat_completion_param(
        self,
        role: ChatCompletionMessageRole,
        content: JSONScalarType,
        tool_call_id: Optional[str] = None,
        tool_calls: Optional[list[JSONScalarType]] = None,
    ) -> Optional["ChatCompletionMessageParam"]:
        from openai.types.chat import (
            ChatCompletionAssistantMessageParam,
            ChatCompletionToolMessageParam,
            ChatCompletionUserMessageParam,
        )

        if role is ChatCompletionMessageRole.USER:
            return ChatCompletionUserMessageParam(
                {
                    "content": content,
                    "role": "user",
                }
            )
        if role is ChatCompletionMessageRole.SYSTEM:
            return None  # System messages are not supported for o1 models
        if role is ChatCompletionMessageRole.AI:
            if tool_calls is None:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                    }
                )
            else:
                return ChatCompletionAssistantMessageParam(
                    {
                        "content": content,
                        "role": "assistant",
                        "tool_calls": [
                            self.to_openai_tool_call_param(tool_call) for tool_call in tool_calls
                        ],
                    }
                )
        if role is ChatCompletionMessageRole.TOOL:
            if tool_call_id is None:
                raise ValueError("tool_call_id is required for tool messages")
        return ChatCompletionToolMessageParam(
            {"content": content, "role": "tool", "tool_call_id": tool_call_id}
        )
        assert_never(role)

    @staticmethod
    def _llm_token_counts(usage: "CompletionUsage") -> Iterator[tuple[str, Any]]:
        yield LLM_TOKEN_COUNT_PROMPT, usage.prompt_tokens
        yield LLM_TOKEN_COUNT_COMPLETION, usage.completion_tokens
        yield LLM_TOKEN_COUNT_TOTAL, usage.total_tokens


@register_llm_client(
    provider_key=GenerativeProviderKey.AZURE_OPENAI,
    model_names=[
        PROVIDER_DEFAULT,
    ],
)
class AzureOpenAIStreamingClient(OpenAIStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ):
        from openai import AsyncAzureOpenAI

        super().__init__(model=model, api_key=api_key)
        if model.endpoint is None or model.api_version is None:
            raise ValueError("endpoint and api_version are required for Azure OpenAI models")
        self.client = AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=model.endpoint,
            api_version=model.api_version,
        )


@register_llm_client(
    provider_key=GenerativeProviderKey.ANTHROPIC,
    model_names=[
        PROVIDER_DEFAULT,
        "claude-3-5-sonnet-20240620",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ],
)
class AnthropicStreamingClient(PlaygroundStreamingClient):
    def __init__(
        self,
        model: GenerativeModelInput,
        api_key: Optional[str] = None,
    ) -> None:
        import anthropic

        super().__init__(model=model, api_key=api_key)
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model_name = model.name

    @classmethod
    def dependencies(cls) -> list[DependencyName]:
        return ["anthropic"]

    @classmethod
    def supported_invocation_parameters(cls) -> list[InvocationParameter]:
        return [
            IntInvocationParameter(
                invocation_name="max_tokens",
                canonical_name=CanonicalParameterName.MAX_COMPLETION_TOKENS,
                label="Max Tokens",
                default_value=UNSET,
                required=True,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="temperature",
                canonical_name=CanonicalParameterName.TEMPERATURE,
                label="Temperature",
                default_value=UNSET,
                min_value=0.0,
                max_value=1.0,
            ),
            StringListInvocationParameter(
                invocation_name="stop_sequences",
                canonical_name=CanonicalParameterName.STOP_SEQUENCES,
                label="Stop Sequences",
                default_value=UNSET,
            ),
            BoundedFloatInvocationParameter(
                invocation_name="top_p",
                canonical_name=CanonicalParameterName.TOP_P,
                label="Top P",
                default_value=UNSET,
                min_value=0.0,
                max_value=1.0,
            ),
            JSONInvocationParameter(
                invocation_name="tool_choice",
                label="Tool Choice",
                canonical_name=CanonicalParameterName.TOOL_CHOICE,
                default_value=UNSET,
                hidden=True,
            ),
        ]

    async def chat_completion_create(
        self,
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[JSONScalarType]]]
        ],
        tools: list[JSONScalarType],
        **invocation_parameters: Any,
    ) -> AsyncIterator[ChatCompletionChunk]:
        import anthropic.lib.streaming as anthropic_streaming
        import anthropic.types as anthropic_types

        anthropic_messages, system_prompt = self._build_anthropic_messages(messages)

        anthropic_params = {
            "messages": anthropic_messages,
            "model": self.model_name,
            "system": system_prompt,
            "max_tokens": 1024,
            **invocation_parameters,
        }
        async with self.client.messages.stream(**anthropic_params) as stream:
            async for event in stream:
                if isinstance(event, anthropic_types.RawMessageStartEvent):
                    self._attributes.update(
                        {LLM_TOKEN_COUNT_PROMPT: event.message.usage.input_tokens}
                    )
                elif isinstance(event, anthropic_streaming.TextEvent):
                    yield TextChunk(content=event.text)
                elif isinstance(event, anthropic_streaming.MessageStopEvent):
                    self._attributes.update(
                        {LLM_TOKEN_COUNT_COMPLETION: event.message.usage.output_tokens}
                    )
                elif isinstance(
                    event,
                    (
                        anthropic_types.RawContentBlockStartEvent,
                        anthropic_types.RawContentBlockDeltaEvent,
                        anthropic_types.RawMessageDeltaEvent,
                        anthropic_streaming.ContentBlockStopEvent,
                    ),
                ):
                    # event types emitted by the stream that don't contain useful information
                    pass
                elif isinstance(event, anthropic_streaming.InputJsonEvent):
                    raise NotImplementedError
                else:
                    assert_never(event)

    def _build_anthropic_messages(
        self,
        messages: list[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]],
    ) -> tuple[list["MessageParam"], str]:
        anthropic_messages: list["MessageParam"] = []
        system_prompt = ""
        for role, content, _tool_call_id, _tool_calls in messages:
            if role == ChatCompletionMessageRole.USER:
                anthropic_messages.append({"role": "user", "content": content})
            elif role == ChatCompletionMessageRole.AI:
                anthropic_messages.append({"role": "assistant", "content": content})
            elif role == ChatCompletionMessageRole.SYSTEM:
                system_prompt += content + "\n"
            elif role == ChatCompletionMessageRole.TOOL:
                raise NotImplementedError
            else:
                assert_never(role)

        return anthropic_messages, system_prompt


def initialize_playground_clients() -> None:
    """
    Ensure that all playground clients are registered at import time.
    """
    pass


LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
