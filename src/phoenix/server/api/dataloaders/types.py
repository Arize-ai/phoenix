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

    def __add__(self, other: "CostBreakdown") -> "CostBreakdown":
        tokens = (self.tokens or 0) + (other.tokens or 0)
        cost = (self.cost or 0) + (other.cost or 0)
        return CostBreakdown(tokens=tokens, cost=cost)


@dataclass(frozen=True)
class SpanCostSummary:
    prompt: CostBreakdown = field(default_factory=CostBreakdown)
    completion: CostBreakdown = field(default_factory=CostBreakdown)
    total: CostBreakdown = field(default_factory=CostBreakdown)

    def __add__(self, other: "SpanCostSummary") -> "SpanCostSummary":
        return SpanCostSummary(
            prompt=self.prompt + other.prompt,
            completion=self.completion + other.completion,
            total=self.total + other.total,
        )


@dataclass(frozen=True)
class SpanCostDetailSummaryEntry:
    token_type: str
    is_prompt: bool
    value: CostBreakdown = field(default_factory=CostBreakdown)
