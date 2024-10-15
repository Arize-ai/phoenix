from typing import List, Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON


@strawberry.input
class InvocationParameters:
    """
    Invocation parameters interface shared between different providers.
    """

    temperature: Optional[float] = UNSET
    max_completion_tokens: Optional[int] = UNSET
    max_tokens: Optional[int] = UNSET
    top_p: Optional[float] = UNSET
    stop: Optional[List[str]] = UNSET
    seed: Optional[int] = UNSET
    tool_choice: Optional[JSON] = UNSET
