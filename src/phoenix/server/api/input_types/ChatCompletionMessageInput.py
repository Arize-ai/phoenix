from typing import List, Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON

from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole


@strawberry.input
class ChatCompletionMessageInput:
    role: ChatCompletionMessageRole
    content: JSON = strawberry.field(
        description="The content of the message as JSON to support various kinds of text"
    )
    tool_calls: Optional[List[JSON]] = UNSET
    """The tool calls that were made in the message"""
    tool_call_id: Optional[str] = UNSET
    """The ID of the tool call that was made in a prior message"""
