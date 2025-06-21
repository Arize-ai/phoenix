from typing import Optional

import strawberry


@strawberry.type
class CostBreakdown:
    tokens: Optional[float] = None
    cost: Optional[float] = None

    @strawberry.field
    def cost_per_token(self) -> Optional[float]:
        if self.tokens and self.cost:
            return self.cost / self.tokens
        return None
