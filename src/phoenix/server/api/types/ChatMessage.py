from typing import Optional

import strawberry

from phoenix.db.types.chat_message import MessageEntry


@strawberry.type
class ChatMessage:
    role: Optional[str]
    content: Optional[str]


def to_gql_chat_message(
    message_entry: Optional[MessageEntry],
) -> Optional[ChatMessage]:
    if not message_entry:
        return None
    return ChatMessage(
        role=message_entry.message.role,
        content=message_entry.message.content,
    )
