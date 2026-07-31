"""Anthropic's media wire format."""

import base64
from collections.abc import Sequence
from typing import Any

from phoenix.server.api.helpers.message_media import MediaContentBlock

from ._allowlists import (
    ANTHROPIC_SUPPORTED_FILE_MEDIA_TYPES,
    ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES,
)
from ._support import require_resolved_media


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
