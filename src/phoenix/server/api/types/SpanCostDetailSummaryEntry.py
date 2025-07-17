import strawberry

from phoenix.server.api.types.CostBreakdown import CostBreakdown


@strawberry.type
class SpanCostDetailSummaryEntry:
    token_type: str
    is_prompt: bool
    value: CostBreakdown = strawberry.field(default_factory=CostBreakdown)
