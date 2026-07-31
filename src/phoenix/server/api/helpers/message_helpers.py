"""
Helper functions for extracting and converting messages from dataset examples.

This module provides utilities for the "appended messages" feature, which allows
users to specify a path to conversation messages within dataset examples that
should be appended to prompt templates when running experiments.
"""

import json
from typing import Any, Iterable, Literal, Mapping, Optional, Sequence, TypedDict, Union

from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Required, TypeAlias, assert_never

from phoenix.db.types.media import MediaContent
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptTemplateFormat,
    media_source,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.media import MediaResolutionError, resolve_media
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    NoOpFormatter,
    TemplateFormatter,
)

# These types are based loosely on the openinference.instrumentation.Message type.
# This makes it easier to leverage openinference.instrumentation helpers
# for extracting OpenInference attributes.


class PlaygroundToolCallFunction(TypedDict, total=False):
    name: str
    arguments: dict[str, Any]


class PlaygroundToolCall(TypedDict, total=False):
    id: str
    function: PlaygroundToolCallFunction


class TextContentBlock(TypedDict):
    """A run of text within a message."""

    type: Literal["text"]
    text: str


class MediaContentBlock(TypedDict, total=False):
    """
    Binary media within a message, at one of three stages.

    ``variable`` is set when the prompt names the image rather than storing it; the
    run supplies the reference. :func:`formatted_messages` substitutes the value
    into ``url``, exactly as it substitutes text variables.

    ``url`` is the reference and is what gets recorded on the span, so that trace
    attributes stay small and stable.

    ``data`` and the authoritative ``media_type`` hold what the provider needs, and
    are populated by :func:`resolve_message_media`.
    """

    type: Required[Literal["media"]]
    kind: Required[Literal["image", "file"]]
    """Which content part this came from, which decides the provider's block shape."""
    variable: str
    url: str
    media_type: str
    data: bytes
    file_name: str
    """The stored name, for the providers that require one to carry a document."""


ContentBlock: TypeAlias = Union[TextContentBlock, MediaContentBlock]


class PlaygroundMessage(TypedDict, total=False):
    role: Required[ChatCompletionMessageRole]
    content: Required[Union[str, list[ContentBlock]]]
    tool_call_id: str
    tool_calls: Sequence[PlaygroundToolCall]


def create_playground_message(
    role: ChatCompletionMessageRole,
    content: Union[str, list[ContentBlock]],
    tool_call_id: Optional[str] = None,
    tool_calls: Optional[Sequence[PlaygroundToolCall]] = None,
) -> PlaygroundMessage:
    msg: PlaygroundMessage = {"role": role, "content": content}
    if tool_call_id is not None:
        msg["tool_call_id"] = tool_call_id
    if tool_calls is not None:
        msg["tool_calls"] = tool_calls
    return msg


def message_text(message: PlaygroundMessage) -> str:
    """
    The text of a message, with any media omitted.

    Lets a provider integration that cannot send media keep treating message
    content as a plain string.

    Args:
        message: The message to read.

    Returns:
        The message's text, with multiple text blocks joined by newlines.
    """
    content = message.get("content")
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    return "\n".join(block["text"] for block in content if block["type"] == "text")


def message_media(message: PlaygroundMessage) -> list[MediaContentBlock]:
    """
    The media blocks of a message, in the order they appear.

    Args:
        message: The message to read.

    Returns:
        The message's media blocks, empty if it carries none.
    """
    content = message.get("content")
    if content is None or isinstance(content, str):
        return []
    return [block for block in content if block["type"] == "media"]


def content_blocks(message: PlaygroundMessage) -> list[ContentBlock]:
    """
    The content of a message as an ordered block list.

    Args:
        message: The message to read.

    Returns:
        The message's blocks. String content becomes a single text block; empty
        string content yields no blocks.
    """
    content = message.get("content")
    if content is None:
        return []
    if isinstance(content, str):
        return [TextContentBlock(type="text", text=content)] if content else []
    return list(content)


def reject_media(messages: Iterable[PlaygroundMessage], *, provider: str) -> None:
    """
    Reject messages carrying media, for providers without media support yet.

    Fails loudly rather than sending the provider a prompt with its images
    silently removed.

    Args:
        messages: The messages about to be sent.
        provider: Human-readable provider name, used in the error message.

    Raises:
        BadRequest: Any message carries a media block.
    """
    for message in messages:
        if message_media(message):
            raise BadRequest(
                f"{provider} does not support image content in Phoenix yet. "
                f"Remove the image from the prompt, or run it against Google."
            )


# Mapping from OpenAI role strings to internal enum values
_ROLE_MAPPING = {
    "user": ChatCompletionMessageRole.USER,
    "assistant": ChatCompletionMessageRole.AI,
    "model": ChatCompletionMessageRole.AI,
    "system": ChatCompletionMessageRole.SYSTEM,
    "developer": ChatCompletionMessageRole.SYSTEM,
    "tool": ChatCompletionMessageRole.TOOL,
    # Also handle our internal names
    "ai": ChatCompletionMessageRole.AI,
}


def extract_value_from_path(data: dict[str, Any], path: str) -> Any:
    """
    Extract a value from a nested dictionary using dot-notation path.

    Args:
        data: The dictionary to extract from
        path: Dot-notation path (e.g., "messages" or "input.messages")

    Returns:
        The value at the specified path

    Raises:
        KeyError: If the path doesn't exist in the data
        TypeError: If the path traverses through a non-dict value
    """
    if not path:
        raise KeyError("Empty path provided")

    keys = path.split(".")
    current = data

    for key in keys:
        if not isinstance(current, dict):
            raise TypeError(f"Cannot traverse path '{path}': intermediate value is not a dict")
        if key not in current:
            raise KeyError(f"Key '{key}' not found in path '{path}'")
        current = current[key]

    return current


def _role_to_enum(role: str) -> ChatCompletionMessageRole:
    """
    Convert an OpenAI-format role string to ChatCompletionMessageRole enum.

    Args:
        role: Role string (e.g., "user", "assistant", "system", "tool")

    Returns:
        Corresponding ChatCompletionMessageRole enum value
    """
    role_lower = role.lower()
    if role_lower not in _ROLE_MAPPING:
        # Default to USER for unknown roles
        return ChatCompletionMessageRole.USER
    return _ROLE_MAPPING[role_lower]


def convert_openai_message_to_internal(message: dict[str, Any]) -> PlaygroundMessage:
    """
    Convert an OpenAI-format message to the internal PlaygroundMessage dict.

    OpenAI format:
        {"role": "user", "content": "Hello"}
        {"role": "assistant", "content": "Hi", "tool_calls": [...]}
        {"role": "tool", "content": "result", "tool_call_id": "call_123"}

    Internal format:
        PlaygroundMessage dict with role, content, tool_call_id (optional), tool_calls (optional)

    Args:
        message: Message dict in OpenAI format

    Returns:
        PlaygroundMessage dict
    """
    role = _role_to_enum(message.get("role", "user"))

    # Content can be a string or null
    content = message.get("content")
    if content is None:
        content = ""
    elif not isinstance(content, str):
        # Handle array content (multimodal) by extracting text parts
        if isinstance(content, list):
            text_parts = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))
                elif isinstance(part, str):
                    text_parts.append(part)
            content = "\n".join(text_parts)
        else:
            content = str(content)

    # Extract tool_call_id (for tool response messages)
    tool_call_id: Optional[str] = message.get("tool_call_id")

    # Extract tool_calls (for assistant messages with function calls)
    tool_calls = message.get("tool_calls")

    return create_playground_message(role, content, tool_call_id, tool_calls)


def extract_and_convert_example_messages(
    data: dict[str, Any],
    path: str,
) -> list[PlaygroundMessage]:
    """
    Extract messages from a dataset example and convert them to internal format.

    This is the main entry point for the appended messages feature. It extracts
    a list of messages from a dataset example's input using a dot-notation path,
    then converts each message from OpenAI format to the internal PlaygroundMessage
    format.

    Args:
        data: The dataset example input dictionary
        path: Dot-notation path to the messages list

    Returns:
        List of PlaygroundMessage dicts ready to be appended to a prompt

    Raises:
        KeyError: If the path doesn't exist in the data
        TypeError: If the value at the path is not a list
        ValueError: If messages in the list are not valid message dicts
    """
    messages_raw = extract_value_from_path(data, path)

    if not isinstance(messages_raw, list):
        raise TypeError(f"Value at path '{path}' is not a list (got {type(messages_raw).__name__})")

    messages: list[PlaygroundMessage] = []
    for i, msg in enumerate(messages_raw):
        if not isinstance(msg, dict):
            raise ValueError(f"Message at index {i} is not a dict (got {type(msg).__name__})")
        messages.append(convert_openai_message_to_internal(msg))

    return messages


def prompt_chat_template_to_playground_messages(
    template: PromptChatTemplate,
) -> list[PlaygroundMessage]:
    """
    Convert a PromptChatTemplate (DB model) into the list of PlaygroundMessage
    dicts used by LLM streaming clients.

    Content part mapping:
      - text part        → text block
      - image part       → image block, ordered among the text blocks as authored
      - tool_call part   → tool_calls entry on the message
      - tool_result part → text block + tool_call_id on the message

    Media blocks carry only their reference here; call :func:`resolve_message_media`
    to attach the bytes a provider needs.
    """
    messages: list[PlaygroundMessage] = []
    for msg in template.messages:
        role = _role_to_enum(msg.role)
        blocks: list[ContentBlock] = []
        tool_calls: list[PlaygroundToolCall] = []
        tool_call_id: Optional[str] = None

        if isinstance(msg.content, str):
            if msg.content:
                blocks.append(TextContentBlock(type="text", text=msg.content))
        else:
            for part in msg.content:
                if part.type == "text":
                    blocks.append(TextContentBlock(type="text", text=part.text))
                elif part.type == "tool_call":
                    try:
                        parsed_args: Any = json.loads(part.tool_call.arguments)
                    except (ValueError, TypeError):
                        parsed_args = {}
                    tool_calls.append(
                        PlaygroundToolCall(
                            id=part.tool_call_id,
                            function=PlaygroundToolCallFunction(
                                name=part.tool_call.name,
                                arguments=parsed_args,
                            ),
                        )
                    )
                elif part.type == "tool_result":
                    tool_call_id = part.tool_call_id
                    result = part.tool_result
                    if isinstance(result, str):
                        blocks.append(TextContentBlock(type="text", text=result))
                    elif result is not None:
                        blocks.append(TextContentBlock(type="text", text=json.dumps(result)))
                elif part.type == "image" or part.type == "file":
                    source = media_source(part)
                    blocks.append(
                        MediaContentBlock(
                            type="media",
                            kind=part.type,
                            url=source.url,
                            media_type=source.media_type,
                        )
                        if isinstance(source, MediaContent)
                        else MediaContentBlock(
                            type="media",
                            kind=part.type,
                            variable=source.variable,
                        )
                    )
                else:
                    assert_never(part)

        messages.append(
            create_playground_message(
                role=role,
                content=blocks,
                tool_call_id=tool_call_id,
                tool_calls=tool_calls if tool_calls else None,
            )
        )
    return messages


async def resolve_message_media(
    session: AsyncSession,
    messages: Iterable[PlaygroundMessage],
) -> list[PlaygroundMessage]:
    """
    Attach resolved bytes to every media block in the given messages.

    Call once the message list is final — after template formatting and after any
    per-example messages have been appended — so that a single batch resolves every
    reference across every message.

    Args:
        session: Session used to read Phoenix-hosted media.
        messages: Messages whose media should be resolved.

    Returns:
        New messages whose image blocks carry ``data`` and the authoritative
        ``media_type``. Messages without media are passed through unchanged.

    Raises:
        MediaResolutionError: A reference is malformed or names media that is not
            present.
    """
    message_list = list(messages)
    for message in message_list:
        for media_block in message_media(message):
            if "url" not in media_block:
                # formatted_messages fills a variable's reference in. Reaching here
                # means the message never went through it.
                name = media_block.get("variable", "an image")
                raise MediaResolutionError(f"No image reference was substituted for '{name}'.")
    urls = [block["url"] for message in message_list for block in message_media(message)]
    if not urls:
        return message_list

    resolved = await resolve_media(session, urls)
    output: list[PlaygroundMessage] = []
    for message in message_list:
        content = message.get("content")
        if isinstance(content, str) or not content:
            output.append(message)
            continue
        blocks: list[ContentBlock] = []
        for block in content:
            if block["type"] != "media":
                blocks.append(block)
                continue
            media = resolved[block["url"]]
            resolved_block = MediaContentBlock(
                type="media",
                kind=block["kind"],
                url=block["url"],
                media_type=media.media_type,
                data=media.content,
            )
            if media.file_name is not None:
                resolved_block["file_name"] = media.file_name
            if (variable := block.get("variable")) is not None:
                resolved_block["variable"] = variable
            blocks.append(resolved_block)
        output.append({**message, "content": blocks})
    return output


def build_template_variables(
    *,
    input_data: dict[str, Any],
    output_data: Any,
    metadata: dict[str, Any],
    template_variables_path: Optional[str],
) -> Any:
    """
    Build template variables for a dataset revision based on the configured path.

    This function constructs the full context dictionary with input, reference (output),
    and metadata, then extracts the appropriate subset based on the template_variables_path
    configuration.

    Args:
        input_data: The dataset example input dictionary
        output_data: The dataset example expected output (reference)
        metadata: The dataset example metadata dictionary
        template_variables_path: Dot-notation path to extract variables from context,
                                or empty string/None to use the full context

    Returns:
        Dictionary of template variables to use for prompt formatting

    Raises:
        KeyError: If the path doesn't exist in the context
        TypeError: If the path traverses through a non-dict value
    """
    # Build the full context with input, reference (expected output), and metadata
    full_context: dict[str, Any] = {
        "input": input_data,
        "reference": output_data,
        "metadata": metadata,
    }

    # Resolve template variables based on the configured path
    if template_variables_path:
        return extract_value_from_path(full_context, template_variables_path)
    else:
        return full_context


def formatted_messages(
    *,
    messages: Iterable[PlaygroundMessage],
    template_format: PromptTemplateFormat,
    template_variables: Mapping[str, Any],
) -> list[PlaygroundMessage]:
    """
    Formats the messages using the given template options.

    Text is formatted, and a media block naming a variable takes its reference from
    that variable — the same substitution, applied to a different kind of content.
    A media block already holding a stored reference is left alone.

    Raises:
        BadRequest: A media variable has no value among the template variables.
    """
    messages_list = list(messages)
    if not messages_list:
        return []
    template_formatter = _template_formatter(template_format=template_format)
    result: list[PlaygroundMessage] = []
    for msg in messages_list:
        content = msg.get("content")
        formatted_content: Union[str, list[ContentBlock]]
        if isinstance(content, str) or content is None:
            formatted_content = template_formatter.format(content or "", **template_variables)
        else:
            blocks: list[ContentBlock] = []
            for block in content:
                if block["type"] == "text":
                    blocks.append(
                        TextContentBlock(
                            type="text",
                            text=template_formatter.format(block["text"], **template_variables),
                        )
                    )
                elif (variable := block.get("variable")) is not None:
                    blocks.append(
                        MediaContentBlock(
                            type="media",
                            kind=block["kind"],
                            variable=variable,
                            url=_media_variable_value(variable, template_variables),
                        )
                    )
                else:
                    blocks.append(block)
            formatted_content = blocks
        result.append(
            create_playground_message(
                msg["role"],
                formatted_content,
                msg.get("tool_call_id"),
                msg.get("tool_calls"),
            )
        )
    return result


def _media_variable_value(variable: str, template_variables: Mapping[str, Any]) -> str:
    """
    The media reference supplied for a media variable.

    Args:
        variable: The media variable's name.
        template_variables: The values supplied for this run.

    Returns:
        The reference to resolve, e.g. ``phoenix://media/<sha256>``.

    Raises:
        BadRequest: No value was supplied, or the value is not a reference string.
    """
    if variable not in template_variables:
        raise BadRequest(f"No image was supplied for '{variable}'.")
    value = template_variables[variable]
    if not isinstance(value, str) or not value.strip():
        raise BadRequest(
            f"The value supplied for '{variable}' is not an image reference. "
            f"Upload an image for it and try again."
        )
    return value


def _template_formatter(template_format: PromptTemplateFormat) -> TemplateFormatter:
    """
    Instantiates the appropriate template formatter for the template format
    """
    # Use equality, not identity: ORM / DB round-trips may yield plain strings that match
    # enum values (e.g. "F_STRING") but are not the same object as PromptTemplateFormat.*.
    if template_format == PromptTemplateFormat.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_format == PromptTemplateFormat.F_STRING:
        return FStringTemplateFormatter()
    if template_format == PromptTemplateFormat.NONE:
        return NoOpFormatter()
    assert_never(template_format)
