from typing import Optional

import strawberry


@strawberry.type
class CostBreakdown:
    tokens: float = 0.0
    cost: float = 0.0

    @strawberry.field
    def cost_per_token(self) -> Optional[float]:
        if self.tokens:
            return self.cost / self.tokens
        return None
