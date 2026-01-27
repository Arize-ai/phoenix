# pyright: reportPrivateUsage=false
from __future__ import annotations

import json
from enum import Enum
from random import randint, random
from secrets import token_hex
from types import MappingProxyType
from typing import (
    Any,
    Callable,
    Iterable,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Union,
    cast,
)

import pytest
from anthropic.types import (
    ToolChoiceAnyParam,
    ToolChoiceAutoParam,
    ToolChoiceParam,
    ToolChoiceToolParam,
    ToolParam,
)
from anthropic.types.message_create_params import MessageCreateParamsBase
from deepdiff.diff import DeepDiff
from openai import pydantic_function_tool
from openai.lib._parsing import type_to_response_format_param
from openai.types.chat import (
    ChatCompletionNamedToolChoiceParam,
    ChatCompletionToolChoiceOptionParam,
    ChatCompletionToolParam,
)
from openai.types.chat.completion_create_params import CompletionCreateParamsBase
from openai.types.shared_params import ResponseFormatJSONSchema
from pydantic import BaseModel, create_model

import phoenix as px
from phoenix.client.types import PromptVersion
from phoenix.client.utils.template_formatters import NO_OP_FORMATTER

from ...__generated__.graphql import (
    ChatPromptVersionInput,
    ContentPartInput,
    CreateChatPromptInput,
    PromptChatTemplateInput,
    PromptMessageInput,
    ResponseFormatInput,
    TextContentValueInput,
    ToolDefinitionInput,
)
from .._helpers import (
    _MEMBER,
    _SYSTEM_USER_GID,
    _AdminSecret,
    _ApiKey,
    _AppInfo,
    _await_or_return,
    _GetUser,
    _gql,
)


class TestUserMessage:
    def test_user_message(
        self,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret
        x = token_hex(4)
        expected = [{"role": "user", "content": f"hello {x}"}]
        prompt = _create_chat_prompt(_app, api_key, template_format="F_STRING")
        messages = prompt.format(variables={"x": x}).messages
        assert not DeepDiff(expected, messages)
        _can_recreate_via_client(_app, prompt, api_key)


class _GetWeather(BaseModel):
    city: str
    country: Optional[str]


class _GetPopulation(BaseModel):
    location: str
    year: Optional[int]


_OPENAI_TOOLS = [
    json.loads(
        json.dumps(
            pydantic_function_tool(
                _GetWeather,
                name="get_weather",
                description="Get the weather",
            )
        )
    ),
    json.loads(
        json.dumps(
            pydantic_function_tool(
                _GetPopulation,
                name="get_population",
                description="Get the population",
            )
        )
    ),
]

_ANTHROPIC_TOOLS: list[ToolParam] = [
    {
        "name": t["function"]["name"],
        "description": t["function"]["description"],
        "input_schema": t["function"]["parameters"],
    }
    for t in _OPENAI_TOOLS
]


class TestTools:
    @pytest.mark.parametrize(
        "types_",
        [
            [_GetWeather],
        ],
    )
    def test_openai(
        self,
        types_: Sequence[type[BaseModel]],
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret
        expected: Mapping[str, ChatCompletionToolParam] = {
            t.__name__: cast(
                ChatCompletionToolParam, json.loads(json.dumps(pydantic_function_tool(t)))
            )
            for t in types_
        }
        tools = [ToolDefinitionInput(definition=dict(v)) for v in expected.values()]
        prompt = _create_chat_prompt(_app, api_key, tools=tools)
        kwargs = prompt.format().kwargs
        assert "tools" in kwargs
        actual: dict[str, ChatCompletionToolParam] = {
            t["function"]["name"]: t
            for t in cast(Iterable[ChatCompletionToolParam], kwargs["tools"])
            if t["type"] == "function" and "parameters" in t["function"]
        }
        assert not DeepDiff(expected, actual)
        _can_recreate_via_client(_app, prompt, api_key)

    @pytest.mark.parametrize(
        "types_",
        [
            [_GetWeather],
        ],
    )
    def test_anthropic(
        self,
        types_: Sequence[type[BaseModel]],
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret
        expected: dict[str, ToolParam] = {
            t.__name__: ToolParam(
                name=t.__name__,
                input_schema=t.model_json_schema(),
            )
            for t in types_
        }
        tools = [ToolDefinitionInput(definition=dict(v)) for v in expected.values()]
        prompt = _create_chat_prompt(
            _app,
            api_key,
            tools=tools,
            model_provider="ANTHROPIC",
            invocation_parameters={"max_tokens": 1024},
        )
        kwargs = prompt.format().kwargs
        assert "tools" in kwargs
        actual = {t["name"]: t for t in cast(Iterable[ToolParam], kwargs["tools"])}
        assert not DeepDiff(expected, actual)
        assert "max_tokens" in kwargs
        assert kwargs["max_tokens"] == 1024
        _can_recreate_via_client(_app, prompt, api_key)


class TestToolChoice:
    @pytest.mark.parametrize(
        "expected",
        [
            "none",
            "auto",
            "required",
            ChatCompletionNamedToolChoiceParam(type="function", function={"name": "_GetWeather"}),
        ],
    )
    def test_openai(
        self,
        expected: ChatCompletionToolChoiceOptionParam,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret
        tools = [
            ToolDefinitionInput(definition=json.loads(json.dumps(pydantic_function_tool(t))))
            for t in cast(Iterable[type[BaseModel]], [_GetWeather, _GetPopulation])
        ]
        invocation_parameters = {"tool_choice": expected}
        prompt = _create_chat_prompt(
            _app, api_key, tools=tools, invocation_parameters=invocation_parameters
        )
        kwargs = prompt.format().kwargs
        assert "tool_choice" in kwargs
        actual = kwargs["tool_choice"]
        assert not DeepDiff(expected, actual)
        _can_recreate_via_client(_app, prompt, api_key)

    @pytest.mark.parametrize(
        "expected",
        [
            ToolChoiceAutoParam(type="auto"),
            ToolChoiceAnyParam(type="any"),
            ToolChoiceToolParam(type="tool", name="_GetWeather"),
        ],
    )
    def test_anthropic(
        self,
        expected: ToolChoiceParam,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret
        tools = [
            ToolDefinitionInput(
                definition=dict(ToolParam(name=t.__name__, input_schema=t.model_json_schema()))
            )
            for t in cast(Iterable[type[BaseModel]], [_GetWeather, _GetPopulation])
        ]
        invocation_parameters = {"max_tokens": 1024, "tool_choice": expected}
        prompt = _create_chat_prompt(
            _app,
            api_key,
            tools=tools,
            invocation_parameters=invocation_parameters,
            model_provider="ANTHROPIC",
        )
        kwargs = prompt.format().kwargs
        assert "tool_choice" in kwargs
        actual = kwargs["tool_choice"]
        assert not DeepDiff(expected, actual)
        assert "max_tokens" in kwargs
        assert kwargs["max_tokens"] == 1024
        _can_recreate_via_client(_app, prompt, api_key)


class _UIType(str, Enum):
    div = "div"
    button = "button"
    header = "header"
    section = "section"
    field = "field"
    form = "form"


class _Attribute(BaseModel):
    name: str
    value: str


class _UI(BaseModel):
    type: _UIType
    label: str
    children: list[_UI]
    attributes: list[_Attribute]


_UI.model_rebuild()


class TestResponseFormat:
    @pytest.mark.parametrize(
        "type_",
        [
            create_model("Response", ui=(_UI, ...)),
        ],
    )
    def test_openai(
        self,
        type_: type[BaseModel],
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret
        expected = cast(ResponseFormatJSONSchema, type_to_response_format_param(type_))
        response_format = ResponseFormatInput(definition=dict(expected))
        prompt = _create_chat_prompt(_app, api_key, response_format=response_format)
        kwargs = prompt.format().kwargs
        assert "response_format" in kwargs
        actual = kwargs["response_format"]
        assert not DeepDiff(expected, actual)
        _can_recreate_via_client(_app, prompt, api_key)


class TestUserId:
    QUERY = "query($versionId:ID!){node(id:$versionId){... on PromptVersion{user{id}}}}"

    def test_client(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(u.create_api_key(_app))
        prompt = px.Client(endpoint=_app.base_url, api_key=api_key).prompts.create(
            name=token_hex(8),
            version=PromptVersion.from_openai(
                CompletionCreateParamsBase(
                    model=token_hex(8), messages=[{"role": "user", "content": "hello"}]
                )
            ),
        )
        response, _ = u.gql(_app, query=self.QUERY, variables={"versionId": prompt.id})
        assert u.gid == response["data"]["node"]["user"]["id"]


class TestMetadata:
    @pytest.mark.parametrize("is_async", [False, True])
    async def test_create_and_retrieve_metadata(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test that metadata can be created and retrieved for prompts."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Create prompt with metadata
        prompt_name = token_hex(8)
        prompt_description = token_hex(8)
        prompt_metadata = {"environment": token_hex(8)}
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).prompts.create(
                name=prompt_name,
                version=PromptVersion.from_openai(
                    CompletionCreateParamsBase(
                        model=token_hex(8), messages=[{"role": "user", "content": "hello"}]
                    )
                ),
                prompt_description=prompt_description,
                prompt_metadata=prompt_metadata,
            )
        )

        # Query prompt metadata via GraphQL
        query = """
        query($name: String!) {
            prompts(first: 1, filter: {col: name, value: $name}) {
                edges {
                    node {
                        id
                        metadata
                        description
                    }
                }
            }
        }
        """
        response, _ = _gql(_app, _app.admin_secret, query=query, variables={"name": prompt_name})
        assert response["data"]["prompts"]["edges"]
        retrieved_metadata = response["data"]["prompts"]["edges"][0]["node"]["metadata"]
        assert retrieved_metadata == prompt_metadata
        assert response["data"]["prompts"]["edges"][0]["node"]["description"] == prompt_description


def _can_recreate_via_client(_app: _AppInfo, version: PromptVersion, api_key: str) -> None:
    new_name = token_hex(8)
    base_url = _app.base_url
    a = px.Client(endpoint=base_url, api_key=api_key).prompts.create(name=new_name, version=version)
    assert version.id != a.id
    expected = version._dumps()
    assert not DeepDiff(expected, a._dumps())
    b = px.Client(endpoint=base_url, api_key=api_key).prompts.get(prompt_identifier=new_name)
    assert a.id == b.id
    assert not DeepDiff(expected, b._dumps())
    same_name = new_name
    c = px.Client(endpoint=base_url, api_key=api_key).prompts.create(
        name=same_name, version=version
    )
    assert a.id != c.id
    assert not DeepDiff(expected, c._dumps())


def _create_chat_prompt(
    app: _AppInfo,
    api_key: Union[_ApiKey, _AdminSecret],
    /,
    *,
    messages: Sequence[PromptMessageInput] = (),
    model_provider: Literal[
        "ANTHROPIC", "AZURE_OPENAI", "GOOGLE", "OPENAI", "DEEPSEEK", "XAI", "OLLAMA"
    ] = "OPENAI",
    model_name: str | None = None,
    response_format: ResponseFormatInput | None = None,
    tools: Sequence[ToolDefinitionInput] = (),
    invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
    template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "NONE",
) -> PromptVersion:
    messages = list(messages) or [
        PromptMessageInput(
            role="USER",
            content=[ContentPartInput(text=TextContentValueInput(text="hello {x}"))],
        )
    ]
    version = ChatPromptVersionInput(
        templateFormat=template_format,
        template=PromptChatTemplateInput(messages=messages),
        invocationParameters=dict(invocation_parameters),
        modelProvider=model_provider,
        modelName=model_name or token_hex(16),
        tools=list(tools),
        responseFormat=response_format,
    )
    variables = {
        "input": CreateChatPromptInput(
            name=token_hex(16),
            promptVersion=version,
        ).model_dump(exclude_unset=True)
    }
    response, _ = _gql(app, api_key, query=_CREATE_CHAT_PROMPT, variables=variables)
    prompt_id = response["data"]["createChatPrompt"]["id"]
    return px.Client(endpoint=app.base_url, api_key=api_key).prompts.get(
        prompt_identifier=prompt_id
    )


_CREATE_CHAT_PROMPT = """
    mutation ($input: CreateChatPromptInput!) {
        createChatPrompt(input: $input) {
            id
        }
    }
"""


class TestClient:
    @pytest.mark.parametrize(
        "template_format",
        ["F_STRING", "MUSTACHE", "NONE"],
    )
    @pytest.mark.parametrize(
        "model_providers,convert,expected",
        [
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    max_tokens=randint(1, 256),
                    seed=randint(24, 42),
                    messages=[
                        {"role": "system", "content": "You are {role}."},
                        {"role": "user", "content": "Write a poem about {topic}."},
                    ],
                ),
                id="openai-system-message-string",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    max_completion_tokens=randint(1, 256),
                    seed=randint(24, 42),
                    messages=[
                        {
                            "role": "system",
                            "content": [
                                {"type": "text", "text": "You are {role}."},
                                {"type": "text", "text": "You study {topic}."},
                            ],
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Write a poem about {topic}."},
                                {"type": "text", "text": "Make it rhyme."},
                            ],
                        },
                    ],
                ),
                id="openai-system-message-list",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    seed=randint(24, 42),
                    messages=[{"role": "developer", "content": "You are {role}."}],
                ),
                id="openai-developer-message-string",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    seed=randint(24, 42),
                    messages=[
                        {
                            "role": "developer",
                            "content": [
                                {"type": "text", "text": "You are {role}."},
                                {"type": "text", "text": "You study {topic}."},
                            ],
                        },
                    ],
                ),
                id="openai-developer-message-list",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    seed=randint(24, 42),
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                    ],
                    tools=_OPENAI_TOOLS,
                    tool_choice="required",
                ),
                id="openai-tools",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    seed=randint(24, 42),
                    messages=[{"role": "user", "content": "create form for {feature}"}],
                    response_format=cast(
                        ResponseFormatJSONSchema,
                        type_to_response_format_param(create_model("Response", ui=(_UI, ...))),
                    ),
                ),
                id="openai-response-format",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    seed=randint(24, 42),
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                        {
                            "role": "assistant",
                            "content": "I'll call these functions",
                            "tool_calls": [
                                {
                                    "id": token_hex(8),
                                    "type": "function",
                                    "function": {
                                        "name": "get_weather",
                                        "arguments": '{"city": "Los Angeles"}',
                                    },
                                },
                                {
                                    "id": token_hex(8),
                                    "type": "function",
                                    "function": {
                                        "name": "get_population",
                                        "arguments": '{"location": "Los Angeles"}',
                                    },
                                },
                            ],
                        },
                    ],
                    tools=_OPENAI_TOOLS,
                    tool_choice="required",
                ),
                id="openai-function-calling",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    seed=randint(24, 42),
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                        {
                            "role": "assistant",
                            "content": "I'll call these functions",
                            "tool_calls": [
                                {
                                    "id": token_hex(8),
                                    "type": "function",
                                    "function": {
                                        "name": "get_weather",
                                        "arguments": '{"city": "Los Angeles"}',
                                    },
                                },
                                {
                                    "id": token_hex(8),
                                    "type": "function",
                                    "function": {
                                        "name": "get_population",
                                        "arguments": '{"location": "Los Angeles"}',
                                    },
                                },
                            ],
                        },
                        {
                            "role": "tool",
                            "tool_call_id": token_hex(8),
                            "content": "temp is hot and pop is large",
                        },
                    ],
                    tools=_OPENAI_TOOLS,
                    tool_choice="required",
                ),
                id="openai-tool-message-string",
            ),
            pytest.param(
                "OPENAI,AZURE_OPENAI,DEEPSEEK,XAI,OLLAMA",
                PromptVersion.from_openai,
                CompletionCreateParamsBase(
                    model=token_hex(8),
                    temperature=random(),
                    top_p=random(),
                    presence_penalty=random(),
                    frequency_penalty=random(),
                    seed=randint(24, 42),
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                        {
                            "role": "assistant",
                            "content": "I'll call these functions",
                            "tool_calls": [
                                {
                                    "id": token_hex(8),
                                    "type": "function",
                                    "function": {
                                        "name": "get_weather",
                                        "arguments": '{"city": "Los Angeles"}',
                                    },
                                },
                                {
                                    "id": token_hex(8),
                                    "type": "function",
                                    "function": {
                                        "name": "get_population",
                                        "arguments": '{"location": "Los Angeles"}',
                                    },
                                },
                            ],
                        },
                        {
                            "role": "tool",
                            "tool_call_id": token_hex(8),
                            "content": [
                                {"type": "text", "text": "temp is hot"},
                                {"type": "text", "text": "pop is large"},
                            ],
                        },
                    ],
                    tools=_OPENAI_TOOLS,
                    tool_choice="required",
                ),
                id="openai-tool-message-list",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    system="You are {role}.",
                    messages=[
                        {"role": "user", "content": "Write a haiku about {topic}."},
                    ],
                ),
                id="anthropic-system-message-string",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1025,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    thinking={
                        "type": "enabled",
                        "budget_tokens": 1024,
                    },
                    system="You are {role}.",
                    messages=[
                        {"role": "user", "content": "Write a haiku about {topic}."},
                    ],
                ),
                id="anthropic-thinking-enabled",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    thinking={"type": "disabled"},
                    system="You are {role}.",
                    messages=[
                        {"role": "user", "content": "Write a haiku about {topic}."},
                    ],
                ),
                id="anthropic-thinking-disabled",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    system=[
                        {"type": "text", "text": "You are {role}."},
                        {"type": "text", "text": "You study {topic}."},
                    ],
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Write a poem about {topic}."},
                                {"type": "text", "text": "Make it rhyme."},
                            ],
                        },
                    ],
                ),
                id="anthropic-system-message-list",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                    ],
                    tools=_ANTHROPIC_TOOLS,
                    tool_choice={"type": "any"},
                ),
                id="anthropic-tools",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    messages=[
                        {
                            "role": "user",
                            "content": "Given a description of a character, your task is to "
                            "extract all the characteristics of the character.\n"
                            "<description>{desc}</description>",
                        },
                    ],
                    tools=[
                        {
                            "name": "print_all_characteristics",
                            "description": "Prints all characteristics which are provided.",
                            "input_schema": {"type": "object", "additionalProperties": True},
                        }
                    ],
                    tool_choice={"type": "tool", "name": "print_all_characteristics"},
                ),
                id="anthropic-tool-with-unknown-keys",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                        {
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "I'll call these functions",
                                },
                                {  # type: ignore[misc,list-item]
                                    "type": "tool_use",
                                    "id": token_hex(8),
                                    "name": "get_weather",
                                    "input": '{"city": "Los Angeles"}',
                                },
                                {  # type: ignore[misc,list-item]
                                    "type": "tool_use",
                                    "id": token_hex(8),
                                    "name": "get_population",
                                    "input": '{"location": "Los Angeles"}',
                                },
                            ],
                        },
                    ],
                    tools=_ANTHROPIC_TOOLS,
                    tool_choice={"type": "any"},
                ),
                id="anthropic-tool-use",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                        {
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "I'll call these functions",
                                },
                                {  # type: ignore[misc,list-item]
                                    "type": "tool_use",
                                    "id": token_hex(8),
                                    "name": "get_weather",
                                    "input": '{"city": "Los Angeles"}',
                                },
                                {  # type: ignore[misc,list-item]
                                    "type": "tool_use",
                                    "id": token_hex(8),
                                    "name": "get_population",
                                    "input": '{"location": "Los Angeles"}',
                                },
                            ],
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "These are function results",
                                },
                                {
                                    "type": "tool_result",
                                    "tool_use_id": token_hex(8),
                                    "content": "temp is hot",
                                },
                                {
                                    "type": "tool_result",
                                    "tool_use_id": token_hex(8),
                                    "content": "pop is large",
                                },
                            ],
                        },
                    ],
                    tools=_ANTHROPIC_TOOLS,
                    tool_choice={"type": "any"},
                ),
                id="anthropic-tool-result-string",
            ),
            pytest.param(
                "ANTHROPIC",
                PromptVersion.from_anthropic,
                MessageCreateParamsBase(
                    model=token_hex(8),
                    max_tokens=1024,
                    temperature=random(),
                    top_p=random(),
                    stop_sequences=[token_hex(8), token_hex(8)],
                    messages=[
                        {
                            "role": "user",
                            "content": "What's the temperature and population in Los Angeles?",
                        },
                        {
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "I'll call these functions",
                                },
                                {  # type: ignore[misc,list-item]
                                    "type": "tool_use",
                                    "id": token_hex(8),
                                    "name": "get_weather",
                                    "input": '{"city": "Los Angeles"}',
                                },
                                {  # type: ignore[misc,list-item]
                                    "type": "tool_use",
                                    "id": token_hex(8),
                                    "name": "get_population",
                                    "input": '{"location": "Los Angeles"}',
                                },
                            ],
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "These are function results",
                                },
                                {
                                    "type": "tool_result",
                                    "tool_use_id": token_hex(8),
                                    "content": [
                                        {"type": "text", "text": "temp"},
                                        {"type": "text", "text": "is"},
                                        {"type": "text", "text": "hot"},
                                    ],
                                },
                                {
                                    "type": "tool_result",
                                    "tool_use_id": token_hex(8),
                                    "content": [
                                        {"type": "text", "text": "pop"},
                                        {"type": "text", "text": "is"},
                                        {"type": "text", "text": "large"},
                                    ],
                                },
                            ],
                        },
                    ],
                    tools=_ANTHROPIC_TOOLS,
                    tool_choice={"type": "any"},
                ),
                id="anthropic-tool-result-list",
            ),
        ],
    )
    def test_round_trip(
        self,
        model_providers: str,
        convert: Callable[..., PromptVersion],
        expected: dict[str, Any],
        template_format: Literal["F_STRING", "MUSTACHE", "NONE"],
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret
        prompt_identifier = token_hex(16)
        from phoenix.client import Client

        client = Client(base_url=_app.base_url, api_key=api_key)
        for model_provider in model_providers.split(","):
            version: PromptVersion = convert(
                expected,
                template_format=template_format,
                model_provider=model_provider,
            )
            client.prompts.create(
                name=prompt_identifier,
                version=version,
            )
            prompt = client.prompts.get(prompt_identifier=prompt_identifier)
            assert prompt._model_provider == model_provider
            assert prompt._template_format == template_format
            params = prompt.format(formatter=NO_OP_FORMATTER)
            assert not DeepDiff(expected, {**params})

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_version_tags(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test the version tagging functionality for prompts.

        This test verifies that:
        1. Tags can be created for prompt versions
        2. Tags are associated with specific versions, not the prompt itself
        3. Tags contain the expected name and description
        4. Only one version can have a tag with a given name - creating a tag with the same name
           for a different version will remove it from the previous version
        5. Different prompts can have tags with the same name without affecting each other
        """
        # Set up test environment with admin secret
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # First test: Verify tag name uniqueness within same prompt
        prompt_identifier = token_hex(16)

        # Create initial version of the prompt
        version = PromptVersion(
            [{"role": "user", "content": "hello {x}"}],
            model_name=token_hex(8),
        )
        prompt1 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.create(
                name=prompt_identifier,
                version=version,
            )
        )
        assert prompt1.id

        # Verify no tags exist initially
        tags = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.list(
                prompt_version_id=prompt1.id,
            )
        )
        assert not tags

        # Create a tag for the first version with a random name and description
        # Using random hex values ensures uniqueness and prevents test interference
        tag_name = token_hex(8)
        tag_description1 = token_hex(16)
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.create(
                prompt_version_id=prompt1.id,
                name=tag_name,
                description=tag_description1,
            )
        )

        # Verify tag was created with correct attributes
        tags = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.list(
                prompt_version_id=prompt1.id,
            )
        )
        assert len(tags) == 1
        assert tags[0]["name"] == tag_name
        assert "description" in tags[0]
        assert tags[0]["description"] == tag_description1

        # Verify tag is associated with the correct user (system user when using admin_secret)
        query = "query($id:ID!){node(id:$id){... on PromptVersionTag{user{id}}}}"
        res, _ = _gql(_app, _app.admin_secret, query=query, variables={"id": tags[0]["id"]})
        assert res["data"]["node"]["user"]["id"] == _SYSTEM_USER_GID

        # Create a second version of the same prompt
        prompt2 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.create(
                name=prompt_identifier,
                version=version,
            )
        )
        assert prompt2.id

        # Verify second version has no tags initially
        tags = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.list(
                prompt_version_id=prompt2.id,
            )
        )
        assert not tags

        # Use admin secret (no need for a different user)
        api_key = _app.admin_secret

        # Create a tag with the same name for the second version.
        # This will automatically remove the tag from the first version
        # due to tag name uniqueness.
        tag_description2 = token_hex(16)
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.create(
                prompt_version_id=prompt2.id,
                name=tag_name,
                description=tag_description2,
            )
        )

        # Verify tag was created for second version with the new description
        tags = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.list(
                prompt_version_id=prompt2.id,
            )
        )
        assert len(tags) == 1
        assert tags[0]["name"] == tag_name
        assert "description" in tags[0]
        assert tags[0]["description"] == tag_description2

        # Verify tag is associated with the correct user (system user)
        query = "query($id:ID!){node(id:$id){... on PromptVersionTag{user{id}}}}"
        res, _ = _gql(_app, _app.admin_secret, query=query, variables={"id": tags[0]["id"]})
        assert res["data"]["node"]["user"]["id"] == _SYSTEM_USER_GID

        # Verify first version's tag was automatically removed when we created
        # the tag for the second version. This demonstrates that tag names must
        # be unique across all versions.
        tags = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.list(
                prompt_version_id=prompt1.id,
            )
        )
        assert not tags

        # Second test: Verify tag name uniqueness is not enforced across different prompts
        # Create a new prompt with a different identifier
        new_prompt_identifier = token_hex(16)
        prompt3 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.create(
                name=new_prompt_identifier,
                version=version,
            )
        )
        assert prompt3.id

        # Create a tag with the same name for the new prompt
        # This should NOT affect the tag on prompt2 since they're different prompts
        tag_description3 = token_hex(16)
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.create(
                prompt_version_id=prompt3.id,
                name=tag_name,
                description=tag_description3,
            )
        )

        # Verify tag was created for the new prompt
        tags = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.list(
                prompt_version_id=prompt3.id,
            )
        )
        assert len(tags) == 1
        assert tags[0]["name"] == tag_name
        assert "description" in tags[0]
        assert tags[0]["description"] == tag_description3

        # Verify prompt2's tag was NOT affected since it's a different prompt
        tags = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).prompts.tags.list(
                prompt_version_id=prompt2.id,
            )
        )
        assert len(tags) == 1
        assert tags[0]["name"] == tag_name
        assert "description" in tags[0]
        assert tags[0]["description"] == tag_description2


class TestPromptFiltering:
    """Test filtering prompts by name, labels, and combinations."""

    def _create_prompt_via_gql(
        self,
        app: _AppInfo,
        name: str,
    ) -> str:
        """Create a prompt via GraphQL mutation and return its ID."""
        create_prompt_mutation = """
        mutation($input: CreateChatPromptInput!) {
            createChatPrompt(input: $input) {
                id
            }
        }
        """

        # Create a simple prompt version
        version = ChatPromptVersionInput(
            templateFormat="NONE",
            template=PromptChatTemplateInput(
                messages=[
                    PromptMessageInput(
                        role="USER",
                        content=[ContentPartInput(text=TextContentValueInput(text="hello {x}"))],
                    )
                ]
            ),
            invocationParameters={},
            modelProvider="OPENAI",
            modelName=token_hex(8),
            tools=[],
            responseFormat=None,
        )

        variables = {
            "input": CreateChatPromptInput(
                name=name,
                promptVersion=version,
            ).model_dump(exclude_unset=True)
        }

        response, _ = _gql(app, app.admin_secret, query=create_prompt_mutation, variables=variables)
        resp_id = response["data"]["createChatPrompt"]["id"]
        assert resp_id is not None
        assert isinstance(resp_id, str)
        return resp_id

    def test_filter_prompts_by_name(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test filtering prompts by name using GraphQL query."""
        # Keep compatibility with _create_prompt_via_gql

        # Create prompts with specific names for testing
        prompt1_name = f"test-prompt-{token_hex(4)}"
        prompt2_name = f"another-prompt-{token_hex(4)}"
        prompt3_name = f"test-another-{token_hex(4)}"

        # Create the test prompts via GraphQL
        self._create_prompt_via_gql(_app, prompt1_name)
        self._create_prompt_via_gql(_app, prompt2_name)
        self._create_prompt_via_gql(_app, prompt3_name)

        # Test filtering by name containing "test"
        query = """
        query($filter: PromptFilter, $labelIds: [ID!]) {
            prompts(first: 10, filter: $filter, labelIds: $labelIds) {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }
        """

        # Filter by name containing "test"
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"filter": {"col": "name", "value": "test"}, "labelIds": None},
        )

        results = response["data"]["prompts"]["edges"]
        result_names = [edge["node"]["name"] for edge in results]

        # Should return prompts with "test" in the name
        assert prompt1_name in result_names
        assert prompt3_name in result_names
        assert prompt2_name not in result_names

        # Test filtering by name containing "another"
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"filter": {"col": "name", "value": "another"}, "labelIds": None},
        )

        results = response["data"]["prompts"]["edges"]
        result_names = [edge["node"]["name"] for edge in results]

        # Should return prompts with "another" in the name
        assert prompt2_name in result_names
        assert prompt3_name in result_names
        assert prompt1_name not in result_names

    def test_filter_prompts_by_labels(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test filtering prompts by labels using GraphQL query."""
        # Keep compatibility with _create_prompt_via_gql

        # Create prompts
        prompt1_name = f"prompt-1-{token_hex(4)}"
        prompt2_name = f"prompt-2-{token_hex(4)}"
        prompt3_name = f"prompt-3-{token_hex(4)}"

        # Create prompts via GraphQL
        prompt1_id = self._create_prompt_via_gql(_app, prompt1_name)
        prompt2_id = self._create_prompt_via_gql(_app, prompt2_name)
        prompt3_id = self._create_prompt_via_gql(_app, prompt3_name)

        # Create labels
        label1_name = f"label-1-{token_hex(4)}"
        label2_name = f"label-2-{token_hex(4)}"

        # Create labels using GraphQL mutation
        create_label_mutation = """
        mutation($input: CreatePromptLabelInput!) {
            createPromptLabel(input: $input) {
                promptLabels {
                    id
                    name
                }
            }
        }
        """

        # Create first label
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=create_label_mutation,
            variables={
                "input": {"name": label1_name, "description": "Test label 1", "color": "#FF0000"}
            },
        )
        label1_id = response["data"]["createPromptLabel"]["promptLabels"][0]["id"]

        # Create second label
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=create_label_mutation,
            variables={
                "input": {"name": label2_name, "description": "Test label 2", "color": "#00FF00"}
            },
        )
        label2_id = response["data"]["createPromptLabel"]["promptLabels"][0]["id"]

        # Assign labels to prompts using GraphQL mutation
        set_labels_mutation = """
        mutation($input: SetPromptLabelsInput!) {
            setPromptLabels(input: $input) {
                query {
                    __typename
                }
            }
        }
        """

        # Assign label1 to prompt1
        _gql(
            _app,
            _app.admin_secret,
            query=set_labels_mutation,
            variables={"input": {"promptId": prompt1_id, "promptLabelIds": [label1_id]}},
        )

        # Assign both label1 and label2 to prompt2
        _gql(
            _app,
            _app.admin_secret,
            query=set_labels_mutation,
            variables={"input": {"promptId": prompt2_id, "promptLabelIds": [label1_id, label2_id]}},
        )

        # Assign label2 to prompt3
        _gql(
            _app,
            _app.admin_secret,
            query=set_labels_mutation,
            variables={"input": {"promptId": prompt3_id, "promptLabelIds": [label2_id]}},
        )

        # Test filtering by label1
        query = """
        query($filter: PromptFilter, $labelIds: [ID!]) {
            prompts(first: 10, filter: $filter, labelIds: $labelIds) {
                edges {
                    node {
                        id
                        name
                        labels {
                            id
                            name
                        }
                    }
                }
            }
        }
        """

        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"filter": None, "labelIds": [label1_id]},
        )

        results = response["data"]["prompts"]["edges"]
        result_ids = [edge["node"]["id"] for edge in results]

        # Should return prompts with label1
        assert prompt1_id in result_ids
        assert prompt2_id in result_ids
        assert prompt3_id not in result_ids

        # Test filtering by label2
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"filter": None, "labelIds": [label2_id]},
        )

        results = response["data"]["prompts"]["edges"]
        result_ids = [edge["node"]["id"] for edge in results]

        # Should return prompts with label2
        assert prompt2_id in result_ids
        assert prompt3_id in result_ids
        assert prompt1_id not in result_ids

        # Test filtering by both labels
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"filter": None, "labelIds": [label1_id, label2_id]},
        )

        results = response["data"]["prompts"]["edges"]
        result_ids = [edge["node"]["id"] for edge in results]

        # Should return prompts with either label1 or label2
        assert prompt1_id in result_ids
        assert prompt2_id in result_ids
        assert prompt3_id in result_ids

    def test_filter_prompts_by_name_and_labels(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test filtering prompts by both name and labels using GraphQL query."""

        # Create prompts with specific names
        test_prompt_name = f"test-prompt-{token_hex(4)}"
        another_prompt_name = f"another-prompt-{token_hex(4)}"
        test_another_name = f"test-another-{token_hex(4)}"

        # Create prompts via GraphQL
        test_prompt_id = self._create_prompt_via_gql(_app, test_prompt_name)
        another_prompt_id = self._create_prompt_via_gql(_app, another_prompt_name)
        test_another_id = self._create_prompt_via_gql(_app, test_another_name)

        # Create labels
        test_label_name = f"test-label-{token_hex(4)}"
        other_label_name = f"other-label-{token_hex(4)}"

        create_label_mutation = """
        mutation($input: CreatePromptLabelInput!) {
            createPromptLabel(input: $input) {
                promptLabels {
                    id
                    name
                }
            }
        }
        """

        # Create test label
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=create_label_mutation,
            variables={
                "input": {"name": test_label_name, "description": "Test label", "color": "#FF0000"}
            },
        )
        test_label_id = response["data"]["createPromptLabel"]["promptLabels"][0]["id"]

        # Create other label
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=create_label_mutation,
            variables={
                "input": {
                    "name": other_label_name,
                    "description": "Other label",
                    "color": "#00FF00",
                }
            },
        )
        other_label_id = response["data"]["createPromptLabel"]["promptLabels"][0]["id"]

        # Assign labels to prompts
        set_labels_mutation = """
        mutation($input: SetPromptLabelsInput!) {
            setPromptLabels(input: $input) {
                query {
                    __typename
                }
            }
        }
        """

        # Assign test label to test_prompt and test_another
        _gql(
            _app,
            _app.admin_secret,
            query=set_labels_mutation,
            variables={"input": {"promptId": test_prompt_id, "promptLabelIds": [test_label_id]}},
        )

        _gql(
            _app,
            _app.admin_secret,
            query=set_labels_mutation,
            variables={"input": {"promptId": test_another_id, "promptLabelIds": [test_label_id]}},
        )

        # Assign other label to another_prompt
        _gql(
            _app,
            _app.admin_secret,
            query=set_labels_mutation,
            variables={
                "input": {"promptId": another_prompt_id, "promptLabelIds": [other_label_id]}
            },
        )

        # Test filtering by name "test" AND label "test-label"
        query = """
        query($filter: PromptFilter, $labelIds: [ID!]) {
            prompts(first: 10, filter: $filter, labelIds: $labelIds) {
                edges {
                    node {
                        id
                        name
                        labels {
                            id
                            name
                        }
                    }
                }
            }
        }
        """

        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"filter": {"col": "name", "value": "test"}, "labelIds": [test_label_id]},
        )

        results = response["data"]["prompts"]["edges"]
        result_ids = [edge["node"]["id"] for edge in results]

        # Should return prompts that have "test" in name AND have the test label
        assert test_prompt_id in result_ids
        assert test_another_id in result_ids
        assert another_prompt_id not in result_ids

        # Test filtering by name "another" AND label "other-label"
        response, _ = _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"filter": {"col": "name", "value": "another"}, "labelIds": [other_label_id]},
        )

        results = response["data"]["prompts"]["edges"]
        result_ids = [edge["node"]["id"] for edge in results]

        # Should return prompts that have "another" in name AND have the other label
        assert another_prompt_id in result_ids
        assert test_prompt_id not in result_ids
        assert test_another_id not in result_ids
