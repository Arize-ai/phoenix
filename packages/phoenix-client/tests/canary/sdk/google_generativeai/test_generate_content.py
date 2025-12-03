# pyright: reportUnknownMemberType=false
import json
from secrets import token_hex
from typing import Any, Mapping

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from google.generativeai import protos
from google.generativeai.types import content_types

from phoenix.client.__generated__ import v1
from phoenix.client.__generated__.v1 import TextContentPart
from phoenix.client.helpers.sdk.google_generativeai.generate_content import (
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


def _text() -> protos.Part:
    ans = protos.Part()  # type: ignore[no-untyped-call]
    ans.text = token_hex(8)
    return ans


class TestContentConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            protos.Content(role="user", parts=[_text(), _text()]),  # type: ignore[no-untyped-call]
        ],
    )
    def test_round_trip(self, obj: protos.Content) -> None:
        new_obj: protos.Content = next(
            _ContentConversion.to_google(_ContentConversion.from_google(obj), {}, NO_OP_FORMATTER)
        )
        assert not DeepDiff(
            protos.Content.to_dict(obj),
            protos.Content.to_dict(new_obj),
        )


class TestTextPartConversion:
    def test_round_trip(self) -> None:
        obj: protos.Part = _text()
        new_obj: protos.Part = _TextContentPartConversion.to_google(
            _TextContentPartConversion.from_google(obj), {}, NO_OP_FORMATTER
        )
        assert not DeepDiff(
            protos.Part.to_dict(obj),
            protos.Part.to_dict(new_obj),
        )

    def test_formatter(self) -> None:
        obj = TextContentPart(type="text", text=token_hex(8))
        formatter, variables = _MockFormatter(), _dict()
        part: protos.Part = _TextContentPartConversion.to_google(obj, variables, formatter)
        assert part.text == formatter.format(obj["text"], variables=variables)


def _f(a: int, b: list[float], c: str, d: list[bool], e: dict[str, Any]) -> int:
    raise NotImplementedError


def _g(a: list[int], b: float, c: list[str], d: bool, e: list[dict[str, Any]]) -> str:
    raise NotImplementedError


_FUNCTION_DECLARATIONS = [
    content_types.FunctionDeclaration.from_function(_f),
    content_types.FunctionDeclaration.from_function(_g),
]


class TestFunctionDeclarationConversion:
    @pytest.mark.parametrize(
        "obj",
        _FUNCTION_DECLARATIONS,
    )
    def test_round_trip(self, obj: content_types.FunctionDeclaration) -> None:
        new_obj: content_types.FunctionDeclaration = _FunctionDeclarationConversion.to_google(
            _FunctionDeclarationConversion.from_google(obj)
        )
        assert not DeepDiff(
            protos.FunctionDeclaration.to_dict(obj.to_proto()),
            protos.FunctionDeclaration.to_dict(new_obj.to_proto()),
        )


_TOOLS = [content_types.Tool(function_declarations=_FUNCTION_DECLARATIONS)]


class TestToolKwargsConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            {
                "tools": _TOOLS,
                "tool_config": protos.ToolConfig(  # type: ignore[no-untyped-call]
                    function_calling_config=protos.FunctionCallingConfig(  # type: ignore[no-untyped-call]
                        mode=protos.FunctionCallingConfig.Mode.ANY
                    ),
                ),
            },
            {
                "tools": _TOOLS,
                "tool_config": protos.ToolConfig(  # type: ignore[no-untyped-call]
                    function_calling_config=protos.FunctionCallingConfig(  # type: ignore[no-untyped-call]
                        mode=protos.FunctionCallingConfig.Mode.NONE
                    ),
                ),
            },
            {
                "tools": _TOOLS,
                "tool_config": protos.ToolConfig(  # type: ignore[no-untyped-call]
                    function_calling_config=protos.FunctionCallingConfig(  # type: ignore[no-untyped-call]
                        mode=protos.FunctionCallingConfig.Mode.AUTO
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
                protos.Tool.to_dict(obj["tools"][i].to_proto()),  # type: ignore[no-untyped-call]
                protos.Tool.to_dict(new_obj["tools"][i].to_proto()),  # type: ignore[no-untyped-call]
            )
        assert "tool_config" in obj
        assert "tool_config" in new_obj
        assert not DeepDiff(
            protos.ToolConfig.to_dict(obj["tool_config"]),
            protos.ToolConfig.to_dict(new_obj["tool_config"]),
        )


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

        # Verify messages is a list of protos.Content
        assert isinstance(messages, list)
        for msg in messages:
            assert isinstance(msg, protos.Content)
            assert msg.role in ("user", "model")
            assert len(msg.parts) > 0

        # Verify kwargs has expected structure
        assert "model_name" in kwargs
        assert kwargs["model_name"] == prompt_version_data["model_name"]
        assert "generation_config" in kwargs

    def test_invocation_parameters_are_passed(self) -> None:
        """Test that invocation parameters are correctly passed to generation_config."""
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

        generation_config = kwargs["generation_config"]
        assert generation_config.temperature == 0.5
        assert generation_config.max_output_tokens == 512
        assert generation_config.top_p == 0.8

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
