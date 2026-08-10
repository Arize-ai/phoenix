# pyright: reportUnknownMemberType=false
import json
from secrets import token_hex
from typing import Any, Mapping

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from google.genai import types as genai_types

from phoenix.client.__generated__ import v1
from phoenix.client.__generated__.v1 import TextContentPart
from phoenix.client.helpers.sdk.google_genai.generate_content import (
    _ContentConversion,
    _FunctionDeclarationConversion,
    _TextContentPartConversion,
    _ToolKwargs,
    _ToolKwargsConversion,
    to_chat_messages_and_kwargs,
)
from phoenix.client.types import PromptVersion
from phoenix.client.types.prompts import GoogleGenAIPrompt
from phoenix.client.utils.template_formatters import NO_OP_FORMATTER


def _dict() -> dict[str, Any]:
    return Faker().pydict(3, value_types=(int, float, bool, str))  # pyright: ignore[reportUnknownMemberType]


def _text() -> genai_types.Part:
    return genai_types.Part(text=token_hex(8))


class TestContentConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            genai_types.Content(role="user", parts=[_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: genai_types.Content) -> None:
        new_obj: genai_types.Content = next(
            _ContentConversion.to_google(_ContentConversion.from_google(obj), {}, NO_OP_FORMATTER)
        )
        assert not DeepDiff(
            obj.model_dump(exclude_none=True),
            new_obj.model_dump(exclude_none=True),
        )


class TestTextPartConversion:
    def test_round_trip(self) -> None:
        obj: genai_types.Part = _text()
        new_obj: genai_types.Part = _TextContentPartConversion.to_google(
            _TextContentPartConversion.from_google(obj), {}, NO_OP_FORMATTER
        )
        assert not DeepDiff(
            obj.model_dump(exclude_none=True),
            new_obj.model_dump(exclude_none=True),
        )

    def test_formatter(self) -> None:
        obj = TextContentPart(type="text", text=token_hex(8))
        formatter, variables = _MockFormatter(), _dict()
        part: genai_types.Part = _TextContentPartConversion.to_google(obj, variables, formatter)
        assert part.text == formatter.format(obj["text"], variables=variables)


_FUNCTION_DECLARATIONS = [
    genai_types.FunctionDeclaration(
        name="_f",
        description=token_hex(8),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "a": genai_types.Schema(type=genai_types.Type.INTEGER),
                "b": genai_types.Schema(
                    type=genai_types.Type.ARRAY,
                    items=genai_types.Schema(type=genai_types.Type.NUMBER),
                ),
                "c": genai_types.Schema(type=genai_types.Type.STRING),
                "d": genai_types.Schema(type=genai_types.Type.BOOLEAN),
            },
            required=["a", "b", "c", "d"],
        ),
    ),
    genai_types.FunctionDeclaration(
        name="_g",
        description=token_hex(8),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "a": genai_types.Schema(
                    type=genai_types.Type.ARRAY,
                    items=genai_types.Schema(type=genai_types.Type.INTEGER),
                ),
                "b": genai_types.Schema(type=genai_types.Type.NUMBER),
                "c": genai_types.Schema(
                    type=genai_types.Type.STRING,
                    enum=["x", "y", "z"],
                ),
                "d": genai_types.Schema(type=genai_types.Type.BOOLEAN, nullable=True),
            },
            required=["a", "b"],
        ),
    ),
]


_JSON_SCHEMA_DECLARATIONS = [
    genai_types.FunctionDeclaration(
        name="_h",
        description=token_hex(8),
        parameters_json_schema={
            "type": "object",
            "properties": {
                # `anyOf`, `$ref`/`$defs` and `default` cannot be expressed by
                # `genai_types.Schema`, so they must survive verbatim.
                "a": {"anyOf": [{"type": "string"}, {"type": "null"}], "default": None},
                "b": {"$ref": "#/$defs/B"},
                "c": {"type": "integer", "default": 3, "title": "C"},
            },
            "$defs": {"B": {"type": "object", "properties": {"x": {"type": "string"}}}},
            "required": ["b"],
        },
    ),
]


class TestFunctionDeclarationConversion:
    @pytest.mark.parametrize(
        "obj",
        _JSON_SCHEMA_DECLARATIONS,
    )
    def test_json_schema_round_trip(self, obj: genai_types.FunctionDeclaration) -> None:
        new_obj: genai_types.FunctionDeclaration = _FunctionDeclarationConversion.to_google(
            _FunctionDeclarationConversion.from_google(obj)
        )
        assert not DeepDiff(
            obj.model_dump(exclude_none=True),
            new_obj.model_dump(exclude_none=True),
        )

    @pytest.mark.parametrize(
        "obj",
        _FUNCTION_DECLARATIONS,
    )
    def test_schema_is_converted_to_json_schema(self, obj: genai_types.FunctionDeclaration) -> None:
        """A `Schema`-based declaration is preserved as raw JSON schema."""
        new_obj: genai_types.FunctionDeclaration = _FunctionDeclarationConversion.to_google(
            _FunctionDeclarationConversion.from_google(obj)
        )
        assert new_obj.name == obj.name
        assert new_obj.parameters is None
        assert new_obj.parameters_json_schema is not None
        assert obj.parameters is not None
        assert isinstance(new_obj.parameters_json_schema, dict)
        schema: Mapping[str, Any] = new_obj.parameters_json_schema
        assert schema["type"] == "object"
        properties: Mapping[str, Any] = schema["properties"]
        assert set(properties) == set(obj.parameters.properties or {})

    def test_optional_parameter_is_not_dropped(self) -> None:
        """An `anyOf` (e.g. `Optional[str]`) property must not collapse to an empty schema."""
        params = {
            "type": "object",
            "properties": {"a": {"anyOf": [{"type": "string"}, {"type": "null"}]}},
        }
        fd = _FunctionDeclarationConversion.to_google(
            v1.PromptToolFunction(
                type="function",
                function=v1.PromptToolFunctionDefinition(name="f", parameters=params),
            )
        )
        assert fd.parameters_json_schema == params


# Uses JSON-schema declarations so the round trip is representation-preserving:
# `to_google` always emits `parameters_json_schema` (see
# `TestFunctionDeclarationConversion.test_schema_is_converted_to_json_schema`).
_TOOLS = [genai_types.Tool(function_declarations=_JSON_SCHEMA_DECLARATIONS)]


class TestToolKwargsConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            {
                "tools": _TOOLS,
                "tool_config": genai_types.ToolConfig(
                    function_calling_config=genai_types.FunctionCallingConfig(
                        mode=genai_types.FunctionCallingConfigMode.ANY,
                    ),
                ),
            },
            {
                "tools": _TOOLS,
                "tool_config": genai_types.ToolConfig(
                    function_calling_config=genai_types.FunctionCallingConfig(
                        mode=genai_types.FunctionCallingConfigMode.NONE,
                    ),
                ),
            },
            {
                "tools": _TOOLS,
                "tool_config": genai_types.ToolConfig(
                    function_calling_config=genai_types.FunctionCallingConfig(
                        mode=genai_types.FunctionCallingConfigMode.AUTO,
                    ),
                ),
            },
            {
                "tools": _TOOLS,
                "tool_config": genai_types.ToolConfig(
                    function_calling_config=genai_types.FunctionCallingConfig(
                        mode=genai_types.FunctionCallingConfigMode.ANY,
                        allowed_function_names=["_f"],
                    ),
                ),
            },
        ],
    )
    def test_round_trip(self, obj: _ToolKwargs) -> None:
        new_obj = _ToolKwargsConversion.to_google(_ToolKwargsConversion.from_google(obj))
        assert "tools" in obj
        assert "tools" in new_obj
        for i in range(len(obj["tools"])):
            assert not DeepDiff(
                obj["tools"][i].model_dump(exclude_none=True),
                new_obj["tools"][i].model_dump(exclude_none=True),
            )
        assert "tool_config" in obj
        assert "tool_config" in new_obj
        assert not DeepDiff(
            obj["tool_config"].model_dump(exclude_none=True),
            new_obj["tool_config"].model_dump(exclude_none=True),
        )


class TestToolMessages:
    def test_tool_call_and_result_are_preserved(self) -> None:
        """Tool-call/tool-result messages must not collapse to empty `parts`."""
        obj = _prompt_version(
            [
                v1.PromptMessage(role="user", content="weather?"),
                v1.PromptMessage(
                    role="assistant",
                    content=[
                        v1.ToolCallContentPart(
                            type="tool_call",
                            tool_call_id="c1",
                            tool_call=v1.ToolCallFunction(
                                type="function",
                                name="get_weather",
                                arguments='{"city": "Paris"}',
                            ),
                        )
                    ],
                ),
                v1.PromptMessage(
                    role="tool",
                    content=[
                        v1.ToolResultContentPart(
                            type="tool_result", tool_call_id="c1", tool_result={"temp": 20}
                        )
                    ],
                ),
            ]
        )
        messages, _ = to_chat_messages_and_kwargs(obj)
        assert all(m.parts for m in messages), "no message may have empty parts"
        assert len(messages) == 3
        call = _first_part(messages[1]).function_call
        assert call is not None
        assert call.name == "get_weather"
        assert call.args == {"city": "Paris"}
        assert call.id == "c1"
        response = _first_part(messages[2]).function_response
        assert response is not None
        # Google matches responses by function name, not call id.
        assert response.name == "get_weather"
        assert response.response == {"temp": 20}

    def test_scalar_tool_result_is_wrapped(self) -> None:
        obj = _prompt_version(
            [
                v1.PromptMessage(
                    role="tool",
                    content=[
                        v1.ToolResultContentPart(
                            type="tool_result", tool_call_id="c1", tool_result=42
                        )
                    ],
                ),
            ]
        )
        messages, _ = to_chat_messages_and_kwargs(obj)
        response = _first_part(messages[0]).function_response
        assert response is not None
        assert response.response == {"output": 42}

    def test_malformed_tool_call_arguments_do_not_raise(self) -> None:
        obj = _prompt_version(
            [
                v1.PromptMessage(
                    role="assistant",
                    content=[
                        v1.ToolCallContentPart(
                            type="tool_call",
                            tool_call_id="c1",
                            tool_call=v1.ToolCallFunction(
                                type="function", name="f", arguments="not json"
                            ),
                        )
                    ],
                ),
            ]
        )
        messages, _ = to_chat_messages_and_kwargs(obj)
        call = _first_part(messages[0]).function_call
        assert call is not None
        assert call.args == {}


class TestInvocationParameters:
    def test_thinking_config_is_propagated(self) -> None:
        obj = _prompt_version([v1.PromptMessage(role="user", content="hi")])
        obj["invocation_parameters"] = v1.PromptGoogleInvocationParameters(
            type="google",
            google=v1.PromptGoogleInvocationParametersContent(
                thinking_config=v1.PromptGoogleThinkingConfig(
                    thinking_budget=1024, include_thoughts=True
                ),
            ),
        )
        _, kwargs = to_chat_messages_and_kwargs(obj)
        thinking_config = kwargs["config"].thinking_config
        assert thinking_config is not None
        assert thinking_config.thinking_budget == 1024
        assert thinking_config.include_thoughts is True

    def test_response_format_is_propagated(self) -> None:
        schema = {"type": "object", "properties": {"a": {"type": "string"}}}
        obj = _prompt_version([v1.PromptMessage(role="user", content="hi")])
        obj["response_format"] = v1.PromptResponseFormatJSONSchema(
            type="json_schema",
            json_schema=v1.PromptResponseFormatJSONSchemaDefinition(name="out", schema=schema),
        )
        _, kwargs = to_chat_messages_and_kwargs(obj)
        config = kwargs["config"]
        assert config.response_mime_type == "application/json"
        assert config.response_json_schema == schema


class TestToolKwargsGuards:
    def test_tool_config_omitted_without_function_declarations(self) -> None:
        """Google rejects `function_calling_config` for built-in tools."""
        obj = _ToolKwargsConversion.to_google(
            v1.PromptTools(
                type="tools",
                tools=[v1.PromptToolRaw(type="raw", raw={"google_search": {}})],
                tool_choice={"type": "zero_or_more"},
            )
        )
        assert "tool_config" not in obj
        assert "tools" in obj
        assert obj["tools"][0].google_search is not None

    def test_no_degenerate_empty_tool(self) -> None:
        obj = _ToolKwargsConversion.to_google(
            v1.PromptTools(type="tools", tools=[], tool_choice={"type": "zero_or_more"})
        )
        assert "tools" not in obj
        assert "tool_config" not in obj


class TestPromptVersionFormatting:
    def test_google_provider_uses_google_genai_by_default(self) -> None:
        prompt = PromptVersion(
            [
                v1.PromptMessage(role="system", content="Be concise."),
                v1.PromptMessage(role="user", content="Hello"),
            ],
            model_name="gemini-2.0-flash",
            model_provider="GOOGLE",
            template_format="NONE",
        )

        formatted = prompt.format()

        assert isinstance(formatted, GoogleGenAIPrompt)
        assert formatted.kwargs["model"] == "gemini-2.0-flash"
        assert formatted.kwargs["config"].system_instruction == "Be concise."
        assert len(formatted.messages) == 1
        assert isinstance(formatted.messages[0], genai_types.Content)
        assert formatted.messages[0].role == "user"
        assert _first_part(formatted.messages[0]).text == "Hello"


def _first_part(content: genai_types.Content) -> genai_types.Part:
    assert content.parts
    return content.parts[0]


def _prompt_version(messages: list[v1.PromptMessage]) -> v1.PromptVersionData:
    return v1.PromptVersionData(
        model_provider="GOOGLE",
        model_name="gemini-2.0-flash",
        template=v1.PromptChatTemplate(type="chat", messages=messages),
        template_type="CHAT",
        template_format="NONE",
        invocation_parameters=v1.PromptGoogleInvocationParameters(
            type="google", google=v1.PromptGoogleInvocationParametersContent()
        ),
    )


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
