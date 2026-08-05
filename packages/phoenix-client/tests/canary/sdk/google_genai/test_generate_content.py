# pyright: reportUnknownMemberType=false
import json
from secrets import token_hex
from typing import Any, Mapping

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from google.genai import types as genai_types

from phoenix.client.__generated__.v1 import TextContentPart
from phoenix.client.helpers.sdk.google_genai.generate_content import (
    _ContentConversion,
    _FunctionDeclarationConversion,
    _TextContentPartConversion,
    _ToolKwargs,
    _ToolKwargsConversion,
)
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


class TestFunctionDeclarationConversion:
    @pytest.mark.parametrize(
        "obj",
        _FUNCTION_DECLARATIONS,
    )
    def test_round_trip(self, obj: genai_types.FunctionDeclaration) -> None:
        new_obj: genai_types.FunctionDeclaration = _FunctionDeclarationConversion.to_google(
            _FunctionDeclarationConversion.from_google(obj)
        )
        assert not DeepDiff(
            obj.model_dump(exclude_none=True),
            new_obj.model_dump(exclude_none=True),
        )


_TOOLS = [genai_types.Tool(function_declarations=_FUNCTION_DECLARATIONS)]


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


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
