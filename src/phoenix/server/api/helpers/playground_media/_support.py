"""Media checks and conversions every provider needs."""

import base64
from typing import Any

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.message_media import MediaContentBlock


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
