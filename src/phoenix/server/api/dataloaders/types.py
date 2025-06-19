from dataclasses import dataclass, field
from functools import cached_property
from typing import Optional


@dataclass(frozen=True)
class CostBreakdown:
    tokens: Optional[float] = None
    cost: Optional[float] = None

    @cached_property
    def cost_per_token(self) -> Optional[float]:
        if self.tokens and self.cost:
            return self.cost / self.tokens
        return None


@dataclass(frozen=True)
class SpanCostSummary:
    prompt: CostBreakdown = field(default_factory=CostBreakdown)
    completion: CostBreakdown = field(default_factory=CostBreakdown)
    total: CostBreakdown = field(default_factory=CostBreakdown)


@dataclass(frozen=True)
class SpanCostDetailSummaryEntry:
    token_type: str
    is_prompt: bool
    value: CostBreakdown = field(default_factory=CostBreakdown)
