from __future__ import annotations

from enum import Enum
from secrets import token_hex
from types import MappingProxyType
from typing import Any, Literal, Mapping, Sequence, cast

import phoenix as px
import pytest
from deepdiff.diff import DeepDiff
from openai import pydantic_function_tool
from openai.lib._parsing import type_to_response_format_param
from openai.types.shared_params import ResponseFormatJSONSchema
from phoenix.client.__generated__.v1 import PromptVersion
from phoenix.client.utils import to_chat_messages_and_kwargs
from pydantic import BaseModel, create_model

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
from .._helpers import _MEMBER, _GetUser, _LoggedInUser


class TestUserMessage:
    def test_user_message(
        self,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        u = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())
        prompt = _create_chat_prompt(u)
        x = token_hex(4)
        messages, _ = to_chat_messages_and_kwargs(prompt, variables={"x": x})
        assert not DeepDiff(messages, [{"role": "user", "content": f"hello {x}"}])


class _GetWeather(BaseModel):
    city: str
    country: str


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
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        u = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())
        tools = [ToolDefinitionInput(definition=dict(pydantic_function_tool(t))) for t in types_]
        prompt = _create_chat_prompt(u, tools=tools)
        assert "tools" in prompt
        actual = {
            t["name"]: t["schema"]["json"]
            for t in prompt["tools"]["tools"]
            if "schema" in t and "json" in t["schema"]
        }
        assert len(actual) == len(tools)
        expected = {
            t.definition["function"]["name"]: t.definition["function"]["parameters"]
            for t in tools
            if "function" in t.definition
            and "name" in t.definition["function"]
            and "parameters" in t.definition["function"]
        }
        assert len(expected) == len(tools)
        assert not DeepDiff(actual, expected)


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
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        u = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())
        response_format = ResponseFormatInput(
            definition=dict(cast(ResponseFormatJSONSchema, type_to_response_format_param(type_)))
        )
        prompt = _create_chat_prompt(u, response_format=response_format)
        assert "response_format" in prompt
        assert not DeepDiff(
            prompt["response_format"]["schema"]["json"],
            response_format.definition["json_schema"]["schema"],
        )


def _create_chat_prompt(
    u: _LoggedInUser,
    /,
    *,
    messages: Sequence[PromptMessageInput] = (),
    model_provider: str = "OPENAI",
    model_name: str | None = None,
    response_format: ResponseFormatInput | None = None,
    tools: Sequence[ToolDefinitionInput] = (),
    invocation_parameters: Mapping[str, Any] = MappingProxyType({}),
    template_format: Literal["FSTRING", "MUSTACHE", "NONE"] = "FSTRING",
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
    response, _ = u.gql(query=_CREATE_CHAT_PROMPT, variables=variables)
    prompt_id = response["data"]["createChatPrompt"]["id"]
    return px.Client().prompts.get(prompt_identifier=prompt_id)


_CREATE_CHAT_PROMPT = """
    mutation ($input: CreateChatPromptInput!) {
        createChatPrompt(input: $input) {
            id
        }
    }
"""
