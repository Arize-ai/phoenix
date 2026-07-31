"""
Media surviving the conversion from a prompt template to playground messages.

Kept out of `test_message_helpers` so upstream's file stays as upstream wrote it.
"""

from phoenix.db.types.media import MediaContent
from phoenix.db.types.media_parts import ImageContentPart
from phoenix.db.types.prompts import PromptChatTemplate, PromptMessage, TextContentPart
from phoenix.server.api.helpers.message_helpers import (
    prompt_chat_template_to_playground_messages,
)
from phoenix.server.api.helpers.message_media import message_media


class TestMediaIsNotSilentlyDropped:
    """
    Media must survive the conversion into playground messages. Whether it can then
    be sent is the provider integration's call — one that fails loudly rather than
    dropping the image (see ``reject_media``).
    """

    def test_image_content_becomes_a_block_rather_than_vanishing(self) -> None:
        url = f"phoenix://media/{'a' * 64}"
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        TextContentPart(type="text", text="what is this?"),
                        ImageContentPart(
                            type="image",
                            image=MediaContent(url=url, media_type="image/png"),
                        ),
                    ],
                )
            ],
        )
        (message,) = prompt_chat_template_to_playground_messages(template)
        content = message["content"]
        assert not isinstance(content, str)
        assert [block["type"] for block in content] == ["text", "media"]
        assert message_media(message)[0]["kind"] == "image"
        assert message_media(message)[0]["url"] == url
