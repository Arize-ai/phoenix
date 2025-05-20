from typing import Optional

import strawberry


@strawberry.type
class TokenCountPromptDetails:
    cache_read: Optional[int]
    cache_write: Optional[int]
    audio: Optional[int]
