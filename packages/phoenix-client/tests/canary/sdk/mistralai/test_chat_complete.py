import json
from typing import Any, Iterable, Mapping, Optional

import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from mistralai.models import (
    AssistantMessageContentTypedDict,
    AssistantMessageTypedDict,
    FunctionCallTypedDict,
    FunctionTypedDict,
    ImageURLChunkTypedDict,
    ImageURLTypedDict,
    SystemMessageContentTypedDict,
    SystemMessageTypedDict,
    TextChunkTypedDict,
    ToolCallTypedDict,
    ToolMessageContentTypedDict,
    ToolMessageTypedDict,
    ToolTypedDict,
    UserMessageContentTypedDict,
    UserMessageTypedDict,
)

from phoenix.client.__generated__.v1 import (
    ImageContentPart,
    PromptMessage,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
)
from phoenix.client.helpers.sdk.mistralai.chat_complete import (
    _from_image,
    _from_message,
    _from_text,
    _from_tool_call,
    _from_tools,
    _to_image,
    _to_messages,
    _to_text,
    _to_tool_call,
    _to_tools,
)
from phoenix.client.utils.template_formatters import NO_OP_FORMATTER

fake = Faker()


def _dict() -> dict[str, Any]:
    return fake.pydict(3, value_types=(int, float, bool, str))  # pyright: ignore[reportUnknownMemberType]


def _str() -> str:
    return fake.pystr(8, 8)


def _user_msg(
    content: UserMessageContentTypedDict,
) -> UserMessageTypedDict:
    return UserMessageTypedDict(
        role="user",
        content=content,
    )


def _assistant_msg(
    content: Optional[AssistantMessageContentTypedDict] = None,
    tool_calls: Iterable[ToolCallTypedDict] = (),
) -> AssistantMessageTypedDict:
    if not tool_calls:
        return AssistantMessageTypedDict(
            role="assistant",
            content=content,
        )
    if content is None:
        return AssistantMessageTypedDict(
            role="assistant",
            tool_calls=list(tool_calls),
        )
    return AssistantMessageTypedDict(
        role="assistant",
        content=content,
        tool_calls=list(tool_calls),
    )


def _tool_msg(
    content: ToolMessageContentTypedDict,
) -> ToolMessageTypedDict:
    return ToolMessageTypedDict(
        role="tool",
        content=content,
        tool_call_id=_str(),
    )


def _system_msg(
    content: SystemMessageContentTypedDict,
) -> SystemMessageTypedDict:
    return SystemMessageTypedDict(
        role="system",
        content=content,
    )


def _text() -> TextChunkTypedDict:
    return TextChunkTypedDict(type="text", text=_str())


def _image() -> ImageURLChunkTypedDict:
    return ImageURLChunkTypedDict(
        type="image_url",
        image_url=ImageURLTypedDict(
            url=fake.image_url(),
        ),
    )


def _tool_call() -> ToolCallTypedDict:
    return ToolCallTypedDict(
        id=_str(),
        type="function",
        function=FunctionCallTypedDict(
            name=_str(),
            arguments=json.dumps(_dict()),
        ),
    )


def _tool() -> ToolTypedDict:
    return ToolTypedDict(
        type="function",
        function=FunctionTypedDict(
            name=_str(),
            description=_str(),
            parameters={
                "type": "object",
                "properties": {
                    "x": {"type": "int", "description": _str()},
                    "y": {"type": "string", "description": _str()},
                },
                "required": ["x", "y"],
                "additionalProperties": False,
            },
        ),
    )


class TestUserMessageTypedDict:
    @pytest.mark.parametrize(
        "obj",
        [
            _user_msg(_str()),
            _user_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: UserMessageTypedDict) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestSystemMessageTypedDict:
    @pytest.mark.parametrize(
        "obj",
        [
            _system_msg(_str()),
            _system_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: SystemMessageTypedDict) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestAssistantMessageTypedDict:
    @pytest.mark.parametrize(
        "obj",
        [
            _assistant_msg(_str()),
            _assistant_msg([_text(), _text()]),
            _assistant_msg(None, [_tool_call(), _tool_call()]),
        ],
    )
    def test_round_trip(self, obj: AssistantMessageTypedDict) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestToolMessageTypedDict:
    @pytest.mark.parametrize(
        "obj",
        [
            _tool_msg(_str()),
            _tool_msg([_text(), _text()]),
        ],
    )
    def test_round_trip(self, obj: ToolMessageTypedDict) -> None:
        x: PromptMessage = _from_message(obj)
        assert not DeepDiff([obj], list(_to_messages(x, {}, NO_OP_FORMATTER)))


class TestToolTypedDict:
    @pytest.mark.parametrize(
        "tools",
        [[_tool() for _ in range(3)]],
    )
    def test_round_trip(self, tools: Iterable[ToolTypedDict]) -> None:
        new_tools = list(_to_tools(_from_tools(tools)))
        assert not DeepDiff(list(tools), new_tools)


class TestTextChunkTypedDict:
    def test_round_trip(self) -> None:
        obj: TextChunkTypedDict = _text()
        x: TextContentPart = _from_text(obj)
        new_obj: TextChunkTypedDict = _to_text(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)

    def test_formatter(self) -> None:
        x = TextContentPart(type="text", text=TextContentValue(text=_str()))
        formatter, variables = _MockFormatter(), _dict()
        ans: TextChunkTypedDict = _to_text(x, variables, formatter)
        assert ans["text"] == formatter.format(x["text"]["text"], variables=variables)


class TestToolCallTypedDict:
    def test_round_trip(self) -> None:
        obj: ToolCallTypedDict = _tool_call()
        x: ToolCallContentPart = _from_tool_call(obj)
        new_obj: ToolCallTypedDict = _to_tool_call(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)


class TestImageURLChunkTypedDict:
    def test_round_trip(self) -> None:
        obj: ImageURLChunkTypedDict = _image()
        x: ImageContentPart = _from_image(obj)
        new_obj: ImageURLChunkTypedDict = _to_image(x, {}, NO_OP_FORMATTER)
        assert not DeepDiff(obj, new_obj)


class _MockFormatter:
    def format(self, _: str, /, *, variables: Mapping[str, str]) -> str:
        return json.dumps(variables)
