"""How media appears in a trace."""

import openinference.instrumentation as oi

from phoenix.server.api.helpers.message_media import ContentBlock, MediaContentBlock

from ._support import media_file_name


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
