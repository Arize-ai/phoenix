import json
from secrets import token_hex
from typing import Any, Mapping

import pytest
from faker import Faker
from google.genai import types

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
from phoenix.client.utils.template_formatters import NO_OP_FORMATTER


def _dict() -> dict[str, Any]:
    return Faker().pydict(3, value_types=(int, float, bool, str))  # pyright: ignore[reportUnknownMemberType]


def _text() -> types.Part:
    return types.Part(text=token_hex(8))


class TestContentConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            types.Content(role="user", parts=[_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: types.Content) -> None:
        new_obj: types.Content = next(
            _ContentConversion.to_google(_ContentConversion.from_google(obj), {}, NO_OP_FORMATTER)
        )
        assert obj.role == new_obj.role
        assert len(obj.parts or []) == len(new_obj.parts or [])
        for orig_part, new_part in zip(obj.parts or [], new_obj.parts or []):
            assert orig_part.text == new_part.text


class TestTextPartConversion:
    def test_round_trip(self) -> None:
        obj: types.Part = _text()
        new_obj: types.Part = _TextContentPartConversion.to_google(
            _TextContentPartConversion.from_google(obj), {}, NO_OP_FORMATTER
        )
        assert obj.text == new_obj.text

    def test_formatter(self) -> None:
        obj = TextContentPart(type="text", text=token_hex(8))
        formatter, variables = _MockFormatter(), _dict()
        part: types.Part = _TextContentPartConversion.to_google(obj, variables, formatter)
        assert part.text == formatter.format(obj["text"], variables=variables)


def _f(a: int, b: list[float], c: str, d: list[bool], e: dict[str, Any]) -> int:
    raise NotImplementedError


def _g(a: list[int], b: float, c: list[str], d: bool, e: list[dict[str, Any]]) -> str:
    raise NotImplementedError


# Create function declarations manually for google-genai
_FUNCTION_DECLARATIONS = [
    types.FunctionDeclaration(
        name="_f",
        description="Function f",
        parameters={
            "type": "object",
            "properties": {
                "a": {"type": "integer"},
                "b": {"type": "array", "items": {"type": "number"}},
                "c": {"type": "string"},
                "d": {"type": "array", "items": {"type": "boolean"}},
                "e": {"type": "object"},
            },
            "required": ["a", "b", "c", "d", "e"],
        },
    ),
    types.FunctionDeclaration(
        name="_g",
        description="Function g",
        parameters={
            "type": "object",
            "properties": {
                "a": {"type": "array", "items": {"type": "integer"}},
                "b": {"type": "number"},
                "c": {"type": "array", "items": {"type": "string"}},
                "d": {"type": "boolean"},
                "e": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["a", "b", "c", "d", "e"],
        },
    ),
]


class TestFunctionDeclarationConversion:
    @pytest.mark.parametrize(
        "obj",
        _FUNCTION_DECLARATIONS,
    )
    def test_round_trip(self, obj: types.FunctionDeclaration) -> None:
        new_obj: types.FunctionDeclaration = _FunctionDeclarationConversion.to_google(
            _FunctionDeclarationConversion.from_google(obj)
        )
        assert obj.name == new_obj.name
        assert obj.description == new_obj.description


_TOOLS = [types.Tool(function_declarations=_FUNCTION_DECLARATIONS)]


class TestToolKwargsConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            {
                "tools": _TOOLS,
                "tool_config": types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode="any"),
                ),
            },
            {
                "tools": _TOOLS,
                "tool_config": types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode="none"),
                ),
            },
            {
                "tools": _TOOLS,
                "tool_config": types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode="auto"),
                ),
            },
        ],
    )
    def test_round_trip(self, obj: _ToolKwargs) -> None:
        new_obj = _ToolKwargsConversion.to_google(_ToolKwargsConversion.from_google(obj))
        assert "tools" in obj
        assert "tools" in new_obj
        # Compare tool function declarations
        for orig_tool, new_tool in zip(obj["tools"], new_obj["tools"]):
            orig_fds = orig_tool.function_declarations or []
            new_fds = new_tool.function_declarations or []
            assert len(orig_fds) == len(new_fds)
            for orig_fd, new_fd in zip(orig_fds, new_fds):
                assert orig_fd.name == new_fd.name
                assert orig_fd.description == new_fd.description
        # Compare tool config
        assert "tool_config" in obj
        assert "tool_config" in new_obj
        orig_fcc = obj["tool_config"].function_calling_config
        new_fcc = new_obj["tool_config"].function_calling_config
        assert orig_fcc is not None
        assert new_fcc is not None
        # Normalize mode comparison
        orig_mode = orig_fcc.mode.value.lower() if orig_fcc.mode else "auto"
        new_mode = new_fcc.mode.value.lower() if new_fcc.mode else "auto"
        assert orig_mode == new_mode


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)


class TestToChatMessagesAndKwargs:
    """End-to-end tests for to_chat_messages_and_kwargs function."""

    @pytest.mark.parametrize(
        "prompt_version_data",
        [
            # Basic user message
            v1.PromptVersionData(
                model_provider="GOOGLE",
                model_name="gemini-pro",
                template=v1.PromptChatTemplate(
                    type="chat",
                    messages=[
                        v1.PromptMessage(role="user", content="Hello, how are you?"),
                    ],
                ),
                template_type="CHAT",
                template_format="NONE",
                invocation_parameters=v1.PromptGoogleInvocationParameters(
                    type="google",
                    google=v1.PromptGoogleInvocationParametersContent(),
                ),
            ),
            # User and assistant messages
            v1.PromptVersionData(
                model_provider="GOOGLE",
                model_name="gemini-pro",
                template=v1.PromptChatTemplate(
                    type="chat",
                    messages=[
                        v1.PromptMessage(role="user", content="What is 2+2?"),
                        v1.PromptMessage(role="assistant", content="2+2 equals 4."),
                        v1.PromptMessage(role="user", content="And 3+3?"),
                    ],
                ),
                template_type="CHAT",
                template_format="NONE",
                invocation_parameters=v1.PromptGoogleInvocationParameters(
                    type="google",
                    google=v1.PromptGoogleInvocationParametersContent(),
                ),
            ),
            # With invocation parameters
            v1.PromptVersionData(
                model_provider="GOOGLE",
                model_name="gemini-1.5-pro",
                template=v1.PromptChatTemplate(
                    type="chat",
                    messages=[
                        v1.PromptMessage(role="user", content="Tell me a story."),
                    ],
                ),
                template_type="CHAT",
                template_format="NONE",
                invocation_parameters=v1.PromptGoogleInvocationParameters(
                    type="google",
                    google=v1.PromptGoogleInvocationParametersContent(
                        temperature=0.7,
                        max_output_tokens=1024,
                        top_p=0.9,
                        top_k=40,
                    ),
                ),
            ),
            # With multiple text parts in content
            v1.PromptVersionData(
                model_provider="GOOGLE",
                model_name="gemini-pro",
                template=v1.PromptChatTemplate(
                    type="chat",
                    messages=[
                        v1.PromptMessage(
                            role="user",
                            content=[
                                v1.TextContentPart(type="text", text="First part."),
                                v1.TextContentPart(type="text", text="Second part."),
                            ],
                        ),
                    ],
                ),
                template_type="CHAT",
                template_format="NONE",
                invocation_parameters=v1.PromptGoogleInvocationParameters(
                    type="google",
                    google=v1.PromptGoogleInvocationParametersContent(),
                ),
            ),
        ],
    )
    def test_basic_conversion(self, prompt_version_data: v1.PromptVersionData) -> None:
        """Test that to_chat_messages_and_kwargs produces valid output."""
        messages, kwargs = to_chat_messages_and_kwargs(
            prompt_version_data, formatter=NO_OP_FORMATTER
        )

        # Verify messages is a list of types.Content
        assert isinstance(messages, list)
        for msg in messages:
            assert isinstance(msg, types.Content)
            assert msg.role in ("user", "model")
            assert len(msg.parts or []) > 0

        # Verify kwargs has expected structure
        assert "model_name" in kwargs
        assert kwargs["model_name"] == prompt_version_data["model_name"]

    def test_invocation_parameters_are_passed(self) -> None:
        """Test that invocation parameters are correctly passed to kwargs."""
        prompt_version_data = v1.PromptVersionData(
            model_provider="GOOGLE",
            model_name="gemini-pro",
            template=v1.PromptChatTemplate(
                type="chat",
                messages=[
                    v1.PromptMessage(role="user", content="Hello"),
                ],
            ),
            template_type="CHAT",
            template_format="NONE",
            invocation_parameters=v1.PromptGoogleInvocationParameters(
                type="google",
                google=v1.PromptGoogleInvocationParametersContent(
                    temperature=0.5,
                    max_output_tokens=512,
                    top_p=0.8,
                ),
            ),
        )

        messages, kwargs = to_chat_messages_and_kwargs(
            prompt_version_data, formatter=NO_OP_FORMATTER
        )

        assert kwargs["temperature"] == 0.5
        assert kwargs["max_output_tokens"] == 512
        assert kwargs["top_p"] == 0.8

    def test_message_content_preserved(self) -> None:
        """Test that message content is preserved correctly."""
        user_text = "What is the weather today?"
        assistant_text = "I don't have access to real-time weather data."

        prompt_version_data = v1.PromptVersionData(
            model_provider="GOOGLE",
            model_name="gemini-pro",
            template=v1.PromptChatTemplate(
                type="chat",
                messages=[
                    v1.PromptMessage(role="user", content=user_text),
                    v1.PromptMessage(role="assistant", content=assistant_text),
                ],
            ),
            template_type="CHAT",
            template_format="NONE",
            invocation_parameters=v1.PromptGoogleInvocationParameters(
                type="google",
                google=v1.PromptGoogleInvocationParametersContent(),
            ),
        )

        messages, kwargs = to_chat_messages_and_kwargs(
            prompt_version_data, formatter=NO_OP_FORMATTER
        )

        assert len(messages) == 2
        assert messages[0].role == "user"
        assert messages[0].parts[0].text == user_text
        assert messages[1].role == "model"  # assistant -> model
        assert messages[1].parts[0].text == assistant_text
