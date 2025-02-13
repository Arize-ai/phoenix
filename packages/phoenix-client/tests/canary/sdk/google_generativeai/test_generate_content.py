# pyright: reportUnknownMemberType=false
import json
from secrets import token_hex
from typing import Any, Mapping

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from google.generativeai import protos
from google.generativeai.types import content_types

from phoenix.client.__generated__.v1 import TextContentPart
from phoenix.client.helpers.sdk.google_generativeai.generate_content import (
    _ContentConversion,
    _FunctionDeclarationConversion,
    _TextContentPartConversion,
    _ToolKwargs,
    _ToolKwargsConversion,
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
