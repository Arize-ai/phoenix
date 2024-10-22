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
    tool_calls: Optional[List[JSON]] = strawberry.field(
        description="The tool calls that were made in the message",
        default=UNSET,
    )
    tool_call_id: Optional[str] = strawberry.field(
        description="The ID that corresponds to a prior tool call. Used to link a tool message to a pre-existing tool call.",  # noqa: E501
        default=UNSET,
    )
