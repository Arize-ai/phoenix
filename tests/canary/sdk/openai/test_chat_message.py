from random import randint, shuffle
from secrets import token_hex
from typing import Any, Iterable, Literal, Union, cast, overload

from deepdiff.diff import DeepDiff
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionContentPartImageParam,
    ChatCompletionContentPartInputAudioParam,
    ChatCompletionContentPartParam,
    ChatCompletionContentPartRefusalParam,
    ChatCompletionContentPartTextParam,
    ChatCompletionMessageToolCallParam,
    ChatCompletionRole,
    ChatCompletionSystemMessageParam,
    ChatCompletionToolMessageParam,
    ChatCompletionUserMessageParam,
)
from openai.types.chat.chat_completion_content_part_image_param import ImageURL
from openai.types.chat.chat_completion_message_tool_call_param import Function
from typing_extensions import assert_never

from phoenix.server.api.helpers.prompts.models import (
    ContentPart,
    ImageContentPart,
    ImageContentValue,
    PromptMessage,
    PromptMessageRole,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
    ToolResultContentValue,
)


class TestChatMessageRoundTrip:
    @classmethod
    def from_content(
        cls,
        obj: Union[
            str,
            Iterable[
                Union[
                    ChatCompletionContentPartTextParam,
                    ChatCompletionContentPartImageParam,
                    ChatCompletionContentPartInputAudioParam,
                    ChatCompletionContentPartRefusalParam,
                ]
            ],
            None,
        ],
    ) -> list[ContentPart]:
        if isinstance(obj, str):
            return [
                TextContentPart(
                    type="text",
                    text=TextContentValue(text=obj),
                ),
            ]
        content: list[ContentPart] = []
        for part in obj or ():
            if part["type"] == "text":
                content.append(
                    TextContentPart(
                        type="text",
                        text=TextContentValue(text=part["text"]),
                    )
                )
            elif part["type"] == "image_url":
                content.append(
                    ImageContentPart(
                        type="image",
                        image=ImageContentValue(
                            url=part["image_url"]["url"],
                            # TODO
                            # detail=part["image_url"].get("detail"),
                        ),
                    )
                )
            else:
                raise NotImplementedError(f"Unexpected content part: {part}")
        return content

    @overload
    @classmethod
    def to_content(
        cls,
        obj: list[ContentPart],
        text_only: Literal[True] = True,
    ) -> list[ChatCompletionContentPartTextParam]: ...

    @overload
    @classmethod
    def to_content(
        cls,
        obj: list[ContentPart],
        text_only: Literal[False] = False,
    ) -> list[ChatCompletionContentPartParam]: ...

    @classmethod
    def to_content(
        cls,
        obj: list[ContentPart],
        text_only: bool = False,
    ) -> Any:
        content: list[ChatCompletionContentPartParam] = []
        for part in obj:
            if isinstance(part, TextContentPart):
                content.append(
                    ChatCompletionContentPartTextParam(
                        type="text",
                        text=part.text.text,
                    )
                )
            elif text_only:
                raise ValueError("Expected text content only")
            elif isinstance(part, ImageContentPart):
                content.append(
                    ChatCompletionContentPartImageParam(
                        type="image_url",
                        image_url=ImageURL(
                            url=part.image.url,
                            # TODO
                            # detail=part.image.detail,
                        ),
                    )
                )
            elif isinstance(part, ToolResultContentPart):
                raise NotImplementedError(f"Unexpected content part: {part}")
            elif isinstance(part, ToolCallContentPart):
                continue
            else:
                assert_never(part)
        return content

    @classmethod
    def get_role(cls, obj: PromptMessage) -> ChatCompletionRole:
        if obj.role is PromptMessageRole.SYSTEM:
            return "system"
        if obj.role is PromptMessageRole.AI:
            return "assistant"
        if obj.role is PromptMessageRole.USER:
            return "user"
        if obj.role is PromptMessageRole.TOOL:
            return "tool"
        assert_never(obj.role)

    class TestSystemMessage:
        _role: Literal["system"] = "system"

        @classmethod
        def from_message(
            cls,
            obj: ChatCompletionSystemMessageParam,
        ) -> PromptMessage:
            return PromptMessage(
                role=PromptMessageRole.SYSTEM,
                content=TestChatMessageRoundTrip.from_content(obj["content"]),
            )

        @classmethod
        def to_message(
            cls,
            obj: PromptMessage,
            str_content: bool = False,
        ) -> ChatCompletionSystemMessageParam:
            content = (
                TestChatMessageRoundTrip.to_content(obj.content, True)[0]["text"]
                if str_content
                else TestChatMessageRoundTrip.to_content(obj.content)
            )
            role = cast(Literal["system"], TestChatMessageRoundTrip.get_role(obj))
            return ChatCompletionSystemMessageParam(
                role=role,
                content=content,
            )

        def test_str_content(self) -> None:
            message = ChatCompletionSystemMessageParam(
                role=self._role,
                content=token_hex(16),
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message, True)
            diff = DeepDiff(message, new_message)
            assert not diff

        def test_list_content(self) -> None:
            content = [
                ChatCompletionContentPartTextParam(
                    type="text",
                    text=token_hex(16),
                )
                for _ in range(randint(1, 3))
            ]
            message = ChatCompletionSystemMessageParam(
                role=self._role,
                content=content,
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message)
            diff = DeepDiff(message, new_message)
            assert not diff

    class TestUserMessage:
        _role: Literal["user"] = "user"

        @classmethod
        def from_message(
            cls,
            obj: ChatCompletionUserMessageParam,
        ) -> PromptMessage:
            return PromptMessage(
                role=PromptMessageRole.USER,
                content=TestChatMessageRoundTrip.from_content(obj["content"]),
            )

        @classmethod
        def to_message(
            cls,
            obj: PromptMessage,
            str_content: bool = False,
        ) -> ChatCompletionUserMessageParam:
            content = (
                TestChatMessageRoundTrip.to_content(obj.content, True)[0]["text"]
                if str_content
                else TestChatMessageRoundTrip.to_content(obj.content)
            )
            role = cast(Literal["user"], TestChatMessageRoundTrip.get_role(obj))
            return ChatCompletionUserMessageParam(
                role=role,
                content=content,
            )

        def test_str_content(self) -> None:
            message = ChatCompletionUserMessageParam(
                role=self._role,
                content=token_hex(16),
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message, True)
            diff = DeepDiff(message, new_message)
            assert not diff

        def test_list_content(self) -> None:
            content = [
                ChatCompletionContentPartTextParam(
                    type="text",
                    text=token_hex(16),
                )
                for _ in range(1, 10)
            ] + [
                ChatCompletionContentPartImageParam(
                    type="image_url",
                    image_url=ImageURL(
                        url=token_hex(16),
                        # detail="auto",
                    ),
                )
                for _ in range(1, 10)
            ]
            shuffle(content)
            message = ChatCompletionUserMessageParam(
                role=self._role,
                content=content,
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message)
            diff = DeepDiff(message, new_message)
            assert not diff

    class TestToolMessage:
        _role: Literal["tool"] = "tool"

        @classmethod
        def from_message(
            cls,
            obj: ChatCompletionToolMessageParam,
        ) -> PromptMessage:
            content: list[ToolResultContentPart] = []
            if isinstance(obj["content"], str):
                content.append(
                    ToolResultContentPart(
                        type="tool_result",
                        tool_result=ToolResultContentValue(
                            tool_call_id=obj["tool_call_id"],
                            result=obj["content"],
                        ),
                    )
                )
            elif isinstance(obj["content"], Iterable):
                for part in obj["content"]:
                    assert isinstance(part, dict)
                    content.append(
                        ToolResultContentPart(
                            type="tool_result",
                            tool_result=ToolResultContentValue(
                                tool_call_id=obj["tool_call_id"],
                                result=part["text"],
                            ),
                        )
                    )
            else:
                assert_never(obj["content"])
            return PromptMessage(
                role=PromptMessageRole.TOOL,
                content=content,
            )

        @classmethod
        def to_message(
            cls,
            obj: PromptMessage,
            str_content: bool = False,
        ) -> ChatCompletionToolMessageParam:
            content: list[ChatCompletionContentPartTextParam] = []
            tool_call_id = None
            for part in obj.content:
                if isinstance(part, ToolResultContentPart):
                    tool_call_id = part.tool_result.tool_call_id
                    content.append(
                        ChatCompletionContentPartTextParam(
                            type="text",
                            text=str(part.tool_result.result),
                        ),
                    )
                    if str_content:
                        break
            assert isinstance(tool_call_id, str)
            assert content
            role = TestChatMessageRoundTrip.get_role(obj)
            return ChatCompletionToolMessageParam(
                role=cast(Literal["tool"], role),
                content=content[0]["text"] if str_content else content,
                tool_call_id=tool_call_id,
            )

        def test_str_content(self) -> None:
            message = ChatCompletionToolMessageParam(
                role=self._role,
                content=token_hex(16),
                tool_call_id=token_hex(16),
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message, True)
            diff = DeepDiff(message, new_message)
            assert not diff

        def test_list_content(self) -> None:
            content = [
                ChatCompletionContentPartTextParam(
                    type="text",
                    text=token_hex(16),
                )
                for _ in range(randint(1, 3))
            ]
            message = ChatCompletionToolMessageParam(
                role=self._role,
                content=content,
                tool_call_id=token_hex(16),
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message)
            diff = DeepDiff(message, new_message)
            assert not diff

    class TestAssistantMessage:
        _role: Literal["assistant"] = "assistant"

        @classmethod
        def from_message(
            cls,
            obj: ChatCompletionAssistantMessageParam,
        ) -> PromptMessage:
            content = TestChatMessageRoundTrip.from_content(obj.get("content"))
            for tool_call in obj.get("tool_calls") or ():
                content.append(
                    ToolCallContentPart(
                        tool_call=ToolCallContentValue(
                            tool_call_id=tool_call["id"],
                            tool_call=ToolCallFunction(
                                type="function",
                                name=tool_call["function"]["name"],
                                arguments=tool_call["function"]["arguments"],
                            ),
                        )
                    )
                )
            return PromptMessage(
                role=PromptMessageRole.AI,
                content=content,
            )

        @classmethod
        def to_message(
            cls,
            obj: PromptMessage,
            str_content: bool = False,
        ) -> ChatCompletionAssistantMessageParam:
            content = (
                TestChatMessageRoundTrip.to_content(obj.content, True)[0]["text"]
                if str_content
                else TestChatMessageRoundTrip.to_content(obj.content)
            )
            tool_calls = []
            for part in obj.content:
                if isinstance(part, ToolCallContentPart):
                    tool_calls.append(
                        ChatCompletionMessageToolCallParam(
                            type="function",
                            id=part.tool_call.tool_call_id,
                            function=Function(
                                name=part.tool_call.tool_call.name,
                                arguments=part.tool_call.tool_call.arguments,
                            ),
                        )
                    )
            role = cast(Literal["assistant"], TestChatMessageRoundTrip.get_role(obj))
            message = ChatCompletionAssistantMessageParam(
                role=role,
                content=content,
                tool_calls=tool_calls,
            )
            if isinstance(content, list) and not content:
                del message["content"]
            if not tool_calls:
                del message["tool_calls"]
            return message

        def test_str_content(self) -> None:
            message = ChatCompletionAssistantMessageParam(
                role=self._role,
                content=token_hex(16),
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message, True)
            diff = DeepDiff(message, new_message)
            assert not diff

        def test_list_content(self) -> None:
            content = [
                ChatCompletionContentPartTextParam(
                    type="text",
                    text=token_hex(16),
                )
                for _ in range(randint(1, 3))
            ]
            message = ChatCompletionAssistantMessageParam(
                role=self._role,
                content=content,
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message)
            diff = DeepDiff(message, new_message)
            assert not diff

        def test_tool_calls(self) -> None:
            content = [
                ChatCompletionContentPartTextParam(
                    type="text",
                    text=token_hex(16),
                )
                for _ in range(randint(1, 3))
            ]
            tool_calls = [
                ChatCompletionMessageToolCallParam(
                    type="function",
                    id=token_hex(16),
                    function=Function(
                        name=token_hex(16),
                        arguments=token_hex(16),
                    ),
                )
                for _ in range(randint(1, 3))
            ]
            message = ChatCompletionAssistantMessageParam(
                role=self._role,
                content=content,
                tool_calls=tool_calls,
            )
            prompt_message = self.from_message(message)
            new_message = self.to_message(prompt_message)
            diff = DeepDiff(message, new_message)
            assert not diff
