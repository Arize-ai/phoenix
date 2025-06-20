from typing import Optional

import strawberry


@strawberry.type
class TokenCost:
    input: Optional[float] = None
    output: Optional[float] = None
    prompt: Optional[float] = None
    completion: Optional[float] = None
    cache_read: Optional[float] = None
    cache_write: Optional[float] = None
    prompt_audio: Optional[float] = None
    completion_audio: Optional[float] = None
    reasoning: Optional[float] = None
    total: Optional[float] = None
