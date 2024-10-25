from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, ClassVar, Iterator, List, Mapping, Optional, Tuple, TypedDict, Union, cast


class ImageDict(TypedDict):
    url: str


@dataclass(frozen=True)
class Image:
    url: str

    def __bool__(self) -> bool:
        return bool(self.url)

    def texts(self) -> Iterator[str]:
        yield from ()

    def to_dict(self) -> ImageDict:
        return {"url": self.url}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[Image]:
        if not obj or not isinstance(url := obj.get("url"), str):
            return None
        return cls(url=url)


class ImageEntryDict(TypedDict):
    image: ImageDict


@dataclass(frozen=True)
class ImageEntry:
    image: Image

    def __bool__(self) -> bool:
        return bool(self.image)

    def texts(self) -> Iterator[str]:
        yield from self.image.texts()

    def to_dict(self) -> ImageEntryDict:
        image = self.image.to_dict()
        return {"image": image}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[ImageEntry]:
        if not obj or not isinstance(v := obj.get("image"), dict):
            return None
        if image := Image.from_dict(v):
            return cls(image=image)
        return None


class ImageContentDict(TypedDict):
    type: str
    image: ImageEntryDict


@dataclass(frozen=True)
class ImageContent:
    type: ClassVar[str] = "image"
    image: ImageEntry

    def __bool__(self) -> bool:
        return bool(self.image)

    def texts(self) -> Iterator[str]:
        yield from self.image.texts()

    def to_dict(self) -> ImageContentDict:
        image = self.image.to_dict()
        return {"type": self.type, "image": image}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[ImageContent]:
        if not obj or not isinstance(v := obj.get("image"), dict):
            return None
        if image := ImageEntry.from_dict(v):
            return cls(image=image)
        return None


class TextContentDict(TypedDict):
    type: str
    text: str


@dataclass(frozen=True)
class TextContent:
    type: ClassVar[str] = "text"
    text: str

    def __bool__(self) -> bool:
        return bool(self.text)

    def texts(self) -> Iterator[str]:
        if self.text:
            yield self.text

    def to_dict(self) -> TextContentDict:
        return {"type": self.type, "text": self.text}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[TextContent]:
        if not obj or not isinstance(text := obj.get("text"), str):
            return None
        return cls(text=text)


class MessageContentEntryDict(TypedDict):
    message_content: Union[TextContentDict, ImageContentDict]


@dataclass(frozen=True)
class MessageContentEntry:
    message_content: Union[TextContent, ImageContent]

    def __bool__(self) -> bool:
        return bool(self.message_content)

    def texts(self) -> Iterator[str]:
        yield from self.message_content.texts()

    def to_dict(self) -> MessageContentEntryDict:
        message_content = self.message_content.to_dict()
        return {"message_content": message_content}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[MessageContentEntry]:
        if not obj or not isinstance(v := obj.get("message_content"), dict):
            return None
        if text_content := TextContent.from_dict(v):
            return cls(message_content=text_content)
        if image_content := ImageContent.from_dict(v):
            return cls(message_content=image_content)
        return None


class FunctionDict(TypedDict, total=False):
    name: str
    arguments: str


@dataclass(frozen=True)
class Function:
    name: Optional[str] = None
    arguments: Optional[str] = None

    def __bool__(self) -> bool:
        return bool(self.name) or bool(self.arguments)

    def texts(self) -> Iterator[str]:
        if self.name:
            yield self.name
        if self.arguments:
            yield self.arguments

    def to_dict(self) -> FunctionDict:
        if self.name and self.arguments:
            return {"name": self.name, "arguments": self.arguments}
        if self.name:
            return {"name": self.name}
        if self.arguments:
            return {"arguments": self.arguments}
        return {}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[Function]:
        if not obj:
            return None
        if not isinstance(name := obj.get("name"), str):
            name = None
        if not isinstance(arguments := obj.get("arguments"), str):
            arguments = None
        if not name and not arguments:
            return None
        return cls(name=name, arguments=arguments)


class ToolCallDict(TypedDict):
    function: FunctionDict


@dataclass(frozen=True)
class ToolCall:
    function: Function

    def __bool__(self) -> bool:
        return bool(self.function)

    def texts(self) -> Iterator[str]:
        yield from self.function.texts()

    def to_dict(self) -> ToolCallDict:
        function = self.function.to_dict()
        return {"function": function}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[ToolCall]:
        if not obj or not isinstance(v := obj.get("function"), dict):
            return None
        if function := Function.from_dict(v):
            return cls(function=function)
        return None


class ToolCallEntryDict(TypedDict):
    tool_call: ToolCallDict


@dataclass(frozen=True)
class ToolCallEntry:
    tool_call: ToolCall

    def __bool__(self) -> bool:
        return bool(self.tool_call)

    def texts(self) -> Iterator[str]:
        yield from self.tool_call.texts()

    def to_dict(self) -> ToolCallEntryDict:
        tool_call = self.tool_call.to_dict()
        return {"tool_call": tool_call}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[ToolCallEntry]:
        if not obj or not isinstance(v := obj.get("tool_call"), dict):
            return None
        if tool_call := ToolCall.from_dict(v):
            return cls(tool_call=tool_call)
        return None


class MessageDict(TypedDict, total=False):
    role: str
    content: str
    tool_calls: List[ToolCallEntryDict]
    contents: List[MessageContentEntryDict]


@dataclass(frozen=True)
class Message:
    role: Optional[str] = None
    content: str = ""
    tool_calls: Tuple[ToolCallEntry, ...] = field(default_factory=tuple)
    contents: Tuple[MessageContentEntry, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        has_content = bool(self.content)
        has_contents = bool(self.contents)
        has_tool_calls = bool(self.tool_calls)
        assert int(has_content) + int(has_contents) + int(has_tool_calls) == 1

    def __bool__(self) -> bool:
        return bool(self.content) or bool(self.contents)

    def texts(self) -> Iterator[str]:
        if self.content:
            yield self.content
        elif self.tool_calls:
            for tool_call_entry in self.tool_calls:
                yield from tool_call_entry.texts()
        elif self.contents:
            for content_entry in self.contents:
                yield from content_entry.texts()

    def to_dict(self) -> MessageDict:
        if self.content:
            return (
                {"role": self.role, "content": self.content}
                if self.role
                else {"content": self.content}
            )
        if self.tool_calls:
            tool_calls = [entry.to_dict() for entry in self.tool_calls]
            return (
                {"role": self.role, "tool_calls": tool_calls}
                if self.role
                else {"tool_calls": tool_calls}
            )
        if self.contents:
            contents = [entry.to_dict() for entry in self.contents]
            return (
                {"role": self.role, "contents": contents} if self.role else {"contents": contents}
            )
        if self.role:
            return {"role": self.role}
        return {}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[Message]:
        if not obj:
            return None
        role = obj.get("role")
        if not role or not isinstance(role, str):
            role = None
        if isinstance(content := obj.get("content"), str) and content:
            return cls(role=role, content=content)
        if isinstance(v := obj.get("tool_calls"), list) and (
            tool_calls := cast(
                Tuple[ToolCallEntry, ...],
                tuple(filter(bool, map(ToolCallEntry.from_dict, v))),
            )
        ):
            return cls(role=role, tool_calls=tool_calls)
        if isinstance(v := obj.get("contents"), list) and (
            contents := cast(
                Tuple[MessageContentEntry, ...],
                tuple(filter(bool, map(MessageContentEntry.from_dict, v))),
            )
        ):
            return cls(role=role, contents=contents)
        return None


class MessageEntryDict(TypedDict):
    message: MessageDict


@dataclass(frozen=True)
class MessageEntry:
    message: Message

    def __bool__(self) -> bool:
        return bool(self.message)

    def texts(self) -> Iterator[str]:
        yield from self.message.texts()

    def to_dict(self) -> MessageEntryDict:
        message = self.message.to_dict()
        return {"message": message}

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[MessageEntry]:
        if not obj or not isinstance(v := obj.get("message"), dict):
            return None
        if message := Message.from_dict(v):
            return cls(message=message)
        return None
