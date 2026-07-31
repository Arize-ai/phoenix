"""OpenAI's media wire formats — Chat Completions and Responses."""

from typing import TYPE_CHECKING, Any, Optional

from phoenix.server.api.helpers.message_helpers import (
    PlaygroundMessage,
    message_media,
    message_text,
)

from ._allowlists import (
    OPENAI_SUPPORTED_FILE_MEDIA_TYPES,
    OPENAI_SUPPORTED_IMAGE_MEDIA_TYPES,
)
from ._support import media_data_url, media_file_name

if TYPE_CHECKING:
    from openai.types.chat import (
        ChatCompletionContentPartParam,
        ChatCompletionUserMessageParam,
    )


def openai_chat_content_parts(
    message: PlaygroundMessage,
    *,
    provider: str,
) -> Optional[list["ChatCompletionContentPartParam"]]:
    """
    A user turn's content as Chat Completions parts, when it carries media.

    A message with media cannot be sent as a bare string; it becomes an ordered
    part list, media following the text as the editor lays it out.

    Three clients speak this format — the streaming client and both reasoning
    clients — and they used to hold a copy of this each. Copies are worse than the
    duplication suggests: a change applied to two of the three leaves the third
    quietly sending something different.

    Args:
        message: The message to convert, media already resolved.
        provider: Human-readable provider name, for error messages.

    Returns:
        The content parts, or None when the message carries no media and should be
        sent as a plain string instead.

    Raises:
        BadRequest: Media is unresolved, or of a type OpenAI does not accept.
    """
    media = message_media(message)
    if not media:
        return None

    from openai.types.chat import (
        ChatCompletionContentPartImageParam,
        ChatCompletionContentPartParam,
        ChatCompletionContentPartTextParam,
    )

    parts: list[ChatCompletionContentPartParam] = []
    if content := message_text(message):
        parts.append(ChatCompletionContentPartTextParam(type="text", text=content))
    for block in media:
        if block["kind"] == "file":
            # Chat Completions carries a document as a `file` part, and requires a
            # filename alongside the payload.
            file_part: Any = {
                "type": "file",
                "file": {
                    "filename": media_file_name(block),
                    "file_data": media_data_url(
                        block,
                        provider=provider,
                        supported_media_types=OPENAI_SUPPORTED_FILE_MEDIA_TYPES,
                    ),
                },
            }
            parts.append(file_part)
            continue
        parts.append(
            ChatCompletionContentPartImageParam(
                type="image_url",
                image_url={
                    "url": media_data_url(
                        block,
                        provider=provider,
                        supported_media_types=OPENAI_SUPPORTED_IMAGE_MEDIA_TYPES,
                    )
                },
            )
        )
    return parts


def openai_responses_content_parts(
    message: PlaygroundMessage,
    *,
    provider: str,
) -> Optional[list[Any]]:
    """
    A user turn's content as Responses API parts, when it carries media.

    The Responses API names its parts differently from Chat Completions —
    `input_image` and `input_file` rather than `image_url` and `file` — so the two
    formats cannot share a builder even though they come from the same SDK.

    Args:
        message: The message to convert, media already resolved.
        provider: Human-readable provider name, for error messages.

    Returns:
        The input parts, or None when the message carries no media.

    Raises:
        BadRequest: Media is unresolved, or of a type OpenAI does not accept.
    """
    media = message_media(message)
    if not media:
        return None

    from openai.types.responses import ResponseInputImageParam, ResponseInputTextParam
    from openai.types.responses.response_input_file_param import ResponseInputFileParam

    parts: list[Any] = []
    if content := message_text(message):
        parts.append(ResponseInputTextParam(type="input_text", text=content))
    for block in media:
        if block["kind"] == "file":
            parts.append(
                ResponseInputFileParam(
                    type="input_file",
                    filename=media_file_name(block),
                    file_data=media_data_url(
                        block,
                        provider=provider,
                        supported_media_types=OPENAI_SUPPORTED_FILE_MEDIA_TYPES,
                    ),
                )
            )
            continue
        parts.append(
            ResponseInputImageParam(
                type="input_image",
                detail="auto",
                image_url=media_data_url(
                    block,
                    provider=provider,
                    supported_media_types=OPENAI_SUPPORTED_IMAGE_MEDIA_TYPES,
                ),
            )
        )
    return parts


def openai_chat_media_message(
    message: PlaygroundMessage,
    *,
    provider: str,
) -> Optional["ChatCompletionUserMessageParam"]:
    """
    The Chat Completions user message for a turn carrying media, or None.

    Folds in the non-user rejection so the whole media concern is one call at each
    client. Three clients speak this format; leaving the guard at the call sites
    meant three copies of it, and a change applied to two of them would leave the
    third accepting media it should refuse.

    Args:
        message: The message to convert, media already resolved.
        provider: Human-readable provider name, for error messages.

    Returns:
        The user message param when the turn carries media, otherwise None — the
        caller should then build a plain-string message as usual.

    Raises:
        BadRequest: Media on a non-user turn, unresolved media, or a media type
            OpenAI does not accept.
    """
    from openai.types.chat import ChatCompletionUserMessageParam

    from phoenix.server.api.helpers.message_helpers import reject_media
    from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole

    if message["role"] is not ChatCompletionMessageRole.USER:
        # Only user turns carry media, enforced when a prompt version is written.
        # Fail loudly rather than drop an image that got here anyway.
        reject_media([message], provider=provider)
        return None
    parts = openai_chat_content_parts(message, provider=provider)
    if not parts:
        return None
    return ChatCompletionUserMessageParam(content=parts, role="user")
