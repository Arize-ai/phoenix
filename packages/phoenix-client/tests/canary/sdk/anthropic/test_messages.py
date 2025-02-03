# pyright: reportPrivateUsage=false
import json
from typing import Any, Iterable, Mapping

import pytest
from anthropic.types import (
    ImageBlockParam,
    MessageParam,
    TextBlockParam,
    ToolParam,
    ToolResultBlockParam,
    ToolUseBlockParam,
)
from anthropic.types.image_block_param import Source
from deepdiff.diff import DeepDiff
from faker import Faker

from phoenix.client.__generated__.v1 import (
    ImageContentPart,
    PromptMessage,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolResultContentPart,
)
from phoenix.client.helpers.sdk.anthropic.messages import (
    _from_image,
    _from_message,
    _from_text,
    _from_tool_call,
    _from_tool_result,
    _from_tools,
    _to_image,
    _to_messages,
    _to_text,
    _to_tool_call,
    _to_tool_result,
    _to_tools,
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


def _image() -> ImageBlockParam:
    return ImageBlockParam(
        type="image",
        source=Source(
            data=_str(),
            media_type="image/png",
            type="base64",
        ),
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


def _tool() -> ToolParam:
    return ToolParam(
        name=_str(),
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


class TestMessageParam:
    @pytest.mark.parametrize(
        "messages",
        [
            [
                MessageParam(role="user", content=[_text(), _image(), _text()]),
                MessageParam(role="assistant", content=[_text(), _tool_use(), _tool_use()]),
                MessageParam(role="user", content=[_text(), _tool_result(), _tool_result()]),
                MessageParam(role="assistant", content=[_image(), _text(), _image()]),
                MessageParam(role="user", content=_str()),
                MessageParam(role="assistant", content=_str()),
            ],
        ],
    )
    def test_round_trip(self, messages: Iterable[MessageParam]) -> None:
        new_messages: list[MessageParam] = []
        for message in messages:
            x: PromptMessage = _from_message(message)
            new_messages.extend(_to_messages(x, {}, NO_OP_FORMATTER))
        assert not DeepDiff(list(messages), new_messages)


class TestToolParam:
    @pytest.mark.parametrize(
        "tools",
        [[_tool() for _ in range(3)]],
    )
    def test_round_trip(self, tools: Iterable[ToolParam]) -> None:
        new_tools = list(_to_tools(_from_tools(tools)))
        assert not DeepDiff(list(tools), new_tools)


class TestTextBlockParam:
    def test_round_trip(self) -> None:
        obj: TextBlockParam = _text()
        x: TextContentPart = _from_text(obj)
        new_obj: TextBlockParam = _to_text(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)

    def test_formatter(self) -> None:
        x = TextContentPart(type="text", text=TextContentValue(text=_str()))
        formatter, variables = _MockFormatter(), _dict()
        ans: TextBlockParam = _to_text(x, variables, formatter)
        assert ans["text"] == formatter.format(x["text"]["text"], variables=variables)


class TestToolUseBlockParam:
    def test_round_trip(self) -> None:
        obj: ToolUseBlockParam = _tool_use()
        x: ToolCallContentPart = _from_tool_call(obj)
        new_obj: ToolUseBlockParam = _to_tool_call(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)


class TestToolResultBlockParam:
    def test_round_trip(self) -> None:
        obj: ToolResultBlockParam = _tool_result()
        x: ToolResultContentPart = _from_tool_result(obj)
        new_obj: ToolResultBlockParam = _to_tool_result(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)


class TestImageBlockParam:
    def test_round_trip(self) -> None:
        obj: ImageBlockParam = _image()
        x: ImageContentPart = _from_image(obj)
        new_obj: ImageBlockParam = _to_image(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
