# pyright: reportPrivateUsage=false
import json
from typing import Any, Iterable, Mapping, Optional

import pytest
from anthropic.types import (
    MessageParam,
    TextBlockParam,
    ToolChoiceAnyParam,
    ToolChoiceAutoParam,
    ToolChoiceToolParam,
    ToolParam,
    ToolResultBlockParam,
    ToolUseBlockParam,
)
from deepdiff.diff import DeepDiff
from faker import Faker

from phoenix.client.__generated__ import v1
from phoenix.client.helpers.sdk.anthropic.messages import (
    _MessageConversion,
    _TextContentPartConversion,
    _ToolCallContentPartConversion,
    _ToolConversion,
    _ToolKwargs,
    _ToolKwargsConversion,
    _ToolResultContentPartConversion,
)
from phoenix.client.utils.template_formatters import NO_OP_FORMATTER

fake = Faker()


def _dict() -> dict[str, Any]:
    return fake.pydict(3, value_types=(int, float, bool, str))  # pyright: ignore[reportUnknownMemberType]


def _str() -> str:
    return fake.pystr(8, 8)


def _text() -> TextBlockParam:
    return TextBlockParam(
        type="text",
        text=_str(),
    )


def _tool_use() -> ToolUseBlockParam:
    return ToolUseBlockParam(
        type="tool_use",
        id=_str(),
        input=json.dumps(_dict()),
        name=_str(),
    )


def _tool_result() -> ToolResultBlockParam:
    return ToolResultBlockParam(
        type="tool_result",
        tool_use_id=_str(),
        content=_str(),  # TODO: relax this
    )


def _tool(name: Optional[str] = None) -> ToolParam:
    return ToolParam(
        name=name or _str(),
        description=_str(),
        input_schema={
            "type": "object",
            "properties": {
                "x": {"type": "int", "description": _str()},
                "y": {"type": "string", "description": _str()},
            },
            "required": ["x", "y"],
            "additionalProperties": False,
        },
    )


class TestMessageConversion:
    @pytest.mark.parametrize(
        "obj",
        [
            MessageParam(role="user", content=[_text(), _text()]),
            MessageParam(role="assistant", content=[_text(), _tool_use(), _tool_use()]),
            MessageParam(role="user", content=[_text(), _tool_result(), _tool_result()]),
            MessageParam(role="assistant", content=[_text(), _text()]),
            MessageParam(role="user", content=_str()),
            MessageParam(role="assistant", content=_str()),
        ],
    )
    def test_round_trip(self, obj: MessageParam) -> None:
        x: v1.PromptMessage = _MessageConversion.from_anthropic(obj)
        new_obj = next(_MessageConversion.to_anthropic(x, {}, NO_OP_FORMATTER))
        assert not DeepDiff(obj, new_obj)


class TestToolConversion:
    @pytest.mark.parametrize(
        "tools",
        [[_tool() for _ in range(3)]],
    )
    def test_round_trip(self, tools: Iterable[ToolParam]) -> None:
        new_tools = list(_ToolConversion.to_anthropic(_ToolConversion.from_anthropic(tools)))
        assert not DeepDiff(list(tools), new_tools)


class TestTextConversion:
    def test_round_trip(self) -> None:
        obj: TextBlockParam = _text()
        x: v1.TextContentPart = _TextContentPartConversion.from_anthropic(obj)
        new_obj: TextBlockParam = _TextContentPartConversion.to_anthropic(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)

    def test_formatter(self) -> None:
        x = v1.TextContentPart(type="text", text=v1.TextContentValue(text=_str()))
        formatter, variables = _MockFormatter(), _dict()
        ans: TextBlockParam = _TextContentPartConversion.to_anthropic(x, variables, formatter)
        assert ans["text"] == formatter.format(x["text"]["text"], variables=variables)


class TestToolCallConversion:
    def test_round_trip(self) -> None:
        obj: ToolUseBlockParam = _tool_use()
        x: v1.ToolCallContentPart = _ToolCallContentPartConversion.from_anthropic(obj)
        new_obj: ToolUseBlockParam = _ToolCallContentPartConversion.to_anthropic(
            x, {}, NO_OP_FORMATTER
        )
        assert not DeepDiff(obj, new_obj)


class TestToolResultBlockParam:
    def test_round_trip(self) -> None:
        obj: ToolResultBlockParam = _tool_result()
        x: v1.ToolResultContentPart = _ToolResultContentPartConversion.from_anthropic(obj)
        new_obj: ToolResultBlockParam = _ToolResultContentPartConversion.to_anthropic(
            x, {}, NO_OP_FORMATTER
        )
        assert not DeepDiff(obj, new_obj)


class TestToolKwargs:
    @pytest.mark.parametrize(
        "obj",
        [
            {},
            {
                "tools": [_tool(), _tool()],
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": ToolChoiceAutoParam(type="auto"),
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": ToolChoiceAutoParam(
                    type="auto",
                    disable_parallel_tool_use=True,
                ),
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": ToolChoiceAnyParam(type="any"),
            },
            {
                "tools": [_tool(), _tool()],
                "tool_choice": ToolChoiceAnyParam(
                    type="any",
                    disable_parallel_tool_use=True,
                ),
            },
            {
                "tools": [_tool(), _tool("xyz")],
                "tool_choice": ToolChoiceToolParam(
                    type="tool",
                    name="xyz",
                ),
            },
            {
                "tools": [_tool(), _tool("xyz")],
                "tool_choice": ToolChoiceToolParam(
                    type="tool",
                    name="xyz",
                    disable_parallel_tool_use=True,
                ),
            },
        ],
    )
    def test_round_trip(self, obj: _ToolKwargs) -> None:
        x: Optional[v1.PromptToolsV1] = _ToolKwargsConversion.from_anthropic(obj)
        new_obj: _ToolKwargs = _ToolKwargsConversion.to_anthropic(x)
        assert not DeepDiff(obj, new_obj)


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
