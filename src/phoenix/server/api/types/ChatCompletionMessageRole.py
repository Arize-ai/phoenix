from enum import Enum

import strawberry


@strawberry.enum
class ChatCompletionMessageRole(Enum):
    USER = "USER"
    SYSTEM = "SYSTEM"
    TOOL = "TOOL"
    AI = "AI"  # E.g. the assistant. Normalize to AI for consistency.
