import json
from secrets import token_hex
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
    PromptToolsV1,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolResultContentPart,
)
from phoenix.client.helpers.sdk.anthropic.messages import (
    _from_image_block_param,
    _from_message_param,
    _from_text_block_param,
    _from_tool_result_block_param,
    _from_tool_use_block_param,
    _from_tools,
    _to_image_block_param,
    _to_message_params,
    _to_text_block_param,
    _to_tool_result_block_param,
    _to_tool_use_block_param,
    _to_tools,
)


def _fake_dict() -> dict[str, Any]:
    return Faker().pydict(3, value_types=(int, float, bool, str))


def _text() -> TextBlockParam:
    return TextBlockParam(type="text", text=token_hex(8))


def _image() -> ImageBlockParam:
    return ImageBlockParam(
        type="image",
        source=Source(
            data=token_hex(8),
            media_type="image/png",
            type="base64",
        ),
    )


def _tool_use() -> ToolUseBlockParam:
    return ToolUseBlockParam(
        type="tool_use",
        id=token_hex(8),
        input=json.dumps(_fake_dict()),
        name=token_hex(8),
    )


def _tool_result() -> ToolResultBlockParam:
    return ToolResultBlockParam(
        type="tool_result",
        tool_use_id=token_hex(8),
        content=token_hex(8),  # TODO: relax this
    )


def _tool() -> ToolParam:
    return ToolParam(
        name=token_hex(8),
        description=token_hex(8),
        input_schema={
            "type": "object",
            "properties": {
                "x": {"type": "int", "description": token_hex(8)},
                "y": {"type": "string", "description": token_hex(8)},
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
                MessageParam(role="user", content=token_hex(8)),
                MessageParam(role="assistant", content=token_hex(8)),
            ],
        ],
    )
    def test_round_trip(self, messages: Iterable[MessageParam]) -> None:
        new_messages: list[MessageParam] = []
        for message in messages:
            assert isinstance(x := _from_message_param(message), PromptMessage)
            new_messages.extend(_to_message_params(x))
        assert not DeepDiff(list(messages), new_messages)


class TestToolParam:
    @pytest.mark.parametrize(
        "tools",
        [[_tool() for _ in range(3)]],
    )
    def test_round_trip(self, tools: Iterable[ToolParam]) -> None:
        assert isinstance(x := _from_tools(tools), PromptToolsV1)
        new_tools = list(_to_tools(x))
        assert not DeepDiff(list(tools), new_tools)


class TestTextBlockParam:
    def test_round_trip(self) -> None:
        block: TextBlockParam = _text()
        assert isinstance(x := _from_text_block_param(block), TextContentPart)
        new_block: TextBlockParam = _to_text_block_param(x)
        assert not DeepDiff(block, new_block)

    def test_formatter(self) -> None:
        obj = TextContentPart(text=TextContentValue(text=token_hex(8)))
        variables = Faker().pydict(value_types=(str, int, float, bool))
        block: TextBlockParam = _to_text_block_param(obj, variables, _MockFormatter())
        assert block["text"] == json.dumps(variables)


class TestToolUseBlockParam:
    def test_round_trip(self) -> None:
        block: ToolUseBlockParam = _tool_use()
        assert isinstance(x := _from_tool_use_block_param(block), ToolCallContentPart)
        new_block: ToolUseBlockParam = _to_tool_use_block_param(x)
        assert not DeepDiff(block, new_block)


class TestToolResultBlockParam:
    def test_round_trip(self) -> None:
        block: ToolResultBlockParam = _tool_result()
        assert isinstance(x := _from_tool_result_block_param(block), ToolResultContentPart)
        new_block: ToolResultBlockParam = _to_tool_result_block_param(x)
        assert not DeepDiff(block, new_block)


class TestImageBlockParam:
    def test_round_trip(self) -> None:
        block: ImageBlockParam = _image()
        assert isinstance(x := _from_image_block_param(block), ImageContentPart)
        new_block: ImageBlockParam = _to_image_block_param(x)
        assert not DeepDiff(block, new_block)


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
