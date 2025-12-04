import json
from secrets import token_hex
from typing import Any, Mapping

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from google.genai import types

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
        assert not DeepDiff(
            obj.model_dump(),
            new_obj.model_dump(),
        )


class TestTextPartConversion:
    def test_round_trip(self) -> None:
        obj: types.Part = _text()
        new_obj: types.Part = _TextContentPartConversion.to_google(
            _TextContentPartConversion.from_google(obj), {}, NO_OP_FORMATTER
        )
        assert not DeepDiff(
            obj.model_dump(),
            new_obj.model_dump(),
        )

    def test_formatter(self) -> None:
        obj = TextContentPart(type="text", text=token_hex(8))
        formatter, variables = _MockFormatter(), _dict()
        part: types.Part = _TextContentPartConversion.to_google(obj, variables, formatter)
        assert part.text == formatter.format(obj["text"], variables=variables)


def _f(a: int, b: list[float], c: str, d: list[bool], e: dict[str, Any]) -> int:
    raise NotImplementedError


def _g(a: list[int], b: float, c: list[str], d: bool, e: list[dict[str, Any]]) -> str:
    raise NotImplementedError


_FUNCTION_DECLARATIONS = [
    types.FunctionDeclaration.from_callable(callable=_f),
    types.FunctionDeclaration.from_callable(callable=_g),
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
        assert not DeepDiff(
            obj.model_dump(),
            new_obj.model_dump(),
        )


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
        for i in range(len(obj["tools"])):
            assert not DeepDiff(
                obj["tools"][i].model_dump(),
                new_obj["tools"][i].model_dump(),
            )
        assert "tool_config" in obj
        assert "tool_config" in new_obj
        assert not DeepDiff(
            obj["tool_config"].model_dump(),
            new_obj["tool_config"].model_dump(),
        )


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
