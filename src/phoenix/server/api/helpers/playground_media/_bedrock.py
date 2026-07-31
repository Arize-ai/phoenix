"""Bedrock Converse's media wire format."""

from typing import TYPE_CHECKING, Any

from phoenix.server.api.helpers.message_helpers import (
    PlaygroundMessage,
)
from phoenix.server.api.helpers.message_media import (
    message_media,
    message_text,
)

from ._allowlists import (
    BEDROCK_DOCUMENT_FORMATS,
    BEDROCK_IMAGE_FORMATS,
    BEDROCK_SUPPORTED_FILE_MEDIA_TYPES,
    BEDROCK_SUPPORTED_IMAGE_MEDIA_TYPES,
)
from ._support import media_file_name, require_resolved_media

if TYPE_CHECKING:
    from types_aiobotocore_bedrock_runtime.type_defs import ContentBlockTypeDef


def bedrock_content_blocks(
    message: PlaygroundMessage,
    *,
    provider: str = "Amazon Bedrock",
) -> list["ContentBlockTypeDef"]:
    """
    A user turn's content as Converse blocks.

    Converse is the odd one out: it takes the raw bytes rather than base64, and
    names a *format* (``png``) rather than a media type (``image/png``). Sending
    base64 here would be accepted by the SDK and silently corrupt the image.

    Args:
        message: The message to convert, media already resolved.
        provider: Human-readable provider name, for error messages.

    Returns:
        The text block followed by one block per piece of media. Empty when the
        message has neither.

    Raises:
        BadRequest: Media is unresolved, or of a type Bedrock does not accept.
    """
    from types_aiobotocore_bedrock_runtime.type_defs import ContentBlockTypeDef

    blocks: list[ContentBlockTypeDef] = []
    if content := message_text(message):
        blocks.append(ContentBlockTypeDef(text=content))
    for block in message_media(message):
        if block["kind"] == "file":
            data, media_type = require_resolved_media(
                block,
                provider=provider,
                supported_media_types=BEDROCK_SUPPORTED_FILE_MEDIA_TYPES,
            )
            # Converse requires a name on a document, unlike an image.
            document_block: Any = {
                "format": BEDROCK_DOCUMENT_FORMATS[media_type],
                "name": media_file_name(block),
                "source": {"bytes": data},
            }
            blocks.append(ContentBlockTypeDef(document=document_block))
            continue
        data, media_type = require_resolved_media(
            block,
            provider=provider,
            supported_media_types=BEDROCK_SUPPORTED_IMAGE_MEDIA_TYPES,
        )
        image_block: Any = {
            "format": BEDROCK_IMAGE_FORMATS[media_type],
            "source": {"bytes": data},
        }
        blocks.append(ContentBlockTypeDef(image=image_block))
    return blocks
