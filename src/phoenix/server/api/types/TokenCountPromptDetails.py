from typing import Optional

import strawberry


@strawberry.type(
    description=(
        "Breakdown of an LLM span's prompt tokens by kind. These counts are a "
        "decomposition of the span's prompt token count, not additive on top "
        "of it, and are typically used for cost analysis."
    ),
)
class TokenCountPromptDetails:
    cache_read: Optional[int] = strawberry.field(
        description="Prompt tokens served from the provider's prompt cache.",
        default=None,
    )
    cache_write: Optional[int] = strawberry.field(
        description="Prompt tokens written into the provider's prompt cache.",
        default=None,
    )
    audio: Optional[int] = strawberry.field(
        description="Prompt tokens that were audio tokens.",
        default=None,
    )
