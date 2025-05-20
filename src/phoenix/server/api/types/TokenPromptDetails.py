from typing import Optional

import strawberry


@strawberry.type
class TokenPromptDetails:
    cache_read: Optional[int]
    cache_write: Optional[int]
    audio: Optional[int]
