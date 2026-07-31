"""
Media handling shared by the playground's provider clients.

Kept apart from `playground_clients` deliberately. That module is where new
providers and models land, so it changes constantly; media support is orthogonal to
it and would otherwise be interleaved with every one of those changes. Holding this
code in its own module keeps each concern reviewable on its own, and keeps a fork
carrying media support clear of upstream's churn in the busier file.

Three kinds of thing live here:

* helpers every provider needs — asserting media was resolved, turning a block into
  a data URL, naming a document;
* what each provider will accept, since the allowlists differ per provider and are
  the part most likely to need revising as providers add formats;
* the per-provider payload builders, which take a message and return that
  provider's own content shape.
"""

import base64
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

import openinference.instrumentation as oi

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.message_helpers import (
    ContentBlock,
    MediaContentBlock,
    PlaygroundMessage,
    content_blocks,
)

if TYPE_CHECKING:
    from google.genai.types import PartDict


def require_resolved_media(
    block: MediaContentBlock,
    *,
    provider: str,
    supported_media_types: frozenset[str],
) -> tuple[bytes, str]:
    """
    The bytes and media type to send for an image, checked against one provider.

    Args:
        block: The image block, already through `resolve_message_media`.
        provider: Human-readable provider name, for the error message.
        supported_media_types: What this provider accepts.

    Returns:
        The image bytes and its lowercased media type.

    Raises:
        BadRequest: The block never had its media resolved, or its type is one this
            provider does not accept.
    """
    data = block.get("data")
    media_type = block.get("media_type")
    if data is None or media_type is None:
        raise BadRequest(
            "Prompt media was not resolved before the request was sent. This is a bug in Phoenix."
        )
    media_type = media_type.lower()
    if media_type not in supported_media_types:
        raise BadRequest(
            f"{provider} does not accept {media_type} images. Supported types: "
            f"{', '.join(sorted(supported_media_types))}."
        )
    return data, media_type


def media_file_name(block: MediaContentBlock) -> str:
    """
    A filename for a document, synthesising one when none was stored.

    OpenAI's file part and Bedrock's document block both require a name. Media
    uploaded before names were recorded has none, and the providers only need the
    name to be present and sensibly suffixed.

    Args:
        block: The media block, already resolved.

    Returns:
        The stored name, or one derived from the digest.
    """
    if name := block.get("file_name"):
        return name
    digest = (block.get("url") or "").rsplit("/", 1)[-1][:12] or "document"
    suffix = "pdf" if block.get("media_type") == "application/pdf" else "bin"
    return f"{digest}.{suffix}"


def media_data_url(block: MediaContentBlock, **kwargs: Any) -> str:
    """
    An image block as a base64 ``data:`` URL.

    For providers whose wire format takes a URL rather than raw bytes. Phoenix
    always inlines the bytes it holds rather than passing a third-party URL
    through, so a run never depends on an outside host.

    Args:
        block: The image block, already resolved.
        **kwargs: Forwarded to :func:`require_resolved_media`.

    Returns:
        A ``data:<media_type>;base64,<payload>`` URL.
    """
    data, media_type = require_resolved_media(block, **kwargs)
    return f"data:{media_type};base64,{base64.b64encode(data).decode()}"


# OpenAI and the providers that speak its wire format.
OPENAI_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    ("image/png", "image/jpeg", "image/gif", "image/webp")
)

# Anthropic rejects HEIC/HEIF, which Google accepts.
ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    ("image/png", "image/jpeg", "image/gif", "image/webp")
)

OPENAI_SUPPORTED_FILE_MEDIA_TYPES = frozenset(("application/pdf",))
ANTHROPIC_SUPPORTED_FILE_MEDIA_TYPES = frozenset(("application/pdf",))
BEDROCK_DOCUMENT_FORMATS = {"application/pdf": "pdf"}
BEDROCK_SUPPORTED_FILE_MEDIA_TYPES = frozenset(BEDROCK_DOCUMENT_FORMATS)

# Bedrock Converse names formats rather than media types.
BEDROCK_IMAGE_FORMATS = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/gif": "gif",
    "image/webp": "webp",
}
BEDROCK_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(BEDROCK_IMAGE_FORMATS)


GOOGLE_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    (
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/heic",
        "image/heif",
    )
)
"""
Image types Gemini accepts as inline data.

Narrower than the set Phoenix will store: Gemini does not accept GIF.
"""

GOOGLE_SUPPORTED_MEDIA_TYPES = GOOGLE_SUPPORTED_IMAGE_MEDIA_TYPES | frozenset(("application/pdf",))
"""
Everything Gemini accepts as inline data, documents included.

A PDF travels the same `inline_data` channel as an image, which is why Google was
the cheapest provider to extend to documents.
"""


def _document_trace_text(block: MediaContentBlock) -> str:
    """
    How a document appears in a trace.

    OpenInference has no message-content type for a document: `MessageContent` is a
    closed union of text, image and reasoning. Recording a PDF as an image made the
    trace UI try to draw it with an `<img>` tag, which renders as a broken image.
    Until the convention grows a document type, the document is named in a text
    block instead. The reference is included, so the trace still identifies exactly
    which bytes were sent and they remain retrievable.

    Args:
        block: The media block, already through `resolve_message_media`.

    Returns:
        A one-line description of the document.
    """
    # Plain prose, no markdown syntax: the trace UI renders message text as
    # markdown, and brackets or a bare newline would render as something other
    # than what was written.
    media_type = block.get("media_type") or "application/octet-stream"
    return f"Document: {media_file_name(block)} ({media_type}), stored at {block.get('url', '')}"


def oi_message_content(block: ContentBlock) -> oi.MessageContent:
    """
    One block of a message's content, as OpenInference records it.

    Args:
        block: A text or media block, media already resolved.

    Returns:
        The matching OpenInference message content.
    """
    if block["type"] == "text":
        return oi.TextMessageContent(type="text", text=block["text"])
    if block["kind"] == "image":
        return oi.ImageMessageContent(type="image", image=oi.Image(url=block["url"]))
    return oi.TextMessageContent(type="text", text=_document_trace_text(block))


def anthropic_media_content(
    content: str,
    media: Sequence[MediaContentBlock],
) -> list[Any]:
    """
    Build the content blocks for a user turn carrying images.

    Anthropic takes the bytes base64-encoded with the media type alongside,
    rather than as a data URL.

    Args:
        content: The message's text, which may be empty.
        media: The message's images, already resolved.

    Returns:
        Text-then-image content blocks, in the order the editor lays them out.

    Raises:
        BadRequest: An image is unresolved or of a type Anthropic rejects.
    """
    from anthropic.types import ImageBlockParam, TextBlockParam

    blocks: list[Any] = []
    if content:
        blocks.append(TextBlockParam(type="text", text=content))
    for block in media:
        if block["kind"] == "file":
            data, media_type = require_resolved_media(
                block,
                provider="Anthropic",
                supported_media_types=ANTHROPIC_SUPPORTED_FILE_MEDIA_TYPES,
            )
            # Anthropic calls it a document; the source shape matches an image's.
            blocks.append(
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": base64.b64encode(data).decode(),
                    },
                }
            )
            continue
        data, media_type = require_resolved_media(
            block,
            provider="Anthropic",
            supported_media_types=ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES,
        )
        blocks.append(
            ImageBlockParam(
                type="image",
                source={
                    "type": "base64",
                    "media_type": media_type,  # type: ignore[typeddict-item]
                    "data": base64.b64encode(data).decode(),
                },
            )
        )
    return blocks


def google_parts(message: PlaygroundMessage) -> list["PartDict"]:
    """
    Convert a message's content blocks into Gemini parts, preserving order.

    Args:
        message: The message to convert. Media blocks must already carry
            resolved bytes.

    Returns:
        The Gemini parts for the message, always at least one.

    Raises:
        BadRequest: A media block reached the provider unresolved, or its type
            is one Gemini does not accept.
    """
    parts: list["PartDict"] = []
    for block in content_blocks(message):
        if block["type"] == "text":
            parts.append({"text": block["text"]})
            continue
        data, media_type = require_resolved_media(
            block,
            provider="Google",
            supported_media_types=GOOGLE_SUPPORTED_MEDIA_TYPES,
        )
        # Gemini carries a document exactly as it carries an image, so a PDF
        # needs no separate branch — only its media type differs.
        parts.append({"inline_data": {"mime_type": media_type, "data": data}})
    # Gemini rejects a Content with no parts.
    return parts or [{"text": ""}]
