from typing import Optional

import strawberry


@strawberry.type
class CostBreakdown:
    tokens: Optional[float] = strawberry.field(
        default=None,
        description="Total number of tokens, including tokens for which no cost was computed.",
    )
    cost: Optional[float] = None
