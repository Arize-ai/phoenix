"""
Media inside a playground message.

Held apart from `message_helpers` so the media feature reads as one module. That one
describes how a prompt template becomes the message dicts an LLM client takes, and
media touches nearly every stage of it: the block a content part becomes, the
substitution a named media variable goes through, the bytes a provider needs. Keeping
that here leaves the pipeline itself legible.

A message's content is either a plain string or an ordered list of blocks. Media
forces the list: a string cannot say where an image sits relative to the text.
"""

from typing import TYPE_CHECKING, Any, Iterable, Literal, Mapping, Union

from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Required, TypeAlias, TypedDict

from phoenix.db.types.media import MediaContent
from phoenix.db.types.media_parts import MediaContentPart, media_source
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.media import MediaResolutionError, resolve_media
from phoenix.utilities.template_formatters import TemplateFormatter

if TYPE_CHECKING:
    from phoenix.server.api.helpers.message_helpers import PlaygroundMessage


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


def message_text(message: "PlaygroundMessage") -> str:
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


def message_media(message: "PlaygroundMessage") -> list[MediaContentBlock]:
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


def content_blocks(message: "PlaygroundMessage") -> list[ContentBlock]:
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


def reject_media(messages: Iterable["PlaygroundMessage"], *, provider: str) -> None:
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


async def resolve_message_media(
    session: AsyncSession,
    messages: Iterable["PlaygroundMessage"],
) -> list["PlaygroundMessage"]:
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
    output: list["PlaygroundMessage"] = []
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


def media_content_block(part: MediaContentPart) -> MediaContentBlock:
    """
    The block an image or file content part becomes.

    Args:
        part: The content part to convert.

    Returns:
        A block holding the stored reference, or naming the variable that will supply
        one when the prompt runs.
    """
    source = media_source(part)
    if isinstance(source, MediaContent):
        return MediaContentBlock(
            type="media",
            kind=part.type,
            url=source.url,
            media_type=source.media_type,
        )
    return MediaContentBlock(type="media", kind=part.type, variable=source.variable)


def format_message_content(
    content: Union[str, list["ContentBlock"], None],
    *,
    template_formatter: TemplateFormatter,
    template_variables: Mapping[str, Any],
) -> Union[str, list["ContentBlock"]]:
    """
    A message's content with its variables substituted.

    Text is formatted. A media block naming a variable takes its reference from that
    variable — the same substitution, applied to a different kind of content. A media
    block already holding a stored reference is left alone.

    Args:
        content: The message's content, string or blocks.
        template_formatter: The formatter for this template format.
        template_variables: The values supplied for this run.

    Returns:
        The content, in whichever shape it arrived.

    Raises:
        BadRequest: A media variable has no value among the template variables.
    """
    if isinstance(content, str) or content is None:
        return template_formatter.format(content or "", **template_variables)
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
    return blocks
