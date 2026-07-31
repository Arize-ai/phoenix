"""Gemini's media wire format."""

from typing import TYPE_CHECKING

from phoenix.server.api.helpers.message_helpers import PlaygroundMessage, content_blocks

from ._allowlists import GOOGLE_SUPPORTED_MEDIA_TYPES
from ._support import require_resolved_media

if TYPE_CHECKING:
    from google.genai.types import PartDict


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
